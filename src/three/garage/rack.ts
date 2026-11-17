/**
 * The jacket rack on the back wall, closet style: a chrome rail on two wall
 * brackets with riding jackets hung side-on on wooden hangers. Real riding
 * jackets: white, black or grey bodies (sometimes two neutral tones), with at
 * most ~5% red or blue as thin piping and a small chest mark, and thin silver
 * reflective lines. Adit's black one (fine red piping) hangs at the right
 * end, with his black helmet on a hook beside it.
 */

import * as THREE from "three";
import { helmetShell, JACKET, type JacketStyle, KIT, vloft } from "../lib/adit";
import { ball, block, cyl, pipe } from "../lib/hero";
import { batch } from "../merge";
import { RACK, WALL_Z } from "./space";

/** How far the rail stands off the wall (jackets hang side-on, so half a jacket width). */
const DEPTH = 0.36;
const SPACING = 0.24;

/** The rack's jackets, left to right; Adit's is last. */
const JACKETS: JacketStyle[] = [
  { base: JACKET.black, accent: JACKET.red },
  { base: JACKET.grey, lower: JACKET.black, accent: JACKET.blue },
  { base: JACKET.black, accent: JACKET.blue },
  { base: JACKET.white, lower: JACKET.grey, accent: JACKET.red },
  { base: JACKET.grey, accent: JACKET.red },
  { base: JACKET.black, lower: JACKET.grey, accent: JACKET.blue },
  KIT.jacketStyle,
];

/** A riding jacket on a wooden hanger, its front facing +z. The hook is at the origin. */
export function hangingJacket(j: JacketStyle): THREE.Group {
  const g = new THREE.Group();
  const lower = j.lower ?? j.base;
  const trim = trimFor(j.base);
  // Wooden hanger with a chrome hook.
  g.add(
    pipe(
      [
        [0, 0.02, 0],
        [0, -0.04, 0],
        [0, -0.09, 0],
      ],
      0.006,
      "#c9cfd6",
      { metal: true },
    ),
  );
  g.add(
    pipe(
      [
        [-0.21, -0.18, 0],
        [-0.1, -0.12, 0],
        [0, -0.1, 0],
        [0.1, -0.12, 0],
        [0.21, -0.18, 0],
      ],
      0.016,
      "#a8774a",
    ),
  );
  const turn = new THREE.Group();
  turn.rotation.y = -Math.PI / 2;
  g.add(turn);
  // A fuller body: upper tone over the shoulders and chest, lower tone below.
  turn.add(
    vloft(
      [
        [-0.46, 0.105, -0.09, 0.215],
        [-0.3, 0.1, -0.095, 0.225],
        [-0.2, 0.095, -0.095, 0.225],
        [-0.14, 0.08, -0.08, 0.16],
      ],
      j.base,
      3,
    ),
  );
  turn.add(
    vloft(
      [
        [-0.84, 0.1, -0.085, 0.2],
        [-0.62, 0.11, -0.09, 0.212],
        [-0.46, 0.104, -0.089, 0.214],
      ],
      lower,
      3,
    ),
  );
  // Stand-up collar.
  g.add(cyl([0, -0.11, 0], [0, -0.19, 0], 0.085, trim));
  // Sleeves: upper tone, then lower tone on the forearm; armour lumps; trim cuffs.
  for (const s of [-1, 1]) {
    g.add(
      pipe(
        [
          [s * 0.22, -0.2, 0],
          [s * 0.25, -0.44, 0.005],
        ],
        0.058,
        j.base,
      ),
    );
    g.add(
      pipe(
        [
          [s * 0.25, -0.44, 0.005],
          [s * 0.24, -0.7, 0.01],
        ],
        0.055,
        lower,
      ),
    );
    g.add(ball([s * 0.255, -0.3, 0.02], 0.045, trim, { rough: 0.5 }, [0.75, 1.3, 0.7]));
    g.add(cyl([s * 0.24, -0.69, 0.01], [s * 0.24, -0.75, 0.01], 0.058, trim));
    // Accent: a thin piping line down the outer sleeve (well under 5% in total).
    g.add(
      pipe(
        [
          [s * 0.278, -0.22, 0],
          [s * 0.305, -0.44, 0.005],
          [s * 0.296, -0.66, 0.01],
        ],
        0.0045,
        j.accent,
      ),
    );
    // Neutral silver reflective line round the upper arm.
    g.add(
      cyl([s * 0.25, -0.38, 0.005], [s * 0.25, -0.392, 0.005], 0.061, JACKET.reflect, {
        metal: true,
      }),
    );
  }
  // Zip, a small accent chest mark, a reflective chest line, hem band.
  g.add(
    pipe(
      [
        [0, -0.2, 0.105],
        [0, -0.82, 0.1],
      ],
      0.005,
      KIT.zip,
      { metal: true },
    ),
  );
  g.add(block([0.06, -0.3, 0.098], [0.13, -0.27, 0.112], j.accent, { r: 0.006 }));
  g.add(
    pipe(
      [
        [-0.17, -0.42, 0.1],
        [-0.03, -0.42, 0.108],
      ],
      0.005,
      JACKET.reflect,
      { metal: true },
    ),
  );
  g.add(block([-0.2, -0.88, -0.085], [0.2, -0.83, 0.095], trim, { r: 0.015 }));
  return g;
}

function trimFor(base: string): string {
  return base === JACKET.white ? "#c9cbcf" : base === JACKET.grey ? "#4f535a" : "#2e3036";
}

export class JacketRack {
  readonly group: THREE.Group;
  /** Adit's jacket on the rail (hidden while he wears it). */
  readonly black: THREE.Group;
  /** The helmet on its hook (hidden while he wears it). */
  readonly helmet: THREE.Group;
  readonly spots: { blackPeg: THREE.Vector3; helmetHook: THREE.Vector3 };

  constructor() {
    const g = new THREE.Group();
    const { y } = RACK;
    const n = JACKETS.length;
    const span = (n - 1) * SPACING;
    const cx = (RACK.x0 + RACK.x1) / 2;
    const x0 = cx - span / 2 - 0.22;
    const x1 = cx + span / 2 + 0.22;
    const zr = WALL_Z + DEPTH;
    // Chrome rail on two wall brackets.
    g.add(cyl([x0, y, zr], [x1, y, zr], 0.016, "#c9cfd6", { metal: true }));
    for (const x of [x0 + 0.04, x1 - 0.04]) {
      g.add(
        pipe(
          [
            [x, y + 0.06, WALL_Z],
            [x, y + 0.04, zr - 0.1],
            [x, y, zr],
          ],
          0.014,
          "#c9cfd6",
          { metal: true },
        ),
      );
      g.add(
        block([x - 0.04, y, WALL_Z], [x + 0.04, y + 0.12, WALL_Z + 0.02], "#9aa1a9", {
          r: 0.008,
          metal: true,
        }),
      );
    }
    // Jackets hung side-on, as in a closet, fronts toward the room's right.
    let blackPeg = new THREE.Vector3();
    JACKETS.forEach((j, i) => {
      const x = cx - span / 2 + i * SPACING;
      const jacket = hangingJacket(j);
      jacket.position.set(x, y + 0.04, zr);
      jacket.rotation.y = Math.PI / 2 + (((i * 7) % 5) * 0.015 - 0.03);
      g.add(jacket);
      if (i === n - 1) {
        blackPeg = new THREE.Vector3(x, y, zr + 0.25);
        jacket.name = "black";
      }
    });

    // Helmet hook on the wall at the right end.
    const hx = x1 + 0.3;
    g.add(
      pipe(
        [
          [hx, y - 0.1, WALL_Z],
          [hx, y - 0.1, WALL_Z + 0.12],
          [hx, y - 0.02, WALL_Z + 0.16],
        ],
        0.012,
        "#c9a227",
        { metal: true },
      ),
    );
    const helmet = new THREE.Group();
    helmet.name = "helmet";
    const shell = helmetShell(0.11);
    shell.scale.setScalar(1.23);
    // Visor facing out into the room.
    shell.rotation.y = -Math.PI / 2;
    helmet.add(shell);
    helmet.position.set(hx, y - 0.32, WALL_Z + 0.2);
    g.add(helmet);
    // Hundreds of small parts → a few draws; the black jacket and the helmet stay live
    // (the ride ritual takes them down and puts them back).
    this.group = batch(g, (o) => o.name === "black" || o.name === "helmet");
    // Wall-mounted and mostly in the lamp's shade: skip the shadow pass for it.
    this.group.traverse((o) => {
      o.castShadow = false;
    });
    this.black = this.group.getObjectByName("black") as THREE.Group;
    this.helmet = this.group.getObjectByName("helmet") as THREE.Group;
    this.spots = {
      blackPeg,
      helmetHook: new THREE.Vector3(hx, y - 0.3, WALL_Z + 0.25),
    };
  }
}
