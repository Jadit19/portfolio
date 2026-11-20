/**
 * Sonar Qila, Jaisalmer's golden fort, as rideable ground in the AstroClub mountains' language,
 * much lower: Trikuta hill is carved rock (mesa blocks merged by a smooth maximum, `Carving`),
 * about 9 m high, its top levelled into a plateau for the town. A long ramp road climbs the
 * south face gently, eased so the grade stays ~9% or less; small blocks (`FineBlocks`) are
 * placed along its cut and fill, so the rock stays blocky right up to it. Through the gate a
 * lane loops round the town, between the houses, past the temples to the palace square and
 * back; curbs along both its edges keep you on it, and the ramp is curbed the whole way up.
 *
 * Everything is in a local frame (the hill's centre at the origin, the ramp's foot to the south-
 * east, +z towards the camera); a world places it and maps heights, roads and curbs across.
 */

import * as THREE from "three";
import { mix } from "../flat/kit";
import type { Lamp } from "../flat/night";
import { Carving, FineBlocks } from "./carve";
import { join } from "./nature";
import { at, drum, lathe, rbox } from "./toys";

type G = THREE.BufferGeometry;
export type Pt = [number, number];

const GOLD = "#f0cf8e";
const GOLD_D = "#d9ac64";
const GOLD_L = "#f8e2b4";
const WOOD_D = "#7e5638";
const BRASS = "#d9b05a";
/** The rock, low to high (Jaisalmer's yellow sandstone), the town's floor, the roads. */
const ROCK_LOW = new THREE.Color("#e6c48c");
const ROCK_MID = new THREE.Color("#dcb176");
const ROCK_HIGH = new THREE.Color("#d2a466");
const FLOOR = new THREE.Color("#ecd5a6");
const ROAD = new THREE.Color("#f2e3c4");
/** The desert floor round the foot (the world's ground: sand peach). */
const SAND = new THREE.Color("#fcdcc4");
type CarveCellLike = { x: number; z: number; t: number };

/** The plateau's level (m), and the rock's top before it's levelled. */
export const QILA_TOP = 8.4;
const ROCK_TOP = 10;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

function chaikin(pts: Pt[], iters = 3, closed = true): Pt[] {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const out: Pt[] = [];
    const n = p.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = p[i] as Pt;
      const b = p[(i + 1) % n] as Pt;
      out.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
      );
    }
    if (!closed) {
      out.unshift(p[0] as Pt);
      out.push(p[n - 1] as Pt);
    }
    p = out;
  }
  return p;
}
function resample(pts: Pt[], step0: number, closed = false): Pt[] {
  const src = closed ? [...pts, pts[0] as Pt] : pts;
  // A loop is spaced evenly all round (so where it closes is no different from anywhere else).
  let step = step0;
  if (closed) {
    let per = 0;
    for (let i = 0; i < src.length - 1; i++)
      per += Math.hypot(
        (src[i + 1] as Pt)[0] - (src[i] as Pt)[0],
        (src[i + 1] as Pt)[1] - (src[i] as Pt)[1],
      );
    step = per / Math.max(3, Math.round(per / step0));
  }
  const out: Pt[] = [src[0] as Pt];
  let carry = 0;
  for (let i = 0; i < src.length - 1; i++) {
    const [ax, az] = src[i] as Pt;
    const [bx, bz] = src[i + 1] as Pt;
    const l = Math.hypot(bx - ax, bz - az);
    let d = step - carry;
    while (d <= l) {
      out.push([ax + ((bx - ax) * d) / l, az + ((bz - az) * d) / l]);
      d += step;
    }
    carry = l - (d - step);
  }
  if (closed) {
    // (The last point lands on the first, give or take rounding.)
    const f = out[0] as Pt;
    const l = out[out.length - 1] as Pt;
    if (Math.hypot(l[0] - f[0], l[1] - f[1]) < step * 0.5) out.pop();
  } else out.push(src[src.length - 1] as Pt);
  return out;
}
const inside = (o: Pt[], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const [xi, zi] = o[i] as Pt;
    const [xj, zj] = o[j] as Pt;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
function nearest(
  pts: Pt[],
  x: number,
  z: number,
  closed: boolean,
): { d: number; i: number; t: number } {
  let best = { d: 1e9, i: 0, t: 0 };
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i] as Pt;
    const b = pts[(i + 1) % n] as Pt;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
    if (d < best.d) best = { d, i, t };
  }
  return best;
}
/** Signed distance into an outline (positive inside). */
const sdist = (o: Pt[], x: number, z: number) =>
  (inside(o, x, z) ? 1 : -1) * nearest(o, x, z, true).d;
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export interface QilaRoad {
  pts: Pt[];
  /** Height at each point. */
  ys: number[];
  half: number;
  closed: boolean;
}
export interface SonarQila {
  /** What you ride (local). */
  heightAt(x: number, z: number): number;
  /** The rock as one coloured surface (local; colour per triangle, sharp). */
  terrain: G;
  /** The ramp's and the lane's own surfaces (exact edges, at their heights). */
  roadSurfaces: G[];
  /** Walls, bastions, gates, houses, the palace, the temples (local). */
  parts: G[];
  lamps: Lamp[];
  /** The ramp (foot first) and the lane round the town (a loop). */
  ramp: QilaRoad;
  lane: QilaRoad;
  /** Invisible walls along the ramp's and the lane's edges: [ax, az, bx, bz]. */
  curbs: [number, number, number, number][];
  /** Solid things (houses, the palace, temples, bastions): x, z, r. */
  solids: [number, number, number][];
  /** The hill's foot (for keeping scenery off it). */
  foot: Pt[];
  /** The area its terrain covers: x0, z0, x1, z1. */
  bounds: [number, number, number, number];
}

export function sonarQila(seed = 17): SonarQila {
  const rnd = rng(seed);
  // Trikuta hill: long and low, a teardrop.
  const T0 = chaikin(
    [
      [-52, 8],
      [-42, -12],
      [-16, -24],
      [20, -22],
      [46, -10],
      [52, 6],
      [32, 18],
      [0, 22],
      [-32, 20],
    ] as Pt[],
    3,
  );
  const env = (x: number, z: number) => ROCK_TOP * smooth(0, 16, sdist(T0, x, z));
  /** The rim wall's line (the town's edge) and the lower wall's (the terrace's edge). */
  const pullT = (k: number): Pt[] => {
    const cx = T0.reduce((a, p) => a + p[0], 0) / T0.length;
    const cz = T0.reduce((a, p) => a + p[1], 0) / T0.length;
    return T0.map(([x, z]) => {
      const l = Math.hypot(x - cx, z - cz) || 1;
      return [x - ((x - cx) / l) * k, z - ((z - cz) / l) * k] as Pt;
    });
  };
  const RIM = pullT(4.5);
  const LOW = pullT(-3.5);
  /** The terrace's height round the foot (the lower wall holds it). */
  const SKIRT = 1.2;
  const carving = new Carving({
    env,
    top: ROCK_TOP,
    W: 400,
    D: 400,
    small: 5,
    big: 9,
    erode: 0.12,
    plateau: 0.78,
    snowline: 999,
    rnd,
    edge: 1.6,
  });

  // The lane: a stadium round the town (two straights, semicircular ends of 10 m radius: the
  // plateau is only ~28 m deep, and anything tighter is too sharp a turn to ride).
  const LANE_R = 10;
  const LANE_X = 26;
  const laneLoop: Pt[] = [];
  for (let x = -LANE_X; x < LANE_X; x += 1) laneLoop.push([x, LANE_R]);
  for (let k = 0; k < 24; k++) {
    const t = (k / 24) * Math.PI;
    laneLoop.push([LANE_X + Math.sin(t) * LANE_R, Math.cos(t) * LANE_R]);
  }
  for (let x = LANE_X; x > -LANE_X; x -= 1) laneLoop.push([x, -LANE_R]);
  for (let k = 0; k < 24; k++) {
    const t = (k / 24) * Math.PI;
    laneLoop.push([-LANE_X - Math.sin(t) * LANE_R, -Math.cos(t) * LANE_R]);
  }
  const lanePts = resample(laneLoop, 2.5, true);
  // The ramp: from the foot (south-east) along the south face, swinging north in a wide bend to
  // meet the lane's south straight square on (its end exactly on the lane).
  const rampPts = resample(
    chaikin(
      [
        [98, 44],
        [74, 36],
        [48, 30],
        [22, 27.5],
        [4, 27.5],
        [-6, 25.5],
        [-12, 20],
        [-14, 15],
        [-14, LANE_R],
      ] as Pt[],
      4,
      false,
    ),
    2.5,
  );
  const L = rampPts.reduce(
    (a, p, i) =>
      i ? a + Math.hypot(p[0] - (rampPts[i - 1] as Pt)[0], p[1] - (rampPts[i - 1] as Pt)[1]) : 0,
    0,
  );
  let acc = 0;
  const rampYs = rampPts.map((p, i) => {
    if (i) acc += Math.hypot(p[0] - (rampPts[i - 1] as Pt)[0], p[1] - (rampPts[i - 1] as Pt)[1]);
    const t = acc / L;
    // Mostly an even grade, eased at both ends (never steeper than ~1.2× the average).
    return QILA_TOP * (0.6 * t + 0.4 * smoother(t));
  });
  const ramp: QilaRoad = { pts: rampPts, ys: rampYs, half: 2.2, closed: false };
  const lane: QilaRoad = { pts: lanePts, ys: lanePts.map(() => QILA_TOP), half: 1.8, closed: true };

  type Near = { d: number; y: number; half: number; lane: boolean };
  const nearRoad = (x: number, z: number): Near => {
    let best: Near = { d: 1e9, y: 0, half: 2, lane: false };
    for (const r of [ramp, lane]) {
      const n = nearest(r.pts, x, z, r.closed);
      if (n.d < best.d) {
        const y0 = r.ys[n.i] as number;
        const y1 = r.ys[(n.i + 1) % r.ys.length] as number;
        best = { d: n.d, y: y0 + (y1 - y0) * n.t, half: r.half, lane: r === lane };
      }
    }
    return best;
  };
  /** The rock before any road: carved, its top levelled into the town's plateau. */
  /**
   * The rock before any road. The walls are its steps: inside the rim wall's line the town's
   * floor is dead flat (QILA_TOP); outside it the carved rock is held well below the wall's top,
   * so the rim wall stands as a retaining wall holding the town up (never rock above the wall).
   * Between the rim and the lower wall, the hill's foot is a stone terrace at least SKIRT high,
   * retained by the lower wall; outside that, the sand.
   */
  const base = (x: number, z: number) => {
    if (inside(RIM, x, z)) return { n: QILA_TOP, cell: null };
    if (!inside(LOW, x, z)) return { n: 0, cell: null };
    const sf = carving.surface(x, z);
    return { n: Math.min(QILA_TOP - 1.8, Math.max(SKIRT, sf.h)), cell: sf.cell };
  };
  /** The slope a road leaves in the rock: its cut above, its fill below (as the mountains'). */
  const slopeOf = (h: number, rd: Near) => {
    if (rd.d < rd.half + 1.2) return rd.y;
    if (h > rd.y) {
      const w = 2 + (h - rd.y) * 0.45;
      if (rd.d >= rd.half + 1.2 + w) return h;
      const k = (rd.d - rd.half - 1.2) / w;
      return rd.y + (h - rd.y) * smoother(k);
    }
    return Math.max(h, rd.y - (rd.d - rd.half - 1.2) * 0.9);
  };
  // Small blocks along the ramp's cut and fill: the stone placement it rises on.
  const fine = new FineBlocks();
  for (let i = 0; i < rampPts.length; i++) {
    const [px, pz] = rampPts[i] as Pt;
    for (let k = 0; k < 9; k++) {
      const x = px + (rnd() - 0.5) * 26;
      const z = pz + (rnd() - 0.5) * 26;
      const rd = nearRoad(x, z);
      if (rd.lane || rd.d < rd.half + 0.4 || rd.d > rd.half + 12) continue;
      const h0 = base(x, z).n;
      const sl = slopeOf(h0, rd);
      if (Math.abs(sl - h0) < 0.25 && rd.d > rd.half + 3) continue;
      fine.add(x, z, sl + (rnd() - 0.4) * 0.5, rnd);
    }
  }
  const ground = (x: number, z: number) => {
    const b = base(x, z);
    let h = b.n;
    const rd = nearRoad(x, z);
    if (rd.lane) {
      if (rd.d < rd.half + 0.6) h = rd.y;
    } else if (rd.d < rd.half + 14) {
      if (rd.d < rd.half + 1.2) h = rd.y;
      else {
        const sl = slopeOf(h, rd);
        const f = fine.at(x, z);
        // The stones make the slope blocky, but stay within a metre of it (here the hill is low:
        // unheld, a fill stone's top would spread out into a bench ending in a cliff).
        if (f !== null && Math.abs(sl - h) > 0.05)
          h = sl > h ? Math.max(h, Math.min(f, rd.y, sl + 1)) : Math.min(h, Math.max(f, sl - 1));
        else h = sl;
      }
    }
    return { h: Math.max(0, h), rock: b.n, cell: b.cell, rd };
  };
  const heightAt = (x: number, z: number) => ground(x, z).h;

  // ── the terrain: one surface over the hill, its ramp and its foot, coloured as crisply as the
  // houses on it are drawn. Colour is per triangle (no smear across a boundary): each carved
  // block one tone, the town's floor and the roads in flat bands with sharp edges, the sand at
  // the foot cut sharp. The one gradient is a wide one: dark to light over the whole 9 m height.
  const bounds: [number, number, number, number] = [-70, -42, 108, 56];
  const step = 0.5;
  const nx = Math.round((bounds[2] - bounds[0]) / step);
  const nz = Math.round((bounds[3] - bounds[1]) / step);
  const grid = new THREE.PlaneGeometry(bounds[2] - bounds[0], bounds[3] - bounds[1], nx, nz);
  grid.rotateX(-Math.PI / 2);
  grid.translate((bounds[0] + bounds[2]) / 2, 0, (bounds[1] + bounds[3]) / 2);
  const gp = grid.attributes.position as THREE.BufferAttribute;
  // What each vertex is: its height, its block, on a road, on the town's floor.
  const vh = new Float32Array(gp.count);
  const vcell: (CarveCellLike | null)[] = new Array(gp.count);
  const vroad = new Uint8Array(gp.count);
  const vfloor = new Uint8Array(gp.count);
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i);
    const z = gp.getZ(i);
    const g = ground(x, z);
    vh[i] = g.h;
    vcell[i] = g.cell;
    // (Just inside the road's own surface, so the grid's teeth stay hidden under it.)
    vroad[i] = g.rd.d < g.rd.half - 0.15 ? 1 : 0;
    // The town's floor runs right out to the rim wall (its edge hides under the wall).
    vfloor[i] = inside(RIM, x, z) && Math.abs(g.h - QILA_TOP) < 0.03 ? 1 : 0;
  }
  const idx = grid.index as THREE.BufferAttribute;
  // Smooth shading from the shared grid (so a steep face shades evenly, not in zebra stripes from
  // alternating facets); the colour stays per triangle, so its edges stay sharp.
  for (let i = 0; i < gp.count; i++) gp.setY(i, (vh[i] as number) - 0.02);
  grid.computeVertexNormals();
  const gn = grid.attributes.normal as THREE.BufferAttribute;
  const N: number[] = [];
  const P: number[] = [];
  const C: number[] = [];
  const c = new THREE.Color();
  const tone = (cell: CarveCellLike) =>
    ((((Math.sin(cell.x * 12.9898 + cell.z * 78.233) * 43758.5453) % 1) + 1) % 1) * 0.09 - 0.045;
  for (let t = 0; t < idx.count; t += 3) {
    const v = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
    const hs = v.map((k) => vh[k] as number);
    // Only where there's rock or road above the plain (the flat foot is the world's own ground).
    if (Math.max(...hs) <= 0.06) continue;
    const votes = (a: Uint8Array) => v.reduce((n, k) => n + (a[k] as number), 0) >= 2;
    const hAvg = hs.reduce((a, h) => a + h, 0) / 3;
    if (votes(vroad)) c.copy(ROAD);
    else if (votes(vfloor)) c.copy(FLOOR);
    else if (hAvg < 0.2) c.copy(SAND);
    else {
      // The block this triangle belongs to (the one most of its corners share).
      const cells = v.map((k) => vcell[k] ?? null);
      const cell =
        cells[0] && (cells[0] === cells[1] || cells[0] === cells[2])
          ? cells[0]
          : (cells[1] ?? cells[0]);
      // Its tone from the block's own height (one per block: a sharp mosaic), on the wide ramp.
      const f = Math.min(1, (cell ? cell.t : hAvg) / ROCK_TOP);
      c.copy(
        f < 0.5
          ? ROCK_LOW.clone().lerp(ROCK_MID, f * 2)
          : ROCK_MID.clone().lerp(ROCK_HIGH, (f - 0.5) * 2),
      );
      if (cell) c.offsetHSL(0, 0, tone(cell));
    }
    for (const k of v) {
      P.push(gp.getX(k), (vh[k] as number) - 0.02, gp.getZ(k));
      N.push(gn.getX(k), gn.getY(k), gn.getZ(k));
      C.push(c.r, c.g, c.b);
    }
  }
  const terrain = new THREE.BufferGeometry();
  terrain.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  terrain.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  terrain.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  // The roads' own surfaces: exact edges, following their heights, just above the rock.
  const roadSurfaces: G[] = [];
  for (const r of [ramp, lane]) {
    const n = r.pts.length;
    const pp: number[] = [];
    const last = r.closed ? n : n - 1;
    const side = (i: number): [Pt, Pt] => {
      const p = r.pts[i % n] as Pt;
      const a = r.pts[r.closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as Pt;
      const b = r.pts[r.closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as Pt;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ox = (-(b[1] - a[1]) / l) * r.half;
      const oz = ((b[0] - a[0]) / l) * r.half;
      return [
        [p[0] + ox, p[1] + oz],
        [p[0] - ox, p[1] - oz],
      ];
    };
    for (let i = 0; i < last; i++) {
      const [l0, r0] = side(i);
      const [l1, r1] = side(i + 1);
      const y0 = (r.ys[i % n] as number) + 0.05;
      const y1 = (r.ys[(i + 1) % n] as number) + 0.05;
      // Each triangle wound to face up (a single-sided surface wound the other way is never drawn).
      const tri = (a: Pt, ya: number, b: Pt, yb: number, d: Pt, yd: number) => {
        const up = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]) < 0;
        if (up) pp.push(a[0], ya, a[1], b[0], yb, b[1], d[0], yd, d[1]);
        else pp.push(a[0], ya, a[1], d[0], yd, d[1], b[0], yb, b[1]);
      };
      tri(l0, y0, r0, y0, l1, y1);
      tri(r0, y0, r1, y1, l1, y1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pp, 3));
    g.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        new Array(pp.length).fill(0).map((_, k) => [ROAD.r, ROAD.g, ROAD.b][k % 3] as number),
        3,
      ),
    );
    g.computeVertexNormals();
    roadSurfaces.push(g);
  }

  // ── curbs: both edges of the ramp all the way up, and of the lane all round ──
  const curbs: [number, number, number, number][] = [];
  /** The ramp, stopping at the lane's edge (its last bit runs on into the lane's middle). */
  const rampOutside = rampPts.filter((p) => nearest(lanePts, p[0], p[1], true).d > lane.half + 0.2);
  const edge = (r: QilaRoad, skip: (x: number, z: number) => boolean) => {
    const n = r.pts.length;
    for (const sgn of [-1, 1]) {
      let prev: Pt | null = null;
      const last = r.closed ? n : n - 1;
      for (let i = r.closed ? 0 : 1; i <= last; i++) {
        const p = r.pts[i % n] as Pt;
        const a = r.pts[(i - 1 + n) % n] as Pt;
        const b = r.pts[(i + 1) % n] as Pt;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const cx = p[0] + (-(b[1] - a[1]) / l) * sgn * (r.half + 0.5);
        const cz = p[1] + ((b[0] - a[0]) / l) * sgn * (r.half + 0.5);
        // (Never across the other road, where the ramp meets the lane: for the lane, only the
        // ramp up to the lane's edge counts, so the curb opposite the junction stays.)
        const other = r === ramp ? lane : ramp;
        const otherPts = r === ramp ? lane.pts : rampOutside;
        if (skip(cx, cz) || nearest(otherPts, cx, cz, other.closed).d < other.half + 0.8) {
          prev = null;
          continue;
        }
        if (prev && Math.hypot(cx - prev[0], cz - prev[1]) < 4)
          curbs.push([prev[0], prev[1], cx, cz]);
        prev = [cx, cz];
      }
    }
  };
  const footEnd = rampPts[0] as Pt;
  edge(ramp, (x, z) => Math.hypot(x - footEnd[0], z - footEnd[1]) < 6);
  edge(lane, () => false);

  // ── the buildings ──
  const parts: G[] = [];
  const lamps: Lamp[] = [];
  const solids: [number, number, number][] = [];
  const pull = (o: Pt[], k: number): Pt[] => {
    const cx = o.reduce((a, p) => a + p[0], 0) / o.length;
    const cz = o.reduce((a, p) => a + p[1], 0) / o.length;
    return o.map(([x, z]) => {
      const l = Math.hypot(x - cx, z - cz) || 1;
      return [x - ((x - cx) / l) * k, z - ((z - cz) / l) * k] as Pt;
    });
  };
  const wallPiece = (ax: number, az: number, bx: number, bz: number, y0: number, h: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = -Math.atan2(bz - az, bx - ax);
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    parts.push(
      at(rbox(len + 0.9, h, 1.2, GOLD, 0.06), mx, y0, mz, yaw),
      at(rbox(len + 1, 0.2, 1.3, GOLD_D, 0.03), mx, y0 + h * 0.7, mz, yaw),
    );
    const n = Math.max(1, Math.floor(len / 1.3));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      parts.push(
        at(rbox(0.6, 0.5, 1.3, GOLD_D, 0.06), ax + (bx - ax) * t, y0 + h, az + (bz - az) * t, yaw),
      );
    }
  };
  const bastion = (x: number, y: number, z: number, r: number, h: number) => {
    parts.push(
      at(drum(r * 1.12, h * 0.3, mix(GOLD, GOLD_D, 0.4), 0.08, 14), x, y, z),
      at(drum(r, h, GOLD, 0.1, 14), x, y, z),
      at(drum(r + 0.1, 0.22, GOLD_D, 0.04, 14), x, y + h * 0.6, z),
      at(drum(r + 0.2, 0.28, GOLD_D, 0.05, 14), x, y + h, z),
    );
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      parts.push(
        at(
          rbox(0.5, 0.5, 0.4, GOLD_D, 0.05),
          x + Math.cos(a) * r,
          y + h + 0.28,
          z + Math.sin(a) * r,
          -a,
        ),
      );
    }
  };
  // The rim: a crenellated wall with close-set round bastions (the famous 99), open at the gate.
  const rim = resample(RIM, 3, true);
  /** Outward from a point on a wall line, `d` metres (to read the ground outside it). */
  const outward = (p: Pt, d: number): Pt => {
    const cx = T0.reduce((a, q) => a + q[0], 0) / T0.length;
    const cz = T0.reduce((a, q) => a + q[1], 0) / T0.length;
    const l = Math.hypot(p[0] - cx, p[1] - cz) || 1;
    return [p[0] + ((p[0] - cx) / l) * d, p[1] + ((p[1] - cz) / l) * d];
  };
  const gateAt = rim.reduce(
    (best, p, i) =>
      nearest(rampPts, p[0], p[1], false).d <
      nearest(rampPts, (rim[best] as Pt)[0], (rim[best] as Pt)[1], false).d
        ? i
        : best,
    0,
  );
  const gate = rim[gateAt] as Pt;
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i] as Pt;
    const b = rim[(i + 1) % rim.length] as Pt;
    if (
      Math.hypot(a[0] - gate[0], a[1] - gate[1]) < 5 ||
      Math.hypot(b[0] - gate[0], b[1] - gate[1]) < 5
    )
      continue;
    // A retaining wall: from the rock outside it up past the town's floor to its parapet.
    const y0 = Math.min(heightAt(...outward(a, 1.4)), heightAt(...outward(b, 1.4))) - 0.3;
    wallPiece(a[0], a[1], b[0], b[1], y0, QILA_TOP + 1.3 - y0);
    if (i % 3 === 0) {
      // The bastions stand on the rock outside and rise above the parapet.
      const y = heightAt(...outward(a, 2.6)) - 0.3;
      bastion(a[0], y, a[1], 1.5, QILA_TOP + 2.3 + (i % 2) * 0.4 - y);
      solids.push([a[0], a[1], 1.7]);
    }
  }
  // The gatehouse over the lane's mouth (Suraj Pol): two towers, an arched beam, kiosks.
  {
    const g = gate;
    const n = nearest(rampPts, g[0], g[1], false);
    const a = rampPts[n.i] as Pt;
    const b = rampPts[n.i + 1] as Pt;
    const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    const y = heightAt(g[0], g[1]) - 0.3;
    const across: Pt = [Math.sin(yaw), Math.cos(yaw)];
    for (const sd of [-1, 1]) {
      const tx = g[0] + across[0] * sd * 4;
      const tz = g[1] + across[1] * sd * 4;
      parts.push(
        at(drum(1.8, 7, GOLD, 0.1, 14), tx, y, tz),
        at(drum(2, 0.3, GOLD_D, 0.05, 14), tx, y + 7, tz),
        at(
          lathe(
            [
              [0, 0],
              [1.6, 0],
              [1.4, 0.6],
              [0.8, 1.3],
              [0, 1.6],
            ],
            GOLD_L,
            12,
          ),
          tx,
          y + 7.3,
          tz,
        ),
      );
      solids.push([tx, tz, 1.9]);
    }
    parts.push(
      at(rbox(8, 1.6, 2.4, GOLD, 0.08), g[0], y + 5, g[1], yaw + Math.PI / 2),
      at(rbox(8.4, 0.25, 2.8, GOLD_D, 0.04), g[0], y + 6.6, g[1], yaw + Math.PI / 2),
    );
    lamps.push({ x: g[0], y: y + 4, z: g[1], r: 6 });
  }
  // The lower wall round the foot (the ghagra), open where the ramp comes through: Akhai Pol.
  // It retains the terrace: from the sand up past the terrace to its parapet. Where the ramp
  // comes through, a short gate tower closes each end of the drop.
  const low = resample(LOW, 3, true);
  const open = low.map((p, i) => {
    const b = low[(i + 1) % low.length] as Pt;
    return nearest(rampPts, (p[0] + b[0]) / 2, (p[1] + b[1]) / 2, false).d < ramp.half + 3;
  });
  for (let i = 0; i < low.length; i++) {
    const a = low[i] as Pt;
    const b = low[(i + 1) % low.length] as Pt;
    if (open[i]) continue;
    wallPiece(a[0], a[1], b[0], b[1], -0.1, SKIRT + 1.0);
    // A gate tower at each end of the opening (Akhai Pol).
    const prevOpen = open[(i - 1 + low.length) % low.length];
    const nextOpen = open[(i + 1) % low.length];
    for (const [end, at2] of [
      [prevOpen, a],
      [nextOpen, b],
    ] as [boolean, Pt][])
      if (end) {
        parts.push(
          at(drum(1.4, 3.6, GOLD, 0.1, 14), at2[0], -0.1, at2[1]),
          at(drum(1.6, 0.28, GOLD_D, 0.05, 14), at2[0], 3.5, at2[1]),
          at(
            lathe(
              [
                [0, 0],
                [1.3, 0],
                [1.15, 0.5],
                [0.65, 1.05],
                [0, 1.3],
              ],
              GOLD_L,
              12,
            ),
            at2[0],
            3.78,
            at2[1],
          ),
        );
        solids.push([at2[0], at2[1], 1.5]);
        lamps.push({ x: at2[0], y: 2.6, z: at2[1], r: 4 });
      }
  }
  // Lamp posts up the ramp.
  for (let i = 6; i < rampPts.length - 4; i += 8) {
    const p = rampPts[i] as Pt;
    const q = rampPts[i + 1] as Pt;
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const x = p[0] + ((q[1] - p[1]) / l) * (ramp.half + 1.1);
    const z = p[1] - ((q[0] - p[0]) / l) * (ramp.half + 1.1);
    const y = rampYs[i] as number;
    parts.push(
      at(drum(0.1, 2.4, GOLD_D, 0.02, 8), x, y, z),
      at(rbox(0.45, 0.55, 0.45, GOLD_L, 0.08), x, y + 2.4, z),
      at(
        lathe(
          [
            [0, 0],
            [0.35, 0],
            [0, 0.35],
          ],
          GOLD_D,
          8,
        ),
        x,
        y + 2.95,
        z,
      ),
    );
    lamps.push({ x, y: y + 2.6, z, r: 4 });
  }
  // The palace (Raj Mahal) at the high end, on the lane's palace square: jharokhas, chhatris.
  const T = QILA_TOP;
  const palace: Pt = [24, -18];
  parts.push(
    at(rbox(20, 8, 7, GOLD, 0.12), palace[0], T, palace[1]),
    at(rbox(20.6, 0.35, 7.6, GOLD_D, 0.06), palace[0], T + 8, palace[1]),
  );
  for (let i = 0; i < 6; i++) {
    const x = palace[0] - 8 + i * 3.2;
    parts.push(
      at(rbox(2, 1.6, 1.1, GOLD_L, 0.1), x, T + 3.8, palace[1] + 4),
      at(
        lathe(
          [
            [0, 0],
            [1.05, 0],
            [0.9, 0.3],
            [0.45, 0.65],
            [0, 0.8],
          ],
          GOLD_D,
          10,
        ).scale(1, 1, 0.55),
        x,
        T + 5.4,
        palace[1] + 4,
      ),
      at(rbox(1.2, 0.9, 0.06, WOOD_D, 0.03), x, T + 4.1, palace[1] + 4.58),
    );
    parts.push(at(rbox(1.0, 1.8, 0.06, WOOD_D, 0.03), x, T, palace[1] + 3.53));
    lamps.push({ x, y: T + 4.4, z: palace[1] + 5, r: 3 });
  }
  for (const dx of [-8, 0, 8]) {
    const s = dx === 0 ? 1.1 : 0.85;
    parts.push(
      at(rbox(2 * s, 1.5 * s, 2 * s, GOLD, 0.06), palace[0] + dx, T + 8.35, palace[1] - 1),
      at(
        rbox(2.4 * s, 0.2, 2.4 * s, GOLD_D, 0.05),
        palace[0] + dx,
        T + 8.35 + 1.5 * s,
        palace[1] - 1,
      ),
      at(
        lathe(
          [
            [0, 0],
            [0.95, 0],
            [0.9, 0.4],
            [0.55, 0.85],
            [0.12, 1.1],
            [0, 1.25],
          ],
          GOLD_L,
          14,
        ).scale(s, s, s),
        palace[0] + dx,
        T + 8.55 + 1.5 * s,
        palace[1] - 1,
      ),
    );
  }
  for (const dx of [-9, -3, 3, 9]) solids.push([palace[0] + dx, palace[1], 3.4]);
  // The Jain temples: spires above the roofs, on their small square by the lane.
  const shikhara = (x: number, z: number, s: number) => {
    parts.push(
      at(rbox(4 * s, 1.2 * s, 4 * s, GOLD_L, 0.08), x, T, z),
      at(rbox(3.2 * s, 1.6 * s, 3.2 * s, GOLD, 0.08), x, T + 1.2 * s, z),
    );
    parts.push(
      at(
        lathe(
          [
            [0, 0],
            [1.5, 0],
            [1.45, 1],
            [1.25, 2.2],
            [0.95, 3.4],
            [0.6, 4.3],
            [0.25, 4.9],
            [0, 5.1],
          ],
          GOLD_L,
          8,
        ).scale(s, s, s),
        x,
        T + 2.8 * s,
        z,
      ),
    );
    for (const f of [0.35, 0.65])
      parts.push(
        at(
          drum(1.42 * s * (1 - f * 0.55), 0.18 * s, GOLD_D, 0.03, 8),
          x,
          T + (2.8 + f * 4.5) * s,
          z,
        ),
      );
    parts.push(
      at(drum(0.05 * s, 0.7 * s, BRASS, 0.01, 6), x, T + 7.9 * s, z),
      at(rbox(0.04, 0.35 * s, 0.5 * s, "#c8553d", 0.01), x, T + 8.25 * s, z + 0.25 * s),
    );
    solids.push([x, z, 2.2 * s]);
    lamps.push({ x, y: T + 1.5, z: z + 2.5 * s, r: 3 });
  };
  shikhara(-14, -15, 0.85);
  shikhara(-4, -17, 0.75);
  // The town: a honeycomb of flat-roofed golden houses packed up to the lane, facing it.
  const plateau = pull(T0, 7.5);
  const placed: Pt[] = [];
  const tries = rng(seed + 1);
  for (let k = 0; k < 2400 && placed.length < 110; k++) {
    const x = -46 + tries() * 92;
    const z = -20 + tries() * 40;
    if (!inside(plateau, x, z)) continue;
    const ln = nearest(lanePts, x, z, true);
    if (ln.d < lane.half + 2.4) continue;
    if (nearest(rampPts, x, z, false).d < ramp.half + 3) continue;
    if (Math.abs(x - palace[0]) < 12.5 && Math.abs(z - palace[1]) < 6) continue;
    if (Math.hypot(x + 9, z + 16) < 8) continue;
    if (placed.some(([px, pz]) => Math.abs(px - x) < 3.5 && Math.abs(pz - z) < 3.5)) continue;
    placed.push([x, z]);
    const a = lanePts[ln.i] as Pt;
    const yaw = Math.atan2(a[0] - x, a[1] - z);
    const h = 2.4 + tries() * 2.4;
    const cc = tries() < 0.25 ? GOLD_L : tries() < 0.5 ? mix(GOLD, GOLD_D, 0.4) : GOLD;
    const house: G[] = [
      at(rbox(3.2, h, 3.2, cc, 0.08), 0, 0, 0),
      at(rbox(3.4, 0.22, 3.4, GOLD_D, 0.04), 0, h, 0),
      at(rbox(0.8, 1.6, 0.06, WOOD_D, 0.03), -0.6, 0, 1.62),
    ];
    if (tries() < 0.4)
      house.push(
        at(rbox(1.5, 0.9, 0.6, cc, 0.06), 0.5, h - 1.5, 1.9),
        at(rbox(1.8, 0.1, 0.8, GOLD_D, 0.02), 0.5, h - 0.6, 1.9),
      );
    parts.push(...house.map((g) => at(g, x, T, z, yaw)));
    solids.push([x, z, 1.8]);
    if (tries() < 0.18) lamps.push({ x, y: T + h - 1, z, r: 3 });
  }
  return {
    heightAt,
    terrain,
    roadSurfaces,
    parts,
    lamps,
    ramp,
    lane,
    curbs,
    solids,
    foot: pull(T0, -6),
    bounds,
  };
}

/** All of it as one geometry (for a board, or as scenery): the terrain and the buildings. */
export function qilaGeometry(q: SonarQila): G {
  return join([q.terrain, ...q.roadSurfaces, ...q.parts]);
}
