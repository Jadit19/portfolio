/**
 * WinZO as a flat world: a circuit on the Greater Noida plains (layout L2,
 * "Expressway spine", from design/3d/winzo-board.ts). Dead-flat lilac ground.
 *
 *  - The circuit (our own: a long pit straight, a heavy-braking T1, esses, a
 *    long back straight, a wide sweeper and the hairpin) with kerbs on its
 *    corners, the pit lane and pit wall, garages, grandstands whose crowds do
 *    the wave, floodlight towers that pool the track at night, the start gantry.
 *  - The paddock behind the garages (race control, scrutineering, the tyre
 *    warehouse, the podium), reached by the ring road; the season-pass kiosk
 *    at its gate, a link road down to the pit lane.
 *  - The expressway curving along the south (it wraps), its toll plaza whose
 *    booms lift for you, and a dhaba beside it; an exit up to the market town
 *    (the fan market); a lane across the middle; a canal, bridged.
 *  - Mustard and sugarcane, brick kilns, villages, eucalyptus.
 *
 * Built a slice at a time (a generator), like the other flat worlds.
 */

import * as THREE from "three";
import {
  clay,
  flatShape,
  instancedToys,
  mix,
  ribbon,
  type ToySlot,
  tintShadow,
  toy,
} from "../../flat/kit";
import {
  findJunctions,
  type JourneyBuild,
  type JourneyDef,
  makeRoad,
  type Ramp,
  type Road,
  type V2,
  type WorldData,
} from "../journey";
import {
  gradedRoad,
  junctionAprons,
  roadColours,
  trimmedRoad,
  type WorldRoad,
} from "../ladakhWorld";
import type { Landmark } from "../landmarks";
import { join } from "../nature";
import { PASTEL as P } from "../palette";
import { at, ball, drum, type G, rbox } from "../toys";
import {
  assignCrops,
  type Bird,
  bands,
  bilerp,
  caneTrolley,
  disc,
  egret,
  estate,
  rng as farmRng,
  gush,
  jgrid,
  type Map2,
  peacock,
  peahen,
  pumpHouse,
  roadside,
  type Sub,
  tractor,
  withTrack,
} from "../winzoFarms";
import {
  ASPHALT,
  autoMarshal,
  bunting,
  floodlight,
  garages,
  grandstand,
  INDIA_GREEN,
  KART_LOOP,
  KERB_RED,
  kiln,
  roundRect,
  SAFFRON,
  startLights,
  TOLL_LANES,
  tollBoom,
  tyreArch,
  WINZO_GROUND,
  WINZO_LANDMARKS,
  type WinzoLandmark,
} from "../winzoLandmarks";
import { knockable, solidity } from "./expressoFlat";

const BASE = WINZO_GROUND;
const TW = 520;
const TD = 400;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
type Pt = [number, number];

// ── the layout ────────────────────────────────────────────────────────────

/**
 * The circuit, as straights and true circular arcs (local; the world puts it at +20, −80), so
 * every corner has a real radius: the inside edge and its kerb never fold back on themselves.
 * Two straights ("X", "Y") are solved so the loop closes exactly. Turns are in degrees.
 */
type Seg = { s: number | "X" | "Y" } | { r: number; turn: number };
const CIRCUIT_SEGS: Seg[] = [
  { s: 205 }, // the pit straight (start at its west end, running +x)
  { r: 26, turn: 90 }, // T1, heavy braking
  { s: 2 },
  { r: 20, turn: 60 }, // the esses
  { s: 6 },
  { r: 20, turn: -120 },
  { s: 8 },
  { r: 22, turn: 150 },
  { s: "X" }, // the back straight
  { r: 45, turn: 90 }, // the wide sweeper
  { s: "Y" },
  { r: 25, turn: 90 },
  { s: 25 },
  { r: 14, turn: -180 }, // the hairpin
  { s: 30 },
  { r: 14, turn: 180 }, // the last corner, onto the pit straight
];
/** Which segment is the hairpin. */
const HAIRPIN_SEG = 13;

/** Walks the segments from `start` (heading +x), points every ~`step` m; and each segment's first point. */
function turtle(start: Pt, segs: Seg[], step = 2.5): { pts: Pt[]; first: number[] } {
  const run = (X: number, Y: number, pts?: Pt[], first?: number[]): Pt => {
    let [x, z] = start;
    let h = 0;
    for (const g of segs) {
      first?.push(pts?.length ?? 0);
      if ("s" in g) {
        const L = g.s === "X" ? X : g.s === "Y" ? Y : g.s;
        const n = Math.max(1, Math.round(L / step));
        for (let k = 0; k < n; k++) {
          pts?.push([x, z]);
          x += (Math.cos(h) * L) / n;
          z += (Math.sin(h) * L) / n;
        }
      } else {
        const a = (g.turn * Math.PI) / 180;
        const n = Math.max(2, Math.round((Math.abs(a) * g.r) / step));
        const sg = Math.sign(a);
        const cx = x - Math.sin(h) * g.r * sg;
        const cz = z + Math.cos(h) * g.r * sg;
        for (let k = 0; k < n; k++) {
          pts?.push([x, z]);
          h += a / n;
          x = cx + Math.sin(h) * g.r * sg;
          z = cz - Math.cos(h) * g.r * sg;
        }
      }
    }
    return [x - start[0], z - start[1]];
  };
  // The miss is linear in the two free straights: solve for the lengths that close the loop.
  const e0 = run(0, 0);
  const ex = run(1, 0);
  const ey = run(0, 1);
  const ax = ex[0] - e0[0];
  const az = ex[1] - e0[1];
  const bx = ey[0] - e0[0];
  const bz = ey[1] - e0[1];
  const det = ax * bz - az * bx;
  const X = (-e0[0] * bz + e0[1] * bx) / det;
  const Y = (-ax * e0[1] + az * e0[0]) / det;
  const pts: Pt[] = [];
  const first: number[] = [];
  run(X, Y, pts, first);
  return { pts, first };
}
const CX = 20;
const CZ = -80;
/** India Gate's centre (world), between the canal and the expressway, east of the middle. */
const GATE: Pt = [130, 76];
/** The pit straight's z (world), and its run in x. */
const PIT_Z = -55 + CZ;

/** The expressway's sweep: periodic across the tile, so it wraps without a kink. */
const sweepZ = (x: number) =>
  128 + 22 * Math.cos((2 * Math.PI * x) / TW) + 6 * Math.sin((4 * Math.PI * x) / TW);
/**
 * The expressway's line. It runs dead straight and level (east–west) for 24 m either side of
 * India Gate's avenue, so the avenue meets it at a right angle, and eases back into its sweep
 * over the next 50 m (a smootherstep, so the bend has no kink).
 */
const hwZ = (x: number) => {
  const d = Math.abs(((((x - GATE[0]) % TW) + TW * 1.5) % TW) - TW / 2);
  const t = Math.min(1, Math.max(0, (d - 24) / 50));
  const w = 1 - t * t * t * (t * (t * 6 - 15) + 10);
  return sweepZ(x) + (sweepZ(GATE[0]) - sweepZ(x)) * w;
};
/** The canal's line (wraps too). */
const canalZ = (x: number) => 40 + 4 * Math.sin((2 * Math.PI * x) / TW);

function curve(ctrl: Pt[], closed: boolean, spacing = 2.5): Pt[] {
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
function offset(pts: Pt[], d: number, closed: boolean): Pt[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)] as Pt;
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)] as Pt;
    const tx = b[0] - a[0];
    const tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    return [p[0] + (-tz / l) * d, p[1] + (tx / l) * d];
  });
}

/** Distance from a point to a polyline. */
function polyDist(pts: Pt[], x: number, z: number, closed = false): number {
  let best = 1e9;
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i] as Pt;
    const b = pts[(i + 1) % n] as Pt;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z));
  }
  return best;
}

/** The point of a polyline nearest (x, z). */
function nearestOn(pts: Pt[], x: number, z: number): Pt {
  let best: Pt = pts[0] as Pt;
  let bd = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as Pt;
    const b = pts[i + 1] as Pt;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    const q: Pt = [a[0] + dx * t, a[1] + dz * t];
    const d = Math.hypot(q[0] - x, q[1] - z);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

/** A seeded random. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** A stone bridge over the canal (deck, parapets), along local z, `len` long. */
function stoneBridge(len: number, width: number): G {
  return join([
    at(rbox(width, 0.5, len, P.stone, 0.12), 0, 0.1, 0),
    at(rbox(0.4, 0.7, len, P.cream, 0.1), -width / 2 - 0.1, 0.5, 0),
    at(rbox(0.4, 0.7, len, P.cream, 0.1), width / 2 + 0.1, 0.5, 0),
  ]);
}

// ── the build ─────────────────────────────────────────────────────────────

function* build(scene: THREE.Scene): Generator<unknown, JourneyBuild, unknown> {
  yield;
  const mat = clay(BASE);
  // Every shadow darkens what it falls on (lilac to the usual shadow, a lawn to darker green,
  // a plaza to darker gold), and overlapping pieces shade once.
  const shadow = tintShadow(BASE, mix(BASE, P.ink, 0.13));
  const H = (_x: number, _z: number) => 0;
  /** India Gate's lawn colour. */
  const LAWN = "#b9dfa6";
  /** A static piece with its cut-paper shadow, kept exactly where it's put. */
  const place = (geo: G, x: number, z: number, yaw = 0, s = 1, y = 0, sh = shadow) => {
    for (const m of [mat, sh]) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.rotation.y = yaw;
      mesh.scale.setScalar(s);
      mesh.frustumCulled = m !== sh;
      mesh.userData.spansRoad = true;
      scene.add(mesh);
    }
  };
  /** Flat things lying on the land (roads, water, fields): never nudged off the roads. */
  const lay = (...objs: THREE.Object3D[]) => {
    for (const o of objs) {
      o.userData.spansRoad = true;
      scene.add(o);
    }
  };

  // ── roads ──
  const track = turtle([-100 + CX, PIT_Z], CIRCUIT_SEGS);
  const circuit = track.pts;
  // The pit lane, a little outside the pit straight, leaving and rejoining the circuit.
  const pitLane = curve(
    [
      [-76 + CX, PIT_Z],
      [-64 + CX, PIT_Z - 5],
      [-48 + CX, PIT_Z - 9],
      [70 + CX, PIT_Z - 9],
      [86 + CX, PIT_Z - 5],
      [98 + CX, PIT_Z],
    ],
    false,
  );
  const highway: Pt[] = [];
  // Every 2 m, so its curves read as smooth arcs, not facets.
  for (let x = -TW / 2; x <= TW / 2 + 1e-6; x += 2) highway.push([x, hwZ(x)]);
  const exitX = -70;
  const eastX = 214;
  const PADDOCK_Z = PIT_Z - 37;
  const ring = curve(
    [
      [exitX, hwZ(exitX)],
      [-95, 100],
      [-150, 72],
      [-205, 30],
      [-212, -50],
      [-180, -132],
      [-120, PADDOCK_Z - 2],
      [-60, PADDOCK_Z],
      [60, PADDOCK_Z],
      [170, PADDOCK_Z - 2],
      [222, -130],
      [240, -40],
      [236, 60],
      [eastX, hwZ(eastX)],
    ],
    false,
  );
  // Every road that ends on another ends exactly on its centreline (no dead ends).
  const lane = curve(
    [
      nearestOn(ring, -150, 72),
      [-118, 30],
      [-60, 21],
      [10, 26],
      [90, 21],
      [160, 26],
      nearestOn(ring, 239, 2),
    ],
    false,
  );
  // The paddock link down to the pit lane (west of the garages).
  const link = curve(
    [nearestOn(ring, -28, PADDOCK_Z), [-27, PADDOCK_Z + 14], nearestOn(pitLane, -26, PIT_Z - 9)],
    false,
  );
  const kart = KART_LOOP.map(([x, z]) => [x + CX, z + CZ + 22] as Pt);
  // India Gate: a true circle of a roundabout round the gate, an avenue up to it from the
  // expressway and on north from it to the lane (over the canal).
  const ROUND_R = 17;
  const roundabout = curve(
    Array.from({ length: 24 }, (_, k) => {
      const a = (k / 24) * Math.PI * 2;
      return [GATE[0] + Math.cos(a) * ROUND_R, GATE[1] + Math.sin(a) * ROUND_R] as Pt;
    }),
    true,
  );
  const avenue = curve(
    [
      nearestOn(highway, GATE[0], hwZ(GATE[0])),
      [GATE[0], GATE[1] + ROUND_R + 12],
      nearestOn(roundabout, GATE[0], GATE[1] + ROUND_R),
    ],
    false,
  );
  const avenueN = curve(
    [
      nearestOn(roundabout, GATE[0], GATE[1] - ROUND_R),
      [GATE[0], 36],
      nearestOn(lane, GATE[0], 24),
    ],
    false,
  );

  /** The roads, as the junction and strip helpers want them (y 0, uniform surface). */
  type Spec = {
    pts: Pt[];
    half: number;
    kind: WorldRoad["kind"];
    closed?: boolean;
    draw: "track" | "pit" | "highway" | "road";
  };
  const specs: Spec[] = [
    { pts: circuit, half: 4.5, kind: "main", closed: true, draw: "track" },
    { pts: pitLane, half: 2.2, kind: "main", draw: "pit" },
    { pts: highway, half: 6, kind: "main", draw: "highway" },
    { pts: ring, half: 2.2, kind: "main", draw: "road" },
    { pts: lane, half: 1.6, kind: "lane", draw: "road" },
    { pts: link, half: 2, kind: "main", draw: "road" },
    { pts: kart, half: 1.6, kind: "main", closed: true, draw: "pit" },
    { pts: roundabout, half: 2.6, kind: "main", closed: true, draw: "road" },
    { pts: avenue, half: 3, kind: "main", draw: "road" },
    { pts: avenueN, half: 2.4, kind: "main", draw: "road" },
  ];
  const worldRoads: WorldRoad[] = specs.map((s) => ({
    pts: s.pts.map(([x, z]) => [x, 0, z] as [number, number, number]),
    grit: s.pts.map(() => 0),
    half: s.half,
    kind: s.kind,
  }));
  /** Clear of every road by `m` metres? */
  const offRoad = (x: number, z: number, m: number) =>
    specs.every((s) => polyDist(s.pts, x, z, s.closed) > s.half + m);
  yield;

  // ── the land: canal, fields, roads drawn ──
  const canal: Pt[] = [];
  for (let x = -TW / 2 - 4; x <= TW / 2 + 4; x += 4) canal.push([x, canalZ(x)]);
  lay(
    ribbon(canal, 4.2, mix(BASE, "#f4dcb8", 0.55), 0.002),
    ribbon(canal, 3, mix(P.aqua, "#ffffff", 0.4), 0.003),
    ribbon(canal, 1.6, P.aqua, 0.004),
  );
  // The circuit: asphalt, white edge lines, kerbs on the corners.
  const TRACK = ASPHALT;
  lay(ribbon([...circuit, circuit[0] as Pt], 4.5, TRACK, 0.03));
  for (const s of [-1, 1])
    lay(
      ribbon(
        [...offset(circuit, s * 4.2, true), offset(circuit, s * 4.2, true)[0] as Pt],
        0.1,
        "#ffffff",
        0.035,
      ),
    );
  {
    // Kerbs: continuous strips along both edges of every corner, alternating red and white
    // every segment (~2.5 m). Strips (not blocks) follow even the hairpin's tight inside.
    const n = circuit.length;
    const corner = circuit.map((_, i) => {
      const a = circuit[(i - 3 + n) % n] as Pt;
      const b = circuit[i] as Pt;
      const c = circuit[(i + 3) % n] as Pt;
      const h1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const h2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let d = Math.abs(h2 - h1);
      d = Math.min(d, Math.PI * 2 - d);
      return d > 0.1;
    });
    const pos: Record<"red" | "white", number[]> = { red: [], white: [] };
    for (const s2 of [-1, 1]) {
      const inner = offset(circuit, s2 * 4.5, true);
      const outer = offset(circuit, s2 * 5.4, true);
      for (let i = 0; i < n; i++) {
        if (!corner[i] && !corner[(i + 1) % n]) continue;
        const j = (i + 1) % n;
        const a = inner[i] as Pt;
        const b = inner[j] as Pt;
        const c = outer[j] as Pt;
        const d = outer[i] as Pt;
        // On a bend tighter than the kerb's offset, the edge loops back on itself: skip it there.
        const m0 = circuit[i] as Pt;
        const m1 = circuit[j] as Pt;
        const fwd = (p: Pt, q: Pt) =>
          (q[0] - p[0]) * (m1[0] - m0[0]) + (q[1] - p[1]) * (m1[1] - m0[1]) > 0;
        if (!fwd(a, b) || !fwd(d, c)) continue;
        const list = pos[i % 2 ? "red" : "white"];
        const y = 0.045;
        list.push(
          a[0],
          y,
          a[1],
          b[0],
          y,
          b[1],
          c[0],
          y,
          c[1],
          a[0],
          y,
          a[1],
          c[0],
          y,
          c[1],
          d[0],
          y,
          d[1],
        );
      }
    }
    for (const [k, colour] of [
      ["red", KERB_RED],
      ["white", "#ffffff"],
    ] as const) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos[k], 3));
      const mesh = new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide, toneMapped: false }),
      );
      lay(mesh);
    }
  }
  // The other roads: strips cut where they meet another, fillets at the corners.
  for (const [ri, s] of specs.entries()) {
    if (s.draw === "track") continue;
    if (s.draw === "highway") {
      // Drawn over the roads that join it (above their strips and fillets): a road's end is
      // cut square, so where it meets at a slant one corner would poke out over the carriageway.
      lay(ribbon(s.pts, s.half, mix(ASPHALT, "#ffffff", 0.35), 0.16));
      for (const d of [-3, 0, 3]) {
        const dashes = offset(s.pts, d, false);
        for (let i = 0; i < dashes.length - 1; i += 3)
          lay(ribbon([dashes[i] as Pt, dashes[i + 1] as Pt], 0.08, "#ffffff", 0.165));
      }
      continue;
    }
    if (s.closed) {
      const r = worldRoads[ri] as WorldRoad;
      const colour =
        s.draw === "road"
          ? `#${(roadColours(r)[0] as THREE.Color).getHexString()}`
          : mix(ASPHALT, "#ffffff", 0.3);
      lay(ribbon([...s.pts, s.pts[0] as Pt], s.half, colour, 0.03));
      continue;
    }
    if (s.draw === "pit") {
      // The pit lane runs on under the track at both mouths: the track and its white edge
      // line paint over it, like a real pit exit, with no apron or wedge at a shallow merge.
      lay(ribbon(s.pts, s.half, mix(ASPHALT, "#ffffff", 0.3), 0.02));
      continue;
    }
    const cut = trimmedRoad(worldRoads, ri);
    const r = worldRoads[ri] as WorldRoad;
    const all = roadColours(r);
    const cols = cut.orig.map((i) => all[i] as THREE.Color);
    const m = gradedRoad(cut.pts, cols, s.half, s.kind === "lane" ? 0.04 : 0.06);
    if (m) lay(m);
  }
  // Fillets only between the ordinary roads (the pit lane's mouths go under the track).
  for (const a of junctionAprons(worldRoads.filter((_, i) => specs[i]?.draw !== "track")))
    lay(flatShape(a.pts, `#${a.colour.getHexString()}`, a.y + (a.band ? 0.08 : 0.075)));
  yield;

  // ── bridges where roads cross the canal ──
  const bridges: { x: number; z: number; yaw: number; len: number; width: number }[] = [];
  for (const s of specs) {
    if (s.closed || s.draw === "highway") continue;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [ax, az] = s.pts[i] as Pt;
      const [bx, bz] = s.pts[i + 1] as Pt;
      const ca = az - canalZ(ax);
      const cb = bz - canalZ(bx);
      if (ca * cb > 0) continue;
      const f = ca / (ca - cb);
      const x = ax + (bx - ax) * f;
      const z = az + (bz - az) * f;
      const yaw = Math.atan2(bx - ax, bz - az);
      bridges.push({ x, z, yaw, len: 9, width: s.half * 2 + 0.6 });
    }
  }
  for (const b of bridges) place(stoneBridge(b.len, b.width), b.x, b.z, b.yaw);
  yield;

  // ── the landmarks ──
  const blockers: WorldData["blockers"] = [];
  const walls: [number, number, number, number][] = [];
  const lamps: NonNullable<WorldData["lamps"]> = [];
  const houses: NonNullable<WorldData["mapArt"]>["houses"] = [];
  const living: THREE.Object3D[] = [];
  const toWorld = (ox: number, oz: number, yaw: number, lx: number, lz: number): Pt => {
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    return [ox + lx * c + lz * sn, oz - lx * sn + lz * c];
  };
  /** A site beside a road: `d` metres off it (+ left), at distance `s` along, facing it. */
  const beside = (pts: Pt[], s: number, d: number): { x: number; z: number; yaw: number } => {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] as Pt;
      const b = pts[i + 1] as Pt;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc + l >= s || i === pts.length - 2) {
        const f = Math.min(1, (s - acc) / (l || 1));
        const tx = (b[0] - a[0]) / (l || 1);
        const tz = (b[1] - a[1]) / (l || 1);
        const x = a[0] + (b[0] - a[0]) * f + -tz * d;
        const z = a[1] + (b[1] - a[1]) * f + tx * d;
        // Facing the road: local +z points back at it.
        const yaw = Math.atan2(tz * Math.sign(d), -tx * Math.sign(d));
        return { x, z, yaw };
      }
      acc += l;
    }
    const p = pts[0] as Pt;
    return { x: p[0], z: p[1], yaw: 0 };
  };
  const along = (pts: Pt[], x: number) => {
    // Distance along a polyline to its point nearest x (the paddock road runs along x).
    let acc = 0;
    let best = { s: 0, d: 1e9 };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] as Pt;
      const b = pts[i + 1] as Pt;
      const d = Math.abs(a[0] - x) + (Math.abs(a[1] - PADDOCK_Z) < 8 ? 0 : 1e6);
      if (d < best.d) best = { s: acc, d };
      acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return best.s;
  };
  /** Distance along a polyline to its point nearest (x, z). */
  const sAt = (pts: Pt[], x: number, z: number) => {
    let acc = 0;
    let best = { s: 0, d: 1e9 };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] as Pt;
      const b = pts[i + 1] as Pt;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const t = Math.min(
        1,
        Math.max(0, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (l * l || 1)),
      );
      const d = Math.hypot(a[0] + (b[0] - a[0]) * t - x, a[1] + (b[1] - a[1]) * t - z);
      if (d < best.d) best = { s: acc + l * t, d };
      acc += l;
    }
    return best.s;
  };
  /** Room for a landmark of this size here: clear of roads, the canal, the circuit, the paddock strip. */
  const roomFor = (x: number, z: number, r: number) =>
    offRoad(x, z, r - 1) &&
    Math.abs(z - canalZ(x)) > 2 + r &&
    polyDist(circuit, x, z, true) > 4.5 + 3 + r &&
    Math.hypot(x - GATE[0], z - GATE[1]) > ROUND_R + 6 + r;
  /** A landmark beside road `ri` near (x, z), on whichever side has room (left first). */
  const besideNear = (key: WinzoLandmark, ri: number, x: number, z: number, gap = 2): Site => {
    const sp = specs[ri] as Spec;
    const lm = WINZO_LANDMARKS[key].make();
    const s0 = sAt(sp.pts, x, z);
    const d = sp.half + gap + lm.half[1];
    const r0 = Math.hypot(lm.half[0], lm.half[1]);
    for (const side of [1, -1]) {
      const b = beside(sp.pts, s0, side * d);
      if (roomFor(b.x, b.z, r0)) return { key, ...b, road: ri };
    }
    return { key, ...beside(sp.pts, s0, d), road: ri };
  };
  type Site = { key: WinzoLandmark; x: number; z: number; yaw: number; road: number };
  const sites: Site[] = [];
  // The stops spread round the world (S2): scrutineering at the paddock's west end, race
  // control at the north-east corner over T1, the tyre depot on the lane through the middle,
  // the ZoPass kiosk at the west gate. (They were 14–55 m apart, all in the paddock.)
  sites.push(besideNear("scrut", 3, -104, -176));
  sites.push(besideNear("flags", 3, 222, -130));
  sites.push(besideNear("tyres", 4, 10, 26));
  sites.push(besideNear("pass", 3, -210, 16, 2.4));
  {
    // The podium, behind the garages (facing the paddock road, so local +z is −z).
    const lm = WINZO_LANDMARKS.podium.make();
    const b = beside(ring, along(ring, 66), 2.2 + 2 + lm.half[1]);
    sites.push({ key: "podium", ...b, road: 3 });
  }
  // India Gate at the centre of its roundabout, facing down the avenue (+z).
  sites.push({ key: "indiagate", x: GATE[0], z: GATE[1], yaw: 0, road: 7 });
  {
    // The fan market in the town, beside the exit road.
    const fm = beside(ring, 60, -(2.2 + 2.2 + 1.6));
    sites.push({ key: "merch", ...fm, road: 3 });
  }
  // The toll plaza across the expressway (its lanes run along local z), the dhaba beside it.
  {
    const x = 0;
    const tx = 4;
    const tz = hwZ(x + 2) - hwZ(x - 2);
    sites.push({ key: "toll", x, z: hwZ(x), yaw: Math.atan2(tx, tz), road: 2 });
    const d = beside(highway, (TW / 2 + 46) * 1.0, 6 + 2 + 3.2);
    sites.push({ key: "dhaba", ...d, road: 2 });
  }
  // The start gantry across the pit straight; the hairpin's marshal post outside the bend.
  sites.push({ key: "gantry", x: 40 + CX, z: PIT_Z, yaw: Math.PI / 2, road: 0 });
  {
    // The hairpin's apex (the middle of its arc), and outward from it.
    const bi = Math.round(
      ((track.first[HAIRPIN_SEG] as number) + (track.first[HAIRPIN_SEG + 1] as number)) / 2,
    );
    const n = circuit.length;
    const a = circuit[(bi - 2 + n) % n] as Pt;
    const c = circuit[(bi + 2) % n] as Pt;
    const p = circuit[bi] as Pt;
    // Outward: away from the mean of its neighbours (the bend's centre is on the inside).
    let ox = p[0] - (a[0] + c[0]) / 2;
    let oz = p[1] - (a[1] + c[1]) / 2;
    const ol = Math.hypot(ox, oz) || 1;
    ox /= ol;
    oz /= ol;
    const lm = WINZO_LANDMARKS.hairpin.make();
    const dist = 4.5 + 4 + lm.half[1];
    sites.push({
      key: "hairpin",
      x: p[0] + ox * dist,
      z: p[1] + oz * dist,
      yaw: Math.atan2(-ox, -oz),
      road: 0,
    });
  }
  // The kart loop in the infield (its own little track; the sign faces the pits).
  sites.push({ key: "kart", x: CX, z: CZ + 22, yaw: 0, road: 6 });

  const made = new Map<WinzoLandmark, Landmark>();
  for (const s of sites) {
    const lm = WINZO_LANDMARKS[s.key].make();
    made.set(s.key, lm);
    const holder = new THREE.Group();
    holder.position.set(s.x, 0, s.z);
    holder.rotation.y = s.yaw;
    holder.userData.spansRoad = true;
    for (const m of [mat, shadow]) {
      const mesh = new THREE.Mesh(lm.body, m);
      mesh.frustumCulled = m !== shadow;
      holder.add(mesh);
    }
    // Flat paint (plazas, lawns) has no shadow of its own (it would cover itself).
    if (lm.flats) holder.add(new THREE.Mesh(lm.flats, mat));
    for (const sg of lm.signs) holder.add(sg);
    scene.add(holder);
    for (const [lx, lz, r] of lm.solids) {
      const [x, z] = toWorld(s.x, s.z, s.yaw, lx, lz);
      blockers.push({ x, z, r });
    }
    for (const l of lm.lamps) {
      const [x, z] = toWorld(s.x, s.z, s.yaw, l.x, l.z);
      lamps.push({ x, y: l.y, z, r: l.r });
    }
    if (s.key === "dhaba") {
      // Its neem, shading the charpais.
      const [x, z] = toWorld(s.x, s.z, s.yaw, 2.6, -1.4);
      place(toy("T9"), x, z, s.yaw);
      blockers.push({ x, z, r: 0.7 });
    }
    if (s.key !== "kart" && s.key !== "gantry" && s.key !== "toll" && s.key !== "indiagate")
      houses.push({ x: s.x, z: s.z, yaw: s.yaw, s: Math.max(...lm.half) * 0.8 });
  }
  // The start lights on the gantry: they run the start sequence as a bike rolls up to the grid.
  {
    const s = sites.find((k) => k.key === "gantry") as Site;
    const { obj, reds, green } = startLights();
    obj.position.set(s.x, 0, s.z);
    obj.rotation.y = s.yaw;
    obj.userData.lights = { reds, green };
    obj.userData.spansRoad = true;
    living.push(obj);
  }
  /** The point `s` along a polyline and the way it runs there. */
  const pointAt = (pts: Pt[], s: number) => {
    const b = beside(pts, s, 0);
    const c = beside(pts, s + 1, 0);
    const l = Math.hypot(c.x - b.x, c.z - b.z) || 1;
    return { x: b.x, z: b.z, tx: (c.x - b.x) / l, tz: (c.z - b.z) / l };
  };
  /** Places `geo` on road `ri` at `s` along, its local x along the road. */
  const onRoad = (geo: G, ri: number, s: number) => {
    const q = pointAt((specs[ri] as Spec).pts, s);
    const yaw = Math.atan2(-q.tz, q.tx);
    place(geo, q.x, q.z, yaw);
    return { ...q, yaw };
  };
  // The tyre arch over the lane just past the tyre depot (you ride through it).
  {
    const s = sites.find((k) => k.key === "tyres") as Site;
    const sp = specs[s.road] as Spec;
    const at0 = sAt(sp.pts, s.x, s.z) + WINZO_LANDMARKS.tyres.make().half[0] + 4;
    const span = 9.2;
    const q = onRoad(tyreArch(span), s.road, at0);
    for (const side of [-1, 1])
      blockers.push({
        x: q.x - q.tz * (span / 2) * side,
        z: q.z + q.tx * (span / 2) * side,
        r: 0.9,
      });
  }
  // Bazaar bunting over the road at the fan market (near-side poles only at the ends).
  {
    const s = sites.find((k) => k.key === "merch") as Site;
    const sp = specs[s.road] as Spec;
    const len = 14;
    const w = sp.half + 1.8;
    const s0 = sAt(sp.pts, s.x, s.z);
    // Which side the market is on (bunting's near side is local +z).
    const q0 = pointAt(sp.pts, s0);
    const left = -q0.tz * (s.x - q0.x) + q0.tx * (s.z - q0.z) > 0;
    const { geo, poles } = bunting(len, w, 7);
    const yaw = Math.atan2(-q0.tz, q0.tx) + (left ? Math.PI : 0);
    place(geo, q0.x, q0.z, yaw);
    for (const [lx, lz] of poles) {
      const [x, z] = toWorld(q0.x, q0.z, yaw, lx, lz);
      blockers.push({ x, z, r: 0.25 });
    }
  }
  // India Gate's avenue: lawns, two long canals and rows of round trees either side, from the
  // expressway up to the roundabout (and trees on north to the lane).
  {
    const [gx, gz] = GATE;
    const roundTree = join([
      at(drum(0.15, 0.7, "#8a6a52", 0.02, 6), 0, 0, 0),
      at(ball(1.1, P.fern, 1, 1.25, 1), 0, 0.5, 0),
    ]);
    const z0 = gz + ROUND_R + 3;
    // Both sides end on one straight line along the expressway (straight and square to the
    // avenue here), closed by a paved walk.
    const z1 = hwZ(gx) - 6 - 3.5;
    // One lawn: its top edge follows the roundabout's outer edge (no gap of bare ground), its
    // bottom corners rounded, with the paved walk set inside its far end.
    const rimR = ROUND_R + 2.4;
    const lawn: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const dx = -15 + (30 * i) / 24;
      lawn.push([gx + dx, gz + Math.sqrt(rimR * rimR - dx * dx)]);
    }
    for (const [x, z] of roundRect(-15, z1 - 30, 15, z1 + 2.4, 2.5).slice(7, 21))
      lawn.push([gx + x, z]);
    lay(flatShape(lawn, LAWN, 0.004));
    lay(
      flatShape(
        roundRect(gx - 14, z1, gx + 14, z1 + 1.4, 0.7) as Pt[],
        mix(LAWN, "#f4e6c8", 0.75),
        0.005,
      ),
    );
    for (const sx of [-1, 1]) {
      lay(
        flatShape(
          roundRect(
            gx + Math.min(sx * 9, sx * 11.4),
            z0 + 1,
            gx + Math.max(sx * 9, sx * 11.4),
            z1 - 1,
            1.1,
          ) as Pt[],
          "#8fd3e0",
          0.008,
        ),
      );
      for (const dx of [6.2, 13.4])
        for (let z = z0 + 1.6; z < z1 - 1; z += 3.2) {
          place(roundTree, gx + sx * dx, z, 0, 1, 0);
          blockers.push({ x: gx + sx * dx, z, r: 0.5 });
        }
      for (let z = gz - ROUND_R - 4; z > 28; z -= 3.6) {
        if (Math.abs(z - canalZ(gx)) < 6) continue;
        place(roundTree, gx + sx * 5.5, z);
        blockers.push({ x: gx + sx * 5.5, z, r: 0.5 });
      }
    }
  }
  // The toll booms: one per lane, pivoting on the island to its right, lifting as you pass.
  {
    const s = sites.find((k) => k.key === "toll") as Site;
    for (const lx of TOLL_LANES) {
      const { arm, flash } = tollBoom();
      const g = new THREE.Group();
      const [x, z] = toWorld(s.x, s.z, s.yaw, lx + 1.5, 1.8);
      g.position.set(x, 0, z);
      g.rotation.y = s.yaw;
      arm.material = mat;
      g.add(arm, flash);
      g.userData.gate = { arm, flash };
      g.userData.spansRoad = true;
      living.push(g);
    }
  }
  yield;

  // ── the circuit's dressing ──
  // The pit wall between the track and the pit lane (solid: you leave by the pit exit).
  {
    const x0 = -42 + CX;
    const x1 = 64 + CX;
    const z = PIT_Z - 5;
    place(join([at(rbox(x1 - x0, 1.1, 0.4, P.cream, 0.06), 0, 0, 0)]), (x0 + x1) / 2, z);
    for (let x = x0 + 1.5; x < x1; x += 3)
      place(
        at(rbox(1.4, 0.35, 0.05, ((x / 3) | 0) % 2 ? SAFFRON : INDIA_GREEN, 0.01), 0, 1.1, 0.21),
        x,
        z,
      );
    walls.push([x0, z, x1, z]);
  }
  // Garages behind the pit lane, fronts to the track.
  place(garages(11), 30 + CX, PIT_Z - 18);
  walls.push(
    [30 + CX - 23.2, PIT_Z - 15, 30 + CX + 23.2, PIT_Z - 15],
    [30 + CX - 23.2, PIT_Z - 21, 30 + CX + 23.2, PIT_Z - 21],
  );
  // Grandstands on the infield side of the pit straight, facing the pits; their crowds wave.
  for (const [x, len] of [
    [-18 + CX, 30],
    [26 + CX, 30],
    [72 + CX, 26],
  ] as const) {
    const { stand, crowd } = grandstand(len, 6, mat);
    const z = PIT_Z + 4.5 + 3;
    place(stand, x, z, Math.PI);
    for (const part of [...crowd.children]) {
      part.position.set(x, 0, z);
      part.rotation.y = Math.PI;
      part.userData.spansRoad = true;
      living.push(part);
    }
    blockers.push(
      ...Array.from({ length: Math.ceil(len / 4) }, (_, i) => ({
        x: x - len / 2 + 2 + i * 4,
        z: z + 3.5,
        r: 3,
      })),
    );
  }
  // Floodlight towers round the circuit (outside, every ~45 m), pooling the track at night.
  {
    const n = circuit.length;
    for (let i = 0; i < n; i += 18) {
      const a = circuit[(i - 1 + n) % n] as Pt;
      const b = circuit[(i + 1) % n] as Pt;
      const p = circuit[i] as Pt;
      const tx = b[0] - a[0];
      const tz = b[1] - a[1];
      const l = Math.hypot(tx, tz) || 1;
      // The outside: away from the circuit's middle.
      let nx = -tz / l;
      let nz = tx / l;
      const mx = CX - 5;
      const mz = CZ + 15;
      if (nx * (p[0] - mx) + nz * (p[1] - mz) < 0) {
        nx = -nx;
        nz = -nz;
      }
      const x = p[0] + nx * 9.5;
      const z = p[1] + nz * 9.5;
      if (!offRoad(x, z, 1.2)) continue;
      place(floodlight(), x, z, Math.atan2(-nx, -nz));
      blockers.push({ x, z, r: 0.5 });
      lamps.push({ x: p[0], y: 0, z: p[1], r: 15 });
    }
  }
  // Start grid boxes behind the gantry, and the start line: flat paint just above the track
  // (a slab level with the track surface fought it and flickered).
  for (let r = 0; r < 4; r++)
    for (const s of [-1, 1]) {
      const gx = 40 + CX - 4 - r * 6 - (s > 0 ? 3 : 0);
      const gz = PIT_Z + s * 2;
      lay(
        ribbon(
          [
            [gx, gz - 0.8],
            [gx, gz + 0.8],
          ],
          0.06,
          "#ffffff",
          0.036,
        ),
      );
    }
  const lineX = 40 + CX + 0.6;
  lay(
    ribbon(
      [
        [lineX, PIT_Z - 4.5],
        [lineX, PIT_Z + 4.5],
      ],
      0.25,
      "#ffffff",
      0.036,
    ),
  );
  // A marshal auto at T1, the chai stall behind the paddock.
  place(autoMarshal(), 150 + CX, -36 + CZ, -1.2);
  blockers.push({ x: 150 + CX, z: -36 + CZ, r: 1.2 });
  place(toy("H4"), -40, PADDOCK_Z - 9, 0);
  place(toy("C1"), -46, PADDOCK_Z - 6, 0.4);
  blockers.push({ x: -40, z: PADDOCK_Z - 9, r: 1.6 });
  yield;

  // ── the plains: fields, kilns, villages, the town, trees ──
  const r = rng(11);
  type Toy = { id: string; tint?: string; x: number; z: number; yaw: number; scale: number };
  const toys: Toy[] = [];
  const nearSite = (x: number, z: number, m: number) =>
    sites.some((s) => {
      const lm = made.get(s.key) as Landmark;
      return Math.hypot(x - s.x, z - s.z) < Math.hypot(lm.half[0], lm.half[1]) + m;
    });
  /** The estates' outlines: scatter keeps off them. Their plots go on the minimap. */
  const estates: Pt[][] = [];
  const plots: { pts: Pt[]; colour: string }[] = [];
  const inside = (o: Pt[], x: number, z: number) => {
    let c = false;
    for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
      const [xi, zi] = o[i] as Pt;
      const [xj, zj] = o[j] as Pt;
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  const free = (x: number, z: number, m: number) =>
    !estates.some((o) => inside(o, x, z) || polyDist(o, x, z, true) < m + 1) &&
    offRoad(x, z, m) &&
    !nearSite(x, z, m) &&
    Math.abs(z - canalZ(x)) > 3.5 + m &&
    polyDist(circuit, x, z, true) > 4.5 + 6 + m &&
    // Not in the paddock and garages strip, nor under the grandstands.
    !(z < PIT_Z + 16 && z > PADDOCK_Z - 4 && x > -60 && x < 140) &&
    // Nor on India Gate's avenue (its lawns, canals and tree rows).
    !(Math.abs(x - GATE[0]) < 22 + m && z > GATE[1] - ROUND_R - 6 && z < hwZ(GATE[0])) &&
    // and a clear precinct round the roundabout, so nothing spoils its symmetry.
    Math.hypot(x - GATE[0], z - GATE[1]) > ROUND_R + 26 + m;
  // ── the farmland: a few huge estates (sub-fields joined edge to edge, every one a different
  // crop from its neighbours), with tractors, pump houses and birds on them ──
  const fr = farmRng(31);
  /** Lays an estate in pieces (batched and culled by area); only the cane casts shadows. */
  const layEstate = (map: Map2, subs: Sub[]) => {
    assignCrops(subs, fr);
    const e = estate(map, subs);
    estates.push(e.outline);
    plots.push(...e.plots);
    for (const p of e.pieces) {
      if (p.soil) lay(new THREE.Mesh(p.soil, mat));
      if (p.low) lay(new THREE.Mesh(p.low, mat));
      if (p.tall) place(p.tall, 0, 0);
    }
  };
  /** A bird (animated by Life): its body, a head that pecks, a fan that opens; shadows follow. */
  const addBird = (b: Bird, x: number, z: number, yaw: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    const pair = (geo: G, parent: THREE.Object3D) => {
      for (const m of [mat, shadow]) parent.add(new THREE.Mesh(geo, m));
    };
    pair(b.body, g);
    const head = new THREE.Group();
    head.position.set(...b.neck);
    pair(b.head, head);
    g.add(head);
    let train: THREE.Group | undefined;
    if (b.train) {
      train = new THREE.Group();
      pair(b.train, train);
      g.add(train);
    }
    let fan: THREE.Group | undefined;
    if (b.fan && b.fanAt) {
      fan = new THREE.Group();
      fan.position.set(...b.fanAt);
      pair(b.fan, fan);
      fan.visible = false;
      g.add(fan);
    }
    g.userData.fowl = { kind: b.kind, head, fan, train };
    scene.add(g);
  };
  /** A pump house (P1) at x, z with its pipe facing yaw; neems either side; the water moves. */
  const addPump = (x: number, z: number, yaw: number) => {
    place(pumpHouse(), x, z, yaw);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    const w = gush();
    const jet = new THREE.Group();
    jet.position.set(0.9, 1.25, 0);
    jet.add(new THREE.Mesh(w.jet, mat));
    const splash = new THREE.Group();
    splash.position.set(1.5, 0.5, 0);
    splash.add(new THREE.Mesh(w.splash, mat));
    g.add(jet, splash);
    g.userData.gush = { jet, splash };
    scene.add(g);
    const c = Math.cos(yaw);
    const sn = -Math.sin(yaw);
    blockers.push(
      { x: x - 1.5 * c, z: z - 1.5 * sn, r: 1.9 },
      { x: x + 1.5 * c, z: z + 1.5 * sn, r: 1.3 },
    );
    for (const side of [-1, 1])
      toys.push({
        id: "T2",
        tint: P.fern,
        x: x - 2 * c + side * 3.4 * -sn,
        z: z - 2 * sn + side * 3.4 * c,
        yaw: r() * 6,
        scale: 1.8,
      });
  };
  /** Faces from a to b (local +x forward). */
  const facing = (a: Pt, b: Pt) => Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  /** A track's mouth: dirt from the estate's edge back under the expressway's verge. */
  const trackMouth = (map: Map2, u: number) => {
    const [ex, ez] = map(u, 0);
    lay(
      ribbon(
        [
          [ex, hwZ(ex) + 5],
          [ex, ez + 0.6],
        ],
        2.1,
        mix("#d9b48f", "#f9f3e6", 0.35),
        0.006,
      ),
    );
  };
  /** The pump at the far end of a track, its pipe towards the estate. */
  const pumpAtEnd = (map: Map2, u: number) => {
    const edge = map(u, 1);
    const out = map(u, 1.2);
    const l = Math.hypot(out[0] - edge[0], out[1] - edge[1]) || 1;
    const at2: Pt = [
      edge[0] + ((out[0] - edge[0]) / l) * 5,
      edge[1] + ((out[1] - edge[1]) / l) * 5,
    ];
    addPump(at2[0], at2[1], facing(at2, edge));
    lay(ribbon([edge, at2], 2.1, mix("#d9b48f", "#f9f3e6", 0.35), 0.006));
  };
  const parkedTractor = (x: number, z: number, yaw: number, plough: boolean) => {
    place(plough ? tractor(true) : join([tractor(), caneTrolley()]), x, z, yaw);
    const c = Math.cos(yaw);
    const sn = -Math.sin(yaw);
    for (let k = plough ? -1 : -5; k <= 2.5; k += 1.5)
      blockers.push({ x: x + c * k, z: z + sn * k, r: 1.2 });
  };
  // A: two estates south of the expressway, west of the toll. The first has a farm track up to
  // its pump house, a tractor with a cane trolley parked on it, peafowl on the roadside rim.
  {
    const map = roadside(hwZ, -215, 82, 1, 7.5, 32);
    layEstate(map, withTrack(bands(fr, [0, 0.3, 0.55, 0.8, 1], [2, 3]), 0.47, 0.53));
    trackMouth(map, 0.5);
    pumpAtEnd(map, 0.5);
    const p = map(0.5, 0.3);
    parkedTractor(p[0], p[1], facing(p, map(0.5, 0)), false);
    const [bx, bz] = map(0.24, 0.03);
    addBird(peacock(false), bx, bz, 0.4);
    addBird(peahen(), bx + 2.6, bz + 0.9, 2.1);
    addBird(peahen(), bx - 2.2, bz + 1.2, -0.5);
  }
  layEstate(roadside(hwZ, -122, 76, 1, 7.5, 28), bands(fr, [0, 0.4, 0.72, 1], [2, 3]));
  // B: south of the expressway, east of India Gate's avenue: a track and pump, a tractor
  // ploughing one plot with egrets behind it, a peacock displaying at the track's mouth.
  {
    const map = roadside(hwZ, 95, 130, 1, 7.5, 30);
    const subs = withTrack(bands(fr, [0, 0.33, 0.66, 1], [3, 4]), 0.24, 0.275);
    const pl = subs.find(
      (q) => q.crop !== "track" && q.q[0][0] > 0.45 && q.q[0][1] > 0.3 && q.q[0][1] < 0.4,
    ) as Sub;
    pl.crop = "plough";
    pl.along = true;
    layEstate(map, subs);
    trackMouth(map, 0.2575);
    pumpAtEnd(map, 0.2575);
    const a = map(...bilerp(pl.q, 0.55, 0.5));
    const b = map(...bilerp(pl.q, 0.75, 0.5));
    const yaw = facing(a, b);
    parkedTractor(a[0], a[1], yaw, true);
    for (let k = 0; k < 6; k++) {
      const [ex, ez] = map(...bilerp(pl.q, 0.42 - k * 0.055, 0.3 + (k % 3) * 0.2));
      addBird(egret(), ex, ez, yaw + (k % 2 ? 0.6 : -0.4));
    }
    const [px, pz] = map(0.2575, 0.06);
    addBird(peacock(true), px, pz, Math.PI / 2);
  }
  // C: a round patchwork between the canal and the expressway (west of India Gate), egrets in
  // its paddy. D: a tall round patchwork inside the ring road, west of the circuit.
  {
    const map = disc(25, 92, 44, 24, 0.05);
    const subs = jgrid(fr, 5, 3);
    layEstate(map, subs);
    const paddy = subs.filter((q) => q.crop === "paddy").slice(0, 2);
    paddy.forEach((q, i) => {
      for (let k = 0; k < 3; k++) {
        const [ex, ez] = map(...bilerp(q.q, 0.3 + k * 0.2, 0.35 + ((k + i) % 2) * 0.3));
        addBird(egret(), ex, ez, k * 2 + i);
      }
    });
  }
  layEstate(disc(-155, -62, 30, 46, 0), jgrid(fr, 3, 5));
  for (const [x, z] of [
    [-235, -20],
    [70, 175],
  ] as Pt[]) {
    place(kiln(), x, z, r() * 6);
    blockers.push({ x, z, r: 3.5 });
  }
  // Villages beside the roads, and the market town on the exit road.
  const house = (x: number, z: number, yaw: number, id: string) => {
    if (!free(x, z, 1.5)) return;
    toys.push({ id, x, z, yaw, scale: 1 });
    houses.push({ x, z, yaw, s: 2 });
  };
  for (const [vx, vz] of [
    [-232, -100],
    [205, -90],
    [-60, 95],
    [200, 66],
  ] as Pt[])
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + r();
      house(vx + Math.cos(a) * 9, vz + Math.sin(a) * 7, r() * 6, "H1");
    }
  for (let i = 0; i < 26; i++)
    house(
      -150 + (r() - 0.5) * 70,
      100 + (r() - 0.5) * 40,
      ((i % 4) * Math.PI) / 2,
      i % 4 ? "H1" : "H2",
    );
  // Eucalyptus along the roads, trees and bushes scattered, hay by the fields.
  for (const s of specs) {
    if (s.closed || s.draw === "highway" || s.draw === "pit") continue;
    for (let i = 0; i < s.pts.length; i += 5) {
      const [a, b] = [
        s.pts[Math.max(0, i - 1)] as Pt,
        s.pts[Math.min(s.pts.length - 1, i + 1)] as Pt,
      ];
      const tx = b[0] - a[0];
      const tz = b[1] - a[1];
      const l = Math.hypot(tx, tz) || 1;
      for (const side of [-1, 1]) {
        if (r() < 0.45) continue;
        const d = s.half + 3 + r() * 2;
        const x = (s.pts[i] as Pt)[0] + (-tz / l) * d * side;
        const z = (s.pts[i] as Pt)[1] + (tx / l) * d * side;
        if (free(x, z, 0.8))
          toys.push({ id: "T2", tint: P.fern, x, z, yaw: r() * 6, scale: 1.6 + r() * 0.6 });
      }
    }
  }
  for (let i = 0; i < 700; i++) {
    const x = (r() - 0.5) * TW;
    const z = (r() - 0.5) * TD;
    if (!free(x, z, 1.2)) continue;
    const k = r();
    const id =
      k < 0.3
        ? "T1"
        : k < 0.45
          ? "T3"
          : k < 0.75
            ? `B${1 + Math.floor(r() * 5)}`
            : k < 0.85
              ? "hayBale"
              : `R${1 + Math.floor(r() * 3)}`;
    toys.push({ id, x, z, yaw: r() * 6, scale: 0.8 + r() * 0.6 });
  }
  yield;
  // Instanced by kind, in chunks the camera can cull; solid ones block, small ones get knocked.
  const groups = new Map<string, Toy[]>();
  const knocks: (Omit<NonNullable<WorldData["knockables"]>[number], "hide"> & {
    key: string;
    slot: number;
  })[] = [];
  const placed = new Map<string, ToySlot[]>();
  for (const p of toys) {
    const k = `${p.id}:${p.tint ?? ""}`;
    const list = groups.get(k) ?? [];
    const knock = knockable(p.id, p.scale);
    if (knock)
      knocks.push({
        id: p.id,
        ...(p.tint ? { tint: p.tint } : {}),
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        scale: p.scale,
        ...knock,
        key: k,
        slot: list.length,
      });
    list.push(p);
    groups.set(k, list);
    const rr = solidity(p.id, p.scale);
    if (rr > 0.15) blockers.push({ x: p.x, z: p.z, r: rr });
  }
  for (const [k, ps] of groups) {
    const [id, tint] = k.split(":") as [string, string];
    const casts = !/^(mustard|paddy)/.test(id);
    const { meshes, at: slots } = instancedToys(
      toy(id, tint || undefined),
      mat,
      casts ? shadow : null,
      ps.map((p) => ({ ...p, y: 0 })),
    );
    for (const m of meshes) scene.add(m);
    placed.set(k, slots);
  }
  for (const o of living) scene.add(o);
  yield;

  // ── the world data the ride engine needs ──
  const roads: WorldData["roads"] = specs.map((s) => ({
    road: makeRoad(s.pts as V2[], H, !!s.closed, 4, 0),
    width: s.half * 2,
    ...(s.closed ? { closed: true } : {}),
  }));
  const tOn = (road: Road, x: number, z: number) => {
    let best = { t: 0, d: Number.POSITIVE_INFINITY };
    for (let i = 0; i <= 900; i++) {
      const p = road.at(i / 900).p;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best.d) best = { t: i / 900, d };
    }
    return best.t;
  };
  const stops: WorldData["stops"] = [];
  for (const s of sites) {
    if (s.key === "kart" || s.key === "dhaba" || s.key === "podium" || s.key === "indiagate")
      continue;
    const lm = made.get(s.key) as Landmark;
    lm.body.computeBoundingBox();
    const road = (roads[s.road] as WorldData["roads"][number]).road;
    stops.push({
      x: s.x,
      z: s.z,
      road,
      t: tOn(road, s.x, s.z),
      tag: s.key,
      top: (lm.body.boundingBox as THREE.Box3).max.y,
    });
  }
  // Ramps: the bridges hump over the canal.
  const ramps: Ramp[] = bridges.map((b) => ({
    x: b.x,
    z: b.z,
    yaw: b.yaw,
    w: b.width,
    len: b.len,
    h: 0.5,
    hump: { base: 0 },
  }));
  for (const b of bridges) {
    const fx = Math.sin(b.yaw);
    const fz = Math.cos(b.yaw);
    for (const s of [-1, 1]) {
      const ox = Math.cos(b.yaw) * s * (b.width / 2);
      const oz = -Math.sin(b.yaw) * s * (b.width / 2);
      walls.push([
        b.x + ox - (fx * b.len) / 2,
        b.z + oz - (fz * b.len) / 2,
        b.x + ox + (fx * b.len) / 2,
        b.z + oz + (fz * b.len) / 2,
      ]);
    }
  }
  const physics = new THREE.PlaneGeometry(TW, TD, TW / 4, TD / 4);
  physics.rotateX(-Math.PI / 2);
  const groundGeo = new THREE.PlaneGeometry(TW, TD, TW / 2, TD / 2);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, mat);
  const spawnAt = beside(highway, 150, 0);
  const world: WorldData = {
    ground,
    physicsGround: new THREE.Mesh(physics),
    shadow,
    size: { w: TW, d: TD },
    roads,
    water: [{ pts: canal as V2[], width: 3 }],
    blockers,
    walls,
    decks: bridges.map((b) => ({
      pts: [
        [b.x - (Math.sin(b.yaw) * b.len) / 2, b.z - (Math.cos(b.yaw) * b.len) / 2],
        [b.x + (Math.sin(b.yaw) * b.len) / 2, b.z + (Math.cos(b.yaw) * b.len) / 2],
      ] as V2[],
      width: b.width,
    })),
    ramps,
    lamps,
    knockables: knocks.map(({ key, slot, ...k }) => ({
      ...k,
      hide: () => {
        const at = placed.get(key)?.[slot];
        if (!at) return;
        at.mesh.setMatrixAt(at.slot, HIDDEN);
        at.mesh.instanceMatrix.needsUpdate = true;
      },
    })),
    mapArt: {
      ponds: [],
      rail: [],
      houses,
      rocks: [],
      trees: toys.filter((p) => p.id.startsWith("T")).map((p) => [p.x, p.z] as V2),
      bridges,
      fields: plots.map((f) => ({ pts: f.pts as V2[], colour: f.colour })),
    },
    stops,
    junctions: findJunctions(roads.map((q) => ({ road: q.road, closed: !!q.closed }))),
    landmarks: Object.fromEntries(sites.map((s) => [s.key, { x: s.x, z: s.z }])),
    spawn: { x: spawnAt.x, z: spawnAt.z, heading: Math.atan2(-(hwZ(-110) - hwZ(-114)), 4) },
  };
  return {
    world,
    road: (roads[3] as WorldData["roads"][number]).road,
    moments: [],
    stops: [],
    mapZoom: Math.max(TW, TD),
    mapCentre: [0, 0],
  };
}

export const winzoFlat: JourneyDef = {
  id: "winzo",
  title: "WinZO · the circuit on the Greater Noida plains (open world)",
  mood: "vivid",
  bike: "superbike",
  flat: { ground: BASE },
  build: (scene) => build(scene),
};
