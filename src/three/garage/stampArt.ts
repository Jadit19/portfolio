/**
 * The passport board's artwork, drawn on a canvas: a dark-green felt board
 * with one sewn-on patch per world. Three takes on "stitched felt with a
 * comic-print edge" (textures only; no film imagery):
 *
 *  - "sewn":   soft embroidered patches with satin borders and running
 *              stitches; a light print touch (halftone shading, a hair of
 *              off-register colour).
 *  - "comic":  the same felt, turned up: bold ink outlines, Ben-Day dots,
 *              caption boxes and loud off-register edges.
 *  - "collage": stop-motion felt cut-outs: uneven layered shapes with
 *              visible thickness, chunky hand stitches, yarn-stitched title.
 */

import type { RouteId } from "../../content/types";
import { WORLDS, type WorldInfo } from "../../content/worlds";

export type StampStyle = "sewn" | "comic" | "collage";

const FELT = "#1f3d2c";
const THREAD = "#efe6d0";
const INK = "#15161a";

type Ctx = CanvasRenderingContext2D;
type Shape = "circle" | "shield" | "hex" | "round" | "burst" | "badge" | "lozenge";

const SHAPES: Record<RouteId, Shape> = {
  zingle: "hex",
  winzo: "shield",
  expresso: "circle",
  astro: "burst",
  fun: "round",
  personal: "badge",
  murphy: "lozenge",
};

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Traces a patch outline of radius r around (0, 0). `wobble` roughens it (cut felt). Returns the points. */
function trace(x: Ctx, shape: Shape, r: number, wobble = 0, seed = 1): [number, number][] {
  const rnd = rng(seed);
  const pts: [number, number][] = [];
  const poly = (n: number, rot: number, rr: (i: number) => number) => {
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * rr(i), Math.sin(a) * rr(i)]);
    }
  };
  switch (shape) {
    case "circle":
      poly(64, 0, () => r);
      break;
    case "hex":
      poly(6, Math.PI / 6, () => r * 1.05);
      break;
    case "burst":
      poly(24, -Math.PI / 2, (i) => (i % 2 ? r * 0.86 : r * 1.04));
      break;
    case "round":
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const k = 1 / (Math.abs(c) ** 4 + Math.abs(s) ** 4) ** 0.25;
        pts.push([c * r * 0.95 * k, s * r * 0.95 * k]);
      }
      break;
    case "shield":
      pts.push([-r * 0.85, -r * 0.85], [r * 0.85, -r * 0.85], [r * 0.85, r * 0.1]);
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push([
          r * 0.85 * (1 - t) * Math.cos(t * 0.9),
          r * 0.1 + r * 0.95 * Math.sin((t * Math.PI) / 2),
        ]);
      }
      for (let i = 12; i >= 0; i--) {
        const t = i / 12;
        pts.push([
          -r * 0.85 * (1 - t) * Math.cos(t * 0.9),
          r * 0.1 + r * 0.95 * Math.sin((t * Math.PI) / 2),
        ]);
      }
      pts.push([-r * 0.85, r * 0.1]);
      break;
    case "badge":
      pts.push(
        [-r * 0.95, -r * 0.6],
        [0, -r * 1.02],
        [r * 0.95, -r * 0.6],
        [r * 0.95, r * 0.6],
        [0, r * 1.02],
        [-r * 0.95, r * 0.6],
      );
      break;
    case "lozenge":
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push([Math.cos(a) * r * 1.1, Math.sin(a) * r * 0.78]);
      }
      break;
  }
  x.beginPath();
  const out: [number, number][] = [];
  pts.forEach(([px, py], i) => {
    const w = wobble ? 1 + (rnd() - 0.5) * wobble : 1;
    out.push([px * w, py * w]);
    if (i === 0) x.moveTo(px * w, py * w);
    else x.lineTo(px * w, py * w);
  });
  x.closePath();
  return out;
}

/** Point at `f` (0–1) of the way round a closed outline, and the outline's length. */
function along(pts: [number, number][], f: number): { p: [number, number]; len: number } {
  const segs: number[] = [];
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as [number, number];
    const b = pts[(i + 1) % pts.length] as [number, number];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push(d);
    len += d;
  }
  let want = len * f;
  for (let i = 0; i < pts.length; i++) {
    const d = segs[i] ?? 0;
    const a = pts[i] as [number, number];
    const b = pts[(i + 1) % pts.length] as [number, number];
    if (want <= d) {
      const k = d ? want / d : 0;
      return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], len };
    }
    want -= d;
  }
  return { p: pts[0] ?? [0, 0], len };
}

/** A simple emblem for each world, drawn at the origin in a box of ±r. */
function emblem(x: Ctx, id: RouteId, r: number, ink: string): void {
  x.save();
  x.strokeStyle = ink;
  x.fillStyle = ink;
  x.lineWidth = r * 0.09;
  x.lineCap = "round";
  x.lineJoin = "round";
  switch (id) {
    case "zingle": // sun over dunes
      x.beginPath();
      x.arc(0, -r * 0.15, r * 0.28, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.moveTo(-r * 0.7, r * 0.35);
      x.quadraticCurveTo(-r * 0.25, r * 0.05, r * 0.1, r * 0.35);
      x.quadraticCurveTo(r * 0.4, r * 0.15, r * 0.7, r * 0.35);
      x.stroke();
      x.beginPath();
      x.moveTo(-r * 0.55, r * 0.55);
      x.quadraticCurveTo(0, r * 0.3, r * 0.55, r * 0.55);
      x.stroke();
      break;
    case "winzo": // chequered flag
      x.beginPath();
      x.moveTo(-r * 0.5, r * 0.65);
      x.lineTo(-r * 0.5, -r * 0.6);
      x.stroke();
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++)
          if ((i + j) % 2 === 0)
            x.fillRect(-r * 0.45 + i * r * 0.26, -r * 0.6 + j * r * 0.26, r * 0.26, r * 0.26);
      x.strokeRect(-r * 0.45, -r * 0.6, r * 1.04, r * 0.78);
      break;
    case "expresso": // cup with steam
      x.beginPath();
      x.moveTo(-r * 0.42, -r * 0.05);
      x.lineTo(r * 0.3, -r * 0.05);
      x.quadraticCurveTo(r * 0.3, r * 0.55, -r * 0.06, r * 0.55);
      x.quadraticCurveTo(-r * 0.42, r * 0.55, -r * 0.42, -r * 0.05);
      x.fill();
      x.beginPath();
      x.arc(r * 0.36, r * 0.16, r * 0.14, -Math.PI / 2, Math.PI / 2);
      x.stroke();
      for (const dx of [-0.2, 0.06]) {
        x.beginPath();
        x.moveTo(r * dx, -r * 0.18);
        x.quadraticCurveTo(r * (dx + 0.12), -r * 0.35, r * dx, -r * 0.5);
        x.quadraticCurveTo(r * (dx - 0.1), -r * 0.62, r * (dx + 0.02), -r * 0.72);
        x.stroke();
      }
      break;
    case "astro": // telescope and a star
      x.save();
      x.rotate(-0.5);
      x.fillRect(-r * 0.5, -r * 0.12, r * 0.9, r * 0.24);
      x.fillRect(r * 0.4, -r * 0.16, r * 0.14, r * 0.32);
      x.restore();
      x.beginPath();
      x.moveTo(-r * 0.05, r * 0.08);
      x.lineTo(-r * 0.3, r * 0.62);
      x.moveTo(-r * 0.05, r * 0.08);
      x.lineTo(r * 0.22, r * 0.62);
      x.stroke();
      star(x, r * 0.42, -r * 0.48, r * 0.16);
      break;
    case "fun": // ferris wheel
      x.beginPath();
      x.arc(0, -r * 0.08, r * 0.48, 0, Math.PI * 2);
      x.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        x.beginPath();
        x.moveTo(0, -r * 0.08);
        x.lineTo(Math.cos(a) * r * 0.48, -r * 0.08 + Math.sin(a) * r * 0.48);
        x.stroke();
        x.beginPath();
        x.arc(Math.cos(a) * r * 0.48, -r * 0.08 + Math.sin(a) * r * 0.48, r * 0.07, 0, Math.PI * 2);
        x.fill();
      }
      x.beginPath();
      x.moveTo(0, -r * 0.08);
      x.lineTo(-r * 0.3, r * 0.65);
      x.moveTo(0, -r * 0.08);
      x.lineTo(r * 0.3, r * 0.65);
      x.stroke();
      break;
    case "personal": // mountains and a moon
      x.beginPath();
      x.moveTo(-r * 0.7, r * 0.5);
      x.lineTo(-r * 0.2, -r * 0.25);
      x.lineTo(r * 0.05, r * 0.1);
      x.lineTo(r * 0.3, -r * 0.1);
      x.lineTo(r * 0.7, r * 0.5);
      x.closePath();
      x.fill();
      x.beginPath();
      x.arc(r * 0.38, -r * 0.48, r * 0.16, 0, Math.PI * 2);
      x.fill();
      break;
    case "murphy": // the Guerrilla, side on
      for (const cx of [-0.42, 0.42]) {
        x.beginPath();
        x.arc(r * cx, r * 0.22, r * 0.24, 0, Math.PI * 2);
        x.stroke();
      }
      x.beginPath();
      x.moveTo(-r * 0.42, r * 0.22);
      x.lineTo(-r * 0.08, -r * 0.12);
      x.lineTo(r * 0.26, -r * 0.12);
      x.lineTo(r * 0.42, r * 0.22);
      x.moveTo(r * 0.26, -r * 0.12);
      x.lineTo(r * 0.36, -r * 0.34);
      x.stroke();
      x.fillRect(-r * 0.2, -r * 0.24, r * 0.4, r * 0.14);
      break;
  }
  x.restore();
}

function star(x: Ctx, cx: number, cy: number, r: number): void {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 ? r * 0.45 : r;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
  x.fill();
}

/** Felt: deep green, fibrous, with a soft vignette. */
function felt(x: Ctx, w: number, h: number, seed = 3): void {
  x.fillStyle = FELT;
  x.fillRect(0, 0, w, h);
  const rnd = rng(seed);
  for (let i = 0; i < (w * h) / 22; i++) {
    const px = rnd() * w;
    const py = rnd() * h;
    const a = rnd() * Math.PI;
    const l = 2 + rnd() * 6;
    x.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.07)";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
    x.stroke();
  }
  const v = x.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.72);
  v.addColorStop(0, "rgba(255,255,255,0.05)");
  v.addColorStop(1, "rgba(0,0,0,0.32)");
  x.fillStyle = v;
  x.fillRect(0, 0, w, h);
}

/** A running stitch along the current path. */
function runningStitch(x: Ctx, colour: string, width: number, dash: [number, number]): void {
  x.save();
  x.setLineDash(dash);
  x.lineCap = "round";
  // thread shadow then thread
  x.strokeStyle = "rgba(0,0,0,0.35)";
  x.lineWidth = width;
  x.translate(1.2, 1.6);
  x.stroke();
  x.translate(-1.2, -1.6);
  x.strokeStyle = colour;
  x.stroke();
  x.restore();
}

/** Satin-stitch border: a thick band of short diagonal threads along the path. */
function satin(x: Ctx, colour: string, width: number): void {
  x.save();
  x.lineWidth = width;
  x.strokeStyle = colour;
  x.stroke();
  x.clip();
  x.restore();
  x.save();
  x.lineWidth = width;
  x.strokeStyle = "rgba(0,0,0,0.18)";
  x.setLineDash([1.5, 3.5]);
  x.stroke();
  x.restore();
}

/** Ben-Day dots filling the current clip, darker toward the bottom-right. */
function halftone(x: Ctx, r: number, colour: string, strength: number): void {
  x.save();
  x.fillStyle = colour;
  const step = Math.max(5, r * 0.11);
  for (let yy = -r; yy <= r; yy += step)
    for (let xx = -r; xx <= r; xx += step) {
      const off = (Math.round(yy / step) % 2) * step * 0.5;
      const k = Math.max(0, ((xx + yy) / (2 * r) + 0.15) * strength);
      if (k <= 0.02) continue;
      x.beginPath();
      x.arc(xx + off, yy, step * 0.45 * Math.min(1, k), 0, Math.PI * 2);
      x.fill();
    }
  x.restore();
}

interface PatchOpts {
  style: StampStyle;
  earned: boolean;
  w: WorldInfo;
  r: number;
  seed: number;
  /** 0–1 progress of the stitch-on animation (undefined = not animating). */
  sew?: number;
}

/** First 65% of the animation: a needle runs thread round the outline. */
const SEW_SPLIT = 0.65;

function patch(x: Ctx, o: PatchOpts): void {
  const { style, w, r, seed, sew } = o;
  const earned = o.earned && (sew === undefined || sew >= SEW_SPLIT);
  const shape = SHAPES[w.id];
  const locked = Boolean(w.unlockAfter);
  if (o.earned && sew !== undefined && sew < SEW_SPLIT) {
    // Stitching on: the slot outline, then bright thread following a needle round it.
    const f = sew / SEW_SPLIT;
    const pts = trace(x, shape, r, 0, seed);
    runningStitch(x, "rgba(239,230,208,0.35)", 2.5, [7, 7]);
    const { p, len } = along(pts, f);
    trace(x, shape, r, 0, seed);
    x.save();
    x.setLineDash([len * f, len]);
    x.lineWidth = 3.4;
    x.strokeStyle = w.tint;
    x.stroke();
    x.restore();
    // The needle.
    x.save();
    x.translate(p[0], p[1]);
    x.rotate(f * Math.PI * 2 + 0.8);
    x.strokeStyle = "#d9dde2";
    x.lineWidth = 3;
    x.lineCap = "round";
    x.beginPath();
    x.moveTo(-r * 0.05, r * 0.2);
    x.lineTo(r * 0.02, -r * 0.18);
    x.stroke();
    x.restore();
    return;
  }
  if (earned && sew !== undefined && sew < 1) {
    // The patch pops on with a little squash and settle.
    const k = (sew - SEW_SPLIT) / (1 - SEW_SPLIT);
    const bump = Math.sin(k * Math.PI) * (1 - k * 0.4);
    x.scale(1 + 0.14 * bump, 1 - 0.1 * bump);
  }
  if (!earned) {
    // Where the patch will go: a stitched outline in pale thread.
    trace(x, shape, r, style === "collage" ? 0.05 : 0, seed);
    runningStitch(
      x,
      "rgba(239,230,208,0.55)",
      style === "collage" ? 3.5 : 2.5,
      style === "collage" ? [10, 9] : [7, 7],
    );
    x.save();
    x.globalAlpha = 0.28;
    emblem(x, w.id, r * 0.8, THREAD);
    x.restore();
    if (locked) {
      x.fillStyle = "rgba(239,230,208,0.75)";
      x.font = `800 ${Math.round(r * 0.5)}px Outfit, Inter, sans-serif`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("?", 0, -r * 0.55);
    }
    return;
  }
  const tilt = ((seed * 37) % 13) / 100 - 0.06;
  x.save();
  x.rotate(tilt);
  // Thickness / drop shadow.
  x.save();
  x.translate(style === "collage" ? 6 : 3, style === "collage" ? 8 : 5);
  trace(x, shape, r, style === "collage" ? 0.06 : 0, seed);
  x.fillStyle = "rgba(0,0,0,0.38)";
  x.fill();
  x.restore();
  if (style === "collage") {
    // A darker felt layer underneath, offset (layered cut-outs).
    trace(x, shape, r * 1.08, 0.07, seed + 1);
    x.fillStyle = shade(w.tint, -0.35);
    x.fill();
  }
  trace(x, shape, r, style === "collage" ? 0.06 : 0, seed);
  x.fillStyle = w.tint;
  x.fill();
  // Comic print touch: halftone shading inside the patch.
  x.save();
  trace(x, shape, r, style === "collage" ? 0.06 : 0, seed);
  x.clip();
  halftone(x, r, "rgba(0,0,0,0.22)", style === "comic" ? 1.1 : 0.6);
  x.restore();
  // Emblem, with off-register colour plates behind it.
  const reg = style === "comic" ? r * 0.05 : style === "sewn" ? r * 0.022 : 0;
  if (reg) {
    x.save();
    x.globalAlpha = 0.85;
    x.translate(-reg, reg * 0.4);
    emblem(x, w.id, r * 0.8, "#24c7e8");
    x.translate(reg * 2, -reg * 0.8);
    emblem(x, w.id, r * 0.8, "#ff3d7f");
    x.restore();
  }
  emblem(x, w.id, r * 0.8, style === "comic" ? INK : THREAD);
  // Borders.
  trace(x, shape, r, style === "collage" ? 0.06 : 0, seed);
  if (style === "comic") {
    x.lineWidth = r * 0.07;
    x.strokeStyle = INK;
    x.stroke();
    trace(x, shape, r * 0.86, 0, seed);
    runningStitch(x, THREAD, 2.5, [6, 6]);
  } else if (style === "sewn") {
    satin(x, shade(w.tint, -0.25), r * 0.11);
    trace(x, shape, r * 0.82, 0, seed);
    runningStitch(x, THREAD, 2.2, [6, 6]);
  } else {
    // Chunky slanted hand stitches across the edge, holding it to the board.
    const n = 22;
    x.strokeStyle = THREAD;
    x.lineWidth = 3;
    x.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const b = a + 0.09;
      x.beginPath();
      x.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      x.lineTo(Math.cos(b) * r * 1.03, Math.sin(b) * r * 1.03);
      x.stroke();
    }
  }
  x.restore();
}

function shade(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function caption(x: Ctx, text: string, cx: number, cy: number, style: StampStyle, w: number): void {
  x.save();
  x.textAlign = "center";
  x.textBaseline = "middle";
  if (style === "comic") {
    x.font = "900 19px Outfit, Inter, sans-serif";
    const tw = Math.min(w, x.measureText(text).width + 22);
    x.translate(cx, cy);
    x.rotate(-0.025);
    x.fillStyle = "#ffe14d";
    x.fillRect(-tw / 2, -15, tw, 30);
    x.lineWidth = 3;
    x.strokeStyle = INK;
    x.strokeRect(-tw / 2, -15, tw, 30);
    x.fillStyle = INK;
    x.fillText(text.toUpperCase(), 0, 1, w - 16);
  } else {
    x.font =
      style === "collage"
        ? "800 21px Outfit, Inter, sans-serif"
        : "700 20px Outfit, Inter, sans-serif";
    x.fillStyle = "rgba(239,230,208,0.85)";
    x.fillText(text, cx, cy, w);
  }
  x.restore();
}

/** Stitched title: letters outlined in a running stitch (collage) or cut felt (sewn/comic). */
function title(x: Ctx, w: number, h: number, style: StampStyle, earned: number): void {
  x.save();
  x.textAlign = "center";
  x.textBaseline = "middle";
  const y = h * 0.1;
  if (style === "comic") {
    x.font = "900 52px Outfit, Inter, sans-serif";
    x.lineWidth = 8;
    x.strokeStyle = INK;
    x.fillStyle = "#24c7e8";
    x.strokeText("PASSPORT", w / 2 - 3, y + 2);
    x.fillText("PASSPORT", w / 2 - 3, y + 2);
    x.fillStyle = "#ff3d7f";
    x.globalAlpha = 0.9;
    x.fillText("PASSPORT", w / 2 + 3, y - 2);
    x.globalAlpha = 1;
    x.fillStyle = THREAD;
    x.fillText("PASSPORT", w / 2, y);
    x.strokeStyle = INK;
    x.lineWidth = 2;
    x.strokeText("PASSPORT", w / 2, y);
  } else if (style === "collage") {
    x.font = "900 54px Outfit, Inter, sans-serif";
    x.fillStyle = "#c8432c";
    x.fillText("PASSPORT", w / 2 + 4, y + 5);
    x.fillStyle = THREAD;
    x.fillText("PASSPORT", w / 2, y);
    x.setLineDash([5, 5]);
    x.lineWidth = 2;
    x.strokeStyle = "#c8432c";
    x.strokeText("PASSPORT", w / 2, y);
  } else {
    x.font = "800 44px Outfit, Inter, sans-serif";
    x.fillStyle = THREAD;
    x.fillText("PASSPORT", w / 2, y);
  }
  x.setLineDash([]);
  x.font = "600 17px Inter, sans-serif";
  x.fillStyle = "rgba(239,230,208,0.6)";
  x.fillText(`${earned} of 6 patches · 3 open the secret`, w / 2, y + 38);
  x.restore();
}

const feltCache = new Map<string, HTMLCanvasElement>();

/** The felt is expensive (tens of thousands of fibres): draw it once per size. */
function cachedFelt(w: number, h: number): HTMLCanvasElement {
  const key = `${w}x${h}`;
  let c = feltCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    if (x) felt(x, w, h);
    feltCache.set(key, c);
  }
  return c;
}

/**
 * Draws the whole board onto a canvas of any size (aspect ≈ 1.75).
 * `sewing` animates one patch being stitched on (t 0–1).
 */
export function drawStampBoard(
  c: HTMLCanvasElement,
  style: StampStyle,
  stamped: readonly RouteId[],
  sewing?: { id: RouteId; t: number },
): void {
  const x = c.getContext("2d");
  if (!x) return;
  const w = c.width;
  const h = c.height;
  x.drawImage(cachedFelt(w, h), 0, 0);
  // A running stitch around the whole board, just inside the frame.
  x.beginPath();
  x.roundRect(18, 18, w - 36, h - 36, 22);
  runningStitch(x, "rgba(239,230,208,0.5)", 2.5, [12, 10]);
  if (style === "comic") {
    // Ben-Day dots across the felt, faint.
    x.save();
    x.beginPath();
    x.rect(0, 0, w, h);
    x.clip();
    x.translate(w / 2, h / 2);
    halftone(x, w / 2, "rgba(0,0,0,0.12)", 0.8);
    x.restore();
  }
  title(x, w, h, style, stamped.filter((s) => s !== "murphy").length);
  const r = Math.min(w / 11.5, h / 7);
  const top = [0.15, 0.383, 0.617, 0.85].map((fx) => [fx * w, h * 0.4] as const);
  const bottom = [0.267, 0.5, 0.733].map((fx) => [fx * w, h * 0.74] as const);
  const spots = [...top, ...bottom];
  WORLDS.forEach((wd, i) => {
    const at = spots[i];
    if (!at) return;
    x.save();
    x.translate(at[0], at[1] - 10);
    const sew = sewing?.id === wd.id ? sewing.t : undefined;
    patch(x, {
      style,
      earned: stamped.includes(wd.id),
      w: wd,
      r,
      seed: i + 3,
      ...(sew === undefined ? {} : { sew }),
    });
    x.restore();
    caption(x, wd.name, at[0], at[1] + r * 1.12 + 10, style, r * 2.5);
  });
}
