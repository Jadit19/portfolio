/**
 * The flat-world kit, shared by the opening yard, the worlds and the design
 * boards: toys by id (in clay), flat shapes on the ground (roads, water,
 * paint), the clay matcap, and cut-paper shadows (each object's shape
 * squashed flat onto the floor along the sun: razor-sharp, no shadow maps).
 *
 * Everything here is unlit or matcap-shaded, so scenes built from it read the
 * same under any renderer settings (materials opt out of tone mapping).
 */

import * as THREE from "three";
import { PASTEL as P } from "../lib/palette";
import {
  BUILDINGS,
  BUSHES,
  CARTS,
  type G,
  type Item,
  LANDSCAPE,
  PEDESTALS,
  ROCKS,
  recolour,
  STREET,
  TREES,
} from "../lib/toys";

export type Pt = [number, number];

// ── toys by id ───────────────────────────────────────────────────────────

const FAMILIES: Record<string, Item[]> = {
  T: TREES,
  B: BUSHES,
  R: ROCKS,
  H: BUILDINGS,
  C: CARTS,
  P: PEDESTALS,
  S: STREET,
};
export const LEAVES: string[] = [P.mint, P.pistachio, P.fern];
export const PETALS: string[] = [P.rose, P.marigold, P.lavender, P.blossom, P.coral];

function swaps(tint: string): [string, string][] {
  const hex = P[tint as keyof typeof P] ?? tint;
  if (LEAVES.includes(hex)) return LEAVES.filter((c) => c !== hex).map((c) => [c, hex]);
  return PETALS.filter((c) => c !== hex).map((c) => [c, hex]);
}

const cache = new Map<string, G>();
/** A toy's geometry by catalogue id ("T1", "B2", "lotus"…), optionally re-tinted. Cached. */
export function toy(id: string, tint?: string): G {
  const key = `${id}:${tint ?? ""}`;
  let g = cache.get(key);
  if (!g) {
    const item = LANDSCAPE[id] ?? FAMILIES[id[0] as string]?.[Number(id.slice(1)) - 1];
    if (!item) throw new Error(`No toy ${id}`);
    g = tint ? recolour(toy(id), swaps(tint)) : item.make();
    g.computeBoundingBox();
    cache.set(key, g);
  }
  return g;
}

/** A toy's footprint radius at scale 1 (m). */
export function footprint(id: string): number {
  const b = toy(id).boundingBox as THREE.Box3;
  return (Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2) * 0.85;
}

// ── colour and shape helpers ─────────────────────────────────────────────

export function mix(a: string, b: string, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

/** A soft, irregular closed outline. */
export function blob(cx: number, cz: number, rx: number, rz: number, seed: number, n = 64): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k =
      1 +
      0.09 * Math.sin(3 * a + seed) +
      0.06 * Math.sin(5 * a + seed * 2.3) +
      0.03 * Math.sin(8 * a + seed * 0.7);
    out.push([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]);
  }
  return out;
}

/** Grows an outline from its centre by `d` metres (good enough for blobs). */
export function grow(pts: Pt[], d: number): Pt[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, z]) => {
    const l = Math.hypot(x - cx, z - cz) || 1;
    return [x + ((x - cx) / l) * d, z + ((z - cz) / l) * d];
  });
}

function segDist(x: number, z: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}

export function lineDist(pts: Pt[], x: number, z: number): number {
  let d = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pts.length - 1; i++)
    d = Math.min(d, segDist(x, z, pts[i] as Pt, pts[i + 1] as Pt));
  return d;
}

/** Signed distance to a closed outline: negative inside. */
export function shapeDist(pts: Pt[], x: number, z: number): number {
  let d = Number.POSITIVE_INFINITY;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i] as Pt;
    const b = pts[j] as Pt;
    d = Math.min(d, segDist(x, z, a, b));
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside ? -d : d;
}

/** An unlit flat colour (not tone mapped, so pastels stay exact). */
export function flat(
  colour: string,
  o: THREE.MeshBasicMaterialParameters = {},
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: colour, toneMapped: false, ...o });
}

/** A flat filled outline lying on the ground, with optional holes. */
export function flatShape(pts: Pt[], colour: string, y: number, holes: Pt[][] = []): THREE.Mesh {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ShapeGeometry(s, 4);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, flat(colour, { side: THREE.DoubleSide }));
  m.position.y = y;
  return m;
}

/** A flat band along a polyline (roads, rivers, paths), its surface at height y. */
export function ribbon(pts: Pt[], half: number, colour: string, y: number): THREE.Mesh {
  const pos: number[] = [];
  const idx: number[] = [];
  pts.forEach(([x, z], i) => {
    const [ax, az] = pts[Math.max(0, i - 1)] as Pt;
    const [bx, bz] = pts[Math.min(pts.length - 1, i + 1)] as Pt;
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / l;
    const nz = (bx - ax) / l;
    pos.push(x + nx * half, y, z + nz * half, x - nx * half, y, z - nz * half);
    if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // Round caps, so paths end softly.
  const m = new THREE.Mesh(g, flat(colour, { side: THREE.DoubleSide }));
  for (const end of [pts[0], pts[pts.length - 1]] as Pt[]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(half, 20), m.material);
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(end[0], y, end[1]);
    m.add(cap);
  }
  return m;
}

/** A smooth polyline through control points (Catmull-Rom). */
export function curve(ctrl: Pt[], per = 12): Pt[] {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  return c.getPoints(ctrl.length * per).map((v) => [v.x, v.z] as Pt);
}

export function circle(cx: number, cz: number, r: number, n = 64): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++)
    out.push([cx + Math.cos((i / n) * Math.PI * 2) * r, cz + Math.sin((i / n) * Math.PI * 2) * r]);
  return out;
}

/** Seeded random numbers (mulberry32). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── clay ─────────────────────────────────────────────────────────────────

/** A soft clay matcap: white-ish key light, warm shadow, the ground's colour bounced up from below. */
export function clayMatcap(ground: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#a8a8a8";
  g.fillRect(0, 0, 256, 256);
  g.save();
  g.beginPath();
  g.arc(128, 128, 128, 0, Math.PI * 2);
  g.clip();
  const r = g.createRadialGradient(92, 80, 4, 118, 116, 150);
  r.addColorStop(0, "#ffffff");
  r.addColorStop(0.42, "#f4f2ef");
  r.addColorStop(0.82, "#cbc6c0");
  r.addColorStop(1, "#aca69f");
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  const gc = new THREE.Color(ground);
  const bounce = g.createLinearGradient(0, 150, 0, 256);
  bounce.addColorStop(0, "rgba(0,0,0,0)");
  bounce.addColorStop(
    1,
    `rgba(${Math.round(gc.r * 255)},${Math.round(gc.g * 255)},${Math.round(gc.b * 255)},0.6)`,
  );
  g.fillStyle = bounce;
  g.fillRect(0, 0, 256, 256);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The shared clay material for toys (vertex-coloured). */
export function clay(ground: string): THREE.MeshMatcapMaterial {
  return new THREE.MeshMatcapMaterial({
    matcap: clayMatcap(ground),
    vertexColors: true,
    toneMapped: false,
  });
}

/** Lit materials become clay in the same colour, so figures and bikes match the toys. */
export function toClay(root: THREE.Object3D, matcap: THREE.Texture): void {
  const made = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const swap = (m: THREE.Material) => {
      const done = made.get(m);
      if (done) return done;
      const c = (m as THREE.MeshStandardMaterial).color;
      if (!c || (m as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
        m.toneMapped = false;
        return m;
      }
      const out = new THREE.MeshMatcapMaterial({
        matcap,
        color: c.clone(),
        side: m.side,
        toneMapped: false,
      });
      if (mesh.geometry.attributes.color && (m as THREE.MeshStandardMaterial).vertexColors)
        out.vertexColors = true;
      made.set(m, out);
      return out;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
}

// ── cut-paper shadows ────────────────────────────────────────────────────

/** The sun: up and back-left, so shadows fall right and towards the camera. */
export const SUN = new THREE.Vector3(-0.45, 1, -0.3).normalize();

/**
 * A shadow material: geometry squashed flat onto the floor at height `floor`
 * along the sun, in one solid colour. Works on meshes and instanced meshes.
 */
export function paperShadow(colour: string, floor = 0.012): THREE.ShaderMaterial {
  // Linear colour, converted for wherever it's drawn (the screen, or the night pass's buffer).
  const c = new THREE.Color(colour);
  return new THREE.ShaderMaterial({
    uniforms: {
      uL: { value: SUN },
      uC: { value: new THREE.Vector3(c.r, c.g, c.b) },
      uY: { value: floor },
    },
    vertexShader: /* glsl */ `
      uniform vec3 uL;
      uniform float uY;
      void main() {
        vec4 w = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          w = instanceMatrix * w;
        #endif
        w = modelMatrix * w;
        w.xz -= uL.xz / uL.y * max(w.y - uY, 0.0);
        w.y = uY;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uC;
      void main() {
        gl_FragColor = vec4(uC, 1.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
  });
}

/** A ground's heights as a texture (half floats), for shadows to drape over. */
export interface Heights {
  tex: THREE.DataTexture;
  /** x0, z0, width, depth. */
  bounds: THREE.Vector4;
}

/** Heights from a PlaneGeometry ground (rotated flat, rows from −z), as a texture. */
export function heightsOf(ground: THREE.PlaneGeometry): Heights {
  const { width, height, widthSegments: sx, heightSegments: sz } = ground.parameters;
  const pos = ground.attributes.position as THREE.BufferAttribute;
  // The last row and column repeat the first (the world wraps), so they're left out:
  // the texture then repeats with exactly the world's period.
  const data = new Uint16Array(sx * sz);
  for (let j = 0; j < sz; j++)
    for (let i = 0; i < sx; i++)
      data[j * sx + i] = THREE.DataUtils.toHalfFloat(pos.getY(j * (sx + 1) + i));
  const tex = new THREE.DataTexture(data, sx, sz, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  // Texel centres sit on the grid's vertices.
  const cx = width / sx;
  const cz = height / sz;
  return {
    tex,
    bounds: new THREE.Vector4(-width / 2 - cx / 2, -height / 2 - cz / 2, width, height),
  };
}

/**
 * A draped shadow: the thing squashed along the sun onto the ground under it
 * (following slopes, lying on top of roads and water), darkening whatever it
 * falls on (grass darker green, sand darker sand) rather than painting one
 * colour. Shadows never stack: where two overlap it's one shade, like cut
 * paper (a stencil marks what's already shaded; the renderer needs a stencil).
 */
export function drapedShadow(
  h: Heights,
  shade = new THREE.Color(0.8, 0.8, 0.86),
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uL: { value: SUN },
      uH: { value: h.tex },
      uB: { value: h.bounds },
      uC: { value: shade },
      uLift: { value: 0.13 },
    },
    vertexShader: /* glsl */ `
      uniform vec3 uL;
      uniform sampler2D uH;
      uniform vec4 uB;
      uniform float uLift;
      float hAt(vec2 p) { return texture2D(uH, (p - uB.xy) / uB.zw).r; }
      void main() {
        vec4 w = vec4(position, 1.0);
        vec4 o = vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          w = instanceMatrix * w;
          o = instanceMatrix * o;
        #endif
        w = modelMatrix * w;
        o = modelMatrix * o;
        float base = hAt(o.xz);
        w.xz -= uL.xz / uL.y * max(w.y - base, 0.0);
        w.y = hAt(w.xz) + uLift;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uC;
      void main() { gl_FragColor = vec4(uC, 1.0); }`,
    blending: THREE.CustomBlending,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.ZeroFactor,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
    toneMapped: false,
  });
}

const shown = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

/**
 * A live shadow for a (possibly moving) object: one shadow mesh per visible
 * mesh, parented alongside so they follow it. The shadow meshes share the
 * object's geometry and read its world matrix every frame.
 */
export class LiveShadow {
  readonly group = new THREE.Group();
  private pairs: [THREE.Mesh, THREE.Mesh][] = [];
  constructor(
    private readonly target: THREE.Object3D,
    readonly material: THREE.ShaderMaterial,
  ) {
    this.rebuild();
  }
  /** Re-reads the target's meshes (after showing or hiding parts). */
  rebuild(): void {
    this.group.clear();
    this.pairs = [];
    this.target.updateMatrixWorld(true);
    this.target.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.noShadow || !shown(mesh)) return;
      const s = new THREE.Mesh(mesh.geometry, this.material);
      s.frustumCulled = false;
      s.matrixAutoUpdate = false;
      this.group.add(s);
      this.pairs.push([mesh, s]);
    });
    this.update();
  }
  update(): void {
    for (const [m, s] of this.pairs) s.matrix.copy(m.matrixWorld);
  }
  setFloor(y: number): void {
    const u = this.material.uniforms.uY as { value: number } | undefined;
    if (u) u.value = y;
  }
}

/** Adds a static object and its shadow (computed once) to a parent. */
export function placeStatic(
  parent: THREE.Object3D,
  obj: THREE.Object3D,
  shadow: THREE.ShaderMaterial,
): void {
  parent.add(obj);
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.noShadow || !shown(mesh)) return;
    const s = new THREE.Mesh(mesh.geometry, shadow);
    s.frustumCulled = false;
    s.matrixAutoUpdate = false;
    s.matrix.copy(mesh.matrixWorld);
    parent.add(s);
  });
}
