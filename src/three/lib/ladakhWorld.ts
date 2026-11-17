/**
 * The AstroClub world, second pass (design; the site still rides ladakhTile):
 *  - the tile is three times the area (520 × 420 m);
 *  - mountains are clean planar faces meeting at rounded ridges, like
 *    rounded corners in 2D: each peak a pyramid whose edges and summit are
 *    filleted, peaks joined by rounded cols, their feet easing onto the floor;
 *  - one landmark on the Gata loops, one at Umling La, the rest spread out
 *    over the valley;
 *  - wooden bridges; roads that turn from paved to gravel gradually (a
 *    0–1 "grit" per point, blended like the ground's colours).
 */

import * as THREE from "three";
import { type CarveCell, Carving, FineBlocks } from "./carve";
import { LADAKH_GROUND, loopNoise, noise2 } from "./ladakh";
import { join, paint } from "./nature";
import { at, drum, type G, rbox } from "./toys";

export type RoadKind = "main" | "lane" | "track";

export interface WorldRoad {
  /** On the mountain: which points ride on wooden stilts (a bend platform, a gully bridge). */
  stilt?: boolean[];
  /** Centreline: x, y (the surface), z. */
  pts: [number, number, number][];
  /** 0 paved … 1 gravel, per point (changes gradually). */
  grit: number[];
  half: number;
  kind: RoadKind;
}

export interface WorldTile {
  W: number;
  D: number;
  H: number;
  ground: THREE.PlaneGeometry;
  roads: WorldRoad[];
  river: [number, number][];
  riverHalf: number;
  riverZ: (x: number) => number;
  lake: {
    x: number;
    a: number;
    b: number;
    mid: (x: number) => number;
    half: (x: number) => number;
    outline: [number, number][];
  };
  bridges: { x: number; z: number; yaw: number; len: number; width: number }[];
  ford: { x: number; z: number; yaw: number };
  /** Umling La: the col's middle (x, y, z on the seam). */
  pass: [number, number, number];
  monastery: [number, number];
  hamlets: { x: number; z: number; face: number }[];
  gompas: [number, number][];
  sites: { key: string; x: number; z: number; y: number; yaw: number; road: number; i: number }[];
  peaks: { x: number; h: number }[];
  /** The ground as the ride engine sees it (on the roads, their surface; stilt bits at deck height). */
  heightAt: (x: number, z: number) => number;
  /** The ground as drawn: under the stilt bits the rock falls away; and which rock block it is. */
  renderAt: (x: number, z: number) => { h: number; rock: number; cell: CarveCell | null };
  /** The floor's colour (sand, fields, shingle) where there's no rock. */
  floorColour: (x: number, z: number, y: number, out: THREE.Color) => THREE.Color;
  /** A rock block's tone. */
  rockColour: (cell: CarveCell, out: THREE.Color) => THREE.Color;
  /** The snowline's offset here (random, lower in hollows; very low on a patch block's top). */
  snowOff: (x: number, z: number, h: number, cell: CarveCell | null) => number;
  /** The snowline's mean height. */
  snowline: number;
  /** How far (m) from the nearest road's edge (negative on a road). */
  roadGap: (x: number, z: number) => number;
  /**
   * Curbs (invisible walls) along the mountain roads, where the rock beside the shelf
   * rises or falls away and along the stilt bits; never across any road.
   */
  curbs: [number, number, number, number][];
  /** Stones tumbled down the fill below the mountain roads. */
  scree: { x: number; y: number; z: number; s: number; yaw: number }[];
}

const C = (hex: string) => new THREE.Color(hex);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Smooth max: like max, but the corner where a and b meet is rounded over about k. */
const smax = (a: number, b: number, k: number) =>
  (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2;
/** |v| with its point rounded off over about k (and 0 at v = 0). */
const sabs = (v: number, k: number) => Math.sqrt(v * v + k * k) - k;

/** ladakhWorld, all at once. */
export function ladakhWorld(o: Parameters<typeof ladakhWorldSteps>[0] = {}): WorldTile {
  const it = ladakhWorldSteps(o);
  for (;;) {
    const n = it.next();
    if (n.done) return n.value;
  }
}

/** The AstroClub world, built a slice at a time (it yields now and then, so a page stays responsive). */
export function* ladakhWorldSteps(
  o: {
    w?: number;
    d?: number;
    height?: number;
    passX?: number;
    seed?: number;
    /** How round the ridges are (m): small is crisp, large is soft. */
    round?: number;
    /** Grid spacing of the ground mesh (m). */
    step?: number;
    footprint?: (key: string) => { depth: number; radius: number };
    /** How round the rock's ridges are where blocks meet (m): a border radius. */
    edge?: number;
    /** How far the level col at Umling La reaches (m). */
    colR?: number;
    /** Stilt bridges only this far (m) or more down the face from the crest. */
    stiltMinD?: number;
    /** The fill's slope below a mountain road (m down per m out). */
    fill?: number;
    /** The pass roads' grade follows the mountain (so the road sits on the rock, not on a causeway). */
    follow?: boolean;
    /**
     * Tidy roadwork: roads that meet match widths (the pass roads and the ford's tracks
     * as wide as the valley road), and a gravel track starts in the colour of the road
     * it leaves, turning to gravel over its first stretch.
     */
    tidy?: boolean;
  } = {},
): Generator<unknown, WorldTile, unknown> {
  const W = o.w ?? 520;
  const D = o.d ?? 420;
  const H = o.height ?? 64;
  const passX = o.passX ?? 100;
  const seed = o.seed ?? 19;
  const R = o.round ?? 6;
  const S = W / 300;
  const SZ = D / 240;
  const band = 100;
  const u = (x: number) => (x / W) * Math.PI * 2;
  const wrapDx = (dx: number) => (((dx % W) + W * 1.5) % W) - W / 2;

  // ── the river, the lake, the roads along the valley ──
  const riverZ = (x: number) => SZ * (6 * Math.sin(u(x) * 2 + 1) + 3 * Math.sin(u(x) * 3));
  const riverHalf = 3.4;
  const lakeX = -50 * S;
  const lakeA = 42 * S;
  const lakeB = 15 * SZ;
  const lakeMid = (x: number) => riverZ(x) + 70 + 3 * Math.sin((x - lakeX) * 0.035);
  const lakeHalf = (x: number) => {
    const q = (x - lakeX) / lakeA;
    return Math.abs(q) < 1 ? lakeB * Math.sqrt(1 - q * q) * (1 + 0.1 * Math.sin(q * 7)) : 0;
  };
  const vroadZ = (x: number) =>
    riverZ(x) - SZ * (15 + 4.5 * Math.sin(u(x) * 2 + 0.7) + 2 * Math.sin(u(x) * 3 + 2.1));
  const hug = (x: number) => {
    const t = Math.min(1, Math.max(0, (Math.abs(x - lakeX) - lakeA * 0.55) / (lakeA * 0.75)));
    return 1 - t * t * (3 - 2 * t);
  };
  const northZ = (x: number) => {
    const base = riverZ(x) + SZ * (15 + 5 * Math.sin(u(x) * 3 + 2) + 2 * Math.sin(u(x) * 5 + 0.4));
    const shoreZ = lakeMid(x) - Math.max(lakeHalf(x), lakeB * 0.55) - 5;
    return base + (shoreZ - base) * hug(x);
  };

  // ── the mountains: pyramids with filleted edges, joined smoothly ──
  // The ridge is centred on the seam (z = ±D/2), mirrored about it, so it is one
  // ridge ringing the world; a pyramid's faces are planes, its edges and summit
  // rounded over R, its foot eased onto the valley floor.
  const slope = 0.64;
  type Peak = { x: number; d: number; h: number; ax: number; diag: boolean };
  const peaks: Peak[] = [];
  {
    // Two peaks flank Umling La; the rest march round the ridge.
    peaks.push({ x: passX - 50, d: 0, h: H * 0.92, ax: 1, diag: true });
    peaks.push({ x: passX + 52, d: 0, h: H * 0.86, ax: 1.1, diag: false });
    let x = passX + 52;
    let k = 0;
    for (;;) {
      x += 58 + 26 * noise2(k * 1.7, 3, seed);
      if (x > passX - 50 + W - 52) break;
      peaks.push({
        x,
        d: 0,
        h: H * (0.82 + 0.3 * noise2(k * 2.3, 7, seed)),
        ax: 0.85 + 0.4 * noise2(k, 11, seed),
        diag: k % 2 === 0,
      });
      k++;
    }
    // Foothills: smaller pyramids along the ridge's foot, both sides alike.
    for (let j = 0; j < 9; j++) {
      const fx = -W / 2 + ((j + 0.5) / 9) * W + (noise2(j, 13, seed) - 0.5) * 20;
      if (Math.abs(wrapDx(fx - passX)) < 34) continue;
      peaks.push({
        x: fx,
        d: band * (0.7 + 0.25 * noise2(j, 17, seed)),
        h: 14 + 14 * noise2(j * 1.3, 19, seed),
        ax: 0.8 + 0.5 * noise2(j, 23, seed),
        diag: j % 3 !== 0,
      });
    }
  }
  const SQ = Math.SQRT1_2;
  const fromSeam = (z: number) => D / 2 - Math.abs(z);
  const pyramid = (p: Peak, x: number, d: number) => {
    const dx = wrapDx(x - p.x) * p.ax;
    const dz = d - p.d;
    let qx = dx;
    let qz = dz;
    if (p.diag) {
      qx = (dx + dz) * SQ;
      qz = (dx - dz) * SQ;
    }
    // Planar faces; edges and summit rounded over R (sabs, smax).
    return p.h - slope * smax(sabs(qx, R), sabs(qz, R), R * 1.4);
  };
  const mountains = (x: number, z: number) => {
    const d = fromSeam(z);
    let h = -40;
    for (const p of peaks) {
      // Each peak only reaches so far (its foot): skip the far ones.
      if (Math.abs(wrapDx(x - p.x)) > p.h / slope / Math.min(1, p.ax) + 40) continue;
      h = smax(h, pyramid(p, x, d), R * 1.6);
    }
    // The foot eases onto the floor: a rounded inside corner, not a crease.
    return Math.max(0, smax(h, 0, R * 1.2) - R * 0.6);
  };
  const passH = mountains(passX, D / 2);

  // ── the pass roads: Gata loops down each face ──
  /** Each descent point's part: -1 the run-out, 100+k bend k, k leg k. */
  const parts = new Map<[number, number][], number[]>();
  const descent = (side: 1 | -1): [number, number][] => {
    const pts: [number, number][] = [[passX, side * (D / 2)]];
    const part: number[] = [-1];
    const loops = 3;
    const span = 26;
    let z = side * (D / 2 - 9);
    let dir = 1;
    const leg = (band * 0.86) / loops;
    // Over the pass, a quarter turn (9 m radius) into the first leg, no doubling back.
    const r0 = 9;
    for (let a = 0.15; a < Math.PI / 2 - 0.01; a += 0.15) {
      pts.push([passX + r0 * (1 - Math.cos(a)), side * (D / 2 - r0 * Math.sin(a))]);
      part.push(-1);
    }
    for (let k = 0; k < loops; k++) {
      // Each bend a broad half-ellipse (12 m out, 22 m across: nowhere tighter than about a
      // 10 m radius, which a bike takes without slowing to a crawl); each leg drops the rest
      // of the loop. The first leg starts where the turn over the pass ends.
      const bendR = 11;
      const drop = leg - 2 * bendR;
      const t0 = k === 0 ? (r0 / span + 1) / 2 : 0;
      for (let t = t0 + 0.05; t <= 1.0001; t += 0.05) {
        pts.push([passX + span * dir * (t * 2 - 1), z - side * ((t - t0) / (1 - t0)) * drop]);
        part.push(k);
      }
      for (let a = 0.12; a <= Math.PI - 0.11; a += 0.12) {
        pts.push([
          passX + span * dir + dir * Math.sin(a) * 12,
          z - side * drop - side * (1 - Math.cos(a)) * bendR,
        ]);
        part.push(100 + k);
      }
      z -= side * leg;
      dir = -dir;
    }
    const zEnd = side > 0 ? northZ(passX) : vroadZ(passX);
    // From where the last bend ends (the side it turned on), a smooth curve (leaving along
    // the bend, no kink) down to the valley road.
    const e = passX - span * dir;
    // (Evenly spaced along the curve, about 2.5 m apart: a smoothed strip through unevenly
    // spaced points dips and bulges between them.)
    const dense: [number, number][] = [];
    for (let k = 0; k <= 200; k++) {
      const t = k / 200;
      const u = 1 - t;
      dense.push([u * u * e + (1 - u * u) * passX, u * u * z + 2 * u * t * z + t * t * zEnd]);
    }
    const dl = lensOf(dense);
    const total = dl[dl.length - 1] as number;
    const steps = Math.max(2, Math.round(total / 2.5));
    let j = 0;
    for (let k = 1; k <= steps; k++) {
      const s = (k / steps) * total;
      while (j < dense.length - 2 && (dl[j + 1] as number) < s) j++;
      const [ax, az] = dense[j] as [number, number];
      const [bx, bz] = dense[j + 1] as [number, number];
      const f = Math.min(
        1,
        (s - (dl[j] as number)) / ((dl[j + 1] as number) - (dl[j] as number) || 1),
      );
      pts.push([ax + (bx - ax) * f, az + (bz - az) * f]);
      part.push(-1);
    }
    parts.set(pts, part);
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
    grit: (i: number) => number;
    half: number;
    kind: RoadKind;
    /** A mountain road (cut into the carved rock). */
    mtn?: boolean;
    stilt?: boolean[];
  };
  const over = (path: [number, number][]): Rd => {
    const l = lensOf(path);
    const total = l[l.length - 1] as number;
    const flatEnd = total * 0.88;
    // Following the mountain: the envelope under the road, smoothed, only ever falling
    // (and never faster than a 15% grade) from the pass to the valley.
    let ys: number[] | null = null;
    if (o.follow) {
      const raw = path.map(([x, z]) => Math.min(passH, mountains(x, z)));
      const sm = raw.map((_, i) => {
        let a = 0;
        let n = 0;
        for (let j = Math.max(0, i - 7); j <= Math.min(raw.length - 1, i + 7); j++) {
          a += raw[j] as number;
          n++;
        }
        return a / n;
      });
      ys = [passH];
      for (let i = 1; i < path.length; i++) {
        const dl = (l[i] as number) - (l[i - 1] as number);
        const prev = ys[i - 1] as number;
        const f = (l[i] as number) / total;
        const want = (sm[i] as number) * (1 - smooth(0.86, 1, f));
        ys.push(Math.min(prev, Math.max(prev - 0.15 * dl, want)));
      }
      // The last stretch eases down to the valley floor whatever's left.
      const last = ys[ys.length - 1] as number;
      if (last > 0)
        for (let i = 0; i < ys.length; i++) {
          const f = (l[i] as number) / total;
          ys[i] = (ys[i] as number) - last * smooth(0.6, 1, f);
        }
    }
    const fy = ys;
    // Paved off the pass, gravel through the middle of the climb, paved again below,
    // each change blended over ~20 m.
    return {
      path,
      y: (i) => (fy ? (fy[i] as number) : passH * Math.max(0, 1 - (l[i] as number) / flatEnd)),
      grit: (i) => {
        const f = (l[i] as number) / total;
        return smooth(0.14, 0.22, f) * (1 - smooth(0.58, 0.66, f));
      },
      half: o.tidy ? 2.2 : 2.3,
      kind: "main",
      mtn: true,
    };
  };
  /** A path with points no more than `step` apart (for colours that change along it). */
  const dense = (path: [number, number][], step = 1.5): [number, number][] => {
    const out: [number, number][] = [path[0] as [number, number]];
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1] as [number, number];
      const [bx, bz] = path[i] as [number, number];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
      for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    return out;
  };
  const level = (
    path0: [number, number][],
    half = 1.5,
    kind: RoadKind = "lane",
    /** Which ends meet another road (a track there starts in that road's colour). */
    ease: [boolean, boolean] = [false, false],
  ): Rd => {
    const easing = o.tidy && kind === "track" && (ease[0] || ease[1]);
    const path = easing ? dense(path0) : path0;
    const l = lensOf(path);
    const total = l[l.length - 1] as number;
    return {
      path,
      y: () => 0,
      grit: (i) => {
        if (kind !== "track") return 0;
        if (!easing) return 1;
        const d = l[i] as number;
        return Math.min(ease[0] ? smooth(0, 14, d) : 1, ease[1] ? smooth(0, 14, total - d) : 1);
      },
      half,
      kind,
    };
  };
  const vpath: [number, number][] = [];
  for (let x = -W / 2; x <= W / 2; x += 3) vpath.push([x, vroadZ(x)]);
  const north: [number, number][] = [];
  for (let x = -W / 2; x <= W / 2; x += 3) north.push([x, northZ(x)]);
  // Lanes across the river (wooden bridges), slanting and bending.
  const bridges: WorldTile["bridges"] = [];
  const crossings: [number, number, number][] = [
    [-173, 45, 12],
    [14, -52, -10],
    [194, 38, -14],
  ];
  const across = crossings.map(([x0, slant, bend]): [number, number][] => {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      const x = x0 + slant * (0.5 - t) + bend * Math.sin(Math.PI * t);
      const e = t * t * (3 - 2 * t);
      pts.push([x, northZ(x) + (vroadZ(x) - northZ(x)) * e]);
    }
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
          len: 13,
          width: 3.4,
        });
        break;
      }
    }
    return pts;
  });
  // The big monastery (after Tawang), back from the valley road; its lane swings past the gate.
  const mx0 = passX - 70;
  const monasteryPt: [number, number] = [mx0, vroadZ(mx0) - 56];
  const loop: [number, number][] = [];
  for (let k = 0; k <= 40; k++) {
    const x = mx0 - 60 + (k / 40) * 120;
    loop.push([x, vroadZ(x) - 30 * Math.sin((Math.PI * k) / 40) ** 0.8]);
  }
  const fields: [number, number][] = [];
  for (let k = 0; k <= 40; k++) {
    const x = -222 + (k / 40) * 115;
    fields.push([x, vroadZ(x) - 52 * Math.sin((Math.PI * k) / 40) ** 0.7]);
  }
  const lakeTrack: [number, number][] = [];
  {
    const e = lakeX + lakeA + 26;
    const w0 = lakeX - lakeA - 26;
    lakeTrack.push([e, northZ(e)]);
    for (let k = 0; k <= 44; k++) {
      const th = 0.12 + (k / 44) * (Math.PI - 0.24);
      const x = lakeX + (lakeA + 14) * Math.cos(th);
      lakeTrack.push([x, lakeMid(x) + (lakeB + 13) * Math.sin(th)]);
    }
    lakeTrack.push([w0, northZ(w0)]);
  }
  // The ford: the pass roads meet across the river, a gravel track down each bank.
  const fordZ = riverZ(passX + 1);
  const roadsIn: Rd[] = [
    over(descent(1)),
    over(descent(-1)),
    level(vpath, 2.2, "main"),
    level(north),
    ...across.map((p) => level(p)),
    level(loop),
    level(fields),
    level(lakeTrack, 1.5, "track", [true, true]),
    level(
      [
        [passX, northZ(passX)],
        [passX + 0.6, (northZ(passX) + fordZ) / 2],
        [passX + 1, fordZ + riverHalf + 1.2],
      ],
      o.tidy ? 2.2 : 1.8,
      "track",
      [true, false],
    ),
    level(
      [
        [passX + 1, fordZ - riverHalf - 1.2],
        [passX + 0.6, (vroadZ(passX) + fordZ) / 2],
        [passX, vroadZ(passX)],
      ],
      o.tidy ? 2.2 : 1.8,
      "track",
      [false, true],
    ),
  ];

  // ── the stops' sites ──
  const foot = o.footprint ?? (() => ({ depth: 3, radius: 5 }));
  const nearestIdx = (path: [number, number][], x: number) => {
    let best = 0;
    let bd = Number.POSITIVE_INFINITY;
    path.forEach(([px], i) => {
      const d = Math.abs(px - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return Math.min(path.length - 2, Math.max(1, best));
  };
  const bends = (path: [number, number][]) => {
    const out: number[] = [];
    for (let i = 2; i < path.length - 2; i++) {
      const a = Math.abs((path[i] as [number, number])[0] - passX);
      if (
        a > 27 &&
        a >= Math.abs((path[i - 1] as [number, number])[0] - passX) &&
        a > Math.abs((path[i + 1] as [number, number])[0] - passX)
      )
        out.push(i);
    }
    return out;
  };
  const sites: WorldTile["sites"] = [];
  const benches: [number, number, number, number][] = [];
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
    // Umling La: the meteor deck on the col itself, beside the road over the top.
    const f = foot("deck");
    const dx = passX + 13;
    const dz = D / 2 - 8;
    sites.push({
      key: "deck",
      x: dx,
      z: dz,
      y: passH,
      yaw: -Math.PI / 2,
      road: 0,
      i: 1,
    });
    benches.push([dx, dz, f.radius + 1, passH]);
    // The Gata loops: one landmark, the observatory dome, out on a middle bend.
    const nb = bends((roadsIn[0] as Rd).path);
    const bi = nb[3] ?? nb[2];
    if (bi !== undefined) {
      const px = ((roadsIn[0] as Rd).path[bi] as [number, number])[0];
      site("dome", 0, bi, [px >= passX ? 1 : -1, 0], 2.5);
    }
    // Spread over the valley, each far from the next.
    site("lake", 3, nearestIdx(north, lakeX + 22), [0, 1], 0.6);
    site("camp", 9, 23, [0, 1]);
    site("bungalow", 3, nearestIdx(north, -222), [0, 1]);
    site("planetarium", 3, nearestIdx(north, 66), [0, 1]);
    site("solar", 2, nearestIdx(vpath, 205), [0, -1], 2.5);
    site("rocket", 8, 20, [0, -1], 3);
    sites.push({
      key: "monastery",
      x: mx0,
      z: monasteryPt[1],
      y: 0,
      yaw: 0,
      road: 7,
      i: nearestIdx(loop, mx0),
    });
  }
  // Hamlets and small gompas.
  const HAMLETS: [number, 1 | -1][] = [
    [-208, 1],
    [38, 1],
    [242, 1],
    [-159, -1],
    [147, -1],
    [-242, -1],
    [182, 1],
    [-95, -1],
  ];
  const hamlets = HAMLETS.map(([x, side]) => ({
    x,
    z: side > 0 ? northZ(x) + 15 : vroadZ(x) - 15,
    face: side > 0 ? Math.PI : 0,
  }));
  const gompas: [number, number][] = [
    [-35, lakeMid(-35) + 40],
    [-149, vroadZ(-149) - 46],
    [253, northZ(253) + 42],
    [158, vroadZ(158) - 44],
    [58, northZ(58) + 44],
    [-232, northZ(-232) + 46],
  ];

  // ── the carving ──
  let rs = (seed * 7919) % 2147483647 || 1;
  const rnd = () => {
    rs = (rs * 16807) % 2147483647;
    return rs / 2147483647;
  };
  // A few gullies down the faces either side of the Gata loops (bridged here and there).
  const GULLIES = [-14, 6, 20].map((g) => passX + g);
  const gullied = (x: number, z: number) => {
    const d = fromSeam(z);
    const w = smooth(6, 20, d) * (1 - smooth(78, 96, d));
    let h = mountains(x, z);
    for (const gx of GULLIES) h -= 10 * Math.exp(-((wrapDx(x - gx) / 7) ** 2)) * w;
    return Math.max(0, h);
  };
  const snowline = H * 0.56;
  yield;
  const carving = new Carving({
    env: gullied,
    top: H,
    W,
    D,
    small: 7,
    big: 18,
    erode: 0.12,
    plateau: 0.82,
    snowline,
    rnd,
    edge: o.edge ?? 0,
  });
  // Stilts, in bits: one hairpin bend on each face out on a stilt platform, and some legs
  // crossing a gully on a short bridge (never one long run).
  for (const r of roadsIn) {
    const part = parts.get(r.path);
    if (!part) continue;
    // (Not the top bend, by the seam: one of the lower two.)
    const bend = 101 + Math.floor(rnd() * 2);
    const bridged = GULLIES.map(() => Array.from({ length: 6 }, () => rnd() < 0.45));
    r.stilt = r.path.map(([x], i) => {
      const k = part[i] as number;
      if (k === bend)
        return fromSeam((r.path[i] as [number, number])[1]) >= (o.stiltMinD ?? 0) * 0.6;
      if (k < 0 || k >= 100) return false;
      const z = (r.path[i] as [number, number])[1];
      if (fromSeam(z) < (o.stiltMinD ?? 0)) return false;
      return GULLIES.some((gx, gi) => Math.abs(x - gx) < 5 && bridged[gi]?.[k] === true);
    });
  }

  // ── road lookups (binned) ──
  const CELL = 10;
  const bins = new Map<string, [number, number][]>();
  roadsIn.forEach((r, ri) => {
    for (let i = 0; i < r.path.length - 1; i++) {
      const [ax, az] = r.path[i] as [number, number];
      const [bx, bz] = r.path[i + 1] as [number, number];
      for (
        let gx = Math.floor((Math.min(ax, bx) - 16) / CELL);
        gx <= Math.floor((Math.max(ax, bx) + 16) / CELL);
        gx++
      )
        for (
          let gz = Math.floor((Math.min(az, bz) - 16) / CELL);
          gz <= Math.floor((Math.max(az, bz) + 16) / CELL);
          gz++
        ) {
          const k = `${gx},${gz}`;
          const list = bins.get(k) ?? [];
          list.push([ri, i]);
          bins.set(k, list);
        }
    }
  });
  type Near = { d: number; y: number; half: number; mtn: boolean; stilt: boolean };
  const nearRoad = (x: number, z: number): Near => {
    let best: Near = { d: Number.POSITIVE_INFINITY, y: 0, half: 2.2, mtn: false, stilt: false };
    for (const [ri, i] of bins.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
      const r = roadsIn[ri] as Rd;
      const [ax, az] = r.path[i] as [number, number];
      const [bx, bz] = r.path[i + 1] as [number, number];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best.d)
        best = {
          d,
          y: r.y(i) + (r.y(i + 1) - r.y(i)) * t,
          half: r.half,
          mtn: r.mtn === true,
          stilt: r.stilt?.[t < 0.5 ? i : i + 1] === true,
        };
    }
    return best;
  };
  const [mxx, mzz] = monasteryPt;
  const pads: [number, number, number][] = [
    ...hamlets.map((h): [number, number, number] => [h.x, h.z, 13]),
    ...gompas.map(([x, z]): [number, number, number] => [x, z, 6]),
  ];
  /** The land before any road: the carved rock, levelled where things stand. */
  const base = (x: number, z: number): { n: number; cell: CarveCell | null } => {
    const sf = carving.surface(x, z);
    let n = sf.h;
    // Umling La: a level col on the seam, the same from both sides.
    const dp = Math.hypot(wrapDx(x - passX), fromSeam(z));
    const colR = o.colR ?? 22;
    if (dp < colR * 0.45) return { n: passH, cell: null };
    if (dp < colR) n = passH + (n - passH) * smooth(colR * 0.45, colR, dp);
    const dm = Math.hypot(x - mxx, z - mzz);
    if (dm < 52) n *= smooth(36, 52, dm);
    const ql = (x - lakeX) / (lakeA + 20);
    if (Math.abs(ql) < 1) {
      const dl = Math.abs(z - lakeMid(x)) - lakeHalf(x);
      n *= Math.min(1, smooth(8, 26, dl) + smooth(0.8, 1, Math.abs(ql)));
    }
    for (const [px, pz, r] of pads) {
      const d = Math.hypot(wrapDx(x - px), z - pz);
      if (d < r + 12) n *= smooth(r, r + 12, d);
    }
    for (const [bx, bz, r, by] of benches) {
      const d = Math.hypot(x - bx, z - bz);
      if (d < r + 12) n = by + (n - by) * smooth(r, r + 12, d);
    }
    return { n, cell: sf.cell };
  };
  /** The slope a mountain road leaves in the rock: its cut above, its fill below. */
  const slopeOf = (h: number, rd: Near) => {
    if (rd.d < rd.half + 1.2) return rd.y;
    if (h > rd.y) {
      const w = 2 + (h - rd.y) * 0.45;
      if (rd.d >= rd.half + 1.2 + w) return h;
      const k = (rd.d - rd.half - 1.2) / w;
      return rd.y + (h - rd.y) * (k * k * k * (k * (k * 6 - 15) + 10));
    }
    return Math.max(h, rd.y - (rd.d - rd.half - 1.2) * (o.fill ?? 1.1));
  };
  yield;
  // Small blocks along the mountain roads' cut and fill; scree down the fill.
  const fine = new FineBlocks();
  const scree: WorldTile["scree"] = [];
  for (const r of roadsIn) {
    if (!r.mtn) continue;
    for (let i = 0; i < r.path.length; i++) {
      const [px, pz] = r.path[i] as [number, number];
      for (let k = 0; k < 7; k++) {
        const x = px + (rnd() - 0.5) * 30;
        const z = pz + (rnd() - 0.5) * 30;
        const rd = nearRoad(x, z);
        if (!rd.mtn || rd.stilt || rd.d < rd.half + 0.4 || rd.d > rd.half + 14) continue;
        const h0 = base(x, z).n;
        const sl = slopeOf(h0, rd);
        if (Math.abs(sl - h0) < 0.3 && rd.d > rd.half + 3) continue;
        if (!fine.add(x, z, sl + (rnd() - 0.4) * 0.7, rnd)) continue;
        if (sl > h0 + 0.5 && sl < rd.y - 0.8)
          for (let q = 2 + Math.floor(rnd() * 3); q > 0; q--) {
            const sx = x + (rnd() - 0.5) * 3;
            const sz = z + (rnd() - 0.5) * 3;
            const s2 = 0.45 + rnd() * rnd() * 1.4;
            scree.push({ x: sx, y: sl - s2 * 0.3, z: sz, s: s2, yaw: rnd() * Math.PI * 2 });
          }
      }
      if (i % 20 === 19) yield;
    }
  }
  /** The ground with its roads; `drawn` lowers the rock under the stilt bits. */
  const ground = (x: number, z: number, drawn: boolean) => {
    const b = base(x, z);
    let h = b.n;
    const rd = nearRoad(x, z);
    if (rd.d < rd.half + 16) {
      if (rd.mtn) {
        if (rd.stilt && drawn) {
          if (rd.d < rd.half + 7) {
            const k = smooth(rd.half + 2, rd.half + 7, rd.d);
            h = Math.min(h, rd.y - 6.5 + (Math.max(h, rd.y) - (rd.y - 6.5)) * k);
          }
        } else if (rd.d < rd.half + 1.2) h = rd.y;
        else {
          const sl = slopeOf(h, rd);
          const f = fine.at(x, z);
          if (f !== null && Math.abs(sl - h) > 0.05)
            h = sl > h ? Math.max(h, Math.min(f, rd.y)) : Math.min(h, f);
          else h = sl;
        }
      } else if (rd.d < rd.half + 0.6) h = rd.y;
      else {
        const k = smooth(rd.half + 0.6, rd.half + 12, rd.d);
        h = rd.y + (h - rd.y) * k;
      }
    }
    return { h: Math.max(0, h), rock: b.n, cell: b.cell };
  };
  const heightAt = (x: number, z: number) => ground(x, z, false).h;
  const renderAt = (x: number, z: number) => ground(x, z, true);

  // ── the engine's ground: a PlaneGeometry (the ride engine reads heights off its grid) ──
  const step = o.step ?? 1;
  const nx = Math.round(W / step);
  const nz = Math.round(D / step);
  const g = new THREE.PlaneGeometry(W, D, nx, nz);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    if (i % 4000 === 3999) yield;
  }
  g.computeVertexNormals();
  g.deleteAttribute("uv");
  const gridAt = (x: number, z: number) => {
    const fx = Math.min(nx, Math.max(0, ((x + W / 2) / W) * nx));
    const fz = Math.min(nz, Math.max(0, ((z + D / 2) / D) * nz));
    const ix = Math.min(nx - 1, Math.floor(fx));
    const iz = Math.min(nz - 1, Math.floor(fz));
    const tx = fx - ix;
    const tz = fz - iz;
    const row = nx + 1;
    const a2 = pos.getY(iz * row + ix);
    const b2 = pos.getY(iz * row + ix + 1);
    const c2 = pos.getY((iz + 1) * row + ix);
    const e2 = pos.getY((iz + 1) * row + ix + 1);
    return (a2 * (1 - tx) + b2 * tx) * (1 - tz) + (c2 * (1 - tx) + e2 * tx) * tz;
  };

  // ── colours, snow ──
  const sand = C(LADAKH_GROUND);
  const gravel = C("#e4d8c6");
  const green = C("#cbdc98");
  const green2 = C("#b9d189");
  const floorColour = (x: number, z: number, y: number, out: THREE.Color) => {
    out.copy(sand);
    const rz = Math.abs(z - riverZ(x));
    const lz = Math.max(0, Math.abs(z - lakeMid(x)) - lakeHalf(x));
    const bare = Math.exp(-(((x - lakeX) / (lakeA * 1.15)) ** 6)) * (1 - smooth(8, 26, lz));
    const lush = (1 - smooth(50, 85, rz)) * (1 - smooth(0.4, 4, y)) * (1 - bare);
    const field = 0.82 + 0.18 * loopNoise(x, z, W, 0.06, seed + 7);
    out.lerp(green.clone().lerp(green2, 1 - field), lush * field);
    out.lerp(gravel, (1 - smooth(riverHalf + 0.5, riverHalf + 4, rz)) * (1 - smooth(0.2, 1.2, y)));
    out.lerp(gravel, bare * (1 - smooth(1, 12, lz)));
    return out;
  };
  const LOW = C("#d9c3aa");
  const MID = C("#c6b1a8");
  const HIGH = C("#ad9894");
  const rockColour = (cell: CarveCell, out: THREE.Color) => {
    const f = cell.f;
    if (f < 0.5) out.copy(LOW).lerp(MID, f * 2);
    else out.copy(MID).lerp(HIGH, (f - 0.5) * 2);
    const j = ((Math.sin(cell.x * 12.9898 + cell.z * 78.233) * 43758.5453) % 1) * 0.06;
    return out.offsetHSL(0, 0, j - 0.03);
  };
  const snowOff = (x: number, z: number, h: number, cell: CarveCell | null) => {
    if (cell?.patch && h > cell.t - 1) return -40;
    let v =
      (noise2(x * 0.018, z * 0.018, 7) - 0.5) * 11 + (noise2(x * 0.05, z * 0.05, 11) - 0.5) * 5;
    const avg = (gridAt(x - 6, z) + gridAt(x + 6, z) + gridAt(x, z - 6) + gridAt(x, z + 6)) / 4;
    v -= Math.min(10, Math.max(0, avg - h) * 1.3);
    return v;
  };

  const roadGap = (x: number, z: number) => {
    const rd = nearRoad(x, z);
    return rd.d - rd.half;
  };
  // Curbs: a point every road point, a little outside each edge, kept only where the
  // ground beside drops or rises (or on stilts) and only where it's clear of every road
  // (at a hairpin the inside edge would otherwise cut across the bend); segments joined
  // only between neighbours, so none ever spans a road.
  const curbs: [number, number, number, number][] = [];
  for (const r of roadsIn) {
    if (!r.mtn) continue;
    for (const sgn of [-1, 1]) {
      let prev: [number, number] | null = null;
      for (let i = 1; i < r.path.length - 1; i++) {
        const [px, pz] = r.path[i] as [number, number];
        const [ax, az] = r.path[i - 1] as [number, number];
        const [bx, bz] = r.path[i + 1] as [number, number];
        const l = Math.hypot(bx - ax, bz - az) || 1;
        const nx = (-(bz - az) / l) * sgn;
        const nz = ((bx - ax) / l) * sgn;
        const y = r.y(i);
        // (Across the whole shoulder, so a fill that falls away just past the edge counts.)
        let drop = 0;
        for (const d of [1.6, 2.6, 3.6])
          drop = Math.max(
            drop,
            Math.abs(ground(px + nx * (r.half + d), pz + nz * (r.half + d), true).h - y),
          );
        // At the shelf's outer edge, so the whole road is yours to ride.
        const cx = px + nx * (r.half + 1.1);
        const cz = pz + nz * (r.half + 1.1);
        // (All the way up the mountain, off the valley floor: no gap to run wide through.)
        const on = (r.stilt?.[i] === true || drop > 0.9 || y > 1.5) && roadGap(cx, cz) > 0.9;
        if (!on) {
          prev = null;
          continue;
        }
        if (prev) {
          const mx = (prev[0] + cx) / 2;
          const mz = (prev[1] + cz) / 2;
          if (Math.hypot(cx - prev[0], cz - prev[1]) < 4 && roadGap(mx, mz) > 0.9)
            curbs.push([prev[0], prev[1], cx, cz]);
        }
        prev = [cx, cz];
      }
    }
    yield;
  }
  const roads: WorldRoad[] = roadsIn.map((r) => ({
    pts: r.path.map(([x, z], i) => [x, r.y(i), z] as [number, number, number]),
    grit: r.path.map((_, i) => r.grit(i)),
    half: r.half,
    kind: r.kind,
    ...(r.stilt ? { stilt: r.stilt } : {}),
  }));
  const river: [number, number][] = [];
  for (let x = -W / 2 - 4; x <= W / 2 + 4; x += 2) river.push([x, riverZ(x)]);
  const outline: [number, number][] = [];
  for (let k = 0; k <= 60; k++) {
    const x = lakeX - lakeA + (k / 60) * 2 * lakeA;
    outline.push([x, lakeMid(x) + lakeHalf(x)]);
  }
  for (let k = 60; k >= 0; k--) {
    const x = lakeX - lakeA + (k / 60) * 2 * lakeA;
    outline.push([x, lakeMid(x) - lakeHalf(x)]);
  }
  return {
    W,
    D,
    H,
    ground: g,
    roads,
    river,
    riverHalf,
    riverZ,
    lake: { x: lakeX, a: lakeA, b: lakeB, mid: lakeMid, half: lakeHalf, outline },
    bridges,
    ford: { x: passX + 1, z: fordZ, yaw: 0 },
    pass: [passX, passH, D / 2],
    monastery: monasteryPt,
    hamlets,
    gompas,
    sites,
    peaks: peaks.filter((p) => p.d === 0).map((p) => ({ x: p.x, h: p.h })),
    heightAt,
    renderAt,
    floorColour,
    rockColour,
    snowOff,
    snowline,
    scree,
    roadGap,
    curbs,
  };
}

// ── junctions ──────────────────────────────────────────────────────────────

/**
 * Where a road ends on another, the corners between them filled with a rounded
 * fillet (radius `r`) in the joining road's colour, so the two flow into each
 * other instead of meeting as hard rectangles.
 */
export function junctionAprons(
  roads: WorldRoad[],
  r = 3,
): { pts: [number, number][]; y: number; colour: THREE.Color }[] {
  const out: { pts: [number, number][]; y: number; colour: THREE.Color }[] = [];
  roads.forEach((side, si) => {
    const cols = roadColours(side);
    for (const end of [0, side.pts.length - 1]) {
      const p = side.pts[end] as [number, number, number];
      const nb = side.pts[end === 0 ? 1 : end - 1] as [number, number, number];
      // The road it ends on: the nearest other road's segment within reach.
      let best: { d: number; tx: number; tz: number; half: number } | null = null;
      roads.forEach((thru, ti) => {
        if (ti === si) return;
        for (let i = 0; i < thru.pts.length - 1; i++) {
          const a = thru.pts[i] as [number, number, number];
          const b = thru.pts[i + 1] as [number, number, number];
          const dx = b[0] - a[0];
          const dz = b[2] - a[2];
          const l2 = dx * dx + dz * dz || 1;
          const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / l2));
          const d = Math.hypot(a[0] + dx * t - p[0], a[2] + dz * t - p[2]);
          if (d < 1.2 && (!best || d < best.d)) {
            const l = Math.sqrt(l2);
            best = { d, tx: dx / l, tz: dz / l, half: thru.half };
          }
        }
      });
      if (!best) continue;
      const b0 = best as { d: number; tx: number; tz: number; half: number };
      // D: the joining road's way out from the junction; T: along the through road;
      // N: across the through road, towards the joining road.
      let dx = nb[0] - p[0];
      let dz = nb[2] - p[2];
      const dl = Math.hypot(dx, dz) || 1;
      dx /= dl;
      dz /= dl;
      const tx = b0.tx;
      const tz = b0.tz;
      let nx = -tz;
      let nz = tx;
      if (nx * dx + nz * dz < 0) {
        nx = -nx;
        nz = -nz;
      }
      for (const sgn of [-1, 1]) {
        // The joining road's edge on this side, and the through road's near edge.
        const sx = -dz * sgn;
        const sz = dx * sgn;
        const px0 = p[0] + sx * side.half;
        const pz0 = p[2] + sz * side.half;
        const qx0 = p[0] + nx * b0.half;
        const qz0 = p[2] + nz * b0.half;
        // Where they cross: px0 + D·s = qx0 + T·u.
        const det = dx * -tz - dz * -tx;
        if (Math.abs(det) < 1e-4) continue;
        const rx = qx0 - px0;
        const rz = qz0 - pz0;
        const sAlong = (rx * -tz - rz * -tx) / det;
        const cx = px0 + dx * sAlong;
        const cz = pz0 + dz * sAlong;
        // u1: along the through road's edge, away from the joining road on this side.
        const away = tx * sx + tz * sz >= 0 ? 1 : -1;
        const u1x = tx * away;
        const u1z = tz * away;
        const cos = Math.min(0.999, Math.max(-0.999, u1x * dx + u1z * dz));
        const th = Math.acos(cos);
        const rr = Math.min(r, 6 * Math.tan(th / 2));
        const L = rr / Math.tan(th / 2);
        let bx = u1x + dx;
        let bz = u1z + dz;
        const bl = Math.hypot(bx, bz) || 1;
        bx /= bl;
        bz /= bl;
        const ox = cx + bx * (rr / Math.sin(th / 2));
        const oz = cz + bz * (rr / Math.sin(th / 2));
        const a1x = cx + u1x * L;
        const a1z = cz + u1z * L;
        const a2x = cx + dx * L;
        const a2z = cz + dz * L;
        const ang1 = Math.atan2(a1z - oz, a1x - ox);
        let ang2 = Math.atan2(a2z - oz, a2x - ox);
        // The short way round (the arc faces the corner).
        while (ang2 - ang1 > Math.PI) ang2 -= Math.PI * 2;
        while (ang2 - ang1 < -Math.PI) ang2 += Math.PI * 2;
        const pts: [number, number][] = [[cx, cz]];
        for (let k = 0; k <= 10; k++) {
          const a = ang1 + ((ang2 - ang1) * k) / 10;
          pts.push([ox + Math.cos(a) * rr, oz + Math.sin(a) * rr]);
        }
        out.push({ pts, y: p[1], colour: (cols[end] as THREE.Color).clone() });
      }
    }
  });
  return out;
}

// ── roads drawn with gradual surfaces ──────────────────────────────────────

export const ROAD_TONES = { paved: "#d9d0c9", gravel: "#e3c6a0", lane: "#e2dad0" };

/**
 * A road strip following its centreline's height, coloured per vertex along
 * its length (paved fading into gravel and back over the blend, the way the
 * ground's colours change), with a soft paler shoulder at each edge.
 */
export function gradedRoad(
  pts: [number, number, number][],
  colours: THREE.Color[],
  half: number,
  lift = 0.05,
): THREE.Mesh | null {
  if (pts.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const n = Math.max(2, Math.ceil(curve.getLength() / 0.5));
  const c = curve.getSpacedPoints(n);
  // Colour at each spaced point: from the input point nearest along the curve.
  const lens = lensOf3(pts);
  const total = lens[lens.length - 1] as number;
  const colourAt = (f: number) => {
    const s = f * total;
    let i = 0;
    while (i < lens.length - 2 && (lens[i + 1] as number) < s) i++;
    const a = lens[i] as number;
    const b = lens[i + 1] as number;
    const t = b > a ? (s - a) / (b - a) : 0;
    return (colours[i] as THREE.Color).clone().lerp(colours[i + 1] as THREE.Color, t);
  };
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  // Three strips across: shoulder, carriageway, shoulder (the shoulders paler).
  const across = [-1, -0.82, 0.82, 1];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)] as THREE.Vector3;
    const b = c[Math.min(c.length - 1, i + 1)] as THREE.Vector3;
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    const nx = (-tz / l) * half;
    const nz = (tx / l) * half;
    const k = colourAt(i / (c.length - 1));
    const edge = k.clone().lerp(new THREE.Color("#efe6da"), 0.35);
    for (const s of across) {
      pos.push(p.x + nx * s, p.y + lift, p.z + nz * s);
      const e = Math.abs(s) === 1 ? edge : k;
      col.push(e.r, e.g, e.b);
    }
    if (i > 0) {
      const k0 = (i - 1) * 4;
      const k1 = i * 4;
      for (let j = 0; j < 3; j++)
        idx.push(k0 + j, k1 + j, k0 + j + 1, k0 + j + 1, k1 + j, k1 + j + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }),
  );
}

function lensOf3(pts: [number, number, number][]): number[] {
  const l = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as [number, number, number];
    const b = pts[i] as [number, number, number];
    l.push((l[i - 1] as number) + Math.hypot(b[0] - a[0], b[2] - a[2]));
  }
  return l;
}

/** A road's colours from its kind and grit (paved → gravel, gradually). */
export function roadColours(r: WorldRoad): THREE.Color[] {
  const paved = C(r.kind === "lane" ? ROAD_TONES.lane : ROAD_TONES.paved);
  const grav = C(ROAD_TONES.gravel);
  return r.grit.map((g) => paved.clone().lerp(grav, g));
}

// ── wooden bridges ─────────────────────────────────────────────────────────

const WOOD = "#b98a62";
const WOOD_DARK = "#8f6a4c";
const WOOD_PALE = "#d2ad84";
const STONE = "#cfc6bd";
const FLAGS = ["#3f7fd0", "#f4f1ea", "#d8453c", "#4caf6a", "#f2c84b"];

export type WoodBridgeStyle = "crib" | "cantilever" | "plank";

/**
 * A Ladakhi wooden bridge `len` long (along local z), `width` across, its
 * deck `deck` above the water, meeting the road level at each end:
 *  - crib: log-crib abutments (logs criss-crossed, packed with stones), two
 *    log stringers, a plank deck, post-and-rail sides, prayer flags strung
 *    over from tall poles at both ends;
 *  - cantilever: stone abutments with stacked logs stepping out over the
 *    water, the deck across between them, a little roofed gate at one end;
 *  - plank: a low plank deck on two log trestles mid-stream, simple rails.
 * Its deck ends ramp down to the ground, so the road runs straight onto it.
 */
export function woodBridge(style: WoodBridgeStyle, len = 13, width = 3.4, deck = 0.55): G {
  const parts: G[] = [];
  const half = len / 2;
  const w2 = width / 2;
  // The deck: planks across, slightly irregular tones; the ends slope down to the road.
  const planks = Math.round(len / 0.32);
  for (let i = 0; i < planks; i++) {
    const z = -half + (i + 0.5) * (len / planks);
    const edge = Math.abs(z) > half - 1.6 ? (Math.abs(z) - (half - 1.6)) / 1.6 : 0;
    const y = deck * (1 - edge * edge * 0.92);
    const tone = i % 3 === 0 ? WOOD_PALE : i % 3 === 1 ? WOOD : "#c79b72";
    parts.push(at(rbox(width, 0.1, len / planks - 0.04, tone, 0.02), 0, y - 0.1, z));
  }
  // Stringers under the deck.
  for (const s of [-1, 1])
    parts.push(
      at(
        drum(0.16, len - 3, WOOD_DARK, 0.04, 8),
        s * (w2 - 0.35),
        deck - 0.28,
        -(len - 3) / 2,
        0,
        Math.PI / 2,
      ),
    );
  const rails = (zs: number, ze: number) => {
    for (const s of [-1, 1]) {
      for (let z = zs; z <= ze + 0.01; z += 1.6)
        parts.push(at(rbox(0.12, 0.95, 0.12, WOOD_DARK, 0.03), s * (w2 + 0.04), deck - 0.05, z));
      parts.push(
        at(rbox(0.1, 0.1, ze - zs + 0.2, WOOD, 0.03), s * (w2 + 0.04), deck + 0.82, (zs + ze) / 2),
      );
    }
  };
  if (style === "crib") {
    for (const e of [-1, 1]) {
      const cz = e * (half - 1.9);
      // Criss-crossed logs, stones packed between.
      for (let k = 0; k < 4; k++) {
        const y = -0.4 + k * 0.22;
        if (k % 2 === 0)
          for (const s of [-1, 1])
            parts.push(
              at(drum(0.12, 2.4, WOOD_DARK, 0.04, 8), s * (w2 + 0.1), y, cz - 1.2, 0, Math.PI / 2),
            );
        else
          for (const dz of [-1, 1])
            parts.push(
              at(
                drum(0.12, width + 0.6, WOOD, 0.04, 8),
                -(width + 0.6) / 2,
                y,
                cz + dz * 1.05,
                0,
                0,
                -Math.PI / 2,
              ),
            );
      }
      parts.push(at(rbox(width - 0.2, 0.7, 2, STONE, 0.15), 0, -0.4, cz));
      // Flag poles at the corners.
      for (const s of [-1, 1])
        parts.push(
          at(drum(0.07, 3.4, WOOD_DARK, 0.02, 8), s * (w2 + 0.25), deck, e * (half - 0.6)),
        );
    }
    rails(-half + 1.2, half - 1.2);
    // Prayer flags: strings over the bridge between the poles (pennants along a sag).
    for (const s of [-1, 1]) {
      const n = 26;
      for (let i = 1; i < n; i++) {
        const f = i / n;
        const z = -half + 0.6 + f * (len - 1.2);
        const y = deck + 3.3 - Math.sin(Math.PI * f) * 0.9;
        parts.push(
          at(
            rbox(0.04, 0.26, 0.22, FLAGS[i % FLAGS.length] as string, 0.01),
            s * (w2 + 0.25),
            y - 0.2,
            z,
          ),
        );
      }
    }
  } else if (style === "cantilever") {
    for (const e of [-1, 1]) {
      // Stone abutment, then logs stepping out in three tiers.
      parts.push(at(rbox(width + 1.2, 1.1, 2.4, STONE, 0.15), 0, -0.6, e * (half - 1.4)));
      // Each tier reaches further out over the water than the one below it.
      for (let k = 0; k < 3; k++) {
        const l = 1.4 + k * 0.9;
        const y = deck - 0.45 - (2 - k) * 0.24;
        const z0 = e * (half - 2.9);
        const z1 = z0 - e * l;
        for (const sx of [-1, 0, 1])
          parts.push(
            at(
              drum(0.13, l + 0.3, k % 2 ? WOOD : WOOD_DARK, 0.04, 8),
              sx * (w2 - 0.4),
              y,
              Math.min(z0, z1) - 0.15,
              0,
              Math.PI / 2,
            ),
          );
      }
    }
    rails(-half + 2.6, half - 2.6);
    // A little roofed gate at the near end.
    for (const s of [-1, 1])
      parts.push(
        at(rbox(0.22, 2.4, 0.22, WOOD_DARK, 0.04), s * (w2 + 0.1), deck - 0.05, half - 1.2),
      );
    parts.push(at(rbox(width + 0.8, 0.18, 1.0, "#9c4f45", 0.04), 0, deck + 2.35, half - 1.2));
    parts.push(at(rbox(width + 1.2, 0.12, 1.3, "#e9b949", 0.04), 0, deck + 2.53, half - 1.2));
  } else {
    // Two trestles in the stream.
    for (const z of [-len * 0.18, len * 0.18])
      for (const s of [-1, 1]) {
        const leg = rbox(0.16, deck + 0.6, 0.16, WOOD_DARK, 0.04);
        leg.rotateZ(s * 0.12);
        parts.push(at(leg, s * (w2 - 0.3), -0.6, z));
      }
    rails(-half + 1.6, half - 1.6);
  }
  return join(parts.map((p) => (p.attributes.color ? p : paint(p, WOOD))));
}

/** The deck's surface height along the bridge (local z), for the ride: level, sloping off at the ends. */
export function woodDeckHeight(len: number, deck: number, z: number): number {
  const half = len / 2;
  const edge = Math.abs(z) > half - 1.6 ? Math.min(1, (Math.abs(z) - (half - 1.6)) / 1.6) : 0;
  return deck * (1 - edge * edge * 0.92);
}
