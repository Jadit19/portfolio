/**
 * WinZO's farmland: a few huge estates, each a field of sub-fields joined edge to edge (no
 * ground showing between them), every sub-field a different crop from its neighbours; and the
 * still life on them: a tractor with a cane trolley, a tubewell pump house with a solar roof,
 * peacocks and egrets. Picked on design/3d/winzo-farms-board.ts (E4 + E2, P1, Ta, Tc, Ba, Bb, Bc).
 */

import * as THREE from "three";
import { mix } from "../flat/kit";
import { join, paint } from "./nature";
import { PASTEL as P } from "./palette";
import { at, ball, drum, type G, lathe, rbox } from "./toys";

type Pt = [number, number];

const MUD = "#d9b48f";
const MUD_D = "#c99d77";
const WATER = "#a9dde6";
const AQUA = "#8fd3e0";
const INK = "#2b2433";
const RED = "#e2564b";
const CREAM = P.cream;

// ── geometry ────────────────────────────────────────────────────────────────

function clean(g: G): G {
  const f = g.index ? g.toNonIndexed() : g;
  if (f.attributes.uv) f.deleteAttribute("uv");
  if (!f.attributes.normal) f.computeVertexNormals();
  return f;
}
/** A flat polygon lying at height y. */
export function flatPoly(pts: Pt[], y: number, hex: string): G {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return paint(clean(g), hex);
}
/** A raised band along a polyline (a crop row, a bund, a channel): top and both sides. */
export function strip(
  pts: Pt[],
  half: number,
  y0: number,
  y1: number,
  hex: string,
  closed = false,
): G {
  const n = pts.length;
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as Pt;
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as Pt;
    const tx = b[0] - a[0];
    const tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    const [x, z] = pts[i] as Pt;
    L.push([x - (tz / l) * half, z + (tx / l) * half]);
    R.push([x + (tz / l) * half, z - (tx / l) * half]);
  }
  const pos: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) =>
    pos.push(...a, ...c, ...b, ...a, ...d, ...c);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n;
    const [l0, l1, r0, r1] = [L[i], L[j], R[i], R[j]] as [Pt, Pt, Pt, Pt];
    quad([l0[0], y1, l0[1]], [r0[0], y1, r0[1]], [r1[0], y1, r1[1]], [l1[0], y1, l1[1]]);
    quad([l0[0], y0, l0[1]], [l0[0], y1, l0[1]], [l1[0], y1, l1[1]], [l1[0], y0, l1[1]]);
    quad([r1[0], y0, r1[1]], [r1[0], y1, r1[1]], [r0[0], y1, r0[1]], [r0[0], y0, r0[1]]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return paint(g, hex);
}
/** A low-poly leafy puff (paddy tufts, cane tops): there are thousands. */
function puff(r: number, hex: string, sx = 1, sy = 1, sz = 1, detail = 0): G {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.scale(sx, sy, sz);
  g.translate(0, r * sy, 0);
  return paint(clean(g), hex);
}
/** Seeded random. */
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// ── crops ───────────────────────────────────────────────────────────────────

export type Crop = "mustard" | "wheat" | "cane" | "paddy";
type Kind = Crop | "track" | "plough";
const SOIL: Record<Kind, string> = {
  mustard: "#cfe0a8",
  wheat: "#bcd88f",
  cane: "#add08e",
  paddy: WATER,
  track: mix(MUD, CREAM, 0.35),
  plough: MUD,
};
const GAP: Record<Crop | "plough", number> = {
  mustard: 0.7,
  wheat: 0.6,
  cane: 1.1,
  paddy: 0.75,
  plough: 0.55,
};

/** Copies of `g` at points `step` apart along a row. */
function dots(row: Pt[], step: number, make: (x: number, z: number, k: number) => G): G[] {
  const out: G[] = [];
  for (let i = 0; i < row.length - 1; i++) {
    const [a, b] = [row[i] as Pt, row[i + 1] as Pt];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++)
      out.push(make(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, i + k));
  }
  return out;
}
/** One row: low parts (no shadow worth drawing) and tall parts (cane, which casts shade). */
function row(c: Crop | "plough", pts: Pt[], seed: number): { low: G[]; tall: G[] } {
  switch (c) {
    case "mustard":
      return {
        low: [strip(pts, 0.26, 0, 0.2, P.marigold), strip(pts, 0.12, 0.2, 0.27, "#ffe27a")],
        tall: [],
      };
    case "wheat":
      return { low: [strip(pts, 0.22, 0, 0.32, seed % 3 ? "#9cc46a" : "#a8cc72")], tall: [] };
    case "paddy":
      return {
        low: dots(pts, 0.6, (x, z) => at(puff(0.15, "#7cc48a", 1, 1.5, 1), x, 0, z)),
        tall: [],
      };
    case "plough":
      return { low: [strip(pts, 0.2, 0, 0.12, MUD_D)], tall: [] };
    case "cane":
      return {
        low: [],
        tall: [
          strip(pts, 0.26, 0, 1.45, "#5f8f4e"),
          ...dots(pts, 0.8, (x, z, k) =>
            at(puff(0.42, (k + seed) % 3 ? "#9cc874" : "#b5d684", 1.1, 0.55, 1.1, 1), x, 1.2, z),
          ),
        ],
      };
  }
}

// ── estates ─────────────────────────────────────────────────────────────────

/** A sub-field's corners in the estate's own (u, v) square: (u0,v0) (u1,v0) (u1,v1) (u0,v1). */
type Q = [Pt, Pt, Pt, Pt];
export type Sub = { q: Q; crop: Kind; along: boolean };
/** The estate's (u, v) square onto the world. */
export type Map2 = (u: number, v: number) => Pt;
const lerp2 = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const bilerp = (q: Q, s: number, t: number): Pt =>
  lerp2(lerp2(q[0], q[1], s), lerp2(q[3], q[2], s), t);
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** An edge (estate space) as world points every ~1.2 m, its end left off. */
function edgePts(map: Map2, a: Pt, b: Pt): Pt[] {
  const n = Math.max(2, Math.ceil(dist(map(...a), map(...b)) / 1.2));
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push(map(...lerp2(a, b, i / n)));
  return out;
}
const outlineOf = (map: Map2, q: Q): Pt[] => [
  ...edgePts(map, q[0], q[1]),
  ...edgePts(map, q[1], q[2]),
  ...edgePts(map, q[2], q[3]),
  ...edgePts(map, q[3], q[0]),
];
/** A sub-field's rows, along its u (or its v), inset from its bunds. */
function rowsOf(map: Map2, q: Q, along: boolean, gap: number): Pt[][] {
  const at2 = (a: number, b: number) => (along ? map(...bilerp(q, a, b)) : map(...bilerp(q, b, a)));
  const width = dist(at2(0.5, 0), at2(0.5, 1));
  const n = Math.floor((width - 1.2) / gap);
  const rows: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const t = (0.6 + (i + 0.5) * ((width - 1.2) / n)) / width;
    const len = dist(at2(0, t), at2(1, t));
    if (len < 2) continue;
    const e = 0.75 / len;
    const k = Math.max(1, Math.ceil((len * (1 - 2 * e)) / 1.5));
    const r: Pt[] = [];
    for (let j = 0; j <= k; j++) r.push(at2(e + ((1 - 2 * e) * j) / k, t));
    rows.push(r);
  }
  return rows;
}
const inQuad = (q: Q, p: Pt) => {
  let sg = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i] as Pt;
    const b = q[(i + 1) % 4] as Pt;
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (c === 0) continue;
    if (sg === 0) sg = Math.sign(c);
    else if (Math.sign(c) !== sg) return false;
  }
  return true;
};
/** Gives every sub-field a crop unlike each neighbour's (greedy; varied by the seed). */
export function assignCrops(subs: Sub[], r: () => number): void {
  const palette: Crop[] = ["mustard", "wheat", "cane", "paddy"];
  const nb: Set<number>[] = subs.map(() => new Set());
  subs.forEach((s, i) => {
    for (let e = 0; e < 4; e++) {
      const a = s.q[e] as Pt;
      const b = s.q[(e + 1) % 4] as Pt;
      const nx = -(b[1] - a[1]);
      const nz = b[0] - a[0];
      const l = Math.hypot(nx, nz) || 1;
      for (const f of [0.15, 0.5, 0.85])
        for (const sg of [-1, 1]) {
          const m = lerp2(a, b, f);
          const p: Pt = [m[0] + (nx / l) * 0.01 * sg, m[1] + (nz / l) * 0.01 * sg];
          if (inQuad(s.q, p)) continue;
          subs.forEach((o, j) => {
            if (j !== i && inQuad(o.q, p)) nb[i]?.add(j);
          });
        }
    }
  });
  const start = Math.floor(r() * palette.length);
  subs.forEach((s, i) => {
    if (s.crop === "track" || s.crop === "plough") return;
    const used = new Set([...(nb[i] ?? [])].map((j) => subs[j]?.crop));
    const free = palette.filter((c) => !used.has(c));
    const pick = free.length ? free : palette;
    s.crop = pick[(start + i + Math.floor(r() * pick.length)) % pick.length] as Crop;
  });
}
/** Bands across v, each cut in u at staggered places (a roadside estate). */
export function bands(r: () => number, vs: number[], cuts: [number, number], alongP = 0.75): Sub[] {
  const out: Sub[] = [];
  for (let b = 0; b < vs.length - 1; b++) {
    const v0 = vs[b] as number;
    const v1 = vs[b + 1] as number;
    const m = cuts[0] + Math.floor(r() * (cuts[1] - cuts[0] + 1));
    const us = [0];
    for (let k = 1; k <= m; k++) us.push(k / (m + 1) + (r() - 0.5) * (0.5 / (m + 1)));
    us.push(1);
    for (let k = 0; k < us.length - 1; k++) {
      const [a, c] = [us[k] as number, us[k + 1] as number];
      out.push({
        q: [
          [a, v0],
          [c, v0],
          [c, v1],
          [a, v1],
        ],
        crop: "wheat",
        along: r() < alongP,
      });
    }
  }
  return out;
}
/** A jittered grid (cells share their corners, so nothing shows between them). */
export function jgrid(r: () => number, nx: number, nz: number, j = 0.3): Sub[] {
  const N: Pt[][] = [];
  for (let i = 0; i <= nx; i++) {
    const col: Pt[] = [];
    for (let k = 0; k <= nz; k++) {
      const ju = i === 0 || i === nx ? 0 : (r() - 0.5) * (j / nx);
      const jv = k === 0 || k === nz ? 0 : (r() - 0.5) * (j / nz);
      col.push([i / nx + ju, k / nz + jv]);
    }
    N.push(col);
  }
  const out: Sub[] = [];
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++)
      out.push({
        q: [N[i]?.[k], N[i + 1]?.[k], N[i + 1]?.[k + 1], N[i]?.[k + 1]] as Q,
        crop: "wheat",
        along: r() < 0.5,
      });
  return out;
}
/** Cuts a farm track across every band at u in [ua, ub]. */
export function withTrack(subs: Sub[], ua: number, ub: number): Sub[] {
  return subs.flatMap((s) => {
    const [u0, u1] = [s.q[0][0], s.q[1][0]];
    const [v0, v1] = [s.q[0][1], s.q[2][1]];
    const mk = (a: number, b: number, crop: Kind): Sub => ({
      q: [
        [a, v0],
        [b, v0],
        [b, v1],
        [a, v1],
      ],
      crop,
      along: s.along,
    });
    if (u1 <= ua || u0 >= ub) return [s];
    const out: Sub[] = [];
    if (u0 < ua) out.push(mk(u0, ua, s.crop));
    out.push(mk(Math.max(u0, ua), Math.min(u1, ub), "track"));
    if (u1 > ub) out.push(mk(ub, u1, s.crop));
    return out;
  });
}
/**
 * An estate beside a road that runs along x (its centreline z = f(x)): u along the road from
 * x0 for L metres, v away from it (side +1: +z) from dmin out to dmin + D; the far corners round.
 */
export function roadside(
  f: (x: number) => number,
  x0: number,
  L: number,
  side: 1 | -1,
  dmin: number,
  D0: number,
): Map2 {
  return (u, v) => {
    const x = x0 + u * L;
    const dz = f(x + 0.5) - f(x - 0.5);
    const l = Math.hypot(1, dz);
    const e = 1 - Math.abs(2 * u - 1) ** 5;
    const d = side * (dmin + v * D0 * (0.5 + 0.5 * Math.max(0, e) ** 0.2));
    return [x - (dz / l) * d, f(x) + (1 / l) * d];
  };
}
/** A round estate: the square stretched onto a soft, slightly wobbly ellipse. */
export function disc(cx: number, cz: number, Rx: number, Rz: number, rot: number): Map2 {
  return (u, v) => {
    const a = 2 * u - 1;
    const b = 2 * v - 1;
    const x = a * Math.sqrt(1 - (b * b) / 2);
    const z = b * Math.sqrt(1 - (a * a) / 2);
    const ang = Math.atan2(z, x);
    const w = 1 + 0.05 * Math.sin(3 * ang + 1) + 0.03 * Math.sin(5 * ang + 2);
    const X = x * Rx * w;
    const Z = z * Rz * w;
    return [cx + X * Math.cos(rot) - Z * Math.sin(rot), cz + X * Math.sin(rot) + Z * Math.cos(rot)];
  };
}
export interface Piece {
  /** Flat soil (no shadow); none for the rim. */
  soil: G | null;
  /** Bunds and low crops (no shadow worth its triangles). */
  low: G | null;
  /** Tall crops (sugarcane): cast shadows. */
  tall: G | null;
}
/**
 * An estate as pieces small enough to be batched by area and culled: one per sub-field (its
 * soil, its bund, its rows), plus the rim in short lengths. Also its outline (to keep scatter off).
 */
/** Each crop's tint on the minimap's paper. */
const MAP_TINT: Record<Kind, string> = {
  mustard: "#f6da86",
  wheat: "#d3e6ae",
  cane: "#b4d69a",
  paddy: "#c4e6ea",
  plough: "#e6c9a6",
  track: "#eadcc2",
};
export function estate(
  map: Map2,
  subs: Sub[],
): { pieces: Piece[]; outline: Pt[]; plots: { pts: Pt[]; colour: string }[] } {
  const pieces: Piece[] = [];
  const plots: { pts: Pt[]; colour: string }[] = [];
  for (const [i, s] of subs.entries()) {
    const outline = outlineOf(map, s.q);
    plots.push({ pts: outline, colour: MAP_TINT[s.crop] });
    const low: G[] = [];
    const tall: G[] = [];
    if (s.crop !== "track") {
      low.push(strip(outline, 0.22, 0, 0.13, mix(MUD, P.lilac, 0.15), true));
      const c = s.crop;
      rowsOf(map, s.q, s.along, GAP[c]).forEach((r, k) => {
        const p = row(c, r, i + k);
        low.push(...p.low);
        tall.push(...p.tall);
      });
    }
    pieces.push({
      soil: flatPoly(outline, 0.004, SOIL[s.crop]),
      low: low.length ? join(low) : null,
      tall: tall.length ? join(tall) : null,
    });
  }
  const rim = outlineOf(map, [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]);
  for (let i = 0; i < rim.length; i += 14) {
    const seg = [...rim.slice(i, i + 15)];
    if (i + 15 > rim.length) seg.push(rim[0] as Pt);
    pieces.push({
      soil: null,
      low: strip(seg, 0.45, 0, 0.16, mix(MUD, P.lilac, 0.25)),
      tall: null,
    });
  }
  return { pieces, outline: rim, plots };
}

// ── still life ──────────────────────────────────────────────────────────────

/** A wheel: axle along z, centre at height r. */
function wheel(r: number, w: number, x: number, z: number, hub: string = P.marigold): G[] {
  const t = drum(r, w, INK, 0.08, 22);
  t.translate(0, -w / 2, 0);
  const h = drum(r * 0.5, w + 0.04, hub, 0.03, 16);
  h.translate(0, -(w + 0.04) / 2, 0);
  return [at(t, x, r, z, 0, Math.PI / 2), at(h, x, r, z, 0, Math.PI / 2)];
}
/** A red tractor facing +x, rear axle at x 0 (generic, no badge); a plough behind if asked. */
export function tractor(plough = false): G {
  const p: G[] = [];
  p.push(...wheel(0.8, 0.5, 0, 0.78), ...wheel(0.8, 0.5, 0, -0.78));
  p.push(...wheel(0.42, 0.3, 2.3, 0.62), ...wheel(0.42, 0.3, 2.3, -0.62));
  p.push(at(rbox(2.5, 0.8, 0.86, RED, 0.12), 1.3, 0.62, 0));
  p.push(at(rbox(0.12, 0.62, 0.7, "#5b5370", 0.03), 2.56, 0.7, 0));
  p.push(at(ball(0.11, CREAM), 2.5, 1.05, 0.3), at(ball(0.11, CREAM), 2.5, 1.05, -0.3));
  p.push(at(rbox(1.1, 0.45, 1.2, mix(RED, INK, 0.25), 0.08), 0.05, 0.85, 0));
  for (const s of [-1, 1]) p.push(at(rbox(1.5, 0.12, 0.6, RED, 0.05), 0, 1.62, s * 0.78));
  p.push(
    at(rbox(0.5, 0.12, 0.5, INK, 0.05), -0.15, 1.35, 0),
    at(rbox(0.1, 0.55, 0.5, INK, 0.04), -0.4, 1.4, 0),
  );
  p.push(at(drum(0.04, 0.6, INK, 0.01, 8), 0.55, 1.4, 0, 0, 0, -0.5));
  p.push(
    at(
      lathe(
        [
          [0.2, 0],
          [0.22, 0.04],
          [0.2, 0.08],
          [0.16, 0.04],
        ],
        INK,
        18,
      ),
      0.4,
      1.9,
      0,
      0,
      0,
      -0.5,
    ),
  );
  p.push(
    at(drum(0.07, 1.2, "#6c6385", 0.02, 10), 1.9, 1.0, 0.3),
    at(drum(0.1, 0.12, INK, 0.02, 10), 1.9, 2.2, 0.3),
  );
  p.push(at(rbox(0.9, 0.12, 0.2, "#6c6385", 0.03), -0.85, 0.6, 0));
  if (plough) {
    p.push(at(rbox(0.3, 0.2, 1.8, "#6c6385", 0.04), -1.5, 0.35, 0));
    for (let k = 0; k < 3; k++)
      p.push(at(rbox(0.14, 0.45, 0.14, "#8a8299", 0.03), -1.6, 0, -0.6 + k * 0.6));
  }
  return join(p);
}
/** A blue trolley heaped with sugarcane, hitch at x 0, trailing towards −x. */
export function caneTrolley(): G {
  const p: G[] = [];
  const body = "#5f86c9";
  p.push(...wheel(0.48, 0.32, -2.6, 0.95, CREAM), ...wheel(0.48, 0.32, -2.6, -0.95, CREAM));
  p.push(at(rbox(4, 0.18, 2.1, mix(body, INK, 0.2), 0.04), -2.6, 0.75, 0));
  for (const s of [-1, 1]) p.push(at(rbox(4, 0.7, 0.08, body, 0.03), -2.6, 0.93, s * 1.02));
  p.push(
    at(rbox(0.08, 0.7, 2.1, body, 0.03), -4.58, 0.93, 0),
    at(rbox(0.08, 0.7, 2.1, body, 0.03), -0.62, 0.93, 0),
  );
  p.push(at(rbox(0.9, 0.1, 0.16, "#6c6385", 0.03), -0.25, 0.6, 0));
  const r = rng(7);
  for (let layer = 0; layer < 4; layer++)
    for (let k = 0; k < 7 - layer; k++) {
      const z = (k - (6 - layer) / 2) * 0.28;
      const g = drum(0.07, 5.2, k % 2 ? "#b7c76a" : "#9fbf62", 0.02, 6);
      g.translate(0, -2.6, 0);
      p.push(
        at(
          g,
          -2.6 + (r() - 0.5) * 0.4,
          1.05 + layer * 0.14,
          z,
          0,
          0,
          Math.PI / 2 + (r() - 0.5) * 0.06,
        ),
      );
    }
  for (let k = 0; k < 6; k++)
    p.push(at(ball(0.3, "#8fc46a", 1.6, 0.6, 1), -5.2 + (k % 2) * 0.2, 1.35, (k - 2.5) * 0.35));
  return join(p);
}
/**
 * The tubewell pump house (P1): whitewashed, a blue dado and door, its roof a tilted solar
 * array; the pipe (facing +x) over a cement tank. The water itself is separate (`gush`), as it
 * moves. Front of the hut at x 0.
 */
export function pumpHouse(): G {
  const p: G[] = [];
  p.push(at(rbox(3, 2.5, 2.6, CREAM, 0.06), -1.5, 0, 0));
  p.push(at(rbox(3.5, 0.18, 3.1, "#d9d3e6", 0.05), -1.5, 2.5, 0));
  p.push(at(rbox(0.06, 1.7, 0.9, "#4f8de8", 0.02), 0.02, 0, -0.6));
  p.push(at(rbox(3.02, 0.35, 2.62, "#4f8de8", 0.02), -1.5, 0, 0));
  for (const [x, z, h] of [
    [-2.9, 1.3, 0.25],
    [-2.9, -1.3, 0.25],
    [-0.1, 1.3, 1.1],
    [-0.1, -1.3, 1.1],
  ] as const)
    p.push(at(drum(0.05, h + 0.1, "#9a93ad", 0.01, 8), x, 2.68, z));
  p.push(at(rbox(3.6, 0.09, 3.3, "#2e4f8f", 0.02), -1.5, 3.25, 0, 0, 0, 0.3));
  for (let i = 0; i < 5; i++)
    p.push(
      at(rbox(0.04, 0.1, 3.3, "#a7c0ea", 0.01), -3.0 + i * 0.72, 3.0 + i * 0.218, 0, 0, 0, 0.3),
    );
  const pipe = drum(0.17, 1.0, "#9a93ad", 0.03, 12);
  pipe.translate(0, -0.5, 0);
  p.push(at(pipe, 0.4, 1.25, 0, 0, 0, Math.PI / 2));
  // The tank: four low walls and its water.
  const tw = "#e4dfee";
  p.push(
    at(rbox(2.2, 0.65, 0.2, tw, 0.04), 1.5, 0, 1.1),
    at(rbox(2.2, 0.65, 0.2, tw, 0.04), 1.5, 0, -1.1),
  );
  p.push(
    at(rbox(0.2, 0.65, 2.2, tw, 0.04), 0.4, 0, 0),
    at(rbox(0.2, 0.65, 2.2, tw, 0.04), 2.6, 0, 0),
  );
  p.push(at(rbox(2.1, 0.5, 2.1, WATER, 0.02), 1.5, 0, 0));
  return join(p);
}
/** The gush from the pump's pipe (pivot at the pipe mouth) and the splash in the tank. */
export function gush(): { jet: G; splash: G } {
  const jet = join([
    at(ball(0.22, "#ffffff", 1.6, 1, 1), 0.2, -0.3, 0),
    at(ball(0.2, WATER, 1.2, 2.2, 1), 0.55, -0.95, 0),
  ]);
  const splash: G[] = [];
  for (let k = 0; k < 6; k++)
    splash.push(
      at(ball(0.12, k % 2 ? "#ffffff" : WATER), Math.cos(k) * 0.6, 0, Math.sin(k) * 0.55),
    );
  return { jet, splash: join(splash) };
}
/** The channel off the tank to the fields (from local (2.6, 0) along +x). */
export function channel(len: number): G {
  const ch: Pt[] = [];
  for (let k = 0; k <= len / 0.6; k++) ch.push([2.6 + k * 0.6, Math.sin(k / 6) * 1.2]);
  return join([strip(ch, 0.75, 0, 0.006, mix(MUD, P.lilac, 0.1)), strip(ch, 0.4, 0, 0.01, AQUA)]);
}

// ── birds (animated: the parts that move are their own pieces) ───────────────

export interface Bird {
  /** Kind of behaviour: peck and potter, display (fan opens as a bike nears), egret (hops). */
  kind: "peck" | "display" | "egret";
  body: G;
  /** Neck and head, pivoting at the neck's base (`neck`). */
  head: G;
  neck: [number, number, number];
  /** The display fan, pivoting at its base (`fanAt`). */
  fan?: G;
  fanAt?: [number, number, number];
  /** The closed train (shown while the fan is down). */
  train?: G;
}
const BLUE = "#2f6fd6";
const PGREEN = "#3f9e6a";
/** A peacock (about 1.1 m; built ×1.5 so it reads): facing +x. */
export function peacock(display: boolean): Bird {
  const s = 1.5;
  const sc = (g: G) => g.scale(s, s, s);
  const body = sc(
    join([
      at(drum(0.025, 0.45, "#8a7a6a", 0.005, 6), 0, 0, 0.07),
      at(drum(0.025, 0.45, "#8a7a6a", 0.005, 6), 0, 0, -0.07),
      at(ball(0.24, mix(PGREEN, INK, 0.2), 1.5, 1, 1), -0.05, 0.38, 0),
    ]),
  );
  const head: G[] = [
    at(ball(0.08, BLUE, 1.1, 3.2, 1.1), 0.02, -0.05, 0),
    at(ball(0.1, BLUE), 0.06, 0.42, 0),
    at(ball(0.025, "#f2e6c8", 3, 1, 1), 0.18, 0.5, 0),
  ];
  for (const k of [-1, 0, 1])
    head.push(
      at(drum(0.008, 0.18, BLUE, 0.002, 4), 0.04, 0.58, k * 0.04),
      at(ball(0.03, BLUE), 0.04, 0.74, k * 0.04),
    );
  const train = sc(
    join([
      at(ball(0.3, PGREEN, 2.6, 0.32, 1), -1.0, 0.18, 0, 0, 0, 0.18),
      ...Array.from({ length: 7 }, (_, k) =>
        at(
          ball(0.06, k % 2 ? "#1e4fa8" : P.marigold, 1, 0.4, 1),
          -0.6 - k * 0.17,
          0.38 - k * 0.03,
          ((k % 3) - 1) * 0.12,
        ),
      ),
    ]),
  );
  const bird: Bird = {
    kind: display ? "display" : "peck",
    body,
    head: sc(join(head)),
    neck: [0.2 * s, 0.6 * s, 0],
    train,
  };
  if (display) {
    // The fan, upright and facing forward (+x), pivoting at its base so it can fold down.
    const R = 1.25;
    // Green with eye-spots on both faces: the camera rides behind the bike, so a fan turned to
    // face the bike is seen from behind (a dark back read as a blank shape).
    const f: G[] = [];
    for (const side of [1, -1]) {
      const ry = (side * Math.PI) / 2;
      const disc = new THREE.CircleGeometry(R, 22, Math.PI * 0.08, Math.PI * 0.84);
      f.push(at(paint(clean(disc), PGREEN), 0.01 * side, 0, 0, ry));
      for (const rr of [0.55, 0.85, 1.12])
        for (let k = 0; k <= 8; k++) {
          const a = Math.PI * 0.12 + (k / 8) * Math.PI * 0.76;
          const eye = paint(
            clean(new THREE.CircleGeometry(0.07, 8)),
            k % 2 ? "#1e4fa8" : P.marigold,
          );
          f.push(at(eye, 0.02 * side, Math.sin(a) * rr, Math.cos(a) * rr, ry));
        }
    }
    bird.fan = sc(join(f));
    bird.fanAt = [-0.25 * s, 0.4 * s, 0];
  }
  return bird;
}
/** A peahen: smaller, brown, no train. */
export function peahen(): Bird {
  const s = 1.5;
  const B = "#a08a72";
  return {
    kind: "peck",
    body: join([
      at(drum(0.02, 0.35, "#8a7a6a", 0.005, 6), 0, 0, 0.06),
      at(drum(0.02, 0.35, "#8a7a6a", 0.005, 6), 0, 0, -0.06),
      at(ball(0.2, B, 1.5, 1, 1), -0.05, 0.3, 0),
    ]).scale(s, s, s),
    head: join([
      at(ball(0.07, "#6f9e7a", 1.1, 2.6, 1.1), 0.0, -0.05, 0),
      at(ball(0.08, B), 0.03, 0.3, 0),
      at(drum(0.006, 0.12, B, 0.002, 4), 0.02, 0.45, 0),
    ]).scale(s, s, s),
    neck: [0.18 * s, 0.5 * s, 0],
  };
}
/** An egret (about 0.9 m, built ×1.4): white, S-necked, yellow bill. */
export function egret(): Bird {
  const s = 1.4;
  return {
    kind: "egret",
    body: join([
      at(drum(0.02, 0.35, INK, 0.005, 6), 0, 0, 0.05),
      at(drum(0.02, 0.35, INK, 0.005, 6), 0, 0, -0.05),
      at(ball(0.18, "#ffffff", 1.6, 0.9, 0.9), -0.05, 0.3, 0),
    ]).scale(s, s, s),
    head: join([
      at(ball(0.06, "#ffffff", 1, 2.6, 1), 0, -0.05, 0),
      at(ball(0.08, "#ffffff", 1.3, 1, 1), 0.06, 0.23, 0),
      at(ball(0.025, P.marigold, 4.5, 1, 1), 0.2, 0.25, 0),
    ]).scale(s, s, s),
    neck: [0.18 * s, 0.5 * s, 0],
  };
}
