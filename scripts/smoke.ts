/**
 * Smoke test for the live site in a real (headless) browser, on a laptop and
 * a phone viewport: waits for the garage, picks a world, opens Inspect 360°
 * by clicking the bike itself, drags to spin (and checks it really spun), and
 * goes back; then rides into Expresso, cruises to a stop (its card must open)
 * and returns. Saves screenshots and fails on page errors or broken input.
 *
 *   bun run scripts/smoke.ts [url] [outDir]
 */

import { existsSync, mkdirSync } from "node:fs";
import puppeteer, { type Page } from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:4310";
const out = process.argv[3] ?? "/tmp/portfolio-smoke";
mkdirSync(out, { recursive: true });

const executablePath =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].find((p) => existsSync(p));
if (!executablePath) throw new Error("No Chromium-based browser found; set CHROME_PATH");

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

const devices = {
  laptop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  "phone-landscape": {
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    isLandscape: true,
  },
} as const;

const errors: string[] = [];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`  ✓ ${name}`);
}

for (const [name, viewport] of Object.entries(devices)) {
  console.log(name);
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) =>
    errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`),
  );
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${name} console: ${m.text()}`);
  });
  await page.setViewport(viewport);
  const t0 = performance.now();
  // ?debug exposes the stage so the test can read the spin and find the bike on screen.
  await page.goto(`${url}${url.includes("?") ? "&" : "?"}debug`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForSelector(".app.is-ready", { timeout: 300_000 });
  console.log(`  ready in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  await wait(2500);
  await shot(page, `${name}-01-table`);

  // Pick Zingle from the list; the rally bike should roll in.
  const zingle = await page.$$eval("button.world", (bs) =>
    bs.findIndex((b) => b.textContent?.includes("Zingle")),
  );
  const buttons = await page.$$("button.world");
  await buttons[zingle]?.click();
  // Murphy rides home and the rally bike rolls in; wait until everyone is at rest.
  const settle = () =>
    page.waitForFunction(
      () => {
        // biome-ignore lint/suspicious/noExplicitAny: debug hook
        const s = (window as any).__stage.active;
        // biome-ignore lint/suspicious/noExplicitAny: debug hook
        return s.rigs.every((r: any) => r.phase === "rest") && !s.settling;
      },
      { timeout: 240_000, polling: 250 },
    );
  await settle();
  await wait(500);
  await shot(page, `${name}-02-picked-zingle`);
  // Phones held sideways: tapping a journey opens its card with the bike in 360° at once.
  const compact = await page.evaluate(
    () => matchMedia("(max-height: 520px) and (min-aspect-ratio: 16 / 10)").matches,
  );
  if (compact) {
    const title = await page.$eval(".panel.inspect h2", (h) => h.textContent).catch(() => "");
    if (!title?.includes("Zingle"))
      errors.push(`${name}: tapping Zingle didn't open its 360° card`);
  } else {
    const pressed = await page.$eval("button.world[aria-pressed='true']", (b) => b.textContent);
    if (!pressed?.includes("Zingle")) errors.push(`${name}: Zingle not selected after click`);
  }

  // Click the bike itself to open Inspect 360° (falls back to the button on failure).
  const bikeAt = await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: debug hook
    const s = (window as any).__stage.active;
    const v = s.current.root.position.clone();
    v.y = 0.9;
    v.project(s.camera);
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
  });
  if (!compact) await page.mouse.click(bikeAt.x, bikeAt.y);
  await wait(400);
  if (!(await page.$("button.back"))) {
    errors.push(`${name}: clicking the bike did not open Inspect`);
    await page.click("button.ghost");
  }
  await wait(1800);
  await settle();
  await shot(page, `${name}-03-inspect`);
  const box = await page.$eval("canvas.stage", (c) => {
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width * 0.35, y: r.top + r.height * 0.4 };
  });
  // biome-ignore lint/suspicious/noExplicitAny: debug hook
  const spin = () => page.evaluate(() => (window as any).__stage.active.spinDegrees() as number);
  const before = await spin();
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(box.x + i * 22, box.y, { steps: 2 });
    await wait(16);
  }
  await page.mouse.up();
  const after = await spin();
  if (Math.abs(after - before) < 10) errors.push(`${name}: dragging did not spin the bike`);
  await wait(1200);
  await shot(page, `${name}-04-spun`);

  await page.click("button.back");
  await wait(1500);
  await shot(page, `${name}-05-back`);
  if (!(await page.$("aside.panel .worlds"))) errors.push(`${name}: list missing after going back`);
  if (compact && (await page.$(".panel .card")))
    errors.push(`${name}: the card should close when going back to the list`);

  // Ride into Expresso: the world builds, the bike moves, cruise reaches a stop
  // and opens its card, and "← Garage" brings the garage back.
  // (Sideways phones have no card on the list: the Ride button is on the 360° card.)
  await page.evaluate((compact) => {
    (window as unknown as { __app: { patch(p: object): void } }).__app.patch({
      selected: "expresso",
      ...(compact ? { view: "inspect" } : {}),
    });
  }, compact);
  await wait(1500);
  await page.click(".card .ride");
  await page.waitForFunction(
    () =>
      (window as unknown as { __app: { get(): { worldReady: boolean } } }).__app.get().worldReady,
    { timeout: 300_000 },
  );
  await wait(1200);
  // Phones: portrait asks you to turn sideways; landscape offers tilt steering.
  if (await page.$(".rotategate")) {
    await shot(page, `${name}-06a-rotate`);
    await page.click(".rotategate .linkish");
    await wait(400);
  }
  if (await page.$(".tiltstart")) {
    // No motion sensor in a headless browser: tilt falls back to the steering slider.
    await shot(page, `${name}-06b-tilt-start`);
    await page.click(".tiltstart .ride");
    await wait(1900);
    // biome-ignore lint/suspicious/noExplicitAny: debug hook
    const assist = await page.evaluate(() => (window as any).__stage.active.roadAssist);
    if (!assist) errors.push(`${name}: without tilt, gas and brake should follow the road`);
  }
  await shot(page, `${name}-06-world`);
  // Step the world by hand (headless frames are slow): cruise to the nearest stop.
  const rode = await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: test reaches into the scene
    const w = window as any;
    const st = w.__stage;
    st.stop();
    const s = st.active;
    const from = [s.bike.x, s.bike.z];
    let t = 0;
    const i = s.nextStop();
    s.startCruise(i);
    for (let k = 0; k < 30 * 40 && !document.querySelector(".stopcard") && s.pilot; k++) {
      t += 1 / 30;
      s.update(1 / 30, t);
    }
    st.start();
    return { moved: Math.hypot(s.bike.x - from[0], s.bike.z - from[1]), pilot: Boolean(s.pilot) };
  });
  await wait(1200);
  if (rode.moved < 5)
    errors.push(`${name}: the bike didn't ride (moved ${rode.moved.toFixed(1)} m)`);
  if (!(await page.$(".stopcard")))
    errors.push(`${name}: cruise didn't reach a stop and open its card`);
  await shot(page, `${name}-07-stop-card`);
  await page.keyboard.press("Escape");
  await wait(400);
  await page.click(".topbar .chip");
  // Home: the ride ritual plays in reverse; tapping skips it.
  try {
    await page.waitForSelector(".ritual-skip", { timeout: 20_000 });
    await page.click(".ritual-skip");
  } catch {
    errors.push(`${name}: no ride-home ritual (or no way to skip it)`);
  }
  await wait(2000);
  if (!(await page.$("aside.panel .worlds"))) errors.push(`${name}: garage missing after riding`);
  await shot(page, `${name}-08-garage-again`);
  await ctx.close();
}

await browser.close();
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n${errors.join("\n")}`);
  process.exit(1);
}
console.log("\nAll good.");
