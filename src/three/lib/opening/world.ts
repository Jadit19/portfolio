/**
 * The opening's island: Murphy's garage in the middle, the seven route zones
 * around it as miniature dioramas (each in its locked mood), ADIT JAIN as
 * giant block letters, and the island ground made of chunks so the loading
 * frame can show it assembling. Design previews only.
 */

import * as THREE from "three";
import { buildBike } from "../bikes";
import { box, disc, type Kit, makeKit, sphere, tube } from "../kit";
import { type Mood, moodKit, palm, ribbon, roundTree, ZONES } from "../zones";

export const ZONE_MOODS: Record<string, Mood> = {
  winzo: "vivid",
  zingle: "vivid",
  expresso: "golden",
  fun: "night",
  astro: "vivid",
  personal: "golden",
  murphy: "vivid",
};

/** Zone placement around the garage (x, z, rotation). Murphy sits behind a gate. */
export const ZONE_SPOTS: Record<string, [number, number, number]> = {
  winzo: [-30, 4, 0],
  zingle: [-24, -22, 0],
  astro: [0, -30, 0],
  personal: [24, -22, 0],
  expresso: [30, 4, 0],
  fun: [22, 26, 0],
  murphy: [-22, 26, 0],
};

const ISLAND_W = 92;
const ISLAND_D = 78;
const CHUNK = 6.5;

export interface ChunkState {
  /** Height above its resting place (0 = landed). */
  lift: number;
  tilt: number;
  visible: boolean;
}

/** The island ground, built from square chunks (grass top + earth sides). */
export function islandChunks(kit: Kit, state: (i: number, j: number) => ChunkState): THREE.Group {
  const g = new THREE.Group();
  const nx = Math.ceil(ISLAND_W / CHUNK);
  const nz = Math.ceil(ISLAND_D / CHUNK);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const s = state(i, j);
      if (!s.visible) continue;
      const x0 = -ISLAND_W / 2 + i * CHUNK;
      const z0 = -ISLAND_D / 2 + j * CHUNK;
      // Rounded-off corners of the island: skip chunks outside an ellipse.
      const cx = x0 + CHUNK / 2;
      const cz = z0 + CHUNK / 2;
      if ((cx / (ISLAND_W / 2)) ** 2 + (cz / (ISLAND_D / 2)) ** 2 > 1.05) continue;
      const depth = 3 + ((i * 7 + j * 3) % 4) * 0.8;
      const chunk = new THREE.Group();
      const grass = (i + j) % 2 ? "#86bf63" : "#8cc56a";
      chunk.add(
        box(kit, "#7b5a3e", [-CHUNK / 2, -depth, -CHUNK / 2], [CHUNK / 2, -0.35, CHUNK / 2]),
      );
      chunk.add(box(kit, grass, [-CHUNK / 2, -0.45, -CHUNK / 2], [CHUNK / 2, -0.2, CHUNK / 2]));
      chunk.position.set(cx, s.lift, cz);
      chunk.rotation.set(s.tilt * 0.4, s.tilt, s.tilt * 0.3);
      g.add(chunk);
    }
  }
  return g;
}

export function chunkIndex(x: number, z: number): [number, number] {
  return [Math.floor((x + ISLAND_W / 2) / CHUNK), Math.floor((z + ISLAND_D / 2) / CHUNK)];
}

/**
 * A zone diorama scaled into a miniature, in its locked mood. With
 * `dropSlab`, its rectangular ground slab is removed (the continuous island
 * provides the ground) and its ground colour is kept in `userData.ground`.
 */
export function miniZone(id: string, dropSlab = false): THREE.Group {
  const zone = ZONES.find((z) => z.id === id);
  const g = new THREE.Group();
  if (!zone) return g;
  const base = makeKit("smooth");
  const mood = ZONE_MOODS[id] ?? "vivid";
  // Zone builders add to a scene; a Group has the same add() for our purposes.
  zone.build(g as unknown as THREE.Scene, moodKit(base, mood), base, mood);
  // Drop anything that only made sense in a standalone frame (e.g. far stars).
  g.children = g.children.filter(
    (c) => !(c instanceof THREE.PointLight) && !(c.position.y > 3.6 && c.position.z < -8),
  );
  if (dropSlab) {
    for (const c of [...g.children]) {
      const info = c.userData.slab as { top: string; w: number; d: number } | undefined;
      if (info) {
        g.remove(c);
        g.userData.ground = info.top;
        g.userData.size = [info.w, info.d];
      }
    }
    // Large flat rectangular slabs (a strip of sea, a plaza) would show as
    // rectangles on a continuous island: drop them too. Roads and tracks stay.
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    for (const c of [...g.children]) {
      const m = c as THREE.Mesh;
      if (!m.isMesh) continue;
      const type = m.geometry.type;
      if (type !== "ExtrudeGeometry" && type !== "BoxGeometry" && type !== "PlaneGeometry")
        continue;
      box.setFromObject(m).getSize(size);
      if (size.y < 0.35 && size.x * size.z > 14) g.remove(m);
    }
  }
  g.scale.setScalar(0.92);
  const [x, z, r] = ZONE_SPOTS[id] ?? [0, 0, 0];
  g.position.set(x, -0.18, z);
  g.rotation.y = r;
  return g;
}

/** Signboard: a canvas texture on a plane (stays flat on a facade). */
export function signBoard(
  text: string,
  w: number,
  h: number,
  bg: string,
  fg: string,
  font = "800 120px Outfit, Arial",
): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round((1024 * h) / w);
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, c.width - 36, c.height - 36);
    ctx.fillStyle = fg;
    ctx.font = font;
    // Shrink the font until the text fits inside the border.
    let size = Number.parseInt(/(\d+)px/.exec(font)?.[1] ?? "120", 10);
    while (ctx.measureText(text).width > c.width - 90 && size > 20) {
      size -= 4;
      ctx.font = font.replace(/\d+px/, `${size}px`);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, c.height / 2 + 6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
  );
  m.castShadow = true;
  return m;
}

/** Murphy's garage: an Indian two-wheeler workshop. Front faces +z. */
export function garage(kit: Kit, opts: { shutter?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const W = 8;
  const D = 6;
  const H = 4.5;
  const shutter = opts.shutter ?? 0.55; // fraction open
  // Walls: lime-washed with a terracotta plinth
  g.add(box(kit, "#f1e2c6", [-W / 2, 0, -D / 2], [W / 2, H, D / 2]));
  g.add(box(kit, "#c4643f", [-W / 2 - 0.02, 0, -D / 2 - 0.02], [W / 2 + 0.02, 0.5, D / 2 + 0.02]));
  // Flat roof with a parapet + water tank (very Indian rooftop)
  g.add(
    box(kit, "#d9c9a8", [-W / 2 - 0.15, H, -D / 2 - 0.15], [W / 2 + 0.15, H + 0.25, D / 2 + 0.15]),
  );
  g.add(
    box(
      kit,
      "#e9dcc2",
      [-W / 2 - 0.15, H + 0.25, D / 2 - 0.05],
      [W / 2 + 0.15, H + 0.65, D / 2 + 0.15],
    ),
  );
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 24), kit.mat("#2a2a2c"));
  tank.position.set(2.4, H + 0.7, -1.4);
  tank.castShadow = true;
  g.add(tank);
  // Shutter opening: dark interior, rolled shutter above
  const ow = 4.6;
  const oh = 2.7;
  g.add(box(kit, "#2a2a2e", [-ow / 2, 0.02, D / 2 - 0.02], [ow / 2, oh, D / 2 + 0.01]));
  const closed = oh * (1 - shutter);
  for (let y = oh - closed; y < oh; y += 0.16) {
    g.add(
      box(kit, "#9aa3ad", [-ow / 2, y, D / 2 + 0.01], [ow / 2, y + 0.13, D / 2 + 0.05], {
        metal: true,
      }),
    );
  }
  g.add(box(kit, "#7d8590", [-ow / 2 - 0.1, oh, D / 2], [ow / 2 + 0.1, oh + 0.35, D / 2 + 0.25]));
  // Warm light spilling from inside
  g.add(
    box(kit, "#ffd88a", [-ow / 2 + 0.2, 0.05, D / 2 - 0.4], [ow / 2 - 0.2, 0.08, D / 2 - 0.05], {
      emissive: true,
    }),
  );
  // Hand-painted sign
  const sign = signBoard("MURPHY'S GARAGE", 6.4, 0.95, "#1f4d36", "#f2c14e");
  sign.position.set(0, H - 0.6, D / 2 + 0.06);
  g.add(sign);
  // Tube light between the shutter box and the sign
  g.add(
    box(kit, "#ffffff", [-1.1, oh + 0.48, D / 2 + 0.05], [1.1, oh + 0.56, D / 2 + 0.12], {
      emissive: true,
    }),
  );
  // Marigold string across the facade
  for (let i = 0; i <= 26; i++) {
    const x = -W / 2 + 0.3 + (i / 26) * (W - 0.6);
    const sag = Math.sin((i / 26) * Math.PI) * 0.35;
    g.add(sphere(kit, i % 3 ? "#ff9f1c" : "#ffbf00", [x, H - 0.05 - sag, D / 2 + 0.12], 0.09));
  }
  // Stool with a cutting-chai glass, stacked tyres, oil drum, a toolbox
  const stool = new THREE.Group();
  stool.add(disc(kit, "#2f6db0", [0, 0.55, 0], 0.26, 0.06));
  stool.children[0]?.rotateX(Math.PI / 2);
  for (const [dx, dz] of [
    [0.16, 0.16],
    [-0.16, 0.16],
    [0.16, -0.16],
    [-0.16, -0.16],
  ] as [number, number][])
    stool.add(tube(kit, "#2f6db0", [dx, 0, dz], [dx * 0.6, 0.55, dz * 0.6], 0.025));
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.055, 0.16, 16),
    kit.mat("#c98a3d"),
  );
  glass.position.set(0.05, 0.66, 0);
  stool.add(glass);
  stool.position.set(-3.2, 0, D / 2 + 1.0);
  g.add(stool);
  for (let i = 0; i < 4; i++) {
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 10, 24), kit.mat("#1f2024"));
    tyre.rotation.x = Math.PI / 2;
    tyre.position.set(3.4, 0.12 + i * 0.24, D / 2 + 0.8);
    tyre.castShadow = true;
    g.add(tyre);
  }
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.0, 20), kit.mat("#2f6db0"));
  drum.position.set(3.4, 0.5, D / 2 - 0.3 + 1.8);
  drum.castShadow = true;
  g.add(drum);
  g.add(box(kit, "#d93a2f", [-2.3, 0, D / 2 + 0.3], [-1.6, 0.4, D / 2 + 0.7]));
  return g;
}

/** Murphy (the silver Guerrilla) parked at the given spot, at bike scale. */
export function murphyBike(x: number, z: number, heading: number): THREE.Group {
  const b = parked(buildBike(makeKit("smooth"), "classic"));
  const pivot = new THREE.Group();
  pivot.add(b);
  pivot.position.set(x, 0, z);
  pivot.rotation.y = heading;
  pivot.scale.setScalar(1.25);
  return pivot;
}

// ── ADIT JAIN block letters ───────────────────────────────────────────────

const GLYPHS: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  J: ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

/** Standing block letters you could crash into; readable from +z. */
export function blockWord(
  kit: Kit,
  text: string,
  cell: number,
  colour: string,
  accent?: string,
): THREE.Group {
  const g = new THREE.Group();
  const advance = cell * 6.2;
  [...text].forEach((ch, i) => {
    const rows = GLYPHS[ch] ?? [];
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== "#") continue;
        const y = (rows.length - 1 - r) * cell;
        const col = accent && r === 0 ? accent : colour;
        g.add(
          box(
            kit,
            col,
            [i * advance + c * cell, y, 0],
            [i * advance + (c + 1) * cell, y + cell, cell * 1.4],
          ),
        );
      }
    });
  });
  const width = text.length * advance - cell * 1.2;
  g.children.forEach((m) => {
    m.position.x -= width / 2;
  });
  return g;
}

/** Roads from the gali out to each zone: from the lane ends or the lane mouth. */
export function spokes(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  for (const [id, [x, z]] of Object.entries(ZONE_SPOTS)) {
    // Astro (behind the garage) leaves by the east end and swings round the back.
    const east = x > 12 || id === "astro";
    const start: [number, number] = x < -12 ? [-16, 6.2] : east ? [16, 6.2] : [0, 26];
    const lead: [number, number] = x < -12 ? [-19, 6.2] : east ? [19, 6.2] : [0, 28];
    const mid: [number, number] =
      id === "astro" ? [18, -12] : [(lead[0] + x * 0.7) / 2, (lead[1] + z * 0.7) / 2];
    const road = ribbon(
      kit,
      id === "murphy" ? "#b7a98a" : "#d8c9a6",
      [start, lead, mid, [x * 0.7, z * 0.7]],
      2.2,
      -0.16,
    );
    g.add(road);
  }
  return g;
}

/** Island dressing: trees and palms scattered between the zones. */
export function dressing(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 90; i++) {
    const x = (rand() - 0.5) * ISLAND_W * 0.95;
    const z = (rand() - 0.5) * ISLAND_D * 0.95;
    if ((x / (ISLAND_W / 2)) ** 2 + (z / (ISLAND_D / 2)) ** 2 > 0.9) continue;
    const nearZone = Object.values(ZONE_SPOTS).some(
      ([zx, zz]) => Math.abs(zx - x) < 9.5 && Math.abs(zz - z) < 7.5,
    );
    const nearCentre = Math.abs(x) < 19 && z > -8 && z < 28;
    if (nearZone || nearCentre) continue;
    const t =
      z > 18
        ? palm(kit, "#3d9a5f", "#8a6a45")
        : roundTree(kit, i % 2 ? "#4f9a45" : "#5aa64e", "#6b4a32", 0.9 + rand() * 0.4);
    t.position.set(x, -0.2, z);
    g.add(t);
  }
  return g;
}

/** A closed wrought-iron gate with a padlock sign (Murphy's secret road). */
export function secretGate(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-2.4, 2.4])
    g.add(box(kit, "#e9dcc2", [x - 0.35, 0, -0.35], [x + 0.35, 2.6, 0.35]));
  for (let i = 0; i < 9; i++)
    g.add(tube(kit, "#2b2b2e", [-2 + i * 0.5, 0, 0], [-2 + i * 0.5, 2.1, 0], 0.04));
  g.add(box(kit, "#2b2b2e", [-2.05, 1.95, -0.05], [2.05, 2.05, 0.05]));
  const sign = signBoard(
    "3 STAMPS TO UNLOCK",
    2.6,
    0.5,
    "#8a2a22",
    "#f6efdf",
    "800 92px Outfit, Arial",
  );
  sign.position.set(0, 1.1, 0.08);
  g.add(sign);
  return g;
}

/** A camera-facing label sized to its text (speech bubbles, map labels). */
export function label(
  text: string,
  fg: string,
  bg: string,
  height = 1,
  tail = false,
): THREE.Sprite {
  const font = "700 64px Outfit, Arial, sans-serif";
  const probe = document.createElement("canvas").getContext("2d");
  if (probe) probe.font = font;
  const tw = Math.ceil(probe?.measureText(text).width ?? text.length * 34);
  const padX = 40;
  const bodyH = 104;
  const tailH = tail ? 30 : 0;
  const c = document.createElement("canvas");
  c.width = tw + padX * 2;
  c.height = bodyH + tailH;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, c.width, bodyH, 40);
    ctx.fill();
    if (tail) {
      ctx.beginPath();
      ctx.moveTo(c.width * 0.3, bodyH - 2);
      ctx.lineTo(c.width * 0.3 + 34, bodyH - 2);
      ctx.lineTo(c.width * 0.3 + 6, bodyH + tailH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = fg;
    ctx.font = font;
    ctx.textBaseline = "middle";
    ctx.fillText(text, padX, bodyH / 2 + 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set((height * c.width) / c.height, height, 1);
  s.renderOrder = 10;
  return s;
}

/** Removes the rider (the last part a bike builder adds) for parked bikes. */
export function parked(bike: THREE.Group): THREE.Group {
  const r = bike.children[bike.children.length - 1];
  if (r) bike.remove(r);
  return bike;
}
