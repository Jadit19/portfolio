/**
 * CPU profile of the frame loop (4 s, riding forward), self time by function: shows what
 * the main thread spends each frame on (matrix updates, scene walks, GL calls…).
 *
 *   bun run .claude/skills/verify-in-browser/scripts/cpu-profile.ts expresso|astro|yard
 */
import puppeteer from "puppeteer-core";

const executablePath =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/chromium",
  ].find((p) => Bun.file(p).size > 0);
if (!executablePath) throw new Error("No Chromium-based browser found; set CHROME_PATH");
const PORT = process.env.PORT ?? 4310;

const world = process.argv[2] ?? "expresso";
const b = await puppeteer.launch({ executablePath, headless: true, protocolTimeout: 900000,
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"] });
const p = await b.newPage();
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 400)));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 400)); });
await p.evaluateOnNewDocument(() => { try { localStorage.setItem("portfolio:homescreen-tip", "1"); localStorage.setItem("portfolio:night", "0"); } catch {} });
await p.setViewport({ width: 932, height: 430, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await p.goto(`http://localhost:${PORT}/?debug`, { waitUntil: "domcontentloaded" });
await p.waitForSelector(".app.is-ready", { timeout: 120000 });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
if (world !== "yard") {
  for (let k = 0; k < 8 && !new RegExp(world, "i").test(await p.evaluate(() => document.querySelector(".yard-card")?.textContent ?? "")); k++) { await p.keyboard.press("ArrowRight"); await wait(600); }
  await p.click(".yard-card .ride");
  await p.waitForSelector(".ridehud", { timeout: 240000 });
}
await wait(6000);
// Ride forward so the update path is exercised.
await p.keyboard.down("ArrowUp");
const c = await p.target().createCDPSession();
await c.send("Profiler.enable");
await c.send("Profiler.setSamplingInterval", { interval: 100 });
await c.send("Profiler.start");
await wait(4000);
const { profile } = await c.send("Profiler.stop") as any;
await p.keyboard.up("ArrowUp");
const total = profile.endTime - profile.startTime;
const dt = new Map<number, number>();
profile.samples.forEach((id: number, i: number) => dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[i + 1] ?? 0)));
const self = new Map<string, number>();
for (const n of profile.nodes) {
  const f = n.callFrame; const key = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber}`;
  self.set(key, (self.get(key) ?? 0) + (dt.get(n.id) ?? 0));
}
const frames = await p.evaluate(() => new Promise<number>((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
console.log(`${world}: total ${(total / 1000).toFixed(0)} ms profiled, ~${frames} fps`);
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 28)) console.log(`${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
await b.close();
