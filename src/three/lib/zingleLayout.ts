/**
 * Zingle's layout as plain data (no scene objects), so it can be checked in Bun. The world at 3×
 * (1560 × 1200 m, layout W3): a road trip across the Thar, west to east the way the real desert
 * runs. Jaisalmer in the west (Sonar Qila on its carved hill, the havelis, Gadisar, Bada Bagh,
 * and beyond it the dune sea), Jodhpur in the middle (the blue walled city, the twin pols at its
 * gate, Ghanta Ghar, Jaswant Thada; the fort with the toshakhana inside, to the south), Jaipur
 * in the east (the pink grid, Hawa Mahal, Johari bazaar; Jantar Mantar, Sambhar and the stepwell
 * to the south). The highway and a ridge road cross it (both wrap); a country road loops the
 * south; the railway runs beside the highway.
 *
 * The rule the roads follow: a road either wraps, loops, or runs from one road to another,
 * starting and ending on another road's centreline at an interior point, at a real angle (never
 * where another road ends: that "carry-on" join is drawn as a notch). Junctions are T's only (no
 * crossings). A chain of lanes is one road. The only dead ends are a terminus (the fort's court).
 */

import * as THREE from "three";
import { lightToys } from "../flat/kit";
import { type SonarQila, sonarQila } from "./sonarQila";
import { FORT_BRIDGE_END, FORT_GATE, FORT_INNER, POL_ARCHES } from "./zingleLandmarks";

export type Pt = [number, number];

/**
 * The world shrunk from W3 (1560 × 1200 m) to about 70% of its area, the landmarks kept at their
 * size: W3's coordinates go through `W`, which scales them by `K` but keeps the ground round Sonar
 * Qila rigid (moved, not shrunk), so the roads still hug the hill they were drawn round.
 */
export const K = 0.84;
export const TW = 1312;
export const TD = 1008;
const QILA_W3: Pt = [-480, -350];
/** Sonar Qila (its local origin: the hill's centre). */
export const QILA: Pt = [QILA_W3[0] * K, QILA_W3[1] * K];
/** A W3 length, in this world. */
export const s = (v: number): number => v * K;
/** A W3 point, in this world: scaled, but rigid within ~120 m of Sonar Qila (blending out by 220 m). */
export function W(x: number, z: number): Pt {
  const d = Math.hypot(x - QILA_W3[0], z - QILA_W3[1]);
  const t = Math.min(1, Math.max(0, (d - 120) / 100));
  const rigid = 1 - t * t * (3 - 2 * t);
  const sx = x * K;
  const sz = z * K;
  return [
    sx + (QILA[0] + x - QILA_W3[0] - sx) * rigid,
    sz + (QILA[1] + z - QILA_W3[1] - sz) * rigid,
  ];
}

/** The highway's line (periodic across the tile, so it wraps without a kink). */
export const hwZ = (x: number): number =>
  s(-40 + 26 * Math.sin((2 * Math.PI * x) / TW) + 10 * Math.sin((6 * Math.PI * x) / TW));
/** The ridge road's line, across the north (it wraps too). */
export const ridgeZ = (x: number): number =>
  s(-505 + 12 * Math.sin((2 * Math.PI * (x + s(100))) / TW) + 5 * Math.sin((8 * Math.PI * x) / TW));
/** The station (x), and the railway's line: level and straight for 45 m either side of it. */
export const STX = s(-120);
export const railZ = (x: number): number => {
  const sweep = (u: number) => s(60 + 22 * Math.sin((2 * Math.PI * (u + s(200))) / TW));
  const d = Math.abs(((((x - STX) % TW) + TW * 1.5) % TW) - TW / 2);
  const t = Math.min(1, Math.max(0, (d - 45) / 60));
  const w = 1 - t * t * t * (t * (t * 6 - 15) + 10);
  return sweep(x) + (sweep(STX) - sweep(x)) * w;
};
/** The fort (its local origin: the gate faces south, the bridge runs south from it). */
export const FORT: Pt = [s(-140), s(300)];
/** Jodhpur's walled city (an ellipse), the dune sea, Sambhar's salt lake. */
export const CITY = { x: 0, z: s(-250), rx: s(150), rz: s(105) };
export const DUNES = { x: s(-560), z: s(230), rx: s(210), rz: s(260) };
export const SALT = { x: s(600), z: s(450), rx: s(130), rz: s(66) };
/** Jaipur's grid (within its pink wall) and Jaisalmer's town (round its lanes). */
export const JAIPUR = { x0: s(330), x1: s(690), z0: s(-460), z1: s(-170) };

export function curve(ctrl: Pt[], closed: boolean, spacing = 2.5): Pt[] {
  const c = new THREE.CatmullRomCurve3(
    ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    closed,
    "centripetal",
  );
  const n = Math.max(8, Math.round(c.getLength() / spacing));
  const pts = c.getSpacedPoints(n).map((p) => [p.x, p.z] as Pt);
  if (closed) pts.pop();
  return pts;
}

/** Offsets a polyline sideways (positive: to its left in x-z, i.e. (−dz, dx)). */
export function offset(pts: Pt[], d: number): Pt[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)] as Pt;
    const b = pts[Math.min(n - 1, i + 1)] as Pt;
    const tx = b[0] - a[0];
    const tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    return [p[0] + (-tz / l) * d, p[1] + (tx / l) * d];
  });
}

/** The point of a polyline nearest (x, z), its distance, and the segment it's on. */
export function nearest(
  pts: Pt[],
  x: number,
  z: number,
  closed = false,
): { p: Pt; d: number; i: number } {
  let best = { p: pts[0] as Pt, d: 1e9, i: 0 };
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i] as Pt;
    const b = pts[(i + 1) % n] as Pt;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    const q: Pt = [a[0] + dx * t, a[1] + dz * t];
    const d = Math.hypot(q[0] - x, q[1] - z);
    if (d < best.d) best = { p: q, d, i };
  }
  return best;
}
export const nearestOn = (pts: Pt[], x: number, z: number, closed = false): Pt =>
  nearest(pts, x, z, closed).p;
export const polyDist = (pts: Pt[], x: number, z: number, closed = false): number =>
  nearest(pts, x, z, closed).d;

/**
 * Polylines bucketed into a grid, for "is (x, z) clear of all of them by m?" asked thousands of
 * times. Each line has its own pad (a road's half width); the answer matches checking every
 * segment, only it looks at the few near the point.
 */
export class SegGrid {
  private cells = new Map<number, number[]>();
  private segs: number[] = [];
  constructor(private cell = 16) {}
  private key(i: number, j: number) {
    return (i + 4096) * 8192 + (j + 4096);
  }
  add(pts: Pt[], closed = false, pad = 0) {
    const n = pts.length;
    const C = this.cell;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = pts[i] as Pt;
      const b = pts[(i + 1) % n] as Pt;
      const id = this.segs.length;
      this.segs.push(a[0], a[1], b[0], b[1], pad);
      const x0 = Math.floor((Math.min(a[0], b[0]) - pad) / C);
      const x1 = Math.floor((Math.max(a[0], b[0]) + pad) / C);
      const z0 = Math.floor((Math.min(a[1], b[1]) - pad) / C);
      const z1 = Math.floor((Math.max(a[1], b[1]) + pad) / C);
      for (let cx = x0; cx <= x1; cx++)
        for (let cz = z0; cz <= z1; cz++) {
          const k = this.key(cx, cz);
          const l = this.cells.get(k);
          if (l) l.push(id);
          else this.cells.set(k, [id]);
        }
    }
    return this;
  }
  /** Further than pad + m from every line? */
  clear(x: number, z: number, m: number): boolean {
    const C = this.cell;
    const s = this.segs;
    const x0 = Math.floor((x - m) / C);
    const x1 = Math.floor((x + m) / C);
    const z0 = Math.floor((z - m) / C);
    const z1 = Math.floor((z + m) / C);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const l = this.cells.get(this.key(cx, cz));
        if (!l) continue;
        for (const id of l) {
          const o = id * 5;
          const ax = s[o] as number;
          const az = s[o + 1] as number;
          const dx = (s[o + 2] as number) - ax;
          const dz = (s[o + 3] as number) - az;
          const l2 = dx * dx + dz * dz || 1;
          const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
          const r = (s[o + 4] as number) + m;
          const ex = ax + dx * t - x;
          const ez = az + dz * t - z;
          if (ex * ex + ez * ez <= r * r) return false;
        }
      }
    return true;
  }
}

/** Local (lx, lz) of something at (ox, oz) turned by yaw, in the world. */
export const toWorld = (ox: number, oz: number, yaw: number, lx: number, lz: number): Pt => {
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  return [ox + lx * c + lz * sn, oz - lx * sn + lz * c];
};

export interface RoadSpec {
  name: string;
  pts: Pt[];
  half: number;
  kind: "main" | "lane";
  /** A loop (its last point joins its first). */
  closed?: boolean;
  /** Runs off one edge of the tile and on at the other (the world wraps). */
  wraps?: boolean;
  /** Leaves and rejoins its road in symmetric Y forks (mirror branches): a gentler join is right. */
  fork?: boolean;
  /** An end that's allowed to stop (the fort's court). */
  terminus?: "start" | "end";
  /** Heights along it (Sonar Qila's ramp and lane); flat where left out. */
  ys?: number[];
  draw: "highway" | "road" | "sand" | "qila";
}

const ROAD_NAMES = [
  "hw",
  "ridge",
  "J1",
  "J3",
  "ramp",
  "lane",
  "ring",
  "A",
  "polLoop",
  "cross",
  "north",
  "D5",
  "station",
  "country",
  "fortRoad",
  "southLoop",
  "P1",
  "P2",
  "C1",
  "C2",
  "C3",
  "P3",
  "P4",
  "K1",
  "sambhar",
  "sand",
  "S2",
  "bivouac",
] as const;
export type RoadName = (typeof ROAD_NAMES)[number];

export interface ZingleLayout {
  roads: RoadSpec[];
  /** Road indices by name. */
  RI: Record<RoadName, number>;
  /** Where the twin pols stand (their moon arch on lane A). */
  pols: { x: number; z: number; yaw: number };
  /** The court road's end inside the fort (world). */
  foot: Pt;
  /** Sonar Qila (local: add QILA for the world). */
  qila: SonarQila;
}

const wrapLine = (f: (x: number) => number): Pt[] => {
  const out: Pt[] = [];
  for (let x = -TW / 2; x <= TW / 2 + 1e-6; x += 2) out.push([x, f(x)]);
  return out;
};

/** The roads. */
export function zingleLayout(qila: SonarQila = lightToys(() => sonarQila())): ZingleLayout {
  const highway = wrapLine(hwZ);
  const ridge = wrapLine(ridgeZ);
  const onHw = (x: number): Pt => nearestOn(highway, x, hwZ(x));
  const onRidge = (x: number): Pt => nearestOn(ridge, x, ridgeZ(x));

  // ── Jaisalmer and Sonar Qila (west) ──
  const [qx, qz] = QILA;
  const rampFoot: Pt = [(qila.ramp.pts[0] as Pt)[0] + qx, (qila.ramp.pts[0] as Pt)[1] + qz];
  // J1: up from the highway past the havelis, past the foot of the qila's ramp, round the north
  // of the hill, west past Bada Bagh, and back down to the highway.
  const J1 = curve(
    [
      onHw(s(-385)),
      W(-385, -120),
      W(-384, -200),
      W(-383, -262),
      rampFoot,
      W(-380, -350),
      W(-388, -402),
      W(-432, -428),
      W(-500, -434),
      W(-575, -416),
      W(-640, -376),
      W(-690, -310),
      W(-714, -220),
      W(-712, -130),
      onHw(s(-705)),
    ],
    false,
  );
  // Sonar Qila's ramp (its foot on J1) and its lane, in the world, with their heights.
  const rampPts = qila.ramp.pts.map(([x, z]) => [x + qx, z + qz] as Pt);
  rampPts[0] = nearestOn(J1, (rampPts[0] as Pt)[0], (rampPts[0] as Pt)[1]);
  const lanePts = qila.lane.pts.map(([x, z]) => [x + qx, z + qz] as Pt);
  // J3: Jaisalmer's town lane, from J1 west and down to the highway.
  const J3 = curve(
    [nearestOn(J1, ...W(-384, -170)), W(-430, -176), W(-520, -172), W(-560, -125), onHw(s(-578))],
    false,
  );

  // ── Jodhpur (middle) ──
  const ring = curve(
    Array.from({ length: 14 }, (_, k) => {
      const a = (k / 14) * Math.PI * 2;
      return [CITY.x + Math.cos(a) * CITY.rx, CITY.z + Math.sin(a) * CITY.rz] as Pt;
    }),
    true,
  );
  // Lane A: from the highway straight up the twin pols' centre line, forking into two mirror
  // branches (the lane through the moon arch, the pols loop through the sun arch), on north to
  // the city's ring road.
  const PC: Pt = W(-10, -95);
  const pols = { x: PC[0], z: PC[1], yaw: 0 };
  const FZ = 18;
  const branch = (side: number): Pt[] => {
    const a = side * (POL_ARCHES[1] as number);
    const local: Pt[] = [
      [0, FZ],
      [a * 0.3, FZ - 6],
      [a * 0.88, FZ - 11],
      [a, 5],
      [a, -5],
      [a * 0.88, -(FZ - 11)],
      [a * 0.3, -(FZ - 6)],
      [0, -FZ],
    ];
    return curve(
      local.map(([x, z]) => [PC[0] + x, PC[1] + z] as Pt),
      false,
      2,
    );
  };
  const approach = curve([onHw(PC[0]), [PC[0], PC[1] + FZ + 8], [PC[0], PC[1] + FZ]], false);
  const ringS = nearestOn(ring, PC[0], CITY.z + CITY.rz, true);
  const beyond = curve(
    [[PC[0], PC[1] - FZ], [PC[0], PC[1] - FZ - 6], [PC[0], ringS[1] + 6], ringS],
    false,
  );
  const laneA = [...approach, ...branch(-1).slice(1), ...beyond.slice(1)];
  const polLoop = branch(1);
  // The cross street through the walled city (past Ghanta Ghar).
  const cross = curve(
    [
      nearestOn(ring, CITY.x - CITY.rx, CITY.z, true),
      W(-60, -256),
      W(20, -262),
      W(90, -256),
      nearestOn(ring, CITY.x + CITY.rx, CITY.z, true),
    ],
    false,
  );
  // North from the ring to Jaswant Thada and the ridge road.
  const north = curve(
    [nearestOn(ring, 0, CITY.z - CITY.rz, true), W(36, -420), W(100, -466), onRidge(s(140))],
    false,
  );

  // ── the south ──
  const country = curve(
    [
      onHw(s(-300)),
      W(-300, 60),
      W(-300, 160),
      W(-330, 300),
      W(-262, 400),
      W(-140, 388),
      W(-30, 368),
      W(60, 334),
      W(185, 282),
      W(300, 262),
      W(430, 250),
      W(530, 234),
      W(640, 202),
      W(720, 142),
      W(746, 40),
      onHw(s(764)),
    ],
    false,
  );
  const D5 = curve(
    [onHw(s(70)), W(70, 40), W(68, 150), W(62, 250), nearestOn(country, ...W(60, 334))],
    false,
  );
  const SR = railZ(STX) + 21;
  const station = curve(
    [nearestOn(country, s(-300), SR), [s(-250), SR], [STX, SR], [0, SR], nearestOn(D5, s(70), SR)],
    false,
  );
  // The fort's road: from the country road north over the moat bridge, through Suraj Pol, to
  // the court (where the toshakhana stands).
  const fx = FORT[0] + FORT_GATE[0];
  const fortRoad = curve(
    [
      nearestOn(country, fx, FORT[1] + 86),
      [fx, FORT[1] + FORT_BRIDGE_END[1]],
      [fx, FORT[1] + FORT_GATE[1]],
      [FORT[0] + FORT_INNER[0], FORT[1] + FORT_INNER[1]],
    ],
    false,
  );
  const southLoop = curve(
    [
      nearestOn(country, ...W(-262, 400)),
      W(-200, 530),
      W(-20, 546),
      W(130, 506),
      nearestOn(country, ...W(185, 282)),
    ],
    false,
  );

  // ── Jaipur (east): a grid of T-junctions only ──
  const P1 = curve(
    [onHw(s(380)), W(380, -200), W(380, -320), W(380, -430), onRidge(s(380))],
    false,
  );
  const P2 = curve(
    [onHw(s(640)), W(640, -200), W(640, -320), W(640, -430), onRidge(s(640))],
    false,
  );
  const street = (z: number) =>
    curve([nearestOn(P1, s(380), z), [s(510), z], nearestOn(P2, s(640), z)], false);
  const C1 = street(s(-200));
  const C2 = street(s(-320));
  const C3 = street(s(-430));
  const P3 = curve(
    [nearestOn(C1, ...W(500, -200)), W(500, -260), nearestOn(C2, ...W(500, -320))],
    false,
  );
  const P4 = curve(
    [nearestOn(C2, ...W(545, -320)), W(545, -375), nearestOn(C3, ...W(545, -430))],
    false,
  );
  const K1 = curve([onHw(s(532)), W(532, 100), nearestOn(country, ...W(532, 234))], false);
  const sambhar = curve(
    [
      nearestOn(country, ...W(430, 250)),
      W(470, 360),
      W(600, 374),
      W(700, 352),
      nearestOn(country, ...W(650, 198)),
    ],
    false,
  );

  // ── the dune sea ──
  const sand = curve(
    [
      W(-520, 300),
      W(-600, 380),
      W(-700, 330),
      W(-720, 220),
      W(-660, 110),
      W(-560, 90),
      W(-480, 150),
    ],
    true,
  );
  const S2 = curve([nearestOn(sand, ...W(-655, 105), true), W(-640, 30), onHw(s(-622))], false);
  const bivouac = curve(
    [nearestOn(sand, ...W(-488, 250), true), W(-430, 322), nearestOn(country, ...W(-333, 302))],
    false,
  );

  const roads: Record<RoadName, RoadSpec> = {
    hw: { name: "highway", pts: highway, half: 5, kind: "main", wraps: true, draw: "highway" },
    ridge: { name: "ridge road", pts: ridge, half: 2.2, kind: "main", wraps: true, draw: "road" },
    J1: { name: "Jaisalmer road", pts: J1, half: 1.9, kind: "main", draw: "road" },
    J3: { name: "Jaisalmer lane", pts: J3, half: 1.7, kind: "main", draw: "road" },
    ramp: {
      name: "qila ramp",
      pts: rampPts,
      half: qila.ramp.half,
      kind: "main",
      ys: qila.ramp.ys,
      draw: "qila",
    },
    lane: {
      name: "qila lane",
      pts: lanePts,
      half: qila.lane.half,
      kind: "lane",
      closed: true,
      ys: qila.lane.ys,
      draw: "qila",
    },
    ring: {
      name: "Jodhpur ring road",
      pts: ring,
      half: 1.9,
      kind: "main",
      closed: true,
      draw: "road",
    },
    A: { name: "lane A", pts: laneA, half: 1.7, kind: "main", draw: "road" },
    polLoop: { name: "pols loop", pts: polLoop, half: 1.7, kind: "main", fork: true, draw: "road" },
    cross: { name: "cross street", pts: cross, half: 1.7, kind: "main", draw: "road" },
    north: { name: "Thada road", pts: north, half: 1.7, kind: "main", draw: "road" },
    D5: { name: "dera road", pts: D5, half: 1.8, kind: "main", draw: "road" },
    station: { name: "station road", pts: station, half: 1.6, kind: "lane", draw: "road" },
    country: { name: "country road", pts: country, half: 2, kind: "main", draw: "road" },
    fortRoad: {
      name: "fort road",
      pts: fortRoad,
      half: 1.8,
      kind: "main",
      terminus: "end",
      draw: "road",
    },
    southLoop: { name: "south loop", pts: southLoop, half: 1.6, kind: "lane", draw: "road" },
    P1: { name: "Jaipur west avenue", pts: P1, half: 1.9, kind: "main", draw: "road" },
    P2: { name: "Jaipur east avenue", pts: P2, half: 1.9, kind: "main", draw: "road" },
    C1: { name: "Johari street", pts: C1, half: 1.7, kind: "main", draw: "road" },
    C2: { name: "middle street", pts: C2, half: 1.7, kind: "main", draw: "road" },
    C3: { name: "Hawa street", pts: C3, half: 1.7, kind: "main", draw: "road" },
    P3: { name: "Jaipur lane south", pts: P3, half: 1.5, kind: "lane", draw: "road" },
    P4: { name: "Jaipur lane north", pts: P4, half: 1.5, kind: "lane", draw: "road" },
    K1: { name: "Jantar road", pts: K1, half: 1.7, kind: "main", draw: "road" },
    sambhar: { name: "Sambhar road", pts: sambhar, half: 1.6, kind: "lane", draw: "road" },
    sand: { name: "sand track", pts: sand, half: 1.8, kind: "main", closed: true, draw: "sand" },
    S2: { name: "sand spur", pts: S2, half: 1.8, kind: "main", draw: "sand" },
    bivouac: { name: "bivouac lane", pts: bivouac, half: 1.6, kind: "lane", draw: "road" },
  };
  const list = ROAD_NAMES.map((n) => roads[n]);
  const RI = Object.fromEntries(ROAD_NAMES.map((n, i) => [n, i])) as Record<RoadName, number>;
  const foot: Pt = [FORT[0] + FORT_INNER[0], FORT[1] + FORT_INNER[1]];
  return { roads: list, RI, pols, foot, qila };
}

/**
 * Proves the roads are continuous and meet cleanly. Returns what's wrong (empty when all's well):
 *  - spacing: every segment 0.2–4 m (the strips are drawn through the points: a long gap dips);
 *  - smoothness: no kink sharper than `maxTurn` between consecutive segments;
 *  - ends: every end of an open road lies on another road's centreline (no dead ends, bar a
 *    terminus), at an interior point (never where that road ends too: a carry-on join is a
 *    notch), meeting it at `minJoin` or more (a shallow join leaves a long sliver; a symmetric
 *    Y fork, 12° or more);
 *  - no road crosses another away from a junction, nor runs alongside one.
 */
export function checkRoads(roads: RoadSpec[], { maxTurn = 18, minJoin = 25 } = {}): string[] {
  const issues: string[] = [];
  const deg = (r: number) => (r * 180) / Math.PI;
  const segs = (r: RoadSpec) => (r.closed ? r.pts.length : r.pts.length - 1);
  const pt = (r: RoadSpec, i: number) =>
    r.pts[((i % r.pts.length) + r.pts.length) % r.pts.length] as Pt;
  const ends = (r: RoadSpec): Pt[] =>
    r.closed || r.wraps ? [] : [r.pts[0] as Pt, r.pts[r.pts.length - 1] as Pt];
  for (const r of roads) {
    // Spacing and smoothness.
    for (let i = 0; i < segs(r); i++) {
      const a = pt(r, i);
      const b = pt(r, i + 1);
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > 4 || l < 0.2) issues.push(`${r.name}: segment ${i} is ${l.toFixed(2)} m long`);
    }
    const from = r.closed ? 0 : 1;
    const to = r.closed ? r.pts.length : r.pts.length - 1;
    for (let i = from; i < to; i++) {
      const a = pt(r, i - 1);
      const b = pt(r, i);
      const c = pt(r, i + 1);
      let t = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
      t = Math.min(t, Math.PI * 2 - t);
      if (deg(t) > maxTurn)
        issues.push(
          `${r.name}: kinks ${deg(t).toFixed(0)}° at (${b[0].toFixed(1)}, ${b[1].toFixed(1)})`,
        );
    }
    // Its ends.
    for (const [k, e] of ends(r).entries()) {
      const dir = (() => {
        const q = k === 0 ? (r.pts[2] as Pt) : (r.pts[r.pts.length - 3] as Pt);
        return Math.atan2(q[1] - e[1], q[0] - e[0]);
      })();
      const on = roads
        .filter((o) => o !== r)
        .map((o) => ({ o, n: nearest(o.pts, e[0], e[1], o.closed) }))
        .filter(({ n }) => n.d < 0.3);
      if (!on.length) {
        if (r.terminus !== (k === 0 ? "start" : "end"))
          issues.push(
            `${r.name}: its ${k === 0 ? "start" : "end"} at (${e[0].toFixed(1)}, ${e[1].toFixed(1)}) is a dead end`,
          );
        continue;
      }
      for (const { o, n } of on) {
        if (ends(o).some((q) => Math.hypot(q[0] - e[0], q[1] - e[1]) < o.half + r.half + 1))
          issues.push(
            `${r.name} carries straight on from ${o.name} (an end of each at one point): make them one road`,
          );
        const a = pt(o, n.i);
        const b = pt(o, n.i + 1);
        let j = Math.abs(dir - Math.atan2(b[1] - a[1], b[0] - a[0]));
        j = Math.min(j, Math.PI * 2 - j);
        j = Math.min(j, Math.PI - j);
        if (deg(j) < (r.fork ? 12 : minJoin))
          issues.push(`${r.name} meets ${o.name} at only ${deg(j).toFixed(0)}°`);
      }
    }
  }
  // Crossings and roads running alongside, away from the junctions.
  const junctions = roads.flatMap(ends);
  const nearJunction = (x: number, z: number, m: number) =>
    junctions.some((q) => Math.hypot(q[0] - x, q[1] - z) < m);
  for (let i = 0; i < roads.length; i++)
    for (let j = i + 1; j < roads.length; j++) {
      const a = roads[i] as RoadSpec;
      const b = roads[j] as RoadSpec;
      let close = 0;
      for (const p of a.pts) {
        if (nearJunction(p[0], p[1], a.half + b.half + 14)) continue;
        if (polyDist(b.pts, p[0], p[1], b.closed) < a.half + b.half + 0.5) close++;
      }
      if (close)
        issues.push(
          `${a.name} and ${b.name} cross or touch away from a junction (${close} points)`,
        );
    }
  return issues;
}
