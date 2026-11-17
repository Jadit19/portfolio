/**
 * Hero (close-up) bikes. The light models in bikes.ts are fine at journey
 * distance; these are for the garage, the map table and stop cards.
 *
 * Every bike is built from a few anchors (axles, swingarm pivot, steering
 * head), and the frame, forks, swingarm, shocks, chain and exhaust are swept
 * between them, so parts always meet. Bodywork is lofted: rounded
 * superellipse cross-sections swept along x, with domed ends, so there are
 * no slab sides and no hard edges.
 *
 * Axes: x forward, y up, z lateral (+z = right side). Units ≈ metres.
 */

import * as THREE from "three";
import type { BikeKind } from "../../content/types";
import type { Kit } from "./kit";

type V3 = [number, number, number];
type V2 = [number, number];
type MatOpts = { metal?: boolean; glass?: boolean; emissive?: boolean; rough?: number };

const BLACK = "#1d1e22";
const TYRE = "#1a1b1f";
const CHROME = "#d4d9de";
const ALU = "#b7bec6";
const DARK = "#34373d";
const LAMP = "#fff4cf";
const TAIL = "#e0332b";
const AMBER = "#ffae3b";

// ── materials ──────────────────────────────────────────────────────────────
const mats = new Map<string, THREE.Material>();
function mat(colour: string, o: MatOpts = {}): THREE.Material {
  const key = `${colour}|${o.metal ? 1 : 0}${o.glass ? 1 : 0}${o.emissive ? 1 : 0}|${o.rough ?? ""}`;
  const hit = mats.get(key);
  if (hit) return hit;
  const m = o.emissive
    ? new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({
        color: colour,
        roughness: o.rough ?? (o.metal ? 0.28 : o.glass ? 0.08 : 0.62),
        metalness: o.metal ? 0.7 : 0,
        transparent: Boolean(o.glass),
        opacity: o.glass ? 0.5 : 1,
        side: THREE.DoubleSide,
      });
  mats.set(key, m);
  return m;
}

function mesh(geo: THREE.BufferGeometry, colour: string, o?: MatOpts): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(colour, o));
  m.castShadow = !o?.glass;
  m.receiveShadow = true;
  return m;
}

const v = (p: V3 | V2) => new THREE.Vector3(p[0], p[1], p[2] ?? 0);

/** Radial segments that scale with size: tiny parts get few sides, big ones stay round. */
const radial = (r: number, max = 28) => Math.max(6, Math.min(max, Math.round(r * 420)));

// ── primitives ─────────────────────────────────────────────────────────────

/** A smooth tube through points (Catmull-Rom) with ball ends, so joints read as welded. */
export function pipe(
  points: (V3 | V2)[],
  r: number,
  colour: string,
  o?: MatOpts & { caps?: boolean; closed?: boolean },
): THREE.Group {
  const g = new THREE.Group();
  const pts = points.map(v);
  const curve = new THREE.CatmullRomCurve3(pts, Boolean(o?.closed), "centripetal");
  const segs = Math.max(6, pts.length * 14);
  g.add(mesh(new THREE.TubeGeometry(curve, segs, r, radial(r, 14), Boolean(o?.closed)), colour, o));
  if (o?.caps !== false && !o?.closed)
    for (const p of [pts[0], pts[pts.length - 1]]) {
      if (!p) continue;
      const s = mesh(
        new THREE.SphereGeometry(r, radial(r, 14), Math.max(4, radial(r, 10) - 2)),
        colour,
        o,
      );
      s.position.copy(p);
      g.add(s);
    }
  return g;
}

/** Mirrors a path to both sides (z = ±half). */
function both(points: V2[], half: number, r: number, colour: string, o?: MatOpts): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1])
    g.add(
      pipe(
        points.map(([x, y]) => [x, y, s * half] as V3),
        r,
        colour,
        o,
      ),
    );
  return g;
}

/** Section: [x, top y, bottom y, half width]. */
export type Sec = [number, number, number, number];

/**
 * Lofted body: superellipse cross-sections (exponent n: 2 = ellipse, 3–4 =
 * soft squircle) swept along x through Catmull-Rom-smoothed sections, with
 * domed caps at both ends.
 */
export function loft(
  secs: Sec[],
  colour: string,
  o?: MatOpts & { n?: number; cap?: number; z?: number; steps?: number },
): THREE.Mesh {
  const n = o?.n ?? 2.6;
  const ring = 32;
  const steps = o?.steps ?? Math.max(16, secs.length * 10);
  const A = new THREE.CatmullRomCurve3(
    secs.map(([x, t, b]) => new THREE.Vector3(x, t, b)),
    false,
    "catmullrom",
    0.5,
  );
  const B = new THREE.CatmullRomCurve3(
    secs.map(([x, , , w]) => new THREE.Vector3(x, w, 0)),
    false,
    "catmullrom",
    0.5,
  );
  const rows: { x: number; yc: number; ry: number; w: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = A.getPoint(i / steps);
    const q = B.getPoint(i / steps);
    rows.push({
      x: p.x,
      yc: (p.y + p.z) / 2,
      ry: Math.max(0.002, (p.y - p.z) / 2),
      w: Math.max(0.002, q.y),
    });
  }
  // Domed caps.
  const capK = o?.cap ?? 0.9;
  const dome = (r: (typeof rows)[number], dir: number) => {
    const L = Math.min(r.ry, r.w) * capK;
    const out: typeof rows = [];
    for (let k = 1; k <= 6; k++) {
      const phi = (k / 6) * (Math.PI / 2);
      const s = Math.cos(phi);
      out.push({ x: r.x + dir * L * Math.sin(phi), yc: r.yc, ry: r.ry * s, w: r.w * s });
    }
    return out;
  };
  const first = rows[0] as (typeof rows)[number];
  const lastRow = rows[rows.length - 1] as (typeof rows)[number];
  const all = [...dome(first, -1).reverse(), ...rows, ...dome(lastRow, 1)];
  const pos: number[] = [];
  const pw = 2 / n;
  for (const r of all)
    for (let j = 0; j < ring; j++) {
      const th = (j / ring) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      pos.push(
        r.x,
        r.yc + r.ry * Math.sign(s) * Math.abs(s) ** pw,
        r.w * Math.sign(c) * Math.abs(c) ** pw,
      );
    }
  const idx: number[] = [];
  for (let i = 0; i < all.length - 1; i++)
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j;
      const b = (i + 1) * ring + j;
      const c = i * ring + ((j + 1) % ring);
      const d = (i + 1) * ring + ((j + 1) % ring);
      idx.push(a, b, c, b, d, c);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = mesh(geo, colour, o);
  m.position.z = o?.z ?? 0;
  return m;
}

/** A lathe (revolved profile [radius, axial]) whose axis is z (sideways) or x (forward). */
export function lathe(
  profile: V2[],
  colour: string,
  o?: MatOpts & { axis?: "z" | "x" | "y"; seg?: number },
): THREE.Mesh {
  const geo = new THREE.LatheGeometry(
    profile.map(([r, a]) => new THREE.Vector2(r, a)),
    o?.seg ?? 40,
  );
  if (o?.axis === "x") geo.rotateZ(-Math.PI / 2);
  else if (o?.axis !== "y") geo.rotateX(Math.PI / 2);
  return mesh(geo, colour, o);
}

/** A rounded-edge cylinder between two points. */
export function cyl(a: V3, b: V3, r: number, colour: string, o?: MatOpts): THREE.Mesh {
  const va = v(a);
  const vb = v(b);
  const len = va.distanceTo(vb);
  const e = Math.min(r * 0.25, len * 0.25);
  const m = lathe(
    [
      [0, -len / 2],
      [r - e, -len / 2],
      [r - e * 0.3, -len / 2 + e * 0.3],
      [r, -len / 2 + e],
      [r, len / 2 - e],
      [r - e * 0.3, len / 2 - e * 0.3],
      [r - e, len / 2],
      [0, len / 2],
    ],
    colour,
    { ...o, axis: "y", seg: radial(r) },
  );
  m.position.copy(va.clone().add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

export function ball(
  at: V3,
  r: number,
  colour: string,
  o?: MatOpts,
  scale: V3 = [1, 1, 1],
): THREE.Mesh {
  const m = mesh(
    new THREE.SphereGeometry(r, radial(r, 24), Math.max(5, Math.round(radial(r, 24) * 0.66))),
    colour,
    o,
  );
  m.position.set(...at);
  m.scale.set(...scale);
  return m;
}

/** A soft rounded block (min → max corners). */
export function block(min: V3, max: V3, colour: string, o?: MatOpts & { r?: number }): THREE.Mesh {
  const w = max[0] - min[0];
  const h = max[1] - min[1];
  const d = max[2] - min[2];
  const r = o?.r ?? Math.min(w, h, d) * 0.35;
  const shape = new THREE.Shape();
  const iw = Math.max(0.001, w - 2 * r);
  const ih = Math.max(0.001, h - 2 * r);
  shape.moveTo(-iw / 2, -ih / 2);
  shape.lineTo(iw / 2, -ih / 2);
  shape.lineTo(iw / 2, ih / 2);
  shape.lineTo(-iw / 2, ih / 2);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, d - 2 * r),
    bevelEnabled: true,
    bevelSize: r,
    bevelThickness: r,
    bevelSegments: r < 0.012 ? 1 : r < 0.03 ? 2 : 4,
    curveSegments: 1,
  });
  geo.center();
  geo.computeVertexNormals();
  const m = mesh(geo, colour, o);
  m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return m;
}

/** Cooling fins: a stack of thin rounded discs between two points. */
function fins(a: V3, b: V3, r: number, colour: string, count: number, o?: MatOpts): THREE.Group {
  const g = new THREE.Group();
  const va = v(a);
  const vb = v(b);
  g.add(cyl(a, b, r * 0.72, DARK));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const p = va.clone().lerp(vb, t);
    const len = va.distanceTo(vb) / count;
    const d = vb
      .clone()
      .sub(va)
      .normalize()
      .multiplyScalar(len * 0.28);
    g.add(
      cyl(
        p.clone().sub(d).toArray() as V3,
        p.clone().add(d).toArray() as V3,
        r * (1 - 0.06 * Math.abs(t - 0.4)),
        colour,
        o,
      ),
    );
  }
  return g;
}

/** A coil-over shock: body, eye mounts and a real helix spring. */
function shock(a: V3, b: V3, spring: string, r = 0.035): THREE.Group {
  const g = new THREE.Group();
  const va = v(a);
  const vb = v(b);
  g.add(cyl(a, b, r * 0.45, CHROME, { metal: true }));
  g.add(cyl(a, va.clone().lerp(vb, 0.45).toArray() as V3, r * 0.7, DARK));
  const axis = vb.clone().sub(va);
  const len = axis.length();
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    axis.clone().normalize(),
  );
  const pts: THREE.Vector3[] = [];
  const turns = 7;
  for (let i = 0; i <= turns * 16; i++) {
    const t = i / (turns * 16);
    const th = t * turns * Math.PI * 2;
    pts.push(
      new THREE.Vector3(Math.cos(th) * r, len * (0.18 + 0.7 * t), Math.sin(th) * r)
        .applyQuaternion(q)
        .add(va),
    );
  }
  g.add(
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, r * 0.2, 8), spring, {
      rough: 0.4,
    }),
  );
  for (const p of [va, vb]) g.add(ball(p.toArray() as V3, r * 0.75, DARK));
  return g;
}

/** Fender: an arc of a flattened torus hugging a wheel. Angles in radians, 0 = forward. */
function fender(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  half: number,
  colour: string,
  o?: MatOpts,
): THREE.Mesh {
  const geo = new THREE.TorusGeometry(r, 0.022, 10, 48, a1 - a0);
  geo.scale(1, 1, half / 0.022);
  geo.rotateZ(a0);
  const m = mesh(geo, colour, o);
  m.position.set(cx, cy, 0);
  return m;
}

// ── wheels ─────────────────────────────────────────────────────────────────

interface WheelOpts {
  r: number;
  tyre: number;
  rim: string;
  kind: "spoke" | "cast" | "solid";
  knobby?: boolean;
  /** Dual-purpose tread: small, low blocks. */
  dual?: boolean;
  /** Cast wheels: spoke count (straight spokes when ≥ 8). */
  spokes?: number;
  /** Drilled rotors. */
  drilled?: boolean;
  disc?: number; // rotor radius (0 = none)
  twin?: boolean; // rotors both sides
  hub?: string;
}

function heroWheel(x: number, w: WheelOpts): THREE.Group {
  const g = new THREE.Group();
  const width = w.tyre * 1.15;
  // Tyre: a rounded lathe profile (crown, shoulders, sidewalls).
  const ri = w.r - w.tyre * 2;
  const prof: V2[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = -Math.PI / 2 + (i / 20) * Math.PI;
    prof.push([ri + w.tyre + Math.cos(a) * w.tyre * 1.0, Math.sin(a) * width]);
  }
  g.add(lathe(prof, TYRE, { axis: "z", seg: 48, rough: 0.9 }));
  if (w.knobby || w.dual) {
    const n = w.dual ? 34 : 26;
    const ks = w.dual ? 0.6 : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (const side of [-1, 1]) {
        const k = block(
          [-0.02 * ks, -0.012 * ks, -0.022 * ks],
          [0.02 * ks, 0.012 * ks, 0.022 * ks],
          TYRE,
          { r: 0.008 * ks, rough: 0.9 },
        );
        const rr = w.r - 0.004 - (w.dual ? 0.004 : 0);
        const za = side * width * 0.5 + (i % 2 ? 0.01 : -0.01);
        k.position.set(Math.cos(a) * rr, Math.sin(a) * rr, za);
        k.rotation.z = a + Math.PI / 2;
        g.add(k);
      }
    }
  }
  // Rim.
  const rimR = ri;
  g.add(
    lathe(
      [
        [rimR - 0.012, -width * 0.62],
        [rimR + 0.006, -width * 0.66],
        [rimR + 0.004, -width * 0.5],
        [rimR - 0.004, 0],
        [rimR + 0.004, width * 0.5],
        [rimR + 0.006, width * 0.66],
        [rimR - 0.012, width * 0.62],
      ],
      w.rim,
      { axis: "z", seg: 48, metal: w.rim === CHROME || w.rim === ALU },
    ),
  );
  const hubR = w.kind === "solid" ? rimR - 0.01 : 0.05;
  const hubW = w.tyre * 0.9;
  if (w.kind === "solid") {
    g.add(
      lathe(
        [
          [0, -hubW],
          [hubR * 0.3, -hubW],
          [hubR * 0.6, -hubW * 0.8],
          [hubR, -hubW * 0.55],
          [hubR, hubW * 0.55],
          [hubR * 0.6, hubW * 0.8],
          [hubR * 0.3, hubW],
          [0, hubW],
        ],
        w.rim,
        { axis: "z", metal: true },
      ),
    );
  } else if (w.kind === "spoke") {
    const n = 18;
    for (let i = 0; i < n * 2; i++) {
      const side = i % 2 ? 1 : -1;
      const a = (i / (n * 2)) * Math.PI * 2;
      const a2 = a + side * 0.35;
      g.add(
        cyl(
          [Math.cos(a) * hubR * 0.85, Math.sin(a) * hubR * 0.85, side * hubW * 0.7],
          [Math.cos(a2) * (rimR - 0.004), Math.sin(a2) * (rimR - 0.004), side * 0.006],
          0.0035,
          w.hub === undefined ? CHROME : CHROME,
          { metal: true },
        ),
      );
    }
  } else {
    // Cast: five or six gently curved split spokes.
    const n = w.spokes ?? 5;
    for (let i = 0; i < n; i++) {
      for (const off of n >= 8 ? [0.05] : [-0.16, 0.16]) {
        const a = (i / n) * Math.PI * 2;
        const pts: V3[] = [
          [Math.cos(a) * hubR, Math.sin(a) * hubR, 0],
          [Math.cos(a + off * 0.4) * rimR * 0.55, Math.sin(a + off * 0.4) * rimR * 0.55, 0],
          [Math.cos(a + off) * (rimR - 0.004), Math.sin(a + off) * (rimR - 0.004), 0],
        ];
        g.add(pipe(pts, 0.011, w.rim, { metal: w.rim === ALU }));
      }
    }
  }
  if (w.kind !== "solid")
    g.add(
      lathe(
        [
          [0.012, -hubW],
          [hubR * 0.7, -hubW],
          [hubR, -hubW * 0.6],
          [hubR, hubW * 0.6],
          [hubR * 0.7, hubW],
          [0.012, hubW],
        ],
        w.hub ?? ALU,
        { axis: "z", metal: true },
      ),
    );
  // Brake rotors.
  if (w.disc)
    for (const side of w.twin ? [-1, 1] : [1]) {
      const z = side * (hubW + 0.012);
      const rotor = lathe(
        [
          [w.disc * 0.62, z - 0.003],
          [w.disc, z - 0.003],
          [w.disc, z + 0.003],
          [w.disc * 0.62, z + 0.003],
        ],
        "#9ea4ab",
        { axis: "y", metal: true },
      );
      rotor.geometry.rotateX(Math.PI / 2);
      g.add(rotor);
      if (w.drilled)
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const rr = w.disc * (i % 2 ? 0.74 : 0.86);
          g.add(
            cyl(
              [Math.cos(a) * rr, Math.sin(a) * rr, z - 0.0045 * side],
              [Math.cos(a) * rr, Math.sin(a) * rr, z + 0.0045 * side],
              0.006,
              DARK,
            ),
          );
        }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(
          cyl(
            [Math.cos(a) * w.disc * 0.62, Math.sin(a) * w.disc * 0.62, z],
            [Math.cos(a) * hubR * 0.6, Math.sin(a) * hubR * 0.6, z],
            0.006,
            DARK,
          ),
        );
      }
    }
  g.position.set(x, w.r, 0);
  g.userData.wheelRadius = w.r;
  return g;
}

/** Brake caliper hugging a rotor at angle a (radians, 0 = forward). */
function caliper(
  wx: number,
  wr: number,
  rotor: number,
  a: number,
  z: number,
  colour: string,
): THREE.Mesh {
  const c = block([-0.035, -0.022, -0.02], [0.035, 0.022, 0.02], colour, { r: 0.012 });
  c.position.set(wx + Math.cos(a) * rotor * 0.86, wr + Math.sin(a) * rotor * 0.86, z);
  c.rotation.z = a + Math.PI / 2;
  return c;
}

// ── chassis ────────────────────────────────────────────────────────────────

interface Front {
  /** Front axle x and wheel radius. */
  x: number;
  r: number;
  rake: number; // degrees from vertical
  lo: number; // bottom clamp height
  hi: number; // top clamp height
  gap: number; // fork leg half-spacing (z)
  leg: number; // fork tube radius
  stanchion: string;
  lower: string;
  usd?: boolean;
  gaiter?: boolean;
}

interface Head {
  /** Steering head bottom / top (behind the fork line). */
  h0: THREE.Vector3;
  h1: THREE.Vector3;
  /** Top clamp centre. */
  top: THREE.Vector3;
  /** Unit vector up the fork. */
  d: THREE.Vector3;
  /** Unit vector forward, perpendicular to the fork. */
  fwd: THREE.Vector3;
}

function frontEnd(g: THREE.Group, f: Front, clamp = BLACK): Head {
  const rk = (f.rake * Math.PI) / 180;
  const d = new THREE.Vector3(-Math.sin(rk), Math.cos(rk), 0);
  const fwd = new THREE.Vector3(Math.cos(rk), Math.sin(rk), 0);
  const axle = new THREE.Vector3(f.x, f.r, 0);
  const at = (y: number) => axle.clone().add(d.clone().multiplyScalar((y - f.r) / d.y));
  const lo = at(f.lo);
  const hi = at(f.hi);
  const top = at(f.hi + 0.03);
  const mid = at(f.r + (f.lo - f.r) * 0.48);
  for (const s of [-1, 1]) {
    const z = s * f.gap;
    const A: V3 = [axle.x, axle.y, z];
    const M: V3 = [mid.x, mid.y, z];
    const T: V3 = [top.x, top.y, z];
    if (f.usd) {
      g.add(cyl(A, M, f.leg * 0.8, f.stanchion, { metal: true }));
      g.add(cyl(M, T, f.leg * 1.12, f.lower));
    } else {
      g.add(cyl(A, M, f.leg * 1.15, f.lower, { metal: f.lower === ALU || f.lower === CHROME }));
      if (f.gaiter) {
        const ga = mid.clone().add(d.clone().multiplyScalar(0.01));
        const gb = mid.clone().add(d.clone().multiplyScalar(0.16));
        g.add(fins([ga.x, ga.y, z], [gb.x, gb.y, z], f.leg * 1.25, BLACK, 7));
      }
      g.add(cyl(M, T, f.leg, f.stanchion, { metal: true }));
    }
    g.add(ball(A, f.leg * 0.9, DARK));
  }
  // Axle and clamps.
  g.add(
    cyl([axle.x, axle.y, -f.gap - 0.02], [axle.x, axle.y, f.gap + 0.02], 0.012, ALU, {
      metal: true,
    }),
  );
  const back = fwd.clone().multiplyScalar(-0.065);
  const h0 = lo.clone().add(back);
  const h1 = hi.clone().add(back);
  for (const c of [lo, hi]) {
    const cl = block(
      [-0.04, -0.016, -f.gap - f.leg * 1.4],
      [0.04, 0.016, f.gap + f.leg * 1.4],
      clamp,
      { r: 0.012, metal: clamp === ALU },
    );
    cl.position.set(c.x - 0.03, c.y, 0);
    cl.rotation.z = -(f.rake * Math.PI) / 180;
    g.add(cl);
  }
  g.add(
    cyl(
      h0.toArray() as V3,
      h1.clone().add(d.clone().multiplyScalar(0.02)).toArray() as V3,
      0.04,
      BLACK,
    ),
  );
  return { h0, h1, top, d, fwd };
}

/** Handlebar: from the top clamp up risers to the grips. Shape = [rise, sweep back, half width, drop at ends]. */
function handlebar(
  g: THREE.Group,
  h: Head,
  rise: number,
  back: number,
  half: number,
  drop: number,
  colour = BLACK,
): V3[] {
  const c = h.top;
  const base: V3 = [c.x - 0.01, c.y + rise, 0];
  const ends: V3[] = [];
  for (const s of [-1, 1]) {
    g.add(cyl([c.x, c.y, s * 0.04], [base[0], base[1], s * 0.04], 0.014, colour));
    const end: V3 = [base[0] - back, base[1] - drop, s * half];
    ends.push(end);
    g.add(
      cyl(
        [end[0], end[1], s * (half - 0.11)],
        [end[0] - 0.005, end[1], s * (half + 0.01)],
        0.02,
        TYRE,
        { rough: 0.9 },
      ),
    );
    // brake / clutch levers
    g.add(
      pipe(
        [
          [end[0] + 0.01, end[1], s * (half - 0.12)],
          [end[0] + 0.07, end[1] - 0.01, s * (half - 0.06)],
          [end[0] + 0.06, end[1] - 0.02, s * (half - 0.01)],
        ],
        0.006,
        ALU,
        { metal: true },
      ),
    );
  }
  const [e0, e1] = ends as [V3, V3];
  g.add(
    pipe(
      [
        [e0[0], e0[1], -half + 0.06],
        [base[0] - back * 0.4, base[1] - drop * 0.2, -half * 0.55],
        [base[0], base[1], 0],
        [base[0] - back * 0.4, base[1] - drop * 0.2, half * 0.55],
        [e1[0], e1[1], half - 0.06],
      ],
      0.013,
      colour,
      { metal: colour === CHROME },
    ),
  );
  return ends;
}

function mirrors(g: THREE.Group, ends: V3[], tall = 0.22, colour = BLACK): void {
  for (const e of ends) {
    const s = Math.sign(e[2]);
    const a: V3 = [e[0] + 0.02, e[1] + 0.01, e[2] - s * 0.1];
    const b: V3 = [a[0] - 0.02, a[1] + tall, a[2] + s * 0.07];
    g.add(pipe([a, [a[0] + 0.01, a[1] + tall * 0.55, a[2] + s * 0.03], b], 0.006, colour));
    g.add(ball(b, 0.05, colour, undefined, [0.35, 0.75, 1]));
  }
}

/** Round headlamp: deep bucket + chrome bezel + glowing lens, facing forward. */
function headlamp(
  g: THREE.Group,
  at: V3,
  r: number,
  bucket: string,
  bezel = CHROME,
  ring = false,
): void {
  const L = r * 1.1;
  const buck = lathe(
    [
      [0.001, -L],
      [r * 0.55, -L * 0.92],
      [r * 0.92, -L * 0.45],
      [r, 0],
    ],
    bucket,
    { axis: "x" },
  );
  buck.position.set(...at);
  g.add(buck);
  const bz = lathe(
    [
      [r * 0.98, -0.004],
      [r * 1.06, 0.006],
      [r * 1.02, 0.018],
      [r * 0.86, 0.02],
    ],
    bezel,
    { axis: "x", metal: true },
  );
  bz.position.set(...at);
  g.add(bz);
  const lens = mesh(
    new THREE.SphereGeometry(r * 0.88, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.32),
    LAMP,
    { emissive: true },
  );
  lens.geometry.rotateZ(-Math.PI / 2);
  lens.scale.set(0.6, 1, 1);
  lens.position.set(at[0] - r * 0.42, at[1], at[2]);
  g.add(lens);
  if (ring) {
    const t = mesh(new THREE.TorusGeometry(r * 0.62, r * 0.05, 8, 40), "#ffffff", {
      emissive: true,
    });
    t.rotation.y = Math.PI / 2;
    t.position.set(at[0] + 0.02, at[1], at[2]);
    g.add(t);
  }
}

function tailLight(g: THREE.Group, at: V3, w = 0.05): void {
  g.add(ball(at, w, TAIL, { emissive: true }, [0.5, 0.55, 1.2]));
  for (const s of [-1, 1]) {
    const p: V3 = [at[0] + 0.03, at[1] - 0.03, s * 0.1];
    g.add(cyl([at[0] + 0.03, p[1], s * 0.03], p, 0.006, BLACK));
    g.add(ball(p, 0.018, AMBER, { emissive: true }, [1.4, 0.9, 0.9]));
  }
}

function plate(g: THREE.Group, at: V3, angle = 0.25): void {
  const p = block([-0.006, -0.055, -0.1], [0.006, 0.055, 0.1], "#f1eee6", { r: 0.005 });
  p.position.set(...at);
  p.rotation.z = angle;
  g.add(p);
}

/** A flat painted decal (race number) on a side panel; faces +z (side = 1) or −z (side = −1). */
function decal(
  g: THREE.Group,
  text: string,
  at: V3,
  size: number,
  side: number,
  colour = "#ffffff",
): void {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const x = c.getContext("2d");
  if (x) {
    x.fillStyle = colour;
    x.font = "italic 900 190px Outfit, Inter, sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(text, 128, 140);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      map: t,
      transparent: true,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  m.position.set(...at);
  if (side < 0) m.rotation.y = Math.PI;
  g.add(m);
}

/** Chain loop on the left side (−z) from the gearbox sprocket to the rear sprocket. */
function chain(
  g: THREE.Group,
  front: V2,
  fr: number,
  rear: V2,
  rr: number,
  z = -0.11,
  colour = "#2a2b2f",
): void {
  const pts: V3[] = [];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 + (i / 11) * Math.PI;
    pts.push([rear[0] + Math.cos(a) * rr, rear[1] + Math.sin(a) * rr, z]);
  }
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 9) * Math.PI;
    pts.push([front[0] + Math.cos(a) * fr, front[1] + Math.sin(a) * fr, z]);
  }
  g.add(pipe(pts, 0.008, colour, { closed: true, metal: true }));
  const sp = lathe(
    [
      [0.01, -0.004],
      [rr, -0.004],
      [rr, 0.004],
      [0.01, 0.004],
    ],
    "#8d939a",
    { axis: "z", metal: true },
  );
  sp.position.set(rear[0], rear[1], z);
  g.add(sp);
}

function swingarm(
  g: THREE.Group,
  pivot: V2,
  axleX: number,
  axleY: number,
  half: number,
  colour: string,
  r = 0.026,
  o?: MatOpts,
): void {
  g.add(
    both(
      [pivot, [(pivot[0] + axleX) / 2, (pivot[1] + axleY) / 2 + 0.015], [axleX, axleY]],
      half,
      r,
      colour,
      o,
    ),
  );
  g.add(
    cyl(
      [pivot[0], pivot[1], -half - 0.015],
      [pivot[0], pivot[1], half + 0.015],
      r * 0.9,
      colour,
      o,
    ),
  );
  g.add(
    cyl([axleX, axleY, -half - 0.02], [axleX, axleY, half + 0.02], 0.012, ALU, { metal: true }),
  );
}

function pegs(g: THREE.Group, at: V2, half = 0.17): void {
  for (const s of [-1, 1]) {
    g.add(cyl([at[0], at[1], s * (half - 0.07)], [at[0], at[1], s * half], 0.014, DARK));
    g.add(
      cyl(
        [at[0] + 0.02, at[1] + 0.02, s * (half - 0.09)],
        [at[0] - 0.03, at[1] - 0.005, s * (half - 0.08)],
        0.012,
        BLACK,
      ),
    );
  }
}

/** Single muffler: a lofted can along +x from `at`, pitched by `pitch` radians. */
function can(
  g: THREE.Group,
  at: V3,
  len: number,
  r: number,
  pitch: number,
  colour: string,
  tip = CHROME,
): void {
  const m = loft(
    [
      [0, r * 0.75, -r * 0.75, r * 0.75],
      [len * 0.15, r, -r, r],
      [len * 0.85, r, -r, r],
      [len, r * 0.9, -r * 0.9, r * 0.9],
    ],
    colour,
    { n: 2, cap: 0.35, metal: colour === CHROME },
  );
  const grp = new THREE.Group();
  grp.add(m);
  const end = cyl([-0.02, 0, 0], [0.01, 0, 0], r * 0.55, tip, { metal: true });
  end.position.x -= 0.0;
  grp.add(end);
  grp.position.set(...at);
  grp.rotation.z = Math.PI - pitch;
  g.add(grp);
}

/** Side stand (−z side): foot on the ground. */
function sideStand(g: THREE.Group, at: V2): void {
  // Tagged so a bike being ridden can fold its stand away.
  const leg = pipe(
    [
      [at[0], at[1], -0.12],
      [at[0] - 0.12, 0.12, -0.2],
      [at[0] - 0.18, 0.012, -0.24],
    ],
    0.012,
    BLACK,
  );
  const foot = block([at[0] - 0.22, 0, -0.27], [at[0] - 0.14, 0.014, -0.21], BLACK, { r: 0.006 });
  leg.userData.stand = true;
  foot.userData.stand = true;
  g.add(leg, foot);
}

// ── the seven hero bikes ───────────────────────────────────────────────────

type Build = (g: THREE.Group) => void;

const HERO: Record<BikeKind, Build> = {
  /** Murphy: Royal Enfield Guerrilla 450, silver. Neo-retro roadster, single cylinder. */
  classic(g) {
    // Modelled on Adit's own bike (photo, Nov 2026): silver tank and side cover,
    // gaitered forks, short silver front fender with a black flap, knuckle
    // guards, stepped two-up seat, black rear rack with a blue strap, angled
    // plate hugger, heat-bronzed header into a short champagne muffler, black
    // ten-spoke cast wheels, drilled discs, and a marigold garland at the bars.
    const S = "#c9ced4";
    const S2 = "#8a929b";
    const RW = 0.31;
    const BRONZE = "#8a6a4a";
    const CHAMPAGNE = "#a8977c";
    g.add(
      heroWheel(-0.7, {
        r: RW,
        tyre: 0.072,
        rim: BLACK,
        kind: "cast",
        spokes: 10,
        dual: true,
        disc: 0.12,
        drilled: true,
        hub: DARK,
      }),
    );
    g.add(
      heroWheel(0.72, {
        r: RW,
        tyre: 0.062,
        rim: BLACK,
        kind: "cast",
        spokes: 10,
        dual: true,
        disc: 0.16,
        drilled: true,
        hub: DARK,
      }),
    );
    g.add(caliper(0.72, RW, 0.16, 2.3, 0.07, DARK));
    g.add(caliper(-0.7, RW, 0.12, 0.6, 0.07, DARK));
    const h = frontEnd(g, {
      x: 0.72,
      r: RW,
      rake: 25,
      lo: 0.86,
      hi: 0.98,
      gap: 0.085,
      leg: 0.022,
      stanchion: DARK,
      lower: BLACK,
      gaiter: true,
    });
    const P: V2 = [-0.2, 0.42];
    swingarm(g, P, -0.7, RW, 0.11, BLACK);
    chain(g, [0.02, 0.34], 0.045, [-0.7, RW], 0.1);
    // Frame: twin spine over the engine, a cradle under it, black subframe.
    both([[h.h1.x, h.h1.y], [0.12, 0.84], [-0.16, 0.76], [-0.24, 0.6], P], 0.075, 0.022, BLACK);
    both(
      [[h.h0.x, h.h0.y], [0.38, 0.56], [0.33, 0.24], [0.06, 0.16], [-0.17, 0.22], P],
      0.07,
      0.02,
      BLACK,
    );
    both(
      [
        [-0.16, 0.76],
        [-0.45, 0.8],
        [-0.72, 0.84],
      ],
      0.08,
      0.016,
      BLACK,
    );
    both(
      [
        [-0.24, 0.55],
        [-0.48, 0.7],
        [-0.66, 0.82],
      ],
      0.08,
      0.014,
      BLACK,
    );
    g.add(shock([-0.12, 0.3, 0], [-0.32, 0.7, 0], CHROME, 0.03));
    // Engine: black liquid-cooled single, silver clutch cover, radiator up front.
    g.add(
      loft(
        [
          [-0.17, 0.44, 0.2, 0.12],
          [0.02, 0.5, 0.18, 0.13],
          [0.24, 0.47, 0.2, 0.12],
        ],
        BLACK,
        { n: 3.2 },
      ),
    );
    {
      const part = lathe(
        [
          [0.001, 0.12],
          [0.08, 0.12],
          [0.09, 0.14],
          [0.085, 0.155],
          [0.001, 0.155],
        ],
        S2,
        { axis: "z", metal: true },
      );
      part.position.set(-0.02, 0.32, 0.01);
      g.add(part);
    }
    g.add(fins([0.12, 0.44, 0], [0.24, 0.7, 0], 0.095, "#2a2c31", 6));
    g.add(block([0.18, 0.68, -0.1], [0.34, 0.8, 0.1], "#2b2d32", { r: 0.035 }));
    g.add(block([0.34, 0.5, -0.13], [0.4, 0.8, 0.13], "#2b2d32", { r: 0.02 }));
    for (const s of [-1, 1])
      g.add(
        block([0.36, 0.56, s * 0.13 - 0.008], [0.4, 0.74, s * 0.13 + 0.008], S2, {
          r: 0.006,
          metal: true,
        }),
      );
    // Exhaust: bronzed header down the front, under the engine, into a short upswept champagne can.
    g.add(
      pipe(
        [
          [0.3, 0.64, 0.05],
          [0.42, 0.5, 0.07],
          [0.4, 0.24, 0.1],
          [0.24, 0.16, 0.13],
          [0.0, 0.18, 0.16],
        ],
        0.022,
        BRONZE,
        { metal: true, rough: 0.45 },
      ),
    );
    can(g, [0.02, 0.19, 0.17], 0.4, 0.06, 0.42, CHAMPAGNE, DARK);
    // Tank: broad, silver, high at the front, flowing into the radiator shrouds.
    g.add(
      loft(
        [
          [-0.13, 0.9, 0.8, 0.11],
          [0.02, 1.0, 0.76, 0.17],
          [0.22, 1.04, 0.76, 0.18],
          [0.38, 1.0, 0.84, 0.13],
        ],
        S,
        { n: 2.8, metal: true, rough: 0.35 },
      ),
    );
    g.add(
      loft(
        [
          [0.18, 0.84, 0.64, 0.125],
          [0.3, 0.86, 0.62, 0.135],
          [0.4, 0.84, 0.66, 0.115],
        ],
        "#2b2d32",
        { n: 3.6, cap: 0.4 },
      ),
    );
    g.add(ball([0.04, 1.0, 0], 0.035, "#2b2d32", { metal: true }, [1, 0.35, 1]));
    // Silver side cover under the seat, with a red accent.
    for (const s of [-1, 1]) {
      g.add(
        loft(
          [
            [-0.26, 0.82, 0.64, 0.02],
            [-0.1, 0.83, 0.64, 0.025],
            [0.02, 0.8, 0.68, 0.02],
          ],
          S,
          { n: 3, z: s * 0.115, metal: true, rough: 0.35 },
        ),
      );
      g.add(
        loft(
          [
            [-0.12, 0.74, 0.71, 0.006],
            [-0.02, 0.74, 0.71, 0.006],
          ],
          "#c8322a",
          { n: 2, z: s * 0.142 },
        ),
      );
    }
    // Stepped two-up seat.
    g.add(
      loft(
        [
          [-0.42, 0.9, 0.82, 0.13],
          [-0.22, 0.89, 0.81, 0.15],
          [-0.06, 0.94, 0.84, 0.14],
          [0.0, 0.97, 0.88, 0.1],
        ],
        "#202126",
        { n: 3.4 },
      ),
    );
    g.add(
      loft(
        [
          [-0.76, 0.97, 0.86, 0.1],
          [-0.6, 0.98, 0.86, 0.12],
          [-0.44, 0.95, 0.84, 0.12],
        ],
        "#202126",
        { n: 3.4 },
      ),
    );
    // Short black tail with a small lamp; angled plate hugger.
    g.add(
      loft(
        [
          [-0.86, 0.9, 0.82, 0.06],
          [-0.74, 0.9, 0.8, 0.09],
          [-0.6, 0.88, 0.78, 0.1],
        ],
        BLACK,
        { n: 3 },
      ),
    );
    tailLight(g, [-0.88, 0.86, 0], 0.035);
    g.add(
      pipe(
        [
          [-0.62, 0.8, 0],
          [-0.84, 0.7, 0],
          [-0.96, 0.6, 0],
        ],
        0.014,
        BLACK,
      ),
    );
    plate(g, [-0.98, 0.56, 0], 0.35);
    // Rear rack (black tube carrier with grab rails) and a blue bungee strap.
    for (const s of [-1, 1])
      g.add(
        pipe(
          [
            [-0.46, 0.96, s * 0.14],
            [-0.64, 1.02, s * 0.15],
            [-0.92, 1.03, s * 0.1],
            [-0.96, 1.03, 0],
          ],
          0.012,
          BLACK,
        ),
      );
    for (const x of [-0.7, -0.82]) g.add(cyl([x, 1.03, -0.13], [x, 1.03, 0.13], 0.009, BLACK));
    for (const s of [-1, 1])
      g.add(cyl([-0.7, 1.03, s * 0.14], [-0.66, 0.86, s * 0.1], 0.01, BLACK));
    g.add(
      pipe(
        [
          [-0.62, 1.04, -0.15],
          [-0.66, 1.055, 0],
          [-0.62, 1.04, 0.15],
        ],
        0.008,
        "#2e5fa8",
      ),
    );
    g.add(
      pipe(
        [
          [-0.86, 1.04, -0.12],
          [-0.82, 1.052, 0],
          [-0.86, 1.04, 0.12],
        ],
        0.008,
        "#2e5fa8",
      ),
    );
    // Fenders: short black hugger at the back; short silver front with a black flap.
    g.add(fender(-0.7, RW, RW + 0.03, 0.75, 1.75, 0.06, BLACK));
    g.add(fender(0.72, RW, RW + 0.03, 0.85, 2.0, 0.05, S, { metal: true, rough: 0.35 }));
    {
      const flap = block([-0.004, -0.06, -0.045], [0.004, 0.06, 0.045], "#18191c", { r: 0.003 });
      flap.position.set(
        0.72 + Math.cos(0.85) * (RW + 0.03) + 0.02,
        RW + Math.sin(0.85) * (RW + 0.03) - 0.08,
        0,
      );
      flap.rotation.z = 0.25;
      g.add(flap);
    }
    // Round headlamp, small round TFT, wide flat bar with knuckle guards, round mirrors.
    const lampAt: V3 = [h.top.x + 0.12, h.top.y - 0.06, 0];
    for (const s of [-1, 1])
      g.add(
        pipe(
          [
            [h.top.x + 0.02, h.top.y - 0.03, s * 0.085],
            [lampAt[0] - 0.06, lampAt[1], s * 0.08],
          ],
          0.008,
          BLACK,
        ),
      );
    headlamp(g, lampAt, 0.085, BLACK, BLACK, true);
    g.add(cyl([h.top.x, h.top.y + 0.07, 0], [h.top.x + 0.02, h.top.y + 0.1, 0], 0.05, BLACK));
    const ends = handlebar(g, h, 0.06, 0.08, 0.38, 0.0);
    for (const e of ends)
      g.add(
        loft(
          [
            [e[0] - 0.02, e[1] + 0.035, e[1] - 0.035, 0.03],
            [e[0] + 0.13, e[1] + 0.05, e[1] - 0.04, 0.04],
          ],
          "#18191c",
          { n: 2.4, z: e[2] - Math.sign(e[2]) * 0.05 },
        ),
      );
    mirrors(g, ends, 0.24);
    // Marigold garland (genda phool) looped round the bars, as on the real bike.
    {
      const cx = h.top.x - 0.02;
      const cy = h.top.y + 0.02;
      const cols = ["#f28c1b", "#f6c12a", "#f28c1b", "#e8571f", "#f6c12a"];
      const N = 34;
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        const z = Math.cos(t) * 0.2;
        const y = cy - 0.02 - (1 - Math.abs(Math.cos(t))) * 0.06 + Math.sin(t) * 0.015;
        const x = cx + Math.sin(t) * 0.08;
        g.add(
          ball([x, y, z], 0.019, cols[i % cols.length] ?? "#f28c1b", { rough: 0.9 }, [1, 0.85, 1]),
        );
      }
      for (const [z, dy] of [
        [-0.05, 0.05],
        [0.06, 0.08],
      ] as [number, number][])
        for (let k = 1; k <= 3; k++)
          g.add(
            ball(
              [cx + 0.085, cy - 0.06 - k * 0.032 - dy * 0.2, z],
              0.016,
              k % 2 ? "#f6c12a" : "#c93a24",
              { rough: 0.9 },
            ),
          );
    }
    pegs(g, [-0.13, 0.36]);
    sideStand(g, [-0.1, 0.26]);
  },

  /** Expresso: Triumph Speed Twin 1200 Café Racer-style. Silver/green split tank, "12" side panel, gold USDs, megaphone. */
  cafe(g) {
    const G = "#1d5a3c";
    const S = "#c9cdd2";
    const GOLD = "#c9a227";
    const RW = 0.32;
    g.add(
      heroWheel(-0.7, {
        r: RW,
        tyre: 0.07,
        rim: ALU,
        kind: "cast",
        spokes: 12,
        disc: 0.11,
        hub: ALU,
      }),
    );
    g.add(
      heroWheel(0.72, {
        r: RW,
        tyre: 0.058,
        rim: ALU,
        kind: "cast",
        spokes: 12,
        disc: 0.16,
        twin: true,
        drilled: false,
        hub: ALU,
      }),
    );
    for (const s of [-1, 1]) g.add(caliper(0.72, RW, 0.16, 2.3, s * 0.075, GOLD));
    const h = frontEnd(g, {
      x: 0.72,
      r: RW,
      rake: 24,
      lo: 0.8,
      hi: 0.9,
      gap: 0.085,
      leg: 0.024,
      stanchion: CHROME,
      lower: GOLD,
      usd: true,
    });
    const P: V2 = [-0.2, 0.4];
    swingarm(g, P, -0.7, RW, 0.11, BLACK);
    chain(g, [0.02, 0.33], 0.045, [-0.7, RW], 0.1);
    both([[h.h1.x, h.h1.y], [0.12, 0.8], [-0.18, 0.74], [-0.26, 0.56], P], 0.07, 0.02, BLACK);
    both(
      [[h.h0.x, h.h0.y], [0.4, 0.52], [0.36, 0.22], [0.06, 0.15], [-0.18, 0.22], P],
      0.075,
      0.019,
      BLACK,
    );
    both(
      [
        [-0.18, 0.74],
        [-0.5, 0.8],
        [-0.76, 0.84],
      ],
      0.08,
      0.016,
      BLACK,
    );
    // Twin shocks with gold springs.
    for (const s of [-1, 1])
      g.add(shock([-0.6, 0.34, s * 0.12], [-0.5, 0.78, s * 0.12], "#d9a420", 0.034));
    // Air-cooled-look parallel twin: black cases, silver fin edges.
    g.add(
      loft(
        [
          [-0.16, 0.42, 0.18, 0.13],
          [0.04, 0.48, 0.16, 0.15],
          [0.28, 0.45, 0.18, 0.13],
        ],
        "#232428",
        { n: 3.2 },
      ),
    );
    for (const s of [-1, 1]) {
      const cover = lathe(
        [
          [0.001, 0],
          [0.1, 0],
          [0.11, 0.015],
          [0.1, 0.03],
          [0.001, 0.03],
        ],
        "#2c2e33",
        { axis: "z" },
      );
      cover.position.set(s < 0 ? 0.08 : -0.05, 0.32, s * 0.15);
      cover.rotation.y = s < 0 ? Math.PI : 0;
      g.add(cover);
    }
    for (const z of [-0.065, 0.065])
      g.add(fins([0.12, 0.44, z], [0.17, 0.66, z], 0.072, "#9aa1a9", 7, { metal: true }));
    g.add(block([0.1, 0.65, -0.14], [0.25, 0.74, 0.14], "#2c2e33", { r: 0.03 }));
    // Brushed headers sweeping into one big megaphone on the right.
    for (const s of [-1, 1])
      g.add(
        pipe(
          [
            [0.24, 0.6, s * 0.065],
            [0.36, 0.5, s * 0.1],
            [0.34, 0.24, s * 0.12],
            [0.08, 0.18, 0.12 + s * 0.02],
            [-0.08, 0.26, 0.17],
          ],
          0.022,
          ALU,
          { metal: true },
        ),
      );
    can(g, [-0.06, 0.27, 0.18], 0.5, 0.07, 0.2, ALU, DARK);
    // Tank: silver over the top and front, green sweeping down the back half, black knee pads.
    g.add(
      loft(
        [
          [-0.16, 0.88, 0.74, 0.11],
          [0.0, 0.96, 0.7, 0.165],
          [0.2, 0.97, 0.7, 0.16],
          [0.36, 0.9, 0.76, 0.1],
        ],
        S,
        { n: 2.6, metal: true, rough: 0.35 },
      ),
    );
    g.add(
      loft(
        [
          [-0.165, 0.86, 0.73, 0.115],
          [-0.05, 0.9, 0.7, 0.152],
          [0.06, 0.86, 0.7, 0.158],
          [0.14, 0.8, 0.71, 0.15],
        ],
        G,
        { n: 2.6, rough: 0.3 },
      ),
    );
    for (const s of [-1, 1])
      g.add(
        loft(
          [
            [0.12, 0.88, 0.8, 0.012],
            [0.26, 0.88, 0.8, 0.012],
          ],
          "#1d1e22",
          { n: 2.6, z: s * 0.158 },
        ),
      );
    g.add(cyl([0.08, 0.955, 0], [0.08, 0.98, 0], 0.035, ALU, { metal: true }));
    // Green side panel with the white "12".
    for (const s of [-1, 1]) {
      g.add(
        loft(
          [
            [-0.42, 0.84, 0.6, 0.02],
            [-0.24, 0.84, 0.58, 0.025],
            [-0.1, 0.8, 0.62, 0.02],
          ],
          G,
          { n: 3, z: s * 0.115, rough: 0.3 },
        ),
      );
      decal(g, "12", [-0.26, 0.72, s * 0.142], 0.2, s);
    }
    // Long flat brown seat ending in a small silver hump.
    g.add(
      loft(
        [
          [-0.66, 0.88, 0.82, 0.12],
          [-0.4, 0.88, 0.8, 0.14],
          [-0.16, 0.9, 0.82, 0.14],
          [-0.08, 0.93, 0.86, 0.1],
        ],
        "#5a3a26",
        { n: 3.6 },
      ),
    );
    g.add(
      loft(
        [
          [-0.86, 0.92, 0.82, 0.06],
          [-0.76, 0.95, 0.82, 0.1],
          [-0.66, 0.93, 0.83, 0.11],
        ],
        S,
        { n: 2.6, metal: true, rough: 0.35 },
      ),
    );
    tailLight(g, [-0.88, 0.86, 0], 0.035);
    g.add(
      pipe(
        [
          [-0.72, 0.8, 0],
          [-0.9, 0.7, 0],
          [-0.96, 0.6, 0],
        ],
        0.012,
        BLACK,
      ),
    );
    plate(g, [-0.98, 0.56, 0], 0.3);
    g.add(fender(0.72, RW, RW + 0.028, 0.75, 1.95, 0.05, S, { metal: true, rough: 0.35 }));
    // Round lamp with a small green fly-screen, twin clocks, clip-ons, bar-end mirrors.
    const lampAt: V3 = [h.top.x + 0.14, h.top.y - 0.06, 0];
    for (const s of [-1, 1])
      g.add(
        pipe(
          [
            [h.top.x + 0.02, h.top.y - 0.05, s * 0.085],
            [lampAt[0] - 0.08, lampAt[1], s * 0.09],
          ],
          0.008,
          BLACK,
        ),
      );
    headlamp(g, lampAt, 0.09, BLACK, ALU);
    g.add(
      loft(
        [
          [lampAt[0] - 0.1, lampAt[1] + 0.16, lampAt[1] - 0.02, 0.1],
          [lampAt[0] - 0.02, lampAt[1] + 0.14, lampAt[1] + 0.02, 0.11],
          [lampAt[0] + 0.03, lampAt[1] + 0.1, lampAt[1] + 0.04, 0.09],
        ],
        G,
        { n: 2.6, cap: 0.3, rough: 0.3 },
      ),
    );
    for (const s of [-1, 1]) {
      const c = lathe(
        [
          [0.001, -0.02],
          [0.04, -0.02],
          [0.045, 0.01],
          [0.04, 0.02],
          [0.001, 0.015],
        ],
        "#2c2e33",
        { axis: "y" },
      );
      g.add(c);
      c.position.set(h.top.x + 0.0, h.top.y + 0.04, s * 0.06);
      c.rotation.z = 0.5;
    }
    for (const s of [-1, 1]) {
      const end: V3 = [h.top.x - 0.12, h.top.y - 0.03, s * 0.34];
      g.add(
        pipe(
          [
            [h.top.x - 0.02, h.top.y - 0.02, s * 0.09],
            [h.top.x - 0.07, h.top.y - 0.025, s * 0.2],
            end,
          ],
          0.013,
          BLACK,
        ),
      );
      g.add(
        cyl([end[0] + 0.015, end[1], s * 0.23], [end[0], end[1], s * 0.34], 0.019, TYRE, {
          rough: 0.9,
        }),
      );
      const m: V3 = [end[0] - 0.01, end[1] + 0.005, s * 0.39];
      g.add(cyl(end, m, 0.008, BLACK));
      g.add(ball(m, 0.045, BLACK, undefined, [0.3, 0.7, 1]));
    }
    pegs(g, [-0.2, 0.4]);
    sideStand(g, [-0.1, 0.24]);
  },

  /** Fun: Ducati Scrambler 1100-style. Yellow teardrop tank, brown seat, black trellis, bronze headers, stacked cans. */
  scrambler(g) {
    const Y = "#f2b705";
    const RW = 0.33;
    g.add(
      heroWheel(-0.7, {
        r: RW,
        tyre: 0.075,
        rim: BLACK,
        kind: "spoke",
        dual: true,
        disc: 0.11,
        hub: BLACK,
      }),
    );
    g.add(
      heroWheel(0.73, {
        r: RW + 0.01,
        tyre: 0.068,
        rim: BLACK,
        kind: "spoke",
        dual: true,
        disc: 0.16,
        twin: true,
        hub: BLACK,
      }),
    );
    g.add(caliper(0.73, RW + 0.01, 0.16, 2.3, 0.07, BLACK));
    const h = frontEnd(g, {
      x: 0.73,
      r: RW + 0.01,
      rake: 24,
      lo: 0.88,
      hi: 0.99,
      gap: 0.09,
      leg: 0.026,
      stanchion: "#2f3238",
      lower: ALU,
      usd: true,
    });
    const P: V2 = [-0.2, 0.42];
    swingarm(g, P, -0.7, RW, 0.11, ALU, 0.028, { metal: true });
    chain(g, [0.02, 0.34], 0.045, [-0.7, RW], 0.1);
    // Black trellis frame.
    const RED = "#1d1e22";
    both([[h.h1.x, h.h1.y], [0.14, 0.86], [-0.14, 0.78], [-0.22, 0.6], P], 0.075, 0.016, RED);
    both(
      [
        [h.h0.x, h.h0.y],
        [0.26, 0.62],
        [0.06, 0.66],
        [-0.14, 0.78],
      ],
      0.075,
      0.014,
      RED,
    );
    both(
      [
        [0.26, 0.62],
        [0.14, 0.86],
      ],
      0.075,
      0.013,
      RED,
    );
    both(
      [
        [-0.14, 0.78],
        [-0.46, 0.83],
        [-0.66, 0.86],
      ],
      0.075,
      0.015,
      RED,
    );
    g.add(shock([-0.1, 0.32, 0.06], [-0.18, 0.74, 0.06], "#c33a2c", 0.03));
    // L-twin: front cylinder nearly horizontal, rear cylinder upright. Black fins, silver heads.
    g.add(
      loft(
        [
          [-0.16, 0.44, 0.2, 0.12],
          [0.02, 0.48, 0.18, 0.13],
          [0.2, 0.42, 0.22, 0.11],
        ],
        BLACK,
        { n: 3.2 },
      ),
    );
    g.add(fins([0.1, 0.34, 0], [0.36, 0.42, 0], 0.08, "#2a2c31", 8));
    g.add(block([0.34, 0.33, -0.09], [0.44, 0.5, 0.09], ALU, { r: 0.03, metal: true }));
    g.add(fins([-0.04, 0.44, 0], [0.0, 0.68, 0], 0.08, "#2a2c31", 7));
    g.add(block([-0.08, 0.66, -0.09], [0.08, 0.76, 0.09], ALU, { r: 0.03, metal: true }));
    g.add(cyl([0.06, 0.32, 0.13], [0.06, 0.32, 0.16], 0.07, ALU, { metal: true }));
    // Bronze headers curling round the front and under, up to twin stacked silver cans beneath the seat.
    const BRZ = "#9a6b45";
    g.add(
      pipe(
        [
          [0.42, 0.4, 0.04],
          [0.48, 0.26, 0.07],
          [0.36, 0.14, 0.1],
          [0.12, 0.16, 0.13],
          [-0.1, 0.32, 0.15],
          [-0.24, 0.6, 0.16],
        ],
        0.025,
        BRZ,
        { metal: true, rough: 0.4 },
      ),
    );
    g.add(
      pipe(
        [
          [0.0, 0.68, 0.06],
          [0.06, 0.5, 0.1],
          [0.0, 0.3, 0.13],
          [-0.1, 0.32, 0.15],
        ],
        0.023,
        BRZ,
        { metal: true, rough: 0.4 },
      ),
    );
    for (const y of [0.6, 0.72]) can(g, [-0.24, y, 0.17], 0.42, 0.05, 0.1, ALU, DARK);
    // Teardrop tank with aluminium side plates and black knee panels.
    g.add(
      loft(
        [
          [-0.12, 0.97, 0.82, 0.1],
          [0.04, 1.06, 0.79, 0.16],
          [0.22, 1.07, 0.8, 0.15],
          [0.36, 1.0, 0.86, 0.1],
        ],
        Y,
        { n: 2.5, rough: 0.35 },
      ),
    );
    for (const s of [-1, 1])
      g.add(
        loft(
          [
            [-0.04, 0.88, 0.8, 0.01],
            [0.16, 0.88, 0.79, 0.012],
            [0.3, 0.9, 0.84, 0.01],
          ],
          "#1d1e22",
          { n: 2.6, z: s * 0.152 },
        ),
      );
    g.add(
      loft(
        [
          [-0.2, 0.84, 0.66, 0.13],
          [-0.06, 0.84, 0.64, 0.14],
          [0.06, 0.82, 0.68, 0.11],
        ],
        BLACK,
        { n: 3 },
      ),
    );
    // Flat brown seat on a tidy black tail.
    g.add(
      loft(
        [
          [-0.68, 0.93, 0.86, 0.11],
          [-0.4, 0.94, 0.85, 0.14],
          [-0.12, 0.96, 0.86, 0.14],
          [-0.04, 0.97, 0.89, 0.1],
        ],
        "#8a5a34",
        { n: 3.6 },
      ),
    );
    g.add(
      loft(
        [
          [-0.74, 0.87, 0.8, 0.08],
          [-0.55, 0.87, 0.78, 0.11],
          [-0.4, 0.86, 0.78, 0.11],
        ],
        BLACK,
        { n: 3 },
      ),
    );
    tailLight(g, [-0.76, 0.81, 0], 0.035);
    g.add(
      pipe(
        [
          [-0.62, 0.62, 0.0],
          [-0.82, 0.55, 0],
          [-0.9, 0.5, 0],
        ],
        0.01,
        BLACK,
      ),
    );
    plate(g, [-0.92, 0.48, 0]);
    g.add(fender(0.73, RW + 0.01, RW + 0.04, 0.6, 1.9, 0.055, Y, { rough: 0.35 }));
    // Round lamp with the LED X-ring, wide tapered bar.
    const lampAt: V3 = [h.top.x + 0.13, h.top.y - 0.07, 0];
    for (const s of [-1, 1])
      g.add(
        pipe(
          [
            [h.top.x + 0.02, h.top.y - 0.04, s * 0.09],
            [lampAt[0] - 0.07, lampAt[1], s * 0.085],
          ],
          0.008,
          BLACK,
        ),
      );
    headlamp(g, lampAt, 0.09, BLACK, ALU, true);
    const ends = handlebar(g, h, 0.1, 0.1, 0.42, 0.02);
    mirrors(g, ends, 0.2);
    {
      const part = lathe(
        [
          [0.001, -0.015],
          [0.05, -0.015],
          [0.055, 0.01],
          [0.001, 0.015],
        ],
        BLACK,
        { axis: "y" },
      );
      part.position.set(h.top.x + 0.01, h.top.y + 0.05, 0);
      g.add(part);
    }
    pegs(g, [-0.14, 0.37]);
    sideStand(g, [-0.1, 0.26]);
  },

  /** Zingle: KTM 450 Rally-style. All orange and black, tall tower with smoked screen, low side tanks, high silver pipe. */
  rally(g) {
    const O = "#f26a1b";
    const N = "#1d1e22";
    const W = O;
    g.add(
      heroWheel(-0.76, {
        r: 0.37,
        tyre: 0.08,
        rim: ALU,
        kind: "spoke",
        knobby: true,
        disc: 0.11,
        hub: O,
      }),
    );
    g.add(
      heroWheel(0.86, {
        r: 0.4,
        tyre: 0.065,
        rim: ALU,
        kind: "spoke",
        knobby: true,
        disc: 0.14,
        hub: O,
      }),
    );
    g.add(caliper(0.86, 0.4, 0.14, 2.4, 0.07, O));
    const h = frontEnd(
      g,
      {
        x: 0.86,
        r: 0.4,
        rake: 27,
        lo: 1.08,
        hi: 1.2,
        gap: 0.095,
        leg: 0.03,
        stanchion: ALU,
        lower: O,
        usd: true,
      },
      O,
    );
    const P: V2 = [-0.16, 0.52];
    swingarm(g, P, -0.76, 0.37, 0.115, ALU, 0.03, { metal: true });
    chain(g, [0.04, 0.44], 0.045, [-0.76, 0.37], 0.11);
    both([[h.h1.x, h.h1.y], [0.2, 1.0], [-0.1, 0.9], [-0.2, 0.72], P], 0.08, 0.022, O);
    both([[h.h0.x, h.h0.y], [0.42, 0.7], [0.32, 0.32], [0.0, 0.28], P], 0.065, 0.02, O);
    both(
      [
        [-0.1, 0.9],
        [-0.5, 1.0],
        [-0.84, 1.06],
      ],
      0.08,
      0.016,
      O,
    );
    g.add(shock([-0.12, 0.4, 0.05], [-0.2, 0.92, 0.05], O, 0.035));
    // Single: compact block, tall head, skid plate.
    g.add(
      loft(
        [
          [-0.14, 0.58, 0.32, 0.11],
          [0.06, 0.62, 0.3, 0.12],
          [0.26, 0.58, 0.32, 0.1],
        ],
        DARK,
        { n: 3.2 },
      ),
    );
    g.add(block([0.08, 0.56, -0.09], [0.26, 0.86, 0.09], "#3a3d44", { r: 0.04 }));
    g.add(block([0.18, 0.84, -0.09], [0.32, 0.94, 0.09], O, { r: 0.035 }));
    g.add(
      loft(
        [
          [-0.16, 0.3, 0.22, 0.13],
          [0.2, 0.3, 0.2, 0.15],
          [0.36, 0.42, 0.3, 0.12],
        ],
        ALU,
        { n: 3.4, metal: true },
      ),
    );
    // High pipe: from the head, round the right, up under the tail.
    g.add(
      pipe(
        [
          [0.3, 0.8, 0.06],
          [0.42, 0.62, 0.12],
          [0.28, 0.42, 0.15],
          [-0.08, 0.6, 0.17],
          [-0.32, 0.86, 0.17],
        ],
        0.026,
        "#8f949a",
        { metal: true },
      ),
    );
    can(g, [-0.3, 0.87, 0.17], 0.42, 0.065, 0.35, ALU, DARK);
    // Front side tanks + main tank, rally tower with screen and twin stacked lamps.
    g.add(
      loft(
        [
          [-0.14, 1.12, 0.92, 0.12],
          [0.06, 1.17, 0.87, 0.16],
          [0.28, 1.15, 0.89, 0.15],
          [0.44, 1.08, 0.95, 0.11],
        ],
        O,
        { n: 3, cap: 0.5 },
      ),
    );
    for (const s of [-1, 1])
      g.add(
        loft(
          [
            [0.16, 0.86, 0.74, 0.04],
            [0.32, 0.88, 0.72, 0.06],
            [0.44, 0.86, 0.76, 0.04],
          ],
          N,
          { n: 2.6, z: s * 0.2 },
        ),
      );
    const tower: Sec[] = [
      [h.top.x + 0.0, 1.47, 1.04, 0.1],
      [h.top.x + 0.11, 1.44, 1.02, 0.115],
      [h.top.x + 0.21, 1.32, 1.04, 0.1],
    ];
    g.add(loft(tower, N, { n: 3.2, cap: 0.4 }));
    // Low side tanks flanking the engine.
    for (const s of [-1, 1])
      g.add(
        loft(
          [
            [0.0, 0.92, 0.52, 0.05],
            [0.24, 0.95, 0.46, 0.075],
            [0.42, 0.9, 0.56, 0.05],
          ],
          O,
          { n: 3, cap: 0.5, z: s * 0.17 },
        ),
      );
    g.add(
      loft(
        [
          [h.top.x + 0.1, 1.3, 1.08, 0.07],
          [h.top.x + 0.22, 1.28, 1.1, 0.075],
          [h.top.x + 0.25, 1.24, 1.12, 0.07],
        ],
        N,
        { n: 2.4 },
      ),
    );
    for (const y of [1.14, 1.24])
      g.add(ball([h.top.x + 0.24, y, 0], 0.04, LAMP, { emissive: true }, [0.4, 0.8, 1.2]));
    const scr = loft(
      [
        [h.top.x - 0.06, 1.66, 1.46, 0.11],
        [h.top.x + 0.04, 1.64, 1.44, 0.13],
        [h.top.x + 0.06, 1.52, 1.44, 0.12],
      ],
      "#59636e",
      { n: 2.2, glass: true, cap: 0.2 },
    );
    g.add(scr);
    g.add(
      block([h.top.x - 0.12, 1.24, -0.11], [h.top.x - 0.02, 1.38, 0.11], "#2a2c31", { r: 0.02 }),
    );
    // Long flat seat, tall white tail, tank behind the seat.
    g.add(
      loft(
        [
          [-0.62, 1.12, 1.04, 0.11],
          [-0.3, 1.13, 1.03, 0.14],
          [-0.06, 1.16, 1.06, 0.13],
          [0.02, 1.2, 1.1, 0.09],
        ],
        N,
        { n: 3.6 },
      ),
    );
    g.add(
      loft(
        [
          [-1.0, 1.12, 1.06, 0.06],
          [-0.8, 1.12, 1.0, 0.1],
          [-0.56, 1.06, 0.92, 0.12],
        ],
        W,
        { n: 3 },
      ),
    );
    g.add(
      loft(
        [
          [-0.62, 1.02, 0.82, 0.13],
          [-0.4, 1.02, 0.8, 0.14],
          [-0.2, 1.0, 0.84, 0.12],
        ],
        O,
        { n: 3 },
      ),
    );
    tailLight(g, [-1.0, 1.06, 0], 0.035);
    plate(g, [-1.02, 0.96, 0], 0.4);
    g.add(fender(0.86, 0.4, 0.46, 0.5, 2.2, 0.06, O));
    const ends = handlebar(g, h, 0.06, 0.06, 0.4, 0.02);
    for (const e of ends)
      g.add(
        loft(
          [
            [e[0] - 0.02, e[1] + 0.03, e[1] - 0.03, 0.03],
            [e[0] + 0.12, e[1] + 0.04, e[1] - 0.04, 0.035],
          ],
          O,
          { n: 2.4, z: e[2] - Math.sign(e[2]) * 0.04 },
        ),
      );
    pegs(g, [-0.12, 0.54]);
    sideStand(g, [-0.06, 0.34]);
  },

  /** Astro: BMW R 1300 GSA-style. Boxer twin, big tricolour tank, dark beak, tall screen, red-topped seat. */
  adv(g) {
    const W = "#e6e8eb";
    const B = "#2463c4";
    const R = "#d6312d";
    g.add(
      heroWheel(-0.76, {
        r: 0.37,
        tyre: 0.085,
        rim: BLACK,
        kind: "spoke",
        knobby: true,
        disc: 0.12,
        hub: ALU,
      }),
    );
    g.add(
      heroWheel(0.86, {
        r: 0.39,
        tyre: 0.07,
        rim: BLACK,
        kind: "spoke",
        knobby: true,
        disc: 0.15,
        twin: true,
        hub: ALU,
      }),
    );
    for (const s of [-1, 1]) g.add(caliper(0.86, 0.39, 0.15, 2.4, s * 0.08, "#c9a227"));
    const h = frontEnd(
      g,
      {
        x: 0.86,
        r: 0.39,
        rake: 27,
        lo: 1.0,
        hi: 1.12,
        gap: 0.1,
        leg: 0.03,
        stanchion: ALU,
        lower: BLACK,
      },
      ALU,
    );
    const P: V2 = [-0.18, 0.48];
    // Single-sided shaft drive on the left.
    g.add(pipe([P.concat(-0.12) as V3, [-0.48, 0.42, -0.12], [-0.76, 0.37, -0.12]], 0.04, DARK));
    g.add(ball([-0.76, 0.37, -0.12], 0.07, DARK));
    g.add(shock([-0.3, 0.44, 0.08], [-0.2, 0.9, 0.08], "#c9a227", 0.036));
    both([[h.h1.x, h.h1.y], [0.2, 0.98], [-0.12, 0.9], [-0.2, 0.68], P], 0.08, 0.024, DARK);
    both(
      [
        [-0.12, 0.9],
        [-0.52, 0.98],
        [-0.92, 1.02],
      ],
      0.1,
      0.018,
      DARK,
    );
    // Boxer twin: cylinders stick out to both sides, with head covers.
    g.add(
      loft(
        [
          [-0.16, 0.6, 0.3, 0.13],
          [0.06, 0.66, 0.28, 0.14],
          [0.28, 0.6, 0.32, 0.12],
        ],
        "#3a3d44",
        { n: 3.2 },
      ),
    );
    for (const s of [-1, 1]) {
      g.add(
        fins([0.12, 0.5, s * 0.12], [0.14, 0.52, s * 0.34], 0.075, "#9aa1a9", 6, { metal: true }),
      );
      g.add(
        loft(
          [
            [0.04, 0.6, 0.42, 0.04],
            [0.14, 0.62, 0.4, 0.05],
            [0.26, 0.6, 0.42, 0.04],
          ],
          DARK,
          { n: 2.6, z: s * 0.38 },
        ),
      );
    }
    // Crash bars around the cylinders.
    for (const s of [-1, 1])
      g.add(
        pipe(
          [
            [h.h0.x - 0.02, 0.86, s * 0.12],
            [0.38, 0.7, s * 0.36],
            [0.3, 0.36, s * 0.42],
            [0.04, 0.34, s * 0.36],
            [-0.06, 0.5, s * 0.16],
          ],
          0.016,
          DARK,
        ),
      );
    g.add(
      loft(
        [
          [-0.12, 0.32, 0.24, 0.14],
          [0.2, 0.32, 0.22, 0.16],
          [0.36, 0.42, 0.32, 0.12],
        ],
        ALU,
        { n: 3.4, metal: true },
      ),
    );
    // Exhaust: right side, up to a big silencer.
    g.add(
      pipe(
        [
          [0.24, 0.48, 0.3],
          [0.2, 0.3, 0.2],
          [-0.1, 0.32, 0.22],
          [-0.4, 0.58, 0.24],
        ],
        0.026,
        CHROME,
        { metal: true },
      ),
    );
    // Big tank and side shrouds, beak, tall screen, twin LED eyes.
    g.add(
      loft(
        [
          [-0.16, 1.1, 0.84, 0.15],
          [0.06, 1.18, 0.8, 0.22],
          [0.3, 1.16, 0.82, 0.21],
          [0.48, 1.04, 0.86, 0.15],
        ],
        W,
        { n: 2.8 },
      ),
    );
    for (const s of [-1, 1])
      g.add(
        loft(
          [
            [0.08, 0.98, 0.76, 0.05],
            [0.32, 1.0, 0.74, 0.07],
            [0.5, 0.96, 0.8, 0.05],
          ],
          B,
          { n: 2.8, z: s * 0.21 },
        ),
      );
    g.add(
      loft(
        [
          [0.08, 1.2, 1.16, 0.07],
          [0.36, 1.18, 1.13, 0.06],
        ],
        R,
        { n: 2.4 },
      ),
    );
    g.add(
      loft(
        [
          [0.52, 1.0, 0.86, 0.07],
          [0.78, 0.86, 0.78, 0.06],
          [0.94, 0.72, 0.68, 0.04],
        ],
        "#3a3d44",
        { n: 2.4 },
      ),
    );
    for (const s of [-1, 1])
      g.add(
        loft(
          [
            [0.02, 1.12, 1.04, 0.03],
            [0.3, 1.1, 1.0, 0.04],
            [0.46, 1.02, 0.95, 0.03],
          ],
          "#1c2a5c",
          { n: 2.6, z: s * 0.19 },
        ),
      );
    g.add(
      loft(
        [
          [0.48, 1.2, 0.92, 0.15],
          [0.62, 1.18, 0.94, 0.15],
          [0.7, 1.12, 0.98, 0.12],
        ],
        W,
        { n: 2.6 },
      ),
    );
    for (const s of [-1, 1])
      g.add(ball([0.7, 1.06, s * 0.06], 0.035, LAMP, { emissive: true }, [0.5, 0.8, 1.2]));
    g.add(
      loft(
        [
          [0.48, 1.52, 1.18, 0.16],
          [0.58, 1.48, 1.16, 0.17],
          [0.64, 1.3, 1.16, 0.15],
        ],
        "#bcd6ee",
        { n: 2.2, glass: true, cap: 0.2 },
      ),
    );
    // Two-up seat with a red rider top, slim black tail, small rack, black silencer.
    g.add(
      loft(
        [
          [-0.7, 1.1, 1.0, 0.13],
          [-0.4, 1.08, 0.98, 0.16],
          [-0.12, 1.12, 1.0, 0.16],
          [0.0, 1.16, 1.04, 0.12],
        ],
        BLACK,
        { n: 3.4 },
      ),
    );
    g.add(
      loft(
        [
          [-0.36, 1.095, 1.06, 0.15],
          [-0.12, 1.13, 1.09, 0.15],
          [-0.02, 1.16, 1.12, 0.11],
        ],
        R,
        { n: 3.4 },
      ),
    );
    g.add(
      loft(
        [
          [-1.0, 1.08, 1.0, 0.06],
          [-0.84, 1.08, 0.94, 0.1],
          [-0.64, 1.04, 0.9, 0.12],
        ],
        BLACK,
        { n: 3 },
      ),
    );
    g.add(block([-0.98, 1.08, -0.11], [-0.7, 1.11, 0.11], DARK, { r: 0.012 }));
    can(g, [-0.4, 0.6, 0.22], 0.42, 0.07, 0.25, BLACK, DARK);
    tailLight(g, [-0.76, 1.0, 0], 0.035);
    plate(g, [-1.06, 0.82, 0], 0.3);
    g.add(fender(0.86, 0.39, 0.44, 0.55, 2.1, 0.06, "#3a3d44"));
    const ends = handlebar(g, h, 0.14, 0.08, 0.42, 0.02);
    for (const e of ends)
      g.add(
        loft(
          [
            [e[0] - 0.02, e[1] + 0.03, e[1] - 0.03, 0.03],
            [e[0] + 0.12, e[1] + 0.04, e[1] - 0.04, 0.035],
          ],
          DARK,
          { n: 2.4, z: e[2] - Math.sign(e[2]) * 0.04 },
        ),
      );
    mirrors(g, ends, 0.2);
    pegs(g, [-0.1, 0.5], 0.2);
    sideStand(g, [-0.04, 0.32]);
  },

  /** WinZO: Fireblade SP-style. Grand Prix red with a blue/white flash, gold USDs, black wheels, titanium upswept can. */
  superbike(g) {
    const W = "#f4f4f2";
    const R = "#d7262b";
    const B = "#1f4fa3";
    const GOLD = "#c9a227";
    g.add(
      heroWheel(-0.7, { r: 0.31, tyre: 0.08, rim: BLACK, kind: "cast", spokes: 7, disc: 0.11 }),
    );
    g.add(
      heroWheel(0.72, {
        r: 0.31,
        tyre: 0.062,
        rim: BLACK,
        kind: "cast",
        spokes: 7,
        disc: 0.16,
        twin: true,
        drilled: true,
      }),
    );
    for (const s of [-1, 1]) g.add(caliper(0.72, 0.31, 0.16, 2.3, s * 0.075, GOLD));
    const h = frontEnd(
      g,
      {
        x: 0.72,
        r: 0.31,
        rake: 23,
        lo: 0.82,
        hi: 0.92,
        gap: 0.09,
        leg: 0.026,
        stanchion: GOLD,
        lower: GOLD,
        usd: true,
      },
      ALU,
    );
    const P: V2 = [-0.16, 0.44];
    // Banana swingarm and twin-spar aluminium frame.
    for (const s of [-1, 1])
      g.add(
        loft(
          [
            [-0.7, 0.35, 0.28, 0.02],
            [-0.42, 0.42, 0.3, 0.025],
            [-0.16, 0.5, 0.38, 0.03],
          ],
          ALU,
          { n: 3, z: s * 0.12, metal: true },
        ),
      );
    g.add(cyl([P[0], P[1], -0.14], [P[0], P[1], 0.14], 0.03, ALU, { metal: true }));
    chain(g, [0.04, 0.36], 0.045, [-0.7, 0.31], 0.1, -0.145);
    g.add(shock([-0.1, 0.34, 0], [-0.08, 0.72, 0], "#d7262b", 0.03));
    g.add(
      loft(
        [
          [-0.14, 0.52, 0.22, 0.13],
          [0.1, 0.62, 0.2, 0.14],
          [0.32, 0.56, 0.26, 0.12],
        ],
        DARK,
        { n: 3.2 },
      ),
    );
    // Full fairing: one sleek white shell, red belly, blue flash, pointed nose with slit lamps.
    g.add(
      loft(
        [
          [-0.04, 0.74, 0.36, 0.15],
          [0.2, 0.78, 0.26, 0.19],
          [0.46, 0.86, 0.3, 0.18],
          [0.66, 0.9, 0.48, 0.14],
          [0.86, 0.8, 0.68, 0.05],
        ],
        R,
        { n: 3, cap: 0.35 },
      ),
    );
    // Blue flash with a white stripe across the front fairing.
    g.add(
      loft(
        [
          [0.2, 0.74, 0.62, 0.194],
          [0.46, 0.8, 0.66, 0.186],
          [0.7, 0.84, 0.74, 0.13],
        ],
        B,
        { n: 3, cap: 0.35 },
      ),
    );
    g.add(
      loft(
        [
          [0.22, 0.615, 0.59, 0.195],
          [0.48, 0.655, 0.63, 0.186],
          [0.68, 0.73, 0.71, 0.14],
        ],
        W,
        { n: 3, cap: 0.35 },
      ),
    );
    for (const s of [-1, 1])
      g.add(
        loft(
          [
            [0.78, 0.79, 0.765, 0.014],
            [0.86, 0.76, 0.745, 0.012],
          ],
          LAMP,
          { emissive: true, z: s * 0.055 },
        ),
      );
    g.add(
      loft(
        [
          [0.46, 1.04, 0.88, 0.13],
          [0.6, 0.98, 0.86, 0.12],
          [0.7, 0.92, 0.86, 0.08],
        ],
        "#4c5560",
        { n: 2.4, glass: true, cap: 0.2 },
      ),
    );
    // Tank (red), seat, a tail that sweeps up out of the tank.
    g.add(
      loft(
        [
          [-0.16, 0.96, 0.78, 0.14],
          [0.06, 1.02, 0.76, 0.17],
          [0.3, 1.0, 0.8, 0.16],
          [0.46, 0.92, 0.84, 0.12],
        ],
        R,
        { n: 2.8, rough: 0.3 },
      ),
    );
    g.add(
      loft(
        [
          [-0.94, 1.05, 0.99, 0.035],
          [-0.72, 1.01, 0.86, 0.085],
          [-0.42, 0.94, 0.76, 0.13],
          [-0.16, 0.9, 0.72, 0.15],
        ],
        R,
        { n: 2.8, cap: 0.4 },
      ),
    );
    g.add(
      loft(
        [
          [-0.46, 0.965, 0.88, 0.11],
          [-0.3, 0.955, 0.87, 0.125],
          [-0.16, 0.95, 0.86, 0.13],
        ],
        "#24252a",
        { n: 3.4 },
      ),
    );
    g.add(
      loft(
        [
          [-0.86, 1.0, 0.975, 0.075],
          [-0.6, 0.95, 0.92, 0.112],
        ],
        B,
        { n: 2.4 },
      ),
    );
    g.add(
      loft(
        [
          [-0.84, 0.97, 0.955, 0.08],
          [-0.58, 0.915, 0.9, 0.118],
        ],
        W,
        { n: 2.4 },
      ),
    );
    tailLight(g, [-0.92, 1.02, 0], 0.03);
    g.add(
      pipe(
        [
          [-0.6, 0.8, 0],
          [-0.86, 0.7, 0],
          [-0.94, 0.64, 0],
        ],
        0.01,
        BLACK,
      ),
    );
    plate(g, [-0.96, 0.6, 0], 0.5);
    // Big titanium can sweeping steeply up on the right.
    g.add(
      pipe(
        [
          [0.3, 0.3, 0.08],
          [0.16, 0.2, 0.14],
          [-0.02, 0.3, 0.19],
        ],
        0.026,
        "#7d7268",
        { metal: true, rough: 0.4 },
      ),
    );
    can(g, [-0.02, 0.3, 0.2], 0.56, 0.07, 0.6, "#b4b0aa", DARK);
    g.add(fender(0.72, 0.31, 0.34, 0.65, 1.8, 0.055, R));
    // Clip-ons and fairing mirrors.
    for (const s of [-1, 1]) {
      const end: V3 = [h.top.x - 0.1, h.top.y - 0.05, s * 0.3];
      g.add(pipe([[h.top.x - 0.01, h.top.y - 0.03, s * 0.09], end], 0.013, BLACK));
      g.add(
        cyl([end[0] + 0.02, end[1], s * 0.2], [end[0], end[1], s * 0.31], 0.019, TYRE, {
          rough: 0.9,
        }),
      );
      g.add(
        pipe(
          [
            [0.6, 0.9, s * 0.15],
            [0.58, 0.97, s * 0.24],
          ],
          0.008,
          BLACK,
        ),
      );
      g.add(ball([0.58, 0.98, s * 0.27], 0.05, W, undefined, [0.4, 0.55, 1]));
    }
    pegs(g, [-0.22, 0.48], 0.16);
    sideStand(g, [-0.1, 0.3]);
  },

  /** Personal: Harley Fat Boy-style. Black + gold two-tone, solid chrome wheels, fat tyres, chrome V-twin, shotgun pipes. */
  bobber(g) {
    const K = "#141518";
    const RW = 0.34;
    g.add(heroWheel(-0.8, { r: RW, tyre: 0.1, rim: CHROME, kind: "solid", disc: 0.14 }));
    g.add(heroWheel(0.86, { r: RW, tyre: 0.09, rim: CHROME, kind: "solid", disc: 0.15 }));
    g.add(caliper(0.86, RW, 0.15, 2.4, 0.11, CHROME));
    const h = frontEnd(
      g,
      {
        x: 0.86,
        r: RW,
        rake: 30,
        lo: 0.9,
        hi: 1.0,
        gap: 0.12,
        leg: 0.032,
        stanchion: CHROME,
        lower: CHROME,
      },
      CHROME,
    );
    // Fork shrouds (fat chrome covers) and headlamp nacelle.
    const P: V2 = [-0.24, 0.36];
    swingarm(g, P, -0.8, RW, 0.15, K, 0.03);
    // Belt drive (left).
    chain(g, [0.0, 0.32], 0.06, [-0.8, RW], 0.14, -0.15, "#2b2c30");
    both([[h.h1.x, h.h1.y], [0.2, 0.84], [-0.2, 0.74], [-0.28, 0.5], P], 0.07, 0.024, K);
    both(
      [[h.h0.x, h.h0.y], [0.46, 0.5], [0.4, 0.18], [0.0, 0.12], [-0.26, 0.2], P],
      0.08,
      0.024,
      K,
    );
    // Big V-twin: black case, chrome covers, two finned jugs in a 45° V.
    g.add(
      loft(
        [
          [-0.18, 0.36, 0.14, 0.13],
          [0.08, 0.4, 0.12, 0.15],
          [0.34, 0.36, 0.14, 0.12],
        ],
        K,
        { n: 3.2 },
      ),
    );
    for (const [a, b] of [
      [
        [0.12, 0.34, 0],
        [0.28, 0.66, 0],
      ],
      [
        [0.02, 0.34, 0],
        [-0.1, 0.66, 0],
      ],
    ] as [V3, V3][]) {
      g.add(fins(a, b, 0.085, "#25272b", 8));
      g.add(ball(b, 0.08, CHROME, { metal: true }, [1.2, 0.6, 1.3]));
    }
    {
      const part = lathe(
        [
          [0.001, 0],
          [0.11, 0],
          [0.12, 0.02],
          [0.11, 0.035],
          [0.001, 0.035],
        ],
        CHROME,
        { axis: "z", metal: true },
      );
      part.position.set(0.08, 0.26, 0.13);
      g.add(part);
    }
    g.add(ball([0.1, 0.5, 0.17], 0.08, CHROME, { metal: true }, [1.1, 1, 0.35]));
    // Shotgun pipes on the right: two straight-back chrome pipes.
    for (const [k, y] of [
      [0, 0.24],
      [1, 0.36],
    ] as [number, number][]) {
      g.add(
        pipe(
          [
            [k ? -0.06 : 0.28, k ? 0.6 : 0.62, 0.08],
            [k ? -0.04 : 0.36, 0.44 - k * 0.0, 0.14],
            [0.1, y, 0.2],
            [-0.4, y + 0.02, 0.22],
          ],
          0.028,
          CHROME,
          { metal: true },
        ),
      );
      can(g, [-0.38, y + 0.02, 0.22], 0.62, 0.042, 0.02, CHROME, DARK);
    }
    // Fat tank with chrome dash, low solo seat, wide bobbed fender.
    const GLD = "#9c8350";
    g.add(
      loft(
        [
          [-0.2, 0.86, 0.7, 0.13],
          [0.02, 0.94, 0.66, 0.19],
          [0.28, 0.92, 0.68, 0.18],
          [0.46, 0.84, 0.74, 0.12],
        ],
        K,
        { n: 2.6, rough: 0.25 },
      ),
    );
    g.add(
      loft(
        [
          [-0.16, 0.84, 0.69, 0.136],
          [0.04, 0.88, 0.67, 0.196],
          [0.28, 0.86, 0.69, 0.186],
          [0.42, 0.82, 0.74, 0.13],
        ],
        GLD,
        { n: 2.6, metal: true, rough: 0.4 },
      ),
    );
    g.add(
      loft(
        [
          [-0.12, 0.952, 0.93, 0.04],
          [0.22, 0.945, 0.92, 0.045],
        ],
        CHROME,
        { n: 2.4, metal: true },
      ),
    );
    g.add(ball([0.2, 0.95, 0], 0.045, "#e8e2d0", { emissive: true }, [1, 0.25, 1]));
    // Stepped two-up seat.
    g.add(
      loft(
        [
          [-0.5, 0.78, 0.7, 0.13],
          [-0.34, 0.74, 0.66, 0.17],
          [-0.18, 0.8, 0.7, 0.14],
        ],
        "#18191c",
        { n: 3.4 },
      ),
    );
    g.add(
      loft(
        [
          [-0.86, 0.84, 0.76, 0.1],
          [-0.68, 0.86, 0.76, 0.12],
          [-0.52, 0.82, 0.74, 0.12],
        ],
        "#18191c",
        { n: 3.4 },
      ),
    );
    // Gold fenders with a black band.
    g.add(fender(-0.8, RW, RW + 0.05, 0.25, 2.2, 0.12, GLD, { metal: true, rough: 0.4 }));
    g.add(fender(-0.8, RW, RW + 0.056, 0.4, 2.0, 0.035, K, { rough: 0.25 }));
    g.add(fender(0.86, RW, RW + 0.04, 0.7, 1.9, 0.1, GLD, { metal: true, rough: 0.4 }));
    tailLight(g, [-1.1, 0.6, 0], 0.035);
    plate(g, [-1.14, 0.48, 0.14], 0.1);
    // Big chrome headlamp in a nacelle, wide pull-back bars, floorboards.
    const lampAt: V3 = [h.top.x + 0.1, h.top.y - 0.09, 0];
    g.add(
      loft(
        [
          [h.top.x - 0.06, h.top.y + 0.02, h.top.y - 0.14, 0.12],
          [h.top.x + 0.04, h.top.y + 0.0, h.top.y - 0.16, 0.13],
        ],
        CHROME,
        { n: 2.6, metal: true },
      ),
    );
    headlamp(g, lampAt, 0.12, CHROME);
    for (const s of [-1, 1])
      g.add(
        ball(
          [lampAt[0] - 0.02, lampAt[1] - 0.06, s * 0.17],
          0.03,
          AMBER,
          { emissive: true },
          [1.3, 1, 1],
        ),
      );
    const ends = handlebar(g, h, 0.12, 0.2, 0.42, 0.04, CHROME);
    mirrors(g, ends, 0.2, CHROME);
    for (const s of [-1, 1])
      g.add(
        block([0.22, 0.26, s > 0 ? 0.18 : -0.34], [0.48, 0.29, s > 0 ? 0.34 : -0.18], K, {
          r: 0.012,
        }),
      );
    sideStand(g, [-0.12, 0.2]);
  },
};

/** Parked hero bike. lean leans it onto its side stand (−z side). */
export function heroBike(_kit: Kit, kind: BikeKind, lean = 0.07): THREE.Group {
  const inner = new THREE.Group();
  HERO[kind](inner);
  const g = new THREE.Group();
  inner.rotation.x = -lean;
  g.add(inner);
  return g;
}

export const HERO_KINDS: BikeKind[] = [
  "superbike",
  "rally",
  "cafe",
  "scrambler",
  "adv",
  "bobber",
  "classic",
];
