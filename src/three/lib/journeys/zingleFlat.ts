/**
 * Zingle AI as a flat world: a Thar desert rally on sand-peach ground, 1312 × 1008 m (layout W3 at 70% of its area,
 * from design/3d/zingle-board.ts): a road trip across Jaisalmer, Jodhpur and Jaipur. See
 * zingleLayout for the roads and where everything is.
 *
 *  - The highway across the middle (it wraps), and a web of small lanes joining every place to
 *    its nearest two or three, the way desert villages are joined.
 *  - The fort on its terraced hill in cream sandstone (walls, bastions, the zig-zag ramp, the
 *    lake moat and the zipline), its town, Hawa Mahal, the twin pols on the road in.
 *  - The ten stops, each a piece of Rajasthani heritage (kunds, the pols, Jantar Mantar, the
 *    lake ghat, the bazaar, the Lohar dera, the toshakhana, the stepwell, Ghanta Ghar, the
 *    haveli); Thar Junction on the railway that loops the world (the toy train stops there);
 *    the caravanserai; the bivouac with camels resting by it.
 *  - The dune sea (blob dunes on a ripple carpet) with a sand track, its dune jumps and dust;
 *    the salt pan; khejris, ker bushes, villages of round
 *    huts; the rally course dressing (km stones, arrow boards, CP flags, a start arch).
 *
 * Built a slice at a time (a generator), like the other flat worlds.
 */

import * as THREE from "three";
import {
  clay,
  flatShape,
  instancedToys,
  lightToys,
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
import { join, paint } from "../nature";
import { PASTEL as P } from "../palette";
import { sonarQila } from "../sonarQila";
import { at, ball, drum, type G, lathe, rbox } from "../toys";
import {
  CLOCK_FACES,
  clockHands,
  FORT_BRIDGE_END,
  FORT_GATE,
  FORT_MOAT,
  FORT_TOSHAKHANA,
  fort,
  GHAT_LAKE,
  PIECES,
  POL_ARCHES,
  ZINGLE_GROUND,
  ZINGLE_LANDMARKS,
  type ZingleLandmark,
  type ZLandmark,
} from "../zingleLandmarks";
import {
  checkRoads,
  DUNES,
  FORT,
  hwZ,
  offset,
  type Pt,
  polyDist,
  QILA,
  railZ,
  SALT,
  SegGrid,
  STX,
  s,
  TD,
  TW,
  toWorld,
  W,
  zingleLayout,
} from "../zingleLayout";
import { knockable, solidity } from "./expressoFlat";

const BASE = ZINGLE_GROUND;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// ── the pieces ────────────────────────────────────────────────────────────

const inside = (o: Pt[], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const [xi, zi] = o[i] as Pt;
    const [xj, zj] = o[j] as Pt;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};

/** A dune jump: a sand wedge rising along local +z (matches the ramp the physics rides). */
function duneJump(w: number, len: number, h: number): G {
  const shape = new THREE.Shape([
    new THREE.Vector2(-len / 2, 0),
    new THREE.Vector2(len / 2, h),
    new THREE.Vector2(len / 2, 0),
  ]);
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: w,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 1,
  });
  body.translate(0, 0, -w / 2);
  body.rotateY(-Math.PI / 2);
  return join([
    paint(body.toNonIndexed(), "#e6b98a"),
    at(ball(0.9, "#efc89a", 1.4, 0.5, 1), -w / 2 - 0.6, 0, len / 2 - 0.4),
    at(ball(0.8, "#efc89a", 1.3, 0.45, 1), w / 2 + 0.6, 0, len / 2 - 0.6),
  ]);
}

/** A round village hut (a jhonpa): lime-plastered mud walls, a thatched cone, a dark door. */
function hut(s = 1): G {
  return join([
    at(drum(1.5 * s, 1.7 * s, "#f1dfc2", 0.08, 18), 0, 0, 0),
    at(drum(1.53 * s, 0.25 * s, "#c98466", 0.04, 18), 0, 0.2 * s, 0),
    at(
      lathe(
        [
          [0, 0],
          [2.0, 0],
          [1.2, 0.8],
          [0.2, 1.75],
          [0, 1.85],
        ],
        "#c9a46e",
        14,
      ).scale(s, s, s),
      0,
      1.6 * s,
      0,
    ),
    at(rbox(0.6 * s, 1.1 * s, 0.1, "#7e5638", 0.04), 0, 0, 1.48 * s),
  ]);
}
/** The rally's start arch over a road (spanning local x ±span/2), in muted terracotta. */
function startArch(span: number): G {
  const R = span / 2;
  return join([
    paint(new THREE.TorusGeometry(R, 0.55, 10, 36, Math.PI).toNonIndexed(), "#e0a35e"),
    at(
      paint(
        new THREE.TorusGeometry(R, 0.57, 10, 36, Math.PI).scale(1, 1, 0.3).toNonIndexed(),
        "#f6efe2",
      ),
      0,
      0,
      0.42,
    ),
    at(rbox(span * 0.42, 0.9, 0.12, "#7e5638", 0.04), 0, R + 0.1, 0.5),
  ]);
}

// ── the build ─────────────────────────────────────────────────────────────

function* build(scene: THREE.Scene): Generator<unknown, JourneyBuild, unknown> {
  yield;
  const mat = clay(BASE);
  const shadow = tintShadow(BASE, mix(BASE, P.ink, 0.13));
  /** A static piece with its cut-paper shadow, kept exactly where it's put. */
  const place = (
    geo: G,
    x: number,
    z: number,
    yaw = 0,
    s = 1,
    y = 0,
    sh: THREE.Material | null = shadow,
  ) => {
    for (const m of sh ? [mat, sh] : [mat]) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.rotation.y = yaw;
      mesh.scale.setScalar(s);
      mesh.frustumCulled = m !== sh;
      mesh.userData.spansRoad = true;
      scene.add(mesh);
    }
  };
  /** Flat paint lying on the land (roads, water, dunes): never nudged off the roads. */
  const lay = (...objs: THREE.Object3D[]) => {
    for (const o of objs) {
      o.userData.spansRoad = true;
      scene.add(o);
    }
  };
  /**
   * Flat painted geometry (vertex colours) in the clay, no shadow, joined in 40 m cells by where
   * each piece is, each cell culled on its own (never one world-wide mesh).
   */
  const paintFlat = (gs: G[]) => {
    const cells = new Map<string, G[]>();
    const c = new THREE.Vector3();
    for (const g of gs) {
      g.computeBoundingBox();
      (g.boundingBox as THREE.Box3).getCenter(c);
      const k = `${Math.floor(c.x / 40)},${Math.floor(c.z / 40)}`;
      const l = cells.get(k) ?? [];
      l.push(g);
      cells.set(k, l);
    }
    for (const l of cells.values()) {
      // Drawn as terrain chunks (each culled on its own, never folded into the scene's wide batch,
      // which every wrap copy draws).
      const m = new THREE.Mesh(join(l), mat);
      m.userData.terrain = true;
      lay(m);
    }
  };

  // ── roads (the layout: see zingleLayout, which also proves they're continuous) ──
  const fortLm = fort();
  yield;
  const builtQila = lightToys(() => sonarQila());
  yield;
  const layout = zingleLayout(builtQila);
  yield;
  const specs = layout.roads;
  const RI = layout.RI;
  type Spec = (typeof specs)[number];
  const polAt = layout.pols;
  const qila = layout.qila;
  const [qx, qz] = QILA;
  const [qb0, qb1, qb2, qb3] = qila.bounds;
  /** Sonar Qila's ground, where it is; the plain elsewhere. */
  const H = (x: number, z: number) =>
    x > qx + qb0 && x < qx + qb2 && z > qz + qb1 && z < qz + qb3
      ? qila.heightAt(x - qx, z - qz)
      : 0;
  const highway = (specs[RI.hw] as Spec).pts;
  const sand = (specs[RI.sand] as Spec).pts;
  /** Where the sand spur meets the sand track: the mouth of the dunes. */
  const MOUTH = (specs[RI.S2] as Spec).pts[0] as Pt;
  const worldRoads: WorldRoad[] = specs.map((s) => ({
    pts: s.pts.map(([x, z], i) => [x, s.ys?.[i] ?? 0, z] as [number, number, number]),
    grit: s.pts.map(() => (s.draw === "sand" ? 1 : 0)),
    half: s.half,
    kind: s.kind,
  }));
  /** Clear of every road by `m` metres? */
  const roadGrid = new SegGrid(16);
  for (const s of specs) roadGrid.add(s.pts, s.closed, s.half);
  const offRoad = (x: number, z: number, m: number) => roadGrid.clear(x, z, m);
  // The railway: points every metre over three tiles (the train runs the middle one and wraps).
  const TRACK: Pt[] = [];
  for (let i = 0; i < 3 * TW; i++) {
    const x = -1.5 * TW + i;
    TRACK.push([x, railZ(x)]);
  }
  const TRACK_S: number[] = [0];
  for (let i = 1; i < TRACK.length; i++) {
    const [ax, az] = TRACK[i - 1] as Pt;
    const [bx, bz] = TRACK[i] as Pt;
    TRACK_S.push((TRACK_S[i - 1] as number) + Math.hypot(bx - ax, bz - az));
  }
  const railTile = TRACK.slice(TW - 4, 2 * TW + 5);
  const offRail = (x: number, z: number, m: number) => Math.abs(z - railZ(x)) > 1.6 + m;
  /** Sonar Qila's ground and its foot (nothing else stands there). */
  const qilaFoot = qila.foot.map(([x, z]) => [x + qx, z + qz] as Pt);
  const onQila = (x: number, z: number, m: number) =>
    inside(qilaFoot, x, z) || polyDist(qilaFoot, x, z, true) < m;
  yield;

  // ── the land: dunes, the salt lake, roads, the railway ──
  const inDunes = (x: number, z: number, k = 1) =>
    ((x - DUNES.x) / (DUNES.rx * k)) ** 2 + ((z - DUNES.z) / (DUNES.rz * k)) ** 2 < 1;
  const inSalt = (x: number, z: number, k = 1) =>
    ((x - SALT.x) / (SALT.rx * k)) ** 2 + ((z - SALT.z) / (SALT.rz * k)) ** 2 < 1;
  const duneOutlines: Pt[][] = [];
  {
    // M1: the ripple carpet over the whole dune sea (each ripple cut into 40 m runs, so it batches
    // and culls by area), the blob dunes on it; all painted low, under the roads, off them.
    const flats: G[] = [];
    const ripple = mix(BASE, "#f0a86a", 0.3);
    const crest = mix(BASE, "#ffffff", 0.5);
    for (let z = DUNES.z - DUNES.rz; z < DUNES.z + DUNES.rz; z += 2.6) {
      let run: Pt[] = [];
      const flush = () => {
        if (run.length > 2)
          flats.push(
            PIECES.band(run, 0.45, 0.006, ripple),
            PIECES.band(
              run.map(([x, zz]) => [x, zz - 0.5] as Pt),
              0.11,
              0.026,
              crest,
            ),
          );
        run = [];
      };
      for (let x = DUNES.x - DUNES.rx; x <= DUNES.x + DUNES.rx; x += 1.2) {
        const p: Pt = [x, z + Math.sin(x / 5 + z) * 0.8 + Math.sin(x / 13) * 1.5];
        if (inDunes(p[0], p[1]) && offRoad(p[0], p[1], 1.2)) {
          run.push(p);
          if (run.length > 34) {
            const last = run[run.length - 1] as Pt;
            flush();
            run.push(last);
          }
        } else flush();
      }
      flush();
    }
    const r = PIECES.rng(21);
    for (let i = 0; i < 650 && duneOutlines.length < 105; i++) {
      const x = DUNES.x + (r() - 0.5) * DUNES.rx * 1.8;
      const z = DUNES.z + (r() - 0.5) * DUNES.rz * 1.8;
      const R = 5 + r() * 5;
      if (!inDunes(x, z, 0.85)) continue;
      const o = PIECES.blobOutline(x, z, R, i + 3);
      if (o.some(([px, pz]) => !offRoad(px, pz, 1.5))) continue;
      if (duneOutlines.some((d) => polyDist(d, x, z, true) < R * 1.5 || inside(d, x, z))) continue;
      duneOutlines.push(o);
      const shade = o.map(
        ([px, pz]) => [px + (px - x) * -0.15 + R * 0.3, pz + (pz - z) * -0.25 + R * 0.25] as Pt,
      );
      const lit = o.map(
        ([px, pz]) => [x + (px - x) * 0.45 - R * 0.25, z + (pz - z) * 0.4 - R * 0.2] as Pt,
      );
      flats.push(
        PIECES.flatPoly(o, 0.008, mix(BASE, "#f0a86a", 0.3)),
        PIECES.flatPoly(
          shade.filter(([px, pz]) => inside(o, px, pz)).length > 4 ? shade : o,
          0.012,
          mix(BASE, "#c9805a", 0.3),
        ),
        PIECES.flatPoly(lit, 0.016, mix(BASE, "#ffffff", 0.4)),
      );
    }
    paintFlat(flats);
    // Sambhar's salt lake, cracked.
    paintFlat(
      PIECES.saltPan(SALT.x, SALT.z, SALT.rx, SALT.rz).map((g) => g.translate(0, -0.022, 0)),
    );
  }
  yield;
  // The highway: warm grey tarmac with white dashes, drawn above the lanes that join it.
  lay(ribbon(highway, 5, mix("#9c919a", BASE, 0.2), 0.16));
  for (const d of [-2.4, 2.4]) {
    const dashes = offset(highway, d);
    for (let i = 0; i < dashes.length - 1; i += 3)
      lay(ribbon([dashes[i] as Pt, dashes[i + 1] as Pt], 0.08, "#ffffff", 0.165));
  }
  for (const [ri, s] of specs.entries()) {
    if (ri % 4 === 0) yield;
    if (s.draw === "highway" || s.draw === "qila") continue;
    const r = worldRoads[ri] as WorldRoad;
    if (s.closed) {
      lay(
        ribbon(
          [...s.pts, s.pts[0] as Pt],
          s.half,
          `#${(roadColours(r)[0] as THREE.Color).getHexString()}`,
          0.04,
        ),
      );
      continue;
    }
    const cut = trimmedRoad(worldRoads, ri);
    const all = roadColours(r);
    const m = gradedRoad(
      cut.pts,
      cut.orig.map((i) => all[i] as THREE.Color),
      s.half,
      s.kind === "lane" ? 0.04 : 0.06,
    );
    if (m) lay(m);
  }
  for (const a of junctionAprons(worldRoads.filter((_, i) => specs[i]?.draw !== "highway")))
    lay(flatShape(a.pts, `#${a.colour.getHexString()}`, a.y + (a.band ? 0.08 : 0.075)));
  // The railway: a ballast bed and two rails, over the roads it crosses (level crossings).
  lay(ribbon(railTile, 1.35, mix("#c9b49a", BASE, 0.3), 0.18));
  for (const s of [-0.62, 0.62])
    lay(ribbon(offset(railTile, s), 0.07, mix(P.ink, P.stone, 0.55), 0.22));
  yield;

  // ── Sonar Qila: its carved rock as terrain, its roads, its walls and town ──
  const blockers: WorldData["blockers"] = [];
  const lamps: NonNullable<WorldData["lamps"]> = [];
  const walls: NonNullable<WorldData["walls"]> = [];
  {
    const t = new THREE.Mesh(qila.terrain.clone().translate(qx, 0, qz), mat);
    t.userData.terrain = true;
    lay(t);
    for (const g of qila.roadSurfaces) lay(new THREE.Mesh(g.clone().translate(qx, 0, qz), mat));
    // Its buildings in ~36 m pieces (batched and culled with their areas).
    const cells = new Map<string, G[]>();
    const c = new THREE.Vector3();
    for (const g of qila.parts) {
      g.computeBoundingBox();
      (g.boundingBox as THREE.Box3).getCenter(c);
      const k = `${Math.floor(c.x / 36)},${Math.floor(c.z / 36)}`;
      const l = cells.get(k) ?? [];
      l.push(g);
      cells.set(k, l);
    }
    for (const l of cells.values()) place(join(l), qx, qz);
    for (const [ax, az, bx, bz] of qila.curbs) walls.push([ax + qx, az + qz, bx + qx, bz + qz]);
    for (const [x, z, r] of qila.solids) blockers.push({ x: x + qx, z: z + qz, r });
    for (const l of qila.lamps) lamps.push({ x: l.x + qx, y: l.y, z: l.z + qz, r: l.r });
  }
  yield;

  // ── the landmarks ──
  const houses: NonNullable<WorldData["mapArt"]>["houses"] = [];
  const living: THREE.Object3D[] = [];
  const ponds: V2[][] = [];
  const water: WorldData["water"] = [];
  const decks: NonNullable<WorldData["decks"]> = [];
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
        const yaw = Math.atan2(tz * Math.sign(d), -tx * Math.sign(d));
        return { x, z, yaw };
      }
      acc += l;
    }
    const p = pts[0] as Pt;
    return { x: p[0], z: p[1], yaw: 0 };
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
  type Site = { key: ZingleLandmark; x: number; z: number; yaw: number; road: number };
  const sites: Site[] = [];
  const made = new Map<ZingleLandmark, Landmark>();
  const lmOf = (key: ZingleLandmark): ZLandmark => {
    let lm = made.get(key) as ZLandmark | undefined;
    if (!lm) {
      lm = key === "fort" ? fortLm : ZINGLE_LANDMARKS[key].make();
      made.set(key, lm);
    }
    return lm;
  };
  /** Its reach towards the road (local +z), back, and across. */
  const extents = new Map<Landmark, { front: number; back: number; side: number }>();
  const extent = (lm: Landmark) => {
    const known = extents.get(lm);
    if (known) return known;
    const b = new THREE.Box3();
    lm.body.computeBoundingBox();
    b.copy(lm.body.boundingBox as THREE.Box3);
    if (lm.flats) {
      lm.flats.computeBoundingBox();
      b.union(lm.flats.boundingBox as THREE.Box3);
    }
    const e = { front: b.max.z, back: -b.min.z, side: Math.max(-b.min.x, b.max.x) };
    extents.set(lm, e);
    return e;
  };
  /** Somewhere it fits: clear of the roads (bar its own frontage), the rail, the zones, other sites. */
  const roomFor = (key: ZingleLandmark, x: number, z: number, yaw: number) => {
    const e = extent(lmOf(key));
    const r = Math.max(e.side, e.back);
    const [bx, bz] = toWorld(x, z, yaw, 0, -e.back * 0.5);
    return (
      offRoad(bx, bz, r * 0.75) &&
      offRail(bx, bz, r * 0.8) &&
      !inSalt(bx, bz, 1.15) &&
      !onQila(bx, bz, r) &&
      sites.every((s) => {
        const o = extent(lmOf(s.key));
        return Math.hypot(s.x - x, s.z - z) > Math.max(o.side, o.back) + r * 0.8;
      })
    );
  };
  /** A landmark facing road `ri` near (x, z), on whichever side has room (facing south first). */
  const besideNear = (key: ZingleLandmark, ri: number, x: number, z: number, gap = 2.5) => {
    const sp = specs[ri] as Spec;
    const e = extent(lmOf(key));
    const s0 = sAt(sp.pts, x, z);
    const d = sp.half + gap + e.front;
    // The camera looks north: face south (towards it) where the road allows, so a façade shows.
    const south = beside(sp.pts, s0, d).yaw;
    const sides = Math.cos(south) >= 0 ? [1, -1] : [-1, 1];
    for (const ds of [0, 15, -15, 30, -30, 45, -45, 60, -60])
      for (const side of sides) {
        const b = beside(sp.pts, s0 + ds, side * d);
        if (roomFor(key, b.x, b.z, b.yaw)) {
          sites.push({ key, ...b, road: ri });
          return;
        }
      }
    sites.push({ key, ...beside(sp.pts, s0, d), road: ri });
  };
  // Placed first (each exactly where the layout puts it).
  sites.push({ key: "fort", x: FORT[0], z: FORT[1], yaw: 0, road: RI.fortRoad });
  // The toshakhana always stands with the fort: inside it, facing the gate across the court.
  sites.push({
    key: "toshakhana",
    x: FORT[0] + FORT_TOSHAKHANA[0],
    z: FORT[1] + FORT_TOSHAKHANA[1],
    yaw: 0,
    road: RI.fortRoad,
  });
  sites.push({ key: "pols", ...polAt, road: RI.A });
  sites.push({ key: "station", x: STX, z: railZ(STX) + 7, yaw: 0, road: RI.station });
  // Jaisalmer (west).
  besideNear("haveli", RI.J1, ...W(-384, -245));
  yield;
  besideNear("ghat", RI.hw, s(-470), hwZ(s(-470)), 0.5);
  yield;
  besideNear("badabagh", RI.J1, ...W(-690, -310), 3);
  yield;
  // Jodhpur (middle).
  besideNear("clock", RI.cross, ...W(10, -262), 1);
  yield;
  besideNear("thada", RI.north, ...W(100, -462), 2);
  yield;
  besideNear("dera", RI.D5, ...W(66, 210), 1.5);
  yield;
  // The south and the dunes.
  besideNear("kund", RI.country, ...W(-300, 170));
  yield;
  besideNear("sarai", RI.country, ...W(-320, 250), 3);
  yield;
  besideNear("bivouac", RI.bivouac, ...W(-455, 296), 3);
  yield;
  // Jaipur (east).
  besideNear("bazaar", RI.C1, ...W(440, -200), 1.5);
  yield;
  besideNear("hawa", RI.C3, ...W(590, -430), 3);
  yield;
  besideNear("jantar", RI.K1, ...W(532, 160), 3);
  yield;
  besideNear("stepwell", RI.country, ...W(712, 152), 3);
  yield;

  for (const s of sites) {
    yield;
    const lm = lmOf(s.key);
    const holder = new THREE.Group();
    holder.position.set(s.x, 0, s.z);
    holder.rotation.y = s.yaw;
    holder.userData.spansRoad = true;
    // A big landmark goes in as its pieces (each batched and culled with its own area).
    if (lm.pieces) for (const g of lm.pieces) place(g, s.x, s.z, s.yaw);
    else
      for (const m of [mat, shadow]) {
        const mesh = new THREE.Mesh(lm.body, m);
        mesh.frustumCulled = m !== shadow;
        holder.add(mesh);
      }
    if (lm.flats) holder.add(new THREE.Mesh(lm.flats, mat));
    for (const sg of lm.signs) holder.add(sg);
    scene.add(holder);
    // The pols: nothing solid in their two arches (their piers are).
    const [m0, s0] = POL_ARCHES;
    const solids =
      s.key === "pols"
        ? [
            ...lm.solids.filter(
              ([lx, lz]) =>
                !(Math.abs(lz) < 3 && (Math.abs(lx - m0) < 4.1 || Math.abs(lx - s0) < 4.1)),
            ),
            ...[m0, s0].flatMap((ax) =>
              [-1, 1].flatMap((sd) =>
                [-1, 1].map((zz) => [ax + sd * 2.95, zz * 0.9, 1.05] as [number, number, number]),
              ),
            ),
          ]
        : s.key === "fort"
          ? // The way in: nothing solid in Suraj Pol's passage (its piers and towers are).
            lm.solids.filter(
              ([lx, lz]) =>
                !(
                  Math.abs(lx - FORT_GATE[0]) < 2.1 &&
                  lz > FORT_GATE[1] - 6 &&
                  lz < FORT_GATE[1] + 6
                ),
            )
          : s.key === "sarai"
            ? lm.solids.filter(([lx, lz]) => !(Math.abs(lx) < 1.6 && lz > 2.5 && lz < 7.5))
            : lm.solids;
    for (const [lx, lz, r] of solids) {
      const [x, z] = toWorld(s.x, s.z, s.yaw, lx, lz);
      blockers.push({ x, z, r });
    }
    for (const l of lm.lamps) {
      const [x, z] = toWorld(s.x, s.z, s.yaw, l.x, l.z);
      lamps.push({ x, y: l.y, z, r: l.r });
    }
    if (s.key === "clock") {
      // Ghanta Ghar keeps the rider's local time: live hands on each of its four faces.
      for (const f of CLOCK_FACES) {
        const [x, z] = toWorld(s.x, s.z, s.yaw, f.x, f.z);
        const g = new THREE.Group();
        g.position.set(x, f.y, z);
        g.rotation.y = s.yaw + f.yaw;
        const { hour: hg, minute: mg } = clockHands(f.r);
        const hour = new THREE.Mesh(hg, mat);
        const minute = new THREE.Mesh(mg, mat);
        hour.position.z = 0.16;
        minute.position.z = 0.18;
        g.add(hour, minute);
        g.userData.clock = { hour, minute };
        g.userData.spansRoad = true;
        living.push(g);
      }
    }
    if (s.key === "ghat") {
      // Its lake: water you can wade into, a pond on the map.
      const lake = GHAT_LAKE.map(([lx, lz]) => toWorld(s.x, s.z, s.yaw, lx, lz));
      ponds.push(lake as V2[]);
      const xs = lake.map((p) => p[0]);
      const zs = lake.map((p) => p[1]);
      for (let z = Math.min(...zs) + 1; z < Math.max(...zs); z += 1.5)
        for (let x = Math.min(...xs) + 1; x < Math.max(...xs); x += 1.5)
          if (inside(lake, x, z) && polyDist(lake, x, z, true) > 1.2)
            water.push({
              pts: [
                [x - 0.8, z],
                [x + 0.8, z],
              ],
              width: 1.6,
            });
    }
    if (s.key !== "pols" && s.key !== "fort")
      houses.push({ x: s.x, z: s.z, yaw: s.yaw, s: Math.max(...lm.half) * 0.8 });
  }
  {
    // The fort's moat: water you can wade into (its centreline, as wide as it is), a ring on the
    // map; the bridge across it rides as road.
    const [inner, outer] = FORT_MOAT;
    const inWorld = (p: Pt): Pt => [FORT[0] + p[0], FORT[1] + p[1]];
    const n = inner.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a: Pt = [
        ((inner[i] as Pt)[0] + (outer[i] as Pt)[0]) / 2,
        ((inner[i] as Pt)[1] + (outer[i] as Pt)[1]) / 2,
      ];
      const b: Pt = [
        ((inner[j] as Pt)[0] + (outer[j] as Pt)[0]) / 2,
        ((inner[j] as Pt)[1] + (outer[j] as Pt)[1]) / 2,
      ];
      const w =
        Math.hypot(
          (outer[i] as Pt)[0] - (inner[i] as Pt)[0],
          (outer[i] as Pt)[1] - (inner[i] as Pt)[1],
        ) - 0.6;
      water.push({ pts: [inWorld(a), inWorld(b)] as V2[], width: w });
      ponds.push([inner[i], inner[j], outer[j], outer[i]].map((p) => inWorld(p as Pt)) as V2[]);
    }
    decks.push({
      pts: [inWorld([FORT_GATE[0], FORT_GATE[1] + 1.5]), inWorld(FORT_BRIDGE_END)] as V2[],
      width: 6,
    });
  }
  yield;

  // ── set pieces: rally dressing, dune jumps ──
  {
    // The km stones along the highway (each its own piece: one mesh across the world would draw
    // everywhere).
    const stone = join(PIECES.kmStone(0, 0, 0));
    let k = 0;
    for (let x = -TW / 2 + 30; x < TW / 2; x += 80, k++) {
      const z = hwZ(x) + (k % 2 ? 7 : -7);
      if (!offRoad(x, z, 0.5) || !offRail(x, z, 1)) continue;
      place(stone, x, z, k % 2 ? Math.PI : 0);
    }
  }
  const ramps: Ramp[] = [];
  {
    const n = sand.length;
    const atS = (i: number) => {
      const a = sand[(((i - 1) % n) + n) % n] as Pt;
      const b = sand[(i + 1) % n] as Pt;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return { p: sand[((i % n) + n) % n] as Pt, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l };
    };
    let oi = 0;
    sand.forEach((p, i) => {
      if (
        Math.hypot(p[0] - MOUTH[0], p[1] - MOUTH[1]) <
        Math.hypot((sand[oi] as Pt)[0] - MOUTH[0], (sand[oi] as Pt)[1] - MOUTH[1])
      )
        oi = i;
    });
    // The start arch a little into the dunes, the CP flags and an arrow board at the mouth.
    {
      const q = atS(oi + 12);
      const yaw = Math.atan2(q.tx, q.tz);
      place(startArch(8.4), q.p[0], q.p[1], yaw);
      for (const sd of [-1, 1]) {
        const [x, z] = toWorld(q.p[0], q.p[1], yaw, sd * 4.2, 0);
        blockers.push({ x, z, r: 0.7 });
      }
      const f = atS(oi + 22);
      place(join(PIECES.cpFlags(0, 0, 0)), f.p[0], f.p[1], Math.atan2(f.tx, f.tz));
      const a = atS(oi + 6);
      place(
        join(PIECES.arrowBoard(0, 0, 0)),
        a.p[0] - a.tz * 3.4,
        a.p[1] + a.tx * 3.4,
        Math.atan2(a.tx, a.tz),
      );
    }
    // Dune jumps round the track (they rise along the way round).
    const jump = duneJump(3.2, 4.2, 1.0);
    for (const f of [0.18, 0.36, 0.55, 0.74, 0.9]) {
      const q = atS(Math.round(oi + f * n));
      const yaw = Math.atan2(q.tx, q.tz);
      place(jump, q.p[0], q.p[1], yaw);
      ramps.push({ x: q.p[0], z: q.p[1], yaw, w: 3.2, len: 4.2, h: 1.0 });
    }
  }
  yield;

  // ── the land's life: towns in each city's colour, villages of round huts, the scatter ──
  const r = rng(11);
  type Toy = { id: string; tint?: string; x: number; z: number; yaw: number; scale: number };
  const toys: Toy[] = [];
  const nearSite = (x: number, z: number, m: number) =>
    sites.some((s) => {
      const lm = made.get(s.key) as Landmark;
      return Math.hypot(x - s.x, z - s.z) < Math.hypot(lm.half[0], lm.half[1]) * 0.9 + m;
    });
  // The dunes' outlines, indexed (the scatter asks about them thousands of times).
  const duneGrid = new SegGrid(16);
  const duneBoxes = duneOutlines.map((o) => {
    duneGrid.add(o, true);
    const xs = o.map((p) => p[0]);
    const zs = o.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] as const;
  });
  const offDunes = (x: number, z: number, m: number) =>
    duneGrid.clear(x, z, m) &&
    !duneOutlines.some((o, i) => {
      const b = duneBoxes[i] as readonly number[];
      return (
        x >= (b[0] as number) &&
        x <= (b[2] as number) &&
        z >= (b[1] as number) &&
        z <= (b[3] as number) &&
        inside(o, x, z)
      );
    });
  const free = (x: number, z: number, m: number) =>
    offRoad(x, z, m) &&
    offRail(x, z, m + 1) &&
    !nearSite(x, z, m) &&
    !inSalt(x, z, 1.1) &&
    !onQila(x, z, m + 2) &&
    offDunes(x, z, m);
  // The landmarks' own trees (khejris, neems), as toys the bike can knock over.
  for (const site of sites)
    for (const t of lmOf(site.key).trees ?? []) {
      const [x, z] = toWorld(site.x, site.z, site.yaw, t.x, t.z);
      toys.push({ id: t.id, x, z, yaw: site.yaw, scale: t.s });
    }
  yield;
  // Villages: round huts in loose clusters by the roads, a khejri each.
  const hutGeo = hut();
  const villages: Pt[] = [
    W(-262, 120),
    W(-230, 450),
    W(-40, 470),
    W(140, 420),
    W(250, 330),
    W(400, 330),
    W(700, 290),
    W(690, -120),
    W(-640, -150),
    W(250, -470),
    W(-260, -470),
    W(-60, 250),
    W(180, 150),
    W(-380, 460),
    W(470, 110),
    W(760, -300),
    W(-120, -40),
    W(220, -120),
  ];
  for (const [vx, vz] of villages) {
    yield;
    let n = 0;
    for (let k = 0; k < 40 && n < 6; k++) {
      const a = r() * Math.PI * 2;
      const d = 3 + r() * 14;
      const x = vx + Math.cos(a) * d;
      const z = vz + Math.sin(a) * d;
      const s = 0.85 + r() * 0.3;
      if (!free(x, z, 2.4 * s) || houses.some((h) => Math.hypot(h.x - x, h.z - z) < 4.6 * s))
        continue;
      place(hutGeo, x, z, r() * Math.PI * 2, s);
      blockers.push({ x, z, r: 1.55 * s });
      if (n % 2 === 0) lamps.push({ x, y: 0.9, z, r: 3.2 });
      houses.push({ x, z, yaw: 0, s: 1.6 * s });
      n++;
    }
    for (let k = 0; k < 8; k++) {
      const x = vx + (r() - 0.5) * 26;
      const z = vz + (r() - 0.5) * 26;
      if (free(x, z, 2)) {
        toys.push({ id: "T4", x, z, yaw: r() * Math.PI * 2, scale: 0.9 + r() * 0.3 });
        break;
      }
    }
  }
  // The scatter: khejris, ker bushes and grass tufts, cactus and rocks, sparse (a desert).
  for (let i = 0; i < 10000 && toys.length < 1850; i++) {
    if (i % 500 === 0) yield;
    const x = -TW / 2 + r() * TW;
    const z = -TD / 2 + r() * TD;
    const dunes = inDunes(x, z);
    const roll = r();
    const id = dunes
      ? roll < 0.5
        ? "B8"
        : roll < 0.75
          ? "B6"
          : "T4"
      : roll < 0.3
        ? "T4"
        : roll < 0.55
          ? "B3"
          : roll < 0.72
            ? "B8"
            : roll < 0.84
              ? "B6"
              : roll < 0.93
                ? "R2"
                : "R4";
    const scale = id === "T4" ? 0.85 + r() * 0.45 : 0.7 + r() * 0.5;
    if (dunes && r() < 0.6) continue;
    if (!free(x, z, id === "T4" ? 2.2 : 1.2)) continue;
    toys.push({
      id,
      ...(id === "B3" ? { tint: "#a9b98a" } : {}),
      x,
      z,
      yaw: r() * Math.PI * 2,
      scale,
    });
  }
  // Sleepers along the railway, across the line every 0.9 m.
  for (let i = TW - 2; i < 2 * TW + 2; i++) {
    const a = TRACK[i] as Pt;
    const b = TRACK[i + 1] as Pt;
    const tx = b[0] - a[0];
    const tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    for (let f = 0; f < l; f += 0.9)
      toys.push({
        id: "sleeper",
        x: a[0] + (tx * f) / l,
        z: a[1] + (tz * f) / l,
        yaw: Math.atan2(-tx / l, -tz / l),
        scale: 1,
      });
  }
  yield;
  /**
   * What gets knocked about. The Thar's trees (khejris, neems, the scatter's parasol khejri) are
   * light, feathery things: every one topples when you ride into it, at about 55–70 kg, however
   * big it looks (the shared rule weighs a big canopy at tonnes and makes it a wall).
   */
  const knockOf = (id: string, scale: number) =>
    /^(T|zkhejri|zneem)/.test(id)
      ? { mass: 40 + 22 * scale, sound: "wood" as const, tree: true }
      : knockable(id, scale);
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
    const knock = p.id === "sleeper" ? null : knockOf(p.id, p.scale);
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
    const rr = knock?.tree ? 0 : solidity(p.id, p.scale);
    if (rr > 0.15) blockers.push({ x: p.x, z: p.z, r: rr });
  }
  for (const [k, ps] of groups) {
    yield;
    const [id, tint] = k.split(":") as [string, string];
    const casts = !/^(sleeper|B8)/.test(id);
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
    ...(s.draw === "sand" ? { dusty: true } : {}),
  }));
  const tOn = (road: Road, x: number, z: number) => {
    let best = { t: 0, d: Number.POSITIVE_INFINITY };
    for (let i = 0; i <= 2400; i++) {
      const p = road.at(i / 2400).p;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best.d) best = { t: i / 2400, d };
    }
    return best.t;
  };
  const STOP_KEYS: ZingleLandmark[] = [
    "kund",
    "pols",
    "jantar",
    "ghat",
    "bazaar",
    "dera",
    "toshakhana",
    "stepwell",
    "clock",
    "haveli",
  ];
  const stops: WorldData["stops"] = [];
  for (const s of sites) {
    if (!STOP_KEYS.includes(s.key)) continue;
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
  yield;
  // The ground the bike rides (2 m) and the props' physics (4 m): flat, but for Sonar Qila.
  const heightsOn = (g: THREE.PlaneGeometry) => {
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const h = H(pos.getX(i), pos.getZ(i));
      if (h) pos.setY(i, h);
    }
    return g;
  };
  const physics = new THREE.PlaneGeometry(TW, TD, TW / 4, TD / 4);
  physics.rotateX(-Math.PI / 2);
  heightsOn(physics);
  const groundGeo = new THREE.PlaneGeometry(TW, TD, TW / 2, TD / 2);
  groundGeo.rotateX(-Math.PI / 2);
  heightsOn(groundGeo);
  const ground = new THREE.Mesh(groundGeo, mat);
  const spawnX = s(110);
  const fields = [
    ...duneOutlines.map((o) => ({ pts: o as V2[], colour: mix(BASE, "#c9805a", 0.35) })),
    {
      pts: Array.from(
        { length: 32 },
        (_, k) =>
          [
            SALT.x + Math.cos((k / 32) * Math.PI * 2) * SALT.rx,
            SALT.z + Math.sin((k / 32) * Math.PI * 2) * SALT.rz,
          ] as V2,
      ),
      colour: "#fbf7f2",
    },
    { pts: qilaFoot as V2[], colour: "#e6c48c" },
  ];
  // Last of all: prove every road is continuous and every join is clean (no dead ends, no
  // carry-on seams, no shallow slivers, no kinks or gaps, no crossings away from a junction).
  const roadIssues = checkRoads(specs);
  if (roadIssues.length)
    console.error(`Zingle's roads don't join cleanly:\n${roadIssues.join("\n")}`);
  const world: WorldData = {
    ground,
    physicsGround: new THREE.Mesh(physics),
    shadow,
    size: { w: TW, d: TD },
    roads,
    water,
    blockers,
    walls,
    decks,
    ramps,
    lamps,
    dust: ["#e8c49a", "#d6a874"],
    train: {
      pts: TRACK as V2[],
      s: TRACK_S,
      from: TRACK_S[TW] as number,
      period: (TRACK_S[2 * TW] as number) - (TRACK_S[TW] as number),
      station: TRACK_S[Math.round(STX + 1.5 * TW)] as number,
    },
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
      ponds,
      rail: railTile as V2[],
      houses,
      rocks: [],
      trees: toys.filter((p) => p.id.startsWith("T")).map((p) => [p.x, p.z] as V2),
      bridges: [],
      fields,
    },
    stops,
    junctions: findJunctions(roads.map((q) => ({ road: q.road, closed: !!q.closed }))),
    landmarks: Object.fromEntries(sites.map((s) => [s.key, { x: s.x, z: s.z }])),
    spawn: {
      x: spawnX,
      z: hwZ(spawnX),
      heading: Math.atan2((hwZ(spawnX + 2) - hwZ(spawnX - 2)) / 4, -1),
    },
  };
  return {
    world,
    road: (roads[RI.country] as WorldData["roads"][number]).road,
    moments: [],
    stops: [],
    mapZoom: Math.max(TW, TD),
    mapCentre: [0, 0],
  };
}

/** A seeded random. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export const zingleFlat: JourneyDef = {
  id: "zingle",
  title: "Zingle AI · a Thar desert rally (open world)",
  mood: "golden",
  bike: "rally",
  flat: { ground: BASE },
  build: (scene) => build(scene),
};
