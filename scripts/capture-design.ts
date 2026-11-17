/**
 * Exports every numbered variation on the design board as a PNG into
 * the output folder, plus an index README. Existing PNGs from a previous
 * export are replaced one by one.
 *
 *   bun --port 4318 design/3d/world.html &
 *   bun run scripts/capture-design.ts [url] [outDir]
 *   DSF=2 bun run scripts/capture-design.ts …   (export at 2× pixel density)
 */
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:4318";
const outDir = join(import.meta.dir, "..", process.argv[3] ?? "design/3d/world");
const executablePath =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/chromium",
  ].find((p) => Bun.file(p).size > 0);
if (!executablePath) throw new Error("No Chromium-based browser found; set CHROME_PATH");

await mkdir(outDir, { recursive: true });
// Remove only previously exported variation images (NN-*.png).
for (const name of await readdir(outDir)) {
  if (/^\d{2}-.*\.png$/.test(name)) await unlink(join(outDir, name));
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e instanceof Error ? e.message : String(e)));
  await page.setViewport({
    width: 1600,
    height: 1000,
    deviceScaleFactor: Number(process.env.DSF ?? 1),
  });
  const target = new URL(url);
  target.searchParams.set("static", "1");
  await page.goto(target.toString(), { waitUntil: "domcontentloaded", timeout: 600000 });
  await page.waitForSelector("body[data-ready]", { timeout: 900000 });
  if (errors.length) throw new Error(errors.join("\n"));
  const figures = await page.$$("figure[data-variation]");
  const lines: string[] = [];
  for (const fig of figures) {
    const { id, slug, label } = await fig.evaluate((el) => ({
      id: (el as HTMLElement).dataset.variation ?? "",
      slug: (el as HTMLElement).dataset.slug ?? "",
      label: el.querySelector("figcaption")?.textContent?.replace(/^\d+\s*/, "") ?? "",
    }));
    const file = `${id}-${slug}.png`;
    await fig.screenshot({ path: join(outDir, file) });
    lines.push(`| ${id} | ${label} | [${file}](${file}) |`);
  }
  await writeFile(
    join(outDir, "README.md"),
    `# Art test variations\n\nRendered from ${url}. Open it to see them animated.\nRefer to options by number.\n\n| # | Variation | File |\n|---|---|---|\n${lines.join("\n")}\n`,
  );
  console.log(`Exported ${figures.length} variations to ${outDir}`);
} finally {
  await browser.close();
}
