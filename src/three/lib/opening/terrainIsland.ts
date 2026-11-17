/**
 * The island as a real-looking landscape, for the map table.
 *
 * Geography (not a grid): an elongated island running north-west to
 * south-east, with a hooked peninsula in the south-west, a deep bay on the
 * east coast, ragged headlands and a few islets. A curved mountain spine runs
 * through the interior (Ladakh's peaks), with the Thar desert in its rain
 * shadow to the west, forest on its north-east slopes, coffee in the southern
 * hills, and a river winding from the spine to the east bay. Regions blend
 * through domain-warped noise, so their edges are ragged, not round.
 *
 * Each journey sits where it plausibly would, marked by a little flag:
 * WinZO's circuit on the north-west coastal plain, Zingle AI in the desert,
 * AstroClub IITK among the peaks, Personal in the north-east forest, Expresso
 * in the coffee hills, C++ for fun at the river mouth, the Secret coast at
 * the tip of the peninsula, and the garage town at an off-centre crossroads.
 *
 * Roads are an irregular network found over the terrain (16-direction
 * path-finding that favours gentle grades and avoids water, bridging the
 * river), then simplified to their real turns and curved.
 *
 * Island units (≈ 92 × 78); the map table scales it down. Sea level is 0.
 */

import * as THREE from "three";
import { WORLDS } from "../../../content/worlds";
import { ball, block, cyl } from "../hero";
import type { Kit } from "../kit";

export type ReliefStyle = "relief" | "terraced";

const X0 = -50;
const Z0 = -43;
const X1 = 50;
const Z1 = 43;

// ── noise ──────────────────────────────────────────────────────────────────

function hash(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, oct = 5): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * valueNoise(x * f, y * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}

const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Domain warp: regions measured in warped space get ragged, organic edges. */
function warp(x: number, z: number): [number, number] {
  return [
    x + (fbm(x * 0.05 + 3, z * 0.05 + 1, 4) - 0.5) * 16,
    z + (fbm(x * 0.05 - 7, z * 0.05 + 5, 4) - 0.5) * 16,
  ];
}

/** A warped soft region around (cx, cz). */
function region(x: number, z: number, cx: number, cz: number, r: number): number {
  const [wx, wz] = warp(x, z);
  return Math.exp(-((wx - cx) ** 2 + (wz - cz) ** 2) / (r * r));
}

// ── where things are ───────────────────────────────────────────────────────

/** Each journey's place on the island (and the garage town). */
export const SITES: Record<string, [number, number]> = {
  hub: [-6, 6],
  winzo: [-32, -14],
  zingle: [-17, -6],
  astro: [2, -21],
  personal: [23, -19],
  expresso: [12, 14],
  fun: [28, 7],
  murphy: [-31, 31],
};
const S = (id: string): [number, number] => SITES[id] ?? [0, 0];

/** Hand-shaped outline, clockwise from the north-west tip. */
const OUTLINE: [number, number][] = [
  [-41, -26],
  [-35, -32],
  [-25, -34],
  [-15, -31],
  [-7, -35],
  [3, -37],
  [12, -33],
  [20, -31],
  [28, -28],
  [34, -22],
  [38, -14],
  [35, -8],
  [30, -3],
  [33, 2],
  [40, 5],
  [42, 12],
  [38, 18],
  [32, 22],
  [26, 28],
  [18, 30],
  [10, 27],
  [4, 31],
  [-4, 26],
  [-11, 24],
  [-17, 27],
  [-23, 31],
  [-28, 36],
  [-34, 38],
  [-39, 34],
  [-35, 29],
  [-31, 25],
  [-29, 19],
  [-35, 14],
  [-41, 8],
  [-43, 0],
  [-45, -7],
  [-38, -12],
  [-43, -18],
  [-45, -22],
];
const ISLETS: [number, number, number][] = [
  [45, -19, 2.4],
  [-47, 4, 1.9],
  [21, 36, 1.7],
  [-44, 33, 1.3],
];
/** The outline is drawn a little large; this fits it to the table's sea. */
const FIT = 0.93;

// ── coastline (signed distance, precomputed on a grid) ─────────────────────

const COAST_PTS = (() => {
  const curve = new THREE.CatmullRomCurve3(
    OUTLINE.map(([x, z]) => new THREE.Vector3(x * FIT, 0, z * FIT)),
    true,
    "centripetal",
  );
  const n = 800;
  const raw = curve.getSpacedPoints(n).slice(0, n);
  // Roughen along the normal with fractal noise: coves, points and small bays.
  return raw.map((p, i) => {
    const prev = raw[(i - 1 + n) % n] as THREE.Vector3;
    const next = raw[(i + 1) % n] as THREE.Vector3;
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const l = Math.hypot(tx, tz) || 1;
    const k = (fbm(p.x * 0.1 + 3, p.z * 0.1 - 7, 5) - 0.5) * 5;
    return new THREE.Vector2(p.x + (tz / l) * k, p.z - (tx / l) * k);
  });
})();

function insidePolygon(x: number, z: number, pts: THREE.Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i] as THREE.Vector2;
    const b = pts[j] as THREE.Vector2;
    if (a.y > z !== b.y > z && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToPolyline(
  x: number,
  z: number,
  pts: THREE.Vector2[],
  closed: boolean,
): { d: number; i: number } {
  let best = Infinity;
  let bi = 0;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i] as THREE.Vector2;
    const b = pts[(i + 1) % pts.length] as THREE.Vector2;
    const abx = b.x - a.x;
    const abz = b.y - a.y;
    const t = THREE.MathUtils.clamp(
      ((x - a.x) * abx + (z - a.y) * abz) / (abx * abx + abz * abz || 1),
      0,
      1,
    );
    const d = Math.hypot(x - a.x - abx * t, z - a.y - abz * t);
    if (d < best) {
      best = d;
      bi = i;
    }
  }
  return { d: best, i: bi };
}

function rawCoastDistance(x: number, z: number): number {
  const d = distToPolyline(x, z, COAST_PTS, true).d;
  let sd = insidePolygon(x, z, COAST_PTS) ? d : -d;
  for (const [ix, iz, r] of ISLETS) {
    const wob = r * (0.75 + fbm(x * 0.3, z * 0.3, 3) * 0.6);
    sd = Math.max(sd, wob - Math.hypot(x - ix * FIT, z - iz * FIT));
  }
  return sd;
}

const GRID = 0.5;
const GW = Math.round((X1 - X0) / GRID) + 1;
const GH = Math.round((Z1 - Z0) / GRID) + 1;
let sdfGrid: Float32Array | null = null;
function coastDistance(x: number, z: number): number {
  if (!sdfGrid) {
    sdfGrid = new Float32Array(GW * GH);
    for (let j = 0; j < GH; j++)
      for (let i = 0; i < GW; i++)
        sdfGrid[j * GW + i] = rawCoastDistance(X0 + i * GRID, Z0 + j * GRID);
  }
  const fx = THREE.MathUtils.clamp((x - X0) / GRID, 0, GW - 1.001);
  const fz = THREE.MathUtils.clamp((z - Z0) / GRID, 0, GH - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const g = sdfGrid;
  const a = g[j * GW + i] ?? 0;
  const b = g[j * GW + i + 1] ?? 0;
  const c = g[(j + 1) * GW + i] ?? 0;
  const d = g[(j + 1) * GW + i + 1] ?? 0;
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ── the mountain spine and the rivers ──────────────────────────────────────

const SPINE = new THREE.CatmullRomCurve3(
  [
    [-9, -31],
    [-2, -25],
    [3, -19],
    [8, -12],
    [12, -5],
    [13, 3],
    [11, 10],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  "centripetal",
)
  .getSpacedPoints(80)
  .map((p) => new THREE.Vector2(p.x, p.z));

/** Rivers: the main one from the spine to the east bay, a stream to the north-west bay. */
const RIVERS = [
  [
    [9, -9],
    [13, -8],
    [16, -4],
    [19, -5],
    [23, -2],
    [27, 0],
    [32, 0.5],
  ],
  [
    [-4, -22],
    [-9, -18],
    [-15, -19],
    [-22, -17],
    [-29, -19],
    [-37, -18],
  ],
].map((pts) =>
  new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
  )
    .getSpacedPoints(90)
    .map((p) => new THREE.Vector2(p.x, p.z)),
);

function riverAt(x: number, z: number): { d: number; t: number; w: number } {
  let best = { d: Infinity, t: 0, w: 0.5 };
  RIVERS.forEach((pts, k) => {
    const r = distToPolyline(x, z, pts, false);
    if (r.d < best.d) {
      const t = r.i / (pts.length - 1);
      best = { d: r.d, t, w: (k === 0 ? 0.55 : 0.4) + t * (k === 0 ? 1.4 : 0.8) };
    }
  });
  return best;
}

// ── terrain ────────────────────────────────────────────────────────────────

const C = (hex: string) => new THREE.Color(hex);
const PAL = {
  meadow: C("#8cc860"),
  plain: C("#a5d067"),
  sand: C("#e8c47c"),
  dune: C("#dfb06a"),
  forest: C("#3b8646"),
  coffee: C("#4b9747"),
  scrub: C("#b3a071"),
  rock: C("#8e7c69"),
  cliff: C("#9b8a76"),
  snow: C("#f4f1ea"),
  beach: C("#efdcaa"),
  shelf: C("#e3d3a3"),
};

/** Where the towns sit, on gently flattened ground. */
const TOWNS: { x: number; z: number; r: number }[] = [
  { x: S("hub")[0], z: S("hub")[1], r: 5.5 },
  { x: S("winzo")[0], z: S("winzo")[1], r: 6 },
  { x: S("zingle")[0] + 3, z: S("zingle")[1] + 2, r: 3.5 },
  { x: S("astro")[0], z: S("astro")[1] + 6, r: 3 },
  { x: S("personal")[0], z: S("personal")[1], r: 3.2 },
  { x: S("expresso")[0], z: S("expresso")[1], r: 3 },
  { x: S("fun")[0], z: S("fun")[1], r: 4.5 },
  { x: S("murphy")[0], z: S("murphy")[1], r: 3.2 },
];

const cliffyAt = (x: number, z: number) =>
  Math.max(region(x, z, -42, -2, 8), region(x, z, 0, -36, 10), region(x, z, 36, -14, 6));
const desertAt = (x: number, z: number) => region(x, z, S("zingle")[0] - 2, S("zingle")[1] - 2, 10);
const forestAt = (x: number, z: number) => region(x, z, S("personal")[0], S("personal")[1] + 1, 11);
const coffeeAt = (x: number, z: number) =>
  region(x, z, S("expresso")[0] + 1, S("expresso")[1] + 1, 8);

export interface IslandSample {
  h: number;
  colour: THREE.Color;
  coast: number;
  river: number;
}

function landHeight(x: number, z: number, sd: number): number {
  const cliffy = cliffyAt(x, z);
  let h = 0.4 + smooth(0, cliffy > 0.4 ? 2 : 6, sd) * (0.5 + fbm(x * 0.08, z * 0.08) * 1.2);
  // The curved mountain spine, highest in the north (Ladakh), easing south into hills.
  const sp = distToPolyline(x, z, SPINE, false);
  const along = sp.i / (SPINE.length - 1);
  const ridged = (1 - Math.abs(fbm(x * 0.08, z * 0.08) * 2 - 1)) ** 2;
  h += Math.exp(-((sp.d / (6 + along * 3)) ** 2)) * (2 + ridged * (11 - along * 8));
  h += forestAt(x, z) * (1.4 + fbm(x * 0.12 + 5, z * 0.12) * 3.5);
  h += coffeeAt(x, z) * (0.8 + fbm(x * 0.16 + 9, z * 0.16) * 3);
  h += desertAt(x, z) * Math.abs(Math.sin(x * 0.45 + z * 0.2 + fbm(x * 0.1, z * 0.1) * 3)) * 1.2;
  return h;
}

export function sampleIsland(x: number, z: number): IslandSample {
  const sd = coastDistance(x, z);
  let h = landHeight(x, z, sd);
  const rv = riverAt(x, z);
  const valley = 1 - smooth(rv.w, rv.w + 3.5, rv.d);
  h = h * (1 - valley * 0.75) + (rv.d < rv.w ? -0.25 : 0) * valley;
  for (const t of TOWNS) {
    const m = 1 - smooth(t.r, t.r + 3, Math.hypot(x - t.x, z - t.z));
    if (m > 0) h += (Math.max(0.6, landHeight(t.x, t.z, 10) * 0.55) - h) * m;
  }
  const sea = smooth(0, -6, sd);
  h = h * smooth(-0.5, 1.2, sd) - 3 * sea - 0.3 * smooth(0.5, -0.5, sd);
  // Colour: warped regions, elevation, coast.
  const desert = desertAt(x, z);
  const cliffy = cliffyAt(x, z);
  const col = PAL.plain.clone();
  const mix = (c: THREE.Color, w: number) => col.lerp(c, THREE.MathUtils.clamp(w, 0, 1));
  mix(PAL.meadow, 0.5 + (fbm(x * 0.13, z * 0.13) - 0.5) * 1.2);
  mix(PAL.sand, desert * 1.7);
  mix(PAL.dune, desert * smooth(1.2, 2.2, h) * 0.6);
  mix(PAL.forest, forestAt(x, z) * 1.5);
  mix(PAL.coffee, coffeeAt(x, z) * 1.4);
  mix(PAL.scrub, smooth(2.5, 5, h) * 0.7);
  mix(PAL.rock, smooth(5, 8, h));
  mix(PAL.snow, smooth(8.5, 10.5, h));
  mix(PAL.cliff, cliffy * (1 - smooth(0.5, 3, sd)) * 1.2);
  mix(PAL.beach, (1 - cliffy) * (1 - smooth(0.4, 2.2, sd)));
  mix(PAL.shelf, smooth(0.2, -1.5, sd));
  col.offsetHSL(0, 0, (fbm(x * 0.35 + 11, z * 0.35) - 0.5) * 0.07);
  return { h, colour: col, coast: sd, river: rv.d };
}

function terrain(style: ReliefStyle): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, 180, 154);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colours = new Float32Array(pos.count * 3);
  const step = 1.1;
  for (let i = 0; i < pos.count; i++) {
    const s = sampleIsland(pos.getX(i), pos.getZ(i));
    let h = s.h;
    const c = s.colour;
    if (style === "terraced" && h > 0.8) {
      const k = h / step;
      const lo = Math.floor(k);
      h = Math.max(0.8, (lo + smooth(0.85, 1, k - lo)) * step);
      c.offsetHSL(0, 0, lo % 2 ? 0.03 : -0.005);
    }
    pos.setY(i, h);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
  );
  m.receiveShadow = true;
  // Seen only small on the table: skip its (expensive) shadow pass.
  m.castShadow = false;
  return m;
}

function ribbon(
  path: [number, number][],
  width: (t: number) => number,
  y: (x: number, z: number, t: number) => number,
  mat: THREE.Material,
): THREE.Mesh {
  const posArr: number[] = [];
  const idx: number[] = [];
  const n = path.length;
  for (let i = 0; i < n; i++) {
    const p = path[i] as [number, number];
    const q = path[Math.min(n - 1, i + 1)] as [number, number];
    const o = path[Math.max(0, i - 1)] as [number, number];
    const tx = q[0] - o[0];
    const tz = q[1] - o[1];
    const l = Math.hypot(tx, tz) || 1;
    const t = i / (n - 1);
    const w = width(t);
    for (const s of [-1, 1]) {
      const x = p[0] + (-tz / l) * w * s;
      const z = p[1] + (tx / l) * w * s;
      posArr.push(x, y(x, z, t), z);
    }
    if (i < n - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

function riverMeshes(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: "#5cb4cf",
    roughness: 0.25,
    side: THREE.DoubleSide,
  });
  RIVERS.forEach((pts, k) => {
    g.add(
      ribbon(
        pts.map((p) => [p.x, p.y] as [number, number]),
        (t) => (k === 0 ? 0.55 + t * 1.4 : 0.4 + t * 0.8),
        (_x, _z, t) => {
          const p = pts[Math.round(t * (pts.length - 1))] as THREE.Vector2;
          return Math.max(0.02, sampleIsland(p.x, p.y).h + 0.18);
        },
        mat,
      ),
    );
  });
  return g;
}

// ── roads ──────────────────────────────────────────────────────────────────

const RES = 1;
const RW = Math.round((X1 - X0) / RES) + 1;
const RH = Math.round((Z1 - Z0) / RES) + 1;
/** 16 directions: knight moves too, so routes aren't stuck at 45° angles. */
const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
  [1, 2],
  [1, -2],
  [-1, 2],
  [-1, -2],
];

interface Fields {
  h: Float32Array;
  river: Float32Array;
  coast: Float32Array;
}

function findPath(from: [number, number], to: [number, number], f: Fields): [number, number][] {
  const idx = (i: number, j: number) => j * RW + i;
  const cell = (x: number, z: number): [number, number] => [
    THREE.MathUtils.clamp(Math.round((x - X0) / RES), 0, RW - 1),
    THREE.MathUtils.clamp(Math.round((z - Z0) / RES), 0, RH - 1),
  ];
  const [si, sj] = cell(...from);
  const [ti, tj] = cell(...to);
  const g = new Float32Array(RW * RH).fill(Infinity);
  const came = new Int32Array(RW * RH).fill(-1);
  const closed = new Uint8Array(RW * RH);
  const open: [number, number][] = [[idx(si, sj), 0]];
  g[idx(si, sj)] = 0;
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++)
      if ((open[k] as [number, number])[1] < (open[bi] as [number, number])[1]) bi = k;
    const [cur] = open.splice(bi, 1)[0] as [number, number];
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % RW;
    const cj = Math.floor(cur / RW);
    if (ci === ti && cj === tj) break;
    for (const [di, dj] of DIRS) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= RW || nj >= RH) continue;
      const n = idx(ni, nj);
      if (closed[n] || (f.coast[n] ?? -1) < 0.9) continue;
      const dist = Math.hypot(di, dj) * RES;
      const slope = Math.abs((f.h[n] ?? 0) - (f.h[cur] ?? 0)) / dist;
      const wiggle = fbm((X0 + ni * RES) * 0.2 + 17, (Z0 + nj * RES) * 0.2 - 5, 3);
      let cost = dist * (1 + slope * slope * 45 + ((f.h[n] ?? 0) > 8 ? 5 : 0) + wiggle * 2);
      if ((f.river[n] ?? 9) < 1.4) cost += 10;
      const ng = (g[cur] ?? 0) + cost;
      if (ng < (g[n] ?? Infinity)) {
        g[n] = ng;
        came[n] = cur;
        open.push([n, ng + Math.hypot(ni - ti, nj - tj) * RES]);
      }
    }
  }
  const out: [number, number][] = [];
  let c = idx(ti, tj);
  while (c >= 0) {
    out.push([X0 + (c % RW) * RES, Z0 + Math.floor(c / RW) * RES]);
    c = came[c] ?? -1;
  }
  return out.reverse();
}

function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 3) return pts;
  const a = pts[0] as [number, number];
  const b = pts[pts.length - 1] as [number, number];
  let far = 0;
  let fi = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i] as [number, number];
    const abx = b[0] - a[0];
    const abz = b[1] - a[1];
    const d = Math.abs((p[0] - a[0]) * abz - (p[1] - a[1]) * abx) / (Math.hypot(abx, abz) || 1);
    if (d > far) {
      far = d;
      fi = i;
    }
  }
  if (far < tol) return [a, b];
  return [...simplify(pts.slice(0, fi + 1), tol).slice(0, -1), ...simplify(pts.slice(fi), tol)];
}

/** A grid route made into a road someone would have built: key turns joined by a flowing curve. */
function organic(route: [number, number][], seed: number): [number, number][] {
  const keys = simplify(route, 1.6);
  const bent: [number, number][] = [];
  keys.forEach((p, i) => {
    bent.push(p);
    const q = keys[i + 1];
    if (!q) return;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len > 6) {
      const k = (hash(seed + i, 7) - 0.5) * Math.min(3.5, len * 0.16);
      bent.push([
        (p[0] + q[0]) / 2 - ((q[1] - p[1]) / len) * k,
        (p[1] + q[1]) / 2 + ((q[0] - p[0]) / len) * k,
      ]);
    }
  });
  const curve = new THREE.CatmullRomCurve3(
    bent.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
  );
  const n = Math.max(24, Math.round(curve.getLength() * 2.5));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n);
    const t = curve.getTangentAt(i / n);
    const m =
      (fbm(p.x * 0.12 + seed, p.z * 0.12 - seed, 3) - 0.5) * 1.2 * Math.sin((i / n) * Math.PI);
    out.push([p.x - t.z * m, p.z + t.x * m]);
  }
  return out;
}

/** The road network: irregular, as it grew between the places people go. */
function roads(): { group: THREE.Group; paths: [number, number][][] } {
  const f: Fields = {
    h: new Float32Array(RW * RH),
    river: new Float32Array(RW * RH),
    coast: new Float32Array(RW * RH),
  };
  for (let j = 0; j < RH; j++)
    for (let i = 0; i < RW; i++) {
      const s = sampleIsland(X0 + i * RES, Z0 + j * RES);
      f.h[j * RW + i] = s.h;
      f.river[j * RW + i] = s.river;
      f.coast[j * RW + i] = s.coast;
    }
  const astroTown: [number, number] = [S("astro")[0], S("astro")[1] + 6];
  const links: [[number, number], [number, number], boolean][] = [
    [S("hub"), S("zingle"), true],
    [S("zingle"), S("winzo"), true],
    [S("hub"), S("expresso"), true],
    [S("expresso"), S("fun"), true],
    [S("hub"), S("murphy"), true],
    [S("hub"), astroTown, false],
    [astroTown, S("personal"), false],
    [S("personal"), S("fun"), true],
  ];
  const g = new THREE.Group();
  const paths: [number, number][][] = [];
  const asphalt = new THREE.MeshStandardMaterial({
    color: "#5b5e66",
    roughness: 0.95,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const gravel = new THREE.MeshStandardMaterial({
    color: "#cdb88f",
    roughness: 1,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  for (const [k, [a, b, main]] of links.entries()) {
    const p = organic(findPath(a, b, f), k * 13 + 5);
    paths.push(p);
    g.add(
      ribbon(
        p,
        () => (main ? 0.55 : 0.42),
        (x, z) => {
          const s = sampleIsland(x, z);
          return s.river < 1.8 ? Math.max(0.3, s.h) + 0.35 : s.h + 0.07;
        },
        main ? asphalt : gravel,
      ),
    );
  }
  return { group: g, paths };
}

// ── miniatures ─────────────────────────────────────────────────────────────

function on<T extends THREE.Object3D>(o: T, x: number, z: number, lift = 0, rot = 0): T {
  o.position.set(x, sampleIsland(x, z).h + lift, z);
  o.rotation.y = rot;
  return o;
}

function house(
  w: number,
  d: number,
  h: number,
  wall: string,
  roof: string,
  flat = false,
): THREE.Group {
  const g = new THREE.Group();
  g.add(block([-w / 2, 0, -d / 2], [w / 2, h, d / 2], wall, { r: 0.08 }));
  if (flat) {
    g.add(
      block([-w / 2 - 0.05, h, -d / 2 - 0.05], [w / 2 + 0.05, h + 0.12, d / 2 + 0.05], roof, {
        r: 0.04,
      }),
    );
  } else {
    const diag = Math.hypot(w, d);
    const r = new THREE.Mesh(
      new THREE.ConeGeometry(diag * 0.62, h * 0.6, 4),
      new THREE.MeshStandardMaterial({ color: roof, roughness: 0.75 }),
    );
    r.rotation.y = Math.PI / 4;
    r.scale.set((w / diag) * Math.SQRT2, 1, (d / diag) * Math.SQRT2);
    r.position.y = h * 1.3;
    r.castShadow = true;
    g.add(r);
  }
  return g;
}

function town(
  cx: number,
  cz: number,
  r: number,
  n: number,
  style: { walls: string[]; roofs: string[]; flat?: boolean },
  roadPts: [number, number][],
  seed: number,
): THREE.Group {
  const g = new THREE.Group();
  let placed = 0;
  for (let k = 0; k < n * 8 && placed < n; k++) {
    const a = hash(seed, k) * Math.PI * 2;
    const d = Math.sqrt(hash(k, seed)) * r;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    if (roadPts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.1)) continue;
    if (sampleIsland(x, z).coast < 1 || sampleIsland(x, z).river < 1.8) continue;
    const w = 0.9 + hash(k, 3) * 0.6;
    g.add(
      on(
        house(
          w,
          w * 0.8,
          0.7 + hash(k, 5) * 0.6,
          style.walls[k % style.walls.length] ?? "#eee",
          style.roofs[k % style.roofs.length] ?? "#a33",
          style.flat,
        ),
        x,
        z,
        0,
        hash(k, 9) * Math.PI,
      ),
    );
    placed++;
  }
  return g;
}

/** A little flag on a pole, in the journey's colour, with its name. */
function flag(name: string, colour: string): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl([0, 0, 0], [0, 4.2, 0], 0.08, "#d9d4c8", { metal: true }));
  g.add(ball([0, 4.25, 0], 0.16, "#d9b23a", { metal: true }));
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 200;
  const x = c.getContext("2d");
  if (x) {
    x.fillStyle = colour;
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(512, 0);
    x.lineTo(470, 100);
    x.lineTo(512, 200);
    x.lineTo(0, 200);
    x.closePath();
    x.fill();
    x.fillStyle = "#ffffff";
    x.font = "900 92px Outfit, Inter, sans-serif";
    x.textBaseline = "middle";
    x.fillText(name, 26, 104, 430);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  // A gently curled cloth: a bent plane, visible from both sides.
  const geo = new THREE.PlaneGeometry(3.4, 1.33, 16, 1);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + 1.7) / 3.4;
    p.setZ(i, Math.sin(u * Math.PI * 1.4) * 0.22 * u);
  }
  geo.translate(1.7, 0, 0);
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: t,
      side: THREE.DoubleSide,
      roughness: 0.8,
      transparent: true,
      alphaTest: 0.5,
    }),
  );
  cloth.position.y = 3.55;
  cloth.castShadow = true;
  g.add(cloth);
  return g;
}

function landmarks(roadPts: [number, number][]): THREE.Group {
  const g = new THREE.Group();
  const [hx, hz] = S("hub");
  // The garage town at the crossroads, and the garage itself.
  g.add(
    town(
      hx,
      hz,
      5,
      14,
      { walls: ["#f1e9da", "#f4dcc2", "#e9efe6"], roofs: ["#c4643f", "#b85a3a"] },
      roadPts,
      1,
    ),
  );
  const gar = new THREE.Group();
  gar.add(block([-1.6, 0, -1.2], [1.6, 1.5, 1.2], "#efe3cb", { r: 0.1 }));
  gar.add(block([-1.1, 0, 1.15], [1.1, 1.1, 1.25], "#2b2d33", { r: 0.03 }));
  gar.add(block([-1.7, 1.5, -1.3], [1.7, 1.65, 1.3], "#c4643f", { r: 0.05 }));
  g.add(on(gar, hx, hz));
  // WinZO: a race circuit on the coastal plain, grandstand and pits.
  {
    const [cx, cz] = S("winzo");
    const loop = new THREE.CatmullRomCurve3(
      [
        [-4.5, -2.5],
        [2.5, -3.8],
        [5, -1],
        [2.8, 1.8],
        [-0.5, 0.8],
        [-3.2, 3.2],
        [-5.8, 0.8],
      ].map(([x, z]) => new THREE.Vector3(cx + (x ?? 0), 0, cz + (z ?? 0))),
      true,
      "centripetal",
    );
    const pts = loop.getSpacedPoints(140).map((p) => [p.x, p.z] as [number, number]);
    pts.push(pts[0] as [number, number]);
    g.add(
      ribbon(
        pts,
        () => 0.4,
        (x, z) => sampleIsland(x, z).h + 0.08,
        new THREE.MeshStandardMaterial({
          color: "#3f4248",
          roughness: 0.9,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      ),
    );
    g.add(on(block([-1.8, 0, -0.5], [1.8, 1.0, 0.5], "#e6e2d8", { r: 0.12 }), cx + 0.5, cz - 5.2));
    g.add(on(block([-1.2, 0, -0.4], [1.2, 0.6, 0.4], "#cf3229", { r: 0.1 }), cx - 1, cz + 4.3));
  }
  // Zingle AI: a sandstone village, the fort on its rock, an oasis.
  {
    const [cx, cz] = S("zingle");
    g.add(
      town(
        cx + 3,
        cz + 2,
        3,
        8,
        { walls: ["#dcab6a", "#e6bd7d"], roofs: ["#c99456"], flat: true },
        roadPts,
        2,
      ),
    );
    g.add(on(ball([0, 0, 0], 2.4, "#b88452", undefined, [1.3, 0.85, 1.1]), cx - 3, cz - 3, 0.5));
    const fort = new THREE.Group();
    fort.add(block([-1.7, 0, -1.3], [1.7, 1.8, 1.3], "#d6a05b", { r: 0.2 }));
    for (const [x, z] of [
      [-1.7, -1.3],
      [1.7, -1.3],
      [-1.7, 1.3],
      [1.7, 1.3],
    ] as [number, number][])
      fort.add(cyl([x, 0, z], [x, 2.4, z], 0.45, "#cc944f"));
    g.add(on(fort, cx - 3, cz - 3, 2.2));
    const oasis = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 24),
      new THREE.MeshStandardMaterial({ color: "#4fb0c9", roughness: 0.2 }),
    );
    oasis.rotation.x = -Math.PI / 2;
    g.add(on(oasis, cx - 1, cz + 5, 0.06));
  }
  // AstroClub IITK: observatory domes among the peaks, a gompa, a hamlet below.
  {
    const [cx, cz] = S("astro");
    for (const [dx, dz] of [
      [-2.5, 0],
      [-0.5, -1.5],
    ] as [number, number][]) {
      const o = new THREE.Group();
      o.add(cyl([0, 0, 0], [0, 0.9, 0], 0.9, "#e9e6df"));
      o.add(ball([0, 0.9, 0], 0.9, "#f4f2ee", { metal: true, rough: 0.3 }));
      g.add(on(o, cx + dx, cz + dz));
    }
    const gompa = new THREE.Group();
    gompa.add(block([-1.3, 0, -0.9], [1.3, 1.3, 0.9], "#f2ede2", { r: 0.12 }));
    gompa.add(block([-1.35, 1.2, -0.95], [1.35, 1.45, 0.95], "#a6362b", { r: 0.06 }));
    g.add(on(gompa, cx + 3.5, cz + 2.5));
    g.add(
      town(cx, cz + 6, 2.3, 6, { walls: ["#f2ede2"], roofs: ["#a6362b"], flat: true }, roadPts, 3),
    );
  }
  // Personal (the North-East): a monastery with tiered roofs, bamboo houses in the forest.
  {
    const [cx, cz] = S("personal");
    const mon = new THREE.Group();
    mon.add(block([-1.4, 0, -1.1], [1.4, 1.2, 1.1], "#f1e8d6", { r: 0.12 }));
    mon.add(block([-1.7, 1.2, -1.35], [1.7, 1.5, 1.35], "#c0452f", { r: 0.1 }));
    mon.add(block([-0.9, 1.5, -0.7], [0.9, 2.3, 0.7], "#f1e8d6", { r: 0.1 }));
    mon.add(block([-1.15, 2.3, -0.9], [1.15, 2.55, 0.9], "#c0452f", { r: 0.08 }));
    mon.add(ball([0, 2.75, 0], 0.25, "#d9b23a", { metal: true }));
    g.add(on(mon, cx + 2.5, cz - 2.5));
    g.add(
      town(
        cx - 1,
        cz + 1,
        2.6,
        7,
        { walls: ["#a7774f", "#9a6b45"], roofs: ["#3f7d4b", "#b4472f"] },
        roadPts,
        4,
      ),
    );
  }
  // Expresso: an estate bungalow and coffee rows following the hills.
  {
    const [cx, cz] = S("expresso");
    g.add(on(house(2.2, 1.6, 1, "#efe2c4", "#8a4a2c"), cx, cz));
    const rows = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.27, 0),
      new THREE.MeshStandardMaterial({ color: "#2f6e3b", roughness: 0.8 }),
      700,
    );
    let n = 0;
    const m = new THREE.Matrix4();
    for (let r = 0; r < 9; r++)
      for (let k = 0; k < 44 && n < 700; k++) {
        const a = (k / 44) * Math.PI * 1.5 + 0.3;
        const rad = 3.4 + r * 0.7;
        const x = cx + Math.cos(a) * rad;
        const z = cz + Math.sin(a) * rad * 0.8;
        const s = sampleIsland(x, z);
        if (
          s.coast < 1.5 ||
          s.river < 2 ||
          roadPts.some(([px, pz]) => Math.abs(px - x) < 0.9 && Math.abs(pz - z) < 0.9)
        )
          continue;
        m.makeTranslation(x, s.h + 0.2, z);
        rows.setMatrixAt(n++, m);
      }
    rows.count = n;
    rows.castShadow = true;
    g.add(rows);
  }
  // C++ for fun: the riverside fair at the river mouth, a Ferris wheel and tents.
  {
    const [cx, cz] = S("fun");
    const wheel = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2, 0.1, 8, 40),
      new THREE.MeshStandardMaterial({ color: "#f2b705", roughness: 0.5 }),
    );
    ring.position.y = 2.6;
    wheel.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      wheel.add(cyl([0, 2.6, 0], [Math.cos(a) * 2, 2.6 + Math.sin(a) * 2, 0], 0.04, "#d94f7a"));
    }
    wheel.add(cyl([-0.9, 0, 0], [0, 2.6, 0], 0.08, "#8a8f98"));
    wheel.add(cyl([0.9, 0, 0], [0, 2.6, 0], 0.08, "#8a8f98"));
    g.add(on(wheel, cx + 1.5, cz - 0.5, 0, 0.6));
    for (const [x, z, c] of [
      [-2, 1.5, "#e8573e"],
      [-0.5, 3, "#2e86c1"],
      [1.3, 2.5, "#f2b705"],
      [-3, -0.5, "#7b4bb5"],
    ] as [number, number, string][]) {
      const tent = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 1.2, 10),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }),
      );
      tent.castShadow = true;
      g.add(on(tent, cx + x, cz + z, 0.6));
    }
  }
  // Secret (the south coast): a fishing village, the lighthouse on the point, boats.
  {
    const [cx, cz] = S("murphy");
    g.add(
      town(
        cx + 1,
        cz - 1,
        2.6,
        8,
        { walls: ["#f6f3ec", "#eef2f4"], roofs: ["#2e6fb6", "#c4643f"] },
        roadPts,
        6,
      ),
    );
    const lh = new THREE.Group();
    for (let i = 0; i < 4; i++)
      lh.add(
        cyl([0, i * 0.7, 0], [0, (i + 1) * 0.7, 0], 0.45 - i * 0.04, i % 2 ? "#d8322b" : "#f4f1ea"),
      );
    lh.add(ball([0, 3.0, 0], 0.32, "#ffe9a8", { emissive: true }));
    g.add(on(lh, -33.5, 35));
    for (const [x, z, r] of [
      [-24, 34, 0.4],
      [-38, 30, -0.3],
      [-27, 39, 1.1],
    ] as [number, number, number][]) {
      const boat = new THREE.Group();
      boat.add(block([-0.8, 0, -0.3], [0.8, 0.35, 0.3], "#f4f1ea", { r: 0.12 }));
      boat.add(block([-0.8, 0.02, -0.31], [0.8, 0.12, 0.31], "#2e6fb6", { r: 0.04 }));
      boat.position.set(x, 0, z);
      boat.rotation.y = r;
      g.add(boat);
    }
  }
  // A flag at each journey's place.
  for (const w of WORLDS) {
    const site = SITES[w.id];
    if (!site) continue;
    const f = flag(w.name, w.tint);
    f.name = `flag:${w.id}`;
    g.add(on(f, site[0] + 1.6, site[1] + 1.6, 0, -0.5));
  }
  return g;
}

function trees(roadPts: [number, number][]): THREE.Group {
  const g = new THREE.Group();
  const kinds = {
    round: { geo: new THREE.IcosahedronGeometry(0.6, 1), colour: "#4b9643", lift: 0.5 },
    pine: { geo: new THREE.ConeGeometry(0.5, 1.6, 7), colour: "#2c6a3b", lift: 0.8 },
    palm: { geo: new THREE.IcosahedronGeometry(0.5, 1), colour: "#6fbf5a", lift: 1.0 },
  } as const;
  const spots: Record<keyof typeof kinds, THREE.Matrix4[]> = { round: [], pine: [], palm: [] };
  for (let i = 0; i < 5600; i++) {
    const x = X0 + hash(i, 3) * (X1 - X0);
    const z = Z0 + hash(i, 7) * (Z1 - Z0);
    const s = sampleIsland(x, z);
    if (s.coast < 1.4 || s.h > 7.5 || s.river < 2) continue;
    if (TOWNS.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + 0.5)) continue;
    if (roadPts.some(([px, pz]) => Math.abs(px - x) < 1.2 && Math.abs(pz - z) < 1.2)) continue;
    const forest = forestAt(x, z);
    const mountain = smooth(3, 6, s.h);
    const desert = desertAt(x, z);
    const coastal = 1 - smooth(1.5, 6, s.coast);
    // Clumpy, like real woods: a noise field decides where groves grow.
    const grove = smooth(0.42, 0.7, fbm(x * 0.13 + 40, z * 0.13 - 20, 4));
    const density =
      0.04 + grove * 0.35 + forest * 0.85 + coffeeAt(x, z) * 0.2 - desert * 0.2 + mountain * 0.12;
    if (hash(i, 11) > density) continue;
    const kind: keyof typeof kinds =
      forest > 0.3 || mountain > 0.5 ? "pine" : coastal > 0.5 || desert > 0.45 ? "palm" : "round";
    const sc = 0.65 + hash(i, 13) * 0.55;
    spots[kind].push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, s.h + kinds[kind].lift * sc, z),
        new THREE.Quaternion(),
        new THREE.Vector3(sc, sc, sc),
      ),
    );
  }
  for (const k of Object.keys(kinds) as (keyof typeof kinds)[]) {
    const list = spots[k];
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(
      kinds[k].geo,
      new THREE.MeshStandardMaterial({ color: kinds[k].colour, roughness: 0.85 }),
      list.length,
    );
    list.forEach((m, i) => {
      im.setMatrixAt(i, m);
    });
    im.castShadow = true;
    g.add(im);
  }
  return g;
}

/** The whole island for the map table. */
export function continuousIsland(_kit: Kit, style: ReliefStyle = "relief"): THREE.Group {
  const g = new THREE.Group();
  g.add(terrain(style));
  g.add(riverMeshes());
  const net = roads();
  g.add(net.group);
  const roadPts = net.paths.flat();
  g.add(landmarks(roadPts));
  g.add(trees(roadPts));
  return g;
}

/** Ground height on the island (for anything floating above it). */
export function islandHeightAt(x: number, z: number): number {
  return Math.max(0, sampleIsland(x, z).h);
}
