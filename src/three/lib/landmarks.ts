/**
 * Stop landmarks: every E in a world is a place, not a circle on the road.
 * Toy buildings and sights in the flat kit's language (soft rounded blocks,
 * flat pastel colours as vertex colours), each facing +z (towards the road),
 * centred on the origin, standing on y = 0, with painted signboards as their
 * own meshes. The forecourt (where you pull in to read the stop) is in front.
 *
 * Expresso (Coorg): the roastery, the kaapi darshini, the post office, the
 * weighing shed, the cold-brew well, the sunset pavilion, the pepper harvest
 * and the rope bridge.
 */

import * as THREE from "three";
import { join, paint } from "./nature";
import { PASTEL as P } from "./palette";
import { at, ball, drum, type G, gable, LANDSCAPE, lathe, rbox } from "./toys";

const WOOD = "#b98a62";
const BAMBOO = "#d8b36a";
const STEEL = "#c7cdd6";
const RED = "#e2574a";
const SMOKE = "#efe9e2";
const MOCHA = "#9a6a52";
const WALL = "#f7ead6";

/** A painted board: lines of text on a colour, as its own mesh (facing +z). */
export function board(
  lines: { text: string; size: number; font?: string }[],
  w: number,
  h: number,
  bg: string,
  fg: string,
  /** Shrink a line that's too long to fit across the board (with a margin each side). */
  fit = true,
): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.max(64, Math.round((512 * h) / w));
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const total = lines.reduce((a, l) => a + l.size, 0);
  let y = (1 - total) / 2;
  for (const l of lines) {
    const face = l.font?.includes("serif") ? "" : "Outfit, sans-serif";
    let px = c.height * l.size * 0.82;
    g.font = `${l.font ?? "900"} ${px}px ${face}`;
    const room = c.width * 0.88;
    const wide = g.measureText(l.text).width;
    if (fit && wide > room) {
      px *= room / wide;
      g.font = `${l.font ?? "900"} ${px}px ${face}`;
    }
    g.fillText(l.text, c.width / 2, c.height * (y + l.size / 2));
    y += l.size;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  m.userData.noShadow = true;
  return m;
}

/** A flat disc of dark water (one plain face, so it shades evenly). */
function water(r: number): G {
  const g = new THREE.CircleGeometry(r, 36);
  g.rotateX(-Math.PI / 2);
  const f = g.toNonIndexed();
  f.deleteAttribute("uv");
  return paint(f, "#2f5a6b");
}

export interface Landmark {
  body: G;
  signs: THREE.Mesh[];
  /** Where warm light shows at night (local), and how far it reaches. */
  lamps: { x: number; y: number; z: number; r: number }[];
  /** Half-size of its footprint (x, z), for keeping scenery and roads clear. */
  half: [number, number];
  /** What the bike can't ride through (local x, z, radius): walls, posts, trunks, the well. */
  solids: [number, number, number][];
  /** Other meshes it brings (e.g. a lake's water), in its local frame. */
  extras?: THREE.Object3D[];
}

export const sign = (m: THREE.Mesh, x: number, y: number, z: number, ry = 0): THREE.Mesh => {
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
};

/** A jute sack, slumped. */
const sack = (x: number, z: number, s = 1) => at(ball(0.32 * s, "#d8b98e", 1, 0.72, 1.15), x, 0, z);

// ── the roastery (Expresso) ─────────────────────────────────────────────────

function roastery(): Landmark {
  const parts: G[] = [
    at(rbox(4.2, 2.6, 3.2, WALL, 0.08), 0, 0, -0.4),
    at(gable(4.2, 3.2, 1.2, P.coral, 0.3), 0, 2.6, -0.4),
    at(rbox(0.9, 1.6, 0.06, P.ink, 0.03), -0.6, 0, 1.22),
    ...[-1.6, 1.0].map((x) => at(rbox(0.8, 0.7, 0.06, P.aqua, 0.03), x, 1.2, 1.22)),
    // The chimney, smoking.
    at(drum(0.34, 2.6, P.clay, 0.06, 16), 1.3, 2.2, -1.3),
    at(drum(0.4, 0.18, P.ink, 0.05, 16), 1.3, 4.75, -1.3),
    at(ball(0.42, SMOKE), 1.35, 5.0, -1.3),
    at(ball(0.55, SMOKE), 1.75, 5.6, -1.5),
    at(ball(0.7, SMOKE, 1, 0.9, 1), 2.4, 6.3, -1.8),
    // The drum roaster by the door, on its stand, with its hopper.
    at(rbox(1.1, 0.5, 0.8, P.ink, 0.05), -2.9, 0, 0.9),
    at(drum(0.55, 1.2, "#c07a4e", 0.08, 20), -2.9, 1.05, 0.3, 0, Math.PI / 2),
    at(
      lathe(
        [
          [0.08, 0],
          [0.35, 0.5],
          [0.35, 0.56],
          [0, 0.56],
        ],
        P.marigold,
        16,
      ),
      -2.9,
      1.55,
      0.9,
    ),
    // Sacks waiting.
    sack(2.6, 1.1),
    sack(3.1, 0.5),
    sack(2.7, 0.2, 0.9),
    at(ball(0.3, "#d8b98e", 1, 0.72, 1.1), 2.85, 0.42, 0.65),
  ];
  return {
    body: join(parts),
    signs: [
      sign(board([{ text: "ROASTERY", size: 1 }], 2.4, 0.5, P.marigold, P.ink), 0, 2.15, 1.24),
    ],
    lamps: [{ x: 0, y: 1.2, z: 1.6, r: 3.6 }],
    half: [3.6, 2.2],
    solids: [
      [-1.1, -0.4, 1.65],
      [1.1, -0.4, 1.65],
      [-2.9, 0.6, 0.7],
    ],
  };
}

// ── the kaapi darshini (Brewtils) ───────────────────────────────────────────

function darshini(): Landmark {
  const tumbler = lathe(
    [
      [0, 0],
      [0.42, 0],
      [0.46, 0.08],
      [0.56, 1.25],
      [0.6, 1.3],
      [0.57, 1.34],
      [0, 1.34],
    ],
    STEEL,
    28,
  );
  const davara = lathe(
    [
      [0, 0],
      [0.55, 0],
      [0.82, 0.32],
      [0.86, 0.38],
      [0.8, 0.4],
      [0, 0.4],
    ],
    STEEL,
    28,
  );
  const parts: G[] = [
    at(rbox(3.6, 2.5, 0.35, P.mint, 0.06), 0, 0, -1.0),
    at(rbox(3.4, 1.05, 1.1, WALL, 0.06), 0, 0, 0),
    at(rbox(3.5, 0.08, 1.2, P.clay, 0.03), 0, 1.05, 0),
    // The roof, and on it the giant steel tumbler in its davara.
    at(rbox(4.0, 0.14, 2.6, P.marigold, 0.05), 0, 2.5, -0.35),
    at(davara, 0.6, 2.64, -0.5),
    at(tumbler, 0.6, 2.9, -0.5),
    at(ball(0.18, "#ffffff"), 0.75, 4.35, -0.55),
    at(ball(0.24, "#ffffff"), 0.95, 4.75, -0.7),
    // Posts for the roof, stools in front, a brass dabba and two small tumblers on the counter.
    ...[-1.75, 1.75].map((x) => at(rbox(0.12, 2.5, 0.12, P.clay, 0.03), x, 0, 0.75)),
    ...[-1.0, 0, 1.0].map((x) => at(drum(0.2, 0.5, P.coral, 0.05, 14), x, 0, 1.25)),
    at(drum(0.2, 0.35, P.marigold, 0.04, 14), -1.1, 1.13, 0),
    ...[0.4, 0.75].map((x) =>
      at(
        lathe(
          [
            [0, 0],
            [0.07, 0],
            [0.09, 0.2],
            [0, 0.2],
          ],
          STEEL,
          12,
        ),
        x,
        1.13,
        0.1,
      ),
    ),
  ];
  return {
    body: join(parts),
    signs: [
      sign(
        board(
          [
            { text: "ಕಾಫಿ", size: 0.5, font: "700" },
            { text: "KAAPI", size: 0.5 },
          ],
          1.6,
          0.8,
          P.cream,
          P.ink,
        ),
        -0.9,
        1.85,
        -0.8,
      ),
    ],
    lamps: [{ x: 0, y: 1.6, z: 0.6, r: 3.4 }],
    half: [2.2, 1.6],
    solids: [
      [-1, -0.3, 1.0],
      [1, -0.3, 1.0],
    ],
  };
}

// ── the post office (Bloomail) ──────────────────────────────────────────────

function postOffice(): Landmark {
  const parts: G[] = [
    at(rbox(3.8, 2.4, 2.8, WALL, 0.08), 0, 0, -0.4),
    at(rbox(3.86, 0.3, 2.86, RED, 0.05), 0, 1.95, -0.4),
    at(gable(3.8, 2.8, 0.9, P.clay, 0.3), 0, 2.4, -0.4),
    at(rbox(0.9, 1.6, 0.06, P.ink, 0.03), 0.6, 0, 1.02),
    at(rbox(1.0, 0.8, 0.06, P.aqua, 0.03), -0.9, 0.8, 1.02),
    // The red pillar box, by the door.
    at(drum(0.3, 1.05, RED, 0.06, 20), 2.3, 0, 1.4),
    at(ball(0.31, RED, 1, 0.5, 1), 2.3, 1.05, 1.4),
    at(rbox(0.3, 0.05, 0.08, P.ink, 0.02), 2.3, 0.8, 1.69),
    // Parcels by the step.
    at(rbox(0.5, 0.35, 0.4, "#d9b68b", 0.04), -2.3, 0, 1.0),
    at(rbox(0.36, 0.28, 0.32, "#d9b68b", 0.04), -2.25, 0.35, 1.0),
  ];
  return {
    body: join(parts),
    signs: [
      sign(
        board(
          [
            { text: "डाकघर", size: 0.45, font: "700" },
            { text: "POST OFFICE", size: 0.55 },
          ],
          3.2,
          0.95,
          "#ffffff",
          RED,
        ),
        0,
        1.95,
        1.08,
      ),
    ],
    lamps: [{ x: 0, y: 1.2, z: 1.4, r: 3.4 }],
    half: [2.8, 1.9],
    solids: [
      [-0.9, -0.4, 1.45],
      [0.9, -0.4, 1.45],
      [2.3, 1.4, 0.35],
    ],
  };
}

// ── the weighing shed (logger) ──────────────────────────────────────────────

function weighingShed(): Landmark {
  const roof = rbox(4.4, 0.1, 3.4, P.aqua, 0.03);
  roof.rotateX(0.1);
  const parts: G[] = [
    ...[
      [-1.9, -1.3],
      [1.9, -1.3],
      [-1.9, 1.3],
      [1.9, 1.3],
    ].map(([x = 0, z = 0]) => at(rbox(0.14, z < 0 ? 2.8 : 2.5, 0.14, P.clay, 0.03), x, 0, z)),
    at(roof, 0, 2.6, 0),
    // The platform scale, its column and dial, sacks on it.
    at(rbox(1.5, 0.16, 1.1, P.stone, 0.04), -0.5, 0, 0.2),
    at(rbox(0.14, 1.5, 0.14, P.ink, 0.03), -1.3, 0, -0.35),
    at(drum(0.34, 0.08, P.cream, 0.03, 20), -1.3, 1.55, -0.29, 0, Math.PI / 2),
    at(ball(0.36, "#d8b98e", 1, 0.72, 1.15), -0.6, 0.16, 0.25),
    at(ball(0.33, "#d8b98e", 1, 0.72, 1.1), -0.2, 0.16, 0.05),
    // Crates of cherries.
    at(rbox(0.7, 0.45, 0.5, WOOD, 0.04), 1.3, 0, 0.6),
    at(ball(0.3, P.coral, 1, 0.4, 0.75), 1.3, 0.42, 0.6),
    at(rbox(0.7, 0.45, 0.5, WOOD, 0.04), 1.3, 0.45, 0.6),
    // The ledger board's legs.
    ...[0.55, 1.75].map((x) => at(rbox(0.08, 1.9, 0.08, WOOD, 0.02), x, 0, -1.05)),
  ];
  return {
    body: join(parts),
    signs: [
      sign(
        board(
          [
            { text: "LEDGER", size: 0.28 },
            { text: "07:42   ✓ 3 sacks", size: 0.24, font: "600" },
            { text: "08:15   ✓ 5 sacks", size: 0.24, font: "600" },
            { text: "09:03   ✓ 2 sacks", size: 0.24, font: "600" },
          ],
          1.3,
          0.95,
          "#2f4a3f",
          "#eef3e6",
        ),
        1.15,
        1.35,
        -1.0,
      ),
    ],
    lamps: [{ x: 0, y: 2.2, z: 0, r: 3.6 }],
    half: [2.4, 1.8],
    solids: [
      [-1.9, -1.3, 0.2],
      [1.9, -1.3, 0.2],
      [-1.9, 1.3, 0.2],
      [1.9, 1.3, 0.2],
      [-0.6, 0.2, 0.8],
      [1.3, 0.6, 0.45],
    ],
  };
}

// ── the cold-brew well (JSON) ───────────────────────────────────────────────

function coldBrewWell(): Landmark {
  const matka = LANDSCAPE.matka?.make() as G;
  const parts: G[] = [
    at(drum(1.0, 0.8, P.stone, 0.08, 28), 0, 0, 0),
    at(drum(1.08, 0.14, P.cream, 0.05, 28), 0, 0.8, 0),
    // The water: a flat dark disc just inside the rim.
    at(water(0.86), 0, 0.93, 0),
    // The frame, the pulley, the rope and the bucket.
    ...[-1.15, 1.15].map((x) => at(rbox(0.14, 2.3, 0.14, WOOD, 0.03), x, 0, 0)),
    at(rbox(2.5, 0.14, 0.16, WOOD, 0.03), 0, 2.25, 0),
    at(drum(0.24, 0.12, P.ink, 0.04, 16), 0.06, 2.0, 0, 0, 0, Math.PI / 2),
    at(rbox(0.03, 0.85, 0.03, P.cream, 0.01), 0, 1.25, 0.2),
    at(
      lathe(
        [
          [0, 0],
          [0.16, 0],
          [0.2, 0.3],
          [0, 0.3],
        ],
        P.aqua,
        16,
      ),
      0,
      0.95,
      0.2,
    ),
    // Clay pots of cold brew, cooling.
    at(matka.clone(), 1.5, 0, 0.9),
    at(matka.clone(), 1.95, 0, 0.5),
    at(matka.clone(), 1.7, 0.48, 0.7),
    at(matka.clone(), -1.6, 0, 0.9),
  ];
  return {
    body: join(parts),
    signs: [
      sign(
        board([{ text: "{ cold brew }", size: 1, font: "800" }], 1.5, 0.36, P.cream, P.ink),
        0,
        2.55,
        0.1,
      ),
    ],
    lamps: [{ x: 0, y: 1.6, z: 0.6, r: 3 }],
    half: [2.2, 1.4],
    solids: [[0, 0, 1.15]],
  };
}

// ── the sunset pavilion (Mochios) ───────────────────────────────────────────

function sunsetPavilion(): Landmark {
  const roof = lathe(
    [
      [0, 0],
      [2.55, 0],
      [2.55, 0.16],
      [0.2, 1.35],
      [0, 1.4],
    ],
    MOCHA,
    4,
  );
  roof.rotateY(Math.PI / 4);
  const parts: G[] = [
    at(rbox(4.2, 0.5, 4.2, P.stone, 0.06), 0, 0, 0),
    at(rbox(1.6, 0.17, 0.5, P.stone, 0.04), 0, 0, 2.3),
    at(rbox(1.6, 0.33, 0.35, P.stone, 0.04), 0, 0, 2.15),
    ...[
      [-1.6, -1.6],
      [1.6, -1.6],
      [-1.6, 1.6],
      [1.6, 1.6],
    ].map(([x, z]) => at(drum(0.16, 2.2, P.cream, 0.05, 14), x as number, 0.5, z as number)),
    at(roof, 0, 2.7, 0),
    at(ball(0.2, P.marigold), 0, 4.05, 0),
    // A bench facing the view, and a low parapet at the back.
    at(rbox(1.8, 0.1, 0.5, WOOD, 0.03), 0, 0.95, -0.8),
    ...[-0.7, 0.7].map((x) => at(rbox(0.1, 0.45, 0.45, WOOD, 0.02), x, 0.5, -0.8)),
    at(rbox(3.6, 0.5, 0.2, P.cream, 0.05), 0, 0.5, -1.95),
  ];
  return {
    body: join(parts),
    signs: [],
    lamps: [{ x: 0, y: 2.2, z: 0, r: 3.4 }],
    half: [2.4, 2.6],
    solids: [
      [-1, -1, 1.45],
      [1, -1, 1.45],
      [-1, 1, 1.45],
      [1, 1, 1.45],
    ],
  };
}

// ── the pepper harvest (Zippuccino) ─────────────────────────────────────────

function pepperHarvest(): Landmark {
  const parts: G[] = [];
  const oaks: [number, number][] = [
    [-1.3, -0.6],
    [0.3, -1.1],
    [1.5, -0.2],
  ];
  for (const [i, [x, z]] of oaks.entries()) {
    parts.push(at(drum(0.15, 4.4, "#d9d3c8", 0.05, 12), x, 0, z));
    parts.push(at(ball(0.95, P.fern, 1, 1.25, 1), x, 3.9, z));
    // The pepper vine climbing it, berries hanging in clusters.
    for (let k = 0; k < 14; k++) {
      const a = k * 1.3 + i;
      const y = 0.3 + k * 0.24;
      parts.push(
        at(ball(0.13, P.mint, 1.2, 0.9, 1.2), x + Math.cos(a) * 0.2, y, z + Math.sin(a) * 0.2),
      );
      if (k % 3 === 1)
        parts.push(
          at(
            ball(0.07, k % 2 ? P.coral : "#4f7a3a"),
            x + Math.cos(a) * 0.3,
            y - 0.08,
            z + Math.sin(a) * 0.3,
          ),
        );
    }
  }
  // A bamboo ladder against the middle oak.
  const ladder: G[] = [];
  for (const s of [-0.22, 0.22]) ladder.push(at(rbox(0.06, 3.6, 0.06, BAMBOO, 0.02), s, 0, 0));
  for (let k = 0; k < 9; k++)
    ladder.push(at(rbox(0.5, 0.05, 0.05, BAMBOO, 0.02), 0, 0.3 + k * 0.38, 0));
  const lad = join(ladder);
  lad.rotateX(-0.28);
  parts.push(at(lad, 0.3, 0, -0.1));
  // A basket of pepper, and a blue tarp of it drying.
  parts.push(
    at(
      lathe(
        [
          [0, 0],
          [0.3, 0],
          [0.38, 0.32],
          [0, 0.32],
        ],
        BAMBOO,
        16,
      ),
      -0.7,
      0,
      0.9,
    ),
  );
  parts.push(at(rbox(1.7, 0.03, 1.2, "#5b86a8", 0.01), 1.0, 0, 1.2));
  for (let k = 0; k < 18; k++)
    parts.push(
      at(ball(0.05, "#3c2f2a"), 0.3 + (k % 6) * 0.26, 0.03, 0.85 + Math.floor(k / 6) * 0.3),
    );
  return {
    body: join(parts),
    signs: [],
    lamps: [{ x: 0, y: 1.5, z: 0.6, r: 3.2 }],
    half: [2.6, 1.8],
    solids: [
      [-1.3, -0.6, 0.25],
      [0.3, -1.1, 0.25],
      [1.5, -0.2, 0.25],
    ],
  };
}

// ── the rope bridge (nexus) ─────────────────────────────────────────────────

/** A footbridge `span` long across x (over the stream), sagging, with rope rails. */
function ropeBridge(span = 9): Landmark {
  const parts: G[] = [];
  const end = span / 2;
  const sag = (x: number) => 0.75 - 0.42 * (1 - (x / end) ** 2);
  // Towers at each end: two posts, a crossbar, stakes.
  for (const e of [-1, 1]) {
    for (const z of [-0.85, 0.85]) parts.push(at(rbox(0.16, 2.2, 0.16, WOOD, 0.04), e * end, 0, z));
    parts.push(at(rbox(0.16, 0.14, 1.9, WOOD, 0.04), e * end, 2.1, 0));
    parts.push(at(rbox(1.4, 0.06, 1.3, P.stone, 0.03), e * (end + 0.4), 0, 0));
  }
  // Planks along the sag.
  for (let x = -end + 0.2; x <= end - 0.15; x += 0.34)
    parts.push(at(rbox(0.26, 0.06, 1.3, WOOD, 0.02), x, sag(x), 0));
  // Rope rails (short pieces along the curve) and hangers.
  const rail = (z: number) => {
    const n = 24;
    for (let i = 0; i < n; i++) {
      const x0 = -end + (span * i) / n;
      const x1 = -end + (span * (i + 1)) / n;
      const y0 = sag(x0) + 0.95 + 0.25 * (Math.abs(x0) / end) ** 2;
      const y1 = sag(x1) + 0.95 + 0.25 * (Math.abs(x1) / end) ** 2;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const seg = rbox(len + 0.02, 0.04, 0.04, P.cream, 0.015);
      seg.translate(0, -0.02, 0);
      seg.rotateZ(Math.atan2(y1 - y0, x1 - x0));
      parts.push(at(seg, (x0 + x1) / 2, (y0 + y1) / 2, z));
      if (i % 2 === 0)
        parts.push(at(rbox(0.025, y0 - sag(x0), 0.025, P.cream, 0.01), x0, sag(x0), z));
    }
  };
  rail(-0.7);
  rail(0.7);
  return {
    body: join(parts),
    signs: [],
    lamps: [
      { x: -end, y: 2, z: 0, r: 2.6 },
      { x: end, y: 2, z: 0, r: 2.6 },
    ],
    half: [end + 1, 1.2],
    solids: [-1, 1].flatMap((e) => [
      [e * end, -0.85, 0.2],
      [e * end, 0.85, 0.2],
    ]) as [number, number, number][],
  };
}

export type ExpressoLandmark =
  | "roastery"
  | "darshini"
  | "post"
  | "weighing"
  | "well"
  | "pavilion"
  | "pepper"
  | "bridge";

/** Expresso's stop landmarks, by stop. */
export const EXPRESSO_LANDMARKS: Record<
  ExpressoLandmark,
  { stop: string; title: string; make: () => Landmark }
> = {
  roastery: { stop: "Expresso", title: "The roastery", make: roastery },
  darshini: { stop: "Brewtils", title: "The kaapi darshini", make: darshini },
  post: { stop: "Bloomail", title: "The post office", make: postOffice },
  weighing: { stop: "logger", title: "The weighing shed", make: weighingShed },
  well: { stop: "JSON", title: "The cold-brew well", make: coldBrewWell },
  pavilion: { stop: "Mochios", title: "The sunset pavilion", make: sunsetPavilion },
  pepper: { stop: "Zippuccino", title: "The pepper harvest", make: pepperHarvest },
  bridge: { stop: "nexus", title: "The rope bridge", make: () => ropeBridge(9) },
};
