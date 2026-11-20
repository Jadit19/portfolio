/**
 * Zingle's landmarks and set pieces (a Thar desert rally), ported from the approved design
 * board (design/3d/zingle-board.ts): every stop is real Rajasthani heritage in the world's own
 * palette (sandstone, terracotta, cream, lime-wash). Built in local frames facing +z, standing on
 * y = 0, at the bike's true scale.
 */

import * as THREE from "three";
import { lightToys, mix } from "../flat/kit";
import type { Lamp } from "../flat/night";
import { board, type Landmark } from "./landmarks";
import { join, paint } from "./nature";
import { PASTEL as P } from "./palette";
import { at, ball, drum, LANDSCAPE, lathe, rbox } from "./toys";

type G = THREE.BufferGeometry;
export type Pt = [number, number];

const PEACH = P.peach;

const ROSE = "#f3d2cc";

const INK = "#2b2433";

const RED = "#e2564b";

const WHITE = "#ffffff";

function clean(g: G): G {
  const f = g.index ? g.toNonIndexed() : g;
  if (f.attributes.uv) f.deleteAttribute("uv");
  if (!f.attributes.normal) f.computeVertexNormals();
  return f;
}

function flatPoly(pts: Pt[], y: number, hex: string, holes: Pt[][] = []): G {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ShapeGeometry(s, 6);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return paint(clean(g), hex);
}

function chaikin(pts: Pt[], iters = 3, closed = true): Pt[] {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const out: Pt[] = closed ? [] : [p[0] as Pt];
    const n = closed ? p.length : p.length - 1;
    for (let i = 0; i < n; i++) {
      const a = p[i] as Pt;
      const b = p[(i + 1) % p.length] as Pt;
      out.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
      );
    }
    if (!closed) out.push(p[p.length - 1] as Pt);
    p = out;
  }
  return p;
}

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** A flat band (painted line) along a polyline at height y. */
function band(pts: Pt[], half: number, y: number, hex: string): G {
  const pos: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i] as Pt;
    const [bx, bz] = pts[i + 1] as Pt;
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (-(bz - az) / l) * half;
    const nz = ((bx - ax) / l) * half;
    pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
    pos.push(ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return paint(g, hex);
}

/**
 * While a landmark is built for the world, the trees standing on the ground in it are taken out
 * and listed here instead (the world puts them back as toys the bike can knock over).
 */
let looseTrees: { id: string; x: number; z: number; s: number }[] | null = null;

/** Khejri: the Thar's tree — a short twisted trunk, a flat, wide, feathery crown. */
function khejri(x: number, z: number, s = 1): G[] {
  if (looseTrees) {
    looseTrees.push({ id: "zkhejri", x, z, s });
    return [];
  }
  const out: G[] = [
    at(drum(0.28 * s, 2.2 * s, "#8a6248", 0.05, 8), x, 0, z, 0, 0, 0.1),
    at(drum(0.12 * s, 1.1 * s, "#8a6248", 0.03, 6), x + 0.3 * s, 1.8 * s, z, 0, 0, -0.7),
  ];
  for (const [dx, dz, r, c] of [
    [0, 0, 1.2, "#86ad66"],
    [1.1, 0.3, 0.9, "#9cc07a"],
    [-0.9, 0.5, 0.95, "#8fb56d"],
    [0.2, -0.9, 0.85, "#a6c784"],
    [0.4, 0.2, 0.8, "#b4d18e"],
  ] as const)
    out.push(
      at(ball(r * s, c, 1.2, 0.6, 1.1), x + dx * s, 2.1 * s + (r > 1 ? 0 : 0.35 * s), z + dz * s),
    );
  return out;
}

/** A bivouac: rows of dome tents, support trucks, spare wheels, a campfire. */
function bivouac(): { parts: G[]; lamps: Lamp[] } {
  const parts: G[] = [];
  const lamps: Lamp[] = [];
  const cols = [P.coral, P.aqua, P.marigold, WHITE, P.lavender];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++)
      parts.push(
        at(ball(1.1, cols[(i + j) % cols.length] as string, 1.2, 0.85, 1), i * 3.4, 0, j * 3.4),
      );
  const truck = (x: number, z: number, c: string) => {
    parts.push(
      at(rbox(2.4, 2.2, 2.4, c, 0.15), x + 3, 0.4, z),
      at(rbox(4.5, 2.6, 2.4, mix(c, WHITE, 0.4), 0.12), x - 0.6, 0.4, z),
    );
    for (const wx of [-2, 0.4, 3.2])
      for (const s of [-1, 1])
        parts.push(
          at(
            drum(0.55, 0.4, INK, 0.08, 14).translate(0, -0.2, 0),
            x + wx,
            0.55,
            z + s * 1.1,
            0,
            Math.PI / 2,
          ),
        );
  };
  truck(-8, 2, P.coral);
  truck(-8, 7.5, P.marigold);
  for (let k = 0; k < 4; k++)
    parts.push(
      at(
        lathe(
          [
            [0.35, 0],
            [0.55, 0.05],
            [0.55, 0.3],
            [0.35, 0.35],
          ],
          INK,
          14,
        ),
        15,
        k * 0.36,
        9,
      ),
    );
  parts.push(
    at(
      lathe(
        [
          [0, 0],
          [0.5, 0],
          [0.1, 0.9],
          [0, 1],
        ],
        P.coral,
        8,
      ),
      5,
      0,
      12,
    ),
    at(drum(0.9, 0.2, "#8a7a6a", 0.05, 10), 5, 0, 12),
  );
  lamps.push({ x: 5, y: 0.8, z: 12, r: 9 });
  for (let i = 0; i < 4; i++) lamps.push({ x: i * 3.4, y: 1, z: 3.4, r: 4 });
  return { parts, lamps };
}

/** A resting camel (legs folded), saddle cloth and tassels; head up. */
function camel(x: number, z: number, yaw: number, cloth: string): G[] {
  const C = "#d9a873";
  return [
    at(ball(0.75, C, 1.6, 0.55, 0.85), 0, 0, 0),
    at(ball(0.55, C, 1, 0.9, 0.8), -0.1, 0.55, 0),
    at(rbox(1.3, 0.12, 1.5, cloth, 0.04), -0.1, 0.95, 0),
    at(ball(0.18, cloth === P.coral ? P.marigold : P.coral, 1, 1, 1), -0.1, 0.85, 0.75),
    at(ball(0.18, cloth === P.coral ? P.marigold : P.coral, 1, 1, 1), -0.1, 0.85, -0.75),
    at(ball(0.18, C, 1, 3.4, 1), 1.15, 0.35, 0, 0, 0, -0.5),
    at(ball(0.26, C, 1.7, 0.9, 0.9), 1.55, 1.45, 0),
  ].map((g) => at(g, x, 0, z, yaw));
}

/** Solar farm: rows of tilted panels. */
function solar(cols: number, rows: number): G[] {
  const out: G[] = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      out.push(at(rbox(3.2, 0.08, 1.8, "#2e4f8f", 0.02), i * 3.6, 1.1, j * 3, 0, 0.45));
      out.push(at(drum(0.05, 1.1, "#9a93ad", 0.01, 6), i * 3.6, 0, j * 3));
    }
  return out;
}

/** A wind turbine (24 m tower), blades turned by `a`. */
function turbine(a: number): G[] {
  const out: G[] = [
    at(drum(0.6, 24, WHITE, 0.05, 14).scale(1, 1, 1), 0, 0, 0),
    at(rbox(1.2, 1, 2.6, WHITE, 0.2), 0, 24, 0.3),
  ];
  for (let k = 0; k < 3; k++) {
    const b = rbox(0.5, 11, 0.12, WHITE, 0.06);
    out.push(at(b, 0, 24.5, 1.7, 0, 0, a + (k * Math.PI * 2) / 3));
  }
  return out;
}

/** Roadbook course dressing: a km stone, an arrow board, a CP flag pair. */
function kmStone(x: number, z: number, yaw: number): G[] {
  return [
    at(rbox(0.5, 0.75, 0.2, WHITE, 0.06), x, 0, z, yaw),
    at(
      lathe(
        [
          [0.25, 0],
          [0.25, 0.1],
          [0.12, 0.3],
          [0, 0.32],
        ],
        P.marigold,
        12,
      ).scale(1, 1, 0.4),
      x,
      0.75,
      z,
      yaw,
    ),
  ];
}

function arrowBoard(x: number, z: number, yaw: number): G[] {
  return [
    at(drum(0.05, 1.6, INK, 0.01, 6), x, 0, z),
    at(rbox(1.2, 0.8, 0.06, P.marigold, 0.03), x, 1.3, z, yaw),
    at(rbox(0.6, 0.12, 0.08, INK, 0.02), x, 1.7, z, yaw),
  ];
}

function cpFlags(x: number, z: number, yaw: number): G[] {
  const out: G[] = [];
  for (const s of [-1, 1]) {
    const dx = Math.cos(yaw) * s * 3.5;
    const dz = -Math.sin(yaw) * s * 3.5;
    out.push(
      at(drum(0.05, 2.6, INK, 0.01, 6), x + dx, 0, z + dz),
      at(rbox(0.05, 0.8, 1.2, s > 0 ? RED : WHITE, 0.02), x + dx, 1.7, z + dz - 0.6, yaw),
    );
  }
  return out;
}

/** The salt pan: white, cracked into polygons. */
function saltPan(cx: number, cz: number, rx: number, rz: number): G[] {
  const r = rng(13);
  const out: Pt[] = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    out.push([
      cx + Math.cos(a) * rx * (0.85 + r() * 0.2),
      cz + Math.sin(a) * rz * (0.85 + r() * 0.2),
    ]);
  }
  const parts: G[] = [flatPoly(chaikin(out, 3), 0.03, "#fbf7f2")];
  for (let i = 0; i < 70; i++) {
    const x = cx + (r() - 0.5) * rx * 1.6;
    const z = cz + (r() - 0.5) * rz * 1.6;
    if (((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 > 0.7) continue;
    const a = r() * Math.PI;
    parts.push(
      band(
        [
          [x, z],
          [x + Math.cos(a) * 3, z + Math.sin(a) * 3],
        ],
        0.06,
        0.05,
        "#e5ddd2",
      ),
    );
  }
  return parts;
}

const insidePoly = (o: Pt[], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const [xi, zi] = o[i] as Pt;
    const [xj, zj] = o[j] as Pt;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};

/** Ripple bands (D2), kept only where `keep` says (runs of a band, cut where it leaves). */
function ripplesWhere(
  x0: number,
  z0: number,
  w: number,
  d: number,
  ground: string,
  keep: (x: number, z: number) => boolean,
  y = 0,
): G[] {
  const out: G[] = [];
  for (let z = z0; z < z0 + d; z += 2.2) {
    let run: Pt[] = [];
    const flush = () => {
      if (run.length > 2)
        out.push(
          band(run, 0.45, 0.03 + y, mix(ground, "#f0a86a", 0.3)),
          band(
            run.map(([x, zz]) => [x, zz - 0.5]),
            0.11,
            0.05 + y,
            mix(ground, WHITE, 0.5),
          ),
        );
      run = [];
    };
    for (let x = x0; x <= x0 + w; x += 1.2) {
      const p: Pt = [x, z + Math.sin(x / 5 + z) * 0.8 + Math.sin(x / 13) * 1.5];
      if (keep(p[0], p[1])) run.push(p);
      else flush();
    }
    flush();
  }
  return out;
}

/** A blob's outline (D3). */
function blobOutline(cx: number, cz: number, R: number, seed: number): Pt[] {
  const r = rng(seed);
  const pts: Pt[] = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const rr = R * (0.75 + r() * 0.4);
    pts.push([cx + Math.cos(a) * rr * 1.5, cz + Math.sin(a) * rr]);
  }
  return chaikin(pts, 3);
}

/** A vertical wall from a 2D profile (u along x, v up), d thick along z, centred on z. */
function profileWall(pts: Pt[], d: number, hex: string, holes: Pt[][] = []): G {
  const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  for (const h of holes)
    shape.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 1,
    curveSegments: 16,
  });
  g.translate(0, 0, -d / 2);
  return paint(clean(g), hex);
}

const arch = (u: number, v: number, w: number, h: number): Pt[] => {
  const out: Pt[] = [
    [u - w / 2, v],
    [u + w / 2, v],
    [u + w / 2, v + h - w / 2],
  ];
  for (let k = 1; k < 8; k++) {
    const a = (k / 8) * Math.PI;
    out.push([u + Math.cos(a) * (w / 2), v + h - w / 2 + Math.sin(a) * (w / 2)]);
  }
  out.push([u - w / 2, v + h - w / 2]);
  return out;
};

// Hawa Mahal: the Palace of Winds — a pink sandstone screen rising in tiers of bay windows
// (jharokhas) to a peak, each bay with a lattice window and a little domed cap. Facing +z.
const HAWA = "#eba58c";

const HAWA_D = "#d98a70";

const HAWA_L = "#f7e3d6";

function hawaMahal(): { parts: G[]; lamps: Lamp[] } {
  const parts: G[] = [];
  const lamps: Lamp[] = [];
  const BW = 1.5; // bay width
  const BH = 2.1; // tier height
  // Tiers from the ground up: how many bays wide each is.
  const tiers = [15, 15, 13, 11, 9, 7, 5];
  // The plain lower storey and the body behind the bays.
  parts.push(at(rbox((tiers[0] as number) * BW + 1, BH * 1.4, 3.2, HAWA_D, 0.08), 0, 0, -0.6));
  for (let t = 0; t < tiers.length; t++) {
    const n = tiers[t] as number;
    const y = BH * 1.4 + t * BH;
    const w = n * BW;
    parts.push(at(rbox(w, BH, 2.2, HAWA, 0.06), 0, y, -1));
    parts.push(at(rbox(w + 0.3, 0.16, 2.6, HAWA_L, 0.04), 0, y, -0.8)); // a pale string course
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * BW;
      // Every other bay projects as a rounded jharokha; between them, flat lattice panels.
      const proud = i % 2 === 0;
      if (proud) {
        parts.push(at(drum(0.62, BH * 0.78, HAWA, 0.08, 10).scale(1, 1, 0.7), x, y + 0.12, 0.3));
        parts.push(
          at(
            lathe(
              [
                [0, 0],
                [0.7, 0],
                [0.62, 0.25],
                [0.35, 0.5],
                [0.08, 0.62],
                [0, 0.72],
              ],
              HAWA_L,
              12,
            ).scale(1, 1, 0.75),
            x,
            y + BH * 0.84,
            0.3,
          ),
        );
        parts.push(at(rbox(0.6, 0.85, 0.08, "#b8674f", 0.03), x, y + 0.55, 0.78));
        if ((i + t) % 3 === 0) lamps.push({ x, y: y + 1, z: 1.2, r: 2.2 });
      } else parts.push(at(rbox(0.7, 1, 0.08, "#c47a60", 0.03), x, y + 0.5, 0.12));
    }
  }
  // The crown: three peaked domes along the top tier.
  const yTop = BH * 1.4 + tiers.length * BH;
  for (const [x, s] of [
    [0, 1.3],
    [-2.2, 0.9],
    [2.2, 0.9],
  ] as const)
    parts.push(
      at(
        lathe(
          [
            [0, 0],
            [0.9, 0],
            [0.8, 0.4],
            [0.4, 0.9],
            [0.1, 1.2],
            [0, 1.5],
          ],
          HAWA_L,
          14,
        ).scale(s, s, s * 0.8),
        x,
        yTop,
        -0.6,
      ),
    );
  // The paved forecourt.
  parts.push(at(rbox((tiers[0] as number) * BW + 6, 0.25, 9, "#e4b39b", 0.06), 0, 0, 2));
  return { parts, lamps };
}

// The fort, reworked from Adit's references (Gwalior's Man Mandir, Amer): not round or
// symmetric. An irregular hill in terraces; a crenellated outer wall that snakes along the
// hill's edge with square bastions and a gatehouse; a second wall higher up; a palace cluster of
// unequal blocks (an arcaded Amer-style front with domed corner kiosks, Gwalior-style round
// towers with blue tile bands and domed chhatris); a walled zig-zag ramp up to the gate; a lake
// moat at the foot with a little island garden.

/** A crenellated wall along a polyline (open), standing on y0. */
function wallAlong(pts: Pt[], y0: number, h: number, c: string, d: string): G[] {
  const out: G[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i] as Pt;
    const [bx, bz] = pts[i + 1] as Pt;
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = -Math.atan2(bz - az, bx - ax);
    out.push(at(rbox(len + 0.9, h, 0.9, c, 0.06), (ax + bx) / 2, y0, (az + bz) / 2, yaw));
    const n = Math.floor(len / 1.3);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      out.push(
        at(rbox(0.6, 0.55, 1, d, 0.06), ax + (bx - ax) * t, y0 + h, az + (bz - az) * t, yaw),
      );
    }
  }
  return out;
}

/** A small domed kiosk (Amer's corner chhatris). */
function kiosk(x: number, y: number, z: number, c: string, d: string, s = 1): G[] {
  return [
    at(rbox(2 * s, 1.6 * s, 2 * s, c, 0.06), x, y, z),
    at(rbox(2.4 * s, 0.2 * s, 2.4 * s, d, 0.05), x, y + 1.6 * s, z),
    at(
      lathe(
        [
          [0, 0],
          [0.95, 0],
          [0.9, 0.4],
          [0.55, 0.85],
          [0.12, 1.1],
          [0, 1.25],
        ],
        mix(c, WHITE, 0.2),
        14,
      ).scale(s, s, s),
      x,
      y + 1.8 * s,
      z,
    ),
  ];
}

/** A thin cylinder from a to b (a cable). */
function cable(a: THREE.Vector3, b: THREE.Vector3, r: number, hex: string): G {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 5, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return paint(clean(g), hex);
}

/** An outline pulled in by `k` towards its centre. */
function inset(o: Pt[], k: number): Pt[] {
  const cx = o.reduce((a, p) => a + p[0], 0) / o.length;
  const cz = o.reduce((a, p) => a + p[1], 0) / o.length;
  return o.map(([x, z]) => {
    const l = Math.hypot(x - cx, z - cz) || 1;
    return [x - ((x - cx) / l) * k, z - ((z - cz) / l) * k] as Pt;
  });
}

/** Orients a flat part (built facing +z in its own XY plane) to face `n` at `p`. */
function facingOut(g: G, p: THREE.Vector3, n: THREE.Vector3): G {
  const o = new THREE.Object3D();
  o.position.copy(p);
  o.lookAt(p.clone().add(n));
  o.updateMatrix();
  g.applyMatrix4(o.matrix);
  return g;
}

// Jantar Mantar (Delhi's Misra Yantra), round 4, from the 3/4 photo: a coral-red pyramid on a
// straight plinth. The front face slopes back to an apex near the rear; the central stair climbs
// it; on that sloped face, either side, two concentric white half-circles (their straight side on
// the stair) ring a deep bowl with steps and a doorway; thick white edges run from the ground at
// each end up to the apex with stairs beside them; quadrant sweeps stand apart at both ends.
const JM = "#e0574a";

const JM_D = "#bf4639";

const JM_W = "#f7f1e8";

/** A sign board at (x, y, z) facing +z (turned by yaw). */
function sign(
  text: string,
  w: number,
  h: number,
  bg: string,
  fg: string,
  x: number,
  y: number,
  z: number,
  yaw = 0,
  sub?: string,
): THREE.Mesh {
  const lines = sub
    ? [
        { text, size: h * 0.42 },
        { text: sub, size: h * 0.24 },
      ]
    : [{ text, size: h * 0.6 }];
  const m = board(lines, w, h, bg, fg);
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  return m;
}

const BLUE = "#4f8de8";

const GREEN = "#3fae6a";

const ORANGE = "#ff8a3d";

const STEEL = "#9a93ad";

interface LM {
  parts: G[];
  flats?: G[];
  signs?: THREE.Mesh[];
  lamps?: Lamp[];
  /** Its own road (through it), instead of one passing in front. */
  road?: Pt[][];
  bike?: [number, number, number];
}

/** 5 · Rally start arch: a big inflatable arch over the road, a start ramp with a podium, flags. */
function lmStart(): LM {
  const parts: G[] = [];
  const arc = new THREE.TorusGeometry(6, 0.8, 10, 36, Math.PI);
  parts.push(paint(clean(arc), ORANGE));
  parts.push(
    at(
      paint(clean(new THREE.TorusGeometry(6, 0.82, 10, 36, Math.PI).scale(1, 1, 0.3)), "#ffffff"),
      0,
      0,
      0.55,
    ),
  );
  // The start ramp: a sloped platform the bikes roll down.
  parts.push(
    at(rbox(4, 1.4, 4, STEEL, 0.1), 0, 0, -7),
    at(rbox(4, 0.2, 5, INK, 0.05), 0, 0.65, -3.6, 0, -0.27),
  );
  for (const x of [-2.1, 2.1]) parts.push(at(drum(0.05, 1, "#ffffff", 0.01, 6), x, 1.4, -7));
  for (let i = 0; i < 6; i++)
    parts.push(
      at(drum(0.05, 3.6, INK, 0.01, 6), -9 + (i % 3) * 1.2, 0, -3 + Math.floor(i / 3) * 6),
      at(
        rbox(0.05, 0.7, 1, [RED, "#ffffff", BLUE][i % 3] as string, 0.02),
        -9 + (i % 3) * 1.2,
        2.8,
        -3 + Math.floor(i / 3) * 6 + 0.5,
      ),
    );
  return {
    parts,
    signs: [sign("START", 4, 1.2, INK, "#ffffff", 0, 6.4, 0.9, 0, "build your own rider")],
    lamps: [{ x: 0, y: 5, z: 1, r: 7 }],
    road: [
      [
        [0, -40],
        [0, 40],
      ],
    ],
    bike: [0, 6, Math.PI / 2],
  };
}

/** 8 · Stepwell: a sunken, stepped square painted flat (Chand Baori's zig-zag stairs), a pavilion on one side. */
function lmStepwell(): LM {
  const flats: G[] = [];
  const parts: G[] = [];
  const S = 9;
  for (let k = 0; k < 8; k++) {
    const h = S - k * 1.05;
    const shade = mix("#e9c79a", "#a9784e", k / 8);
    flats.push(
      flatPoly(
        [
          [-h, -h],
          [h, -h],
          [h, h],
          [-h, h],
        ],
        0.02 + k * 0.004,
        shade,
      ),
    );
    // Zig-zag stair lines on each side.
    for (let side = 0; side < 4; side++)
      for (let z = -h + 0.6; z < h - 0.6; z += 1.4) {
        const a = (side * Math.PI) / 2;
        const p0: Pt = [
          Math.cos(a) * (h - 0.5) - Math.sin(a) * z,
          Math.sin(a) * (h - 0.5) + Math.cos(a) * z,
        ];
        const p1: Pt = [
          Math.cos(a) * (h - 0.5) - Math.sin(a) * (z + 0.7),
          Math.sin(a) * (h - 0.5) + Math.cos(a) * (z + 0.7),
        ];
        flats.push(band([p0, p1], 0.08, 0.025 + k * 0.004 + 0.002, mix(shade, "#ffffff", 0.35)));
      }
  }
  flats.push(
    flatPoly(
      [
        [-0.9, -0.9],
        [0.9, -0.9],
        [0.9, 0.9],
        [-0.9, 0.9],
      ],
      0.06,
      "#7fc4d0",
    ),
  );
  for (const [x, z, w, d] of [
    [0, -S - 0.4, 2 * S + 1.6, 0.8],
    [0, S + 0.4, 2 * S + 1.6, 0.8],
    [-S - 0.4, 0, 0.8, 2 * S],
    [S + 0.4, 0, 0.8, 2 * S],
  ] as const)
    parts.push(at(rbox(w, 0.7, d, "#e9c79a", 0.06), x, 0, z));
  // The pavilion on the back side: arches and chhatris.
  parts.push(at(rbox(12, 4, 3, "#e9c79a", 0.1), 0, 0, -S - 2.4));
  for (let i = 0; i < 5; i++)
    parts.push(at(rbox(1.2, 2.4, 0.2, "#9b6a4c", 0.1), -4.8 + i * 2.4, 0.5, -S - 0.85));
  for (const x of [-4.5, 4.5]) parts.push(...kiosk(x, 4, -S - 2.4, "#e9c79a", "#d4a874", 0.9));
  return {
    parts,
    flats,
    signs: [
      sign("STEPWELL", 3.6, 0.8, "#9b6a4c", "#ffffff", 0, 4.6, -S - 0.9, 0, "level below level"),
    ],
    lamps: [{ x: 0, y: 2, z: -S, r: 6 }],
  };
}

/** 10 · Haveli as rally HQ: a painted haveli, jharokha balconies, a courtyard arch, banner and flags. */
function lmHaveli(): LM {
  const parts: G[] = [];
  const C = "#f0d9b5";
  parts.push(
    at(rbox(12, 7.5, 8, C, 0.12), 0, 0, 0),
    at(rbox(12.4, 0.3, 8.4, "#d4a874", 0.06), 0, 7.5, 0),
  );
  for (const y of [0.2, 3.6]) parts.push(at(rbox(12.05, 0.35, 8.05, "#7fb3e0", 0.04), 0, y, 0));
  parts.push(at(rbox(2.6, 3.2, 0.3, "#9b6a4c", 0.12), 0, 0, 4.05));
  for (const x of [-4, 4]) {
    parts.push(
      at(rbox(2.4, 1.8, 1, C, 0.12), x, 4.2, 4.3),
      at(
        lathe(
          [
            [0, 0],
            [1.3, 0],
            [1.2, 0.3],
            [0.6, 0.7],
            [0, 0.85],
          ],
          "#d4a874",
          12,
        ).scale(1, 1, 0.6),
        x,
        6,
        4.3,
      ),
    );
    parts.push(at(rbox(1.6, 1.1, 0.08, "#9b6a4c", 0.04), x, 4.5, 4.82));
  }
  for (let i = 0; i < 4; i++)
    parts.push(at(rbox(1, 1.6, 0.1, "#9b6a4c", 0.06), -4.5 + i * 3, 1, 4.05));
  for (const x of [-5, 5]) parts.push(...kiosk(x, 7.8, -2.5, C, "#d4a874", 0.8));
  for (const [x, c] of [
    [-2, ORANGE],
    [0, "#ffffff"],
    [2, GREEN],
  ] as const)
    parts.push(
      at(drum(0.05, 3, INK, 0.01, 6), x, 7.8, 2),
      at(rbox(0.05, 0.8, 1.2, c, 0.02), x, 10, 2.6),
    );
  return {
    parts,
    signs: [sign("RALLY HQ", 5, 1.1, "#9b6a4c", "#ffffff", 0, 3.35, 4.25, 0, "the rulebook")],
    lamps: [
      { x: -4, y: 4.6, z: 5, r: 4 },
      { x: 4, y: 4.6, z: 5, r: 4 },
      { x: 0, y: 1.5, z: 5, r: 4 },
    ],
  };
}

// Jantar Mantar (Misra Yantra), round 5: from the Sketchfab model, orbited and read. A long
// rectangle: a tall flat back wall; two concentric ring walls whose white tops tilt (high at the
// back, low at the front: the "loops"); spiral steps between the rings; a sunken court inside;
// the outer ring bulging out of the front as a drum with two arched doors; the gnomon stair
// straight from the front to the top of the back wall; wedge side walls carrying broad stairs;
// sloped, white-stepped corners; concave quadrants at both ends with stairs on their backs.
function misra4(): { parts: G[]; flats: G[]; lamps: Lamp[] } {
  const parts: G[] = [];
  const flats: G[] = [];
  const lamps: Lamp[] = [];
  const HW = 15; // half width
  const ZF = 7; // front edge
  const ZB = -7; // back wall
  const H = 9.5; // back wall's peak
  const C: Pt = [0, 1.5]; // the rings' centre
  const RO = 7.8;
  const RI = 5.0;
  const yAt = (z: number) => 3 + ((ZF + 2.3 - z) / (ZF + 2.3 - ZB)) * (H - 1.6 - 3);
  const quads: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) =>
    quads.push(...a, ...b, ...c, ...a, ...c, ...d);
  const whites: number[] = [];
  const wquad = (a: number[], b: number[], c: number[], d: number[]) =>
    whites.push(...a, ...b, ...c, ...a, ...c, ...d);
  // The ring walls: inner and outer faces up to the tilted top, a white cap on top.
  const ring = (R: number, t: number) => {
    const n = 72;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      const P = (a: number, r: number): [number, number] => [
        C[0] + Math.cos(a) * r,
        C[1] + Math.sin(a) * r,
      ];
      const [ox0, oz0] = P(a0, R);
      const [ox1, oz1] = P(a1, R);
      const [ix0, iz0] = P(a0, R - t);
      const [ix1, iz1] = P(a1, R - t);
      const y0 = yAt(oz0);
      const y1 = yAt(oz1);
      // Behind the back wall the ring is hidden: skip it there.
      if (oz0 < ZB && oz1 < ZB) continue;
      quad([ox0, 0, oz0], [ox1, 0, oz1], [ox1, y1, oz1], [ox0, y0, oz0]);
      quad([ix1, 0, iz1], [ix0, 0, iz0], [ix0, yAt(iz0), iz0], [ix1, yAt(iz1), iz1]);
      // The white coping along the top (a round-edged tube, so it reads from every side).
      const [mx0, mz0] = P(a0, R - t / 2);
      const [mx1, mz1] = P(a1, R - t / 2);
      parts.push(
        cable(
          new THREE.Vector3(mx0, yAt(mz0) + 0.15, mz0),
          new THREE.Vector3(mx1, yAt(mz1) + 0.15, mz1),
          t * 0.62,
          JM_W,
        ),
      );
      quad([ox0, y0, oz0], [ox1, y1, oz1], [ox1, y1 + 0.3, oz1], [ox0, y0 + 0.3, oz0]);
      quad(
        [ix1, yAt(iz1), iz1],
        [ix0, yAt(iz0), iz0],
        [ix0, yAt(iz0) + 0.3, iz0],
        [ix1, yAt(iz1) + 0.3, iz1],
      );
    }
  };
  ring(RO, 0.8);
  ring(RI, 0.7);
  // Spiral steps between the rings: treads stepping up with the tilt, white-edged.
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * Math.PI * 2;
    const rm = (RO - 0.8 + RI) / 2;
    const x = C[0] + Math.cos(a) * rm;
    const z = C[1] + Math.sin(a) * rm;
    if (z < ZB + 0.5) continue;
    const y = yAt(z) - 0.9;
    parts.push(at(rbox(0.8, Math.max(0.3, y), RO - 0.8 - RI - 0.1, JM, 0.04), x, 0, z, -a));
    parts.push(at(rbox(0.82, 0.12, RO - 0.8 - RI - 0.05, JM_W, 0.02), x, Math.max(0.3, y), z, -a));
  }
  // The corners: the sloped surface outside the outer ring, inside the rectangle (a height
  // field with the ring cut out), white treads across it, and its front face.
  const step = 0.7;
  for (let x = -HW + 3; x < HW - 3; x += step)
    for (let z = ZB; z < ZF; z += step) {
      const cx = x + step / 2;
      const cz = z + step / 2;
      if (Math.hypot(cx - C[0], cz - C[1]) < RO + 0.2) continue;
      // White treads (flat, each at its step's height), red risers between.
      wquad(
        [x, yAt(z), z + step],
        [x + step, yAt(z), z + step],
        [x + step, yAt(z), z],
        [x, yAt(z), z],
      );
      quad(
        [x, yAt(z), z + step],
        [x, yAt(z + step), z + step],
        [x + step, yAt(z + step), z + step],
        [x + step, yAt(z), z + step],
      );
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(quads, 3));
  g.computeVertexNormals();
  parts.push(paint(g, JM));
  const gw = new THREE.BufferGeometry();
  gw.setAttribute("position", new THREE.Float32BufferAttribute(whites, 3));
  gw.computeVertexNormals();
  parts.push(paint(gw, JM_W));
  // The tall back wall, its top slightly peaked, a white coping.
  parts.push(
    at(
      profileWall(
        [
          [-HW, 0],
          [HW, 0],
          [HW, H - 2],
          [0, H],
          [-HW, H - 2],
        ],
        0.9,
        JM_D,
      ),
      0,
      0,
      ZB - 0.45,
    ),
  );
  parts.push(
    cable(new THREE.Vector3(-HW, H - 2 + 0.1, ZB), new THREE.Vector3(0, H + 0.1, ZB), 0.3, JM_W),
    cable(new THREE.Vector3(0, H + 0.1, ZB), new THREE.Vector3(HW, H - 2 + 0.1, ZB), 0.3, JM_W),
  );
  // The wedge side walls with broad straight stairs up them, front (low) to back (high).
  for (const sd of [-1, 1]) {
    const w = profileWall(
      [
        [ZF + 1, 0],
        [ZB, 0],
        [ZB, H - 2],
        [ZF + 1, 1.2],
      ],
      3,
      JM,
    );
    w.rotateY(-Math.PI / 2);
    parts.push(at(w, sd * (HW - 1.5), 0, 0));
    for (let k = 0; k < 22; k++) {
      const t = (k + 0.5) / 22;
      const z = ZF + 1 - t * (ZF + 1 - ZB);
      const y = 1.2 + t * (H - 2 - 1.2);
      parts.push(
        at(rbox(2.7, 0.18, (ZF + 1 - ZB) / 22 + 0.05, JM_W, 0.02), sd * (HW - 1.5), y - 0.05, z),
      );
    }
  }
  // The gnomon stair: from the front, straight up across both rings to the top of the back wall.
  const gz0 = C[1] + RO + 2.6;
  const gnomon = profileWall(
    [
      [gz0, 0],
      [ZB, 0],
      [ZB, H + 0.2],
    ],
    2.2,
    mix(JM, JM_D, 0.3),
  );
  gnomon.rotateY(-Math.PI / 2);
  parts.push(gnomon);
  for (let k = 0; k < 30; k++) {
    const t = (k + 0.5) / 30;
    const z = gz0 - t * (gz0 - ZB);
    parts.push(at(rbox(2.0, 0.2, (gz0 - ZB) / 30 + 0.04, JM_W, 0.02), 0, t * (H + 0.2) - 0.1, z));
  }
  for (const x of [-1.1, 1.1])
    parts.push(
      cable(new THREE.Vector3(x, 0.3, gz0), new THREE.Vector3(x, H + 0.5, ZB), 0.15, JM_D),
    );
  // Two arched doorways in the drum's front, steps before them.
  for (const sd of [-1, 1]) {
    const a = Math.PI / 2 - sd * 0.42;
    const p = new THREE.Vector3(
      C[0] + Math.cos(a) * (RO + 0.03),
      0.01,
      C[1] + Math.sin(a) * (RO + 0.03),
    );
    const door = paint(
      clean(
        new THREE.ShapeGeometry(
          new THREE.Shape(arch(0, 0, 1.8, 2.6).map(([u, v]) => new THREE.Vector2(u, v))),
        ),
      ),
      "#5a2e28",
    );
    parts.push(facingOut(door, p, new THREE.Vector3(Math.cos(a), 0, Math.sin(a))));
    parts.push(
      at(
        rbox(2.2, 0.35, 1.2, mix(JM, JM_W, 0.4), 0.04),
        p.x * 1.08,
        0,
        p.z + 0.8,
        -(a - Math.PI / 2),
      ),
    );
    lamps.push({ x: p.x, y: 1.3, z: p.z + 1, r: 3 });
  }
  // The sunken court inside the inner ring.
  flats.push(
    flatPoly(
      Array.from(
        { length: 40 },
        (_, k) =>
          [
            C[0] + Math.cos((k / 40) * Math.PI * 2) * (RI - 0.7),
            C[1] + Math.sin((k / 40) * Math.PI * 2) * (RI - 0.7),
          ] as Pt,
      ),
      0.03,
      "#c9a094",
    ),
  );
  // Quadrants at both ends: high at the outer end, curving down to the block; stairs on the back.
  for (const sd of [-1, 1]) {
    const R = 6;
    const prof: Pt[] = [
      [0, 0],
      [R, 0],
      [R, R],
    ];
    const lip: Pt[] = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * (Math.PI / 2);
      const pt: Pt = [R - Math.sin(a) * R * 0.92, R - Math.cos(a) * R * 0.92 + 0.0];
      lip.push(pt);
    }
    prof.push(...lip.slice(1));
    const q = profileWall(prof, 2, JM);
    const lipG: G[] = [];
    for (let k = 0; k < lip.length - 1; k++) {
      const [u0, v0] = lip[k] as Pt;
      const [u1, v1] = lip[k + 1] as Pt;
      const seg = rbox(Math.hypot(u1 - u0, v1 - v0) + 0.06, 0.22, 2.1, JM_W, 0.04);
      seg.rotateZ(Math.atan2(v1 - v0, u1 - u0));
      lipG.push(at(seg, (u0 + u1) / 2, (v0 + v1) / 2 - 0.11, 0));
    }
    // Stairs up its outer back.
    for (let k = 0; k < 10; k++)
      lipG.push(
        at(
          rbox(1.2, (k + 1) * 0.55, 1.8, JM, 0.04),
          R + 0.6 + (9 - k) * 0.55 * 0 + 0.6,
          0,
          -1.2 - k * 0.0 + 0,
        ).scale(1, 1, 1),
      );
    const all = join([q, ...lipG]);
    if (sd < 0) all.scale(-1, 1, 1);
    parts.push(at(all, sd * (HW + 0.5), 0, 1));
  }
  flats.push(
    flatPoly(
      [
        [-26, -10],
        [26, -10],
        [26, 16],
        [-26, 16],
      ],
      0.02,
      "#dfa28e",
    ),
  );
  for (let x = -26; x <= 26; x += 3)
    flats.push(
      band(
        [
          [x, -10],
          [x, 16],
        ],
        0.04,
        0.03,
        "#cf927e",
      ),
    );
  for (let z = -10; z <= 16; z += 3)
    flats.push(
      band(
        [
          [-26, z],
          [26, z],
        ],
        0.04,
        0.03,
        "#cf927e",
      ),
    );
  return { parts, flats, lamps };
}

const SAND = "#ecc896";

const SAND_D = "#d6a874";

const LIME = "#f6efe2";

const JODHPUR = "#a9c6e6";

const SAGE = "#bcd3ae";

const BRASS = "#d9b05a";

const WOOD = "#a7774f";

const WOOD_D = "#7e5638";

const IRON = "#5d5668";

/** A stone plaque on a little plinth. */
function plaque(
  text: string,
  sub: string,
  x: number,
  z: number,
  yaw = 0,
): { part: G[]; sign: THREE.Mesh } {
  return {
    part: [at(rbox(2.6, 0.9, 0.5, SAND_D, 0.08), x, 0, z, yaw)],
    sign: sign(
      text,
      2.3,
      0.62,
      SAND,
      WOOD_D,
      x + Math.sin(yaw) * 0.27,
      0.5,
      z + Math.cos(yaw) * 0.27,
      yaw,
      sub,
    ),
  };
}

/** 1 · Kund: a Thar rainwater tank — a lime-plastered catchment saucer sloping in to a domed well. */
function lmKund(): LM {
  const parts: G[] = [];
  const flats: G[] = [];
  const kund = (x: number, z: number, R: number, s: number) => {
    // The saucer: a shallow cone sloping inwards to the middle, its raised rim.
    parts.push(
      at(
        lathe(
          [
            [0, 0.25],
            [R, 0.05],
            [R + 0.4, 0.45],
            [R + 0.8, 0.05],
            [R + 0.8, 0],
          ],
          "#f3e6cf",
          40,
        ),
        x,
        0,
        z,
      ),
    );
    parts.push(
      at(
        paint(clean(new THREE.TorusGeometry(R + 0.4, 0.2, 8, 48).rotateX(Math.PI / 2)), "#f7efe0"),
        x,
        0.42,
        z,
      ),
    );
    // A soft shade towards the middle: the saucer dips in to the well.
    for (const [f, c] of [
      [0.75, "#efe1c8"],
      [0.45, "#e9d8bb"],
    ] as const)
      flats.push(
        flatPoly(
          Array.from(
            { length: 40 },
            (_, k) =>
              [
                x + Math.cos((k / 40) * Math.PI * 2) * R * f,
                z + Math.sin((k / 40) * Math.PI * 2) * R * f,
              ] as Pt,
          ),
          0.27 - f * 0.1,
          c,
        ),
      );
    // The domed cover over the well, a little door, a finial.
    parts.push(at(drum(1.3 * s, 1.1 * s, LIME, 0.08, 24), x, 0.2, z));
    parts.push(
      at(
        lathe(
          [
            [0, 0],
            [1.4, 0],
            [1.3, 0.5],
            [0.9, 1.05],
            [0.35, 1.35],
            [0, 1.45],
          ],
          LIME,
          24,
        ).scale(s, s, s),
        x,
        0.2 + 1.1 * s,
        z,
      ),
    );
    parts.push(at(drum(0.08 * s, 0.6 * s, BRASS, 0.02, 8), x, 0.2 + 2.55 * s, z));
    parts.push(at(rbox(0.6 * s, 0.75 * s, 0.1, WOOD_D, 0.05), x, 0.25, z + 1.28 * s));
  };
  kund(0, 0, 8, 1.4);
  kund(-13, -4, 4.2, 0.8);
  kund(12, -6, 3.6, 0.7);
  // A carved stone trough by the big one, and a khejri for shade.
  parts.push(at(rbox(3, 0.6, 1, SAND, 0.1), 5, 0, 7), ...khejri(-9, 7, 1.2));
  const pl = plaque("KUND", "every drop saved", -3, 9.5);
  return {
    parts: [...parts, ...pl.part],
    flats,
    signs: [pl.sign],
    lamps: [{ x: 0, y: 1.5, z: 2, r: 5 }],
  };
}

/** A sandstone pol (gateway): an arch through a crenellated block, kiosks on top. `wash` on the arch's face. */
function pol(wash: string, emblem: "sun" | "moon"): G[] {
  const out: G[] = [];
  out.push(
    profileWall(
      [
        [-4, 0],
        [4, 0],
        [4, 7],
        [-4, 7],
      ],
      3,
      SAND,
      [arch(0, 0, 3.6, 5.2)],
    ),
  );
  // The washed arch surround and the emblem, on both faces (you ride through from either side).
  const face: G[] = [
    at(
      profileWall(
        [
          [-2.3, 0],
          [2.3, 0],
          [2.3, 5.9],
          [-2.3, 5.9],
        ],
        0.12,
        wash,
        [arch(0, 0, 3.6, 5.2)],
      ),
      0,
      0,
      1.56,
    ),
  ];
  for (let i = -3; i <= 3; i++)
    for (const zz of [-1.25, 1.25])
      out.push(at(rbox(0.7, 0.65, 0.5, SAND_D, 0.06), i * 1.15, 7, zz));
  out.push(...kiosk(-3.2, 7, 0.4, SAND, SAND_D, 0.8), ...kiosk(3.2, 7, 0.4, SAND, SAND_D, 0.8));
  // The emblem over the arch: a gilt sun, or a silver crescent moon.
  if (emblem === "sun") {
    face.push(at(drum(0.55, 0.12, BRASS, 0.03, 20).rotateX(Math.PI / 2), 0, 6.3, 1.62));
    for (let k = 0; k < 10; k++)
      face.push(
        at(
          rbox(0.12, 0.45, 0.08, BRASS, 0.02)
            .rotateZ((k / 10) * Math.PI * 2)
            .translate(
              Math.cos((k / 10) * Math.PI * 2 + Math.PI / 2) * -0.85,
              Math.sin((k / 10) * Math.PI * 2 + Math.PI / 2) * 0.85,
              0,
            ),
          0,
          6.3,
          1.62,
        ),
      );
  } else {
    const moon = paint(clean(new THREE.TorusGeometry(0.55, 0.16, 8, 20, Math.PI * 1.3)), "#e4e4ef");
    face.push(at(moon.rotateZ(Math.PI * 0.85), 0, 6.3, 1.65));
  }
  out.push(...face, ...face.map((g) => g.clone().rotateY(Math.PI)));
  return out;
}

/** 2 · Suraj Pol and Chand Pol: twin gateways; the road forks through both and rejoins. */
function lmTwinPols(): LM {
  const parts = [
    ...pol(JODHPUR, "moon").map((g) => at(g, -5.2, 0, 0)),
    ...pol(SAGE, "sun").map((g) => at(g, 5.2, 0, 0)),
  ];
  // The wall between and beyond them.
  parts.push(
    ...wallAlong(
      [
        [-14, 0],
        [-9.2, 0],
      ],
      0,
      4,
      SAND,
      SAND_D,
    ),
    ...wallAlong(
      [
        [-1.2, 0],
        [1.2, 0],
      ],
      0,
      5,
      SAND,
      SAND_D,
    ),
    ...wallAlong(
      [
        [9.2, 0],
        [14, 0],
      ],
      0,
      4,
      SAND,
      SAND_D,
    ),
  );
  const flats: G[] = [];
  return {
    parts,
    flats,
    road: [
      chaikin(
        [
          [0, 30],
          [0, 12],
          [-5.2, 4],
          [-5.2, -4],
          [0, -12],
          [0, -30],
        ] as Pt[],
        4,
        false,
      ),
      chaikin(
        [
          [0, 30],
          [0, 12],
          [5.2, 4],
          [5.2, -4],
          [0, -12],
          [0, -30],
        ] as Pt[],
        4,
        false,
      ),
    ],
    bike: [-3, 10, Math.PI / 2 + 0.4],
    lamps: [
      { x: -5.2, y: 4, z: 2, r: 5 },
      { x: 5.2, y: 4, z: 2, r: 5 },
    ],
  };
}

/** 7 · Fort strongroom: a squat keep, a door studded with elephant spikes, a brass lock, a guard chhatri, an old cannon. */
function lmStrongroom(): LM {
  const parts: G[] = [];
  parts.push(at(rbox(9, 6, 7, SAND, 0.15), 0, 0, 0));
  for (let i = -3; i <= 3; i++)
    for (const zz of [-3.3, 3.3])
      parts.push(at(rbox(0.8, 0.75, 0.55, SAND_D, 0.06), i * 1.25, 6, zz));
  for (let i = -2; i <= 2; i++)
    for (const xx of [-4.2, 4.2])
      parts.push(at(rbox(0.55, 0.75, 0.8, SAND_D, 0.06), xx, 6, i * 1.3));
  for (const x of [-4.5, 4.5])
    parts.push(
      at(drum(1.3, 6.6, SAND, 0.1, 18), x, 0, 3.4),
      at(drum(1.45, 0.4, SAND_D, 0.06, 18), x, 6.6, 3.4),
    );
  parts.push(...kiosk(0, 6.7, -1.5, SAND, SAND_D, 1.1));
  // The door: heavy timber in a pointed arch, iron bands, rows of elephant spikes, a brass lock.
  parts.push(at(profileWall(arch(0, 0, 3.4, 4.6), 0.4, WOOD_D), 0, 0, 3.55));
  for (const y of [1, 2.2, 3.4]) parts.push(at(rbox(3.4, 0.14, 0.1, IRON, 0.02), 0, y, 3.8));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      parts.push(
        at(
          lathe(
            [
              [0, 0],
              [0.12, 0],
              [0, 0.55],
            ],
            IRON,
            8,
          ).rotateX(Math.PI / 2),
          -1.2 + c * 0.8,
          1.4 + r * 1.2,
          3.8,
        ),
      );
  parts.push(
    at(rbox(0.5, 0.6, 0.25, BRASS, 0.08), 0, 2.3, 3.95),
    at(paint(clean(new THREE.TorusGeometry(0.2, 0.06, 6, 12, Math.PI)), BRASS), 0, 2.9, 3.95),
  );
  // An old bronze cannon on its carriage before the door.
  parts.push(
    at(rbox(2.2, 0.6, 1.4, WOOD_D, 0.08), 4.5, 0.5, 8),
    at(
      paint(
        clean(new THREE.CylinderGeometry(0.32, 0.45, 3.4, 14).rotateZ(Math.PI / 2 - 0.15)),
        "#b98a4e",
      ),
      4.6,
      1.5,
      8,
    ),
  );
  for (const sd of [-1, 1])
    parts.push(
      at(paint(clean(new THREE.TorusGeometry(0.55, 0.12, 6, 16)), WOOD_D), 4.2, 0.6, 8 + sd * 0.8),
      at(drum(0.3, 0.2, BRASS, 0.03, 10).rotateX(Math.PI / 2), 4.2, 0.6, 8 + sd * 0.85),
    );
  for (let k = 0; k < 4; k++)
    parts.push(at(ball(0.22, IRON), 6.5 + (k % 2) * 0.45, 0, 7.6 + Math.floor(k / 2) * 0.45));
  const pl = plaque("TOSHAKHANA", "the locked strongroom", -4, 8.5);
  return { parts: [...parts, ...pl.part], signs: [pl.sign], lamps: [{ x: 0, y: 3.5, z: 5, r: 5 }] };
}

const GRASS = "#d4dfaa";

const GRASS_D = "#c2d398";

const LAKE = "#9fd2dc";

const LAKE_D = "#86bfcc";

const CLAY = "#c9784f";

const DARK = "#6e4c3b";

const DYES = ["#c8553d", "#e3b04b", "#7f95bd", "#d99a8f", "#9fb48a", "#e0a35e"];

const PAVE = mix(SAND, LIME, 0.45);

const MATKA: Pt[] = [
  [0, 0],
  [0.24, 0.04],
  [0.33, 0.26],
  [0.2, 0.52],
  [0.13, 0.56],
  [0.16, 0.64],
  [0, 0.64],
];

const ring = (x: number, z: number, r: number, n = 32, sz = 1): Pt[] =>
  Array.from(
    { length: n },
    (_, k) =>
      [x + Math.cos((k / n) * Math.PI * 2) * r, z + Math.sin((k / n) * Math.PI * 2) * r * sz] as Pt,
  );

const closed = (p: Pt[]): Pt[] => [...p, p[0] as Pt];

/** Neem: a straight trunk, a full round crown of soft greens. */
function neem(x: number, z: number, s = 1, y = 0): G[] {
  // (A neem up on a platform stays put.)
  if (looseTrees && y === 0) {
    looseTrees.push({ id: "zneem", x, z, s });
    return [];
  }
  const out: G[] = [at(drum(0.26 * s, 2.3 * s, "#8a6248", 0.05, 8), x, y, z)];
  for (const [dx, dy, dz, r, c] of [
    [0, 0, 0, 1.5, "#8fb36f"],
    [1.1, -0.3, 0.4, 1.05, "#9fc07e"],
    [-1.1, -0.2, 0.5, 1.1, "#86ab68"],
    [0.3, -0.2, -1.1, 1.05, "#98ba77"],
    [0.2, 0.7, 0.3, 0.95, "#afcb8b"],
  ] as const)
    out.push(at(ball(r * s, c, 1.1, 0.8, 1.05), x + dx * s, y + (2.0 + dy) * s, z + dz * s));
  return out;
}

function shrub(x: number, z: number, s = 1, c = "#a6c283"): G[] {
  return [
    at(ball(0.6 * s, c, 1.25, 0.8, 1.1), x, 0, z),
    at(ball(0.45 * s, mix(c, WHITE, 0.15), 1.2, 0.8, 1.1), x + 0.4 * s, 0.1 * s, z + 0.3 * s),
  ];
}

function lampPost(x: number, z: number): G[] {
  return [
    at(drum(0.32, 0.4, SAND_D, 0.05, 10), x, 0, z),
    at(drum(0.1, 2.2, SAND_D, 0.02, 8), x, 0.4, z),
    at(rbox(0.45, 0.55, 0.45, LIME, 0.08), x, 2.6, z),
    at(
      lathe(
        [
          [0, 0],
          [0.35, 0],
          [0, 0.35],
        ],
        SAND_D,
        8,
      ),
      x,
      3.15,
      z,
    ),
  ];
}

/** A chhatri: a stepped plinth, four pillars, an eave, a dome and a brass finial. */
function chhatriAt(x: number, y: number, z: number, s: number, plinth = true): G[] {
  const o: G[] = [];
  const y0 = plinth ? y + 0.9 : y;
  if (plinth)
    o.push(
      at(rbox(3.7 * s, 0.55, 3.7 * s, SAND_D, 0.06), x, y, z),
      at(rbox(3.2 * s, 0.35, 3.2 * s, SAND, 0.05), x, y + 0.55, z),
    );
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    o.push(at(drum(0.15 * s, 2.1 * s, LIME, 0.02, 8), x + dx * 1.2 * s, y0, z + dz * 1.2 * s));
  const top = y0 + 2.1 * s;
  o.push(
    at(rbox(3.9 * s, 0.14, 3.9 * s, SAND_D, 0.04), x, top, z),
    at(rbox(3.1 * s, 0.4 * s, 3.1 * s, SAND, 0.05), x, top + 0.14, z),
  );
  o.push(
    at(
      lathe(
        [
          [0, 0],
          [1.45, 0],
          [1.35, 0.5],
          [0.8, 1.15],
          [0.2, 1.5],
          [0, 1.6],
        ],
        LIME,
        18,
      ).scale(s, s, s),
      x,
      top + 0.14 + 0.4 * s,
      z,
    ),
  );
  o.push(
    at(drum(0.06 * s, 0.5 * s, BRASS, 0.02, 6), x, top + 0.14 + 2.0 * s, z),
    at(ball(0.12 * s, BRASS), x, top + 0.14 + 2.45 * s, z),
  );
  return o;
}

/** A clock face on the +z side of whatever it is put on (10:10, the watchmaker's hour). */
/** A clock's two hands, pointing up (12) from the pivot at the origin. */
export function clockHands(R: number): { hour: G; minute: G } {
  return {
    hour: rbox(R * 0.09, R * 0.5, 0.04, IRON, 0.01),
    minute: rbox(R * 0.06, R * 0.75, 0.04, IRON, 0.01),
  };
}
/** The hands' turns (about the face's normal, clockwise as you look at it) at a time. */
export function handAngles(t: Date): [number, number] {
  const m = t.getMinutes() + t.getSeconds() / 60;
  const h = (t.getHours() % 12) + m / 60;
  return [(-h / 12) * Math.PI * 2, (-m / 60) * Math.PI * 2];
}
/** `hands`: drawn at this time (the local time by default), or left off (false) for live hands. */
function clockFace(R: number, hands: Date | false = new Date()): G[] {
  const o: G[] = [
    at(drum(R, 0.12, "#fbf6ec", 0.04, 32).rotateX(Math.PI / 2), 0, 0, 0),
    at(paint(clean(new THREE.TorusGeometry(R, R * 0.09, 8, 32)), BRASS), 0, 0, 0.12),
  ];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    o.push(
      at(
        rbox(R * 0.07, R * (k % 3 ? 0.12 : 0.2), 0.04, IRON, 0.01)
          .translate(0, R * 0.72, 0)
          .rotateZ(a),
        0,
        0,
        0.13,
      ),
    );
  }
  if (hands) {
    const h = clockHands(R);
    const [ha, ma] = handAngles(hands);
    o.push(at(h.hour.rotateZ(ha), 0, 0, 0.16), at(h.minute.rotateZ(ma), 0, 0, 0.18));
  }
  return o;
}

/** Bunting: a sagging string between a and b with little diamond pennants. */
function bunting(
  a: [number, number, number],
  b: [number, number, number],
  sag: number,
  seed: number,
): G[] {
  const o: G[] = [];
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const N = 16;
  const pts = Array.from({ length: N + 1 }, (_, k) => {
    const t = k / N;
    const p = A.clone().lerp(B, t);
    p.y -= sag * 4 * t * (1 - t);
    return p;
  });
  const yaw = -Math.atan2(B.z - A.z, B.x - A.x);
  for (let k = 0; k < N; k++)
    o.push(cable(pts[k] as THREE.Vector3, pts[k + 1] as THREE.Vector3, 0.025, WOOD_D));
  for (let k = 1; k < N; k++) {
    const p = pts[k] as THREE.Vector3;
    o.push(
      at(
        rbox(0.34, 0.34, 0.03, DYES[(k + seed) % DYES.length] as string, 0.01)
          .translate(0, -0.17, 0)
          .rotateZ(Math.PI / 4),
        p.x,
        p.y - 0.22,
        p.z,
        yaw,
      ),
    );
  }
  return o;
}

/** 4 · Lake ghat, reworked: Tilon-ki-Pol detailing, a garden round the water, trees, lotus, a boat. */
function lmGhat2(): LM {
  const parts: G[] = [];
  const flats: G[] = [];
  const lake = chaikin(
    [
      [-17, -8],
      [17, -8],
      [20, -2],
      [15, 5],
      [4, 6.8],
      [-8, 6.4],
      [-19, 1],
    ] as Pt[],
    3,
  );
  const lawn = chaikin(
    [
      [-27, -17],
      [-8, -24],
      [10, -24],
      [27, -16],
      [28, 3],
      [22, 13],
      [0, 14],
      [-22, 13],
      [-28, 1],
    ] as Pt[],
    3,
  );
  flats.push(flatPoly(lawn, 0.02, GRASS));
  flats.push(
    flatPoly(
      lake.map(([x, z]) => [x * 1.1, -1 + (z + 1) * 1.18] as Pt),
      0.03,
      GRASS_D,
    ),
  );
  flats.push(flatPoly(lake, 0.044, LAKE));
  flats.push(band(closed(lake), 0.45, 0.06, mix(SAND, LIME, 0.45)));
  // Ripples and lotus beds.
  for (const [x, z, l] of [
    [-13, -5.5, 4],
    [-4, 2.5, 5],
    [7, 4.2, 4],
    [16, 1.5, 3],
    [-15, 3.5, 3],
  ] as const)
    flats.push(
      band(
        [
          [x - l / 2, z],
          [x, z - 0.3],
          [x + l / 2, z],
        ],
        0.09,
        0.068,
        "#c3e5eb",
      ),
    );
  const rnd = rng(7);
  for (const [cx, cz, sx] of [
    [-15.5, -3.5, 4],
    [15.5, -1, 4.5],
  ] as const)
    for (let k = 0; k < 9; k++) {
      const x = cx + (rnd() - 0.5) * sx;
      const z = cz + (rnd() - 0.5) * 3.2;
      flats.push(flatPoly(ring(x, z, 0.32 + rnd() * 0.25, 10), 0.068, "#94b979"));
      if (k % 3 === 0) parts.push(at(ball(0.16, "#efb8bd", 1, 0.8, 1), x, 0.06, z));
    }
  // The ghat: steps from the gateway down into the water.
  for (let k = 0; k < 5; k++)
    parts.push(
      at(
        rbox(15.6 - k * 0.5, 0.55 - k * 0.1, 0.8, k % 2 ? SAND : LIME, 0.04),
        0,
        0,
        -10.1 + k * 0.55,
      ),
    );
  // The gateway: three arches with lime surrounds, niches, a deep eave on brackets, three jharokhas, a parapet, drum towers.
  const GZ = -12;
  const FZ = GZ + 1.22;
  const holes: [number, number, number][] = [
    [-4.5, 2.6, 4.2],
    [0, 3.2, 5],
    [4.5, 2.6, 4.2],
  ];
  parts.push(
    at(
      profileWall(
        [
          [-7, 0],
          [7, 0],
          [7, 7.5],
          [-7, 7.5],
        ],
        2.4,
        SAND,
        holes.map(([u, w, h]) => arch(u, 0, w, h)),
      ),
      0,
      0,
      GZ,
    ),
  );
  for (const [u, w, h] of holes)
    parts.push(
      at(
        profileWall(arch(u, 0, w + 0.7, h + 0.35), 0.12, LIME, [arch(u, 0, w, h)]),
        0,
        0,
        FZ + 0.14,
      ),
    );
  for (const x of [-6.4, -2.4, 2.4, 6.4]) {
    parts.push(
      at(
        profileWall(arch(x, 1.4, 1.05, 1.6), 0.05, LIME, [arch(x, 1.4, 0.75, 1.4)]),
        0,
        0,
        FZ + 0.1,
      ),
    );
    parts.push(at(profileWall(arch(x, 1.4, 0.75, 1.4), 0.05, "#b98a5e"), 0, 0, FZ + 0.08));
  }
  parts.push(at(rbox(14.6, 0.16, 1.2, SAND_D, 0.04), 0, 5.3, FZ + 0.5, 0, 0.2));
  for (let x = -6.5; x <= 6.6; x += 1.0)
    if (Math.abs(x) > 1.0) parts.push(at(rbox(0.22, 0.45, 0.5, SAND_D, 0.04), x, 4.85, FZ + 0.25));
  for (const x of [-4.5, 0, 4.5]) {
    const z = FZ + 0.5;
    parts.push(at(rbox(2.2, 1.45, 1.0, SAND, 0.1), x, 5.45, z));
    parts.push(at(profileWall(arch(0, 0, 1.3, 1.05), 0.06, WOOD_D), x, 5.62, z + 0.52));
    parts.push(at(rbox(2.6, 0.12, 1.35, SAND_D, 0.04), x, 6.9, z));
    parts.push(
      at(
        lathe(
          [
            [0, 0],
            [1.05, 0],
            [0.95, 0.3],
            [0.5, 0.7],
            [0, 0.85],
          ],
          LIME,
          14,
        ).scale(1, 1, 0.55),
        x,
        7.02,
        z,
      ),
    );
    parts.push(at(drum(0.05, 0.35, BRASS, 0.02, 6), x, 7.85, z));
  }
  for (let i = -6; i <= 6; i++)
    for (const zz of [GZ + 1.0, GZ - 1.0])
      parts.push(at(rbox(0.7, 0.6, 0.45, SAND_D, 0.06), i * 1.1, 7.5, zz));
  for (const sx of [-1, 1]) {
    const x = sx * 7.9;
    parts.push(at(drum(1.2, 8.2, SAND, 0.1, 18), x, 0, GZ));
    for (const y of [2.6, 5.3]) parts.push(at(drum(1.28, 0.25, SAND_D, 0.04, 18), x, y, GZ));
    parts.push(...kiosk(x, 8.2, GZ, SAND, SAND_D, 0.85));
  }
  // The gateway's reflection on the water (arches showing the lake through them).
  const k = 0.75;
  const mapG = (p: Pt[]) => p.map(([u, d]) => [u, -8 + d * k] as Pt);
  flats.push(
    flatPoly(
      mapG([
        [-9.1, 0],
        [9.1, 0],
        [9.1, 8.2],
        [6.7, 8.2],
        [6.7, 7.5],
        [-6.7, 7.5],
        [-6.7, 8.2],
        [-9.1, 8.2],
      ]),
      0.052,
      LAKE_D,
      holes.map(([u, w, h]) => mapG(arch(u, 0.4, w, h))),
    ),
  );
  for (const x of [-4.5, 0, 4.5])
    flats.push(
      flatPoly(
        mapG([
          [x - 1.1, 7.4],
          [x + 1.1, 7.4],
          [x + 1.1, 8.4],
          [x + 0.5, 9.2],
          [x, 9.4],
          [x - 0.5, 9.2],
          [x - 1.1, 8.4],
        ]),
        0.052,
        LAKE_D,
      ),
    );
  // Chhatris standing in the water, with their reflections.
  const chh = (x: number, z: number, s: number) => {
    parts.push(...chhatriAt(x, 0, z, s));
    const o: Pt[] = [
      [-1.85, 0],
      [1.85, 0],
      [1.85, 0.9],
      [1.95, 0.9],
      [1.95, 3.15],
      [1.55, 3.15],
      [1.55, 3.55],
      [1.45, 3.55],
      [1.35, 4.05],
      [0.8, 4.7],
      [0.2, 5.05],
      [0, 5.3],
      [-0.2, 5.05],
      [-0.8, 4.7],
      [-1.35, 4.05],
      [-1.45, 3.55],
      [-1.55, 3.55],
      [-1.55, 3.15],
      [-1.95, 3.15],
      [-1.95, 0.9],
      [-1.85, 0.9],
    ];
    const m = (p: Pt[]) => p.map(([u, d]) => [x + u * s, z + 1.85 * s + d * s * k] as Pt);
    flats.push(
      flatPoly(m(o), 0.052, LAKE_D, [
        m([
          [-1.05, 1.0],
          [1.05, 1.0],
          [1.05, 2.95],
          [-1.05, 2.95],
        ]),
      ]),
    );
  };
  chh(-11.5, -2.5, 0.95);
  chh(10.5, -4, 1.1);
  // A canopied boat moored by the steps.
  {
    const b: G[] = [
      at(rbox(3.6, 0.55, 1.3, WOOD, 0.25), 0, 0.02, 0),
      at(rbox(3.0, 0.08, 0.95, WOOD_D, 0.03), 0, 0.5, 0),
    ];
    for (const [dx, dz] of [
      [-0.8, -0.45],
      [0.8, -0.45],
      [-0.8, 0.45],
      [0.8, 0.45],
    ] as const)
      b.push(at(drum(0.04, 1.1, WOOD_D, 0.01, 6), dx, 0.5, dz));
    b.push(at(rbox(2.0, 0.1, 1.25, CLAY, 0.04), 0, 1.6, 0));
    for (let i = 0; i < 5; i++)
      b.push(at(rbox(0.36, 0.22, 0.03, DYES[i] as string, 0.01), -0.8 + i * 0.4, 1.38, 0.64));
    parts.push(...b.map((g) => at(g, 3.5, 0, 2.5, 0.25)));
    flats.push(band(closed(ring(3.5, 2.5, 2.3, 24, 0.5)), 0.07, 0.068, "#c3e5eb"));
  }
  // The promenade along the near bank, the path in from the road, lamp posts.
  flats.push(
    band(
      chaikin(
        [
          [-21, 1],
          [-10, 8.6],
          [4, 9],
          [17, 7],
          [22, 0],
        ] as Pt[],
        3,
        false,
      ),
      1.0,
      0.038,
      PAVE,
    ),
  );
  flats.push(
    band(
      [
        [0, 16],
        [0, 8.8],
      ],
      1.3,
      0.038,
      PAVE,
    ),
  );
  for (const [x, z] of [
    [-12.5, 9.3],
    [-4, 10.5],
    [5, 10.6],
    [12.5, 9.7],
  ] as const)
    parts.push(...lampPost(x, z));
  // Trees and shrubs round the garden.
  for (const [x, z, s] of [
    [-21, -11, 1.2],
    [-16, -18, 1.05],
    [14, -19, 1.1],
    [22, -10, 1.2],
    [-24, 4, 1],
    [24, 4, 1.05],
    [-3, -19, 0.95],
    [-9.5, -19.5, 0.85],
  ] as const)
    parts.push(...neem(x, z, s));
  parts.push(...khejri(8, -18, 1), ...khejri(19, -15, 0.9));
  for (const [x, z, s] of [
    [-18, 10],
    [-15, 11.5, 0.8],
    [15, 11],
    [19, 9, 1.1],
    [-9, -15],
    [9.5, -15],
    [-21, -4],
    [22, -4],
    [-2.7, 12.6, 0.8],
    [2.7, 12.6, 0.8],
    [-24, -9, 0.9],
  ] as [number, number, number?][])
    parts.push(...shrub(x, z, s ?? 1));
  const pl = plaque("GHAT", "source meets destination", -6.5, 12.6);
  const lamps: Lamp[] = [
    ...holes.map(([u]) => ({ x: u, y: 2.5, z: FZ + 1, r: 4 })),
    ...[-4.5, 0, 4.5].map((x) => ({ x, y: 6, z: FZ + 1.4, r: 3.5 })),
    { x: -11.5, y: 2, z: -2.5, r: 4 },
    { x: 10.5, y: 2, z: -4, r: 4 },
    ...[
      [-12.5, 9.3],
      [-4, 10.5],
      [5, 10.6],
      [12.5, 9.7],
    ].map(([x, z]) => ({ x: x as number, y: 2.8, z: z as number, r: 4 })),
    { x: 3.5, y: 1.4, z: 2.5, r: 3 },
  ];
  return { parts: [...parts, ...pl.part], flats, signs: [pl.sign], lamps };
}

type Goods = "pots" | "cloth" | "spice" | "brass" | "bangles" | "shoes" | "lamps";

/** What a shop has out on its otla (local: the shop front at z = 0, the otla from 0 to 1.3, top at 0.55). */
function goods(kind: Goods, w: number): G[] {
  const o: G[] = [];
  const y = 0.55;
  const xs = (n: number) =>
    Array.from({ length: n }, (_, i) => -w / 2 + 0.55 + (i * (w - 1.1)) / (n - 1));
  switch (kind) {
    case "pots":
      xs(4).forEach((x, i) => {
        o.push(at(lathe(MATKA, CLAY, 12), x, y, 0.7));
        if (i % 2 === 0)
          o.push(
            at(
              lathe(MATKA, mix(CLAY, "#f0c9a0", 0.25), 12).scale(0.75, 0.75, 0.75),
              x,
              y + 0.64,
              0.7,
            ),
          );
      });
      o.push(
        at(lathe(MATKA, mix(CLAY, "#8a5a3c", 0.3), 12).scale(1.5, 1.5, 1.5), w / 2 - 0.3, 0, 1.9),
        at(lathe(MATKA, CLAY, 12).scale(1.3, 1.3, 1.3), w / 2 - 1.1, 0, 2.1),
      );
      break;
    case "cloth":
      xs(5).forEach((x, i) => {
        o.push(at(rbox(0.5, 1.35, 0.04, DYES[i] as string, 0.01), x, 1.3, 1.36));
      });
      for (let k = 0; k < 4; k++)
        o.push(
          at(rbox(1.0, 0.13, 0.65, DYES[(k + 2) % 6] as string, 0.03), -0.4, y + k * 0.13, 0.55),
          at(rbox(1.0, 0.13, 0.65, DYES[(k + 4) % 6] as string, 0.03), 0.8, y + k * 0.13, 0.55),
        );
      break;
    case "spice":
      xs(5).forEach((x, i) => {
        o.push(at(drum(0.3, 0.42, "#e6d3ad", 0.08, 12), x, y, 0.75));
        o.push(
          at(
            ball(
              0.28,
              ["#e3b04b", "#c8553d", "#b6a26a", "#9a7b55", "#d98a4a"][i] as string,
              1,
              0.5,
              1,
            ),
            x,
            y + 0.36,
            0.75,
          ),
        );
      });
      o.push(
        at(drum(0.03, 1.2, BRASS, 0.01, 6), 0, y, 0.2),
        at(rbox(1.0, 0.04, 0.04, BRASS, 0.01), 0, y + 1.2, 0.2),
      );
      for (const sx of [-0.5, 0.5]) o.push(at(drum(0.2, 0.05, BRASS, 0.02, 10), sx, y + 0.75, 0.2));
      break;
    case "brass":
      o.push(
        at(rbox(w - 0.6, 0.35, 0.5, WOOD, 0.04), 0, y, 0.95),
        at(rbox(w - 0.6, 0.7, 0.4, WOOD, 0.04), 0, y, 0.4),
      );
      xs(5).forEach((x, i) => {
        o.push(
          at(
            lathe(
              i % 2
                ? MATKA
                : [
                    [0, 0],
                    [0.18, 0],
                    [0.22, 0.2],
                    [0.1, 0.38],
                    [0.14, 0.45],
                    [0, 0.45],
                  ],
              BRASS,
              12,
            ).scale(0.7, 0.7, 0.7),
            x,
            y + 0.35,
            0.95,
          ),
        );
      });
      xs(4).forEach((x) => {
        o.push(at(drum(0.28, 0.04, BRASS, 0.01, 14).rotateX(Math.PI / 2 - 0.2), x, y + 1.0, 0.4));
      });
      break;
    case "bangles":
      xs(3).forEach((x, i) => {
        o.push(
          at(drum(0.25, 0.1, WOOD_D, 0.03, 10), x, y, 0.7),
          at(drum(0.04, 1.2, WOOD_D, 0.01, 6), x, y, 0.7),
        );
        for (let k = 0; k < 8; k++)
          o.push(
            at(
              paint(
                clean(new THREE.TorusGeometry(0.16, 0.035, 5, 12).rotateX(Math.PI / 2)),
                DYES[(k + i) % 6] as string,
              ),
              x,
              y + 0.25 + k * 0.1,
              0.7,
            ),
          );
      });
      break;
    case "shoes":
      o.push(at(rbox(w - 0.6, 0.5, 0.45, WOOD, 0.04), 0, y, 0.4));
      for (const [yy, zz] of [
        [y, 0.95],
        [y + 0.5, 0.4],
      ] as const)
        xs(5).forEach((x, i) => {
          for (const dx of [-0.1, 0.1])
            o.push(
              at(
                rbox(0.15, 0.1, 0.36, DYES[(i + (yy > y ? 3 : 0)) % 6] as string, 0.04),
                x + dx,
                yy,
                zz,
              ),
            );
        });
      break;
    case "lamps":
      xs(4).forEach((x, i) => {
        o.push(
          at(
            cable(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.6, 0), 0.015, IRON),
            x,
            2.0,
            1.3,
          ),
          at(rbox(0.32, 0.45, 0.32, i % 2 ? LIME : BRASS, 0.06), x, 1.55, 1.3),
          at(
            lathe(
              [
                [0, 0],
                [0.24, 0],
                [0, 0.2],
              ],
              IRON,
              8,
            ),
            x,
            2.0,
            1.3,
          ),
        );
      });
      xs(6).forEach((x) => {
        o.push(
          at(
            lathe(
              [
                [0, 0],
                [0.12, 0],
                [0.16, 0.08],
                [0, 0.08],
              ],
              CLAY,
              8,
            ),
            x,
            y,
            0.9,
          ),
        );
      });
      break;
  }
  return o;
}

/** One shop: a deep box, a dark open front with a timber frame, the otla, a striped awning, a sign board; a jharokha if two-storeyed. */
function shop(
  x: number,
  z: number,
  yaw: number,
  w: number,
  i: number,
  kind: Goods,
  tall: boolean,
): G[] {
  const o: G[] = [];
  const wall = [SAND, LIME, "#efd6b0", mix(SAND, ROSE, 0.5)][i % 4] as string;
  const awn = DYES[i % DYES.length] as string;
  const H = tall ? 6.4 : 4.1;
  o.push(
    at(rbox(w, H, 3.2, wall, 0.08), 0, 0, -1.6),
    at(rbox(w + 0.2, 0.25, 3.4, SAND_D, 0.05), 0, H, -1.6),
  );
  for (let m = 0; m < Math.floor(w / 1.1); m++)
    o.push(at(rbox(0.5, 0.4, 0.3, SAND_D, 0.05), -w / 2 + 0.55 + m * 1.1, H + 0.25, -0.1));
  o.push(at(rbox(w - 0.7, 2.3, 0.1, DARK, 0.02), 0, 0.55, 0.02));
  for (const sx of [-1, 1])
    o.push(at(rbox(0.16, 2.4, 0.16, WOOD_D, 0.03), sx * (w / 2 - 0.35), 0.55, 0.06));
  o.push(at(rbox(w - 0.4, 0.16, 0.16, WOOD_D, 0.03), 0, 2.82, 0.06));
  o.push(
    at(rbox(w, 0.55, 1.3, SAND_D, 0.06), 0, 0, 0.65),
    at(rbox(1.2, 0.25, 0.5, SAND_D, 0.04), 0, 0, 1.5),
  );
  const n = 4;
  for (let k = 0; k < n; k++)
    o.push(
      at(
        rbox(w / n + 0.01, 0.07, 1.55, k % 2 ? LIME : awn, 0.02),
        -w / 2 + (k + 0.5) * (w / n),
        3.05,
        0.72,
        0,
        0.32,
      ),
    );
  o.push(at(rbox(w, 0.2, 0.04, awn, 0.01), 0, 2.62, 1.48));
  o.push(at(rbox(w - 1.0, 0.5, 0.08, mix(awn, WHITE, 0.45), 0.03), 0, 3.42, 0.04));
  if (tall) {
    o.push(at(rbox(w + 0.05, 0.22, 3.25, SAND_D, 0.04), 0, 4.05, -1.6));
    o.push(
      at(rbox(1.8, 1.35, 0.75, wall, 0.08), 0, 4.4, 0.32),
      at(profileWall(arch(0, 0, 1.05, 0.95), 0.05, WOOD_D), 0, 4.55, 0.72),
      at(rbox(2.3, 0.1, 1.05, SAND_D, 0.03), 0, 5.75, 0.32),
    );
    o.push(
      at(
        lathe(
          [
            [0, 0],
            [0.85, 0],
            [0.75, 0.25],
            [0.4, 0.55],
            [0, 0.65],
          ],
          mix(wall, SAND_D, 0.4),
          12,
        ).scale(1, 1, 0.5),
        0,
        5.85,
        0.32,
      ),
    );
  }
  o.push(...goods(kind, w));
  return o.map((g) => at(g, x, 0, z, yaw));
}

/** A thela (handcart) heaped with produce, a parasol over it. */
function thela(x: number, z: number, yaw: number, c1: string, c2: string, brolly: string): G[] {
  const o: G[] = [at(rbox(2.2, 0.16, 1.1, WOOD, 0.04), 0, 0.75, 0)];
  for (const sz of [-1, 1])
    o.push(
      at(paint(clean(new THREE.TorusGeometry(0.38, 0.06, 6, 14)), IRON), 0.3, 0.42, sz * 0.62),
      at(drum(0.03, 0.75, WOOD_D, 0.01, 6), -0.9, 0, sz * 0.45),
      at(rbox(0.9, 0.06, 0.06, WOOD_D, 0.02), 1.5, 0.84, sz * 0.4),
    );
  o.push(at(ball(0.85, c1, 1.15, 0.42, 0.55), 0, 0.88, 0));
  for (let i = 0; i < 7; i++)
    o.push(
      at(
        ball(0.15, i % 2 ? c2 : c1),
        -0.7 + i * 0.23,
        1.12 + (i % 3) * 0.08,
        ((i % 2) - 0.5) * 0.3,
      ),
    );
  o.push(
    at(drum(0.03, 1.6, WOOD_D, 0.01, 6), -0.85, 0.9, 0),
    at(
      lathe(
        [
          [0, 0],
          [1.0, 0],
          [0.5, 0.3],
          [0, 0.4],
        ],
        brolly,
        10,
      ),
      -0.85,
      2.4,
      0,
    ),
  );
  return o.map((g) => at(g, x, 0, z, yaw));
}

/** 5 · Bazaar: a chowk of small specialist shops round a neem on its chabutra, handcarts, bunting. */
function lmBazaar(): LM {
  const parts: G[] = [];
  const flats: G[] = [];
  const kinds: Goods[] = ["cloth", "pots", "spice", "brass", "bangles", "shoes", "lamps"];
  const SW = 3.4;
  const lamps: Lamp[] = [];
  for (let i = 0; i < 7; i++) {
    const x = -10.2 + i * SW;
    parts.push(...shop(x, -7, 0, SW, i, kinds[i] as Goods, i % 3 === 1));
    if (i % 2 === 0) lamps.push({ x, y: 2.2, z: -5.6, r: 3.6 });
  }
  for (let i = 0; i < 3; i++) {
    const z = -2.4 + i * SW;
    parts.push(...shop(-14, z, Math.PI / 2, SW, i + 3, kinds[(i + 2) % 7] as Goods, i === 1));
    parts.push(...shop(14, z, -Math.PI / 2, SW, i + 5, kinds[(i + 5) % 7] as Goods, i === 0));
    if (i !== 1) lamps.push({ x: -12.6, y: 2.2, z, r: 3.6 }, { x: 12.6, y: 2.2, z, r: 3.6 });
  }
  // The back corners: taller blocks with a chhatri; the front corners: a pavilion each.
  for (const sx of [-1, 1]) {
    parts.push(
      at(rbox(3.6, 5.4, 3.6, SAND, 0.08), sx * 15.6, 0, -8.6),
      at(rbox(4.0, 0.25, 4.0, SAND_D, 0.05), sx * 15.6, 5.4, -8.6),
      ...kiosk(sx * 15.6, 5.65, -8.6, SAND, SAND_D, 0.9),
    );
    parts.push(...chhatriAt(sx * 15.6, 0, 7.6, 0.8));
  }
  // The paved chowk with its joints.
  flats.push(
    flatPoly(
      [
        [-14, -5.7],
        [14, -5.7],
        [14, 9.6],
        [-14, 9.6],
      ],
      0.03,
      PAVE,
    ),
  );
  for (let x = -12; x <= 12; x += 3)
    flats.push(
      band(
        [
          [x, -5.6],
          [x, 9.5],
        ],
        0.04,
        0.04,
        mix(SAND_D, LIME, 0.35),
      ),
    );
  for (let z = -3; z <= 9; z += 3)
    flats.push(
      band(
        [
          [-13.9, z],
          [13.9, z],
        ],
        0.04,
        0.04,
        mix(SAND_D, LIME, 0.35),
      ),
    );
  // The chabutra with its neem, a little shrine niche and lamps.
  parts.push(
    at(drum(3.0, 0.7, SAND_D, 0.1, 28), 0, 0, 1.5),
    at(drum(2.7, 0.15, LIME, 0.05, 28), 0, 0.7, 1.5),
    ...neem(0, 1.5, 1.15, 0.85),
  );
  parts.push(
    at(rbox(0.7, 0.8, 0.5, LIME, 0.06), 0, 0.85, 3.6),
    at(rbox(0.4, 0.45, 0.06, "#c8553d", 0.02), 0, 0.95, 3.86),
  );
  parts.push(
    ...thela(-6.5, 3.5, 0.3, "#e0a35e", "#9fb48a", DYES[3] as string),
    ...thela(6.5, 4.5, -0.25, "#9fb48a", "#c8553d", DYES[1] as string),
    ...thela(4, -2.6, 2.9, "#c8553d", "#e3b04b", DYES[2] as string),
  );
  // Bamboo poles at the front, bunting from them back to the shops.
  for (const sx of [-7, 7]) {
    parts.push(at(drum(0.08, 4.6, WOOD, 0.02, 6), sx, 0, 8.6));
    parts.push(...bunting([sx, 4.5, 8.6], [sx, 4.3, -7.05], 0.9, sx > 0 ? 2 : 0));
  }
  parts.push(...bunting([-7, 4.5, 8.6], [7, 4.5, 8.6], 0.6, 4));
  const pl = plaque("BAZAAR", "a shop for every job", -10, 11.4);
  lamps.push(
    { x: 0, y: 1.5, z: 3.8, r: 4 },
    { x: -15.6, y: 2.5, z: 7.6, r: 4 },
    { x: 15.6, y: 2.5, z: 7.6, r: 4 },
  );
  return { parts: [...parts, ...pl.part], flats, signs: [pl.sign], lamps };
}

/** A Gadiya Lohar cart at true size: carved body on two spoked wheels, the tall front board, shafts down, its load lashed on. */
function gadi(x: number, z: number, yaw: number): G[] {
  const o: G[] = [];
  o.push(
    at(rbox(2.7, 0.85, 1.4, WOOD, 0.1), 0, 0.85, 0),
    at(rbox(2.8, 0.1, 1.5, WOOD_D, 0.03), 0, 1.7, 0),
  );
  o.push(at(rbox(0.18, 1.8, 1.55, WOOD_D, 0.06), 1.35, 0.6, 0));
  for (let i = 0; i < 3; i++)
    for (const zz of [-0.45, 0, 0.45]) o.push(at(ball(0.08, BRASS), 1.46, 1.0 + i * 0.42, zz));
  for (let i = 0; i < 6; i++)
    for (const sd of [-1, 1]) o.push(at(ball(0.05, BRASS), -1.1 + i * 0.42, 1.3, sd * 0.71));
  for (const sd of [-1, 1]) {
    o.push(
      at(paint(clean(new THREE.TorusGeometry(0.75, 0.08, 8, 24)), WOOD_D), -0.2, 0.83, sd * 0.85),
    );
    for (let k = 0; k < 6; k++)
      o.push(
        at(
          rbox(1.45, 0.06, 0.06, WOOD, 0.02)
            .translate(0, -0.03, 0)
            .rotateZ((k / 6) * Math.PI),
          -0.2,
          0.83,
          sd * 0.85,
        ),
      );
    o.push(
      at(
        drum(0.15, 0.22, BRASS, 0.03, 10).rotateX(Math.PI / 2),
        -0.2,
        0.83,
        sd * 0.85 - (sd < 0 ? 0.22 : 0),
      ),
    );
    o.push(at(rbox(2.6, 0.1, 0.1, WOOD_D, 0.03), 2.6, 0.43, sd * 0.45, 0, 0, -0.33));
  }
  // The load: a bundle, a rolled quilt, a tied-on cot frame; iron pans hanging off the back.
  o.push(
    at(ball(0.5, "#d9b07a", 1.6, 0.7, 1.2), -0.4, 1.75, 0),
    at(ball(0.35, DYES[0] as string, 1.5, 0.8, 1), 0.6, 1.75, 0.2),
    at(drum(0.24, 1.2, DYES[2] as string, 0.1, 10).rotateX(Math.PI / 2), -0.9, 2.0, -0.6),
  );
  for (const zz of [-0.35, 0.35])
    o.push(at(drum(0.3, 0.04, IRON, 0.01, 14).rotateZ(Math.PI / 2), -1.36, 1.15, zz));
  return o.map((g) => at(g, x, 0, z, yaw));
}

/** A lean-to sheet off the cart's side, on two poles, a durrie under it (in the cart's own frame). */
function tapra(x: number, z: number, yaw: number, seed: number): G[] {
  const o: G[] = [];
  for (const sx of [-1.3, 1.3]) o.push(at(drum(0.05, 1.45, WOOD_D, 0.01, 6), sx, 0, 3.3));
  for (let k = 0; k < 3; k++)
    o.push(
      at(
        rbox(0.95, 0.05, 2.7, DYES[(k + seed) % 6] as string, 0.02),
        -0.95 + k * 0.95,
        1.7,
        2.1,
        0,
        0.24,
      ),
    );
  o.push(at(rbox(2.6, 0.03, 2.2, mix(DYES[(seed + 3) % 6] as string, SAND, 0.3), 0.01), 0, 0, 2.1));
  for (let k = 0; k < 3; k++) o.push(at(rbox(2.6, 0.035, 0.12, LIME, 0.01), 0, 0, 1.3 + k * 0.8));
  return o.map((g) => at(g, x, 0, z, yaw));
}

function charpai(x: number, z: number, yaw: number): G[] {
  const o: G[] = [];
  for (const [dx, dz] of [
    [-0.9, -0.45],
    [0.9, -0.45],
    [-0.9, 0.45],
    [0.9, 0.45],
  ] as const)
    o.push(at(drum(0.06, 0.48, WOOD, 0.02, 6), dx, 0, dz));
  for (const sz of [-0.45, 0.45]) o.push(at(rbox(1.95, 0.08, 0.08, WOOD, 0.02), 0, 0.42, sz));
  for (const sx of [-0.9, 0.9]) o.push(at(rbox(0.08, 0.08, 0.98, WOOD, 0.02), sx, 0.42, 0));
  o.push(at(rbox(1.75, 0.04, 0.84, "#e8d6b0", 0.01), 0, 0.46, 0));
  for (let k = 0; k < 5; k++)
    o.push(at(rbox(0.07, 0.045, 0.84, "#c9a46e", 0.01), -0.7 + k * 0.35, 0.46, 0));
  return o.map((g) => at(g, x, 0, z, yaw));
}

/** 6 · Gadiya Lohar dera: the travelling toolsmiths' camp — carts, lean-tos, the forge, and every tool laid out on a mat. */
function lmDera(): LM {
  const parts: G[] = [];
  const flats: G[] = [];
  flats.push(
    flatPoly(
      chaikin(
        [
          [-11, -7.5],
          [0, -9],
          [10, -7],
          [11.5, 2.5],
          [7, 7.2],
          [-5, 7.6],
          [-11.5, 3],
        ] as Pt[],
        3,
      ),
      0.02,
      mix(PEACH, "#c99a6a", 0.22),
    ),
  );
  parts.push(
    ...gadi(-5, -2.5, 0.25),
    ...tapra(-5, -2.5, 0.25 + Math.PI, 0),
    ...gadi(4.5, -3, -0.3),
    ...tapra(4.5, -3, -0.3 + Math.PI, 2),
  );
  // A sleeping tent (two sloped cloths on a ridge pole) at the back.
  {
    const t: G[] = [];
    for (const sd of [-1, 1])
      t.push(
        at(
          rbox(
            2.6,
            0.05,
            1.75,
            sd < 0 ? (DYES[2] as string) : mix(DYES[2] as string, LIME, 0.3),
            0.02,
          ),
          0,
          0.62,
          sd * 0.58,
          0,
          sd * 0.83,
        ),
      );
    t.push(
      at(drum(0.04, 1.3, WOOD_D, 0.01, 6), -1.3, 0, 0),
      at(drum(0.04, 1.3, WOOD_D, 0.01, 6), 1.3, 0, 0),
    );
    parts.push(...t.map((g) => at(g, -8.3, 0, -5.2, 0.35)));
  }
  // A tool rack: two posts and a bar with ladles, sickles and chains hanging from it.
  parts.push(
    at(drum(0.06, 1.9, WOOD_D, 0.01, 6), 6.6, 0, 3.4),
    at(drum(0.06, 1.9, WOOD_D, 0.01, 6), 9.0, 0, 3.4),
    at(rbox(2.6, 0.09, 0.09, WOOD_D, 0.02), 7.8, 1.82, 3.4),
  );
  for (let i = 0; i < 6; i++) {
    const x = 6.95 + i * 0.34;
    parts.push(at(rbox(0.05, 0.75, 0.03, IRON, 0.01), x, 1.05, 3.4));
    if (i % 2 === 0)
      parts.push(at(drum(0.13, 0.05, IRON, 0.01, 10).rotateX(Math.PI / 2), x, 0.95, 3.4));
    else
      parts.push(
        at(
          paint(clean(new THREE.TorusGeometry(0.16, 0.025, 4, 10, Math.PI * 1.2)), IRON),
          x,
          0.95,
          3.42,
        ),
      );
  }
  // The forge: a clay hearth with glowing coals, two leather bellows, an anvil on its stump, a quench pot, rods.
  {
    const fx = -1;
    const fz = 2.2;
    flats.push(flatPoly(ring(fx, fz, 2.6, 20, 0.8), 0.035, "#d8c2a6"));
    parts.push(
      at(
        lathe(
          [
            [0.45, 0.25],
            [0.5, 0],
            [1.0, 0],
            [0.95, 0.35],
            [0.6, 0.42],
          ],
          "#c98466",
          16,
        ),
        fx,
        0,
        fz,
      ),
      at(drum(0.5, 0.3, "#e88a4a", 0.05, 14), fx, 0, fz),
    );
    for (let k = 0; k < 5; k++)
      parts.push(
        at(
          ball(0.13, "#f2b25a"),
          fx + Math.cos(k * 1.3) * 0.25,
          0.25,
          fz + Math.sin(k * 1.3) * 0.25,
        ),
      );
    for (const dz of [-0.45, 0.45])
      parts.push(
        at(ball(0.42, "#8a6a52", 1.4, 0.55, 0.85), fx - 1.7, 0, fz + dz),
        at(drum(0.05, 1.0, IRON, 0.01, 6).rotateZ(Math.PI / 2), fx - 0.75, 0.25, fz + dz * 0.5),
      );
    parts.push(
      at(drum(0.34, 0.55, WOOD_D, 0.06, 12), fx + 1.6, 0, fz + 0.4),
      at(rbox(0.7, 0.25, 0.3, IRON, 0.05), fx + 1.6, 0.55, fz + 0.4),
      at(
        lathe(
          [
            [0, 0],
            [0.12, 0],
            [0, 0.32],
          ],
          IRON,
          8,
        ).rotateZ(-Math.PI / 2),
        fx + 1.95,
        0.68,
        fz + 0.4,
      ),
    );
    parts.push(
      at(lathe(MATKA, CLAY, 12), fx + 1.5, 0, fz - 0.8),
      at(rbox(0.06, 0.06, 0.8, IRON, 0.01), fx + 1.35, 0.82, fz + 0.4, 0.5),
    );
    for (let k = 0; k < 6; k++)
      parts.push(
        at(
          drum(0.04, 1.6, IRON, 0.01, 5).rotateZ(Math.PI / 2 - 0.05),
          fx - 0.2 + k * 0.06,
          0.04 + (k % 2) * 0.05,
          fz - 1.6 + k * 0.1,
        ),
      );
  }
  // The tool mat by the road: pans, woks, sickles, hammers, tongs, axe heads, in neat rows.
  {
    const mx = 3.5;
    const mz = 4.8;
    parts.push(
      at(rbox(4.0, 0.03, 2.1, "#e3b04b", 0.01), mx, 0, mz),
      at(rbox(3.7, 0.045, 1.8, "#b85c43", 0.01), mx, 0, mz),
    );
    for (let i = 0; i < 4; i++)
      parts.push(at(drum(0.3, 0.04, IRON, 0.01, 16), mx - 1.3 + i * 0.85, 0.05, mz - 0.5));
    for (let i = 0; i < 4; i++)
      parts.push(
        at(drum(0.27, 0.14, IRON, 0.05, 14), mx - 1.3 + i * 0.85, 0.05, mz + 0.15),
        at(drum(0.21, 0.02, "#3f3a48", 0.01, 14), mx - 1.3 + i * 0.85, 0.19, mz + 0.15),
      );
    for (let i = 0; i < 3; i++)
      parts.push(
        at(
          paint(
            clean(new THREE.TorusGeometry(0.24, 0.03, 4, 12, Math.PI * 1.2).rotateX(-Math.PI / 2)),
            IRON,
          ),
          mx - 1.4 + i * 0.5,
          0.06,
          mz + 0.65,
        ),
        at(rbox(0.06, 0.05, 0.3, WOOD, 0.01), mx - 1.16 + i * 0.5, 0.05, mz + 0.85),
      );
    for (let i = 0; i < 2; i++)
      parts.push(
        at(rbox(0.12, 0.08, 0.7, WOOD, 0.02), mx + 0.4 + i * 0.5, 0.05, mz + 0.65),
        at(rbox(0.32, 0.14, 0.14, IRON, 0.03), mx + 0.4 + i * 0.5, 0.05, mz + 0.35),
      );
    for (const r of [0.25, -0.25])
      parts.push(at(rbox(0.05, 0.04, 0.8, IRON, 0.01), mx + 1.5, 0.05, mz + 0.6, r));
    parts.push(
      at(rbox(0.35, 0.08, 0.3, IRON, 0.03), mx + 1.15, 0.05, mz - 0.95),
      at(rbox(0.35, 0.08, 0.3, IRON, 0.03), mx + 1.6, 0.05, mz - 0.95),
    );
    // A grindstone on its frame beside the mat.
    parts.push(
      at(
        paint(
          clean(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 18).rotateX(Math.PI / 2)),
          "#b7ab9b",
        ),
        mx - 3,
        0.75,
        mz,
      ),
      at(rbox(0.12, 0.7, 0.9, WOOD, 0.02), mx - 3.2, 0, mz),
      at(rbox(0.12, 0.7, 0.9, WOOD, 0.02), mx - 2.8, 0, mz),
    );
  }
  // Home: a charpai, a clay chulha with a pot, a water stand with matkas, a clothes line.
  parts.push(...charpai(8.5, -0.3, 0.4), ...charpai(-8.8, 1.2, -0.3));
  parts.push(
    at(rbox(0.25, 0.38, 0.75, "#c98466", 0.06), -6.9, 0, 3.8),
    at(rbox(0.25, 0.38, 0.75, "#c98466", 0.06), -6.1, 0, 3.8),
    at(rbox(0.8, 0.38, 0.22, "#c98466", 0.06), -6.5, 0, 3.5),
    at(
      lathe(
        [
          [0, 0],
          [0.3, 0],
          [0.34, 0.25],
          [0.28, 0.32],
          [0, 0.32],
        ],
        IRON,
        12,
      ),
      -6.5,
      0.38,
      3.8,
    ),
    at(ball(0.14, "#f2b25a"), -6.5, 0.05, 4.05),
  );
  parts.push(at(rbox(1.8, 0.6, 0.55, WOOD, 0.05), 0.5, 0, -6.2));
  for (let i = 0; i < 3; i++)
    parts.push(
      at(
        lathe(MATKA, i === 1 ? BRASS : CLAY, 12).scale(
          i === 1 ? 0.7 : 1,
          i === 1 ? 0.7 : 1,
          i === 1 ? 0.7 : 1,
        ),
        -0.1 + i * 0.6,
        0.6,
        -6.2,
      ),
    );
  const A = new THREE.Vector3(-3.4, 1.9, -6.6);
  const B = new THREE.Vector3(-0.8, 1.9, -7.6);
  parts.push(
    at(drum(0.05, 1.95, WOOD_D, 0.01, 6), A.x, 0, A.z),
    at(drum(0.05, 1.95, WOOD_D, 0.01, 6), B.x, 0, B.z),
    cable(A, B, 0.02, WOOD_D),
  );
  for (let i = 0; i < 5; i++) {
    const p = A.clone().lerp(B, (i + 0.6) / 5.4);
    parts.push(
      at(
        rbox(0.55, 0.7 + (i % 2) * 0.2, 0.03, DYES[(i + 1) % 6] as string, 0.01),
        p.x,
        p.y - 0.75 - (i % 2) * 0.2,
        p.z,
        -Math.atan2(B.z - A.z, B.x - A.x),
      ),
    );
  }
  // Shade trees, and the thorn fence (bada) round the back of the camp.
  parts.push(...khejri(-10, -3, 1.15), ...khejri(10, -5, 1.0), ...khejri(-1.5, -9.3, 0.85));
  const rnd = rng(3);
  for (let a = Math.PI * 1.06; a < Math.PI * 1.94; a += 0.045) {
    if (rnd() < 0.12) continue;
    parts.push(
      at(
        ball(0.35 + rnd() * 0.3, rnd() < 0.5 ? "#a08463" : "#8d7356", 1.3, 0.6 + rnd() * 0.3, 1.1),
        Math.cos(a) * 12.8,
        0,
        -0.5 + Math.sin(a) * 9.3,
      ),
    );
  }
  const pl = plaque("LOHAR DERA", "every tool, laid out", -6, 8.4);
  const lamps: Lamp[] = [
    { x: -1, y: 0.8, z: 2.2, r: 6 },
    { x: -6.5, y: 0.6, z: 3.9, r: 4 },
    { x: -5, y: 1.6, z: -1, r: 4 },
    { x: 4.5, y: 1.6, z: -1.5, r: 4 },
    { x: 3.5, y: 0.8, z: 4.8, r: 3.5 },
    { x: 7.8, y: 1.5, z: 3.8, r: 3 },
  ];
  return { parts: [...parts, ...pl.part], flats, signs: [pl.sign], lamps };
}

/** 9 · R1 · Ghanta Ghar (Jodhpur's clock tower): a stepped sandstone tower, four clock faces, chhatris on top, its chowk. */
function lmClockTower(): LM {
  const parts: G[] = [];
  const flats: G[] = [];
  flats.push(
    flatPoly(
      ring(0, 0, 11.5, 8).map(([x, z]) => [x, z] as Pt),
      0.03,
      PAVE,
    ),
  );
  flats.push(band(closed(ring(0, 0, 9, 8)), 0.12, 0.04, SAND_D));
  flats.push(band(closed(ring(0, 0, 6.2, 8)), 0.08, 0.04, mix(SAND_D, LIME, 0.3)));
  parts.push(
    at(rbox(7.4, 0.5, 7.4, SAND_D, 0.08), 0, 0, 0),
    at(rbox(6.6, 0.4, 6.6, SAND, 0.06), 0, 0.5, 0),
  );
  parts.push(
    at(rbox(5.2, 4.2, 5.2, SAND, 0.1), 0, 0.9, 0),
    at(rbox(6.0, 0.18, 6.0, SAND_D, 0.04), 0, 5.1, 0, 0, 0),
  );
  for (let m = 0; m < 4; m++) {
    const yaw = (m * Math.PI) / 2;
    const face = (g: G, y: number, d: number) => parts.push(at(g.translate(0, y, d), 0, 0, 0, yaw));
    face(profileWall(arch(0, 0, 2.0, 3.0), 0.1, DARK), 0.9, 2.62);
    face(profileWall(arch(0, 0, 2.6, 3.35), 0.08, LIME, [arch(0, 0, 2.0, 3.0)]), 0.9, 2.66);
    for (const y of [6.6, 9.4]) face(profileWall(arch(0, 0, 0.55, 1.2), 0.06, DARK), y, 1.92);
    face(rbox(4.6, 0.22, 0.4, SAND_D, 0.04), 13.1, 2.3);
    // The hands are live (the world turns them to the local time): the face alone here.
    clockFace(1.25, false).forEach((g) => {
      face(g, 14.75, 2.32);
    });
  }
  parts.push(at(rbox(3.8, 8, 3.8, SAND, 0.08), 0, 5.3, 0));
  for (const y of [8.0, 10.7]) parts.push(at(rbox(4.0, 0.25, 4.0, SAND_D, 0.05), 0, y, 0));
  parts.push(
    at(rbox(4.6, 3.1, 4.6, LIME, 0.1), 0, 13.3, 0),
    at(rbox(5.4, 0.22, 5.4, SAND_D, 0.05), 0, 16.4, 0),
  );
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    parts.push(...kiosk(dx * 2.1, 16.62, dz * 2.1, SAND, SAND_D, 0.5));
  parts.push(...chhatriAt(0, 16.62, 0, 0.75, false));
  // The chowk: lamp posts, benches, neems at the edge.
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    parts.push(...lampPost(dx * 6.8, dz * 6.8));
    parts.push(
      at(
        rbox(2.2, 0.45, 0.6, SAND_D, 0.06),
        dx * 4.6,
        0,
        dz * 7.6,
        dx * dz > 0 ? -Math.PI / 4 : Math.PI / 4,
      ),
    );
  }
  parts.push(
    ...neem(-14.5, -5, 1.15),
    ...neem(14.5, -4, 1.1),
    ...neem(-12, -12, 1),
    ...shrub(-12.5, 4),
    ...shrub(13, 5),
    ...shrub(11, -10),
  );
  const pl = plaque("GHANTA GHAR", "on the hour, every hour", -6.5, 11);
  const lamps: Lamp[] = [
    { x: 0, y: 14.75, z: 3.5, r: 5 },
    { x: 3.5, y: 14.75, z: 0, r: 5 },
    { x: 0, y: 2.2, z: 3.4, r: 4 },
    { x: 3.4, y: 2.2, z: 0, r: 4 },
    { x: -3.4, y: 2.2, z: 0, r: 4 },
    ...[
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([dx, dz]) => ({ x: (dx as number) * 6.8, y: 2.8, z: (dz as number) * 6.8, r: 4 })),
    { x: 0, y: 18, z: 0, r: 4 },
  ];
  return { parts: [...parts, ...pl.part], flats, signs: [pl.sign], lamps };
}

/** 9 · R2 · A desert railway station: a sandstone station with chhatris and a clock, the platform, a metre-gauge train, water tank, signal. */
function lmStation(own = true): LM {
  const parts: G[] = [];
  const flats: G[] = [];
  const TZ = -7;
  if (own) {
    flats.push(
      band(
        [
          [-50, TZ],
          [50, TZ],
        ],
        1.7,
        0.03,
        "#d6c4a6",
      ),
    );
    for (let x = -48; x <= 48; x += 1.1)
      parts.push(at(rbox(0.35, 0.12, 2.4, WOOD_D, 0.02), x, 0, TZ));
    for (const sz of [-0.72, 0.72])
      parts.push(at(rbox(98, 0.14, 0.12, "#8d8a96", 0.02), 0, 0.12, TZ + sz));
  }
  // The platform.
  parts.push(
    at(rbox(36, 0.9, 4.4, SAND_D, 0.08), 0, 0, TZ + 3.9),
    at(rbox(36, 0.04, 0.35, LIME, 0.01), 0, 0.9, TZ + 1.9),
  );
  // The station: long range, a taller central pavilion with porch and clock, chhatris, an arcade on the road side.
  parts.push(
    at(rbox(18, 4.4, 5, SAND, 0.1), 0, 0, 1.6),
    at(rbox(18.4, 0.22, 5.4, SAND_D, 0.05), 0, 4.4, 1.6),
  );
  for (let m = -8; m <= 8; m++)
    if (Math.abs(m) > 2) parts.push(at(rbox(0.5, 0.45, 0.35, SAND_D, 0.05), m * 1.05, 4.62, 4.1));
  for (let x = -8.2; x <= 8.3; x += 1.64)
    if (Math.abs(x) > 3) parts.push(at(drum(0.17, 3.2, LIME, 0.03, 8), x, 0, 5.4));
  for (const sx of [-1, 1]) parts.push(at(rbox(5.4, 0.22, 1.9, SAND_D, 0.04), sx * 5.8, 3.2, 5.0));
  for (let x = -7.4; x <= 7.5; x += 1.64)
    if (Math.abs(x) > 3) parts.push(at(profileWall(arch(0, 0, 0.9, 2.2), 0.06, DARK), x, 0, 4.15));
  parts.push(
    at(rbox(5.4, 6.8, 5.8, SAND, 0.1), 0, 0, 1.8),
    at(rbox(5.8, 0.22, 6.2, SAND_D, 0.05), 0, 6.8, 1.8),
  );
  parts.push(
    at(profileWall(arch(0, 0, 2.2, 3.2), 0.08, DARK), 0, 0, 4.75),
    at(profileWall(arch(0, 0, 2.8, 3.55), 0.06, LIME, [arch(0, 0, 2.2, 3.2)]), 0, 0, 4.78),
  );
  parts.push(at(rbox(5.0, 0.25, 2.8, SAND_D, 0.05), 0, 3.6, 6.1));
  for (const sx of [-2.2, 2.2]) parts.push(at(drum(0.22, 3.6, LIME, 0.04, 10), sx, 0, 7.2));
  parts.push(...clockFace(0.85).map((g) => at(g, 0, 5.3, 4.8)));
  parts.push(
    ...kiosk(0, 7.02, 1.8, SAND, SAND_D, 1.2),
    ...kiosk(-8.3, 4.62, 2.2, SAND, SAND_D, 0.8),
    ...kiosk(8.3, 4.62, 2.2, SAND, SAND_D, 0.8),
  );
  // On the platform: benches, a luggage trolley, milk cans; yellow name boards at both ends.
  for (const x of [-12, 12, -5.5, 5.5])
    parts.push(
      at(rbox(2, 0.45, 0.6, WOOD, 0.05), x, 0.9, -2.2),
      at(rbox(2, 0.5, 0.08, WOOD, 0.03), x, 1.35, -1.95),
    );
  parts.push(
    at(rbox(2.2, 0.12, 1.1, WOOD, 0.03), 9, 1.4, -3.4),
    at(rbox(0.4, 0.6, 0.4, "#c8553d", 0.05), 8.5, 1.52, -3.4),
    at(rbox(0.7, 0.5, 0.5, "#e3b04b", 0.05), 9.3, 1.52, -3.4),
  );
  for (const sz of [-1, 1])
    parts.push(
      at(paint(clean(new THREE.TorusGeometry(0.38, 0.06, 6, 14)), IRON), 9, 1.3, -3.4 + sz * 0.6),
    );
  for (let i = 0; i < 4; i++)
    parts.push(
      at(
        drum(0.22, 0.6, "#b7b1c2", 0.06, 12),
        -8 + (i % 2) * 0.5,
        0.9,
        -3.3 + Math.floor(i / 2) * 0.5,
      ),
    );
  const signs: THREE.Mesh[] = [];
  for (const x of [-15, 15]) {
    for (const dx of [-1.3, 1.3]) parts.push(at(drum(0.06, 2.6, IRON, 0.01, 6), x + dx, 0.9, -2.8));
    parts.push(at(rbox(3.0, 0.95, 0.1, "#e8c95a", 0.04), x, 2.4, -2.8));
    signs.push(sign("THAR JN", 2.7, 0.8, "#e8c95a", INK, x, 2.87, -2.73));
  }
  if (own) {
    // A metre-gauge train at the platform: a muted blue diesel and two maroon coaches.
    const bogies = (x0: number, len: number) => {
      for (const dx of [-len / 2 + 1.4, len / 2 - 1.4])
        parts.push(at(rbox(2.2, 0.55, 2.0, "#4a4555", 0.08), x0 + dx, 0.2, TZ));
    };
    bogies(-14, 8);
    parts.push(
      at(rbox(8, 2.6, 2.6, "#7f95bd", 0.2), -14, 0.75, TZ),
      at(rbox(8.05, 0.35, 2.65, "#f3e9da", 0.05), -14, 2.0, TZ),
      at(rbox(2.2, 3.4, 2.65, "#7f95bd", 0.2), -11, 0.75, TZ),
    );
    for (const dz of [-1.33, 1.33])
      parts.push(at(rbox(1.4, 0.7, 0.04, "#3f3a48", 0.02), -11, 3.0, TZ + dz));
    for (const [x0, c] of [
      [-4.6, "#a65a4c"],
      [4.9, "#a65a4c"],
    ] as const) {
      bogies(x0, 9);
      parts.push(
        at(rbox(9, 2.7, 2.7, c, 0.2), x0, 0.75, TZ),
        at(rbox(9.05, 0.3, 2.4, "#b5aebf", 0.15), x0, 3.42, TZ),
        at(rbox(9.05, 0.12, 2.75, "#e3b04b", 0.02), x0, 1.3, TZ),
      );
      for (let w = 0; w < 7; w++)
        parts.push(at(rbox(0.75, 0.6, 0.04, LIME, 0.03), x0 - 3.6 + w * 1.2, 2.2, TZ + 1.36));
    }
  }
  // The water tank on its legs, the water crane, the semaphore signal across the line.
  for (const [dx, dz] of [
    [-1.3, -1.3],
    [1.3, -1.3],
    [-1.3, 1.3],
    [1.3, 1.3],
  ] as const)
    parts.push(at(drum(0.14, 4.6, IRON, 0.02, 8), 21 + dx, 0, -1.5 + dz));
  parts.push(
    at(drum(2.0, 2.2, "#a59fb3", 0.12, 20), 21, 4.6, -1.5),
    at(
      lathe(
        [
          [0, 0],
          [2.1, 0],
          [0, 0.6],
        ],
        "#8d8a96",
        20,
      ),
      21,
      6.8,
      -1.5,
    ),
  );
  parts.push(
    at(drum(0.18, 3.6, IRON, 0.03, 8), 18, 0, -4),
    at(drum(0.1, 2.6, IRON, 0.02, 8).rotateX(Math.PI / 2), 18, 3.4, -4),
  );
  parts.push(
    at(drum(0.12, 6.2, IRON, 0.02, 8), -21, 0, TZ - 3),
    at(
      rbox(1.8, 0.3, 0.08, "#c8553d", 0.03).translate(0.9, 0, 0).rotateZ(0.6),
      -21,
      5.6,
      TZ - 2.92,
    ),
    at(rbox(0.3, 0.32, 0.1, LIME, 0.02).translate(0.9, 0, 0).rotateZ(0.6), -21, 5.6, TZ - 2.86),
  );
  // The forecourt: paving, neems, shrubs.
  flats.push(
    flatPoly(
      [
        [-12, 4.3],
        [12, 4.3],
        [12, 12.4],
        [-12, 12.4],
      ],
      0.03,
      PAVE,
    ),
  );
  parts.push(
    ...neem(-15, 8, 1.1),
    ...neem(15.5, 7, 1.15),
    ...shrub(-10, 10.5),
    ...shrub(10, 10.5),
    ...shrub(-8.5, 11.5, 0.8),
  );
  const pl = plaque("STATION", "on time, every time", -6.5, 11);
  const lamps: Lamp[] = [
    { x: 0, y: 3, z: 6.5, r: 5 },
    { x: 0, y: 5.3, z: 5.5, r: 3.5 },
    { x: -5.8, y: 2.5, z: 5.2, r: 4.5 },
    { x: 5.8, y: 2.5, z: 5.2, r: 4.5 },
    { x: -4.6, y: 2.4, z: TZ + 2, r: 5 },
    { x: 4.9, y: 2.4, z: TZ + 2, r: 5 },
    { x: -15, y: 2.6, z: -2, r: 3.5 },
    { x: 15, y: 2.6, z: -2, r: 3.5 },
    { x: -18, y: 2, z: TZ, r: 4 },
    { x: -21, y: 5.8, z: TZ - 2.6, r: 2.5 },
  ];
  return { parts: [...parts, ...pl.part], flats, signs: [...signs, pl.sign], lamps };
}

/** 9 · R4 · Caravanserai: a walled inn on the caravan route — a great gate, rooms round a courtyard, a well, camels resting. */
function lmSarai(): LM {
  const parts: G[] = [];
  const flats: G[] = [];
  const FZw = 5;
  const BZ = -13;
  flats.push(
    flatPoly(
      [
        [-11.5, BZ + 0.5],
        [11.5, BZ + 0.5],
        [11.5, FZw - 0.5],
        [-11.5, FZw - 0.5],
      ],
      0.03,
      mix(PEACH, "#c99a6a", 0.2),
    ),
  );
  parts.push(
    ...wallAlong(
      [
        [-12, BZ],
        [12, BZ],
      ],
      0,
      4.4,
      SAND,
      SAND_D,
    ),
    ...wallAlong(
      [
        [-12, BZ],
        [-12, FZw],
      ],
      0,
      4.4,
      SAND,
      SAND_D,
    ),
    ...wallAlong(
      [
        [12, BZ],
        [12, FZw],
      ],
      0,
      4.4,
      SAND,
      SAND_D,
    ),
  );
  parts.push(
    ...wallAlong(
      [
        [-12, FZw],
        [-3.2, FZw],
      ],
      0,
      4.4,
      SAND,
      SAND_D,
    ),
    ...wallAlong(
      [
        [3.2, FZw],
        [12, FZw],
      ],
      0,
      4.4,
      SAND,
      SAND_D,
    ),
  );
  for (const [x, z] of [
    [-12, BZ],
    [12, BZ],
    [-12, FZw],
    [12, FZw],
  ] as const)
    parts.push(
      at(drum(1.6, 5.2, SAND, 0.1, 18), x, 0, z),
      at(drum(1.8, 0.3, SAND_D, 0.05, 18), x, 5.2, z),
    );
  for (const x of [-12, 12]) parts.push(...kiosk(x, 5.5, FZw, SAND, SAND_D, 0.75));
  // The rooms: an arcade of cells along three sides of the court.
  parts.push(at(rbox(22, 3.2, 3, SAND, 0.08), 0, 0, BZ + 1.9));
  for (const sx of [-1, 1]) parts.push(at(rbox(3, 3.2, 14.5, SAND, 0.08), sx * 10.1, 0, -4.1));
  for (let x = -7.2; x <= 7.3; x += 2.4)
    parts.push(
      at(profileWall(arch(0, 0, 1.4, 2.3), 0.06, DARK), x, 0, BZ + 3.42),
      at(profileWall(arch(0, 0, 1.8, 2.55), 0.05, LIME, [arch(0, 0, 1.4, 2.3)]), x, 0, BZ + 3.44),
    );
  for (const sx of [-1, 1])
    for (let z = -9.5; z <= 2.5; z += 2.4)
      parts.push(
        at(profileWall(arch(0, 0, 1.4, 2.3), 0.06, DARK), sx * 8.58, 0, z, (sx * -Math.PI) / 2),
        at(
          profileWall(arch(0, 0, 1.8, 2.55), 0.05, LIME, [arch(0, 0, 1.4, 2.3)]),
          sx * 8.56,
          0,
          z,
          (sx * -Math.PI) / 2,
        ),
      );
  // The gate: a tall pol with a lime arch, a jharokha, kiosks; its doors swung open.
  parts.push(
    at(
      profileWall(
        [
          [-3.6, 0],
          [3.6, 0],
          [3.6, 7.2],
          [-3.6, 7.2],
        ],
        3,
        SAND,
        [arch(0, 0, 3.4, 5.2)],
      ),
      0,
      0,
      FZw,
    ),
  );
  parts.push(
    at(profileWall(arch(0, 0, 4.1, 5.55), 0.12, LIME, [arch(0, 0, 3.4, 5.2)]), 0, 0, FZw + 1.62),
  );
  parts.push(
    at(rbox(2.2, 1.2, 0.9, SAND, 0.1), 0, 5.7, FZw + 1.9),
    at(
      lathe(
        [
          [0, 0],
          [1.05, 0],
          [0.95, 0.3],
          [0.5, 0.7],
          [0, 0.85],
        ],
        LIME,
        14,
      ).scale(1, 1, 0.5),
      0,
      6.9,
      FZw + 1.9,
    ),
  );
  for (let i = -3; i <= 3; i++)
    parts.push(at(rbox(0.7, 0.6, 0.5, SAND_D, 0.06), i * 1.05, 7.2, FZw + 1.2));
  parts.push(
    ...kiosk(-2.8, 7.2, FZw - 0.6, SAND, SAND_D, 0.75),
    ...kiosk(2.8, 7.2, FZw - 0.6, SAND, SAND_D, 0.75),
  );
  for (const sx of [-1, 1])
    parts.push(
      at(
        rbox(1.7, 4.4, 0.15, WOOD_D, 0.04).translate(sx * -0.85, 0, 0),
        sx * 1.7,
        0,
        FZw - 1.6,
        sx * 1.25,
      ),
    );
  // The court: a well with its pulley frame, a neem, a campfire, two camels resting by their loads, a charpai.
  parts.push(
    at(drum(1.4, 0.9, SAND, 0.1, 20), 0, 0, -5),
    at(drum(1.0, 0.02, "#4d6b78", 0.01, 18), 0, 0.9, -5),
  );
  for (const sx of [-1, 1]) parts.push(at(rbox(0.25, 2.4, 0.25, SAND_D, 0.04), sx * 1.2, 0.9, -5));
  parts.push(
    at(rbox(2.7, 0.22, 0.3, WOOD_D, 0.04), 0, 3.3, -5),
    at(paint(clean(new THREE.TorusGeometry(0.3, 0.06, 6, 14)), WOOD), 0, 3.0, -5),
  );
  parts.push(...neem(-5.5, -8, 1.1));
  parts.push(...camel(4.5, -2.5, 0.4, P.coral), ...camel(6.5, -6, -0.6, P.marigold));
  for (let k = 0; k < 4; k++)
    parts.push(
      at(
        ball(0.45, ["#d9b07a", DYES[0], DYES[2], "#c9a46e"][k] as string, 1.4, 0.8, 1),
        6.2 + (k % 2) * 1.1,
        0,
        -0.8 + Math.floor(k / 2) * 0.9,
      ),
    );
  for (let k = 0; k < 7; k++)
    parts.push(at(ball(0.18, "#b7ab9b"), -3 + Math.cos(k) * 0.7, 0, 0.5 + Math.sin(k) * 0.7));
  parts.push(
    at(ball(0.3, "#f0a04b", 1, 1.3, 1), -3, 0, 0.5),
    at(ball(0.18, "#f7d06a", 1, 1.4, 1), -3, 0.2, 0.5),
  );
  parts.push(...charpai(-6, 2, 0.4));
  const pl = plaque("SARAI", "open every night", 8, 8.5);
  const lamps: Lamp[] = [
    { x: 0, y: 3, z: FZw + 2, r: 5 },
    { x: 0, y: 6, z: FZw + 2.5, r: 3.5 },
    { x: -3, y: 0.8, z: 0.5, r: 6 },
    { x: -4.8, y: 1.5, z: BZ + 4, r: 3.5 },
    { x: 2.4, y: 1.5, z: BZ + 4, r: 3.5 },
    { x: -8, y: 1.5, z: -4.7, r: 3.5 },
    { x: 8, y: 1.5, z: 0.1, r: 3.5 },
  ];
  return { parts: [...parts, ...pl.part], flats, signs: [pl.sign], lamps };
}

// ── into the world ──────────────────────────────────────────────────────────

/** The ground: sand peach (Ga). */
export const ZINGLE_GROUND = PEACH;
/** The fort's cream sandstone (F2). */
export const FORT_STONE = "#f5e2c3";
export const FORT_DARK = "#e2c49a";

/**
 * Solid circles worked out from the parts themselves: every part that stands knee-high or
 * taller from the ground (walls, pillars, trunks, carts), as circles along its long side. Low
 * things (rugs, steps, kerbs) and things up in the air (awnings, crowns, bunting) don't block.
 */
function solidsOf(parts: G[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  const seen = new Set<string>();
  for (const g of parts) {
    g.computeBoundingBox();
    const b = g.boundingBox as THREE.Box3;
    if (b.max.y < 0.7 || b.min.y > 1.2) continue;
    const sx = b.max.x - b.min.x;
    const sz = b.max.z - b.min.z;
    if (Math.max(sx, sz) < 0.1) continue;
    const long = Math.max(sx, sz);
    const short = Math.max(0.3, Math.min(sx, sz));
    const n = Math.min(60, Math.max(1, Math.round(long / short)));
    const r = Math.max(0.2, (short / 2) * 1.05);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = sx >= sz ? b.min.x + sx * t : (b.min.x + b.max.x) / 2;
      const z = sx >= sz ? (b.min.z + b.max.z) / 2 : b.min.z + sz * t;
      const key = `${Math.round(x / 0.5)},${Math.round(z / 0.5)},${Math.round(r * 4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([x, z, r]);
    }
  }
  return out;
}

/** A board landmark as the world wants it: one body, its flats, signs, lamps, footprint and solids. */
function landmark(lm: LM, extra: [number, number, number][] = []): Landmark & { pieces?: G[] } {
  const body = join(lm.parts);
  body.computeBoundingBox();
  const bb = (body.boundingBox as THREE.Box3).clone();
  let flats: G | undefined;
  if (lm.flats?.length) {
    flats = join(lm.flats);
    flats.computeBoundingBox();
    bb.union(flats.boundingBox as THREE.Box3);
  }
  // A big one (wider than an area of the scenery batches) also comes in ~36 m pieces, so each
  // piece is batched and culled with its own area instead of all of it drawing everywhere.
  let pieces: G[] | undefined;
  if (Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) > 40) {
    const cells = new Map<string, G[]>();
    const c = new THREE.Vector3();
    for (const g of lm.parts) {
      g.computeBoundingBox();
      (g.boundingBox as THREE.Box3).getCenter(c);
      const k = `${Math.floor(c.x / 36)},${Math.floor(c.z / 36)}`;
      const list = cells.get(k) ?? [];
      list.push(g);
      cells.set(k, list);
    }
    pieces = [...cells.values()].map((gs) => join(gs));
  }
  return {
    body,
    ...(pieces ? { pieces } : {}),
    ...(flats ? { flats } : {}),
    signs: lm.signs ?? [],
    lamps: (lm.lamps ?? []).map((l) => ({ x: l.x, y: l.y, z: l.z, r: l.r })),
    half: [Math.max(-bb.min.x, bb.max.x), Math.max(-bb.min.z, bb.max.z)],
    solids: [...solidsOf(lm.parts), ...extra],
  };
}

/** The lake of the ghat (local), for riding into it as water. */
export const GHAT_LAKE: Pt[] = chaikin(
  [
    [-17, -8],
    [17, -8],
    [20, -2],
    [15, 5],
    [4, 6.8],
    [-8, 6.4],
    [-19, 1],
  ] as Pt[],
  3,
);
/** The twin pols' arches (local x): the road runs through the first, its loop through the second. */
export const POL_ARCHES: [number, number] = [-5.2, 5.2];

export type ZingleLandmark =
  | "kund"
  | "pols"
  | "jantar"
  | "ghat"
  | "bazaar"
  | "dera"
  | "toshakhana"
  | "stepwell"
  | "clock"
  | "haveli"
  | "hawa"
  | "station"
  | "sarai"
  | "fort"
  | "bivouac"
  | "thada"
  | "badabagh";

/** Ghanta Ghar's four clock faces (local): each hand pivot, the way the face looks, its radius. */
export const CLOCK_FACES: { x: number; y: number; z: number; yaw: number; r: number }[] = [
  0, 1, 2, 3,
].map((m) => {
  const yaw = (m * Math.PI) / 2;
  return { x: Math.sin(yaw) * 2.32, y: 14.75, z: Math.cos(yaw) * 2.32, yaw, r: 1.25 };
});

// ── the fort (after Junagarh, Bikaner) ──
const pullIn = inset;
const FC = "#f5e2c3";
const FDK = "#e2c49a";
const FLT = "#fbf0dc";
const SAFFRON_M = "#e0a35e";
type Built = { parts: G[]; flats: G[]; lamps: Lamp[] };
const built = (): Built => ({ parts: [], flats: [], lamps: [] });
/** A fort wall along a polyline: battered plinth, thick body, string course, lotus merlons. */
function fwall(pts: Pt[], y0: number, h: number, c = FC, d = FDK): G[] {
  const out: G[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i] as Pt;
    const [bx, bz] = pts[i + 1] as Pt;
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.2) continue;
    const yaw = -Math.atan2(bz - az, bx - ax);
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    out.push(
      at(rbox(len + 1.4, h, 1.6, c, 0.08), mx, y0, mz, yaw),
      at(rbox(len + 1.6, h * 0.28, 2.2, mix(c, d, 0.4), 0.08), mx, y0, mz, yaw),
      at(rbox(len + 1.45, 0.22, 1.75, d, 0.04), mx, y0 + h * 0.7, mz, yaw),
    );
    const n = Math.max(1, Math.floor(len / 1.4));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      out.push(
        at(rbox(0.7, 0.6, 1.7, d, 0.08), x, y0 + h, z, yaw),
        at(ball(0.22, d), x, y0 + h + 0.55, z),
      );
    }
  }
  return out;
}
/** A round bastion: battered foot, drum, string course, crown of merlons, a domed kiosk on some. */
function rbastion(
  b: Built,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  dome = false,
): void {
  b.parts.push(
    at(drum(r * 1.14, h * 0.32, mix(FC, FDK, 0.4), 0.1, 16), x, y, z),
    at(drum(r, h, FC, 0.1, 16), x, y, z),
    at(drum(r + 0.08, 0.24, FDK, 0.04, 16), x, y + h * 0.7, z),
    at(drum(r + 0.25, 0.3, FDK, 0.05, 16), x, y + h, z),
  );
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    b.parts.push(
      at(
        rbox(0.6, 0.6, 0.45, FDK, 0.06),
        x + Math.cos(a) * (r + 0.05),
        y + h + 0.3,
        z + Math.sin(a) * (r + 0.05),
        -a,
      ),
    );
  }
  if (dome) b.parts.push(...chhatriAt(x, y + h + 0.3, z, r * 0.42, false));
}
/** A gate (pol): the arched block, a lime surround, a jharokha over it, bastions each side, open spiked doors. Facing +z (local), the road through it along z. */
function pol2(b: Built, x: number, y: number, z: number, yaw: number, s = 1): void {
  const g: G[] = [];
  g.push(
    profileWall(
      [
        [-4.6, 0],
        [4.6, 0],
        [4.6, 8],
        [-4.6, 8],
      ],
      3.6,
      FC,
      [arch(0, 0, 3.6, 5.6)],
    ),
  );
  g.push(
    at(profileWall(arch(0, 0, 4.4, 6.0), 0.12, LIME, [arch(0, 0, 3.6, 5.6)]), 0, 0, 1.86),
    at(profileWall(arch(0, 0, 4.4, 6.0), 0.12, LIME, [arch(0, 0, 3.6, 5.6)]), 0, 0, -1.86),
  );
  g.push(
    at(rbox(2.6, 1.5, 1.1, FC, 0.1), 0, 6.3, 2.2),
    at(profileWall(arch(0, 0, 1.4, 1.1), 0.06, WOOD_D), 0, 6.45, 2.78),
    at(rbox(3, 0.12, 1.4, FDK, 0.03), 0, 7.8, 2.2),
    at(
      lathe(
        [
          [0, 0],
          [1.1, 0],
          [1, 0.3],
          [0.5, 0.7],
          [0, 0.85],
        ],
        LIME,
        14,
      ).scale(1, 1, 0.55),
      0,
      7.92,
      2.2,
    ),
  );
  for (let i = -3; i <= 3; i++)
    g.push(
      at(rbox(0.75, 0.6, 0.6, FDK, 0.06), i * 1.25, 8, 1.5),
      at(rbox(0.75, 0.6, 0.6, FDK, 0.06), i * 1.25, 8, -1.5),
    );
  for (const sx of [-1, 1]) {
    g.push(
      at(drum(2.1, 9.2, FC, 0.1, 14), sx * 5.4, 0, 0),
      at(drum(2.35, 0.3, FDK, 0.05, 14), sx * 5.4, 9.2, 0),
      at(drum(2.15, 0.22, FDK, 0.04, 14), sx * 5.4, 6.2, 0),
    );
    g.push(...kiosk(sx * 5.4, 9.5, 0, FC, FDK, 0.75));
    g.push(
      at(
        rbox(1.7, 5.2, 0.16, WOOD_D, 0.04).translate(sx * -0.85, 0, 0),
        sx * 1.75,
        0,
        -1.2,
        sx * 1.2,
      ),
    );
    for (let k = 0; k < 3; k++)
      g.push(
        at(
          lathe(
            [
              [0, 0],
              [0.1, 0],
              [0, 0.45],
            ],
            IRON,
            6,
          ).rotateX(Math.PI / 2),
          sx * 1.75 - sx * 0.9 * Math.cos(1.2),
          1.4 + k * 1.3,
          -1.2 + 0.9 * Math.sin(1.2) * 1,
        ),
      );
  }
  b.parts.push(...g.map((p) => at(p.scale(s, s, s), x, y, z, yaw)));
  const [lx, lz] = [x + Math.sin(yaw) * 3.5 * s, z + Math.cos(yaw) * 3.5 * s];
  b.lamps.push({ x: lx, y: y + 3 * s, z: lz, r: 5 }, { x: lx, y: y + 6.6 * s, z: lz, r: 3 });
}
/** A palace block facing +z: body, plinth, cornice, rows of jharokha bays with domes, roof chhatris. */
function palace2(
  b: Built,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  rows: number,
  c = FC,
): void {
  b.parts.push(
    at(rbox(w, h, d, c, 0.12), x, y, z),
    at(rbox(w + 0.6, 0.6, d + 0.6, mix(c, FDK, 0.5), 0.06), x, y, z),
    at(rbox(w + 0.8, 0.35, d + 0.8, FDK, 0.06), x, y + h, z),
  );
  const n = Math.max(2, Math.floor(w / 3.2));
  for (let r = 0; r < rows; r++) {
    const yy = y + 1.4 + r * ((h - 2.4) / Math.max(1, rows - 0.4));
    b.parts.push(at(rbox(w + 0.1, 0.16, d + 0.1, FDK, 0.03), x, yy - 0.35, z));
    for (let i = 0; i < n; i++) {
      const xx = x - w / 2 + (i + 0.5) * (w / n);
      const fz = z + d / 2;
      if ((i + r) % 2 === 0) {
        b.parts.push(
          at(rbox(1.9, 1.5, 0.9, FLT, 0.1), xx, yy, fz + 0.4),
          at(profileWall(arch(0, 0, 1.1, 1.1), 0.05, WOOD_D), xx, yy + 0.18, fz + 0.86),
          at(rbox(2.2, 0.1, 1.2, FDK, 0.03), xx, yy + 1.5, fz + 0.4),
          at(
            lathe(
              [
                [0, 0],
                [0.95, 0],
                [0.85, 0.28],
                [0.45, 0.6],
                [0, 0.74],
              ],
              FLT,
              12,
            ).scale(1, 1, 0.55),
            xx,
            yy + 1.6,
            fz + 0.4,
          ),
        );
        b.lamps.push({ x: xx, y: yy + 0.7, z: fz + 1.4, r: 2.6 });
      } else b.parts.push(at(profileWall(arch(0, 0, 0.8, 1.3), 0.05, DARK), xx, yy, fz + 0.03));
    }
  }
  for (const sx of [-1, 1])
    b.parts.push(...kiosk(x + sx * (w / 2 - 1.4), y + h + 0.35, z + d / 2 - 1.4, c, FDK, 0.8));
  if (w > 12) b.parts.push(...chhatriAt(x, y + h + 0.35, z, 0.9, false));
}
/** A cypress: a slim dark-green cone on a short trunk. */
function cypress(x: number, z: number, s = 1, y = 0): G[] {
  return [
    at(drum(0.14 * s, 0.6 * s, "#8a6248", 0.02, 6), x, y, z),
    at(
      lathe(
        [
          [0, 0],
          [0.75, 0.3],
          [0.7, 1.6],
          [0.35, 3.2],
          [0, 3.8],
        ],
        "#7fa268",
        10,
      ).scale(s, s, s),
      x,
      y + 0.4 * s,
      z,
    ),
  ];
}
/** A charbagh: four lawns, cross paths, a fountain pool, cypresses, a low hedge round it. */
function charbagh(b: Built, x: number, y: number, z: number, w: number, d: number): void {
  b.flats.push(
    flatPoly(
      [
        [x - w / 2, z - d / 2],
        [x + w / 2, z - d / 2],
        [x + w / 2, z + d / 2],
        [x - w / 2, z + d / 2],
      ],
      y + 0.02,
      PAVE,
    ),
  );
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const cx = x + sx * (w / 4 + 0.4);
      const cz = z + sz * (d / 4 + 0.4);
      b.flats.push(
        flatPoly(
          [
            [cx - w / 4 + 0.9, cz - d / 4 + 0.9],
            [cx + w / 4 - 0.9, cz - d / 4 + 0.9],
            [cx + w / 4 - 0.9, cz + d / 4 - 0.9],
            [cx - w / 4 + 0.9, cz + d / 4 - 0.9],
          ],
          y + 0.04,
          GRASS,
        ),
      );
      b.parts.push(...cypress(cx + (w / 4 - 1.6) * -sx, cz + (d / 4 - 1.6) * -sz, 0.8, y));
    }
  b.parts.push(
    at(drum(1.6, 0.4, LIME, 0.06, 20), x, y, z),
    at(drum(1.3, 0.06, LAKE, 0.02, 20), x, y + 0.36, z),
    at(drum(0.15, 0.9, LIME, 0.03, 8), x, y + 0.4, z),
  );
  b.flats.push(
    band(
      closed([
        [x - w / 2, z - d / 2],
        [x + w / 2, z - d / 2],
        [x + w / 2, z + d / 2],
        [x - w / 2, z + d / 2],
      ]),
      0.25,
      y + 0.05,
      "#9fbf80",
    ),
  );
}
/** A temple: a stepped plinth, a mandapa with pillars, a ribbed shikhara with a flag. */
function mandir(b: Built, x: number, y: number, z: number, s: number): void {
  b.parts.push(
    at(rbox(7 * s, 1 * s, 9 * s, FDK, 0.08), x, y, z),
    at(rbox(6 * s, 0.8 * s, 8 * s, FC, 0.06), x, y + s, z),
  );
  for (const sx of [-1, 1])
    for (const zz of [1.2, 3.2])
      b.parts.push(
        at(drum(0.22 * s, 2.4 * s, FLT, 0.03, 8), x + sx * 2 * s, y + 1.8 * s, z + zz * s),
      );
  b.parts.push(
    at(rbox(5 * s, 0.4 * s, 3.4 * s, FDK, 0.05), x, y + 4.2 * s, z + 2.2 * s),
    at(
      lathe(
        [
          [0, 0],
          [1.8, 0],
          [1.2, 0.8],
          [0, 1.2],
        ],
        FC,
        10,
      ).scale(s, s, s),
      x,
      y + 4.6 * s,
      z + 2.2 * s,
    ),
  );
  b.parts.push(
    at(rbox(4.2 * s, 3 * s, 4.2 * s, FC, 0.08), x, y + 1.8 * s, z - 1.6 * s),
    at(
      lathe(
        [
          [0, 0],
          [2.1, 0],
          [2, 1.2],
          [1.7, 2.6],
          [1.25, 4],
          [0.7, 5.2],
          [0.3, 5.8],
          [0, 6],
        ],
        FLT,
        8,
      ).scale(s, s, s),
      x,
      y + 4.8 * s,
      z - 1.6 * s,
    ),
  );
  for (const f of [0.3, 0.55, 0.78])
    b.parts.push(
      at(
        drum(2 * s * (1 - f * 0.6), 0.2 * s, FDK, 0.03, 8),
        x,
        y + (4.8 + f * 5.8) * s,
        z - 1.6 * s,
      ),
    );
  b.parts.push(
    at(drum(0.04 * s, 1.6 * s, WOOD_D, 0.01, 6), x, y + 10.6 * s, z - 1.6 * s),
    at(rbox(0.04, 0.5 * s, 0.8 * s, SAFFRON_M, 0.01), x, y + 11.6 * s, z - 1.2 * s),
  );
  b.lamps.push({ x, y: y + 2.4 * s, z: z + 3 * s, r: 4 });
}
function cannon(x: number, y: number, z: number, yaw: number): G[] {
  return [
    at(rbox(1.6, 0.5, 1.0, WOOD_D, 0.06), 0, 0.35, 0),
    at(
      paint(
        clean(new THREE.CylinderGeometry(0.22, 0.32, 2.4, 12).rotateX(Math.PI / 2 - 0.12)),
        "#b98a4e",
      ),
      0,
      1.0,
      0.5,
    ),
    ...[-1, 1].map((sd) =>
      at(
        paint(clean(new THREE.TorusGeometry(0.4, 0.09, 6, 12).rotateY(Math.PI / 2)), WOOD_D),
        sd * 0.55,
        0.42,
        0,
      ),
    ),
  ].map((g) => at(g, x, y, z, yaw));
}
function flagPole(x: number, y: number, z: number, h = 5): G[] {
  return [
    at(drum(0.06, h, WOOD_D, 0.01, 6), x, y, z),
    at(rbox(0.05, 0.9, 1.6, SAFFRON_M, 0.02), x, y + h - 1, z + 0.8),
  ];
}
/** Trees and shrubs where `keep` allows, standing on whatever is there (`yAt`: the ground or rock height). */
function greenery(
  b: Built,
  seed: number,
  area: [number, number, number, number],
  keep: (x: number, z: number) => boolean,
  n = 26,
  yAt: (x: number, z: number) => number = () => 0,
): void {
  const r = rng(seed);
  for (let i = 0; i < n * 4 && n > 0; i++) {
    const x = area[0] + r() * (area[2] - area[0]);
    const z = area[1] + r() * (area[3] - area[1]);
    if (!keep(x, z)) continue;
    const k = r();
    const y = yAt(x, z);
    b.parts.push(
      ...(k < 0.35
        ? khejri(x, z, 0.9 + r() * 0.3)
        : k < 0.6
          ? neem(x, z, 0.9 + r() * 0.3)
          : shrub(x, z, 0.8 + r() * 0.5)
      ).map((g) => g.translate(0, y, 0)),
    );
    n--;
  }
}

/**
 * The fort (after Junagarh, Bikaner): a desert fort on the flat. An angular ring of tall walls
 * with round and square bastions, a low outer curtain, a water moat with lotus; a bridge across
 * it to Suraj Pol, and inside, palaces round paved courts, a charbagh, the temple, the
 * toshakhana. You ride in: over the bridge, through the gate, along the court road to the
 * toshakhana's forecourt. Both rings of wall are open at the gate.
 * Local frame: the gate in the south wall, the bridge running south from it (+z).
 */
export const FORT_GATE: Pt = [13, 32];
/** Where the bridge reaches the far bank of the moat. */
export const FORT_BRIDGE_END: Pt = [13, 61];
/** The end of the court road (the toshakhana's forecourt). */
export const FORT_INNER: Pt = [13, 14];
/** Where the toshakhana stands inside (facing the gate). */
export const FORT_TOSHAKHANA: Pt = [13, 2];
/** The wall's ring (local), and the moat's two banks. */
export const FORT_WALL: Pt[] = [
  [-46, -30],
  [10, -36],
  [48, -26],
  [54, 8],
  [36, 30],
  [-10, 34],
  [-44, 22],
  [-56, -4],
];
export const FORT_MOAT: [Pt[], Pt[]] = [pullIn(FORT_WALL, -9), pullIn(FORT_WALL, -18)];
function fortMoat(): Built {
  const b = built();
  const W = FORT_WALL;
  const [out1, out2] = FORT_MOAT;
  const GX = FORT_GATE[0];
  // The moat between the outer curtain and the garden belt; lotus, ripples.
  b.flats.push(
    flatPoly(out2, 0.044, LAKE, [out1]),
    band(closed(out2), 0.5, 0.06, mix(SAND, LIME, 0.45)),
    band(closed(out1), 0.5, 0.06, mix(SAND, LIME, 0.45)),
  );
  const r = rng(31);
  for (let i = 0; i < 34; i++) {
    const k = Math.floor(r() * out1.length);
    const a = out1[k] as Pt;
    const c = out2[k] as Pt;
    const t = 0.3 + r() * 0.4;
    const x = a[0] + (c[0] - a[0]) * t;
    const z = a[1] + (c[1] - a[1]) * t;
    if (Math.abs(x - GX) < 6 && z > 0) continue;
    b.flats.push(
      i % 2
        ? flatPoly(ring(x, z, 0.5, 10), 0.068, "#94b979")
        : band(
            [
              [x - 1.6, z],
              [x, z - 0.3],
              [x + 1.6, z],
            ],
            0.07,
            0.068,
            "#c3e5eb",
          ),
    );
  }
  // A closed ring as runs of short pieces (3 m: each wall piece's footprint stays a wall's,
  // even on a slant), open where the road comes through the gate.
  const runs = (o: Pt[], gap: number): Pt[][] => {
    const dense: Pt[] = [];
    for (let i = 0; i < o.length; i++) {
      const [ax, az] = o[i] as Pt;
      const [bx, bz] = o[(i + 1) % o.length] as Pt;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
      for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    const open = (p: Pt) => Math.abs(p[0] - GX) < gap && p[1] > 0;
    const start = dense.findIndex(open);
    const rot = [...dense.slice(start), ...dense.slice(0, start)];
    const out: Pt[][] = [];
    let cur: Pt[] = [];
    for (const p of [...rot, rot[0] as Pt]) {
      if (open(p)) {
        if (cur.length > 1) out.push(cur);
        cur = [];
      } else cur.push(p);
    }
    if (cur.length > 1) out.push(cur);
    return out;
  };
  b.flats.push(flatPoly(pullIn(W, -6), 0.03, mix(PAVE, PEACH, 0.3)));
  for (const run of runs(pullIn(W, -6), 4)) b.parts.push(...fwall(run, 0, 2.4));
  for (const run of runs(W, 4.4)) b.parts.push(...fwall(run, 0, 7.5));
  for (let i = 0; i < W.length; i++) {
    const [ax, az] = W[i] as Pt;
    const [bx, bz] = W[(i + 1) % W.length] as Pt;
    rbastion(b, ax, 0, az, 3, 9.5, i % 2 === 0);
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    if (Math.hypot(bx - ax, bz - az) > 30 && i !== 4) {
      const yaw = -Math.atan2(bz - az, bx - ax);
      b.parts.push(
        at(rbox(5, 9, 5, FC, 0.08), mx, 0, mz, yaw),
        at(rbox(5.6, 0.3, 5.6, FDK, 0.05), mx, 9, mz, yaw),
      );
    }
  }
  // Suraj Pol, the bridge across the moat (a deck flush with the road, parapets, lamp posts).
  const [, gz] = FORT_GATE;
  const bz0 = gz + 1.5;
  const bz1 = FORT_BRIDGE_END[1];
  pol2(b, GX, 0, gz, 0, 0.95);
  b.parts.push(at(rbox(6, 0.14, bz1 - bz0, mix(FC, FDK, 0.3), 0.04), GX, 0, (bz0 + bz1) / 2));
  for (const sd of [-1, 1]) {
    b.parts.push(at(rbox(0.5, 1.1, bz1 - bz0, FC, 0.05), GX + sd * 3.1, 0, (bz0 + bz1) / 2));
    for (let z = bz0 + 2; z < bz1; z += 3)
      b.parts.push(at(rbox(0.55, 0.4, 0.55, FDK, 0.05), GX + sd * 3.1, 1.1, z));
    b.parts.push(...lampPost(GX + sd * 3.7, bz1 - 0.5), ...lampPost(GX + sd * 3.7, bz0 + 3));
  }
  b.lamps.push({ x: GX, y: 3, z: bz1, r: 4 }, { x: GX, y: 3, z: bz0 + 4, r: 4 });
  // The court road, from the gate to the toshakhana's forecourt, lamp posts along it.
  b.flats.push(band([[GX, gz - 1], FORT_INNER], 2.2, 0.05, PAVE));
  for (const z of [26, 19]) for (const sd of [-1, 1]) b.parts.push(...lampPost(GX + sd * 3.4, z));
  // Inside: palaces round the courts, a charbagh, the temple, the flag, cannons.
  palace2(b, -18, 0, -18, 26, 12, 9, 3);
  palace2(b, 20, 0, -22, 18, 9, 8, 2);
  palace2(b, 34, 0, -2, 12, 7, 14, 2);
  palace2(b, -36, 0, 4, 10, 8, 16, 2);
  charbagh(b, -14, 0, 8, 22, 16);
  mandir(b, 30, 0, 16, 0.6);
  b.parts.push(...flagPole(-18, 12.4, -22, 6), ...cannon(-4, 0, 25, 0), ...cannon(30, 0, 24, 0.3));
  // The garden belt outside the moat: neems, khejris, shrubs (the bridge's way left clear).
  greenery(
    b,
    32,
    [-100, -70, 100, 70],
    (x, z) =>
      !insidePoly(pullIn(W, -21), x, z) && insidePoly(pullIn(W, -29), x, z) && Math.abs(x - GX) > 7,
    26,
  );
  return b;
}

/** The fort (a set piece): built light, its trees loose, in pieces (it's big). */
export function fort(): ZLandmark {
  return withLooseTrees(() => fortMoat());
}

/** The bivouac: tents, support trucks, a campfire, camels resting by it. */
function camp(): LM {
  const b = bivouac();
  const parts = [...b.parts];
  for (const [x, z, yaw, c] of [
    [16, 2, 0.4, P.coral],
    [18.5, 5, -0.5, P.marigold],
    [15, 7.5, 2.6, P.coral],
    [19, -1, 1.9, P.marigold],
  ] as const)
    parts.push(...camel(x, z, yaw, c));
  parts.push(...khejri(-14, -4, 1.2), ...khejri(22, 11, 1));
  const pl = plaque("BIVOUAC", "the night's camp", 4, 15.5);
  return { parts: [...parts, ...pl.part], signs: [pl.sign], lamps: b.lamps };
}

/** A white marble chhatri (four pillars, an eave, a dome and a finial), standing on y. */
function marbleChhatri(x: number, y: number, z: number, s: number): G[] {
  const W = "#f7f3ec";
  const WD = "#e6ddd0";
  const o: G[] = [at(rbox(3.4 * s, 0.4 * s, 3.4 * s, WD, 0.05), x, y, z)];
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    o.push(at(drum(0.14 * s, 2 * s, W, 0.02, 8), x + dx * 1.2 * s, y + 0.4 * s, z + dz * 1.2 * s));
  o.push(at(rbox(3.7 * s, 0.14 * s, 3.7 * s, WD, 0.04), x, y + 2.4 * s, z));
  o.push(
    at(
      lathe(
        [
          [0, 0],
          [1.4, 0],
          [1.3, 0.5],
          [0.8, 1.15],
          [0.2, 1.5],
          [0, 1.6],
        ],
        W,
        16,
      ).scale(s, s, s),
      x,
      y + 2.54 * s,
      z,
    ),
  );
  o.push(at(drum(0.05 * s, 0.5 * s, BRASS, 0.01, 6), x, y + 4.1 * s, z));
  return o;
}

/** Jaswant Thada: Jodhpur's white marble cenotaph on its terrace, a garden and pool before it. */
function lmThada(): LM {
  const W = "#f7f3ec";
  const WD = "#e6ddd0";
  const parts: G[] = [];
  const flats: G[] = [];
  const lamps: Lamp[] = [];
  // The garden in front: lawn, a paved walk to the steps, a lotus pool.
  flats.push(
    flatPoly(
      [
        [-20, 6],
        [20, 6],
        [20, 22],
        [-20, 22],
      ],
      0.03,
      GRASS,
    ),
  );
  flats.push(
    flatPoly(
      [
        [-2, 6],
        [2, 6],
        [2, 22],
        [-2, 22],
      ],
      0.045,
      PAVE,
    ),
  );
  flats.push(
    flatPoly(ring(-11, 14, 4.2, 24, 0.7), 0.05, LAKE),
    band(closed(ring(-11, 14, 4.2, 24, 0.7)), 0.3, 0.06, W),
  );
  for (const [x, z] of [
    [-12.5, 13],
    [-9.5, 15.2],
    [-11, 12.4],
  ] as const)
    flats.push(flatPoly(ring(x, z, 0.5, 10), 0.068, "#94b979"));
  parts.push(
    ...neem(12, 14, 1.1),
    ...neem(17, 9, 0.9),
    ...shrub(-17, 9),
    ...shrub(-5, 19, 0.8),
    ...shrub(5, 19, 0.8),
  );
  // The terrace: two stepped marble plinths, steps down to the walk.
  parts.push(
    at(rbox(30, 0.7, 13, WD, 0.06), 0, 0, -1),
    at(rbox(26, 0.6, 11, W, 0.05), 0, 0.7, -1.4),
  );
  for (let k = 0; k < 3; k++)
    parts.push(at(rbox(6, 0.43 * (3 - k), 1, W, 0.03), 0, 0, 5.4 + k * 0.9));
  // The cenotaph: a cube of marble, arched windows in jali, a cornice, the great dome.
  const y = 1.3;
  parts.push(
    at(rbox(10, 5, 10, W, 0.1), 0, y, -2),
    at(rbox(10.8, 0.4, 10.8, WD, 0.06), 0, y + 5, -2),
  );
  for (let m = 0; m < 4; m++) {
    const yaw = (m * Math.PI) / 2;
    for (const dx of [-3, 0, 3])
      parts.push(
        at(
          profileWall(arch(dx, 0, 1.6, 3), 0.08, dx === 0 ? "#cbbfae" : "#ddd3c4").translate(
            0,
            y + 0.6,
            5.04,
          ),
          0,
          0,
          -2,
          yaw,
        ),
      );
  }
  parts.push(
    at(drum(3.4, 1, W, 0.06, 24), 0, y + 5.4, -2),
    at(
      lathe(
        [
          [0, 0],
          [3.6, 0],
          [3.4, 1.4],
          [2.4, 3.1],
          [1, 4.1],
          [0, 4.4],
        ],
        W,
        24,
      ),
      0,
      y + 6.4,
      -2,
    ),
    at(drum(0.08, 1.2, BRASS, 0.02, 8), 0, y + 10.8, -2),
    at(ball(0.22, BRASS), 0, y + 12, -2),
  );
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    parts.push(...marbleChhatri(dx * 4.2, y + 5.4, -2 + dz * 4.2, 0.55));
  // Its two side pavilions (lesser cenotaphs).
  for (const sx of [-1, 1]) {
    parts.push(
      at(rbox(5, 3, 5, W, 0.08), sx * 10, y, -2),
      at(rbox(5.6, 0.3, 5.6, WD, 0.05), sx * 10, y + 3, -2),
      at(
        profileWall(arch(0, 0, 1.4, 2.2), 0.08, "#cbbfae").translate(sx * 10, y + 0.4, 0.54),
        0,
        0,
        0,
      ),
    );
    parts.push(
      at(
        lathe(
          [
            [0, 0],
            [2, 0],
            [1.9, 0.8],
            [1.3, 1.7],
            [0.5, 2.2],
            [0, 2.4],
          ],
          W,
          18,
        ),
        sx * 10,
        y + 3.3,
        -2,
      ),
    );
    lamps.push({ x: sx * 10, y: y + 1.5, z: 1, r: 4 });
  }
  lamps.push({ x: 0, y: y + 2, z: 4, r: 6 }, { x: 0, y: y + 7, z: 2, r: 4 });
  const pl = plaque("JASWANT THADA", "the marble of Makrana", 7, 20);
  return { parts: [...parts, ...pl.part], flats, signs: [pl.sign], lamps };
}

/** Bada Bagh: Jaisalmer's royal chhatris, a field of cenotaphs on stepped plinths, khejris round. */
function lmBadaBagh(): LM {
  const parts: G[] = [];
  const flats: G[] = [];
  const lamps: Lamp[] = [];
  // The compound: a low wall, a stone floor.
  const yard: Pt[] = [
    [-24, -16],
    [24, -16],
    [24, 14],
    [-24, 14],
  ];
  flats.push(flatPoly(yard, 0.03, mix(SAND, LIME, 0.3)));
  for (const [a, b] of [
    [
      [-24, -16],
      [24, -16],
    ],
    [
      [24, -16],
      [24, 14],
    ],
    [
      [-24, 14],
      [-4, 14],
    ],
    [
      [4, 14],
      [24, 14],
    ],
    [
      [-24, -16],
      [-24, 14],
    ],
  ] as [Pt, Pt][]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    parts.push(
      at(
        rbox(len + 0.6, 1, 0.6, SAND, 0.06),
        (a[0] + b[0]) / 2,
        0,
        (a[1] + b[1]) / 2,
        -Math.atan2(b[1] - a[1], b[0] - a[0]),
      ),
    );
  }
  // The chhatris: rows of them, the oldest small, the later ones grander (stepped plinths).
  const r = rng(41);
  const spots: [number, number, number][] = [];
  for (const [z, n, s0] of [
    [-10, 5, 0.75],
    [-2, 4, 1.0],
    [6, 5, 0.8],
  ] as const)
    for (let i = 0; i < n; i++)
      spots.push([
        -18 + (36 * i) / (n - 1) + (r() - 0.5) * 2,
        z + (r() - 0.5) * 1.5,
        s0 + r() * 0.35,
      ]);
  spots.push([0, -4, 1.5]);
  for (const [x, z, s] of spots) {
    parts.push(at(rbox(4.4 * s, 0.5, 4.4 * s, SAND_D, 0.05), x, 0, z));
    parts.push(...chhatriAt(x, 0.5, z, s));
    lamps.push({ x, y: 1.5, z: z + 2, r: 3 });
  }
  parts.push(
    ...khejri(-28, -6, 1.2),
    ...khejri(28, 2, 1.1),
    ...khejri(-14, 20, 1),
    ...khejri(16, 19, 0.9),
  );
  const pl = plaque("BADA BAGH", "the royal chhatris", -9, 17);
  return { parts: [...parts, ...pl.part], flats, signs: [pl.sign], lamps: lamps.slice(0, 10) };
}

/** A landmark built for the world (light detail), its ground-standing trees listed as loose toys. */
function withLooseTrees(build: () => LM): ZLandmark {
  return lightToys(() => {
    looseTrees = [];
    try {
      const lm = build();
      const trees = looseTrees;
      return { ...landmark(lm), trees };
    } finally {
      looseTrees = null;
    }
  });
}
/** A world landmark: big ones in pieces, and the trees that stand loose in it (local). */
export type ZLandmark = Landmark & {
  pieces?: G[];
  trees?: { id: string; x: number; z: number; s: number }[];
};

// The loose trees as toys (so the physics can draw them when they're knocked about).
const asToy = (make: () => G[]) => () => {
  const keep = looseTrees;
  looseTrees = null;
  try {
    return join(make());
  } finally {
    looseTrees = keep;
  }
};
LANDSCAPE.zkhejri = { name: "Khejri (Thar)", make: asToy(() => khejri(0, 0, 1)) };
LANDSCAPE.zneem = { name: "Neem", make: asToy(() => neem(0, 0, 1)) };

/** Zingle's landmarks, by key: the ten stops, the monuments and the set pieces. */
export const ZINGLE_LANDMARKS: Record<
  Exclude<ZingleLandmark, "fort">,
  { title: string; make: () => ZLandmark }
> = {
  kund: { title: "The kunds", make: () => withLooseTrees(() => lmKund()) },
  pols: { title: "Suraj Pol and Chand Pol", make: () => withLooseTrees(() => lmTwinPols()) },
  jantar: { title: "Jantar Mantar", make: () => withLooseTrees(() => lmJantar()) },
  ghat: { title: "The lake ghat", make: () => withLooseTrees(() => lmGhat2()) },
  bazaar: { title: "The bazaar", make: () => withLooseTrees(() => lmBazaar()) },
  dera: { title: "The Lohar dera", make: () => withLooseTrees(() => lmDera()) },
  toshakhana: { title: "The toshakhana", make: () => withLooseTrees(() => lmStrongroom()) },
  stepwell: { title: "The stepwell", make: () => withLooseTrees(() => lmStepwell()) },
  clock: { title: "Ghanta Ghar", make: () => withLooseTrees(() => lmClockTower()) },
  haveli: { title: "The haveli", make: () => withLooseTrees(() => lmHaveli()) },
  hawa: { title: "Hawa Mahal", make: () => withLooseTrees(() => hawaMahal()) },
  station: { title: "Thar Junction", make: () => withLooseTrees(() => lmStation(false)) },
  sarai: { title: "The caravanserai", make: () => withLooseTrees(() => lmSarai()) },
  bivouac: { title: "The bivouac", make: () => withLooseTrees(() => camp()) },
  thada: { title: "Jaswant Thada", make: () => withLooseTrees(() => lmThada()) },
  badabagh: { title: "Bada Bagh", make: () => withLooseTrees(() => lmBadaBagh()) },
};

/** The set pieces strewn round the world (in their own local frames). */
export const PIECES = {
  turbine,
  solar,
  kmStone,
  arrowBoard,
  cpFlags,
  saltPan,
  ripplesWhere,
  blobOutline,
  khejri,
  neem,
  shrub,
  chaikin,
  band,
  flatPoly,
  rng,
  lmStart,
  insidePoly,
};

/** 3 · Jantar Mantar (the Misra Yantra, read from the model), at 0.62 of the board's size. */
function lmJantar(): LM {
  const m = misra4();
  return {
    parts: m.parts.map((g) => g.clone().scale(0.62, 0.62, 0.62)),
    flats: m.flats.map((g) => g.clone().scale(0.62, 1, 0.62)),
    lamps: m.lamps.map((l) => ({ ...l, x: l.x * 0.62, z: l.z * 0.62 })),
  };
}
