/**
 * Things with weight, shared by every journey: real rigid bodies (Rapier)
 * that the bike knocks over, pushes and scatters. Sacks topple and slump,
 * milk cans roll, crates tip their cherries out, chairs and tumblers go
 * flying, pots wobble over, bamboo fences fall, firewood stacks collapse.
 *
 * - The bike is a kinematic body: it pushes props, and the knock slows it a
 *   little in proportion to what it hit (so a sack stack feels heavier than a
 *   tumbler).
 * - Everything starts asleep (free until touched) and stays where it fell for
 *   the rest of the ride; the next ride into the world finds it all back home.
 * - Flat worlds also bring toys as bodies (pots, hay bales, bollards), each as
 *   heavy as it looks, so a light pot flies and a hay bale barely shifts.
 * - Drawn as instanced meshes: one draw per kind and material.
 */

import type RAPIER_NS from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { RouteId } from "../../content/types";
import type { WorldData } from "../lib/journey";
import { batch } from "../merge";
import type { Blocker } from "./bike";
import type { Ground } from "./ground";
import type { ClangKind } from "./sound";

type Rapier = typeof RAPIER_NS;

export type PropKind =
  | "sack"
  | "crate"
  | "cherry"
  | "can"
  | "chair"
  | "table"
  | "tumbler"
  | "pot"
  | "fence"
  | "log"
  | "drum"
  | "bro"
  | "jerrycan"
  | "stone";

export interface PropSpot {
  kind: PropKind;
  x: number;
  z: number;
  /** Height of its base above the ground (for stacking). */
  lift?: number;
  yaw?: number;
}

/** A knock worth hearing: the caller plays the sound and slows the bike. */
export interface Knock {
  kind: ClangKind;
  strength: number;
  /** The bike hit it (not just a prop landing). */
  bike: boolean;
  /** Mass of what was hit, kg. */
  mass: number;
}

interface Collider {
  shape: "box" | "cyl" | "ball";
  /** box: half extents; cyl: [halfHeight, radius]; ball: [radius]. */
  size: number[];
  at: [number, number, number];
  /** Lay a cylinder along x. */
  sideways?: boolean;
  /** A wheel: no friction, so it rolls (slides) freely. */
  wheel?: boolean;
}

interface KindDef {
  colliders: Collider[];
  /** How quickly its spin dies (default 0.35). */
  angDamp?: number;
  density: number;
  sound: ClangKind;
  build(): THREE.Group;
}

// ── visuals (origin at the base, centred) ───────────────────────────────────

const mats = new Map<string, THREE.MeshStandardMaterial>();
const mat = (colour: string, o: { metal?: boolean; rough?: number } = {}) => {
  const key = `${colour}${o.metal ? "m" : ""}${o.rough ?? ""}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: colour,
      roughness: o.rough ?? (o.metal ? 0.3 : 0.8),
      metalness: o.metal ? 0.7 : 0,
    });
    mats.set(key, m);
  }
  return m;
};
const mesh = (
  g: THREE.BufferGeometry,
  m: THREE.Material,
  at: [number, number, number],
  rot?: [number, number, number],
) => {
  const x = new THREE.Mesh(g, m);
  x.position.set(...at);
  if (rot) x.rotation.set(...rot);
  x.castShadow = true;
  x.receiveShadow = true;
  return x;
};
const round = (w: number, h: number, d: number, r: number) => {
  // A soft box: a box with its corners pulled toward a sphere.
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(
      Math.max(-w / 2 + r, Math.min(w / 2 - r, v.x)),
      Math.max(-h / 2 + r, Math.min(h / 2 - r, v.y)),
      Math.max(-d / 2 + r, Math.min(d / 2 - r, v.z)),
    );
    const off = v.clone().sub(c);
    if (off.lengthSq() > 0) v.copy(c).add(off.setLength(Math.min(r, off.length())));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
};

const KINDS: Record<PropKind, KindDef> = {
  // A jute coffee sack lying flat, stamped with a dark band.
  sack: {
    colliders: [{ shape: "box", size: [0.36, 0.14, 0.24], at: [0, 0.14, 0] }],
    density: 330,
    sound: "soft",
    build() {
      const g = new THREE.Group();
      g.add(mesh(round(0.74, 0.28, 0.5, 0.12), mat("#b8956a", { rough: 1 }), [0, 0.14, 0]));
      g.add(mesh(round(0.2, 0.285, 0.505, 0.1), mat("#8a6a45", { rough: 1 }), [0.12, 0.14, 0]));
      g.add(
        mesh(
          new THREE.CircleGeometry(0.07, 14),
          mat("#5a3b28"),
          [-0.14, 0.285, 0],
          [-Math.PI / 2, 0, 0],
        ),
      );
      return g;
    },
  },
  // A slatted crate (open top); cherries sit in it as their own bodies.
  crate: {
    colliders: [{ shape: "box", size: [0.3, 0.17, 0.21], at: [0, 0.17, 0] }],
    density: 220,
    sound: "wood",
    build() {
      const g = new THREE.Group();
      const wood = mat("#a8743f");
      const dark = mat("#7f5530");
      g.add(mesh(new THREE.BoxGeometry(0.6, 0.04, 0.42), dark, [0, 0.02, 0]));
      for (const y of [0.1, 0.22]) {
        g.add(mesh(new THREE.BoxGeometry(0.6, 0.08, 0.025), wood, [0, y, 0.2]));
        g.add(mesh(new THREE.BoxGeometry(0.6, 0.08, 0.025), wood, [0, y, -0.2]));
        g.add(mesh(new THREE.BoxGeometry(0.025, 0.08, 0.42), wood, [0.29, y, 0]));
        g.add(mesh(new THREE.BoxGeometry(0.025, 0.08, 0.42), wood, [-0.29, y, 0]));
      }
      for (const x of [-0.28, 0.28])
        for (const z of [-0.19, 0.19])
          g.add(mesh(new THREE.BoxGeometry(0.04, 0.34, 0.04), dark, [x, 0.17, z]));
      return g;
    },
  },
  cherry: {
    colliders: [{ shape: "ball", size: [0.05], at: [0, 0.05, 0] }],
    density: 900,
    sound: "soft",
    build() {
      const g = new THREE.Group();
      g.add(
        mesh(new THREE.SphereGeometry(0.05, 10, 8), mat("#c0392b", { rough: 0.45 }), [0, 0.05, 0]),
      );
      return g;
    },
  },
  // A steel milk can.
  can: {
    colliders: [{ shape: "cyl", size: [0.3, 0.17], at: [0, 0.3, 0] }],
    density: 160,
    sound: "metal",
    build() {
      const g = new THREE.Group();
      const steel = mat("#c9ced3", { metal: true });
      g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 20), steel, [0, 0.21, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.1, 20), steel, [0, 0.47, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 20), steel, [0, 0.55, 0]));
      g.add(
        mesh(
          new THREE.CylinderGeometry(0.115, 0.115, 0.03, 20),
          mat("#9aa3ad", { metal: true }),
          [0, 0.59, 0],
        ),
      );
      g.add(
        mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 24), steel, [0, 0.3, 0], [Math.PI / 2, 0, 0]),
      );
      return g;
    },
  },
  // A red monobloc plastic chair (as at every chai stall).
  chair: {
    colliders: [
      { shape: "box", size: [0.21, 0.025, 0.21], at: [0, 0.42, 0] },
      { shape: "box", size: [0.025, 0.2, 0.2], at: [-0.2, 0.64, 0] },
      { shape: "box", size: [0.18, 0.2, 0.18], at: [0, 0.2, 0] },
    ],
    density: 60,
    sound: "wood",
    build() {
      const g = new THREE.Group();
      const red = mat("#c8372d", { rough: 0.5 });
      g.add(mesh(round(0.44, 0.05, 0.42, 0.02), red, [0, 0.42, 0]));
      g.add(mesh(round(0.05, 0.4, 0.4, 0.02), red, [-0.2, 0.64, 0], [0, 0, 0.12]));
      for (const x of [-0.18, 0.18])
        for (const z of [-0.18, 0.18])
          g.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.42, 8), red, [x, 0.21, z]));
      return g;
    },
  },
  // A small steel chai table.
  table: {
    colliders: [
      { shape: "box", size: [0.4, 0.02, 0.3], at: [0, 0.72, 0] },
      { shape: "box", size: [0.36, 0.35, 0.26], at: [0, 0.35, 0] },
    ],
    density: 40,
    sound: "metal",
    build() {
      const g = new THREE.Group();
      const steel = mat("#aab3bb", { metal: true });
      g.add(mesh(new THREE.BoxGeometry(0.8, 0.04, 0.6), steel, [0, 0.72, 0]));
      for (const x of [-0.36, 0.36])
        for (const z of [-0.26, 0.26])
          g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 8), steel, [x, 0.35, z]));
      return g;
    },
  },
  // A steel tumbler of filter kaapi.
  tumbler: {
    colliders: [{ shape: "cyl", size: [0.055, 0.04], at: [0, 0.055, 0] }],
    density: 500,
    sound: "metal",
    build() {
      const g = new THREE.Group();
      g.add(
        mesh(
          new THREE.CylinderGeometry(0.042, 0.034, 0.11, 14),
          mat("#d6dbe0", { metal: true }),
          [0, 0.055, 0],
        ),
      );
      g.add(
        mesh(
          new THREE.CircleGeometry(0.038, 14),
          mat("#c8a27a", { rough: 0.6 }),
          [0, 0.1, 0],
          [-Math.PI / 2, 0, 0],
        ),
      );
      return g;
    },
  },
  // A terracotta pot with a plant.
  pot: {
    colliders: [{ shape: "cyl", size: [0.19, 0.22], at: [0, 0.19, 0] }],
    density: 260,
    sound: "pot",
    build() {
      const g = new THREE.Group();
      const clay = mat("#b5603a", { rough: 0.9 });
      g.add(mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.36, 18), clay, [0, 0.18, 0]));
      g.add(
        mesh(new THREE.TorusGeometry(0.235, 0.03, 8, 22), clay, [0, 0.36, 0], [Math.PI / 2, 0, 0]),
      );
      g.add(mesh(new THREE.SphereGeometry(0.26, 14, 10), mat("#3f8f4a"), [0, 0.5, 0], [0, 0, 0]));
      return g;
    },
  },
  // A bamboo fence section: two posts and two rails, 1.9 m long.
  fence: {
    colliders: [{ shape: "box", size: [0.95, 0.45, 0.04], at: [0, 0.5, 0] }],
    density: 70,
    sound: "wood",
    build() {
      const g = new THREE.Group();
      const bamboo = mat("#c8b46a", { rough: 0.6 });
      const node = mat("#9c8a48");
      for (const x of [-0.9, 0.9]) {
        g.add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.0, 10), bamboo, [x, 0.5, 0]));
        g.add(mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.03, 10), node, [x, 0.55, 0]));
      }
      for (const y of [0.42, 0.82])
        g.add(
          mesh(
            new THREE.CylinderGeometry(0.035, 0.035, 1.92, 10),
            bamboo,
            [0, y, 0],
            [0, 0, Math.PI / 2],
          ),
        );
      return g;
    },
  },
  // A firewood log, lying along x.
  log: {
    colliders: [{ shape: "cyl", size: [0.35, 0.06], at: [0, 0.06, 0], sideways: true }],
    density: 600,
    sound: "wood",
    build() {
      const g = new THREE.Group();
      g.add(
        mesh(
          new THREE.CylinderGeometry(0.06, 0.065, 0.7, 10),
          mat("#7a5132", { rough: 1 }),
          [0, 0.06, 0],
          [0, 0, Math.PI / 2],
        ),
      );
      for (const s of [-1, 1])
        g.add(
          mesh(
            new THREE.CircleGeometry(0.058, 10),
            mat("#c49a6c"),
            [s * 0.351, 0.06, 0],
            [0, (s * Math.PI) / 2, 0],
          ),
        );
      return g;
    },
  },
  // An army-green fuel drum.
  drum: {
    colliders: [{ shape: "cyl", size: [0.44, 0.29], at: [0, 0.44, 0] }],
    density: 120,
    sound: "metal",
    build() {
      const g = new THREE.Group();
      g.add(
        mesh(
          new THREE.CylinderGeometry(0.29, 0.29, 0.88, 20),
          mat("#4f5a3a", { rough: 0.6 }),
          [0, 0.44, 0],
        ),
      );
      for (const y of [0.29, 0.59])
        g.add(
          mesh(
            new THREE.TorusGeometry(0.29, 0.015, 6, 24),
            mat("#3f4830"),
            [0, y, 0],
            [Math.PI / 2, 0, 0],
          ),
        );
      g.add(
        mesh(
          new THREE.CircleGeometry(0.27, 20),
          mat("#5d6a45"),
          [0, 0.881, 0],
          [-Math.PI / 2, 0, 0],
        ),
      );
      return g;
    },
  },
  // A Border Roads drum: black and yellow bands, every Ladakh hairpin has them.
  bro: {
    colliders: [{ shape: "cyl", size: [0.44, 0.29], at: [0, 0.44, 0] }],
    density: 90,
    sound: "metal",
    build() {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++)
        g.add(
          mesh(
            new THREE.CylinderGeometry(0.29, 0.29, 0.22, 20),
            mat(k % 2 ? "#1d1f24" : "#f2c230", { rough: 0.55 }),
            [0, 0.11 + k * 0.22, 0],
          ),
        );
      return g;
    },
  },
  // A jerrycan.
  jerrycan: {
    colliders: [{ shape: "box", size: [0.17, 0.23, 0.09], at: [0, 0.23, 0] }],
    density: 300,
    sound: "metal",
    build() {
      const g = new THREE.Group();
      g.add(mesh(round(0.34, 0.46, 0.18, 0.03), mat("#6b7a3c", { rough: 0.6 }), [0, 0.23, 0]));
      g.add(mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), mat("#5a6832"), [-0.05, 0.48, 0]));
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), mat("#2b2f22"), [0.11, 0.48, 0]));
      return g;
    },
  },
  // A mani stone: a flat river stone carved with a mantra, piled by the walls.
  stone: {
    colliders: [{ shape: "box", size: [0.2, 0.06, 0.14], at: [0, 0.06, 0] }],
    density: 2400,
    sound: "wood",
    build() {
      const g = new THREE.Group();
      g.add(mesh(round(0.4, 0.12, 0.28, 0.05), mat("#9a958e", { rough: 0.95 }), [0, 0.06, 0]));
      g.add(
        mesh(
          new THREE.PlaneGeometry(0.22, 0.12),
          mat("#f2efe6"),
          [0, 0.121, 0],
          [-Math.PI / 2, 0, 0],
        ),
      );
      return g;
    },
  },
};

// ── the world ──────────────────────────────────────────────────────────────

/**
 * A toy from the flat kit as a body: a box the size of its bounds, as heavy
 * as `mass` (kg), drawn with the world's clay and a paper shadow.
 */
export interface ToySpot {
  id: string;
  x: number;
  z: number;
  /** Height of its base above the ground (for stacking). */
  lift?: number;
  yaw: number;
  scale: number;
  mass: number;
  sound: ClangKind;
  geometry: THREE.BufferGeometry;
  /** On wheels: a body on four frictionless balls, so a push rolls it along. */
  wheels?: boolean;
  /** A tree: a trunk under a heavy canopy, so it topples. */
  tree?: boolean;
}

/** Scenery the bike can knock about (see WorldData.knockables), with its geometry. */
export interface Knockable extends ToySpot {
  hide(): void;
}

/** Bike and rider (kg): what everything knocked is weighed against. */
const BIKE_MASS = 250;
/** Collision groups (membership << 16 | filter): the ground, and the bike's body, which skips it. */
const GROUND_GROUPS = (0x0002 << 16) | 0xffff;
const BIKE_GROUPS = (0x0001 << 16) | 0xfffd;

/** Knockables are looked up in squares this big (m). */
const KNOCK_CELL = 6;

/** How a flat world draws props: its clay material and paper-shadow material. */
export interface FlatLook {
  clay: (colour: THREE.Color) => THREE.Material;
  toyMaterial: THREE.Material;
  shadow: THREE.Material;
}

interface Body {
  kind: string;
  body: RAPIER_NS.RigidBody;
  slot: number;
  quietUntil: number;
}

let rapier: Rapier | null = null;

/** Loads the physics engine once (it's only needed inside a world). */
async function loadRapier(): Promise<Rapier> {
  if (rapier) return rapier;
  const mod = await import("@dimforge/rapier3d-compat");
  const R = (mod as unknown as { default?: Rapier }).default ?? (mod as unknown as Rapier);
  await R.init();
  rapier = R;
  return R;
}

export class Props {
  readonly group = new THREE.Group();
  private readonly world: RAPIER_NS.World;
  private readonly events: RAPIER_NS.EventQueue;
  private readonly bodies: Body[] = [];
  private readonly byCollider = new Map<number, Body>();
  private readonly bike: RAPIER_NS.RigidBody;
  private readonly bikeCollider: number;
  /** Instanced visuals: for each kind, one instanced mesh per material. */
  private readonly visuals = new Map<string, THREE.InstancedMesh[]>();
  /** Toy kinds (one per toy and scale): their colliders, density, sound and look. */
  private readonly toyKinds = new Map<
    string,
    KindDef & { geometry: THREE.BufferGeometry; scale: number }
  >();
  private readonly scales = new Map<string, THREE.Vector3>();
  /** Scenery to knock about, by area; which have been taken over; their bodies and meshes. */
  private readonly knockCells = new Map<string, number[]>();
  private readonly taken = new Set<number>();
  private readonly live: { body: RAPIER_NS.RigidBody; meshes: THREE.Mesh[]; placed: boolean }[] =
    [];
  private heightAt: (x: number, z: number) => number = () => 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private time = 0;
  private dirty = true;

  private constructor(
    private readonly R: Rapier,
    _id: RouteId,
    ground: THREE.Mesh,
    blockers: readonly Blocker[],
    heightAt: (x: number, z: number) => number,
    spots: PropSpot[],
    toys: ToySpot[],
    private readonly look?: FlatLook,
    private readonly knock: Knockable[] = [],
  ) {
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 120;
    this.world = world;
    this.events = new R.EventQueue(true);
    // The ground: the terrain mesh itself.
    const geo = ground.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const verts = new Float32Array(pos.array as ArrayLike<number>);
    const index = geo.index
      ? new Uint32Array(geo.index.array as ArrayLike<number>)
      : Uint32Array.from({ length: pos.count }, (_, i) => i);
    // (In its own collision group, which the bike's body ignores: the ride already keeps the
    // bike on the ground, and a level box on a slope digs into it and is held back uphill.)
    world.createCollider(
      R.ColliderDesc.trimesh(verts, index).setFriction(0.9).setCollisionGroups(GROUND_GROUPS),
    );
    // Buildings and trees: solid posts props bounce off.
    for (const b of blockers) {
      const y = heightAt(b.x, b.z);
      world.createCollider(
        R.ColliderDesc.cylinder(3, b.r)
          .setTranslation(b.x, y + 2.6, b.z)
          .setFriction(0.6),
      );
    }
    // The bike: a real body with the weight of bike and rider, so a knock
    // trades momentum both ways (a light thing flies, a heavy one barely
    // moves and slows you). It goes where the ride says each step; the
    // physics only reports how much the knocks held it back.
    this.bike = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .lockRotations()
        .setGravityScale(0)
        .setCanSleep(false)
        .setCcdEnabled(true),
    );
    const bc = world.createCollider(
      R.ColliderDesc.cuboid(1.0, 0.5, 0.3)
        .setTranslation(0, 0.65, 0)
        .setMass(BIKE_MASS)
        .setFriction(0.3)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(40)
        .setCollisionGroups(BIKE_GROUPS),
      this.bike,
    );
    this.bikeCollider = bc.handle;
    // Props where they stand (every ride starts with them home: knocked
    // things stay where they land only for this ride).
    const up = new THREE.Vector3(0, 1, 0);
    for (const s of spots) {
      const y = heightAt(s.x, s.z) + (s.lift ?? 0) + 0.005;
      this.add(
        s.kind,
        new THREE.Vector3(s.x, y, s.z),
        new THREE.Quaternion().setFromAxisAngle(up, s.yaw ?? 0),
      );
    }
    for (const t of toys) {
      const kind = this.toyKind(t);
      const y = heightAt(t.x, t.z) + (t.lift ?? 0) + 0.005;
      this.add(
        kind,
        new THREE.Vector3(t.x, y, t.z),
        new THREE.Quaternion().setFromAxisAngle(up, t.yaw),
      );
    }
    // Scenery to knock about, indexed by area (taken over when the bike comes near).
    for (const [i, k] of this.knock.entries()) {
      const key = `${Math.floor(k.x / KNOCK_CELL)},${Math.floor(k.z / KNOCK_CELL)}`;
      const list = this.knockCells.get(key) ?? [];
      list.push(i);
      this.knockCells.set(key, list);
    }
    this.heightAt = heightAt;
    this.buildVisuals();
  }

  static async create(
    id: RouteId,
    data: WorldData,
    ground: Ground,
    blockers: readonly Blocker[],
    spots: PropSpot[],
    toys: ToySpot[] = [],
    look?: FlatLook,
    knock: Knockable[] = [],
  ): Promise<Props> {
    const R = await loadRapier();
    return new Props(
      R,
      id,
      data.physicsGround ?? data.ground,
      blockers,
      (x, z) => ground.height(x, z),
      spots,
      toys,
      look,
      knock,
    );
  }

  /** The body kind for a toy (one per toy, scale and weight), made on first use. */
  private toyKind(t: ToySpot): string {
    const kind = `toy:${t.id}:${t.scale.toFixed(2)}:${Math.round(t.mass)}:${t.tree ? "t" : ""}`;
    if (this.toyKinds.has(kind)) return kind;
    t.geometry.computeBoundingBox();
    const b = (t.geometry.boundingBox as THREE.Box3).clone();
    const half = b.getSize(new THREE.Vector3()).multiplyScalar(t.scale / 2);
    const centre = b.getCenter(new THREE.Vector3()).multiplyScalar(t.scale);
    const W = 0.18 * t.scale;
    let colliders: Collider[];
    if (t.tree) {
      // A slim trunk under a heavy canopy: knocked, it topples over.
      const H = half.y * 2;
      const R = Math.max(0.2, Math.min(half.x, half.z));
      // (The canopy is a flat-sided block, not a ball, so a fallen tree lies
      // on its side instead of rolling about like a beach ball.)
      colliders = [
        { shape: "cyl", size: [H * 0.3, 0.12 * t.scale], at: [0, H * 0.3, 0] },
        {
          shape: "box",
          size: [R, Math.max(0.2, (H * 0.55) / 2), R],
          at: [centre.x, H * 0.72, centre.z],
        },
      ];
    } else if (t.wheels) {
      // The body rides above four wheels.
      colliders = [
        {
          shape: "box",
          size: [half.x, Math.max(0.05, half.y - W), half.z],
          at: [centre.x, centre.y + W, centre.z],
        },
        ...[
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ].map(([sx = 1, sz = 1]) => ({
          shape: "ball" as const,
          size: [W],
          at: [centre.x + sx * half.x * 0.7, W, centre.z + sz * half.z * 0.7] as [
            number,
            number,
            number,
          ],
          wheel: true,
        })),
      ];
    } else
      colliders = [
        { shape: "box", size: [half.x, half.y, half.z], at: [centre.x, centre.y, centre.z] },
      ];
    this.toyKinds.set(kind, {
      colliders,
      // Trees fall and stay down: their spin dies quickly.
      ...(t.tree ? { angDamp: 2.5 } : {}),
      density: t.mass / colliders.reduce((a, c) => a + volume(c), 0),
      sound: t.sound,
      build: () => new THREE.Group(),
      geometry: t.geometry,
      scale: t.scale,
    });
    this.scales.set(kind, new THREE.Vector3().setScalar(t.scale));
    return kind;
  }

  /**
   * Hands the scenery near (x, z) over to the physics: within `r`, each
   * shrub, tree or rock not yet taken over leaves the static scenery and
   * becomes a body (asleep until the bike touches it), drawn on its own.
   */
  wakeNear(x: number, z: number, r: number): void {
    if (!this.knock.length) return;
    const c0 = Math.floor((x - r) / KNOCK_CELL);
    const c1 = Math.floor((x + r) / KNOCK_CELL);
    const d0 = Math.floor((z - r) / KNOCK_CELL);
    const d1 = Math.floor((z + r) / KNOCK_CELL);
    for (let i = c0; i <= c1; i++)
      for (let j = d0; j <= d1; j++) {
        const list = this.knockCells.get(`${i},${j}`);
        if (!list) continue;
        for (const n of list) {
          if (this.taken.has(n)) continue;
          const k = this.knock[n] as Knockable;
          if (Math.hypot(k.x - x, k.z - z) > r) continue;
          this.taken.add(n);
          k.hide();
          const kind = this.toyKind({ ...k, geometry: k.geometry });
          const before = this.bodies.length;
          this.add(
            kind,
            new THREE.Vector3(k.x, this.heightAt(k.x, k.z) + 0.005, k.z),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k.yaw),
          );
          const body = this.bodies[before] as Body;
          const mesh = new THREE.Mesh(
            k.geometry,
            this.look?.toyMaterial ?? new THREE.MeshStandardMaterial({ vertexColors: true }),
          );
          mesh.scale.setScalar(k.scale);
          const meshes = [mesh];
          if (this.look) {
            const sh = new THREE.Mesh(k.geometry, this.look.shadow);
            sh.scale.setScalar(k.scale);
            sh.frustumCulled = false;
            meshes.push(sh);
          }
          for (const m of meshes) this.group.add(m);
          this.live.push({ body: body.body, meshes, placed: false });
        }
      }
  }

  private def(kind: string): KindDef {
    return (KINDS[kind as PropKind] ?? this.toyKinds.get(kind)) as KindDef;
  }

  private add(kind: string, p: THREE.Vector3, q: THREE.Quaternion): void {
    const R = this.R;
    const def = this.def(kind);
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y, p.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.15)
        .setAngularDamping(def.angDamp ?? 0.35)
        .setCanSleep(true)
        .setSleeping(true),
    );
    const record: Body = {
      kind,
      body,
      slot: this.bodies.filter((b) => b.kind === kind).length,
      quietUntil: 0,
    };
    for (const c of def.colliders) {
      let d: RAPIER_NS.ColliderDesc;
      if (c.shape === "box")
        d = R.ColliderDesc.cuboid(c.size[0] ?? 0.1, c.size[1] ?? 0.1, c.size[2] ?? 0.1);
      else if (c.shape === "cyl") d = R.ColliderDesc.cylinder(c.size[0] ?? 0.1, c.size[1] ?? 0.1);
      else d = R.ColliderDesc.ball(c.size[0] ?? 0.1);
      d.setTranslation(...c.at)
        .setDensity(def.density)
        .setFriction(c.wheel ? 0 : kind === "can" || kind === "cherry" ? 0.5 : 0.85)
        .setRestitution(kind === "can" || kind === "tumbler" ? 0.25 : 0.08)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
        // Only knocks, not resting weight: a few times the prop's own weight.
        .setContactForceEventThreshold(def.density * volume(c) * 9.81 * 6 + 2);
      if (c.sideways) {
        const r = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
        d.setRotation({ x: r.x, y: r.y, z: r.z, w: r.w });
      }
      const col = this.world.createCollider(d, body);
      this.byCollider.set(col.handle, record);
    }
    this.bodies.push(record);
  }

  private buildVisuals(): void {
    const look = this.look;
    const instance = (geo: THREE.BufferGeometry, material: THREE.Material, count: number) => {
      const inst = new THREE.InstancedMesh(geo, material, count);
      inst.castShadow = !look;
      inst.receiveShadow = !look;
      // Props move: they're never culled (see sync).
      inst.frustumCulled = false;
      this.group.add(inst);
      return inst;
    };
    const kinds = [...(Object.keys(KINDS) as string[]), ...this.toyKinds.keys()];
    for (const kind of kinds) {
      const count = this.bodies.filter((b) => b.kind === kind).length;
      if (!count) continue;
      const list: THREE.InstancedMesh[] = [];
      const toyKind = this.toyKinds.get(kind);
      if (toyKind) {
        list.push(
          instance(
            toyKind.geometry,
            look?.toyMaterial ?? new THREE.MeshStandardMaterial({ vertexColors: true }),
            count,
          ),
        );
        if (look) list.push(instance(toyKind.geometry, look.shadow, count));
      } else {
        const merged = batch(KINDS[kind as PropKind].build());
        for (const c of merged.children) {
          const src = c as THREE.Mesh;
          if (!src.isMesh) continue;
          // A flat world draws them in its clay, each with a paper shadow.
          const colour = (src.material as THREE.MeshStandardMaterial).color;
          list.push(
            instance(
              src.geometry,
              look && colour ? look.clay(colour) : (src.material as THREE.Material),
              count,
            ),
          );
          if (look) list.push(instance(src.geometry, look.shadow, count));
        }
      }
      this.visuals.set(kind, list);
    }
    this.sync(true);
  }

  /**
   * One physics step (call at the same fixed rate as the bike). Returns the
   * knocks worth a sound, and how much the bike was held back.
   */
  step(bike: {
    x: number;
    y: number;
    z: number;
    heading: number;
    lean: number;
    /** The bike's velocity this step (world x and z). */
    vx: number;
    vz: number;
  }): { knocks: Knock[]; vx: number; vz: number } {
    this.time += this.world.timestep;
    this.q.setFromEuler(this.e.set(-bike.lean, bike.heading, 0, "YXZ"));
    // Where the ride has the bike, moving as fast as it is.
    this.bike.setTranslation({ x: bike.x, y: bike.y, z: bike.z }, true);
    this.bike.setRotation({ x: this.q.x, y: this.q.y, z: this.q.z, w: this.q.w }, true);
    this.bike.setLinvel({ x: bike.vx, y: 0, z: bike.vz }, true);
    this.world.step(this.events);
    // What's left of its speed after this step's knocks.
    const after = this.bike.linvel();
    const knocks: Knock[] = [];
    this.events.drainContactForceEvents((ev) => {
      const a = ev.collider1();
      const b = ev.collider2();
      const hitBike = a === this.bikeCollider || b === this.bikeCollider;
      const prop = this.byCollider.get(a) ?? this.byCollider.get(b);
      if (!prop || this.time < prop.quietUntil) return;
      prop.quietUntil = this.time + 0.18;
      const mass = prop.body.mass();
      const strength = Math.min(1, ev.totalForceMagnitude() / (mass * 260 + 60));
      if (strength < 0.04) return;
      knocks.push({ kind: this.def(prop.kind).sound, strength, bike: hitBike, mass });
    });
    this.dirty = true;
    return { knocks, vx: after.x, vz: after.z };
  }

  /** Copies awake bodies' poses into the instanced meshes (call once a frame). */
  sync(all = false): void {
    if (!this.dirty && !all) return;
    this.dirty = false;
    const touched = new Set<THREE.InstancedMesh>();
    for (const b of this.bodies) {
      if (!all && b.body.isSleeping()) continue;
      const t = b.body.translation();
      const r = b.body.rotation();
      this.m.compose(
        new THREE.Vector3(t.x, t.y, t.z),
        this.q.set(r.x, r.y, r.z, r.w),
        this.scales.get(b.kind) ?? this.one,
      );
      for (const inst of this.visuals.get(b.kind) ?? []) {
        inst.setMatrixAt(b.slot, this.m);
        touched.add(inst);
      }
    }
    for (const inst of touched) inst.instanceMatrix.needsUpdate = true;
    for (const l of this.live) {
      if (l.placed && l.body.isSleeping()) continue;
      l.placed = true;
      const t = l.body.translation();
      const r = l.body.rotation();
      for (const m of l.meshes) {
        m.position.set(t.x, t.y, t.z);
        m.quaternion.set(r.x, r.y, r.z, r.w);
      }
    }
  }

  dispose(): void {
    this.world.free();
    this.events.free();
    for (const list of this.visuals.values()) for (const inst of list) inst.dispose();
  }
}

function volume(c: Collider): number {
  const s = c.size;
  if (c.shape === "box") return 8 * (s[0] ?? 0) * (s[1] ?? 0) * (s[2] ?? 0);
  if (c.shape === "cyl") return 2 * (s[0] ?? 0) * Math.PI * (s[1] ?? 0) ** 2;
  return (4 / 3) * Math.PI * (s[0] ?? 0) ** 3;
}

// ── where things stand in the Expresso estate ──────────────────────────────

/**
 * Props for the Coorg estate, placed around its landmarks and kept off the
 * roads and out of buildings.
 */
export function expressoProps(data: WorldData, ground: Ground): PropSpot[] {
  const L = data.landmarks;
  const spots: PropSpot[] = [];
  const roadPts = data.roads.map((r) => ({ half: r.width / 2 + 0.6, s: r.road.samples }));
  const clear = (x: number, z: number, r = 0.6) =>
    !data.blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r) &&
    !roadPts.some((rp) => rp.s.some((s) => Math.hypot(s.x - x, s.z - z) < rp.half + r)) &&
    ground.surface(x, z) === "ground";
  const put = (kind: PropKind, x: number, z: number, yaw = 0, lift = 0) => {
    if (lift > 0 || clear(x, z)) spots.push({ kind, x, z, yaw, lift });
  };
  /** A point near a landmark, `d` metres out at angle `a`, nudged until clear. */
  const near = (p: { x: number; z: number } | undefined, d: number, a: number) => {
    if (!p) return null;
    for (let k = 0; k < 12; k++) {
      const x = p.x + Math.cos(a + k * 0.5) * (d + k * 0.4);
      const z = p.z + Math.sin(a + k * 0.5) * (d + k * 0.4);
      if (clear(x, z, 1.4)) return { x, z };
    }
    return null;
  };
  // Coffee sacks: stacked two high by the pulping house.
  for (const a of [0.6, 3.4]) {
    const c = near(L.pulping, 5.2, a);
    if (!c) continue;
    const yaw = a + Math.PI / 2;
    const fx = Math.cos(yaw);
    const fz = -Math.sin(yaw);
    for (const [i, j] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ] as const) {
      put("sack", c.x + fx * i * 0.78 - fz * j * 0.54, c.z + fz * i * 0.78 + fx * j * 0.54, yaw);
    }
    put("sack", c.x - fz * -0.27, c.z + fx * -0.27, yaw, 0.29);
    put("sack", c.x - fz * 0.27, c.z + fx * 0.27, yaw, 0.29);
  }
  // Crates of red cherries along the drying yard, each with cherries in it.
  for (const a of [0.3, 1.6, 2.9, 4.4]) {
    const c = near(L.drying, 5, a);
    if (!c) continue;
    put("crate", c.x, c.z, a);
    for (let k = 0; k < 7; k++)
      spots.push({
        kind: "cherry",
        x: c.x + ((k % 4) - 1.5) * 0.11,
        z: c.z + (Math.floor(k / 4) - 0.5) * 0.12,
        lift: 0.06,
      });
  }
  // Milk cans waiting at the bus stop.
  const bus = near(L.bus, 2.4, 0.5);
  if (bus)
    for (let k = 0; k < 4; k++)
      put("can", bus.x + (k % 2) * 0.42, bus.z + Math.floor(k / 2) * 0.42);
  // A filter-kaapi stall by the arrival plaza: a table, chairs and tumblers.
  const s = data.spawn;
  const nx = Math.sin(s.heading);
  const nz = Math.cos(s.heading);
  for (const side of [1, -1]) {
    const tx = s.x + nx * side * 6.5 + Math.cos(s.heading) * 4;
    const tz = s.z + nz * side * 6.5 - Math.sin(s.heading) * 4;
    if (!clear(tx, tz, 1.4)) continue;
    put("table", tx, tz, s.heading);
    for (const [dx, dz] of [
      [0.8, 0],
      [-0.8, 0],
    ] as const)
      put("chair", tx + dx, tz + dz, dx > 0 ? Math.PI : 0);
    for (let k = 0; k < 4; k++)
      spots.push({
        kind: "tumbler",
        x: tx - 0.2 + (k % 2) * 0.35,
        z: tz - 0.1 + Math.floor(k / 2) * 0.2,
        lift: 0.745,
      });
    break;
  }
  // Terracotta pots along the bungalow's terrace.
  for (let k = 0; k < 6; k++) {
    const c = near(L.bungalow, 5.4, -0.9 + k * 0.32);
    if (c) put("pot", c.x, c.z, k);
  }
  // Firewood stacked by the line houses (a pyramid of logs per stack).
  for (const a of [0.8, 3.6]) {
    const c = near(L.lineHouses, 7.2, a);
    if (!c) continue;
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 4 - row; k++) {
        const off = (k - (3 - row) / 2) * 0.125;
        spots.push({
          kind: "log",
          x: c.x - Math.sin(a) * off,
          z: c.z + Math.cos(a) * off,
          yaw: a,
          lift: row * 0.106,
        });
      }
  }
  // Bamboo fence along a stretch of the estate road, past the line houses.
  const road = data.roads[0]?.road;
  const lh = L.lineHouses;
  if (road && lh) {
    let t0 = 0;
    let bd = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 400; i++) {
      const p = road.at(i / 400).p;
      const d = Math.hypot(p.x - lh.x, p.z - lh.z);
      if (d < bd) {
        bd = d;
        t0 = i / 400;
      }
    }
    const half = (data.roads[0]?.width ?? 3) / 2 + 1.5;
    for (let k = -5; k <= 5; k++) {
      const t = t0 + (k * 2) / road.length;
      const { p, normal, heading } = road.at(((t % 1) + 1) % 1);
      // On the side away from the houses.
      const side = Math.sign((lh.x - p.x) * normal.x + (lh.z - p.z) * normal.z) || 1;
      const x = p.x - normal.x * side * half;
      const z = p.z - normal.z * side * half;
      if (clear(x, z, 0.3)) spots.push({ kind: "fence", x, z, yaw: heading });
    }
  }
  return spots;
}
