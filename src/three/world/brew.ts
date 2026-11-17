/**
 * Brew moments for the Expresso world's café counters.
 *
 * When the rider pulls over at a library's counter, a tiny animated coffee
 * scene plays on the counter top, a small visual metaphor for what that C++
 * library does: a shot pulled (request in, response out), cold brew layers
 * nesting (JSON), filter kaapi poured high (utilities), a droplet sent and
 * answered (HTTP client), foam compressed (zip), evenly timed drips (logger),
 * scoops dropped in parallel (thread pool) and a letter folded from mist
 * (email). Everything is built in counter-local space (top at y = 1.22, +z
 * toward the road), eased and toy-like, and fades out gently at the end.
 */

import * as THREE from "three";

export type BrewKind =
  | "shot"
  | "layers"
  | "kaapi"
  | "exchange"
  | "foam"
  | "drip"
  | "parallel"
  | "letter";

const KIND_BY_STOP: Readonly<Record<string, BrewKind>> = {
  "expresso/expresso": "shot",
  "expresso/json": "layers",
  "expresso/brewtils": "kaapi",
  "expresso/mochios": "exchange",
  "expresso/zippuccino": "foam",
  "expresso/logger": "drip",
  "expresso/nexus": "parallel",
  "expresso/bloomail": "letter",
};

/** Which brew plays for a stop id like "expresso/json". */
export function brewKindFor(stopId: string): BrewKind {
  return KIND_BY_STOP[stopId.trim().toLowerCase()] ?? "shot";
}

/** Counter top surface, in counter-local space. */
const TOP = 1.22;
/** Seconds of the closing fade. */
const FADE = 0.5;
/** Highest point anything may reach. */
const CEIL = 2.58;

// ---------------------------------------------------------------- easing

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
/** 0..1 progress of t through [a, b]. */
const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
const smooth = (x: number): number => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};
const easeOut = (x: number): number => 1 - (1 - clamp01(x)) ** 3;
const easeIn = (x: number): number => clamp01(x) ** 2;
const easeInOut = (x: number): number => {
  const u = clamp01(x);
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
};
const easeOutBack = (x: number): number => {
  const u = clamp01(x) - 1;
  const c = 1.70158;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
/** 0 → 1 → 0 hump. */
const bump = (x: number): number => Math.sin(Math.PI * clamp01(x));
/** A soft landing wobble, 0 at impact, settling to 0 (a = seconds since impact). */
const wobble = (a: number, amp = 0.3, freq = 20, damp = 6): number =>
  a <= 0 ? 0 : amp * Math.exp(-a * damp) * Math.sin(a * freq);

type Key = readonly number[];

/** Keyframes [time, ...values], eased in-out between each pair. */
function track(t: number, keys: readonly Key[]): number[] {
  let a = keys[0];
  let b = a;
  for (const k of keys) {
    b = k;
    if ((k[0] ?? 0) >= t) break;
    a = k;
  }
  if (a === undefined || b === undefined) return [];
  const ta = a[0] ?? 0;
  const tb = b[0] ?? 0;
  const u = tb > ta ? easeInOut((t - ta) / (tb - ta)) : 0;
  const out: number[] = [];
  for (let i = 1; i < a.length; i++) out.push(lerp(a[i] ?? 0, b[i] ?? 0, u));
  return out;
}

function bez(
  out: THREE.Vector3,
  a: THREE.Vector3,
  c: THREE.Vector3,
  b: THREE.Vector3,
  s: number,
): THREE.Vector3 {
  const u = 1 - s;
  const ka = u * u;
  const kc = 2 * u * s;
  const kb = s * s;
  return out.set(
    ka * a.x + kc * c.x + kb * b.x,
    ka * a.y + kc * c.y + kb * b.y,
    ka * a.z + kc * c.z + kb * b.z,
  );
}

/** Transform a point from obj's local space up into root's space. */
function toRoot(obj: THREE.Object3D, root: THREE.Object3D, v: THREE.Vector3): THREE.Vector3 {
  let o: THREE.Object3D | null = obj;
  while (o !== null && o !== root) {
    o.updateMatrix();
    v.applyMatrix4(o.matrix);
    o = o.parent;
  }
  return v;
}

// ---------------------------------------------------------------- parts

interface MatOpts {
  rough?: number;
  metal?: number;
  /** Starting opacity. */
  alpha?: number;
  /** Always transparent, never writes depth (steam, glass). */
  soft?: boolean;
  double?: boolean;
  flat?: boolean;
  glow?: THREE.ColorRepresentation;
}

interface Mat {
  readonly m: THREE.MeshStandardMaterial;
  readonly soft: boolean;
  /** The scene's own opacity for this material, before the global fade. */
  alpha: number;
}

/** Owns every geometry and material a brew creates. */
class Parts {
  readonly geos: THREE.BufferGeometry[] = [];
  readonly mats: Mat[] = [];
  readonly sphere: THREE.SphereGeometry;
  readonly puff: THREE.SphereGeometry;
  /** Unit cylinder standing on y = 0. */
  readonly cyl: THREE.CylinderGeometry;
  /** Unit flat ring (torus lying in xz). */
  readonly ring: THREE.TorusGeometry;
  /** Unit box anchored at its left edge (x = 0). */
  readonly bar: THREE.BoxGeometry;
  /** Teardrop with its tip at +y, radius ≈ 1. */
  readonly drop: THREE.LatheGeometry;

  constructor() {
    this.sphere = this.geo(new THREE.SphereGeometry(1, 22, 16));
    this.puff = this.geo(new THREE.SphereGeometry(1, 12, 9));
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 26);
    cyl.translate(0, 0.5, 0);
    this.cyl = this.geo(cyl);
    const ring = new THREE.TorusGeometry(1, 0.09, 6, 32);
    ring.rotateX(-Math.PI / 2);
    this.ring = this.geo(ring);
    const bar = new THREE.BoxGeometry(1, 1, 1);
    bar.translate(0.5, 0, 0);
    this.bar = this.geo(bar);
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI;
      pts.push(new THREE.Vector2(Math.sin(a) * (0.58 + 0.42 * Math.cos(a)), -Math.cos(a) * 1.3));
    }
    this.drop = this.geo(new THREE.LatheGeometry(pts, 16));
  }

  geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  mat(color: THREE.ColorRepresentation, o: MatOpts = {}): Mat {
    const soft = o.soft ?? false;
    const alpha = o.alpha ?? 1;
    const see = soft || alpha < 1;
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.72,
      metalness: o.metal ?? 0,
      transparent: see,
      opacity: alpha,
      depthWrite: !see,
      side: o.double === true ? THREE.DoubleSide : THREE.FrontSide,
      flatShading: o.flat ?? false,
    });
    if (o.glow !== undefined) {
      m.emissive.set(o.glow);
      m.emissiveIntensity = 0;
    }
    const rec: Mat = { m, soft, alpha };
    this.mats.push(rec);
    return rec;
  }

  mesh(
    geo: THREE.BufferGeometry,
    mat: Mat,
    parent: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = sx,
    sz = sx,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat.m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = !mat.soft && mat.alpha >= 1;
    parent.add(mesh);
    return mesh;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const r of this.mats) r.m.dispose();
    this.geos.length = 0;
    this.mats.length = 0;
  }
}

interface VesselSpec {
  rb: number;
  rt: number;
  h: number;
  wall: number;
}

/** An open cup / glass / tumbler, lathed with a rounded lip. */
class Vessel {
  readonly mesh: THREE.Mesh;
  readonly floor: number;
  private readonly s: VesselSpec;

  constructor(
    p: Parts,
    parent: THREE.Object3D,
    mat: Mat,
    s: VesselSpec,
    x: number,
    y: number,
    z: number,
  ) {
    this.s = s;
    this.floor = s.wall;
    const { rb, rt, h, wall } = s;
    const V = THREE.Vector2;
    const pts = [
      new V(0, 0),
      new V(rb * 0.9, 0),
      new V(rb, wall * 0.7),
      new V(rt, h - wall * 0.6),
      new V(rt - wall * 0.5, h),
      new V(rt - wall, h - wall * 0.6),
      new V(rb - wall, wall * 1.4),
      new V(rb - wall * 1.3, wall),
      new V(0, wall),
    ];
    this.mesh = p.mesh(p.geo(new THREE.LatheGeometry(pts, 30)), mat, parent, x, y, z);
  }

  /** Inner radius at a liquid level above the floor. */
  inner(level: number): number {
    const { rb, rt, h, wall } = this.s;
    return lerp(rb - wall, rt - wall, clamp01(level / (h - wall)));
  }

  get rim(): number {
    return this.s.h;
  }
}

/** A liquid filling a vessel; a frustum scaled to the level. */
class Liquid {
  readonly mesh: THREE.Mesh;
  readonly mat: Mat;
  private readonly v: Vessel;
  private readonly base: number;
  private readonly topR: number;

  constructor(p: Parts, v: Vessel, color: THREE.ColorRepresentation, max: number, base = 0) {
    this.v = v;
    this.base = base;
    this.topR = v.inner(base + max) * 0.97;
    const geo = new THREE.CylinderGeometry(this.topR, v.inner(base) * 0.97, 1, 26);
    geo.translate(0, 0.5, 0);
    this.mat = p.mat(color, { rough: 0.45 });
    this.mesh = p.mesh(p.geo(geo), this.mat, v.mesh, 0, v.floor + base, 0);
    this.mesh.castShadow = false;
  }

  set(level: number): void {
    const l = Math.max(0, level);
    this.mesh.visible = l > 0.0015;
    const s = (this.v.inner(this.base + l) * 0.97) / this.topR;
    this.mesh.scale.set(s, Math.max(l, 1e-4), s);
  }

  /** Surface height in the vessel's local space. */
  surface(level: number): number {
    return this.v.floor + this.base + Math.max(0, level);
  }
}

/** A half-torus cup handle on the +x side. */
function handle(
  p: Parts,
  mat: Mat,
  parent: THREE.Object3D,
  x: number,
  y: number,
  r: number,
  tube: number,
): void {
  const g = p.geo(new THREE.TorusGeometry(r, tube, 8, 14, Math.PI));
  const m = p.mesh(g, mat, parent, x, y, 0);
  m.rotation.z = -Math.PI / 2;
}

/** A pouring stream: a chain of overlapping beads flowing along a curve. */
class Stream {
  readonly mat: Mat;
  private readonly beads: THREE.Mesh[] = [];
  private readonly r: number;
  private readonly speed: number;
  private readonly tmp = new THREE.Vector3();

  constructor(
    p: Parts,
    parent: THREE.Object3D,
    color: THREE.ColorRepresentation,
    n: number,
    r: number,
    speed: number,
  ) {
    this.r = r;
    this.speed = speed;
    this.mat = p.mat(color, { rough: 0.45 });
    for (let k = 0; k < n; k++) {
      const m = p.mesh(p.puff, this.mat, parent, 0, 0, 0, r);
      m.castShadow = false;
      m.visible = false;
      this.beads.push(m);
    }
  }

  /** head: how far the front has run (0..1); tail: how much of the back has left. */
  set(
    t: number,
    a: THREE.Vector3,
    c: THREE.Vector3,
    b: THREE.Vector3,
    head: number,
    tail: number,
  ): void {
    const n = this.beads.length;
    for (let k = 0; k < n; k++) {
      const bead = this.beads[k];
      if (bead === undefined) continue;
      const s = (k / n + t * this.speed) % 1;
      const wHead = smooth((head - s) / 0.12);
      const wTail = tail <= 0 ? 1 : smooth((s - tail) / 0.12);
      const w = head <= 0 ? 0 : wHead * wTail;
      bead.visible = w > 0.02;
      if (!bead.visible) continue;
      bez(this.tmp, a, c, b, s);
      bead.position.copy(this.tmp);
      bead.scale.setScalar(this.r * w * (1 - 0.3 * s));
    }
  }
}

/** A ripple ring expanding over a liquid surface. */
class Ripple {
  private readonly mesh: THREE.Mesh;
  private readonly mat: Mat;

  constructor(p: Parts, parent: THREE.Object3D, color: THREE.ColorRepresentation = "#f6e7cf") {
    this.mat = p.mat(color, { soft: true, alpha: 0, rough: 0.6 });
    this.mesh = p.mesh(p.ring, this.mat, parent);
    this.mesh.visible = false;
  }

  step(t: number, t0: number, life: number, maxR: number, at: THREE.Vector3): void {
    const u = (t - t0) / life;
    this.mesh.visible = u >= 0 && u <= 1;
    if (!this.mesh.visible) return;
    this.mesh.position.copy(at);
    this.mesh.scale.setScalar(maxR * (0.15 + 0.85 * easeOut(u)));
    this.mat.alpha = 0.75 * smooth(u / 0.1) * (1 - smooth(u));
  }
}

interface SteamOpts {
  start: number;
  end: number;
  every?: number;
  life?: number;
  size?: number;
  rise?: number;
  alpha?: number;
}

interface Puff {
  mesh: THREE.Mesh;
  mat: Mat;
  born: number;
  seed: number;
}

/** Soft translucent puffs that rise, grow and fade. */
class Steam {
  readonly src: THREE.Vector3;
  private readonly puffs: Puff[] = [];
  private readonly life: number;
  private readonly size: number;
  private readonly rise: number;
  private readonly alpha: number;

  constructor(p: Parts, parent: THREE.Object3D, src: THREE.Vector3, o: SteamOpts) {
    this.src = src.clone();
    this.life = o.life ?? 1.5;
    this.size = o.size ?? 0.042;
    this.rise = o.rise ?? 0.3;
    this.alpha = o.alpha ?? 0.38;
    const every = o.every ?? 0.22;
    let k = 0;
    for (let born = o.start; born <= o.end; born += every) {
      const mat = p.mat("#fffaf2", { soft: true, alpha: 0, rough: 0.9 });
      const mesh = p.mesh(p.puff, mat, parent);
      mesh.visible = false;
      this.puffs.push({ mesh, mat, born, seed: k * 2.39 });
      k++;
    }
  }

  step(t: number): void {
    for (const f of this.puffs) {
      const age = t - f.born;
      const u = age / this.life;
      f.mesh.visible = u > 0 && u < 1;
      if (!f.mesh.visible) {
        f.mat.alpha = 0;
        continue;
      }
      const size = this.size * (0.35 + 0.95 * easeOut(u));
      const sway = Math.sin(f.seed + age * 2.4) * 0.03 * u;
      const y = Math.min(this.src.y + this.rise * easeOut(u), CEIL - size);
      f.mesh.position.set(
        this.src.x + sway,
        y,
        this.src.z + Math.cos(f.seed * 1.3 + age * 1.9) * 0.02 * u,
      );
      f.mesh.scale.setScalar(size);
      f.mat.alpha = this.alpha * smooth(u / 0.2) * (1 - smooth((u - 0.35) / 0.65));
    }
  }
}

const UP = new THREE.Vector3(0, 1, 0);

/** A drop launched from one point, arcing to another, sinking in at the end. */
function flyDrop(
  mesh: THREE.Mesh,
  t: number,
  launch: number,
  fly: number,
  land: number,
  from: THREE.Vector3,
  to: THREE.Vector3,
  apex: number,
  size: number,
  tmp: THREE.Vector3,
  dir: THREE.Vector3,
): void {
  const sink = 0.16;
  mesh.visible = t >= launch && t <= land + sink;
  if (!mesh.visible) return;
  let scale = size;
  if (t < fly) {
    const u = seg(t, launch, fly);
    mesh.position.set(from.x, from.y + 0.03 * easeOut(u), from.z);
    scale = size * easeOutBack(u);
    dir.set(0, 1, 0);
  } else if (t <= land) {
    const s = seg(t, fly, land);
    const arc = (q: number, out: THREE.Vector3): THREE.Vector3 =>
      out.set(
        lerp(from.x, to.x, q),
        lerp(from.y + 0.03, to.y, q) + apex * 4 * q * (1 - q),
        lerp(from.z, to.z, q),
      );
    arc(s, tmp);
    mesh.position.copy(tmp);
    arc(Math.min(1, s + 0.02), dir);
    if (s >= 0.98)
      arc(s - 0.02, dir)
        .sub(tmp)
        .negate();
    else dir.sub(tmp);
    scale = size * (1 + 0.15 * bump(s));
  } else {
    const v = seg(t, land, land + sink);
    mesh.position.set(to.x, to.y - 0.02 * v, to.z);
    scale = size * (1 - smooth(v));
    dir.set(0, -1, 0);
  }
  if (dir.lengthSq() > 1e-10) {
    dir.normalize().negate();
    mesh.quaternion.setFromUnitVectors(UP, dir);
  }
  mesh.scale.setScalar(Math.max(scale, 1e-4));
}

// ---------------------------------------------------------------- scenes

interface Scene {
  duration: number;
  /** Point the closing shrink scales around. */
  pivot: THREE.Vector3;
  step(t: number): void;
}

type Build = (p: Parts, g: THREE.Group) => Scene;

const steelOpts: MatOpts = { rough: 0.38, metal: 0.8, double: true };
const ceramic = (p: Parts, color: THREE.ColorRepresentation): Mat =>
  p.mat(color, { rough: 0.62, double: true });
const glass = (p: Parts): Mat =>
  p.mat("#eaf4f8", { rough: 0.18, alpha: 0.26, soft: true, double: true });

/** Espresso: portafilter locks in, a thin stream fills a cup, crema forms, cup slides out. */
const shot: Build = (p, g) => {
  const D = 4.3;
  const MX = 0.92;
  const MZ = 0.0;
  const HZ = 0.34;
  const steel = p.mat("#b9c0c7", steelOpts);
  const dark = p.mat("#3d4148", { rough: 0.6, metal: 0.4 });
  const body = p.mat("#c4553b", { rough: 0.6 });
  const lamp = p.mat("#ffe0a0", { rough: 0.5, glow: "#ffb347" });
  const wood = p.mat("#3a2418", { rough: 0.7 });

  p.mesh(p.cyl, dark, g, MX, TOP, MZ, 0.16, 0.025, 0.16);
  p.mesh(p.cyl, body, g, MX, TOP + 0.025, MZ, 0.12, 0.42, 0.12);
  p.mesh(p.sphere, body, g, MX, TOP + 0.445, MZ, 0.12, 0.06, 0.12);
  p.mesh(p.sphere, steel, g, MX, TOP + 0.51, MZ, 0.026);
  const arm = p.mesh(p.cyl, steel, g, MX, 1.605, MZ, 0.04, HZ - MZ, 0.04);
  arm.rotation.x = Math.PI / 2;
  p.mesh(p.cyl, steel, g, MX, 1.56, HZ, 0.066, 0.06, 0.066);
  const lampM = p.mesh(p.sphere, lamp, g, MX, 1.47, MZ + 0.118, 0.02);
  lampM.castShadow = false;
  p.mesh(p.cyl, dark, g, MX, TOP, HZ, 0.1, 0.012, 0.1);

  const pf = new THREE.Group();
  g.add(pf);
  p.mesh(p.cyl, steel, pf, 0, -0.036, 0, 0.056, 0.036, 0.056);
  p.mesh(p.cyl, steel, pf, 0, -0.054, 0, 0.014, 0.02, 0.014);
  const grip = p.mesh(
    p.geo(new THREE.CapsuleGeometry(0.015, 0.12, 4, 12)),
    wood,
    pf,
    0,
    -0.03,
    0.13,
  );
  grip.rotation.x = Math.PI / 2 - 0.18;

  const cupG = new THREE.Group();
  g.add(cupG);
  const cream = ceramic(p, "#fbf6ee");
  p.mesh(p.cyl, cream, cupG, 0, 0, 0, 0.082, 0.01, 0.082);
  const cup = new Vessel(
    p,
    cupG,
    cream,
    { rb: 0.042, rt: 0.058, h: 0.072, wall: 0.007 },
    0,
    0.01,
    0,
  );
  handle(p, cream, cup.mesh, 0.058, 0.04, 0.017, 0.0055);
  const coffee = new Liquid(p, cup, "#2a160c", 0.056);
  const crema = new THREE.Color("#a8693a");
  const espresso = new THREE.Color("#2a160c");
  const fleckMat = p.mat("#d9a86e", { rough: 0.6 });
  const flecks: THREE.Mesh[] = [];
  for (let k = 0; k < 5; k++) {
    const m = p.mesh(p.puff, fleckMat, cup.mesh);
    m.castShadow = false;
    m.visible = false;
    flecks.push(m);
  }

  const stream = new Stream(p, g, "#3a1d0e", 22, 0.0085, 1.7);
  const steam = new Steam(p, g, new THREE.Vector3(MX, TOP + 0.1, 0.64), {
    start: 3.3,
    end: D - 0.7,
    every: 0.2,
    size: 0.034,
    rise: 0.28,
  });
  const a = new THREE.Vector3(MX, 1.505, HZ);
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  return {
    duration: D,
    pivot: new THREE.Vector3(MX, TOP, 0.3),
    step(t) {
      const lock = seg(t, 0.15, 0.85);
      pf.position.set(MX, 1.56 - 0.07 * (1 - smooth(lock)), HZ);
      pf.rotation.y = -0.9 * (1 - easeOutBack(lock));
      lamp.m.emissiveIntensity = 1.5 * smooth(seg(t, 0.8, 1.0)) * (1 - smooth(seg(t, 2.7, 3.0)));

      const level = 0.052 * easeInOut(seg(t, 1.05, 2.75));
      coffee.set(level);
      coffee.mat.m.color.copy(espresso).lerp(crema, 0.85 * smooth(seg(t, 1.5, 2.8)));
      const surf = coffee.surface(level);
      for (let k = 0; k < flecks.length; k++) {
        const f = flecks[k];
        if (f === undefined) continue;
        const u = easeOutBack(seg(t, 1.9 + k * 0.12, 2.3 + k * 0.12));
        f.visible = u > 0.01;
        const ang = k * 1.9 + t * 0.4;
        const r = cup.inner(level) * (0.25 + 0.12 * (k % 3));
        f.position.set(Math.cos(ang) * r, surf + 0.001, Math.sin(ang) * r);
        f.scale.set(0.007 * u, 0.0015 * u, 0.007 * u);
      }

      const slide = easeInOut(seg(t, 2.95, 3.5));
      cupG.position.set(MX, lerp(1.232, 1.221, slide) + 0.035 * bump(slide), lerp(HZ, 0.64, slide));
      b.set(MX, cupG.position.y + 0.01 + surf, cupG.position.z);
      c.copy(a).lerp(b, 0.5);
      if (t < 2.95) stream.set(t, a, c, b, easeOut(seg(t, 0.95, 1.2)), smooth(seg(t, 2.55, 2.85)));
      else stream.set(t, a, c, b, 0, 1);
      steam.step(t);
    },
  };
};

/** Rounded puck lathe: a soft-edged layer. */
function puckGeo(p: Parts, r: number, h: number, corner: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - corner + Math.cos(a) * corner, corner + Math.sin(a) * corner));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(r - corner + Math.cos(a) * corner, h - corner + Math.sin(a) * corner),
    );
  }
  pts.push(new THREE.Vector2(0, h));
  return p.geo(new THREE.LatheGeometry(pts, 28));
}

/** Cold brew: distinct layers drop into a glass one by one and settle. */
const layers: Build = (p, g) => {
  const D = 4.2;
  const X = 0.84;
  const Z = 0.45;
  const H = 0.068;
  const glassV = new Vessel(
    p,
    g,
    glass(p),
    { rb: 0.115, rt: 0.118, h: 0.4, wall: 0.008 },
    X,
    TOP,
    Z,
  );
  const geo = puckGeo(p, 0.1, H, 0.022);
  const colors = ["#2b170d", "#5e341c", "#9a6236", "#d2a774", "#f3e7d3"];
  const pucks = colors.map((col) => {
    const m = p.mesh(geo, p.mat(col, { rough: 0.55 }), g, X, 2.3, Z);
    m.visible = false;
    return m;
  });
  const strawMat = p.mat("#2f7d63", { rough: 0.6 });
  const straw = p.mesh(p.cyl, strawMat, g, 0, 0, 0, 0.011, 0.5, 0.011);
  straw.rotation.z = -0.2;
  straw.visible = false;
  const bean = p.mesh(p.sphere, p.mat("#4a2a16", { rough: 0.55 }), g, X, 0, Z, 0.022);
  bean.visible = false;
  const floor = TOP + glassV.floor;

  return {
    duration: D,
    pivot: new THREE.Vector3(X, TOP, Z),
    step(t) {
      pucks.forEach((m, k) => {
        const t0 = 0.35 + k * 0.5;
        const appear = seg(t, t0 - 0.25, t0);
        const fall = seg(t, t0, t0 + 0.42);
        m.visible = appear > 0;
        const rest = floor + k * (H - 0.004);
        m.position.y = lerp(2.3, rest, easeIn(fall));
        const st = 0.22 * bump(fall);
        const sq = wobble(t - (t0 + 0.42), 0.32, 18, 6);
        const grow = easeOutBack(appear);
        const sy = (1 + st - sq) * grow;
        const sxz = (1 - 0.12 * st + 0.2 * sq) * grow;
        m.scale.set(sxz, Math.max(sy, 1e-4), sxz);
      });
      const top = floor + colors.length * (H - 0.004);
      const s = seg(t, 2.85, 3.4);
      straw.visible = s > 0;
      straw.position.set(X + 0.03, lerp(2.0, TOP + 0.03, easeOut(s)), Z - 0.02);
      const bs = seg(t, 3.0, 3.45);
      bean.visible = bs > 0;
      bean.position.y = top + 0.012;
      bean.scale.set(0.022 * easeOutBack(bs), 0.013 * easeOutBack(bs), 0.016 * easeOutBack(bs));
    },
  };
};

/** Filter kaapi: poured high from tumbler to dabara and back, then served nested. */
const kaapi: Build = (p, g) => {
  const D = 4.5;
  const steel = p.mat("#c3c9cf", steelOpts);
  const dab = new Vessel(p, g, steel, { rb: 0.09, rt: 0.15, h: 0.065, wall: 0.007 }, 0.7, TOP, 0.5);
  const tum = new Vessel(
    p,
    g,
    steel,
    { rb: 0.052, rt: 0.068, h: 0.17, wall: 0.006 },
    1.02,
    TOP,
    0.42,
  );
  p.mesh(p.ring, steel, tum.mesh, 0, tum.rim, 0, 0.066);
  p.mesh(p.ring, steel, dab.mesh, 0, dab.rim, 0, 0.148);
  const tumLiq = new Liquid(p, tum, "#a8714a", 0.15);
  const dabLiq = new Liquid(p, dab, "#c08a5c", 0.045);
  const froth = p.mesh(p.sphere, p.mat("#ead2b0", { rough: 0.85 }), tum.mesh, 0, 0, 0);
  froth.visible = false;
  const pour1 = new Stream(p, g, "#b27b50", 26, 0.014, 1.3);
  const pour2 = new Stream(p, g, "#b98457", 26, 0.014, 1.3);
  const steam = new Steam(p, g, new THREE.Vector3(0.7, TOP + 0.24, 0.5), {
    start: 3.65,
    end: D - 0.75,
    every: 0.2,
  });
  const lipT = new THREE.Vector3();
  const lipD = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const ctl = new THREE.Vector3();
  const tKeys: Key[] = [
    [0, 1.02, TOP, 0.42, 0],
    [0.25, 1.02, TOP, 0.42, 0],
    [0.8, 0.98, 1.98, 0.48, 1.15],
    [1.85, 0.98, 1.98, 0.48, 1.15],
    [2.3, 1.02, TOP, 0.42, 0],
    [3.05, 1.02, TOP, 0.42, 0],
    [3.3, 0.86, 1.42, 0.47, 0],
    [3.6, 0.7, TOP + 0.007, 0.5, 0],
  ];
  const dKeys: Key[] = [
    [0, 0.7, TOP, 0.5, 0],
    [1.95, 0.7, TOP, 0.5, 0],
    [2.35, 0.72, 1.82, 0.48, -1.05],
    [2.95, 0.72, 1.82, 0.48, -1.05],
    [3.25, 0.7, TOP, 0.5, 0],
  ];

  return {
    duration: D,
    pivot: new THREE.Vector3(0.84, TOP, 0.46),
    step(t) {
      const [tx = 0, ty = 0, tz = 0, tr = 0] = track(t, tKeys);
      const high = 0.12 * bump(seg(t, 0.85, 1.85));
      tum.mesh.position.set(tx, ty + high, tz);
      tum.mesh.rotation.z = tr;
      const [dx = 0, dy = 0, dz = 0, dr = 0] = track(t, dKeys);
      dab.mesh.position.set(dx, dy, dz);
      dab.mesh.rotation.z = dr;

      const p1 = easeInOut(seg(t, 0.9, 1.85));
      const p2 = easeInOut(seg(t, 2.4, 2.95));
      const tl = lerp(lerp(0.13, 0.03, p1), 0.13, p2);
      tumLiq.set(tl);
      dabLiq.set(0.042 * p1 * (1 - p2));

      toRoot(tum.mesh, g, lipT.set(-0.068, tum.rim, 0));
      toRoot(dab.mesh, g, tgt.set(-0.02, dabLiq.surface(0.042 * p1), 0));
      ctl.set(lipT.x - 0.07, lipT.y + 0.015, lerp(lipT.z, tgt.z, 0.3));
      pour1.set(t, lipT, ctl, tgt, easeOut(seg(t, 0.82, 1.02)), smooth(seg(t, 1.7, 1.92)));

      toRoot(dab.mesh, g, lipD.set(0.15, dab.rim, 0));
      toRoot(tum.mesh, g, tgt.set(0, tumLiq.surface(tl), 0));
      ctl.set(lipD.x + 0.09, lipD.y + 0.015, lerp(lipD.z, tgt.z, 0.3));
      pour2.set(t, lipD, ctl, tgt, easeOut(seg(t, 2.35, 2.55)), smooth(seg(t, 2.8, 3.0)));

      const f = easeOutBack(seg(t, 3.55, 3.95));
      froth.visible = f > 0.01;
      froth.position.y = tumLiq.surface(tl);
      const fr = tum.inner(tl) * 0.98;
      froth.scale.set(fr * Math.max(f, 0.01), 0.04 * f + 1e-4, fr * Math.max(f, 0.01));
      steam.step(t);
    },
  };
};

/** HTTP client: a milk droplet arcs to the server cup, a coffee droplet arcs back. */
const exchange: Build = (p, g) => {
  const D = 4.0;
  const cream = ceramic(p, "#f8f1e6");
  const clay = ceramic(p, "#b4503a");
  p.mesh(p.cyl, cream, g, 0.62, TOP, 0.66, 0.11, 0.01, 0.11);
  const cA = new Vessel(
    p,
    g,
    cream,
    { rb: 0.055, rt: 0.075, h: 0.095, wall: 0.007 },
    0.62,
    TOP + 0.01,
    0.66,
  );
  handle(p, cream, cA.mesh, 0.075, 0.05, 0.022, 0.007);
  p.mesh(p.cyl, p.mat("#6b4a32", { rough: 0.8 }), g, 1.04, TOP, 0.28, 0.09, 0.012, 0.09);
  const cB = new Vessel(
    p,
    g,
    clay,
    { rb: 0.065, rt: 0.068, h: 0.12, wall: 0.008 },
    1.04,
    TOP + 0.012,
    0.28,
  );
  handle(p, clay, cB.mesh, 0.068, 0.06, 0.026, 0.008);
  const milkA = new Liquid(p, cA, "#f1e7d6", 0.075);
  const coffeeB = new Liquid(p, cB, "#3a1f10", 0.09);
  coffeeB.set(0.09);
  const milk = new THREE.Color("#f1e7d6");
  const latte = new THREE.Color("#b98a5e");
  const req = p.mesh(p.drop, p.mat("#f4ece0", { rough: 0.45 }), g);
  const res = p.mesh(p.drop, p.mat("#3a1f10", { rough: 0.45 }), g);
  req.visible = false;
  res.visible = false;
  const rippleB = new Ripple(p, g, "#c99a6a");
  const rippleA = new Ripple(p, g, "#fff6e8");
  const steamB = new Steam(p, g, new THREE.Vector3(1.04, TOP + 0.15, 0.28), {
    start: 1.35,
    end: 2.1,
    every: 0.14,
    size: 0.03,
  });
  const steamA = new Steam(p, g, new THREE.Vector3(0.62, TOP + 0.12, 0.66), {
    start: 3.1,
    end: D - 0.7,
    every: 0.2,
    size: 0.03,
  });
  const aPos = new THREE.Vector3();
  const bPos = new THREE.Vector3(1.04, TOP + 0.012 + coffeeB.surface(0.09), 0.28);
  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();

  return {
    duration: D,
    pivot: new THREE.Vector3(0.83, TOP, 0.47),
    step(t) {
      const lv = lerp(0.03, 0.062, easeInOut(seg(t, 2.95, 3.35)));
      milkA.set(lv);
      milkA.mat.m.color.copy(milk).lerp(latte, smooth(seg(t, 2.95, 3.4)));
      aPos.set(0.62, TOP + 0.01 + milkA.surface(lv), 0.66);

      const sqA = wobble(t - 0.35, 0.12, 16, 7) + wobble(t - 2.95, 0.16, 16, 6);
      cA.mesh.scale.set(1 + sqA * 0.5, 1 - sqA, 1 + sqA * 0.5);
      const sqB = wobble(t - 1.35, 0.16, 16, 6) + wobble(t - 1.95, 0.1, 16, 7);
      cB.mesh.scale.set(1 + sqB * 0.5, 1 - sqB, 1 + sqB * 0.5);
      cB.mesh.rotation.z = 0.06 * Math.sin((t - 1.4) * 14) * bump(seg(t, 1.45, 1.95));

      flyDrop(req, t, 0.35, 0.6, 1.35, aPos, bPos, 0.42, 0.03, tmp, dir);
      flyDrop(res, t, 1.95, 2.2, 2.95, bPos, aPos, 0.42, 0.034, tmp, dir);
      rippleB.step(t, 1.35, 0.6, 0.055, bPos);
      rippleA.step(t, 2.95, 0.6, 0.06, aPos);
      steamB.step(t);
      steamA.step(t);
    },
  };
};

/** Cappuccino: a tall foam tower rises, then is pressed down into a neat dense cap. */
const foam: Build = (p, g) => {
  const D = 4.4;
  const X = 0.82;
  const Z = 0.48;
  const cream = ceramic(p, "#f6efe4");
  p.mesh(p.cyl, cream, g, X, TOP, Z, 0.15, 0.012, 0.15);
  const cup = new Vessel(
    p,
    g,
    cream,
    { rb: 0.065, rt: 0.118, h: 0.115, wall: 0.008 },
    X,
    TOP + 0.012,
    Z,
  );
  handle(p, cream, cup.mesh, 0.1, 0.06, 0.026, 0.008);
  new Liquid(p, cup, "#5a3218", 0.092).set(0.092);
  const rim = TOP + 0.012 + cup.rim;

  const airy = new THREE.Color("#fffdf8");
  const dense = new THREE.Color("#f1e2c8");
  const puffMat = p.mat("#fffdf8", { rough: 0.88 });
  const N = 7;
  const puffs: THREE.Mesh[] = [];
  for (let k = 0; k < N; k++) {
    const m = p.mesh(p.sphere, puffMat, g, X, rim, Z);
    m.visible = false;
    puffs.push(m);
  }
  const rOf = (k: number): number => 0.095 - k * 0.008;
  const yOf = (k: number): number => rim + 0.02 + k * 0.058;
  const colTop = yOf(N - 1) + rOf(N - 1);
  const capH = 0.05;
  const cap = p.mesh(p.sphere, p.mat("#f1e2c8", { rough: 0.85 }), g, X, rim - 0.01, Z);
  cap.visible = false;
  const capTop = rim - 0.01 + capH;

  const tamper = new THREE.Group();
  g.add(tamper);
  const tSteel = p.mat("#b9c0c7", { rough: 0.38, metal: 0.8 });
  const tWood = p.mat("#6b4329", { rough: 0.7 });
  p.mesh(p.cyl, tSteel, tamper, 0, 0, 0, 0.118, 0.024, 0.118);
  p.mesh(p.cyl, tWood, tamper, 0, 0.024, 0, 0.028, 0.08, 0.028);
  p.mesh(p.sphere, tWood, tamper, 0, 0.12, 0, 0.042);
  tamper.visible = false;
  const cocoa = p.mesh(p.sphere, p.mat("#6b3a1f", { rough: 0.8 }), g, X, capTop - 0.002, Z);
  cocoa.visible = false;
  const steam = new Steam(p, g, new THREE.Vector3(X, capTop + 0.02, Z), {
    start: 3.2,
    end: D - 0.7,
    every: 0.2,
  });

  return {
    duration: D,
    pivot: new THREE.Vector3(X, TOP, Z),
    step(t) {
      const c = easeInOut(seg(t, 2.05, 2.85));
      puffMat.m.color.copy(airy).lerp(dense, c);
      puffs.forEach((m, k) => {
        const t0 = 0.35 + k * 0.17;
        const u = seg(t, t0, t0 + 0.4);
        const gone = 1 - smooth(seg(c, 0.45, 1));
        m.visible = u > 0 && gone > 0.001;
        const from = k === 0 ? rim - 0.02 : yOf(k - 1);
        const y = lerp(lerp(from, yOf(k), easeOut(u)), rim + 0.01, c);
        const sway = Math.sin(t * 3 + k * 1.3) * 0.007 * (1 - c) * (k / N);
        m.position.set(X + sway, y, Z + Math.cos(t * 2.4 + k) * 0.004 * (1 - c));
        const r = rOf(k) * easeOutBack(u) * gone * lerp(1, 0.7, c);
        m.scale.set(r, r * (1 - 0.45 * c), r);
      });
      const cg = smooth(seg(c, 0.25, 1));
      cap.visible = cg > 0.001;
      cap.scale.set(0.112 * Math.max(cg, 0.2), capH * cg + 1e-4, 0.112 * Math.max(cg, 0.2));

      const arrive = easeOut(seg(t, 1.65, 2.05));
      const lift = easeInOut(seg(t, 2.95, 3.35));
      const bottom = lerp(colTop, capTop, c) + 0.25 * (1 - arrive) + 0.25 * lift;
      tamper.visible = t > 1.6 && t < 3.4;
      tamper.position.set(X, bottom, Z);
      const ta = smooth(seg(t, 1.6, 1.9)) * (1 - smooth(seg(t, 3.0, 3.35)));
      tSteel.alpha = ta;
      tWood.alpha = ta;

      const cc = easeOutBack(seg(t, 3.1, 3.45));
      cocoa.visible = cc > 0.01;
      cocoa.scale.set(0.032 * cc, 0.004 * cc + 1e-4, 0.032 * cc);
      steam.step(t);
    },
  };
};

/** Pour-over: evenly timed drips, a ripple each, and a log slip gaining a line per drip. */
const drip: Build = (p, g) => {
  const D = 4.3;
  const X = 0.82;
  const Z = 0.45;
  const carafe = new Vessel(
    p,
    g,
    glass(p),
    { rb: 0.095, rt: 0.092, h: 0.17, wall: 0.007 },
    X,
    TOP,
    Z,
  );
  const coffee = new Liquid(p, carafe, "#3a2214", 0.08);
  const wood = p.mat("#8a5a3a", { rough: 0.75 });
  p.mesh(p.ring, wood, carafe.mesh, 0, carafe.rim - 0.008, 0, 0.096);
  const clay = p.mat("#d8cfc2", { rough: 0.62, double: true });
  const V = THREE.Vector2;
  const cone = new THREE.LatheGeometry(
    [
      new V(0.006, 0.012),
      new V(0.012, 0),
      new V(0.022, 0),
      new V(0.112, 0.128),
      new V(0.108, 0.136),
      new V(0.1, 0.132),
      new V(0.016, 0.014),
      new V(0.006, 0.012),
    ],
    30,
  );
  const tipY = 1.37;
  p.mesh(p.geo(cone), clay, g, X, tipY, Z);
  p.mesh(p.cyl, clay, g, X, TOP + carafe.rim - 0.002, Z, 0.105, 0.01, 0.105);
  const bed = p.mesh(p.sphere, p.mat("#2e1a0e", { rough: 0.85 }), g, X, tipY + 0.1, Z);

  const slip = new THREE.Group();
  slip.position.set(1.08, TOP, 0.66);
  slip.rotation.set(-0.22, -0.35, 0);
  g.add(slip);
  p.mesh(p.bar, p.mat("#fbf4e4", { rough: 0.8 }), slip, -0.06, 0.09, 0, 0.12, 0.17, 0.005);
  const inkMat = p.mat("#3a2418", { rough: 0.7 });

  const N = 8;
  const every = 0.38;
  const g0 = 5;
  const per = 0.007;
  const drops: THREE.Mesh[] = [];
  const ripples: Ripple[] = [];
  const lines: THREE.Mesh[] = [];
  const lands: number[] = [];
  const surfs: number[] = [];
  for (let k = 0; k < N; k++) {
    const m = p.mesh(p.drop, coffee.mat, g, X, tipY, Z);
    m.castShadow = false;
    m.visible = false;
    drops.push(m);
    ripples.push(new Ripple(p, g, "#c99a6a"));
    const surf = TOP + coffee.surface(0.012 + k * per);
    surfs.push(surf);
    lands.push(0.55 + k * every + Math.sqrt((2 * (tipY - 0.006 - surf)) / g0));
    const line = p.mesh(p.bar, inkMat, slip, -0.045, 0.155 - k * 0.017, 0.004, 0.001, 0.005, 0.002);
    line.castShadow = false;
    line.visible = false;
    lines.push(line);
  }
  const widths = [0.07, 0.09, 0.06, 0.085, 0.05, 0.08, 0.065, 0.09];
  const steam = new Steam(p, g, new THREE.Vector3(X, tipY + 0.14, Z), {
    start: 0.3,
    end: D - 0.9,
    every: 0.3,
    size: 0.03,
    alpha: 0.28,
  });
  const at = new THREE.Vector3();

  return {
    duration: D,
    pivot: new THREE.Vector3(0.9, TOP, 0.5),
    step(t) {
      let level = 0.012;
      for (let k = 0; k < N; k++) {
        const land = lands[k] ?? 0;
        level += per * smooth(seg(t, land, land + 0.3));
      }
      coffee.set(level);
      bed.scale.set(0.082, 0.018 + 0.004 * Math.sin(t * 3.2), 0.082);
      for (let k = 0; k < N; k++) {
        const m = drops[k];
        const land = lands[k] ?? 0;
        const surf = surfs[k] ?? TOP;
        const tk = 0.55 + k * every;
        if (m === undefined) continue;
        m.quaternion.identity();
        if (t < tk - 0.3 || t > land + 0.1) m.visible = false;
        else if (t < tk) {
          const u = smooth(seg(t, tk - 0.3, tk));
          m.visible = true;
          m.position.set(X, tipY - 0.004 - 0.008 * u, Z);
          m.scale.set(0.009 * u, 0.009 * u * (1 + 0.3 * u), 0.009 * u);
        } else if (t <= land) {
          const a = t - tk;
          m.visible = true;
          m.position.set(X, Math.max(surf, tipY - 0.012 - 0.5 * g0 * a * a), Z);
          m.scale.set(0.008, 0.012, 0.008);
        } else {
          const v = smooth(seg(t, land, land + 0.1));
          m.visible = true;
          m.position.set(X, surf - 0.004 * v, Z);
          m.scale.setScalar(0.009 * (1 - v) + 1e-4);
        }
        ripples[k]?.step(t, land, 0.65, 0.07, at.set(X, surf + 0.002, Z));
        const line = lines[k];
        if (line !== undefined) {
          const w = easeOut(seg(t, land, land + 0.3));
          line.visible = w > 0.001;
          line.scale.x = (widths[k] ?? 0.07) * Math.max(w, 0.01);
        }
      }
      steam.step(t);
    },
  };
};

/** Affogato bar: four scoops queue up, then drop into four cups nearly at once. */
const parallel: Build = (p, g) => {
  const D = 4.0;
  const spots: [number, number][] = [
    [0.66, 0.64],
    [0.98, 0.64],
    [0.66, 0.3],
    [0.98, 0.3],
  ];
  const glassMat = glass(p);
  const scoopMat = p.mat("#f6e9cf", { rough: 0.85 });
  const leafMat = p.mat("#4e9a4a", { rough: 0.7 });
  const dark = new THREE.Color("#2a160c");
  const melted = new THREE.Color("#7a4a2a");
  const lanes = spots.map(([x, z], k) => {
    const v = new Vessel(p, g, glassMat, { rb: 0.055, rt: 0.07, h: 0.085, wall: 0.006 }, x, TOP, z);
    const liq = new Liquid(p, v, "#2a160c", 0.05);
    const scoop = p.mesh(p.sphere, scoopMat, g, x, 2.05, z, 0.05);
    scoop.visible = false;
    p.mesh(p.ring, scoopMat, scoop, 0, -0.1, 0, 1.0);
    const leaf = p.mesh(p.sphere, leafMat, scoop, 0.25, 0.92, 0.1);
    leaf.rotation.set(0.3, k * 1.3, 0.4);
    leaf.visible = false;
    const surf = TOP + liq.surface(0.035);
    return {
      x,
      z,
      liq,
      scoop,
      leaf,
      ripple: new Ripple(p, g, "#c99a6a"),
      drop: 1.0 + k * 0.12,
      steam: new Steam(p, g, new THREE.Vector3(x, TOP + 0.15, z), {
        start: 1.9 + k * 0.12,
        end: D - 0.8,
        every: 0.35,
        size: 0.022,
        rise: 0.22,
        alpha: 0.3,
      }),
      surf,
    };
  });
  const at = new THREE.Vector3();

  return {
    duration: D,
    pivot: new THREE.Vector3(0.82, TOP, 0.47),
    step(t) {
      lanes.forEach((L, k) => {
        const land = L.drop + 0.5;
        const appear = seg(t, 0.15 + k * 0.07, 0.55 + k * 0.07);
        const fall = seg(t, L.drop, land);
        const melt = smooth(seg(t, land + 0.5, land + 2.0));
        const rest = L.surf + 0.032 - 0.012 * melt;
        const hover = 2.05 + 0.015 * Math.sin(t * 4 + k * 1.7) * (1 - fall);
        L.scoop.visible = appear > 0;
        L.scoop.position.set(L.x, lerp(hover, rest, easeIn(fall)), L.z);
        const st = 0.18 * bump(fall);
        const sq = wobble(t - land, 0.3, 18, 6);
        const grow = easeOutBack(appear);
        const r = 0.05 * grow;
        L.scoop.scale.set(
          r * (1 - 0.1 * st + 0.25 * sq + 0.06 * melt),
          Math.max(r * (1 + st - sq - 0.18 * melt), 1e-4),
          r * (1 - 0.1 * st + 0.25 * sq + 0.06 * melt),
        );
        const lf = easeOutBack(seg(t, land + 0.3, land + 0.6));
        L.leaf.visible = lf > 0.01;
        L.leaf.scale.set(0.38 * lf, 0.08 * lf + 1e-4, 0.2 * lf);
        L.liq.set(0.035 + 0.008 * smooth(seg(t, land, land + 0.3)));
        L.liq.mat.m.color.copy(dark).lerp(melted, 0.6 * melt);
        L.ripple.step(t, land, 0.55, 0.05, at.set(L.x, L.surf + 0.004, L.z));
        L.steam.step(t);
      });
    },
  };
};

/** Iced latte: cold mist spirals up, folds into an envelope, which flutters away. */
const letter: Build = (p, g) => {
  const D = 4.3;
  const X = 0.84;
  const Z = 0.45;
  const gl = new Vessel(p, g, glass(p), { rb: 0.085, rt: 0.1, h: 0.3, wall: 0.007 }, X, TOP, Z);
  new Liquid(p, gl, "#efe6d6", 0.16).set(0.16);
  new Liquid(p, gl, "#8a5634", 0.07, 0.16).set(0.07);
  const iceGeo = p.geo(new THREE.IcosahedronGeometry(1, 0));
  const ice = p.mat("#eef8fc", { rough: 0.2, alpha: 0.55, soft: true, flat: true });
  const cubes = [0, 1, 2].map((k) => {
    const m = p.mesh(iceGeo, ice, g, 0, 0, 0, 0.03);
    m.rotation.set(k, k * 2, k * 0.5);
    return m;
  });
  const straw = p.mesh(p.cyl, p.mat("#2f7d63", { rough: 0.6 }), g, X + 0.03, TOP + 0.03, Z - 0.02);
  straw.scale.set(0.009, 0.31, 0.009);
  straw.rotation.z = -0.18;
  const rimY = TOP + gl.rim;
  const G = new THREE.Vector3(X, 1.86, Z + 0.05);

  const mist = [0, 1, 2, 3, 4, 5, 6].map((k) => {
    const mat = p.mat("#ffffff", { soft: true, alpha: 0, rough: 0.9 });
    const mesh = p.mesh(p.puff, mat, g);
    mesh.visible = false;
    return { mesh, mat, born: 0.25 + k * 0.14, ang: k * 0.9 };
  });

  const env = new THREE.Group();
  g.add(env);
  const paper = p.mat("#fbf3e2", { rough: 0.8, double: true });
  const paper2 = p.mat("#efe0c2", { rough: 0.8, double: true });
  const seal = p.mat("#c0392b", { rough: 0.6 });
  p.mesh(p.geo(new THREE.BoxGeometry(0.17, 0.115, 0.008)), paper, env);
  const shape = new THREE.Shape();
  shape.moveTo(-0.085, 0);
  shape.lineTo(0.085, 0);
  shape.lineTo(0, -0.066);
  shape.closePath();
  const flap = p.mesh(p.geo(new THREE.ShapeGeometry(shape)), paper2, env, 0, 0.0575, 0.0045);
  const sealM = p.mesh(p.sphere, seal, env, 0, -0.008, 0.007);
  sealM.visible = false;
  env.visible = false;
  const envMats = [paper, paper2, seal];
  const burst = new Steam(p, g, G, {
    start: 2.5,
    end: 2.75,
    every: 0.05,
    life: 0.7,
    size: 0.03,
    rise: 0.05,
    alpha: 0.45,
  });

  return {
    duration: D,
    pivot: new THREE.Vector3(X, TOP, Z),
    step(t) {
      cubes.forEach((m, k) => {
        const a = k * 2.1;
        m.position.set(
          X + Math.cos(a) * 0.04,
          TOP + gl.floor + 0.205 + 0.006 * Math.sin(t * 2 + k),
          Z + Math.sin(a) * 0.04,
        );
        m.rotation.y = k + t * 0.3;
      });
      const gather = 1 - smooth(seg(t, 1.35, 1.75));
      for (const m of mist) {
        const u = easeInOut(seg(t, m.born, m.born + 1.1));
        m.mesh.visible = t > m.born && gather > 0.001;
        const r = 0.07 * (1 - u);
        const ang = m.ang + u * 3;
        m.mesh.position.set(
          lerp(X, G.x, u) + Math.cos(ang) * r,
          lerp(rimY + 0.01, G.y, u),
          lerp(Z, G.z, u) + Math.sin(ang) * r,
        );
        m.mesh.scale.setScalar((0.02 + 0.03 * u) * gather + 1e-4);
        m.mat.alpha = 0.5 * smooth(seg(t, m.born, m.born + 0.3)) * gather;
      }

      const show = seg(t, 1.3, 1.7);
      const fly = seg(t, 2.55, 3.75);
      env.visible = show > 0 && fly < 1;
      const e = easeIn(fly);
      const hover = 0.01 * Math.sin(t * 4) * (1 - smooth(fly));
      env.position.set(G.x + 0.28 * e, G.y + 0.62 * e + hover, G.z - 0.32 * e);
      env.rotation.set(
        -0.5 * smooth(fly),
        Math.PI * (1 - easeOut(show)),
        -0.3 * smooth(fly) + 0.18 * Math.sin(fly * 12) * bump(fly),
      );
      env.scale.setScalar(Math.max(easeOutBack(show) * (1 - 0.45 * e), 1e-4));
      flap.rotation.x = -Math.PI * (1 - easeInOut(seg(t, 1.7, 2.15)));
      const s = easeOutBack(seg(t, 2.15, 2.4));
      sealM.visible = s > 0.01;
      sealM.scale.set(0.018 * s, 0.018 * s, 0.006 * s + 1e-4);
      const fade = 1 - smooth(seg(fly, 0.55, 1));
      for (const m of envMats) m.alpha = fade;
      burst.step(t);
    },
  };
};

const BUILDERS: Record<BrewKind, Build> = {
  shot,
  layers,
  kaapi,
  exchange,
  foam,
  drip,
  parallel,
  letter,
};

// ---------------------------------------------------------------- brew

export class Brew {
  /** Add this to the scene. Positioned/rotated by the constructor: group.position = at, group.rotation.y = yaw. */
  readonly group = new THREE.Group();
  /** Seconds the whole moment lasts (≈3–4.5 s including a fade-out at the end). */
  readonly duration: number;
  private readonly inner = new THREE.Group();
  private readonly parts = new Parts();
  private readonly scene: Scene;
  private t = 0;

  constructor(kind: BrewKind, at: THREE.Vector3, yaw: number) {
    this.group.position.copy(at);
    this.group.rotation.y = yaw;
    this.group.add(this.inner);
    this.scene = BUILDERS[kind](this.parts, this.inner);
    this.duration = this.scene.duration;
    this.apply(0);
  }

  /** Advance; returns false once finished (caller then removes group and calls dispose). */
  update(dt: number): boolean {
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.t = Math.min(this.duration, this.t + step);
    this.apply(this.t);
    return this.t < this.duration;
  }

  /** Frees geometries and materials it created. */
  dispose(): void {
    this.parts.dispose();
    this.inner.clear();
  }

  private apply(t: number): void {
    const d = this.duration;
    this.scene.step(t);
    const fin = smooth(seg(t, 0, 0.3));
    const fout = 1 - smooth(seg(t, d - FADE, d));
    const fade = fin * fout;
    const s = (0.9 + 0.1 * easeOut(seg(t, 0, 0.35))) * (1 - 0.1 * smooth(seg(t, d - FADE, d)));
    this.inner.scale.setScalar(s);
    this.inner.position.copy(this.scene.pivot).multiplyScalar(1 - s);
    this.group.visible = fade > 0.002;
    for (const r of this.parts.mats) {
      const a = r.alpha * fade;
      const see = r.soft || a < 0.999;
      if (r.m.transparent !== see) {
        r.m.transparent = see;
        r.m.depthWrite = !see;
        r.m.needsUpdate = true;
      }
      r.m.opacity = see ? a : 1;
    }
  }
}
