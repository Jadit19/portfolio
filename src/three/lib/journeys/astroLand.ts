/**
 * The richer Himachal → Ladakh landscape for the AstroClub world: trees and
 * orchards drawn as instanced meshes (hundreds of them cheaply), Kath-kuni
 * houses, a parachute-tent dhaba, a prayer-flag footbridge, a waterfall,
 * Bactrian camels, bharal, lammergeiers, high clouds, snow plumes and dust
 * devils. The journey decides where things go; this file says what they are.
 */

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { box, type Kit, sphere, tube } from "../kit";

// ── instanced flora ─────────────────────────────────────────────────────────

/** Merges coloured parts into one geometry with vertex colours. */
function species(
  parts: [THREE.BufferGeometry, string, [number, number, number]][],
): THREE.BufferGeometry {
  const geos = parts.map(([g, colour, at]) => {
    const flat = g.index ? g.toNonIndexed() : g;
    flat.translate(...at);
    const c = new THREE.Color(colour);
    const n = flat.attributes.position?.count ?? 0;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
    flat.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    flat.deleteAttribute("uv");
    return flat;
  });
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) throw new Error("species: nothing to merge");
  merged.computeVertexNormals();
  return merged;
}

const cyl = (r0: number, r1: number, h: number) => new THREE.CylinderGeometry(r0, r1, h, 7);
const cone = (r: number, h: number) => new THREE.ConeGeometry(r, h, 9);
const ball = (r: number, sx = 1, sy = 1, sz = 1) => {
  const g = new THREE.IcosahedronGeometry(r, 1);
  g.scale(sx, sy, sz);
  return g;
};

export type Flora =
  | "deodar"
  | "pine"
  | "apple"
  | "poplar"
  | "poplarGold"
  | "willow"
  | "buckthorn"
  | "flowers"
  | "khejri"
  | "ber";

const SHAPES: Record<Flora, () => THREE.BufferGeometry> = {
  // Himalayan cedar: dark, layered, tall.
  deodar: () =>
    species([
      [cyl(0.12, 0.18, 1.4), "#5a3d2b", [0, 0.7, 0]],
      [cone(1.5, 2.2), "#2d5a3b", [0, 2.0, 0]],
      [cone(1.15, 1.9), "#34663f", [0, 3.1, 0]],
      [cone(0.75, 1.6), "#3b7146", [0, 4.1, 0]],
    ]),
  // Chir pine: a lighter, airier crown on a taller trunk.
  pine: () =>
    species([
      [cyl(0.1, 0.14, 2.6), "#6b4a32", [0, 1.3, 0]],
      [cone(0.95, 1.4), "#4f7f45", [0, 2.8, 0]],
      [cone(0.72, 1.2), "#58894a", [0, 3.6, 0]],
      [cone(0.45, 1.0), "#619350", [0, 4.3, 0]],
    ]),
  // Apple tree, fruit showing.
  apple: () =>
    species([
      [cyl(0.08, 0.11, 0.9), "#6b5240", [0, 0.45, 0]],
      [ball(0.9, 1, 0.8, 1), "#5f9c43", [0, 1.5, 0]],
      ...(
        [
          [0.55, 1.6, 0.35],
          [-0.5, 1.4, 0.45],
          [0.2, 1.9, -0.6],
          [-0.3, 1.75, -0.5],
          [0.65, 1.3, -0.25],
          [-0.65, 1.7, -0.1],
        ] as [number, number, number][]
      ).map(
        (at) =>
          [ball(0.1), "#c0392b", at] as [THREE.BufferGeometry, string, [number, number, number]],
      ),
    ]),
  poplar: () =>
    species([
      [cyl(0.06, 0.09, 1.2), "#7a6a55", [0, 0.6, 0]],
      [ball(0.5, 0.9, 3.2, 0.9), "#9ab84a", [0, 2.6, 0]],
    ]),
  // Poplars turning gold, as they do in Ladakh's autumn.
  poplarGold: () =>
    species([
      [cyl(0.06, 0.09, 1.2), "#7a6a55", [0, 0.6, 0]],
      [ball(0.5, 0.9, 3.2, 0.9), "#d9b03e", [0, 2.6, 0]],
    ]),
  willow: () =>
    species([
      [cyl(0.1, 0.14, 1.1), "#6b5a45", [0, 0.55, 0]],
      [ball(1.1, 1, 0.7, 1), "#8fb35a", [0, 1.7, 0]],
      [ball(1.0, 1.05, 0.5, 1.05), "#7da34e", [0, 1.15, 0]],
    ]),
  // Seabuckthorn: grey-green scrub with orange berries along the rivers.
  buckthorn: () =>
    species([
      [ball(0.45, 1.2, 0.7, 1), "#8a9a6a", [0, 0.32, 0]],
      ...(
        [
          [0.3, 0.5, 0.15],
          [-0.25, 0.45, 0.2],
          [0.05, 0.6, -0.25],
          [-0.35, 0.35, -0.1],
        ] as [number, number, number][]
      ).map(
        (at) =>
          [ball(0.06), "#e07b2c", at] as [THREE.BufferGeometry, string, [number, number, number]],
      ),
    ]),
  // Khejri (the Thar's tree of life): a crooked grey trunk, lopped low, under
  // a flat, feathery, grey-green umbrella.
  khejri: () =>
    species([
      [cyl(0.11, 0.17, 1.5), "#7b6a58", [0, 0.75, 0]],
      [cyl(0.06, 0.09, 0.9), "#7b6a58", [0.32, 1.65, 0.05]],
      [cyl(0.06, 0.08, 0.8), "#7b6a58", [-0.28, 1.6, -0.12]],
      [ball(1.25, 1.25, 0.32, 1.1), "#8f9a6a", [0, 2.15, 0]],
      [ball(0.8, 1.2, 0.3, 1.1), "#9ca777", [0.45, 2.45, 0.2]],
      [ball(0.7, 1.2, 0.3, 1.1), "#85905f", [-0.5, 2.35, -0.25]],
    ]),
  // Ber (wild jujube): a thorny, rounded desert bush with small orange fruit.
  ber: () =>
    species([
      [cyl(0.05, 0.07, 0.4), "#6b5a45", [0, 0.2, 0]],
      [ball(0.7, 1.15, 0.75, 1.05), "#6f8a45", [0, 0.75, 0]],
      [ball(0.45, 1.1, 0.7, 1), "#7c9750", [0.4, 0.95, 0.2]],
      ...(
        [
          [0.55, 0.85, 0.35],
          [-0.5, 0.7, 0.4],
          [0.15, 1.15, -0.55],
          [-0.4, 1.0, -0.4],
          [0.7, 0.6, -0.2],
        ] as [number, number, number][]
      ).map(
        (at) =>
          [ball(0.07), "#e0812c", at] as [THREE.BufferGeometry, string, [number, number, number]],
      ),
    ]),
  // A tuft of wildflowers.
  flowers: () =>
    species([
      [ball(0.07), "#e86fa1", [0.1, 0.1, 0]],
      [ball(0.07), "#9b6fd6", [-0.08, 0.08, 0.08]],
      [ball(0.07), "#f2c230", [0, 0.12, -0.1]],
      [ball(0.12, 1.4, 0.4, 1.4), "#5f9c43", [0, 0.04, 0]],
    ]),
};

/** A species' geometry (vertex-coloured), e.g. for design boards. */
export function floraShape(kind: Flora): THREE.BufferGeometry {
  return SHAPES[kind]();
}

/** Solid trees (their trunks): the bike bounces off these, not off flowers or scrub. */
export const SOLID: Partial<Record<Flora, number>> = {
  deodar: 0.5,
  pine: 0.4,
  apple: 0.35,
  poplar: 0.3,
  poplarGold: 0.3,
  willow: 0.45,
  khejri: 0.4,
  ber: 0.55,
};

/**
 * Scatters one kind of plant as a single instanced mesh. `spot` proposes a
 * place (or null); `height` sets it on the ground. Returns the mesh and the
 * trunk circles of solid trees.
 */
export function scatter(
  kind: Flora,
  count: number,
  spot: (rnd: () => number) => { x: number; z: number } | null,
  height: (x: number, z: number) => number,
  rnd: () => number,
  scale: [number, number] = [0.8, 1.25],
): { mesh: THREE.InstancedMesh; solid: { x: number; z: number; r: number }[] } {
  const pts: { x: number; z: number; s: number; yaw: number }[] = [];
  for (let tries = 0; pts.length < count && tries < count * 12; tries++) {
    const p = spot(rnd);
    if (!p) continue;
    pts.push({ ...p, s: scale[0] + rnd() * (scale[1] - scale[0]), yaw: rnd() * Math.PI * 2 });
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const mesh = new THREE.InstancedMesh(SHAPES[kind](), mat, Math.max(1, pts.length));
  mesh.count = pts.length;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  pts.forEach((p, i) => {
    q.setFromAxisAngle(up, p.yaw);
    m.compose(
      new THREE.Vector3(p.x, height(p.x, p.z) - 0.05, p.z),
      q,
      new THREE.Vector3(p.s, p.s, p.s),
    );
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = kind !== "flowers";
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  mesh.userData.flora = kind;
  const r = SOLID[kind];
  return {
    mesh,
    solid: r ? pts.map((p) => ({ x: p.x, z: p.z, r: r * p.s })) : [],
  };
}

// ── Himachal ────────────────────────────────────────────────────────────────

/** A Kath-kuni house: dry-stone and deodar-timber courses, a grey slate roof, a balcony. */
export function kathkuni(kit: Kit, w = 3, d = 2.6, floors = 2): THREE.Group {
  const g = new THREE.Group();
  const course = 0.36;
  const top = floors * 1.45;
  g.add(box(kit, "#8e8a82", [-w / 2 - 0.1, -2, -d / 2 - 0.1], [w / 2 + 0.1, 0.05, d / 2 + 0.1]));
  for (let y = 0, k = 0; y < top; y += course, k++)
    g.add(
      box(
        kit,
        k % 2 ? "#a49d90" : "#7a5236",
        [-w / 2, y, -d / 2],
        [w / 2, Math.min(top, y + course), d / 2],
      ),
    );
  // A carved wooden balcony on the upper floor.
  g.add(
    box(kit, "#6b4528", [-w / 2 - 0.05, top - 1.2, d / 2], [w / 2 + 0.05, top - 1.1, d / 2 + 0.6]),
  );
  for (let i = 0; i <= 6; i++) {
    const x = -w / 2 + (i * w) / 6;
    g.add(tube(kit, "#5a3a22", [x, top - 1.1, d / 2 + 0.55], [x, top - 0.55, d / 2 + 0.55], 0.03));
  }
  // Pitched slate roof: two slopes hinged at the ridge, falling to the eaves.
  const run = d / 2 + 0.55;
  const pitch = 0.55;
  const ridge = top + run * Math.sin(pitch);
  for (const side of [0, Math.PI]) {
    const hinge = new THREE.Group();
    hinge.position.set(0, ridge, 0);
    hinge.rotation.set(0, side, 0);
    const tilt = new THREE.Group();
    tilt.rotation.x = pitch;
    tilt.add(box(kit, "#5f6670", [-w / 2 - 0.35, -0.06, 0], [w / 2 + 0.35, 0.06, run]));
    hinge.add(tilt);
    g.add(hinge);
  }
  g.add(
    box(kit, "#4a5058", [-w / 2 - 0.35, ridge - 0.02, -0.1], [w / 2 + 0.35, ridge + 0.12, 0.1]),
  );
  return g;
}

/** A Sarchu/Pang-style dhaba: bright parachute tents, a counter, a kettle steaming. */
export function parachuteDhaba(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const stripes = ["#e8452c", "#f2c230", "#2b6cb0", "#f3f1ea", "#4f9a45"];
  for (const [x, z, r] of [
    [0, 0, 2.4],
    [4.4, 1.2, 1.9],
  ] as [number, number, number][]) {
    for (let k = 0; k < 10; k++) {
      const seg = new THREE.Mesh(
        new THREE.SphereGeometry(
          r,
          6,
          6,
          (k / 10) * Math.PI * 2,
          (Math.PI * 2) / 10,
          0,
          Math.PI / 2,
        ),
        kit.mat(stripes[k % stripes.length] ?? "#e8452c"),
      );
      seg.position.set(x, 0, z);
      seg.scale.y = 0.75;
      seg.castShadow = true;
      g.add(seg);
    }
  }
  g.add(box(kit, "#8a6a45", [-1.0, 0, 2.4], [1.0, 0.9, 2.9]));
  g.add(sphere(kit, "#c9cdd2", [0.4, 1.05, 2.65], 0.14, { metal: true }));
  return g;
}

/** A footbridge over a river: two pairs of posts, a plank deck on cables, prayer flags. */
export function footbridge(kit: Kit, span: number): THREE.Group {
  const g = new THREE.Group();
  const flags = ["#2b6cb0", "#f3f5f8", "#d93a2f", "#4f9a45", "#f2c14e"];
  for (const x of [-span / 2, span / 2]) {
    for (const z of [-0.7, 0.7]) g.add(tube(kit, "#6b4a32", [x, 0, z], [x, 2.6, z], 0.08));
  }
  const sag = (u: number) => 1.2 - Math.sin(u * Math.PI) * 0.7;
  const n = 18;
  for (let i = 0; i < n; i++) {
    const u0 = i / n;
    const x0 = -span / 2 + u0 * span;
    g.add(
      box(
        kit,
        "#9a7a52",
        [x0, sag(u0 + 0.5 / n) - 0.05, -0.6],
        [x0 + span / n - 0.05, sag(u0 + 0.5 / n), 0.6],
      ),
    );
  }
  for (const z of [-0.7, 0.7]) {
    for (let i = 0; i < n; i++) {
      const a = i / n;
      const b = (i + 1) / n;
      g.add(
        tube(
          kit,
          "#3a3a3a",
          [-span / 2 + a * span, sag(a) + 1.0, z],
          [-span / 2 + b * span, sag(b) + 1.0, z],
          0.025,
        ),
      );
      if (i % 2 === 0)
        g.add(
          box(
            kit,
            flags[(i / 2) % flags.length] ?? "#2b6cb0",
            [-span / 2 + a * span, sag(a) + 0.65, z - 0.01],
            [-span / 2 + a * span + 0.35, sag(a) + 0.95, z + 0.01],
          ),
        );
    }
  }
  g.userData.bridge = true;
  return g;
}

/** A waterfall tumbling down a hillside: falling ribbons, white water and spray at the foot. */
export function waterfall(kit: Kit, drop: number, run: number): THREE.Group {
  const g = new THREE.Group();
  const water = (kit.mat("#bfe7f0", { glass: true }) as THREE.MeshStandardMaterial).clone();
  water.opacity = 0.85;
  for (let k = 0; k < 3; k++) {
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9 - k * 0.2, Math.hypot(drop, run)),
      water,
    );
    sheet.position.set((k - 1) * 0.35, drop / 2, run / 2);
    sheet.rotation.x = -Math.atan2(run, drop);
    g.add(sheet);
  }
  for (let i = 0; i < 9; i++)
    g.add(
      sphere(
        kit,
        "#ffffff",
        [Math.sin(i * 1.7) * 1.1, 0.3 + (i % 3) * 0.25, run + Math.cos(i * 2.3) * 0.9],
        0.45 + (i % 3) * 0.15,
        { glass: true },
      ),
    );
  return g;
}

// ── Ladakh life ────────────────────────────────────────────────────────────

/** A Bactrian camel (two humps), as at Hunder in the Nubra valley. */
export function camel(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const coat = "#b98b5a";
  g.add(sphere(kit, coat, [0, 1.5, 0], 0.75, undefined, [1.4, 0.75, 0.75]));
  for (const x of [-0.45, 0.4])
    g.add(sphere(kit, "#a87a4c", [x, 2.05, 0], 0.32, undefined, [1, 1.2, 1]));
  g.add(tube(kit, coat, [0.85, 1.6, 0], [1.25, 2.2, 0], 0.17));
  g.add(sphere(kit, coat, [1.4, 2.25, 0], 0.22, undefined, [1.5, 0.9, 0.9]));
  for (const [x, z] of [
    [0.6, 0.3],
    [0.6, -0.3],
    [-0.6, 0.3],
    [-0.6, -0.3],
  ] as const)
    g.add(tube(kit, "#9a7048", [x, 1.2, z], [x, 0, z], 0.09));
  g.userData.dodge = "animal";
  return g;
}

/** Bharal (Himalayan blue sheep) on a ledge. */
export function bharal(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(sphere(kit, "#8a8378", [0, 0.75, 0], 0.4, undefined, [1.4, 0.8, 0.8]));
  g.add(sphere(kit, "#8a8378", [0.55, 1.05, 0], 0.18, undefined, [1.3, 1, 1]));
  for (const s of [-1, 1])
    g.add(tube(kit, "#6e665c", [0.55, 1.2, s * 0.07], [0.35, 1.35, s * 0.22], 0.04));
  for (const [x, z] of [
    [0.3, 0.15],
    [0.3, -0.15],
    [-0.3, 0.15],
    [-0.3, -0.15],
  ] as const)
    g.add(tube(kit, "#6e665c", [x, 0.55, z], [x, 0, z], 0.05));
  g.userData.dodge = "animal";
  return g;
}

/** Lammergeiers circling high (big, slow wings): a flock the world animates. */
export function lammergeiers(kit: Kit, n: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group();
    for (const s of [-1, 1]) {
      const wing = box(kit, "#3a3530", [0, -0.04, 0], [1.1, 0.04, 0.32]);
      wing.rotation.y = s * 2.6;
      wing.rotation.z = 0.12;
      b.add(wing);
    }
    b.add(sphere(kit, "#d9b98c", [0, 0, 0], 0.18, undefined, [2, 0.8, 0.8]));
    b.position.set(Math.cos(i * 2.1) * 6, Math.sin(i * 1.3) * 1.5, Math.sin(i * 2.1) * 6);
    g.add(b);
  }
  g.userData.birds = true;
  return g;
}

/** A high cloud: drifts, and its shadow slides over the land below. */
export function highCloud(r: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    color: "#ffffff",
    emissive: "#eef4ff",
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.9,
  });
  for (const [dx, dy, dz, s] of [
    [0, 0, 0, 1],
    [r * 0.75, -0.2, 0.25 * r, 0.75],
    [-r * 0.7, -0.15, -0.15 * r, 0.7],
    [0.25 * r, 0.3 * r, -0.4 * r, 0.6],
  ] as [number, number, number, number][]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r * s, 14, 8), mat);
    m.scale.y = 0.4;
    m.position.set(dx, dy, dz);
    m.castShadow = true;
    g.add(m);
  }
  g.userData.cloud = true;
  return g;
}

/** Spindrift blowing off a summit: a long translucent white streamer. */
export function snowPlume(length: number): THREE.Mesh {
  const geo = new THREE.ConeGeometry(1.6, length, 10, 1, true);
  geo.rotateZ(Math.PI / 2);
  geo.translate(-length / 2, 0, 0);
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  return m;
}

/** A dust devil: a slim spinning column of dust on the plateau. */
export function dustDevil(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: "#d8c09a",
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (let k = 0; k < 4; k++) {
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9 + k * 0.5, 0.25 + k * 0.15, 1.6, 12, 1, true),
      mat,
    );
    c.position.y = 0.8 + k * 1.5;
    c.rotation.y = k;
    g.add(c);
  }
  g.userData.spin = 2.5;
  return g;
}
