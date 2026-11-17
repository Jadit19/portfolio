/**
 * 23 Before 23 · Murphy's secret world (v2): an open southern coastal region.
 *
 * No start or finish. A ring road follows the coast of a stylised peninsula:
 *  - East coast: Chennai's Marina Beach in the cyclone (lighthouse, kites,
 *    sundal carts, the "Delhi 1,800 km" stone), Mahabalipuram's shore temple
 *    and rathas, Puducherry's White Town and promenade.
 *  - The tip: Kanyakumari, land's end, the rock memorial offshore.
 *  - West coast: Varkala's red laterite cliffs with surfers and kayaks, the
 *    Jatayu sculpture on its hill, Chinese fishing nets and a houseboat on a
 *    backwater lagoon.
 *  - An inland road across the top closes the loop.
 * Branches: a cross-country road through the middle with the arrival gateway
 * (a roadside temple gate, the first-visit spawn); an off-road loop through
 * the Theri Kaadu red dunes; a spur over the Pamban sea bridge (a train
 * waiting beside you, lift span raised) to the Dhanushkodi ruins.
 */

import * as THREE from "three";
import {
  beside,
  branchPoints,
  cornerSign,
  flattenPads,
  foundation,
  type HeightFn,
  type JourneyBuild,
  type JourneyDef,
  kmStone,
  type Moment,
  makeRoad,
  nhaiSign,
  placeOnGround,
  type Road,
  roadMesh,
  type SignLine,
  terrain,
  type V2,
} from "../journey";
import { box, disc, type Kit, sphere, tube } from "../kit";
import { palm } from "../zones";

const g2 = (x: number, z: number, cx: number, cz: number, rx: number, rz = rx) =>
  Math.exp(-((x - cx) ** 2) / (2 * rx * rx) - (z - cz) ** 2 / (2 * rz * rz));
const ss = THREE.MathUtils.smoothstep;

const SEA = 0;
const BED = -3;

// ── Geography ─────────────────────────────────────────────────────────────

/** The coastline: the peninsula's tip is at the front (+z), coasts run back. */
const coastZ = (x: number) =>
  46 - 1.12 * Math.abs(x) + 1.6 * Math.sin(x * 0.17) + (x > 0 ? 0 : 1.2 * Math.cos(x * 0.11));
/** Positive inland, negative out to sea. */
const inland = (x: number, z: number) => coastZ(x) - z;

/** Pamban/Rameswaram island off the east coast, and the Dhanushkodi spit. */
const ISLAND: V2 = [68, 8];
const islandMask = (x: number, z: number) => {
  const body = 1 - ss(Math.hypot((x - ISLAND[0]) / 5.8, (z - ISLAND[1]) / 4.2), 0.75, 1.05);
  // the spit runs east-south-east to Arichal Munai
  const t = THREE.MathUtils.clamp((x - 72) / 12, 0, 1);
  const sz = ISLAND[1] + 0.5 + t * 5;
  const spit =
    (x > 70 && x < 87 ? 1 : 0) * (1 - ss(Math.abs(z - sz), 2.0, 3.2)) * (1 - ss(x, 84, 87));
  return Math.max(body, spit);
};
const MEMORIAL: V2 = [2, 53];
const LAGOON: V2 = [-34, -22];
const JATAYU: V2 = [-46, -40];
const DUNES: V2 = [13, 6];

const base: HeightFn = (x, z) => {
  const d = inland(x, z);
  let land =
    0.8 +
    0.04 * Math.max(0, d) +
    0.5 * Math.sin(x * 0.19) * Math.cos(z * 0.15) +
    2.0 * g2(x, z, 6, -30, 18, 10);
  // Varkala: laterite cliffs rising just behind the west-coast beach.
  const varkala = (1 - ss(x, -44, -30)) * ss(-z, 6, 20);
  land += varkala * 4.6 * ss(d, 2.0, 5.0);
  // Jatayu's rocky hill.
  land += 7.5 * g2(x, z, JATAYU[0], JATAYU[1], 5.5, 5);
  // Theri Kaadu: rolling red dunes inland of the east coast.
  land += 1.6 * g2(x, z, DUNES[0], DUNES[1], 10, 8) * (0.6 + 0.4 * Math.sin(x * 0.7 + z * 0.3));
  // Eastern Ghats: ridged hills across the inland north, stepping down to the plains.
  const ghats = ss(-z, 26, 40) * (1 - ss(Math.abs(x - 6), 34, 48));
  const ridged = 1 - Math.abs(Math.sin(x * 0.16 + Math.sin(z * 0.21) * 1.4));
  land += ghats * (5.0 + 4.2 * ridged * ridged + 1.6 * Math.sin(x * 0.07 + 1));
  land = THREE.MathUtils.lerp(land, 1.0, paddyK(x, z) * 0.8);
  let h = THREE.MathUtils.lerp(BED, land, ss(d, -6, 2.5));
  // Rameswaram island + Dhanushkodi spit.
  h = Math.max(h, THREE.MathUtils.lerp(BED, 1.0 + 0.4 * Math.sin(x * 0.5), islandMask(x, z)));
  // Kanyakumari's rock memorial islet.
  h = Math.max(h, BED + 4.9 * g2(x, z, MEMORIAL[0], MEMORIAL[1], 2.6));
  // The backwater lagoon behind the west coast.
  const lr = Math.hypot((x - LAGOON[0]) / 7, (z - LAGOON[1]) / 4.2);
  h = THREE.MathUtils.lerp(h, -1.4, 1 - ss(lr, 0.7, 1.2));
  return h;
};

// ── Roads ─────────────────────────────────────────────────────────────────

/** The coastal ring, clockwise from Chennai (top right). */
const RING: V2[] = [
  [72, -46],
  [66, -38],
  [60, -28],
  [53, -18],
  [46, -8],
  [38, 2],
  [30, 13],
  [22, 22],
  [13, 30],
  [5, 36],
  [-4, 36],
  [-13, 30],
  [-22, 22],
  [-30, 12],
  [-38, 2],
  [-45, -9],
  [-52, -20],
  [-58, -32],
  [-60, -42],
  [-48, -50],
  [-30, -51],
  [-10, -51],
  [10, -51],
  [30, -51],
  [50, -51],
  [64, -50],
];
/** The cross-country road through the middle, with the arrival gateway. */
const SPAWN: V2 = [0, -18];
const CROSS_VIA: V2[] = [
  [34, -20],
  [20, -22],
  [10, -16],
  SPAWN,
  [-10, -16],
  [-22, -14],
  [-32, -10],
];
/** Off-road loop through the Theri Kaadu red dunes. */
const DUNES_VIA: V2[] = [
  [18, 8],
  [10, 2],
  [4, 8],
  [4, 18],
  [8, 26],
];
/** The Pamban spur: over the bridge, across the island, out to Arichal Munai. */
const PAMBAN: V2[] = [
  [34, 8],
  [38, 8.2],
  [42, 6.5],
  [48, 5],
  [54, 5],
  [60, 5.5],
  [65, 7],
  [70, 8.5],
  [75, 10.5],
  [80, 12.5],
  [84, 13.6],
];

// ── Labels (local scripts, always with English) ───────────────────────────

const FONT_STACK =
  "Outfit, 'Tamil Sangam MN', 'Noto Sans Tamil', 'Malayalam Sangam MN', 'Noto Sans Malayalam', 'Kohinoor Devanagari', 'Devanagari Sangam MN', 'Noto Sans Devanagari', Arial, sans-serif";

function label(
  lines: string | string[],
  colour: string,
  bg?: string,
  height = 1,
  weight = 800,
): THREE.Sprite {
  const rows = Array.isArray(lines) ? lines : [lines];
  const font = `${weight} 64px ${FONT_STACK}`;
  const probe = document.createElement("canvas").getContext("2d");
  if (probe) probe.font = font;
  const textW = Math.max(...rows.map((r) => (probe ? probe.measureText(r).width : r.length * 40)));
  const w = Math.max(256, Math.ceil(textW + 80));
  const lineH = 84;
  const h = 44 + rows.length * lineH;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) {
    if (bg) {
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, h - 8, 28);
      ctx.fill();
    }
    ctx.fillStyle = colour;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    rows.forEach((r, i) => {
      ctx.fillText(r, w / 2, 22 + lineH * (i + 0.55));
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sp.scale.set((height * w) / 128, (height * h) / 128, 1);
  return sp;
}

function signBoard(
  kit: Kit,
  lines: string[],
  fg: string,
  bg: string,
  height: number,
  postH = 1.2,
): THREE.Group {
  const g = new THREE.Group();
  for (const dz of [-0.6, 0.6]) g.add(tube(kit, "#6b6f78", [0, 0, dz], [0, postH, dz], 0.05));
  const s = label(lines, fg, bg, height);
  s.position.set(0, postH + (s.scale.y / 2) * 0.92, 0);
  g.add(s);
  return g;
}

function photoSpot(kit: Kit): THREE.Group {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 160;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0f766e";
    ctx.beginPath();
    ctx.roundRect(4, 4, 312, 152, 30);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(36, 48, 100, 70, 14);
    ctx.fill();
    ctx.fillRect(60, 36, 34, 16);
    ctx.fillStyle = "#0f766e";
    ctx.beginPath();
    ctx.arc(86, 83, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(86, 83, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `800 40px ${FONT_STACK}`;
    ctx.textBaseline = "middle";
    ctx.fillText("PHOTO", 160, 62);
    ctx.fillText("SPOT", 160, 106);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  g.add(tube(kit, "#6b6f78", [0, 0, 0], [0, 1.5, 0], 0.05));
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sp.scale.set(2.2, 1.1, 1);
  sp.position.y = 2.0;
  g.add(sp);
  return g;
}

// ── Props ──────────────────────────────────────────────────────────────────

function person(kit: Kit, cloth: string, skin = "#a8714f"): THREE.Group {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 14), kit.mat(cloth));
  c.position.y = 0.45;
  c.castShadow = true;
  g.add(c);
  g.add(sphere(kit, cloth, [0, 0.98, 0], 0.19, undefined, [1, 1.1, 0.9]));
  g.add(sphere(kit, skin, [0, 1.3, 0], 0.16));
  g.add(sphere(kit, "#1f1a17", [0, 1.38, 0], 0.15, undefined, [1, 0.5, 1]));
  return g;
}

function lighthouse(kit: Kit, tall = 1): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry((0.5 - i * 0.04) * tall, (0.56 - i * 0.04) * tall, 0.8 * tall, 24),
      kit.mat(i % 2 ? "#d93a2f" : "#f5f5f2"),
    );
    seg.position.y = (0.4 + i * 0.8) * tall;
    seg.castShadow = true;
    g.add(seg);
  }
  g.add(
    box(
      kit,
      "#2b2f38",
      [-0.42 * tall, 5.6 * tall, -0.42 * tall],
      [0.42 * tall, 5.75 * tall, 0.42 * tall],
    ),
  );
  g.add(sphere(kit, "#fff3c4", [0, 6.0 * tall, 0], 0.34 * tall, { emissive: true }));
  return g;
}

/** M9: a sundal seller's push cart with a beach umbrella. */
function sundalCart(kit: Kit, umbrella: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#c97b3d", [-0.7, 0.45, -0.4], [0.7, 0.95, 0.4]));
  g.add(box(kit, "#e9e1cf", [-0.5, 0.95, -0.25], [0.5, 1.1, 0.25]));
  for (const x of [-0.5, 0.5]) g.add(disc(kit, "#2b2f38", [x, 0.3, 0.42], 0.3, 0.06));
  g.add(tube(kit, "#d9d9d9", [0, 0.95, 0], [0, 2.1, 0], 0.03));
  const u = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.4, 16), kit.mat(umbrella));
  u.position.y = 2.2;
  u.castShadow = true;
  g.add(u);
  return g;
}

/** A kite on a string tethered to the beach. */
function kite(_kit: Kit, colour: string, h: number, lean: number): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape([
    new THREE.Vector2(0, 0.6),
    new THREE.Vector2(0.4, 0),
    new THREE.Vector2(0, -0.6),
    new THREE.Vector2(-0.4, 0),
  ]);
  const m = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color: colour, side: THREE.DoubleSide, roughness: 0.8 }),
  );
  m.position.set(lean, h, 0);
  m.rotation.y = 0.6;
  g.add(m);
  const pts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.6, h * 0.55, 0),
    new THREE.Vector3(lean, h - 0.6, 0),
  ];
  g.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 4),
      new THREE.MeshBasicMaterial({ color: "#f5f5f5" }),
    ),
  );
  return g;
}

function cloud(kit: Kit, s: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++)
    g.add(
      sphere(
        kit,
        i % 2 ? "#5b6170" : "#6a7080",
        [(i - 2.5) * 1.3 * s, Math.sin(i * 1.7) * 0.4 * s, Math.cos(i * 2.1) * 0.8 * s],
        (1.2 + (i % 3) * 0.35) * s,
      ),
    );
  return g;
}

function milestone(kit: Kit, top: string, km: string, big = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#f5f5f2", [-0.3 * big, -0.2, -0.13 * big], [0.3 * big, 0.75 * big, 0.13 * big]));
  g.add(sphere(kit, "#f2c14e", [0, 0.76 * big, 0], 0.3 * big, undefined, [1, 0.7, 0.45]));
  const t = label([top, km], "#1d1f24", undefined, 0.28 * big, 800);
  t.position.set(0, 0.45 * big, 0.2 * big);
  g.add(t);
  return g;
}

/** M3: Mahabalipuram's shore temple: two stepped granite towers. */
function shoreTemple(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const STONE = "#a99c8c";
  g.add(box(kit, "#bdb2a3", [-3.4, -0.6, -2.2], [3.4, 0.5, 2.2]));
  for (const [x, s] of [
    [-1.3, 1.25],
    [1.7, 0.85],
  ] as [number, number][]) {
    for (let i = 0; i < 6; i++) {
      const w = (1.4 - i * 0.2) * s;
      g.add(
        box(
          kit,
          i % 2 ? STONE : "#b6a998",
          [x - w, 0.5 + i * 0.75 * s, -w],
          [x + w, 0.5 + (i + 1) * 0.75 * s, w],
        ),
      );
    }
    g.add(
      sphere(kit, STONE, [x, 0.5 + 6 * 0.75 * s + 0.25 * s, 0], 0.35 * s, undefined, [1, 0.8, 1]),
    );
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14 * s, 0.6 * s, 8), kit.mat(STONE));
    fin.position.set(x, 0.5 + 6 * 0.75 * s + 0.8 * s, 0);
    g.add(fin);
  }
  // Nandi bulls on the enclosure wall
  for (let i = 0; i < 5; i++)
    g.add(sphere(kit, STONE, [-3 + i * 1.5, 0.75, 2.0], 0.22, undefined, [1.4, 0.8, 0.8]));
  return g;
}

/** M3: the rathas: monolithic rock-cut shrines and an elephant. */
function rathas(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const ROCK = "#b39f8a";
  // Draupadi ratha (hut roof), Arjuna ratha (stepped), Bhima ratha (barrel vault)
  g.add(box(kit, ROCK, [-5, -0.4, -0.9], [-3.4, 1.4, 0.9]));
  const hut = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.2, 4), kit.mat(ROCK));
  hut.rotation.y = Math.PI / 4;
  hut.position.set(-4.2, 2.0, 0);
  hut.castShadow = true;
  g.add(hut);
  for (let i = 0; i < 3; i++)
    g.add(
      box(
        kit,
        ROCK,
        [-2.5 + i * 0.25, -0.4 + i * 1.0, -1.1 + i * 0.25],
        [-0.5 - i * 0.25, 0.6 + i * 1.0, 1.1 - i * 0.25],
      ),
    );
  g.add(box(kit, ROCK, [0.6, -0.4, -1.1], [4.2, 1.4, 1.1]));
  const vault = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 3.6, 24, 1, false, 0, Math.PI),
    kit.mat(ROCK),
  );
  vault.rotation.z = Math.PI / 2;
  vault.rotation.y = Math.PI / 2;
  vault.position.set(2.4, 1.4, 0);
  vault.castShadow = true;
  g.add(vault);
  // the stone elephant
  g.add(sphere(kit, ROCK, [-1.5, 0.9, 2.6], 0.75, undefined, [1.4, 0.95, 0.8]));
  g.add(sphere(kit, ROCK, [-0.5, 1.2, 2.6], 0.45));
  g.add(tube(kit, ROCK, [-0.2, 1.0, 2.6], [0.0, 0.2, 2.6], 0.12));
  for (const [x, z] of [
    [-1.9, 2.3],
    [-1.9, 2.9],
    [-1.1, 2.3],
    [-1.1, 2.9],
  ] as V2[])
    g.add(tube(kit, ROCK, [x, 0.6, z], [x, -0.2, z], 0.16));
  return g;
}

/** M1: a Puducherry White Town villa (mustard, white trim, coloured shutters). */
function villa(kit: Kit, wall: string, shutter: string, w = 3.2, d = 2.4): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, wall, [-w / 2, -0.5, -d / 2], [w / 2, 3.0, d / 2]));
  g.add(
    box(kit, "#f8f4ea", [-w / 2 - 0.08, 3.0, -d / 2 - 0.08], [w / 2 + 0.08, 3.25, d / 2 + 0.08]),
  );
  g.add(box(kit, "#c9763f", [-w / 2 + 0.1, 3.25, -d / 2 + 0.1], [w / 2 - 0.1, 3.3, d / 2 - 0.1]));
  g.add(
    box(kit, "#f8f4ea", [-w / 2 - 0.05, 1.45, -d / 2 - 0.05], [w / 2 + 0.05, 1.55, d / 2 + 0.05]),
  );
  const n = Math.round(w / 0.9);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / n;
    for (const y of [0.4, 1.9])
      g.add(box(kit, shutter, [x - 0.22, y, d / 2 - 0.01], [x + 0.22, y + 0.8, d / 2 + 0.05]));
  }
  // bougainvillea spilling over the wall
  for (let i = 0; i < 6; i++)
    g.add(
      sphere(
        kit,
        i % 2 ? "#d63384" : "#e75aa0",
        [-w / 2 + 0.3 + i * (w / 6), 3.1 + (i % 2) * 0.15, d / 2 + 0.1],
        0.42,
      ),
    );
  g.add(sphere(kit, "#4f8f46", [w / 2 - 0.2, 2.9, d / 2 + 0.15], 0.35));
  return g;
}

/** M4: a passenger train (Indian Railways blue coaches). */
function train(kit: Kit, coaches: number): THREE.Group {
  const g = new THREE.Group();
  // locomotive
  g.add(box(kit, "#c1272d", [0, 0.25, -0.65], [3.6, 2.1, 0.65]));
  g.add(box(kit, "#f2c14e", [0, 1.15, -0.67], [3.6, 1.35, 0.67]));
  g.add(box(kit, "#9fc3e6", [3.2, 1.45, -0.55], [3.62, 1.9, 0.55], { glass: true }));
  for (let c = 0; c < coaches; c++) {
    const x0 = -(c + 1) * 4.1;
    g.add(box(kit, "#2b5aa5", [x0, 0.25, -0.65], [x0 + 3.9, 2.0, 0.65]));
    g.add(box(kit, "#e9edf3", [x0, 2.0, -0.6], [x0 + 3.9, 2.2, 0.6]));
    for (let k = 0; k < 6; k++)
      g.add(
        box(kit, "#e6edf6", [x0 + 0.35 + k * 0.58, 1.2, 0.64], [x0 + 0.7 + k * 0.58, 1.6, 0.67]),
      );
  }
  for (let k = 0; k <= coaches; k++)
    for (const z of [-0.5, 0.5])
      for (const x of [0.6, 2.9]) g.add(disc(kit, "#1c1d21", [x - k * 4.1, 0.22, z], 0.22, 0.12));
  return g;
}

/** M7: the Jatayu sculpture: a colossal bird lying on its hilltop. */
function jatayu(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const STONE = "#8f8578";
  g.add(sphere(kit, STONE, [0, 1.2, 0], 2.6, undefined, [1.7, 0.6, 0.9]));
  // the raised wing
  const wing = new THREE.Shape([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(5, 1.4),
    new THREE.Vector2(6.5, 3.6),
    new THREE.Vector2(3.5, 2.4),
    new THREE.Vector2(0.4, 1.4),
  ]);
  const wg = new THREE.ExtrudeGeometry(wing, {
    depth: 0.4,
    bevelEnabled: true,
    bevelSize: 0.12,
    bevelThickness: 0.12,
    bevelSegments: 3,
  });
  const wm = new THREE.Mesh(wg, kit.mat("#9b9184"));
  wm.position.set(-1.2, 1.6, 0.6);
  wm.rotation.y = -0.4;
  wm.rotation.x = -0.5;
  wm.castShadow = true;
  g.add(wm);
  // the other wing, spread on the ground
  const wm2 = new THREE.Mesh(wg, kit.mat("#867c70"));
  wm2.position.set(-1.0, 0.6, -0.8);
  wm2.rotation.set(1.2, 0.3, 0);
  wm2.castShadow = true;
  g.add(wm2);
  // neck, head and the beak raised to the sky
  g.add(tube(kit, STONE, [3.4, 1.6, 0], [4.8, 3.0, 0], 0.6));
  g.add(sphere(kit, STONE, [5.0, 3.3, 0], 0.8));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 12), kit.mat("#c9a227"));
  beak.position.set(5.6, 4.1, 0);
  beak.rotation.z = -0.6;
  beak.castShadow = true;
  g.add(beak);
  g.add(sphere(kit, "#2a2622", [5.25, 3.5, 0.55], 0.12));
  // tail feathers
  for (let i = 0; i < 4; i++)
    g.add(
      box(
        kit,
        "#7f766a",
        [-5.2, 0.6 + i * 0.1, -0.9 + i * 0.6],
        [-3.4, 0.9 + i * 0.1, -0.5 + i * 0.6],
      ),
    );
  return g;
}

/** M8: a Chinese fishing net on its cantilevered frame. */
function fishingNet(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#6b4a32", [-0.6, -0.4, -0.6], [0.6, 0.3, 0.6]));
  const arm = new THREE.Group();
  arm.add(tube(kit, "#7a5636", [0, 0, 0], [5.2, 2.6, 0], 0.09));
  arm.add(tube(kit, "#7a5636", [0, 0, 0], [-2.5, 1.4, 0], 0.08));
  for (const s of [-1, 1]) arm.add(tube(kit, "#8a6640", [5.2, 2.6, 0], [6.4, 1.2, s * 1.4], 0.04));
  // the net, a shallow square bowl
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.8, 4, 4),
    new THREE.MeshStandardMaterial({ color: "#e8e1cf", wireframe: true }),
  );
  net.rotation.x = -Math.PI / 2;
  net.position.set(6.4, 1.0, 0);
  arm.add(net);
  for (let i = 0; i < 4; i++)
    arm.add(sphere(kit, "#b8a68a", [-2.2 + i * 0.2, 1.2 - i * 0.25, 0], 0.18));
  arm.position.y = 0.3;
  g.add(arm);
  return g;
}

/** M8: a Kerala kettuvallam houseboat with a woven thatch roof. */
function houseboat(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const hull = new THREE.Shape([
    new THREE.Vector2(-3.4, 0.9),
    new THREE.Vector2(-2.6, 0),
    new THREE.Vector2(2.6, 0),
    new THREE.Vector2(3.4, 0.9),
    new THREE.Vector2(3.0, 0.6),
    new THREE.Vector2(-3.0, 0.6),
  ]);
  const hg = new THREE.ExtrudeGeometry(hull, {
    depth: 1.5,
    bevelEnabled: true,
    bevelSize: 0.08,
    bevelThickness: 0.08,
    bevelSegments: 2,
  });
  hg.translate(0, 0, -0.75);
  const hm = new THREE.Mesh(hg, kit.mat("#5a3b24"));
  hm.castShadow = true;
  g.add(hm);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 4.6, 24, 1, false, 0, Math.PI),
    kit.mat("#c9a46a"),
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.set(0, 0.7, 0);
  roof.castShadow = true;
  g.add(roof);
  for (let i = 0; i < 5; i++)
    g.add(box(kit, "#3a2a1c", [-2.1 + i * 1.05, 0.65, -0.78], [-1.85 + i * 1.05, 1.35, 0.78]));
  return g;
}

function surfer(kit: Kit, board: string, shirt: string): THREE.Group {
  const g = new THREE.Group();
  g.add(sphere(kit, board, [0, 0.05, 0], 0.5, undefined, [2.2, 0.12, 0.6]));
  const p = person(kit, shirt);
  p.scale.setScalar(0.75);
  p.position.y = 0.05;
  g.add(p);
  return g;
}

function kayak(kit: Kit, colour: string): THREE.Group {
  const g = new THREE.Group();
  g.add(sphere(kit, colour, [0, 0.05, 0], 0.6, undefined, [2.4, 0.3, 0.5]));
  const p = person(kit, "#2b6cb0");
  p.scale.setScalar(0.55);
  p.position.y = 0.05;
  g.add(p);
  g.add(tube(kit, "#e9e1cf", [0, 0.45, -0.9], [0, 0.75, 0.9], 0.03));
  return g;
}

function boat(kit: Kit, colour: string): THREE.Group {
  const g = new THREE.Group();
  g.add(sphere(kit, colour, [0, 0.15, 0], 0.6, undefined, [2.0, 0.45, 0.6]));
  g.add(tube(kit, "#6b4a32", [0, 0.3, 0], [0, 1.7, 0], 0.03));
  g.add(box(kit, "#f5f0e6", [0.02, 0.55, -0.01], [0.75, 1.55, 0.01]));
  return g;
}

/** Dhanushkodi church ruins. */
function ruins(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const C = "#c9b08a";
  g.add(box(kit, C, [-3, -0.4, -0.25], [-1.4, 2.6, 0.25]));
  g.add(box(kit, C, [-0.8, -0.4, -0.25], [0.6, 3.2, 0.25]));
  g.add(box(kit, C, [1.2, -0.4, -0.25], [2.4, 1.6, 0.25]));
  g.add(box(kit, C, [-3, -0.4, -0.25], [-2.6, 1.8, 3.0]));
  g.add(box(kit, C, [2.0, -0.4, 0], [2.4, 1.1, 2.4]));
  for (const x of [-2.2, 0.0])
    g.add(box(kit, "#a68c66", [x - 0.3, 0.8, -0.27], [x + 0.3, 2.0, 0.27]));
  return g;
}

/** Kanyakumari's rock memorial on its islet. */
function memorial(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const plinth = foundation(kit, 4.4, 3.2, 3, "#6e5a4a");
  g.add(plinth);
  g.add(box(kit, "#b84a3a", [-2, 0, -1.4], [2, 0.5, 1.4]));
  g.add(box(kit, "#e9dcc4", [-1.6, 0.5, -1.1], [1.6, 2.4, 1.1]));
  for (let i = 0; i < 5; i++)
    g.add(tube(kit, "#d9c7a6", [-1.4 + i * 0.7, 0.5, 1.15], [-1.4 + i * 0.7, 2.3, 1.15], 0.1));
  g.add(box(kit, "#b84a3a", [-1.7, 2.4, -1.2], [1.7, 2.65, 1.2]));
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    kit.mat("#e9dcc4"),
  );
  dome.position.y = 2.65;
  dome.castShadow = true;
  g.add(dome);
  return g;
}

function cliffCafe(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#8a6a45", [-3, -0.4, -2], [3, 0.2, 2]));
  g.add(box(kit, "#f2e6cf", [-2.6, 0.2, -1.8], [-0.4, 2.0, 0.2]));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 2.1, 1.0, 4), kit.mat("#c96a3a"));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(-1.5, 2.5, -0.8);
  roof.castShadow = true;
  g.add(roof);
  for (const [x, z, c] of [
    [0.8, 0.6, "#3f9a8a"],
    [2.0, -0.8, "#f2c14e"],
    [1.6, 1.4, "#e05a6b"],
  ] as [number, number, string][]) {
    g.add(tube(kit, "#d9d9d9", [x, 0.2, z], [x, 1.7, z], 0.03));
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.3, 16), kit.mat(c));
    p.position.set(x, 1.75, z);
    p.castShadow = true;
    g.add(p);
  }
  const s = label(["CLIFF CAFÉ", "വർക്കല · Varkala"], "#ffffff", "#c96a3a", 0.55);
  s.position.set(-1.5, 3.6, 0.4);
  g.add(s);
  return g;
}

/** The arrival gateway: a roadside temple gate (gopuram-style top) over the road. */
function welcomeArch(kit: Kit, span: number): THREE.Group {
  const g = new THREE.Group();
  const half = span / 2 + 0.8;
  const cols = ["#e9b44c", "#d9653b", "#3f9a8a", "#e05a6b", "#5a7fd0"];
  for (const z of [-half, half]) {
    g.add(box(kit, "#f2e6cf", [-0.8, -0.5, z - 0.8], [0.8, 3.6, z + 0.8]));
    g.add(box(kit, "#d9653b", [-0.85, 3.3, z - 0.85], [0.85, 3.6, z + 0.85]));
    // garlands of marigold down each pillar
    for (let i = 0; i < 6; i++)
      g.add(sphere(kit, i % 2 ? "#ff9f1c" : "#ffbf00", [0.82, 0.4 + i * 0.5, z], 0.13));
  }
  // stepped, colourful tiers across the top, with kalasam finials
  for (let i = 0; i < 4; i++) {
    const w = half + 1.0 - i * 0.55;
    g.add(
      box(
        kit,
        cols[i] ?? "#e9b44c",
        [-0.9 + i * 0.12, 3.6 + i * 0.6, -w],
        [0.9 - i * 0.12, 4.2 + i * 0.6, w],
      ),
    );
    for (let k = -2; k <= 2; k++)
      g.add(sphere(kit, "#f5e6c8", [0.92 - i * 0.12, 3.9 + i * 0.6, (k * w) / 2.6], 0.12));
  }
  for (const z of [-1.2, 0, 1.2]) g.add(sphere(kit, "#f2c14e", [0, 6.2, z], 0.2, { metal: true }));
  const s = label(["WELCOME", "வருக · സ്വാഗതം"], "#ffffff", "#8a2a22", 0.55);
  s.position.set(0, 7.4, 0);
  g.add(s);
  return g;
}

function postcard(kit: Kit, i: number, colour: string): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#6b4a32", [0, -0.3, 0], [0, 1.2, 0], 0.05));
  g.add(box(kit, "#f6efdc", [-0.7, 1.2, -0.05], [0.7, 2.1, 0.05]));
  g.add(box(kit, colour, [-0.6, 1.3, 0.05], [0.25, 2.0, 0.07]));
  g.add(box(kit, "#8a2a22", [0.35, 1.75, 0.05], [0.6, 2.0, 0.07]));
  const n = label(String(i + 1), "#ffffff", "#8a2a22", 0.45);
  n.position.set(0, 2.65, 0);
  g.add(n);
  return g;
}

function flock(kit: Kit, n: number, colour = "#f4f4f4"): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const k = Math.ceil(i / 2);
    const b = new THREE.Group();
    for (const s of [-1, 1]) {
      const wing = box(kit, colour, [0, -0.02, -0.02], [0.45, 0.02, 0.02]);
      wing.rotation.y = s * 0.5;
      wing.rotation.z = 0.25;
      b.add(wing);
    }
    b.position.set(-k * 0.9, Math.sin(i) * 0.2, side * k * 0.7);
    g.add(b);
  }
  return g;
}

function butterflies(kit: Kit, n: number): THREE.Group {
  const g = new THREE.Group();
  const cols = ["#f2c14e", "#ff8fb1", "#7fc8f8", "#ffffff"];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group();
    for (const s of [-1, 1]) {
      const w = box(kit, cols[i % cols.length] ?? "#fff", [0, 0, -0.01], [0.16, 0.12, 0.01]);
      w.rotation.y = s * 1.1;
      b.add(w);
    }
    b.position.set(Math.sin(i * 2.3) * 2.5, 1 + (i % 3) * 0.35, Math.cos(i * 1.7) * 2.5);
    g.add(b);
  }
  return g;
}

function spawnMarker(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.0, 2.35, 64),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.16;
  g.add(ring);
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 32),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7 }),
  );
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = 0.17;
  g.add(dot);
  return g;
}

/** A ribbon along part of a road (used for tyre ruts and partial surfaces). */
function partialRibbon(
  kit: Kit,
  road: Road,
  t0: number,
  t1: number,
  width: number,
  colour: string,
  lift: number,
  sideOffset = 0,
): THREE.Mesh {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = Math.max(20, Math.round((t1 - t0) * 1400));
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const { p, normal } = road.at(t);
    const k = Math.min(1, Math.min(i, n - i) / (n * 0.1));
    const hw = (width / 2) * (0.35 + 0.65 * k);
    const cx = p.x + normal.x * sideOffset;
    const cz = p.z + normal.z * sideOffset;
    pos.push(
      cx + normal.x * hw,
      p.y + lift,
      cz + normal.z * hw,
      cx - normal.x * hw,
      p.y + lift,
      cz - normal.z * hw,
    );
    if (i < n) {
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

/** Bucketed carve against several roads at once (dense centrelines). */
function carveRoads(
  height: HeightFn,
  roads: Road[],
  widths: number[],
  keep: (x: number, z: number) => boolean,
): HeightFn {
  const pts: { x: number; z: number; y: number; w: number; next: number }[] = [];
  roads.forEach((road, r) => {
    const n = Math.ceil(road.length / 0.6);
    const start = pts.length;
    for (let i = 0; i <= n; i++) {
      const p = road.at(i / n).p;
      pts.push({ x: p.x, z: p.z, y: p.y, w: widths[r] ?? 3, next: i < n ? start + i + 1 : -1 });
    }
  });
  const cell = 8;
  const buckets = new Map<string, number[]>();
  pts.forEach((p, i) => {
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    const list = buckets.get(key) ?? [];
    list.push(i);
    buckets.set(key, list);
  });
  return (x, z) => {
    const h = height(x, z);
    if (keep(x, z)) return h;
    let best = Number.POSITIVE_INFINITY;
    let y = 0;
    let w = 3;
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const i of buckets.get(`${cx + dx},${cz + dz}`) ?? []) {
          const a = pts[i];
          if (!a || a.next < 0) continue;
          const b = pts[a.next];
          if (!b) continue;
          const abx = b.x - a.x;
          const abz = b.z - a.z;
          const l2 = abx * abx + abz * abz || 1;
          const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / l2));
          const d = (a.x + abx * t - x) ** 2 + (a.z + abz * t - z) ** 2;
          if (d < best) {
            best = d;
            y = a.y + (b.y - a.y) * t;
            w = a.w;
          }
        }
      }
    }
    if (!Number.isFinite(best)) return h;
    const dist = Math.sqrt(best);
    const inner = w / 2 + 0.8;
    const shoulder = 3.5;
    if (dist <= inner) return y - 0.02;
    if (dist >= inner + shoulder) return h;
    return THREE.MathUtils.lerp(y - 0.02, h, ss(dist, inner, inner + shoulder));
  };
}

function tNear(road: Road, x: number, z: number, from = 0, to = 1): number {
  let best = from;
  let bd = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= 600; i++) {
    const t = from + ((to - from) * i) / 600;
    const p = road.at(t).p;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

// ── Lived-in Tamil Nadu: temple towns, paddy, road life ──────────────────

/** Paddy fields: flooded-green patchwork with raised bunds. */
const PADDIES: { c: V2; rx: number; rz: number }[] = [
  { c: [-14, 6], rx: 11, rz: 7 },
  { c: [26, -7], rx: 6, rz: 4 },
];
const paddyK = (x: number, z: number) =>
  Math.max(
    ...PADDIES.map((p) => 1 - ss(Math.hypot((x - p.c[0]) / p.rx, (z - p.c[1]) / p.rz), 0.8, 1.05)),
  );
const paddyColour = (x: number, z: number): string | null => {
  if (paddyK(x, z) < 0.5) return null;
  const fx = x / 3.6;
  const fz = z / 2.8;
  if (Math.abs(fx - Math.round(fx)) < 0.06 || Math.abs(fz - Math.round(fz)) < 0.07)
    return "#9b8a5e";
  const r = Math.abs(Math.sin(Math.floor(fx) * 12.9898 + Math.floor(fz) * 78.233) * 43758.5453) % 1;
  return r < 0.45 ? "#5fbf4a" : r < 0.8 ? "#78cc52" : "#9fd06a";
};

/** A small temple gopuram: stepped, painted tiers over a gateway. */
function gopuramSmall(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const cols = ["#e9b44c", "#3f9a8a", "#e05a6b", "#5a7fd0", "#f2e6cf"];
  g.add(box(kit, "#f2e6cf", [-1.6, -2.5, -1.0], [1.6, 1.8, 1.0]));
  g.add(box(kit, "#5a3b24", [-0.45, 0, 0.98], [0.45, 1.4, 1.04]));
  for (let i = 0; i < 5; i++) {
    const w = 1.5 - i * 0.24;
    const d = 0.95 - i * 0.12;
    g.add(box(kit, cols[i] ?? "#e9b44c", [-w, 1.8 + i * 0.62, -d], [w, 2.4 + i * 0.62, d]));
    for (let k = -2; k <= 2; k++)
      g.add(
        sphere(
          kit,
          cols[(i + k + 5) % 5] ?? "#fff",
          [(k * w) / 2.6, 2.1 + i * 0.62, d + 0.02],
          0.1,
        ),
      );
  }
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1.4, 20, 1, false, 0, Math.PI),
    kit.mat("#e9b44c"),
  );
  top.rotation.z = Math.PI / 2;
  top.position.y = 4.9;
  top.castShadow = true;
  g.add(top);
  for (const x of [-0.5, 0, 0.5])
    g.add(sphere(kit, "#f2c14e", [x, 5.45, 0], 0.11, { metal: true }));
  return g;
}

/** A kolam drawn in rice flour at a doorstep (flat decal). */
function kolam(): THREE.Group {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(128 + Math.cos(a) * 52, 128 + Math.sin(a) * 52, 46, 20, a, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(128, 128, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#e05a6b";
    ctx.beginPath();
    ctx.arc(128, 128, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 40),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

function flowerSeller(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(person(kit, "#d63384"));
  g.add(sphere(kit, "#8a6a45", [0.7, 0.25, 0.2], 0.4, undefined, [1.2, 0.5, 1.2]));
  for (let i = 0; i < 9; i++)
    g.add(
      sphere(
        kit,
        i % 3 === 0 ? "#ff9f1c" : "#fffaf0",
        [0.7 + Math.cos(i) * 0.26, 0.45, 0.2 + Math.sin(i) * 0.26],
        0.09,
      ),
    );
  return g;
}

/** A small bus at a bus stop (built along +x). */
function bus(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#2f8f6b", [-2.6, 0.35, -0.7], [2.6, 1.3, 0.7]));
  g.add(box(kit, "#f2e6cf", [-2.6, 1.3, -0.7], [2.6, 2.1, 0.7]));
  g.add(box(kit, "#e9b44c", [-2.62, 1.22, -0.72], [2.62, 1.36, 0.72]));
  for (let k = 0; k < 7; k++)
    for (const z of [-0.71, 0.71])
      g.add(
        box(kit, "#7fb3cf", [-2.3 + k * 0.66, 1.45, z - 0.02], [-1.8 + k * 0.66, 1.95, z + 0.02]),
      );
  g.add(box(kit, "#9fc3e6", [2.6, 1.3, -0.6], [2.64, 2.0, 0.6], { glass: true }));
  for (const x of [-1.6, 1.7])
    for (const z of [-0.66, 0.66]) g.add(disc(kit, "#1c1d21", [x, 0.32, z], 0.32, 0.18));
  return g;
}

function busShelter(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1.3, 1.3]) g.add(tube(kit, "#6b6f78", [x, 0, -0.5], [x, 2.1, -0.5], 0.05));
  g.add(box(kit, "#3f7fb5", [-1.6, 2.1, -1.0], [1.6, 2.2, 0.2]));
  g.add(box(kit, "#c9c2b6", [-1.1, 0.45, -0.8], [1.1, 0.55, -0.4]));
  const s = label(["பேருந்து நிறுத்தம்", "BUS STOP"], "#ffffff", "#3f7fb5", 0.3);
  s.position.set(0, 2.65, -0.4);
  g.add(s);
  return g;
}

function teaStall(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#3f9a8a", [-1.1, -0.5, -0.8], [1.1, 1.0, 0.8]));
  g.add(box(kit, "#e9e1cf", [-1.1, 1.0, -0.8], [1.1, 1.1, 0.8]));
  for (const x of [-1.05, 1.05]) g.add(tube(kit, "#6b4a32", [x, 1.0, 0.75], [x, 2.0, 0.75], 0.04));
  const roof = box(kit, "#d9653b", [-1.4, 2.0, -1.0], [1.4, 2.1, 1.3]);
  g.add(roof);
  g.add(tube(kit, "#b8c0c6", [0.5, 1.1, 0], [0.5, 1.5, 0], 0.18, { metal: true }));
  for (let i = 0; i < 4; i++)
    g.add(tube(kit, "#f5f0e6", [-0.7 + i * 0.22, 1.1, 0.5], [-0.7 + i * 0.22, 1.24, 0.5], 0.05));
  for (let i = 0; i < 3; i++)
    g.add(
      sphere(kit, "#ffffff", [0.55 + i * 0.08, 1.75 + i * 0.25, 0], 0.12 + i * 0.04, {
        glass: true,
      }),
    );
  // banana bunches hanging at the front, as at every roadside tea kadai
  for (const x of [-0.8, 0.9])
    g.add(sphere(kit, "#e6c33a", [x, 1.6, 1.1], 0.18, undefined, [0.8, 1.6, 0.8]));
  g.add(box(kit, "#6b4a32", [-1.0, 0, 1.3], [1.0, 0.4, 1.6]));
  const s = label(["டீ கடை", "TEA · COFFEE"], "#ffffff", "#d9653b", 0.3);
  s.position.set(0, 2.55, 1.1);
  g.add(s);
  return g;
}

/** A scooter (along +x) with riders; optionally a moped piled with coconuts. */
function scooter(kit: Kit, colour: string, riders: number, coconuts = false): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, colour, [-0.5, 0.25, -0.18], [0.45, 0.55, 0.18]));
  g.add(box(kit, "#1f1f22", [-0.45, 0.55, -0.16], [0.15, 0.62, 0.16]));
  g.add(tube(kit, "#8a8f98", [0.45, 0.25, 0], [0.55, 0.95, 0], 0.03));
  g.add(tube(kit, "#8a8f98", [0.55, 0.95, -0.25], [0.55, 0.95, 0.25], 0.025));
  for (const x of [-0.45, 0.5]) g.add(disc(kit, "#1c1d21", [x, 0.2, 0], 0.2, 0.09));
  const shirts = ["#2b6cb0", "#e05a6b", "#f2c14e"];
  for (let i = 0; i < riders; i++) {
    const p = person(kit, shirts[i] ?? "#fff");
    p.scale.setScalar(i === 2 ? 0.5 : 0.62);
    p.position.set(0.05 - i * 0.32, 0.45, 0);
    g.add(p);
  }
  if (coconuts) {
    for (let i = 0; i < 14; i++)
      g.add(
        sphere(
          kit,
          i % 3 ? "#6b8f3a" : "#7a5a32",
          [-0.6 - (i % 3) * 0.18, 0.75 + Math.floor(i / 6) * 0.22, -0.3 + ((i * 7) % 5) * 0.15],
          0.13,
        ),
      );
  }
  return g;
}

/** A bullock cart (along +x) with two white bulls with painted horns. */
function bullockCart(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, "#8a6a45", [-1.6, 0.7, -0.6], [0.2, 0.85, 0.6]));
  const hood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 1.4, 20, 1, false, 0, Math.PI),
    kit.mat("#c9a46a"),
  );
  hood.rotation.z = Math.PI / 2;
  hood.rotation.y = Math.PI / 2;
  hood.position.set(-0.8, 0.85, 0);
  hood.castShadow = true;
  g.add(hood);
  for (const z of [-0.68, 0.68]) g.add(disc(kit, "#6b4a32", [-0.8, 0.55, z], 0.55, 0.08));
  g.add(tube(kit, "#6b4a32", [0.2, 0.8, 0], [1.9, 0.9, 0], 0.05));
  for (const z of [-0.32, 0.32]) {
    g.add(sphere(kit, "#f1ece2", [1.5, 0.75, z], 0.32, undefined, [1.5, 0.85, 0.75]));
    g.add(sphere(kit, "#ebe5da", [2.05, 0.9, z], 0.16, undefined, [1.2, 1, 0.9]));
    for (const s of [-1, 1])
      g.add(
        tube(
          kit,
          s > 0 ? "#2b6cb0" : "#d93a2f",
          [2.0, 1.02, z + s * 0.06],
          [2.05, 1.3, z + s * 0.16],
          0.03,
        ),
      );
    for (const [x, dz] of [
      [1.75, 0.12],
      [1.25, 0.12],
      [1.75, -0.12],
      [1.25, -0.12],
    ] as V2[])
      g.add(tube(kit, "#d9d2c4", [x, 0.6, z + dz], [x, 0, z + dz], 0.05));
  }
  const p = person(kit, "#f5f0e6");
  p.scale.setScalar(0.6);
  p.position.set(0.0, 0.85, 0);
  g.add(p);
  return g;
}

/** Hazy Eastern Ghats silhouettes beyond the inland (north) edge, for depth. */
function distantHills(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const layers = ["#8fb39c", "#a9c3c0", "#c3d4d8"];
  layers.forEach((colour, layer) => {
    for (let i = 0; i < 14 + layer * 2; i++) {
      const x = -130 + i * (260 / (13 + layer * 2)) + layer * 9;
      const r = 12 + ((i * 37 + layer * 11) % 9);
      const h = 7 + ((i * 13 + layer * 5) % 7) + layer * 3;
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        kit.mat(colour),
      );
      hill.scale.set(r, h, r * 0.55);
      hill.position.set(x, -6, -96 - layer * 14);
      g.add(hill);
    }
  });
  return noSelfShadow(g);
}

const noSelfShadow = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) c.castShadow = false;
  });
  return o;
};

// ── The world ─────────────────────────────────────────────────────────────

export const murphy: JourneyDef = {
  id: "murphy",
  title: "23 Before 23 · Murphy's southern coast (open world)",
  mood: "vivid",
  bike: "classic",
  build(scene, kit) {
    const W = 3.2;
    const DECK = SEA + 1.6;
    /** The Pamban strait between the mainland and the island. */
    const inStrait = (x: number, z: number) => x > 38.5 && x < 63 && z > -1 && z < 9;
    const deckH: HeightFn = (x, z) =>
      inStrait(x, z) ? Math.max(base(x, z), DECK) : Math.max(base(x, z), 0.6);
    const ring0 = makeRoad(RING, (x, z) => Math.max(base(x, z), 0.6), true, 6);
    const cFrom = tNear(ring0, 53, -18);
    const cTo = tNear(ring0, -38, 2);
    const dFrom = tNear(ring0, 25, 19);
    const dTo = tNear(ring0, 9, 33);
    const cross0 = makeRoad(branchPoints(ring0, cFrom, cTo, CROSS_VIA), base, false, 6);
    const dunes0 = makeRoad(branchPoints(ring0, dFrom, dTo, DUNES_VIA), base, false, 4);
    const pStart = ring0.at(tNear(ring0, 34, 8)).p;
    const pamban0 = makeRoad([[pStart.x, pStart.z], ...PAMBAN.slice(1)], deckH, false, 8);
    const carved = carveRoads(
      base,
      [ring0, cross0, dunes0, pamban0],
      [W, W - 0.6, W - 0.9, W - 0.4],
      inStrait,
    );
    /** Ground used while placing; replaced by the pad-flattened field at the end. */
    let height: HeightFn = carved;
    const buildRoads = () => {
      const roadH: HeightFn = (x, z) => Math.max(height(x, z), 0.6);
      const road = makeRoad(RING, roadH, true, 6);
      const cross = makeRoad(branchPoints(road, cFrom, cTo, CROSS_VIA), roadH, false, 6);
      const dunes = makeRoad(branchPoints(road, dFrom, dTo, DUNES_VIA), height, false, 4);
      const ps = road.at(tNear(road, 34, 8)).p;
      const pamban = makeRoad(
        [[ps.x, ps.z], ...PAMBAN.slice(1)],
        (x, z) => (inStrait(x, z) ? Math.max(height(x, z), DECK) : Math.max(height(x, z), 0.7)),
        false,
        8,
      );
      return { road, cross, dunes, pamban };
    };
    let { road, cross, dunes, pamban } = buildRoads();

    // The sea: a rounded rectangle inside the soft rim, with gentle surf lines.
    {
      const shape = new THREE.Shape();
      const [hw, hd, r] = [90, 58, 16];
      shape.moveTo(-hw + r, -hd);
      shape.lineTo(hw - r, -hd);
      shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
      shape.lineTo(hw, hd - r);
      shape.quadraticCurveTo(hw, hd, hw - r, hd);
      shape.lineTo(-hw + r, hd);
      shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
      shape.lineTo(-hw, -hd + r);
      shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
      const sea = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), kit.mat("#21b5b8"));
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = SEA;
      sea.receiveShadow = true;
      scene.add(sea);
      for (let i = 0; i < 64; i++) {
        const x = -84 + i * 2.7;
        const z = coastZ(x) + 4 + (i % 3) * 1.6;
        if (Math.abs(x) < 3 || (x > 44 && x < 84 && z > -12 && z < 12)) continue;
        const w = box(kit, "#e8fbfb", [-0.9, 0, -0.05], [0.9, 0.03, 0.05]);
        w.position.set(x, SEA + 0.01, z);
        w.rotation.y = x > 0 ? 0.85 : -0.85;
        scene.add(w);
      }
    }

    /** Deferred placement: buildings get a levelled pad; props tilt to the slope. */
    type Kind = "build" | "post" | "prop";
    const pads: { x: number; z: number; r: number }[] = [];
    const placements: {
      o: THREE.Object3D;
      x: number;
      z: number;
      rot: number;
      sink: number;
      kind: Kind;
      foot: number;
    }[] = [];
    const placeOn = (
      o: THREE.Object3D,
      x: number,
      z: number,
      rot = 0,
      sink = 0,
      kind: Kind = "post",
      foot = 0.35,
    ) => {
      if (kind === "build") pads.push({ x, z, r: foot * 1.15 });
      placements.push({ o, x, z, rot, sink, kind, foot });
      scene.add(o);
      return o;
    };
    const keepClear: { x: number; z: number; r: number }[] = [];

    /** Which side of the road is inland (+1/-1) at t. */
    const landSide = (r: Road, t: number): 1 | -1 => {
      const a = beside(r, t, 6, 1);
      const b = beside(r, t, 6, -1);
      return inland(a.x, a.z) > inland(b.x, b.z) ? 1 : -1;
    };
    /** A spot on the dry beach on the sea side of the road. */
    const beachSpot = (r: Road, t: number, lo = 0.8, hi = 3.0, minOff = W / 2 + 2.2) => {
      const side = -landSide(r, t) as 1 | -1;
      for (let off = minOff; off < 16; off += 0.4) {
        const q = beside(r, t, off, side);
        const d = inland(q.x, q.z);
        if (d >= lo && d <= hi) return q;
      }
      return beside(r, t, minOff, side);
    };
    const faceTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
    const landSpot = (r: Road, t: number, off: number) => beside(r, t, off, landSide(r, t));

    // ── Chennai / Marina Beach (east coast, top right), in the cyclone
    const tChennai = tNear(road, 67, -41);
    {
      const lh = beachSpot(road, tChennai + 0.004, 1.5, 3.2, 6);
      placeOn(lighthouse(kit, 1.15), lh.x, lh.z, 0, 0, "build", 1.2);
      keepClear.push({ x: lh.x, z: lh.z, r: 3 });
      for (let i = 0; i < 4; i++) {
        const at = beachSpot(road, tChennai - 0.016 + i * 0.007, 0.9, 2.4);
        const rp = road.at(tChennai - 0.016 + i * 0.007).p;
        placeOn(
          sundalCart(kit, ["#d93a2f", "#f2c14e", "#3f9a8a", "#2f6db0"][i] ?? "#fff"),
          at.x,
          at.z,
          faceTo(at.x, at.z, rp.x, rp.z),
          0,
          "prop",
          0.8,
        );
        placeOn(
          person(kit, ["#f2c14e", "#e05a6b", "#3f9a8a", "#ffffff"][i] ?? "#fff"),
          at.x + 1.0,
          at.z + 0.7,
        );
        keepClear.push({ x: at.x, z: at.z, r: 2 });
      }
      for (let i = 0; i < 3; i++) {
        const at = beachSpot(road, tChennai - 0.012 + i * 0.01, 0.6, 1.4);
        placeOn(
          kite(kit, ["#e05a6b", "#f2c14e", "#2f6db0"][i] ?? "#fff", 4.5 + i * 1.2, 2.2),
          at.x,
          at.z,
          0.9 + i * 0.25,
        );
      }
      // the cyclone over Chennai: low dark clouds and slanting rain, out to sea
      for (let i = 0; i < 5; i++) {
        const c = cloud(kit, 1.0 + (i % 3) * 0.2);
        c.position.set(68 + i * 4.2, 15 + (i % 2) * 1.5, -56 + i * 2.6);
        scene.add(c);
      }
      const rainMat = new THREE.MeshBasicMaterial({
        color: "#a9c4e6",
        transparent: true,
        opacity: 0.35,
      });
      for (let i = 0; i < 150; i++) {
        const x = 64 + ((i * 37.3) % 24);
        const z = -60 + ((i * 23.7) % 18);
        const y = 1 + ((i * 7.1) % 11);
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 0.03), rainMat);
        r.position.set(x, Math.max(SEA, height(x, z)) + y, z);
        r.rotation.z = 0.45;
        scene.add(r);
      }
      // M11 + X1: the Delhi 1,800 km stone, and a Tamil/English welcome to Chennai
      const tD = tNear(road, 60, -51);
      const ds = landSpot(road, tD, W / 2 + 1.0);
      placeOn(
        milestone(kit, "DELHI · दिल्ली", "1,800 km", 1.8),
        ds.x,
        ds.z,
        road.at(tD).heading - Math.PI / 2,
        0,
        "post",
        0.5,
      );
      const tW = tChennai + 0.03;
      const ws = landSpot(road, tW, W / 2 + 2.0);
      placeOn(
        nhaiSign(kit, [{ local: "சென்னை", en: "Chennai · Marina Beach", arrow: "up", km: 2 }], 3.0),
        ws.x,
        ws.z,
        road.at(tW).heading + Math.PI / 2,
        0,
        "post",
        0.6,
      );
      // low city edge inland
      for (let i = 0; i < 6; i++) {
        const t = tChennai - 0.02 + i * 0.008;
        const q = landSpot(road, t, W / 2 + 6 + (i % 2) * 3.4);
        const rp = road.at(t).p;
        placeOn(
          box(
            kit,
            ["#e8dcc6", "#d9e3e8", "#efd3c2", "#cfd8c8"][i % 4] ?? "#eee",
            [-1.4, 0, -1.2],
            [1.4, 2 + (i % 3) * 0.9, 1.2],
          ),
          q.x,
          q.z,
          faceTo(q.x, q.z, rp.x, rp.z),
          0,
          "build",
          1.9,
        );
        keepClear.push({ x: q.x, z: q.z, r: 2.4 });
      }
    }

    // ── Mahabalipuram: the shore temple on the beach, the rathas inland
    const tMaha = tNear(road, 58, -25);
    {
      const st = beachSpot(road, tMaha, 2.8, 5.0, 6);
      placeOn(shoreTemple(kit), st.x, st.z, road.at(tMaha).heading, 0, "build", 3.6);
      keepClear.push({ x: st.x, z: st.z, r: 5 });
      const rt = landSpot(road, tMaha + 0.006, W / 2 + 7);
      placeOn(rathas(kit), rt.x, rt.z, road.at(tMaha).heading, 0, "build", 5.0);
      keepClear.push({ x: rt.x, z: rt.z, r: 6.5 });
      const sg = landSpot(road, tMaha - 0.02, W / 2 + 1.9);
      placeOn(
        signBoard(kit, ["மாமல்லபுரம்", "MAHABALIPURAM"], "#ffffff", "#7a5a3a", 0.42),
        sg.x,
        sg.z,
      );
    }

    // ── Puducherry White Town: villas inland, the promenade by the sea
    const tPondy = tNear(road, 43, -4);
    {
      const walls = ["#f2c14e", "#f6d36b", "#f2b705", "#f7e1a0"];
      const shutters = ["#2f7d6b", "#2b6cb0", "#2f7d6b", "#8a2a22"];
      for (let i = 0; i < 3; i++) {
        const t = tPondy - 0.011 + i * 0.011;
        const at = landSpot(road, t, W / 2 + 4.0);
        const rp = road.at(t).p;
        placeOn(
          villa(kit, walls[i % 4] ?? "#f2c14e", shutters[i % 4] ?? "#2f7d6b"),
          at.x,
          at.z,
          faceTo(at.x, at.z, rp.x, rp.z),
          0,
          "build",
          2.0,
        );
        keepClear.push({ x: at.x, z: at.z, r: 3 });
      }
      // promenade: paved slabs with lamps along the shore
      for (let i = 0; i < 10; i++) {
        const t = tPondy - 0.014 + i * 0.0032;
        const at = beachSpot(road, t, 0.9, 2.6);
        placeOn(
          box(kit, "#e9e1cf", [-0.9, -0.3, -0.7], [0.9, 0.08, 0.7]),
          at.x,
          at.z,
          road.at(t).heading,
          0,
          "prop",
          0.8,
        );
        if (i % 3 === 0) {
          const lamp = new THREE.Group();
          lamp.add(tube(kit, "#2b2f38", [0, 0, 0], [0, 2.2, 0], 0.05));
          lamp.add(sphere(kit, "#ffe3a6", [0, 2.3, 0], 0.16, { emissive: true }));
          placeOn(lamp, at.x, at.z);
        }
      }
      const bf = landSpot(road, tPondy, W / 2 + 7.5);
      placeOn(butterflies(kit, 8), bf.x, bf.z);
      const sg = landSpot(road, tPondy - 0.02, W / 2 + 1.9);
      placeOn(
        signBoard(kit, ["புதுச்சேரி", "PUDUCHERRY · WHITE TOWN"], "#ffffff", "#2b6cb0", 0.4),
        sg.x,
        sg.z,
      );
    }

    // ── Pamban: the road bridge, the old railway bridge beside it (lift span
    // raised) with a train waiting, a ship; Dhanushkodi ruins at the end.
    {
      let b0 = 0;
      let b1 = 1;
      for (let i = 0; i <= 400; i++) {
        const p = pamban.at(i / 400).p;
        if (inStrait(p.x, p.z)) {
          if (b0 === 0) b0 = i / 400;
          b1 = i / 400;
        }
      }
      for (let t = b0; t <= b1; t += (b1 - b0) / 10) {
        const { p, heading, normal } = pamban.at(t);
        const pier = box(kit, "#d9d4c8", [-0.35, BED, -1.2], [0.35, p.y, 1.2]);
        pier.position.set(p.x, pier.position.y, p.z);
        pier.rotation.y = heading;
        scene.add(pier);
        for (const side of [-1, 1])
          scene.add(
            tube(
              kit,
              "#f5f5f2",
              [p.x + normal.x * side * (W / 2), p.y + 0.1, p.z + normal.z * side * (W / 2)],
              [p.x + normal.x * side * (W / 2), p.y + 0.75, p.z + normal.z * side * (W / 2)],
              0.05,
            ),
          );
      }
      for (const side of [-1, 1]) {
        for (const y of [0.45, 0.75]) {
          const pts: THREE.Vector3[] = [];
          for (let k = 0; k <= 30; k++) {
            const q = pamban.at(b0 + ((b1 - b0) * k) / 30);
            pts.push(
              new THREE.Vector3(
                q.p.x + q.normal.x * side * (W / 2),
                q.p.y + 0.1 + y,
                q.p.z + q.normal.z * side * (W / 2),
              ),
            );
          }
          scene.add(
            new THREE.Mesh(
              new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.045, 6),
              kit.mat("#f5f5f2"),
            ),
          );
        }
      }
      // the old railway bridge, 5 units to the north (-z)
      const r0 = pamban.at(b0).p;
      const r1 = pamban.at(b1).p;
      const railZ = Math.min(r0.z, r1.z) - 5;
      const x0 = 42.5;
      const x1 = Math.max(r1.x + 2, 63);
      const mid = (x0 + x1) / 2;
      const gap = 2.6;
      for (let x = x0; x <= x1; x += 1.6) {
        if (Math.abs(x - mid) < gap) continue;
        const pier = box(kit, "#8d8a84", [-0.25, BED, -0.8], [0.25, 1.3, 0.8]);
        pier.position.set(x, pier.position.y, railZ);
        scene.add(pier);
      }
      for (const [a, b] of [
        [x0, mid - gap],
        [mid + gap, x1],
      ] as V2[]) {
        const deck = box(kit, "#6e6a64", [a, 1.3, railZ - 0.9], [b, 1.5, railZ + 0.9]);
        scene.add(deck);
        for (const dz of [-0.45, 0.45])
          scene.add(box(kit, "#b9b4ab", [a, 1.5, railZ + dz - 0.04], [b, 1.56, railZ + dz + 0.04]));
      }
      // Scherzer lift span: two leaves raised
      for (const side of [-1, 1]) {
        const leaf = new THREE.Group();
        leaf.add(box(kit, "#9a5b32", [0, 0, -0.9], [gap, 0.2, 0.9]));
        const tri = new THREE.Shape([
          new THREE.Vector2(0, 0.2),
          new THREE.Vector2(gap, 0.2),
          new THREE.Vector2(0.4, 1.5),
        ]);
        for (const z of [-0.9, 0.8]) {
          const plate = new THREE.Mesh(
            new THREE.ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: false }),
            kit.mat("#a8623a"),
          );
          plate.position.z = z;
          plate.castShadow = true;
          leaf.add(plate);
        }
        const piv = new THREE.Group();
        piv.add(leaf);
        piv.position.set(mid - side * gap, 1.5, railZ);
        piv.rotation.y = side > 0 ? 0 : Math.PI;
        leaf.rotation.z = 0.7;
        scene.add(piv);
      }
      // the train waits on the mainland side of the raised span
      const tr = train(kit, 1);
      tr.position.set(mid - gap - 4.0, 1.5, railZ);
      scene.add(tr);
      // a ship passing through the raised span
      const ship = new THREE.Group();
      const hull = new THREE.Shape([
        new THREE.Vector2(-3.0, 1.1),
        new THREE.Vector2(3.2, 1.1),
        new THREE.Vector2(2.5, 0),
        new THREE.Vector2(-2.6, 0),
      ]);
      const hg = new THREE.ExtrudeGeometry(hull, {
        depth: 1.4,
        bevelEnabled: true,
        bevelSize: 0.08,
        bevelThickness: 0.08,
        bevelSegments: 2,
      });
      hg.translate(0, 0, -0.7);
      const hm = new THREE.Mesh(hg, kit.mat("#2b4a7a"));
      hm.castShadow = true;
      ship.add(hm);
      ship.add(box(kit, "#f5f5f2", [-1.4, 1.1, -0.6], [0.4, 2.1, 0.6]));
      ship.add(box(kit, "#d93a2f", [-0.8, 2.1, -0.22], [-0.45, 2.7, 0.22]));
      ship.position.set(mid + 0.3, SEA - 0.3, railZ - 7);
      ship.rotation.y = Math.PI / 2;
      scene.add(ship);
      keepClear.push({ x: mid, z: railZ, r: 9 });
      // Dhanushkodi: ruins near the end of the spit, the Arichal Munai point
      const ru = { x: ISLAND[0] - 1, z: ISLAND[1] + 2.8, heading: 0.2 };
      placeOn(ruins(kit), ru.x, ru.z, ru.heading, 0.2, "build", 3.2);
      keepClear.push({ x: ru.x, z: ru.z, r: 4 });
      const dl = label(["DHANUSHKODI", "தனுஷ்கோடி"], "#ffffff", "#8a6a45", 0.6);
      dl.position.set(ru.x, height(ru.x, ru.z) + 4.2, ru.z);
      scene.add(dl);
      const end = pamban.at(0.995).p;
      placeOn(
        nhaiSign(kit, [{ local: "அரிச்சல் முனை", en: "Arichal Munai · Road ends" }], 3.0),
        end.x + 0.8,
        end.z + 1.8,
        pamban.at(0.995).heading - Math.PI / 2,
        0,
        "post",
        0.6,
      );
      for (let i = 0; i < 4; i++) {
        const bt = boat(kit, ["#3f9a8a", "#d93a2f", "#f2c14e", "#2f6db0"][i] ?? "#fff");
        bt.position.set(44 + i * 4, SEA, 14 + (i % 2) * 2.5);
        bt.rotation.y = i;
        scene.add(bt);
      }
    }

    // ── Kanyakumari: land's end, lighthouse, the rock memorial offshore
    const tTip = tNear(road, 0, 37);
    {
      const ke = beside(road, tTip, W / 2 + 2.4, 1);
      placeOn(
        nhaiSign(
          kit,
          [
            { local: "கன்னியாகுமரி", en: "Kanyakumari · Land's End" },
            { en: "Vivekananda Rock Memorial", arrow: "left" },
          ],
          3.2,
        ),
        ke.x,
        ke.z,
        road.at(tTip).heading - Math.PI / 2,
        0,
        "post",
        0.6,
      );
      const lh = beside(road, tTip + 0.012, 7.5, -1);
      placeOn(lighthouse(kit, 0.9), lh.x, lh.z, 0, 0, "build", 1.1);
      keepClear.push({ x: lh.x, z: lh.z, r: 3 });
      const ph = beside(road, tTip - 0.008, W / 2 + 2.6, 1);
      placeOn(photoSpot(kit), ph.x, ph.z);
      const isl = memorial(kit);
      isl.position.set(MEMORIAL[0], base(MEMORIAL[0], MEMORIAL[1]) - 0.1, MEMORIAL[1]);
      isl.rotation.y = 0.4;
      scene.add(isl);
    }

    // ── Varkala: laterite cliffs, cliff café, surfers and kayaks below,
    // Jatayu on its hill, fishing nets and a houseboat on the backwater.
    {
      const tv = tNear(road, -55, -26);
      const vc = beside(road, tv, W / 2 + 4.0, -1);
      placeOn(cliffCafe(kit), vc.x, vc.z, road.at(tv).heading, 0, "build", 3.4);
      keepClear.push({ x: vc.x, z: vc.z, r: 5 });
      const ph = beside(road, tv + 0.01, W / 2 + 2.4, -1);
      placeOn(photoSpot(kit), ph.x, ph.z);
      for (let i = 0; i < 5; i++) {
        const x = -74 + i * 2.6;
        const z = -22 - i * 3.2 + (i % 2) * 2;
        const s = surfer(
          kit,
          ["#f2c14e", "#e05a6b", "#ffffff", "#3f9a8a", "#ff8f3c"][i] ?? "#fff",
          ["#2b6cb0", "#d93a2f", "#f2c14e", "#1f6b3a", "#5a7fd0"][i] ?? "#fff",
        );
        s.position.set(x, SEA, z);
        s.rotation.y = 0.9;
        scene.add(s);
      }
      for (let i = 0; i < 3; i++) {
        const k = kayak(kit, ["#d93a2f", "#f2c14e", "#3f9a8a"][i] ?? "#fff");
        k.position.set(-66 + i * 3, SEA, -6 - i * 4);
        k.rotation.y = 0.4 + i;
        scene.add(k);
      }
      placeOn(jatayu(kit), JATAYU[0], JATAYU[1], -0.4, 0.6, "build", 6);
      keepClear.push({ x: JATAYU[0], z: JATAYU[1], r: 8 });
      const jl = label(["JATAYU EARTH'S CENTER", "ജടായു"], "#ffffff", "#5a5048", 0.55);
      jl.position.set(JATAYU[0], height(JATAYU[0], JATAYU[1]) + 7.5, JATAYU[1]);
      scene.add(jl);
      // backwater lagoon with a houseboat, Chinese fishing nets on the shore
      const lagoon = new THREE.Mesh(new THREE.CircleGeometry(1, 64), kit.mat("#2f8f8a"));
      lagoon.rotation.x = -Math.PI / 2;
      lagoon.scale.set(7.2, 1, 4.4);
      lagoon.position.set(LAGOON[0], -0.6, LAGOON[1]);
      scene.add(lagoon);
      const hb = houseboat(kit);
      hb.position.set(LAGOON[0] + 1, -0.85, LAGOON[1]);
      hb.rotation.y = 0.3;
      scene.add(hb);
      for (let i = 0; i < 3; i++) {
        const x = LAGOON[0] - 5.5 + i * 2.6;
        const z = LAGOON[1] + 4.8 - Math.abs(i - 1) * 0.6;
        placeOn(fishingNet(kit), x, z, Math.PI / 2 + 0.3, 0.1, "build", 0.9);
      }
      keepClear.push({ x: LAGOON[0], z: LAGOON[1], r: 9 });
      const ml = beside(road, tNear(road, -52, -20), W / 2 + 2.2, -1);
      placeOn(
        nhaiSign(
          kit,
          [
            { local: "വർക്കല · സ്വാഗതം", en: "Welcome to Varkala" },
            { local: "ജടായു", en: "Jatayu Earth's Center", arrow: "right", km: 4 },
          ],
          3.2,
        ),
        ml.x,
        ml.z,
        road.at(tNear(road, -52, -20)).heading - Math.PI / 2,
        0,
        "post",
        0.6,
      );
    }

    // ── Lived-in: a temple town, road life, a bullock cart, coconut groves
    {
      /** Left lane / left verge (India drives on the left). */
      const left = (r: Road, t: number, off: number) => {
        const { p, heading } = r.at(t);
        return { x: p.x - Math.sin(heading) * off, z: p.z - Math.cos(heading) * off, heading };
      };
      // Temple town on the cross-country road: small gopuram, homes with kolams, flower sellers
      const tt = tNear(cross, 18, -22);
      const gp = landSpot(cross, tt, W / 2 + 5.5);
      const gpr = cross.at(tt).p;
      placeOn(gopuramSmall(kit), gp.x, gp.z, faceTo(gp.x, gp.z, gpr.x, gpr.z), 0, "build", 1.9);
      keepClear.push({ x: gp.x, z: gp.z, r: 3.5 });
      const tl = label(["கோவில் · TEMPLE TOWN"], "#ffffff", "#8a2a22", 0.38);
      tl.position.set(gp.x, height(gp.x, gp.z) + 6.8, gp.z);
      scene.add(tl);
      const homeCols = ["#e9a0b8", "#9fd0c6", "#f2d36b", "#b9c8f0", "#f2b48a"];
      for (let i = 0; i < 6; i++) {
        const t = tt + (i < 3 ? -1 : 1) * (0.012 + (i % 3) * 0.009);
        const side = i % 2 ? 1 : -1;
        const h = beside(cross, t, W / 2 + 3.6, side);
        const rp = cross.at(t).p;
        const yaw = faceTo(h.x, h.z, rp.x, rp.z);
        const home = new THREE.Group();
        home.add(box(kit, homeCols[i % 5] ?? "#eee", [-1.2, -2, -1.0], [1.2, 1.7, 1.0]));
        home.add(box(kit, "#c9763f", [-1.4, 1.7, -1.2], [1.4, 1.85, 1.2]));
        home.add(box(kit, "#5a3b24", [-0.35, 0, 0.98], [0.35, 1.2, 1.04]));
        home.add(tube(kit, "#f2e6cf", [-1.1, 0, 1.6], [-1.1, 1.7, 1.6], 0.06));
        home.add(tube(kit, "#f2e6cf", [1.1, 0, 1.6], [1.1, 1.7, 1.6], 0.06));
        home.add(box(kit, "#c9763f", [-1.4, 1.7, 1.0], [1.4, 1.78, 1.9]));
        placeOn(home, h.x, h.z, yaw, 0, "build", 1.4);
        keepClear.push({ x: h.x, z: h.z, r: 2.6 });
        const kx = h.x + Math.sin(yaw) * 2.3;
        const kz = h.z + Math.cos(yaw) * 2.3;
        placeOn(kolam(), kx, kz, 0, 0, "prop", 0.6);
      }
      for (let i = 0; i < 2; i++) {
        const f = left(cross, tt + 0.004 + i * 0.01, W / 2 + 1.3);
        placeOn(flowerSeller(kit), f.x, f.z, f.heading, 0, "post", 0.4);
      }
      // Bullock cart on the village lane near the paddies
      const bc = left(cross, tNear(cross, -16, -15), W / 4);
      placeOn(bullockCart(kit), bc.x, bc.z, bc.heading, 0, "prop", 1.0);
      // Road life on the coast road: buses, tea stalls, families on scooters, a coconut moped
      for (const [tq, kind] of [
        [tNear(road, 20, 24), "bus"],
        [tNear(road, -26, 17), "tea"],
        [tNear(road, 56, -31), "tea"],
        [tNear(road, -10, -51), "bus"],
      ] as [number, string][]) {
        const v = landSpot(road, tq, W / 2 + 2.4);
        const yaw = road.at(tq).heading - Math.PI / 2;
        if (kind === "bus") {
          placeOn(
            busShelter(kit),
            v.x,
            v.z,
            landSide(road, tq) > 0 ? yaw + Math.PI : yaw,
            0,
            "post",
            1.2,
          );
          const b = left(road, tq + 0.006, W / 4);
          placeOn(bus(kit), b.x, b.z, b.heading, 0, "prop", 1.6);
        } else {
          const rp = road.at(tq).p;
          placeOn(teaStall(kit), v.x, v.z, faceTo(v.x, v.z, rp.x, rp.z), 0, "build", 1.4);
          for (let k = 0; k < 2; k++)
            placeOn(
              person(kit, ["#ffffff", "#2b6cb0"][k] ?? "#fff"),
              v.x + 1.2 + k * 0.6,
              v.z + 0.8,
              0,
              0,
              "post",
              0.3,
            );
        }
        keepClear.push({ x: v.x, z: v.z, r: 2.4 });
      }
      for (const [tq, riders, coco, col] of [
        [0.13, 3, false, "#d93a2f"],
        [0.31, 2, false, "#2b6cb0"],
        [0.47, 1, true, "#3f9a8a"],
        [0.62, 3, false, "#f2c14e"],
        [0.86, 1, true, "#e05a6b"],
      ] as [number, number, boolean, string][]) {
        const sc = left(road, tq, W / 4);
        placeOn(scooter(kit, col, riders, coco), sc.x, sc.z, sc.heading, 0, "prop", 0.5);
      }
    }

    // ── Theri Kaadu: a red-dune off-road loop, marked by a sign
    {
      const ts = beside(road, dFrom - 0.006, W / 2 + 1.8, -1);
      placeOn(
        signBoard(
          kit,
          ["தேரிக்காடு · RED DUNES", "OFF-ROAD · 4x4 & BIKES"],
          "#ffffff",
          "#9a3e22",
          0.42,
        ),
        ts.x,
        ts.z,
      );
      keepClear.push({ x: DUNES[0], z: DUNES[1], r: 9 });
    }

    // ── The arrival gateway (first-visit spawn) on the cross-country road
    {
      const st = tNear(cross, SPAWN[0], SPAWN[1]);
      const at = cross.at(st);
      const gate = welcomeArch(kit, W);
      gate.position.set(at.p.x, at.p.y, at.p.z);
      gate.rotation.y = at.heading;
      scene.add(gate);
      const ahead = cross.at(Math.min(1, st + 0.03)).p;
      const m = spawnMarker();
      m.position.set(ahead.x, ahead.y, ahead.z);
      scene.add(m);
      keepClear.push({ x: at.p.x, z: at.p.z, r: 6 });
    }

    // ── English junction signposts at the crossroads
    const junction = (r: Road, t: number, side: 1 | -1, lines: SignLine[]) => {
      const at = beside(r, t, W / 2 + 1.9, side);
      placeOn(nhaiSign(kit, lines, 3.0, 1.5), at.x, at.z, at.heading - Math.PI / 2, 0, "post", 0.6);
      keepClear.push({ x: at.x, z: at.z, r: 2 });
    };
    // Ring runs clockwise (Chennai → south down the east coast).
    junction(road, cFrom - 0.008, 1, [
      { local: "வரவேற்பு வாயில்", en: "Arrival Gate · Varkala", arrow: "right", km: 34 },
      { local: "புதுச்சேரி", en: "Puducherry", arrow: "up", km: 6 },
    ]);
    junction(road, cTo - 0.008, 1, [
      { local: "വർക്കല", en: "Varkala · Jatayu", arrow: "up", km: 18 },
      { local: "வரவேற்பு வாயில்", en: "Arrival Gate · Chennai", arrow: "right", km: 32 },
    ]);
    junction(road, tNear(road, 34, 8) - 0.008, 1, [
      { local: "பாம்பன் · தனுஷ்கோடி", en: "Pamban · Dhanushkodi", arrow: "up-left", km: 22 },
      { local: "கன்னியாகுமரி", en: "Kanyakumari", arrow: "up", km: 64 },
    ]);
    junction(road, dFrom - 0.012, 1, [
      { local: "தேரிக்காடு", en: "Theri Kaadu (off-road)", arrow: "right", km: 3 },
      { local: "கன்னியாகுமரி", en: "Kanyakumari", arrow: "up", km: 41 },
    ]);

    // ── Stops (postcards) spread to be discovered: ring corners + branches
    const corners = road
      .corners(0.012)
      .filter((t, i, all) =>
        all.slice(0, i).every((o) => Math.min(Math.abs(o - t), 1 - Math.abs(o - t)) > 0.07),
      );
    const stops = corners.slice(0, 5).sort((a, b) => a - b);
    const crossStops = [0.72];
    const dunesStops = [0.5];
    const cardCols = ["#3f9a8a", "#e9b44c", "#5a7fd0", "#e05a6b", "#7fbf5e", "#d9653b", "#21b5b8"];
    let n = 0;
    for (const [r, list] of [
      [road, stops],
      [cross, crossStops],
      [dunes, dunesStops],
    ] as const) {
      for (const t of list) {
        let p = beside(r, t, W / 2 + 2.6, "outside");
        if (
          height(p.x, p.z) < SEA + 0.4 ||
          keepClear.some((k) => (k.x - p.x) ** 2 + (k.z - p.z) ** 2 < k.r * k.r)
        )
          p = beside(r, t, W / 2 + 2.6, "inside");
        placeOn(postcard(kit, n, cardCols[n] ?? "#3f9a8a"), p.x, p.z, p.heading);
        const s = beside(r, t - 0.012, W / 2 + 1.0, "inside");
        if (r === road)
          placeOn(
            signBoard(kit, ["மெதுவாக செல்லவும்", "GO SLOW"], "#1d1f24", "#f2c14e", 0.32, 1.0),
            s.x,
            s.z,
          );
        else placeOn(cornerSign(kit, 30), s.x, s.z);
        n++;
      }
    }

    // ── Milestones along the coast road (yellow caps, counting km)
    for (let k = 0; k < 10; k++) {
      const t = (k * 0.1 + 0.04) % 1;
      const m = beside(road, t, W / 2 + 0.7, 1);
      if (
        height(m.x, m.z) < SEA + 0.3 ||
        keepClear.some((c) => (c.x - m.x) ** 2 + (c.z - m.z) ** 2 < c.r * c.r)
      )
        continue;
      placeOn(
        kmStone(kit, "KANYAKUMARI", Math.round(Math.abs(Math.sin(k)) * 300 + 20), "nh"),
        m.x,
        m.z,
        m.heading - Math.PI / 2,
        0,
        "post",
        0.25,
      );
    }

    // ── Palms everywhere coastal (fewer under the cyclone), birds over the sea
    const near = (x: number, z: number, r: number) =>
      [road, cross, pamban, dunes].some((rd) =>
        rd.samples.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < r * r),
      );
    let placed = 0;
    for (let i = 0; i < 1600 && placed < 190; i++) {
      const x = -86 + ((i * 53.7) % 172);
      const z = -54 + ((i * 31.3) % 108);
      const h = height(x, z);
      if (h < SEA + 0.6 || h > 6) continue;
      if (g2(x, z, DUNES[0], DUNES[1], 11, 9) > 0.3) continue;
      if (paddyK(x, z) > 0.4) continue;
      if (near(x, z, W / 2 + 2)) continue;
      if (keepClear.some((k) => (k.x - x) ** 2 + (k.z - z) ** 2 < k.r * k.r)) continue;
      const p = palm(kit, i % 2 ? "#3d9a5f" : "#4aa86a", "#8a6a45");
      if (x > 50 && z < -30) p.rotation.z = -0.35;
      placeOn(p, x, z, i);
      placed++;
    }
    for (const [x, z, r] of [
      [30, 30, 0.6],
      [-30, 30, 2.2],
      [76, -16, 1],
      [-74, -30, 2.6],
    ] as [number, number, number][]) {
      const f = flock(kit, 7);
      f.position.set(x, 8, z);
      f.rotation.y = r;
      scene.add(f);
    }

    // ── Settle the ground: level pads under buildings, rebuild roads on it,
    // then lay terrain, tarmac and every deferred object.
    height = flattenPads(carved, pads);
    ({ road, cross, dunes, pamban } = buildRoads());
    scene.add(
      noSelfShadow(
        terrain({
          w: 200,
          d: 136,
          height,
          mood: "vivid",
          density: 2.2,
          soft: 11,
          fall: 7,
          colour: (x, z, h, slope) => {
            const d = inland(x, z);
            if (h < SEA + 0.4) return "#e7d3a0";
            if (islandMask(x, z) > 0.4 && d < 0) return "#efdcae";
            const paddy = slope < 0.1 ? paddyColour(x, z) : null;
            if (paddy) return paddy;
            const dune = g2(x, z, DUNES[0], DUNES[1], 11, 9);
            if (dune > 0.35) return dune > 0.6 ? "#c4552f" : "#cf6a3f";
            if (x < -30 && slope > 0.14 && d < 9) return "#b4502f";
            if (d < 3.5) return "#ecd9a8";
            // Eastern Ghats: scrub on the foothills, dense forest higher, bare rock on the crests
            if (z < -26 && h > 3.2) {
              if (h > 10.5 || slope > 0.32) return h > 11.5 ? "#9a9184" : "#8a8a6e";
              if (h > 6.5) return Math.sin(x * 0.9 + z * 0.7) > 0.2 ? "#3f7a46" : "#467f4a";
              return Math.sin(x * 0.6) > 0.3 ? "#6a9a52" : "#74a457";
            }
            if (x > 40 && z < -30) return Math.sin(x * 0.5 + z * 0.4) > 0.4 ? "#a9b07a" : "#b3b886";
            return Math.sin(x * 0.5) * Math.cos(z * 0.5) > 0.5 ? "#7fbf5e" : "#8ac868";
          },
        }),
      ),
    );

    // Roads: tarmac ring and cross road, the Pamban road, and the dune track.
    scene.add(roadMesh(kit, road, W + 0.4, "#c9c3b4", 0.07));
    scene.add(roadMesh(kit, road, W, "#46474c", 0.1));
    scene.add(roadMesh(kit, road, 0.08, "#f2c14e", 0.13));
    scene.add(roadMesh(kit, cross, W - 0.6, "#4e4f55", 0.1));
    scene.add(roadMesh(kit, pamban, W - 0.4, "#46474c", 0.1));
    // Theri Kaadu is off-road: no tarmac, just ruts through the red sand.
    for (const off of [-0.5, 0.5])
      scene.add(partialRibbon(kit, dunes, 0.04, 0.96, 0.22, "#9a3e22", 0.06, off));
    for (const p of placements) {
      placeOnGround(p.o, height, p.x, p.z, {
        mode: p.kind === "prop" ? "align" : "upright",
        yaw: p.rot,
        footprint: p.foot,
      });
      p.o.position.y -= p.sink;
    }
    scene.add(distantHills(kit));

    // ── Moments: the board reads `built.road` and each moment's `t`; to put
    // some shots on branches, iterating the moments switches the active road.
    let active: Road = road;
    const shots: { m: Moment; road: Road }[] = [
      {
        m: {
          label:
            "Marina Beach in the cyclone: lighthouse, kites, sundal carts, and the 'Delhi 1,800 km' stone",
          t: tChennai,
          zoom: 30,
        },
        road,
      },
      {
        m: {
          label:
            "Mahabalipuram (cinematic): the shore temple on the sand, the rathas across the road",
          t: tMaha,
          zoom: 20,
          cinematic: { azimuth: 150, elevation: 15, distance: 17, fov: 50 },
        },
        road,
      },
      {
        m: {
          label: "Puducherry White Town: mustard villas, bougainvillea, the seaside promenade",
          t: tPondy,
          zoom: 24,
        },
        road,
      },
      {
        m: {
          label: "Theri Kaadu (cinematic): off-road through the red dunes, tyre ruts in the sand",
          t: 0.45,
          zoom: 20,
          cinematic: { azimuth: 320, elevation: 10, distance: 16, fov: 50 },
        },
        road: dunes,
      },
      {
        m: {
          label:
            "Pamban bridge (cinematic): the train waits beside you as the old lift span rises for a ship",
          t: tNear(pamban, 49, 5),
          zoom: 20,
          cinematic: { azimuth: 330, elevation: 11, distance: 17, fov: 50 },
        },
        road: pamban,
      },
      {
        m: {
          label:
            "Varkala: laterite cliffs, surfers and kayaks, Jatayu on its hill, a houseboat and Chinese nets",
          t: tNear(road, -54, -24),
          zoom: 40,
        },
        road,
      },
    ];
    const moments = shots.map((s) => s.m);
    (moments as unknown as { [Symbol.iterator]: () => Iterator<Moment> })[Symbol.iterator] =
      function* () {
        for (const s of shots) {
          active = s.road;
          yield s.m;
        }
        active = road;
      };

    const result: JourneyBuild = {
      get road() {
        return active;
      },
      stops,
      branches: [
        { road: cross, stops: crossStops, label: "Cross-country road (arrival gateway)" },
        { road: dunes, stops: dunesStops, label: "Theri Kaadu off-road loop" },
        { road: pamban, stops: [], label: "Pamban bridge spur to Dhanushkodi" },
      ],
      mapZoom: 150,
      mapCentre: [0, -2],
      moments,
    };
    return result;
  },
};
