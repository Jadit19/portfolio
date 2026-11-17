/**
 * The passport's artwork, drawn on a canvas: immigration-style stamps (each
 * world its own shape and ink), passport pages, the cover, and the book at
 * any moment of opening. Stamps sit wholly inside one page, scattered and
 * tilted, sometimes overlapping, like a real passport.
 */

import type { BikeKind } from "../content/types";
import { WORLDS, type WorldInfo } from "../content/worlds";
import { mix, rng } from "../three/flat/kit";
import { PASTEL as P } from "../three/lib/palette";
import { COLOUR } from "../three/lineup/yard";

const INK = P.ink;
const TAU = Math.PI * 2;
const info = (k: BikeKind) => WORLDS.find((w) => w.bike.kind === k) as WorldInfo;

type Shape = "rect" | "oval" | "star" | "hex" | "triangle" | "roundrect" | "circle";
const SHAPE: Record<BikeKind, Shape> = {
  superbike: "rect",
  rally: "triangle",
  cafe: "oval",
  adv: "star",
  scrambler: "hex",
  bobber: "roundrect",
  classic: "circle",
};

function outline(g: CanvasRenderingContext2D, shape: Shape, w: number, h: number): void {
  g.beginPath();
  if (shape === "rect") g.rect(-w / 2, -h / 2, w, h);
  else if (shape === "roundrect") g.roundRect(-w / 2, -h / 2, w, h, h * 0.22);
  else if (shape === "oval") g.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU);
  else if (shape === "circle") g.arc(0, 0, h / 2, 0, TAU);
  else if (shape === "hex")
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      g.lineTo((Math.cos(a) * w) / 2, (Math.sin(a) * h) / 2);
    }
  else if (shape === "triangle") {
    g.moveTo(0, -h / 2);
    g.lineTo(w / 2, h / 2);
    g.lineTo(-w / 2, h / 2);
  } else
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * TAU;
      const rr = i % 2 ? 0.78 : 1;
      g.lineTo((Math.cos(a) * w * rr) / 2, (Math.sin(a) * h * rr) / 2);
    }
  g.closePath();
}

/** A stamp's width and height before turning (wide shapes are wider than tall). */
function extent(k: BikeKind, size: number): [number, number] {
  const wide = ["rect", "oval", "roundrect"].includes(SHAPE[k]);
  return [size * (wide ? 1.45 : 1), size * (wide ? 0.82 : 1)];
}

/** "14 MAR 2026" for when a stamp was earned. */
function stampDate(when: number): string {
  const d = new Date(when);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en", { month: "short" }).toUpperCase()} ${d.getFullYear()}`;
}

/** One immigration stamp, centred at (0, 0), about `size` across. */
function visa(
  g: CanvasRenderingContext2D,
  k: BikeKind,
  size: number,
  seed: number,
  when: number,
): void {
  const shape = SHAPE[k];
  const ink = mix(COLOUR[k], INK, 0.5);
  const [w, h] = extent(k, size);
  g.save();
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineJoin = "round";
  g.lineWidth = size * 0.04;
  outline(g, shape, w, h);
  g.stroke();
  g.lineWidth = size * 0.018;
  outline(g, shape, w * 0.86, h * 0.86);
  g.stroke();
  g.textAlign = "center";
  g.textBaseline = "middle";
  const fit = (t: string, weight: number, px: number, max: number, y: number) => {
    let f = px;
    g.font = `${weight} ${f}px Outfit, sans-serif`;
    while (g.measureText(t).width > max && f > 4) {
      f *= 0.93;
      g.font = `${weight} ${f}px Outfit, sans-serif`;
    }
    g.fillText(t, 0, y);
  };
  const tri = shape === "triangle";
  const span = tri ? w * 0.42 : w * 0.66;
  const y = tri ? h * 0.16 : 0;
  fit("ARRIVED", 800, size * 0.1, span, y - h * 0.22);
  fit(info(k).name.toUpperCase(), 900, size * 0.17, span, y - h * 0.03);
  g.lineWidth = size * 0.012;
  g.beginPath();
  g.moveTo(-span / 2, y + h * 0.08);
  g.lineTo(span / 2, y + h * 0.08);
  g.stroke();
  fit(stampDate(when), 700, size * 0.09, span, y + h * 0.17);
  if (!tri)
    fit(
      `IMM · ${String(40 + seed * 7).padStart(3, "0")} · ${info(k).place.toUpperCase()}`,
      600,
      size * 0.055,
      span,
      y + h * 0.29,
    );
  // Patchy ink, and one edge pressed lighter.
  g.globalCompositeOperation = "destination-out";
  const r = rng(seed * 13 + 5);
  for (let i = 0; i < 70; i++) {
    g.globalAlpha = 0.5 + r() * 0.5;
    g.beginPath();
    g.arc((r() - 0.5) * w, (r() - 0.5) * h, r() * size * 0.025, 0, TAU);
    g.fill();
  }
  const fade = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.7, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0.45)");
  g.globalAlpha = 1;
  g.fillStyle = fade;
  g.fillRect(-w, -h, w * 2, h * 2);
  g.restore();
}

/** Presses a stamp onto a page (drawn on its own canvas so its patchy ink only marks itself). */
function press(
  g: CanvasRenderingContext2D,
  k: BikeKind,
  size: number,
  seed: number,
  when: number,
): void {
  const c = document.createElement("canvas");
  c.width = c.height = Math.ceil(size * 1.7);
  const s = c.getContext("2d") as CanvasRenderingContext2D;
  s.translate(c.width / 2, c.height / 2);
  visa(s, k, size, seed, when);
  g.globalAlpha = 0.92;
  g.drawImage(c, -c.width / 2, -c.height / 2);
  g.globalAlpha = 1;
}

/** A passport page: off-white paper with fine wavy security lines and a page number. */
function page(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  num: number,
  u: number,
): void {
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, 10 * u);
  g.fillStyle = "#fbf5e8";
  g.fill();
  g.clip();
  g.strokeStyle = "rgba(121,212,228,0.22)";
  g.lineWidth = u;
  for (let k = 0; k < 26; k++) {
    g.beginPath();
    for (let i = 0; i <= 60; i++) {
      const px = x + (w * i) / 60;
      const py = y + (h * k) / 26 + Math.sin(i * 0.35 + k * 0.8) * 5 * u;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.stroke();
  }
  if (num) {
    g.fillStyle = "rgba(58,47,77,0.35)";
    g.font = `600 ${11 * u}px Inter, sans-serif`;
    g.textAlign = "center";
    g.fillText(String(num), x + w / 2, y + h - 14 * u);
  }
  g.restore();
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where each stamp lands: each belongs to one page and sits wholly inside it
 * (measured after turning); within a page they're in a loose 2 × 2 grid,
 * jittered and tilted, so they spread out but can overlap.
 */
function scatter(
  stamps: BikeKind[],
  pages: Rect[],
  seed: number,
  u: number,
): { x: number; y: number; a: number; size: number }[] {
  const r = rng(seed);
  const cells: [number, number, number][] = [];
  for (let p = 0; p < pages.length; p++)
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) cells.push([p, i, j]);
  for (let i = cells.length - 1; i > 0; i--) {
    const k = Math.floor(r() * (i + 1));
    [cells[i], cells[k]] = [
      cells[k] as [number, number, number],
      cells[i] as [number, number, number],
    ];
  }
  return stamps.map((k, n) => {
    const [p, ci, cj] = cells[n % cells.length] as [number, number, number];
    const pg = pages[p] as Rect;
    let size = (118 + r() * 40) * u;
    const a = (r() - 0.5) * 0.9;
    const box = () => {
      const [w, h] = extent(k, size);
      return [
        (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2,
        (Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) / 2,
      ] as const;
    };
    while (box()[0] * 2 > pg.w || box()[1] * 2 > pg.h) size *= 0.92;
    const [hx, hy] = box();
    const cx = pg.x + ((ci + 0.5) * pg.w) / 2 + (r() - 0.5) * pg.w * 0.35;
    const cy = pg.y + ((cj + 0.5) * pg.h) / 2 + (r() - 0.5) * pg.h * 0.3;
    return {
      x: Math.min(pg.x + pg.w - hx, Math.max(pg.x + hx, cx)),
      y: Math.min(pg.y + pg.h - hy, Math.max(pg.y + hy, cy)),
      a,
      size,
    };
  });
}

export const COVER = "#2b3a5a";
const GOLD = "#d9b25c";

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/** The cover: navy with gold type and a wheel emblem. */
function cover(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  u: number,
): void {
  g.save();
  g.fillStyle = COVER;
  g.beginPath();
  g.roundRect(x, y, w, h, 14 * u);
  g.fill();
  g.strokeStyle = GOLD;
  g.fillStyle = GOLD;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `800 ${Math.max(8, w * 0.085)}px Outfit, sans-serif`;
  g.fillText("PASSPORT", x + w / 2, y + h * 0.2);
  const cx = x + w / 2;
  const cy = y + h * 0.5;
  const R = Math.min(w, h) * 0.2;
  g.lineWidth = Math.max(1, R * 0.08);
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * R * 0.25, cy + Math.sin(a) * R * 0.25);
    g.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
    g.stroke();
  }
  star(g, cx, cy, R * 0.32);
  g.font = `700 ${Math.max(6, w * 0.05)}px Outfit, sans-serif`;
  g.fillText("ADIT JAIN · RIDER", x + w / 2, y + h * 0.8);
  g.restore();
}

export interface Stamped {
  kind: BikeKind;
  /** When it was earned (ms). */
  when: number;
}

/** Slow in, slow out. */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The open spread (both pages, with their heading, stamps or note), drawn once
 * per size and set of stamps: the opening shows parts of this one picture, so
 * nothing on the pages pops in or out.
 */
let spreadCache: { key: string; c: HTMLCanvasElement } | null = null;
function spread(
  pw: number,
  ph: number,
  u: number,
  stamps: Stamped[],
  landing?: BikeKind,
): HTMLCanvasElement {
  const key = `${Math.round(pw)}x${Math.round(ph)}:${stamps.map((s) => `${s.kind}${s.when}`).join(",")}:${landing ?? ""}`;
  if (spreadCache?.key === key) return spreadCache.c;
  const c = document.createElement("canvas");
  c.width = Math.ceil(pw * 2);
  c.height = Math.ceil(ph);
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  page(g, 0, 0, pw, ph, 6, u);
  page(g, pw, 0, pw, ph, 7, u);
  g.fillStyle = INK;
  g.font = `800 ${15 * u}px Outfit, sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillText("VISAS · ADIT JAIN", 22 * u, 30 * u);
  if (!stamps.length) {
    g.fillStyle = "rgba(58,47,77,0.45)";
    g.font = `600 ${13 * u}px Inter, sans-serif`;
    g.textAlign = "center";
    g.fillText("No stamps yet.", pw / 2, ph / 2 - 10 * u);
    g.fillText("Find every stop in a world to earn its stamp.", pw / 2, ph / 2 + 12 * u);
  }
  const m = 16 * u;
  const spots = scatter(
    stamps.map((x) => x.kind),
    [
      { x: m, y: 48 * u, w: pw - 2 * m, h: ph - 48 * u - 34 * u },
      { x: pw + m, y: m, w: pw - 2 * m, h: ph - m - 34 * u },
    ],
    41,
    u,
  );
  stamps.forEach((st, i) => {
    const p = spots[i];
    if (!p) return;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.a);
    if (st.kind === landing) {
      g.scale(1.08, 1.08);
      g.fillStyle = mix(COLOUR[st.kind], INK, 0.5);
      const r = rng(3);
      for (let j = 0; j < 14; j++) {
        const a = r() * TAU;
        const d = p.size * (0.55 + r() * 0.15);
        g.beginPath();
        g.arc(Math.cos(a) * d, Math.sin(a) * d, (2 + r() * 4) * u, 0, TAU);
        g.fill();
      }
    }
    press(g, st.kind, p.size, i + 1, st.when);
    g.restore();
  });
  spreadCache = { key, c };
  return c;
}

/** One side of a leaf: a part (`sx`, `sw`) of a picture. */
interface Face {
  img: HTMLCanvasElement;
  sx: number;
  sw: number;
}
const whole = (img: HTMLCanvasElement): Face => ({ img, sx: 0, sw: img.width });

/** Pictures drawn once per size: the cover, and blank pages (0: the inside of the cover, unnumbered). */
const pictures = new Map<string, HTMLCanvasElement>();
function picture(what: "cover" | number, pw: number, ph: number, u: number): HTMLCanvasElement {
  const key = `${what}:${Math.round(pw)}x${Math.round(ph)}`;
  const hit = pictures.get(key);
  if (hit) return hit;
  if (pictures.size > 24) pictures.clear();
  const c = document.createElement("canvas");
  c.width = Math.ceil(pw);
  c.height = Math.ceil(ph);
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  if (what === "cover") cover(g, 0, 0, pw, ph, u);
  else page(g, 0, 0, pw, ph, what, u);
  pictures.set(key, c);
  return c;
}

/**
 * A leaf turned to `angle` (0 lying on the right, π lying on the left) about
 * the spine: seen from above it narrows to the spine and back out, showing
 * its front on the right and its back on the left, shaded towards its outer
 * edge as it stands up (so it reads as turning, not squashing). No size change.
 */
function leaf(
  g: CanvasRenderingContext2D,
  front: Face,
  back: Face,
  angle: number,
  spine: number,
  top: number,
  pw: number,
  ph: number,
  r: number,
): void {
  const width = Math.abs(Math.cos(angle)) * pw;
  if (width < 0.5) return;
  const right = angle < Math.PI / 2;
  const f = right ? front : back;
  const x = right ? spine : spine - width;
  g.drawImage(f.img, f.sx, 0, f.sw, f.img.height, x, top, width, ph);
  const stand = Math.sin(angle);
  if (stand < 0.01) return;
  const outer = right ? x + width : x;
  const shade = g.createLinearGradient(spine, 0, outer, 0);
  shade.addColorStop(0, `rgba(30,24,44,${0.06 * stand})`);
  shade.addColorStop(1, `rgba(30,24,44,${0.3 * stand})`);
  g.fillStyle = shade;
  g.beginPath();
  g.roundRect(x, top, width, ph, right ? [0, r, r, 0] : [r, 0, 0, r]);
  g.fill();
}

/** Slow in, quick stop: for things that slide to rest. */
const settle = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const phase = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Opening: the slide in from the right, the cover's swing, then each page of the riffle. */
const SLIDE = 0.27;
const SWING: [number, number] = [0.27, 0.64];
const RIFFLE: [number, number][] = [
  [0.58, 0.79],
  [0.66, 0.88],
  [0.74, 1],
];
/** Closing (from fully open): the cover swings shut, then it slides away right. */
export const CLOSE_SLIDE = 0.4;

/**
 * The book at a moment on a canvas of any size, `open` from 0 to 1.
 * Opening: it slides in from the right (turned a little, straightening as it
 * comes to rest, like a passport pushed across a counter), the cover swings
 * open, then a few pages riffle over to the stamps. With `closing` (from fully
 * open, `open` running 1 → 0): the cover swings shut and it slides back out to
 * the right. `landing` thumps a new stamp down with a little ink spatter.
 */
export function drawPassport(
  c: HTMLCanvasElement,
  open: number,
  stamps: Stamped[],
  landing?: BikeKind,
  closing = false,
): void {
  const g = c.getContext("2d");
  if (!g) return;
  open = clamp01(open);
  const W = c.width;
  const H = c.height;
  g.clearRect(0, 0, W, H);
  const u = Math.min(W / 760, H / 560);
  const pw = 330 * u;
  const ph = 440 * u;
  const cx = W / 2;
  const cy = H / 2;
  const top = cy - ph / 2;
  const rim = 6 * u;
  const r = 14 * u;
  const slideEnd = closing ? CLOSE_SLIDE : SLIDE;
  // How far it has slid in (it decelerates in, and so accelerates out on closing).
  const s = settle(phase(open, 0, slideEnd));
  // The yard dims as it comes in (and brightens as it goes).
  g.fillStyle = `rgba(58,47,77,${0.38 * s})`;
  g.fillRect(0, 0, W, H);

  const pages = spread(pw, ph, u, stamps, landing);
  const half = pages.width / 2;
  const spreadLeft: Face = { img: pages, sx: 0, sw: half };
  const spreadRight: Face = { img: pages, sx: half, sw: half };
  const blank = (n: number) => whole(picture(n, pw, ph, u));
  // The leaves, top of the stack first, and how far each has turned (0–1).
  const leaves: { front: Face; back: Face; p: number }[] = closing
    ? [
        {
          front: whole(picture("cover", pw, ph, u)),
          back: spreadLeft,
          p: ease(phase(open, CLOSE_SLIDE, 1)),
        },
      ]
    : [
        {
          front: whole(picture("cover", pw, ph, u)),
          back: blank(0),
          p: ease(phase(open, ...SWING)),
        },
        ...RIFFLE.map(([a, b], i) => ({
          front: blank(2 * i + 1),
          back: i === RIFFLE.length - 1 ? spreadLeft : blank(2 * i + 2),
          p: ease(phase(open, a, b)),
        })),
      ];
  const cov = leaves[0]?.p ?? 0;
  // Closed, the book is centred; open, the spine is. It slides between the two as the cover turns.
  const spine = cx - (pw / 2) * (1 - cov) + (1 - s) * (W / 2 + pw * 1.2);
  const tilt = (1 - s) * 0.1;
  g.save();
  if (tilt) {
    g.translate(spine + pw / 2, cy);
    g.rotate(tilt);
    g.translate(-(spine + pw / 2), -cy);
  }
  // The left half exists once the cover is over: as wide as the cover reads from above.
  const coverOver = cov >= 0.5;
  const leftW = coverOver ? Math.abs(Math.cos(cov * Math.PI)) * pw : 0;
  // Shadow under the book.
  g.fillStyle = "rgba(58,47,77,0.22)";
  g.beginPath();
  g.roundRect(
    spine - leftW - rim + 10 * u,
    top - rim + 14 * u,
    pw + leftW + 2 * rim,
    ph + 2 * rim,
    r + rim,
  );
  g.fill();
  // The navy covers behind the pages: the back cover on the right, the front (turned) on the left,
  // meeting at the spine (no overlap, so no doubled edge).
  g.fillStyle = COVER;
  g.beginPath();
  // (Rounded on the left too while it's shut, so the closed book's corners match.)
  const shut = (r + rim) * (1 - Math.min(1, cov * 4));
  g.roundRect(spine, top - rim, pw + rim, ph + 2 * rim, [shut, r + rim, r + rim, shut]);
  g.fill();
  if (leftW > 1) {
    g.beginPath();
    g.roundRect(spine - leftW - rim, top - rim, leftW + rim, ph + 2 * rim, [
      r + rim,
      0,
      0,
      r + rim,
    ]);
    g.fill();
  }
  // Right: the top leaf that hasn't moved yet (or the stamps' page under them all),
  // then the leaves lifting off it, the top one last.
  const resting = leaves.find((l) => l.p <= 0);
  const base = resting ? resting.front : spreadRight;
  g.drawImage(base.img, base.sx, 0, base.sw, base.img.height, spine, top, pw, ph);
  for (let i = leaves.length - 1; i >= 0; i--) {
    const l = leaves[i];
    if (l && l.p > 0 && l.p < 0.5) leaf(g, l.front, l.back, l.p * Math.PI, spine, top, pw, ph, r);
  }
  // Left: the leaves that are over, in the order they came over (the cover's inside lies under the pages).
  for (const l of leaves) {
    if (l.p >= 0.5) leaf(g, l.front, l.back, l.p * Math.PI, spine, top, pw, ph, r);
  }
  // The fold down the spine, deepening as it opens.
  const fold = g.createLinearGradient(spine - 24 * u, 0, spine + 24 * u, 0);
  fold.addColorStop(0, "rgba(58,47,77,0)");
  fold.addColorStop(0.5, `rgba(58,47,77,${0.16 * cov})`);
  fold.addColorStop(1, "rgba(58,47,77,0)");
  g.fillStyle = fold;
  g.fillRect(spine - 24 * u, top, 48 * u, ph);
  g.restore();
}
