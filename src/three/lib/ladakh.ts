/**
 * Ladakh's toys for the AstroClub world, in the flat kit's language: toy
 * peaks on the flat ground (three styles), prayer flags (strings and the
 * flag-gate jump, three styles), chortens and mani walls, the army road's
 * BRO signboards, trucks and milestones, and yaks.
 *
 * Each faces +z, stands on y = 0, centred on the origin (painted, as vertex
 * colours), with any lettering as separate board meshes.
 */

import * as THREE from "three";
import { flatShape, ribbon } from "../flat/kit";
import { board, sign } from "./landmarks";
import { join, paint, prism } from "./nature";
import { at, ball, drum, type G, gable, LANDSCAPE, lathe, rbox } from "./toys";

/** The cold-desert ground (Hanle's plateau): pale sand with a pink-lilac cast. */
export const LADAKH_GROUND = "#efdcca";

const SNOW = "#f8f6f2";
const WHITEWASH = "#f6f1e8";
const MAROON = "#9c4f45";
const GOLD = "#e8b84a";
const OLIVE = "#7d8a5c";
const OLIVE_DARK = "#5f6b45";
const BRO_YELLOW = "#f2c64b";
/** Prayer-flag colours in their order: blue, white, red, green, yellow. */
const FLAGS = ["#5b8fd6", "#f8f6f2", "#e2574a", "#5fae7a", "#f2c64b"];

// ── toy peaks ───────────────────────────────────────────────────────────────

export type PeakStyle = "massif" | "range" | "horn";

/** A smooth, repeatable noise on the plane (value noise, three octaves). */
export function noise2(x: number, y: number, seed: number): number {
  const hash = (i: number, j: number) => {
    const h = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  let total = 0;
  let amp = 1;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < 3; o++) {
    const X = x * f;
    const Y = y * f;
    const i = Math.floor(X);
    const j = Math.floor(Y);
    const u = smooth(X - i);
    const v = smooth(Y - j);
    const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * u;
    const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * u;
    total += (a + (b - a) * v) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return total / norm;
}

/**
 * One mountain as a radial mesh: rings round the summit, spokes down its
 * flanks, so its foot is a clean circle on the ground and its ridges and
 * valleys run along the spokes as crisp facets. `ridges` arêtes; `sharp`
 * shapes the flanks (higher: steeper near the top, a wider apron). Coloured
 * per face: snow above a wandering snowline (except on the steepest faces),
 * rock below, scree at the foot.
 */
function mountain(R: number, H: number, ridges: number, sharp: number, seed: number): G {
  const K = 14;
  const S = 44;
  const verts: number[] = [];
  const cols: number[] = [];
  const snow = new THREE.Color(SNOW);
  const snowShade = new THREE.Color("#e3e6ee");
  const rockHi = new THREE.Color("#b9a3ad");
  const rockLo = new THREE.Color("#9f8995");
  const scree = new THREE.Color("#d9c3ad");
  const at2 = (k: number, s: number): [number, number, number] => {
    const d = (k / K) ** 0.85;
    const a = (s / S) * Math.PI * 2;
    // Arêtes and the valleys between them, deepest mid-flank.
    const ridge = Math.abs(Math.cos(((a + seed) * ridges) / 2)) ** 2.5;
    const relief = (ridge - 0.45) * 0.36 * Math.sin(Math.PI * Math.min(1, d * 1.05));
    const rough =
      (noise2(Math.cos(a) * d * 3, Math.sin(a) * d * 3, seed) - 0.5) * 0.14 * Math.sin(Math.PI * d);
    const body = (1 - d) ** sharp;
    const h = k === K ? 0 : Math.max(0, H * (body + relief * (1 - d) + rough * (1 - d)));
    const rr = R * d * (1 + (ridge - 0.5) * 0.12 * d);
    return [Math.cos(a) * rr, h, Math.sin(a) * rr];
  };
  const face = (
    p: [number, number, number],
    q: [number, number, number],
    r: [number, number, number],
  ) => {
    const e1 = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const e2 = new THREE.Vector3(r[0] - p[0], r[1] - p[1], r[2] - p[2]);
    const steep = 1 - Math.abs(e1.cross(e2).normalize().y);
    const cy = (p[1] + q[1] + r[1]) / 3;
    const cx = (p[0] + q[0] + r[0]) / 3;
    const cz = (p[2] + q[2] + r[2]) / 3;
    const t = cy / H;
    const line = 0.56 + (noise2(cx * 0.5, cz * 0.5, seed + 9) - 0.5) * 0.2;
    let col: THREE.Color;
    if (t > line && steep < 0.75) col = steep < 0.5 ? snow : snowShade;
    else if (t > 0.2) col = rockHi.clone().lerp(rockLo, Math.min(1, steep * 1.15));
    // Down the foot, scree then the plain's own sand: no outline where it meets the ground.
    else if (t > 0.08) col = rockLo.clone().lerp(scree, Math.min(1, (0.2 - t) / 0.12));
    else
      col = scree
        .clone()
        .lerp(new THREE.Color(LADAKH_GROUND), Math.min(1, (0.08 - t) / 0.08) ** 0.7);
    for (const v of [p, q, r]) {
      verts.push(v[0], v[1], v[2]);
      cols.push(col.r, col.g, col.b);
    }
  };
  const top: [number, number, number] = [0, H * (1 + 0.04), 0];
  for (let s = 0; s < S; s++) {
    // The summit cap, then ring by ring down to the foot.
    face(top, at2(1, s + 1), at2(1, s));
    for (let k = 1; k < K; k++) {
      const a = at2(k, s);
      const b = at2(k, s + 1);
      const c = at2(k + 1, s + 1);
      const d = at2(k + 1, s);
      face(a, b, c);
      face(a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A toy mountain about `size` metres tall, with real relief and crisp facets:
 *  - massif: one broad summit, five ridges;
 *  - range: two summits with a saddle and a lower shoulder (three mountains
 *    run together);
 *  - horn: a sharp four-sided pyramid peak.
 */
export function peak(style: PeakStyle, size = 12, seed = 1): G {
  if (style === "massif") return mountain(size * 1.1, size, 5, 1.25, seed);
  if (style === "horn") return mountain(size * 0.75, size, 4, 0.95, seed + 0.4);
  const a = mountain(size * 0.95, size, 4, 1.2, seed);
  a.translate(-size * 0.35, 0, 0);
  const b = mountain(size * 0.82, size * 0.82, 5, 1.2, seed + 2);
  b.translate(size * 0.45, 0, size * 0.12);
  const c = mountain(size * 0.7, size * 0.55, 3, 1.3, seed + 5);
  c.translate(-size * 0.05, 0, -size * 0.5);
  return join([a, b, c]);
}

// ── mountains that belong to the land ───────────────────────────────────────

type P3 = [number, number, number];

/** A bag of flat-shaded, per-face-coloured triangles. */
class Facets {
  readonly verts: number[] = [];
  readonly cols: number[] = [];
  add(p: P3, q: P3, r: P3, col: THREE.Color): void {
    // Always facing up (out of the land), whichever way the corners came.
    const ny = (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]);
    const tri = ny < 0 ? [p, r, q] : [p, q, r];
    for (const v of tri) {
      this.verts.push(v[0], v[1], v[2]);
      this.cols.push(col.r, col.g, col.b);
    }
  }
  geometry(): G {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.verts, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.cols, 3));
    g.computeVertexNormals();
    return g;
  }
}

const C = (hex: string) => new THREE.Color(hex);
/** How steep a face is (0 flat … 1 vertical). */
function steepness(p: P3, q: P3, r: P3): number {
  const e1 = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
  const e2 = new THREE.Vector3(r[0] - p[0], r[1] - p[1], r[2] - p[2]);
  return 1 - Math.abs(e1.cross(e2).normalize().y);
}
/** Rock, snow and scree for a face at relative height t (0 foot … 1 crest). */
function rockColour(t: number, steep: number, line: number): THREE.Color {
  if (t > line && steep < 0.78) return steep < 0.5 ? C(SNOW) : C("#e3e6ee");
  if (t > 0.18) return C("#b9a3ad").lerp(C("#9f8995"), Math.min(1, steep * 1.15));
  if (t > 0.07) return C("#9f8995").lerp(C("#d9c3ad"), Math.min(1, (0.18 - t) / 0.11));
  return C("#d9c3ad").lerp(C(LADAKH_GROUND), Math.min(1, (0.07 - t) / 0.07) ** 0.7);
}

/**
 * A range wall: a continuous snowy ridgeline along `path` (x, z points),
 * `width` across at its foot, its crest rising and falling (summits and
 * cols), with a pass where the road crosses: at each `passes` point the
 * crest dips right down to the ground, so the road runs through between its
 * shoulders. The ends taper into the plateau.
 */
export function rangeWall(
  path: [number, number][],
  o: { width?: number; height?: number; passes?: [number, number][]; seed?: number } = {},
): G {
  const width = o.width ?? 14;
  const H = o.height ?? 9;
  const seed = o.seed ?? 3;
  const f = new Facets();
  // Resample the path every ~2 m.
  const pts: [number, number][] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i] as [number, number];
    const [bx, bz] = path[i + 1] as [number, number];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2));
    for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  pts.push(path[path.length - 1] as [number, number]);
  const M = 8;
  const rows: P3[][] = pts.map(([x, z], i) => {
    const a = pts[Math.max(0, i - 1)] as [number, number];
    const b = pts[Math.min(pts.length - 1, i + 1)] as [number, number];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l;
    const nz = dx / l;
    const end = Math.min(1, Math.min(i, pts.length - 1 - i) / 6);
    // The crest: summits and cols, and the passes cut down to the ground.
    let crest = H * (0.62 + 0.38 * noise2(i * 0.09, 0, seed)) * end ** 0.7;
    for (const [px, pz] of o.passes ?? []) {
      const d = Math.hypot(x - px, z - pz);
      crest *= Math.min(1, Math.max(0, (d - 4) / 10)) ** 1.4;
    }
    const w = width * (0.75 + 0.25 * noise2(i * 0.13, 5, seed)) * (0.4 + 0.6 * end);
    return Array.from({ length: M + 1 }, (_, k): P3 => {
      const u = (k / M) * 2 - 1;
      // A sharp crest, concave flanks, a buttress here and there.
      const prof = (1 - Math.abs(u)) ** 1.35;
      const rough = (noise2(i * 0.31, k * 0.7, seed + 1) - 0.5) * 0.18 * (1 - Math.abs(u));
      const h = k === 0 || k === M ? 0 : Math.max(0, crest * (prof + rough));
      return [x + nx * u * w * 0.5, h, z + nz * u * w * 0.5];
    });
  });
  for (let i = 0; i < rows.length - 1; i++) {
    const r0 = rows[i] as P3[];
    const r1 = rows[i + 1] as P3[];
    for (let k = 0; k < M; k++) {
      const a = r0[k] as P3;
      const b = r0[k + 1] as P3;
      const c = r1[k + 1] as P3;
      const d = r1[k] as P3;
      for (const [p, q, r] of [
        [a, c, b],
        [a, d, c],
      ] as [P3, P3, P3][]) {
        if (Math.max(p[1], q[1], r[1]) <= 0.001) continue;
        const cy = (p[1] + q[1] + r[1]) / 3;
        const line = 0.6 + (noise2(p[0] * 0.3, p[2] * 0.3, seed + 9) - 0.5) * 0.25;
        f.add(p, q, r, rockColour(cy / H, steepness(p, q, r), line));
      }
    }
  }
  return f.geometry();
}

/**
 * A glacier massif: one big peak with foothills grown into its flanks (so it
 * rises out of the land, not onto it), a glacier tongue flowing down its
 * valley (local +z) into a meltwater lake at its foot. Returns the rock and
 * ice, and the lake's outline (for the water, and for a stream to start).
 */
export function glacierMassif(
  size = 14,
  seed = 2,
): { body: G; lake: [number, number][]; outlet: [number, number] } {
  const main = mountain(size * 1.05, size, 5, 1.25, seed);
  const hills: G[] = [main];
  for (const [a, d, h, r] of [
    [0.9, 0.85, 0.42, 0.55],
    [2.3, 0.8, 0.36, 0.5],
    [3.6, 0.9, 0.5, 0.6],
    [4.9, 0.75, 0.32, 0.45],
  ] as const) {
    const m = mountain(size * r, size * h, 3, 1.15, seed + a);
    m.translate(Math.cos(a) * size * d, 0, -Math.sin(a) * size * d);
    hills.push(m);
  }
  // The glacier: an ice tongue down the valley towards +z, widening, cracked by crevasses.
  const f = new Facets();
  const ice = C("#eaf2f8");
  const blue = C("#bcd6e6");
  const steps = 14;
  let prev: [P3, P3] | null = null;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const z = size * (0.12 + t * 0.95);
    const y = size * (0.78 * (1 - t) ** 1.5) + size * 0.07;
    const w = size * (0.08 + t * 0.16);
    const wob = Math.sin(t * 5 + seed) * size * 0.04;
    const row: [P3, P3] = [
      [wob - w, y, z],
      [wob + w, y, z],
    ];
    if (prev) {
      const col = k % 3 === 0 ? blue : ice;
      f.add(prev[0], row[1], prev[1], col);
      f.add(prev[0], row[0], row[1], col);
    }
    prev = row;
  }
  const lake: [number, number][] = [];
  const lz = size * 1.22;
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    lake.push([
      Math.cos(a) * size * 0.32 * (1 + 0.1 * Math.sin(a * 3)),
      lz + Math.sin(a) * size * 0.2,
    ]);
  }
  return { body: join([...hills, f.geometry()]), lake, outlet: [size * 0.28, lz + size * 0.12] };
}

/**
 * Moonland: Lamayuru's eroded badlands. Flat-topped mesas built of banded
 * layers (ochre, cream, rust), each layer a little smaller than the one
 * below, in a cluster of different heights; their tops dusted pale.
 */
export function moonland(size = 12, seed = 4): G {
  const bands = ["#d9b48c", "#efdcc0", "#c9906f", "#e6c9a2", "#d2a383", "#f1e2c8"];
  const parts: G[] = [];
  const r = (k: number) => {
    const h = Math.sin(k * 91.7 + seed * 13.1) * 43758.5453;
    return h - Math.floor(h);
  };
  for (let m = 0; m < 6; m++) {
    const a = r(m) * Math.PI * 2;
    const d = m === 0 ? 0 : size * (0.45 + r(m + 10) * 0.55);
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    const rad = size * (m === 0 ? 0.42 : 0.18 + r(m + 20) * 0.18);
    const layers = m === 0 ? 6 : 3 + Math.floor(r(m + 30) * 3);
    let y = 0;
    for (let k = 0; k < layers; k++) {
      const h = size * (0.08 + r(m * 7 + k) * 0.06);
      const layer = prism({
        sides: 7,
        radius: rad * (1 - k * 0.09),
        height: h,
        taper: 0.93,
        jitter: 0.28,
        seed: seed + m * 10 + k,
        round: 0.12,
        bevel: 0.05,
      });
      paint(layer, bands[(k + m) % bands.length] as string);
      layer.translate(cx, y, cz);
      parts.push(layer);
      y += h * 0.98;
    }
  }
  return join(parts);
}

// ── where the mountains meet the plain ──────────────────────────────────────

/**
 * An alluvial fan: the gravel a side valley spills onto the plain, a pale
 * fan opening from its apex along `dir` (radians, 0 = +x), with braided
 * meltwater channels down it (the stream finds its way across).
 */
export function alluvialFan(
  apex: [number, number],
  dir: number,
  len = 22,
  spread = 0.55,
  seed = 1,
): THREE.Object3D {
  const g = new THREE.Group();
  const pts: [number, number][] = [apex];
  const n = 14;
  for (let k = 0; k <= n; k++) {
    const a = dir - spread + (2 * spread * k) / n;
    const r = len * (0.82 + 0.18 * Math.sin(k * 1.7 + seed));
    pts.push([apex[0] + Math.cos(a) * r, apex[1] - Math.sin(a) * r]);
  }
  g.add(flatShape(pts, "#f3e5d2", 0.003));
  // Braided channels: a few threads that wander apart down the fan.
  for (let c = 0; c < 3; c++) {
    const thread: [number, number][] = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const a = dir + (c - 1) * spread * 0.45 * t + Math.sin(t * 7 + c + seed) * 0.06;
      thread.push([apex[0] + Math.cos(a) * len * t * 0.95, apex[1] - Math.sin(a) * len * t * 0.95]);
    }
    g.add(ribbon(thread, 0.35, "#a9dbe3", 0.0045));
  }
  return g;
}

/** A Ladakhi house: whitewashed, flat-roofed, a maroon band and dark windows, firewood on the roof. */
export function ladakhiHouse(s = 1): G {
  return join([
    at(rbox(3.0 * s, 2.0 * s, 2.4 * s, WHITEWASH, 0.06), 0, 0, 0),
    at(rbox(3.1 * s, 0.22 * s, 2.5 * s, MAROON, 0.04), 0, 2.0 * s, 0),
    ...[-0.8, 0.6].map((x) =>
      at(rbox(0.45 * s, 0.5 * s, 0.05, "#2f3550", 0.02), x * s, 1.0 * s, 1.22 * s),
    ),
    at(rbox(0.7 * s, 1.1 * s, 0.05, MAROON, 0.02), 1.0 * s, 0, 1.22 * s),
    at(rbox(1.2 * s, 0.3 * s, 0.6 * s, "#b98a62", 0.06), -0.6 * s, 2.2 * s, -0.5 * s),
  ]);
}

/**
 * Barley terraces on a fan: small green fields in steps, stone-bordered,
 * alternating greens (one fallow), around a point.
 */
export function barleyTerraces(
  cx: number,
  cz: number,
  dir: number,
  rows = 4,
  cols = 3,
): THREE.Object3D {
  const g = new THREE.Group();
  const greens = ["#c3d68b", "#d4dd9b", "#b6cc7e", "#e6d7a8"];
  const fx = Math.cos(dir);
  const fz = -Math.sin(dir);
  const sx = -fz;
  const sz = fx;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const u = (c - (cols - 1) / 2) * 3.4;
      const v = r * 2.6;
      const x = cx + sx * u + fx * v;
      const z = cz + sz * u + fz * v;
      const w = 1.5;
      const h = 1.1;
      const corners: [number, number][] = [
        [x - sx * w - fx * h, z - sz * w - fz * h],
        [x + sx * w - fx * h, z + sz * w - fz * h],
        [x + sx * w + fx * h, z + sz * w + fz * h],
        [x - sx * w + fx * h, z - sz * w + fz * h],
      ];
      g.add(flatShape(corners, "#d9c8b2", 0.004));
      const inner = corners.map(
        ([px, pz]) => [x + (px - x) * 0.86, z + (pz - z) * 0.86] as [number, number],
      );
      g.add(flatShape(inner, greens[(r * cols + c) % greens.length] as string, 0.005));
    }
  return g;
}

/**
 * Rising land: the plain itself swelling into foothills that climb to rock
 * and snow. One continuous height field over a w × d patch, flat-faceted,
 * its rim exactly level with the plain and the plain's colour (no seam):
 * low swells in sand, then dusty ochre, rock, and snow on the summits.
 */
export function risingLand(
  w = 70,
  d = 50,
  peaks: [number, number, number, number][] = [
    [0, -8, 18, 16],
    [16, -2, 12, 11],
    [-18, 0, 13, 10],
  ],
  seed = 6,
): G {
  const f = new Facets();
  const N = 64;
  const top = Math.max(...peaks.map((p) => p[2]));
  const height = (x: number, z: number) => {
    // The patch's edge: everything eases to the plain.
    const ex = Math.min(1, (w / 2 - Math.abs(x)) / (w * 0.22));
    const ez = Math.min(1, (d / 2 - Math.abs(z)) / (d * 0.22));
    const edge = Math.max(0, Math.min(ex, ez));
    const e = edge * edge * (3 - 2 * edge);
    let h = 0;
    for (const [px, pz, ph, pr] of peaks) {
      const dd = Math.hypot(x - px, z - pz) / pr;
      const a = Math.atan2(z - pz, x - px);
      const ridge = Math.abs(Math.cos((a + px) * 2.5)) ** 2;
      h = Math.max(h, ph * Math.max(0, 1 - dd) ** 1.3 * (1 + (ridge - 0.45) * 0.4 * dd));
    }
    // The swells of the foothills between and round them.
    const swell = (noise2(x * 0.06, z * 0.06, seed) - 0.35) * 5;
    return Math.max(0, (h + Math.max(0, swell)) * e);
  };
  const step = w / N;
  const pt = (i: number, j: number): P3 => {
    const x = -w / 2 + (i + (j % 2) * 0.5) * step;
    const z = -d / 2 + j * step * 0.866;
    return [x, height(x, z), z];
  };
  const rows = Math.ceil(d / (step * 0.866));
  const sand = C(LADAKH_GROUND);
  const ochre = C("#dcc0a0");
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < N; i++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + (j % 2), j + 1);
      const e = pt(i + (j % 2) - 1, j + 1);
      for (const [p, q, r] of [
        [a, c, b],
        [a, e, c],
      ] as [P3, P3, P3][]) {
        const cy = (p[1] + q[1] + r[1]) / 3;
        if (cy <= 0.002) continue;
        const t = cy / top;
        const steep = steepness(p, q, r);
        const line = 0.62 + (noise2(p[0] * 0.2, p[2] * 0.2, seed + 3) - 0.5) * 0.2;
        let col: THREE.Color;
        if (t > line && steep < 0.75) col = steep < 0.5 ? C(SNOW) : C("#e3e6ee");
        else if (t > 0.3) col = C("#b9a3ad").lerp(C("#9f8995"), Math.min(1, steep * 1.1));
        else if (t > 0.1) col = ochre.clone().lerp(C("#b9a3ad"), (t - 0.1) / 0.2);
        else col = sand.clone().lerp(ochre, (t / 0.1) ** 0.8);
        f.add(p, q, r, col);
      }
    }
  return f.geometry();
}

// ── valleys: the mountains as land you ride through ─────────────────────────

export interface ValleyOptions {
  /** Along x (m) and across z (m): the whole patch, mountains and their fading edges. */
  length: number;
  width: number;
  /** The valley's axis: its z at each x (the river runs down it). */
  axis: (x: number) => number;
  /** Half-width of the flat valley floor at x. */
  floor: (x: number) => number;
  /** The walls' height (the summits go a little higher). */
  height: number;
  /** How far the walls reach out from the floor's edge to their crests. */
  reach: number;
  /** A road shelf cut into one wall: which side (+1 or −1 in z), how far up, how wide. */
  shelf?: { side: 1 | -1; height: number; half: number };
  /** What the floor is: a river's gravel bed, green fields, or plain sand. */
  floorColour?: string;
  seed?: number;
}

export interface Valley {
  ground: G;
  /** The road along the shelf (x, y, z), if there's one. */
  road: [number, number, number][];
  /** The river down the middle (x, z). */
  river: [number, number][];
  /** Ground height anywhere in the patch (for placing things, and for riding). */
  heightAt: (x: number, z: number) => number;
}

/**
 * A valley carved through mountains, as one continuous height field (flat
 * faceted, coloured like the toys: sand, ochre hills, warm grey-brown rock,
 * snow): a flat floor down the middle carrying the river; walls rising
 * steeply either side to ridged crests well over ten times the bike's
 * height; at the open ends and the outer edges the mountains fall to rolling
 * hills, then to the dead-flat plain (no seam). Optionally a shelf cut into
 * one wall a few metres above the river, the road riding along it and
 * easing down to the plain at the valley's mouths.
 */
export function valley(o: ValleyOptions): Valley {
  const seed = o.seed ?? 11;
  const L = o.length;
  const Wd = o.width;
  const H = o.height;
  const shelfAt = (x: number) => {
    if (!o.shelf) return 0;
    // Up on its bench through the gorge, down to the plain at each mouth.
    const u = Math.abs(x) / (L / 2);
    const k = Math.min(1, Math.max(0, (0.72 - u) / 0.22));
    return o.shelf.height * k * k * (3 - 2 * k);
  };
  const shelfZ = (x: number) =>
    o.axis(x) + (o.shelf ? o.shelf.side * (o.floor(x) + o.shelf.half + 2.2) : 0);
  const heightAt = (x: number, z: number): number => {
    const dz = z - o.axis(x);
    // Spurs reach into the valley and side ravines cut back between them.
    const spur = (noise2(x * 0.035, Math.sign(dz) * 3, seed + 4) - 0.5) * o.reach * 0.55;
    const off = Math.abs(dz) - o.floor(x) - Math.max(0, spur) * 0.6 + Math.min(0, spur) * -0.4;
    // How mountainous here: full in the middle, hills towards the ends and the sides, then plain.
    const ex = 1 - Math.min(1, Math.max(0, (Math.abs(x) - L * 0.28) / (L * 0.22)));
    const ez =
      1 - Math.min(1, Math.max(0, (Math.abs(dz) - (o.floor(x) + o.reach * 1.1)) / (Wd * 0.18)));
    const grand = Math.min(ex, ez);
    const g = grand * grand * (3 - 2 * grand);
    let h = 0;
    if (off > 0) {
      // The wall: steep from the floor, then the crest (ridged, with summits and cols).
      const t = Math.min(1, off / o.reach);
      const wall = 1 - (1 - t) ** 1.7;
      // Distinct summits and cols along the crest.
      const crest = 0.5 + 0.85 * noise2(x * 0.011, Math.sign(dz) * 7, seed) ** 1.4;
      const ribs = (noise2(x * 0.09, off * 0.06 + Math.sign(dz) * 5, seed + 1) - 0.5) * 0.14 * t;
      const beyond = off > o.reach ? Math.max(0, 1 - (off - o.reach) / (o.reach * 1.4)) : 1;
      h = H * (wall * crest + ribs) * beyond;
    }
    // Rolling hills where the mountains fade (and a little everywhere off the floor).
    // (Never on the valley floor itself: it stays flat for the river, the fields and the road.)
    const hills =
      Math.max(0, noise2(x * 0.03, z * 0.03, seed + 2) - 0.42) *
      9 *
      Math.min(1, Math.max(0, (off - 3) / 6));
    let y =
      h * g +
      hills *
        (1 - g) *
        Math.min(1, Math.max(0, off / 6)) *
        Math.max(0, 1 - Math.max(0, Math.abs(x) - L * 0.42) / (L * 0.08));
    // The plain at the very edges.
    const fx = Math.min(1, (L / 2 - Math.abs(x)) / (L * 0.06));
    const fz = Math.min(1, (Wd / 2 - Math.abs(z)) / (Wd * 0.06));
    y *= Math.max(0, Math.min(fx, fz));
    // The road shelf: a flat bench cut into the wall.
    if (o.shelf) {
      const dzs = Math.abs(z - shelfZ(x));
      const sh = shelfAt(x);
      if (dzs < o.shelf.half + 0.6) y = sh;
      else if (dzs < o.shelf.half + 3.2 && y > sh)
        y = sh + (y - sh) * ((dzs - o.shelf.half - 0.6) / 2.6);
    }
    return Math.max(0, y);
  };
  const f = new Facets();
  const step = 2.4;
  const N = Math.ceil(L / step);
  const rows = Math.ceil(Wd / (step * 0.866));
  const pt = (i: number, j: number): P3 => {
    const x = -L / 2 + (i + (j % 2) * 0.5) * step;
    const z = -Wd / 2 + j * step * 0.866;
    return [x, heightAt(x, z), z];
  };
  const sand = C(LADAKH_GROUND);
  const ochre = C("#dcc3a3");
  const rock = C("#b8a196");
  const rockDark = C("#9d8580");
  const floorC = C(o.floorColour ?? "#e6d9c6");
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < N; i++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + (j % 2), j + 1);
      const e = pt(i + (j % 2) - 1, j + 1);
      for (const [p, q, r] of [
        [a, c, b],
        [a, e, c],
      ] as [P3, P3, P3][]) {
        const cx = (p[0] + q[0] + r[0]) / 3;
        const cz = (p[2] + q[2] + r[2]) / 3;
        const cy = (p[1] + q[1] + r[1]) / 3;
        const onFloor = cy < 0.6 && Math.abs(cz - o.axis(cx)) < o.floor(cx) + 1.5;
        const onShelf =
          o.shelf &&
          Math.abs(cz - shelfZ(cx)) < o.shelf.half + 0.4 &&
          Math.abs(cy - shelfAt(cx)) < 0.2 &&
          cy > 0.3;
        if (cy <= 0.002 && !onFloor) continue;
        const t = cy / H;
        const steep = steepness(p, q, r);
        // Snow only up on the summits (Spiti and Ladakh are mostly bare rock).
        const line = 0.84 + (noise2(cx * 0.04, cz * 0.04, seed + 5) - 0.5) * 0.16;
        let col: THREE.Color;
        if (onFloor) col = floorC;
        else if (onShelf) col = C("#d9cdbf");
        else if (t > line && steep < 0.65) col = steep < 0.45 ? C(SNOW) : C("#e3e6ee");
        else if (t > 0.28) col = rock.clone().lerp(rockDark, Math.min(1, steep * 1.2));
        else if (t > 0.08) col = ochre.clone().lerp(rock, (t - 0.08) / 0.2);
        else col = sand.clone().lerp(ochre, (t / 0.08) ** 0.8);
        f.add(p, q, r, col);
      }
    }
  const road: [number, number, number][] = [];
  const river: [number, number][] = [];
  for (let x = -L / 2; x <= L / 2; x += 2) {
    river.push([x, o.axis(x) + Math.sin(x * 0.09) * o.floor(x) * 0.35]);
    if (o.shelf) road.push([x, shelfAt(x) + 0.01, shelfZ(x)]);
  }
  return { ground: f.geometry(), road, river, heightAt };
}

// ── a pass at the top: Umling La ────────────────────────────────────────────

export type Surface = "paved" | "gravel";

export interface PassMountain {
  ground: G;
  /** The road up, as 3D points, each with its surface (paved, then gravel, then paved again). */
  road: { p: [number, number, number]; surface: Surface }[];
  /** The summit's flat top (x, y, z) where the pass is. */
  summit: [number, number, number];
  /** The terrace beside the road partway up (for the monastery): its middle, and which way it faces the road. */
  terrace: { p: [number, number, number]; yaw: number } | null;
  heightAt: (x: number, z: number) => number;
}

/**
 * A mountain with a road up to the pass at its top. The road climbs one face
 * in hairpin loops (Gata loops), then spirals round the peak to a flat
 * summit; it's cut into the mountain as a bench (a cut slope above, an
 * embankment below), its grade steady all the way. Paved at the bottom,
 * gravel through the middle, paved again near the top. Around it the
 * mountain fades to hills and then the plain.
 */
export function passMountain(
  o: {
    radius?: number;
    height?: number;
    loops?: number;
    seed?: number;
    /** A terrace beside the road for a monastery: how far up the road (0–1) and how big. */
    terrace?: { at: number; size: number };
  } = {},
): PassMountain {
  const R0 = o.radius ?? 100;
  const H = o.height ?? 46;
  const loops = o.loops ?? 6;
  const seed = o.seed ?? 13;
  // ── the road's path (x, z), then its heights along it ──
  const path: [number, number][] = [];
  const add = (x: number, z: number) => path.push([x, z]);
  // In from the plain to the foot of the loops.
  for (let t = 0; t <= 1; t += 0.1) add(-44 + t * 16, R0 * 1.12 - t * (R0 * 1.12 - R0 * 0.9));
  // The loops: legs across the south face, joined by hairpins, climbing towards the summit.
  const span = R0 * 0.3;
  const rise = (R0 * 0.55) / loops;
  let z = R0 * 0.9;
  let dir = 1;
  for (let k = 0; k < loops; k++) {
    const x0 = -span * dir;
    const x1 = span * dir;
    for (let t = 0.1; t <= 1.0001; t += 0.1) add(x0 + (x1 - x0) * t, z - t * rise * 0.55);
    // The hairpin: a half circle round to the next leg up the face.
    const cz = z - rise * 0.55 - rise * 0.225;
    const r = rise * 0.225;
    for (let a = 0.2; a <= Math.PI - 0.19; a += 0.2)
      add(x1 + dir * Math.sin(a) * r * 1.4, cz + Math.cos(a) * r);
    z -= rise;
    dir = -dir;
  }
  // Then round the peak, spiralling in to the top.
  const [sx, sz] = path[path.length - 1] as [number, number];
  const a0 = Math.atan2(sz, sx);
  const r0 = Math.hypot(sx, sz);
  const turns = 1.15;
  const rTop = R0 * 0.06;
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    const a = a0 + t * turns * Math.PI * 2 * -dir;
    const r = r0 + (rTop - r0) * t;
    add(Math.cos(a) * r, Math.sin(a) * r);
  }
  // Heights: a steady grade from the plain to the top.
  const lens = [0];
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1] as [number, number];
    const [bx, bz] = path[i] as [number, number];
    lens.push((lens[i - 1] as number) + Math.hypot(bx - ax, bz - az));
  }
  const total = lens[lens.length - 1] as number;
  const top = H * 0.94;
  const climbFrom = lens[10] as number;
  const roadY = (i: number) =>
    Math.max(0, ((lens[i] as number) - climbFrom) / (total - climbFrom)) * top;
  const road = path.map(([x, zz], i) => {
    const f = (lens[i] as number) / total;
    return {
      p: [x, roadY(i), zz] as [number, number, number],
      surface: (f > 0.42 && f < 0.74 ? "gravel" : "paved") as Surface,
    };
  });
  // The terrace: beside the road at its point, on the uphill side (towards the summit).
  let terrace: PassMountain["terrace"] = null;
  if (o.terrace) {
    let i = 0;
    while (i < path.length - 2 && (lens[i] as number) / total < o.terrace.at) i++;
    const [px, pz] = path[i] as [number, number];
    const [qx, qz] = path[i + 1] as [number, number];
    const dx = qx - px;
    const dz = qz - pz;
    const l = Math.hypot(dx, dz) || 1;
    let nx = -dz / l;
    let nz = dx / l;
    if (nx * -px + nz * -pz < 0) {
      nx = -nx;
      nz = -nz;
    }
    const off = 2.3 + o.terrace.size * 0.7;
    terrace = { p: [px + nx * off, roadY(i), pz + nz * off], yaw: Math.atan2(-nx, -nz) };
  }
  // Segments binned by area, for finding the road near any point quickly.
  const CELL = 10;
  const bins = new Map<string, number[]>();
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i] as [number, number];
    const [bx, bz] = path[i + 1] as [number, number];
    for (
      let gx = Math.floor((Math.min(ax, bx) - 8) / CELL);
      gx <= Math.floor((Math.max(ax, bx) + 8) / CELL);
      gx++
    )
      for (
        let gz = Math.floor((Math.min(az, bz) - 8) / CELL);
        gz <= Math.floor((Math.max(az, bz) + 8) / CELL);
        gz++
      ) {
        const k = `${gx},${gz}`;
        const list = bins.get(k) ?? [];
        list.push(i);
        bins.set(k, list);
      }
  }
  const nearRoad = (x: number, z: number): { d: number; y: number } => {
    let best = { d: Number.POSITIVE_INFINITY, y: 0 };
    for (const i of bins.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
      const [ax, az] = path[i] as [number, number];
      const [bx, bz] = path[i + 1] as [number, number];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best.d) best = { d, y: roadY(i) + (roadY(i + 1) - roadY(i)) * t };
    }
    return best;
  };
  // ── the mountain, with the road cut into it ──
  const natural = (x: number, zz: number) => {
    const r = Math.hypot(x, zz) / R0;
    if (r >= 1.5) return 0;
    const a = Math.atan2(zz, x);
    const cone = Math.max(0, 1 - r) ** 0.95;
    const ridge =
      (Math.abs(Math.cos((a + seed) * 2.5)) ** 2.5 - 0.4) *
      0.22 *
      Math.sin(Math.PI * Math.min(1, r));
    const hills =
      Math.max(0, noise2(x * 0.03, zz * 0.03, seed) - 0.4) *
      7 *
      Math.max(0, Math.min(1, (r - 0.7) / 0.3)) *
      Math.max(0, (1.5 - r) / 0.5);
    return Math.max(0, H * (cone + ridge * (1 - r)) + hills);
  };
  const half = 2.3;
  const heightAt = (x: number, zz: number) => {
    // The summit: a flat top for the pass (its edge easing into the peak).
    const rs = Math.hypot(x, zz);
    if (rs < R0 * 0.1) return top;
    const n0 = natural(x, zz);
    let n = rs < R0 * 0.16 ? top + (n0 - top) * ((rs - R0 * 0.1) / (R0 * 0.06)) : n0;
    // The monastery's terrace: level with the road there, easing into the slope round it.
    if (terrace && o.terrace) {
      const td = Math.hypot(x - terrace.p[0], zz - terrace.p[2]);
      const tr = o.terrace.size;
      if (td < tr) return terrace.p[1];
      if (td < tr + 8) n = terrace.p[1] + (n - terrace.p[1]) * ((td - tr) / 8) ** 1.5;
    }
    const rd = nearRoad(x, zz);
    if (rd.d < half + 0.5) return rd.y;
    // A cut slope above the road, an embankment below, then the mountain.
    const k = Math.min(1, (rd.d - half - 0.5) / 7);
    return rd.y + (n - rd.y) * k * k * (3 - 2 * k);
  };
  const f = new Facets();
  const ext = R0 * 1.55;
  const step = 2.2;
  const N = Math.ceil((ext * 2) / step);
  const rows = Math.ceil((ext * 2) / (step * 0.866));
  const pt = (i: number, j: number): P3 => {
    const x = -ext + (i + (j % 2) * 0.5) * step;
    const zz = -ext + j * step * 0.866;
    return [x, heightAt(x, zz), zz];
  };
  const sand = C(LADAKH_GROUND);
  const ochre = C("#dcc3a3");
  const rock = C("#b8a196");
  const rockDark = C("#9d8580");
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < N; i++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + (j % 2), j + 1);
      const e = pt(i + (j % 2) - 1, j + 1);
      for (const [p, q, r] of [
        [a, c, b],
        [a, e, c],
      ] as [P3, P3, P3][]) {
        const cy = (p[1] + q[1] + r[1]) / 3;
        if (cy <= 0.01) continue;
        const cx = (p[0] + q[0] + r[0]) / 3;
        const cz = (p[2] + q[2] + r[2]) / 3;
        const t = cy / H;
        const steep = steepness(p, q, r);
        const onRoad = nearRoad(cx, cz).d < half + 0.6;
        const line = 0.78 + (noise2(cx * 0.05, cz * 0.05, seed + 5) - 0.5) * 0.14;
        let col: THREE.Color;
        if (onRoad) col = C("#d6cbbd");
        else if (t > line && steep < 0.65) col = steep < 0.45 ? C(SNOW) : C("#e3e6ee");
        else if (t > 0.26) col = rock.clone().lerp(rockDark, Math.min(1, steep * 1.2));
        else if (t > 0.07) col = ochre.clone().lerp(rock, (t - 0.07) / 0.19);
        else col = sand.clone().lerp(ochre, (t / 0.07) ** 0.8);
        f.add(p, q, r, col);
      }
    }
  const last = road[road.length - 1] as { p: [number, number, number] };
  return { ground: f.geometry(), road, summit: last.p, terrace, heightAt };
}

// ── the range at the world's edge ───────────────────────────────────────────

export interface RangeCorner {
  ground: G;
  /** The two roads over Umling La (south face up, north face down), and the valley road; each point with its surface. */
  roads: { p: [number, number, number]; surface: Surface }[][];
  /** The river down the valley (x, z). */
  river: [number, number][];
  /** The pass (its flat top) and the monastery's site on the plain. */
  pass: [number, number, number];
  monastery: [number, number];
  heightAt: (x: number, z: number) => number;
}

/**
 * The corner of the tile where the world's two seams cross: the mountain
 * range runs along one seam (here the x axis, z = 0) and the river valley
 * along the other (x = 0). On the wrapping world they're each one continuous
 * feature: the range rings the world one way, the valley the other. Where
 * they meet the river cuts a gorge through the range. Umling La is a col on
 * the ridge (at x = passX), with a hairpin road down each face to the plain
 * either side; a road runs down the valley beside the river, through the
 * gorge. The range falls to hills and then the plain away from its crest.
 */
export function rangeCorner(
  o: { size?: number; height?: number; passX?: number; seed?: number } = {},
): RangeCorner {
  const S = o.size ?? 300;
  const H = o.height ?? 44;
  const passX = o.passX ?? 75;
  const seed = o.seed ?? 17;
  const F = 9;
  const band = 48;
  const passH = H * 0.62;
  const natural = (x: number, z: number) => {
    const d = Math.abs(z);
    // The crest along the range: summits and cols, and the pass's col.
    let crest =
      H *
      (0.72 + 0.4 * noise2(x * 0.012, 3, seed)) *
      (1 + (noise2(x * 0.05, 9, seed) - 0.5) * 0.15);
    crest = crest - (crest - passH) * Math.exp(-(((x - passX) / 16) ** 2));
    const across = Math.max(0, 1 - d / band) ** 1.45;
    const spurs = (noise2(x * 0.04, z * 0.04, seed + 1) - 0.5) * 0.25 * (1 - d / band);
    let range = crest * Math.max(0, across + (d < band ? spurs : 0));
    // Foothills beyond the range's flanks, fading to the plain.
    const hills =
      Math.max(0, noise2(x * 0.03, z * 0.03, seed + 2) - 0.38) *
      10 *
      Math.max(0, 1 - Math.abs(d - band * 1.15) / (band * 0.8));
    // The valley cuts through: its floor flat, the gorge walls the range's own flanks.
    const ax = Math.abs(x);
    const cut = Math.min(1, Math.max(0, (ax - F) / 30));
    range *= cut * cut * (3 - 2 * cut);
    // Low valley walls (hills) either side of the river, all the way along.
    const vw = ax > F ? Math.min(1, (ax - F) / 14) * Math.max(0, 1 - (ax - F - 26) / 30) : 0;
    const valleyHills = 9 * Math.max(0, vw) * (0.6 + 0.6 * noise2(z * 0.02, ax * 0.05, seed + 3));
    return Math.max(range, hills * (ax > F + 4 ? 1 : 0), valleyHills);
  };
  // ── the roads over the pass: hairpins down each face from the col ──
  const face = (side: 1 | -1, loops: number): [number, number][] => {
    const pts: [number, number][] = [];
    const span = 22;
    let z = side * 6;
    let dir = side;
    for (let k = 0; k < loops; k++) {
      const leg = (band * 0.85) / loops;
      for (let t = 0.1; t <= 1.0001; t += 0.1)
        pts.push([
          passX + span * dir * (t * 2 - 1) * 0.5 + 4 * Math.sin(k),
          z + side * t * leg * 0.7,
        ]);
      const cz = z + side * leg * 0.85;
      for (let a = 0.25; a <= Math.PI - 0.24; a += 0.25)
        pts.push([
          passX + span * dir * 0.5 + dir * Math.sin(a) * 5,
          z + side * leg * 0.7 + side * (1 - Math.cos(a)) * leg * 0.08,
        ]);
      z = cz;
      dir = -dir as 1 | -1;
    }
    // Out onto the plain.
    for (let t = 0.1; t <= 1.0001; t += 0.1)
      pts.push([passX - span * dir * 0.5 * (1 - t) - 10 * t, z + side * t * 40]);
    return pts;
  };
  const top: [number, number] = [passX, 0];
  const south = [top, ...face(-1, 5)];
  const north = [top, ...face(1, 5)];
  const lensOf = (path: [number, number][]) => {
    const l = [0];
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1] as [number, number];
      const [bx, bz] = path[i] as [number, number];
      l.push((l[i - 1] as number) + Math.hypot(bx - ax, bz - az));
    }
    return l;
  };
  type Rd = { path: [number, number][]; y: (i: number) => number; half: number };
  const mk = (path: [number, number][]): Rd => {
    const l = lensOf(path);
    const total = l[l.length - 1] as number;
    // Down from the pass at a steady grade, level on the plain.
    const descent = total - 40;
    return { path, y: (i) => passH * Math.max(0, 1 - (l[i] as number) / descent), half: 2.3 };
  };
  const roadsIn = [mk(south), mk(north)];
  // The valley road beside the river, level, through the gorge.
  const vpath: [number, number][] = [];
  for (let z = -S / 2; z <= S / 2; z += 3) vpath.push([-F + 3.2 + Math.sin(z * 0.03) * 1.2, z]);
  roadsIn.push({ path: vpath, y: () => 0, half: 2.1 });
  // Find the road near a point (binned), and its height there.
  const CELL = 10;
  const bins = new Map<string, [number, number][]>();
  roadsIn.forEach((r, ri) => {
    for (let i = 0; i < r.path.length - 1; i++) {
      const [ax, az] = r.path[i] as [number, number];
      const [bx, bz] = r.path[i + 1] as [number, number];
      for (
        let gx = Math.floor((Math.min(ax, bx) - 9) / CELL);
        gx <= Math.floor((Math.max(ax, bx) + 9) / CELL);
        gx++
      )
        for (
          let gz = Math.floor((Math.min(az, bz) - 9) / CELL);
          gz <= Math.floor((Math.max(az, bz) + 9) / CELL);
          gz++
        ) {
          const k = `${gx},${gz}`;
          const list = bins.get(k) ?? [];
          list.push([ri, i]);
          bins.set(k, list);
        }
    }
  });
  const nearRoad = (x: number, z: number) => {
    let best = { d: Number.POSITIVE_INFINITY, y: 0, half: 2.2 };
    for (const [ri, i] of bins.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
      const r = roadsIn[ri] as Rd;
      const [ax, az] = r.path[i] as [number, number];
      const [bx, bz] = r.path[i + 1] as [number, number];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best.d) best = { d, y: r.y(i) + (r.y(i + 1) - r.y(i)) * t, half: r.half };
    }
    return best;
  };
  const monastery: [number, number] = [passX - 40, -band * 1.9];
  const heightAt = (x: number, z: number) => {
    // The pass: a flat saddle on the ridge.
    const dp = Math.hypot(x - passX, z);
    let n = natural(x, z);
    // The monastery's ground: level plain round its courtyard.
    const dm = Math.hypot(x - monastery[0], z - monastery[1]);
    if (dm < 26) n *= Math.max(0, (dm - 15) / 11) ** 1.5;
    if (dp < 9) return passH;
    if (dp < 16) n = passH + (n - passH) * ((dp - 9) / 7) ** 1.3;
    const rd = nearRoad(x, z);
    if (rd.d < rd.half + 0.5) return rd.y;
    const k = Math.min(1, (rd.d - rd.half - 0.5) / 7);
    return rd.y + (n - rd.y) * k * k * (3 - 2 * k);
  };
  // ── the mesh ──
  const f = new Facets();
  const step = 2.4;
  const N = Math.ceil(S / step);
  const rows = Math.ceil(S / (step * 0.866));
  const pt = (i: number, j: number): P3 => {
    const x = -S / 2 + (i + (j % 2) * 0.5) * step;
    const z = -S / 2 + j * step * 0.866;
    return [x, heightAt(x, z), z];
  };
  const sand = C(LADAKH_GROUND);
  const ochre = C("#dcc3a3");
  const rock = C("#b8a196");
  const rockDark = C("#9d8580");
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < N; i++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + (j % 2), j + 1);
      const e = pt(i + (j % 2) - 1, j + 1);
      for (const [p, q, r] of [
        [a, c, b],
        [a, e, c],
      ] as [P3, P3, P3][]) {
        const cx = (p[0] + q[0] + r[0]) / 3;
        const cz = (p[2] + q[2] + r[2]) / 3;
        const cy = (p[1] + q[1] + r[1]) / 3;
        const floor = Math.abs(cx) < F + 1 && cy < 0.5;
        if (cy <= 0.01 && !floor) continue;
        const t = cy / H;
        const steep = steepness(p, q, r);
        const line = 0.8 + (noise2(cx * 0.05, cz * 0.05, seed + 5) - 0.5) * 0.14;
        let col: THREE.Color;
        if (floor) col = C("#e2d4c2");
        else if (nearRoad(cx, cz).d < 2.8) col = C("#d6cbbd");
        else if (t > line && steep < 0.65) col = steep < 0.45 ? C(SNOW) : C("#e3e6ee");
        else if (t > 0.26) col = rock.clone().lerp(rockDark, Math.min(1, steep * 1.2));
        else if (t > 0.07) col = ochre.clone().lerp(rock, (t - 0.07) / 0.19);
        else col = sand.clone().lerp(ochre, (t / 0.07) ** 0.8);
        f.add(p, q, r, col);
      }
    }
  const roads = roadsIn.map((r, ri) => {
    const l = lensOf(r.path);
    const total = l[l.length - 1] as number;
    return r.path.map(([x, z], i) => ({
      p: [x, r.y(i), z] as [number, number, number],
      // Over the pass: paved by the plain, gravel up high, paved at the top.
      surface: (ri < 2 && (l[i] as number) / total > 0.18 && (l[i] as number) / total < 0.6
        ? "gravel"
        : "paved") as Surface,
    }));
  });
  const river: [number, number][] = [];
  for (let z = -S / 2; z <= S / 2; z += 2) river.push([Math.sin(z * 0.05) * 2.5 + 1.5, z]);
  return {
    ground: f.geometry(),
    roads,
    river,
    pass: [passX, passH, 0],
    monastery,
    heightAt,
  };
}

// ── the AstroClub tile: a valley between the ridge that rings the world ─────

export interface LadakhTile {
  ground: G;
  /** The roads: two down from Umling La (one each side of the ridge), and the valley road. */
  roads: { p: [number, number, number]; surface: Surface }[][];
  river: [number, number][];
  pass: [number, number, number];
  monastery: [number, number];
  /** Small stone bridges where lanes cross the river. */
  bridges: { x: number; z: number; yaw: number }[];
  /** Pangong: a long lake of its own (not on the river) on the north side of the valley. Its middle (x), half-length (a), half-width (b), its centreline and half-width at any x. */
  lake: {
    x: number;
    a: number;
    b: number;
    mid: (x: number) => number;
    half: (x: number) => number;
    outline: [number, number][];
  };
  /** Hamlets of village homes beside the lanes (each on its own level patch), and which way the road lies. */
  hamlets: { x: number; z: number; face: number }[];
  /** Small gompas out on the floor and the foothills' toes. */
  gompas: [number, number][];
  /** The ford across the river (where the pass roads meet the valley). */
  ford: { x: number; z: number };
  /** Each road's half-width, in the order of `roads`. */
  halves: number[];
  /**
   * The stops' landmark sites: where each stands (on its own level bench, at
   * the height of the road beside it), turned so its front (local +z) faces
   * that road, and which road point it's beside (road index, point index).
   */
  sites: { key: string; x: number; z: number; y: number; yaw: number; road: number; i: number }[];
  heightAt: (x: number, z: number) => number;
}

/** Noise that repeats every `period` along x (sampled round a circle), so the tile wraps without a seam. */
export function loopNoise(
  x: number,
  z: number,
  period: number,
  scale: number,
  seed: number,
): number {
  const a = (x / period) * Math.PI * 2;
  const r = (period * scale) / (Math.PI * 2);
  return noise2(Math.cos(a) * r + z * scale * 0.37, Math.sin(a) * r + z * scale, seed);
}

/**
 * The AstroClub world's land, as one tile of a wrapping world: the mountain
 * ridge runs along its top and bottom edges (one ridge ringing the world:
 * its crest is the seam), and between them the whole tile is the valley,
 * its river running parallel to the ridge right across the tile and out
 * through its left and right edges (one river ringing the world the other
 * way). The ridge's flanks fall to foothills and then the valley floor.
 * Umling La is a col on the crest with a hairpin road down each face, both
 * into this same valley (one from the top edge, one from the bottom), and a
 * road runs along the valley by the river. Colour blends smoothly with
 * height and slope (sand, ochre, rock, snow), shaded soft: no flat
 * triangles, no sudden bands.
 */
export function ladakhTile(
  o: {
    w?: number;
    d?: number;
    height?: number;
    passX?: number;
    seed?: number;
    /** How deep each landmark is (front to back, half) and how wide its bench must be (radius). */
    footprint?: (key: string) => { depth: number; radius: number };
  } = {},
): LadakhTile {
  const W = o.w ?? 300;
  const D = o.d ?? 240;
  const H = o.height ?? 46;
  const passX = o.passX ?? 60;
  const seed = o.seed ?? 19;
  const band = D * 0.27;
  const passH = H * 0.6;
  const riverZ = (x: number) =>
    6 * Math.sin((x / W) * Math.PI * 2 * 2 + 1) + 3 * Math.sin((x / W) * Math.PI * 2 * 3);
  // The valley road (south bank) and the north-bank lane drift nearer the river and away
  // from it, never parallel for long: 8 to 22 m off the water.
  const u = (x: number) => (x / W) * Math.PI * 2;
  // Pangong: a long, narrow lake of its own, apart from the river, lying along the valley on
  // its north side under the foothills; the north-bank lane runs along its near shore.
  const lakeX = -50;
  const lakeA = 42;
  const lakeB = 15;
  const lakeMid = (x: number) => riverZ(x) + 44 + 2 * Math.sin((x - lakeX) * 0.06);
  const lakeHalf = (x: number) => {
    const q = (x - lakeX) / lakeA;
    return Math.abs(q) < 1 ? lakeB * Math.sqrt(1 - q * q) * (1 + 0.12 * Math.sin(q * 7)) : 0;
  };
  const vroadZ = (x: number) =>
    riverZ(x) - 15 - 4.5 * Math.sin(u(x) * 2 + 0.7) - 2 * Math.sin(u(x) * 3 + 2.1);
  // The north-bank lane leaves the river to follow Pangong's near shore along most of its
  // length, a few metres off the water, then eases back.
  const hug = (x: number) => {
    const t = Math.min(1, Math.max(0, (Math.abs(x - lakeX) - lakeA * 0.55) / (lakeA * 0.75)));
    return 1 - t * t * (3 - 2 * t);
  };
  const northZ = (x: number) => {
    const base = riverZ(x) + 15 + 5 * Math.sin(u(x) * 3 + 2) + 2 * Math.sin(u(x) * 5 + 0.4);
    const shoreZ = lakeMid(x) - Math.max(lakeHalf(x), lakeB * 0.55) - 4.5;
    return base + (shoreZ - base) * hug(x);
  };
  // Distance in from the seam (the crest): 0 on the crest, band at the ridge's foot.
  const fromCrest = (z: number) => D / 2 - Math.abs(z);
  const natural = (x: number, z: number) => {
    const d = fromCrest(z);
    let crest = H * (0.7 + 0.45 * loopNoise(x, 0, W, 0.012, seed));
    crest -= (crest - passH) * Math.exp(-(((x - passX) / 18) ** 2));
    const across = Math.max(0, 1 - d / band) ** 1.5;
    const spurs = (loopNoise(x, z, W, 0.04, seed + 1) - 0.5) * 0.3 * Math.max(0, 1 - d / band);
    const ridge = crest * Math.max(0, across + spurs);
    // Foothills where the ridge meets the valley, easing out onto its floor.
    const foot = Math.max(0, 1 - Math.abs(d - band) / (band * 0.7));
    const hills = Math.max(0, loopNoise(x, z, W, 0.03, seed + 2) - 0.35) * 12 * foot;
    return Math.max(ridge, hills);
  };
  // ── the roads down from the pass, one each side; and the valley road ──
  const descent = (side: 1 | -1): [number, number][] => {
    const pts: [number, number][] = [[passX, side * (D / 2)]];
    const loops = 4;
    const span = 20;
    let z = side * (D / 2 - 5);
    let dir = 1;
    for (let k = 0; k < loops; k++) {
      const leg = (band * 0.85) / loops;
      for (let t = 0.1; t <= 1.0001; t += 0.1)
        pts.push([passX + span * dir * (t * 2 - 1), z - side * t * leg * 0.55]);
      for (let a = 0.25; a <= Math.PI - 0.24; a += 0.25)
        pts.push([
          passX + span * dir + dir * Math.sin(a) * 6,
          z - side * leg * 0.55 - side * (1 - Math.cos(a)) * leg * 0.225,
        ]);
      z -= side * leg;
      dir = -dir;
    }
    // Down the foothills to the road on its side of the river (the north-bank lane, or the valley road).
    const zEnd = side > 0 ? northZ(passX) : vroadZ(passX);
    for (let t = 0.1; t <= 1.0001; t += 0.1)
      pts.push([passX + span * dir * (1 - t), z + (zEnd - z) * t]);
    return pts;
  };
  const lensOf = (path: [number, number][]) => {
    const l = [0];
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1] as [number, number];
      const [bx, bz] = path[i] as [number, number];
      l.push((l[i - 1] as number) + Math.hypot(bx - ax, bz - az));
    }
    return l;
  };
  type Rd = {
    path: [number, number][];
    y: (i: number) => number;
    half: number;
    over: boolean;
    gravel?: boolean;
  };
  const overRoad = (path: [number, number][]): Rd => {
    const l = lensOf(path);
    const total = l[l.length - 1] as number;
    const flatEnd = total * 0.86;
    return {
      path,
      y: (i) => passH * Math.max(0, 1 - (l[i] as number) / flatEnd),
      half: 2.3,
      over: true,
    };
  };
  const vpath: [number, number][] = [];
  for (let x = -W / 2; x <= W / 2; x += 3) vpath.push([x, vroadZ(x)]);
  const level = (path: [number, number][], half = 1.4): Rd => ({
    path,
    y: () => 0,
    half,
    over: false,
  });
  // The village lanes: none dead-ends. A lane along the north bank, all the way round the
  // world like the valley road; three lanes across the river (small bridges) joining them;
  // a loop past the monastery; a loop out through the fields on the south side.
  const north: [number, number][] = [];
  for (let x = -W / 2; x <= W / 2; x += 3) north.push([x, northZ(x)]);
  // Lanes across the river slant over it (acute one way, obtuse the other) and
  // bend as they go, like tracks worn between farms.
  const crossings: [number, number, number][] = [
    // [x at the river, slant (north end minus south end, in x), bend]
    [-100, 26, 7],
    [8, -30, -6],
    [112, 22, -8],
  ];
  const bridges: { x: number; z: number; yaw: number }[] = [];
  // Hamlets of a handful of homes beside the lanes (away from the river), and small gompas
  // further back on the floor.
  const HAMLETS: [number, 1 | -1][] = [
    [-120, 1],
    [22, 1],
    [140, 1],
    [-92, -1],
    [85, -1],
    [-140, -1],
    [105, 1],
  ];
  const hamlets = HAMLETS.map(([x, side]) => ({
    x,
    z: side > 0 ? northZ(x) + 12 : vroadZ(x) - 12,
    face: side > 0 ? Math.PI : 0,
  }));
  const gompas: [number, number][] = [
    [-20, lakeMid(-20) + 31],
    [-86, vroadZ(-86) - 27],
    [146, northZ(146) + 25],
    [91, vroadZ(91) - 25],
    [32, northZ(32) + 27],
  ];
  const across = crossings.map(([x0, slant, bend]): [number, number][] => {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24; // 0 north end, 1 south end
      const x = x0 + slant * (0.5 - t) + bend * Math.sin(Math.PI * t);
      const e = t * t * (3 - 2 * t);
      pts.push([x, northZ(x) + (vroadZ(x) - northZ(x)) * e]);
    }
    // Where it meets the water: a bridge along the lane's heading there.
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1] as [number, number];
      const [bx, bz] = pts[k] as [number, number];
      const da = az - riverZ(ax);
      const db = bz - riverZ(bx);
      if (da >= 0 && db < 0) {
        const f = da / (da - db);
        bridges.push({
          x: ax + (bx - ax) * f,
          z: az + (bz - az) * f,
          yaw: Math.atan2(bx - ax, bz - az),
        });
        break;
      }
    }
    return pts;
  });
  // The big monastery (after Tawang) stands back from the valley road, its compound facing
  // the river; a lane forks off the road, swings round past its gate and back.
  const monasteryPt: [number, number] = [passX - 40, vroadZ(passX - 40) - 32];
  const [mx0] = monasteryPt;
  const loop: [number, number][] = [];
  for (let k = 0; k <= 30; k++) {
    const x = mx0 - 34 + (k / 30) * 68;
    loop.push([x, vroadZ(x) - 15 * Math.sin((Math.PI * k) / 30) ** 0.8]);
  }
  // A loop out through the fields on the south side, off the valley road and back.
  const fields: [number, number][] = [];
  for (let k = 0; k <= 30; k++) {
    const x = -128 + (k / 30) * 66;
    fields.push([x, vroadZ(x) - 34 * Math.sin((Math.PI * k) / 30) ** 0.7]);
  }
  // A gravel track round Pangong's far (north) shore, off the north-bank lane at both ends.
  const lakeTrack: [number, number][] = [];
  {
    const e = lakeX + lakeA + 16;
    const w0 = lakeX - lakeA - 16;
    lakeTrack.push([e, northZ(e)]);
    for (let k = 0; k <= 36; k++) {
      const th = 0.12 + (k / 36) * (Math.PI - 0.24);
      const x = lakeX + (lakeA + 9) * Math.cos(th);
      lakeTrack.push([x, lakeMid(x) + (lakeB + 8) * Math.sin(th)]);
    }
    lakeTrack.push([w0, northZ(w0)]);
  }
  const roadsIn: Rd[] = [
    overRoad(descent(1)),
    overRoad(descent(-1)),
    { path: vpath, y: () => 0, half: 2.2, over: false },
    level(north),
    ...across.map((p) => level(p)),
    level(loop),
    level(fields),
    { ...level(lakeTrack, 1.5), gravel: true },
    // The ford: where the two pass roads meet the valley, a gravel track runs down each
    // bank into the river and out the other side (no bridge: you splash through).
    {
      ...level(
        [
          [passX, northZ(passX)],
          [passX + 0.6, (northZ(passX) + riverZ(passX)) / 2 + 2],
          [passX + 1, riverZ(passX) + 4.4],
        ],
        1.7,
      ),
      gravel: true,
    },
    {
      ...level(
        [
          [passX + 1, riverZ(passX) - 4.4],
          [passX + 0.6, (vroadZ(passX) + riverZ(passX)) / 2 - 2],
          [passX, vroadZ(passX)],
        ],
        1.7,
      ),
      gravel: true,
    },
  ];
  // ── the stops' landmark sites ──
  const foot = o.footprint ?? (() => ({ depth: 3, radius: 5 }));
  /** Path index nearest a point (along x only for roads that run across the tile). */
  const nearestIdx = (path: [number, number][], x: number, z?: number) => {
    let best = 0;
    let bd = Number.POSITIVE_INFINITY;
    path.forEach(([px, pz], i) => {
      const d = z === undefined ? Math.abs(px - x) : Math.hypot(px - x, pz - z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return Math.min(path.length - 2, Math.max(1, best));
  };
  /** The hairpin bends of a pass road: where it swings furthest out from the pass's line. */
  const bends = (path: [number, number][]) => {
    const out: number[] = [];
    for (let i = 2; i < path.length - 2; i++) {
      const a = Math.abs((path[i] as [number, number])[0] - passX);
      if (
        a > 21 &&
        a >= Math.abs((path[i - 1] as [number, number])[0] - passX) &&
        a > Math.abs((path[i + 1] as [number, number])[0] - passX)
      )
        out.push(i);
    }
    return out;
  };
  const sites: LadakhTile["sites"] = [];
  const benches: [number, number, number, number][] = [];
  /** A landmark beside road `ri` at point `i`, on the side `want` points to. */
  const site = (key: string, ri: number, i: number, want: [number, number], gap = 1.5) => {
    const r = roadsIn[ri] as Rd;
    const [px, pz] = r.path[i] as [number, number];
    const [ax, az] = r.path[i - 1] as [number, number];
    const [bx, bz] = r.path[i + 1] as [number, number];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    let nx = -(bz - az) / l;
    let nz = (bx - ax) / l;
    if (nx * want[0] + nz * want[1] < 0) {
      nx = -nx;
      nz = -nz;
    }
    const f = foot(key);
    const d = r.half + f.depth + gap;
    const x = px + nx * d;
    const z = pz + nz * d;
    const y = r.y(i);
    sites.push({ key, x, z, y, yaw: Math.atan2(-nx, -nz), road: ri, i });
    benches.push([x, z, f.radius, y]);
  };
  {
    const nb = bends((roadsIn[0] as Rd).path);
    const sb = bends((roadsIn[1] as Rd).path);
    // The observatories up on the pass road's bends, like Hanle's on its hilltop.
    for (const [key, ri, i] of [
      ["dome", 0, nb[1]],
      ["solar", 0, nb[2]],
      ["deck", 1, sb[1]],
    ] as const)
      if (i !== undefined) {
        const px = ((roadsIn[ri] as Rd).path[i] as [number, number])[0];
        site(key, ri, i, [px >= passX ? 1 : -1, 0], 2.5);
      }
    // Down in the valley.
    site("lake", 3, nearestIdx(north, lakeX + 12), [0, 1], 0.5);
    site("bungalow", 3, nearestIdx(north, 133), [0, 1]);
    site("camp", 9, 19, [0, 1]);
    site("planetarium", 2, nearestIdx(vpath, -20), [0, -1]);
    site("rocket", 8, 15, [0, -1], 3);
    // The big monastery is the Wiki stop: beside the lane that swings past its gate.
    const mi = nearestIdx(loop, mx0);
    sites.push({ key: "monastery", x: mx0, z: monasteryPt[1], y: 0, yaw: 0, road: 7, i: mi });
  }

  const CELL = 10;
  const bins = new Map<string, [number, number][]>();
  roadsIn.forEach((r, ri) => {
    for (let i = 0; i < r.path.length - 1; i++) {
      const [ax, az] = r.path[i] as [number, number];
      const [bx, bz] = r.path[i + 1] as [number, number];
      for (
        let gx = Math.floor((Math.min(ax, bx) - 10) / CELL);
        gx <= Math.floor((Math.max(ax, bx) + 10) / CELL);
        gx++
      )
        for (
          let gz = Math.floor((Math.min(az, bz) - 10) / CELL);
          gz <= Math.floor((Math.max(az, bz) + 10) / CELL);
          gz++
        ) {
          const k = `${gx},${gz}`;
          const list = bins.get(k) ?? [];
          list.push([ri, i]);
          bins.set(k, list);
        }
    }
  });
  const nearRoad = (x: number, z: number) => {
    let best = { d: Number.POSITIVE_INFINITY, y: 0, half: 2.2 };
    for (const [ri, i] of bins.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
      const r = roadsIn[ri] as Rd;
      const [ax, az] = r.path[i] as [number, number];
      const [bx, bz] = r.path[i + 1] as [number, number];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best.d) best = { d, y: r.y(i) + (r.y(i + 1) - r.y(i)) * t, half: r.half };
    }
    return best;
  };
  const monastery = monasteryPt;
  const pads: [number, number, number][] = [
    ...hamlets.map((h): [number, number, number] => [h.x, h.z, 10]),
    ...gompas.map(([x, z]): [number, number, number] => [x, z, 5]),
  ];
  const heightAt = (x: number, z: number) => {
    let n = natural(x, z);
    // The pass: a flat saddle on the crest (the seam), the same on both edges.
    const dp = Math.hypot(x - passX, fromCrest(z));
    if (dp < 8) return passH;
    if (dp < 15) n = passH + (n - passH) * ((dp - 8) / 7) ** 1.3;
    // Level ground round the monastery's courtyard.
    const dm = Math.hypot(x - monastery[0], z - monastery[1]);
    if (dm < 42) n *= Math.max(0, (dm - 30) / 12) ** 1.5;
    // The lake's basin: level, easing up into the foothills behind.
    const ql = (x - lakeX) / (lakeA + 12);
    if (Math.abs(ql) < 1) {
      const dl = Math.abs(z - lakeMid(x)) - lakeHalf(x);
      const fall = Math.max(0, (dl - 6) / 12);
      n *= Math.min(1, fall ** 1.5 + Math.max(0, Math.abs(ql) - 0.85) / 0.15);
    }
    // Level patches for the hamlets and the small gompas.
    for (const [px, pz, r] of pads) {
      const dx = ((((x - px) % W) + W * 1.5) % W) - W / 2;
      const d = Math.hypot(dx, z - pz);
      if (d < r + 9) n *= Math.max(0, (d - r) / 9) ** 1.5;
    }
    // The landmarks' benches: level at their road's height, easing back into the slope.
    for (const [bx, bz, r, by] of benches) {
      const d = Math.hypot(x - bx, z - bz);
      if (d < r) n = by;
      else if (d < r + 9) n = by + (n - by) * ((d - r) / 9) ** 1.5;
    }
    const rd = nearRoad(x, z);
    if (rd.d < rd.half + 0.5) return rd.y;
    const k = Math.min(1, (rd.d - rd.half - 0.5) / 7);
    return rd.y + (n - rd.y) * k * k * (3 - 2 * k);
  };
  // ── the mesh: a smooth grid, coloured per vertex (gradual, no bands) ──
  // (A PlaneGeometry, so the ride engine can read heights straight off its grid.)
  const nx = Math.round(W / 1.6);
  const nz = Math.round(D / 1.6);
  const step = W / nx;
  const stepZ = D / nz;
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  const col = new Float32Array((nx + 1) * (nz + 1) * 3);
  const hs = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = -W / 2 + i * step;
      const z = -D / 2 + j * stepZ;
      hs[j * (nx + 1) + i] = heightAt(x, z);
    }
  const sand = C(LADAKH_GROUND);
  const ochre = C("#dcc5a8");
  const rock = C("#b9a39a");
  const rockDark = C("#a18b86");
  const snow = C(SNOW);
  const gravel = C("#e4d8c6");
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const tmp = new THREE.Color();
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i;
      const x = -W / 2 + i * step;
      const z = -D / 2 + j * stepZ;
      const y = hs[k] as number;
      pos.set([x, y, z], k * 3);
      // Slope from the neighbours.
      const hx =
        (hs[j * (nx + 1) + Math.min(nx, i + 1)] as number) -
        (hs[j * (nx + 1) + Math.max(0, i - 1)] as number);
      const hz =
        (hs[Math.min(nz, j + 1) * (nx + 1) + i] as number) -
        (hs[Math.max(0, j - 1) * (nx + 1) + i] as number);
      const slope = Math.min(1, Math.hypot(hx, hz) / (step * 4));
      const t = y / H;
      // Sand → ochre → rock (darker where steep) → snow, each blending over a broad band.
      tmp.copy(sand).lerp(ochre, smooth(0.01, 0.12, t));
      tmp.lerp(rock.clone().lerp(rockDark, slope), smooth(0.12, 0.35, t));
      const line = 0.68 + (loopNoise(x, z, W, 0.05, seed + 5) - 0.5) * 0.14;
      tmp.lerp(snow, smooth(line - 0.07, line + 0.07, t) * (1 - smooth(0.8, 1.0, slope) * 0.6));
      // The valley floor: green (fields and meadows) along the river, Leh-like, fading
      // gradually back to sand towards the foothills; pale gravel right by the water.
      const rz = Math.abs(z - riverZ(x));
      // Pangong's shore is bare: pale shingle, no green.
      const lz = Math.max(0, Math.abs(z - lakeMid(x)) - lakeHalf(x));
      const bare = Math.exp(-(((x - lakeX) / (lakeA * 1.15)) ** 6)) * (1 - smooth(6, 18, lz));
      const lush = (1 - smooth(34, 58, rz)) * (1 - smooth(0.4, 3.5, y)) * (1 - bare);
      const field = 0.82 + 0.18 * loopNoise(x, z, W, 0.08, seed + 7);
      tmp.lerp(C("#cbdc98").lerp(C("#b9d189"), 1 - field), lush * field);
      tmp.lerp(gravel, (1 - smooth(3.5, 7, rz)) * (1 - smooth(0.2, 1.2, y)));
      tmp.lerp(gravel, bare * (1 - smooth(1, 10, lz)));
      // The road's bench: a pale shoulder.
      const rd = nearRoad(x, z);
      tmp.lerp(C("#d9cdbf"), 1 - smooth(rd.half, rd.half + 1.6, rd.d));
      col.set([tmp.r, tmp.g, tmp.b], k * 3);
    }
  // Same vertex order as ours: rows from −z to +z, each from −x to +x.
  const g = new THREE.PlaneGeometry(W, D, nx, nz);
  g.rotateX(-Math.PI / 2);
  const gp = g.attributes.position as THREE.BufferAttribute;
  gp.copyArray(pos);
  gp.needsUpdate = true;
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  const roads = roadsIn.map((r) => {
    const l = lensOf(r.path);
    const total = l[l.length - 1] as number;
    return r.path.map(([x, z], i) => ({
      p: [x, r.y(i), z] as [number, number, number],
      surface: ((r.over && (l[i] as number) / total > 0.2 && (l[i] as number) / total < 0.62) ||
      r.gravel
        ? "gravel"
        : "paved") as Surface,
    }));
  });
  const river: [number, number][] = [];
  for (let x = -W / 2; x <= W / 2; x += 2) river.push([x, riverZ(x)]);
  const outline: [number, number][] = [];
  for (let k = 0; k <= 40; k++) {
    const x = lakeX - lakeA + (k / 40) * 2 * lakeA;
    outline.push([x, lakeMid(x) + lakeHalf(x)]);
  }
  for (let k = 40; k >= 0; k--) {
    const x = lakeX - lakeA + (k / 40) * 2 * lakeA;
    outline.push([x, lakeMid(x) - lakeHalf(x)]);
  }
  return {
    ground: g,
    roads,
    river,
    pass: [passX, passH, D / 2],
    monastery,
    bridges,
    lake: { x: lakeX, a: lakeA, b: lakeB, mid: lakeMid, half: lakeHalf, outline },
    hamlets,
    gompas,
    ford: { x: passX + 1, z: riverZ(passX) },
    halves: roadsIn.map((r) => r.half),
    sites,
    heightAt,
  };
}

const ROOF_GOLD = "#e9b949";
const ROOF_RED = "#c2453a";

/** A low hipped roof, `w` by `d`, `h` tall, with a little lip at the eaves. */
export function hipRoof(w: number, d: number, h: number, hex: string): G {
  const g = lathe(
    [
      [1, 0],
      [1, 0.12],
      [0.3, 1],
      [0, 1],
    ],
    hex,
    4,
  );
  g.rotateY(Math.PI / 4);
  g.scale((w / 2) * Math.SQRT2, h, (d / 2) * Math.SQRT2);
  g.computeVertexNormals();
  return g;
}

/** A whitewashed block with rows of dark windows on its front (+z), a maroon band and a hipped roof. */
function hall(
  w: number,
  h: number,
  d: number,
  rows: number,
  roof: string,
  rh = 1.2,
  /** The roof's width (default: an overhang of 0.55 each side). */
  roofW = w + 1.1,
): G[] {
  const out: G[] = [at(rbox(w, h, d, WHITEWASH, 0.06), 0, 0, 0)];
  const cols = Math.max(2, Math.round(w / 1.9));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push(
        at(
          rbox(0.5, 0.62, 0.06, "#3a2f4d", 0.02),
          -w / 2 + (w / cols) * (c + 0.5),
          h * 0.18 + (r * (h * 0.66)) / Math.max(1, rows),
          d / 2 + 0.01,
        ),
      );
  out.push(at(rbox(w + 0.08, 0.38, d + 0.08, MAROON, 0.04), 0, h - 0.38, 0));
  out.push(at(hipRoof(roofW, d + 1.1, rh, roof), 0, h, 0));
  return out;
}

const move = (parts: G[], x: number, y: number, z: number): G[] => parts.map((g) => at(g, x, y, z));

/**
 * The big monastery, after Tawang: a walled compound, the great white
 * assembly hall at the back on a raised terrace (rows of windows, a gold
 * roof, a red-roofed pavilion and a gilded finial on top), two lesser halls
 * beside it, and rows of whitewashed monks' quarters with gold roofs packed
 * round the courtyard, a tall prayer pole in its middle and a gate on the
 * road side (+z). About 46 m by 30.
 */
export function tawangMonastery(seed = 3): G {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const STONE = "#dcd6cc";
  const parts: G[] = [
    at(rbox(46, 0.25, 30, STONE, 0.05), 0, 0, -1),
    // The terrace at the back, its retaining wall and steps up the middle.
    at(rbox(34, 1.4, 11, "#d2cabd", 0.06), 0, 0, -10),
    ...[0, 1, 2, 3, 4].map((k) =>
      at(rbox(5, 0.28, 0.5, STONE, 0.03), 0, 0.2 + k * 0.28, -4.2 + k * 0.42 * -1 + 2.1),
    ),
  ];
  // The compound wall (white, maroon-topped) with the gate in front.
  const wall = (w: number, d: number, x: number, z: number) => {
    parts.push(
      at(rbox(w, 1.3, d, WHITEWASH, 0.04), x, 0, z),
      at(rbox(w + 0.04, 0.22, d + 0.04, MAROON, 0.03), x, 1.3, z),
    );
  };
  wall(19.5, 0.5, -12.75, 13.8);
  wall(19.5, 0.5, 12.75, 13.8);
  wall(46, 0.5, 0, -15.8);
  wall(0.5, 29.6, -22.8, -1);
  wall(0.5, 29.6, 22.8, -1);
  for (const x of [-3.1, 3.1]) parts.push(at(drum(0.3, 3.2, ROOF_RED, 0.05, 12), x, 0, 13.8));
  parts.push(
    at(rbox(7.2, 0.5, 1.6, MAROON, 0.04), 0, 3.2, 13.8),
    at(hipRoof(7.8, 2.4, 1.0, ROOF_GOLD), 0, 3.7, 13.8),
  );
  // The great hall, its gold roof, the red-roofed pavilion on top, the finial.
  parts.push(...move(hall(15, 7, 7.5, 3, ROOF_GOLD, 1.5), 0, 1.4, -10.5));
  parts.push(at(rbox(4.2, 3.0, 0.08, "#c98f2e", 0.03), 0, 1.4, -6.7));
  parts.push(...move(hall(6, 2.2, 4.4, 1, ROOF_RED, 1.5), 0, 9.6, -10.8));
  parts.push(
    at(
      lathe(
        [
          [0.3, 0],
          [0.34, 0.6],
          [0.12, 1.1],
          [0, 1.3],
        ],
        GOLD,
        10,
      ),
      0,
      13.1,
      -10.8,
    ),
  );
  // The lesser halls either side, one with a second storey.
  parts.push(...move(hall(8, 5.2, 6.5, 2, ROOF_GOLD, 1.2), 13, 1.4, -10));
  parts.push(...move(hall(4.6, 1.8, 3.8, 1, ROOF_RED, 1.1), 13, 7.8, -10.2));
  parts.push(...move(hall(7, 4.2, 6, 2, ROOF_GOLD, 1.1), -13.5, 1.4, -10));
  // The monks' quarters, in rows round the courtyard, each a little different.
  for (const [z, x0, x1] of [
    [-1.6, -20.5, 20.5],
    [3.4, -20.5, 20.5],
    [8.6, -20.5, 20.5],
  ] as const)
    for (let x = x0; x <= x1 + 0.01; x += 4.1) {
      if (Math.abs(x) < 6.5) continue;
      const w = 3.3 + rnd() * 0.5;
      const h = 2.0 + Math.floor(rnd() * 3) * 0.7;
      // Roofs a hair narrower than the spacing: neighbours meet eave to eave, never cut through.
      parts.push(
        ...move(
          hall(w, h, 3.1, h > 2.8 ? 2 : 1, ROOF_GOLD, 0.8, Math.min(w + 1.1, 3.95)),
          x + (rnd() - 0.5) * 0.12,
          0.25,
          z,
        ),
      );
    }
  // The prayer pole in the courtyard, and two chortens either side of the steps.
  parts.push(at(drum(0.1, 9, "#8a6a4a", 0.03, 8), 0, 0.25, 6), at(ball(0.25, GOLD), 0, 9.2, 6));
  parts.push(at(rbox(0.7, 4.5, 0.05, ROOF_GOLD, 0.02), 0.4, 4.5, 6));
  parts.push(...chortenParts(0.8, -4.5, 0.25, 2), ...chortenParts(0.8, 4.5, 0.25, 2));
  return join(parts);
}

/**
 * What's solid in the Tawang compound (local, front +z, as tawangMonastery
 * builds it): its walls (with the gate gap), the terrace's face (the halls
 * stand up on it), and round each monks' house, the pole and the chortens.
 */
export function tawangSolids(): {
  walls: [number, number, number, number][];
  circles: [number, number, number][];
} {
  const circles: [number, number, number][] = [
    [0, 6, 0.3],
    [-4.5, 2, 0.8],
    [4.5, 2, 0.8],
    [-3.1, 13.8, 0.4],
    [3.1, 13.8, 0.4],
  ];
  for (const z of [-1.6, 3.4, 8.6])
    for (let x = -20.5; x <= 20.51; x += 4.1) if (Math.abs(x) >= 6.5) circles.push([x, z, 1.9]);
  return {
    walls: [
      [-23, 13.8, -3.4, 13.8],
      [3.4, 13.8, 23, 13.8],
      [-23, -15.8, 23, -15.8],
      [-22.8, -15.8, -22.8, 13.8],
      [22.8, -15.8, 22.8, 13.8],
      [-17, -4.5, 17, -4.5],
    ],
    circles,
  };
}

/**
 * A road that follows the ground's height (along a shelf, round hairpins):
 * one continuous strip with shared edges, its centreline smoothed into a
 * curve and resampled finely, the edges offset with mitred corners, so bends
 * stay smooth, never a fan of separate pieces.
 */
export function roadStrip(
  pts: [number, number, number][],
  half: number,
  colour: string,
  lift = 0.04,
): THREE.Mesh | null {
  if (pts.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const n = Math.max(2, Math.ceil(curve.getLength() / 0.5));
  const c = curve.getSpacedPoints(n);
  const pos: number[] = [];
  const idx: number[] = [];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)] as THREE.Vector3;
    const b = c[Math.min(c.length - 1, i + 1)] as THREE.Vector3;
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    const nx = (-tz / l) * half;
    const nz = (tx / l) * half;
    pos.push(p.x + nx, p.y + lift, p.z + nz, p.x - nx, p.y + lift, p.z - nz);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide }));
}

/** A small gompa: a whitewashed shrine on a plinth, maroon band, gold roof and finial, a chorten beside it. */
export function smallGompa(): G {
  return join([
    at(rbox(5.4, 0.4, 5.4, "#dcd6cc", 0.05), 0, 0, 0),
    ...move(hall(3.8, 3.0, 3.8, 1, ROOF_GOLD, 1.1), 0, 0.4, 0),
    at(rbox(0.9, 1.5, 0.06, MAROON, 0.02), 0, 0.4, 1.92),
    at(
      lathe(
        [
          [0.18, 0],
          [0.2, 0.4],
          [0.07, 0.7],
          [0, 0.8],
        ],
        GOLD,
        10,
      ),
      0,
      4.4,
      0,
    ),
    ...chortenParts(0.6, 3.6, 0, 1.6),
  ]);
}

/**
 * A Tibetan monastery building on its own paved courtyard (not built into
 * the rock): a red pillared porch up a flight of steps, red-and-white walls
 * with rows of gold discs, a whitewashed upper storey under a red band, and
 * a grey-blue roof with upturned eaves, gilded finials and the golden dharma
 * wheel between two deer. Faces +z.
 */
export function tibetanTemple(): G {
  const RED = "#c23a3a";
  const STONE = "#d7d2c8";
  const ROOF = "#7d8aa3";
  const parts: G[] = [
    // The courtyard and the plinth with its steps.
    at(rbox(18, 0.2, 16, "#dcd6cc", 0.05), 0, 0, 1),
    at(rbox(12, 0.9, 9, STONE, 0.06), 0, 0.2, -0.5),
    ...[0, 1, 2, 3].map((k) =>
      at(rbox(5, 0.22, 0.5, STONE, 0.04), 0, 0.2 + k * 0.22, 5.4 - k * 0.42),
    ),
    // Ground floor: walls, the porch's red pillars, gold discs along the band.
    at(rbox(10.6, 3.0, 6.6, "#efe8dc", 0.06), 0, 1.1, -1.4),
    at(rbox(10.8, 0.7, 7.8, RED, 0.05), 0, 4.1, -0.9),
    ...[-4.4, -2.6, -0.9, 0.9, 2.6, 4.4].map((x) => at(drum(0.2, 3.0, RED, 0.05, 10), x, 1.1, 2.5)),
    at(rbox(3.2, 2.4, 0.08, "#d8a63c", 0.03), 0, 1.1, 1.95),
    ...[-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2].map((x) =>
      at(drum(0.18, 0.06, "#e8b84a", 0.02, 14), x, 4.45, 3.0, 0, Math.PI / 2),
    ),
    // The first roof: a terrace with its parapet.
    at(rbox(11.4, 0.25, 8.4, "#9c8e86", 0.05), 0, 4.8, -0.9),
    // Upper storey: white walls, windows, the red band with gold discs.
    at(rbox(7.4, 2.4, 5.0, "#f2ede4", 0.06), 0, 5.05, -1.6),
    ...[-2.4, -0.8, 0.8, 2.4].map((x) => at(rbox(0.7, 0.9, 0.06, "#3a2f4d", 0.02), x, 5.8, 0.92)),
    at(rbox(7.6, 0.6, 5.2, RED, 0.05), 0, 7.45, -1.6),
    ...[-2.8, -1.4, 0, 1.4, 2.8].map((x) =>
      at(drum(0.16, 0.06, "#e8b84a", 0.02, 14), x, 7.75, 1.02, 0, Math.PI / 2),
    ),
    // The top hall and its roof with upturned eaves.
    at(rbox(5.0, 1.8, 3.6, "#f2ede4", 0.06), 0, 8.05, -1.8),
    at(
      lathe(
        [
          [4.0, 0],
          [3.9, 0.25],
          [2.4, 1.0],
          [0, 1.25],
        ],
        ROOF,
        4,
      ),
      0,
      9.85,
      -1.8,
      Math.PI / 4,
    ),
    at(rbox(5.8, 0.12, 4.4, ROOF, 0.05), 0, 9.8, -1.8),
    // Gilded finials (gyaltsen) at the corners, and the wheel with its deer above the porch.
    ...[
      [-4.8, 2.6],
      [4.8, 2.6],
      [-4.8, -4.2],
      [4.8, -4.2],
    ].map(([x, z]) =>
      at(
        lathe(
          [
            [0.18, 0],
            [0.22, 0.7],
            [0.08, 1.0],
            [0, 1.1],
          ],
          "#e8b84a",
          10,
        ),
        x as number,
        4.9,
        z as number,
      ),
    ),
    at(
      lathe(
        [
          [0.2, 0],
          [0.12, 0.5],
          [0, 0.65],
        ],
        "#e8b84a",
        8,
      ),
      0,
      11.1,
      -1.8,
    ),
    at(drum(0.55, 0.12, "#e8b84a", 0.03, 20), 0, 5.6, 2.6, 0, Math.PI / 2),
    ...[-1, 1].map((sd) => at(ball(0.28, "#e8b84a", 1.2, 1, 0.7), sd * 0.95, 5.1, 2.6)),
  ];
  return join(parts);
}

/**
 * A Spiti monastery (after Key Gompa): whitewashed buildings stacked up a
 * rocky knoll, tier on tier, maroon bands under their flat roofs, rows of
 * small dark windows, and a gilded canopy on the topmost hall. Faces +z.
 */
export function spitiMonastery(s = 1): G {
  const parts: G[] = [
    at(
      lathe(
        [
          [0, 0],
          [7.5 * s, 0],
          [6.6 * s, 1.6 * s],
          [4.6 * s, 3.4 * s],
          [2.2 * s, 4.6 * s],
          [0, 4.8 * s],
        ],
        "#c9b3a6",
        10,
      ),
      0,
      0,
      0,
    ),
  ];
  const block = (x: number, y: number, z: number, w: number, h: number, d: number) => {
    parts.push(at(rbox(w * s, h * s, d * s, WHITEWASH, 0.05), x * s, y * s, z * s));
    parts.push(
      at(rbox((w + 0.1) * s, 0.22 * s, (d + 0.1) * s, MAROON, 0.03), x * s, (y + h) * s, z * s),
    );
    const n = Math.max(1, Math.floor(w / 0.9));
    for (let k = 0; k < n; k++)
      parts.push(
        at(
          rbox(0.28 * s, 0.4 * s, 0.05, "#2f3550", 0.02),
          (x - w / 2 + (k + 0.5) * (w / n)) * s,
          (y + h * 0.45) * s,
          (z + d / 2 + 0.01) * s,
        ),
      );
  };
  // Tiers up the knoll: a ring of houses low down, halls above, the gompa at the top.
  for (const [a, r] of [
    [0.3, 5.6],
    [1.2, 5.4],
    [2.2, 5.6],
    [-0.6, 5.5],
    [-1.6, 5.3],
  ] as const)
    block(Math.sin(a) * r, 0.3, Math.cos(a) * r, 2.0, 1.8, 1.6);
  for (const [a, r] of [
    [0.1, 3.6],
    [1.3, 3.4],
    [-1.1, 3.5],
  ] as const)
    block(Math.sin(a) * r, 1.9, Math.cos(a) * r, 2.6, 2.0, 2.0);
  block(0, 3.4, 0.6, 3.4, 2.4, 2.6);
  block(-0.4, 4.8, -0.6, 2.6, 2.0, 2.2);
  // The gilded canopy on the top hall, and a few chortens round the foot.
  parts.push(at(rbox(1.4 * s, 0.2 * s, 1.4 * s, GOLD, 0.04), -0.4 * s, 7.0 * s, -0.6 * s));
  parts.push(
    at(
      lathe(
        [
          [0.75 * s, 0],
          [0.2 * s, 0.6 * s],
          [0, 0.9 * s],
        ],
        GOLD,
        4,
      ),
      -0.4 * s,
      7.2 * s,
      -0.6 * s,
    ),
  );
  for (const a of [-2.6, 2.7])
    parts.push(...chortenParts(0.4 * s, Math.sin(a) * 7.2 * s, 0, Math.cos(a) * 7.2 * s));
  return join(parts);
}

// ── prayer flags ────────────────────────────────────────────────────────────

/** A string of prayer flags from a to b, sagging, the five colours in order. */
export function flagString(a: THREE.Vector3, b: THREE.Vector3, sag = 0.5, spacing = 0.34): G {
  const parts: G[] = [];
  const len = a.distanceTo(b);
  const n = Math.max(2, Math.round(len / spacing));
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const at3 = (t: number) => {
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    return p;
  };
  // The cord.
  for (let i = 0; i < n; i++) {
    const p0 = at3(i / n);
    const p1 = at3((i + 1) / n);
    const seg = rbox(0.025, 0.025, p0.distanceTo(p1) + 0.02, "#e9e1d4", 0.01);
    seg.translate(0, -0.0125, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      p1.clone().sub(p0).normalize(),
    );
    seg.applyQuaternion(q);
    const m = p0.clone().add(p1).multiplyScalar(0.5);
    seg.translate(m.x, m.y, m.z);
    parts.push(seg);
  }
  // The flags, hanging from it.
  for (let i = 1; i < n; i++) {
    const p = at3(i / n);
    const f = rbox(0.02, 0.24, 0.24, FLAGS[i % FLAGS.length] as string, 0.008);
    f.rotateY(yaw);
    f.translate(p.x, p.y - 0.25, p.z);
    parts.push(f);
  }
  return join(parts);
}

const pole = (x: number, z: number, h: number) => at(drum(0.06, h, "#b98a62", 0.02, 8), x, 0, z);

export type FlagGateStyle = "span" | "chorten" | "tunnel";

/**
 * The prayer-flag gate jump: a ramp (local +z up the slope, its lip at +1.6)
 * launching you through prayer flags:
 *  - span: two tall poles beyond the lip, one string of flags between them
 *    and strings fanning down to pegs;
 *  - chorten: a whitewashed kakani gate (two piers, a roof and a small
 *    chorten on top) that you fly through, flags off its corners;
 *  - tunnel: four poles and strings criss-crossing over the landing.
 */
export function flagGate(style: FlagGateStyle): G {
  const ramp = LANDSCAPE.ramp?.make() as G;
  const parts: G[] = [ramp];
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  if (style === "span") {
    for (const s of [-1, 1]) parts.push(pole(s * 2.2, 4, 4.2));
    parts.push(flagString(V(-2.2, 4.15, 4), V(2.2, 4.15, 4), 0.55));
    for (const s of [-1, 1])
      for (const z of [2.2, 5.8])
        parts.push(flagString(V(s * 2.2, 4.1, 4), V(s * 3.4, 0.15, z), 0.25));
  } else if (style === "chorten") {
    for (const s of [-1, 1]) parts.push(at(rbox(0.9, 3.4, 1.2, WHITEWASH, 0.08), s * 2.1, 0, 4.2));
    parts.push(at(rbox(5.2, 0.5, 1.6, WHITEWASH, 0.08), 0, 3.4, 4.2));
    parts.push(at(rbox(5.4, 0.18, 1.8, MAROON, 0.05), 0, 3.9, 4.2));
    parts.push(...chortenParts(0.55, 0, 4.08, 4.2));
    for (const s of [-1, 1])
      parts.push(flagString(V(s * 2.6, 4.0, 4.2), V(s * 4.2, 0.15, 6.5), 0.3));
  } else {
    const posts: [number, number][] = [
      [-2.4, 2.6],
      [2.4, 2.6],
      [-2.4, 6.4],
      [2.4, 6.4],
    ];
    for (const [x, z] of posts) parts.push(pole(x, z, 4));
    const top = posts.map(([x, z]) => V(x, 3.95, z));
    const [a, b, c, d] = top as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
    parts.push(
      flagString(a, d, 0.6),
      flagString(b, c, 0.6),
      flagString(a, b, 0.4),
      flagString(c, d, 0.4),
    );
    parts.push(flagString(a, c, 0.3), flagString(b, d, 0.3));
  }
  return join(parts);
}

// ── chortens and mani walls ─────────────────────────────────────────────────

/** A chorten's parts at scale s (steps, the dome, the spire, the moon and sun). */
function chortenParts(s: number, x: number, y: number, z: number): G[] {
  return [
    at(rbox(2.0 * s, 0.5 * s, 2.0 * s, WHITEWASH, 0.05 * s), x, y, z),
    at(rbox(1.6 * s, 0.45 * s, 1.6 * s, WHITEWASH, 0.05 * s), x, y + 0.5 * s, z),
    at(rbox(1.25 * s, 0.4 * s, 1.25 * s, WHITEWASH, 0.05 * s), x, y + 0.95 * s, z),
    at(ball(0.62 * s, WHITEWASH, 1, 0.9, 1), x, y + 1.25 * s, z),
    at(rbox(0.5 * s, 0.25 * s, 0.5 * s, WHITEWASH, 0.03 * s), x, y + 2.25 * s, z),
    at(
      lathe(
        [
          [0, 0],
          [0.22 * s, 0],
          [0.06 * s, 1.1 * s],
          [0, 1.1 * s],
        ],
        GOLD,
        12,
      ),
      x,
      y + 2.5 * s,
      z,
    ),
    at(ball(0.09 * s, GOLD), x, y + 3.6 * s, z),
  ];
}

/** A whitewashed chorten (stupa), about 3.6 m tall at scale 1. */
export function chorten(s = 1): G {
  return join(chortenParts(s, 0, 0, 0));
}

/** A mani wall `len` long along x: stones carved with prayers on a low wall, a chorten at each end. */
export function maniWall(len = 9): G {
  const parts: G[] = [at(rbox(len, 0.8, 1.2, "#d9cdbf", 0.2), 0, 0, 0)];
  const tones = ["#c9bdb0", "#e5dccf", "#b9aea3", "#d4c6c9"];
  for (let x = -len / 2 + 0.4; x < len / 2 - 0.3; x += 0.42) {
    const k = Math.round((x + len) * 7) % tones.length;
    const st = rbox(0.38, 0.12 + (k % 2) * 0.05, 0.5 + (k % 3) * 0.12, tones[k] as string, 0.05);
    st.rotateY((k - 1.5) * 0.15);
    parts.push(at(st, x, 0.8, k % 2 ? 0.15 : -0.15));
  }
  for (const s of [-1, 1]) parts.push(...chortenParts(0.5, s * (len / 2 + 0.6), 0, 0));
  return join(parts);
}

// ── the army road ───────────────────────────────────────────────────────────

/** Border Roads' cheeky signboards (their real house style: yellow, black lettering). */
export const BRO_SLOGANS = [
  ["BE GENTLE", "ON MY CURVES"],
  ["AFTER WHISKY", "DRIVING RISKY"],
  ["PEEP PEEP", "DON'T SLEEP"],
  ["LIFE IS SHORT", "DON'T MAKE IT SHORTER"],
];

/** A BRO signboard: a yellow board on two posts, its slogan, and the little BRO plate. */
export function broSign(lines: string[] = BRO_SLOGANS[0] as string[]): {
  body: G;
  boards: THREE.Mesh[];
} {
  const body = join([
    at(rbox(0.1, 1.6, 0.1, "#fbf6ec", 0.03), -0.85, 0, 0),
    at(rbox(0.1, 1.6, 0.1, "#fbf6ec", 0.03), 0.85, 0, 0),
    at(rbox(2.1, 1.0, 0.08, BRO_YELLOW, 0.04), 0, 1.15, 0),
  ]);
  const b = board(
    [...lines.map((t) => ({ text: t, size: 0.36 })), { text: "— BRO —", size: 0.22, font: "700" }],
    1.95,
    0.9,
    BRO_YELLOW,
    "#1c1820",
  );
  return { body, boards: [sign(b, 0, 1.65, 0.05)] };
}

/** An army truck: olive cab, a canvas-covered back, big wheels. Faces +x. */
export function armyTruck(): G {
  const wheel = (x: number, z: number) =>
    at(drum(0.42, 0.3, "#2a2730", 0.08, 16), x, 0.42, z, 0, Math.PI / 2);
  const cover = lathe(
    [
      [0, 0],
      [1.05, 0],
      [1.05, 0.4],
      [0.85, 0.9],
      [0, 1.0],
    ],
    OLIVE,
    16,
  );
  cover.scale(1, 1, 1);
  const back = join([at(rbox(3.2, 1.0, 2.1, OLIVE_DARK, 0.06), 0, 0, 0)]);
  return join([
    at(rbox(5.2, 0.35, 2.0, "#3c3a40", 0.05), 0, 0.55, 0),
    at(back, -0.9, 0.9, 0),
    at(rbox(3.2, 1.0, 2.0, OLIVE, 0.4), -0.9, 1.6, 0),
    at(rbox(1.5, 1.4, 1.9, OLIVE, 0.12), 1.85, 0.9, 0),
    at(rbox(0.06, 0.6, 1.5, "#9fc6d6", 0.03), 2.6, 1.55, 0),
    at(rbox(0.3, 0.25, 1.95, "#3c3a40", 0.05), 2.6, 0.75, 0),
    wheel(1.9, -0.95),
    wheel(1.9, 0.95),
    wheel(-1.6, -0.95),
    wheel(-1.6, 0.95),
    wheel(-0.6, -0.95),
    wheel(-0.6, 0.95),
  ]);
}

/** A BRO milestone: a white stone with a yellow rounded top, its destination painted on. */
export function milestone(place = "HANLE", km = 12): { body: G; boards: THREE.Mesh[] } {
  const body = join([
    at(rbox(0.55, 0.6, 0.22, "#fbf6ec", 0.05), 0, 0, 0),
    at(drum(0.275, 0.22, BRO_YELLOW, 0.03, 18), 0, 0.6, -0.11, 0, Math.PI / 2),
  ]);
  const b = board(
    [
      { text: place, size: 0.45, font: "800" },
      { text: `${km}`, size: 0.55, font: "900" },
    ],
    0.5,
    0.5,
    "#fbf6ec",
    "#1c1820",
  );
  return { body, boards: [sign(b, 0, 0.32, 0.12)] };
}

// ── yaks ────────────────────────────────────────────────────────────────────

/** A shaggy yak with curved horns. Faces +x. */
export function yak(tone = "#4a3b36"): G {
  const parts: G[] = [
    at(ball(0.62, tone, 1.45, 0.82, 0.9), 0, 0.55, 0),
    // The shaggy skirt.
    at(
      lathe(
        [
          [0.55, 0],
          [0.7, 0],
          [0.62, 0.5],
          [0, 0.5],
        ],
        tone,
        12,
      ),
      0,
      0.42,
      0,
    ),
    at(ball(0.36, tone, 1.1, 0.9, 0.9), 0.95, 0.95, 0),
    at(ball(0.18, "#e9dcc8", 1.2, 0.8, 1), 1.24, 0.92, 0),
  ];
  for (const s of [-1, 1]) {
    const horn = lathe(
      [
        [0.06, 0],
        [0.04, 0.2],
        [0, 0.36],
      ],
      "#efe6d6",
      8,
    );
    horn.rotateX(s * -0.9);
    parts.push(at(horn, 0.98, 1.18, s * 0.18));
    for (const x of [-0.5, 0.5]) parts.push(at(drum(0.1, 0.5, tone, 0.03, 8), x, 0, s * 0.3));
  }
  parts.push(at(ball(0.12, "#efe6d6", 1, 1.6, 1), -0.92, 0.6, 0));
  return join(parts);
}

/** A little gable roof (exported for the landmarks). */
export { gable };
