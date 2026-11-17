/**
 * Adit, the guide (a.k.a. Murphy). A smooth toy-style figure modelled on
 * Adit's photo: curly black hair with volume on top, clean-shaven, a big
 * toothy smile, sage-green linen shirt with sleeves rolled, black
 * dark jeans, white sneakers.
 *
 * Faces +x, stands on y = 0. `toy` (0–1) blends from true proportions to a
 * chibi figure with a big head.
 */

import * as THREE from "three";
import { ball, block, cyl, loft, pipe, type Sec } from "./hero";

type V3 = [number, number, number];

export const ADIT = {
  skin: "#b37a54",
  skinShade: "#9c6646",
  hair: "#17130f",
  shirt: "#93a98c",
  shirtShade: "#7f957a",
  jeans: "#2f3b52",
  shoe: "#f1efe8",
  sole: "#cfcac0",
};

export type AditPose = "stand" | "wave" | "point" | "helmet" | "lean";

export interface AditOpts {
  pose?: AditPose;
  toy?: number;
  /** Head turn (radians, + = toward +z). */
  look?: number;
  /**
   * Build legs and arms as pivot groups (legL/legR at the hips, armL/armR at
   * the shoulders, arms hanging neutral) so they can be animated: walking,
   * pointing, presenting. The pose then only affects the body lean.
   */
  rig?: boolean;
  helmet?: string;
}

/** Vertical loft: sections [y, front x, back x, half width]. */
export function vloft(
  secs: [number, number, number, number][],
  colour: string,
  n = 2.4,
): THREE.Mesh {
  const s: Sec[] = secs.map(([y, f, b, w]) => [y, -b, -f, w]);
  const m = loft(s, colour, { n, cap: 0.5 });
  m.rotation.z = Math.PI / 2;
  return m;
}

function rand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function head(look: number): THREE.Group {
  const g = new THREE.Group();
  const r = 0.11;
  g.add(ball([0, 0, 0], r, ADIT.skin, undefined, [1.0, 1.12, 0.93]));
  // Ears.
  for (const s of [-1, 1])
    g.add(ball([-0.005, -0.005, s * r * 0.92], 0.026, ADIT.skin, undefined, [0.7, 1, 0.5]));
  // Relaxed smile: a soft D-shaped opening conforming to the face, a smooth
  // row of upper teeth with rounded edges and faint gaps, and a soft lower lip.
  const onFace = (y: number, z: number, out = 0.002) =>
    r * Math.sqrt(Math.max(0, 1 - (y / (1.12 * r)) ** 2 - (z / (0.93 * r)) ** 2)) + out;
  const hw = 0.04;
  const top = (u: number) => -0.035 + 0.005 * u * u;
  const bot = (u: number) => top(u) - 0.021 * (1 - u * u) ** 0.75;
  const patch = (
    f0: (u: number) => number,
    f1: (u: number) => number,
    colour: string,
    out: number,
    rough = 0.7,
  ) => {
    const nu = 40;
    const nt = 8;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= nu; i++) {
      const u = -1 + (i / nu) * 2;
      for (let j = 0; j <= nt; j++) {
        const y = f0(u) + (f1(u) - f0(u)) * (j / nt);
        const z = u * hw;
        pos.push(onFace(y, z, out), y, z);
      }
    }
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nt; j++) {
        const a0 = i * (nt + 1) + j;
        const b0 = (i + 1) * (nt + 1) + j;
        idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: colour,
        roughness: rough,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    g.add(m);
  };
  patch(top, bot, "#8e4640", 0.0012);
  // Teeth: a smooth row; the lower edge has gentle rounded scallops, never points.
  const teethBot = (u: number) => {
    const depth = (top(u) - bot(u)) * 0.55;
    const scallop = 0.0009 * (1 - Math.abs(Math.cos(u * Math.PI * 3.5)));
    return top(u) - depth + scallop;
  };
  patch(top, teethBot, "#f8f5ee", 0.0018, 0.35);
  for (const u of [-0.45, -0.15, 0.15, 0.45]) {
    const z = u * hw;
    const y0 = top(u) - 0.0005;
    const y1 = y0 - (top(u) - bot(u)) * 0.3;
    g.add(
      pipe(
        [
          [onFace(y0, z, 0.0022), y0, z],
          [onFace(y1, z, 0.0022), y1, z],
        ],
        0.00035,
        "#d9d3c7",
      ),
    );
  }
  // Soft lower lip.
  const lip: V3[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = -0.85 + (i / 14) * 1.7;
    const y = bot(u) - 0.0035;
    lip.push([onFace(y, u * hw, 0.0008), y, u * hw]);
  }
  g.add(pipe(lip, 0.0035, "#b0705a"));
  // Nose.
  g.add(ball([r * 0.95, -r * 0.06, 0], 0.013, ADIT.skinShade, undefined, [1, 1.2, 0.95]));
  // Smiling eyes (squinted) and thick brows.
  for (const s of [-1, 1]) {
    g.add(ball([r * 0.86, r * 0.14, s * r * 0.38], 0.016, "#1b1410", undefined, [0.6, 0.7, 1.2]));
    g.add(
      ball([r * 0.88, r * 0.17, s * r * 0.38 + s * 0.004], 0.005, "#ffffff", { emissive: true }),
    );
    g.add(
      pipe(
        [
          [r * 0.86, r * 0.3, s * r * 0.18],
          [r * 0.9, r * 0.34, s * r * 0.38],
          [r * 0.84, r * 0.31, s * r * 0.58],
        ],
        0.007,
        ADIT.hair,
      ),
    );
  }
  // Hair: a cap tilted back (forehead clear) covered in curls, voluminous on top.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.04, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.MeshStandardMaterial({ color: ADIT.hair, roughness: 0.9, side: THREE.DoubleSide }),
  );
  cap.scale.set(1.0, 1.12, 0.95);
  cap.rotation.z = 0.36;
  cap.castShadow = true;
  g.add(cap);
  const rnd = rand(77121346);
  const hairMat = new THREE.MeshStandardMaterial({ color: ADIT.hair, roughness: 0.85 });
  const curl = new THREE.SphereGeometry(1, 14, 10);
  for (let i = 0; i < 70; i++) {
    const th = Math.acos(1 - rnd() * 0.78); // polar angle from the top
    const ph = rnd() * Math.PI * 2;
    // tilt back like the cap, and stay above the forehead and ears
    const x0 = Math.sin(th) * Math.cos(ph);
    const y0 = Math.cos(th);
    const z0 = Math.sin(th) * Math.sin(ph);
    const c = Math.cos(0.36);
    const sn = Math.sin(0.36);
    const x = x0 * c - y0 * sn;
    const y = x0 * sn + y0 * c;
    if (y < 0.18 && x > -0.3) continue;
    const lift = 1.06 + 0.16 * Math.max(0, y) + rnd() * 0.05;
    const m = new THREE.Mesh(curl, hairMat);
    const s = 0.026 + rnd() * 0.016 + 0.01 * Math.max(0, y);
    m.scale.set(s, s * 0.9, s);
    m.position.set(x * r * lift, y * r * 1.12 * lift + 0.01, z0 * r * 0.98 * lift);
    m.castShadow = true;
    g.add(m);
  }
  // A few curls falling onto the forehead.
  for (const [z, dy] of [
    [-0.03, 0],
    [0.015, -0.008],
    [0.05, 0.004],
  ] as [number, number][])
    g.add(ball([r * 0.82, r * 0.62 + dy, z], 0.024, ADIT.hair, undefined, [0.8, 1, 1]));
  g.rotation.y = -look;
  return g;
}

interface Arm {
  sh: V3;
  el: V3;
  wr: V3;
}

function arm(g: THREE.Group, a: Arm): void {
  const cuff = new THREE.Vector3(...a.el).lerp(new THREE.Vector3(...a.wr), 0.28).toArray() as V3;
  g.add(pipe([a.sh, a.el, cuff], 0.05, ADIT.shirt));
  g.add(
    cyl(
      cuff,
      new THREE.Vector3(...a.el).lerp(new THREE.Vector3(...a.wr), 0.4).toArray() as V3,
      0.053,
      ADIT.shirtShade,
    ),
  );
  g.add(pipe([cuff, a.wr], 0.036, ADIT.skin));
  g.add(ball(a.wr, 0.042, ADIT.skin, undefined, [1, 1.2, 0.8]));
}

export function adit(o: AditOpts = {}): THREE.Group {
  const pose = o.pose ?? "stand";
  const toy = o.toy ?? 0.35;
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const legK = 1 - 0.22 * toy;
  const hip = 0.9 * legK;
  const knee = 0.48 * legK;
  const torsoTop = hip + 0.56;
  const sh = torsoTop - 0.08;
  // Legs and sneakers. With `rig`, each leg is a group pivoting at the hip.
  for (const s of [-1, 1]) {
    const z = s * 0.1;
    const leg = new THREE.Group();
    const hz = s * 0.09;
    if (o.rig) {
      leg.name = s < 0 ? "legL" : "legR";
      leg.position.set(0, hip, hz);
    }
    const oy = o.rig ? -hip : 0;
    const oz = o.rig ? -hz : 0;
    leg.add(
      block([-0.06, oy, z - 0.05 + oz], [0.17, 0.035 + oy, z + 0.05 + oz], ADIT.sole, { r: 0.015 }),
    );
    leg.add(
      block([-0.055, 0.02 + oy, z - 0.047 + oz], [0.15, 0.09 + oy, z + 0.047 + oz], ADIT.shoe, {
        r: 0.035,
      }),
    );
    const lean = pose === "lean" ? 0.03 : 0;
    leg.add(
      pipe(
        [
          [0, hip + oy, hz + oz],
          [0.015 + lean, knee + oy, s * 0.098 + oz],
          [0.0, 0.1 + oy, z + oz],
        ],
        0.066,
        ADIT.jeans,
      ),
    );
    body.add(leg);
  }
  // Hips and torso (linen shirt, untucked).
  body.add(
    vloft(
      [
        [hip - 0.06, 0.1, -0.1, 0.17],
        [hip + 0.12, 0.11, -0.1, 0.175],
        [hip + 0.3, 0.12, -0.11, 0.18],
        [torsoTop - 0.08, 0.11, -0.1, 0.21],
        [torsoTop, 0.07, -0.07, 0.15],
      ],
      ADIT.shirt,
    ),
  );
  body.add(
    vloft(
      [
        [hip - 0.1, 0.09, -0.09, 0.155],
        [hip + 0.02, 0.09, -0.09, 0.16],
      ],
      ADIT.jeans,
    ),
  );
  // Placket, buttons, open collar.
  for (let i = 0; i < 4; i++)
    body.add(ball([0.122, torsoTop - 0.13 - i * 0.1, 0.0], 0.008, "#e9eadf"));
  for (const s of [-1, 1])
    body.add(
      pipe(
        [
          [0.05, torsoTop + 0.01, s * 0.07],
          [0.1, torsoTop - 0.04, s * 0.05],
          [0.12, torsoTop - 0.1, s * 0.01],
        ],
        0.016,
        ADIT.shirtShade,
      ),
    );
  // Neck (with a little chest skin in the open collar).
  body.add(cyl([0.01, torsoTop - 0.04, 0], [0.015, torsoTop + 0.08, 0], 0.048, ADIT.skin));
  // Arms per pose (neutral when rigged; the scene animates them).
  const L: Arm = { sh: [0, sh, -0.205], el: [0.0, sh - 0.27, -0.245], wr: [0.04, sh - 0.5, -0.24] };
  const R: Arm = { sh: [0, sh, 0.205], el: [0.0, sh - 0.27, 0.245], wr: [0.04, sh - 0.5, 0.24] };
  if (o.rig) {
    for (const [a, name] of [
      [L, "armL"],
      [R, "armR"],
    ] as [Arm, string][]) {
      const grp = new THREE.Group();
      grp.name = name;
      grp.position.set(...a.sh);
      const rel = (p: V3): V3 => [p[0] - a.sh[0], p[1] - a.sh[1], p[2] - a.sh[2]];
      arm(grp, { sh: [0, 0, 0], el: rel(a.el), wr: rel(a.wr) });
      body.add(grp);
    }
  } else if (pose === "wave") {
    R.el = [0.04, sh - 0.06, 0.4];
    R.wr = [0.08, sh + 0.2, 0.42];
  } else if (pose === "point") {
    R.el = [0.18, sh - 0.14, 0.27];
    R.wr = [0.42, sh - 0.24, 0.26];
  } else if (pose === "lean") {
    L.el = [0.16, sh - 0.22, -0.28];
    L.wr = [0.34, sh - 0.38, -0.26];
    R.el = [0.16, sh - 0.22, 0.28];
    R.wr = [0.34, sh - 0.38, 0.26];
  } else if (pose === "helmet") {
    L.el = [-0.02, sh - 0.27, -0.27];
    L.wr = [0.14, sh - 0.42, -0.3];
  }
  if (!o.rig) {
    arm(body, L);
    arm(body, R);
  }
  if (pose === "helmet" && !o.rig) {
    const hc = o.helmet ?? "#8a2a22";
    const hm = ball([0.13, sh - 0.4, -0.33], 0.15, hc, { rough: 0.25 });
    body.add(hm);
    body.add(ball([0.24, sh - 0.42, -0.33], 0.11, "#1f2a36", { rough: 0.1 }, [0.5, 0.65, 0.95]));
  }
  if (pose === "lean") body.rotation.z = -0.12;
  const hd = head(o.look ?? 0);
  hd.name = "head";
  const hs = 1 + 0.65 * toy;
  hd.scale.setScalar(hs);
  hd.position.set(0.02, torsoTop + 0.08 + 0.11 * 1.12 * hs, 0);
  body.add(hd);
  return g;
}

// ── Jointed rig (garage choreography) ─────────────────────────────────────

/**
 * Real riding-jacket colours: white, black or grey bodies (sometimes two
 * neutral tones), with at most ~5% red or blue: thin piping and a small
 * chest mark. Silver reflective lines are neutral.
 */
export const JACKET = {
  white: "#e8e8e4",
  black: "#1b1c20",
  grey: "#7b7f87",
  red: "#cf3229",
  blue: "#2463c4",
  reflect: "#b9bec6",
};

export interface JacketStyle {
  base: string;
  /** Optional second neutral tone on the lower body and forearms. */
  lower?: string;
  /** Thin piping and a small chest mark only (≤ 5%). */
  accent: string;
}

/** Adit's riding kit. */
export const KIT = {
  jacketStyle: { base: JACKET.black, accent: JACKET.red } as JacketStyle,
  jacket: JACKET.black,
  jacketSeam: "#3a3c43",
  armour: "#2a2c31",
  zip: "#9aa0a8",
  helmet: "#141518",
  visor: "#3b4656",
};

export type Layer = "shirt" | "jacket" | "hair" | "helmet" | "carry";

function layer(name: Layer): THREE.Group {
  const g = new THREE.Group();
  g.userData.layer = name;
  return g;
}

/** Black full-face helmet, centred on the head (radius r of the head). */
export function helmetShell(r: number): THREE.Group {
  const g = new THREE.Group();
  g.add(ball([0, 0.01, 0], r * 1.32, KIT.helmet, { rough: 0.28 }, [1.05, 1.08, 1.0]));
  // Visor: a dark glossy band across the front, and the chin bar below it.
  g.add(
    ball(
      [r * 0.98, r * 0.1, 0],
      r * 0.98,
      KIT.visor,
      { rough: 0.05, metal: true },
      [0.5, 0.42, 0.95],
    ),
  );
  // A slim grey trim around the visor opening.
  g.add(
    pipe(
      [
        [r * 1.12, r * 0.5, -r * 0.7],
        [r * 1.42, r * 0.52, 0],
        [r * 1.12, r * 0.5, r * 0.7],
      ],
      r * 0.05,
      "#5a5e66",
    ),
  );
  g.add(ball([r * 1.02, -r * 0.62, 0], r * 0.62, KIT.helmet, { rough: 0.28 }, [0.62, 0.55, 1.15]));
  for (const s of [-1, 1])
    g.add(
      ball([r * 0.5, r * 0.08, s * r * 0.95], r * 0.12, "#3a3c43", { rough: 0.4 }, [1, 1, 0.4]),
    );
  return g;
}

/**
 * Adit with joints and swappable layers, for the garage ritual: walking,
 * putting on the jacket and helmet, riding.
 *
 * Joints (rotate these): hips › legL/legR (hip) › shinL/shinR (knee);
 * hips › torso (lean) › armL/armR (shoulder) › foreL/foreR (elbow); torso › head.
 * Layers (toggle with `dress`): shirt, jacket, hair, helmet.
 * Faces +x, feet on y = 0, all joints neutral = standing.
 */
export function aditRig(toy = 0.35): THREE.Group {
  const g = new THREE.Group();
  const legK = 1 - 0.22 * toy;
  const hip = 0.9 * legK;
  const knee = 0.48 * legK;
  const torsoTop = hip + 0.56;
  const sh = torsoTop - 0.08;
  const hips = new THREE.Group();
  hips.name = "hips";
  hips.position.set(0, hip, 0);
  g.add(hips);
  // Legs: thigh (hip pivot) › shin (knee pivot) › sneaker.
  for (const s of [-1, 1]) {
    const z = s * 0.09;
    const thigh = new THREE.Group();
    thigh.name = s < 0 ? "legL" : "legR";
    thigh.position.set(0, 0, z);
    thigh.add(
      pipe(
        [
          [0, 0.02, 0],
          [0.012, knee - hip, s * 0.006],
        ],
        0.066,
        ADIT.jeans,
      ),
    );
    const shin = new THREE.Group();
    shin.name = s < 0 ? "shinL" : "shinR";
    shin.position.set(0.012, knee - hip, s * 0.006);
    shin.add(
      pipe(
        [
          [0, 0, 0],
          [-0.012, 0.1 - knee, s * 0.004],
        ],
        0.06,
        ADIT.jeans,
      ),
    );
    const fy = -knee;
    shin.add(block([-0.072, fy, -0.05], [0.158, fy + 0.035, 0.05], ADIT.sole, { r: 0.015 }));
    shin.add(
      block([-0.067, fy + 0.02, -0.047], [0.138, fy + 0.09, 0.047], ADIT.shoe, { r: 0.035 }),
    );
    thigh.add(shin);
    hips.add(thigh);
  }
  hips.add(
    vloft(
      [
        [-0.1, 0.09, -0.09, 0.155],
        [0.02, 0.09, -0.09, 0.16],
      ],
      ADIT.jeans,
    ),
  );
  // Torso (pivots at the hips so he can lean over the bars).
  const torso = new THREE.Group();
  torso.name = "torso";
  hips.add(torso);
  const ty = (y: number) => y - hip;
  const shirt = layer("shirt");
  shirt.add(
    vloft(
      [
        [ty(hip - 0.06), 0.1, -0.1, 0.17],
        [ty(hip + 0.12), 0.11, -0.1, 0.175],
        [ty(hip + 0.3), 0.12, -0.11, 0.18],
        [ty(torsoTop - 0.08), 0.11, -0.1, 0.21],
        [ty(torsoTop), 0.07, -0.07, 0.15],
      ],
      ADIT.shirt,
    ),
  );
  for (let i = 0; i < 4; i++)
    shirt.add(ball([0.122, ty(torsoTop - 0.13 - i * 0.1), 0], 0.008, "#e9eadf"));
  for (const s of [-1, 1])
    shirt.add(
      pipe(
        [
          [0.05, ty(torsoTop + 0.01), s * 0.07],
          [0.1, ty(torsoTop - 0.04), s * 0.05],
          [0.12, ty(torsoTop - 0.1), s * 0.01],
        ],
        0.016,
        ADIT.shirtShade,
      ),
    );
  torso.add(shirt);
  // The black riding jacket: a little fuller, zip, seams, shoulder armour, high collar.
  const jacket = layer("jacket");
  jacket.add(
    vloft(
      [
        [ty(hip - 0.08), 0.115, -0.115, 0.185],
        [ty(hip + 0.12), 0.125, -0.115, 0.19],
        [ty(hip + 0.3), 0.135, -0.125, 0.195],
        [ty(torsoTop - 0.08), 0.125, -0.115, 0.225],
        [ty(torsoTop + 0.01), 0.08, -0.08, 0.16],
      ],
      KIT.jacket,
    ),
  );
  jacket.add(
    pipe(
      [
        [0.138, ty(hip - 0.05), 0],
        [0.15, ty(hip + 0.3), 0],
        [0.13, ty(torsoTop - 0.02), 0],
      ],
      0.006,
      KIT.zip,
      { metal: true },
    ),
  );
  for (const s of [-1, 1]) {
    jacket.add(
      pipe(
        [
          [0.1, ty(torsoTop - 0.02), s * 0.12],
          [0.13, ty(hip + 0.32), s * 0.14],
          [0.12, ty(hip + 0.02), s * 0.13],
        ],
        0.005,
        KIT.jacketSeam,
      ),
    );
    jacket.add(ball([0, ty(sh), s * 0.2], 0.075, KIT.armour, { rough: 0.5 }, [1.1, 0.75, 0.8]));
  }
  jacket.add(cyl([0.0, ty(torsoTop - 0.01), 0], [0.01, ty(torsoTop + 0.07), 0], 0.075, KIT.jacket));
  // Fine red piping over the shoulders and a small red chest mark (≤ 5%), plus a silver reflective line.
  const acc = KIT.jacketStyle.accent;
  for (const s of [-1, 1]) {
    jacket.add(
      pipe(
        [
          [0.11, ty(torsoTop - 0.01), s * 0.08],
          [0.05, ty(torsoTop - 0.03), s * 0.2],
          [-0.06, ty(sh - 0.02), s * 0.24],
        ],
        0.0045,
        acc,
      ),
    );
    jacket.add(
      pipe(
        [
          [0.125, ty(hip + 0.18), s * 0.05],
          [0.1, ty(hip + 0.18), s * 0.17],
        ],
        0.005,
        JACKET.reflect,
      ),
    );
  }
  jacket.add(
    block([0.125, ty(torsoTop - 0.16), -0.13], [0.142, ty(torsoTop - 0.12), -0.07], acc, {
      r: 0.006,
    }),
  );
  jacket.visible = false;
  torso.add(jacket);
  // Neck.
  torso.add(cyl([0.01, ty(torsoTop - 0.04), 0], [0.015, ty(torsoTop + 0.08), 0], 0.048, ADIT.skin));
  // Arms: upper (shoulder pivot) › forearm (elbow pivot) › hand. Shirt sleeves rolled; jacket sleeves full.
  for (const s of [-1, 1]) {
    const up = new THREE.Group();
    up.name = s < 0 ? "armL" : "armR";
    up.position.set(0, ty(sh), s * 0.205);
    const el: V3 = [0, -0.27, s * 0.04];
    const upShirt = layer("shirt");
    upShirt.add(pipe([[0, 0, 0], el], 0.05, ADIT.shirt));
    up.add(upShirt);
    const upJacket = layer("jacket");
    upJacket.add(pipe([[0, 0, 0], el], 0.058, KIT.jacket));
    upJacket.add(ball([0.005, -0.13, s * 0.02], 0.045, KIT.armour, { rough: 0.5 }, [1, 1.3, 0.8]));
    upJacket.add(
      pipe(
        [
          [0, -0.02, s * 0.056],
          [0, -0.27, s * 0.096],
        ],
        0.0045,
        KIT.jacketStyle.accent,
      ),
    );
    upJacket.visible = false;
    up.add(upJacket);
    const fore = new THREE.Group();
    fore.name = s < 0 ? "foreL" : "foreR";
    fore.position.set(...el);
    const wr: V3 = [0.04, -0.23, -s * 0.005];
    const cuffAt = new THREE.Vector3(...wr).multiplyScalar(0.28).toArray() as V3;
    const foreShirt = layer("shirt");
    foreShirt.add(pipe([[0, 0, 0], cuffAt], 0.05, ADIT.shirt));
    foreShirt.add(
      cyl(
        cuffAt,
        new THREE.Vector3(...wr).multiplyScalar(0.4).toArray() as V3,
        0.053,
        ADIT.shirtShade,
      ),
    );
    foreShirt.add(pipe([cuffAt, wr], 0.036, ADIT.skin));
    fore.add(foreShirt);
    const foreJacket = layer("jacket");
    foreJacket.add(
      pipe(
        [[0, 0, 0], new THREE.Vector3(...wr).multiplyScalar(0.86).toArray() as V3],
        0.055,
        KIT.jacket,
      ),
    );
    foreJacket.add(
      pipe(
        [
          [0, 0, s * 0.054],
          [0.032, -0.19, s * 0.05],
        ],
        0.0045,
        KIT.jacketStyle.accent,
      ),
    );
    foreJacket.visible = false;
    fore.add(foreJacket);
    fore.add(ball(wr, 0.042, ADIT.skin, undefined, [1, 1.2, 0.8]));
    if (s < 0) {
      // The helmet carried in the left hand, by its chin bar: hanging just below and
      // outside the hand, visor forward. `grip` has the same frame as the helmet on
      // the head, so the scene can carry it from hand to head and back.
      const carry = layer("carry");
      const grip = new THREE.Group();
      grip.name = "grip";
      grip.position.set(wr[0] + 0.02, wr[1] - 0.16, wr[2] - 0.13);
      grip.rotation.set(0.25, 0, -0.35);
      const shell = helmetShell(0.11);
      shell.scale.setScalar(1 + 0.65 * toy);
      grip.add(shell);
      carry.add(grip);
      carry.visible = false;
      fore.add(carry);
    }
    up.add(fore);
    torso.add(up);
  }
  // Head: face + hair as a layer, the helmet as another.
  const hs = 1 + 0.65 * toy;
  const headPivot = new THREE.Group();
  headPivot.name = "head";
  headPivot.position.set(0.02, ty(torsoTop + 0.08 + 0.11 * 1.12 * hs), 0);
  const hair = layer("hair");
  const face = head(0);
  face.scale.setScalar(hs);
  hair.add(face);
  headPivot.add(hair);
  const helm = layer("helmet");
  const shell = helmetShell(0.11);
  shell.scale.setScalar(hs);
  helm.add(shell);
  helm.visible = false;
  headPivot.add(helm);
  torso.add(headPivot);
  return g;
}

/**
 * Switches the rig's layers: jacket or shirt, helmet (on the head) or hair, and
 * whether the left hand carries the helmet (`carry`, off unless asked for).
 */
export function dress(
  rig: THREE.Object3D,
  o: { jacket: boolean; helmet: boolean; carry?: boolean },
): void {
  rig.traverse((c) => {
    const l = c.userData.layer as Layer | undefined;
    if (!l) return;
    c.visible =
      l === "shirt"
        ? !o.jacket
        : l === "jacket"
          ? o.jacket
          : l === "hair"
            ? !o.helmet
            : l === "helmet"
              ? o.helmet
              : !!o.carry;
  });
}

/** Names of the rig's live parts (joints and layers) for batching. */
export const RIG_JOINTS = new Set([
  "hips",
  "legL",
  "legR",
  "shinL",
  "shinR",
  "torso",
  "armL",
  "armR",
  "foreL",
  "foreR",
  "head",
]);
