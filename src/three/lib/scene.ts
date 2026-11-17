/** Island props, palettes, lighting and the orthographic ¾ camera for previews. */

import * as THREE from "three";
import { box, type Kit, sphere, tube } from "./kit";

export interface Palette {
  name: string;
  sky: string;
  grass: string;
  dirt: string;
  path: string;
  leaf: string;
  leaf2: string;
  wood: string;
  stone: string;
  crate: string;
  cone: string;
  letters: string;
  wall: string;
  roof: string;
  lamp: string;
  shadow: string;
}

export const PALETTES: Record<"pastel" | "minecraft" | "earthy", Palette> = {
  pastel: {
    name: "Soft pastel",
    sky: "#f4ead9",
    grass: "#bfdcb6",
    dirt: "#e6c7a8",
    path: "#f4e8d6",
    leaf: "#8fc6a3",
    leaf2: "#a4d3b2",
    wood: "#c99e7c",
    stone: "#d3cde0",
    crate: "#eabf94",
    cone: "#f3a184",
    letters: "#fbf7f1",
    wall: "#f3dfce",
    roof: "#e79f8f",
    lamp: "#ffe7a6",
    shadow: "#8a7aa6",
  },
  minecraft: {
    name: "Classic Minecraft",
    sky: "#9cc7ff",
    grass: "#64a33f",
    dirt: "#8a6442",
    path: "#9e9384",
    leaf: "#3f7f2c",
    leaf2: "#4f9536",
    wood: "#6e5333",
    stone: "#8e8e8e",
    crate: "#a87b4b",
    cone: "#e4762b",
    letters: "#f2f2f2",
    wall: "#bb8a5c",
    roof: "#7a3e2e",
    lamp: "#ffd25a",
    shadow: "#2c3a2a",
  },
  earthy: {
    name: "Earthy Indian",
    sky: "#f2e2c4",
    grass: "#a7b070",
    dirt: "#c27a4b",
    path: "#e8c47e",
    leaf: "#4f7d4c",
    leaf2: "#628f55",
    wood: "#7b4a2e",
    stone: "#d8c6a6",
    crate: "#c98b3d",
    cone: "#2f4f8a",
    letters: "#f7ecd6",
    wall: "#ead5ae",
    roof: "#b4503a",
    lamp: "#ffcf73",
    shadow: "#6b4a3a",
  },
};

/** Orthographic ¾ top-down camera framing a box of `size` world units. */
export function orthoCamera(
  aspect: number,
  size: number,
  elevation = 38,
  azimuth = -40,
): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(
    (-size * aspect) / 2,
    (size * aspect) / 2,
    size / 2,
    -size / 2,
    0.1,
    200,
  );
  const el = THREE.MathUtils.degToRad(elevation);
  const az = THREE.MathUtils.degToRad(azimuth);
  const d = 40;
  cam.position.set(
    Math.sin(az) * Math.cos(el) * d,
    Math.sin(el) * d,
    Math.cos(az) * Math.cos(el) * d,
  );
  cam.lookAt(0, 0, 0);
  return cam;
}

export function lights(
  scene: THREE.Scene,
  sky: string,
  ground: string,
  shadows: boolean,
  span = 12,
): void {
  scene.add(new THREE.HemisphereLight(sky, ground, 1.6));
  const sun = new THREE.DirectionalLight("#fff6e6", 2.2);
  sun.position.set(-6, 12, 8);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -span;
  cam.right = span;
  cam.top = span;
  cam.bottom = -span;
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 3;
  scene.add(sun);
}

/** The island: a grass slab with dirt sides (Minecraft-style cut-away). */
export function island(kit: Kit, p: Palette, w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, p.dirt, [-w / 2, -1.2, -d / 2], [w / 2, -0.05, d / 2]));
  const top = box(kit, p.grass, [-w / 2, -0.12, -d / 2], [w / 2, 0, d / 2]);
  g.add(top);
  return g;
}

export function ringRoad(kit: Kit, p: Palette, r: number, width: number): THREE.Mesh {
  const geo = new THREE.RingGeometry(r - width / 2, r + width / 2, kit.seg(24, 96));
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, kit.mat(p.path));
  m.position.y = 0.006;
  m.receiveShadow = true;
  return m;
}

export function tree(kit: Kit, p: Palette, x: number, z: number, h = 1): THREE.Group {
  const g = new THREE.Group();
  if (kit.surface === "flat") {
    g.add(box(kit, p.wood, [-0.15, 0, -0.15], [0.15, 1.1 * h, 0.15]));
    g.add(box(kit, p.leaf, [-0.6, 0.9 * h, -0.6], [0.6, 1.7 * h, 0.6]));
    g.add(box(kit, p.leaf2, [-0.38, 1.7 * h, -0.38], [0.38, 2.15 * h, 0.38]));
  } else {
    g.add(tube(kit, p.wood, [0, 0, 0], [0, 1.1 * h, 0], 0.13));
    g.add(sphere(kit, p.leaf, [0, 1.45 * h, 0], 0.62));
    g.add(sphere(kit, p.leaf2, [0.18, 1.9 * h, 0.1], 0.38));
  }
  g.position.set(x, 0, z);
  return g;
}

export function crate(kit: Kit, p: Palette, x: number, z: number, rot = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, p.crate, [-0.3, 0, -0.3], [0.3, 0.6, 0.3]));
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  return g;
}

export function cone(kit: Kit, p: Palette, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, p.cone, [-0.2, 0, -0.2], [0.2, 0.05, 0.2]));
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, kit.seg(6, 24)), kit.mat(p.cone));
  c.position.y = 0.3;
  c.castShadow = true;
  g.add(c);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 0.08, kit.seg(6, 24)),
    kit.mat("#f5f5f5"),
  );
  band.position.y = 0.3;
  g.add(band);
  g.position.set(x, 0, z);
  return g;
}

export function rock(kit: Kit, p: Palette, x: number, z: number): THREE.Mesh {
  const geo =
    kit.surface === "flat"
      ? new THREE.DodecahedronGeometry(0.4, 0)
      : new THREE.IcosahedronGeometry(0.4, 3);
  const m = new THREE.Mesh(geo, kit.mat(p.stone));
  m.scale.set(1.3, 0.7, 1);
  m.position.set(x, 0.18, z);
  m.castShadow = true;
  return m;
}

export function lamp(kit: Kit, p: Palette, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#3a3d44", [0, 0, 0], [0, 2.2, 0], 0.05));
  g.add(box(kit, p.lamp, [-0.14, 2.2, -0.14], [0.14, 2.45, 0.14], { emissive: true }));
  g.position.set(x, 0, z);
  return g;
}

export function garage(kit: Kit, p: Palette, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(kit, p.wall, [-1.6, 0, -1.2], [1.6, 1.8, 1.2]));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.2, 0.9, 4, 1), kit.mat(p.roof));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.75);
  roof.position.y = 2.25;
  roof.castShadow = true;
  g.add(roof);
  g.add(box(kit, "#3a3d44", [-0.8, 0, 1.19], [0.8, 1.3, 1.24]));
  for (let i = 1; i < 6; i++)
    g.add(box(kit, "#4b4f57", [-0.8, i * 0.22, 1.23], [0.8, i * 0.22 + 0.04, 1.26]));
  g.add(box(kit, p.lamp, [1.0, 1.35, 1.2], [1.3, 1.5, 1.26], { emissive: true }));
  g.position.set(x, 0, z);
  return g;
}

const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
};

/** Big standing block letters (Bruno-style), each pixel a small cube. */
export function word(
  kit: Kit,
  p: Palette,
  text: string,
  x: number,
  z: number,
  cell = 0.16,
): THREE.Group {
  const g = new THREE.Group();
  [...text].forEach((ch, i) => {
    const rows = FONT[ch] ?? [];
    const letter = new THREE.Group();
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== "#") continue;
        const y = (rows.length - 1 - r) * cell;
        letter.add(box(kit, p.letters, [c * cell, y, 0], [c * cell + cell, y + cell, cell * 1.6]));
      }
    });
    letter.position.x = i * cell * 6.2;
    g.add(letter);
  });
  g.position.set(x - ((text.length * 6.2 - 1.2) * cell) / 2, 0, z);
  return g;
}

/** Soft blob shadow (used when shadow maps are off). */
export function blob(x: number, z: number, r: number, colour: string): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: tex, color: colour, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.01, z);
  return m;
}
