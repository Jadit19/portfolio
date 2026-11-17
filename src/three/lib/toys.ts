/**
 * The toy kit: the numbered catalogue pieces (trees,
 * bushes, rocks, buildings, carts, pedestals, street bits), shared by the
 * catalogue and the biome boards.
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { join, natureGeometry, nub, paint, prism, trunk } from "./nature";
import { PASTEL as P } from "./palette";

// ── geometry kit ─────────────────────────────────────────────────────────

export type G = THREE.BufferGeometry;

function flat(g: G): G {
  const f = g.index ? g.toNonIndexed() : g;
  if (f !== g) g.dispose();
  f.deleteAttribute("uv");
  if (f.attributes.uv1) f.deleteAttribute("uv1");
  if (!f.attributes.normal) f.computeVertexNormals();
  return f;
}

/** Moves (and turns) a part. */
export function at(g: G, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): G {
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

/** A box with rounded edges, standing on y = 0. */
export function rbox(w: number, h: number, d: number, hex: string, r = 0.06): G {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  g.translate(0, h / 2, 0);
  return paint(flat(g), hex);
}

/** A round form turned on a lathe from [radius, height] points (smooth sides). */
export function lathe(profile: [number, number][], hex: string, seg = 28): G {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
  return paint(flat(g), hex);
}

/** A drum with softly rounded edges. */
export function drum(r: number, h: number, hex: string, b = 0.05, seg = 28): G {
  const pts: [number, number][] = [[0, 0]];
  for (let i = 0; i <= 3; i++) {
    const a = (i / 3) * (Math.PI / 2);
    pts.push([r - b + Math.sin(a) * b, b - Math.cos(a) * b]);
  }
  for (let i = 0; i <= 3; i++) {
    const a = (i / 3) * (Math.PI / 2);
    pts.push([r - b + Math.cos(a) * b, h - b + Math.sin(a) * b]);
  }
  pts.push([0, h]);
  return lathe(pts, hex, seg);
}

export function ball(r: number, hex: string, sx = 1, sy = 1, sz = 1): G {
  const g = new THREE.SphereGeometry(r, 24, 16);
  g.scale(sx, sy, sz);
  g.translate(0, r * sy, 0);
  return paint(flat(g), hex);
}

/** A gabled roof (a prism with a soft ridge), sitting on y = 0. */
export function gable(w: number, d: number, h: number, hex: string, over = 0.12): G {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - over, 0);
  shape.lineTo(0, h);
  shape.lineTo(w / 2 + over, 0);
  shape.lineTo(-w / 2 - over, 0);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d + over * 2,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  g.translate(0, 0, -(d + over * 2) / 2);
  return paint(flat(g), hex);
}

/** A wheel: a soft tyre with a hub. */
function wheel(r: number, w: number): G {
  const tyre = drum(r, w, P.ink, w * 0.35, 20);
  tyre.translate(0, -w / 2, 0);
  tyre.rotateX(Math.PI / 2);
  const hub = drum(r * 0.45, w * 1.1, P.cream, 0.02, 16);
  hub.translate(0, -w * 0.55, 0);
  hub.rotateX(Math.PI / 2);
  return join([tyre, hub]);
}

function stick(r: number, h: number, hex: string): G {
  const g = new THREE.CylinderGeometry(r, r, h, 10);
  g.translate(0, h / 2, 0);
  return paint(flat(g), hex);
}

/** Leaf slabs radiating from a point (palms, agave). */
function fronds(n: number, len: number, hex: string, droop: number, seed: number): G[] {
  const out: G[] = [];
  for (let i = 0; i < n; i++) {
    const g = prism({
      sides: 4,
      radius: 0.16,
      height: len,
      taper: 0.25,
      round: 0.35,
      bevel: 0.03,
      jitter: 0.05,
      seed: seed + i,
    });
    g.scale(1, 1, 0.35);
    g.rotateZ(-Math.PI / 2 + droop);
    g.rotateY((i / n) * Math.PI * 2);
    out.push(paint(g, hex));
  }
  return out;
}

// ── the catalogue ────────────────────────────────────────────────────────

export interface Item {
  name: string;
  make: () => G;
}

export const TREES: Item[] = [
  { name: "Pentagon crown", make: () => natureGeometry("crown", { colour: P.mint, seed: 4 }) },
  { name: "Spire", make: () => natureGeometry("spire", { colour: P.fern, seed: 3 }) },
  { name: "Column", make: () => natureGeometry("column", { colour: P.pistachio, seed: 2 }) },
  {
    name: "Parasol (khejri)",
    make: () => natureGeometry("parasol", { colour: P.pistachio, seed: 6 }),
  },
  {
    name: "Lollipop",
    make: () =>
      join([paint(trunk(0.1, 0.9), P.clay), at(ball(0.75, P.mint, 1, 0.95, 1), 0, 0.7, 0)]),
  },
  {
    name: "Stacked tiers",
    make: () =>
      join(
        [
          paint(trunk(0.14, 0.45), P.clay),
          at(prism({ sides: 6, radius: 0.8, height: 0.55, taper: 0.62, seed: 1 }), 0, 0.35, 0),
          paint(
            at(prism({ sides: 6, radius: 0.6, height: 0.5, taper: 0.6, seed: 2 }), 0, 0.82, 0),
            P.fern,
          ),
          paint(
            at(prism({ sides: 6, radius: 0.4, height: 0.5, taper: 0.4, seed: 3 }), 0, 1.25, 0),
            P.fern,
          ),
        ].map((g) => (g.attributes.color ? g : paint(g, P.fern))),
      ),
  },
  {
    name: "Cloud cluster",
    make: () =>
      join([
        paint(trunk(0.13, 0.8), P.clay),
        at(ball(0.55, P.pistachio), 0, 0.6, 0),
        at(ball(0.42, P.pistachio), 0.45, 0.55, 0.15),
        at(ball(0.4, P.pistachio), -0.38, 0.6, -0.2),
        at(ball(0.35, P.pistachio), 0.05, 1.15, -0.1),
      ]),
  },
  {
    name: "Coconut palm",
    make: () => {
      const segs: G[] = [];
      for (let i = 0; i < 6; i++)
        segs.push(at(drum(0.14 - i * 0.008, 0.36, P.clay, 0.05, 14), i * 0.05, i * 0.34, 0));
      return join([
        ...segs,
        ...fronds(6, 1.1, P.mint, 0.35, 5).map((g) => at(g, 0.3, 2.05, 0)),
        at(ball(0.09, P.cream), 0.32, 1.9, 0.08),
      ]);
    },
  },
  {
    name: "Banyan",
    make: () => {
      const roots: G[] = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        roots.push(at(stick(0.035, 1.2, P.clay), Math.cos(a) * 0.75, 0, Math.sin(a) * 0.6));
      }
      return join(
        [
          paint(trunk(0.3, 1.2), P.clay),
          ...roots,
          at(
            prism({ sides: 7, radius: 1.25, height: 0.6, taper: 0.8, slant: 0.05, seed: 8 }),
            0,
            1.1,
            0,
          ),
          at(prism({ sides: 6, radius: 0.8, height: 0.45, taper: 0.75, seed: 9 }), 0.2, 1.6, -0.1),
        ].map((g) => (g.attributes.color ? g : paint(g, P.fern))),
      );
    },
  },
  {
    name: "Blossom box",
    make: () =>
      join([
        paint(trunk(0.12, 0.6), P.clay),
        at(rbox(1.1, 1.0, 1.1, P.blossom, 0.22), 0, 0.5, 0),
        at(rbox(0.6, 0.5, 0.6, P.blossom, 0.15), 0.15, 1.4, 0.1),
      ]),
  },
];

export const BUSHES: Item[] = [
  { name: "Prism bush", make: () => natureGeometry("bush", { colour: P.fern, seed: 2 }) },
  {
    name: "Coffee (with cherries)",
    make: () => natureGeometry("bush", { colour: P.fern, fruit: P.coral, seed: 21 }),
  },
  { name: "Dome bush", make: () => ball(0.5, P.mint, 1.1, 0.95, 1) },
  { name: "Hedge block", make: () => rbox(1.6, 0.6, 0.6, P.pistachio, 0.2) },
  {
    name: "Flowering shrub",
    make: () => {
      const parts: G[] = [ball(0.5, P.mint, 1.1, 0.8, 1)];
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        parts.push(
          paint(
            at(nub(0.12, i + 3), Math.cos(a) * 0.42, 0.45 + (i % 3) * 0.1, Math.sin(a) * 0.4),
            i % 2 ? P.rose : P.marigold,
          ),
        );
      }
      return join(parts);
    },
  },
  {
    name: "Cactus (Thar)",
    make: () =>
      join([
        drum(0.2, 1.3, P.fern, 0.18, 14),
        at(drum(0.12, 0.5, P.fern, 0.1, 12), 0.3, 0.45, 0),
        at(stick(0.06, 0.2, P.fern), 0.18, 0.55, 0, 0, 0, Math.PI / 2),
        at(drum(0.11, 0.4, P.fern, 0.09, 12), -0.28, 0.7, 0),
        paint(at(nub(0.12, 4), 0, 1.3, 0), P.rose),
      ]),
  },
  {
    name: "Agave",
    make: () => join(fronds(8, 0.75, P.mint, -0.9, 1).map((g) => at(g, 0, 0.05, 0))),
  },
  {
    name: "Grass tufts",
    make: () =>
      join([
        natureGeometry("tuft", { colour: P.pistachio, seed: 1 }),
        at(natureGeometry("tuft", { colour: P.mint, seed: 2 }), 0.3, 0, 0.2),
      ]),
  },
  { name: "Flower pad", make: () => natureGeometry("flowers", { seed: 5 }) },
];

export const ROCKS: Item[] = [
  { name: "Faceted tent", make: () => natureGeometry("rock", { seed: 3 }) },
  {
    name: "Smooth pebbles",
    make: () =>
      join([
        ball(0.4, P.stone, 1.2, 0.6, 1),
        at(ball(0.22, P.stone, 1.2, 0.7, 1), 0.5, 0, 0.3),
        at(ball(0.14, P.stone), -0.45, 0, 0.25),
      ]),
  },
  {
    name: "Cairn (Ladakh)",
    make: () => {
      const parts: G[] = [];
      let y = 0;
      const sizes = [0.42, 0.34, 0.27, 0.2, 0.14];
      sizes.forEach((r, i) => {
        parts.push(
          at(ball(r, i % 2 ? P.cream : P.stone, 1.25, 0.45, 1.05), i % 2 ? 0.04 : -0.03, y, 0),
        );
        y += r * 0.85;
      });
      return join(parts);
    },
  },
  {
    name: "Boulder + slab",
    make: () =>
      join([
        natureGeometry("rock", { seed: 7, colour: P.stone }),
        at(rbox(0.9, 0.18, 0.55, P.cream, 0.06), 0.55, 0, -0.35, 0.4),
      ]),
  },
  {
    name: "Shards",
    make: () =>
      join([
        paint(
          prism({ sides: 4, radius: 0.22, height: 0.9, taper: 0.2, slant: 0.4, seed: 1 }),
          P.lavender,
        ),
        paint(
          at(
            prism({ sides: 4, radius: 0.16, height: 0.55, taper: 0.2, slant: -0.3, seed: 2 }),
            0.3,
            0,
            0.1,
            0,
            0,
            -0.3,
          ),
          P.lavender,
        ),
        paint(
          at(
            prism({ sides: 4, radius: 0.14, height: 0.45, taper: 0.2, seed: 3 }),
            -0.25,
            0,
            -0.1,
            0,
            0,
            0.35,
          ),
          P.aqua,
        ),
      ]),
  },
];

export const BUILDINGS: Item[] = [
  {
    name: "Gabled cottage",
    make: () =>
      join([
        rbox(2, 1.4, 1.6, P.cream, 0.1),
        at(gable(2, 1.6, 0.9, P.coral), 0, 1.38, 0),
        at(rbox(0.45, 0.8, 0.06, P.clay, 0.04), 0, 0, 0.82),
        at(rbox(0.38, 0.38, 0.06, P.aqua, 0.04), 0.6, 0.65, 0.82),
      ]),
  },
  {
    name: "Rajasthani haveli",
    make: () => {
      const parts: G[] = [
        rbox(2.2, 1.9, 1.6, P.peach, 0.08),
        at(rbox(2.35, 0.16, 1.75, P.cream, 0.05), 0, 1.9, 0),
      ];
      for (let i = 0; i < 5; i++)
        parts.push(at(rbox(0.22, 0.24, 0.22, P.cream, 0.05), -0.95 + i * 0.475, 2.05, 0.72));
      parts.push(
        at(
          lathe(
            [
              [0, 0],
              [0.28, 0],
              [0.28, 0.55],
              [0.2, 0.8],
              [0, 0.88],
            ],
            P.coral,
            16,
          ),
          0,
          0,
          0.8,
        ),
      );
      parts.push(
        at(rbox(0.6, 0.12, 0.35, P.marigold, 0.04), -0.65, 1.15, 0.85),
        at(rbox(0.6, 0.12, 0.35, P.marigold, 0.04), 0.65, 1.15, 0.85),
      );
      return join(parts);
    },
  },
  {
    name: "Dome hut",
    make: () =>
      join([
        drum(0.95, 0.9, P.cream, 0.08),
        at(
          lathe(
            [
              [0, 0],
              [1.05, 0],
              [0.95, 0.35],
              [0.7, 0.7],
              [0.35, 0.9],
              [0, 0.95],
            ],
            P.lavender,
            28,
          ),
          0,
          0.88,
          0,
        ),
        at(rbox(0.45, 0.7, 0.1, P.clay, 0.05), 0, 0, 0.92),
      ]),
  },
  {
    name: "Chai shop + awning",
    make: () => {
      const parts: G[] = [
        rbox(1.8, 1.5, 1.2, P.mist, 0.08),
        at(rbox(1.9, 0.12, 1.3, P.cream, 0.04), 0, 1.5, 0),
        at(rbox(1.5, 0.7, 0.4, P.clay, 0.06), 0, 0, 0.75),
      ];
      for (let i = 0; i < 6; i++)
        parts.push(
          at(
            rbox(0.3, 0.06, 0.7, i % 2 ? P.cream : P.coral, 0.03),
            -0.75 + i * 0.3,
            1.25,
            0.95,
            0,
            -0.35,
          ),
        );
      parts.push(at(drum(0.1, 0.18, P.ink, 0.03, 12), 0.4, 0.7, 0.75));
      return join(parts);
    },
  },
  {
    name: "Kerala tiled roof",
    make: () => {
      const roofA = gable(2.2, 1.6, 0.7, P.clay, 0.25);
      const roofB = at(gable(1.2, 1.1, 0.55, P.clay, 0.2), 0, 0.55, 0, Math.PI / 2);
      return join([
        rbox(2, 1.2, 1.5, P.cream, 0.08),
        at(roofA, 0, 1.18, 0),
        at(roofB, 0, 1.18, 0),
        at(rbox(1.2, 0.08, 0.5, P.fern, 0.03), 0, 0, 0.95),
      ]);
    },
  },
  {
    name: "Toran gateway",
    make: () => {
      const parts: G[] = [
        at(rbox(0.4, 2.2, 0.4, P.peach, 0.08), -1.1, 0, 0),
        at(rbox(0.4, 2.2, 0.4, P.peach, 0.08), 1.1, 0, 0),
        at(rbox(2.8, 0.35, 0.5, P.coral, 0.08), 0, 2.2, 0),
      ];
      for (let i = 0; i < 9; i++)
        parts.push(
          at(
            ball(0.08, i % 2 ? P.marigold : P.coral),
            -0.9 + i * 0.225,
            1.95 - Math.sin((i / 8) * Math.PI) * 0.25,
            0.2,
          ),
        );
      return join(parts);
    },
  },
];

export const CARTS: Item[] = [
  {
    name: "Chai cart",
    make: () =>
      join([
        at(rbox(1.3, 0.55, 0.7, P.marigold, 0.08), 0, 0.45, 0),
        at(wheel(0.25, 0.08), -0.35, 0.25, 0.4),
        at(wheel(0.25, 0.08), -0.35, 0.25, -0.48),
        at(stick(0.025, 1.0, P.ink), 0.55, 1.0, 0.3),
        at(stick(0.025, 1.0, P.ink), 0.55, 1.0, -0.3),
        at(rbox(1.4, 0.08, 0.85, P.coral, 0.03), 0.1, 1.95, 0),
        at(
          lathe(
            [
              [0, 0],
              [0.16, 0],
              [0.18, 0.12],
              [0.12, 0.25],
              [0.04, 0.3],
              [0, 0.32],
            ],
            P.stone,
            16,
          ),
          0.2,
          1.0,
          0,
        ),
      ]),
  },
  {
    name: "Fruit thela",
    make: () => {
      const parts: G[] = [
        at(rbox(1.5, 0.12, 0.8, P.clay, 0.04), 0, 0.55, 0),
        at(wheel(0.3, 0.07), 0, 0.3, 0.45),
        at(wheel(0.3, 0.07), 0, 0.3, -0.52),
        at(stick(0.025, 0.8, P.clay), 0.8, 0.55, 0, 0, 0, Math.PI / 2.4),
      ];
      const cols = [P.coral, P.marigold, P.pistachio, P.rose];
      for (let i = 0; i < 4; i++)
        for (let k = 0; k < 3; k++)
          parts.push(
            at(
              ball(0.11, cols[(i + k) % 4] as string),
              -0.55 + i * 0.36,
              0.67 + (k === 1 ? 0.12 : 0),
              -0.22 + k * 0.22,
            ),
          );
      return join(parts);
    },
  },
  {
    name: "Ice-cream tricycle",
    make: () =>
      join([
        at(rbox(0.8, 0.65, 0.65, P.cream, 0.1), 0.3, 0.35, 0),
        at(rbox(0.82, 0.12, 0.67, P.aqua, 0.04), 0.3, 0.6, 0),
        at(wheel(0.2, 0.06), 0.3, 0.2, 0.36),
        at(wheel(0.2, 0.06), 0.3, 0.2, -0.38),
        at(wheel(0.24, 0.06), -0.55, 0.24, -0.02),
        at(stick(0.025, 1.4, P.ink), 0.3, 0.95, 0),
        at(
          lathe(
            [
              [0, 0],
              [0.75, 0],
              [0.55, 0.15],
              [0.1, 0.28],
              [0, 0.3],
            ],
            P.rose,
            20,
          ),
          0.3,
          2.3,
          0,
        ),
      ]),
  },
  {
    name: "Bullock cart",
    make: () =>
      join([
        at(rbox(1.6, 0.14, 0.9, P.clay, 0.05), 0, 0.6, 0),
        at(
          lathe(
            [
              [0.5, 0],
              [0.52, 0.3],
              [0.5, 0.6],
              [0.45, 0.85],
              [0.35, 1.05],
            ].map(([r, y]) => [r, y] as [number, number]),
            P.marigold,
            18,
          ),
          0.05,
          0.7,
          0,
          0,
          0,
          Math.PI / 2,
        ),
        at(wheel(0.5, 0.08), 0, 0.5, 0.52),
        at(wheel(0.5, 0.08), 0, 0.5, -0.6),
        at(stick(0.03, 1.4, P.clay), 0.75, 0.62, 0, 0, 0, Math.PI / 2.1),
      ]),
  },
  {
    name: "Food truck",
    make: () =>
      join([
        at(rbox(2.2, 1.4, 1.1, P.mist, 0.18), 0, 0.3, 0),
        at(rbox(0.7, 0.9, 1.05, P.cream, 0.15), 1.25, 0.3, 0),
        at(rbox(1.2, 0.5, 0.06, P.ink, 0.04), -0.2, 0.95, 0.56),
        at(rbox(1.3, 0.06, 0.5, P.coral, 0.03), -0.2, 1.45, 0.8, 0, -0.4),
        at(wheel(0.26, 0.12), -0.65, 0.26, 0.5),
        at(wheel(0.26, 0.12), -0.65, 0.26, -0.62),
        at(wheel(0.26, 0.12), 1.15, 0.26, 0.5),
        at(wheel(0.26, 0.12), 1.15, 0.26, -0.62),
      ]),
  },
];

export const PEDESTALS: Item[] = [
  {
    name: "Stepped round plinth",
    make: () =>
      join([
        drum(0.9, 0.18, P.cream),
        at(drum(0.7, 0.18, P.stone), 0, 0.18, 0),
        at(drum(0.5, 0.5, P.cream), 0, 0.36, 0),
      ]),
  },
  {
    name: "Square plinth + number",
    make: () =>
      join([
        rbox(1.1, 0.7, 1.1, P.cream, 0.1),
        at(rbox(0.5, 0.5, 0.06, P.coral, 0.05), 0, 0.1, 0.56),
      ]),
  },
  {
    name: "Pillar + ball",
    make: () =>
      join([
        drum(0.35, 0.15, P.stone),
        at(drum(0.22, 1.1, P.cream, 0.04), 0, 0.15, 0),
        at(drum(0.32, 0.12, P.stone), 0, 1.25, 0),
        at(ball(0.25, P.marigold), 0, 1.37, 0),
      ]),
  },
  {
    name: "Floor ring pad",
    make: () =>
      join([
        drum(1.1, 0.06, P.cream, 0.03),
        at(drum(0.95, 0.07, P.lilac, 0.02), 0, 0.01, 0),
        at(drum(0.18, 0.12, P.coral, 0.04), 0, 0.02, 0),
      ]),
  },
  {
    name: "Board on legs",
    make: () =>
      join([
        at(stick(0.04, 1.0, P.clay), -0.5, 0, 0),
        at(stick(0.04, 1.0, P.clay), 0.5, 0, 0),
        at(rbox(1.3, 0.8, 0.1, P.cream, 0.06), 0, 0.85, 0),
        at(rbox(1.1, 0.12, 0.11, P.coral, 0.04), 0, 1.4, 0),
      ]),
  },
  {
    name: "Road milestone",
    make: () =>
      join([
        at(rbox(0.7, 0.5, 0.35, P.cream, 0.05), 0, 0, 0),
        at(
          lathe(
            [
              [0, 0],
              [0.35, 0],
              [0.35, 0.05],
              [0.3, 0.2],
              [0.18, 0.3],
              [0, 0.34],
            ],
            P.marigold,
            20,
          ),
          0,
          0.5,
          0,
          0,
          0,
          0,
        ),
        at(rbox(0.5, 0.1, 0.36, P.ink, 0.03), 0, 0.3, 0),
      ]),
  },
];

export const STREET: Item[] = [
  {
    name: "Lamp post",
    make: () =>
      join([
        drum(0.18, 0.1, P.stone),
        at(stick(0.05, 2.2, P.ink), 0, 0.1, 0),
        at(ball(0.18, P.marigold), 0, 2.2, 0),
      ]),
  },
  {
    name: "Bench",
    make: () =>
      join([
        at(rbox(1.4, 0.1, 0.45, P.coral, 0.04), 0, 0.45, 0),
        at(rbox(1.4, 0.35, 0.08, P.coral, 0.04), 0, 0.6, -0.2),
        at(rbox(0.1, 0.45, 0.4, P.ink, 0.03), -0.6, 0, 0),
        at(rbox(0.1, 0.45, 0.4, P.ink, 0.03), 0.6, 0, 0),
      ]),
  },
  {
    name: "Signpost",
    make: () =>
      join([
        at(stick(0.05, 1.8, P.clay), 0, 0, 0),
        at(rbox(0.9, 0.28, 0.06, P.aqua, 0.05), 0.35, 1.45, 0, 0.2),
        at(rbox(0.9, 0.28, 0.06, P.marigold, 0.05), -0.3, 1.1, 0, -0.35),
      ]),
  },
  {
    name: "Picket fence",
    make: () => {
      const parts: G[] = [at(rbox(2.2, 0.08, 0.06, P.cream, 0.03), 0, 0.45, 0)];
      for (let i = 0; i < 7; i++)
        parts.push(at(rbox(0.14, 0.7, 0.06, P.cream, 0.05), -1 + i * 0.33, 0, 0));
      return join(parts);
    },
  },
  {
    name: "Stone wall",
    make: () => {
      const parts: G[] = [];
      for (let r = 0; r < 3; r++)
        for (let i = 0; i < 4 - (r % 2); i++)
          parts.push(
            at(
              rbox(0.5, 0.24, 0.35, r % 2 ? P.stone : P.cream, 0.07),
              -0.75 + i * 0.52 + (r % 2) * 0.26,
              r * 0.25,
              0,
            ),
          );
      return join(parts);
    },
  },
  {
    name: "Water pot (matka)",
    make: () =>
      join([
        lathe(
          [
            [0, 0],
            [0.18, 0],
            [0.32, 0.15],
            [0.35, 0.3],
            [0.28, 0.48],
            [0.14, 0.55],
            [0.16, 0.62],
            [0, 0.62],
          ],
          P.clay,
          24,
        ),
        at(drum(0.3, 0.08, P.cream, 0.03), 0.6, 0, 0),
        at(
          lathe(
            [
              [0, 0],
              [0.12, 0],
              [0.22, 0.12],
              [0.22, 0.25],
              [0.12, 0.35],
              [0, 0.35],
            ],
            P.coral,
            20,
          ),
          0.6,
          0.08,
          0,
        ),
      ]),
  },
];

/** A copy of a piece with one palette colour swapped for another (vertex colours). */
export function recolour(g: G, swaps: [string, string][]): G {
  const out = g.clone();
  const col = out.attributes.color as THREE.BufferAttribute | undefined;
  if (!col) return out;
  const pairs = swaps.map(([a, b]) => [new THREE.Color(a), new THREE.Color(b)] as const);
  const c = new THREE.Color();
  for (let i = 0; i < col.count; i++) {
    c.fromBufferAttribute(col, i);
    for (const [a, b] of pairs) {
      if (Math.abs(c.r - a.r) + Math.abs(c.g - a.g) + Math.abs(c.b - a.b) < 0.02) {
        col.setXYZ(i, b.r, b.g, b.b);
        break;
      }
    }
  }
  return out;
}

// ── landscape kit: reusable pieces for regional scenes ───────────────────

/** Sand, for dunes and shores: between peach and marigold. */
export const SAND = "#f4dcb8";
const FLAGS = [P.aqua, P.cream, P.coral, P.pistachio, P.marigold];

function crop(row: string, base: string, h = 0.14, rr = 0.06): G {
  const parts: G[] = [rbox(3, 0.08, 2, base, 0.03)];
  for (let i = 0; i < 5; i++) parts.push(at(rbox(2.8, h, 0.22, row, rr), 0, 0.06, -0.8 + i * 0.4));
  return join(parts);
}

function hull(len: number, w: number, h: number): G {
  const g = ball(0.5, P.clay, len, h * 1.2, w);
  g.translate(0, -0.12, 0);
  return g;
}

function stall(roof: string): G {
  const parts: G[] = [rbox(1.3, 0.6, 0.8, P.cream, 0.05)];
  for (const [x, z] of [
    [-0.6, -0.36],
    [0.6, -0.36],
    [-0.6, 0.36],
    [0.6, 0.36],
  ] as const)
    parts.push(at(stick(0.04, 1.45, P.clay), x, 0, z));
  parts.push(at(rbox(1.6, 0.1, 1.05, roof, 0.04), 0, 1.42, 0));
  for (let i = 0; i < 5; i++)
    parts.push(
      paint(
        at(nub(0.1, i), -0.45 + i * 0.22, 0.62, 0.1),
        [P.marigold, P.coral, P.pistachio][i % 3] as string,
      ),
    );
  return join(parts);
}

export const LANDSCAPE: Record<string, Item> = {
  reeds: {
    name: "Reeds",
    make: () => {
      const parts: G[] = [];
      for (let i = 0; i < 7; i++) {
        const g = prism({
          sides: 3,
          radius: 0.05,
          height: 0.6 + (i % 3) * 0.18,
          taper: 0.2,
          round: 0.3,
          bevel: 0.01,
          jitter: 0.1,
          seed: i,
        });
        g.rotateZ(((i % 5) - 2) * 0.08);
        g.translate(Math.cos(i * 2.4) * 0.18, 0, Math.sin(i * 2.4) * 0.18);
        parts.push(paint(g, i % 2 ? P.fern : P.pistachio));
      }
      parts.push(
        at(drum(0.045, 0.18, P.clay, 0.04, 8), 0.05, 0.72, 0.02),
        at(drum(0.045, 0.16, P.clay, 0.04, 8), -0.15, 0.62, 0.1),
      );
      return join(parts);
    },
  },
  lotus: {
    name: "Lotus",
    make: () =>
      join([
        drum(0.34, 0.03, P.mint, 0.015, 20),
        at(drum(0.22, 0.03, P.fern, 0.015, 16), 0.45, 0, 0.2),
        paint(at(nub(0.12, 3), 0, 0.04, 0), P.blossom),
      ]),
  },
  boat: {
    name: "Country boat",
    make: () =>
      join([
        hull(2.2, 0.8, 0.45),
        at(rbox(0.22, 0.05, 0.6, P.cream, 0.02), 0.3, 0.2, 0),
        at(rbox(0.22, 0.05, 0.6, P.cream, 0.02), -0.4, 0.2, 0),
      ]),
  },
  shikara: {
    name: "Shikara",
    make: () => {
      const parts: G[] = [hull(2.6, 0.85, 0.42)];
      for (const [x, z] of [
        [-0.45, -0.25],
        [0.45, -0.25],
        [-0.45, 0.25],
        [0.45, 0.25],
      ] as const)
        parts.push(at(stick(0.025, 0.6, P.cream), x, 0.18, z));
      parts.push(
        at(rbox(1.25, 0.08, 0.72, P.rose, 0.035), 0, 0.76, 0),
        at(rbox(0.9, 0.16, 0.55, P.cream, 0.05), 0, 0.16, 0),
      );
      return join(parts);
    },
  },
  houseboat: {
    name: "Houseboat (kettuvallam)",
    make: () => {
      const roof = new THREE.CylinderGeometry(0.55, 0.55, 2.5, 18, 1, false, 0, Math.PI);
      roof.rotateZ(Math.PI / 2);
      roof.translate(0, 0.32, 0);
      return join([
        hull(3.6, 1.1, 0.5),
        paint(flat(roof), P.marigold),
        at(rbox(0.5, 0.36, 0.7, P.cream, 0.05), 1.45, 0.2, 0),
      ]);
    },
  },
  ghat: {
    name: "Ghat steps",
    make: () =>
      join(
        [0, 1, 2, 3].map((i) =>
          at(rbox(6, 0.2 * (4 - i), 0.9, i % 2 ? P.cream : P.stone, 0.03), 0, 0, i * 0.9 - 1.35),
        ),
      ),
  },
  chhatri: {
    name: "Chhatri",
    make: () => {
      const parts: G[] = [rbox(1.1, 0.18, 1.1, P.stone, 0.04)];
      for (const [x, z] of [
        [-0.4, -0.4],
        [0.4, -0.4],
        [-0.4, 0.4],
        [0.4, 0.4],
      ] as const)
        parts.push(at(stick(0.06, 0.8, P.cream), x, 0.18, z));
      parts.push(
        at(rbox(1.2, 0.12, 1.2, P.cream, 0.04), 0, 0.98, 0),
        at(ball(0.42, P.cream, 1, 0.8, 1), 0, 1.1, 0),
        paint(at(nub(0.08, 2), 0, 1.76, 0), P.marigold),
      );
      return join(parts);
    },
  },
  longhouse: {
    name: "Ladakhi longhouse",
    make: () => {
      const parts: G[] = [
        rbox(3, 1.2, 1.4, P.cream, 0.06),
        at(rbox(3.06, 0.24, 1.46, P.clay, 0.04), 0, 1.16, 0),
      ];
      for (const i of [-1, 0, 1])
        parts.push(
          at(rbox(0.32, 0.38, 0.06, P.ink, 0.03), i * 0.9, 0.5, 0.7),
          at(rbox(0.44, 0.08, 0.1, P.clay, 0.02), i * 0.9, 0.92, 0.7),
        );
      return join(parts);
    },
  },
  gompa: {
    name: "Gompa hall",
    make: () => {
      const parts: G[] = [
        rbox(3.4, 2, 2.4, P.cream, 0.08),
        at(rbox(3.46, 0.3, 2.46, P.clay, 0.05), 0, 1.9, 0),
        at(rbox(1.2, 0.6, 1, P.cream, 0.05), 0, 2.15, 0),
        at(gable(1.2, 1, 0.4, P.marigold, 0.1), 0, 2.75, 0),
        at(rbox(0.5, 0.8, 0.06, P.coral, 0.03), 0, 0, 1.2),
      ];
      for (const i of [-1, 1])
        for (const y of [0.4, 1.2])
          parts.push(at(rbox(0.36, 0.42, 0.06, P.ink, 0.03), i * 1.05, y, 1.2));
      return join(parts);
    },
  },
  chorten: {
    name: "Chorten (stupa)",
    make: () =>
      join([
        rbox(0.9, 0.22, 0.9, P.cream, 0.04),
        at(rbox(0.7, 0.2, 0.7, P.cream, 0.04), 0, 0.22, 0),
        at(rbox(0.52, 0.16, 0.52, P.cream, 0.04), 0, 0.42, 0),
        at(ball(0.3, P.cream, 1, 0.9, 1), 0, 0.56, 0),
        at(
          lathe(
            [
              [0.1, 0],
              [0.035, 0.45],
              [0, 0.47],
            ],
            P.marigold,
            14,
          ),
          0,
          1.08,
          0,
        ),
        paint(at(nub(0.06, 1), 0, 1.52, 0), P.marigold),
      ]),
  },
  prayerflags: {
    name: "Prayer flags",
    make: () => {
      const parts: G[] = [
        at(stick(0.04, 1.8, P.clay), -1.6, 0, 0),
        at(stick(0.04, 1.8, P.clay), 1.6, 0, 0),
      ];
      for (let i = 0; i < 11; i++) {
        const x = -1.4 + i * 0.28;
        const y = 1.72 - 0.35 * (1 - (x / 1.6) ** 2);
        parts.push(
          at(rbox(0.17, 0.21, 0.02, FLAGS[i % FLAGS.length] as string, 0.008), x, y - 0.21, 0),
        );
      }
      return join(parts);
    },
  },
  maniwall: {
    name: "Mani wall",
    make: () =>
      join([
        rbox(2.6, 0.5, 0.55, P.stone, 0.08),
        ...[0, 1, 2, 3, 4, 5].map((i) =>
          at(rbox(0.36, 0.12, 0.4, i % 2 ? P.cream : P.stone, 0.05), -1.05 + i * 0.42, 0.5, 0),
        ),
      ]),
  },
  katte: {
    name: "Katte (banyan platform)",
    make: () => {
      const tree = (TREES[8] as Item).make();
      tree.scale(0.9, 0.9, 0.9);
      tree.translate(0, 0.45, 0);
      return join([
        drum(1.7, 0.45, P.stone, 0.06, 32),
        at(drum(1.45, 0.05, P.cream, 0.02, 32), 0, 0.42, 0),
        tree,
      ]);
    },
  },
  well: {
    name: "Well",
    make: () =>
      join([
        drum(0.6, 0.55, P.stone, 0.06, 24),
        at(drum(0.46, 0.02, P.aqua, 0.01, 20), 0, 0.54, 0),
        at(stick(0.05, 1.2, P.clay), 0.5, 0, 0),
        at(stick(0.05, 1.2, P.clay), -0.5, 0, 0),
        at(stick(0.04, 1.1, P.clay), -0.55, 1.18, 0, 0, 0, -Math.PI / 2),
        paint(at(nub(0.1, 2), 0, 0.85, 0), P.clay),
      ]),
  },
  mustard: { name: "Mustard field", make: () => crop(P.marigold, P.pistachio) },
  paddy: { name: "Paddy field", make: () => crop(P.mint, P.aqua, 0.12, 0.05) },
  barley: { name: "Barley field", make: () => crop(P.pistachio, P.clay) },
  tea: { name: "Tea rows", make: () => crop(P.fern, P.clay, 0.36, 0.17) },
  haystack: {
    name: "Haystack",
    make: () =>
      lathe(
        [
          [0, 0],
          [0.55, 0],
          [0.58, 0.3],
          [0.45, 0.7],
          [0.2, 0.95],
          [0, 1.02],
        ],
        P.marigold,
        16,
      ),
  },
  scarecrow: {
    name: "Scarecrow",
    make: () =>
      join([
        stick(0.04, 1.4, P.clay),
        at(stick(0.035, 0.9, P.clay), -0.45, 1.05, 0, 0, 0, -Math.PI / 2),
        at(rbox(0.4, 0.45, 0.18, P.coral, 0.06), 0, 0.72, 0),
        at(ball(0.14, P.cream), 0, 1.3, 0),
        at(drum(0.22, 0.05, P.marigold, 0.02, 14), 0, 1.52, 0),
      ]),
  },
  poplar: {
    name: "Poplar",
    make: () =>
      join([
        paint(trunk(0.08, 0.6), P.clay),
        paint(
          at(
            prism({
              sides: 6,
              radius: 0.32,
              height: 2.4,
              taper: 0.3,
              round: 0.5,
              bevel: 0.06,
              seed: 3,
            }),
            0,
            0.45,
            0,
          ),
          P.pistachio,
        ),
      ]),
  },
  willow: {
    name: "Willow",
    make: () => {
      const parts: G[] = [
        paint(trunk(0.12, 0.9), P.clay),
        at(ball(0.7, P.pistachio, 1.2, 0.7, 1.2), 0, 0.75, 0),
      ];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        parts.push(
          at(rbox(0.2, 0.55, 0.2, P.pistachio, 0.09), Math.cos(a) * 0.78, 0.62, Math.sin(a) * 0.78),
        );
      }
      return join(parts);
    },
  },
  chinar: {
    name: "Chinar (autumn)",
    make: () =>
      join([
        paint(trunk(0.16, 0.9), P.clay),
        at(ball(0.8, P.coral, 1.15, 0.85, 1.1), 0, 0.7, 0),
        at(ball(0.5, P.marigold, 1, 0.9, 1), 0.45, 1.25, 0.1),
      ]),
  },
  bhunga: {
    name: "Bhunga (Kutch hut)",
    make: () =>
      join([
        drum(0.85, 0.95, P.cream, 0.08, 24),
        at(drum(0.87, 0.12, P.coral, 0.03, 24), 0, 0.5, 0),
        at(
          lathe(
            [
              [0, 0],
              [1.05, 0],
              [0.6, 0.45],
              [0.12, 0.85],
              [0, 0.9],
            ],
            P.marigold,
            20,
          ),
          0,
          0.92,
          0,
        ),
        at(rbox(0.32, 0.55, 0.08, P.ink, 0.03), 0, 0, 0.82),
      ]),
  },
  dune: { name: "Dune", make: () => ball(2.2, SAND, 1.6, 0.22, 1) },
  stallCoral: { name: "Market stall", make: () => stall(P.coral) },
  stallAqua: { name: "Market stall", make: () => stall(P.aqua) },
  telescope: {
    name: "Observatory dome",
    make: () =>
      join([
        drum(0.9, 0.9, P.cream, 0.06, 28),
        at(ball(0.9, P.cream, 1, 0.9, 1), 0, 0.09, 0),
        at(rbox(0.26, 0.75, 0.12, P.ink, 0.05), 0, 1.0, 0.72, 0, -0.5),
      ]),
  },

  // ── bike activities (all point along +z: the way you ride) ──
  ramp: { name: "Wooden ramp", make: () => wedge(2.2, 3.2, 0.95, P.clay, P.marigold) },
  kicker: { name: "Stone kicker", make: () => wedge(2, 2.4, 0.7, P.stone, P.cream) },
  railing: {
    name: "Bridge railing",
    make: () =>
      join([
        rbox(0.16, 0.5, 6, P.cream, 0.05),
        at(rbox(0.22, 0.62, 0.22, P.cream, 0.05), 0, 0, -2.9),
        at(rbox(0.22, 0.62, 0.22, P.cream, 0.05), 0, 0, 2.9),
      ]),
  },
  sleeper: { name: "Rail sleeper", make: () => rbox(2, 0.1, 0.32, P.clay, 0.03) },
  engine: {
    name: "Toy engine",
    // Nose (lamp, chimney, cow-catcher) towards +z, the cab at the back by the coaches.
    make: () =>
      join([
        rbox(1.7, 0.35, 4.4, P.ink, 0.08),
        at(drum(0.62, 2.7, P.coral, 0.12), 0, 1.0, -0.8, 0, Math.PI / 2),
        at(rbox(1.6, 1.7, 1.3, P.coral, 0.12), 0, 0.35, -1.45),
        at(rbox(1.8, 0.14, 1.5, P.ink, 0.05), 0, 2.05, -1.45),
        at(rbox(0.06, 0.45, 0.7, P.aqua, 0.03), 0.8, 1.25, -1.45),
        at(rbox(0.06, 0.45, 0.7, P.aqua, 0.03), -0.8, 1.25, -1.45),
        at(drum(0.2, 0.7, P.ink, 0.06), 0, 1.5, 1.0),
        at(drum(0.3, 0.12, P.marigold, 0.05), 0, 2.2, 1.0),
        at(drum(0.24, 0.12, P.marigold, 0.04), 0, 0.88, 1.66, 0, Math.PI / 2),
        at(wedgeNose(1.5, 0.45, 0.5, P.ink), 0, 0.02, 2.25),
        ...[-1.4, 0, 1.4].flatMap((z) => [
          at(wheelOn(0.38), 0.86, 0.38, z),
          at(wheelOn(0.38), -0.86, 0.38, z),
        ]),
      ]),
  },
  coupler: { name: "Coupler", make: () => at(rbox(0.22, 0.16, 1.1, P.ink, 0.05), 0, 0.42, 0) },
  coachAqua: { name: "Toy coach", make: () => coach(P.aqua) },
  coachMarigold: { name: "Toy coach", make: () => coach(P.marigold) },
  bollardCoral: {
    name: "Marker bollard",
    make: () =>
      join([
        drum(0.16, 0.6, P.coral, 0.05, 14),
        at(drum(0.17, 0.12, P.cream, 0.04, 14), 0, 0.3, 0),
      ]),
  },
  bollardCream: {
    name: "Marker bollard",
    make: () =>
      join([
        drum(0.16, 0.6, P.cream, 0.05, 14),
        at(drum(0.17, 0.12, P.coral, 0.04, 14), 0, 0.3, 0),
      ]),
  },
  potStack: {
    name: "Stack of matkas",
    make: () => {
      const parts: G[] = [];
      const rows = [3, 2, 1];
      rows.forEach((n, row) => {
        for (let i = 0; i < n; i++) parts.push(at(matka(), (i - (n - 1) / 2) * 0.58, row * 0.5, 0));
      });
      parts.unshift(rbox(2, 0.12, 0.8, P.clay, 0.04));
      return join(parts);
    },
  },
  matka: { name: "Matka", make: () => matka() },
  hayBale: { name: "Hay bale", make: () => rbox(1, 0.5, 0.62, P.marigold, 0.08) },
  plank: { name: "Plank", make: () => rbox(2, 0.12, 0.8, P.clay, 0.04) },
  hayBales: {
    name: "Hay bales",
    make: () => {
      const parts: G[] = [];
      [3, 2, 1].forEach((n, row) => {
        for (let i = 0; i < n; i++)
          parts.push(
            at(rbox(1, 0.5, 0.62, P.marigold, 0.08), (i - (n - 1) / 2) * 1.04, row * 0.5, 0),
          );
      });
      return join(parts);
    },
  },
  lantern: {
    name: "Lantern post",
    make: () =>
      join([
        drum(0.14, 0.12, P.stone, 0.04, 12),
        stick(0.05, 1.6, P.clay),
        at(rbox(0.5, 0.05, 0.08, P.clay, 0.02), 0.2, 1.55, 0),
        at(rbox(0.26, 0.34, 0.26, P.cream, 0.05), 0.38, 1.18, 0),
        at(rbox(0.32, 0.06, 0.32, P.ink, 0.03), 0.38, 1.52, 0),
      ]),
  },
  shrine: {
    name: "Roadside shrine",
    make: () =>
      join([
        rbox(1.3, 0.3, 1.3, P.stone, 0.06),
        at(rbox(0.8, 0.75, 0.8, P.cream, 0.06), 0, 0.3, 0),
        at(rbox(0.36, 0.48, 0.06, P.coral, 0.04), 0, 0.34, 0.39),
        at(
          lathe(
            [
              [0, 0],
              [0.5, 0],
              [0.42, 0.25],
              [0.28, 0.55],
              [0.12, 0.8],
              [0, 0.95],
            ],
            P.marigold,
            8,
          ),
          0,
          1.05,
          0,
        ),
        at(ball(0.07, P.coral), 0, 2.0, 0),
        ...[-0.45, -0.15, 0.15, 0.45].map((x, i) =>
          paint(at(nub(0.09, i), x, 0.32, 0.62), i % 2 ? P.coral : P.marigold),
        ),
        at(drum(0.08, 0.06, P.clay, 0.02, 10), 0.4, 0.3, 0.5),
      ]),
  },
  kite: {
    name: "Kite (patang)",
    make: () => {
      // A patang: a square diamond in two colours with a cream cap, a spine,
      // a bowed cross-stick and a little tassel; flying tilted back into the wind.
      const tri = (pts: [number, number][], hex: string, z = 0) => {
        const g = new THREE.ExtrudeGeometry(
          new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))),
          { depth: 0.025, bevelEnabled: false },
        );
        g.translate(0, 0, z);
        return paint(flat(g), hex);
      };
      const T = 0.62;
      const parts: G[] = [
        tri(
          [
            [0, T],
            [T, 0],
            [0, -T],
          ],
          P.coral,
        ),
        tri(
          [
            [0, T],
            [0, -T],
            [-T, 0],
          ],
          P.marigold,
        ),
        tri(
          [
            [0, T],
            [T * 0.38, T * 0.62],
            [-T * 0.38, T * 0.62],
          ],
          P.cream,
          0.004,
        ),
        tri(
          [
            [0, -T + 0.02],
            [0.2, -T - 0.24],
            [-0.2, -T - 0.24],
          ],
          P.rose,
        ),
      ];
      const spine = new THREE.CylinderGeometry(0.018, 0.018, T * 2, 6);
      parts.push(paint(flat(at(spine, 0, 0, 0.03)), P.cream));
      const bow = new THREE.TubeGeometry(
        new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(-T, 0, 0.03),
          new THREE.Vector3(0, T * 0.55, 0.03),
          new THREE.Vector3(T, 0, 0.03),
        ),
        12,
        0.016,
        5,
      );
      parts.push(paint(flat(bow), P.cream));
      return join(parts.map((g) => at(g, 0, 0, 0, 0, -0.95)));
    },
  },
  flag: {
    name: "Summit flag",
    make: () => {
      const shape = new THREE.Shape([
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.8, -0.25),
        new THREE.Vector2(0, -0.5),
      ]);
      const cloth = paint(
        flat(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false })),
        P.coral,
      );
      return join([stick(0.04, 2, P.cream), at(cloth, 0.03, 1.95, 0)]);
    },
  },
  spray: { name: "Spray", make: () => ball(0.12, "#ffffff") },
};

/** A wedge you ride up: width (x), length along +z, lip height; side and top colours. */
function wedge(w: number, len: number, h: number, side: string, top: string): G {
  const shape = new THREE.Shape([
    new THREE.Vector2(-len / 2, 0),
    new THREE.Vector2(len / 2, h),
    new THREE.Vector2(len / 2, 0),
  ]);
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: w,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
  body.translate(0, 0, -w / 2);
  body.rotateY(-Math.PI / 2);
  const parts: G[] = [paint(flat(body), side)];
  // Planks across the slope, and a bright lip.
  const slope = Math.atan2(h, len);
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5;
    parts.push(
      at(
        rbox(w * 0.96, 0.03, len / 6.2, i % 2 ? top : side, 0.01),
        0,
        h * t + 0.02,
        -len / 2 + len * t,
        0,
        -slope,
      ),
    );
  }
  parts.push(at(rbox(w, 0.08, 0.14, P.cream, 0.03), 0, h - 0.02, len / 2 - 0.07));
  return join(parts);
}

/** A low sloped nose (a cow-catcher), its slope facing +z. */
function wedgeNose(w: number, len: number, h: number, hex: string): G {
  const shape = new THREE.Shape([
    new THREE.Vector2(-len / 2, 0),
    new THREE.Vector2(-len / 2, h),
    new THREE.Vector2(len / 2, 0),
  ]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(-Math.PI / 2);
  return paint(flat(g), hex);
}

function wheelOn(r: number): G {
  const g = drum(r, 0.16, P.ink, 0.05, 16);
  g.translate(0, -0.08, 0);
  g.rotateZ(Math.PI / 2);
  return g;
}

function coach(body: string): G {
  return join([
    rbox(1.7, 0.3, 4.6, P.ink, 0.08),
    at(rbox(1.6, 1.5, 4.4, body, 0.14), 0, 0.3, 0),
    at(rbox(1.64, 0.36, 3.8, P.cream, 0.06), 0, 1.05, 0),
    at(rbox(1.8, 0.14, 4.7, P.cream, 0.06), 0, 1.8, 0),
    ...[-1.5, 1.5].flatMap((z) => [
      at(wheelOn(0.32), 0.86, 0.32, z),
      at(wheelOn(0.32), -0.86, 0.32, z),
    ]),
  ]);
}

/** A clay pot. */
function matka(): G {
  return join([
    lathe(
      [
        [0, 0],
        [0.14, 0],
        [0.27, 0.12],
        [0.28, 0.24],
        [0.2, 0.38],
        [0.12, 0.42],
        [0.14, 0.48],
        [0, 0.48],
      ],
      P.coral,
      18,
    ),
    at(drum(0.15, 0.03, P.cream, 0.01, 18), 0, 0.26, 0),
  ]);
}

/** A rounded block, painted: for terraces, risers and walls built in a scene. */
export const block = rbox;
