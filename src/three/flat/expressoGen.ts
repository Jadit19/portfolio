/**
 * The flat Expresso world's layout and scatter (Coorg: coffee estate, shola
 * forest, meadow), generated on demand: a 490 × 350 m tile that loops. Roads,
 * the toy-train line and the stream run off one edge and back in at the
 * other; coffee follows the contour; rocks small to big; the bike activities
 * (ramps, a stream leap, a wheelie strip into a drift circle, the train, an
 * outcrop climb, stacks to knock over, lanterns, a kite, a hidden shrine);
 * bridges wherever a road or the railway meets water.
 *
 * Ported from the design board (design/3d/world-board.ts). Everything is
 * computed inside generate(), so importing this costs nothing.
 */

import * as THREE from "three";
import {
  type Anchor,
  type Biome,
  biomeAt,
  fbm,
  type Placement,
  type ScatterOptions,
  scatterSteps,
} from "../lib/biome";
import { GROUND, PASTEL as P } from "../lib/palette";
import { SAND } from "../lib/toys";
import { blob, footprint, type Pt, shapeDist, toy } from "./kit";

export const BASE = GROUND.expresso;
const TAU = Math.PI * 2;
void P;
void SAND;

/**
 * Builds the whole layout, a section at a time (it pauses between sections so
 * a build in the background never holds a frame for long).
 */
function* layout() {
  // ── the tile ─────────────────────────────────────────────────────────────

  const TW = 490;
  const TD = 350;
  const X0 = -TW / 2;
  const Z0 = -TD / 2;
  const BOUNDS: [number, number, number, number] = [X0, Z0, TW / 2, TD / 2];
  const inTile = (x: number, z: number) => Math.abs(x) < TW / 2 && Math.abs(z) < TD / 2;

  function rng(seed: number): () => number {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** A smooth line through control points, sampled about every metre. */
  function spline(ctrl: Pt[], closed = false): Pt[] {
    const c = new THREE.CatmullRomCurve3(
      ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      closed,
      "centripetal",
    );
    const n = Math.ceil(c.getLength());
    return c.getSpacedPoints(n).map((p) => [p.x, p.z] as Pt);
  }

  /**
   * A line that runs across the tile and meets itself across the seam. Its
   * sideways wander is a sum of smooth waves that each fit the tile a whole
   * number of times (so it joins up), with random phases and the shorter
   * waves weaker: big sweeps, plus bends you can see from the saddle. Lines
   * with the same seed share their waves, so a railway can follow a road's
   * big sweeps without its small bends.
   */
  function crossing(
    axis: "x" | "z",
    base: number,
    amp: number,
    seed: number,
    harmonics = [1, 2, 3, 5, 7],
  ): Pt[] {
    const r = rng(seed);
    const span = axis === "x" ? TW : TD;
    const start = axis === "x" ? X0 : Z0;
    const waves = harmonics.map((k) => ({
      k,
      a: (amp / k ** 0.9) * (0.6 + r() * 0.8),
      ph: r() * TAU,
    }));
    const off = (t: number) => waves.reduce((s, w) => s + w.a * Math.sin(w.k * TAU * t + w.ph), 0);
    const pts: Pt[] = [];
    for (let u = -span; u <= 2 * span; u += 1) {
      const t = u / span;
      const v = base + off(t);
      pts.push(axis === "x" ? [start + u, v] : [v, start + u]);
    }
    return pts;
  }

  /** A closed loop road: a wobbly ring. */
  function loop(cx: number, cz: number, rx: number, rz: number, seed: number): Pt[] {
    const r = rng(seed);
    const ctrl: Pt[] = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + (r() - 0.5) * 0.25;
      const k = 0.78 + r() * 0.4;
      ctrl.push([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]);
    }
    const s = spline(ctrl, true);
    return [...s, s[0] as Pt];
  }

  /** A short lane wandering from a point towards another. */
  function spur(from: Pt, to: Pt, seed: number, wobble = 9): Pt[] {
    const r = rng(seed);
    const ctrl: Pt[] = [from];
    const n = 4;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const nx = -(to[1] - from[1]);
      const nz = to[0] - from[0];
      const l = Math.hypot(nx, nz) || 1;
      const o = (r() - 0.5) * 2 * wobble;
      ctrl.push([
        from[0] + (to[0] - from[0]) * t + (nx / l) * o,
        from[1] + (to[1] - from[1]) * t + (nz / l) * o,
      ]);
    }
    ctrl.push(to);
    return spline(ctrl);
  }

  /** Nearest sample on a line to (x, z). */
  function nearest(pts: Pt[], x: number, z: number): { i: number; d: number } {
    let best = { i: 0, d: Number.POSITIVE_INFINITY };
    pts.forEach(([px, pz], i) => {
      const d = Math.hypot(px - x, pz - z);
      if (d < best.d) best = { i, d };
    });
    return best;
  }

  interface Spot {
    x: number;
    z: number;
    yaw: number;
    /** Height and nose-up pitch (jumps, wheelies). */
    y?: number;
    pitch?: number;
    /** Where the camera looks, if not at the rider. */
    look?: Pt;
  }

  /** A spot on a line, heading along it. */
  function onRoad(pts: Pt[], i: number): Spot {
    const a = pts[Math.max(0, i - 2)] as Pt;
    const b = pts[Math.min(pts.length - 1, i + 2)] as Pt;
    const [x, z] = pts[i] as Pt;
    return { x, z, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
  }

  /** A spot `off` m to one side of a line, facing it. */
  function beside(pts: Pt[], i: number, side: number, off = 7): Anchor {
    const { x, z, yaw } = onRoad(pts, i);
    const nx = Math.cos(yaw) * side;
    const nz = -Math.sin(yaw) * side;
    return { x: x + nx * off, z: z + nz * off, yaw: Math.atan2(-nx, -nz) };
  }

  interface Road {
    pts: Pt[];
    half: number;
  }

  const MAIN = crossing("x", 25, 34, 3);
  const CROSS = crossing("z", 70, 30, 8);
  const RING = loop(-125, -95, 70, 48, 5);
  const mainAt = (x: number) => MAIN[nearest(MAIN, x, 0).i] as Pt;
  const ringTop = RING[nearest(RING, -125, 0).i] as Pt;
  /** The cross road's point at a given z (in the tile). */
  const crossAt = (z: number) => {
    let best = CROSS[0] as Pt;
    for (const p of CROSS)
      if (inTile(p[0], p[1]) && Math.abs(p[1] - z) < Math.abs(best[1] - z)) best = p;
    return best;
  };
  // Lanes always run from one road to another (never a dead end, never a hairpin).
  const LANTERN_LANE = spur(mainAt(-30), crossAt(150), 22, 14);

  yield;
  // ── water ────────────────────────────────────────────────────────────────

  const pondAt = (x: number, off: number): Pt => {
    const [px, pz] = mainAt(x);
    return [px, pz + off];
  };
  const [P1X, P1Z] = pondAt(110, -30);
  const PONDS: Pt[][] = [
    blob(P1X, P1Z, 15, 9, 1.3),
    blob(-150, -92, 9, 6, 2.1),
    blob(-40, 120, 7, 5, 3.3),
  ];
  const pondShapeDist = (x: number, z: number) => Math.min(...PONDS.map((p) => shapeDist(p, x, z)));

  /** A stream that runs north–south right round the world. */
  const STREAM = crossing("z", 185, 14, 31, [1, 2, 3, 5]);
  const STREAM_HALF = 1.7;

  yield;
  // ── the toy train ────────────────────────────────────────────────────────

  /**
   * The railway shares the main road's big sweeps but not its small bends, a
   * little north of it: some stretches run close beside the road (race the
   * train), others drift away. It loops round the world like the roads.
   */
  const TRACK: Pt[] = (() => {
    for (const shift of [44, 48, 52, 40, 56, 60, 36]) {
      const t = crossing("x", 25 + shift, 34, 3, [1, 2, 3]);
      const ok = t.every(
        ([x, z]) =>
          !inTile(x, z) ||
          (pondShapeDist(x, z) > 12 &&
            nearest(RING, x, z).d > 12 &&
            nearest(MAIN, x, z).d > 9 &&
            nearest(LANTERN_LANE, x, z).d > 0),
      );
      if (ok) return t;
    }
    return crossing("x", 73, 34, 3, [1, 2, 3]);
  })();

  yield;
  // ── the stunt yard: a wheelie strip into a drift circle ──────────────────

  const stripFrom = onRoad(MAIN, nearest(MAIN, 10, 0).i);
  const STRIP_N: Pt = [Math.cos(stripFrom.yaw), -Math.sin(stripFrom.yaw)];
  const STRIP: Pt[] = [];
  for (let d = 0; d <= 58; d += 1)
    STRIP.push([stripFrom.x + STRIP_N[0] * d, stripFrom.z + STRIP_N[1] * d]);
  const DRIFT: [number, number, number] = [
    stripFrom.x + STRIP_N[0] * 70,
    stripFrom.z + STRIP_N[1] * 70,
    11,
  ];

  /**
   * The station: on a straight stretch of line in the tile, its platform on
   * the side facing a road 14–26 m away, with a short lane in from that road
   * (so it can be a stop). Away from the stream, the ponds and the edges.
   */
  const STATION = (() => {
    const lines = [MAIN, CROSS, RING];
    let best: { i: number; score: number; road: Pt; d: number; line: Pt[]; ri: number } | null =
      null;
    for (let i = TW + 12; i < 2 * TW - 12; i++) {
      const [x, z] = TRACK[i] as Pt;
      if (!inTile(x, z) || Math.abs(x) > TW / 2 - 45 || Math.abs(z) > TD / 2 - 35) continue;
      if (nearest(STREAM, x, z).d < 30 || pondShapeDist(x, z) < 20) continue;
      let road: Pt = [x, z];
      let d = Number.POSITIVE_INFINITY;
      let line = MAIN;
      let ri = 0;
      for (const l of lines) {
        const n = nearest(l, x, z);
        if (n.d < d) {
          d = n.d;
          road = l[n.i] as Pt;
          line = l;
          ri = n.i;
        }
      }
      if (d < 14 || d > 26) continue;
      // Straight: little turn over the platform's length either side.
      const a = TRACK[i - 10] as Pt;
      const b = TRACK[i + 10] as Pt;
      const bend = Math.abs(Math.atan2(b[0] - x, b[1] - z) - Math.atan2(x - a[0], z - a[1]));
      const score = bend + Math.abs(d - 18) * 0.02;
      if (!best || score < best.score) best = { i, score, road, d, line, ri };
    }
    const at = best ?? {
      i: TW + Math.round(TW / 2),
      road: mainAt(0),
      d: 20,
      line: MAIN,
      ri: nearest(MAIN, 0, 0).i,
    };
    const s = onRoad(TRACK, at.i);
    // The platform (local +x) faces the road.
    let yaw = s.yaw;
    const tx = at.road[0] - s.x;
    const tz = at.road[1] - s.z;
    if (Math.cos(yaw) * tx - Math.sin(yaw) * tz < 0) yaw += Math.PI;
    const side: Pt = [Math.cos(yaw), -Math.sin(yaw)];
    const door: Pt = [s.x + side[0] * 7.2, s.z + side[1] * 7.2];
    // A loop, not a dead end: in from the road to the platform, and back out
    // to the road a little further along.
    const back = at.line[Math.min(at.line.length - 1, at.ri + 26)] as Pt;
    const lane = [...spur(at.road, door, 41, 2), ...spur(door, back, 43, 2).slice(1)];
    return { x: s.x, z: s.z, yaw, i: at.i, door, lane };
  })();

  /**
   * No road ever dead-ends: a lane whose end isn't on another road carries
   * on, by a gentle bend, to the nearest other road in the tile (keeping out
   * of the ponds; the stream gets a bridge like any crossing).
   */
  function joinUp(pts: Pt[], others: Pt[][], seed: number): Pt[] {
    const end = pts[pts.length - 1] as Pt;
    if (others.some((o) => nearest(o, end[0], end[1]).d < 3)) return pts;
    const start = pts[0] as Pt;
    const cands: Pt[] = [];
    for (const o of others)
      for (let i = 0; i < o.length; i += 3) {
        const p = o[i] as Pt;
        if (!inTile(p[0], p[1]) || Math.abs(p[0]) > TW / 2 - 8 || Math.abs(p[1]) > TD / 2 - 8)
          continue;
        if (Math.hypot(p[0] - start[0], p[1] - start[1]) < 40) continue;
        cands.push(p);
      }
    cands.sort(
      (a, b) => Math.hypot(a[0] - end[0], a[1] - end[1]) - Math.hypot(b[0] - end[0], b[1] - end[1]),
    );
    for (const c of cands.slice(0, 60)) {
      const link = spur(end, c, seed, 5);
      if (link.every(([x, z]) => inTile(x, z) && pondShapeDist(x, z) > 6))
        return [...pts, ...link.slice(1)];
    }
    return pts;
  }
  const SOUTH_LANE: Pt[] = spur(mainAt(160), crossAt(-120), 23, 12);
  /** Out of the far side of the drift pad, back to the roads (the wheelie strip leads in). */
  const PAD_EXIT: Pt[] = (() => {
    const far: Pt = [DRIFT[0] + STRIP_N[0] * DRIFT[2], DRIFT[1] + STRIP_N[1] * DRIFT[2]];
    const on: Pt = [far[0] + STRIP_N[0] * 3, far[1] + STRIP_N[1] * 3];
    return joinUp([far, on], [MAIN, CROSS, RING, LANTERN_LANE, SOUTH_LANE], 63);
  })();

  const ROADS: Road[] = [
    { pts: MAIN, half: 2 },
    { pts: CROSS, half: 1.6 },
    { pts: RING, half: 1.4 },
    // The ring joins the main road; a lantern lane runs north; a lane runs south.
    { pts: spur(ringTop, mainAt(-140), 21), half: 1.4 },
    { pts: LANTERN_LANE, half: 1.1 },
    { pts: SOUTH_LANE, half: 1.1 },
    { pts: STRIP, half: 1.3 },
    { pts: PAD_EXIT, half: 1.3 },
    { pts: STATION.lane, half: 1.1 },
  ];

  yield;
  // ── what's clear (distance grids, baked once) ────────────────────────────

  const CELL = 1;
  const GW = Math.round(TW / CELL);
  const GD = Math.round(TD / CELL);
  const REACH = 14;
  const wrapI = (i: number, n: number) => ((i % n) + n) % n;

  /** Stamps each segment's distance (minus its half width) into a grid, with its heading. */
  function stamp(lines: Road[]): { dist: Float32Array; head: Float32Array } {
    const dist = new Float32Array(GW * GD).fill(REACH);
    const head = new Float32Array(GW * GD);
    for (const road of lines) {
      const pts = road.pts;
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, az] = pts[s] as Pt;
        const [bx, bz] = pts[s + 1] as Pt;
        // Only the tile matters (the grid wraps); skip the copies either side.
        if (!inTile(ax, az) && !inTile(bx, bz) && Math.abs(ax) > TW / 2 + REACH) continue;
        if (Math.abs(ax) > TW / 2 + REACH || Math.abs(az) > TD / 2 + REACH) continue;
        const dx = bx - ax;
        const dz = bz - az;
        const l2 = dx * dx + dz * dz || 1;
        const yaw = Math.atan2(dx, dz);
        const i0 = Math.floor((Math.min(ax, bx) - REACH - X0) / CELL);
        const i1 = Math.ceil((Math.max(ax, bx) + REACH - X0) / CELL);
        const j0 = Math.floor((Math.min(az, bz) - REACH - Z0) / CELL);
        const j1 = Math.ceil((Math.max(az, bz) + REACH - Z0) / CELL);
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const x = X0 + (i + 0.5) * CELL;
            const z = Z0 + (j + 0.5) * CELL;
            const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
            const d = Math.hypot(ax + dx * t - x, az + dz * t - z) - road.half;
            const k = wrapI(j, GD) * GW + wrapI(i, GW);
            if (d < (dist[k] as number)) {
              dist[k] = d;
              head[k] = yaw;
            }
          }
      }
    }
    return { dist, head };
  }
  const ROADGRID = stamp([...ROADS, { pts: TRACK, half: 1.3 }]);
  const WATERGRID = stamp([{ pts: STREAM, half: STREAM_HALF }]);
  const cellOf = (x: number, z: number) =>
    wrapI(Math.floor((z - Z0) / CELL), GD) * GW + wrapI(Math.floor((x - X0) / CELL), GW);
  const roadDist = (x: number, z: number) => ROADGRID.dist[cellOf(x, z)] as number;
  const waterDist = (x: number, z: number) =>
    Math.min(pondShapeDist(x, z), WATERGRID.dist[cellOf(x, z)] as number);
  const heading = (x: number, z: number) => ROADGRID.head[cellOf(x, z)] as number;

  /** Rock outcrops: set pieces, kept clear of the scatter. */
  const OUTCROPS: [number, number, number][] = [
    (() => {
      const a = beside(RING, 100, 1, 19);
      return [a.x, a.z, 9] as [number, number, number];
    })(),
    (() => {
      const a = beside(MAIN, nearest(MAIN, -200, 0).i, -1, 18);
      return [a.x, a.z, 8] as [number, number, number];
    })(),
  ];

  /** Set pieces placed by hand (activities); the scatter keeps clear of them. */
  const KEEP: [number, number, number][] = [];

  function clear(x: number, z: number): number {
    let d = Math.min(roadDist(x, z), waterDist(x, z) - 1.5);
    for (const [ox, oz, r] of [...OUTCROPS, ...KEEP, DRIFT])
      d = Math.min(d, Math.hypot(x - ox, z - oz) - r);
    return d;
  }

  yield;
  // ── biomes ───────────────────────────────────────────────────────────────

  const leafy = (id: string, w = 1) =>
    ["mint", "pistachio", "fern"].map((tint) => ({ id, tint, weight: w / 3 }));
  const blooms = (id: string, names = ["rose", "marigold", "lavender"]) =>
    names.map((tint) => ({ id, tint }));
  /** Small stones everywhere: pebbles, shards and little faceted rocks. */
  const STONES = [
    { id: "R2", weight: 2, scale: [0.7, 1.1] as [number, number] },
    { id: "R5", weight: 1, scale: [0.6, 1] as [number, number] },
    { id: "R1", weight: 1.5, scale: [0.45, 0.8] as [number, number] },
  ];

  const EXPRESSO: Biome[] = [
    {
      id: "Coffee estate",
      climate: [0.6, 0.65],
      layers: {
        planted: {
          species: [{ id: "B2", scale: [0.75, 0.95] }],
          density: 0.8,
          rows: [1.7, 2.8, 0.45],
          natural: { amp: 2.6, length: 30, jitter: 0.32, gaps: 0.3 },
          keep: 2.2,
        },
        canopy: {
          species: [
            { id: "T3", tint: "fern" },
            { id: "T3", tint: "pistachio" },
          ],
          density: 0.06,
          keep: 3,
        },
        accent: { species: STONES, density: 0.04, pair: 0.4, keep: 1 },
      },
      hamlet: {
        buildings: [{ id: "H5" }, { id: "H1" }],
        props: [{ id: "C1" }, { id: "S6" }, { id: "S2" }],
      },
    },
    {
      id: "Shola forest",
      climate: [0.3, 0.75],
      layers: {
        landmark: {
          species: [
            { id: "T9", scale: [1.2, 1.35] },
            { id: "R4", scale: [2.2, 3] },
          ],
          density: 0.35,
          keep: 4,
        },
        canopy: {
          species: [...leafy("T1", 3), ...leafy("T2", 1.5), ...leafy("T7", 1)],
          density: 0.6,
          clump: 0.75,
          grove: 14,
          keep: 2.6,
        },
        under: {
          species: [...leafy("B1", 2), { id: "B5" }],
          density: 0.12,
          nearTrees: [3.5, 2],
          verge: [2.5, 1.8],
          keep: 1,
        },
        cover: { species: blooms("B9"), density: 0.06, patch: [4, 7, 2.4], keep: 0.6 },
        accent: {
          species: [...STONES, { id: "R1", weight: 1, scale: [1.6, 2.6] }],
          density: 0.09,
          pair: 0.6,
          keep: 1,
        },
      },
    },
    {
      id: "Meadow",
      climate: [0.7, 0.25],
      layers: {
        landmark: {
          species: [
            { id: "R4", scale: [2.4, 3.4] },
            { id: "R1", scale: [2.6, 3.6] },
          ],
          density: 0.16,
          keep: 3,
        },
        canopy: { species: [...leafy("T5")], density: 0.035, keep: 3 },
        under: { species: [{ id: "B3" }, { id: "B5" }], density: 0.05, verge: [2, 2.5], keep: 1 },
        cover: {
          species: [{ id: "B8", weight: 2 }, ...blooms("B9", ["marigold", "rose"])],
          density: 0.28,
          patch: [3, 6, 2],
          keep: 0.5,
        },
        accent: { species: STONES, density: 0.12, pair: 0.6, keep: 1 },
      },
    },
  ];

  /** Where the cross road meets the main road. */
  const CROSSING: Pt = (() => {
    let best: [Pt, number] = [[0, 0], Number.POSITIVE_INFINITY];
    for (const p of CROSS) {
      if (!inTile(p[0], p[1])) continue;
      const d = nearest(MAIN, p[0], p[1]).d;
      if (d < best[1]) best = [p, d];
    }
    return best[0];
  })();
  const mi = nearest(MAIN, CROSSING[0], CROSSING[1]).i;
  const ci = nearest(CROSS, CROSSING[0], CROSSING[1]).i;
  const ANCHORS: Anchor[] = [
    beside(MAIN, mi - 14, 1),
    beside(MAIN, mi + 14, 1),
    beside(MAIN, mi - 14, -1),
    beside(MAIN, mi + 16, -1),
    beside(CROSS, ci + 16, 1),
    beside(CROSS, ci - 16, -1),
    beside(RING, 30, 1),
    beside(RING, 170, -1),
    beside(MAIN, nearest(MAIN, -200, 0).i, 1),
    beside(MAIN, nearest(MAIN, 200, 0).i, -1),
  ];

  /** Biome lookups before the scatter runs (only the climate fields matter). */
  const CLIMATE: ScatterOptions = {
    biomes: EXPRESSO,
    bounds: BOUNDS,
    seed: 11,
    wrap: true,
    region: 60,
    clear: () => 9,
    footprint,
  };

  /** The road sample (in the tile) whose surroundings are most of one biome. */
  function mostly(biome: string, roads: Road[] = ROADS.slice(0, 6)): { road: Road; i: number } {
    let best: [Road, number, number] = [ROADS[0] as Road, 0, -1];
    for (const road of roads)
      for (let i = 4; i < road.pts.length - 4; i += 6) {
        const [x, z] = road.pts[i] as Pt;
        if (!inTile(x, z) || Math.abs(x) > TW / 2 - 30 || Math.abs(z) > TD / 2 - 30) continue;
        let n = 0;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * TAU;
          if (biomeAt(CLIMATE, x + Math.cos(a) * 18, z + Math.sin(a) * 12).id === biome) n++;
        }
        if (n > best[2]) best = [road, i, n];
      }
    return { road: best[0], i: best[1] };
  }

  yield;
  // ── the activities ───────────────────────────────────────────────────────

  type Piece = Placement & { y?: number };
  const SET: Piece[] = [];
  function put(id: string, x: number, z: number, yaw: number, scale = 1, y = 0, keep = 0): void {
    SET.push({ id, x, z, yaw, scale, y, biome: "set", layer: "accent" });
    if (keep) KEEP.push([x, z, keep]);
  }

  /** Ramps on the verge, running along the road: swerve off and launch. */
  const RAMPS = [
    { road: MAIN, i: nearest(MAIN, -100, 0).i, side: 1, half: 2, id: "ramp" },
    { road: RING, i: 60, side: -1, half: 1.4, id: "ramp" },
    { road: CROSS, i: ci + 70, side: 1, half: 1.6, id: "kicker" },
  ].map((r) => {
    const a = beside(r.road, r.i, r.side, r.half + 3.4);
    const s = onRoad(r.road, r.i);
    put(r.id, a.x, a.z, s.yaw, 1, 0, 3);
    return { ...a, yaw: s.yaw, road: r.road, i: r.i };
  });

  yield;
  /** The stream leap: a take-off ramp on one bank, a landing ramp on the other, well away from roads. */
  const LEAP = (() => {
    // The quietest stretch of the stream in the tile: as far from roads and ponds as it gets.
    const mid = Math.floor(STREAM.length / 2);
    for (let k = 0; k < TD; k++) {
      const i = mid + (k % 2 ? k : -k);
      const [x, z] = STREAM[i] as Pt;
      if (
        !inTile(x, z) ||
        Math.abs(z) > TD / 2 - 20 ||
        roadDist(x, z) < REACH - 0.5 ||
        pondShapeDist(x, z) < 20
      )
        continue;
      const s = onRoad(STREAM, i);
      const n: Pt = [Math.cos(s.yaw), -Math.sin(s.yaw)];
      const off = STREAM_HALF + 2.1;
      const across = Math.atan2(n[0], n[1]);
      put("ramp", x - n[0] * off, z - n[1] * off, across, 1, 0, 3);
      put("ramp", x + n[0] * off, z + n[1] * off, across + Math.PI, 1, 0, 3);
      return { x, z, across, n };
    }
    return { x: 0, z: 0, across: 0, n: [1, 0] as Pt };
  })();

  /** Bollards down both sides of the wheelie strip, and tyre marks in the drift circle. */
  for (let d = 6; d <= 56; d += 8)
    for (const side of [-1, 1]) {
      const k = (d / 8) % 2 ? "bollardCoral" : "bollardCream";
      const sx = stripFrom.x + STRIP_N[0] * d;
      const sz = stripFrom.z + STRIP_N[1] * d;
      // Sideways to the strip is along the main road's heading.
      put(
        k,
        sx + Math.sin(stripFrom.yaw) * side * 2.2,
        sz + Math.cos(stripFrom.yaw) * side * 2.2,
        0,
      );
    }

  /** Stacks to knock over: matkas by the village, hay bales by the estate. */
  const POTS = (() => {
    const a = beside(MAIN, mi + 34, -1, 2 + 4);
    put("potStack", a.x, a.z, a.yaw, 1, 0, 2);
    return a;
  })();
  (() => {
    const a = beside(MAIN, nearest(MAIN, -160, 0).i, 1, 2 + 4);
    put("hayBales", a.x, a.z, a.yaw, 1, 0, 2.5);
  })();

  /** Lanterns along the lane to the north: ride past to light them. */
  const LANTERNS: Anchor[] = [];
  for (let i = 14, k = 0; i < LANTERN_LANE.length - 6; i += 13, k++) {
    const a = beside(LANTERN_LANE, i, k % 2 ? 1 : -1, 1.1 + 1.1);
    LANTERNS.push(a);
    put("lantern", a.x, a.z, a.yaw + Math.PI / 2, 1, 0, 0.8);
  }

  yield;
  /** A hidden shrine, tucked into the forest a little way off the road. */
  const SHRINE = (() => {
    const { road, i } = mostly("Shola forest");
    const a = beside(road.pts, i, 1, road.half + 8);
    put("shrine", a.x, a.z, a.yaw, 1, 0, 2.2);
    return { road, i, a };
  })();

  /** A kite cut loose, drifting over the meadow. */
  const KITE = (() => {
    const { road, i } = mostly("Meadow");
    const s = onRoad(road.pts, i + 6);
    const kx = s.x + Math.sin(s.yaw) * 9 + Math.cos(s.yaw) * 5;
    const kz = s.z + Math.cos(s.yaw) * 9 - Math.sin(s.yaw) * 5;
    // Facing the camera's side, tilted back into the wind.
    put("kite", kx, kz, Math.PI / 4 + 0.35, 1.5, 4.5);
    return { road, i };
  })();

  yield;
  /** Distance along the line at each sample (the samples are 1 m apart in x, more on slants). */
  const TRACK_S: number[] = [0];
  for (let i = 1; i < TRACK.length; i++) {
    const [ax, az] = TRACK[i - 1] as Pt;
    const [bx, bz] = TRACK[i] as Pt;
    TRACK_S.push((TRACK_S[i - 1] as number) + Math.hypot(bx - ax, bz - az));
  }
  /** The point and heading `d` metres along the line. */
  function alongTrack(d: number): Spot {
    let lo = 0;
    let hi = TRACK.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((TRACK_S[mid] as number) < d) lo = mid;
      else hi = mid;
    }
    const t =
      (d - (TRACK_S[lo] as number)) / ((TRACK_S[hi] as number) - (TRACK_S[lo] as number) || 1);
    const [ax, az] = TRACK[lo] as Pt;
    const [bx, bz] = TRACK[hi] as Pt;
    return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw: Math.atan2(bx - ax, bz - az) };
  }

  yield;
  // The station keeps its ground clear (the platform, the shelter, the boards).
  KEEP.push([STATION.x + Math.cos(STATION.yaw) * 2.6, STATION.z - Math.sin(STATION.yaw) * 2.6, 12]);

  yield;
  /**
   * The stops are places: a site for each of Expresso's eight landmarks. Each
   * stands beside a road (facing it, a forecourt between), its whole
   * footprint clear of roads, the railway, water and the set pieces, away
   * from junctions, and the eight spread as far apart as they'll go. The rope
   * bridge goes where a road runs close by the stream (with no crossing near),
   * spanning it, its near bank towards the road.
   */
  const SITE_HALF: Record<string, [number, number]> = {
    roastery: [3.6, 2.2],
    darshini: [2.2, 1.6],
    post: [2.8, 1.9],
    weighing: [2.4, 1.8],
    well: [2.2, 1.4],
    pavilion: [2.4, 2.6],
    pepper: [2.6, 1.8],
  };
  /** The rope bridge's half span (its towers stand this far out from the stream's middle). */
  const BRIDGE_END = 4.5;
  interface Site {
    key: string;
    x: number;
    z: number;
    yaw: number;
    /** The road it's beside, and the sample there. */
    road: Pt[];
    i: number;
  }
  const SITES: Site[] = [];
  const siteRoads = ROADS.filter(
    (r) => r.pts !== STRIP && r.pts !== PAD_EXIT && r.pts !== STATION.lane,
  );
  const taken = (x: number, z: number) => {
    let d = Math.hypot(x - STATION.x, z - STATION.z);
    for (const t of SITES) d = Math.min(d, Math.hypot(x - t.x, z - t.z));
    return d;
  };
  const inKeep = (x: number, z: number) =>
    [...OUTCROPS, ...KEEP, DRIFT].some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r);
  const inside = (x: number, z: number) => Math.abs(x) < TW / 2 - 26 && Math.abs(z) < TD / 2 - 26;
  /** Not near any other road than `own` (no junctions by a stop). */
  const lonely = (own: Pt[], x: number, z: number) =>
    siteRoads.every((r) => r.pts === own || nearest(r.pts, x, z).d > 14);
  // The rope bridge (nexus): along the stream, where a road passes 9–18 m from
  // its middle (close enough to pull in, far enough from the road's own bridge).
  {
    let best: (Site & { score: number }) | null = null;
    const lines = [...siteRoads.map((q) => q.pts), TRACK];
    for (let k = 0; k < STREAM.length; k += 2) {
      const [sx, sz] = STREAM[k] as Pt;
      if (!inside(sx, sz)) continue;
      let road: Pt[] | null = null;
      let ri = 0;
      let d = Number.POSITIVE_INFINITY;
      for (const pts of lines) {
        const n = nearest(pts, sx, sz);
        if (n.d < d) {
          d = n.d;
          road = pts;
          ri = n.i;
        }
      }
      if (!road || road === TRACK || d < 9 || d > 18) continue;
      // Clear of the set pieces (the stream leap's ramps, the outcrops, the drift pad).
      if (
        [...OUTCROPS, ...KEEP, DRIFT].some(([ox, oz, r]) => Math.hypot(sx - ox, sz - oz) < r + 12)
      )
        continue;
      const [rx, rz] = road[ri] as Pt;
      let yaw = onRoad(STREAM, k).yaw;
      // Its near end (local −x) towards the road.
      if (Math.cos(yaw) * (rx - sx) - Math.sin(yaw) * (rz - sz) > 0) yaw += Math.PI;
      // Prefer the middle of that band (about 13 m off), then spread from the rest.
      const score = taken(sx, sz) - Math.abs(d - 13) * 3;
      if (!best || score > best.score)
        best = { key: "bridge", x: sx, z: sz, yaw, road, i: ri, score };
    }
    if (best) {
      SITES.push({
        key: best.key,
        x: best.x,
        z: best.z,
        yaw: best.yaw,
        road: best.road,
        i: best.i,
      });
      for (const e of [-1, 1])
        KEEP.push([
          best.x + Math.cos(best.yaw) * e * BRIDGE_END,
          best.z - Math.sin(best.yaw) * e * BRIDGE_END,
          2.6,
        ]);
    }
  }
  yield;
  for (const key of ["roastery", "darshini", "post", "weighing", "well", "pavilion", "pepper"]) {
    const [hx, hz] = SITE_HALF[key] as [number, number];
    let best: (Site & { score: number }) | null = null;
    for (const r of siteRoads)
      for (let i = 0; i < r.pts.length; i += 5)
        for (const side of [1, -1]) {
          const [rx, rz] = r.pts[i] as Pt;
          if (!inside(rx, rz)) continue;
          const a = beside(r.pts, i, side, r.half + 2.2 + hz);
          const score = taken(a.x, a.z);
          if (score < 40 || (best && score <= best.score)) continue;
          if (!lonely(r.pts, rx, rz)) continue;
          // Every corner and edge of the footprint (and its forecourt) clear.
          const c = Math.cos(a.yaw);
          const sn = Math.sin(a.yaw);
          let ok = true;
          for (const u of [-hx, 0, hx])
            for (const v of [-hz, 0, hz, hz + 1.2]) {
              const px = a.x + c * u + sn * v;
              const pz = a.z - sn * u + c * v;
              if (
                (v <= hz && roadDist(px, pz) < 0.9) ||
                waterDist(px, pz) < 2.5 ||
                inKeep(px, pz)
              ) {
                ok = false;
                break;
              }
            }
          if (ok) best = { key, x: a.x, z: a.z, yaw: a.yaw, road: r.pts, i, score };
        }
    if (best) {
      SITES.push({
        key: best.key,
        x: best.x,
        z: best.z,
        yaw: best.yaw,
        road: best.road,
        i: best.i,
      });
      KEEP.push([best.x, best.z, Math.hypot(hx, hz) + 1.2]);
    }
    yield;
  }

  yield;
  /**
   * Bridges: no road or railway ever runs across water. Where one meets the
   * stream it stops at the bank and a humped bridge carries it over.
   */
  interface Bridge {
    x: number;
    z: number;
    yaw: number;
    len: number;
    width: number;
    railway: boolean;
  }
  const BRIDGES: Bridge[] = [];
  /**
   * Straightens a line around sample `i` (a bridge `len` long there): points
   * within the span (and a metre and a half beyond) move onto one straight
   * axis; further out they blend back to where they were, over ~8 m.
   */
  function straighten(pts: Pt[], i: number, len: number): void {
    const m = Math.ceil(len / 2 + 9);
    const a = pts[Math.max(0, i - m)] as Pt;
    const b = pts[Math.min(pts.length - 1, i + m)] as Pt;
    const c = [...(pts[i] as Pt)] as Pt;
    let dx = b[0] - a[0];
    let dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const flat = len / 2 + 1.5;
    const ease = Math.max(1, m - flat);
    for (let k = -m; k <= m; k++) {
      const j = i + k;
      const p = pts[j];
      if (!p) continue;
      const t = (p[0] - c[0]) * dx + (p[1] - c[1]) * dz;
      const wgt = Math.abs(t) <= flat ? 1 : Math.max(0, 1 - (Math.abs(t) - flat) / ease);
      const s = wgt * wgt * (3 - 2 * wgt);
      pts[j] = [p[0] + (c[0] + dx * t - p[0]) * s, p[1] + (c[1] + dz * t - p[1]) * s];
    }
  }
  for (const road of [...ROADS, { pts: TRACK, half: 1.3 }]) {
    const railway = road.pts === TRACK;
    const done: Pt[] = [];
    STREAM.forEach(([sx, sz], si) => {
      const near = nearest(road.pts, sx, sz);
      if (near.d > 0.8 || done.some(([x, z]) => Math.hypot(x - sx, z - sz) < 12)) return;
      done.push([sx, sz]);
      const w = onRoad(STREAM, si);
      // Crossing at a slant needs a longer span.
      const slant0 = Math.max(0.4, Math.abs(Math.sin(onRoad(road.pts, near.i).yaw - w.yaw)));
      // The road runs dead straight over the bridge (and eases back into its
      // curves either side), so bridge and road share one axis.
      straighten(road.pts, near.i, (2 * (STREAM_HALF + 1)) / slant0 + 1.8);
      const r = onRoad(road.pts, near.i);
      const slant = Math.max(0.4, Math.abs(Math.sin(r.yaw - w.yaw)));
      // Kept in tile coordinates, once each (the copies are drawn round it).
      const x = X0 + ((((r.x - X0) % TW) + TW) % TW);
      const z = Z0 + ((((r.z - Z0) % TD) + TD) % TD);
      if (BRIDGES.some((b) => Math.hypot(b.x - x, b.z - z) < 3)) return;
      BRIDGES.push({
        x,
        z,
        yaw: r.yaw,
        len: (2 * (STREAM_HALF + 1)) / slant + 1.8,
        width: road.half * 2 + 0.7,
        railway,
      });
    });
  }
  // (The line was straightened at its bridges: measure it again.)
  TRACK_S.length = 1;
  for (let i = 1; i < TRACK.length; i++) {
    const [ax, az] = TRACK[i - 1] as Pt;
    const [bx, bz] = TRACK[i] as Pt;
    TRACK_S.push((TRACK_S[i - 1] as number) + Math.hypot(bx - ax, bz - az));
  }
  /** Is (x, z) on a bridge's span (so the road or rail under it is cut)? */
  const onBridge = (x0: number, z0: number, margin = 0.4) =>
    BRIDGES.some((b) => {
      // Measured the short way round the looping world.
      let dx = x0 - b.x;
      let dz = z0 - b.z;
      dx -= Math.round(dx / TW) * TW;
      dz -= Math.round(dz / TD) * TD;
      const along = dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw);
      const across = dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw);
      return Math.abs(along) < b.len / 2 - margin && Math.abs(across) < b.width;
    });
  /** A line split into its dry runs (the bits between bridges). */
  function dry(pts: Pt[]): Pt[][] {
    const runs: Pt[][] = [];
    let cur: Pt[] = [];
    for (const p of pts) {
      if (onBridge(p[0], p[1])) {
        if (cur.length > 1) runs.push(cur);
        cur = [];
      } else cur.push(p);
    }
    if (cur.length > 1) runs.push(cur);
    return runs;
  }

  yield;
  /** Sleepers every 0.9 m along the line (not on the bridges, which have their own deck). */
  for (let d = 0; d < (TRACK_S[TRACK_S.length - 1] as number); d += 0.9) {
    const p = alongTrack(d);
    if (!inTile(p.x, p.z) || onBridge(p.x, p.z, -0.6)) continue;
    // The sleeper's 2 m length runs across the line once turned to its heading.
    put("sleeper", p.x, p.z, p.yaw);
  }

  yield;
  // ── the scatter ──────────────────────────────────────────────────────────

  const OPTS: ScatterOptions = { ...CLIMATE, clear, heading, anchors: ANCHORS };
  const PLACED: Placement[] = yield* scatterSteps(OPTS);

  /** Lotus and reeds in the ponds; rock outcrops (with a ramp and a flag on the big one). */
  const EXTRA: Piece[] = (() => {
    const r = rng(4);
    const out: Piece[] = [];
    const add = (id: string, x: number, z: number, scale: number, yaw = r() * TAU, y = 0) =>
      out.push({ id, x, z, yaw, scale, y, biome: "set", layer: "accent" });
    PONDS.forEach((pond, k) => {
      const [cx, cz] = pond.reduce(
        ([a, b], [x, z]) => [a + x / pond.length, b + z / pond.length],
        [0, 0],
      );
      const placed: Pt[] = [];
      for (let i = 0; i < 900 && placed.length < 40; i++) {
        const x = cx - 20 + r() * 40;
        const z = cz - 14 + r() * 28;
        const d = shapeDist(pond, x, z);
        // Lotus in the shallows; reeds on the shore, only on the far sides.
        const isLotus = d > -2.6 && d < -0.7;
        const isReed = d > 0 && d < 1.4 && Math.sin(Math.atan2(z - cz, x - cx) * 2 + k) > 0.2;
        if (!isLotus && !isReed) continue;
        if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.1)) continue;
        placed.push([x, z]);
        add(isLotus ? "lotus" : "reeds", x, z, 0.9 + r() * 0.4);
      }
      if (k === 0) add("boat", cx + 2, cz, 1.6, 0.4);
    });
    // Reeds in clumps along the stream banks.
    for (let i = 0; i < STREAM.length; i += 9) {
      const [x, z] = STREAM[i] as Pt;
      if (!inTile(x, z) || roadDist(x, z) < 4 || r() < 0.5) continue;
      const side = r() < 0.5 ? -1 : 1;
      const a = beside(STREAM, i, side, STREAM_HALF + 0.5);
      add("reeds", a.x, a.z, 0.9 + r() * 0.4);
    }
    OUTCROPS.forEach(([ox, oz, rad], k) => {
      // A heap of big rocks, mid ones round it, a skirt of stones.
      for (let i = 0; i < 5; i++) {
        const a = r() * TAU;
        const d = i === 0 ? 0 : rad * (0.15 + r() * 0.25);
        add(
          i % 2 ? "R4" : "R1",
          ox + Math.cos(a) * d,
          oz + Math.sin(a) * d,
          i === 0 ? 4.6 : 3 + r() * 1.6,
        );
      }
      for (let i = 0; i < 9; i++) {
        const a = r() * TAU;
        const d = rad * (0.6 + r() * 0.3);
        add(i % 3 ? "R1" : "R5", ox + Math.cos(a) * d, oz + Math.sin(a) * d, 1.1 + r() * 0.9);
      }
      for (let i = 0; i < 18; i++) {
        const a = r() * TAU;
        const d = rad * (0.9 + r() * 0.5);
        add(i % 2 ? "R2" : "R5", ox + Math.cos(a) * d, oz + Math.sin(a) * d, 0.5 + r() * 0.5);
      }
      if (k === 0) {
        // The climb: a big ramp up to the summit rock, and a flag on top.
        const top = ((toy("R1").boundingBox as THREE.Box3).max.y || 1) * 4.6;
        add("flag", ox, oz, 1.4, 0.3, top * 0.9);
      }
    });
    return out;
  })();
  const CLIMB = (() => {
    const [ox, oz, rad] = OUTCROPS[0] as [number, number, number];
    const s = onRoad(RING, 100);
    const dx = s.x - ox;
    const dz = s.z - oz;
    const l = Math.hypot(dx, dz) || 1;
    const x = ox + (dx / l) * rad * 0.62;
    const z = oz + (dz / l) * rad * 0.62;
    const yaw = Math.atan2(-dx, -dz);
    EXTRA.push({ id: "ramp", x, z, yaw, scale: 1.7, y: 0, biome: "set", layer: "accent" });
    return { x, z, yaw };
  })();

  yield;
  // ── grass, where grass grows ─────────────────────────────────────────────

  /**
   * How likely a tuft is at (x, z): thick on pond and stream banks, a band
   * along road verges, in drifts across meadows, thin under the forest, almost
   * none in the weeded coffee; never on a road, the railway or in water.
   */
  function grassChance(x: number, z: number): number {
    const road = roadDist(x, z);
    const water = waterDist(x, z);
    if (road < 0.3 || water < 0.2 || Math.hypot(x - DRIFT[0], z - DRIFT[1]) < DRIFT[2]) return 0;
    const drift = fbm(((x - X0) / TW) * 24, ((z - Z0) / TD) * 17, 71, 24, 17);
    const b = biomeAt(OPTS, x, z).id;
    let p = b === "Meadow" ? 0.3 * (drift > 0.45 ? 1.6 : 0.4) : b === "Shola forest" ? 0.08 : 0.015;
    if (water < 4) p = Math.max(p, 0.85 * (1 - water / 4));
    if (road < 2.5) p = Math.max(p, b === "Coffee estate" ? 0.2 : 0.4);
    return p;
  }

  const TUFTS: [number, number, number, number][] = [];
  {
    const r = rng(77);
    let row = 0;
    for (let z = Z0; z < Z0 + TD; z += 1.1) {
      for (let x = X0; x < X0 + TW; x += 1.1) {
        const px = x + r() * 1.1;
        const pz = z + r() * 1.1;
        if (r() < grassChance(px, pz)) TUFTS.push([px, pz, 0.7 + r() * 0.6, r() < 0.5 ? 0 : 1]);
      }
      // A pause every few rows (this is the slowest part of the layout).
      if (++row % 8 === 0) yield;
    }
  }

  function tuftGeometry(): THREE.BufferGeometry {
    const blade = new THREE.ConeGeometry(0.035, 0.32, 3);
    blade.translate(0, 0.16, 0);
    const pos: number[] = [];
    for (const [a, t] of [
      [0, 0],
      [2.1, 0.35],
      [4.2, -0.35],
    ] as const) {
      const b = blade.clone();
      b.rotateZ(t);
      b.rotateY(a);
      pos.push(...(b.toNonIndexed().attributes.position as THREE.BufferAttribute).array);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  return {
    TW,
    TD,
    X0,
    Z0,
    BOUNDS,
    inTile,
    ROADS,
    MAIN,
    CROSS,
    RING,
    LANTERN_LANE,
    PONDS,
    pondShapeDist,
    STREAM,
    STREAM_HALF,
    TRACK,
    STRIP,
    DRIFT,
    OUTCROPS,
    BRIDGES,
    onBridge,
    dry,
    PLACED,
    EXTRA,
    SET,
    TUFTS,
    LANTERNS,
    ANCHORS,
    CROSSING,
    roadDist,
    waterDist,
    heading,
    onRoad,
    nearest,
    beside,
    mostly,
    OPTS,
    P1X,
    P1Z,
    SHRINE,
    STATION,
    SITES,
    TRACK_S,
    LEAP,
    RAMPS,
    CLIMB,
    POTS,
    KITE,
    tuftGeometry,
  };
}

export type ExpressoLayout = LayoutOf<ReturnType<typeof layout>>;
type LayoutOf<G> = G extends Generator<unknown, infer R, unknown> ? R : never;

/** The layout is the same every time: work it out once, then reuse it. */
let cached: ExpressoLayout | null = null;

/** The layout, worked out in steps (yields between sections; instant once cached). */
export function* generateSteps(): Generator<unknown, ExpressoLayout, unknown> {
  if (!cached) cached = yield* layout();
  return cached;
}

/** The layout, all at once. */
export function generate(): ExpressoLayout {
  const g = generateSteps();
  for (;;) {
    const n = g.next();
    if (n.done) return n.value;
  }
}
