/**
 * Personal projects: an open-world Sikkim / North-East India forest at golden
 * hour. There is no start or finish: the regions are landmarks of one world
 * joined by a trail network (a ring trail, two crossroads connectors, a safari
 * loop, a monastery detour and spurs to viewpoints).
 *
 *  - Centre: the arrival gateway (a Sikkimese welcome gate) at the crossroads,
 *    with a momo/thukpa stall, an orange orchard and cardamom. First visits
 *    spawn here; later visits resume where the rider left off.
 *  - NW: the Sela-style high pass (snow, a frozen lake, the gate arch) with a
 *    Tawang-style monastery above it, plus the Rumtek-style ridge monastery
 *    (lungta flags) on a detour.
 *  - N: deep forest canopy (hoolock gibbons, a hornbill in flight), where a red
 *    panda family crosses the trail.
 *  - NE: a Batasia-style loop where the Darjeeling toy train crosses the trail
 *    (barriers down: a wait moment).
 *  - E: a rhododendron valley in bloom; a spur to the campfire viewpoint.
 *  - SE: a Kaziranga-style grassland park (rhinos, wild buffalo, swamp deer,
 *    an elephant safari, a watchtower) on its own safari loop.
 *  - S: Loktak Lake with floating phumdis and a sangai deer (overlook spur).
 *  - SW: a Khasi/Meghalaya stream village: bamboo stilt houses, a cane bridge
 *    and a double-decker living root bridge in the drizzle (a clouded leopard
 *    hides in a tree nearby).
 *
 * Signposts at junctions are in English; local-language signs always carry
 * English too.
 */

import * as THREE from "three";
import {
  beside,
  carve,
  cornerSign,
  flattenPads,
  type HeightFn,
  type JourneyDef,
  kmStone,
  makeRoad,
  nhaiSign,
  placeOnGround,
  type Road,
  roadMesh,
  type SignLine,
  terrain,
  textSprite,
  type V2,
} from "../journey";
import { box, disc, type Kit, sphere, tube } from "../kit";
import { pine, roundTree } from "../zones";

const g2 = (x: number, z: number, cx: number, cz: number, r: number) =>
  Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));

const WATER = -1.6;
const SIZE: V2 = [200, 140];

/** Distance from a point to a polyline. */
function distToLine(x: number, z: number, line: V2[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    if (!a || !b) continue;
    const abx = b[0] - a[0];
    const abz = b[1] - a[1];
    const l2 = abx * abx + abz * abz || 1;
    const t = Math.min(1, Math.max(0, ((x - a[0]) * abx + (z - a[1]) * abz) / l2));
    best = Math.min(best, Math.hypot(x - (a[0] + abx * t), z - (a[1] + abz * t)));
  }
  return best;
}

// ── Layout ───────────────────────────────────────────────────────────────────

/** The ring trail (closed), clockwise from the Sela-style pass in the NW. */
const RING: V2[] = [
  [-55, -38],
  [-36, -44],
  [-14, -40],
  [8, -44],
  [30, -40],
  [50, -30],
  [66, -16],
  [74, 2],
  [66, 20],
  [48, 28],
  [24, 24],
  [0, 26],
  [-24, 26],
  [-46, 30],
  [-66, 16],
  [-76, -4],
  [-70, -24],
];

/**
 * The river (Teesta-like): it tumbles off a waterfall on the inner west ridge,
 * cuts a deep gorge south across the ring trail, and feeds Loktak Lake.
 */
const STREAM: V2[] = [
  [-38, 9],
  [-34, 14],
  [-31, 19],
  [-28, 24],
  [-26, 31],
  [-21, 39],
  [-14, 45],
  [-6, 48],
];
const FALLS: V2 = [-41, 6];

const LOKTAK: V2 = [6, 47];
const KAZI: V2 = [60, 44];
const POOLS: V2[] = [
  [62, 48],
  [52, 52],
  [68, 40],
];
/** Braided Brahmaputra-style channels across the Kaziranga floodplain. */
const BRAIDS: V2[][] = [
  [
    [44, 36],
    [50, 40],
    [55, 39],
    [61, 43],
    [66, 42],
    [72, 46],
  ],
  [
    [46, 47],
    [51, 45],
    [57, 47],
    [62, 52],
    [67, 50],
    [73, 52],
  ],
  [
    [50, 40],
    [53, 44],
    [57, 47],
  ],
  [
    [61, 43],
    [63, 47],
    [62, 52],
  ],
];
const ICE: V2 = [-68, -46];
const ICE_R = 5;
const TERRACES: V2 = [-46, 40];
/** A Lepcha/Bhutia hill village on terraced slopes, inside the ring (NW). */
const VILLAGE: V2 = [-34, -17];

// Value noise + ridged multifractal: crisp Himalayan ridgelines, no blobs.
function hash2(ix: number, iz: number): number {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = THREE.MathUtils.lerp(hash2(ix, iz), hash2(ix + 1, iz), u);
  const b = THREE.MathUtils.lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), u);
  return THREE.MathUtils.lerp(a, b, v);
}
function ridged(x: number, z: number): number {
  let sum = 0;
  let amp = 1;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    const n = 1 - Math.abs(vnoise(x * f + o * 17.3, z * f - o * 9.1) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.07;
  }
  return sum / norm;
}

/** Soft terraces: flat treads with eased risers (paddy terraces on a slope). */
function terraced(h: number, step: number): number {
  const k = h / step;
  const f = k - Math.floor(k);
  return (Math.floor(k) + THREE.MathUtils.smootherstep(f, 0.72, 1)) * step;
}
const terraceMask = (x: number, z: number) =>
  Math.max(g2(x, z, TERRACES[0], TERRACES[1], 7.5), g2(x, z, VILLAGE[0], VILLAGE[1], 8));

/** The shape of the world: ridges everywhere except where a place needs calm. */
const land: HeightFn = (x, z) => {
  const calm = Math.max(
    g2(x, z, 0, -2, 13), // the village square at the crossroads
    g2(x, z, LOKTAK[0], LOKTAK[1], 13),
    g2(x, z, KAZI[0], KAZI[1], 17),
    g2(x, z, 50, -44, 10), // Batasia plateau
  );
  const ridges = (1 - calm) * 9.5 * (ridged(x * 0.042, z * 0.042) - 0.32);
  let h =
    1.2 +
    ridges +
    12 * g2(x, z, -64, -50, 13) +
    6 * g2(x, z, -76, -58, 6) +
    5.5 * g2(x, z, -55, -61, 6) +
    5 * g2(x, z, -84, -46, 7) +
    6 * g2(x, z, -86, -60, 9) + // Sela-style massif
    7 * g2(x, z, -22, -57, 8) + // Rumtek-style ridge
    4 * g2(x, z, 50, -46, 11) + // Batasia plateau
    7 * g2(x, z, 87, -6, 8) +
    5 * g2(x, z, 80, 16, 10) + // campfire hill, rhododendron slopes
    6 * g2(x, z, -84, 18, 10) +
    4 * g2(x, z, 24, -22, 14) +
    7.5 * g2(x, z, FALLS[0] - 2, FALLS[1] - 2, 5) + // inner ridge with the falls
    6 * g2(x, z, TERRACES[0], TERRACES[1], 10) +
    6.5 * g2(x, z, VILLAGE[0], VILLAGE[1], 10) + // terraced hillsides
    -6.5 * g2(x, z, LOKTAK[0], LOKTAK[1], 9.5);
  // Paddy terraces on the hillside above the river village.
  const tm = terraceMask(x, z);
  if (tm > 0.02) h = THREE.MathUtils.lerp(h, terraced(h, 0.75), Math.min(1, tm * 1.4));
  // Kaziranga: a flat Brahmaputra floodplain, just above the water.
  const kz = 1 - THREE.MathUtils.smootherstep(Math.hypot(x - KAZI[0], z - KAZI[1]), 15, 23);
  return THREE.MathUtils.lerp(h, WATER + 0.8, kz);
};

/** Land plus water: the river gorge, braided channels, pools, the frozen lake. */
const withWater: HeightFn = (x, z) => {
  let h = land(x, z);
  for (const [px, pz] of POOLS) h -= 2.8 * g2(x, z, px, pz, 2.2);
  for (const braid of BRAIDS) {
    const d = distToLine(x, z, braid);
    if (d < 1.6) h = Math.min(h, WATER - 0.45 + d * 0.55);
  }
  // A deep, V-shaped gorge with a narrow river at the bottom.
  const d = distToLine(x, z, STREAM);
  const gorge = 7.5 * Math.exp(-((d / 6.5) ** 2));
  const bed = WATER - 0.7 + Math.max(0, d - 1.8) * 1.5;
  h = Math.min(h - gorge, bed);
  // The frozen lake sits in a level hollow below the pass.
  const di = Math.hypot(x - ICE[0], z - ICE[1]);
  const iceLevel = land(ICE[0], ICE[1]) - 0.6;
  if (di < ICE_R + 8)
    h = THREE.MathUtils.lerp(iceLevel, h, THREE.MathUtils.smootherstep(di, ICE_R, ICE_R + 8));
  return h;
};

/** Roads never dip into water: bridges carry them over the river and channels. */
const dry =
  (h: HeightFn): HeightFn =>
  (x, z) =>
    Math.max(h(x, z), WATER + 1.1);

/** Nearest t on a road to a point. */
function tNear(r: Road, x: number, z: number, from = 0, to = 1): number {
  let best = from;
  let bd = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= 600; i++) {
    const t = from + ((to - from) * i) / 600;
    const p = r.at(t).p;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

/** Control points for a road that leaves `main` at t1 and rejoins at t2 (or ends at `via`'s last point). */
function fork(main: Road, t1: number, via: V2[], t2?: number): V2[] {
  const a = main.at(t1);
  const a2 = main.at(t1 + (main.length > 300 ? 0.006 : 0.012));
  const pts: V2[] = [[a.p.x, a.p.z], [a2.p.x, a2.p.z], ...via];
  if (t2 !== undefined) {
    const b0 = main.at(t2 - (main.length > 300 ? 0.006 : 0.012));
    const b = main.at(t2);
    pts.push([b0.p.x, b0.p.z], [b.p.x, b.p.z]);
  }
  return pts;
}

/**
 * The board frames moments on `built.road` only. In an open world the set
 * pieces sit on different roads, so this "director" road maps equal slices
 * of t onto the network's roads (slice 0 is the ring trail).
 */
function director(parts: Road[]): Road {
  const k = parts.length;
  const pick = (t: number) => {
    const i = Math.min(k - 1, Math.max(0, Math.floor(t * k)));
    const part = parts[i] ?? parts[0];
    if (!part) throw new Error("director needs at least one road");
    return { part, local: THREE.MathUtils.clamp(t * k - i, 0, 1) };
  };
  const first = parts[0];
  if (!first) throw new Error("director needs at least one road");
  return {
    curve: first.curve,
    length: first.length,
    at: (t) => {
      const { part, local } = pick(t);
      return part.at(local);
    },
    corners: () => [],
    samples: first.samples,
  };
}

// ── Props ──────────────────────────────────────────────────────────────────

function rhododendron(kit: Kit, h = 1): THREE.Group {
  const g = roundTree(kit, "#4f8f4a", "#5a3d2b", h);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(
      sphere(
        kit,
        i % 2 ? "#e0457b" : "#f06292",
        [Math.cos(a) * 0.45 * h, (1.3 + (i % 3) * 0.2) * h, Math.sin(a) * 0.45 * h],
        0.13 * h,
      ),
    );
  }
  return g;
}

function bambooGrove(kit: Kit, seed: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = seed * 1.7 + i * 2.3;
    const r = 0.25 + ((i * 37) % 10) / 14;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 2.6 + ((i * 13) % 7) * 0.25;
    g.add(tube(kit, i % 3 ? "#7fb24a" : "#94c25a", [x, 0, z], [x * 1.15, h, z * 1.15], 0.05));
    for (let k = 1; k < 4; k++)
      g.add(
        tube(
          kit,
          "#5e8f34",
          [x * 1.15, h * (k / 4), z * 1.15],
          [x * 1.15 + 0.35, h * (k / 4) + 0.15, z * 1.15],
          0.02,
        ),
      );
    g.add(sphere(kit, "#6fa83e", [x * 1.2, h, z * 1.2], 0.3, undefined, [1, 0.5, 1]));
  }
  return g;
}

function stiltHouse(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1.2, 0, 1.2])
    for (const z of [-0.9, 0.9]) g.add(tube(kit, "#b38b4a", [x, 0, z], [x, 1.4, z], 0.07));
  g.add(box(kit, "#a0743f", [-1.5, 1.4, -1.1], [1.5, 1.55, 1.1]));
  g.add(box(kit, "#d9b77a", [-1.3, 1.55, -0.9], [1.3, 2.7, 0.9]));
  for (let i = 0; i < 6; i++)
    g.add(box(kit, "#c49b5c", [-1.31, 1.7 + i * 0.17, -0.91], [1.31, 1.75 + i * 0.17, 0.91]));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 2.0, 1.2, 4), kit.mat("#8a6a3a"));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1, 0.8);
  roof.position.y = 3.25;
  roof.castShadow = true;
  g.add(roof);
  g.add(box(kit, "#3a2a1c", [-0.25, 1.6, 0.89], [0.25, 2.3, 0.93]));
  g.add(box(kit, "#ffd28a", [0.6, 2.0, 0.89], [0.95, 2.3, 0.93], { emissive: true }));
  // bamboo ladder
  g.add(tube(kit, "#b38b4a", [-0.5, 0, 1.7], [-0.5, 1.45, 1.05], 0.035));
  g.add(tube(kit, "#b38b4a", [0.0, 0, 1.7], [0.0, 1.45, 1.05], 0.035));
  return g;
}

/** A cane suspension bridge: deck slats, two hand ropes, posts. */
function caneBridge(kit: Kit, len: number): THREE.Group {
  const g = new THREE.Group();
  const n = Math.round(len / 0.35);
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i / n) * len;
    const sag = -Math.sin((i / n) * Math.PI) * 0.25;
    g.add(
      box(
        kit,
        i % 2 ? "#a77c45" : "#b98c50",
        [x - 0.14, 0.45 + sag, -1.9],
        [x + 0.14, 0.53 + sag, 1.9],
      ),
    );
  }
  for (const z of [-1.95, 1.95]) {
    for (const x of [-len / 2, len / 2]) g.add(tube(kit, "#7a5a33", [x, 0, z], [x, 1.7, z], 0.07));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++)
      pts.push(
        new THREE.Vector3(-len / 2 + (i / 20) * len, 1.6 - Math.sin((i / 20) * Math.PI) * 0.45, z),
      );
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 6),
      kit.mat("#8a6a3a"),
    );
    rope.castShadow = true;
    g.add(rope);
  }
  return g;
}

function chorten(kit: Kit, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#f4f1ea", [-0.6 * s, 0, -0.6 * s], [0.6 * s, 0.35 * s, 0.6 * s]));
  g.add(box(kit, "#f4f1ea", [-0.45 * s, 0.35 * s, -0.45 * s], [0.45 * s, 0.6 * s, 0.45 * s]));
  g.add(sphere(kit, "#f8f6f0", [0, 0.9 * s, 0], 0.42 * s, undefined, [1, 0.9, 1]));
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(0.16 * s, 0.9 * s, 16),
    kit.mat("#e3b23c", { metal: true }),
  );
  spire.position.y = 1.65 * s;
  spire.castShadow = true;
  g.add(spire);
  return g;
}

function monastery(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#e9e2d2", [-4, 0, -2], [4, 0.5, 2.4]));
  g.add(box(kit, "#f4efe4", [-3.2, 0.5, -1.6], [3.2, 3.0, 1.6]));
  g.add(box(kit, "#8a1f1a", [-3.25, 2.5, -1.65], [3.25, 3.0, 1.65]));
  for (let i = 0; i < 4; i++)
    g.add(box(kit, "#e3b23c", [-2.6 + i * 1.6, 1.2, 1.59], [-2.0 + i * 1.6, 2.2, 1.63]));
  g.add(box(kit, "#7a1a16", [-0.6, 0.5, 1.59], [0.6, 2.2, 1.66]));
  const roof1 = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 4.4, 1.0, 4),
    kit.mat("#d9a32a", { metal: true }),
  );
  roof1.rotation.y = Math.PI / 4;
  roof1.scale.set(1, 1, 0.62);
  roof1.position.y = 3.5;
  roof1.castShadow = true;
  g.add(roof1);
  g.add(box(kit, "#f4efe4", [-1.4, 4.0, -0.8], [1.4, 5.0, 0.8]));
  g.add(box(kit, "#8a1f1a", [-1.45, 4.7, -0.85], [1.45, 5.0, 0.85]));
  const roof2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 2.2, 0.8, 4),
    kit.mat("#d9a32a", { metal: true }),
  );
  roof2.rotation.y = Math.PI / 4;
  roof2.scale.set(1, 1, 0.62);
  roof2.position.y = 5.4;
  roof2.castShadow = true;
  g.add(roof2);
  const finial = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 1.0, 12),
    kit.mat("#f2c14e", { metal: true }),
  );
  finial.position.y = 6.3;
  g.add(finial);
  // row of prayer wheels along the front
  for (let i = 0; i < 10; i++) {
    const x = -3.6 + i * 0.8;
    g.add(tube(kit, "#d93a2f", [x, 0.55, 2.2], [x, 1.05, 2.2], 0.17));
    g.add(tube(kit, "#e3b23c", [x, 0.62, 2.2], [x, 0.7, 2.2], 0.18));
  }
  g.add(box(kit, "#8a1f1a", [-4, 1.05, 1.95], [4, 1.15, 2.45]));
  return g;
}

/** Lungta: a rope of five-colour flags strung across the trail. */
function lungta(kit: Kit, a: THREE.Vector3, b: THREE.Vector3, h = 3.2): THREE.Group {
  const g = new THREE.Group();
  for (const p of [a, b])
    g.add(tube(kit, "#6b4a32", [p.x, p.y, p.z], [p.x, p.y + h + 0.2, p.z], 0.06));
  const cols = ["#2b6cb0", "#f4f1ea", "#d93a2f", "#4f9a45", "#f2c14e"];
  const n = Math.max(8, Math.round(a.distanceTo(b) / 0.42));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const y = a.y + (b.y - a.y) * t + h - Math.sin(t * Math.PI) * 0.7;
    const f = box(kit, cols[i % 5] ?? "#fff", [-0.15, -0.38, -0.02], [0.15, 0, 0.02]);
    f.position.set(x, y, z);
    f.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    g.add(f);
  }
  return g;
}

/** A red panda: rust body, white face, dark legs, ringed tail. Cute first. */
function redPanda(kit: Kit, s = 1): THREE.Group {
  const g = new THREE.Group();
  const RUST = "#b9512a";
  const DARK = "#3a1d14";
  g.add(sphere(kit, RUST, [0, 0.42 * s, 0], 0.32 * s, undefined, [1.45, 0.85, 0.9]));
  for (const [x, z] of [
    [0.28, 0.15],
    [0.28, -0.15],
    [-0.28, 0.15],
    [-0.28, -0.15],
  ] as V2[])
    g.add(tube(kit, DARK, [x * s, 0.3 * s, z * s], [x * s, 0, z * s], 0.07 * s));
  // head
  g.add(sphere(kit, RUST, [0.52 * s, 0.62 * s, 0], 0.24 * s));
  g.add(sphere(kit, "#f6efe6", [0.68 * s, 0.6 * s, 0], 0.13 * s, undefined, [0.7, 0.8, 1.2]));
  for (const z of [-0.1, 0.1]) {
    g.add(sphere(kit, "#f6efe6", [0.62 * s, 0.7 * s, z * 1.4 * s], 0.06 * s));
    g.add(sphere(kit, DARK, [0.72 * s, 0.68 * s, z * s], 0.035 * s));
    g.add(
      sphere(kit, "#f6efe6", [0.48 * s, 0.86 * s, z * 1.8 * s], 0.08 * s, undefined, [0.8, 1, 0.5]),
    );
  }
  g.add(sphere(kit, DARK, [0.8 * s, 0.6 * s, 0], 0.035 * s));
  // ringed tail curling up behind
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = (-0.42 - t * 0.55) * s;
    const y = (0.45 + Math.sin(t * Math.PI * 0.8) * 0.35) * s;
    g.add(sphere(kit, i % 2 ? "#e7b07a" : "#a8441f", [x, y, 0], (0.12 - t * 0.03) * s));
  }
  return g;
}

function rhino(kit: Kit, s = 1): THREE.Group {
  const g = new THREE.Group();
  const GREY = "#a3adb6";
  g.add(sphere(kit, GREY, [0, 0.9 * s, 0], 0.85 * s, undefined, [1.6, 0.85, 0.85]));
  for (const x of [-0.7, 0.7])
    g.add(sphere(kit, "#9a9e9f", [x * s, 1.15 * s, 0], 0.55 * s, undefined, [0.9, 0.8, 0.95]));
  for (const [x, z] of [
    [0.8, 0.4],
    [0.8, -0.4],
    [-0.8, 0.4],
    [-0.8, -0.4],
  ] as V2[])
    g.add(tube(kit, GREY, [x * s, 0.6 * s, z * s], [x * s, 0, z * s], 0.2 * s));
  g.add(sphere(kit, GREY, [1.55 * s, 0.85 * s, 0], 0.48 * s, undefined, [1.3, 0.85, 0.85]));
  // Armour-plate folds, ears and the single horn make it read as an Indian rhino.
  for (const x of [-0.35, 0.35])
    g.add(
      tube(kit, "#8f9aa3", [x * s, 0.55 * s, -0.86 * s], [x * s, 1.45 * s, -0.4 * s], 0.05 * s),
    );
  for (const z of [-0.18, 0.18])
    g.add(sphere(kit, GREY, [1.25 * s, 1.35 * s, z * s], 0.1 * s, undefined, [0.6, 1.4, 0.6]));
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.17 * s, 0.75 * s, 12), kit.mat("#e7dfcf"));
  horn.position.set(2.05 * s, 1.25 * s, 0);
  horn.rotation.z = -0.35;
  horn.castShadow = true;
  g.add(horn);
  for (const z of [-0.22, 0.22]) {
    g.add(sphere(kit, "#7a7e7f", [1.3 * s, 1.25 * s, z * s], 0.11 * s, undefined, [0.6, 1.2, 0.6]));
    g.add(sphere(kit, "#1c1d21", [1.75 * s, 1.0 * s, z * 1.2 * s], 0.05 * s));
  }
  return g;
}

function campfire(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++)
    g.add(
      tube(
        kit,
        "#6b4a32",
        [Math.cos(i) * 0.45, 0.06, Math.sin(i) * 0.45],
        [-Math.cos(i) * 0.45, 0.12, -Math.sin(i) * 0.45],
        0.07,
      ),
    );
  for (let i = 0; i < 10; i++)
    g.add(sphere(kit, "#8a8580", [Math.cos(i * 0.63) * 0.7, 0.06, Math.sin(i * 0.63) * 0.7], 0.12));
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.95, 14),
    kit.mat("#ff8a2a", { emissive: true }),
  );
  outer.position.y = 0.55;
  g.add(outer);
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.6, 12),
    kit.mat("#ffd36b", { emissive: true }),
  );
  inner.position.y = 0.45;
  g.add(inner);
  // log benches around the fire
  for (const a of [0.4, 2.4, 4.4]) {
    const bench = box(kit, "#7a5236", [-0.7, 0, 1.0], [0.7, 0.3, 1.35]);
    const pivot = new THREE.Group();
    pivot.add(bench);
    pivot.rotation.y = a;
    g.add(pivot);
  }
  return g;
}

/** Ten little camps, each with a hint of the project it holds. */
function camp(kit: Kit, i: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#8a6a45", [-1.3, 0, -1.0], [1.3, 0.14, 1.0]));
  const tentCol = ["#d9653b", "#2f7d6b", "#e3b23c", "#5a6fb0", "#b84a62"][i % 5] ?? "#d9653b";
  const tent = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.1, 4), kit.mat(tentCol));
  tent.rotation.y = Math.PI / 4;
  tent.position.set(-0.6, 0.69, -0.3);
  tent.castShadow = true;
  g.add(tent);
  const H = 0.14;
  switch (i % 10) {
    case 0: {
      // drone + gate
      const gate = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.05, 8, 28),
        kit.mat("#ff4fa3", { emissive: true }),
      );
      gate.position.set(0.6, 1.0, 0);
      gate.castShadow = true;
      g.add(gate);
      g.add(box(kit, "#222428", [0.25, 1.6, -0.12], [0.5, 1.66, 0.12]));
      for (const [dx, dz] of [
        [0.2, 0.2],
        [0.2, -0.2],
        [-0.2, 0.2],
        [-0.2, -0.2],
      ] as V2[])
        g.add(disc(kit, "#9aa3ad", [0.37 + dx * 0.7, 1.68, dz * 0.7], 0.08, 0.01));
      break;
    }
    case 1:
      // TurtleBot on a sand patch tracing a pattern
      g.add(disc(kit, "#e8d3a8", [0.55, H + 0.01, 0.2], 0.6, 0.02));
      g.add(disc(kit, "#2b2d33", [0.55, H + 0.12, 0.2], 0.2, 0.2));
      g.add(disc(kit, "#4ade80", [0.55, H + 0.24, 0.2], 0.08, 0.03, { emissive: true }));
      break;
    case 2:
      // arcade cabinet (games)
      g.add(box(kit, "#5b2a86", [0.3, H, -0.25], [0.85, H + 1.25, 0.25]));
      g.add(box(kit, "#7ef0ff", [0.32, H + 0.75, 0.24], [0.83, H + 1.1, 0.27], { emissive: true }));
      break;
    case 3:
      // attendance: camera on tripod facing a face-outline screen
      for (const a of [0, 2.1, 4.2])
        g.add(
          tube(
            kit,
            "#3a3d44",
            [0.5, H, 0],
            [0.5 + Math.cos(a) * 0.3, H + 0.02, Math.sin(a) * 0.3],
            0.02,
          ),
        );
      g.add(tube(kit, "#3a3d44", [0.5, H, 0], [0.5, H + 0.9, 0], 0.025));
      g.add(box(kit, "#1c1d21", [0.4, H + 0.9, -0.12], [0.62, H + 1.06, 0.12]));
      g.add(box(kit, "#2b2d33", [0.9, H, -0.4], [1.0, H + 1.1, 0.4]));
      g.add(sphere(kit, "#4ade80", [0.9, H + 0.75, 0], 0.18, { emissive: true }, [0.3, 1.2, 1]));
      break;
    case 4:
      // IMDb bot: radio mast with a speech bubble
      g.add(tube(kit, "#9aa3ad", [0.6, H, 0], [0.6, H + 2.0, 0], 0.04));
      g.add(sphere(kit, "#5865f2", [0.6, H + 2.1, 0], 0.12, { emissive: true }));
      g.add(box(kit, "#f5c518", [0.75, H + 1.4, -0.3], [1.25, H + 1.75, 0.3]));
      break;
    case 5:
      // home server rack in a little shed
      g.add(box(kit, "#7d8590", [0.2, H, -0.5], [1.05, H + 1.2, 0.5]));
      for (let k = 0; k < 4; k++)
        g.add(
          box(
            kit,
            k % 2 ? "#4ade80" : "#60a5fa",
            [1.04, H + 0.25 + k * 0.2, -0.25],
            [1.07, H + 0.3 + k * 0.2, -0.05],
            { emissive: true },
          ),
        );
      break;
    case 6:
      // blog: writing desk + lantern
      g.add(box(kit, "#7a5236", [0.3, H + 0.55, -0.4], [1.0, H + 0.62, 0.4]));
      for (const [x, z] of [
        [0.35, -0.35],
        [0.95, -0.35],
        [0.35, 0.35],
        [0.95, 0.35],
      ] as V2[])
        g.add(tube(kit, "#5a3d2b", [x, H, z], [x, H + 0.55, z], 0.03));
      g.add(box(kit, "#f4efe4", [0.45, H + 0.62, -0.2], [0.75, H + 0.66, 0.15]));
      g.add(sphere(kit, "#ffd28a", [0.9, H + 0.75, 0.25], 0.08, { emissive: true }));
      break;
    case 7: {
      // satellite orbit sim: dish + orbiting satellite
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3),
        kit.mat("#e6e8ec"),
      );
      dish.position.set(0.6, H + 1.0, 0);
      dish.rotation.z = 0.8;
      dish.castShadow = true;
      g.add(dish);
      g.add(tube(kit, "#9aa3ad", [0.6, H, 0], [0.6, H + 0.9, 0], 0.05));
      g.add(box(kit, "#c9a227", [1.2, H + 2.2, -0.1], [1.4, H + 2.4, 0.1]));
      g.add(box(kit, "#2b6cb0", [1.05, H + 2.27, -0.04], [1.55, H + 2.33, 0.04]));
      break;
    }
    case 8:
      // thermal camera + heat-map screen
      g.add(box(kit, "#2b2d33", [0.35, H, -0.35], [0.95, H + 0.5, 0.35]));
      for (let k = 0; k < 4; k++)
        g.add(
          box(
            kit,
            ["#2b1d8a", "#d93a2f", "#f2c14e", "#ff6b00"][k] ?? "#fff",
            [0.96, H + 0.12 + (k % 2) * 0.18, -0.25 + Math.floor(k / 2) * 0.25],
            [0.98, H + 0.28 + (k % 2) * 0.18, -0.02 + Math.floor(k / 2) * 0.25],
            { emissive: true },
          ),
        );
      break;
    default: {
      // student forum: a second tent and a signpost
      const t2 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 4), kit.mat("#4f9a45"));
      t2.rotation.y = Math.PI / 4;
      t2.position.set(0.6, 0.59, 0.3);
      t2.castShadow = true;
      g.add(t2);
      g.add(tube(kit, "#6b4a32", [1.0, H, -0.5], [1.0, H + 1.2, -0.5], 0.04));
      g.add(box(kit, "#c49b5c", [0.75, H + 0.9, -0.52], [1.4, H + 1.1, -0.48]));
    }
  }
  const sign = textSprite(String(i + 1), "#ffffff", "#1f3326");
  sign.position.set(0.1, 2.3, 0);
  sign.scale.set(1.0, 0.5, 1);
  g.add(sign);
  return g;
}

// ── New props (v2) ─────────────────────────────────────────────────────────

/** A soft, translucent material for mist and drizzle (never casts shadows). */
function veil(colour: string, opacity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: colour,
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: 1,
  });
}

/** A road-like ribbon offset sideways from a road's centreline (rails, edges). */
function offsetRibbon(
  kit: Kit,
  road: Road,
  offset: number,
  width: number,
  colour: string,
  lift: number,
  steps = 600,
): THREE.Mesh {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const { p, normal } = road.at(i / steps);
    const cx = p.x + normal.x * offset;
    const cz = p.z + normal.z * offset;
    pos.push(cx + normal.x * (width / 2), p.y + lift, cz + normal.z * (width / 2));
    pos.push(cx - normal.x * (width / 2), p.y + lift, cz - normal.z * (width / 2));
    if (i < steps) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = (kit.mat(colour) as THREE.MeshStandardMaterial).clone();
  mat.side = THREE.DoubleSide;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -6;
  mat.polygonOffsetUnits = -6;
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

/** A bilingual sign board on a post (English always on top). */
function bilingual(kit: Kit, english: string, local: string, bg = "#8a1f1a", h = 2.2): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#6b4a32", [0, 0, 0], [0, h, 0], 0.06));
  const en = textSprite(english, "#ffffff", bg);
  en.position.set(0, h + 0.55, 0);
  en.scale.set(1.5, 0.6, 1);
  g.add(en);
  const lo = textSprite(local, "#1f2a1f", "#f4ead2");
  lo.position.set(0, h, 0);
  lo.scale.set(1.2, 0.5, 1);
  g.add(lo);
  return g;
}

/** A photo-spot sign: a camera icon on a post (postcards are framed here). */
function photoSpot(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#3a3d44", [0, 0, 0], [0, 1.7, 0], 0.05));
  g.add(box(kit, "#f4f1ea", [-0.55, 1.6, -0.08], [0.55, 2.4, 0.08]));
  g.add(box(kit, "#1f2328", [-0.32, 1.8, 0.07], [0.32, 2.2, 0.12]));
  g.add(disc(kit, "#7fb3e6", [0, 2.0, 0.14], 0.12, 0.04, { emissive: true }));
  g.add(box(kit, "#1f2328", [-0.18, 2.2, 0.07], [0.02, 2.28, 0.12]));
  const s = textSprite("PHOTO SPOT", "#1f2328", "#ffd166");
  s.position.set(0, 2.8, 0);
  s.scale.set(1.3, 0.55, 1);
  g.add(s);
  return g;
}

/** The arrival gateway: a Sikkimese welcome gate with prayer flags. */
function welcomeGate(kit: Kit, span: number): THREE.Group {
  const g = new THREE.Group();
  const RED = "#a3241c";
  const GOLD = "#e3b23c";
  for (const z of [-span / 2, span / 2]) {
    g.add(box(kit, "#f2ead8", [-0.6, 0, z - 0.6], [0.6, 0.5, z + 0.6]));
    g.add(box(kit, RED, [-0.38, 0.5, z - 0.38], [0.38, 5.2, z + 0.38]));
    for (let i = 0; i < 4; i++)
      g.add(
        box(
          kit,
          i % 2 ? "#2b6cb0" : GOLD,
          [-0.4, 1.2 + i * 1.0, z - 0.4],
          [0.4, 1.32 + i * 1.0, z + 0.4],
        ),
      );
    // Snow-lion-ish finial pots on the pillar tops
    g.add(sphere(kit, GOLD, [0, 5.4, z], 0.32, { metal: true }));
  }
  // Painted lintel beams in the five lungta colours
  const cols = ["#2b6cb0", "#f4f1ea", "#d93a2f", "#4f9a45", "#f2c14e"];
  cols.forEach((c, i) => {
    g.add(
      box(kit, c, [-0.5, 4.3 + i * 0.16, -span / 2 - 0.8], [0.5, 4.46 + i * 0.16, span / 2 + 0.8]),
    );
  });
  // Sweeping pagoda roof with upturned eaves
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.6, 1.0, 4, 1), kit.mat("#2f7a4a"));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.2, 1, (span + 2.4) / 2.1);
  roof.position.y = 5.75;
  roof.castShadow = true;
  g.add(roof);
  for (const z of [-span / 2 - 1.3, span / 2 + 1.3])
    g.add(sphere(kit, GOLD, [0, 5.35, z], 0.18, { metal: true }));
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.9, 16),
    kit.mat(GOLD, { metal: true }),
  );
  crown.position.y = 6.7;
  g.add(crown);
  const en = textSprite("WELCOME", "#fff6d8", RED);
  en.position.set(0.6, 3.75, 0);
  en.scale.set(2.6, 1.0, 1);
  g.add(en);
  const lo = textSprite("स्वागतम्", "#1f2a1f", "#f4ead2");
  lo.position.set(0.6, 3.05, 0);
  lo.scale.set(1.8, 0.7, 1);
  g.add(lo);
  return g;
}

/** A Darjeeling-style toy train: blue saddle-tank engine + two coaches. */
function toyTrain(kit: Kit): { engine: THREE.Group; coach: () => THREE.Group } {
  const BLUE = "#2a5aa8";
  const CREAM = "#efe2c4";
  const engine = new THREE.Group();
  engine.add(box(kit, "#1c1d21", [-1.1, 0.25, -0.45], [1.1, 0.45, 0.45]));
  engine.add(tube(kit, BLUE, [-0.4, 0.85, 0], [1.05, 0.85, 0], 0.42));
  engine.add(box(kit, BLUE, [-1.2, 0.45, -0.55], [-0.35, 1.65, 0.55]));
  engine.add(box(kit, "#1c1d21", [-1.3, 1.65, -0.62], [-0.25, 1.78, 0.62]));
  engine.add(box(kit, "#bcd6ee", [-1.21, 1.05, -0.4], [-0.35, 1.4, 0.4], { glass: true }));
  engine.add(tube(kit, "#1c1d21", [0.8, 1.2, 0], [0.8, 1.75, 0], 0.13));
  engine.add(disc(kit, "#fff3c4", [1.12, 0.95, 0], 0.13, 0.04, { emissive: true }));
  for (const x of [-0.7, 0, 0.7])
    for (const z of [-0.47, 0.47]) engine.add(disc(kit, "#b03a2e", [x, 0.25, z], 0.22, 0.06));
  // a puff of steam
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 + i * 0.08, 14, 10),
      veil("#f7f4ee", 0.55 - i * 0.1),
    );
    p.position.set(0.8 - i * 0.35, 1.95 + i * 0.32, 0);
    engine.add(p);
  }
  const coach = () => {
    const c = new THREE.Group();
    c.add(box(kit, BLUE, [-1.1, 0.4, -0.55], [1.1, 1.55, 0.55]));
    c.add(box(kit, CREAM, [-1.11, 1.0, -0.56], [1.11, 1.3, 0.56]));
    for (let i = 0; i < 4; i++)
      c.add(
        box(kit, "#bcd6ee", [-0.95 + i * 0.5, 1.03, 0.55], [-0.65 + i * 0.5, 1.27, 0.58], {
          glass: true,
        }),
      );
    c.add(box(kit, "#3a3d44", [-1.15, 1.55, -0.6], [1.15, 1.65, 0.6]));
    for (const x of [-0.7, 0.7])
      for (const z of [-0.47, 0.47]) c.add(disc(kit, "#1c1d21", [x, 0.25, z], 0.18, 0.06));
    return c;
  };
  return { engine, coach };
}

/** A level-crossing boom barrier (lowered), with a flashing lamp. */
function boom(kit: Kit, len: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#3a3d44", [-0.2, 0, -0.2], [0.2, 1.1, 0.2]));
  for (let i = 0; i < 6; i++)
    g.add(
      box(
        kit,
        i % 2 ? "#ffffff" : "#d93a2f",
        [-0.06, 0.95, 0.2 + (i * len) / 6],
        [0.06, 1.07, 0.2 + ((i + 1) * len) / 6],
      ),
    );
  g.add(sphere(kit, "#ff3b30", [0, 1.3, 0], 0.12, { emissive: true }));
  return g;
}

/** The Batasia-style memorial garden at the centre of the loop. */
function memorialGarden(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(disc(kit, "#7bbf5c", [0, 0.05, 0], 3.2, 0.1));
  g.add(box(kit, "#e9e4d8", [-0.9, 0, -0.9], [0.9, 0.5, 0.9]));
  const obelisk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.42, 3.4, 4),
    kit.mat("#f4f1ea"),
  );
  obelisk.rotation.y = Math.PI / 4;
  obelisk.position.y = 2.2;
  obelisk.castShadow = true;
  g.add(obelisk);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    g.add(
      sphere(
        kit,
        ["#e0457b", "#f2c14e", "#f06292", "#ffffff"][i % 4] ?? "#fff",
        [Math.cos(a) * 2.4, 0.25, Math.sin(a) * 2.4],
        0.22,
      ),
    );
  }
  return g;
}

function bigTree(kit: Kit, h = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#5a3d2b", [0, 0, 0], [0, 4.6 * h, 0], 0.3 * h));
  g.add(tube(kit, "#5a3d2b", [0, 3.4 * h, 0], [2.6 * h, 4.0 * h, 0], 0.13 * h)); // long side branch
  g.add(sphere(kit, "#2f6b45", [0, 5.3 * h, 0], 2.0 * h, undefined, [1, 0.72, 1]));
  g.add(sphere(kit, "#3a7a4e", [1.0 * h, 5.9 * h, 0.6 * h], 1.3 * h, undefined, [1, 0.7, 1]));
  g.add(sphere(kit, "#2f6b45", [2.6 * h, 4.3 * h, 0], 0.9 * h, undefined, [1, 0.6, 1]));
  return g;
}

/** A hoolock gibbon hanging by one long arm. */
function gibbon(kit: Kit, light = false): THREE.Group {
  const g = new THREE.Group();
  const C = light ? "#c9b48a" : "#2a2420";
  g.add(tube(kit, C, [0, 0, 0], [0, -0.75, 0], 0.05));
  g.add(sphere(kit, C, [0, -0.95, 0], 0.22, undefined, [0.9, 1.2, 0.8]));
  g.add(sphere(kit, C, [0.05, -0.62, 0], 0.15));
  g.add(sphere(kit, "#f2ead8", [0.14, -0.6, 0], 0.06, undefined, [0.4, 0.4, 1.6])); // white brow band
  g.add(tube(kit, C, [0, -0.85, 0.12], [0.35, -1.15, 0.3], 0.04));
  for (const z of [-0.08, 0.08]) g.add(tube(kit, C, [0, -1.15, z], [0.05, -1.5, z * 2], 0.045));
  return g;
}

/** A great hornbill in flight. */
function hornbill(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(sphere(kit, "#1f1f22", [0, 0, 0], 0.32, undefined, [1.6, 0.8, 0.8]));
  g.add(sphere(kit, "#f2ead8", [-0.6, -0.02, 0], 0.2, undefined, [1.6, 0.3, 1.2]));
  g.add(sphere(kit, "#1f1f22", [0.5, 0.12, 0], 0.18));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.6, 12), kit.mat("#f2c14e"));
  beak.rotation.z = -Math.PI / 2.2;
  beak.position.set(0.9, 0.06, 0);
  g.add(beak);
  g.add(sphere(kit, "#f2a93b", [0.62, 0.3, 0], 0.12, undefined, [1.6, 0.6, 0.6])); // casque
  for (const z of [-1, 1]) {
    const wing = box(kit, "#1f1f22", [-0.35, -0.03, 0], [0.35, 0.03, 1.1 * z]);
    wing.rotation.x = z * 0.25;
    g.add(wing);
    g.add(box(kit, "#f2ead8", [-0.35, -0.035, 0.55 * z], [0.0, 0.035, 0.95 * z]));
  }
  return g;
}

/** A clouded leopard draped along a branch (easter egg). */
function cloudedLeopard(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const TAN = "#c9a46a";
  const SPOT = "#5a4630";
  g.add(sphere(kit, TAN, [0, 0, 0], 0.32, undefined, [2.0, 0.6, 0.8]));
  g.add(sphere(kit, TAN, [0.7, 0.05, 0], 0.2));
  for (let i = 0; i < 6; i++)
    g.add(
      sphere(
        kit,
        SPOT,
        [-0.45 + i * 0.18, 0.15, i % 2 ? 0.12 : -0.12],
        0.08,
        undefined,
        [1.4, 0.4, 1],
      ),
    );
  for (let i = 0; i < 6; i++)
    g.add(sphere(kit, i % 2 ? SPOT : TAN, [-0.7, -0.15 - i * 0.18, 0], 0.07)); // tail hanging
  for (const z of [-0.12, 0.12])
    g.add(tube(kit, TAN, [0.35, -0.05, z], [0.35, -0.4, z * 1.5], 0.05)); // dangling paws
  return g;
}

function waterBuffalo(kit: Kit, s = 1): THREE.Group {
  const g = new THREE.Group();
  const C = "#3a3a3e";
  g.add(sphere(kit, C, [0, 0.95 * s, 0], 0.7 * s, undefined, [1.6, 0.8, 0.85]));
  for (const [x, z] of [
    [0.7, 0.35],
    [0.7, -0.35],
    [-0.7, 0.35],
    [-0.7, -0.35],
  ] as V2[])
    g.add(tube(kit, C, [x * s, 0.7 * s, z * s], [x * s, 0, z * s], 0.14 * s));
  g.add(sphere(kit, C, [1.3 * s, 0.9 * s, 0], 0.35 * s, undefined, [1.3, 0.85, 0.85]));
  // the great swept-back crescent horns
  for (const z of [-1, 1]) {
    const pts = [
      new THREE.Vector3(1.25 * s, 1.15 * s, 0.15 * z * s),
      new THREE.Vector3(1.0 * s, 1.35 * s, 0.75 * z * s),
      new THREE.Vector3(0.45 * s, 1.45 * s, 0.85 * z * s),
    ];
    const horn = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.07 * s, 8),
      kit.mat("#d9d0bd"),
    );
    horn.castShadow = true;
    g.add(horn);
  }
  return g;
}

function deer(kit: Kit, colour: string, s = 1, sangai = false): THREE.Group {
  const g = new THREE.Group();
  g.add(sphere(kit, colour, [0, 0.95 * s, 0], 0.42 * s, undefined, [1.6, 0.75, 0.75]));
  for (const [x, z] of [
    [0.45, 0.16],
    [0.45, -0.16],
    [-0.45, 0.16],
    [-0.45, -0.16],
  ] as V2[])
    g.add(tube(kit, colour, [x * s, 0.8 * s, z * s], [x * s, 0, z * s], 0.05 * s));
  g.add(tube(kit, colour, [0.55 * s, 1.05 * s, 0], [0.75 * s, 1.45 * s, 0], 0.1 * s));
  g.add(sphere(kit, colour, [0.85 * s, 1.5 * s, 0], 0.15 * s, undefined, [1.5, 0.9, 0.9]));
  g.add(sphere(kit, "#f2ead8", [-0.62 * s, 1.0 * s, 0], 0.08 * s)); // white scut
  for (const z of [-1, 1]) {
    // Barasingha: many-tined antlers. Sangai: brow tines sweeping forward.
    const base = new THREE.Vector3(0.82 * s, 1.62 * s, 0.07 * z * s);
    const tip = sangai
      ? new THREE.Vector3(1.05 * s, 2.0 * s, 0.32 * z * s)
      : new THREE.Vector3(0.6 * s, 2.25 * s, 0.4 * z * s);
    g.add(tube(kit, "#cbb796", [base.x, base.y, base.z], [tip.x, tip.y, tip.z], 0.03 * s));
    const tines = sangai ? 2 : 4;
    for (let i = 1; i <= tines; i++) {
      const t = i / (tines + 1);
      const p = base.clone().lerp(tip, t);
      g.add(
        tube(
          kit,
          "#cbb796",
          [p.x, p.y, p.z],
          [p.x + 0.18 * s, p.y + 0.16 * s, p.z + 0.04 * z * s],
          0.02 * s,
        ),
      );
    }
    if (sangai)
      g.add(
        tube(
          kit,
          "#cbb796",
          [base.x, base.y, base.z],
          [base.x + 0.3 * s, base.y + 0.05 * s, base.z],
          0.025 * s,
        ),
      );
  }
  return g;
}

/** An elephant on safari with a mahout and two visitors on a padded seat. */
function safariElephant(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const GREY = "#8e9196";
  g.add(sphere(kit, GREY, [0, 1.9, 0], 1.2, undefined, [1.35, 1.0, 0.9]));
  for (const [x, z] of [
    [0.8, 0.5],
    [0.8, -0.5],
    [-0.8, 0.5],
    [-0.8, -0.5],
  ] as V2[])
    g.add(tube(kit, GREY, [x, 1.3, z], [x, 0, z], 0.3));
  g.add(sphere(kit, GREY, [1.65, 2.4, 0], 0.7, undefined, [1, 1.05, 0.95]));
  for (const z of [-1, 1])
    g.add(sphere(kit, "#80838a", [1.45, 2.45, 0.62 * z], 0.55, undefined, [0.35, 1, 0.8])); // ears
  const trunk = [
    new THREE.Vector3(2.25, 2.3, 0),
    new THREE.Vector3(2.55, 1.6, 0),
    new THREE.Vector3(2.5, 0.8, 0),
    new THREE.Vector3(2.75, 0.45, 0),
  ];
  const tm = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunk), 16, 0.16, 10),
    kit.mat(GREY),
  );
  tm.castShadow = true;
  g.add(tm);
  for (const z of [-0.25, 0.25])
    g.add(tube(kit, "#f2ead8", [2.1, 2.0, z], [2.5, 1.85, z * 1.4], 0.05)); // tusks
  // padded seat (gaddi) in red and gold
  g.add(box(kit, "#a3241c", [-0.9, 3.0, -0.75], [0.7, 3.15, 0.75]));
  g.add(box(kit, "#e3b23c", [-0.92, 3.15, -0.78], [0.72, 3.22, 0.78]));
  g.add(box(kit, "#a3241c", [-0.9, 3.22, -0.75], [-0.8, 3.75, 0.75])); // backrest rail
  // mahout on the neck, visitors on the seat
  const people: [number, number, string][] = [
    [1.35, 0, "#e9e2d2"],
    [-0.1, -0.35, "#2b6cb0"],
    [-0.1, 0.35, "#e0457b"],
  ];
  for (const [x, z, shirt] of people) {
    g.add(tube(kit, shirt, [x, 3.2, z], [x, 3.75, z], 0.16));
    g.add(sphere(kit, "#8a5a3c", [x, 3.95, z], 0.15));
  }
  g.add(sphere(kit, "#f2f0e8", [1.35, 4.06, 0], 0.13, undefined, [1, 0.5, 1])); // mahout's cap
  return g;
}

/** A wooden watchtower with a thatched roof (Kaziranga style). */
function watchtower(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [
    [-1.2, -1.2],
    [1.2, -1.2],
    [-1.2, 1.2],
    [1.2, 1.2],
  ] as V2[])
    g.add(tube(kit, "#7a5236", [x, 0, z], [x * 0.85, 5.2, z * 0.85], 0.12));
  for (const y of [1.6, 3.4]) {
    g.add(tube(kit, "#6b4a32", [-1.1, y, -1.1], [1.1, y, 1.1], 0.06));
    g.add(tube(kit, "#6b4a32", [1.1, y, -1.1], [-1.1, y, 1.1], 0.06));
  }
  g.add(box(kit, "#9a7448", [-1.4, 5.2, -1.4], [1.4, 5.38, 1.4]));
  for (const z of [-1.35, 1.35])
    g.add(box(kit, "#8a6a40", [-1.4, 5.38, z - 0.05], [1.4, 6.0, z + 0.05]));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.5, 4), kit.mat("#c9b06a"));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 7.2;
  roof.castShadow = true;
  g.add(roof);
  for (const z of [-0.6, 0.6]) g.add(tube(kit, "#7a5236", [1.6, 5.2, z], [1.6, 7.0, z], 0.06));
  // ladder
  g.add(tube(kit, "#8a6a40", [1.9, 0, -0.35], [1.35, 5.2, -0.35], 0.04));
  g.add(tube(kit, "#8a6a40", [1.9, 0, 0.35], [1.35, 5.2, 0.35], 0.04));
  return g;
}

/** A clump of tall elephant grass. */
function elephantGrass(kit: Kit, seed: number, h = 1): THREE.Group {
  const g = new THREE.Group();
  const cols = ["#c9c06a", "#b7b45c", "#d6cc7a", "#a9b25a"];
  for (let i = 0; i < 9; i++) {
    const a = seed * 2.1 + i * 0.7;
    const r = (i % 3) * 0.18;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, (1.8 + (i % 4) * 0.35) * h, 5),
      kit.mat(cols[(i + seed) % 4] ?? "#c9c06a"),
    );
    blade.position.set(x, (0.9 + (i % 4) * 0.17) * h, z);
    blade.rotation.set(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16);
    blade.castShadow = true;
    g.add(blade);
  }
  return g;
}

/** A floating phumdi: a ring or disc of matted vegetation on the lake. */
function phumdi(kit: Kit, r: number, ring: boolean, seed: number): THREE.Group {
  const g = new THREE.Group();
  const geo = ring
    ? new THREE.TorusGeometry(r, r * 0.22, 10, 40)
    : new THREE.CylinderGeometry(r, r * 1.05, 0.3, 28);
  if (ring) geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, kit.mat(ring ? "#7a9a4a" : "#6f9445"));
  m.scale.set(1, ring ? 0.45 : 1, 1);
  m.receiveShadow = true;
  g.add(m);
  const n = ring ? 16 : 10;
  for (let i = 0; i < n; i++) {
    const a = seed + (i / n) * Math.PI * 2;
    const rr = ring ? r : r * 0.6 * ((i % 3) / 3 + 0.3);
    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.6, 5),
      kit.mat(i % 2 ? "#9ab55a" : "#86a84e"),
    );
    tuft.position.set(Math.cos(a) * rr, 0.35, Math.sin(a) * rr);
    tuft.castShadow = true;
    g.add(tuft);
  }
  return g;
}

/** A fishing hut on a phumdi. */
function lakeHut(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#b8925a", [-0.7, 0.15, -0.55], [0.7, 1.0, 0.55]));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.8, 4), kit.mat("#c9b06a"));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.4;
  roof.castShadow = true;
  g.add(roof);
  return g;
}

/** A dugout canoe with a fisher. */
function canoe(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(sphere(kit, "#6b4a32", [0, 0, 0], 0.4, undefined, [3.2, 0.45, 0.9]));
  g.add(tube(kit, "#2b6cb0", [0.2, 0.1, 0], [0.2, 0.6, 0], 0.13));
  g.add(sphere(kit, "#8a5a3c", [0.2, 0.75, 0], 0.12));
  g.add(tube(kit, "#c49b5c", [0.2, 0.5, 0], [0.9, 0.0, 0.35], 0.025));
  return g;
}

/** A double-decker living root bridge: two arching decks of woven roots. */
function rootBridge(kit: Kit, len: number): THREE.Group {
  const g = new THREE.Group();
  const ROOT = "#6e5a3a";
  const MOSS = "#7a9a4a";
  for (const [deck, rise, y0] of [
    [0, 0.9, 0.9],
    [1, 0.8, 3.0],
  ] as [number, number, number][]) {
    for (const z of [-0.9, -0.3, 0.3, 0.9]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push(
          new THREE.Vector3(
            -len / 2 + t * len,
            y0 + Math.sin(t * Math.PI) * rise,
            z + Math.sin(t * 9 + z * 3) * 0.08,
          ),
        );
      }
      const m = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, deck ? 0.09 : 0.12, 6),
        kit.mat(z === -0.3 || z === 0.3 ? ROOT : "#5a4a30"),
      );
      m.castShadow = true;
      g.add(m);
    }
    // stone-slab steps along the deck and moss tufts
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const y = y0 + Math.sin(t * Math.PI) * rise + 0.08;
      g.add(
        box(
          kit,
          "#8a8580",
          [-len / 2 + t * len - 0.22, y, -0.35],
          [-len / 2 + t * len + 0.22, y + 0.08, 0.35],
        ),
      );
      if (i % 2)
        g.add(
          sphere(kit, MOSS, [-len / 2 + t * len, y + 0.1, 0.85], 0.16, undefined, [1.4, 0.5, 1]),
        );
    }
    // hand-root rails
    for (const z of [-0.9, 0.9]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push(new THREE.Vector3(-len / 2 + t * len, y0 + 0.9 + Math.sin(t * Math.PI) * rise, z));
      }
      const m = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.05, 6),
        kit.mat(ROOT),
      );
      m.castShadow = true;
      g.add(m);
    }
  }
  // the two rubber-fig trees the roots grow from, with aerial roots
  for (const x of [-len / 2 - 0.6, len / 2 + 0.6]) {
    g.add(tube(kit, "#5a4a30", [x, 0, 0], [x, 5.5, 0], 0.55));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(
        tube(
          kit,
          "#6e5a3a",
          [x + Math.cos(a) * 0.5, 3.8, Math.sin(a) * 0.5],
          [x + Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1],
          0.08,
        ),
      );
    }
    g.add(sphere(kit, "#3f7a3a", [x, 6.6, 0], 2.0, undefined, [1, 0.7, 1]));
    g.add(sphere(kit, "#4f8f46", [x + 0.8, 7.2, 0.6], 1.2, undefined, [1, 0.7, 1]));
  }
  return g;
}

/** A momo / thukpa stall with a steaming bamboo steamer stack. */
function momoStall(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#8a5a3a", [-1.3, 0, -0.7], [1.3, 0.95, 0.7]));
  g.add(box(kit, "#f2ead8", [-1.32, 0.6, 0.69], [1.32, 0.8, 0.72]));
  for (const x of [-1.25, 1.25]) g.add(tube(kit, "#6b4a32", [x, 0.95, 0.6], [x, 2.2, 0.6], 0.05));
  const roof = box(kit, "#2f7a4a", [-1.55, 2.15, -0.95], [1.55, 2.3, 0.95]);
  g.add(roof);
  for (let i = 0; i < 4; i++)
    g.add(tube(kit, "#c9a46a", [-0.5, 0.95 + i * 0.16, 0], [-0.5, 1.09 + i * 0.16, 0], 0.32));
  g.add(sphere(kit, "#c9a46a", [-0.5, 1.62, 0], 0.32, undefined, [1, 0.35, 1]));
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.2 + i * 0.07, 14, 10),
      veil("#ffffff", 0.5 - i * 0.08),
    );
    p.position.set(-0.5 + i * 0.12, 1.85 + i * 0.3, 0);
    g.add(p);
  }
  g.add(tube(kit, "#9aa3ad", [0.5, 0.95, 0], [0.5, 1.35, 0], 0.28)); // thukpa pot
  for (let i = 0; i < 6; i++)
    g.add(
      sphere(kit, "#f4efe4", [0.1 + (i % 3) * 0.18, 0.99, 0.35 + Math.floor(i / 3) * 0.16], 0.07),
    ); // momos
  const en = textSprite("MOMO · THUKPA", "#ffffff", "#a3241c");
  en.position.set(0, 2.85, 0);
  en.scale.set(1.8, 0.65, 1);
  g.add(en);
  const lo = textSprite("मःम · थुक्पा", "#1f2a1f", "#f4ead2");
  lo.position.set(0, 2.35, 0.8);
  lo.scale.set(1.3, 0.5, 1);
  g.add(lo);
  return g;
}

function orangeTree(kit: Kit, h = 1): THREE.Group {
  const g = roundTree(kit, "#3f7f3a", "#5a3d2b", h * 0.85);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + i;
    g.add(
      sphere(
        kit,
        "#f28c1e",
        [Math.cos(a) * 0.5 * h, (1.05 + (i % 3) * 0.22) * h, Math.sin(a) * 0.5 * h],
        0.09 * h,
      ),
    );
  }
  return g;
}

/** Large-leaved cardamom clumps under the shade trees. */
function cardamom(kit: Kit, seed: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = seed + i * 0.9;
    const leaf = box(kit, i % 2 ? "#4f9a45" : "#5fae4f", [-0.08, 0, -0.03], [0.08, 1.1, 0.03]);
    leaf.position.set(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15);
    leaf.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5);
    g.add(leaf);
  }
  return g;
}

/** A Tawang-style hilltop monastery complex: tiers of white blocks, gold roofs. */
function tawang(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const main = monastery(kit);
  main.scale.setScalar(1.25);
  g.add(main);
  for (const [x, z, w] of [
    [-7, -2, 3],
    [7, -1.5, 3.4],
    [-4.5, -5.5, 2.6],
    [4, -6, 2.8],
  ] as [number, number, number][]) {
    g.add(box(kit, "#f4efe4", [x - w, 0, z - 1.4], [x + w, 2.4, z + 1.4]));
    g.add(box(kit, "#8a1f1a", [x - w - 0.05, 2.0, z - 1.45], [x + w + 0.05, 2.4, z + 1.45]));
    for (let i = 0; i < 3; i++)
      g.add(
        box(
          kit,
          "#2b2d33",
          [x - w + 0.6 + i * (w * 0.6), 1.0, z + 1.38],
          [x - w + 1.0 + i * (w * 0.6), 1.5, z + 1.42],
        ),
      );
  }
  g.add(box(kit, "#e9e2d2", [-9.5, 0, -8], [9.5, 0.4, 3.6]));
  return g;
}

/** A Sela-style pass gate arch with an altitude board. */
function passGate(kit: Kit, span: number): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-span / 2, span / 2]) {
    g.add(box(kit, "#d93a2f", [-0.45, 0, z - 0.45], [0.45, 4.6, z + 0.45]));
    g.add(box(kit, "#f2c14e", [-0.5, 4.0, z - 0.5], [0.5, 4.25, z + 0.5]));
  }
  const cols = ["#2b6cb0", "#f2c14e", "#4f9a45", "#d93a2f"];
  cols.forEach((c, i) => {
    g.add(
      box(
        kit,
        c,
        [-0.55, 4.6 + i * 0.22, -span / 2 - 0.7],
        [0.55, 4.82 + i * 0.22, span / 2 + 0.7],
      ),
    );
  });
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 0.8, 4), kit.mat("#2f7a4a"));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, (span + 2) / 1.7);
  roof.position.y = 5.9;
  roof.castShadow = true;
  g.add(roof);
  const en = textSprite("SELA PASS · 13,700 ft", "#ffffff", "#8a1f1a");
  en.position.set(0.6, 3.4, 0);
  en.scale.set(3.4, 1.0, 1);
  g.add(en);
  const lo = textSprite("सेला दर्रा", "#1f2a1f", "#f4ead2");
  lo.position.set(0.6, 2.65, 0);
  lo.scale.set(1.6, 0.6, 1);
  g.add(lo);
  return g;
}

/** A small flock of birds (V-shaped chevrons). */
function flock(kit: Kit, n: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group();
    for (const z of [-1, 1]) {
      const w = box(kit, "#2a2a2e", [-0.04, -0.02, 0], [0.04, 0.02, 0.38 * z]);
      w.rotation.x = z * 0.45;
      b.add(w);
    }
    const a = seed + i * 1.3;
    b.position.set(
      Math.cos(a) * (1 + i * 0.4),
      Math.sin(i * 1.7) * 0.6,
      Math.sin(a) * (1 + i * 0.4),
    );
    b.rotation.y = 0.4;
    g.add(b);
  }
  return g;
}

/** Butterflies: little pairs of coloured wings around flowers. */
function butterflies(kit: Kit, n: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const cols = ["#f2c14e", "#4fa3d9", "#f06292", "#ffffff", "#f28c1e"];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group();
    for (const z of [-1, 1]) {
      const w = box(
        kit,
        cols[(i + seed) % cols.length] ?? "#fff",
        [-0.1, -0.01, 0],
        [0.1, 0.01, 0.16 * z],
      );
      w.rotation.x = z * 0.9;
      b.add(w);
    }
    const a = seed * 3.1 + i * 2.4;
    b.position.set(
      Math.cos(a) * (1.5 + (i % 4)),
      1.2 + (i % 3) * 0.5,
      Math.sin(a) * (1.5 + (i % 4)),
    );
    b.rotation.y = a;
    g.add(b);
  }
  return g;
}

/** Mist banks: soft, flattened translucent blobs. */
function mist(n: number, spread: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), veil("#fbf7f0", 0.13));
    const a = seed + i * 2.2;
    m.position.set(
      Math.cos(a) * spread * ((i % 3) / 3 + 0.3),
      0.8 + (i % 2) * 0.6,
      Math.sin(a) * spread * ((i % 4) / 4 + 0.2),
    );
    m.scale.set(4 + (i % 3) * 1.5, 0.9, 2.6 + (i % 2));
    g.add(m);
  }
  return g;
}

/** A light drizzle: thin translucent streaks in a column of air. */
function drizzle(kit: Kit, n: number, spread: number, height: number): THREE.Group {
  void kit;
  const g = new THREE.Group();
  const mat = veil("#dfeaf2", 0.45);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996;
    const r = spread * Math.sqrt((i + 0.5) / n);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), mat);
    s.position.set(Math.cos(a) * r, 0.6 + (((i * 37) % 100) / 100) * height, Math.sin(a) * r);
    s.rotation.z = 0.12;
    g.add(s);
  }
  return g;
}

/** The spawn marker: a soft ring of light on the ground. */
function spawnRing(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.08, 8, 48),
    kit.mat("#fff3c4", { emissive: true }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.16;
  g.add(ring);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), veil("#fff3c4", 0.25));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.15;
  g.add(inner);
  return g;
}

// ── Lived-in: hill villages, people, livestock ───────────────────────────────

const mesh = (
  kit: Kit,
  geo: THREE.BufferGeometry,
  colour: string,
  at: [number, number, number],
) => {
  const m = new THREE.Mesh(geo, kit.mat(colour));
  m.position.set(...at);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

/**
 * A Lepcha/Bhutia hill house: a whitewashed stone ground floor, a timber
 * upper floor with brightly painted window frames, and a coloured tin roof.
 */
function hillHouse(kit: Kit, seed: number): THREE.Group {
  const g = new THREE.Group();
  const roofC = ["#b8372c", "#2f7a5a", "#2d5f9a", "#b8372c"][seed % 4] ?? "#b8372c";
  const frameC = ["#c8342b", "#2f8a4f", "#2f63b0", "#e0a526"];
  const W2 = 1.5;
  const D2 = 1.1;
  g.add(box(kit, "#efe9dc", [-W2, -0.4, -D2], [W2, 1.1, D2])); // stone floor (runs into the ground)
  g.add(box(kit, "#8a5a32", [-W2 - 0.05, 1.1, -D2 - 0.05], [W2 + 0.05, 1.22, D2 + 0.05])); // timber band
  g.add(box(kit, "#b07a45", [-W2, 1.22, -D2], [W2, 2.5, D2]));
  // painted windows, upper floor front and back; a door below
  for (const z of [D2 + 0.02, -D2 - 0.02]) {
    for (const x of [-0.85, 0, 0.85]) {
      const f = frameC[(seed + Math.round(x * 2) + 3) % frameC.length] ?? "#c8342b";
      g.add(box(kit, f, [x - 0.3, 1.5, z - 0.03], [x + 0.3, 2.2, z + 0.03]));
      g.add(
        box(
          kit,
          x === 0 ? "#ffd99a" : "#3b2a20",
          [x - 0.2, 1.6, z - 0.04],
          [x + 0.2, 2.1, z + 0.04],
          { emissive: x === 0 },
        ),
      );
    }
  }
  g.add(
    box(
      kit,
      frameC[seed % frameC.length] ?? "#c8342b",
      [-0.32, 0, D2 - 0.02],
      [0.32, 1.0, D2 + 0.04],
    ),
  );
  g.add(box(kit, "#4a3020", [-0.24, 0, D2 + 0.02], [0.24, 0.92, D2 + 0.06]));
  // tin roof: two sloping sheets with corrugation ribs, gable triangles
  const pitch = 0.48;
  for (const s of [-1, 1]) {
    const r = new THREE.Group();
    r.add(
      box(kit, roofC, [-W2 - 0.35, -0.04, s > 0 ? 0 : -1.55], [W2 + 0.35, 0.04, s > 0 ? 1.55 : 0]),
    );
    for (let i = -6; i <= 6; i++)
      r.add(
        box(
          kit,
          roofC,
          [i * 0.28 - 0.03, 0.03, s > 0 ? 0.05 : -1.5],
          [i * 0.28 + 0.03, 0.07, s > 0 ? 1.5 : -0.05],
        ),
      );
    r.position.y = 3.22;
    r.rotation.x = s * pitch;
    g.add(r);
  }
  const tri = new THREE.Shape();
  tri.moveTo(-D2, 0);
  tri.lineTo(D2, 0);
  tri.lineTo(0, 0.72);
  tri.closePath();
  for (const s of [-1, 1]) {
    const m = mesh(kit, new THREE.ShapeGeometry(tri), "#b07a45", [s * W2, 2.5, 0]);
    m.rotation.y = s * (Math.PI / 2);
    g.add(m);
  }
  return g;
}

/** A bamboo mat of cardamom pods drying in the sun. */
function dryingMat(kit: Kit, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#d2b06a", [-0.9, 0, -0.6], [0.9, 0.06, 0.6]));
  for (let i = 0; i < 22; i++) {
    const x = ((i * 37 + seed * 11) % 160) / 100 - 0.8;
    const z = ((i * 53 + seed * 7) % 100) / 100 - 0.5;
    g.add(sphere(kit, i % 3 ? "#7a3b2a" : "#8f4a33", [x, 0.08, z], 0.06, undefined, [1.4, 0.6, 1]));
  }
  return g;
}

/** Darchor: tall prayer-flag poles with long vertical banners. */
function darchor(kit: Kit, n: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const colours = ["#ffffff", "#2f6fd6", "#e8e8e8", "#e13a34", "#ffffff", "#f2c330", "#2f9a55"];
  for (let i = 0; i < n; i++) {
    const a = seed + i * 1.3;
    const x = Math.cos(a) * 0.9 * (i % 2 ? 1 : 0.5);
    const z = Math.sin(a) * 0.9;
    const h = 4.4 + (i % 3) * 0.6;
    g.add(tube(kit, "#e9e1cf", [x, -0.3, z], [x, h, z], 0.05));
    g.add(sphere(kit, "#d9a83a", [x, h + 0.05, z], 0.08));
    const flag = box(
      kit,
      colours[(i + seed) % colours.length] ?? "#ffffff",
      [x + 0.05, h - 2.6, z - 0.01],
      [x + 0.42, h - 0.2, z + 0.01],
    );
    g.add(flag);
  }
  return g;
}

/** A young monk in a maroon robe with a saffron sash, walking. */
function monk(kit: Kit, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(
    mesh(kit, new THREE.CylinderGeometry(0.17 * s, 0.3 * s, 0.95 * s, kit.seg(10, 20)), "#7a1f2b", [
      0,
      0.48 * s,
      0,
    ]),
  );
  const sash = box(kit, "#e0a12c", [-0.19 * s, 0.6 * s, -0.05 * s], [0.19 * s, 0.75 * s, 0.05 * s]);
  sash.rotation.x = 0.6;
  g.add(sash);
  g.add(sphere(kit, "#b98a62", [0, 1.12 * s, 0], 0.15 * s));
  g.add(sphere(kit, "#7a1f2b", [0, 0.95 * s, 0], 0.17 * s, undefined, [1, 0.5, 1.3]));
  return g;
}

/** A schoolchild in uniform: white shirt, navy shorts or pinafore, a coloured backpack. */
function schoolKid(kit: Kit, seed: number): THREE.Group {
  const g = new THREE.Group();
  const girl = seed % 2 === 0;
  for (const z of [-0.07, 0.07]) g.add(tube(kit, "#9a6f4f", [0, 0, z], [0, 0.42, z], 0.045));
  if (girl)
    g.add(
      mesh(
        kit,
        new THREE.CylinderGeometry(0.13, 0.22, 0.4, kit.seg(10, 20)),
        "#22325e",
        [0, 0.55, 0],
      ),
    );
  else g.add(box(kit, "#22325e", [-0.12, 0.36, -0.14], [0.12, 0.58, 0.14]));
  g.add(box(kit, "#f6f6f2", [-0.12, 0.58, -0.15], [0.12, 0.9, 0.15]));
  g.add(box(kit, "#a3241c", [0.12, 0.7, -0.025], [0.14, 0.86, 0.025])); // tie
  g.add(
    box(
      kit,
      ["#e35d3a", "#2f8ad0", "#f2b62c", "#7b4fc4"][seed % 4] ?? "#e35d3a",
      [-0.3, 0.58, -0.13],
      [-0.12, 0.9, 0.13],
    ),
  );
  g.add(sphere(kit, "#a87754", [0, 1.02, 0], 0.13));
  g.add(sphere(kit, "#1e1a17", [-0.02, 1.07, 0], 0.13, undefined, [1, 0.7, 1]));
  return g;
}

/** A farmer bent over the paddy, in a conical straw hat. */
function farmer(kit: Kit, seed: number): THREE.Group {
  const g = new THREE.Group();
  const shirt = ["#d9534f", "#3f7fbf", "#e6c45a"][seed % 3] ?? "#d9534f";
  for (const z of [-0.12, 0.12]) g.add(tube(kit, "#6b4a35", [0, 0, z], [0.05, 0.55, z], 0.06));
  g.add(tube(kit, shirt, [0.05, 0.6, 0], [0.45, 0.95, 0], 0.17));
  g.add(sphere(kit, "#8a5f42", [0.6, 0.98, 0], 0.13));
  const hat = mesh(
    kit,
    new THREE.ConeGeometry(0.36, 0.2, kit.seg(14, 28)),
    "#d8b56a",
    [0.62, 1.1, 0],
  );
  hat.rotation.z = -0.5;
  g.add(hat);
  for (const z of [-0.12, 0.12])
    g.add(tube(kit, shirt, [0.4, 0.9, z], [0.75, 0.35, z * 1.5], 0.05)); // arms planting
  return g;
}

/** A hill cow (small, humped; Siri-style). */
function cow(kit: Kit, colour: string, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(sphere(kit, colour, [0, 0.72 * s, 0], 0.5 * s, undefined, [1.5, 0.75, 0.75]));
  g.add(sphere(kit, colour, [0.45 * s, 1.0 * s, 0], 0.17 * s)); // hump
  for (const [x, z] of [
    [0.5, 0.2],
    [0.5, -0.2],
    [-0.5, 0.2],
    [-0.5, -0.2],
  ] as V2[])
    g.add(tube(kit, colour, [x * s, 0.55 * s, z * s], [x * s, 0, z * s], 0.08 * s));
  g.add(sphere(kit, colour, [0.92 * s, 0.82 * s, 0], 0.22 * s, undefined, [1.3, 0.9, 0.85]));
  g.add(sphere(kit, "#f1e6d4", [1.08 * s, 0.76 * s, 0], 0.11 * s));
  for (const z of [-1, 1])
    g.add(
      tube(
        kit,
        "#e9dcc2",
        [0.95 * s, 1.0 * s, 0.1 * z * s],
        [0.98 * s, 1.18 * s, 0.22 * z * s],
        0.03 * s,
      ),
    );
  g.add(tube(kit, colour, [-0.7 * s, 0.85 * s, 0], [-0.82 * s, 0.35 * s, 0], 0.03 * s));
  return g;
}

/** A yak at the high pasture: dark and shaggy, white horns, a red tassel. */
function yak(kit: Kit, s = 1, colour = "#2e2622"): THREE.Group {
  const g = new THREE.Group();
  g.add(sphere(kit, colour, [0, 0.95 * s, 0], 0.62 * s, undefined, [1.5, 0.85, 0.85]));
  g.add(sphere(kit, colour, [0.35 * s, 1.3 * s, 0], 0.38 * s)); // shoulder hump
  // the long hair skirt
  g.add(
    mesh(kit, new THREE.CylinderGeometry(0.55 * s, 0.68 * s, 0.5 * s, kit.seg(12, 24)), colour, [
      0,
      0.55 * s,
      0,
    ]),
  );
  g.children[g.children.length - 1]?.scale.set(1.55, 1, 0.85);
  for (const [x, z] of [
    [0.5, 0.25],
    [0.5, -0.25],
    [-0.5, 0.25],
    [-0.5, -0.25],
  ] as V2[])
    g.add(tube(kit, colour, [x * s, 0.4 * s, z * s], [x * s, 0, z * s], 0.09 * s));
  g.add(sphere(kit, colour, [1.0 * s, 0.95 * s, 0], 0.27 * s, undefined, [1.2, 0.9, 0.9]));
  for (const z of [-1, 1]) {
    const pts = [
      new THREE.Vector3(1.0 * s, 1.15 * s, 0.15 * z * s),
      new THREE.Vector3(1.0 * s, 1.3 * s, 0.4 * z * s),
      new THREE.Vector3(1.1 * s, 1.5 * s, 0.35 * z * s),
    ];
    const horn = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.045 * s, 8),
      kit.mat("#efe6d2"),
    );
    horn.castShadow = true;
    g.add(horn);
  }
  g.add(sphere(kit, "#c8342b", [1.05 * s, 0.68 * s, 0], 0.09 * s)); // red tassel
  g.add(tube(kit, colour, [-0.85 * s, 1.0 * s, 0], [-1.0 * s, 0.45 * s, 0], 0.08 * s));
  return g;
}

/**
 * The falls: a cascade ribbon that hugs the cliff from the ridge down to the
 * head of the gorge (it follows the ground, so it never floats), with a foam
 * pool and spray at the bottom.
 */
function addWaterfall(scene: THREE.Scene, kit: Kit, ground: HeightFn): void {
  const top: V2 = [FALLS[0] - 2.2, FALLS[1] - 2.6];
  const foot = STREAM[0] ?? [FALLS[0] + 3, FALLS[1] + 3];
  const n = 40;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = THREE.MathUtils.lerp(top[0], foot[0], t);
    const z = THREE.MathUtils.lerp(top[1], foot[1], t);
    pts.push(new THREE.Vector3(x, Math.max(ground(x, z), WATER) + 0.14, z));
  }
  const dir = new THREE.Vector2(foot[0] - top[0], foot[1] - top[1]).normalize();
  const side = new THREE.Vector3(-dir.y, 0, dir.x);
  const pos: number[] = [];
  const idx: number[] = [];
  pts.forEach((p, i) => {
    const w = 0.7 + (i / n) * 0.9;
    for (const s of [-1, 1]) {
      const x = p.x + side.x * w * s;
      const z = p.z + side.z * w * s;
      pos.push(x, Math.max(ground(x, z), WATER) + 0.14, z);
    }
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const sheet = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: "#e9f7fb",
      transparent: true,
      opacity: 0.88,
      roughness: 0.25,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  scene.add(sheet);
  // Foam where it lands, and spray.
  const last = pts[n] ?? pts[0];
  if (!last) return;
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    scene.add(
      sphere(
        kit,
        "#ffffff",
        [last.x + Math.cos(a) * 0.9, WATER + 0.05, last.z + Math.sin(a) * 0.9],
        0.45 + (i % 3) * 0.12,
        undefined,
        [1.4, 0.35, 1],
      ),
    );
  }
  const spray = mist(4, 2.5, 21);
  spray.position.set(last.x, WATER + 0.9, last.z);
  scene.add(spray);
  const gorgeMist = mist(6, 7, 22);
  const mid = STREAM[3] ?? last.toArray();
  gorgeMist.position.set(mid[0] ?? last.x, WATER + 1.4, (mid as number[])[1] ?? last.z);
  scene.add(gorgeMist);
}

/**
 * Distant ranges beyond the island edge, hazed towards the sky: a
 * Kanchenjunga-style snow massif to the north, Himalayan foothills elsewhere.
 * They never cast or receive shadows.
 */
function distantRanges(_kit: Kit): THREE.Mesh[] {
  const haze = new THREE.Color("#f1d9b8");
  const make = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    peak: number,
    seed: number,
    snow: number,
    base: string,
    rot = 0,
  ) => {
    const geo = new THREE.PlaneGeometry(w, d, 96, 36);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const cols: number[] = [];
    const rock = new THREE.Color(base);
    const ice = new THREE.Color("#fbf3ea");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const env = Math.exp(-((x / (w * 0.42)) ** 4)) * Math.exp(-((z / (d * 0.4)) ** 2));
      const r = ridged(x * 0.03 + seed, z * 0.03 - seed);
      const y = peak * env * (0.35 + 0.95 * r) - 4;
      pos.setY(i, y);
      const c = rock.clone();
      if (y > snow) c.lerp(ice, Math.min(1, (y - snow) / 4));
      c.lerp(haze, 0.42);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    );
    m.position.set(cx, 0, cz);
    m.rotation.y = rot;
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  };
  return [
    make(-20, -128, 280, 60, 46, 3.1, 16, "#7f8fa3"), // Kanchenjunga-style massif
    make(-150, -30, 120, 70, 30, 7.7, 20, "#7d8ea0", Math.PI / 2), // western snows
    make(150, 0, 140, 60, 20, 11.3, 40, "#6f8c86", Math.PI / 2), // eastern foothills
    make(10, 112, 300, 50, 14, 5.9, 40, "#6f8f82"), // southern hills, hazy
  ];
}

// ── The world ────────────────────────────────────────────────────────────────

const near = (road: Road, x: number, z: number, r: number) =>
  road.samples.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < r * r);

/** Camera azimuth (degrees) that looks at the bike from behind, offset by `side` degrees. */
const behind = (heading: number, side = 0) =>
  THREE.MathUtils.radToDeg(Math.atan2(-Math.cos(heading), Math.sin(heading))) + side;

export const forest: JourneyDef = {
  id: "forest",
  title: "Personal projects · Sikkim & the North-East (open world)",
  mood: "golden",
  bike: "bobber",
  build(scene, kit) {
    const W = 3.0;
    const roadH = dry(withWater);

    // 1. Draft the network on bare land. Road xz depends only on control
    //    points, so drafts tell us where junctions and features are.
    const ring0 = makeRoad(RING, roadH, true);
    const T = (x: number, z: number) => tNear(ring0, x, z);
    const tN = T(4, -43);
    const tS = T(2, 20);
    const tW = T(-76, -4);
    const tE = T(73, 6);
    const NS: V2[] = fork(
      ring0,
      tN,
      [
        [3, -28],
        [1, -14],
        [0, -2],
        [-1, 9],
      ],
      tS,
    );
    const EW: V2[] = fork(
      ring0,
      tW,
      [
        [-58, -5],
        [-34, -3],
        [-14, -1],
        [0, -2],
        [16, -2],
        [38, 0],
        [58, 3],
      ],
      tE,
    );
    const tR1 = T(-36, -44);
    const tR2 = T(-14, -40);
    const RUMTEK: V2[] = fork(
      ring0,
      tR1,
      [
        [-30, -51],
        [-21, -53],
        [-12, -48],
      ],
      tR2,
    );
    const tK1 = T(62, 22);
    const tK2 = T(40, 23);
    const KAZ: V2[] = fork(
      ring0,
      tK1,
      [
        [72, 32],
        [74, 46],
        [62, 57],
        [46, 55],
        [38, 42],
        [37, 32],
      ],
      tK2,
    );
    const tLok = T(6, 20);
    const LOKTAK_SPUR: V2[] = fork(ring0, tLok, [
      [6, 24],
      [6.5, 27.5],
    ]);
    const tCamp = T(73, -6);
    const CAMP_SPUR: V2[] = fork(ring0, tCamp, [
      [79, -8],
      [85, -7],
    ]);
    const drafts = [NS, EW, RUMTEK, KAZ, LOKTAK_SPUR, CAMP_SPUR].map((pts) =>
      makeRoad(pts, roadH, false, 40),
    );

    // Where the ring trail meets the river gorge (SW). The trail holds a level
    // deck across it on a cane bridge instead of diving to the river bed.
    let tStream = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 1600; i++) {
      const p = ring0.at(i / 1600).p;
      if (p.x > -10 || p.x < -50 || p.z < 10) continue;
      const d = distToLine(p.x, p.z, STREAM);
      if (d < bestD) {
        bestD = d;
        tStream = i / 1600;
      }
    }
    const sp = ring0.at(tStream).p;
    const rimT = 12 / ring0.length;
    const rimA = ring0.at(tStream - rimT).p;
    const rimB = ring0.at(tStream + rimT).p;
    const deckY = (land(rimA.x, rimA.z) + land(rimB.x, rimB.z)) / 2 - 0.4;
    const deckW = (x: number, z: number) =>
      1 - THREE.MathUtils.smootherstep(Math.hypot(x - sp.x, z - sp.z), 8, 15);
    const roadDeck: HeightFn = (x, z) => {
      const b = roadH(x, z);
      const w = deckW(x, z);
      return w > 0 ? THREE.MathUtils.lerp(b, Math.max(b, deckY), w) : b;
    };
    const ringD = makeRoad(RING, roadDeck, true, 80);

    // The Batasia-style loop: a level circle of track that the ring crosses twice.
    const tB = T(50, -32);
    const cross = ring0.at(tB);
    const nb = cross.normal.clone();
    if (nb.z > 0) nb.multiplyScalar(-1); // the loop sits on the north side
    const R = 9;
    const centre = new THREE.Vector3(cross.p.x + nb.x * R * 0.7, 0, cross.p.z + nb.z * R * 0.7);
    const trackY = cross.p.y;
    const CIRCLE: V2[] = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return [centre.x + Math.cos(a) * R, centre.z + Math.sin(a) * R] as V2;
    });
    const track = makeRoad(CIRCLE, () => trackY, true, 0, 0);

    // 2. Carve the land for every road, keep the stream channel open under the
    //    cane bridge, then build the final roads on the carved land.
    // The carve chain is rebuilt at the end on top of the building pads, so it
    // is a function of the base land.
    const shape = (base: HeightFn): HeightFn => {
      let c: HeightFn = carve(base, ringD, W + 0.4, 3.5);
      drafts.forEach((r, i) => {
        c = carve(c, r, i < 2 ? W : W - 0.6, 2.8);
      });
      c = carve(c, track, 2.2, 2.5);
      // Keep the gorge open under the bridge deck.
      return (x, z) => {
        const h = c(x, z);
        const k = 1 - THREE.MathUtils.smootherstep(Math.hypot(x - sp.x, z - sp.z), 9, 14);
        return k > 0 ? THREE.MathUtils.lerp(h, Math.min(h, base(x, z)), k) : h;
      };
    };
    const height = shape(withWater);
    const roadOn: HeightFn = (x, z) => {
      const b = dry(height)(x, z);
      const w = deckW(x, z);
      return w > 0 ? THREE.MathUtils.lerp(b, Math.max(b, deckY), w) : b;
    };
    const ring = makeRoad(RING, roadOn, true, 80);
    const [ns, ew, rumtek, kaz, lokSpur, campSpur] = [
      NS,
      EW,
      RUMTEK,
      KAZ,
      LOKTAK_SPUR,
      CAMP_SPUR,
    ].map((pts) => makeRoad(pts, roadOn, false, 40)) as [Road, Road, Road, Road, Road, Road];

    // 3. Water and roads (the land itself is added last, on the building pads).
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(SIZE[0] - 34, SIZE[1] - 26),
      kit.mat("#46b3a6"),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER;
    water.receiveShadow = true;
    scene.add(water);

    const trail = (r: Road, w: number, edge: string, core: string) => {
      scene.add(roadMesh(kit, r, w + 0.6, edge, 0.07));
      scene.add(roadMesh(kit, r, w, core, 0.1));
    };
    trail(ring, W, "#7a5a3a", "#a07c52");
    trail(ns, W - 0.2, "#7a5a3a", "#a98557");
    trail(ew, W - 0.2, "#7a5a3a", "#a98557");
    trail(rumtek, W - 0.8, "#7a5a3a", "#b08a5c");
    trail(kaz, W - 0.6, "#8a6a3a", "#c4a16a");
    trail(lokSpur, W - 1.0, "#7a5a3a", "#b08a5c");
    trail(campSpur, W - 1.0, "#7a5a3a", "#b08a5c");
    // Toy-train track: sleepers + two rails on the level loop.
    scene.add(offsetRibbon(kit, track, 0, 1.4, "#5a4632", 0.09));
    for (const o of [-0.38, 0.38]) scene.add(offsetRibbon(kit, track, o, 0.09, "#c9cdd2", 0.16));

    // Every object is grounded at the end, once the building pads have
    // levelled the land: buildings stay upright on a pad, animals and props
    // tilt to the slope, and nothing floats or is cut by the terrain.
    const keepClear: { x: number; z: number; r: number }[] = [];
    type Place = {
      o: THREE.Object3D;
      x: number;
      z: number;
      rot: number;
      mode: "upright" | "align";
      footprint: number;
      y?: number | undefined;
    };
    const placements: Place[] = [];
    const pads: { x: number; z: number; r: number; blend?: number }[] = [];
    const placeOn = (
      o: THREE.Object3D,
      x: number,
      z: number,
      rot = 0,
      opts: { pad?: number; mode?: "upright" | "align"; footprint?: number; y?: number } = {},
    ) => {
      if (opts.pad) pads.push({ x, z, r: opts.pad, blend: opts.pad * 1.1 });
      placements.push({
        o,
        x,
        z,
        rot,
        mode: opts.mode ?? "upright",
        footprint: opts.footprint ?? 0.3,
        y: opts.y,
      });
      return o;
    };
    /** A green NHAI-style guide board facing riders arriving along `r` at t. */
    const guide = (
      r: Road,
      t: number,
      lines: SignLine[],
      side: 1 | -1 | "inside" | "outside" = "inside",
    ) => {
      const q = beside(r, t, W / 2 + 1.5, side);
      placeOn(nhaiSign(kit, lines, 3.4), q.x, q.z, q.heading - Math.PI / 2, { footprint: 1.1 });
      keepClear.push({ x: q.x, z: q.z, r: 2 });
    };
    const roads = [ring, ns, ew, rumtek, kaz, lokSpur, campSpur, track];

    // ── Centre: the arrival gateway at the crossroads (first-visit spawn) ──
    let tX = 0.5;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 400; i++) {
      const p = ns.at(i / 400).p;
      for (const s of ew.samples) {
        const d = (p.x - s.x) ** 2 + (p.z - s.z) ** 2;
        if (d < best) {
          best = d;
          tX = i / 400;
        }
      }
    }
    const X = ns.at(tX);
    const gateAt = ns.at(tX - 0.07);
    const gate = welcomeGate(kit, W + 2.2);
    gate.position.set(gateAt.p.x, gateAt.p.y, gateAt.p.z);
    gate.rotation.y = gateAt.heading;
    scene.add(gate);
    for (const side of [-1, 1]) {
      const a = beside(ns, tX - 0.07, W / 2 + 1.6, side as 1 | -1);
      const b = beside(ns, tX - 0.16, W / 2 + 1.6, side as 1 | -1);
      scene.add(
        lungta(
          kit,
          new THREE.Vector3(a.x, height(a.x, a.z), a.z),
          new THREE.Vector3(b.x, height(b.x, b.z), b.z),
          3.6,
        ),
      );
    }
    const ringSpawn = spawnRing(kit);
    ringSpawn.position.set(X.p.x, X.p.y + 0.02, X.p.z);
    scene.add(ringSpawn);
    const spawnTag = textSprite("★ ARRIVAL · SPAWN", "#5a3d10", "#fff3c4");
    spawnTag.position.set(gateAt.p.x, gateAt.p.y + 7.2, gateAt.p.z);
    spawnTag.scale.set(2.6, 1.0, 1);
    scene.add(spawnTag);
    keepClear.push({ x: X.p.x, z: X.p.z, r: 9 });
    // English signpost at the crossroads.
    // Southbound on the connector: east is to the left, west to the right.
    guide(
      ns,
      tX - 0.035,
      [
        { en: "Loktak Lake", local: "लोकटक ताल", arrow: "up", km: 3 },
        { en: "Kaziranga · Toy Train", local: "काजीरंगा · टॉय ट्रेन", arrow: "left", km: 6 },
        { en: "Root Bridge · Sela Pass", local: "जरा पुल · सेला दर्रा", arrow: "right", km: 4 },
      ],
      -1,
    );
    // Momo stall, orange orchard and cardamom in the quadrants around the crossroads.
    placeOn(momoStall(kit), X.p.x + 6.5, X.p.z - 6.5, 0.6, { pad: 2.8, footprint: 1.4 });
    keepClear.push({ x: X.p.x + 6.5, z: X.p.z - 6.5, r: 3.5 });
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        const x = X.p.x + 7 + i * 3.4;
        const z = X.p.z + 6 + j * 3.2;
        if (roads.some((r) => near(r, x, z, W / 2 + 1.6))) continue;
        placeOn(orangeTree(kit, 1), x, z, i + j);
        keepClear.push({ x, z, r: 1.6 });
      }
    for (let i = 0; i < 10; i++) {
      const x = X.p.x - 7 - (i % 4) * 2.2;
      const z = X.p.z + 6 + Math.floor(i / 4) * 2.4;
      if (roads.some((r) => near(r, x, z, W / 2 + 1.2))) continue;
      placeOn(cardamom(kit, i), x, z);
      keepClear.push({ x, z, r: 1 });
    }
    for (const [x, z] of [
      [-9, 7],
      [-14, 10],
    ] as V2[])
      placeOn(roundTree(kit, "#3f7f3a", "#5a3d2b", 1.4), X.p.x + x, X.p.z + z);

    // ── NE: the Batasia-style loop and the toy train (a wait moment) ──
    const garden = memorialGarden(kit);
    garden.position.set(centre.x + nb.x * R * 0.15, trackY, centre.z + nb.z * R * 0.15);
    scene.add(garden);
    keepClear.push({ x: centre.x, z: centre.z, r: R + 2 }, { x: cross.p.x, z: cross.p.z, r: 9 });
    let tTrack = 0;
    best = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 400; i++) {
      const p = track.at(i / 400).p;
      const d = (p.x - cross.p.x) ** 2 + (p.z - cross.p.z) ** 2;
      if (d < best) {
        best = d;
        tTrack = i / 400;
      }
    }
    const train = toyTrain(kit);
    const carGap = 2.5 / track.length;
    const cars = [train.engine, train.coach(), train.coach()];
    cars.forEach((car, i) => {
      const q = track.at((tTrack + 0.01 - i * carGap + 1) % 1);
      car.position.set(q.p.x, trackY + 0.12, q.p.z);
      car.rotation.y = q.heading;
      scene.add(car);
    });
    const ringAt = (t: number) => ring.at(((t % 1) + 1) % 1);
    const tBf = tNear(ring, cross.p.x, cross.p.z);
    for (const [dt, side] of [
      [-0.012, -1],
      [-0.012, 1],
      [0.012, -1],
      [0.012, 1],
    ] as [number, -1 | 1][]) {
      const q = ringAt(tBf + dt);
      const b = boom(kit, W / 2 - 0.1);
      b.position.set(
        q.p.x + q.normal.x * side * (W / 2 + 0.5),
        q.p.y,
        q.p.z + q.normal.z * side * (W / 2 + 0.5),
      );
      b.rotation.y = q.heading + (side > 0 ? Math.PI : 0);
      scene.add(b);
    }
    const ts = beside(ring, tBf - 0.022, W / 2 + 1.4, -1);
    placeOn(bilingual(kit, "TRAIN CROSSING · WAIT", "रुकें", "#a3241c"), ts.x, ts.z);
    const bp = beside(ring, tBf + 0.03, W / 2 + 2.8, "outside");
    placeOn(photoSpot(kit), bp.x, bp.z, bp.heading);

    // ── N: deep forest canopy and the red panda crossing ──
    const tP = tNear(ring, 19, -42);
    const pc = ring.at(tP);
    const across = new THREE.Vector3(pc.normal.x, 0, pc.normal.z);
    const crossHeading = Math.atan2(-across.z, across.x);
    for (const [off, along, s] of [
      [0.3, 0, 1.15],
      [-0.75, 0.45, 0.62],
      [-1.4, -0.35, 0.6],
    ] as [number, number, number][]) {
      const x = pc.p.x + across.x * off + Math.cos(pc.heading) * along;
      const z = pc.p.z + across.z * off - Math.sin(pc.heading) * along;
      const panda = redPanda(kit, s);
      panda.position.set(x, pc.p.y + 0.1, z);
      panda.rotation.y = crossHeading;
      scene.add(panda);
    }
    const ps = beside(ring, tP + 0.035, W / 2 + 1.4, 1);
    placeOn(bilingual(kit, "RED PANDAS · GO SLOW", "बिस्तारै", "#b9512a"), ps.x, ps.z);
    for (const [dt, side, off, gibbons] of [
      [0.012, 1, 5.5, 2],
      [-0.006, -1, 7, 1],
      [0.024, -1, 9, 0],
    ] as [number, 1 | -1, number, number][]) {
      const q = beside(ring, tP + dt, off, side);
      const tree = bigTree(kit, 1.15);
      for (let i = 0; i < gibbons; i++) {
        const gb = gibbon(kit, i === 1);
        gb.position.set((1.2 + i * 0.9) * 1.15, 3.75 * 1.15, 0);
        tree.add(gb);
      }
      placeOn(tree, q.x, q.z, q.heading + (side > 0 ? 0 : Math.PI));
      keepClear.push({ x: q.x, z: q.z, r: 3.5 });
    }
    const hb = hornbill(kit);
    const hbAt = ring.at(tP + 0.014);
    hb.position.set(hbAt.p.x, hbAt.p.y + 6.5, hbAt.p.z);
    hb.rotation.y = hbAt.heading + 0.9;
    scene.add(hb);

    // ── NW: Sela-style pass, frozen lake, Tawang-style monastery; Rumtek ridge ──
    const tG = tNear(ring, -55, -38);
    const gq = ring.at(tG);
    const pass = passGate(kit, W + 2.2);
    pass.position.set(gq.p.x, gq.p.y, gq.p.z);
    pass.rotation.y = gq.heading;
    scene.add(pass);
    const iceLevel = land(ICE[0], ICE[1]) - 0.6;
    const ice = new THREE.Mesh(
      new THREE.CylinderGeometry(ICE_R, ICE_R + 0.3, 0.12, 40),
      kit.mat("#dcf0f6"),
    );
    ice.position.set(ICE[0], iceLevel + 0.06, ICE[1]);
    ice.receiveShadow = true;
    scene.add(ice);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      scene.add(
        sphere(
          kit,
          "#f4f6f8",
          [
            ICE[0] + Math.cos(a) * (ICE_R + 0.6),
            iceLevel + 0.1,
            ICE[1] + Math.sin(a) * (ICE_R + 0.6),
          ],
          0.5,
          undefined,
          [1.6, 0.4, 1],
        ),
      );
    }
    keepClear.push({ x: ICE[0], z: ICE[1], r: ICE_R + 2 });
    const tw: V2 = [-60, -56];
    placeOn(tawang(kit), tw[0], tw[1], Math.atan2(gq.p.x - tw[0], gq.p.z - tw[1]), {
      pad: 6.5,
      footprint: 4,
    });
    keepClear.push({ x: tw[0], z: tw[1], r: 11 });
    const sg = beside(ring, tG + 0.014, W / 2 + 2.6, "outside");
    placeOn(photoSpot(kit), sg.x, sg.z, sg.heading);
    const selaMist = mist(7, 8, 3);
    const mistAt = beside(ring, tG - 0.03, 12, "inside");
    selaMist.position.set(mistAt.x, height(mistAt.x, mistAt.z) - 0.6, mistAt.z);
    scene.add(selaMist);

    const mq = rumtek.at(0.5);
    // The monastery stands just north of the detour, its prayer-wheel front (+z) facing the lane.
    const mp: V2 = [mq.p.x - 1, mq.p.z - 7];
    placeOn(monastery(kit), mp[0], mp[1], 0, { pad: 5.5, footprint: 3.5 });
    keepClear.push({ x: mp[0], z: mp[1], r: 7 });
    for (const t of [0.25, 0.45, 0.65]) {
      const a = beside(rumtek, t, W / 2 + 0.9, 1);
      const b = beside(rumtek, t, W / 2 + 0.9, -1);
      scene.add(
        lungta(
          kit,
          new THREE.Vector3(a.x, height(a.x, a.z), a.z),
          new THREE.Vector3(b.x, height(b.x, b.z), b.z),
        ),
      );
    }
    for (const t of [0.12, 0.88]) {
      const c = beside(rumtek, t, W / 2 + 1.8, "outside");
      placeOn(chorten(kit, 1.1), c.x, c.z, 0, { pad: 1.2, footprint: 0.6 });
    }

    // ── E: rhododendron valley and the campfire viewpoint ──
    const campEnd = campSpur.at(1);
    const cf = campfire(kit);
    cf.position.set(campEnd.p.x + 1.8, height(campEnd.p.x + 1.8, campEnd.p.z), campEnd.p.z);
    scene.add(cf);
    keepClear.push({ x: campEnd.p.x + 1.8, z: campEnd.p.z, r: 3.5 });
    placeOn(photoSpot(kit), campEnd.p.x - 0.5, campEnd.p.z - 2.6, campEnd.heading);
    for (const [x, z, n, s] of [
      [66, -4, 10, 1],
      [70, 12, 12, 4],
      [60, 6, 8, 7],
    ] as [number, number, number, number][]) {
      const b = butterflies(kit, n, s);
      b.position.set(x, height(x, z), z);
      scene.add(b);
    }

    // ── SE: Kaziranga-style grassland park on its own safari loop ──
    const taken: V2[] = [];
    const spot = (cx: number, cz: number, rad: number, seed: number, clear = 3.2): V2 => {
      for (let k = 0; k < 400; k++) {
        const a = seed * 2.4 + k * 2.39996;
        const r = rad * Math.sqrt(((k * 0.618) % 1) + 0.02);
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        if (roads.some((rd) => near(rd, x, z, W / 2 + clear))) continue;
        if (POOLS.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4.2)) continue;
        if (taken.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < clear + 1)) continue;
        if (height(x, z) < WATER + 0.3) continue;
        taken.push([x, z]);
        return [x, z];
      }
      // Nothing ideal: take the candidate furthest from any road.
      let bestP: V2 = [cx, cz];
      let bestR = -1;
      for (let k = 0; k < 200; k++) {
        const a = k * 2.39996;
        const r = rad * Math.sqrt(((k * 0.618) % 1) + 0.02);
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        if (height(x, z) < WATER + 0.3) continue;
        let dmin = Number.POSITIVE_INFINITY;
        for (const rd of roads)
          for (const s of rd.samples) dmin = Math.min(dmin, Math.hypot(s.x - x, s.z - z));
        if (dmin > bestR) {
          bestR = dmin;
          bestP = [x, z];
        }
      }
      taken.push(bestP);
      return bestP;
    };
    const towerAt = spot(52, 38, 8, 1, 4);
    placeOn(watchtower(kit), towerAt[0], towerAt[1], 0.6, { pad: 2.6, footprint: 1.3 });
    keepClear.push({ x: towerAt[0], z: towerAt[1], r: 3.5 });
    keepClear.push({ x: 52, z: 38, r: 3.5 });
    const ks = beside(kaz, 0.04, W / 2 + 1.6, "inside");
    placeOn(bilingual(kit, "KAZIRANGA · NATIONAL PARK", "काजीरंगा", "#4f6b2a"), ks.x, ks.z);
    const [p1, p2, p3] = POOLS as [V2, V2, V2];
    placeOn(rhino(kit, 1.35), p1[0], p1[1], 0.6, { y: WATER - 0.45 });
    placeOn(rhino(kit, 0.8), p1[0] + 2.6, p1[1] + 1.5, 0.9, { y: WATER - 0.25 });
    const walker = spot(47, 45, 7, 3);
    placeOn(rhino(kit, 1.2), walker[0], walker[1], -0.4, { mode: "align" });
    for (const [x, z, r] of [
      [p2[0] + 1, p2[1], 0.3],
      [p2[0] - 2, p2[1] + 1.5, 1.2],
      [p2[0] + 2.5, p2[1] + 2, 2.4],
    ] as [number, number, number][]) {
      placeOn(waterBuffalo(kit, 1), x, z, r, { y: WATER - 0.2 });
    }
    const herd = spot(64, 51, 6, 5, 5);
    for (const [dx, dz, r] of [
      [0, 0, 2.2],
      [1.6, 1.2, 2.5],
      [-1.4, 1.4, 1.8],
      [2.2, -1.0, 2.8],
    ] as [number, number, number][])
      placeOn(deer(kit, "#9a6a3a", 1), herd[0] + dx, herd[1] + dz, r, { mode: "align" });
    const eleQ = spot(54, 44, 9, 7, 5);
    const eq = kaz.at(tNear(kaz, eleQ[0], eleQ[1]));
    placeOn(safariElephant(kit), eleQ[0], eleQ[1], eq.heading, { mode: "align" });
    const ele2 = spot(44, 50, 7, 11, 5);
    placeOn(safariElephant(kit), ele2[0], ele2[1], eq.heading + 2.6, { mode: "align" });
    for (const q of [p1, p2, p3, walker, herd, eleQ, ele2])
      keepClear.push({ x: q[0], z: q[1], r: 3.4 });
    const parkBirds = flock(kit, 7, 2);
    parkBirds.position.set(KAZI[0], 9, KAZI[1]);
    scene.add(parkBirds);

    // ── S: Loktak Lake: phumdis, a sangai deer, a fishing hut, a canoe ──
    const phumdis: [number, number, number, boolean][] = [
      [LOKTAK[0] - 4, LOKTAK[1] - 2, 2.4, true],
      [LOKTAK[0] + 4, LOKTAK[1] + 1, 3.0, false],
      [LOKTAK[0] - 1, LOKTAK[1] + 6, 1.8, true],
      [LOKTAK[0] + 7, LOKTAK[1] - 5, 1.6, false],
      [LOKTAK[0] - 7, LOKTAK[1] + 4, 1.4, false],
      [LOKTAK[0] + 1, LOKTAK[1] - 7, 2.0, true],
    ];
    phumdis.forEach(([x, z, r, ringShape], i) => {
      const ph = phumdi(kit, r, ringShape, i);
      ph.position.set(x, WATER + 0.05, z);
      scene.add(ph);
    });
    const sangai = deer(kit, "#a8562e", 0.9, true);
    sangai.position.set(LOKTAK[0] + 4.3, WATER + 0.22, LOKTAK[1] + 0.6);
    sangai.rotation.y = 2.4;
    scene.add(sangai);
    const hut = lakeHut(kit);
    hut.position.set(LOKTAK[0] + 7, WATER + 0.2, LOKTAK[1] - 5);
    scene.add(hut);
    const boat = canoe(kit);
    boat.position.set(LOKTAK[0] - 3, WATER + 0.1, LOKTAK[1] + 2.5);
    boat.rotation.y = 0.8;
    scene.add(boat);
    const lakeBirds = flock(kit, 6, 5);
    lakeBirds.position.set(LOKTAK[0] - 4, 8, LOKTAK[1] - 2);
    scene.add(lakeBirds);
    const le = lokSpur.at(1);
    placeOn(photoSpot(kit), le.p.x + 2.2, le.p.z, le.heading);
    const ll = beside(lokSpur, 0.5, W / 2 + 1.2, -1);
    placeOn(bilingual(kit, "LOKTAK LAKE", "लोकटक", "#2b6c8a"), ll.x, ll.z);

    // ── SW: stream village: cane bridge, stilt houses, living root bridge ──
    // The cane bridge spans exactly where the deck leaves the ground.
    const clearOf = (dir: 1 | -1) => {
      let t = tStream;
      for (let k = 0; k < 400; k++) {
        const q = ring.at(t + dir * 0.0005).p;
        if (q.y - withWater(q.x, q.z) < 0.35) break;
        t += dir * 0.0005;
      }
      return t;
    };
    const bA = ring.at(clearOf(-1)).p;
    const bB = ring.at(clearOf(1)).p;
    const br = ring.at(tStream);
    const span = Math.max(8, bA.distanceTo(bB) + 2);
    const bridge = caneBridge(kit, span);
    bridge.position.set((bA.x + bB.x) / 2, deckY - 0.28, (bA.z + bB.z) / 2);
    bridge.rotation.y = Math.atan2(-(bB.z - bA.z), bB.x - bA.x);
    scene.add(bridge);
    keepClear.push({ x: br.p.x, z: br.p.z, r: span / 2 + 2 });
    // Downstream along the stream: the root bridge, the village, drizzle.
    const streamCurve = new THREE.CatmullRomCurve3(
      STREAM.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    );
    let ts0 = 0;
    best = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 300; i++) {
      const p = streamCurve.getPointAt(i / 300);
      const d = (p.x - br.p.x) ** 2 + (p.z - br.p.z) ** 2;
      if (d < best) {
        best = d;
        ts0 = i / 300;
      }
    }
    const rbT = Math.min(0.98, ts0 + 14 / streamCurve.getLength());
    const rbP = streamCurve.getPointAt(rbT);
    const rbTan = streamCurve.getTangentAt(rbT);
    const rb = rootBridge(kit, 7);
    const rbY =
      Math.max(
        height(rbP.x + rbTan.z * 4, rbP.z - rbTan.x * 4),
        height(rbP.x - rbTan.z * 4, rbP.z + rbTan.x * 4),
      ) - 1.2;
    rb.position.set(rbP.x, Math.max(rbY, WATER - 0.4), rbP.z);
    rb.rotation.y = Math.atan2(-rbTan.z, rbTan.x) + Math.PI / 2;
    scene.add(rb);
    keepClear.push({ x: rbP.x, z: rbP.z, r: 9.5 });
    const rbs = new THREE.Vector3(rbP.x + rbTan.z * 6, 0, rbP.z - rbTan.x * 6);
    placeOn(bilingual(kit, "LIVING ROOT BRIDGE", "जीवित जड़ पुल", "#4f6b2a"), rbs.x, rbs.z);
    const rain = drizzle(kit, 220, 9, 7);
    rain.position.set(rbP.x, Math.max(rbY, WATER) + 0.5, rbP.z);
    scene.add(rain);
    const rbMist = mist(5, 6, 9);
    rbMist.position.set(rbP.x, WATER + 0.6, rbP.z);
    scene.add(rbMist);
    for (const [along, side] of [
      [-6, 1],
      [5, -1],
      [10, 1],
      [-11, -1],
      [-16, 1],
    ] as [number, 1 | -1][]) {
      const t = Math.min(0.99, Math.max(0.01, ts0 + along / streamCurve.getLength()));
      const sp2 = streamCurve.getPointAt(t);
      const tan = streamCurve.getTangentAt(t);
      const x = sp2.x + tan.z * side * 7.5;
      const z = sp2.z - tan.x * side * 7.5;
      if (roads.some((r) => near(r, x, z, W / 2 + 3))) continue;
      if (Math.hypot(x - br.p.x, z - br.p.z) < 6 || Math.hypot(x - rbP.x, z - rbP.z) < 7) continue;
      placeOn(stiltHouse(kit), x, z, Math.atan2(-tan.z, tan.x) + (side > 0 ? 0 : Math.PI), {
        pad: 2.8,
        footprint: 1.6,
      });
      keepClear.push({ x, z, r: 4 });
    }
    const leoT = new THREE.Vector3(
      rbP.x - rbTan.z * 14 + rbTan.x * 9,
      0,
      rbP.z + rbTan.x * 14 + rbTan.z * 9,
    );
    const leoTree = bigTree(kit, 1.1);
    const leo = cloudedLeopard(kit);
    leo.position.set(1.7 * 1.1, 3.95 * 1.1, 0);
    leoTree.add(leo);
    placeOn(leoTree, leoT.x, leoT.z, 1.2);
    keepClear.push({ x: leoT.x, z: leoT.z, r: 3.5 });

    // ── Lived-in: hill villages, paddies, monks, schoolchildren, a yak pasture ──
    const free = (x: number, z: number, pad = 2.5) =>
      !roads.some((r) => near(r, x, z, W / 2 + pad)) &&
      !keepClear.some((k) => (k.x - x) ** 2 + (k.z - z) ** 2 < (k.r + 1) ** 2);
    const village = (c: V2, houses: number, rad: number, seed: number) => {
      for (let i = 0; i < houses; i++) {
        const a = seed + (i / houses) * Math.PI * 2 + (i % 2) * 0.3;
        const r = rad + (i % 2) * 1.6;
        const x = c[0] + Math.cos(a) * r;
        const z = c[1] + Math.sin(a) * r;
        if (!free(x, z, 3)) continue;
        placeOn(hillHouse(kit, Math.round(seed * 10) + i), x, z, Math.atan2(x - c[0], z - c[1]), {
          pad: 2.4,
          footprint: 1.5,
        });
        keepClear.push({ x, z, r: 2.8 });
        // cardamom drying in front, prayer flags beside
        const fx = x + Math.cos(a) * 2.6;
        const fz = z + Math.sin(a) * 2.6;
        if (i % 2 === 0 && free(fx, fz, 1.5)) {
          placeOn(dryingMat(kit, i), fx, fz, a, { mode: "align", footprint: 0.6 });
          keepClear.push({ x: fx, z: fz, r: 1.2 });
        }
      }
      const fl: V2 = [c[0] + Math.cos(seed + 0.9) * 2, c[1] + Math.sin(seed + 0.9) * 2];
      placeOn(darchor(kit, 5, Math.round(seed * 10)), fl[0], fl[1], 0, { footprint: 0.9 });
      // farmers planting on the terraces below, cows grazing
      for (let i = 0; i < 4; i++) {
        const a = seed + 2 + i * 1.6;
        const r = rad + 3.4 + (i % 2) * 1.2;
        const x = c[0] + Math.cos(a) * r;
        const z = c[1] + Math.sin(a) * r;
        if (!free(x, z, 1.5)) continue;
        placeOn(farmer(kit, i + Math.round(seed * 10)), x, z, a + 1.6, { footprint: 0.3 });
        keepClear.push({ x, z, r: 1 });
      }
      for (let i = 0; i < 2; i++) {
        const a = seed + 4.4 + i * 0.5;
        const x = c[0] + Math.cos(a) * (rad + 4.5);
        const z = c[1] + Math.sin(a) * (rad + 4.5);
        if (!free(x, z, 2)) continue;
        placeOn(cow(kit, i ? "#efe4d0" : "#9a6a45", 0.9), x, z, a + 2.2, { mode: "align" });
        keepClear.push({ x, z, r: 1.4 });
      }
      keepClear.push({ x: c[0], z: c[1], r: rad + 6 });
    };
    village(VILLAGE, 6, 4.2, 0.4);
    village(TERRACES, 3, 3.6, 2.1);

    // Young monks walking up the detour to the monastery.
    [0.3, 0.335, 0.37].forEach((t, i) => {
      const q = beside(rumtek, t, W / 2 + 0.55, 1);
      placeOn(monk(kit, 0.95 - i * 0.08), q.x, q.z, q.heading, { mode: "align" });
    });
    // Schoolchildren in uniform on the way to the arrival gate.
    [0.0, 0.012, 0.02, 0.034].forEach((dt, i) => {
      const q = beside(ns, tX - 0.115 + dt, W / 2 + 0.45 + (i % 2) * 0.4, 1);
      placeOn(schoolKid(kit, i), q.x, q.z, q.heading, { mode: "align" });
    });
    // A yak pasture on the high ground below the pass.
    let yaks = 0;
    for (let k = 0; k < 300 && yaks < 3; k++) {
      const a = k * 2.39996;
      const r = 13 * Math.sqrt(((k * 0.618) % 1) + 0.02);
      const x = -48 + Math.cos(a) * r;
      const z = -50 + Math.sin(a) * r;
      const h = height(x, z);
      if (h < 6.5 || h > 10.5 || !free(x, z, 3)) continue;
      placeOn(yak(kit, 1 - yaks * 0.12, yaks === 1 ? "#efe9df" : "#2e2622"), x, z, a, {
        mode: "align",
      });
      keepClear.push({ x, z, r: 2 });
      if (yaks === 0) placeOn(darchor(kit, 3, 5), x + 3, z - 2, 0, { footprint: 0.9 });
      yaks++;
    }

    // ── Junction guide boards (NHAI green; the ring runs clockwise, so the inside is to the right) ──
    const posts: [Road, number, SignLine[]][] = [
      [
        ring,
        tN,
        [
          { en: "Arrival Gate", local: "स्वागत द्वार", arrow: "right", km: 4 },
          { en: "Toy Train", local: "टॉय ट्रेन", arrow: "up", km: 5 },
        ],
      ],
      [
        ring,
        tS,
        [
          { en: "Arrival Gate", local: "स्वागत द्वार", arrow: "right", km: 2 },
          { en: "Root Bridge", local: "जरा पुल", arrow: "up", km: 3 },
        ],
      ],
      [ring, tLok, [{ en: "Loktak Lake", local: "लोकटक ताल", arrow: "left", km: 1 }]],
      [
        ring,
        tR1,
        [
          { en: "Rumtek Monastery", local: "रुम्टेक गुम्बा", arrow: "up-left", km: 1 },
          { en: "Toy Train", local: "टॉय ट्रेन", arrow: "up", km: 7 },
        ],
      ],
      [
        ring,
        tK1,
        [
          { en: "Kaziranga Safari", local: "काजीरंगा", arrow: "left", km: 1 },
          { en: "Loktak Lake", local: "लोकटक ताल", arrow: "up", km: 5 },
        ],
      ],
      [
        ring,
        tCamp,
        [
          { en: "Campfire View", local: "क्याम्प", arrow: "left", km: 1 },
          { en: "Kaziranga", local: "काजीरंगा", arrow: "up", km: 3 },
        ],
      ],
      [
        ring,
        tW,
        [
          { en: "Arrival Gate", local: "स्वागत द्वार", arrow: "right", km: 4 },
          { en: "Sela Pass", local: "सेला दर्रा", arrow: "up", km: 3 },
        ],
      ],
    ];
    for (const [r, t, lines] of posts) guide(r, t - 0.012, lines, -1);
    // Kilometre stones along the ring (white with a yellow cap, like a national highway).
    for (const [t, place, km] of [
      [tG + 0.06, "SELA", 2],
      [tBf - 0.06, "GHUM", 1],
      [tStream + 0.05, "MAWLYN", 1],
      [tK1 + 0.05, "KOHORA", 2],
    ] as [number, string, number][]) {
      const q = beside(ring, t, W / 2 + 0.7, "outside");
      placeOn(kmStone(kit, place, km, "nh"), q.x, q.z, q.heading - Math.PI / 2, {
        footprint: 0.25,
      });
    }

    // ── Stops: one camp per project, spread over the network ──
    const avoid = [tStream, tG, tBf, tP, tN, tS, tW, tE, tR1, tR2, tK1, tK2, tLok, tCamp];
    const ringStops: number[] = [];
    const okRing = (t: number) =>
      avoid.every((a) => Math.min(Math.abs(a - t), 1 - Math.abs(a - t)) > 0.03) &&
      ringStops.every((o) => Math.min(Math.abs(o - t), 1 - Math.abs(o - t)) > 0.08);
    for (const t of ring.corners(0.02)) if (ringStops.length < 4 && okRing(t)) ringStops.push(t);
    for (let k = 0; ringStops.length < 4 && k < 400; k++) {
      const t = (((k * 0.618) % 1) + 1) % 1;
      if (okRing(t)) ringStops.push(t);
    }
    ringStops.sort((a, b) => a - b);
    const branches: { road: Road; stops: number[]; label: string }[] = [
      { road: ns, stops: [Math.max(0.1, tX - 0.32)], label: "Crossroads · north–south" },
      { road: ew, stops: [Math.min(0.9, tX + 0.2)], label: "Crossroads · east–west" },
      { road: rumtek, stops: [0.5], label: "Rumtek monastery detour" },
      { road: kaz, stops: [0.28], label: "Kaziranga safari loop" },
      { road: lokSpur, stops: [0.8], label: "Loktak overlook (spur)" },
      { road: campSpur, stops: [0.55], label: "Campfire viewpoint (spur)" },
    ];
    let campNo = 0;
    const placeCamp = (r: Road, t: number) => {
      // Try the outside, then the inside of the bend, then nudge along the road.
      const free = (x: number, z: number) =>
        !keepClear.some((k) => (k.x - x) ** 2 + (k.z - z) ** 2 < (k.r + 2.5) ** 2) &&
        !roads.some((rd) => near(rd, x, z, W / 2 + 2.6));
      let q = beside(r, t, W / 2 + 4.2, "outside");
      search: for (const dt of [0, 0.015, -0.015, 0.03, -0.03])
        for (const side of ["outside", "inside"] as const) {
          const c = beside(r, Math.min(0.99, Math.max(0.01, t + dt)), W / 2 + 4.2, side);
          if (free(c.x, c.z)) {
            q = c;
            break search;
          }
        }
      placeOn(camp(kit, campNo), q.x, q.z, q.heading, { pad: 2.4, footprint: 1.2 });
      keepClear.push({ x: q.x, z: q.z, r: 3.5 });
      const s = beside(r, t - 0.012, W / 2 + 0.9, "outside");
      placeOn(cornerSign(kit, [20, 30, 25][campNo % 3] ?? 25), s.x, s.z);
      campNo++;
    };
    for (const t of ringStops) placeCamp(ring, t);
    for (const b of branches) for (const t of b.stops) placeCamp(b.road, t);

    // ── Fill: forest, rhododendron valley, bamboo; grass in the park ──
    let placed = 0;
    for (let i = 0; i < 2600 && placed < 900; i++) {
      const x = -88 + ((i * 97.13) % 176);
      const z = -60 + ((i * 61.71) % 120);
      if (roads.some((r) => near(r, x, z, W / 2 + 2.4))) continue;
      if (keepClear.some((k) => (k.x - x) ** 2 + (k.z - z) ** 2 < k.r * k.r)) continue;
      const h = height(x, z);
      if (h < WATER + 0.25) continue;
      const dk = Math.hypot(x - KAZI[0], z - KAZI[1]);
      if (dk < 17) {
        placeOn(elephantGrass(kit, i, 0.9 + (i % 3) * 0.15), x, z, i, { mode: "align" });
        placed++;
        continue;
      }
      if (h > 12) continue; // bare snow up high
      if (Math.abs(x - X.p.x) < 15 && Math.abs(z - X.p.z) < 13) continue; // the open village square
      if (Math.hypot(x - centre.x, z - centre.z) < R + 8) continue; // keep the loop and crossing open
      const inValley = x > 56 && x < 86 && z > -14 && z < 22;
      let o: THREE.Object3D;
      if (h > 9) o = pine(kit, "#2f6b45", "#5a3d2b", 0.9 + (i % 3) * 0.15);
      else if (inValley)
        o = i % 5 ? rhododendron(kit, 0.9 + (i % 3) * 0.18) : pine(kit, "#3d8a56", "#5a3d2b", 1.2);
      else {
        const kind = i % 12;
        if (kind < 6) o = pine(kit, i % 3 ? "#2f7a4a" : "#3d8a56", "#5a3d2b", 1.1 + (i % 5) * 0.18);
        else if (kind < 8) o = rhododendron(kit, 0.9 + (i % 3) * 0.15);
        else if (kind < 10)
          o = roundTree(kit, i % 2 ? "#4f8f46" : "#3f7f3a", "#5a3d2b", 1.1 + (i % 3) * 0.15);
        else o = bambooGrove(kit, i);
      }
      placeOn(o, x, z, i);
      placed++;
    }
    const sky = flock(kit, 8, 9);
    sky.position.set(-10, 14, -10);
    scene.add(sky);

    // ── Ground everything on the pads, then add the land ──
    const ground = shape(flattenPads(withWater, pads));
    for (const pl of placements) {
      placeOnGround(pl.o, ground, pl.x, pl.z, {
        mode: pl.mode,
        yaw: pl.rot,
        footprint: pl.footprint,
      });
      if (pl.y !== undefined) pl.o.position.y = pl.y;
      scene.add(pl.o);
    }
    scene.add(
      terrain({
        w: SIZE[0],
        d: SIZE[1],
        density: 1.9,
        height: ground,
        mood: "golden",
        colour: (x, z, h, slope) => {
          if (h < WATER + 0.3) return "#93ba6c";
          if (h > 11.5) return slope > 0.35 ? "#c2c8d2" : "#eef4fb";
          if (h > 9.5) return slope > 0.25 ? "#a8a39c" : "#e6ebef";
          if (slope > 0.28 && h > 5.5) return "#8f8a84";
          if (terraceMask(x, z) > 0.3 && slope < 0.2)
            return (
              ["#9cc65a", "#b5d26a", "#86b84e"][((Math.floor(h / 0.75) % 3) + 3) % 3] ?? "#9cc65a"
            );
          if (Math.hypot(x - KAZI[0], z - KAZI[1]) < 17)
            return slope > 0.12 ? "#a9b25a" : "#bcc06a";
          if (slope > 0.16) return "#6a9a52";
          const n = Math.sin(x * 0.5) * Math.cos(z * 0.45);
          if (h > 6) return n > 0.4 ? "#7cb85e" : "#86c066";
          return n > 0.55 ? "#7bbf5c" : "#86c864";
        },
      }),
    );
    addWaterfall(scene, kit, ground);
    for (const r of distantRanges(kit)) scene.add(r);

    // Moment framing on several roads (see `director`).
    const parts = [ring, ns, kaz, ew];
    const D = director(parts);
    const at = (part: number, t: number) =>
      (part + THREE.MathUtils.clamp(t, 0.001, 0.999)) / parts.length;
    const hX = ns.at(tX - 0.11).heading;
    const tVil = tNear(ew, VILLAGE[0] + 3, VILLAGE[1] + 14);
    const vq = ew.at(tVil).p;
    const villageView =
      THREE.MathUtils.radToDeg(Math.atan2(vq.x - VILLAGE[0], vq.z - VILLAGE[1])) + 12;
    const trainView = THREE.MathUtils.radToDeg(
      Math.atan2(cross.p.x - centre.x, cross.p.z - centre.z),
    );
    const hP = ring.at(tP - 0.012).heading;
    const selaView = THREE.MathUtils.radToDeg(
      Math.atan2(gq.p.x - (ICE[0] + tw[0]) / 2, gq.p.z - (ICE[1] + tw[1]) / 2),
    );
    return {
      road: D,
      stops: ringStops.map((t) => at(0, t)),
      branches,
      mapZoom: 150,
      mapCentre: [0, 0],
      moments: [
        {
          label:
            "Arrival gateway (first-visit spawn): the Sikkimese welcome gate at the crossroads, momo stall, orange orchard",
          t: at(1, tX - 0.11),
          zoom: 28,
          cinematic: { azimuth: behind(hX, 28), elevation: 20, distance: 22, fov: 42 },
        },
        {
          label: "Batasia-style loop (cinematic): the toy train crosses, barriers down: wait",
          t: at(0, tBf - 0.03),
          zoom: 22,
          cinematic: { azimuth: trainView + 25, elevation: 22, distance: 19, fov: 44 },
        },
        {
          label:
            "Red panda family crossing (cinematic): gibbons in the canopy, a hornbill overhead",
          t: at(0, tP - 0.012),
          zoom: 18,
          cinematic: { azimuth: behind(hP, 24), elevation: 14, distance: 11, fov: 42 },
        },
        {
          label:
            "Hill village (cinematic): Lepcha/Bhutia houses with tin roofs on terraced paddies, darchor flags, cardamom drying, farmers and cows",
          t: at(3, tVil),
          zoom: 26,
          cinematic: { azimuth: villageView, elevation: 18, distance: 13, fov: 46 },
        },
        {
          label:
            "Kaziranga safari loop: watchtower, rhinos in the pools, wild buffalo, swamp deer, elephant safari",
          t: at(2, 0.45),
          zoom: 34,
        },
        {
          label: "Stream village: cane bridge, stilt houses, the living root bridge in the drizzle",
          t: at(0, tStream),
          zoom: 30,
        },
        {
          label:
            "Sela-style pass (cinematic): snow, the gate arch, a frozen lake, the Tawang-style monastery above",
          t: at(0, tG + 0.012),
          zoom: 26,
          cinematic: { azimuth: selaView, elevation: 20, distance: 26, fov: 46 },
        },
      ],
    };
  },
};
