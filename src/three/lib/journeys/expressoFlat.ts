/**
 * Expresso in the flat-world language: Coorg as a dead-flat pastel diorama
 * that loops (see flat/expressoGen for the layout). Built a slice at a time:
 * the layout, then the ground, water and roads, then the toys (instanced, with
 * cut-paper shadows), then the grass, then the world data the ride engine
 * needs (roads as curves, solids, stops, landmarks, the spawn).
 */

import * as THREE from "three";
import { type ExpressoLayout, generateSteps } from "../../flat/expressoGen";
import {
  clay,
  flat,
  flatShape,
  footprint,
  grow,
  mix,
  type Pt,
  paperShadow,
  ribbon,
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
import { EXPRESSO_LANDMARKS, type ExpressoLandmark } from "../landmarks";
import { PASTEL as P } from "../palette";
import { PLATFORM, railBridge, roadBridge, roadDeck, STATION_NAME, station } from "../railway";
import { SAND } from "../toys";

const INK = P.ink;
/** Toys are instanced in chunks this size (m), so off-screen ones aren't drawn. */
const CHUNK = 60;
export const FLAT_GROUND = "#f5d4c6";

/** Points of a line inside the tile (plus a margin), split into runs. */
function clip(L: ExpressoLayout, pts: Pt[], margin = 12): Pt[][] {
  const runs: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of pts) {
    const inside = Math.abs(p[0]) < L.TW / 2 + margin && Math.abs(p[1]) < L.TD / 2 + margin;
    if (inside) cur.push(p);
    else if (cur.length) {
      if (cur.length > 1) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

/** A polyline pushed sideways by d. */
function offset(pts: Pt[], d: number): Pt[] {
  return pts.map(([x, z], i) => {
    const [ax, az] = pts[Math.max(0, i - 1)] as Pt;
    const [bx, bz] = pts[Math.min(pts.length - 1, i + 1)] as Pt;
    const l = Math.hypot(bx - ax, bz - az) || 1;
    return [x - ((bz - az) / l) * d, z + ((bx - ax) / l) * d];
  });
}

/**
 * How the bike meets each thing in the world, in three kinds:
 *  - solid: it stops, with a small bounce (houses, big rocks, tree trunks,
 *    posts, the toy train): returns the radius it blocks;
 *  - ride-over: grass, pebbles, crops, sleepers, ramps (ramps lift the bike
 *    instead, see `RAMP`): returns 0;
 *  - pushed: see `PUSHED` (they become bodies, not scenery).
 */
/**
 * Big enough to stop the bike: trees over 3 m tall or about 1 m wide (the
 * banyan, the tallest spires), rocks about 1 m tall or wide (boulders, the
 * big tent rocks). Everything smaller you ride through.
 */
export function big(id: string, scale: number): boolean {
  const h = ((toy(id).boundingBox as THREE.Box3).max.y || 1) * scale;
  const r = footprint(id) * scale;
  return id.startsWith("T") ? h > 3 || r > 0.9 : h > 1 || r > 1;
}

export function solidity(id: string, scale: number): number {
  if (
    /^(B|lotus|reeds|sleeper|ramp|kicker|spray|mustard|paddy|barley|tea|dune|railing|kite)/.test(id)
  )
    return 0;
  // Rocks and trees: small and medium ones you ride straight through; big ones stop you.
  if (id.startsWith("R")) return big(id, scale) ? footprint(id) * scale * 0.8 : 0;
  // A big tree is solid at the trunk (ride under the edge of the canopy).
  if (id.startsWith("T"))
    return big(id, scale) ? Math.max(0.45, Math.min(0.9, footprint(id) * scale * 0.3)) : 0;
  if (id === "lantern" || id === "flag") return 0.22;
  return footprint(id) * scale * 0.75;
}

/**
 * What the bike knocks about, and how heavy it is: shrubs get kicked, small
 * and medium trees fall over, small and medium rocks get kicked along. Grass,
 * flower pads and tiny pebbles stay where they are; big trees and rocks are
 * solid (see `solidity`).
 */
export function knockable(
  id: string,
  scale: number,
): { mass: number; sound: "soft" | "wood" | "pot"; tree?: boolean } | null {
  const h = ((toy(id).boundingBox as THREE.Box3).max.y || 1) * scale;
  const r = footprint(id) * scale;
  /** Its bulk (m³): the cylinder it stands in. */
  const bulk = Math.PI * r * r * h;
  // Weighed by what it's made of: airy foliage (25 kg/m³), timber and canopy (120), toy stone (120).
  if (/^B[1-7]$/.test(id)) return { mass: Math.max(2, 25 * bulk), sound: "soft" };
  if (id.startsWith("T") && !big(id, scale))
    return { mass: Math.max(30, 120 * bulk), sound: "wood", tree: true };
  if (id.startsWith("R") && !big(id, scale)) {
    if (h < 0.4 && r < 0.4) return null;
    return { mass: Math.max(8, 120 * bulk), sound: "pot" };
  }
  return null;
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/** Ramps and kickers: their wedge (matching the toys' shapes, at scale 1). */
const RAMP: Record<string, { w: number; len: number; h: number }> = {
  ramp: { w: 2.2, len: 3.2, h: 0.95 },
  kicker: { w: 2, len: 2.4, h: 0.7 },
};

/**
 * Things the bike shoves aside, by weight (kg): a pot flies, a bale barely
 * shifts. Stacks come apart into their pieces (each local to the stack:
 * x across, height, kind).
 */
const PUSHED: Record<
  string,
  {
    pieces: [number, number, string][];
    mass: Record<string, number>;
    sound: "soft" | "pot" | "wood" | "metal";
    wheels?: boolean;
  }
> = {
  potStack: {
    pieces: [
      [0, 0, "plank"],
      ...[-0.58, 0, 0.58].map((x): [number, number, string] => [x, 0.13, "matka"]),
      ...[-0.29, 0.29].map((x): [number, number, string] => [x, 0.62, "matka"]),
      [0, 1.11, "matka"],
    ],
    mass: { plank: 6, matka: 4 },
    sound: "pot",
  },
  hayBales: {
    pieces: [
      ...[-1.04, 0, 1.04].map((x): [number, number, string] => [x, 0, "hayBale"]),
      ...[-0.52, 0.52].map((x): [number, number, string] => [x, 0.51, "hayBale"]),
      [0, 1.02, "hayBale"],
    ],
    mass: { hayBale: 18 },
    sound: "soft",
  },
  bollardCoral: { pieces: [[0, 0, "bollardCoral"]], mass: { bollardCoral: 3 }, sound: "soft" },
  // Carts roll on their wheels (the bullock cart and the food truck are too heavy: solid).
  C1: { pieces: [[0, 0, "C1"]], mass: { C1: 60 }, sound: "wood", wheels: true },
  C2: { pieces: [[0, 0, "C2"]], mass: { C2: 50 }, sound: "wood", wheels: true },
  C3: { pieces: [[0, 0, "C3"]], mass: { C3: 40 }, sound: "metal", wheels: true },
  bollardCream: { pieces: [[0, 0, "bollardCream"]], mass: { bollardCream: 3 }, sound: "soft" },
};

function* build(scene: THREE.Scene): Generator<unknown, JourneyBuild, unknown> {
  yield;
  const L = yield* generateSteps();
  yield;
  const BASE = FLAT_GROUND;
  const mat = clay(BASE);
  const shadow = paperShadow(mix(BASE, INK, 0.13));
  const inTileish = (x: number, z: number, m = 10) =>
    Math.abs(x) < L.TW / 2 + m && Math.abs(z) < L.TD / 2 + m;

  // The ground: one flat colour (its grid also tells the engine the height: zero).
  const groundGeo = new THREE.PlaneGeometry(L.TW, L.TD, 8, 6);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, flat(BASE));
  scene.add(ground);

  // Water: banded ponds and the stream.
  const shore = mix(BASE, SAND, 0.65);
  const shallow = mix(P.aqua, "#ffffff", 0.45);
  for (const pond of L.PONDS) {
    scene.add(
      flatShape(grow(pond, 1.1), shore, 0.001),
      flatShape(pond, shallow, 0.002),
      flatShape(grow(pond, -2.6), P.aqua, 0.003),
    );
  }
  for (const run of clip(L, L.STREAM)) {
    scene.add(
      ribbon(run, L.STREAM_HALF + 1, shore, 0.002),
      ribbon(run, L.STREAM_HALF, shallow, 0.003),
      ribbon(run, L.STREAM_HALF * 0.45, P.aqua, 0.004),
    );
  }
  yield;

  // Roads (stopping at the bridges), the railway (ballast, rails), the drift pad.
  for (const road of L.ROADS)
    for (const run of L.dry(road.pts))
      for (const part of clip(L, run)) scene.add(ribbon(part, road.half, P.cream, 0.008));
  const rail = mix(INK, P.stone, 0.55);
  for (const run of L.dry(L.TRACK))
    for (const part of clip(L, run)) {
      scene.add(ribbon(part, 1.35, mix(P.stone, BASE, 0.35), 0.005));
      for (const s of [-0.62, 0.62]) scene.add(ribbon(offset(part, s), 0.07, rail, 0.14));
    }
  {
    const [dx, dz, rad] = L.DRIFT;
    const pad: Pt[] = [];
    for (let k = 0; k < 48; k++)
      pad.push([
        dx + Math.cos((k / 48) * Math.PI * 2) * rad,
        dz + Math.sin((k / 48) * Math.PI * 2) * rad,
      ]);
    scene.add(flatShape(pad, mix(BASE, SAND, 0.85), 0.006));
    for (let k = 0; k < 3; k++) {
      const loopPts: Pt[] = [];
      const r0 = rad * (0.45 + k * 0.14);
      for (let t = 0; t <= 1.0001; t += 1 / 70)
        loopPts.push([
          dx + Math.cos(t * Math.PI * 2 * 1.15 + k) * r0 * 1.08 + k * 0.6,
          dz + Math.sin(t * Math.PI * 2 * 1.15 + k) * r0 * 0.92,
        ]);
      scene.add(ribbon(loopPts, 0.07, mix(BASE, INK, 0.28), 0.0065));
    }
  }
  // Bridges (RB1, RW3): stone arches; the railway's carries the track unbroken.
  for (const b of L.BRIDGES) {
    const geo = b.railway ? railBridge("arch", b.len) : roadBridge("arch", b.len, b.width);
    for (const m of [mat, shadow]) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(b.x, 0, b.z);
      mesh.rotation.y = b.yaw;
      mesh.frustumCulled = m !== shadow;
      // It carries the road: never nudged off it by the road clearing.
      mesh.userData.spansRoad = true;
      mesh.userData.bridge = true;
      scene.add(mesh);
    }
  }
  // The station (ST1, a halt): its platform faces the lane in from the road.
  const ST = L.STATION;
  {
    const st = station("halt", STATION_NAME);
    for (const m of [mat, shadow]) {
      const mesh = new THREE.Mesh(st.body, m);
      mesh.position.set(ST.x, 0, ST.z);
      mesh.rotation.y = ST.yaw;
      // Placed with its lane in mind: stays exactly where it is.
      mesh.userData.spansRoad = true;
      scene.add(mesh);
    }
    for (const b of st.boards) {
      const holder = new THREE.Group();
      holder.position.set(ST.x, 0, ST.z);
      holder.rotation.y = ST.yaw;
      holder.userData.spansRoad = true;
      holder.add(b);
      scene.add(holder);
    }
  }
  yield;

  // The toys, instanced per kind, each with its cut-paper shadow.
  type P3 = { x: number; z: number; y: number; yaw: number; scale: number };
  const groups = new Map<string, P3[]>();
  const knocks: (Omit<NonNullable<WorldData["knockables"]>[number], "hide"> & {
    key: string;
    slot: number;
  })[] = [];
  const meshOf = new Map<string, THREE.InstancedMesh>();
  const blockers: WorldData["blockers"] = [];
  const ramps: Ramp[] = [];
  const pushables: NonNullable<WorldData["pushables"]> = [];
  for (const p of [...L.PLACED, ...L.EXTRA, ...L.SET] as (ExpressoLayout["SET"][number] & {
    y?: number;
  })[]) {
    if (!inTileish(p.x, p.z)) continue;
    const ramp = RAMP[p.id];
    if (ramp)
      ramps.push({
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        w: ramp.w * p.scale,
        len: ramp.len * p.scale,
        h: ramp.h * p.scale,
      });
    const push = PUSHED[p.id];
    if (push) {
      // A body each (drawn by the physics, not here).
      const ax = Math.cos(p.yaw);
      const az = -Math.sin(p.yaw);
      for (const [across, lift, id] of push.pieces)
        pushables.push({
          id,
          x: p.x + ax * across * p.scale,
          z: p.z + az * across * p.scale,
          yaw: p.yaw,
          scale: p.scale,
          lift: lift * p.scale,
          mass: (push.mass[id] ?? 5) * p.scale ** 3,
          sound: push.sound,
          ...(push.wheels ? { wheels: true } : {}),
        });
      continue;
    }
    // Chunked by area too, so the camera skips what's off screen (the tile and its eight copies).
    const k = `${p.id}:${p.tint ?? ""}:${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}`;
    const list = groups.get(k) ?? [];
    const knock = (p.y ?? 0) > 0.05 ? null : knockable(p.id, p.scale);
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
    list.push({ x: p.x, z: p.z, y: p.y ?? 0, yaw: p.yaw, scale: p.scale });
    groups.set(k, list);
    const r = (p.y ?? 0) > 1.5 ? 0 : solidity(p.id, p.scale);
    if (r > 0.15)
      blockers.push(
        // Rocks are only as tall as they look: a jump can clear the low ones.
        p.id.startsWith("R")
          ? { x: p.x, z: p.z, r, h: ((toy(p.id).boundingBox as THREE.Box3).max.y || 1) * p.scale }
          : { x: p.x, z: p.z, r },
      );
  }
  // Nothing solid on a ramp or just past its lip: a ramp always lets you launch.
  for (let i = blockers.length - 1; i >= 0; i--) {
    const b = blockers[i] as WorldData["blockers"][number];
    const onRamp = ramps.some((rp) => {
      const dx = b.x - rp.x;
      const dz = b.z - rp.z;
      const along = dx * Math.sin(rp.yaw) + dz * Math.cos(rp.yaw);
      const across = dx * Math.cos(rp.yaw) - dz * Math.sin(rp.yaw);
      return (
        Math.abs(across) < rp.w / 2 + b.r &&
        along > -rp.len / 2 - b.r &&
        along < rp.len / 2 + 2 + b.r
      );
    });
    if (onRamp) blockers.splice(i, 1);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (const [k, ps] of groups) {
    const [id, tint] = k.split(":") as [string, string, string];
    const geo = toy(id, tint || undefined);
    const mesh = new THREE.InstancedMesh(geo, mat, ps.length);
    ps.forEach((p, i) => {
      q.setFromAxisAngle(up, p.yaw);
      mesh.setMatrixAt(
        i,
        m4.compose(
          new THREE.Vector3(p.x, p.y, p.z),
          q,
          new THREE.Vector3(p.scale, p.scale, p.scale),
        ),
      );
    });
    mesh.computeBoundingSphere();
    scene.add(mesh);
    meshOf.set(k, mesh);
    if (id !== "lotus" && id !== "sleeper") {
      const s = new THREE.InstancedMesh(geo, shadow, ps.length);
      s.instanceMatrix = mesh.instanceMatrix;
      // The shadow lies a little to the side of the toys: cull it by slightly bigger bounds.
      const sphere = (mesh.boundingSphere as THREE.Sphere).clone();
      sphere.radius += 6;
      s.boundingSphere = sphere;
      scene.add(s);
    }
    if (++n % 8 === 0) yield;
  }

  // Grass, where grass grows (two tones).
  {
    const geo = L.tuftGeometry();
    const tones: [string, string] = [mix(BASE, P.fern, 0.55), mix(BASE, P.pistachio, 0.7)];
    for (const tone of [0, 1] as const) {
      const cells = new Map<string, [number, number, number][]>();
      for (const [x, z, sc, t] of L.TUFTS) {
        if (t !== tone) continue;
        const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
        const list = cells.get(key) ?? [];
        list.push([x, z, sc]);
        cells.set(key, list);
      }
      const material = flat(tones[tone]);
      for (const list of cells.values()) {
        const mesh = new THREE.InstancedMesh(geo, material, list.length);
        list.forEach(([x, z, sc], i) => {
          mesh.setMatrixAt(i, m4.makeScale(sc, sc, sc).setPosition(x, 0, z));
        });
        mesh.computeBoundingSphere();
        scene.add(mesh);
      }
    }
  }
  yield;

  // The stops' landmarks (each stop is a place), at their sites beside the roads.
  const marks: {
    key: string;
    x: number;
    z: number;
    yaw: number;
    top: number;
    lamps: { x: number; y: number; z: number; r: number }[];
    half: [number, number];
    site: (typeof L.SITES)[number];
  }[] = [];
  for (const site of L.SITES) {
    const def = EXPRESSO_LANDMARKS[site.key as ExpressoLandmark];
    if (!def) continue;
    const lm = def.make();
    const holder = new THREE.Group();
    holder.position.set(site.x, 0, site.z);
    holder.rotation.y = site.yaw;
    holder.userData.spansRoad = true;
    for (const m of [mat, shadow]) {
      const mesh = new THREE.Mesh(lm.body, m);
      mesh.frustumCulled = m !== shadow;
      holder.add(mesh);
    }
    for (const sg of lm.signs) holder.add(sg);
    scene.add(holder);
    const c = Math.cos(site.yaw);
    const sn = Math.sin(site.yaw);
    const w = (lx: number, lz: number): [number, number] => [
      site.x + c * lx + sn * lz,
      site.z - sn * lx + c * lz,
    ];
    for (const [lx, lz, r] of lm.solids) {
      const [x, z] = w(lx, lz);
      blockers.push({ x, z, r });
    }
    lm.body.computeBoundingBox();
    marks.push({
      key: site.key,
      x: site.x,
      z: site.z,
      yaw: site.yaw,
      top: (lm.body.boundingBox as THREE.Box3).max.y,
      lamps: lm.lamps.map((l) => {
        const [x, z] = w(l.x, l.z);
        return { x, y: l.y, z, r: l.r };
      }),
      half: lm.half,
      site,
    });
  }
  yield;

  // The world data the ride engine needs.
  const zero = () => 0;
  const asRoad = (pts: Pt[], closed: boolean): Road =>
    makeRoad((closed ? pts.slice(0, -1) : pts) as V2[], zero, closed, 0, 1);
  // The ring road is the closed loop (the engine treats the first road as a loop).
  const ring = L.ROADS.find((r) => r.pts === L.RING) as { pts: Pt[]; half: number };
  const roads: WorldData["roads"] = [
    { road: asRoad(ring.pts, true), width: ring.half * 2 },
    ...L.ROADS.filter((r) => r !== ring).map((r) => ({
      road: asRoad(r.pts, false),
      width: r.half * 2,
    })),
  ];
  yield;
  // Ponds as broad strokes through their middles; the stream as itself.
  const water: WorldData["water"] = [{ pts: L.STREAM as V2[], width: L.STREAM_HALF * 2 }];
  for (const pond of L.PONDS) {
    const xs = pond.map((p) => p[0]);
    const zs = pond.map((p) => p[1]);
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    water.push({
      pts: [
        [Math.min(...xs) + 1, cz],
        [Math.max(...xs) - 1, cz],
      ],
      width: (Math.max(...zs) - Math.min(...zs)) * 0.85,
    });
  }
  // Bridge parapets are walls.
  const walls: [number, number, number, number][] = [];
  for (const b of L.BRIDGES) {
    const fx = Math.sin(b.yaw);
    const fz = Math.cos(b.yaw);
    const half = b.railway ? 1.35 : b.width / 2 - 0.15;
    for (const s of [-1, 1]) {
      const ox = Math.cos(b.yaw) * s * half;
      const oz = -Math.sin(b.yaw) * s * half;
      walls.push([
        b.x + ox - (fx * b.len) / 2,
        b.z + oz - (fz * b.len) / 2,
        b.x + ox + (fx * b.len) / 2,
        b.z + oz + (fz * b.len) / 2,
      ]);
    }
  }
  // The platform's edges are walls (you ride up the lane to it, not onto it).
  {
    const c = Math.cos(ST.yaw);
    const sn = Math.sin(ST.yaw);
    const w = (lx: number, lz: number): [number, number] => [
      ST.x + c * lx + sn * lz,
      ST.z - sn * lx + c * lz,
    ];
    const x0 = PLATFORM.x - PLATFORM.w / 2;
    const x1 = PLATFORM.x + PLATFORM.w / 2;
    const z1 = PLATFORM.len / 2;
    const corners = [w(x0, -z1), w(x1, -z1), w(x1, z1), w(x0, z1)];
    corners.forEach((a, i) => {
      const b = corners[(i + 1) % 4] as [number, number];
      walls.push([a[0], a[1], b[0], b[1]]);
    });
  }
  /** Where along a road a point is (0–1). */
  const tOn = (road: Road, x: number, z: number) => {
    let best = { t: 0, d: Number.POSITIVE_INFINITY };
    for (let i = 0; i <= 600; i++) {
      const p = road.at(i / 600).p;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best.d) best = { t: i / 600, d };
    }
    return best.t;
  };
  // The eight stops are the eight landmarks (their content is pinned to them by tag);
  // you pull in from the road beside each. The station is a landmark too, not a stop.
  const roadOf = new Map<Pt[], WorldData["roads"][number]>();
  roadOf.set(ring.pts, roads[0] as WorldData["roads"][number]);
  L.ROADS.filter((r) => r !== ring).forEach((r, k) => {
    roadOf.set(r.pts, roads[k + 1] as WorldData["roads"][number]);
  });
  const stops: WorldData["stops"] = [];
  for (const m of marks) {
    const r = roadOf.get(m.site.road);
    if (!r) continue;
    const [rx, rz] = m.site.road[m.site.i] as Pt;
    stops.push({ x: m.x, z: m.z, road: r.road, t: tOn(r.road, rx, rz), tag: m.key, top: m.top });
  }
  const main = roads[1] as WorldData["roads"][number];
  const spawnT = tOn(main.road, L.X0 + 30, 0);
  const sp = main.road.at(spawnT);
  const anchor = (i: number) => {
    const a = L.ANCHORS[i] ?? L.ANCHORS[0];
    return { x: a?.x ?? 0, z: a?.z ?? 0 };
  };
  const [ox, oz] = L.OUTCROPS[0] ?? [0, 0];
  const meadow = L.mostly("Meadow");
  const herd = meadow.road.pts[meadow.i] as Pt;
  const world: WorldData = {
    ground,
    size: { w: L.TW, d: L.TD },
    roads,
    water,
    blockers,
    walls,
    // Bridge decks: road over the water, humped (the bike rides up and over).
    decks: L.BRIDGES.map((b) => ({
      pts: [
        [b.x - (Math.sin(b.yaw) * b.len) / 2, b.z - (Math.cos(b.yaw) * b.len) / 2],
        [b.x + (Math.sin(b.yaw) * b.len) / 2, b.z + (Math.cos(b.yaw) * b.len) / 2],
      ] as V2[],
      width: b.width,
    })),
    ramps: [
      ...ramps,
      ...L.BRIDGES.map((b) => ({
        x: b.x,
        z: b.z,
        yaw: b.yaw,
        w: b.width,
        len: b.len,
        // The stone road arch humps (RB1); the railway's deck stays flat.
        h: b.railway ? 0 : roadDeck("arch").rise,
        hump: { base: b.railway ? 0.12 : roadDeck("arch").base },
      })),
    ],
    pushables,
    // At night: lanterns, every house's windows, the shrine, the station's lamps, and the landmarks.
    lamps: [
      ...marks.flatMap((m) => m.lamps),
      ...[...L.PLACED, ...L.SET]
        .filter((p) => p.id === "lantern" || /^(H|S)\d/.test(p.id) || p.id === "shrine")
        .map((p) =>
          p.id === "lantern"
            ? { x: p.x, y: 1.6, z: p.z, r: 3.6 }
            : { x: p.x, y: 0.8, z: p.z, r: 2.6 + footprint(p.id) * p.scale },
        ),
      ...[-1, 0, 1].map((e) => {
        const c = Math.cos(ST.yaw);
        const sn = Math.sin(ST.yaw);
        const lz = e * (PLATFORM.len / 2 - 1.6);
        return {
          x: ST.x + c * PLATFORM.x + sn * lz,
          y: 1.8,
          z: ST.z - sn * PLATFORM.x + c * lz,
          r: 4,
        };
      }),
    ],
    knockables: knocks.map(({ key, slot, ...k }) => ({
      ...k,
      // Out of the static scenery (and its copies, and its shadow: they share instances).
      hide: () => {
        const mesh = meshOf.get(key);
        if (!mesh) return;
        mesh.setMatrixAt(slot, HIDDEN);
        mesh.instanceMatrix.needsUpdate = true;
      },
    })),
    train: {
      pts: L.TRACK as V2[],
      s: L.TRACK_S,
      from: L.TRACK_S[L.TW] as number,
      period: (L.TRACK_S[2 * L.TW] as number) - (L.TRACK_S[L.TW] as number),
      station: L.TRACK_S[ST.i] as number,
    },
    mapArt: {
      ponds: L.PONDS as V2[][],
      rail: L.TRACK as V2[],
      houses: [
        ...[...L.PLACED, ...L.SET]
          .filter((p) => /^(H|S|C)\d/.test(p.id) || p.id === "shrine")
          .map((p) => ({ x: p.x, z: p.z, yaw: p.yaw, s: footprint(p.id) * p.scale })),
        ...marks
          .filter((m) => m.key !== "bridge")
          .map((m) => ({ x: m.x, z: m.z, yaw: m.yaw, s: Math.max(...m.half) * 0.8 })),
      ],
      rocks: L.PLACED.filter((p) => p.id.startsWith("R") && big(p.id, p.scale)).map((p) => ({
        x: p.x,
        z: p.z,
        r: footprint(p.id) * p.scale * 0.8,
      })),
      trees: L.PLACED.filter((p) => p.id.startsWith("T")).map((p) => [p.x, p.z] as V2),
      bridges: L.BRIDGES.map((b) => ({ x: b.x, z: b.z, yaw: b.yaw, len: b.len, width: b.width })),
    },
    stops,
    junctions: findJunctions(roads.map((r, i) => ({ road: r.road, closed: i === 0 }))),
    landmarks: {
      // The roastery (and its live server board) is the Expresso stop's landmark.
      roastery: (() => {
        const m = marks.find((q) => q.key === "roastery");
        if (!m) return { ...anchor(0), road: { x: L.CROSSING[0], z: L.CROSSING[1] } };
        const [rx, rz] = m.site.road[m.site.i] as Pt;
        return { x: m.x, z: m.z, road: { x: rx, z: rz } };
      })(),
      pulping: anchor(2),
      drying: anchor(3),
      bus: anchor(4),
      bungalow: anchor(6),
      outcrop: { x: ox, z: oz },
      herd: { x: herd[0] + 20, z: herd[1] + 20 },
    },
    spawn: { x: sp.p.x, z: sp.p.z, heading: sp.heading },
  };
  return {
    world,
    road: main.road,
    moments: [],
    stops: [],
    mapZoom: Math.max(L.TW, L.TD),
    mapCentre: [0, 0],
  };
}

export const expressoFlat: JourneyDef = {
  id: "expresso",
  title: "Expresso · Coorg, flat (open world)",
  mood: "golden",
  bike: "cafe",
  flat: { ground: FLAT_GROUND },
  build: (scene) => build(scene),
};
