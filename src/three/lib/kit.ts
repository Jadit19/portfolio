/**
 * Low-poly modelling kit. Every part is built from primitives so models are
 * original, tiny and recolourable. Two surface styles share one API:
 *  - "flat":   faceted, low segment counts, flat shading (classic low-poly)
 *  - "smooth": more segments, bevels, soft matte shading (toy / clay)
 *
 * Axes: x forward, y up, z lateral (right). Units are metres.
 */

import * as THREE from "three";

export type Surface = "flat" | "smooth";

/**
 * Global detail level for smooth geometry built from now on (1 = full).
 * Lowered while building things only ever seen small, e.g. the map-table
 * miniature, then restored.
 */
let DETAIL = 1;
export function setDetail(d: number): void {
  DETAIL = d;
}
export function detail(): number {
  return DETAIL;
}

export interface Kit {
  surface: Surface;
  mat(
    colour: string,
    opts?: { metal?: boolean; glass?: boolean; emissive?: boolean },
  ): THREE.Material;
  seg(flat: number, smooth: number): number;
}

export function makeKit(surface: Surface): Kit {
  const cache = new Map<string, THREE.Material>();
  return {
    surface,
    seg: (flat, smooth) =>
      surface === "flat" ? flat : Math.max(flat, Math.round(smooth * DETAIL)),
    mat(colour, opts = {}) {
      const key = `${colour}|${opts.metal ? 1 : 0}${opts.glass ? 1 : 0}${opts.emissive ? 1 : 0}`;
      const hit = cache.get(key);
      if (hit) return hit;
      let m: THREE.Material;
      if (opts.emissive) {
        m = new THREE.MeshBasicMaterial({ color: colour });
      } else if (surface === "flat") {
        m = new THREE.MeshLambertMaterial({
          color: colour,
          flatShading: true,
          transparent: Boolean(opts.glass),
          opacity: opts.glass ? 0.55 : 1,
        });
      } else {
        m = new THREE.MeshStandardMaterial({
          color: colour,
          roughness: opts.metal ? 0.32 : opts.glass ? 0.1 : 0.82,
          metalness: opts.metal ? 0.55 : 0,
          transparent: Boolean(opts.glass),
          opacity: opts.glass ? 0.55 : 1,
        });
      }
      cache.set(key, m);
      return m;
    },
  };
}

const shadowed = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
};

/** A box from min corner to max corner. */
export function box(
  kit: Kit,
  colour: string,
  min: [number, number, number],
  max: [number, number, number],
  opts?: Parameters<Kit["mat"]>[1],
): THREE.Mesh {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const g =
    kit.surface === "smooth"
      ? roundedBox(
          x1 - x0,
          y1 - y0,
          z1 - z0,
          Math.min(0.07, Math.min(x1 - x0, y1 - y0, z1 - z0) * 0.22),
        )
      : new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const m = new THREE.Mesh(g, kit.mat(colour, opts));
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return shadowed(m);
}

function roundedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  // The bevel grows the outline by r on every side, so start from a box inset by r.
  const iw = Math.max(0.001, w - r * 2);
  const ih = Math.max(0.001, h - r * 2);
  const shape = new THREE.Shape();
  shape.moveTo(-iw / 2, -ih / 2);
  shape.lineTo(iw / 2, -ih / 2);
  shape.lineTo(iw / 2, ih / 2);
  shape.lineTo(-iw / 2, ih / 2);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, d - r * 2),
    bevelEnabled: true,
    bevelSize: r,
    bevelThickness: r,
    bevelSegments: DETAIL < 1 ? 1 : 3,
    curveSegments: 1,
  });
  g.center();
  return g;
}

/**
 * Extrudes a side-view profile (x forward, y up) across the bike's width.
 * This is how tanks, fairings, seats and tails get distinct silhouettes.
 */
export function profile(
  kit: Kit,
  colour: string,
  points: [number, number][],
  width: number,
  z = 0,
  opts?: Parameters<Kit["mat"]>[1],
): THREE.Mesh {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const smooth = kit.surface === "smooth";
  const bevel = smooth ? Math.min(0.045, width * 0.3) : 0;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.005, width - bevel * 2),
    bevelEnabled: smooth,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: smooth ? (DETAIL < 1 ? 1 : 4) : 1,
    curveSegments: smooth ? Math.max(3, Math.round(12 * DETAIL)) : 2,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  const m = new THREE.Mesh(g, kit.mat(colour, opts));
  m.position.z = z;
  return shadowed(m);
}

/** A cylinder between two points. */
export function tube(
  kit: Kit,
  colour: string,
  a: [number, number, number],
  b: [number, number, number],
  radius: number,
  opts?: Parameters<Kit["mat"]>[1],
): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(radius, radius, len, kit.seg(6, 16));
  const m = new THREE.Mesh(g, kit.mat(colour, opts));
  m.position.copy(va.clone().add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return shadowed(m);
}

export function sphere(
  kit: Kit,
  colour: string,
  at: [number, number, number],
  r: number,
  opts?: Parameters<Kit["mat"]>[1],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, kit.seg(7, 24), kit.seg(5, 16));
  const m = new THREE.Mesh(g, kit.mat(colour, opts));
  m.position.set(...at);
  m.scale.set(...scale);
  return shadowed(m);
}

/** A disc facing sideways (axis = z), e.g. headlight lens or solid wheel. */
export function disc(
  kit: Kit,
  colour: string,
  at: [number, number, number],
  r: number,
  thickness: number,
  opts?: Parameters<Kit["mat"]>[1],
): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, thickness, kit.seg(10, 32));
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, kit.mat(colour, opts));
  m.position.set(...at);
  return shadowed(m);
}

export interface WheelSpec {
  r: number;
  /** Tyre section radius. */
  tyre: number;
  rim: string;
  kind: "spoke" | "cast" | "disc";
  knobby?: boolean;
}

/** A wheel centred at (x, r) rolling along x. */
export function wheel(kit: Kit, x: number, spec: WheelSpec): THREE.Group {
  const g = new THREE.Group();
  const tyreGeo = new THREE.TorusGeometry(
    spec.r - spec.tyre,
    spec.tyre,
    kit.seg(5, 12),
    kit.seg(14, 36),
  );
  const tyre = new THREE.Mesh(tyreGeo, kit.mat("#1c1d21"));
  g.add(tyre);
  if (spec.knobby) {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.035, spec.tyre * 2.1),
        kit.mat("#1c1d21"),
      );
      k.position.set(Math.cos(a) * spec.r, Math.sin(a) * spec.r, 0);
      k.rotation.z = a;
      g.add(k);
    }
  }
  const inner = spec.r - spec.tyre * 2;
  if (spec.kind === "disc") {
    g.add(disc(kit, spec.rim, [0, 0, 0], inner, spec.tyre * 1.6, { metal: true }));
  } else {
    const rimGeo = new THREE.TorusGeometry(inner, 0.016, 4, kit.seg(14, 36));
    g.add(new THREE.Mesh(rimGeo, kit.mat(spec.rim, { metal: true })));
    const spokes = spec.kind === "spoke" ? 12 : 5;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const len = inner;
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(len, spec.kind === "spoke" ? 0.008 : 0.03, 0.01),
        kit.mat(spec.rim, { metal: true }),
      );
      s.position.set((Math.cos(a) * len) / 2, (Math.sin(a) * len) / 2, 0);
      s.rotation.z = a;
      g.add(s);
    }
    g.add(disc(kit, "#9aa3ad", [0, 0, 0], 0.05, spec.tyre * 1.4, { metal: true }));
  }
  g.position.set(x, spec.r, 0);
  return shadowed(g);
}
