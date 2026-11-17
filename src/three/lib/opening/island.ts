/**
 * The miniature island (used by the opening fly-in) and the garage map table
 * built from it (the bike-select landing).
 */

import * as THREE from "three";
import { batch } from "../../merge";
import { box, makeKit, setDetail } from "../kit";
import { gali } from "./gali";
import { continuousIsland, islandHeightAt, type ReliefStyle, SITES } from "./terrainIsland";
import {
  blockWord,
  chunkIndex,
  dressing,
  garage,
  islandChunks,
  label,
  miniZone,
  murphyBike,
  secretGate,
  spokes,
  ZONE_SPOTS,
} from "./world";

const kit = makeKit("smooth");

export function islandContent(
  progress: number,
  night = false,
): { group: THREE.Group; lights: THREE.Light[] } {
  const scene = new THREE.Group();
  const hash = (i: number, j: number) => {
    const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  // Chunks land from the centre outwards, with a little randomness.
  const landedBy = (i: number, j: number) => {
    const d = Math.hypot(i - 7, j - 6) / 9;
    return d * 0.8 + hash(i, j) * 0.25;
  };
  scene.add(
    islandChunks(kit, (i, j) => {
      const due = landedBy(i, j);
      if (progress >= 1 || due <= progress) return { lift: 0, tilt: 0, visible: true };
      const late = due - progress;
      if (late > 0.35) return { lift: 0, tilt: 0, visible: false };
      return { lift: 4 + late * 70, tilt: (hash(j, i) - 0.5) * 0.5, visible: true };
    }),
  );
  const landed = (x: number, z: number) => {
    const [i, j] = chunkIndex(x, z);
    return progress >= 1 || landedBy(i, j) <= progress;
  };
  if (progress >= 1) {
    scene.add(spokes(kit));
    scene.add(dressing(kit));
  }
  for (const id of Object.keys(ZONE_SPOTS)) {
    const [x, z] = ZONE_SPOTS[id] ?? [0, 0];
    if (landed(x, z)) scene.add(miniZone(id));
  }
  // Secret gate across the road to Murphy's coast.
  const gate = secretGate(kit);
  gate.position.set(-17.6, -0.2, 12.5);
  gate.rotation.y = 0.29;
  if (landed(-17.6, 12.5)) scene.add(gate);
  // The maidan south of the lane mouth: dusty ground where ADIT JAIN stands.
  const maidan = box(kit, "#d6c08f", [-16, -0.24, 14.4], [16, -0.16, 26.5]);
  scene.add(maidan);
  for (const [x, z, r] of [
    [-9, 23, 1.6],
    [6, 17.5, 1.2],
    [11, 24, 1.4],
  ] as [number, number, number][]) {
    const worn = new THREE.Mesh(new THREE.CircleGeometry(r, 24), kit.mat("#c9b07c"));
    worn.rotation.x = -Math.PI / 2;
    worn.position.set(x, -0.155, z);
    scene.add(worn);
  }
  // The gali, the garage, Murphy
  const lane = gali(kit, { night });
  lane.group.position.y = -0.15;
  if (landed(0, 6)) scene.add(lane.group);
  const shop = garage(kit);
  shop.position.set(0, -0.15, 0);
  if (landed(0, 0)) scene.add(shop);
  const murphy = murphyBike(1.5, 5.6, -0.4);
  murphy.position.y = -0.15;
  if (landed(1.5, 5.6)) scene.add(murphy);
  // ADIT JAIN in giant block letters on the maidan, facing the swoop.
  const name = blockWord(kit, "ADIT JAIN", 0.48, "#e4572e", "#ffd166");
  name.position.set(0, -0.16, 19.5);
  if (landed(0, 19.5)) scene.add(name);
  for (const l of lane.lights) l.position.y -= 0.15;
  return { group: scene, lights: progress >= 1 ? lane.lights : [] };
}

/** The full island world as a scene. */

/** The map table: a wooden table with the whole island in miniature in a resin sea; tap a world to ride there. */
export function mapTable(
  highlight = "zingle",
  style: ReliefStyle | "chunks" = "chunks",
): THREE.Group {
  const g = new THREE.Group();
  const top = 1.0;
  const S = 0.034;
  g.add(box(kit, "#7a5233", [-1.9, top - 0.1, -1.5], [1.9, top, 1.5]));
  for (const [x, z] of [
    [-1.7, -1.3],
    [1.7, -1.3],
    [-1.7, 1.3],
    [1.7, 1.3],
  ] as [number, number][])
    g.add(box(kit, "#5a3d2b", [x - 0.08, 0, z - 0.08], [x + 0.08, top - 0.1, z + 0.08]));
  // tray rim and the resin sea
  for (const [a, b] of [
    [
      [-1.8, top, -1.4],
      [1.8, top + 0.16, -1.32],
    ],
    [
      [-1.8, top, 1.32],
      [1.8, top + 0.16, 1.4],
    ],
    [
      [-1.8, top, -1.4],
      [-1.72, top + 0.16, 1.4],
    ],
    [
      [1.72, top, -1.4],
      [1.8, top + 0.16, 1.4],
    ],
  ] as [[number, number, number], [number, number, number]][])
    g.add(box(kit, "#8a5a32", a, b));
  // Resin sea; on the continuous island it's a touch translucent so the shallows show.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(3.44, 2.64),
    new THREE.MeshStandardMaterial({
      color: "#4fb0c9",
      roughness: 0.2,
      transparent: style !== "chunks",
      opacity: style !== "chunks" ? 0.82 : 1,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = top + 0.06;
  g.add(sea);
  if (style === "chunks") {
    const mini = islandContent(1).group;
    mini.scale.setScalar(S);
    mini.position.y = top + 0.12;
    g.add(mini);
  } else {
    // One continuous landscape; its sea level sits at the resin's surface.
    const mini = continuousIsland(kit, style);
    mini.scale.setScalar(S);
    mini.position.y = top + 0.06;
    g.add(mini);
  }
  // pins: a little flag over each world; the hovered one glows (the continuous island plants real flags)
  if (style !== "chunks") return g;
  for (const [id, name] of [
    ["winzo", "WinZO"],
    ["zingle", "Zingle"],
    ["expresso", "Expresso"],
    ["fun", "Fun"],
    ["astro", "Astro"],
    ["personal", "Personal"],
  ] as const) {
    const [x, z] = ZONE_SPOTS[id] ?? [0, 0];
    const on = id === highlight;
    const tag = label(
      name,
      on ? "#1d1f24" : "#ffffff",
      on ? "#f2c14e" : "#1d1f24",
      on ? 0.16 : 0.11,
    );
    tag.position.set(x * S, top + 0.36, z * S);
    g.add(tag);
    if (on) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.018, 8, 40),
        kit.mat("#ffd166", { emissive: true }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x * S, top + 0.16, z * S);
      g.add(ring);
    }
  }
  return g;
}

export interface LiveTable {
  group: THREE.Group;
  /** Table-top height (world units, before the group transform). */
  top: number;
  /** World spots on the table, in the table's local space. */
  spots: Record<string, THREE.Vector3>;
  setSelected(id: string): void;
  setHovered(id: string | null): void;
  update(t: number): void;
}

const TAGS: [string, string][] = [
  ["zingle", "Zingle AI"],
  ["winzo", "WinZO"],
  ["expresso", "Expresso"],
  ["astro", "AstroClub IITK"],
  ["fun", "C++ for fun"],
  ["personal", "Personal"],
  ["murphy", "Secret"],
];

/** The map table for the live landing: tags and the ring follow the selection without rebuilding. */
export function liveMapTable(style: ReliefStyle | "chunks" = "relief"): LiveTable {
  const continuous = style !== "chunks";
  // The miniature is only ever seen small: build it at reduced detail.
  setDetail(0.35);
  const raw = mapTable("none", style);
  setDetail(1);
  // Drop the static tags the design version adds; the live ones (or the flags) replace them.
  for (const c of [...raw.children]) if (c instanceof THREE.Sprite) raw.remove(c);
  // Thousands of tiny static parts → one draw per material; the journey flags stay live.
  const g = batch(raw, (o) => o.name.startsWith("flag:"));
  const top = 1.0;
  const S = 0.034;
  const spots: Record<string, THREE.Vector3> = {};
  const tags = new Map<string, { off: THREE.Sprite; on: THREE.Sprite }>();
  const flags = new Map<string, THREE.Object3D>();
  for (const [id, name] of TAGS) {
    const [x, z] = continuous ? (SITES[id] ?? [0, 0]) : (ZONE_SPOTS[id] ?? [0, 0]);
    const ground = continuous ? 0.06 + islandHeightAt(x, z) * S : 0.06;
    spots[id] = new THREE.Vector3(x * S, top + ground + 0.06, z * S);
    if (continuous) {
      const f = g.getObjectByName(`flag:${id}`);
      if (f) {
        f.userData.base = f.scale.clone();
        flags.set(id, f);
      }
      continue;
    }
    const off = label(name, "#ffffff", id === "murphy" ? "#5b5149" : "#1d1f24", 0.11);
    const on = label(name, "#1d1f24", "#f2c14e", 0.16);
    for (const t of [off, on]) {
      t.position.set(x * S, (spots[id]?.y ?? top) + 0.24, z * S);
      g.add(t);
    }
    on.visible = false;
    tags.set(id, { off, on });
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(continuous ? 0.22 : 0.3, 0.014, 8, 48),
    kit.mat("#ffd166", { emissive: true }),
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  let selected = "";
  let hovered: string | null = null;
  const grow = (o: THREE.Object3D, target: number) => {
    const s0 = (o.userData.base as THREE.Vector3 | undefined) ?? o.scale.clone();
    o.userData.base = s0;
    const cur = o.scale.x / s0.x;
    const next = cur + (target - cur) * 0.2;
    o.scale.set(s0.x * next, s0.y * next, s0.z * next);
  };
  return {
    group: g,
    top,
    spots,
    setSelected(id) {
      selected = id;
      for (const [k, t] of tags) {
        t.on.visible = k === id;
        t.off.visible = k !== id;
      }
      const p = spots[id];
      ring.visible = Boolean(p);
      if (p) ring.position.set(p.x, p.y + 0.01, p.z);
    },
    setHovered(id) {
      hovered = id;
    },
    update(t) {
      ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      // The picked journey's flag stands taller; a hovered one lifts a little.
      for (const [k, f] of flags) grow(f, k === selected ? 1.45 : k === hovered ? 1.2 : 1);
      for (const [k, tg] of tags) {
        const target = k === hovered && k !== selected ? 1.18 : 1;
        const sp = tg.off;
        const s0 = sp.userData.base ?? sp.scale.clone();
        sp.userData.base = s0;
        const cur = sp.scale.x / s0.x;
        const next = cur + (target - cur) * 0.2;
        sp.scale.set(s0.x * next, s0.y * next, 1);
      }
    },
  };
}
