/** Serves the production build in dist/ for a local check. */
import { join, normalize } from "node:path";

const root = join(import.meta.dir, "..", "dist");
const port = Number(process.env.PORT ?? 4173);

Bun.serve({
  port,
  async fetch(req) {
    const path = normalize(decodeURIComponent(new URL(req.url).pathname));
    const file = Bun.file(join(root, path.endsWith("/") ? `${path}index.html` : path));
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(join(root, "index.html")));
  },
});
console.log(`Preview: http://localhost:${port}`);
