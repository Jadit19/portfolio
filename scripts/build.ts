/**
 * Production build: bundles index.html (with its TS/CSS graph) into dist/,
 * then copies static files from public/ (CNAME, 404.html, robots.txt).
 */
import { cp, rm } from "node:fs/promises";

const outdir = "dist";
await rm(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir,
  minify: true,
  // Split dynamic imports (the physics engine loads only when you ride into a world).
  splitting: true,
  sourcemap: "linked",
  target: "browser",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await cp("public", outdir, { recursive: true });

const bytes = result.outputs.reduce((sum, o) => sum + o.size, 0);
console.log(
  `Built ${result.outputs.length} files (${(bytes / 1024).toFixed(1)} KiB) into ${outdir}/`,
);
