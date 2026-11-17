/**
 * Screenshots one route's diorama on a laptop and a phone, for iterating on
 * route art. Skips the intro and unlocks every route via a seeded save.
 *
 *   bun run build && bun run preview &
 *   bun run scripts/snap-route.ts <routeId> [outDir] [url]
 *
 * Optional env: HOUR=0..23 fakes the local clock (day/night lighting).
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const route = process.argv[2];
if (!route) throw new Error("usage: snap-route.ts <routeId> [outDir] [url]");
const outDir = process.argv[3] ?? "snapshots";
const url = process.argv[4] ?? "http://localhost:4173";
const hour = process.env.HOUR ? Number(process.env.HOUR) : null;
const executablePath =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/chromium",
  ].find((p) => Bun.file(p).size > 0);
if (!executablePath) throw new Error("No Chromium-based browser found; set CHROME_PATH");

const save = {
  version: 1,
  riderName: "Ada",
  nameAsked: true,
  livery: { bike: "#d6452e", helmet: "#e8e2d4" },
  visited: [],
  stamps: ["winzo", "zingle", "expresso"],
  decals: [],
  bestCombo: 0,
  totalPdp: 0,
  muted: true,
  introSeen: true,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
await mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
const errors: string[] = [];
try {
  for (const d of [
    { name: "laptop", width: 1440, height: 900, touch: false },
    { name: "phone", width: 390, height: 844, touch: true },
  ]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.on("pageerror", (e) =>
      errors.push(`[${d.name}] ${e instanceof Error ? e.message : String(e)}`),
    );
    await page.evaluateOnNewDocument(
      (s: string, h: number | null) => {
        try {
          localStorage.setItem("adit-portfolio:progress", s);
        } catch {
          // about:blank and other opaque origins have no storage.
        }
        if (h !== null) {
          const RealDate = Date;
          const base = new RealDate();
          base.setHours(h, 0, 0, 0);
          const offset = base.getTime() - RealDate.now();
          // biome-ignore lint/suspicious/noExplicitAny: test shim
          (globalThis as any).Date = class extends RealDate {
            // biome-ignore lint/suspicious/noExplicitAny: test shim
            constructor(...args: any[]) {
              // biome-ignore lint/suspicious/noExplicitAny: test shim
              super(...((args.length ? args : [RealDate.now() + offset]) as [any]));
            }
            static override now() {
              return RealDate.now() + offset;
            }
          };
        }
      },
      JSON.stringify(save),
      hour,
    );
    await page.setViewport({
      width: d.width,
      height: d.height,
      hasTouch: d.touch,
      isMobile: d.touch,
      deviceScaleFactor: 2,
    });
    await page.goto(`${url}/?route=${route}`, { waitUntil: "networkidle0" });
    await sleep(3200);
    await page.screenshot({ path: join(outDir, `${route}-${d.name}-1-start.png`) });
    await page.keyboard.down("ArrowUp");
    await sleep(2600);
    await page.keyboard.up("ArrowUp");
    await sleep(400);
    await page.screenshot({ path: join(outDir, `${route}-${d.name}-2-riding.png`) });
    await page.keyboard.down("ArrowUp");
    await sleep(3500);
    await page.keyboard.up("ArrowUp");
    await page.screenshot({ path: join(outDir, `${route}-${d.name}-3-further.png`) });
    await context.close();
  }
} finally {
  await browser.close();
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else console.log(`Saved ${route} screenshots to ${outDir}/`);
