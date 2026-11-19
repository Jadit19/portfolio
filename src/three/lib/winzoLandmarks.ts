/**
 * WinZO's landmarks (the circuit on the Greater Noida plains), as picked on
 * the landmarks board (design/3d/winzo-landmarks-board.ts): one per stop,
 * plus the podium (the finale), the infield kart loop and the dhaba by the
 * expressway. And the circuit's dressing: pit garages, grandstands with a
 * crowd that does the wave, the pit wall, floodlight towers, kerbs, the
 * marshal autos.
 *
 * Each landmark stands in its own frame, its front (and forecourt) towards +z.
 */

import * as THREE from "three";
import { board, type Landmark, sign } from "./landmarks";
import { join, paint } from "./nature";
import { PASTEL as P } from "./palette";
import { at, ball, drum, gable, lathe, rbox } from "./toys";

type G = THREE.BufferGeometry;

export const WINZO_GROUND = P.lilac;
export const SAFFRON = "#ff9f43";
export const INDIA_GREEN = "#3fae6a";
export const KERB_RED = "#e2564b";
export const ASPHALT = "#8d86a3";
const GLASS = "#bfe3f0";
const STEEL = "#cfc8dd";
const AMBER = "#ffb84d";
const GOLD = "#e9b949";
const WHITE = "#ffffff";
const FLAG = {
  yellow: "#ffd23f",
  red: KERB_RED,
  blue: "#4f8de8",
  green: INDIA_GREEN,
  black: "#2b2433",
};

// ── small parts ───────────────────────────────────────────────────────────

/** A flag on a pole (chequered if `colour` is null). */
function flag(x: number, z: number, h: number, colour: string | null): G[] {
  const out: G[] = [at(drum(0.05, h, P.ink, 0.01, 8), x, 0, z)];
  if (colour) out.push(at(rbox(0.9, 0.6, 0.04, colour, 0.02), x + 0.47, h - 0.65, z));
  else
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++)
        out.push(
          at(
            rbox(0.22, 0.2, 0.04, (i + j) % 2 ? FLAG.black : WHITE, 0.005),
            x + 0.13 + i * 0.22,
            h - 0.65 + j * 0.2,
            z,
          ),
        );
  return out;
}

/** A short pile of tyres. */
export function tyres(x: number, z: number, n: number, colour: string = P.ink): G[] {
  const out: G[] = [];
  for (let k = 0; k < n; k++)
    out.push(
      at(drum(0.36, 0.24, k % 2 ? colour : mixHex(colour, WHITE, 0.12), 0.08, 12), x, k * 0.24, z),
    );
  return out;
}

/** A tyre wall along x: stacks in painted bands. */
export function tyreWall(x0: number, x1: number, z: number, rows = 2): G[] {
  const out: G[] = [];
  let k = 0;
  for (let x = x0; x <= x1; x += 0.74, k++)
    out.push(...tyres(x, z, rows, k % 6 < 3 ? P.ink : WHITE));
  return out;
}

/** A flat shape lying on the ground (a painted plaza, a lawn), just above it. */
function pad(pts: [number, number][], hex: string, y = 0.02): G {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const f = g.toNonIndexed();
  g.dispose();
  f.deleteAttribute("uv");
  return paint(f, hex);
}
const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

/** A rectangle with rounded corners (radius r), as an outline for flat paint. */
export function roundRect(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  r: number,
  seg = 6,
): [number, number][] {
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [x1 - r, z0 + r, -Math.PI / 2],
    [x1 - r, z1 - r, 0],
    [x0 + r, z1 - r, Math.PI / 2],
    [x0 + r, z0 + r, Math.PI],
  ];
  for (const [cx, cz, a0] of corners)
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  return pts;
}
/** A circle's outline (n points), for flat paint. */
export const circle = (R: number, n = 72): [number, number][] =>
  Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return [Math.cos(a) * R, Math.sin(a) * R];
  });

/** A ring (torus) of radius R and tube t, lying flat (axis y), sitting on y = 0. */
function ring(R: number, t: number, hex: string, seg = 10): G {
  const prof: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const a = -Math.PI / 2 + (i / seg) * Math.PI * 2;
    prof.push([R + Math.cos(a) * t, t + Math.sin(a) * t]);
  }
  return lathe(prof, hex, 24);
}

function mixHex(a: string, b: string, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

/** A CNG autorickshaw in green and yellow with a light bar: a marshal car (front +x). */
export function autoMarshal(): G {
  return join([
    at(rbox(2.2, 0.9, 1.25, INDIA_GREEN, 0.18), 0, 0.3, 0),
    at(rbox(1.5, 0.9, 1.3, P.marigold, 0.2), -0.25, 1.15, 0),
    at(rbox(0.5, 0.75, 1.2, GLASS, 0.12), 0.75, 1.15, 0),
    at(rbox(0.7, 0.14, 0.3, "#ff8a3d", 0.04), -0.2, 2.07, 0),
    at(drum(0.28, 0.2, P.ink, 0.06, 12), 0.9, 0.28, 0, 0, Math.PI / 2),
    at(drum(0.28, 0.2, P.ink, 0.06, 12), -0.7, 0.28, 0.6, 0, Math.PI / 2),
    at(drum(0.28, 0.2, P.ink, 0.06, 12), -0.7, 0.28, -0.6, 0, Math.PI / 2),
  ]);
}

/** A charpai (string cot). */
function charpai(x: number, z: number, yaw = 0): G[] {
  const parts = [
    at(rbox(2, 0.18, 0.9, "#c98f5a", 0.03), 0, 0.45, 0),
    at(rbox(1.8, 0.04, 0.8, "#f3e2c0", 0.01), 0, 0.64, 0),
    ...[-0.85, 0.85].flatMap((dx) =>
      [-0.38, 0.38].map((dz) => at(rbox(0.1, 0.45, 0.1, "#8a5a3a", 0.02), dx, 0, dz)),
    ),
  ];
  return parts.map((g) => at(g, x, 0, z, yaw));
}

// ── 1 · race control (the payments risk engine) ────────────────────────────

/** The flag fan's poles (a half-ring behind the tower) and their flags (null: chequered). */
const FAN: [number, number][] = Array.from({ length: 7 }, (_, i) => {
  const a = Math.PI * (0.08 + (i / 6) * 0.84);
  return [Math.cos(a) * 8.5, -Math.sin(a) * 6 - 0.6];
});
const FAN_COLS = [FLAG.yellow, FLAG.red, FLAG.blue, FLAG.green, WHITE, FLAG.black, null];
function fanFlag(x: number, z: number, colour: string | null): G[] {
  const H = 9.2;
  const out: G[] = [at(drum(0.09, H, P.ink, 0.02, 8), x, 0, z)];
  if (colour) out.push(at(rbox(2.4, 1.5, 0.06, colour, 0.03), x + 1.25, H - 1.6, z));
  else
    for (let u = 0; u < 5; u++)
      for (let v = 0; v < 3; v++)
        out.push(
          at(
            rbox(0.48, 0.5, 0.06, (u + v) % 2 ? FLAG.black : WHITE, 0.01),
            x + 0.3 + u * 0.48,
            H - 1.6 + v * 0.5,
            z,
          ),
        );
  return out;
}
function fanPlaza(): G[] {
  const out: G[] = [];
  for (let u = -5; u <= 5; u++)
    for (let v = 0; v < 4; v++)
      out.push(
        pad(
          rect(u * 1.6 - 0.8, -2.4 - (v + 1) * 1.6, u * 1.6 + 0.8, -2.4 - v * 1.6),
          (u + v) % 2 ? mixHex(WINZO_GROUND, P.ink, 0.45) : WHITE,
          0.006,
        ),
      );
  return out;
}

function raceControl(): Landmark {
  return {
    body: join([
      ...[-2.4, 2.4].flatMap((x) =>
        [-1.6, 1.6].map((z) => at(rbox(0.3, 3.2, 0.3, STEEL, 0.05), x, 0, z)),
      ),
      at(rbox(5.4, 0.4, 3.8, P.cream, 0.08), 0, 3.2, 0),
      at(rbox(5.2, 1.9, 3.6, GLASS, 0.12), 0, 3.6, 0),
      at(rbox(5.6, 0.35, 4, P.cream, 0.08), 0, 5.5, 0),
      at(rbox(1.3, 3.2, 1.3, P.stone, 0.08), 0, 0, -1),
      ...flag(-3.2, 2.6, 3.6, FLAG.yellow),
      ...flag(-1.8, 2.8, 3.6, FLAG.red),
      ...flag(-0.4, 2.9, 3.6, FLAG.blue),
      ...flag(1.0, 2.9, 3.6, FLAG.green),
      ...flag(2.4, 2.8, 3.6, null),
      // The flag fan: a half-ring of 9 m poles behind the tower flying the marshal flags big,
      // over a chequered plaza (seen from anywhere; the flags are what race control throws).
      ...FAN.flatMap(([x, z], i) => fanFlag(x, z, FAN_COLS[i] ?? null)),
    ]),
    flats: join(fanPlaza()),
    signs: [
      sign(board([{ text: "RACE CONTROL", size: 0.8 }], 4.6, 0.5, P.ink, P.cream), 0, 5.15, 1.82),
    ],
    lamps: [
      { x: 0, y: 4.5, z: 2.5, r: 6 },
      { x: 0, y: 6, z: -5, r: 7 },
    ],
    half: [9.5, 2.2],
    solids: [
      [0, -1, 0.9],
      [-2.4, 1.6, 0.3],
      [2.4, 1.6, 0.3],
      [-2.4, -1.6, 0.3],
      [2.4, -1.6, 0.3],
      ...FAN.map(([x, z]) => [x, z, 0.3] as [number, number, number]),
    ],
  };
}

// ── 2 · scrutineering (fraud ML) ───────────────────────────────────────────

/** The shamiana's poles: corners and the middle of the back (the front stays open). */
const SHAMIANA_POLES = (W: number, D: number): [number, number][] => [
  [-W, -D],
  [W, -D],
  [-W, D],
  [W, D],
  [0, -D],
];
/**
 * A shamiana (the Indian event tent) over the bay: a broad striped canopy in saffron, white and
 * red on gold poles, a scalloped valance round it and a peak in the middle. From the high
 * camera it's a big patterned roof, three times the shed's footprint.
 */
function shamiana(W: number, D: number): G[] {
  const parts: G[] = [];
  const n = Math.round((W * 2) / 1.2);
  const w = (W * 2) / n;
  for (let i = 0; i < n; i++)
    parts.push(
      at(
        rbox(w + 0.01, 0.18, D * 2, [SAFFRON, WHITE, KERB_RED, WHITE][i % 4] as string, 0.02),
        -W + (i + 0.5) * w,
        5.2,
        0,
      ),
    );
  parts.push(
    at(
      lathe(
        [
          [W * 0.55, 0],
          [0.2, 1.8],
          [0, 1.9],
        ],
        SAFFRON,
        4,
      ),
      0,
      5.35,
      0,
      Math.PI / 4,
    ),
  );
  for (const [x, z] of SHAMIANA_POLES(W, D))
    parts.push(at(drum(0.1, 5.3, GOLD, 0.02, 8), x * 0.97, 0, z * 0.97));
  for (let x = -W; x <= W + 1e-6; x += 0.8)
    for (const z of [-D, D])
      parts.push(
        at(ball(0.4, Math.round(x / 0.8) % 2 ? SAFFRON : KERB_RED, 1, 0.6, 0.3), x, 4.65, z),
      );
  for (let z = -D + 0.8; z < D; z += 0.8)
    for (const x of [-W, W])
      parts.push(
        at(ball(0.4, Math.round(z / 0.8) % 2 ? SAFFRON : KERB_RED, 0.3, 0.6, 1), x, 4.65, z),
      );
  return parts;
}

function scrutineering(): Landmark {
  return {
    body: join([
      at(rbox(8, 0.15, 6, P.stone, 0.04), 0, 0, 0),
      at(rbox(8, 3.4, 0.3, P.cream, 0.08), 0, 0, -2.85),
      ...[-3.8, 3.8].map((x) => at(rbox(0.3, 3.4, 0.3, STEEL, 0.05), x, 0, 2.6)),
      at(rbox(8.6, 0.3, 6.2, P.lavender, 0.08), 0, 3.4, -0.2, 0, -0.1),
      at(rbox(2.6, 0.5, 1, STEEL, 0.06), 0, 0.15, -0.6),
      ...[-1.2, 1.2].flatMap((x) => [
        at(drum(0.03, 1.2, P.ink, 0.01, 6), x, 2.2, -0.6),
        at(
          lathe(
            [
              [0.4, 0],
              [0.12, 0.35],
              [0, 0.35],
            ],
            AMBER,
            12,
          ),
          x,
          1.9,
          -0.6,
        ),
      ]),
      at(rbox(0.12, 2.4, 0.12, KERB_RED, 0.03), -2.4, 0, 0.4),
      at(rbox(0.12, 2.4, 0.12, KERB_RED, 0.03), -2.4, 0, -1.6),
      at(rbox(0.12, 0.12, 2.1, KERB_RED, 0.03), -2.4, 2.3, -0.6),
      at(rbox(1.6, 0.9, 0.8, P.clay, 0.05), 2.6, 0, -2),
      ...shamiana(7.2, 6.1),
    ]),
    signs: [
      sign(
        board(
          [
            { text: "SCRUTINEERING", size: 0.55 },
            { text: "PASSED ✓", size: 0.45, font: "800" },
          ],
          2.2,
          1.2,
          P.cream,
          P.ink,
        ),
        2.6,
        1.9,
        -2.68,
      ),
    ],
    lamps: [
      { x: 0, y: 2, z: 0.5, r: 6 },
      { x: 0, y: 4, z: 3, r: 8 },
    ],
    half: [7.2, 6.1],
    solids: [
      [-3, -2.85, 1],
      [0, -2.85, 1],
      [3, -2.85, 1],
      [-3.8, 2.6, 0.3],
      [3.8, 2.6, 0.3],
      ...SHAMIANA_POLES(7.2, 6.1).map(([x, z]) => [x, z, 0.25] as [number, number, number]),
    ],
  };
}

// ── 3 · the season-pass kiosk (ZoPass) ─────────────────────────────────────

function seasonPass(): Landmark {
  return {
    body: join([
      at(drum(1.6, 2.6, GLASS, 0.3, 24), 0, 0, -0.4),
      at(drum(1.9, 0.4, GOLD, 0.15, 24), 0, 2.6, -0.4),
      at(drum(1.2, 0.5, P.cream, 0.15, 24), 0, 3, -0.4),
      at(rbox(2, 0.04, 4, KERB_RED, 0.01), 0, 0, 1.4),
      ...[-3.2, -2.2, 2.2, 3.2].flatMap((x) => [
        at(rbox(0.3, 1, 1.2, STEEL, 0.06), x, 0, 0.6),
        at(rbox(0.6, 0.3, 0.05, "#bfe3a8", 0.02), x + (x < 0 ? 0.45 : -0.45), 0.65, 0.6),
      ]),
      at(rbox(0.5, 1.3, 0.3, P.ink, 0.05), 1.8, 0, 2),
      // The plaza: a gold-paved apron out to the road, the red carpet down it between gold
      // queue posts, and two tall feather banners either side.
      ...[2.4, 3.4].flatMap((z) =>
        [-1.9, 1.9].flatMap((x) => [
          at(drum(0.07, 0.9, GOLD, 0.02, 8), x, 0, z),
          at(ball(0.11, GOLD), x, 0.9, z),
        ]),
      ),
      ...[-5.2, 5.2].flatMap((x) => [
        at(drum(0.08, 6.4, P.ink, 0.02, 8), x, 0, 1.2),
        at(rbox(1.2, 4.4, 0.06, GOLD, 0.3), x + (x < 0 ? 0.65 : -0.65), 1.8, 1.2),
      ]),
    ]),
    flats: join([
      pad(rect(-6.1, -2.6, 6.1, 4.4), mixHex(GOLD, P.cream, 0.6), 0.004),
      pad(rect(-1.4, 2, 1.4, 4.4), KERB_RED, 0.008),
    ]),
    signs: [
      sign(
        board([{ text: "SEASON PASS", size: 0.8 }], 2.8, 0.55, P.ink, P.marigold),
        0,
        3.15,
        0.92,
      ),
      ...[-5.2, 5.2].map((x) =>
        sign(
          board([{ text: "ZOPASS", size: 0.42 }], 0.95, 3.6, GOLD, P.ink),
          x + (x < 0 ? 0.65 : -0.65),
          4,
          1.24,
        ),
      ),
    ],
    lamps: [
      { x: 0, y: 1, z: 1, r: 6 },
      { x: -5, y: 4, z: 1.2, r: 4 },
      { x: 5, y: 4, z: 1.2, r: 4 },
    ],
    half: [6.1, 2],
    solids: [
      [0, -0.4, 1.7],
      [-3.2, 0.6, 0.4],
      [3.2, 0.6, 0.4],
      [-5.2, 1.2, 0.3],
      [5.2, 1.2, 0.3],
    ],
  };
}

// ── 4 · the fan-market stalls (offer engine) ───────────────────────────────

function marketStall(roof: string, x: number): G[] {
  return [
    at(rbox(2.6, 1, 1.6, P.cream, 0.06), x, 0, 0),
    ...[-1.2, 1.2].flatMap((dx) =>
      [-0.7, 0.7].map((dz) => at(rbox(0.12, 2.6, 0.12, "#8a5a3a", 0.02), x + dx, 0, dz)),
    ),
    at(rbox(3, 0.2, 2.1, roof, 0.06), x, 2.6, 0.1, 0, 0.12),
  ];
}

function fanMarket(): Landmark {
  const jerseys = [SAFFRON, P.lavender, INDIA_GREEN, KERB_RED, P.aqua];
  return {
    body: join([
      ...marketStall(P.coral, -3.2),
      ...marketStall(P.aqua, 0),
      ...marketStall(P.coral, 3.2),
      ...jerseys.map((c, i) => at(rbox(0.42, 0.55, 0.04, c, 0.02), -4.2 + i * 0.5, 1.3, 0.85)),
      at(rbox(2.6, 0.05, 0.05, STEEL, 0.01), -3.2, 1.9, 0.85),
      ...[P.marigold, SAFFRON, INDIA_GREEN, KERB_RED].map((c, i) =>
        at(ball(0.18, c, 1, 0.6, 1), -0.9 + i * 0.6, 1, 0.3),
      ),
      ...Array.from({ length: 22 }, (_, i) =>
        at(
          rbox(0.22, 0.28, 0.02, [SAFFRON, WHITE, INDIA_GREEN, P.marigold][i % 4] as string, 0.005),
          -5 + i * 0.48,
          3.3 - Math.sin((i / 21) * Math.PI) * 0.35,
          1.3,
        ),
      ),
      // The SALE % cut-out standing on the roofs (on two posts).
      ...[-2, 2].map((x) => at(rbox(0.14, 3, 0.14, STEEL, 0.03), x, 2.7, -0.5)),
    ]),
    signs: [
      sign(
        board(
          [
            { text: "TODAY'S OFFERS", size: 0.4 },
            { text: "2 for ₹499 · −20%", size: 0.45, font: "800" },
          ],
          2.4,
          1,
          P.cream,
          P.ink,
        ),
        3.2,
        1.1,
        0.86,
      ),
      sign(board([{ text: "SALE %", size: 1.5 }], 5.6, 2.2, KERB_RED, GOLD), 0, 4.8, -0.4),
    ],
    lamps: [
      { x: -3, y: 2, z: 1, r: 5 },
      { x: 3, y: 2, z: 1, r: 5 },
      { x: 0, y: 5, z: 0.5, r: 5 },
    ],
    half: [5, 1.6],
    solids: [
      [-3.2, 0, 1.3],
      [0, 0, 1.3],
      [3.2, 0, 1.3],
    ],
  };
}

// ── 5 · the tyre warehouse (data platform) ─────────────────────────────────

function tyreWarehouse(): Landmark {
  return {
    body: join([
      at(rbox(10, 0.15, 6, P.stone, 0.04), 0, 0, 0),
      at(rbox(10, 0.4, 6.4, P.coral, 0.08), 0, 4, 0),
      ...[-4.8, 4.8].flatMap((x) =>
        [-2.8, 2.8].map((z) => at(rbox(0.25, 4, 0.25, STEEL, 0.04), x, 0, z)),
      ),
      ...[-3.4, -1.2, 1.2, 3.4].flatMap((x, b) => [
        at(rbox(2, 0.08, 1.2, STEEL, 0.02), x, 1.4, -2),
        at(rbox(2, 0.08, 1.2, STEEL, 0.02), x, 2.8, -2),
        ...[-0.55, 0.55].flatMap((dx) =>
          tyres(x + dx, -2, b === 3 ? 2 : 5, b === 1 ? P.aqua : P.ink),
        ),
      ]),
      at(rbox(1.6, 1.1, 1, P.marigold, 0.1), 1.5, 0.3, 1.2),
      at(rbox(0.1, 2.2, 0.8, P.ink, 0.02), 2.4, 0.3, 1.2),
      ...tyres(3, 1.2, 4),
      ...[0, 1, 2].flatMap((k) => tyres(6, -1 + k * 0.8, 3, mixHex(P.ink, WHITE, 0.3))),
    ]),
    signs: [
      sign(
        board([{ text: "DRY · WET · USED · SCRAP", size: 0.8 }], 7.6, 0.45, P.ink, P.cream),
        0,
        3.55,
        2.95,
      ),
    ],
    lamps: [{ x: 0, y: 3, z: 1, r: 7 }],
    half: [6.4, 3.2],
    solids: [
      [-3, -2, 1.3],
      [0, -2, 1.3],
      [3, -2, 1.3],
      [1.8, 1.2, 1],
      [6, 0, 1],
    ],
  };
}

// ── 6 · the toll plaza (international payments) ────────────────────────────

/** The toll plaza's lanes (local x of each lane's middle) and where its booms pivot. */
export const TOLL_LANES = [-4.5, -1.5, 1.5, 4.5];

function tollPlaza(): Landmark {
  // Islands between the lanes (and at each side), a booth on each, the canopy over all.
  const isles = [-6, -3, 0, 3, 6];
  const parts: G[] = [at(rbox(14.5, 0.35, 5.5, P.cream, 0.1), 0, 4.6, 0)];
  for (const [i, x] of isles.entries()) {
    parts.push(
      at(rbox(0.9, 0.3, 5, P.stone, 0.06), x, 0, 0),
      at(rbox(0.5, 4.6, 0.5, STEEL, 0.06), x, 0, -1.8),
    );
    parts.push(
      at(rbox(0.8, 2, 1.4, P.cream, 0.1), x, 0.3, 0.4),
      at(rbox(0.05, 0.8, 0.9, GLASS, 0.03), x + (i < 2 ? 0.42 : -0.42), 1.2, 0.4),
    );
  }
  return {
    body: join(parts),
    signs: [
      sign(
        board([{ text: "टोल प्लाज़ा · TOLL PLAZA", size: 0.8 }], 9, 0.8, INDIA_GREEN, WHITE),
        0,
        5.4,
        2.8,
      ),
      sign(board([{ text: "FASTag", size: 0.8 }], 1.6, 0.45, P.cream, INDIA_GREEN), -4.5, 4.3, 2.8),
      sign(board([{ text: "FASTag", size: 0.8 }], 1.6, 0.45, P.cream, INDIA_GREEN), 4.5, 4.3, 2.8),
    ],
    lamps: TOLL_LANES.map((x) => ({ x, y: 1, z: 1.5, r: 5 })),
    half: [7.3, 2.8],
    solids: isles.flatMap((x) => [
      [x, -1.6, 0.5] as [number, number, number],
      [x, 0.4, 0.6] as [number, number, number],
      [x, 2, 0.5] as [number, number, number],
    ]),
  };
}

/**
 * One boom barrier (a red and white arm on its pivot post), to animate: it
 * lifts as a bike rides through, with a green APPROVED flash. Pivot at the
 * origin; the arm runs along −x.
 */
export function tollBoom(): { arm: THREE.Mesh; flash: THREE.Mesh } {
  const bands: G[] = [];
  for (let k = 0; k < 6; k++)
    bands.push(at(rbox(0.5, 0.12, 0.12, k % 2 ? KERB_RED : WHITE, 0.04), -0.25 - k * 0.5, 0, 0));
  const arm = new THREE.Mesh(join(bands));
  arm.position.y = 1.05;
  const flash = board([{ text: "APPROVED", size: 0.8 }], 1.6, 0.4, INDIA_GREEN, WHITE);
  flash.position.set(-1.5, 2.1, 0.2);
  flash.visible = false;
  return { arm, flash };
}

// ── 7 · the start gantry (guest + SSO login) ───────────────────────────────

/** The start-light panel's lamps (gantry-local): 5 columns, two red lamps each, and a green row. */
const LIGHT_COLS = [-2, -1, 0, 1, 2].map((k) => k * 1.05);
const LIGHT_ROWS = { red: [5.0, 4.45], green: 3.9 };
const LAMP_R = 0.2;

/** A lamp face on both sides of the panel (bulging out, so it reads from above too). */
function lampPair(x: number, y: number, hex: string, r = LAMP_R): G[] {
  return [-1, 1].map((side) => at(ball(r, hex, 1, 1, 0.6), x, y - r, side * (0.3 + r * 0.25)));
}

function startGantry(): Landmark {
  return {
    body: join([
      at(rbox(0.5, 6.6, 0.5, P.cream, 0.08), -5.6, 0, 0),
      at(rbox(0.5, 6.6, 0.5, P.cream, 0.08), 5.6, 0, 0),
      at(rbox(11.8, 0.9, 0.7, P.cream, 0.1), 0, 6.2, 0),
      // The F1-style start-light panel hanging under the beam: dark housing, unlit lamps.
      at(rbox(0.3, 0.6, 0.3, P.ink, 0.04), -1.6, 5.6, 0),
      at(rbox(0.3, 0.6, 0.3, P.ink, 0.04), 1.6, 5.6, 0),
      at(rbox(5.7, 1.95, 0.6, "#2b2433", 0.12), 0, 3.65, 0),
      ...LIGHT_COLS.flatMap((x) => [
        ...LIGHT_ROWS.red.flatMap((y) => lampPair(x, y, "#4a2228")),
        ...lampPair(x, LIGHT_ROWS.green, "#22382c"),
      ]),
      // Marigold garlands wound round the two posts (not on the lights).
      ...[-5.6, 5.6].flatMap((px) =>
        Array.from({ length: 9 }, (_, k) =>
          at(
            ball(0.17, k % 2 ? P.marigold : SAFFRON),
            px + Math.cos(k * 1.4) * 0.34,
            0.8 + k * 0.6,
            Math.sin(k * 1.4) * 0.34,
          ),
        ),
      ),
    ]),
    signs: [],
    lamps: [{ x: 0, y: 4.5, z: 0.6, r: 4 }],
    half: [6, 0.6],
    solids: [
      [-5.6, 0, 0.4],
      [5.6, 0, 0.4],
    ],
  };
}

/**
 * The start lights, lit (gantry-local, place it with the gantry): five red columns that come on
 * one by one and go out together, then the green row ("lights out"). `Life` runs the sequence
 * (userData.lights) as a bike rolls up to the grid.
 */
export function startLights(): { obj: THREE.Group; reds: THREE.Mesh[]; green: THREE.Mesh } {
  const glow = (g: G) =>
    new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  const obj = new THREE.Group();
  const reds = LIGHT_COLS.map((x) =>
    glow(join(LIGHT_ROWS.red.flatMap((y) => lampPair(x, y, "#ff2a1f", LAMP_R + 0.02)))),
  );
  const green = glow(
    join(LIGHT_COLS.flatMap((x) => lampPair(x, LIGHT_ROWS.green, "#3dff7a", LAMP_R + 0.02))),
  );
  for (const m of [...reds, green]) {
    m.visible = false;
    obj.add(m);
  }
  return { obj, reds, green };
}

// ── 8 · the hairpin's marshal post (refunds) ───────────────────────────────

function marshalPost(): Landmark {
  // A two-storey marshal tower (glass cab, flags on the roof, a big board facing the track),
  // tall enough to spot from the top of the hairpin, with its tyre wall and CNG-auto car.
  const tx = 6.5;
  return {
    body: join([
      ...tyreWall(-5, 4, -1.8),
      at(rbox(3.2, 3.4, 3.2, P.cream, 0.1), tx, 0, 0),
      at(rbox(3.6, 2.3, 3.6, GLASS, 0.12), tx, 3.4, 0),
      at(rbox(3.7, 0.25, 0.08, P.ink, 0.02), tx, 4.6, 1.82),
      at(rbox(4.6, 0.4, 4.6, P.coral, 0.08), tx, 5.7, 0),
      // A ladder up the side.
      at(rbox(0.08, 3.4, 0.08, P.ink, 0.02), tx + 1.75, 0, 0.9),
      at(rbox(0.08, 3.4, 0.08, P.ink, 0.02), tx + 1.75, 0, 0.3),
      ...Array.from({ length: 6 }, (_, k) =>
        at(rbox(0.08, 0.06, 0.6, P.ink, 0.01), tx + 1.75, 0.4 + k * 0.55, 0.6),
      ),
      // The flags a marshal shows, on tall poles from the roof.
      ...flag(tx - 1.6, 1.6, 9.2, FLAG.yellow),
      ...flag(tx + 1.6, 1.6, 9.2, FLAG.blue),
      ...flag(tx - 1.6, -1.6, 9.2, null),
      // A rotating-beacon dome on the roof.
      at(ball(0.4, AMBER), tx + 1.2, 6.1, -1.2),
      at(autoMarshal(), -6.6, 0, 0.6, 0.4),
    ]),
    signs: [
      sign(board([{ text: "MARSHAL POST 8", size: 1.2 }], 4.4, 0.8, KERB_RED, WHITE), tx, 6.6, 0.3),
      sign(board([{ text: "POST 8", size: 0.9 }], 2.6, 0.6, P.ink, P.cream), tx, 2.2, 1.62),
    ],
    lamps: [{ x: tx, y: 4, z: 2, r: 7 }],
    half: [8, 2.4],
    solids: [
      [0, -1.8, 0.8],
      [-2.5, -1.8, 0.8],
      [2.5, -1.8, 0.8],
      [-4.5, -1.8, 0.8],
      [tx, 0, 1.9],
      [-6.6, 0.6, 1.1],
    ],
  };
}

// ── the podium (the finale) ────────────────────────────────────────────────

function podium(): Landmark {
  return {
    body: join([
      at(rbox(10, 0.4, 6, P.stone, 0.08), 0, 0, 0),
      at(rbox(2, 1.3, 1.6, P.cream, 0.08), -2, 0.4, 0),
      at(rbox(2, 2, 1.6, P.marigold, 0.08), 0, 0.4, 0),
      at(rbox(2, 0.9, 1.6, P.cream, 0.08), 2, 0.4, 0),
      ...[
        [-2, 1.7],
        [0, 2.4],
        [2, 1.3],
      ].map(([x, y]) =>
        at(
          lathe(
            [
              [0.18, 0],
              [0.08, 0.3],
              [0.28, 0.75],
              [0, 0.75],
            ],
            "#d4af37",
            14,
          ),
          x as number,
          y as number,
          0,
        ),
      ),
      at(rbox(0.5, 5, 0.5, P.cream, 0.1), -4.5, 0.4, -2),
      at(rbox(0.5, 5, 0.5, P.cream, 0.1), 4.5, 0.4, -2),
      at(rbox(9.5, 0.6, 0.5, P.cream, 0.1), 0, 5.2, -2),
      at(rbox(3, 0.6, 0.05, SAFFRON, 0.01), 0, 3.8, -2.3),
      at(rbox(3, 0.6, 0.05, WHITE, 0.01), 0, 3.2, -2.3),
      at(rbox(3, 0.6, 0.05, INDIA_GREEN, 0.01), 0, 2.6, -2.3),
      ...Array.from({ length: 18 }, (_, k) =>
        at(
          ball(0.15, k % 2 ? P.marigold : SAFFRON),
          -4.3 + (k / 17) * 8.6,
          5.1 - Math.sin((k / 17) * Math.PI) * 0.9,
          -1.7,
        ),
      ),
      ...Array.from({ length: 40 }, (_, k) =>
        at(
          rbox(0.12, 0.02, 0.08, [SAFFRON, WHITE, INDIA_GREEN, P.marigold][k % 4] as string, 0.005),
          Math.sin(k * 7.1) * 4,
          0.42,
          Math.cos(k * 3.3) * 2.5,
          k,
        ),
      ),
    ]),
    signs: [],
    lamps: [{ x: 0, y: 2, z: 1.5, r: 8 }],
    half: [5, 3],
    solids: [
      [-2, 0, 1.2],
      [0, 0, 1.2],
      [2, 0, 1.2],
      [-4.5, -2, 0.4],
      [4.5, -2, 0.4],
    ],
  };
}

// ── the infield kart loop ──────────────────────────────────────────────────

/** The kart loop's centreline (local), closed. */
export const KART_LOOP: [number, number][] = Array.from({ length: 64 }, (_, k) => {
  const a = (k / 64) * Math.PI * 2;
  return [Math.cos(a) * 9 + Math.cos(a * 2) * 2, Math.sin(a) * 5.5 + Math.sin(a * 3) * 1.2];
});

function kartLoop(): Landmark {
  const parts: G[] = [];
  const solids: [number, number, number][] = [];
  for (let k = 0; k < 64; k += 4) {
    const [x, z] = KART_LOOP[k] as [number, number];
    const l = Math.hypot(x, z) || 1;
    const ox = x + (x / l) * 2.6;
    const oz = z + (z / l) * 2.6;
    parts.push(...tyres(ox, oz, 2, k % 8 ? P.ink : WHITE));
    solids.push([ox, oz, 0.45]);
  }
  parts.push(
    at(rbox(3, 2, 2, P.cream, 0.08), 0, 0, 0),
    at(rbox(3.4, 0.3, 2.4, P.lavender, 0.06), 0, 2, 0),
  );
  solids.push([0, 0, 1.6]);
  for (const [x, z, c] of [
    [5, -3.6, P.lavender],
    [-6.5, 2.6, P.marigold],
  ] as const) {
    parts.push(
      at(rbox(1.4, 0.3, 0.9, c, 0.1), x, 0.12, z),
      at(ball(0.18, P.ink), x - 0.2, 0.55, z),
    );
    for (const dx of [-0.5, 0.5])
      for (const dz of [-0.45, 0.45])
        parts.push(at(drum(0.15, 0.12, P.ink, 0.04, 10), x + dx, 0.15, z + dz, 0, Math.PI / 2));
  }
  return {
    body: join(parts),
    signs: [
      sign(board([{ text: "KARTING", size: 0.8 }], 2.6, 0.5, P.ink, P.marigold), 0, 1.4, 1.02),
    ],
    lamps: [{ x: 0, y: 2, z: 0, r: 12 }],
    half: [12, 8.5],
    solids,
  };
}

// ── the dhaba under the neem ───────────────────────────────────────────────

function dhaba(): Landmark {
  return {
    body: join([
      at(rbox(4.5, 2.4, 3, P.cream, 0.1), -2, 0, -1.6),
      at(gable(4.8, 3.4, 1.2, P.coral, 0.2), -2, 2.4, -1.6),
      ...charpai(1, 0.8),
      ...charpai(3.4, 1.2, 0.3),
      at(
        lathe(
          [
            [0.6, 0],
            [0.65, 0.5],
            [0.4, 1],
            [0, 1],
          ],
          "#c06a4a",
          14,
        ),
        -4.8,
        0,
        0.6,
      ),
      at(rbox(0.8, 0.5, 0.8, "#6b6075", 0.08), -0.6, 0, 0.6),
      at(
        lathe(
          [
            [0.22, 0],
            [0.24, 0.25],
            [0.1, 0.38],
            [0, 0.38],
          ],
          STEEL,
          12,
        ),
        -0.6,
        0.5,
        0.6,
      ),
    ]),
    signs: [
      sign(board([{ text: "ढाबा · DHABA", size: 0.8 }], 2.6, 0.6, KERB_RED, WHITE), -2, 2.1, 0.12),
    ],
    lamps: [
      { x: -4.8, y: 0.8, z: 0.6, r: 5 },
      { x: 1, y: 1.5, z: 1, r: 6 },
    ],
    half: [5.6, 3.2],
    solids: [
      [-2, -1.6, 2.2],
      [-4.8, 0.6, 0.7],
      [1, 0.8, 1],
      [3.4, 1.2, 1],
    ],
  };
}

export type WinzoLandmark =
  | "flags"
  | "scrut"
  | "pass"
  | "merch"
  | "tyres"
  | "toll"
  | "gantry"
  | "hairpin"
  | "indiagate"
  | "podium"
  | "kart"
  | "dhaba";

/** WinZO's landmarks, by key: the stops' (with their work), and the extras. */
export const WINZO_LANDMARKS: Record<WinzoLandmark, { title: string; make: () => Landmark }> = {
  flags: { title: "Race control", make: raceControl },
  scrut: { title: "The scrutineering bay", make: scrutineering },
  pass: { title: "The season-pass kiosk", make: seasonPass },
  merch: { title: "The fan market", make: fanMarket },
  tyres: { title: "The tyre warehouse", make: tyreWarehouse },
  toll: { title: "The toll plaza", make: tollPlaza },
  gantry: { title: "The start gantry", make: startGantry },
  hairpin: { title: "The hairpin's marshal post", make: marshalPost },
  podium: { title: "The podium", make: podium },
  kart: { title: "The kart loop", make: kartLoop },
  dhaba: { title: "The dhaba", make: dhaba },
  indiagate: { title: "India Gate", make: indiaGate },
};

// ── over the road: the tyre arch and the bazaar bunting ────────────────────

/**
 * An arch of tyres over a road (it runs along local x; the arch spans local z, its feet at
 * ±`span`/2): upright tyres facing along the road, black and white, red at the crown.
 */
export function tyreArch(span = 9.2): G {
  const parts: G[] = [];
  const n = 13;
  const R = span / 2;
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1)) * Math.PI;
    const c = i >= 5 && i <= 7 ? KERB_RED : i % 2 ? WHITE : P.ink;
    parts.push(
      at(
        ring(0.75, 0.32, c),
        -0.32,
        Math.sin(a) * (R + 0.2) + 0.15,
        -Math.cos(a) * R,
        Math.PI / 2,
        Math.PI / 2,
      ),
    );
  }
  // Feet: a short stack each side.
  for (const z of [-R, R]) parts.push(...tyres(0, z, 2));
  return join(parts);
}

/**
 * Bazaar bunting over a road `len` long (along local x): bamboo poles every `step` along the
 * far side (local −z, `w` off the centreline) and only at the two ends on the near side (+z,
 * where the stop's forecourt is, so nothing stands in the way in), strings of triangle flags
 * fanning across the road from each near pole to the far ones.
 */
export function bunting(len: number, w: number, step = 5): { geo: G; poles: [number, number][] } {
  const parts: G[] = [];
  const far: [number, number][] = [];
  for (let x = -len / 2; x <= len / 2 + 1e-6; x += step) far.push([x, -w]);
  const near: [number, number][] = [
    [-len / 2, w],
    [len / 2, w],
  ];
  const poles = [...far, ...near];
  for (const [x, z] of poles) parts.push(at(drum(0.08, 5.4, "#c9a46a", 0.02, 8), x, 0, z));
  const cols = [KERB_RED, GOLD, P.aqua, P.rose, SAFFRON, P.mint];
  for (const a of near)
    for (const b of far) {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(4, Math.round(l / 0.8));
      const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2;
      for (let k = 1; k < n; k++) {
        const t = k / n;
        parts.push(
          at(
            rbox(0.36, 0.36, 0.03, cols[k % cols.length] as string, 0.01),
            a[0] + (b[0] - a[0]) * t,
            5.1 - Math.sin(t * Math.PI) * 0.7,
            a[1] + (b[1] - a[1]) * t,
            yaw,
            0,
            Math.PI / 4,
          ),
        );
      }
    }
  return { geo: join(parts), poles };
}

// ── India Gate (a monument, not a stop) ────────────────────────────────────

const SAND = "#e6cfa6";
const SAND_D = "#d4b585";
const RED_SAND = "#c98466";
const LAWN = "#b9dfa6";
const POOL = "#8fd3e0";

/** India Gate itself (~18 m): red-sandstone plinth, the great arch, stepped attic, shallow dome. */
function gateArch(): G[] {
  const W = 12;
  const H = 12.5;
  const D = 3.4;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0);
  shape.lineTo(W / 2, 0);
  shape.lineTo(W / 2, H);
  shape.lineTo(-W / 2, H);
  shape.lineTo(-W / 2, 0);
  const hole = new THREE.Path();
  hole.moveTo(-2.6, 0);
  hole.lineTo(-2.6, 6.2);
  hole.absarc(0, 6.2, 2.6, Math.PI, 0, true);
  hole.lineTo(2.6, 0);
  hole.lineTo(-2.6, 0);
  shape.holes.push(hole);
  const ex = new THREE.ExtrudeGeometry(shape, {
    depth: D,
    bevelEnabled: true,
    bevelSize: 0.08,
    bevelThickness: 0.08,
    bevelSegments: 1,
    curveSegments: 12,
  });
  ex.translate(0, 0, -D / 2);
  const body = ex.toNonIndexed();
  ex.dispose();
  body.deleteAttribute("uv");
  body.computeVertexNormals();
  return [
    at(rbox(W + 3, 0.7, D + 4, RED_SAND, 0.08), 0, 0, 0),
    at(rbox(W + 1.4, 0.5, D + 2.4, SAND_D, 0.06), 0, 0.7, 0),
    at(paint(body, SAND), 0, 1.2, 0),
    at(rbox(W + 0.8, 0.5, D + 0.8, SAND_D, 0.08), 0, 1.2 + H * 0.62, 0),
    at(rbox(W + 0.9, 0.6, D + 0.9, SAND_D, 0.08), 0, 1.2 + H, 0),
    at(rbox(W - 1.2, 1.8, D - 0.4, SAND, 0.08), 0, 1.8 + H, 0),
    at(rbox(W - 3.2, 1.1, D - 0.8, SAND_D, 0.08), 0, 3.6 + H, 0),
    at(
      lathe(
        [
          [1.9, 0],
          [1.8, 0.5],
          [1.2, 1.0],
          [0.3, 1.2],
          [0, 1.2],
        ],
        SAND,
        24,
      ),
      0,
      4.7 + H,
      0,
    ),
    // The flame bowl in front.
    at(drum(0.7, 0.5, RED_SAND, 0.05, 16), 0, 0, D / 2 + 3.2),
  ];
}
/** The canopy (chhatri) behind the gate on the axis: four pillars and a dome. */
function gateCanopy(): G[] {
  return [
    at(rbox(5.4, 0.5, 5.4, RED_SAND, 0.06), 0, 0, 0),
    ...[-1.9, 1.9].flatMap((x) =>
      [-1.9, 1.9].map((z) => at(rbox(0.6, 4.2, 0.6, SAND, 0.06), x, 0.5, z)),
    ),
    at(rbox(5, 0.6, 5, SAND_D, 0.08), 0, 4.7, 0),
    at(
      lathe(
        [
          [2.3, 0],
          [2.2, 0.7],
          [1.4, 1.6],
          [0.4, 2.1],
          [0, 2.3],
        ],
        SAND,
        4,
      ),
      0,
      5.3,
      0,
      Math.PI / 4,
    ),
    at(
      lathe(
        [
          [0.25, 0],
          [0.06, 0.9],
          [0, 0.95],
        ],
        GOLD,
        8,
      ),
      0,
      7.5,
      0,
    ),
  ];
}
/**
 * India Gate in the middle of its round lawn, which fills the roundabout (radius `r`) right up
 * to the road: the gate facing +z (down the avenue), the canopy behind on the axis, a path on
 * the axis and four pools with fountains. Every edge is smooth (a circle, rounded corners).
 */
function indiaGate(r = 17): Landmark {
  // Out to just under the road's inner edge (the road, half 2.6, paints over the rim).
  const lawnR = r - 2.4;
  const pathEnd = Math.sqrt(lawnR * lawnR - 1.6 * 1.6);
  const pools: [number, number][] = [
    [-7.5, 5],
    [7.5, 5],
    [-7.5, -5],
    [7.5, -5],
  ];
  return {
    // (Flat paint sits under the paper-shadow floor at 0.012, so shadows fall on it.)
    flats: join([
      pad(circle(lawnR), LAWN, 0.004),
      pad(rect(-1.6, -pathEnd, 1.6, pathEnd), mixHex(P.cream, "#f4dcb8", 0.5), 0.007),
      ...pools.map(([x, z]) =>
        pad(roundRect(x - 2.2, z - 1.4, x + 2.2, z + 1.4, 0.7), POOL, 0.009),
      ),
    ]),
    body: join([
      ...pools.map(([x, z]) => at(drum(0.25, 0.6, P.cream, 0.05, 10), x, 0, z)),
      ...gateArch(),
      ...gateCanopy().map((g) => at(g, 0, 0, -9.5)),
    ]),
    signs: [],
    lamps: [
      { x: 0, y: 6, z: 4, r: 10 },
      { x: 0, y: 3, z: -9.5, r: 5 },
    ],
    half: [lawnR, lawnR],
    solids: [
      [-4.5, 0, 2],
      [4.5, 0, 2],
      [0, -9.5, 2.9],
    ],
  };
}

// ── the circuit's dressing ─────────────────────────────────────────────────

/** A row of pit garages (shutters and team colours on the front, +z). */
export function garages(n: number): G {
  const parts: G[] = [];
  const team = [P.lavender, P.coral, P.aqua, P.marigold, P.rose, P.mint];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 4.2;
    parts.push(at(rbox(4, 3.2, 6, P.cream, 0.08), x, 0, 0));
    parts.push(at(rbox(3.9, 0.5, 0.12, team[i % team.length] as string, 0.03), x, 2.6, 3.02));
    const up = i % 3 !== 1;
    parts.push(
      at(
        rbox(3.2, up ? 0.7 : 2.3, 0.08, up ? "#6c6385" : "#d9d3e6", 0.02),
        x,
        up ? 1.8 : 0.05,
        3.0,
      ),
    );
  }
  parts.push(at(rbox(n * 4.2 + 0.4, 0.3, 6.4, P.stone, 0.06), 0, 3.2, 0));
  return join(parts);
}

/**
 * A stepped grandstand facing +z (tiers rising away), a canopy on posts; its
 * crowd (instanced, in tricolour and pastels) does the wave (userData.wave).
 */
export function grandstand(
  len: number,
  tiers: number,
  material: THREE.Material,
): { stand: G; crowd: THREE.Object3D } {
  const parts: G[] = [];
  for (let k = 0; k < tiers; k++)
    parts.push(
      at(rbox(len, 0.55 + k * 0.55, 1.2, k % 2 ? P.stone : P.cream, 0.04), 0, 0, -k * 1.2),
    );
  parts.push(
    at(
      rbox(len + 0.4, 0.25, tiers * 1.2 + 1, P.coral, 0.06),
      0,
      tiers * 0.55 + 2.4,
      -(tiers - 1) * 0.6,
    ),
  );
  for (const x of [-len / 2 + 0.3, 0, len / 2 - 0.3])
    parts.push(at(rbox(0.2, tiers * 0.55 + 2.4, 0.2, P.ink, 0.04), x, 0, -(tiers - 1) * 1.2 - 0.4));
  // The crowd: one instanced mesh per colour, positions shared with the wave.
  const cols = [SAFFRON, WHITE, INDIA_GREEN, P.marigold, P.rose, P.aqua];
  let s = 7;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const byCol: number[][] = cols.map(() => []);
  for (let k = 0; k < tiers; k++)
    for (let x = -len / 2 + 0.5; x < len / 2 - 0.3; x += 0.66) {
      if (r() < 0.18) continue;
      (byCol[Math.floor(r() * cols.length)] as number[]).push(
        x + (r() - 0.5) * 0.15,
        0.55 + k * 0.55,
        -k * 1.2 + 0.1,
      );
    }
  // Each fan: a shirt-coloured torso, a head (skin tones vary), and arms that go up with the wave.
  const crowd = new THREE.Group();
  const torso = rbox(0.44, 0.5, 0.3, WHITE, 0.12);
  const head = ball(0.15, WHITE, 1, 1.1, 1);
  const arms = join([
    at(rbox(0.08, 0.4, 0.08, WHITE, 0.03), -0.2, 0, 0),
    at(rbox(0.08, 0.4, 0.08, WHITE, 0.03), 0.2, 0, 0),
  ]);
  const SKINS = ["#c68a62", "#a86f4c", "#8a5a3c", "#d9a07a", "#b37a54"];
  cols.forEach((c, i) => {
    const pts = byCol[i] as number[];
    const n = pts.length / 3;
    if (!n) return;
    const m4 = new THREE.Matrix4();
    const shirt = new THREE.Color(c);
    const mesh = (g: G, dy: number, colour: (j: number) => THREE.Color) => {
      const m = new THREE.InstancedMesh(g, material, n);
      for (let j = 0; j < n; j++) {
        m.setMatrixAt(
          j,
          m4.makeTranslation(pts[j * 3] ?? 0, (pts[j * 3 + 1] ?? 0) + dy, pts[j * 3 + 2] ?? 0),
        );
        m.setColorAt(j, colour(j));
      }
      m.computeBoundingSphere();
      return m;
    };
    const body = mesh(torso, 0, () => shirt);
    const face = mesh(head, 0.48, (j) => new THREE.Color(SKINS[(j * 7 + i) % SKINS.length]));
    const up = mesh(arms, 0.4, () => shirt);
    const part = new THREE.Group();
    part.add(body, face, up);
    part.userData.wave = {
      pts,
      len,
      parts: [
        { mesh: body, dy: 0 },
        { mesh: face, dy: 0.48 },
        { mesh: up, dy: 0.4, arm: true },
      ],
    };
    crowd.add(part);
  });
  return { stand: join(parts), crowd };
}

/** A floodlight tower: a slim tapered mast, a head of lamps tilted at the track (+z). */
export function floodlight(): G {
  return join([
    at(
      lathe(
        [
          [0.32, 0],
          [0.18, 14],
          [0, 14],
        ],
        STEEL,
        10,
      ),
      0,
      0,
      0,
    ),
    at(rbox(2.6, 1.3, 0.4, STEEL, 0.06), 0, 14, 0, 0, -0.35),
    ...[-0.8, 0, 0.8].map((x) =>
      at(rbox(0.6, 0.45, 0.1, "#fff6d6", 0.04), x, 14.6, 0.25, 0, -0.35),
    ),
  ]);
}

/** A brick-kiln chimney on its kiln: the plains' landmark. */
export function kiln(): G {
  return join([
    at(rbox(8, 1.4, 6, "#c98a6a", 0.2), 0, 0, 0),
    at(
      lathe(
        [
          [0.9, 0],
          [0.55, 11],
          [0.62, 11.3],
          [0, 11.3],
        ],
        "#b5634f",
        12,
      ),
      0,
      1.4,
      0,
    ),
  ]);
}
