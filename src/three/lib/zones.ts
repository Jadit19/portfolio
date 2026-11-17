/**
 * Environment concepts for each route (design previews only). Every zone is a
 * small island diorama built from the smooth kit, with its bike riding in it.
 * Colours are authored once ("vivid") and shifted per mood.
 */

import * as THREE from "three";
import type { BikeKind } from "../../content/types";
import { buildBike } from "./bikes";
import { box, disc, type Kit, makeKit, profile, sphere, tube } from "./kit";

export type Mood = "soft" | "vivid" | "golden" | "night";

export interface Light {
  sky: string;
  ground: string;
  hemi: number;
  sun: string;
  sunI: number;
  sunPos: [number, number, number];
  bg: string;
}

export const LIGHTS: Record<Mood, Omit<Light, "bg">> = {
  soft: {
    sky: "#ffffff",
    ground: "#e9dcc8",
    hemi: 2.0,
    sun: "#fff6ea",
    sunI: 1.5,
    sunPos: [-6, 14, 8],
  },
  vivid: {
    sky: "#e8f2ff",
    ground: "#c9b48a",
    hemi: 1.4,
    sun: "#fff2dc",
    sunI: 2.5,
    sunPos: [-7, 12, 7],
  },
  golden: {
    sky: "#ffe6cc",
    ground: "#6f5a44",
    hemi: 1.2,
    sun: "#ffc98f",
    sunI: 2.6,
    sunPos: [-12, 5, 4],
  },
  night: {
    sky: "#4a5aa0",
    ground: "#1d2238",
    hemi: 1.15,
    sun: "#a9bdff",
    sunI: 1.2,
    sunPos: [6, 10, -6],
  },
};

/** Shifts an authored colour into a mood. */
export function shift(hex: string, mood: Mood): string {
  const c = new THREE.Color(hex);
  switch (mood) {
    case "soft":
      return `#${c.lerp(new THREE.Color("#f7efe4"), 0.38).getHexString()}`;
    case "golden": {
      // Warm the light, not the paint. Near-whites (snow, whitewash, clouds)
      // and saturated greens are spared so snow stays white and leaves stay fresh.
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      const spare = THREE.MathUtils.clamp((hsl.l - 0.78) / 0.15, 0, 1);
      const warm = c
        .clone()
        .multiply(new THREE.Color("#fff4e8"))
        .lerp(new THREE.Color("#ffdcb8"), 0.05);
      return `#${warm.lerp(c, spare).getHexString()}`;
    }
    case "night":
      return `#${c.lerp(new THREE.Color("#1d2547"), 0.45).getHexString()}`;
    default:
      return hex;
  }
}

/** A kit whose colours are shifted into the mood (emissive lights stay bright). */
export function moodKit(base: Kit, mood: Mood): Kit {
  return {
    surface: base.surface,
    seg: base.seg,
    mat: (colour, opts) => base.mat(opts?.emissive ? colour : shift(colour, mood), opts),
  };
}

// ── Shared helpers ──────────────────────────────────────────────────────────

export type V2 = [number, number];

/** A flat ribbon (road, track, trail) following a smooth curve through points. */
export function ribbon(
  kit: Kit,
  colour: string,
  pts: V2[],
  width: number,
  y = 0.012,
  closed = false,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, y, z)),
    closed,
    "centripetal",
  );
  const n = 160;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nx = -tan.z;
    const nz = tan.x;
    const l = Math.hypot(nx, nz) || 1;
    pos.push(p.x + (nx / l) * (width / 2), y, p.z + (nz / l) * (width / 2));
    pos.push(p.x - (nx / l) * (width / 2), y, p.z - (nz / l) * (width / 2));
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, kit.mat(colour));
  m.material.side = THREE.DoubleSide;
  m.receiveShadow = true;
  return m;
}

/** Position + heading of a point along a curve, for placing the bike. */
export function along(
  pts: V2[],
  t: number,
  closed = false,
): { x: number; z: number; heading: number } {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    closed,
    "centripetal",
  );
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  return { x: p.x, z: p.z, heading: Math.atan2(-tan.z, tan.x) };
}

export function slab(kit: Kit, top: string, side: string, w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  // Tagged so a continuous island can drop the slab and reuse its ground colour.
  g.userData.slab = { top, w, d };
  g.add(box(kit, side, [-w / 2, -1.4, -d / 2], [w / 2, -0.08, d / 2]));
  g.add(box(kit, top, [-w / 2, -0.16, -d / 2], [w / 2, 0, d / 2]));
  return g;
}

export const at = (o: THREE.Object3D, x: number, z: number, rot = 0, s = 1): THREE.Object3D => {
  o.position.set(x, o.position.y, z);
  o.rotation.y = rot;
  o.scale.setScalar(s);
  return o;
};

export function roundTree(kit: Kit, leaf: string, trunk: string, h = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, trunk, [0, 0, 0], [0, 1.0 * h, 0], 0.12));
  g.add(sphere(kit, leaf, [0, 1.35 * h, 0], 0.62 * h));
  g.add(sphere(kit, leaf, [0.25 * h, 1.75 * h, 0.1], 0.38 * h));
  return g;
}

export function pine(kit: Kit, leaf: string, trunk: string, h = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, trunk, [0, 0, 0], [0, 0.6 * h, 0], 0.1));
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(
      new THREE.ConeGeometry((0.75 - i * 0.18) * h, 0.9 * h, 20),
      kit.mat(leaf),
    );
    c.position.y = (0.85 + i * 0.5) * h;
    c.castShadow = true;
    g.add(c);
  }
  return g;
}

export function palm(kit: Kit, leaf: string, trunk: string): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, trunk, [0, 0, 0], [0.25, 1.4, 0], 0.09));
  g.add(tube(kit, trunk, [0.25, 1.4, 0], [0.45, 2.4, 0], 0.08));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leafMesh = box(kit, leaf, [0, -0.03, -0.12], [0.9, 0.03, 0.12]);
    const pivot = new THREE.Group();
    pivot.position.set(0.45, 2.4, 0);
    pivot.rotation.y = a;
    leafMesh.rotation.z = -0.45;
    pivot.add(leafMesh);
    g.add(pivot);
  }
  return g;
}

export function flagPole(kit: Kit, colour: string, h = 1.6): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#e6e6e6", [0, 0, 0], [0, h, 0], 0.025));
  g.add(box(kit, colour, [0.02, h - 0.4, -0.01], [0.5, h - 0.05, 0.01]));
  return g;
}

export function lampPost(kit: Kit, lamp: string, h = 2.3): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#3a3d44", [0, 0, 0], [0, h, 0], 0.045));
  g.add(sphere(kit, lamp, [0, h + 0.1, 0], 0.14, { emissive: true }));
  return g;
}

export function nightLight(
  scene: THREE.Scene,
  mood: Mood,
  x: number,
  y: number,
  z: number,
  colour: string,
  power = 6,
): void {
  if (mood !== "night" && mood !== "golden") return;
  const l = new THREE.PointLight(colour, mood === "night" ? power : power * 0.3, 6, 1.6);
  l.position.set(x, y, z);
  scene.add(l);
}

export function rider(
  kit: Kit,
  kind: BikeKind,
  x: number,
  z: number,
  heading: number,
  lean = 0,
): THREE.Group {
  const b = buildBike(kit, kind);
  const pivot = new THREE.Group();
  pivot.add(b);
  b.rotation.x = lean;
  pivot.position.set(x, 0, z);
  pivot.rotation.y = heading;
  pivot.scale.setScalar(1.25);
  return pivot;
}

// ── Zones ──────────────────────────────────────────────────────────────────

export interface ZoneDef {
  id: string;
  title: string;
  bike: BikeKind;
  bg: Partial<Record<Mood, string>>;
  moods: Mood[];
  build(scene: THREE.Scene, kit: Kit, bikeKit: Kit, mood: Mood): void;
}

export const BG: Record<Mood, string> = {
  soft: "#f4ede2",
  vivid: "#bfe0f5",
  golden: "#f3c79a",
  night: "#0f1428",
};

export const ZONES: ZoneDef[] = [
  {
    id: "winzo",
    title: "WinZO · the circuit",
    bike: "superbike",
    bg: {},
    moods: ["soft", "vivid", "golden"],
    build(scene, k, bk, mood) {
      scene.add(slab(k, "#6aa84f", "#7a5a3c", 16, 12));
      const track: V2[] = [
        [-6.5, 2.5],
        [-2, 3.6],
        [3.5, 3.2],
        [6.2, 0.6],
        [4.8, -2.6],
        [0, -3.4],
        [-5.2, -2.4],
        [-6.8, 0],
      ];
      scene.add(ribbon(k, "#d93a2f", track, 2.35, 0.01, true));
      scene.add(ribbon(k, "#f3f3f1", track, 2.15, 0.012, true));
      scene.add(ribbon(k, "#3a3d44", track, 1.95, 0.014, true));
      // start/finish gantry
      const gantry = new THREE.Group();
      gantry.add(tube(k, "#e6e6e6", [0, 0, -1.3], [0, 2.4, -1.3], 0.06));
      gantry.add(tube(k, "#e6e6e6", [0, 0, 1.3], [0, 2.4, 1.3], 0.06));
      gantry.add(box(k, "#d93a2f", [-0.12, 2.1, -1.4], [0.12, 2.55, 1.4]));
      for (let i = 0; i < 8; i++)
        gantry.add(
          box(
            k,
            i % 2 ? "#111111" : "#ffffff",
            [-0.13, 2.2, -1.2 + i * 0.3],
            [0.13, 2.45, -0.9 + i * 0.3],
          ),
        );
      scene.add(at(gantry, 1.2, 3.35, Math.PI / 2 - 0.05));
      // grandstand
      const stand = new THREE.Group();
      for (let i = 0; i < 4; i++)
        stand.add(
          box(
            k,
            i % 2 ? "#9aa3b2" : "#aeb6c4",
            [-3, 0, -0.5 - i * 0.45],
            [3, 0.4 + i * 0.35, -0.05 - i * 0.45],
          ),
        );
      for (let i = 0; i < 40; i++)
        stand.add(
          sphere(
            k,
            ["#d93a2f", "#f2c14e", "#ffffff", "#2b6cb0"][i % 4] ?? "#fff",
            [
              -2.8 + (i % 20) * 0.29,
              0.62 + Math.floor(i / 20) * 0.7,
              -0.75 - Math.floor(i / 20) * 0.9,
            ],
            0.09,
          ),
        );
      stand.add(box(k, "#e9ecef", [-3.2, 2.2, -2.3], [3.2, 2.3, 0.1]));
      scene.add(at(stand, 0, -4.6));
      // pit garages
      for (let i = 0; i < 3; i++) {
        const pit = new THREE.Group();
        pit.add(box(k, "#eef0f2", [-0.7, 0, -0.6], [0.7, 1.0, 0.6]));
        pit.add(box(k, "#d93a2f", [-0.75, 1.0, -0.65], [0.75, 1.12, 0.65]));
        pit.add(box(k, "#2c2f36", [-0.45, 0, 0.59], [0.45, 0.75, 0.62]));
        scene.add(at(pit, -4 + i * 1.6, 5.3));
      }
      // tyre walls + cones + floodlights
      for (let i = 0; i < 6; i++)
        scene.add(
          at(
            disc(k, i % 2 ? "#f3f3f1" : "#1f2024", [0, 0.12, 0], 0.22, 0.24),
            6.9,
            -0.6 + i * 0.4,
            Math.PI / 2,
          ),
        );
      for (const [x, z] of [
        [-7.2, -5],
        [7.2, -5],
        [7.2, 5],
        [-7.2, 5],
      ] as V2[]) {
        const fl = new THREE.Group();
        fl.add(tube(k, "#4b5058", [0, 0, 0], [0, 3.6, 0], 0.07));
        fl.add(box(k, "#2c3036", [-0.4, 3.5, -0.15], [0.4, 3.85, 0.15]));
        for (let i = 0; i < 3; i++)
          fl.add(sphere(k, "#fffbe8", [-0.25 + i * 0.25, 3.68, 0.17], 0.08, { emissive: true }));
        scene.add(at(fl, x, z));
        nightLight(scene, mood, x, 3.6, z, "#fff6d8", 10);
      }
      for (const [x, z] of [
        [2, -0.5],
        [-1.5, 0.4],
        [3.6, 0.8],
      ] as V2[])
        scene.add(at(roundTree(k, "#4f9a45", "#6b4a32", 0.8), x, z));
      const p = along(track, 0.08, true);
      scene.add(rider(bk, "superbike", p.x, p.z, p.heading, -0.35));
    },
  },
  {
    id: "zingle",
    title: "Zingle · the rally stage",
    bike: "rally",
    bg: {},
    moods: ["soft", "vivid", "golden"],
    build(scene, k, bk) {
      scene.add(slab(k, "#e8c48a", "#b98552", 16, 12));
      const piste: V2[] = [
        [-8, 3.5],
        [-4, 2.2],
        [-1, 3.5],
        [2.5, 1.2],
        [5, 2.6],
        [8, 0.5],
      ];
      scene.add(ribbon(k, "#d9ad6f", piste, 1.4));
      for (const [x, z, s] of [
        [-5, -2.5, 1.6],
        [0.5, -3.5, 2.1],
        [5.5, -2.8, 1.5],
        [-2, -0.8, 0.9],
        [6, 4.7, 1.1],
        [-6.5, 5, 1],
      ] as [number, number, number][]) {
        const dune = sphere(k, "#e3b97b", [0, 0, 0], 1, undefined, [s * 1.6, s * 0.55, s]);
        scene.add(at(dune, x, z));
      }
      for (const [x, z, c] of [
        [-4, 1.1, "#f26a1b"],
        [-0.8, 4.4, "#1d2d5c"],
        [2.6, 0.2, "#f26a1b"],
        [5.2, 3.6, "#1d2d5c"],
      ] as [number, number, string][])
        scene.add(at(flagPole(k, c), x, z));
      // bivouac tents
      for (const [x, z, c] of [
        [-6.4, -0.6, "#f26a1b"],
        [-5.4, -1.4, "#2b6cb0"],
        [-4.2, -0.4, "#f2c14e"],
      ] as [number, number, string][]) {
        const t = sphere(k, c, [0, 0, 0], 0.55, undefined, [1, 0.75, 1]);
        scene.add(at(t, x, z));
      }
      // support truck
      const truck = new THREE.Group();
      truck.add(box(k, "#f2f2ef", [-1.2, 0.3, -0.5], [0.4, 1.35, 0.5]));
      truck.add(box(k, "#f26a1b", [0.4, 0.3, -0.5], [1.1, 1.15, 0.5]));
      truck.add(box(k, "#9fc3e6", [0.85, 0.75, -0.42], [1.12, 1.05, 0.42], { glass: true }));
      for (const x of [-0.8, 0.7])
        for (const z of [-0.5, 0.5]) truck.add(at(disc(k, "#1c1d21", [0, 0.3, 0], 0.3, 0.2), x, z));
      scene.add(at(truck, 3.8, -1.2, 0.4));
      for (const [x, z] of [
        [1.5, -1.8],
        [-2.8, 5],
        [7, -4.5],
      ] as V2[]) {
        const r = sphere(k, "#b07a52", [0, 0.2, 0], 0.4, undefined, [1.3, 0.8, 1]);
        scene.add(at(r, x, z));
      }
      for (const [x, z] of [
        [-7, -4.5],
        [7.2, 4.8],
      ] as V2[]) {
        const acacia = new THREE.Group();
        acacia.add(tube(k, "#6b4a32", [0, 0, 0], [0.2, 1.3, 0], 0.08));
        acacia.add(sphere(k, "#7c9a4c", [0.2, 1.4, 0], 0.7, undefined, [1.4, 0.35, 1.2]));
        scene.add(at(acacia, x, z));
      }
      const p = along(piste, 0.45);
      scene.add(rider(bk, "rally", p.x, p.z, p.heading, 0.1));
    },
  },
  {
    id: "expresso",
    title: "Expresso · the café",
    bike: "cafe",
    bg: {},
    moods: ["soft", "vivid", "golden"],
    build(scene, k, bk, mood) {
      scene.add(slab(k, "#b9b0a3", "#6f5a48", 16, 12));
      scene.add(box(k, "#4a4642", [-8, 0, -0.9], [8, 0.02, 1.4]));
      for (let i = -7; i <= 7; i += 1.4)
        scene.add(box(k, "#e9e4da", [i, 0.021, 0.2], [i + 0.6, 0.03, 0.3]));
      scene.add(box(k, "#cfc6b8", [-8, 0, -2.0], [8, 0.14, -0.9]));
      // café building
      const cafe = new THREE.Group();
      cafe.add(box(k, "#2a4a3a", [-2.6, 0, -1.6], [2.6, 2.6, 1.2]));
      cafe.add(box(k, "#efe2c4", [-2.7, 2.6, -1.7], [2.7, 2.9, 1.3]));
      cafe.add(
        box(k, "#ffe3a6", [-2.2, 0.4, 1.19], [-0.5, 1.8, 1.22], {
          emissive: mood === "night" || mood === "golden",
        }),
      );
      cafe.add(
        box(k, "#ffe3a6", [0.5, 0.4, 1.19], [2.2, 1.8, 1.22], {
          emissive: mood === "night" || mood === "golden",
        }),
      );
      cafe.add(box(k, "#5a3b28", [-0.35, 0, 1.19], [0.35, 1.7, 1.24]));
      for (let i = 0; i < 9; i++)
        cafe.add(
          box(
            k,
            i % 2 ? "#efe2c4" : "#2a4a3a",
            [-2.7 + i * 0.6, 1.95, 1.2],
            [-2.1 + i * 0.6, 2.05, 1.95],
          ),
        );
      cafe.add(box(k, "#e98a4a", [-1.2, 2.2, 1.23], [1.2, 2.5, 1.27], { emissive: true }));
      scene.add(at(cafe, -1.0, -3.4));
      nightLight(scene, mood, -1.0, 1.6, -1.6, "#ffd28a", 8);
      // tables + parasols
      for (const [x, c] of [
        [-4.6, "#d93a2f"],
        [1.8, "#f2c14e"],
        [3.8, "#2a4a3a"],
      ] as [number, string][]) {
        const t = new THREE.Group();
        t.add(tube(k, "#3a3d44", [0, 0, 0], [0, 0.6, 0], 0.03));
        t.add(disc(k, "#efe2c4", [0, 0.62, 0], 0.32, 0.04));
        t.add(tube(k, "#d9d9d9", [0, 0.6, 0], [0, 1.6, 0], 0.025));
        const para = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.35, 16), k.mat(c));
        para.position.y = 1.65;
        para.castShadow = true;
        t.add(para);
        t.add(sphere(k, "#ffffff", [0.4, 0.68, 0], 0.07));
        scene.add(at(t, x, -1.45));
      }
      // chalk menu A-frame
      const menu = new THREE.Group();
      menu.add(
        profile(
          k,
          "#2a2725",
          [
            [-0.35, 0],
            [0.35, 0],
            [0.1, 1.0],
            [-0.1, 1.0],
          ],
          0.08,
        ),
      );
      menu.add(box(k, "#5a3b28", [-0.38, 0, -0.06], [0.38, 0.06, 0.06]));
      scene.add(at(menu, 5.4, -1.4, Math.PI / 2));
      // shops + lamps + street trees
      scene.add(at(box(k, "#b4503a", [-1.2, 0, -1.1], [1.2, 2.2, 1.1]), 5.6, -3.6));
      scene.add(at(box(k, "#e9d3ad", [-1.2, 0, -1.1], [1.2, 1.8, 1.1]), -6.0, -3.6));
      for (const x of [-6.5, -2.5, 2.5, 6.5]) {
        scene.add(at(lampPost(k, "#ffe3a6"), x, -1.0));
        nightLight(scene, mood, x, 2.3, -1.0, "#ffd28a", 5);
      }
      for (const x of [-5.5, -1.5, 3.0, 6.5])
        scene.add(at(roundTree(k, "#5f8f4e", "#6b4a32", 0.9), x, 3.6));
      // parked café racer + the riding one
      scene.add(rider(bk, "cafe", -3.6, -1.4, Math.PI * 0.85));
      scene.add(rider(bk, "cafe", 0.6, 0.35, 0, -0.08));
    },
  },
  {
    id: "fun",
    title: "C++ for fun · the village fair",
    bike: "scrambler",
    bg: {},
    moods: ["soft", "vivid", "night"],
    build(scene, k, bk, mood) {
      scene.add(slab(k, "#d6b07f", "#9a6b45", 16, 12));
      const lane: V2[] = [
        [-8, 1],
        [-3, 0.2],
        [1, 1.4],
        [4.5, 0.4],
        [8, 1.2],
      ];
      scene.add(ribbon(k, "#c49a68", lane, 1.6));
      // striped stalls
      for (const [x, z, c] of [
        [-4.6, -2.4, "#ef476f"],
        [-1.2, -2.8, "#118ab2"],
        [2.2, -2.4, "#f2b705"],
      ] as [number, number, string][]) {
        const s = new THREE.Group();
        s.add(box(k, "#f5efe6", [-1, 0, -0.7], [1, 1.1, 0.7]));
        for (let i = 0; i < 6; i++)
          s.add(
            box(
              k,
              i % 2 ? "#ffffff" : c,
              [-1.1 + i * 0.37, 1.6, -0.9],
              [-0.73 + i * 0.37, 1.75, 0.9],
            ),
          );
        for (const px of [-0.95, 0.95])
          s.add(tube(k, "#ffffff", [px, 0, 0.75], [px, 1.62, 0.75], 0.03));
        s.add(box(k, "#8a5a3a", [-0.9, 0.5, 0.6], [0.9, 0.75, 0.95]));
        scene.add(at(s, x, z));
        nightLight(scene, mood, x, 1.5, z + 1, "#ffcf7a", 5);
      }
      // Ferris wheel
      const fw = new THREE.Group();
      const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.06, 8, 48), k.mat("#ef476f"));
      wheelRim.position.y = 2.8;
      fw.add(wheelRim);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        fw.add(
          tube(k, "#ef476f", [0, 2.8, 0], [Math.cos(a) * 2.2, 2.8 + Math.sin(a) * 2.2, 0], 0.03),
        );
        fw.add(
          box(
            k,
            ["#118ab2", "#f2b705", "#06d6a0", "#ef476f"][i % 4] ?? "#fff",
            [Math.cos(a) * 2.2 - 0.22, 2.55 + Math.sin(a) * 2.2, -0.2],
            [Math.cos(a) * 2.2 + 0.22, 2.9 + Math.sin(a) * 2.2, 0.2],
          ),
        );
      }
      fw.add(tube(k, "#2b1d3a", [-1, 0, 0.2], [0, 2.8, 0.2], 0.07));
      fw.add(tube(k, "#2b1d3a", [1, 0, 0.2], [0, 2.8, 0.2], 0.07));
      scene.add(at(fw, 5.4, -1.8, -0.5, 0.8));
      nightLight(scene, mood, 5.4, 2.4, -1.4, "#ff7ab0", 8);
      // well of death drum
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.4, 1.3, 32, 1, true),
        k.mat("#8a5a3a"),
      );
      drum.position.y = 0.65;
      drum.material.side = THREE.DoubleSide;
      drum.castShadow = true;
      scene.add(at(drum, -5.5, 3.6));
      // bunting + balloons + string-light poles
      for (const [x, z] of [
        [-1.8, 3.6],
        [1.6, 3.8],
        [4.6, 3.2],
      ] as V2[]) {
        const cart = new THREE.Group();
        cart.add(box(k, "#2f6db0", [-0.4, 0.2, -0.3], [0.4, 0.6, 0.3]));
        ["#ef476f", "#f2b705", "#06d6a0", "#118ab2"].forEach((c, i) => {
          cart.add(tube(k, "#ffffff", [0, 0.6, 0], [(i - 1.5) * 0.18, 1.6, 0], 0.006));
          cart.add(sphere(k, c, [(i - 1.5) * 0.18, 1.7, 0], 0.16));
        });
        scene.add(at(cart, x, z));
      }
      for (let i = 0; i < 14; i++) {
        const tri = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.38, 3),
          k.mat(["#ef476f", "#f2b705", "#06d6a0", "#118ab2"][i % 4] ?? "#fff"),
        );
        tri.rotation.x = Math.PI;
        tri.position.set(-6.5 + i * 0.7, 2.1 - Math.sin((i / 13) * Math.PI) * 0.3, -1.1);
        scene.add(tri);
      }
      const p = along(lane, 0.55);
      scene.add(rider(bk, "scrambler", p.x, p.z, p.heading));
    },
  },
  {
    id: "astro",
    title: "Astronomy Club · the climb to Hanle",
    bike: "adv",
    bg: { soft: "#273061", vivid: "#151b3d", golden: "#3b2a52" },
    moods: ["soft", "vivid", "night"],
    build(scene, k, bk, mood) {
      scene.add(slab(k, "#a9a3a0", "#6e6460", 16, 12));
      // terraces stepping up toward the back
      for (let i = 0; i < 3; i++)
        scene.add(
          box(
            k,
            i === 2 ? "#e9edf3" : "#b8b2ae",
            [-8, 0, -6 + i * 0],
            [8, 0.5 + i * 0.5, -3.2 - i * 0.9],
          ),
        );
      const road: V2[] = [
        [-7.5, 4.5],
        [-2, 4],
        [3.5, 2.8],
        [-1, 1.2],
        [-6, 0.6],
        [-3, -0.8],
        [4, -1.4],
      ];
      scene.add(ribbon(k, "#e9edf3", road, 1.55));
      scene.add(ribbon(k, "#3d4048", road, 1.3, 0.016));
      for (const [x, z, s] of [
        [5.8, 4.4, 1],
        [-6.8, 2.6, 0.8],
        [6.6, 0.8, 0.9],
        [1, 5.2, 0.7],
      ] as [number, number, number][]) {
        const r = new THREE.Group();
        r.add(sphere(k, "#8d8580", [0, 0.35, 0], 0.6, undefined, [1.2, 0.8, 1]));
        r.add(sphere(k, "#f3f5f8", [0, 0.72, 0], 0.4, undefined, [1.1, 0.45, 0.9]));
        scene.add(at(r, x, z, 0, s));
      }
      // observatory domes on the top terrace
      for (const [x, s] of [
        [-3.5, 1],
        [0.5, 1.3],
        [4.5, 0.9],
      ] as [number, number][]) {
        const obs = new THREE.Group();
        obs.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.0, 32), k.mat("#eef1f5")));
        obs.children[0]?.position.set(0, 0.5, 0);
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.92, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
          k.mat("#d9dee6"),
        );
        dome.position.y = 1.0;
        obs.add(dome);
        obs.add(box(k, "#2c3140", [-0.12, 1.2, -0.1], [0.12, 1.85, 0.94]));
        obs.traverse((c) => {
          if (c instanceof THREE.Mesh) c.castShadow = true;
        });
        scene.add(at(obs, x, -5.2, 0, s * 0.7));
        obs.position.y = 1.5;
      }
      // prayer flags
      for (let i = 0; i < 12; i++) {
        const f = box(
          k,
          ["#2b6cb0", "#f3f5f8", "#d93a2f", "#4f9a45", "#f2c14e"][i % 5] ?? "#fff",
          [0, 0, 0],
          [0.2, 0.25, 0.02],
        );
        f.position.set(-7 + i * 0.5, 1.6 - Math.sin((i / 11) * Math.PI) * 0.35, 2.4);
        scene.add(f);
      }
      scene.add(at(tube(k, "#6b4a32", [0, 0, 0], [0, 1.7, 0], 0.03), -7.1, 2.4));
      scene.add(at(tube(k, "#6b4a32", [0, 0, 0], [0, 1.7, 0], 0.03), -1.3, 2.4));
      // glowing star markers (stops) + rocket on its pad
      for (const [x, z] of [
        [-2.2, 3.1],
        [2.4, 1.9],
        [-4.6, -0.1],
      ] as V2[]) {
        const star = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.22),
          k.mat("#ffd27a", { emissive: true }),
        );
        star.position.set(x, 1.4, z);
        scene.add(star);
        nightLight(scene, mood, x, 1.4, z, "#ffd27a", 4);
      }
      const rocket = new THREE.Group();
      rocket.add(box(k, "#9aa3ad", [-0.5, 0, -0.5], [0.5, 0.15, 0.5]));
      rocket.add(tube(k, "#f3f5f8", [0, 0.15, 0], [0, 1.6, 0], 0.2));
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 24), k.mat("#d93a2f"));
      nose.position.y = 1.82;
      rocket.add(nose);
      scene.add(at(rocket, 6.4, 2.6));
      // background stars
      if (mood === "night" || mood === "vivid" || mood === "soft") {
        for (let i = 0; i < 70; i++) {
          const s = new THREE.Mesh(
            new THREE.SphereGeometry(0.03 + (i % 3) * 0.015, 6, 4),
            k.mat("#ffffff", { emissive: true }),
          );
          s.position.set(-14 + ((i * 37) % 28), 4 + ((i * 13) % 9), -9 - ((i * 7) % 4));
          scene.add(s);
        }
      }
      const p = along(road, 0.22);
      scene.add(rider(bk, "adv", p.x, p.z, p.heading));
    },
  },
  {
    id: "personal",
    title: "Personal projects · the forest trail",
    bike: "bobber",
    bg: {},
    moods: ["soft", "vivid", "golden"],
    build(scene, k, bk, mood) {
      scene.add(slab(k, "#5f8f4e", "#5a4330", 16, 12));
      const trail: V2[] = [
        [-8, -1],
        [-4, 0.6],
        [-0.5, -0.6],
        [3, 1.2],
        [8, 0],
      ];
      scene.add(ribbon(k, "#9c7a52", trail, 1.3));
      for (let i = 0; i < 26; i++) {
        const x = -7.5 + ((i * 53) % 150) / 10;
        const z = i % 2 ? -5 + ((i * 17) % 30) / 10 : 2.4 + ((i * 29) % 30) / 10;
        scene.add(
          at(
            i % 3
              ? pine(k, i % 4 ? "#2f6b45" : "#3a7a4e", "#5a3d2b", 0.9 + (i % 3) * 0.2)
              : roundTree(k, "#4f8f46", "#6b4a32", 0.8),
            x,
            z,
          ),
        );
      }
      // cabin + campfire + server shed + drone gate
      const cabin = new THREE.Group();
      cabin.add(box(k, "#8a5a3a", [-1.2, 0, -0.9], [1.2, 1.4, 0.9]));
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.7, 0.9, 4), k.mat("#5a3d2b"));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 1.85;
      roof.castShadow = true;
      cabin.add(roof);
      cabin.add(
        box(k, "#ffe3a6", [0.4, 0.5, 0.89], [0.85, 0.95, 0.92], { emissive: mood === "golden" }),
      );
      scene.add(at(cabin, -3.6, -2.6));
      const fire = new THREE.Group();
      for (let i = 0; i < 5; i++)
        fire.add(
          tube(
            k,
            "#6b4a32",
            [Math.cos(i) * 0.3, 0.05, Math.sin(i) * 0.3],
            [-Math.cos(i) * 0.3, 0.1, -Math.sin(i) * 0.3],
            0.05,
          ),
        );
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.6, 12),
        k.mat("#ff9a3c", { emissive: true }),
      );
      flame.position.y = 0.35;
      fire.add(flame);
      scene.add(at(fire, -1.4, -1.8));
      nightLight(scene, mood, -1.4, 0.6, -1.8, "#ff9a3c", 8);
      const shed = new THREE.Group();
      shed.add(box(k, "#7d8590", [-0.8, 0, -0.6], [0.8, 1.3, 0.6]));
      shed.add(box(k, "#1c1f26", [-0.3, 0.2, 0.59], [0.3, 1.1, 0.62]));
      for (let i = 0; i < 4; i++)
        shed.add(
          box(
            k,
            i % 2 ? "#4ade80" : "#60a5fa",
            [-0.2, 0.3 + i * 0.2, 0.62],
            [-0.1, 0.36 + i * 0.2, 0.64],
            { emissive: true },
          ),
        );
      scene.add(at(shed, 3.2, -2.4));
      const gate = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.07, 10, 40),
        k.mat("#ff4fa3", { emissive: mood !== "soft" }),
      );
      gate.position.set(5.6, 1.4, 2.0);
      gate.rotation.y = 0.6;
      gate.castShadow = true;
      scene.add(gate);
      const drone = new THREE.Group();
      drone.add(box(k, "#222428", [-0.15, -0.04, -0.15], [0.15, 0.04, 0.15]));
      for (const [dx, dz] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as V2[])
        drone.add(disc(k, "#9aa3ad", [dx * 0.2, 0.05, dz * 0.2], 0.1, 0.01));
      scene.add(at(drone, 4.8, 2.6));
      drone.position.y = 1.9;
      const p = along(trail, 0.6);
      scene.add(rider(bk, "bobber", p.x, p.z, p.heading));
    },
  },
  {
    id: "murphy",
    title: "23 Before 23 · Murphy's ride",
    bike: "classic",
    bg: {},
    moods: ["soft", "vivid", "golden"],
    build(scene, k, bk, mood) {
      scene.add(slab(k, "#d9c08a", "#a7714a", 16, 12));
      // sea + beach at the back
      scene.add(box(k, "#2b8fa3", [-8, -0.1, -6], [8, 0.02, -3.4]));
      scene.add(box(k, "#f2dfb0", [-8, -0.1, -3.4], [8, 0.03, -2.4]));
      for (let i = 0; i < 6; i++)
        scene.add(box(k, "#e9f6f7", [-7 + i * 2.6, 0.03, -3.5], [-6 + i * 2.6, 0.05, -3.42]));
      const road: V2[] = [
        [-8, 3.6],
        [-3, 2.4],
        [1.5, 2.8],
        [5, 1.2],
        [8, 1.6],
      ];
      scene.add(ribbon(k, "#46474c", road, 1.4));
      scene.add(ribbon(k, "#f2c14e", road, 0.06, 0.016));
      // milestones (white with yellow caps)
      for (const [x, z] of [
        [-6.2, 4.5],
        [-1.2, 3.8],
        [3.2, 3.0],
      ] as V2[]) {
        const m = new THREE.Group();
        m.add(box(k, "#f5f5f2", [-0.16, 0, -0.08], [0.16, 0.42, 0.08]));
        m.add(sphere(k, "#f2c14e", [0, 0.44, 0], 0.16, undefined, [1, 0.7, 0.5]));
        scene.add(at(m, x, z));
      }
      // lighthouse on the cape
      const lh = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42 - i * 0.03, 0.45 - i * 0.03, 0.55, 24),
          k.mat(i % 2 ? "#d93a2f" : "#f5f5f2"),
        );
        seg.position.y = 0.28 + i * 0.55;
        seg.castShadow = true;
        lh.add(seg);
      }
      lh.add(sphere(k, "#fff3c4", [0, 3.55, 0], 0.26, { emissive: true }));
      scene.add(at(lh, 5.8, -2.0));
      nightLight(scene, mood, 5.8, 3.6, -2, "#fff3c4", 10);
      // temple gopuram (simplified)
      const gop = new THREE.Group();
      for (let i = 0; i < 5; i++)
        gop.add(
          box(
            k,
            ["#e9b44c", "#d9653b", "#4a9a8a", "#e9b44c", "#d9653b"][i] ?? "#fff",
            [-1.0 + i * 0.16, i * 0.5, -0.6 + i * 0.08],
            [1.0 - i * 0.16, (i + 1) * 0.5, 0.6 - i * 0.08],
          ),
        );
      scene.add(at(gop, -4.8, -0.6));
      // dhaba + painted truck + palms + cows
      const dhaba = new THREE.Group();
      dhaba.add(box(k, "#e9d3ad", [-1, 0, -0.7], [1, 1.1, 0.7]));
      dhaba.add(box(k, "#5a8fb0", [-1.2, 1.1, -0.9], [1.2, 1.2, 1.1]));
      scene.add(at(dhaba, -0.5, 0.2));
      const truck = new THREE.Group();
      truck.add(box(k, "#f2b705", [-1.3, 0.35, -0.5], [0.5, 1.5, 0.5]));
      truck.add(box(k, "#d93a2f", [0.5, 0.35, -0.5], [1.2, 1.25, 0.5]));
      truck.add(box(k, "#2b8fa3", [-1.32, 0.9, -0.52], [0.48, 1.0, 0.52]));
      for (const x of [-0.9, 0.8])
        for (const z of [-0.5, 0.5])
          truck.add(at(disc(k, "#1c1d21", [0, 0.32, 0], 0.32, 0.2), x, z));
      scene.add(at(truck, 2.6, 4.6, 0.1));
      for (const [x, z] of [
        [-7, -1.8],
        [-2.6, -2.6],
        [1.6, -2.2],
        [7.2, -0.4],
        [7, 4.4],
      ] as V2[])
        scene.add(at(palm(k, "#3d9a5f", "#8a6a45"), x, z));
      const cow = new THREE.Group();
      cow.add(box(k, "#f5f2ea", [-0.45, 0.35, -0.2], [0.45, 0.75, 0.2]));
      cow.add(box(k, "#f5f2ea", [0.4, 0.55, -0.14], [0.65, 0.85, 0.14]));
      for (const x of [-0.35, 0.35])
        for (const z of [-0.14, 0.14]) cow.add(tube(k, "#e9e4d8", [x, 0, z], [x, 0.36, z], 0.04));
      scene.add(at(cow, -6.6, 1.6, 0.4));
      const p = along(road, 0.45);
      scene.add(rider(bk, "classic", p.x, p.z, p.heading));
    },
  },
];

export function buildZone(zone: ZoneDef, mood: Mood): { scene: THREE.Scene; light: Light } {
  const base = makeKit("smooth");
  const k = moodKit(base, mood);
  const scene = new THREE.Scene();
  const lit = LIGHTS[mood];
  const bg = zone.bg[mood] ?? BG[mood];
  scene.background = new THREE.Color(bg);
  zone.build(scene, k, base, mood);
  return { scene, light: { ...lit, bg } };
}

export const MOOD_NAMES: Record<Mood, string> = {
  soft: "soft daylight",
  vivid: "vivid daylight",
  golden: "golden hour",
  night: "night",
};
