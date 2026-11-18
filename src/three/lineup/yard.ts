/**
 * The opening yard: Adit's dhaba yard on a raised diorama plot. Six bikes in
 * painted bays (names painted between the bay lines carried forward), the
 * secret bike on its own pad at the front right, a ramp off
 * the left edge (the way out), and a lived-in back: chai shop, a sign with his
 * name, tandoor, banyan on its katte, charpai, chairs and chai under string
 * lights, a dog asleep.
 *
 * Built in the flat-world language (see flat/kit): clay toys, unlit flat
 * shapes, cut-paper shadows. Static parts are built once; the bikes come back
 * as groups the scene can move.
 *
 * Layout uses a frame aligned with the camera: u runs across the screen, v
 * towards the camera (see `at`).
 */

import * as THREE from "three";
import type { BikeKind } from "../../content/types";
import { WORLDS, type WorldInfo } from "../../content/worlds";
import {
  circle,
  clay,
  flat,
  flatShape,
  mix,
  type Pt,
  paperShadow,
  placeStatic,
  rng,
  toClay,
  toy,
} from "../flat/kit";
import { heroBike } from "../lib/hero";
import { makeKit } from "../lib/kit";
import { GROUND, PASTEL as P } from "../lib/palette";
import { block, SAND } from "../lib/toys";
import { batch } from "../merge";

const INK = P.ink;
export const BASE = GROUND.garage;
export const OUTSIDE = mix(BASE, "#ffffff", 0.35);
export const YARD = mix(BASE, SAND, 0.3);

/** Left to right in the bays; the secret bike stands apart. */
export const ORDER: BikeKind[] = ["scrambler", "cafe", "superbike", "rally", "adv", "bobber"];
export const SECRET: BikeKind = "classic";
export const ALL: BikeKind[] = [...ORDER, SECRET];
export const COLOUR: Record<BikeKind, string> = {
  scrambler: P.rose,
  cafe: P.coral,
  superbike: P.lavender,
  rally: P.marigold,
  adv: P.aqua,
  bobber: P.pistachio,
  classic: P.mint,
};
export const infoOf = (k: BikeKind) => WORLDS.find((w) => w.bike.kind === k) as WorldInfo;

// ── the frame ────────────────────────────────────────────────────────────

/** The camera looks from the south-east; u is screen-right, v is towards the camera. */
export const YAW = Math.PI / 4;
export const RIGHT: Pt = [Math.cos(YAW), -Math.sin(YAW)];
export const TOWARD: Pt = [Math.sin(YAW), Math.cos(YAW)];
export const at = (u: number, v: number): Pt => [
  RIGHT[0] * u + TOWARD[0] * v,
  RIGHT[1] * u + TOWARD[1] * v,
];
/** Yaw for a +x-facing model (bikes, Adit) to point along (du, dv) in the frame. */
export const heading = (du: number, dv: number): number => {
  const x = RIGHT[0] * du + TOWARD[0] * dv;
  const z = RIGHT[1] * du + TOWARD[1] * dv;
  return Math.atan2(-z, x);
};
/** Parked: facing the camera, turned a little to show the side. */
export const PARKED = heading(0.55, 1);

// ── the layout ───────────────────────────────────────────────────────────

export const LIFT = 0.6;
export const U = 13;
export const V0 = -8.2;
export const V1 = 6.6;
export const SPACING = 2.4;
export const bayU = (i: number) => (i - (ORDER.length - 1) / 2) * SPACING;
export const BAY_V = -1.7;
/** Bay lines lean; names sit between the lines carried forward. */
export const LEAN = 0.35;
const LINE_V = BAY_V + 0.1;
const NAME_V = 0.85;
export const SECRET_AT: Pt = [9.4, 3.9];
export const PAD = 0.12;
export const RAMP = { v: 2.4, len: 4.6, w: 2.6 };
/** How far a picked bike rolls forward. */
export const PULL = 1.6;
export const BIKE_SCALE = 1.25;
/** Where Adit waits. */
export const ADIT_AT: Pt = [SPACING / 2, 3.3];

/**
 * Where a bike stands when picked and `pull` metres out of its bay: it rolls
 * out parallel to the bay's (leaning) lines, not straight at the camera.
 */
export function pulled(k: BikeKind, pull: number): Pt {
  const [u, v] = home(k);
  return [u + pull * Math.sin(LEAN), v + pull * Math.cos(LEAN)];
}

/** Where a bike rests: [u, v]. */
export function home(k: BikeKind): Pt {
  return k === SECRET ? SECRET_AT : [bayU(ORDER.indexOf(k)), BAY_V];
}

// ── small builders ───────────────────────────────────────────────────────

function tint(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const f = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex);
  const n = (f.attributes.position as THREE.BufferAttribute).count;
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3);
  f.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  if (f.attributes.uv) f.deleteAttribute("uv");
  return f;
}

/** Text painted flat on the ground, reading across the screen. */
function painted(
  text: string,
  x: number,
  z: number,
  y: number,
  width: number,
  colour: string,
): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  let size = 170;
  do {
    g.font = `800 ${size}px Outfit, sans-serif`;
    size -= 6;
  } while (g.measureText(text).width > 960 && size > 40);
  g.fillStyle = colour;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 512, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 4),
    flat("#ffffff", { map: t, transparent: true, depthWrite: false }),
  );
  m.rotation.order = "YXZ";
  m.rotation.set(-Math.PI / 2, YAW, 0);
  m.position.set(x, y + 0.008, z);
  m.userData.noShadow = true;
  return m;
}

/** A rounded rectangle in the frame, centred at (cu, cv), turned by `turn`. */
function rounded(cu: number, cv: number, w: number, d: number, r: number, turn = 0): Pt[] {
  const pts: Pt[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(w / 2 - r, d / 2 - r, 0);
  corner(-w / 2 + r, d / 2 - r, Math.PI / 2);
  corner(-w / 2 + r, -d / 2 + r, Math.PI);
  corner(w / 2 - r, -d / 2 + r, (3 * Math.PI) / 2);
  const ct = Math.cos(turn);
  const st = Math.sin(turn);
  return pts.map(([u, v]) => at(cu + u * ct - v * st, cv + u * st + v * ct));
}

/** A raised block: a flat top on straight sides. */
function raised(shape: Pt[], top: string, side: string, h: number, y0 = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(flatShape(shape, top, y0 + h));
  const pos: number[] = [];
  const idx: number[] = [];
  [...shape, shape[0] as Pt].forEach(([x, z], i) => {
    pos.push(x, y0, z, x, y0 + h, z);
    if (i) idx.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  g.add(new THREE.Mesh(geo, flat(side, { side: THREE.DoubleSide })));
  return g;
}

// ── the yard ─────────────────────────────────────────────────────────────

export interface Yard {
  /** Everything static, already shadowed. */
  root: THREE.Group;
  /** One parked bike per kind (positioned at home; the scene moves them). */
  bikes: Map<BikeKind, THREE.Group>;
  /** The clay material's matcap (for anything added later, like Adit). */
  matcap: THREE.Texture;
}

/** A parked bike: the garage's hero bike (no rider), clay-shaded, on its side stand. */
export function parkedBike(kind: BikeKind, matcap: THREE.Texture, lean = 0.07): THREE.Group {
  const b = heroBike(makeKit("smooth"), kind, lean);
  b.scale.setScalar(BIKE_SCALE);
  toClay(b, matcap);
  // One draw per material kind instead of one per part (a hero bike has hundreds);
  // the inner model stays its own group, as the side-stand lean turns it.
  const inner = b.children[0];
  return batch(b, (o) => o === inner);
}

export function buildYard(): Yard {
  const root = new THREE.Group();
  const mat = clay(BASE);
  const matcap = mat.matcap as THREE.Texture;
  const y0 = LIFT;
  const shadowOn = (under: string, floor: number) =>
    paperShadow(mix(under, INK, 0.14), floor + 0.012);
  const yardShadow = shadowOn(YARD, y0);
  const put = (obj: THREE.Object3D, s = yardShadow) => placeStatic(root, obj, s);
  const part = (
    g: THREE.BufferGeometry,
    hex: string,
    x = 0,
    y = 0,
    z = 0,
    ry = 0,
    rx = 0,
    rz = 0,
  ) => {
    const m = new THREE.Mesh(tint(g, hex), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    return m;
  };
  const cyl = (r: number, h: number, seg = 14) => {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
    g.translate(0, h / 2, 0);
    return g;
  };
  const sph = (r: number, sx = 1, sy = 1, sz = 1) => {
    const g = new THREE.SphereGeometry(r, 18, 12);
    g.scale(sx, sy, sz);
    return g;
  };
  const thing = (p: Pt, yaw: number, parts: THREE.Object3D[], y = y0) => {
    const g = new THREE.Group();
    g.add(...parts);
    g.position.set(p[0], y, p[1]);
    g.rotation.y = yaw;
    return g;
  };
  const piece = (id: string, p: Pt, yaw = 0, scale = 1, tintName?: string) => {
    const m = new THREE.Mesh(toy(id, tintName), mat);
    m.position.set(p[0], y0, p[1]);
    m.rotation.y = yaw;
    m.scale.setScalar(scale);
    return m;
  };

  // The ground beyond, the plot, the steps and the ramp.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), flat(OUTSIDE));
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);
  root.add(raised(rounded(0, (V0 + V1) / 2, U * 2, V1 - V0, 1.8), YARD, mix(YARD, INK, 0.2), LIFT));
  for (let k = 0; k < 3; k++)
    root.add(
      raised(
        rounded(0, V1 + 0.2 + k * 0.2, 3, 0.4 + k * 0.4 + 0.4, 0.05),
        mix(YARD, P.stone, 0.4),
        mix(YARD, INK, 0.2),
        LIFT - (k + 1) * 0.15,
      ),
    );
  {
    const len = RAMP.len;
    const h = LIFT;
    const w = RAMP.w;
    const shape = new THREE.Shape([
      new THREE.Vector2(-len / 2, 0),
      new THREE.Vector2(len / 2, h),
      new THREE.Vector2(len / 2, 0),
    ]);
    const body = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    body.translate(0, 0, -w / 2);
    const ramp = new THREE.Group();
    ramp.add(part(body, P.clay));
    const slope = Math.atan2(h, len);
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7;
      ramp.add(
        part(
          block(len / 7 - 0.08, 0.03, w * 0.96, P.marigold, 0.01),
          i % 2 ? P.marigold : mix(P.clay, P.marigold, 0.4),
          -len / 2 + len * t,
          h * t + 0.005,
          0,
          0,
          0,
          slope,
        ),
      );
    }
    for (const s of [-1, 1])
      ramp.add(
        part(
          block(Math.hypot(len, h), 0.12, 0.1, P.cream, 0.04),
          P.cream,
          0,
          h / 2 + 0.03,
          s * (w / 2 - 0.05),
          0,
          0,
          slope,
        ),
      );
    const [x, z] = at(-U - len / 2 + 0.05, RAMP.v);
    ramp.position.set(x, 0, z);
    ramp.rotation.y = heading(1, 0);
    put(ramp, shadowOn(OUTSIDE, 0));
  }

  // The apron, the painted bays and the names between the lines.
  root.add(
    flatShape(
      rounded(0, BAY_V + 0.2, ORDER.length * SPACING + 1.6, 5.2, 1),
      mix(YARD, P.stone, 0.6),
      y0 + 0.004,
    ),
  );
  const slant = Math.tan(LEAN);
  for (let i = 0; i <= ORDER.length; i++)
    root.add(
      flatShape(
        rounded(bayU(i) - SPACING / 2, LINE_V, 0.08, 3.4, 0.03, -LEAN),
        P.cream,
        y0 + 0.006,
      ),
    );
  ORDER.forEach((k, i) => {
    const u = bayU(i) + (NAME_V - LINE_V) * slant;
    root.add(
      painted(infoOf(k).name.toUpperCase(), ...at(u, NAME_V), y0, 1.75, mix(COLOUR[k], INK, 0.3)),
    );
  });

  // The secret bike's pad and its name.
  const padTop = mix(COLOUR[SECRET], "#ffffff", 0.2);
  {
    const [x, z] = at(...SECRET_AT);
    root.add(flatShape(circle(x, z, 1.95), mix(YARD, COLOUR[SECRET], 0.3), y0 + 0.003));
    root.add(raised(circle(x, z, 1.7), padTop, mix(COLOUR[SECRET], INK, 0.2), PAD, y0));
    root.add(
      painted(
        "SECRET",
        ...at(SECRET_AT[0], SECRET_AT[1] + 2.3),
        y0,
        1.6,
        mix(COLOUR[SECRET], INK, 0.35),
      ),
    );
  }

  // The back: chai shop, the sign with his name, tandoor, cylinders, crates, cottage.
  put(piece("H4", at(-2, -6.2), heading(0, 1), 1.6));
  put(piece("H1", at(6.2, -6.4), heading(0, 1), 1.3));
  {
    const g = new THREE.Group();
    g.add(
      part(cyl(0.06, 2.6), P.clay, -1.3, 0, 0),
      part(cyl(0.06, 2.6), P.clay, 1.3, 0, 0),
      part(block(3.1, 0.95, 0.12, P.marigold, 0.05), P.marigold, 0, 1.75, 0),
    );
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 300;
    const k = c.getContext("2d") as CanvasRenderingContext2D;
    k.fillStyle = INK;
    k.textAlign = "center";
    k.textBaseline = "middle";
    k.font = "900 150px Outfit, sans-serif";
    k.fillText("ADIT JAIN", 512, 155);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 0.85),
      flat("#ffffff", { map: t, transparent: true }),
    );
    face.position.set(0, 2.22, 0.07);
    face.userData.noShadow = true;
    g.add(face);
    const [x, z] = at(2.2, -5.4);
    g.position.set(x, y0, z);
    g.rotation.y = YAW;
    put(g);
  }
  {
    const lathe = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.45, 0],
        [0.5, 0.35],
        [0.42, 0.75],
        [0.25, 0.8],
        [0.22, 0.72],
      ].map(([a, b]) => new THREE.Vector2(a, b)),
      20,
    );
    put(thing(at(-5.1, -5.4), 0, [part(lathe, P.clay)]));
  }
  {
    const parts: THREE.Object3D[] = [];
    for (const [a, b] of [
      [0, 0],
      [0.42, 0.1],
    ] as const)
      parts.push(
        part(cyl(0.17, 0.62), P.coral, a, 0, b),
        part(sph(0.17, 1, 0.6, 1), P.coral, a, 0.62, b),
        part(cyl(0.05, 0.12, 8), INK, a, 0.68, b),
      );
    put(thing(at(-6.2, -6.1), 0.3, parts));
  }
  {
    const parts: THREE.Object3D[] = [];
    for (const [a, y, col] of [
      [0, 0, P.aqua],
      [0.62, 0, P.marigold],
      [0.3, 0.36, P.aqua],
    ] as const) {
      parts.push(part(block(0.58, 0.34, 0.42, col, 0.04), col, a, y, 0));
      for (let i = 0; i < 6; i++)
        parts.push(
          part(
            cyl(0.035, 0.1, 6),
            i % 2 ? P.fern : INK,
            a - 0.18 + (i % 3) * 0.18,
            y + 0.34,
            -0.09 + Math.floor(i / 3) * 0.18,
          ),
        );
    }
    put(thing(at(1.4, -6.6), YAW, parts));
  }
  // The left: the banyan on its katte, a charpai in its shade, a dog asleep.
  put(piece("T9", at(-10, -5.2), 0.2, 1.3));
  put(piece("katte", at(-10, -5.2), 0.2, 1.0));
  {
    const parts: THREE.Object3D[] = [
      part(block(1.9, 0.08, 0.95, P.cream, 0.03), P.cream, 0, 0.42, 0),
    ];
    for (const [a, b] of [
      [-0.88, -0.42],
      [0.88, -0.42],
      [-0.88, 0.42],
      [0.88, 0.42],
    ] as const)
      parts.push(part(cyl(0.05, 0.45), P.clay, a, 0, b));
    for (const b of [-0.45, 0.45])
      parts.push(part(block(1.95, 0.08, 0.08, P.clay, 0.02), P.clay, 0, 0.38, b));
    put(thing(at(-10, -1.4), YAW + 0.3, parts));
  }
  {
    const c = "#e2b07d";
    put(
      thing(at(-8.3, -0.2), 1.2, [
        part(sph(0.42, 1.15, 0.5, 0.95), c, 0, 0.2, 0),
        part(sph(0.17, 1.2, 0.85, 1), c, 0.32, 0.18, 0.28),
        part(sph(0.08, 0.6, 1, 1.2), mix(c, INK, 0.3), 0.26, 0.3, 0.38),
      ]),
    );
  }
  // The right: the chai cart, the well, chairs and chai under string lights.
  put(piece("C1", at(10.4, -5.2), heading(-1, 0.4), 1.1));
  put(piece("well", at(11.3, -2.8), 0, 0.9));
  put(
    thing(at(9.3, -0.4), 0, [
      part(cyl(0.48, 0.05, 24), P.cream, 0, 0.72, 0),
      part(cyl(0.05, 0.72), P.cream),
      part(cyl(0.25, 0.04, 16), P.cream),
      part(cyl(0.05, 0.12, 10), P.marigold, 0.15, 0.77, 0.1),
      part(cyl(0.05, 0.12, 10), P.marigold, -0.12, 0.77, -0.08),
    ]),
  );
  for (const [u, v, yaw, col] of [
    [8.6, -0.9, YAW + 0.6, P.coral],
    [10.1, 0.1, YAW + Math.PI + 0.4, P.aqua],
    [10.2, -1.4, YAW + 2, P.coral],
  ] as const) {
    const parts: THREE.Object3D[] = [
      part(block(0.5, 0.06, 0.5, col, 0.03), col, 0, 0.42, 0),
      part(block(0.5, 0.5, 0.06, col, 0.03), col, 0, 0.46, -0.24),
    ];
    for (const [a, b] of [
      [-0.21, -0.21],
      [0.21, -0.21],
      [-0.21, 0.21],
      [0.21, 0.21],
    ] as const)
      parts.push(part(cyl(0.025, 0.43, 8), col, a, 0, b));
    put(thing(at(u, v), yaw, parts));
  }
  {
    const poles = [at(7.6, 1.2), at(7.6, -3.4), at(12, -3.4)];
    for (const p of poles) put(thing(p, 0, [part(cyl(0.05, 2.9), P.clay)]));
    const bulbs = [P.marigold, "#fff3c8", P.coral, P.aqua].map((c) => flat(c));
    for (let i = 0; i < poles.length - 1; i++) {
      const [ax, az] = poles[i] as Pt;
      const [bx, bz] = poles[i + 1] as Pt;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        pts.push(
          new THREE.Vector3(
            ax + (bx - ax) * t,
            y0 + 2.85 - Math.sin(t * Math.PI) * 0.45,
            az + (bz - az) * t,
          ),
        );
      }
      root.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 4),
          flat(INK),
        ),
      );
      for (let k = 1; k < 20; k += 2) {
        const b = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 10, 8),
          bulbs[(k + i) % 4] as THREE.Material,
        );
        b.position.copy(pts[k] as THREE.Vector3).y -= 0.08;
        root.add(b);
      }
    }
  }
  put(piece("S2", at(-4.6, 4.8), YAW, 1));
  put(piece("B9", at(-2.6, 5.7), 0, 1, "marigold"));
  put(piece("B9", at(4.2, 5.5), 0, 1, "rose"));
  for (const [id, u, v, sc, t] of [
    ["T1", -12, -7.2, 1.1, "fern"],
    ["T5", 12, -7.3, 1, "mint"],
    ["T2", -12.2, 5.4, 0.9, "pistachio"],
  ] as const)
    put(piece(id, at(u, v), 0.4, sc, t));

  // Grass tufts, away from the busy middle and the ramp.
  {
    const blade = new THREE.ConeGeometry(0.035, 0.32, 3);
    blade.translate(0, 0.16, 0);
    const pos: number[] = [];
    for (const [a, t] of [
      [0, 0],
      [2.1, 0.35],
      [4.2, -0.35],
    ] as const) {
      const b = blade.clone();
      b.rotateZ(t);
      b.rotateY(a);
      pos.push(...(b.toNonIndexed().attributes.position as THREE.BufferAttribute).array);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const r = rng(21);
    const list: Pt[] = [];
    const ok = (u: number, v: number) =>
      Math.abs(u) < U - 0.8 &&
      v > -4.4 &&
      v < V1 - 0.8 &&
      !(Math.abs(u) < 8.4 && v < 1.6) &&
      !(u > 7 && v < 6) &&
      !(u < -9 && Math.abs(v - RAMP.v) < 1.6) &&
      !(Math.abs(v - RAMP.v) < 1.4);
    for (let i = 0; i < 3000 && list.length < 150; i++) {
      const u = (r() - 0.5) * 26;
      const v = -8 + r() * 14.6;
      if (ok(u, v)) list.push(at(u, v));
    }
    const mesh = new THREE.InstancedMesh(geo, flat(mix(YARD, P.fern, 0.5)), list.length);
    const m4 = new THREE.Matrix4();
    list.forEach(([x, z], i) => {
      const s = 0.8 + r() * 0.5;
      mesh.setMatrixAt(i, m4.makeScale(s, s, s).setPosition(x, y0, z));
    });
    root.add(mesh);
  }

  // The bikes, parked at home.
  const bikes = new Map<BikeKind, THREE.Group>();
  for (const k of ALL) {
    const b = parkedBike(k, matcap);
    const [x, z] = at(...home(k));
    b.position.set(x, y0 + (k === SECRET ? PAD : 0), z);
    b.rotation.y = PARKED;
    bikes.set(k, b);
  }
  // Everything static drawn in a handful of calls (parts and their shadows merged by material).
  return { root: batch(root), bikes, matcap };
}
