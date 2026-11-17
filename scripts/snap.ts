/**
 * Visual smoke test: drives a headless Chromium through the main flows on
 * phone, tablet and laptop viewports and saves screenshots.
 *
 *   bun run build && bun run preview &   # serve dist/ on :4173
 *   bun run scripts/snap.ts [outDir] [url]
 *
 * Set CHROME_PATH to use a specific Chromium-based browser.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import puppeteer, { type Page } from "puppeteer-core";

const outDir = process.argv[2] ?? "snapshots";
const url = process.argv[3] ?? "http://localhost:4173";
const executablePath =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].find((p) => Bun.file(p).size > 0);

if (!executablePath) throw new Error("No Chromium-based browser found; set CHROME_PATH");

const DEVICES = [
  { name: "laptop", width: 1440, height: 900, touch: false },
  { name: "phone-portrait", width: 390, height: 844, touch: true },
  { name: "phone-landscape", width: 844, height: 390, touch: true },
  { name: "tablet-portrait", width: 820, height: 1180, touch: true },
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shot(page: Page, device: string, name: string) {
  await page.screenshot({ path: join(outDir, `${device}-${name}.png`) });
}

await mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
const errors: string[] = [];

try {
  for (const d of DEVICES) {
    // Fresh profile per device so saved progress doesn't skip the intro.
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.on("pageerror", (e) =>
      errors.push(`[${d.name}] ${e instanceof Error ? e.message : String(e)}`),
    );
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`[${d.name}] console: ${m.text()}`);
    });
    await page.setViewport({
      width: d.width,
      height: d.height,
      hasTouch: d.touch,
      isMobile: d.touch,
      deviceScaleFactor: 2,
    });
    await page.goto(url, { waitUntil: "networkidle0" });
    await shot(page, d.name, "01-loading");
    await page.waitForSelector(".intro", { timeout: 8000 });
    await sleep(600);
    await shot(page, d.name, "02-intro");

    // Kick three times (easter egg), then give a name.
    for (let i = 0; i < 3; i++) {
      await page.click(".btn--kick");
      await sleep(i < 2 ? 500 : 2600);
    }
    await page.waitForSelector("#rider-name", { timeout: 4000 });
    await page.type("#rider-name", "Ada");
    await shot(page, d.name, "03-name");
    await page.click(".intro__actions .btn--primary");
    await sleep(900);
    await shot(page, d.name, "04-garage");

    // Ride WinZO.
    await page.click(".spec-plate__ride");
    await sleep(1200);
    await shot(page, d.name, "05-route-start");
    await page.keyboard.press("KeyC"); // cruise to the first stop
    await sleep(4500);
    await shot(page, d.name, "06-route-cruise");
    const prompt = await page.$(".stop-prompt__btn");
    if (prompt) {
      await prompt.click();
      await sleep(1800);
      await shot(page, d.name, "07-card");
      await page.keyboard.press("Escape");
      await sleep(400);
    }
    // Road atlas + certificate
    await page.click('[aria-label^="Open the road atlas"]');
    await sleep(500);
    await shot(page, d.name, "08-atlas");
    await page.keyboard.press("Escape");
    await sleep(300);
    await page.click('[aria-label="Your certificate"]');
    await sleep(600);
    await shot(page, d.name, "09-certificate");
    await page.keyboard.press("Escape");
    await context.close();
  }
} finally {
  await browser.close();
}

if (errors.length) {
  console.error(`Errors:\n${errors.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Saved screenshots to ${outDir}/ with no page errors.`);
}
