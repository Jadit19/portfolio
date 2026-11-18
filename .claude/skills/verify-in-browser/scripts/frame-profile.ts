/**
 * Frame profile of the real site on this machine's GPU (Metal via ANGLE, vsync off), at
 * phone size by default. Per scenario: fps, scene update ms, draw ms incl. gl.finish (≈ the
 * frame's CPU+GPU cost, median/95th), draw calls, triangles, objects, pixel ratio.
 *
 *   bun --port 4310 ./index.html &
 *   SCEN="yard,yard-night,expresso,astro,astro-night" bun run .claude/skills/verify-in-browser/scripts/frame-profile.ts
 *   BREAK=1 …   also list what the frame draws, by geometry (triangles, draws, instances)
 *   W=1440 H=900 DPR=2 …   other screen sizes (default 932×430 @3, an iPhone Pro Max landscape)
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

const W = Number(process.env.W ?? 932), H = Number(process.env.H ?? 430), DPR = Number(process.env.DPR ?? 3);
const scen = (process.env.SCEN ?? "yard,yard-night,astro,astro-night").split(",");
const b = await puppeteer.launch({
  executablePath,
  headless: true,
  protocolTimeout: 900000,
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"],
});
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function page(night: boolean) {
  const p = await b.newPage();
  p.on("pageerror", (e) => console.log("pageerror", String(e)));
  await p.evaluateOnNewDocument((n: string) => { localStorage.clear(); localStorage.setItem("portfolio:night", n); localStorage.setItem("portfolio:homescreen-tip", "1"); }, night ? "1" : "0");
  await p.setViewport({ width: W, height: H, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await p.goto(`http://localhost:${PORT}/?debug`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".app.is-ready", { timeout: 120000 });
  return p;
}
async function measure(p: any, label: string) {
  await wait(4000);
  const r = await p.evaluate(async () => {
    const st = (window as any).__stage;
    const R = st.renderer;
    const gl = R.getContext();
    const info = { gpu: gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info")?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) };
    const scene = st.active;
    const up: number[] = [], rd: number[] = [], fin: number[] = [], frames: number[] = [];
    let calls = 0, tris = 0;
    const origUpdate = scene.update.bind(scene);
    scene.update = (dt: number, t: number) => { const a = performance.now(); origUpdate(dt, t); up.push(performance.now() - a); };
    const origRender = R.render.bind(R);
    let inFrame = false;
    R.info.autoReset = false;
    // Time the whole stage draw (scene, or night pass): wrap requestAnimationFrame's tick by timing between update end and next rAF.
    const nightRender = st.night.render.bind(st.night);
    const timeDraw = (fn: () => void) => { const a = performance.now(); fn(); const m = performance.now(); gl.finish(); const e = performance.now(); rd.push(m - a); fin.push(e - a); };
    st.night.render = (...args: any[]) => timeDraw(() => nightRender(...args));
    R.render = (s: any, c: any) => { if (inFrame) return origRender(s, c); inFrame = true; try { timeDraw(() => origRender(s, c)); } finally { inFrame = false; } };
    // night.render calls R.render internally: mark in-frame while it runs
    st.night.render = (...args: any[]) => { inFrame = true; try { timeDraw(() => nightRender(...args)); } finally { inFrame = false; } };
    let last = performance.now();
    const t0 = last;
    await new Promise<void>((res) => { const f = () => { const n = performance.now(); frames.push(n - last); last = n; R.info.reset(); if (n - t0 < 5000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    await new Promise((r) => requestAnimationFrame(r));
    calls = R.info.render.calls; tris = R.info.render.triangles;
    const q = (a: number[], k: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) * k)] ?? 0; };
    let objs = 0, meshes = 0, inst = 0; scene.scene.traverse((o: any) => { objs++; if (o.isMesh) { meshes++; if (o.isInstancedMesh) inst += o.count; } });
    return { ...info, dpr: R.getPixelRatio(), size: `${R.domElement.width}x${R.domElement.height}`, fps: (1000 / q(frames, 0.5)).toFixed(0), update: `${q(up, 0.5).toFixed(2)}/${q(up, 0.95).toFixed(2)}`, submit: `${q(rd, 0.5).toFixed(2)}/${q(rd, 0.95).toFixed(2)}`, gpu: `${q(fin, 0.5).toFixed(2)}/${q(fin, 0.95).toFixed(2)}`, calls, tris, objs, meshes, inst, geos: R.info.memory.geometries, tex: R.info.memory.textures, programs: R.info.programs?.length };
  });
  console.log(label.padEnd(12), JSON.stringify(r));
  if (process.env.BREAK) console.log(await p.evaluate(() => {
    const st = (window as any).__stage; const scene = st.active; const R = st.renderer;
    R.render(scene.scene, scene.camera);
    const list = R.renderLists.get(scene.scene, 0);
    const rows: Record<string, { draws: number; tris: number; inst: number }> = {};
    let total = 0;
    for (const it of [...list.opaque, ...list.transmissive, ...list.transparent]) {
      const o = it.object; const g = it.geometry;
      const per = (g.index ? g.index.count : g.attributes.position.count) / 3;
      const n = o.isInstancedMesh ? o.count : 1;
      const key = `${o.isInstancedMesh ? "I" : "M"} ${it.material.type}${it.material.type === "ShaderMaterial" ? "(shadow?)" : ""} per=${per | 0}`;
      const r = rows[key] ?? (rows[key] = { draws: 0, tris: 0, inst: 0 });
      r.draws++; r.inst += n; r.tris += per * n; total += per * n;
    }
    return `drawn total ${(total / 1e6).toFixed(2)}M in ${list.opaque.length + list.transparent.length} items\n` + Object.entries(rows).sort((a, b) => b[1].tris - a[1].tris).slice(0, 14).map(([k, r]) => `  ${(r.tris / 1e6).toFixed(2)}M ${k} draws ${r.draws} inst ${r.inst}`).join("\n");
  }));
}
async function ride(p: any, world: string) {
  for (let k = 0; k < 8 && !new RegExp(world, "i").test(await p.evaluate(() => document.querySelector(".yard-card")?.textContent ?? "")); k++) { await p.keyboard.press("ArrowRight"); await wait(600); }
  await p.click(".yard-card .ride");
  await p.waitForSelector(".ridehud", { timeout: 600000 });
  await wait(6000);
}
for (const s of scen) {
  const night = s.endsWith("-night");
  const p = await page(night);
  if (s.startsWith("yard")) await measure(p, s);
  else { await ride(p, s.replace("-night", "")); await measure(p, s); }
  await p.close();
}
await b.close();
