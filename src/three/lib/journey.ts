/**
 * Long-route ("journey") design toolkit: terrain with real elevation, roads
 * that lie on the terrain, corner detection (corners are where stops and
 * details live), and a shot list (overview map + key moments). Design
 * previews only, never shipped.
 */

import * as THREE from "three";
import type { BikeKind } from "../../content/types";
import { box, disc, type Kit, tube } from "./kit";
import { type Mood, rider, shift } from "./zones";

export type V2 = [number, number];
export type HeightFn = (x: number, z: number) => number;

// ── Terrain ───────────────────────────────────────────────────────────────

export interface TerrainOptions {
  w: number;
  d: number;
  /** Grid cells per world unit. */
  density?: number;
  height: HeightFn;
  colour: (x: number, z: number, h: number, slope: number) => string;
  mood: Mood;
  /** Width of the soft edge where the land rolls away (world units). */
  soft?: number;
  /** How far the edge falls below the land. */
  fall?: number;
  /** The height function already tiles (so the terrain doesn't blend its edges again). */
  preTiled?: boolean;
  /** @deprecated No longer used (edges are soft now); accepted for compatibility. */
  base?: number;
}

/**
 * Open-world switch (off by default): while on, terrains are built to tile,
 * with no soft rim and opposite edges matching, so a world can wrap round.
 */
let TILING = false;
export function setTiling(on: boolean): void {
  TILING = on;
}
export function tiling(): boolean {
  return TILING;
}

/**
 * Makes a height field tile: within `band` of each edge the ground blends
 * toward what lies just past the opposite edge, so the east edge meets the
 * west edge (and north meets south) exactly, with no seam.
 */
export function tileHeight(h: HeightFn, w: number, d: number, band: number): HeightFn {
  const fade = (x: number, half: number) =>
    x > half - band
      ? 0.5 * THREE.MathUtils.smootherstep(x, half - band, half)
      : x < -half + band
        ? 0.5 * THREE.MathUtils.smootherstep(-x, half - band, half)
        : 0;
  const hx: HeightFn = (x, z) => {
    const a = fade(x, w / 2);
    return a === 0 ? h(x, z) : (1 - a) * h(x, z) + a * h(x - Math.sign(x) * w, z);
  };
  return (x, z) => {
    const a = fade(z, d / 2);
    return a === 0 ? hx(x, z) : (1 - a) * hx(x, z) + a * hx(x, z - Math.sign(z) * d);
  };
}

/** Signed distance to a rounded rectangle centred at the origin (negative inside). */
function roundedRectSdf(x: number, z: number, hw: number, hd: number, r: number): number {
  const qx = Math.abs(x) - (hw - r);
  const qz = Math.abs(z) - (hd - r);
  const ox = Math.max(qx, 0);
  const oz = Math.max(qz, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0) - r;
}

/**
 * A heightfield with per-vertex colours. There are no hard cut-away walls: the
 * land rolls softly away at a rounded-rectangle edge, so the diorama blends
 * into the background instead of ending in a sharp edge.
 */
export function terrain(o: TerrainOptions): THREE.Group {
  const steps = terrainSteps(o);
  for (;;) {
    const n = steps.next();
    if (n.done) return n.value;
  }
}

/**
 * terrain(), yielding every few thousand vertices: a build can use
 * `yield* terrainSteps(…)` so a big ground mesh doesn't freeze the page.
 */
export function* terrainSteps(o: TerrainOptions): Generator<unknown, THREE.Group, unknown> {
  const density = o.density ?? 2.2;
  const soft = o.soft ?? 9;
  const fall = o.fall ?? 7;
  const sx = Math.round(o.w * density);
  const sz = Math.round(o.d * density);
  const geo = new THREE.PlaneGeometry(o.w, o.d, sx, sz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const edge: number[] = [];
  const hw = o.w / 2;
  const hd = o.d / 2;
  const radius = Math.min(hw, hd) * 0.45;
  // Tiling: no rim, and the edges match their opposites.
  const height =
    TILING && !o.preTiled ? tileHeight(o.height, o.w, o.d, Math.min(o.w, o.d) * 0.14) : o.height;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const inside = -roundedRectSdf(x, z, hw, hd, radius);
    // 1 well inside, easing to 0 at the rim (smootherstep for a soft shoulder).
    const k = TILING ? 1 : THREE.MathUtils.smootherstep(inside, 0, soft);
    const h = height(x, z);
    pos.setY(i, THREE.MathUtils.lerp(h - fall, h, k));
    edge.push(k);
    if (i % 3000 === 2999) yield;
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const colours: number[] = [];
  const c = new THREE.Color();
  const rim = new THREE.Color(shift("#8a6a50", o.mood));
  for (let i = 0; i < pos.count; i++) {
    const slope = 1 - nrm.getY(i);
    c.set(shift(o.colour(pos.getX(i), pos.getZ(i), pos.getY(i), slope), o.mood));
    // The falling rim shades towards earth so the edge reads as soft soil.
    c.lerp(rim, (1 - (edge[i] ?? 1)) * 0.7);
    colours.push(c.r, c.g, c.b);
    if (i % 6000 === 5999) yield;
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
  );
  mesh.receiveShadow = true;
  // Terrain only receives shadows: self-shadowing a heightfield causes acne on long slopes.
  mesh.castShadow = false;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

// ── Roads ─────────────────────────────────────────────────────────────────

export interface Road {
  curve: THREE.CatmullRomCurve3;
  length: number;
  /** Point, heading (radians, for the bike) and signed curvature at t ∈ [0,1]. */
  at(t: number): { p: THREE.Vector3; heading: number; curvature: number; normal: THREE.Vector3 };
  /** Local minima of radius: t values of slow corners, sharpest first. */
  corners(min?: number): number[];
  /** Height of the road surface along its length (for flattening terrain). */
  samples: { x: number; z: number; y: number }[];
}

/**
 * Chaikin corner-cutting: rounds every corner of the control polygon so even
 * hairpins become smooth arcs (no kinks). Endpoints of open roads are kept.
 */
export function chaikin(pts: V2[], iterations: number, closed = false): V2[] {
  let out = pts;
  for (let it = 0; it < iterations; it++) {
    const next: V2[] = closed ? [] : [out[0] ?? [0, 0]];
    const n = out.length;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = out[i];
      const b = out[(i + 1) % n];
      if (!a || !b) continue;
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) next.push(out[n - 1] ?? [0, 0]);
    out = next;
  }
  return out;
}

/**
 * Control points for a branch that leaves `main` at t1, wanders through `via`,
 * and rejoins at t2. Starts and ends tangent to the main road so the fork and
 * merge are smooth.
 */
export function branchPoints(main: Road, t1: number, t2: number, via: V2[]): V2[] {
  const a = main.at(t1);
  const a2 = main.at(t1 + 0.01);
  const b0 = main.at(t2 - 0.01);
  const b = main.at(t2);
  return [[a.p.x, a.p.z], [a2.p.x, a2.p.z], ...via, [b0.p.x, b0.p.z], [b.p.x, b.p.z]];
}

/** Builds the road centreline on the terrain, smoothing its height profile. */
export function makeRoad(pts: V2[], height: HeightFn, closed = false, smooth = 6, round = 2): Road {
  const control = chaikin(pts, round, closed);
  const flat = new THREE.CatmullRomCurve3(
    control.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    closed,
    "centripetal",
  );
  const N = 900;
  const raw: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const p = flat.getPointAt(i / N);
    raw.push(new THREE.Vector3(p.x, height(p.x, p.z), p.z));
  }
  // Smooth the height profile so the road never jitters with the terrain.
  const ys = raw.map((p) => p.y);
  for (let pass = 0; pass < smooth; pass++) {
    for (let i = 1; i < ys.length - 1; i++)
      ys[i] = ((ys[i - 1] ?? 0) + (ys[i] ?? 0) * 2 + (ys[i + 1] ?? 0)) / 4;
  }
  raw.forEach((p, i) => {
    p.y = ys[i] ?? p.y;
  });
  const curve = new THREE.CatmullRomCurve3(raw, closed, "centripetal");
  const length = curve.getLength();
  const at = (t: number) => {
    const tt = THREE.MathUtils.clamp(t, 0, 1);
    const p = curve.getPointAt(tt);
    const tan = curve.getTangentAt(tt);
    const e = 0.004;
    const t2 = curve.getTangentAt(Math.min(1, tt + e));
    const t1 = curve.getTangentAt(Math.max(0, tt - e));
    const turn = Math.atan2(t2.x * t1.z - t2.z * t1.x, t2.x * t1.x + t2.z * t1.z);
    const curvature = turn / (2 * e * length);
    const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    return { p, heading: Math.atan2(-tan.z, tan.x), curvature, normal };
  };
  const corners = (min = 0.06) => {
    const out: { t: number; k: number }[] = [];
    const M = 400;
    const ks = Array.from({ length: M + 1 }, (_, i) => Math.abs(at(i / M).curvature));
    for (let i = 2; i < M - 1; i++) {
      const k = ks[i] ?? 0;
      if (k > min && k >= (ks[i - 1] ?? 0) && k >= (ks[i + 1] ?? 0)) out.push({ t: i / M, k });
    }
    return out.sort((a, b) => b.k - a.k).map((c) => c.t);
  };
  const samples = raw.filter((_, i) => i % 3 === 0).map((p) => ({ x: p.x, z: p.z, y: p.y }));
  return { curve, length, at, corners, samples };
}

/**
 * Wraps a height function so the ground is flattened to the road's height
 * across `width` (plus a soft shoulder), as real roads are cut into hills.
 */
export function carve(height: HeightFn, road: Road, width: number, shoulder = 3): HeightFn {
  const s = road.samples;
  const inner = width / 2 + 0.4;
  const reach = inner + shoulder;
  // Segments bucketed in a coarse grid, so each lookup only measures the few
  // within reach (beyond it the ground is untouched anyway).
  const CELL = Math.max(4, reach);
  const buckets = new Map<number, number[]>();
  const key = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
  for (let n = 0; n < s.length - 1; n++) {
    const a = s[n];
    const b = s[n + 1];
    if (!a || !b) continue;
    const i0 = Math.floor((Math.min(a.x, b.x) - reach) / CELL);
    const i1 = Math.floor((Math.max(a.x, b.x) + reach) / CELL);
    const j0 = Math.floor((Math.min(a.z, b.z) - reach) / CELL);
    const j1 = Math.floor((Math.max(a.z, b.z) + reach) / CELL);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        const list = buckets.get(k);
        if (list) list.push(n);
        else buckets.set(k, [n]);
      }
  }
  return (x, z) => {
    const list = buckets.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return height(x, z);
    let best = Number.POSITIVE_INFINITY;
    let y = 0;
    // In order along the road, as before, so ties resolve the same way.
    for (const n of list) {
      const a = s[n];
      const b = s[n + 1];
      if (!a || !b) continue;
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const l2 = abx * abx + abz * abz || 1;
      const t = Math.min(1, Math.max(0, ((x - a.x) * abx + (z - a.z) * abz) / l2));
      const qx = a.x + abx * t;
      const qz = a.z + abz * t;
      const d = (qx - x) ** 2 + (qz - z) ** 2;
      if (d < best) {
        best = d;
        y = a.y + (b.y - a.y) * t;
      }
    }
    const dist = Math.sqrt(best);
    if (dist >= reach) return height(x, z);
    if (dist <= inner) return y - 0.02;
    const h = height(x, z);
    const k = THREE.MathUtils.smootherstep(dist, inner, inner + shoulder);
    return THREE.MathUtils.lerp(y - 0.02, h, k);
  };
}

/**
 * Nearest point on a polyline to (x, z), exactly, for points within `reach`
 * of it; null beyond. Segments are bucketed in a coarse grid, so a lookup
 * only measures the few nearby (ties go to the earlier segment, as a plain
 * scan would).
 */
export function polylineIndex(
  pts: readonly { x: number; z: number }[],
  reach: number,
): (x: number, z: number) => { d: number; px: number; pz: number } | null {
  const CELL = Math.max(4, reach);
  const buckets = new Map<number, number[]>();
  const key = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
  for (let n = 0; n < pts.length - 1; n++) {
    const a = pts[n];
    const b = pts[n + 1];
    if (!a || !b) continue;
    const i0 = Math.floor((Math.min(a.x, b.x) - reach) / CELL);
    const i1 = Math.floor((Math.max(a.x, b.x) + reach) / CELL);
    const j0 = Math.floor((Math.min(a.z, b.z) - reach) / CELL);
    const j1 = Math.floor((Math.max(a.z, b.z) + reach) / CELL);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        const list = buckets.get(k);
        if (list) list.push(n);
        else buckets.set(k, [n]);
      }
  }
  return (x, z) => {
    const list = buckets.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return null;
    let best = Number.POSITIVE_INFINITY;
    let px = x;
    let pz = z;
    for (const n of list) {
      const a = pts[n];
      const b = pts[n + 1];
      if (!a || !b) continue;
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const l2 = abx * abx + abz * abz || 1;
      const t = Math.min(1, Math.max(0, ((x - a.x) * abx + (z - a.z) * abz) / l2));
      const qx = a.x + abx * t;
      const qz = a.z + abz * t;
      const d = Math.hypot(qx - x, qz - z);
      if (d < best) {
        best = d;
        px = qx;
        pz = qz;
      }
    }
    return best <= reach ? { d: best, px, pz } : null;
  };
}

/** Distance from (x, z) to a polyline, exactly, within `reach` of it; Infinity beyond. */
export function nearPolyline(
  pts: readonly { x: number; z: number }[],
  reach: number,
): (x: number, z: number) => number {
  const near = polylineIndex(pts, reach);
  return (x, z) => near(x, z)?.d ?? Number.POSITIVE_INFINITY;
}

export interface RoadMeshOptions {
  /** Hug this ground instead of the curve's own height (so crossing roads meet on one surface). */
  height?: HeightFn;
  /** Leave out the ribbon where this is true (e.g. a centre line through a crossing). */
  skip?: (x: number, z: number) => boolean;
  /**
   * Depth layer: shoulders 0, asphalt 1, markings 2. Higher layers always win
   * where ribbons overlap, so one road's shoulder never paints over another's asphalt.
   */
  layer?: number;
}

/** The road surface as a ribbon that follows the curve's height (or the ground's). */
export function roadMesh(
  kit: Kit,
  road: Road,
  width: number,
  colour: string,
  lift = 0.08,
  steps = 1400,
  o: RoadMeshOptions = {},
): THREE.Mesh {
  const pos: number[] = [];
  const idx: number[] = [];
  let prev = false;
  for (let i = 0; i <= steps; i++) {
    const { p, normal } = road.at(i / steps);
    const lx = p.x + normal.x * (width / 2);
    const lz = p.z + normal.z * (width / 2);
    const rx = p.x - normal.x * (width / 2);
    const rz = p.z - normal.z * (width / 2);
    const ly = o.height ? o.height(lx, lz) : p.y;
    const ry = o.height ? o.height(rx, rz) : p.y;
    pos.push(lx, ly + lift, lz, rx, ry + lift, rz);
    const keep = !o.skip?.(p.x, p.z);
    if (i > 0 && keep && prev) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    prev = keep;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // A dedicated material that always wins the depth test against the terrain.
  const base = kit.mat(colour) as THREE.MeshStandardMaterial;
  const mat = base.clone();
  mat.side = THREE.DoubleSide;
  mat.polygonOffset = true;
  const layer = o.layer ?? 1;
  mat.polygonOffsetFactor = -2 - layer * 2;
  mat.polygonOffsetUnits = -2 - layer * 2;
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  // It is the road (the open world keeps everything else off it).
  m.userData.spansRoad = true;
  return m;
}

/**
 * Where roads meet: crossings (two roads, or two passes of one road) and the
 * ends of branches that join another road. Returns one point per junction.
 */
export function findJunctions(roads: { road: Road; closed?: boolean }[], near = 1.2): V2[] {
  const pts = roads.map(({ road }) => {
    const n = Math.max(40, Math.round(road.length / 0.8));
    return Array.from({ length: n + 1 }, (_, i) => road.at(i / n).p);
  });
  const out: V2[] = [];
  const add = (x: number, z: number) => {
    if (out.some(([ox, oz]) => (ox - x) ** 2 + (oz - z) ** 2 < 36)) return;
    out.push([x, z]);
  };
  pts.forEach((a, ia) => {
    pts.forEach((b, ib) => {
      if (ib < ia) return;
      for (let i = 0; i < a.length; i++) {
        const pa = a[i];
        if (!pa) continue;
        for (let j = ia === ib ? i + 1 : 0; j < b.length; j++) {
          const pb = b[j];
          if (!pb) continue;
          if (ia === ib) {
            // The same road passing itself: ignore neighbours along the curve.
            const gap = Math.abs(i - j);
            if (Math.min(gap, a.length - gap) < 30) continue;
          }
          if ((pa.x - pb.x) ** 2 + (pa.z - pb.z) ** 2 < near * near)
            add((pa.x + pb.x) / 2, (pa.z + pb.z) / 2);
        }
      }
    });
  });
  return out;
}

/**
 * Levels the ground at junctions so every road meeting there arrives at one
 * height (no steps between crossing roads), blending back into the land.
 */
export function levelJunctions(height: HeightFn, at: V2[], r = 4.5, blend = 6): HeightFn {
  const levels = at.map(([x, z]) => height(x, z));
  return (x, z) => {
    let h = height(x, z);
    at.forEach(([jx, jz], i) => {
      const d = Math.hypot(x - jx, z - jz);
      if (d >= r + blend) return;
      const k = d <= r ? 1 : 1 - THREE.MathUtils.smootherstep(d, r, r + blend);
      h = THREE.MathUtils.lerp(h, levels[i] ?? h, k);
    });
    return h;
  };
}

/** Alternating kerb blocks along both road edges near corners. */
export function kerbs(
  kit: Kit,
  road: Road,
  width: number,
  a: string,
  b: string,
  around: number[],
  span = 0.03,
): THREE.Group {
  const g = new THREE.Group();
  for (const c of around) {
    for (let t = c - span; t <= c + span; t += 0.0016) {
      const { p, normal, heading } = road.at(t);
      const i = Math.round(t / 0.0016);
      for (const side of [-1, 1]) {
        const k = box(kit, i % 2 ? a : b, [-0.22, 0, -0.18], [0.22, 0.08, 0.18]);
        k.position.set(
          p.x + normal.x * side * (width / 2 + 0.15),
          p.y + 0.02,
          p.z + normal.z * side * (width / 2 + 0.15),
        );
        k.rotation.y = heading;
        g.add(k);
      }
    }
  }
  return g;
}

/** Where things go relative to the road at t: `side` +1 = outside of the turn. */
export function beside(
  road: Road,
  t: number,
  offset: number,
  side: 1 | -1 | "outside" | "inside" = "outside",
) {
  const { p, normal, curvature, heading } = road.at(t);
  const turnSign = Math.sign(curvature) || 1;
  const s = side === "outside" ? turnSign : side === "inside" ? -turnSign : side;
  return { x: p.x + normal.x * s * offset, y: p.y, z: p.z + normal.z * s * offset, heading };
}

/** A round suggested-speed sign (corners are where you slow down). */
export function cornerSign(kit: Kit, speed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(kit, "#9aa3ad", [0, 0, 0], [0, 1.4, 0], 0.04));
  g.add(disc(kit, "#d93a2f", [0, 1.55, 0], 0.32, 0.05));
  g.add(disc(kit, "#ffffff", [0, 1.55, 0.03], 0.24, 0.02));
  const label = textSprite(String(speed), "#1d1f24");
  label.position.set(0, 1.55, 0.06);
  label.scale.set(0.42, 0.21, 1);
  g.add(label);
  return g;
}

/** A small billboard text sprite (signs, km markers, labels on design maps). */
export function textSprite(text: string, colour: string, bg?: string): THREE.Sprite {
  // The canvas grows with the text so long labels are never clipped; the
  // sprite keeps a 2:1 box by default and callers scale it as before, while
  // `userData.aspect` reports the real width/height for wide labels.
  const font = "800 72px Outfit, Arial, sans-serif";
  const probe = document.createElement("canvas").getContext("2d");
  if (probe) probe.font = font;
  const textW = probe ? probe.measureText(text).width : text.length * 44;
  const w = Math.max(256, Math.ceil(textW + 72));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    if (bg) {
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, 120, 28);
      ctx.fill();
    }
    ctx.fillStyle = colour;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, 68);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.userData.aspect = w / 128;
  // Widen proportionally whenever a caller sets a 2:1 scale.
  const k = w / 256;
  const setScale = sprite.scale.set.bind(sprite.scale);
  sprite.scale.set = (x: number, y: number, z: number) => setScale(x * k, y, z);
  return sprite;
}

/** A numbered stop pin (design maps only). */
export function stopPin(n: number, colour = "#1d1f24"): THREE.Sprite {
  const s = textSprite(String(n), "#ffffff", colour);
  s.scale.set(3.2, 1.6, 1);
  return s;
}

/** Places a scaled bike on the road at t, leaning into the corner. */
export function bikeOnRoad(
  bikeKit: Kit,
  kind: BikeKind,
  road: Road,
  t: number,
  extraLean = 0,
): THREE.Group {
  const { p, heading, curvature } = road.at(t);
  const lean = THREE.MathUtils.clamp(-curvature * 6, -0.6, 0.6) + extraLean;
  const b = rider(bikeKit, kind, p.x, p.z, heading, lean);
  b.position.y = p.y + 0.02;
  return b;
}

// ── Shots ─────────────────────────────────────────────────────────────────

export interface Moment {
  label: string;
  /** Where along the road the shot centres (and the bike sits). */
  t: number;
  /** Ortho frame height in world units (smaller = closer). */
  zoom: number;
  /** Cinematic: a perspective camera at this azimuth/elevation and distance. */
  cinematic?: { azimuth: number; elevation: number; distance: number; fov?: number };
  /** Extra lean / wheelie for drama. */
  lean?: number;
  /** The road this shot sits on (defaults to the main road), e.g. a branch. */
  road?: Road;
  /** Light this shot in a different mood (e.g. a night shot in a day world). */
  mood?: Mood;
}

export interface Branch {
  road: Road;
  /** Stops on this branch (t along the branch road). */
  stops: number[];
  label?: string;
}

/** The minimap's paper drawing: water shapes, the railway, buildings, rocks, trees, bridges. */
export interface MapArt {
  ponds: V2[][];
  rail: V2[];
  houses: { x: number; z: number; yaw: number; s: number }[];
  rocks: { x: number; z: number; r: number }[];
  trees: V2[];
  bridges: { x: number; z: number; yaw: number; len: number; width: number }[];
  /** Farm plots (each sub-field of an estate), tinted by crop on the paper. */
  fields?: { pts: V2[]; colour: string }[];
}

/**
 * A railway line round the world for the toy train: the track's points and
 * the distance along it at each, one loop's start and length, and where the
 * station's platform is centred (all in metres along the line).
 */
export interface TrainLine {
  pts: V2[];
  s: number[];
  from: number;
  period: number;
  station: number;
}

/** A ramp, as in WorldData.ramps. */
export interface Ramp {
  x: number;
  z: number;
  yaw: number;
  w: number;
  len: number;
  h: number;
  /** A humped bridge deck instead of a wedge: `base` at both ends, rising by `h` mid-span. */
  hump?: { base: number };
}

/** Everything a playable world needs from a journey's build (beyond the scenery it adds). */
export interface WorldData {
  /** The terrain heightfield mesh (a regular grid, rotated flat), for fast ground lookups. */
  ground: THREE.Mesh;
  /** Terrain footprint (world units), centred on the origin. */
  size: { w: number; d: number };
  /** `closed`: a loop (when left out, only the first road is one). */
  roads: { road: Road; width: number; closed?: boolean }[];
  /** Rivers and streams: centrelines and widths. */
  water: { pts: V2[]; width: number }[];
  /** Solid things the bike bounces off: buildings, trees, posts, animals. */
  blockers: { x: number; z: number; r: number; h?: number }[];
  /** Also work out solids from the scenery itself (on top of `blockers`). */
  autoSolids?: boolean;
  /** Straight solid edges the bike bounces off (e.g. bridge parapets), as [ax, az, bx, bz]. */
  walls?: [number, number, number, number][];
  /** Bridge decks: ridden over as road even where water runs underneath. */
  decks?: { pts: V2[]; width: number }[];
  /**
   * Ramps the bike rides up and launches off: a wedge `w` wide and `len` long,
   * rising to `h` along its local +z (turned by `yaw` like the toy).
   */
  ramps?: Ramp[];
  /** Lights that come on at night (lanterns, windows, station lamps): where, and how far their pool reaches. */
  lamps?: { x: number; y: number; z: number; r: number }[];
  /** A coarser ground for the physics (when `ground` is too detailed to collide with). */
  physicsGround?: THREE.Mesh;
  /** The shadow material for live things (the rider, knocked props), when the world has its own. */
  shadow?: THREE.Material;
  /** The toy train's line, if the world has a railway. */
  train?: TrainLine;
  /**
   * Scenery the bike knocks about (shrubs, small and medium trees and rocks):
   * drawn as static scenery until the bike comes near, then handed to the
   * physics (`hide` removes its static copy).
   */
  knockables?: {
    id: string;
    x: number;
    z: number;
    yaw: number;
    scale: number;
    mass: number;
    sound: "metal" | "wood" | "soft" | "pot";
    /** Its colour swap, if any (as the toy was drawn). */
    tint?: string;
    /** A tree: a trunk under a heavy canopy, so it topples. */
    tree?: boolean;
    hide(): void;
  }[];
  /** What the round minimap draws besides roads and water (a flat world's paper map). */
  mapArt?: MapArt;
  /** Things the bike shoves aside, by weight (pots, hay bales, bollards). */
  pushables?: {
    id: string;
    x: number;
    z: number;
    yaw: number;
    scale: number;
    /** Base height above the ground (stacked). */
    lift?: number;
    /** Weight, kg: how far a knock sends it. */
    mass: number;
    sound: "metal" | "wood" | "soft" | "pot";
    /** On wheels: rolls freely when pushed (carts). */
    wheels?: boolean;
  }[];
  /** Project stops. A tag marks a special place (e.g. "blastoff" beside the launch pad). */
  stops: {
    x: number;
    z: number;
    road: Road;
    t: number;
    tag?: string;
    /** A stop that's a landmark: how tall it is (the pin floats above), and no ring on the road. */
    top?: number;
  }[];
  /** Where roads cross, merge or split. */
  junctions: V2[];
  /** Named places the world's extras hang off (e.g. the roastery's live board). */
  landmarks: Record<string, { x: number; z: number; road?: { x: number; z: number } }>;
  /** First-visit spawn: the arrival gateway. */
  spawn: { x: number; z: number; heading: number };
}

export interface JourneyBuild {
  /** Present when the journey is playable. */
  world?: WorldData;
  road: Road;
  /** Optional side roads that fork off and rejoin the main road. */
  branches?: Branch[];
  moments: Moment[];
  /** Stops (t values) to pin on the overview map. */
  stops: number[];
  /** Overview map frame size (world units). */
  mapZoom: number;
  mapCentre?: V2;
}

export interface JourneyDef {
  id: string;
  title: string;
  mood: Mood;
  bike: BikeKind;
  /**
   * Builds the scenery into `scene`. May be a generator that yields between
   * its sections, so a ride can build in slices while the garage animates
   * (see buildSliced); runBuild runs either kind straight through.
   */
  build(scene: THREE.Scene, kit: Kit, bikeKit: Kit): JourneyBuild | BuildSteps;
  /**
   * A flat world (the flat-world language): dead-flat ground in one colour,
   * no planet curve, no haze, the fixed three-quarter camera, cut-paper
   * shadows. The ground colour is also the sky (the horizon never shows).
   */
  flat?: { ground: string };
}

/** A build that yields between its sections. */
export type BuildSteps = Generator<unknown, JourneyBuild, unknown>;

const isSteps = (r: JourneyBuild | BuildSteps): r is BuildSteps =>
  typeof (r as BuildSteps).next === "function" && typeof (r as BuildSteps).throw === "function";

/** Runs a journey's build to the end, in one go. */
export function runBuild(
  def: JourneyDef,
  scene: THREE.Scene,
  kit: Kit,
  bikeKit: Kit,
): JourneyBuild {
  const r = def.build(scene, kit, bikeKit);
  if (!isSteps(r)) return r;
  for (;;) {
    const n = r.next();
    if (n.done) return n.value;
  }
}

/**
 * Runs a journey's build a slice at a time: about `budget` ms of work, then a
 * frame for everything else (the garage keeps animating while a world builds).
 * `around` wraps each slice (to switch build-time settings on just for it).
 */
export async function buildSliced(
  def: JourneyDef,
  scene: THREE.Scene,
  kit: Kit,
  bikeKit: Kit,
  around: <T>(slice: () => T) => T,
  budget = 10,
): Promise<JourneyBuild> {
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  const r = around(() => def.build(scene, kit, bikeKit));
  if (!isSteps(r)) return r;
  for (;;) {
    const n = around(() => {
      const t0 = performance.now();
      for (;;) {
        const step = r.next();
        if (step.done || performance.now() - t0 > budget) return step;
      }
    });
    if (n.done) return n.value;
    await frame();
  }
}

// ── Grounding: nothing floats, nothing gets cut ──────────────────────────────

/** Surface normal of a height field at (x, z), by central differences. */
export function normalAt(height: HeightFn, x: number, z: number, e = 0.25): THREE.Vector3 {
  const dx = height(x + e, z) - height(x - e, z);
  const dz = height(x, z + e) - height(x, z - e);
  return new THREE.Vector3(-dx, 2 * e, -dz).normalize();
}

/**
 * Flattens the ground under building footprints so structures sit level on
 * slopes, blending smoothly back into the terrain around each pad (like a
 * real cut-and-fill platform).
 */
export function flattenPads(
  height: HeightFn,
  pads: { x: number; z: number; r: number; blend?: number }[],
): HeightFn {
  const levels = pads.map((p) => {
    // Average a ring of samples so the pad sits at the footprint's mean height.
    let sum = height(p.x, p.z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      sum += height(p.x + Math.cos(a) * p.r, p.z + Math.sin(a) * p.r);
    }
    return sum / 9;
  });
  return (x, z) => {
    let h = height(x, z);
    pads.forEach((p, i) => {
      const d = Math.hypot(x - p.x, z - p.z);
      const blend = p.blend ?? p.r * 0.8;
      if (d >= p.r + blend) return;
      const k = d <= p.r ? 1 : 1 - THREE.MathUtils.smootherstep(d, p.r, p.r + blend);
      h = THREE.MathUtils.lerp(h, levels[i] ?? h, k);
    });
    return h;
  };
}

export type GroundMode =
  /** Buildings: stay upright, sink to the lowest point of the footprint so no gap shows. */
  | "upright"
  /** Vehicles, animals, small props: tilt to match the slope. */
  | "align";

/**
 * Places an object on the terrain. "upright" keeps it vertical and sinks it to
 * the lowest corner of its footprint (pair with a foundation or flattenPads);
 * "align" tilts it to the surface normal so it rests naturally on slopes.
 */
export function placeOnGround(
  obj: THREE.Object3D,
  height: HeightFn,
  x: number,
  z: number,
  opts: { mode?: GroundMode; yaw?: number; footprint?: number; lift?: number } = {},
): THREE.Object3D {
  const { mode = "align", yaw = obj.rotation.y, footprint = 0.6, lift = 0 } = opts;
  if (mode === "upright") {
    let low = height(x, z);
    for (const [dx, dz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      low = Math.min(low, height(x + dx * footprint, z + dz * footprint));
    }
    obj.position.set(x, low + lift, z);
    obj.rotation.set(0, yaw, 0);
    return obj;
  }
  const n = normalAt(height, x, z);
  const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  obj.quaternion.copy(tilt.multiply(turn));
  obj.position.set(x, height(x, z) + lift, z);
  return obj;
}

/** A plinth that extends below a building into the slope, so it never floats. */
export function foundation(
  kit: Kit,
  w: number,
  d: number,
  depth: number,
  colour = "#9a8f80",
): THREE.Mesh {
  return box(kit, colour, [-w / 2, -depth, -d / 2], [w / 2, 0.05, d / 2]);
}

// ── NHAI-style signage ───────────────────────────────────────────────────────

export interface SignLine {
  /** Main English text (always present). */
  en: string;
  /** Optional local-script line shown above the English (bilingual, like real NHAI boards). */
  local?: string;
  /** Arrow: "left", "right", "up" (straight on), "up-left", "up-right", or none. */
  arrow?: "left" | "right" | "up" | "up-left" | "up-right";
  /** Distance in km, right-aligned. */
  km?: number;
}

const NHAI_GREEN = "#0b6b3a";

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  dir: NonNullable<SignLine["arrow"]>,
): void {
  const angle = {
    right: 0,
    "up-right": -Math.PI / 4,
    up: -Math.PI / 2,
    "up-left": (-3 * Math.PI) / 4,
    left: Math.PI,
  }[dir];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.12);
  ctx.lineTo(s * 0.1, -s * 0.12);
  ctx.lineTo(s * 0.1, -s * 0.38);
  ctx.lineTo(s * 0.6, 0);
  ctx.lineTo(s * 0.1, s * 0.38);
  ctx.lineTo(s * 0.1, s * 0.12);
  ctx.lineTo(-s * 0.55, s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Renders an NHAI-style green guide board face (white border, bilingual lines, arrows, km). */
export function nhaiBoardTexture(
  lines: SignLine[],
  width = 1024,
): { texture: THREE.CanvasTexture; aspect: number } {
  const rowH = 150;
  const pad = 48;
  const h = pad * 2 + lines.length * rowH;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = NHAI_GREEN;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, h, 36);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.roundRect(18, 18, width - 36, h - 36, 24);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    lines.forEach((l, i) => {
      const top = pad + i * rowH;
      const textX = l.arrow ? 170 : 64;
      if (l.arrow) drawArrow(ctx, 96, top + rowH / 2, 110, l.arrow);
      if (l.local) {
        ctx.font =
          "600 44px 'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Tamil', 'Noto Sans Kannada', 'Noto Sans Malayalam', 'Noto Sans Tibetan', sans-serif";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(l.local, textX, top + 58);
      }
      ctx.font = "700 58px 'Inter', 'Helvetica Neue', Arial, sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(l.en, textX, top + (l.local ? 122 : 98));
      if (l.km !== undefined) {
        ctx.textAlign = "right";
        ctx.fillText(`${l.km}`, width - 64, top + (l.local ? 122 : 98));
        ctx.textAlign = "left";
      }
    });
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: width / h };
}

/**
 * A roadside NHAI-style direction board on twin galvanised posts. `width` is
 * the board's world width; height follows its content. Face it along +z, then
 * rotate/place it with placeOnGround(…, { mode: "upright" }).
 */
export function nhaiSign(kit: Kit, lines: SignLine[], width = 3.2, clearance = 1.6): THREE.Group {
  const g = new THREE.Group();
  const { texture, aspect } = nhaiBoardTexture(lines);
  const h = width / aspect;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, h),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }),
  );
  face.position.set(0, clearance + h / 2, 0.06);
  face.castShadow = true;
  g.add(face);
  g.add(box(kit, "#5d6b62", [-width / 2, clearance, -0.04], [width / 2, clearance + h, 0.05]));
  for (const x of [-width * 0.32, width * 0.32])
    g.add(
      tube(kit, "#b8c0c6", [x, -0.3, -0.06], [x, clearance + h * 0.9, -0.06], 0.06, {
        metal: true,
      }),
    );
  return g;
}

/** An overhead NHAI gantry spanning the road (for expressway-like stretches and circuits). */
export function nhaiGantry(kit: Kit, lines: SignLine[], span = 9, clearance = 4.2): THREE.Group {
  const g = new THREE.Group();
  const { texture, aspect } = nhaiBoardTexture(lines, 1400);
  const w = Math.min(span * 0.7, 6.5);
  const h = w / aspect;
  for (const x of [-span / 2, span / 2])
    g.add(tube(kit, "#b8c0c6", [x, -0.3, 0], [x, clearance + h + 0.2, 0], 0.12, { metal: true }));
  g.add(
    tube(
      kit,
      "#b8c0c6",
      [-span / 2, clearance + h + 0.15, 0],
      [span / 2, clearance + h + 0.15, 0],
      0.1,
      { metal: true },
    ),
  );
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }),
  );
  face.position.set(0, clearance + h / 2, 0.08);
  g.add(face);
  g.add(box(kit, "#5d6b62", [-w / 2, clearance, -0.04], [w / 2, clearance + h, 0.07]));
  return g;
}

/** Indian kilometre stone: white body with a coloured cap (yellow = NH, green = SH), place name + km. */
export function kmStone(
  kit: Kit,
  place: string,
  km: number,
  cap: "nh" | "sh" | "district" = "nh",
): THREE.Group {
  const g = new THREE.Group();
  const capColour = cap === "nh" ? "#f2c14e" : cap === "sh" ? "#1f8a4c" : "#2b6cb0";
  g.add(box(kit, "#f5f5f2", [-0.22, 0, -0.1], [0.22, 0.5, 0.1]));
  const capMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.2, kit.seg(10, 24), 1, false, 0, Math.PI),
    kit.mat(capColour),
  );
  capMesh.rotation.z = Math.PI / 2;
  capMesh.rotation.y = Math.PI / 2;
  capMesh.position.y = 0.5;
  g.add(capMesh);
  const label = textSprite(`${place} ${km}`, "#1d1f24");
  label.position.set(0, 0.3, 0.12);
  label.scale.set(0.42, 0.21, 1);
  g.add(label);
  return g;
}
