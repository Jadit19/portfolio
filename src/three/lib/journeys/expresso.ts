/**
 * Expresso (v2, open world): a Coorg coffee estate at golden hour.
 *
 * No start or finish. A figure-eight estate road passes every hero
 * landmark: the estate gate and bungalow, the Mandalpatti summit above a sea
 * of clouds, the roastery café, the Kaveri with Dubare-style elephants being
 * bathed, Abbey Falls with a rainbow, and the pulping house and drying yards.
 * The figure-eight crosses itself at the arrival plaza (Kodava-style arch,
 * first-visit spawn); a pickers' lane and a dead-end spur to the coracle
 * landing make it a network to explore. Junction signposts are in English.
 * The 8 stops are café counters serving each C++ library as a drink.
 */

import * as THREE from "three";
import {
  beside,
  branchPoints,
  carve,
  findJunctions,
  flattenPads,
  type HeightFn,
  type JourneyDef,
  kmStone,
  levelJunctions,
  makeRoad,
  nhaiSign,
  placeOnGround,
  type Road,
  roadMesh,
  type SignLine,
  terrainSteps,
  tileHeight,
  tiling,
  type V2,
} from "../journey";
import { box, disc, type Kit, sphere, tube } from "../kit";
import { BG, nightLight } from "../zones";

const g2 = (x: number, z: number, cx: number, cz: number, r: number) =>
  Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));

/** The arrival plaza where the figure-eight crosses itself (first-visit spawn). */
const CENTRE: V2 = [2, -4];

/**
 * The estate road: a closed figure-eight that crosses itself at the arrival
 * plaza. The east lobe passes the roastery, the elephant camp and the coracle
 * spur; the west lobe climbs over Mandalpatti, passes the bungalow and the
 * pulping house, and crosses the stream below Abbey Falls.
 */
const LOOP: V2[] = [
  CENTRE,
  [14, 10],
  [26, 26],
  [42, 40],
  [58, 30],
  [64, 10],
  [58, -14],
  [46, -30],
  [28, -40],
  [12, -26],
  [3, -9],
  [-8, 6],
  [-20, 18],
  [-18, 32],
  [-6, 42],
  [-20, 46],
  [-36, 42],
  [-52, 36],
  [-62, 18],
  [-62, -2],
  [-56, -22],
  [-40, -36],
  [-20, -44],
  [-8, -26],
  [-1, -10],
];

/**
 * The Kaveri: runs the length of the estate, north edge to south edge, past
 * the elephant camp. It leaves the south edge exactly where it enters the
 * north edge, so in the open world it flows on forever.
 */
const RIVER: V2[] = [
  [52, 68],
  [60, 46],
  [72, 26],
  [80, 4],
  [76, -12],
  [66, -26],
  [56, -42],
  [52, -68],
];
/** A stream from the hills, past Abbey Falls, north edge to south edge (it meets itself too). */
const STREAM: V2[] = [
  [-30, 68],
  [-33, 46],
  [-30, 24],
  [-27, 8],
  [-24, -6],
  [-22, -20],
  [-22, -34],
  [-26, -50],
  [-30, -68],
];

/** The estate's size: one tile of the open world. */
const TILE_W = 176;
const TILE_D = 128;

const LIBRARIES: [string, string][] = [
  ["expresso", "single-origin espresso"],
  ["json", "cold brew, served neat"],
  ["brewtils", "filter kaapi, steel tumbler"],
  ["mochios", "café mocha"],
  ["zippuccino", "cappuccino, extra foam"],
  ["logger", "black coffee, no sugar"],
  ["nexus", "affogato"],
  ["bloomail", "iced latte"],
];

/** Distance from (x, z) to a polyline. */
function polyDist(pts: readonly V2[], x: number, z: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    const abx = b[0] - a[0];
    const abz = b[1] - a[1];
    const l2 = abx * abx + abz * abz || 1;
    const t = Math.min(1, Math.max(0, ((x - a[0]) * abx + (z - a[1]) * abz) / l2));
    best = Math.min(best, Math.hypot(a[0] + abx * t - x, a[1] + abz * t - z));
  }
  return best;
}

const smoothRiver = (() => {
  const c = new THREE.CatmullRomCurve3(
    RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
  );
  return c.getSpacedPoints(80).map((p) => [p.x, p.z] as V2);
})();
const smoothStream = (() => {
  const c = new THREE.CatmullRomCurve3(
    STREAM.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
  );
  return c.getSpacedPoints(80).map((p) => [p.x, p.z] as V2);
})();

/** A sharp-crested ridge profile: 1 on the crest, falling to 0 in the folds. */
const ridged = (u: number) => (1 - Math.abs(Math.sin(u))) ** 2;

/** The Mandalpatti grassland ridge line, running east-west behind the summit. */
const MANDAL_RIDGE: V2[] = [
  [-52, 54],
  [-30, 52],
  [-4, 50],
  [20, 56],
  [40, 60],
];

const base: HeightFn = (x, z) => {
  const rd = polyDist(smoothRiver, x, z);
  const sd = polyDist(smoothStream, x, z);
  // Mandalpatti: a high grassland summit on a long ridge (above the clouds).
  const mandalpatti =
    17 * g2(x, z, -4, 46, 14) +
    4 * g2(x, z, -26, 44, 10) +
    7 * Math.exp(-(polyDist(MANDAL_RIDGE, x, z) ** 2) / 50);
  // Steep estate hills and Western Ghats folds, fading out in the valleys.
  const hills =
    6.5 * g2(x, z, 30, 6, 15) +
    5 * g2(x, z, -38, -6, 13) +
    3.5 * g2(x, z, 6, -20, 11) +
    4 * g2(x, z, -66, 40, 12);
  const valley = THREE.MathUtils.smoothstep(Math.min(rd, sd * 1.6), 4, 18);
  const folds =
    valley * (2.6 * ridged(x * 0.065 + z * 0.035 + 0.7) + 1.3 * ridged(x * 0.12 - z * 0.085 + 0.3));
  const rolls =
    0.6 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.1) +
    0.3 * Math.sin(x * 0.29) * Math.sin(z * 0.25);
  // The Kaveri gorge and the stream valley, with soft banks.
  const river = -4.4 * (1 - THREE.MathUtils.smoothstep(rd, 3, 14));
  const stream = -2.4 * (1 - THREE.MathUtils.smoothstep(sd, 1, 6));
  // Abbey Falls: a granite step across the stream, high to the north.
  const step =
    2.6 * THREE.MathUtils.smoothstep(z, -21, -16) * (1 - THREE.MathUtils.smoothstep(sd, 4, 12));
  return mandalpatti + hills + folds + rolls + river + stream + step;
};

/**
 * A distant mountain range as a ring band beyond the island: a crest line
 * with feet falling away on both sides, coloured with aerial haze (the foot
 * fades into the valley mist). Unlit so the layers read as clean silhouettes.
 */
function rangeBand(
  pts: V2[],
  centre: V2,
  inner: number,
  outer: number,
  crest: (s: number) => number,
  foot: number,
  colour: string,
  haze: string,
  hazeAmt = 0.55,
): THREE.Mesh {
  const pos: number[] = [];
  const col: number[] = [];
  const top = new THREE.Color(colour);
  const low = top.clone().lerp(new THREE.Color(haze), hazeAmt);
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i] ?? [0, 0];
    const a = pts[Math.max(0, i - 1)] ?? p;
    const b = pts[Math.min(n - 1, i + 1)] ?? p;
    let nx = -(b[1] - a[1]);
    let nz = b[0] - a[0];
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    if (nx * (p[0] - centre[0]) + nz * (p[1] - centre[1]) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const y = crest(i / (n - 1));
    pos.push(
      p[0] - nx * inner,
      foot,
      p[1] - nz * inner,
      p[0],
      y,
      p[1],
      p[0] + nx * outer,
      foot,
      p[1] + nz * outer,
    );
    col.push(low.r, low.g, low.b, top.r, top.g, top.b, low.r, low.g, low.b);
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < 2; k++) {
      const a = i * 3 + k;
      const b = (i + 1) * 3 + k;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
}

const ellipse = (rx: number, rz: number, n = 260, a0 = 0, a1 = Math.PI * 2): V2[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [Math.cos(a) * rx, Math.sin(a) * rz] as V2;
  });

/** Layered blue Western Ghats ridges around the estate, fading into the golden haze. */
function westernGhats(scene: THREE.Scene): void {
  const haze = BG.golden;
  const layers: [number, number, number, number, string, number][] = [
    // rx, rz, crest, jaggedness, colour, haze at the foot
    [132, 104, 12, 7, "#5a9270", 0.15],
    [162, 128, 22, 10, "#5f8e9c", 0.45],
    [205, 162, 32, 12, "#86a2b6", 0.5],
    [260, 205, 40, 14, "#b2b6bd", 0.55],
  ];
  // The valley floor between the estate and the ranges.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96),
    new THREE.MeshBasicMaterial({ color: "#8fb07a" }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.scale.set(150, 120, 1);
  floor.position.y = -9;
  scene.add(floor);
  layers.forEach(([rx, rz, c, j, colour, h], li) => {
    const crest = (s: number) => {
      const a = s * Math.PI * 2;
      const r = ridged(a * (5 + li) + li * 1.7);
      return c + j * (0.55 * Math.sin(a * 3 + li) + 0.45 * r) + 3 * Math.sin(a * 11 + li * 2);
    };
    scene.add(rangeBand(ellipse(rx, rz), [0, 0], 22, 26, crest, -18, colour, haze, h));
  });
  // Valley mist between the layers.
  for (const [rx, rz, y] of [
    [148, 116, 2],
    [184, 146, 6],
    [232, 184, 10],
  ] as [number, number, number][]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.12, 96),
      new THREE.MeshBasicMaterial({
        color: "#fbe6cf",
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(rx, rz, 1);
    ring.position.y = y;
    scene.add(ring);
  }
}

// ── Labels ──────────────────────────────────────────────────────────────────

const KANNADA_FONT = "'Noto Sans Kannada', 'Kannada Sangam MN', 'Kannada MN', 'Tunga', sans-serif";

/** A two-line sign: Kannada on top, English below. Sized to its text. */
function bilingual(kn: string, en: string, fg: string, bg: string, icon?: "camera"): THREE.Sprite {
  const probe = document.createElement("canvas").getContext("2d");
  const knFont = `700 60px ${KANNADA_FONT}`;
  const enFont = "800 44px Outfit, Arial, sans-serif";
  let w = 280;
  if (probe) {
    probe.font = knFont;
    w = Math.max(w, probe.measureText(kn).width + 90);
    probe.font = enFont;
    w = Math.max(w, probe.measureText(en).width + 90);
  }
  if (icon) w += 110;
  w = Math.ceil(w);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = 176;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, 164, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 4;
    ctx.stroke();
    const cx = icon ? (w + 110) / 2 : w / 2;
    if (icon === "camera") {
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.roundRect(36, 62, 84, 60, 12);
      ctx.fill();
      ctx.fillRect(58, 50, 36, 16);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(78, 92, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(78, 92, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = knFont;
    ctx.fillText(kn, cx, 62);
    ctx.font = enFont;
    ctx.fillText(en, cx, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set((w / 176) * 1.3, 1.3, 1);
  return sp;
}

/** A sign on a post at a world position. */
function signPost(kit: Kit, sprite: THREE.Sprite, h = 2.4): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#5a3b28", [0, 0, 0], [0, h, 0], 0.06));
  sprite.position.set(0, h + 0.7, 0);
  g.add(sprite);
  return g;
}

/** A chalkboard menu: library name, and the drink it's served as. */
function chalkMenu(name: string, drink: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 560;
  c.height = 200;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#24221f";
    ctx.beginPath();
    ctx.roundRect(8, 8, 544, 184, 26);
    ctx.fill();
    ctx.strokeStyle = "#c9a46a";
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f3ead6";
    let size = 76;
    do {
      ctx.font = `700 ${size}px Outfit, Arial, sans-serif`;
      size -= 4;
    } while (ctx.measureText(name).width > 480 && size > 30);
    ctx.fillText(name, 280, 78);
    ctx.fillStyle = "#e8c48a";
    ctx.font = "italic 500 36px Outfit, Arial, sans-serif";
    ctx.fillText(drink, 280, 148);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(3.4, 1.21, 1);
  return sp;
}

// ── Props ───────────────────────────────────────────────────────────────────

/** Coffee bushes in wavy contour rows as one instanced mesh (cheap). */
function coffeeRows(
  kit: Kit,
  roads: Road[],
  height: HeightFn,
  keepOut: [number, number, number][],
): THREE.InstancedMesh {
  const spots: THREE.Vector3[] = [];
  // Open world: rows cover the whole tile on a grid that repeats exactly.
  const open = tiling();
  const rows = open ? 71 : 61;
  const cols = open ? 135 : 124;
  const dz = open ? TILE_D / rows : 1.8;
  const dx = open ? TILE_W / cols : 1.3;
  const kx = open ? (2 * Math.PI * 5) / TILE_W : 0.16;
  const kz = open ? (2 * Math.PI) / TILE_D : 0.05;
  for (let r = 0; r < rows; r++) {
    const z = open ? -TILE_D / 2 + r * dz : -54 + r * dz;
    for (let c = 0; c < cols; c++) {
      const x = open ? -TILE_W / 2 + c * dx : -80 + c * dx;
      const zz = z + Math.sin(x * kx + z * kz) * 0.9;
      const h = height(x, zz);
      if (h > 9.5 || h < -1.2) continue; // above the tree line / in the river
      if (polyDist(smoothRiver, x, zz) < 10 || polyDist(smoothStream, x, zz) < 3.4) continue;
      if (!open && (Math.abs(x) > 74 || Math.abs(zz) > 50)) continue;
      if (keepOut.some(([cx, cz, r]) => (x - cx) ** 2 + (zz - cz) ** 2 < r * r)) continue;
      if (roads.some((r) => r.samples.some((s) => (s.x - x) ** 2 + (s.z - zz) ** 2 < 10))) continue;
      spots.push(new THREE.Vector3(x, h, zz));
    }
  }
  const geo = new THREE.SphereGeometry(0.55, 12, 8);
  const mesh = new THREE.InstancedMesh(geo, kit.mat("#ffffff"), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  spots.forEach((p, i) => {
    const s = 0.85 + ((i * 37) % 10) / 30;
    m.compose(
      new THREE.Vector3(p.x, p.y + 0.42 * s, p.z),
      q,
      new THREE.Vector3(s * 1.1, s * 0.85, s),
    );
    mesh.setMatrixAt(i, m);
    // Slight per-bush variation keeps the rows lively, not flat.
    c.set(i % 7 === 0 ? "#2fa957" : i % 5 === 0 ? "#1f8a48" : "#26994f");
    mesh.setColorAt(i, c);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.coffee = true;
  return mesh;
}

/** Tall silver oak with a pepper vine climbing the trunk. */
function silverOak(kit: Kit, h = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#8a7a68", [0, 0, 0], [0, 5.2 * h, 0], 0.13));
  for (let i = 0; i < 6; i++)
    g.add(
      sphere(
        kit,
        "#2f6a2a",
        [Math.cos(i * 2.1) * 0.15, 0.8 + i * 0.6, Math.sin(i * 2.1) * 0.15],
        0.14,
      ),
    );
  g.add(sphere(kit, "#5fae6a", [0, 5.6 * h, 0], 1.2 * h, undefined, [0.75, 1.4, 0.75]));
  g.add(sphere(kit, "#7cc27f", [0.2, 6.6 * h, 0.1], 0.7 * h, undefined, [0.7, 1.2, 0.7]));
  return g;
}

function bungalow(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#9a8f80", [-3.2, -1.4, -2.2], [3.2, 0.06, 3.6]));
  g.add(box(kit, "#d9cbb2", [-3, 0, -2], [3, 2.4, 2]));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 4.6, 1.6, 4), kit.mat("#b4503a"));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.72);
  roof.position.y = 3.2;
  roof.castShadow = true;
  g.add(roof);
  g.add(box(kit, "#e8dccb", [-3, 0, 2], [3, 0.25, 3.4]));
  for (const x of [-2.7, -0.9, 0.9, 2.7])
    g.add(tube(kit, "#f5f0e6", [x, 0.25, 3.2], [x, 2.3, 3.2], 0.1));
  g.add(box(kit, "#b4503a", [-3.3, 2.3, 1.8], [3.3, 2.45, 3.6]));
  for (const x of [-2, 2])
    g.add(box(kit, "#ffd88a", [x - 0.4, 0.8, 1.99], [x + 0.4, 1.7, 2.02], { emissive: true }));
  g.add(box(kit, "#5a3b28", [-0.4, 0.25, 1.99], [0.4, 1.9, 2.03]));
  return g;
}

/** A coffee picker in a saree with a cane basket. */
function picker(kit: Kit, saree: string): THREE.Group {
  const g = new THREE.Group();
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 14), kit.mat(saree));
  skirt.position.y = 0.45;
  skirt.castShadow = true;
  g.add(skirt);
  g.add(tube(kit, saree, [0, 0.85, 0], [0, 1.25, 0], 0.16));
  g.add(sphere(kit, "#8a5a3e", [0, 1.42, 0], 0.15));
  g.add(sphere(kit, "#1d1b1a", [0, 1.48, -0.05], 0.13, undefined, [1, 0.8, 1]));
  // Cane basket on the hip, half full of red cherries
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.18, 0.3, 12),
    kit.mat("#c9a46a"),
  );
  basket.position.set(0.32, 0.95, 0.05);
  basket.castShadow = true;
  g.add(basket);
  g.add(sphere(kit, "#b8322a", [0.32, 1.08, 0.05], 0.17, undefined, [1, 0.45, 1]));
  for (const s of [-1, 1])
    g.add(tube(kit, "#8a5a3e", [s * 0.16, 1.2, 0], [s * 0.3, 0.98, 0.15], 0.045));
  g.userData.dodge = "person";
  return g;
}

function dryingYard(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#b9ad98", [-5.1, -1.2, -3.1], [5.1, 0.12, 3.1]));
  g.add(box(kit, "#d8d0c2", [-5, 0, -3], [5, 0.15, 3]));
  const beans = ["#6b3e1e", "#7a4a26", "#5a341a", "#8a5a30"];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 2; j++)
      g.add(
        box(
          kit,
          beans[(i + j) % 4] ?? "#6b3e1e",
          [-4.4 + i * 2.3, 0.15, -2.4 + j * 2.6],
          [-2.6 + i * 2.3, 0.22, -0.4 + j * 2.6],
        ),
      );
  for (let i = 0; i < 3; i++)
    g.add(
      sphere(kit, "#c9a46a", [4.2, 0.35 + i * 0.25, 2.4 - i * 0.1], 0.35, undefined, [1, 0.7, 0.8]),
    );
  g.add(tube(kit, "#8a5a3a", [3.4, 0.15, 2.0], [4.0, 1.6, 2.2], 0.04));
  return g;
}

/** Pulping house: a shed with tanks and water channels, and steam wisps. */
function pulpingHouse(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#9a8f80", [-3.8, -1.4, -2.2], [3.8, 0.06, 5.4]));
  g.add(box(kit, "#c9b9a0", [-3, 0, -2], [3, 2.2, 2]));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 4.4, 1.2, 4), kit.mat("#7a3e2e"));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.75);
  roof.position.y = 2.8;
  roof.castShadow = true;
  g.add(roof);
  g.add(box(kit, "#3a3d44", [-0.8, 0, 1.99], [0.8, 1.6, 2.03]));
  // Fermentation tanks and the water channels feeding them
  for (const x of [-2.2, 0, 2.2]) {
    g.add(box(kit, "#bdb6aa", [x - 0.9, 0, 2.6], [x + 0.9, 0.7, 4.2]));
    g.add(box(kit, "#6fb2c4", [x - 0.75, 0.55, 2.75], [x + 0.75, 0.66, 4.05], { glass: true }));
  }
  g.add(box(kit, "#bdb6aa", [-3.6, 0, 4.6], [3.6, 0.35, 5.2]));
  g.add(box(kit, "#7cc0d0", [-3.5, 0.3, 4.72], [3.5, 0.38, 5.08], { glass: true }));
  // Steam from the chimney
  g.add(tube(kit, "#4b4f57", [2.2, 2.2, -1.2], [2.2, 4.2, -1.2], 0.18));
  for (let i = 0; i < 4; i++)
    g.add(
      sphere(kit, "#f5efe6", [2.2 + i * 0.25, 4.6 + i * 0.5, -1.2 - i * 0.15], 0.3 + i * 0.1, {
        glass: true,
      }),
    );
  return g;
}

function spiceStall(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#9a8f80", [-1.8, -1.0, -1.1], [1.8, 0.06, 1.1]));
  g.add(box(kit, "#9a6a3e", [-1.6, 0, -0.9], [1.6, 0.9, 0.9]));
  for (const x of [-1.5, 1.5])
    for (const z of [-0.8, 0.8]) g.add(tube(kit, "#6b4a32", [x, 0.9, z], [x, 2.3, z], 0.05));
  g.add(box(kit, "#2a6b4a", [-1.8, 2.3, -1.1], [1.8, 2.45, 1.1]));
  // Sacks: green cardamom, black pepper, red chilli, turmeric
  const goods = ["#7fae4a", "#2b2725", "#c0392b", "#e0a526"];
  goods.forEach((c, i) => {
    const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.5, 12), kit.mat("#d8c39a"));
    sack.position.set(-1.1 + i * 0.73, 1.15, 0.45);
    g.add(sack);
    g.add(sphere(kit, c, [-1.1 + i * 0.73, 1.42, 0.45], 0.27, undefined, [1, 0.45, 1]));
  });
  // Honey jars and Coorg oranges
  for (let i = 0; i < 4; i++)
    g.add(
      tube(kit, "#e0a526", [-1.2 + i * 0.3, 0.9, -0.55], [-1.2 + i * 0.3, 1.15, -0.55], 0.09, {
        glass: true,
      }),
    );
  for (let i = 0; i < 6; i++)
    g.add(
      sphere(kit, "#f28c28", [0.4 + (i % 3) * 0.24, 0.98 + Math.floor(i / 3) * 0.18, -0.5], 0.11),
    );
  return g;
}

/** A café counter stop: the library is served as a drink, chalk menu above. */
function cafeCounter(kit: Kit, name: string, drink: string, i: number): THREE.Group {
  const g = new THREE.Group();
  const trim = ["#b4503a", "#2a6b4a", "#c9893d", "#5a3b28"][i % 4] ?? "#b4503a";
  g.add(box(kit, "#9a8f80", [-1.5, -1.0, -1.1], [1.5, 0.06, 1.4]));
  g.add(box(kit, "#e9d8b8", [-1.3, 0, -0.9], [1.3, 1.1, 0.9]));
  g.add(box(kit, "#6b4a32", [-1.4, 1.1, -1.0], [1.4, 1.22, 1.15]));
  for (let k = 0; k < 6; k++)
    g.add(
      box(kit, k % 2 ? "#f5efe2" : trim, [-1.5 + k * 0.5, 2.15, -1.1], [-1.0 + k * 0.5, 2.28, 1.3]),
    );
  for (const x of [-1.3, 1.3]) g.add(tube(kit, "#5a3b28", [x, 1.22, 1.1], [x, 2.18, 1.1], 0.045));
  // The drink, served: a big cup with a saucer and steam.
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.36, 18), kit.mat("#fbf6ee"));
  cup.position.set(0.1, 1.42, 0.7);
  cup.castShadow = true;
  g.add(cup);
  g.add(disc(kit, "#fbf6ee", [0.1, 1.24, 0.7], 0.0, 0.0));
  const saucer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.04, 18),
    kit.mat("#f1e6d6"),
  );
  saucer.position.set(0.1, 1.24, 0.7);
  g.add(saucer);
  g.add(sphere(kit, "#6b3e1e", [0.1, 1.6, 0.7], 0.22, undefined, [1, 0.12, 1]));
  for (let k = 0; k < 3; k++)
    g.add(
      sphere(kit, "#ffffff", [0.1 + k * 0.08, 1.85 + k * 0.22, 0.7], 0.08 + k * 0.03, {
        glass: true,
      }),
    );
  g.add(tube(kit, "#9aa3ad", [-0.75, 1.22, 0.3], [-0.75, 1.68, 0.3], 0.16, { metal: true }));
  const menu = chalkMenu(name, drink);
  menu.position.set(0, 3.0, 0.2);
  g.add(menu);
  return g;
}

function roastery(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#9a8f80", [-5.0, -1.4, -2.8], [5.0, 0.06, 5.8]));
  g.add(box(kit, "#8a4a2e", [-4, 0, -2.6], [4, 3.2, 2.6]));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 5.8, 1.8, 4), kit.mat("#5a2e1e"));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.68);
  roof.position.y = 4.1;
  roof.castShadow = true;
  g.add(roof);
  g.add(tube(kit, "#4b4f57", [2.6, 3, -1.2], [2.6, 6.2, -1.2], 0.25));
  for (let i = 0; i < 4; i++)
    g.add(
      sphere(kit, "#efe7dc", [2.6 + i * 0.35, 6.6 + i * 0.6, -1.2 - i * 0.2], 0.35 + i * 0.12, {
        glass: true,
      }),
    );
  for (const x of [-2.6, -0.9, 0.9, 2.6])
    g.add(box(kit, "#ffd88a", [x - 0.5, 0.9, 2.59], [x + 0.5, 2.2, 2.62], { emissive: true }));
  for (const x of [-3, 0, 3]) {
    g.add(tube(kit, "#3a3d44", [x, 0, 4.3], [x, 0.7, 4.3], 0.04));
    g.add(disc(kit, "#e9d8b8", [x, 0.72, 4.3], 0.45, 0.05));
    g.add(sphere(kit, "#f5f0e6", [x + 0.15, 0.82, 4.3], 0.08));
  }
  for (let i = 0; i <= 12; i++) {
    const x = -4.5 + i * 0.75;
    g.add(
      sphere(kit, "#ffcf73", [x, 2.8 - Math.sin((i / 12) * Math.PI) * 0.6, 5.4], 0.08, {
        emissive: true,
      }),
    );
  }
  for (const x of [-4.6, 4.6]) g.add(tube(kit, "#5a3b28", [x, 0, 5.4], [x, 2.9, 5.4], 0.05));
  const sign = bilingual("ಕಾಫಿ", "ROASTERY", "#f3ead6", "#3a2016");
  sign.position.set(0, 4.6, 2.8);
  g.add(sign);
  return g;
}

/** Abbey Falls: a granite cliff, a white cascade, a mist cloud and a rainbow. */
function abbeyFalls(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  for (const [x, w, h] of [
    [-3.4, 2.4, 4.6],
    [3.4, 2.4, 4.2],
    [0, 6.2, 3.2],
  ] as [number, number, number][]) {
    g.add(sphere(kit, "#8f8a80", [x, h / 2, -1.2], 1, undefined, [w / 1.6, h / 1.7, 1.5]));
  }
  g.add(box(kit, "#9c968b", [-2.4, 0, -2.2], [2.4, 3.4, -0.8]));
  // Three cascade strands
  for (const x of [-1.0, 0, 1.0]) {
    const fall = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 3.4),
      kit.mat("#e4f6fb", { glass: true }),
    );
    fall.position.set(x, 1.7, -0.7);
    g.add(fall);
  }
  // Plunge pool foam and mist
  for (let i = 0; i < 9; i++)
    g.add(
      sphere(kit, "#f4fcff", [-1.4 + i * 0.35, 0.2, -0.3 + (i % 2) * 0.3], 0.3, { glass: true }),
    );
  for (let i = 0; i < 5; i++)
    g.add(sphere(kit, "#ffffff", [-1.2 + i * 0.6, 1.0 + (i % 2) * 0.4, 0.6], 0.7, { glass: true }));
  // The rainbow in the spray
  const colours = ["#ff595e", "#ff924c", "#ffca3a", "#8ac926", "#52a675", "#1982c4", "#6a4c93"];
  colours.forEach((c, i) => {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(3.2 - i * 0.12, 0.06, 6, 48, Math.PI),
      new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    arc.position.set(0, 0.6, 1.2);
    g.add(arc);
  });
  return g;
}

/** An Asian elephant (smooth toy style). */
function elephant(kit: Kit, s = 1): THREE.Group {
  const g = new THREE.Group();
  const skin = "#7d8590";
  g.add(sphere(kit, skin, [0, 1.5, 0], 1, undefined, [1.35, 1.0, 0.95]));
  g.add(sphere(kit, skin, [1.35, 1.9, 0], 0.62));
  for (const z of [-0.45, 0.45])
    g.add(sphere(kit, "#a49d97", [1.1, 1.95, z], 0.45, undefined, [0.3, 1, 0.9]));
  // Trunk curling down, then up (spraying)
  g.add(tube(kit, skin, [1.85, 1.75, 0], [2.25, 1.1, 0], 0.17));
  g.add(tube(kit, skin, [2.25, 1.1, 0], [2.6, 1.35, 0], 0.13));
  for (const [x, z] of [
    [-0.75, -0.5],
    [-0.75, 0.5],
    [0.75, -0.5],
    [0.75, 0.5],
  ] as V2[])
    g.add(tube(kit, skin, [x, 0, z], [x, 1.1, z], 0.28));
  g.add(tube(kit, skin, [-1.3, 1.6, 0], [-1.6, 0.9, 0], 0.05));
  for (const z of [-0.22, 0.22]) g.add(sphere(kit, "#1d1b1a", [1.8, 2.05, z], 0.06));
  g.scale.setScalar(s);
  g.userData.elephant = true;
  return g;
}

/** A mahout scrubbing an elephant, with a little water arc. */
function mahout(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#f5efe6", [0, 0, 0], [0, 0.7, 0], 0.13));
  g.add(tube(kit, "#4a6fa5", [0, 0.7, 0], [0, 1.2, 0], 0.16));
  g.add(sphere(kit, "#7a4a32", [0, 1.38, 0], 0.15));
  g.add(sphere(kit, "#f5efe6", [0, 1.48, 0], 0.13, undefined, [1.1, 0.5, 1.1]));
  g.add(tube(kit, "#7a4a32", [0, 1.1, 0], [0.45, 1.25, 0], 0.045));
  return g;
}

function coracle(kit: Kit, rower = true): THREE.Group {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    kit.mat("#6b4a2e"),
  );
  bowl.scale.set(1, 0.45, 1);
  bowl.position.y = 0.4;
  bowl.castShadow = true;
  g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.05, 6, 32), kit.mat("#8a6a45"));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.4;
  g.add(rim);
  if (rower) {
    g.add(tube(kit, "#c0392b", [0, 0.4, 0], [0, 1.0, 0], 0.15));
    g.add(sphere(kit, "#7a4a32", [0, 1.18, 0], 0.14));
    g.add(tube(kit, "#c9a46a", [0.4, 1.3, 0], [0.9, 0.1, 0.2], 0.03));
  }
  return g;
}

function jeep(kit: Kit, colour: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, colour, [-1.2, 0.4, -0.6], [1.2, 1.0, 0.6]));
  g.add(box(kit, colour, [-1.2, 1.0, -0.6], [0.3, 1.45, 0.6]));
  g.add(box(kit, "#bcd6ee", [0.25, 1.0, -0.55], [0.35, 1.4, 0.55], { glass: true }));
  for (const x of [-0.8, 0.8])
    for (const z of [-0.6, 0.6]) g.add(disc(kit, "#1c1d21", [x, 0.33, z], 0.32, 0.2));
  g.add(disc(kit, "#2c2f35", [-1.25, 0.8, 0], 0.3, 0.16));
  return g;
}

/** A soft cloud puff for the cloud sea. */
function cloudPuff(kit: Kit, r: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    color: "#ffffff",
    emissive: "#fff1e2",
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.8,
  });
  void kit;
  for (const [dx, dy, dz, s] of [
    [0, 0, 0, 1],
    [r * 0.7, -0.1, 0.2 * r, 0.75],
    [-r * 0.65, -0.15, -0.1 * r, 0.7],
    [0.2 * r, 0.25 * r, -0.4 * r, 0.6],
  ] as [number, number, number, number][]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r * s, 18, 10), mat);
    m.scale.y = 0.42;
    m.position.set(dx, dy, dz);
    g.add(m);
  }
  return g;
}

function birds(kit: Kit, n: number, cx: number, cy: number, cz: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group();
    for (const s of [-1, 1]) {
      const wing = box(kit, "#2b2b30", [0, -0.02, 0], [0.38, 0.02, 0.1]);
      wing.rotation.y = s * 2.4;
      wing.rotation.z = 0.35;
      b.add(wing);
    }
    b.position.set(
      cx + Math.cos(i * 1.7) * (2 + i * 0.6),
      cy + Math.sin(i * 2.3) * 0.8,
      cz + Math.sin(i * 1.7) * (1.2 + i * 0.4),
    );
    g.add(b);
  }
  g.userData.birds = true;
  return g;
}

function butterflies(kit: Kit, n: number, cx: number, cy: number, cz: number): THREE.Group {
  const g = new THREE.Group();
  const colours = ["#ffb703", "#fb8500", "#8ecae6", "#f28482"];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group();
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(
        new THREE.CircleGeometry(0.13, 10),
        kit.mat(colours[i % colours.length] ?? "#ffb703"),
      );
      (w.material as THREE.Material).side = THREE.DoubleSide;
      w.position.set(0, 0, s * 0.1);
      w.rotation.x = s * 0.6;
      b.add(w);
    }
    b.position.set(cx + Math.cos(i * 2.4) * 1.6, cy + (i % 3) * 0.35, cz + Math.sin(i * 2.4) * 1.6);
    g.add(b);
  }
  return g;
}

/** A thin monsoon drizzle: translucent streaks over an area. */
function drizzle(cx: number, cz: number, r: number, top: number): THREE.LineSegments {
  const pos: number[] = [];
  for (let i = 0; i < 260; i++) {
    const a = i * 2.39996;
    const d = Math.sqrt(i / 260) * r;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    const y = top - ((i * 7) % 9);
    pos.push(x, y, z, x - 0.08, y - 1.1, z + 0.05);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(
    g,
    new THREE.LineBasicMaterial({ color: "#dbe7f0", transparent: true, opacity: 0.45 }),
  );
}

/** A soft round mist puff lying flat over a valley. */
function mist(w: number, d: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,248,238,0.55)");
    gr.addColorStop(0.6, "rgba(255,248,238,0.25)");
    gr.addColorStop(1, "rgba(255,248,238,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 128, 128);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** A water ribbon following a polyline at a fixed or terrain-following height. */
function waterRibbon(
  pts: V2[],
  width: number,
  y: (x: number, z: number) => number,
  colour: string,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
  );
  const N = 240;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N);
    const tan = curve.getTangentAt(i / N);
    const nx = -tan.z;
    const nz = tan.x;
    const yy = y(p.x, p.z);
    pos.push(
      p.x + (nx * width) / 2,
      yy,
      p.z + (nz * width) / 2,
      p.x - (nx * width) / 2,
      yy,
      p.z - (nz * width) / 2,
    );
    if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({
      color: colour,
      roughness: 0.2,
      metalness: 0.15,
      side: THREE.DoubleSide,
    }),
  );
  m.receiveShadow = true;
  return m;
}

/**
 * A Kodava-style estate arch: whitewashed pillars on granite plinths, a dark
 * timber beam and a steep two-slope tiled roof, a brass lamp at each pillar.
 */
function kodavaArch(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const span = 3.4;
  for (const z of [-span, span]) {
    g.add(box(kit, "#8f8a80", [-0.7, 0, z - 0.7], [0.7, 0.5, z + 0.7]));
    g.add(box(kit, "#f2ece0", [-0.5, 0.5, z - 0.5], [0.5, 3.4, z + 0.5]));
    g.add(box(kit, "#5a3b28", [-0.6, 3.4, z - 0.6], [0.6, 3.7, z + 0.6]));
    g.add(tube(kit, "#c9a227", [0.55, 2.2, z], [0.85, 2.2, z], 0.03, { metal: true }));
    g.add(sphere(kit, "#ffcf73", [0.9, 2.25, z], 0.1, { emissive: true }));
  }
  g.add(box(kit, "#4a2f1f", [-0.7, 3.7, -span - 0.8], [0.7, 4.1, span + 0.8]));
  // Steep gable roof: two tiled slopes meeting at a ridge.
  for (const s of [-1, 1]) {
    const slope = box(kit, "#b4503a", [-1.6, -0.08, -span - 1.2], [1.6, 0.08, span + 1.2]);
    slope.position.set(s * 0.95, 4.75, 0);
    slope.rotation.z = s * -0.62;
    g.add(slope);
  }
  g.add(box(kit, "#7a3e2e", [-0.12, 5.55, -span - 1.2], [0.12, 5.7, span + 1.2]));
  const sign = bilingual("ಸ್ವಾಗತ", "WELCOME · COORG ESTATE", "#f3ead6", "#4a2f1f");
  sign.position.set(0.9, 3.0, 0);
  g.add(sign);
  return g;
}

// ── Lived-in estate life ────────────────────────────────────────────────────

/** A small child: shorts or a frock, a round head. */
function child(kit: Kit, colour: string): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#6b4a32", [-0.06, 0, 0], [-0.06, 0.35, 0], 0.045));
  g.add(tube(kit, "#6b4a32", [0.06, 0, 0], [0.06, 0.35, 0], 0.045));
  g.add(tube(kit, colour, [0, 0.33, 0], [0, 0.7, 0], 0.13));
  g.add(sphere(kit, "#8a5a3e", [0, 0.84, 0], 0.13));
  g.add(sphere(kit, "#1d1b1a", [0, 0.9, -0.03], 0.12, undefined, [1, 0.75, 1]));
  return g;
}

/** Estate line houses: a whitewashed row under a corrugated tin roof, a washing line, kids. */
function lineHouses(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#9a8f80", [-6.2, -1.2, -1.8], [6.2, 0.06, 3.2]));
  g.add(box(kit, "#efe6d6", [-6, 0, -1.6], [6, 2.0, 1.6]));
  g.add(box(kit, "#5f8fa8", [-6, 1.75, -1.62], [6, 2.0, 1.62]));
  // Tin roof: a shallow single pitch with ribs.
  const roof = box(kit, "#9fa8ae", [-6.4, -0.05, -2.1], [6.4, 0.05, 2.3], { metal: true });
  roof.position.y = 2.25;
  roof.rotation.x = -0.12;
  g.add(roof);
  for (let i = 0; i < 16; i++) {
    const rib = box(kit, "#b8c0c6", [-6.3 + i * 0.84, 0.05, -2.1], [-6.2 + i * 0.84, 0.1, 2.3], {
      metal: true,
    });
    rib.position.y = 2.25;
    rib.rotation.x = -0.12;
    g.add(rib);
  }
  const doors = ["#2a6b4a", "#b4503a", "#2b5f8a", "#c9893d"];
  for (let i = 0; i < 4; i++) {
    const x = -4.5 + i * 3;
    g.add(box(kit, doors[i] ?? "#2a6b4a", [x - 0.4, 0, 1.59], [x + 0.4, 1.5, 1.64]));
    g.add(box(kit, "#5f8fa8", [x + 0.7, 0.8, 1.59], [x + 1.2, 1.3, 1.64]));
    g.add(box(kit, "#d8cdb8", [x - 0.7, 0, 1.6], [x + 0.7, 0.12, 2.4]));
  }
  // Washing line with saris and shirts drying.
  for (const x of [-5.5, 5.5]) g.add(tube(kit, "#6b4a32", [x, 0, 3.2], [x, 1.9, 3.2], 0.04));
  g.add(tube(kit, "#e9e4da", [-5.5, 1.85, 3.2], [5.5, 1.85, 3.2], 0.012));
  const clothes = ["#e63946", "#ffd166", "#06a77d", "#4f7cff", "#ff8fab", "#f28c28", "#9b5de5"];
  clothes.forEach((c, i) => {
    const x = -4.8 + i * 1.5;
    const long = i % 3 === 0;
    g.add(box(kit, c, [x - 0.35, long ? 0.6 : 1.15, 3.17], [x + 0.35, 1.84, 3.23]));
  });
  // Kids playing in the yard, a parked estate bike.
  const k1 = child(kit, "#e63946");
  k1.position.set(-2, 0, 4.4);
  const k2 = child(kit, "#4f7cff");
  k2.position.set(-1.2, 0, 4.9);
  k2.rotation.y = 2.4;
  const k3 = child(kit, "#ffd166");
  k3.position.set(2.6, 0, 4.6);
  g.add(k1, k2, k3);
  g.add(sphere(kit, "#ff6b6b", [-1.6, 0.13, 4.3], 0.13));
  const bike = estateBike(kit);
  bike.position.set(5.2, 0, 2.6);
  bike.rotation.y = 0.4;
  g.add(bike);
  return g;
}

/** An old estate motorbike, parked on its stand. */
function estateBike(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.55, 0.55]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 20), kit.mat("#1c1d21"));
    w.position.set(x, 0.32, 0);
    g.add(w);
  }
  g.add(tube(kit, "#2b2d33", [-0.55, 0.32, 0], [0.1, 0.65, 0], 0.05));
  g.add(tube(kit, "#2b2d33", [0.55, 0.32, 0], [0.4, 0.95, 0], 0.04));
  g.add(sphere(kit, "#1f4e79", [0.05, 0.72, 0], 0.22, undefined, [1.4, 0.7, 0.8]));
  g.add(box(kit, "#3a2a1e", [-0.6, 0.72, -0.12], [-0.1, 0.8, 0.12]));
  g.add(tube(kit, "#9aa3ad", [0.4, 0.98, -0.3], [0.4, 0.98, 0.3], 0.025, { metal: true }));
  return g;
}

/** A tiny shrine under a peepal tree on a round stone katte (platform). */
function peepalShrine(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const katte = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.2, 1.6, 40), kit.mat("#b9ad98"));
  katte.position.y = -0.2;
  katte.castShadow = true;
  katte.receiveShadow = true;
  g.add(katte);
  // Gnarled trunk with aerial roots and a broad crown.
  g.add(tube(kit, "#7a6a58", [0, 0.6, 0], [0.2, 4.0, 0.1], 0.45));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    g.add(tube(kit, "#7a6a58", [0.1, 3.2, 0], [Math.cos(a) * 2.2, 4.6, Math.sin(a) * 2.2], 0.18));
  }
  for (const [x, y, z, r] of [
    [0, 5.4, 0, 2.6],
    [1.8, 5.0, 0.8, 1.8],
    [-1.7, 5.1, -0.6, 1.9],
    [0.4, 6.2, -1.2, 1.6],
  ] as [number, number, number, number][])
    g.add(sphere(kit, "#3f8f4a", [x, y, z], r, undefined, [1.1, 0.75, 1.1]));
  // Sacred threads around the trunk.
  for (let i = 0; i < 3; i++) {
    const thread = new THREE.Mesh(
      new THREE.TorusGeometry(0.47, 0.03, 6, 24),
      kit.mat(i === 1 ? "#ffd166" : "#e63946"),
    );
    thread.rotation.x = Math.PI / 2;
    thread.position.set(0.05, 1.4 + i * 0.15, 0.02);
    g.add(thread);
  }
  // The shrine: a whitewashed niche with a tiered top, a lamp and a red flag.
  const s = new THREE.Group();
  s.add(box(kit, "#f5efe6", [-0.6, 0, -0.5], [0.6, 1.0, 0.5]));
  s.add(box(kit, "#b4503a", [-0.3, 0.2, 0.49], [0.3, 0.8, 0.52]));
  for (let i = 0; i < 3; i++)
    s.add(
      box(
        kit,
        "#f5efe6",
        [-0.5 + i * 0.12, 1.0 + i * 0.22, -0.4 + i * 0.1],
        [0.5 - i * 0.12, 1.22 + i * 0.22, 0.4 - i * 0.1],
      ),
    );
  s.add(sphere(kit, "#ffd166", [0, 1.8, 0], 0.1));
  s.add(sphere(kit, "#ffb347", [0, 0.25, 0.7], 0.06, { emissive: true }));
  s.add(tube(kit, "#6b4a32", [0.5, 1.0, -0.3], [0.5, 2.6, -0.3], 0.025));
  s.add(box(kit, "#e63946", [0.5, 2.15, -0.31], [1.05, 2.55, -0.29]));
  s.position.set(0, 0.6, 1.8);
  g.add(s);
  return g;
}

/** A gaur (Indian bison): dark body, shoulder hump, pale "socks", curved horns. */
function gaur(kit: Kit, s = 1): THREE.Group {
  const g = new THREE.Group();
  const skin = "#2e2420";
  g.add(sphere(kit, skin, [0, 1.25 * s, 0], 1.0 * s, undefined, [1.35, 0.72, 0.62]));
  g.add(sphere(kit, skin, [0.55 * s, 1.65 * s, 0], 0.7 * s, undefined, [0.9, 0.85, 0.65]));
  g.add(sphere(kit, skin, [1.45 * s, 1.15 * s, 0], 0.38 * s, undefined, [1.2, 0.9, 0.8]));
  g.add(sphere(kit, "#c9b48a", [1.62 * s, 1.35 * s, 0], 0.2 * s, undefined, [1, 0.6, 1.4]));
  for (const z of [-1, 1]) {
    g.add(
      tube(
        kit,
        "#d8cdb8",
        [1.5 * s, 1.42 * s, z * 0.2 * s],
        [1.55 * s, 1.75 * s, z * 0.45 * s],
        0.05 * s,
      ),
    );
    for (const x of [-0.8, 0.75]) {
      g.add(
        tube(kit, skin, [x * s, 1.0 * s, z * 0.32 * s], [x * s, 0.45 * s, z * 0.32 * s], 0.13 * s),
      );
      g.add(
        tube(kit, "#e9e1cf", [x * s, 0.45 * s, z * 0.32 * s], [x * s, 0, z * 0.32 * s], 0.11 * s),
      );
    }
  }
  g.userData.dodge = "herd";
  return g;
}

/** A wild boar rooting by the roadside. */
function boar(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(sphere(kit, "#4a3a30", [0, 0.55, 0], 0.55, undefined, [1.3, 0.75, 0.7]));
  g.add(sphere(kit, "#3a2e26", [0.6, 0.62, 0], 0.32, undefined, [1, 1, 0.9]));
  g.add(sphere(kit, "#5a463a", [0.88, 0.45, 0], 0.16, undefined, [1.2, 0.8, 1]));
  for (const z of [-0.1, 0.1])
    g.add(tube(kit, "#efe6d6", [0.9, 0.42, z], [0.98, 0.58, z * 1.6], 0.025));
  for (const x of [-0.4, 0.35])
    for (const z of [-0.18, 0.18]) g.add(tube(kit, "#2e2420", [x, 0.4, z], [x, 0, z], 0.06));
  for (let i = 0; i < 5; i++)
    g.add(box(kit, "#2e2420", [-0.3 + i * 0.15, 0.9, -0.03], [-0.2 + i * 0.15, 1.02, 0.03]));
  g.userData.dodge = "animal";
  return g;
}

/** A village bus-stop shelter: concrete roof, a bench, a bilingual board, people waiting. */
function busStop(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#9a8f80", [-2.2, -1.0, -1.1], [2.2, 0.12, 1.1]));
  g.add(box(kit, "#e9e4da", [-2.1, 0, -1.0], [2.1, 2.2, -0.8]));
  for (const x of [-2.0, 2.0]) g.add(box(kit, "#e9e4da", [x - 0.1, 0, -1.0], [x + 0.1, 2.2, 0.9]));
  g.add(box(kit, "#2a6b4a", [-2.4, 2.2, -1.2], [2.4, 2.45, 1.2]));
  g.add(box(kit, "#c9b9a0", [-1.6, 0.45, -0.75], [1.6, 0.55, -0.35]));
  const sign = bilingual("ಬಸ್ ನಿಲ್ದಾಣ", "BUS STOP", "#ffffff", "#2a6b4a");
  sign.position.set(0, 3.1, 0);
  sign.scale.multiplyScalar(0.7);
  g.add(sign);
  const p1 = picker(kit, "#2980b9");
  p1.position.set(-0.8, 0, -0.1);
  g.add(p1);
  const p2 = child(kit, "#ffd166");
  p2.position.set(0.0, 0, 0.2);
  g.add(p2);
  return g;
}

function tNear(r: Road, x: number, z: number): number {
  let best = 0;
  let bd = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= 600; i++) {
    const p = r.at(i / 600).p;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = i / 600;
    }
  }
  return best;
}

/** Faces an object's front (+z) towards a point. */

export const expresso: JourneyDef = {
  id: "expresso",
  title: "Expresso · Coorg coffee estate (open world, golden hour)",
  mood: "golden",
  bike: "cafe",
  *build(scene, kit) {
    const W = 3.0;
    yield;
    // Network: the figure-eight estate road, a pickers' lane through the
    // coffee, and a dead-end spur down to the coracle landing. Roads' xz are
    // fixed by their control points, so placements are planned on the base
    // roads first; then the ground is levelled under every building (pads)
    // and the roads are carved in.
    const loop0 = makeRoad(LOOP, base, true);
    const crossFrom = tNear(loop0, -62, -2);
    const crossTo = tNear(loop0, -8, -26);
    const viaCross: V2[] = [
      [-50, -10],
      [-38, -16],
      [-28, -12],
      [-16, -18],
    ];
    const cross0 = makeRoad(branchPoints(loop0, crossFrom, crossTo, viaCross), base);
    const spurFrom = tNear(loop0, 46, -30);
    const spurPts = (r: Road): V2[] => {
      const a = r.at(spurFrom);
      const b = r.at(spurFrom + 0.008);
      return [
        [a.p.x, a.p.z],
        [b.p.x, b.p.z],
        [52, -36],
        [58, -38],
        [61, -35],
      ];
    };
    const spur0 = makeRoad(spurPts(loop0), base);

    yield;
    // Planned placements (xz only).
    const summitT = tNear(loop0, 0, 31);
    const roastT = tNear(loop0, 44, 40);
    const campT = tNear(loop0, 62, -6);
    const spawnT = tNear(loop0, CENTRE[0], CENTRE[1]);
    const rp = beside(loop0, roastT, W / 2 + 7.6, "outside");
    const spn0 = loop0.at(spawnT).p;
    const jeepsAt: V2[] = [summitT + 0.014, summitT + 0.022].map((t) => {
      const b = beside(loop0, t, W / 2 + 4.2, "outside");
      return [b.x, b.z] as V2;
    });
    const spicesAt: [number, number, number][] = [
      [spn0.x - 7.5, spn0.z + 4.5, 0.4],
      [spn0.x + 7.5, spn0.z - 5.5, -2.6],
    ];
    const pick = (r: Road, n: number, min: number, avoid: number[] = []) =>
      r
        .corners(0.02)
        .filter(
          (t, i, all) =>
            t > 0.04 &&
            t < 0.96 &&
            all.slice(0, i).every((o) => Math.abs(o - t) > min) &&
            avoid.every((a) => Math.abs(a - t) > 0.04),
        )
        .slice(0, n)
        .sort((a, b) => a - b);
    const loopStops = pick(loop0, 5, 0.1, [summitT, roastT, campT, spawnT]);
    const crossStops = pick(cross0, 2, 0.25);
    yield;
    // Back from the landing, on dry land (the spur ends at the water).
    const spurStops = [0.5];
    yield;
    // Every library gets a counter: if the loop has too few sharp corners, add
    // stops on the loop where they're furthest from everything else.
    const avoid = [summitT, roastT, campT, spawnT];
    const loopGap = (t: number, list: number[]) =>
      Math.min(
        ...list.map((o) => {
          const d = Math.abs(o - t) % 1;
          return Math.min(d, 1 - d);
        }),
      );
    while (loopStops.length + crossStops.length + spurStops.length < LIBRARIES.length) {
      let best = 0.5;
      let gap = -1;
      for (let t = 0.02; t < 0.98; t += 0.004) {
        if (avoid.some((a) => Math.abs(a - t) < 0.045)) continue;
        // The loop passes the arrival plaza twice: keep counters off it.
        const q = loop0.at(t).p;
        if (Math.hypot(q.x - CENTRE[0], q.z - CENTRE[1]) < 16) continue;
        const g = loopGap(t, [...loopStops, ...avoid]);
        if (g > gap) {
          gap = g;
          best = t;
        }
      }
      loopStops.push(best);
      loopStops.sort((x, y) => x - y);
    }
    const stopPlan: {
      r0: Road;
      t: number;
      branch: "road" | "cross" | "spur";
      x: number;
      z: number;
    }[] = [];
    for (const [r0, list, branch] of [
      [loop0, loopStops, "road"],
      [cross0, crossStops, "cross"],
      [spur0, spurStops, "spur"],
    ] as const) {
      for (const t of list) {
        // Outside the bend, unless that's in (or by) the water: then the dry side.
        const off = (branch === "road" ? W : W - 0.6) / 2 + 3.0;
        const wet = (q: { x: number; z: number }) =>
          Math.min(polyDist(smoothRiver, q.x, q.z) - 6.5, polyDist(smoothStream, q.x, q.z) - 3);
        const out = beside(r0, t, off, "outside");
        const inn = beside(r0, t, off, "inside");
        const p = wet(out) < 0 && wet(inn) > wet(out) ? inn : out;
        stopPlan.push({ r0, t, branch, x: p.x, z: p.z });
      }
    }
    yield;
    // Lived-in spots: line houses, the peepal shrine, the gaur clearing, the bus stop.
    const LINE: V2 = [-42, 29];
    const SHRINE: V2 = [-37, 16];
    const GAUR: V2 = [36, -18];
    const busT = spawnT + 0.05;
    const bus0 = beside(loop0, busT, W / 2 + 3.4, -1);
    const pads = [
      { x: LINE[0], z: LINE[1], r: 7.5 },
      { x: SHRINE[0], z: SHRINE[1], r: 4 },
      { x: bus0.x, z: bus0.z, r: 2.6 },
      { x: -68, z: 22, r: 5.5 },
      { x: -43, z: -21, r: 5.5 },
      { x: -34, z: -28, r: 5.5 },
      { x: rp.x, z: rp.z, r: 6.5 },
      ...jeepsAt.map(([x, z]) => ({ x, z, r: 2.2 })),
      ...spicesAt.map(([x, z]) => ({ x, z, r: 2.2 })),
      ...stopPlan.map((s) => ({ x: s.x, z: s.z, r: 2.0, blend: 2.2 })),
    ];
    const padded = flattenPads(base, pads);
    const carved = carve(
      carve(carve(padded, loop0, W + 0.4, 3.5), cross0, W, 3),
      spur0,
      W - 0.6,
      3,
    );
    yield;
    // Junctions (the figure-eight's crossing, where branches leave and join):
    // level the ground there so every road meets on one surface.
    const junctions = findJunctions([
      { road: loop0, closed: true },
      { road: cross0 },
      { road: spur0 },
    ]);
    const levelled = levelJunctions(carved, junctions, W + 1.5, 6);
    yield;
    // Open world: the ground tiles (east meets west, north meets south).
    const open = tiling();
    const height = open ? tileHeight(levelled, TILE_W, TILE_D, 18) : levelled;
    const nearJunction = (x: number, z: number) =>
      junctions.some(([jx, jz]) => (x - jx) ** 2 + (z - jz) ** 2 < (W * 1.15) ** 2);
    const road = makeRoad(LOOP, height, true);
    const cross = makeRoad(branchPoints(road, crossFrom, crossTo, viaCross), height);
    const spur = makeRoad(spurPts(road), height);
    const roads = [road, cross, spur];
    const branchRoad = { road, cross, spur };
    const upright = (o: THREE.Object3D, x: number, z: number, yaw: number, footprint = 1.2) => {
      placeOnGround(o, height, x, z, { mode: "upright", yaw, footprint });
      scene.add(o);
      return o;
    };
    const align = (o: THREE.Object3D, x: number, z: number, yaw: number) => {
      placeOnGround(o, height, x, z, { mode: "align", yaw });
      scene.add(o);
      return o;
    };
    /** Yaw so a +z-facing board faces riders arriving along the road at t. */
    const facingTraffic = (r: Road, t: number) => r.at(t).heading - Math.PI / 2;
    const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

    yield;
    // The distant ranges frame the diorama; in the open world the land itself is the horizon.
    if (!open) westernGhats(scene);
    const ground = yield* terrainSteps({
      w: TILE_W,
      d: TILE_D,
      height,
      ...(open ? { preTiled: true, density: 1.6 } : {}),
      mood: "golden",
      colour: (x, z, h, slope) => {
        if (polyDist(smoothRiver, x, z) < 5.6 && h < -2.2) return "#cdbb93";
        if (polyDist(smoothStream, x, z) < 2.8 && h < 1.2) return "#8fbf86";
        if (h > 12) return slope > 0.2 ? "#86b86a" : "#a3d98c";
        if (slope > 0.32) return "#7c8f5a";
        if (slope > 0.18) return "#58a85a";
        // Frequencies that fit the tile exactly, so the pattern repeats seamlessly.
        const n =
          Math.sin(x * ((2 * Math.PI * 14) / TILE_W)) * Math.cos(z * ((2 * Math.PI * 9) / TILE_D));
        return n > 0.55 ? "#62bf68" : "#70c972";
      },
    });
    scene.add(ground);
    yield;
    // Solid things for the rider to bounce off (playable world).
    const blockers: { x: number; z: number; r: number }[] = [];
    const block = (x: number, z: number, r: number) => blockers.push({ x, z, r });

    yield;
    // Water: the Kaveri and the stream.
    scene.add(waterRibbon(RIVER, 9, (x, z) => height(x, z) + 0.6, "#4f9fb5"));
    scene.add(
      waterRibbon(
        STREAM,
        2.4,
        (x, z) => {
          const onRoad = roads.some((r) =>
            r.samples.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < (W / 2 + 1.4) ** 2),
          );
          return height(x, z) + (onRoad ? -1.0 : 0.22);
        },
        "#6fb7c6",
      ),
    );

    yield;
    // Roads hug the levelled ground and are layered (shoulders under asphalt
    // under markings), so crossing roads merge cleanly; the centre line breaks
    // through crossings.
    for (const r of roads) {
      const w = r === road ? W : W - 0.6;
      scene.add(roadMesh(kit, r, w + 0.5, "#b0905e", 0.07, 1400, { height, layer: 0 }));
      scene.add(roadMesh(kit, r, w, "#4a4744", 0.1, 1400, { height, layer: 1 }));
      if (r === road)
        scene.add(
          roadMesh(kit, r, 0.08, "#efe2c4", 0.12, 1400, { height, layer: 2, skip: nearJunction }),
        );
    }

    yield;
    // Stone bridges wherever a road crosses the stream.
    for (const r of roads) {
      let prev = 0;
      for (let i = 0; i <= 1200; i++) {
        const t = i / 1200;
        const p = r.at(t).p;
        const d = polyDist(smoothStream, p.x, p.z) < 1.2 ? 1 : 0;
        if (d === 1 && prev === 0) {
          const br = r.at(Math.min(1, t + 0.004));
          const bridge = new THREE.Group();
          const w = r === road ? W : W - 0.6;
          for (const side of [-1, 1]) {
            bridge.add(
              box(
                kit,
                "#b9ad98",
                [-3.4, -1.2, side * (w / 2 + 0.05)],
                [3.4, 0.6, side * (w / 2 + 0.35)],
              ),
            );
            for (let k = 0; k < 5; k++)
              bridge.add(
                box(
                  kit,
                  "#d8cdb8",
                  [-3 + k * 1.5, 0.6, side * (w / 2 + 0.05)],
                  [-2.6 + k * 1.5, 0.9, side * (w / 2 + 0.35)],
                ),
              );
          }
          bridge.position.set(br.p.x, br.p.y, br.p.z);
          bridge.rotation.y = br.heading;
          bridge.userData.spansRoad = true;
          scene.add(bridge);
        }
        prev = d;
      }
    }

    yield;
    // ── Hero landmarks on the loop ──────────────────────────────────────────
    // West: the estate bungalow on its levelled terrace, pickers in the rows.
    const bung = upright(bungalow(kit), -68, 22, Math.PI / 2, 3);
    block(-68, 22, 4.2);
    nightLight(
      scene,
      "golden",
      bung.position.x + 3,
      bung.position.y + 2,
      bung.position.z,
      "#ffd88a",
      8,
    );
    const sarees = ["#c0392b", "#e67e22", "#8e44ad", "#16a085", "#d35400", "#2980b9"];
    for (let i = 0; i < 6; i++) {
      const x = -50 + (i % 3) * 2.2;
      const z = 18 + Math.floor(i / 3) * 3.2;
      upright(picker(kit, sarees[i] ?? "#c0392b"), x, z, i * 0.9, 0.3);
    }

    yield;
    // North: Mandalpatti summit above a sea of clouds; jeeps; photo spot.
    const sp = road.at(summitT);
    const view = beside(road, summitT, W / 2 + 3.2, "outside");
    const photo = signPost(
      kit,
      bilingual("ವೀಕ್ಷಣಾ ಸ್ಥಳ", "VIEWPOINT", "#ffffff", "#2a6b4a", "camera"),
      2.2,
    );
    upright(photo, view.x, view.z, 0, 0.2);
    for (const [i, [x, z]] of jeepsAt.entries()) {
      align(jeep(kit, i ? "#e9e4da" : "#2f5d3a"), x, z, 0.7);
      block(x, z, 1.4);
    }
    yield;
    // The cloud sea: puffs in the low ground around the mountain, clear of roads.
    const cloudSum = new THREE.Vector3();
    let cloudN = 0;
    for (let i = 0; i < 110; i++) {
      const a = i * 2.39996;
      const d = 14 + Math.sqrt(i / 80) * 28;
      const x = -4 + Math.cos(a) * d;
      const z = 44 + Math.sin(a) * d * 0.7;
      if (Math.abs(x) > 74 || Math.abs(z) > 54 || x > 28) continue;
      if (pads.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + 7) ** 2)) continue;
      const h = height(x, z);
      if (h > 6.8 || i % 3 === 0) continue;
      if (roads.some((r) => r.samples.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 64))) continue;
      const puff = cloudPuff(kit, 2.2 + (i % 4) * 0.7);
      puff.userData.cloud = true;
      puff.position.set(x, 8.0 + (i % 3) * 0.4, z);
      scene.add(puff);
      cloudSum.add(puff.position);
      cloudN += 1;
    }
    const cloudC = cloudN ? cloudSum.divideScalar(cloudN) : new THREE.Vector3(0, 0, 0);
    const summitAz = THREE.MathUtils.radToDeg(Math.atan2(sp.p.x - cloudC.x, sp.p.z - cloudC.z));
    yield;
    // A passing monsoon drizzle over the summit (weather moment).
    scene.add(drizzle(-8, 46, 14, 26));

    yield;
    // North-east: the roastery café (a hero landmark, not a finish).
    const rq = road.at(roastT).p;
    const cafe = upright(roastery(kit), rp.x, rp.z, yawTo(rp.x, rp.z, rq.x, rq.z), 4);
    block(rp.x, rp.z, 4.4);
    nightLight(scene, "golden", rp.x, cafe.position.y + 2.5, rp.z, "#ffcf73", 14);

    yield;
    // East: Dubare-style elephant camp on the Kaveri; coracles on the river.
    const campP = road.at(campT).p;
    const campAz = THREE.MathUtils.radToDeg(Math.atan2(campP.x - 71, campP.z + 12));
    const campSign = signPost(kit, bilingual("ಆನೆ ಶಿಬಿರ", "ELEPHANT CAMP", "#ffffff", "#7a4a2e"));
    const cs = beside(road, campT + 0.025, W / 2 + 1.6, -1);
    upright(campSign, cs.x, cs.z, 0, 0.2);
    for (const [x, z, s, r] of [
      [71, -12, 1.4, 2.2],
      [68, -20, 1.2, 0.4],
      [74, -5, 0.75, 1.6],
    ] as [number, number, number, number][]) {
      const e = upright(elephant(kit, s), x, z, r, 0.3);
      e.position.y -= 0.2; // knee-deep in the shallows
      const mx = x - 1.6 * s;
      const mz = z + 1.2;
      upright(mahout(kit), mx, mz, r + 0.6, 0.2);
      for (let k = 0; k < 6; k++)
        scene.add(
          sphere(
            kit,
            "#eaf8ff",
            [
              x + Math.cos(r) * 2.6 * s + k * 0.12,
              height(x, z) + 2.4 * s + Math.sin((k / 5) * Math.PI) * 1.2,
              z - Math.sin(r) * 2.6 * s,
            ],
            0.12,
            { glass: true },
          ),
        );
    }
    for (const [x, z] of [
      [64, -32],
      [58, -42],
      [70, -24],
      [52, -50],
    ] as V2[]) {
      const c = coracle(kit);
      c.position.set(x, height(x, z) + 0.62, z);
      c.rotation.y = x * 0.3;
      scene.add(c);
    }
    yield;
    // Coracle landing at the end of the spur: a timber jetty on piles.
    const landing = new THREE.Group();
    landing.add(box(kit, "#8a6a45", [-1.8, -0.2, -1.2], [1.8, 0.1, 1.2]));
    for (const x of [-1.6, 1.6])
      for (const z of [-1, 1]) landing.add(tube(kit, "#5a3b28", [x, -2.5, z], [x, 0, z], 0.1));
    for (let k = 0; k < 3; k++) {
      const c = coracle(kit, false);
      c.position.set(-1.2 + k * 1.2, -0.5, 2.4);
      landing.add(c);
    }
    const sEnd = spur.at(1);
    landing.position.set(sEnd.p.x + 1.5, sEnd.p.y, sEnd.p.z - 1.5);
    landing.rotation.y = 0.6;
    yield;
    // The spur road runs onto the jetty: it's the end of the road, not in its way.
    landing.userData.spansRoad = true;
    scene.add(landing);

    yield;
    // South: Abbey Falls on the stream, butterflies in the spray.
    const falls = abbeyFalls(kit);
    falls.position.set(-22, height(-22, -17.6), -17.6);
    scene.add(falls);
    scene.add(butterflies(kit, 8, -18, height(-18, -12) + 1.4, -12));
    const fallsSign = signPost(kit, bilingual("ಅಬ್ಬಿ ಜಲಪಾತ", "ABBEY FALLS", "#ffffff", "#2a5f73"));
    const fallsT = tNear(road, -20, -44);
    const fs = beside(road, fallsT, W / 2 + 1.6, -1);
    upright(fallsSign, fs.x, fs.z, 0, 0.2);

    yield;
    // South-west: coffee life: pulping house, drying yard, pickers.
    upright(pulpingHouse(kit), -43, -21, 0.5, 3);
    block(-43, -21, 3.6);
    block(-22, -17.6, 2.6);
    upright(dryingYard(kit), -34, -28, 0.2, 4);
    for (let i = 0; i < 5; i++)
      upright(
        picker(kit, sarees[(i + 2) % 6] ?? "#8e44ad"),
        -37 + i * 1.6,
        -22.5 + (i % 2) * 1.2,
        -0.6 + i,
        0.3,
      );

    yield;
    // Centre: the arrival gateway, where first-time riders spawn. A
    // Kodava-style arch over the plaza where the figure-eight crosses itself,
    // with a spice bazaar, an NHAI guide board and a km stone.
    const spn = road.at(spawnT);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(6.5, 48), kit.mat("#cbbfa8"));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(spn.p.x, height(spn.p.x, spn.p.z) + 0.04, spn.p.z);
    plaza.receiveShadow = true;
    plaza.userData.spansRoad = true;
    scene.add(plaza);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.0, 2.5, 48),
      new THREE.MeshBasicMaterial({
        color: "#ffcf73",
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(spn.p.x, height(spn.p.x, spn.p.z) + 0.05, spn.p.z);
    ring.userData.spansRoad = true;
    scene.add(ring);
    const arch = kodavaArch(kit);
    const archAt = road.at(spawnT + 0.012);
    arch.position.set(archAt.p.x, archAt.p.y, archAt.p.z);
    arch.rotation.y = archAt.heading;
    arch.userData.spansRoad = true;
    scene.add(arch);
    for (const s of [-1, 1])
      block(
        archAt.p.x + Math.sin(archAt.heading) * 3.4 * s,
        archAt.p.z + Math.cos(archAt.heading) * 3.4 * s,
        0.75,
      );
    nightLight(scene, "golden", archAt.p.x, archAt.p.y + 3, archAt.p.z, "#ffcf73", 10);
    for (const [x, z, ry] of spicesAt) {
      upright(spiceStall(kit), x, z, ry, 1.6);
      block(x, z, 1.5);
    }

    yield;
    // NHAI guide boards (Kannada above English) at the plaza and the forks.
    const board = (
      r: Road,
      t: number,
      side: 1 | -1 | "inside" | "outside",
      lines: SignLine[],
      width = 3.4,
    ) => {
      const at = beside(r, t, W / 2 + 1.9, side);
      upright(nhaiSign(kit, lines, width), at.x, at.z, facingTraffic(r, t), 0.4);
    };
    const plazaBoard = (lines: SignLine[]) =>
      upright(nhaiSign(kit, lines, 4.2), spn0.x - 8, spn0.z + 1, -0.66, 0.4);
    plazaBoard([
      { local: "ಮಾಂಡಲಪಟ್ಟಿ", en: "Mandalpatti", arrow: "up-left", km: 4 },
      { local: "ಕಾಫಿ ರೋಸ್ಟರಿ", en: "Roastery Café", arrow: "right", km: 2 },
      { local: "ಆನೆ ಶಿಬಿರ · ಕಾವೇರಿ", en: "Elephant Camp · Kaveri", arrow: "right", km: 3 },
      { local: "ಅಬ್ಬಿ ಜಲಪಾತ", en: "Abbey Falls", arrow: "left", km: 3 },
    ]);
    board(road, crossFrom - 0.012, "inside", [
      { local: "ತೋಟದ ದಾರಿ", en: "Pickers' Lane", arrow: "up-left" },
      { local: "ಅಬ್ಬಿ ಜಲಪಾತ", en: "Abbey Falls", arrow: "up", km: 2 },
    ]);
    board(road, spurFrom - 0.012, "inside", [
      { local: "ತೆಪ್ಪ ನಿಲ್ದಾಣ", en: "Coracle Landing", arrow: "right" },
      { local: "ಆನೆ ಶಿಬಿರ", en: "Elephant Camp", arrow: "up", km: 1 },
    ]);
    board(
      road,
      summitT - 0.06,
      "outside",
      [{ local: "ಮಾಂಡಲಪಟ್ಟಿ ವೀಕ್ಷಣಾ ಸ್ಥಳ", en: "Mandalpatti Viewpoint", arrow: "up", km: 1 }],
      3.6,
    );
    yield;
    // Km stones: a state-highway stone by the arch, a district stone on the climb.
    for (const [t, place, km, cap] of [
      [spawnT + 0.03, "Madikeri", 12, "sh"],
      [summitT - 0.1, "Mandalpatti", 2, "district"],
      [campT - 0.04, "Kushalnagar", 8, "sh"],
    ] as [number, string, number, "sh" | "district"][]) {
      const at = beside(road, t, W / 2 + 0.9, -1);
      upright(kmStone(kit, place, km, cap), at.x, at.z, facingTraffic(road, t) + Math.PI / 2, 0.2);
    }

    yield;
    // ── Lived-in estate life ────────────────────────────────────────────────
    upright(lineHouses(kit), LINE[0], LINE[1], -0.5, 6);
    upright(peepalShrine(kit), SHRINE[0], SHRINE[1], 0.9, 2.5);
    block(LINE[0], LINE[1], 6.2);
    block(SHRINE[0], SHRINE[1], 2.4);
    block(bus0.x, bus0.z, 1.6);
    const bq = road.at(busT).p;
    upright(busStop(kit), bus0.x, bus0.z, yawTo(bus0.x, bus0.z, bq.x, bq.z), 2);
    yield;
    // An old Willys parked by the bus stop.
    const willys = beside(road, busT + 0.012, W / 2 + 2.4, -1);
    align(jeep(kit, "#556b3a"), willys.x, willys.z, road.at(busT).heading);
    block(willys.x, willys.z, 1.4);
    yield;
    // A gaur herd grazing in a forest clearing, birds in the canopy.
    for (const [dx, dz, s, r] of [
      [0, 0, 1.15, 0.4],
      [3.5, 2, 1, 1.2],
      [-3, 2.5, 0.95, -0.3],
      [1.5, -3.2, 0.7, 0.8],
      [-1.2, -2, 0.6, 2.2],
    ] as [number, number, number, number][]) {
      align(gaur(kit, s), GAUR[0] + dx, GAUR[1] + dz, r);
    }
    scene.add(birds(kit, 6, GAUR[0] + 2, height(GAUR[0], GAUR[1]) + 9, GAUR[1] - 4));
    yield;
    // A wild boar rooting at the roadside below the falls.
    const bo = beside(road, tNear(road, -20, -44) + 0.03, W / 2 + 2.0, 1);
    align(boar(kit), bo.x, bo.z, road.at(tNear(road, -20, -44) + 0.03).heading + 0.8);

    yield;
    // ── Stops: café counters spread over the network ─────────────────────────
    stopPlan.forEach((s, i) => {
      const [name, drink] = LIBRARIES[i] ?? ["lib", ""];
      const r = branchRoad[s.branch];
      const q = r.at(s.t).p;
      upright(cafeCounter(kit, name, drink, i), s.x, s.z, yawTo(s.x, s.z, q.x, q.z), 1.3);
      block(s.x, s.z, 1.7);
    });
    yield;
    // A Kannada "go slow" (with English) at the first switchback below the summit.
    const slow = signPost(kit, bilingual("ನಿಧಾನವಾಗಿ ಚಲಿಸಿ", "GO SLOW", "#1d1f24", "#ffd23f"));
    const sl = beside(road, summitT - 0.03, W / 2 + 1.2, "inside");
    upright(slow, sl.x, sl.z, 0, 0.2);

    yield;
    // Silver oaks scattered over the estate (shade trees), kept off roads/water/buildings.
    const clear = (x: number, z: number, r: number) =>
      !pads.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + r) ** 2);
    yield;
    // Open world: shade trees over the whole tile (they carry on across the edges).
    const oakW = open ? TILE_W : 148;
    const oakD = open ? TILE_D : 100;
    for (let i = 0; i < (open ? 130 : 90); i++) {
      const x = -oakW / 2 + ((i * 89) % oakW);
      const z = -oakD / 2 + ((i * 53) % oakD);
      if (roads.some((r) => r.samples.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 60))) continue;
      if (polyDist(smoothRiver, x, z) < 10 || polyDist(smoothStream, x, z) < 3.5) continue;
      if (height(x, z) > 11.5 || !clear(x, z, 3)) continue;
      if ((x - campP.x) ** 2 + (z - campP.z) ** 2 < 260) continue;
      if ((x - GAUR[0]) ** 2 + (z - GAUR[1]) ** 2 < 50) continue;
      const tree = silverOak(kit, 0.85 + (i % 4) * 0.12);
      tree.userData.tree = "silverOak";
      tree.position.set(x, height(x, z) - 0.1, z);
      scene.add(tree);
      block(x, z, 0.45);
    }
    const keepOut: [number, number, number][] = [
      ...pads.map((p) => [p.x, p.z, p.r + 1.5] as [number, number, number]),
      [-22, -17, 6],
      [spn.p.x, spn.p.z, 9],
      [campP.x + 2, campP.z - 2, 7],
      [GAUR[0], GAUR[1], 9],
    ];
    scene.add(coffeeRows(kit, roads, height, keepOut));

    yield;
    // Birds over the valleys, mist in the low ground.
    scene.add(birds(kit, 9, 10, 20, -10));
    scene.add(birds(kit, 7, -40, 22, 10));
    for (const [x, z, w, d] of [
      [-36, 12, 22, 14],
      [30, -20, 26, 14],
      [-6, -30, 22, 10],
    ] as [number, number, number, number][]) {
      for (let k = 0; k < 2; k++) {
        const m = mist(w * (1 - k * 0.3), d * (1 - k * 0.3));
        m.position.set(x + k * 2, height(x, z) + 1.2 + k * 0.6, z - k * 2);
        scene.add(m);
      }
    }

    const at = (b: "road" | "cross" | "spur") =>
      stopPlan.filter((s) => s.branch === b).map((s) => s.t);
    const mesh = ground.children[0] as THREE.Mesh;
    return {
      world: {
        ground: mesh,
        size: { w: 176, d: 128 },
        roads: [
          { road, width: W },
          { road: cross, width: W - 0.6 },
          { road: spur, width: W - 0.6 },
        ],
        water: [
          { pts: smoothRiver, width: 9 },
          { pts: smoothStream, width: 2.4 },
        ],
        blockers,
        junctions,
        landmarks: {
          roastery: { x: rp.x, z: rp.z, road: { x: rq.x, z: rq.z } },
          camp: { x: campP.x, z: campP.z },
          herd: { x: GAUR[0], z: GAUR[1] },
          pulping: { x: -43, z: -21 },
          drying: { x: -34, z: -28 },
          bungalow: { x: -68, z: 22 },
          lineHouses: { x: LINE[0], z: LINE[1] },
          bus: { x: bus0.x, z: bus0.z, road: { x: bq.x, z: bq.z } },
        },
        stops: stopPlan.map((s) => ({
          x: s.x,
          z: s.z,
          road: branchRoad[s.branch],
          t: s.t,
        })),
        spawn: { x: spn.p.x, z: spn.p.z, heading: spn.heading },
      },
      road,
      stops: at("road"),
      branches: [
        { road: cross, stops: at("cross"), label: "Pickers' lane through the coffee" },
        { road: spur, stops: at("spur"), label: "Coracle landing spur" },
      ],
      mapZoom: 140,
      moments: [
        {
          label:
            "Arrival gateway (spawn): Kodava-style arch over the crossing plaza, spice bazaar, NHAI guide board, km stone",
          t: spawnT,
          zoom: 22,
        },
        {
          label:
            "Mandalpatti (cinematic): the summit road above a sea of clouds, layered Western Ghats beyond, drizzle passing",
          t: summitT,
          zoom: 22,
          cinematic: { azimuth: summitAz - 35, elevation: 18, distance: 20, fov: 52 },
        },
        {
          label: "The roastery café on its terrace: a hero landmark on the loop (not a finish)",
          t: roastT,
          zoom: 22,
        },
        {
          label:
            "Dubare elephant camp (cinematic): mahouts bathing elephants in the Kaveri gorge, coracles",
          t: campT,
          zoom: 22,
          cinematic: { azimuth: campAz, elevation: 34, distance: 15, fov: 58 },
        },
        {
          label: "Abbey Falls: rainbow in the spray, the stone bridge, butterflies",
          t: tNear(road, -22, -17.6),
          zoom: 24,
        },
        {
          label:
            "Lived-in estate: line houses with tin roofs and a washing line, kids, the peepal-tree shrine",
          t: tNear(road, -36, 40),
          zoom: 26,
        },
        {
          label:
            "Estate bungalow & coffee life: pickers with cane baskets, pulping house, drying yard",
          t: tNear(road, -44, -32),
          zoom: 28,
        },
      ],
    };
  },
};
