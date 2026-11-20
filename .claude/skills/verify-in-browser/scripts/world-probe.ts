/**
 * Drives the real site headless (Chromium/Edge, swiftshader), picks a world in
 * the yard, rides in, then runs commands in order, saving screenshots.
 *
 *   bun --port 4310 ./index.html &            # dev server (any port: PORT=…)
 *   WORLD=astro OUT=/path/to/dir bun run .claude/skills/verify-in-browser/scripts/world-probe.ts \
 *     stop:dome  at:100,-40,1.5708  road:1:0.5  cruise  night  e  shot:name
 *
 * Commands
 *   stop:<tag>       park at a stop's forecourt facing its landmark
 *   at:x,z,heading   place the bike, screenshot, then hold throttle 4 s and print speed/surface
 *                    (heading: forward is (cos h, −sin h))
 *   road:<i>:<t>     place the bike on engine road i at parameter t (0–1)
 *   mark:<name>      look at a named landmark (w.data.landmarks), from a few metres off
 *   go:x,z,heading   place the bike and carry straight on (no settle, no screenshot)
 *   top:x,z,y        straight-down plan view of x,z from height y (north up); top:off to undo
 *   dump             write roads (every 4th point), stops and landmarks to OUT/world.json (for maps)
 *   js:<expr>        print an expression evaluated in the page (e.g. on window.__world)
 *   wait:<ms>        wait (e.g. to catch an animation mid-way), then shot:<name>
 *   cruise           press "Cruise to next stop", 3 screenshots 15 s apart
 *   night            toggle night (N) and wait for the fade
 *   e                open the nearest stop's card, then close it
 *   shot:<name>      screenshot now
 * Env: WORLD (regex on the yard card, default "astro"), NIGHT=1 (start at night), PORT, OUT,
 *      CHROME_PATH, GPU=1 (use the real GPU via Metal: loads in seconds instead of minutes). Load takes ~150 s headless for big worlds; everything runs slowly under
 *      swiftshader, so compare ratios (uphill vs flat), not absolute speeds.
 */
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const out = process.env.OUT ?? `${process.env.TMPDIR ?? "/tmp"}/world-probe`;
await mkdir(out, { recursive: true });
const executablePath =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/chromium",
  ].find((p) => Bun.file(p).size > 0);
if (!executablePath) throw new Error("No Chromium-based browser found; set CHROME_PATH");
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  protocolTimeout: 900000,
  // GPU=1: the machine's real GPU (fast, and realistic for performance); default: software (works anywhere).
  args: process.env.GPU
    ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const p = await browser.newPage();
p.on("pageerror", (e) => console.log("pageerror", String(e)));
p.on("console", (m) => {
  if (m.type() === "error") console.log("console error", m.text().slice(0, 300));
});
await p.evaluateOnNewDocument(
  (v: string) => localStorage.setItem("portfolio:night", v),
  process.env.NIGHT ? "1" : "0",
);
await p.setViewport({ width: 1100, height: 680 });
await p.goto(`http://localhost:${process.env.PORT ?? 4310}/?debug`, { waitUntil: "domcontentloaded" });
await p.waitForSelector(".app.is-ready", { timeout: 120000 });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const card = () => p.evaluate(() => document.querySelector(".yard-card")?.textContent ?? "");
for (let k = 0; k < 8 && !new RegExp(process.env.WORLD ?? "astro", "i").test(await card()); k++) {
  await p.keyboard.press("ArrowRight");
  await wait(700);
}
const t0 = Date.now();
await p.click(".yard-card .ride");
await p.waitForSelector(".ridehud", { timeout: 600000 });
console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
await wait(10000);
const shot = (name: string) => p.screenshot({ path: `${out}/${name}.png` });
/** Place the bike where `body` (a function of w returning {x, z, h}) says. */
const place = async (name: string, body: string) => {
  await p.evaluate((body: string) => {
    const w = (window as any).__world;
    const at = new Function("w", body)(w);
    Object.assign(w.bike, { x: at.x, z: at.z, v: 0, vy: 0, air: false, heading: at.h ?? 0 });
    w.bike.y = w.ground.height(at.x, at.z);
  }, body);
  await wait(15000);
  await shot(name);
};
for (const a of process.argv.slice(2)) {
  if (a.startsWith("stop:")) {
    const tag = a.slice(5);
    await place(
      `stop-${tag}`,
      `const i = w.data.stops.findIndex((s) => s.tag === ${JSON.stringify(tag)}); const m = w.stops[i];
       return { x: m.park.x, z: m.park.z, h: Math.atan2(-(m.z - m.park.z), m.x - m.park.x) };`,
    );
  } else if (a.startsWith("at:")) {
    const [x, z, h] = a.slice(3).split(",").map(Number);
    await place(`at-${x}_${z}`, `return { x: ${x}, z: ${z}, h: ${h ?? 0} };`);
    await p.keyboard.down("ArrowUp");
    await wait(4000);
    await shot(`at-${x}_${z}-drive`);
    console.log(
      a,
      await p.evaluate(() => {
        const b = (window as any).__world.bike;
        return `v ${b.v.toFixed(2)} m/s on ${b.surface} at ${b.x.toFixed(1)},${b.z.toFixed(1)}`;
      }),
    );
    await p.keyboard.up("ArrowUp");
  } else if (a.startsWith("go:")) {
    const [x, z, h] = a.slice(3).split(",").map(Number);
    await p.evaluate(
      (x: number, z: number, h: number) => {
        const w = (window as any).__world;
        Object.assign(w.bike, { x, z, v: 0, vy: 0, air: false, heading: h });
        w.bike.y = w.ground.height(x, z);
      },
      x ?? 0,
      z ?? 0,
      h ?? 0,
    );
  } else if (a === "dump") {
    const j = await p.evaluate(() => {
      const w = (window as any).__world;
      const r1 = (v: number) => Math.round(v * 10) / 10;
      return JSON.stringify({
        roads: w.data.roads.map((r: any) =>
          r.road.samples.filter((_: unknown, i: number) => i % 4 === 0).map((q: any) => [r1(q.x), r1(q.z)]),
        ),
        stops: w.data.stops.map((s: any) => ({ id: s.id ?? s.title, x: r1(s.x), z: r1(s.z) })),
        landmarks: Object.fromEntries(
          Object.entries(w.data.landmarks ?? {}).map(([k, m]: [string, any]) => [k, [r1(m.x), r1(m.z)]]),
        ),
      });
    });
    await Bun.write(`${out}/world.json`, j);
  } else if (a.startsWith("top:")) {
    // A straight-down view of x,z from height y (north up), for checking layouts as a plan.
    // "top:off" hands the camera back.
    const [x, z, y] = a.slice(4).split(",").map(Number);
    await p.evaluate(
      (x: number, z: number, y: number, off: boolean) => {
        const cam = (window as any).__world.camera;
        cam.__orig ??= cam.updateMatrixWorld.bind(cam);
        if (off) {
          cam.updateMatrixWorld = cam.__orig;
          return;
        }
        cam.updateMatrixWorld = (f?: boolean) => {
          // High plan views reach past the riding camera's far plane.
          if (cam.far < y * 1.5) {
            cam.far = y * 1.5;
            cam.updateProjectionMatrix();
          }
          cam.position.set(x, y, z);
          cam.up.set(0, 0, -1);
          cam.lookAt(x, 0, z);
          cam.__orig(f);
        };
      },
      x ?? 0,
      z ?? 0,
      y ?? 120,
      a === "top:off",
    );
    await wait(1500);
    if (a !== "top:off") await shot(`top-${x}_${z}`);
  } else if (a.startsWith("js:")) {
    // Prints an expression evaluated in the page (window.__world is the live world).
    console.log(a, "=>", JSON.stringify(await p.evaluate(a.slice(3))));
  } else if (a.startsWith("wait:")) {
    await wait(Number(a.slice(5)));
  } else if (a.startsWith("mark:")) {
    // A named landmark (w.data.landmarks), from a few metres off.
    const key = a.slice(5);
    await place(
      `mark-${key}`,
      `const m = w.data.landmarks[${JSON.stringify(key)}]; return { x: m.x + 14, z: m.z + 14, h: Math.atan2(14, -14) };`,
    );
  } else if (a.startsWith("road:")) {
    const [, i, t] = a.split(":");
    await place(
      `road${i}-${t}`,
      `const q = w.data.roads[${i}].road.at(${t}); return { x: q.p.x, z: q.p.z, h: q.heading + Math.PI };`,
    );
  } else if (a === "cruise") {
    await p.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((x) => /cruise/i.test(x.textContent ?? ""))
        ?.click(),
    );
    for (let k = 0; k < 3; k++) {
      await wait(15000);
      await shot(`cruise-${k}`);
    }
  } else if (a === "night") {
    await p.keyboard.press("n");
    await wait(10000);
  } else if (a === "e") {
    await p.keyboard.press("e");
    await wait(6000);
    await shot("card");
    await p.keyboard.press("Escape");
    await wait(4000);
  } else if (a.startsWith("shot:")) await shot(a.slice(5));
  else console.log("unknown command", a);
}
console.log(`screenshots in ${out}`);
await browser.close();
