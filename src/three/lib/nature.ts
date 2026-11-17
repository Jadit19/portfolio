/**
 * Nature in the portfolio's toy language: each plant or rock is one bold,
 * deliberate shape, not a pile of parts. Canopies are chunky polygon prisms
 * (a few big flat faces) with rounded corners and the same soft bevel on every
 * edge, slightly tapered and sliced at the top; trunks are short and thick.
 * Small details come as scattered debris (a few fruit cubes, pebbles), never
 * as tiny parts glued on. Colours are baked into the vertices from the pastel
 * palette, so one material (and one instanced mesh) draws a whole species.
 *
 * Every geometry stands on y = 0 (its base) and faces nowhere in particular;
 * scale and turn it per instance.
 */

import * as THREE from "three";
import { PASTEL } from "./palette";

export type NatureKind =
  | "crown" // a broadleaf: mango, silver oak, apple, willow
  | "spire" // a conifer: deodar, pine
  | "column" // a poplar
  | "parasol" // a flat umbrella crown: khejri, acacia
  | "bush" // coffee, ber, scrub
  | "rock"
  | "tuft" // grass
  | "flowers";

export interface NatureOptions {
  /** Canopy (or body) colour. */
  colour?: string;
  /** A few fruit or flowers on it, in this colour. */
  fruit?: string;
  /** Shape variation (each seed is a slightly different individual). */
  seed?: number;
}

/** A small, fast, seeded random number generator (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PrismOptions {
  sides: number;
  radius: number;
  height: number;
  /** Top size relative to the bottom (1 = straight, < 1 narrows upward). */
  taper: number;
  /** How much the top is sliced on a slant (rise per metre across). */
  slant?: number;
  /** Corner rounding, as a fraction of the radius. */
  round?: number;
  /** The soft bevel on every edge (metres). */
  bevel?: number;
  /** Irregularity of the outline (0 = a perfect polygon). */
  jitter?: number;
  seed: number;
}

/**
 * The building block: a rounded polygon, extruded upward with a soft bevel,
 * tapered and sliced. Flat-shaded big faces with rounded corners and edges,
 * which catch the light as thin highlights.
 */
export function prism(o: PrismOptions): THREE.BufferGeometry {
  const r = seeded(o.seed);
  const jitter = o.jitter ?? 0.18;
  const corners: THREE.Vector2[] = [];
  const turn = r() * Math.PI * 2;
  for (let i = 0; i < o.sides; i++) {
    const a = turn + ((i + (r() - 0.5) * jitter) / o.sides) * Math.PI * 2;
    const rr = o.radius * (1 + (r() - 0.5) * jitter);
    corners.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
  }
  // Round each corner: line to just before it, curve through it.
  const cut = o.radius * (o.round ?? 0.16);
  const shape = new THREE.Shape();
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const p = corners[i] as THREE.Vector2;
    const prev = corners[(i - 1 + n) % n] as THREE.Vector2;
    const next = corners[(i + 1) % n] as THREE.Vector2;
    const a = p.clone().add(
      prev
        .clone()
        .sub(p)
        .setLength(Math.min(cut, prev.distanceTo(p) * 0.45)),
    );
    const b = p.clone().add(
      next
        .clone()
        .sub(p)
        .setLength(Math.min(cut, next.distanceTo(p) * 0.45)),
    );
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
  }
  shape.closePath();
  const bevel = o.bevel ?? 0.06;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, o.height - 2 * bevel),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  // Extruded along +z: stand it up (base at y = 0).
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const slant = o.slant ?? 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp(y / o.height, 0, 1);
    const s = 1 + (o.taper - 1) * t;
    const x = pos.getX(i) * s;
    const z = pos.getZ(i) * s;
    pos.setXYZ(i, x, y + slant * x * t * t, z);
  }
  geo.deleteAttribute("uv");
  geo.computeVertexNormals();
  return geo;
}

/** A short, thick trunk (smooth round sides). */
export function trunk(radius: number, height: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius * 0.88, radius, height, 10, 1);
  g.translate(0, height / 2, 0);
  const flat = g.toNonIndexed();
  g.dispose();
  flat.deleteAttribute("uv");
  return flat;
}

/** A rounded little cube (fruit, pebbles, flower heads). */
export function nub(size: number, seed: number): THREE.BufferGeometry {
  return prism({
    sides: 4,
    radius: size * 0.75,
    height: size,
    taper: 0.9,
    round: 0.35,
    bevel: size * 0.18,
    jitter: 0.1,
    seed,
  });
}

export function paint(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position?.count ?? 0;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Joins non-indexed geometries (position, normal, colour). */
export function join(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const keys = ["position", "normal", "color"] as const;
  const total = parts.reduce((s, g) => s + (g.attributes.position?.count ?? 0), 0);
  const out = new THREE.BufferGeometry();
  for (const k of keys) {
    const arr = new Float32Array(total * 3);
    let o = 0;
    for (const g of parts) {
      const a = g.attributes[k] as THREE.BufferAttribute;
      arr.set(a.array as Float32Array, o);
      o += a.count * 3;
    }
    out.setAttribute(k, new THREE.BufferAttribute(arr, 3));
  }
  for (const g of parts) g.dispose();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** Scatters `count` fruit nubs over a canopy's upper sides. */
function fruitOn(
  canopy: { radius: number; y0: number; height: number; taper: number },
  hex: string,
  count: number,
  r: () => number,
): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const t = 0.25 + r() * 0.55;
    const a = r() * Math.PI * 2;
    const rad = canopy.radius * (1 + (canopy.taper - 1) * t) * 0.98;
    const g = nub(0.13, Math.floor(r() * 1e6));
    g.rotateY(r() * Math.PI);
    g.translate(Math.cos(a) * rad, canopy.y0 + canopy.height * t, Math.sin(a) * rad);
    out.push(paint(g, hex));
  }
  return out;
}

/** One plant or rock, as a single geometry with its colours baked in. */
export function natureGeometry(kind: NatureKind, o: NatureOptions = {}): THREE.BufferGeometry {
  const seed = o.seed ?? 1;
  const r = seeded(seed * 7919 + 13);
  const leaf = o.colour ?? PASTEL.mint;
  const wood = PASTEL.clay;
  const parts: THREE.BufferGeometry[] = [];
  switch (kind) {
    case "crown": {
      const c = { radius: 0.62, y0: 0.42, height: 1.3, taper: 0.76 };
      parts.push(paint(trunk(0.16, 0.6), wood));
      const g = prism({
        sides: 5,
        radius: c.radius,
        height: c.height,
        taper: c.taper,
        slant: 0.22,
        seed,
      });
      g.translate(0, c.y0, 0);
      parts.push(paint(g, leaf));
      if (o.fruit) parts.push(...fruitOn(c, o.fruit, 5, r));
      break;
    }
    case "spire": {
      parts.push(paint(trunk(0.15, 0.5), wood));
      const g = prism({
        sides: 6,
        radius: 0.6,
        height: 2.4,
        taper: 0.2,
        slant: 0,
        round: 0.2,
        seed,
      });
      g.translate(0, 0.38, 0);
      parts.push(paint(g, leaf));
      break;
    }
    case "column": {
      parts.push(paint(trunk(0.12, 0.55), wood));
      const g = prism({
        sides: 4,
        radius: 0.4,
        height: 2.1,
        taper: 0.7,
        slant: 0.12,
        round: 0.3,
        seed,
      });
      g.translate(0, 0.45, 0);
      parts.push(paint(g, leaf));
      break;
    }
    case "parasol": {
      parts.push(paint(trunk(0.15, 1.35), wood));
      const low = prism({ sides: 7, radius: 1.05, height: 0.42, taper: 0.84, slant: 0.06, seed });
      low.translate(0, 1.25, 0);
      const top = prism({
        sides: 6,
        radius: 0.62,
        height: 0.3,
        taper: 0.8,
        slant: 0.08,
        seed: seed + 1,
      });
      top.translate(0.18, 1.62, -0.1);
      parts.push(paint(low, leaf), paint(top, leaf));
      break;
    }
    case "bush": {
      const c = { radius: 0.55, y0: 0, height: 0.62, taper: 0.72 };
      parts.push(
        paint(
          prism({
            sides: 6,
            radius: c.radius,
            height: c.height,
            taper: c.taper,
            slant: 0.12,
            round: 0.22,
            seed,
          }),
          leaf,
        ),
      );
      if (o.fruit) parts.push(...fruitOn(c, o.fruit, 4, r));
      break;
    }
    case "rock": {
      parts.push(
        paint(
          prism({
            sides: 5,
            radius: 0.55,
            height: 0.5,
            taper: 0.42,
            slant: 0.28,
            round: 0.12,
            bevel: 0.05,
            jitter: 0.3,
            seed,
          }),
          o.colour ?? PASTEL.stone,
        ),
      );
      // A couple of pebbles at its foot.
      for (let i = 0; i < 2; i++) {
        const a = r() * Math.PI * 2;
        const g = nub(0.09 + r() * 0.05, seed + 31 * (i + 1));
        g.translate(Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72);
        parts.push(paint(g, o.colour ?? PASTEL.stone));
      }
      break;
    }
    case "tuft": {
      for (let i = 0; i < 3; i++) {
        const g = prism({
          sides: 3,
          radius: 0.07,
          height: 0.32 + r() * 0.12,
          taper: 0.15,
          round: 0.3,
          bevel: 0.015,
          jitter: 0.1,
          seed: seed + i,
        });
        g.rotateZ((r() - 0.5) * 0.5);
        g.rotateX((r() - 0.5) * 0.5);
        g.translate((i - 1) * 0.07, 0, (r() - 0.5) * 0.08);
        parts.push(paint(g, leaf));
      }
      break;
    }
    case "flowers": {
      const pad = prism({ sides: 6, radius: 0.22, height: 0.12, taper: 0.8, seed });
      parts.push(paint(pad, PASTEL.fern));
      const heads = [o.fruit ?? PASTEL.rose, PASTEL.marigold, PASTEL.lavender];
      heads.forEach((hex, i) => {
        const g = nub(0.1, seed + i);
        const a = (i / 3) * Math.PI * 2 + r();
        g.translate(Math.cos(a) * 0.1, 0.1 + r() * 0.06, Math.sin(a) * 0.1);
        parts.push(paint(g, hex));
      });
      break;
    }
  }
  return join(parts);
}
