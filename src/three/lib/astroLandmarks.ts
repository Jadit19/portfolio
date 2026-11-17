/**
 * AstroClub's stop landmarks (Inter IIT Tech Meet 2022 at the observatory dome,
 * the jux package at the solar observatory; see the stops for the rest) (Ladakh / Hanle), in the flat kit's language,
 * facing +z (the road), standing on y = 0: the solar observatory, the
 * observatory dome, the meteor deck, the rocket pad, the planetarium tent,
 * the star-party camp, the hilltop monastery, the lake with yaks and the dak
 * bungalow. And each stop's star, drawn as a glowing constellation that
 * hangs above its landmark at night while you're stopped there.
 */

import * as THREE from "three";
import { flatShape } from "../flat/kit";
import { chorten, flagString, yak } from "./ladakh";
import { board, type Landmark, sign } from "./landmarks";
import { join, paint } from "./nature";
import { PASTEL as P } from "./palette";
import { at, ball, drum, type G, gable, lathe, rbox } from "./toys";

const WHITE = "#f6f1e8";
const MAROON = "#9c4f45";
const GOLD = "#e8b84a";
const STEEL = "#c7cdd6";
const WOOD = "#b98a62";
const TURQUOISE = "#54c3c9";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A dish (a shallow bowl) on its back, `r` across, facing up (tilt it after). */
function dish(r: number, hex: string): G {
  return lathe(
    [
      [0, 0],
      [r * 0.15, 0.02],
      [r * 0.6, r * 0.12],
      [r, r * 0.34],
      [r * 0.96, r * 0.36],
      [0, r * 0.06],
    ],
    hex,
    24,
  );
}

/** A telescope on a tripod, about 1.6 m tall, pointing up and along +x. */
function telescope(tone = "#f3efe6"): G {
  const tube = drum(0.13, 1.3, tone, 0.04, 12);
  tube.translate(0, -0.4, 0);
  tube.rotateZ(-0.9);
  const legs: G[] = [-1, 0, 1].map((k) => {
    const leg = rbox(0.05, 1.15, 0.05, "#3a2f4d", 0.02);
    leg.rotateX(0.32 * (k === 0 ? 1 : 0));
    leg.rotateZ(0.3 * k);
    return leg;
  });
  return join([...legs, at(tube, 0, 1.1, 0)]);
}

// ── the solar observatory (jux) ─────────────────────────────────────────────

function solarObservatory(): Landmark {
  // The dish looks up and to the south, after the sun.
  const d = dish(1.3, STEEL);
  d.rotateX(0.55);
  d.rotateY(0.6);
  return {
    body: join([
      at(rbox(4.0, 2.0, 2.6, WHITE, 0.08), -0.6, 0, -0.6),
      at(rbox(4.2, 0.2, 2.8, MAROON, 0.05), -0.6, 2.0, -0.6),
      at(rbox(0.8, 1.5, 0.06, "#3a2f4d", 0.03), -1.4, 0, 0.72),
      at(rbox(1.1, 0.6, 0.06, "#9fc6d6", 0.03), 0.4, 1.0, 0.72),
      // The sun-tracking dish on its mount.
      at(drum(0.18, 1.5, STEEL, 0.05, 12), 2.3, 0, 0.2),
      at(drum(0.3, 0.25, "#3a2f4d", 0.05, 12), 2.3, 1.45, 0.2),
      at(d, 2.3, 1.62, 0.2),
      // Solar panels on the roof.
      ...[-1.6, -0.2].map((x) => {
        const p = rbox(1.2, 0.06, 1.8, "#3f5f86", 0.02);
        p.rotateX(-0.35);
        return at(p, x, 2.45, -0.6);
      }),
    ]),
    signs: [
      sign(board([{ text: "SOLAR LAB", size: 1 }], 1.6, 0.36, P.marigold, P.ink), -0.6, 1.75, 0.74),
    ],
    lamps: [{ x: -0.6, y: 1.2, z: 1.2, r: 3.2 }],
    half: [3.2, 1.8],
    solids: [
      [-1.7, -0.6, 1.3],
      [0.5, -0.6, 1.3],
      [2.3, 0.2, 0.3],
    ],
  };
}

// ── the observatory dome (Inter IIT Tech Meet 2022) ──────────────────────────────────────────────

/** A loose geometry made solid and painted, ready to join with the kit's parts. */
function solid(g: G, hex: string): G {
  const f = g.index ? g.toNonIndexed() : g;
  f.deleteAttribute("uv");
  f.computeVertexNormals();
  return paint(f, hex);
}

/** An arc band, `r0`..`r1` across, from angle `a0` to `a1` in the x–y plane, `w` thick in z. */
function arcBand(r0: number, r1: number, a0: number, a1: number, w: number, hex: string): G {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, r1, a0, a1, false);
  sh.absarc(0, 0, r0, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 28 });
  g.translate(0, 0, -w / 2);
  return solid(g, hex);
}

// After Hanle's telescope (the photo): a tall ribbed silver tower, a panelled
// hemisphere on top with the arched shutter hood running up over it to a
// boxy cap, and a low barrel-roofed annex at its foot with a dark door.
const SILVER = "#d5dae1";
const SILVER_HI = "#e9ecf0";
const SILVER_LO = "#b9c0ca";

function observatoryDome(): Landmark {
  const R = 1.5;
  const H = 3.6;
  const cz = -0.6;
  const parts: G[] = [
    // A rocky base, the tower and its ribs, the band where the dome turns.
    at(drum(R + 0.35, 0.22, "#cbb9a6", 0.08, 28), 0, 0, cz),
    at(drum(R, H, SILVER, 0.03, 40), 0, 0, cz),
    at(drum(R + 0.06, 0.32, SILVER_HI, 0.04, 40), 0, H - 0.1, cz),
  ];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    parts.push(
      at(rbox(0.06, H - 0.2, 0.05, SILVER_LO, 0.02), Math.sin(a) * R, 0.1, cz + Math.cos(a) * R, a),
    );
  }
  // The hemisphere, and its panel seams (thin rings and meridians).
  const dome = ball(R, SILVER_HI, 1, 1, 1);
  dome.translate(0, -R, 0);
  parts.push(at(dome, 0, H + 0.2, cz));
  for (const k of [0.38, 0.72])
    parts.push(
      at(
        arcBand(
          R * Math.cos(k * 1.3) - 0.01,
          R * Math.cos(k * 1.3) + 0.02,
          0,
          Math.PI * 2,
          0.03,
          SILVER_LO,
        ),
        0,
        H + 0.2 + R * Math.sin(k * 1.3),
        cz,
        0,
        Math.PI / 2,
      ),
    );
  for (let i = 0; i < 8; i++)
    parts.push(
      at(
        arcBand(R - 0.005, R + 0.018, 0, Math.PI / 2, 0.03, SILVER_LO),
        0,
        H + 0.2,
        cz,
        (i / 8) * Math.PI * 2 + 0.2,
      ),
    );
  // The shutter hood: two rails and a cover over the slit, from the brim up over
  // the top, a cap at the far end, the lip standing out at the front.
  const yaw = -0.55;
  const hood: G[] = [
    arcBand(R + 0.02, R + 0.2, -0.04, Math.PI * 0.58, 0.85, SILVER_HI),
    arcBand(R + 0.2, R + 0.26, -0.04, Math.PI * 0.58, 0.95, SILVER),
    at(rbox(0.5, 0.36, 0.7, SILVER_HI, 0.05), -0.42, R + 0.06, 0),
    at(rbox(0.55, 0.1, 1.05, SILVER, 0.03), R + 0.2, -0.12, 0),
  ];
  for (const g of hood) parts.push(at(g, 0, H + 0.2, cz, yaw));
  // The annex: ribbed walls, a barrel roof, a dark door and a window.
  const ax = -2.1;
  const az = 0.5;
  parts.push(at(rbox(2.6, 1.15, 1.7, SILVER, 0.04), ax, 0, az));
  for (let i = 0; i < 18; i++)
    parts.push(
      at(rbox(0.04, 1.1, 0.04, SILVER_LO, 0.015), ax - 1.25 + (i / 17) * 2.5, 0, az + 0.86),
    );
  const roof = drum(0.9, 2.8, SILVER_HI, 0.04, 20);
  roof.scale(0.42, 1, 1);
  roof.rotateZ(Math.PI / 2);
  roof.translate(1.4, 0, 0);
  parts.push(at(roof, ax, 1.08, az));
  parts.push(at(rbox(0.55, 0.95, 0.05, "#2a2b36", 0.02), ax - 0.7, 0, az + 0.88));
  parts.push(at(rbox(0.7, 0.32, 0.05, "#3a4258", 0.02), ax + 0.55, 0.3, az + 0.88));
  return {
    body: join(parts),
    signs: [],
    lamps: [{ x: ax - 0.7, y: 1.1, z: az + 1.2, r: 2.8 }],
    half: [3.4, 2.4],
    solids: [
      [0, cz, R + 0.2],
      [ax - 0.7, az, 0.9],
      [ax + 0.6, az, 0.9],
    ],
  };
}

// ── the meteor deck (XUVI) ──────────────────────────────────────────────────

function meteorDeck(): Landmark {
  const parts: G[] = [at(rbox(4.6, 0.16, 3.0, WOOD, 0.04), 0, 0.8, -0.3)];
  for (const [x, z] of [
    [-2.1, -1.6],
    [2.1, -1.6],
    [-2.1, 1.0],
    [2.1, 1.0],
  ] as const)
    parts.push(at(rbox(0.16, 0.85, 0.16, WOOD, 0.03), x, 0, z));
  // Steps, a rail round three sides, two reclining chairs and a telescope.
  for (let k = 0; k < 3; k++)
    parts.push(at(rbox(1.2, 0.08, 0.4, WOOD, 0.02), -1.2, 0.2 + k * 0.25, 1.4 - k * 0.3));
  parts.push(at(rbox(4.6, 0.08, 0.08, WOOD, 0.02), 0, 1.75, -1.75));
  for (const x of [-2.25, 2.25]) parts.push(at(rbox(0.08, 0.08, 2.9, WOOD, 0.02), x, 1.75, -0.3));
  for (const x of [0.3, 1.5]) {
    const back = rbox(0.8, 0.08, 0.9, P.coral, 0.03);
    back.rotateX(0.7);
    parts.push(at(rbox(0.8, 0.3, 1.0, P.coral, 0.06), x, 0.96, 0.2), at(back, x, 1.3, -0.35));
  }
  parts.push(at(telescope(), -1.2, 0.96, -0.9));
  return {
    body: join(parts),
    signs: [
      sign(
        board(
          [
            { text: "DARK SKY", size: 0.5 },
            { text: "RESERVE", size: 0.5 },
          ],
          1.0,
          0.55,
          "#2f3550",
          "#f6f1e8",
        ),
        1.6,
        2.0,
        -1.72,
      ),
    ],
    lamps: [{ x: 0, y: 1.4, z: 0, r: 3 }],
    half: [2.6, 2.0],
    solids: [
      [-2.1, -1.6, 0.25],
      [2.1, -1.6, 0.25],
      [-2.1, 1.0, 0.25],
      [2.1, 1.0, 0.25],
    ],
  };
}

// ── the rocket pad (Blast Off!) ─────────────────────────────────────────────

function rocketPad(): Landmark {
  const parts: G[] = [at(drum(2.2, 0.25, "#cfc7bd", 0.06, 28), 0, 0, -0.6)];
  // The launch tower: a lattice.
  const tx = -1.2;
  for (const [x, z] of [
    [-0.4, -0.4],
    [0.4, -0.4],
    [-0.4, 0.4],
    [0.4, 0.4],
  ] as const)
    parts.push(at(rbox(0.1, 5.2, 0.1, P.coral, 0.03), tx + x, 0.25, -0.6 + z));
  for (let y = 0.8; y < 5.4; y += 0.7)
    parts.push(at(rbox(0.9, 0.08, 0.9, P.coral, 0.02), tx, y, -0.6));
  parts.push(at(rbox(0.9, 0.08, 0.1, P.coral, 0.02), tx + 0.5, 3.6, -0.6));
  // The rocket: body, nose, fins, a stripe.
  const rx = 0.3;
  parts.push(at(drum(0.32, 3.0, WHITE, 0.06, 18), rx, 0.6, -0.6));
  parts.push(at(drum(0.33, 0.25, P.coral, 0.04, 18), rx, 2.4, -0.6));
  parts.push(
    at(
      lathe(
        [
          [0.32, 0],
          [0.24, 0.5],
          [0.1, 0.9],
          [0, 1.0],
        ],
        P.coral,
        18,
      ),
      rx,
      3.6,
      -0.6,
    ),
  );
  for (const a of [0, 1, 2, 3]) {
    const fin = rbox(0.06, 0.8, 0.6, P.aqua, 0.03);
    fin.translate(0, 0, 0.45);
    fin.rotateY((a * Math.PI) / 2);
    parts.push(at(fin, rx, 0.45, -0.6));
  }
  // A control shed, with a mast.
  parts.push(
    at(rbox(1.6, 1.4, 1.2, WHITE, 0.06), 2.6, 0, 0.4),
    at(gable(1.6, 1.2, 0.4, P.aqua, 0.1), 2.6, 1.4, 0.4),
  );
  return {
    body: join(parts),
    signs: [
      sign(board([{ text: "BLAST OFF!", size: 1 }], 1.4, 0.32, P.marigold, P.ink), 2.6, 1.05, 1.02),
    ],
    lamps: [{ x: 0, y: 1.5, z: 0, r: 3.4 }],
    half: [3.4, 2.4],
    solids: [
      [-0.6, -0.6, 1.4],
      [1, -0.6, 1.0],
      [2.6, 0.4, 0.8],
    ],
  };
}

// ── the planetarium tent (Hyperion 2022) ────────────────────────────────────

function planetariumTent(): Landmark {
  const dome = ball(2.4, "#f3ecdf", 1, 0.75, 1);
  dome.translate(0, -0.5, 0);
  const ring = (r: number, tilt: number, hex: string) => {
    const g = new THREE.TorusGeometry(r, 0.05, 6, 48);
    g.rotateX(Math.PI / 2 + tilt);
    const f = g.toNonIndexed();
    f.deleteAttribute("uv");
    return paint(f, hex);
  };
  const r1 = ring(2.9, 0.25, P.lavender);
  const r2 = ring(3.2, -0.3, P.marigold);
  return {
    body: join([
      at(dome, 0, 0, -0.4),
      at(rbox(1.2, 1.6, 0.9, "#2f3550", 0.1), 0, 0, 1.6),
      at(r1, 0, 1.4, -0.4),
      at(r2, 0, 1.2, -0.4),
      at(ball(0.3, P.marigold), 2.6, 2.4, -0.4),
      at(ball(0.18, P.coral), -2.9, 1.7, 0.6),
    ]),
    signs: [
      sign(board([{ text: "PLANETARIUM", size: 1 }], 1.6, 0.3, P.lavender, P.ink), 0, 1.75, 2.06),
    ],
    lamps: [{ x: 0, y: 1, z: 2, r: 3.2 }],
    half: [3.2, 3.0],
    solids: [[0, -0.4, 2.4]],
  };
}

// ── the star-party camp (Hyperion 2021) ─────────────────────────────────────

function starPartyCamp(): Landmark {
  /** A solid A-frame tent (a triangular prism), its door at the front (+z). */
  const tent = (x: number, z: number, hex: string, yaw: number) => {
    const shape = new THREE.Shape([
      new THREE.Vector2(-0.85, 0),
      new THREE.Vector2(0.85, 0),
      new THREE.Vector2(0, 1.25),
    ]);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 2,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      bevelSegments: 1,
    });
    g.translate(0, 0, -1);
    const f = g.index ? g.toNonIndexed() : g;
    f.deleteAttribute("uv");
    f.computeVertexNormals();
    paint(f, hex);
    const door = rbox(0.5, 0.7, 0.04, "#3a2f4d", 0.02);
    door.translate(0, 0, 1.05);
    const t = join([f, door]);
    t.rotateY(yaw);
    return at(t, x, 0, z);
  };
  const parts: G[] = [
    tent(-2.2, -1.2, P.coral, 0.3),
    tent(0, -1.8, P.aqua, 0),
    tent(2.2, -1.1, P.marigold, -0.35),
    // Telescopes out front, and a campfire in a ring of stones.
    at(telescope(), -1.4, 0, 0.9),
    at(telescope("#e9dcc8"), 0.3, 0, 1.2),
    at(telescope(), 1.9, 0, 0.7),
  ];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    parts.push(
      at(ball(0.12, "#b8afa6", 1, 0.7, 1), -0.2 + Math.cos(a) * 0.45, 0, -0.1 + Math.sin(a) * 0.45),
    );
  }
  parts.push(
    at(ball(0.22, P.marigold, 1, 1.4, 1), -0.2, 0, -0.1),
    at(ball(0.14, P.coral, 1, 1.6, 1), -0.2, 0.18, -0.1),
  );
  return {
    body: join(parts),
    signs: [],
    lamps: [{ x: -0.2, y: 0.4, z: -0.1, r: 3.4 }],
    half: [3.2, 2.2],
    solids: [
      [-2.2, -1.2, 0.8],
      [0, -1.8, 0.8],
      [2.2, -1.1, 0.8],
    ],
  };
}

// ── the hilltop monastery (Wiki) ────────────────────────────────────────────

function monastery(): Landmark {
  const parts: G[] = [
    // Stacked whitewashed blocks with maroon parapets, small dark windows (on the ground).
    at(rbox(4.6, 2.2, 2.8, WHITE, 0.06), 0, 0, -1.0),
    at(rbox(4.7, 0.3, 2.9, MAROON, 0.04), 0, 2.1, -1.0),
    at(rbox(2.6, 1.6, 2.0, WHITE, 0.06), -0.6, 2.3, -1.3),
    at(rbox(2.7, 0.28, 2.1, MAROON, 0.04), -0.6, 3.85, -1.3),
    ...[-1.6, -0.5, 0.6, 1.7].map((x) => at(rbox(0.36, 0.5, 0.06, "#2f3550", 0.02), x, 1.0, 0.42)),
    ...[-1.2, 0].map((x) => at(rbox(0.32, 0.45, 0.06, "#2f3550", 0.02), x, 3.0, -0.28)),
    at(rbox(0.8, 1.2, 0.06, MAROON, 0.03), 0, 0, 0.42),
    // Golden finials on the roof, a chorten beside the door, a courtyard step.
    ...[-1.5, 0.3].map((x) =>
      at(
        lathe(
          [
            [0.16, 0],
            [0.05, 0.5],
            [0, 0.6],
          ],
          GOLD,
          10,
        ),
        x,
        4.1,
        -1.3,
      ),
    ),
    at(chorten(0.45), 2.9, 0, 0.8),
    at(rbox(2.0, 0.16, 0.8, "#d9cdbf", 0.04), 0, 0, 0.9),
  ];
  // Prayer flags from the roof down to the ground.
  parts.push(
    flagString(V(-1.8, 4.0, -1.3), V(-4.0, 0.4, 1.6), 0.4),
    flagString(V(1.2, 4.0, -1.3), V(4.0, 0.4, 1.8), 0.4),
  );
  return {
    body: join(parts),
    signs: [],
    lamps: [
      { x: 0, y: 1.2, z: 0.6, r: 3.4 },
      { x: -0.6, y: 3.1, z: -0.2, r: 2.4 },
    ],
    half: [4.0, 2.6],
    solids: [
      [-1.2, -0.8, 2.6],
      [1.2, -0.8, 2.6],
    ],
  };
}

// ── the lake with yaks (NASA APOD bot) ──────────────────────────────────────

function lakeWithYaks(): Landmark {
  // A turquoise high lake (flat shapes), grazing yaks on the shore, a few stones.
  const shore: [number, number][] = [];
  const water: [number, number][] = [];
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const wob = 1 + 0.12 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 5);
    shore.push([Math.cos(a) * 5.2 * wob, -1.6 + Math.sin(a) * 2.9 * wob]);
    water.push([Math.cos(a) * 4.6 * wob, -1.6 + Math.sin(a) * 2.4 * wob]);
  }
  const yaks = [
    { x: -2.6, z: 1.8, yaw: 0.6, tone: "#4a3b36" },
    { x: -0.8, z: 2.2, yaw: 2.4, tone: "#2f2826" },
    { x: 2.4, z: 1.6, yaw: -0.4, tone: "#5a4a42" },
  ];
  const parts: G[] = yaks.map((y) => {
    const g = yak(y.tone);
    g.rotateY(y.yaw);
    return at(g, y.x, 0, y.z);
  });
  for (const [x, z, s] of [
    [4.6, 0.6, 0.3],
    [-4.8, 0.2, 0.25],
    [3.4, -4.2, 0.35],
  ] as const)
    parts.push(at(ball(s, "#b8afa6", 1.3, 0.7, 1), x, 0, z));
  return {
    body: join(parts),
    signs: [],
    lamps: [],
    half: [5.4, 4.6],
    solids: yaks.map((y) => [y.x, y.z, 0.7] as [number, number, number]),
    extras: [flatShape(shore, "#e8d2b8", 0.004), flatShape(water, TURQUOISE, 0.006)],
  };
}

// ── the dak bungalow (IP Mail) ──────────────────────────────────────────────

function dakBungalow(): Landmark {
  return {
    body: join([
      at(rbox(5.0, 2.3, 3.0, WHITE, 0.08), 0, 0, -0.6),
      at(gable(5.0, 3.0, 1.1, "#7fae8f", 0.35), 0, 2.3, -0.6),
      // The verandah: a floor, posts and its own roof.
      at(rbox(5.2, 0.2, 1.4, "#d9cdbf", 0.04), 0, 0, 1.6),
      ...[-2.4, -0.8, 0.8, 2.4].map((x) => at(rbox(0.14, 2.0, 0.14, WOOD, 0.03), x, 0.2, 2.2)),
      at(rbox(5.4, 0.12, 1.6, "#7fae8f", 0.03), 0, 2.2, 1.65),
      at(rbox(0.9, 1.7, 0.06, "#3a2f4d", 0.03), 0, 0.2, 0.92),
      ...[-1.6, 1.6].map((x) => at(rbox(0.8, 0.8, 0.06, "#9fc6d6", 0.03), x, 0.9, 0.92)),
      // A red post box by the steps, and a little radio mast on the roof.
      at(drum(0.26, 0.95, "#e2574a", 0.05, 16), 2.9, 0, 2.6),
      at(ball(0.27, "#e2574a", 1, 0.5, 1), 2.9, 0.95, 2.6),
      at(rbox(0.06, 1.6, 0.06, "#3a2f4d", 0.02), -1.8, 3.0, -1.0),
      at(rbox(0.6, 0.04, 0.04, "#3a2f4d", 0.02), -1.8, 4.3, -1.0),
    ]),
    signs: [
      sign(board([{ text: "DAK BUNGALOW", size: 1 }], 2.2, 0.34, "#fbf6ec", MAROON), 0, 2.0, 2.46),
    ],
    lamps: [{ x: 0, y: 1.4, z: 1.8, r: 3.6 }],
    half: [3.2, 2.8],
    solids: [
      [-1.4, -0.6, 1.6],
      [1.4, -0.6, 1.6],
      [2.9, 2.6, 0.3],
    ],
  };
}

export type AstroLandmark =
  | "solar"
  | "dome"
  | "deck"
  | "rocket"
  | "planetarium"
  | "camp"
  | "monastery"
  | "lake"
  | "bungalow";

/** AstroClub's landmarks, by stop, with each stop's star. */
export const ASTRO_LANDMARKS: Record<
  AstroLandmark,
  { stop: string; title: string; star: StarName; make: () => Landmark }
> = {
  solar: { stop: "Jux", title: "The solar observatory", star: "algol", make: solarObservatory },
  dome: {
    stop: "Inter IIT Tech Meet 2022",
    title: "The observatory dome",
    star: "sol",
    make: observatoryDome,
  },
  deck: { stop: "XUVI", title: "The meteor deck", star: "hr8799", make: meteorDeck },
  rocket: { stop: "Blast Off!", title: "The rocket pad", star: "altair", make: rocketPad },
  planetarium: {
    stop: "Hyperion 2022",
    title: "The planetarium tent",
    star: "mars",
    make: planetariumTent,
  },
  camp: {
    stop: "Hyperion 2021",
    title: "The star-party camp",
    star: "hyperion",
    make: starPartyCamp,
  },
  monastery: { stop: "Wiki", title: "The hilltop monastery", star: "andromeda", make: monastery },
  lake: { stop: "NASA APOD bot", title: "The lake with yaks", star: "venus", make: lakeWithYaks },
  bungalow: { stop: "IP Mail", title: "The dak bungalow", star: "polaris", make: dakBungalow },
};

// ── the stars ───────────────────────────────────────────────────────────────

export type StarName =
  | "sol"
  | "algol"
  | "hr8799"
  | "altair"
  | "mars"
  | "hyperion"
  | "andromeda"
  | "venus"
  | "polaris";

/** Each stop's star as a little figure: its points (x right, y up, about −1…1), lines, and the star itself. */
const PATTERNS: Record<
  StarName,
  {
    pts: [number, number][];
    lines: [number, number][];
    main: number;
    colour?: string;
    rings?: number[];
  }
> = {
  // The Sun: one bright star with short rays.
  sol: {
    pts: [
      [0, 0],
      ...Array.from({ length: 8 }, (_, k): [number, number] => [
        Math.cos((k * Math.PI) / 4) * 0.55,
        Math.sin((k * Math.PI) / 4) * 0.55,
      ]),
    ],
    lines: [],
    main: 0,
    colour: "#ffd27a",
  },
  // Perseus, with Algol (the demon star) marked.
  algol: {
    pts: [
      [-0.7, 0.9],
      [-0.35, 0.55],
      [0, 0.35],
      [0.15, -0.05],
      [0.45, -0.35],
      [0.7, -0.75],
      [-0.25, 0.05],
      [-0.45, -0.3],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [2, 6],
      [6, 7],
    ],
    main: 6,
  },
  // HR 8799: a star and its four imaged planets.
  hr8799: {
    pts: [
      [0, 0],
      [0.25, 0.05],
      [-0.1, 0.42],
      [-0.6, -0.2],
      [0.55, -0.62],
    ],
    lines: [],
    main: 0,
    rings: [0.25, 0.43, 0.63, 0.83],
  },
  // Aquila, the eagle, round Altair.
  altair: {
    pts: [
      [0, 0],
      [0.16, 0.24],
      [-0.16, -0.22],
      [0.62, 0.5],
      [-0.75, -0.42],
      [0.1, -0.9],
      [0.3, 0.92],
    ],
    lines: [
      [2, 0],
      [0, 1],
      [0, 3],
      [0, 4],
      [0, 5],
      [1, 6],
    ],
    main: 0,
  },
  // Mars at opposition: a red dot, its orbit.
  mars: { pts: [[0.42, 0.2]], lines: [], main: 0, colour: "#ff8a6a", rings: [0.47] },
  // Saturn's moon Hyperion: Saturn and its ring, the little moon beside.
  hyperion: {
    pts: [
      [0, 0],
      [0.75, 0.35],
    ],
    lines: [],
    main: 0,
    colour: "#ffe0a0",
    rings: [0.38],
  },
  // Andromeda's chain of stars and the galaxy beside it.
  andromeda: {
    pts: [
      [-0.9, -0.45],
      [-0.45, -0.22],
      [0.05, 0.02],
      [0.55, 0.3],
      [0.2, 0.55],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
    main: 4,
    colour: "#d9c8ff",
  },
  // Venus, the morning star: one very bright point.
  venus: { pts: [[0, 0]], lines: [], main: 0, colour: "#fff6d6" },
  // The Little Dipper, Polaris at the end of its handle.
  polaris: {
    pts: [
      [0, 0.95],
      [0.12, 0.62],
      [0.24, 0.36],
      [0.18, 0.08],
      [0.48, -0.08],
      [0.7, 0.16],
      [0.45, 0.34],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 3],
    ],
    main: 0,
  },
};

/**
 * A star figure, glowing (unlit, drawn over the night): points as soft discs,
 * lines between them, rings for orbits. About `size` metres across, in the
 * xy plane (turn it to face the camera).
 */
export function constellation(name: StarName, size = 6): THREE.Group {
  const pat = PATTERNS[name];
  const g = new THREE.Group();
  const col = new THREE.Color(pat.colour ?? "#fff3cf");
  const glow = new THREE.MeshBasicMaterial({
    color: col,
    transparent: true,
    opacity: 0.28,
    depthTest: false,
    toneMapped: false,
  });
  const core = new THREE.MeshBasicMaterial({ color: col, depthTest: false, toneMapped: false });
  const lineMat = new THREE.LineBasicMaterial({
    color: col,
    transparent: true,
    opacity: 0.55,
    depthTest: false,
    toneMapped: false,
  });
  const s = size / 2;
  pat.pts.forEach(([x, y], i) => {
    const big = i === pat.main ? 1.9 : 1;
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.09 * big * (size / 6), 16), core);
    c.position.set(x * s, y * s, 0);
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.26 * big * (size / 6), 20), glow);
    h.position.set(x * s, y * s, -0.01);
    g.add(h, c);
  });
  if (pat.lines.length) {
    const pos: number[] = [];
    for (const [a, b] of pat.lines) {
      const pa = pat.pts[a] as [number, number];
      const pb = pat.pts[b] as [number, number];
      pos.push(pa[0] * s, pa[1] * s, 0, pb[0] * s, pb[1] * s, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.add(new THREE.LineSegments(geo, lineMat));
  }
  for (const r of pat.rings ?? []) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * s - 0.03, r * s + 0.03, 64), lineMat);
    ring.scale.set(1, name === "hyperion" ? 0.35 : 1, 1);
    g.add(ring);
  }
  g.renderOrder = 10;
  return g;
}
