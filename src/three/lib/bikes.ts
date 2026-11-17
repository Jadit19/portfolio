/**
 * Low-poly bikes for the design previews. Each is an original model shaped
 * after a real machine's silhouette and colours (no logos):
 * WinZO = Fireblade, Zingle = KTM Dakar, Expresso = Triumph café racer,
 * Fun = Ducati Scrambler, Astro = BMW R 1300 GSA, Personal = Fat Boy,
 * Murphy = Royal Enfield Guerrilla 450 (silver).
 */

import * as THREE from "three";
import type { BikeKind } from "../../content/types";
import { box, type Kit, profile, sphere, tube, wheel } from "./kit";

type P = [number, number];

const JACKET = "#2f3540";
const JEANS = "#3b4f6b";
const BOOT = "#1b1b1e";
const BLACK = "#202125";
const CHROME = "#c9d0d6";
const ENGINE = "#4d5157";
const LAMP = "#fff3c4";

interface Pose {
  hip: P;
  shoulder: P;
  hand: P;
  foot: P;
  helmet: string;
  visor?: string;
}

function rider(kit: Kit, pose: Pose): THREE.Group {
  const g = new THREE.Group();
  const { hip, shoulder, hand, foot } = pose;
  const knee: P = [foot[0] + 0.16, (hip[1] + foot[1]) / 2 + 0.1];
  for (const z of [-0.12, 0.12]) {
    g.add(tube(kit, JEANS, [hip[0], hip[1], z], [knee[0], knee[1], z * 1.2], 0.065));
    g.add(tube(kit, JEANS, [knee[0], knee[1], z * 1.2], [foot[0], foot[1], z * 1.3], 0.055));
    g.add(
      box(
        kit,
        BOOT,
        [foot[0] - 0.04, foot[1] - 0.05, z * 1.3 - 0.05],
        [foot[0] + 0.1, foot[1] + 0.04, z * 1.3 + 0.05],
      ),
    );
    const elbow: P = [(shoulder[0] + hand[0]) / 2, (shoulder[1] + hand[1]) / 2 - 0.04];
    g.add(
      tube(kit, JACKET, [shoulder[0], shoulder[1], z * 1.35], [elbow[0], elbow[1], z * 1.6], 0.05),
    );
    g.add(tube(kit, JACKET, [elbow[0], elbow[1], z * 1.6], [hand[0], hand[1], z * 1.9], 0.045));
  }
  g.add(tube(kit, JACKET, [hip[0], hip[1], 0], [shoulder[0], shoulder[1], 0], 0.14));
  g.add(sphere(kit, JACKET, [shoulder[0], shoulder[1], 0], 0.15, undefined, [1, 0.8, 1.2]));
  const dx = shoulder[0] - hip[0];
  const dy = shoulder[1] - hip[1];
  const len = Math.hypot(dx, dy) || 1;
  const head: [number, number, number] = [
    shoulder[0] + (dx / len) * 0.2,
    shoulder[1] + (dy / len) * 0.2,
    0,
  ];
  g.add(sphere(kit, pose.helmet, head, 0.135));
  g.add(
    sphere(
      kit,
      pose.visor ?? "#1f2a36",
      [head[0] + 0.07, head[1] - 0.005, 0],
      0.1,
      { glass: false },
      [0.75, 0.6, 0.95],
    ),
  );
  return g;
}

function headlight(kit: Kit, x: number, y: number, r: number, bezel: string): THREE.Group {
  const g = new THREE.Group();
  const shell = sphere(kit, bezel, [x, y, 0], r, { metal: bezel === CHROME }, [0.8, 1, 1]);
  g.add(shell);
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.78, kit.seg(10, 28)),
    kit.mat(LAMP, { emissive: true }),
  );
  lens.position.set(x + r * 0.81, y, 0);
  lens.rotation.y = Math.PI / 2;
  g.add(lens);
  return g;
}

function bars(kit: Kit, x: number, y: number, half: number, colour: string): THREE.Mesh {
  return tube(kit, colour, [x, y, -half], [x, y, half], 0.018, { metal: colour === CHROME });
}

type Build = (kit: Kit, g: THREE.Group) => void;

const BIKES: Record<BikeKind, Build> = {
  superbike(kit, g) {
    const W = "#f3f3f1";
    const R = "#d7262b";
    const B = "#1f4fa3";
    const GOLD = "#c9a227";
    g.add(wheel(kit, -0.7, { r: 0.31, tyre: 0.07, rim: R, kind: "cast" }));
    g.add(wheel(kit, 0.72, { r: 0.31, tyre: 0.065, rim: R, kind: "cast" }));
    g.add(tube(kit, BLACK, [-0.7, 0.31, 0], [-0.12, 0.42, 0], 0.035));
    g.add(box(kit, ENGINE, [-0.18, 0.2, -0.13], [0.26, 0.55, 0.13]));
    for (const z of [-0.08, 0.08])
      g.add(tube(kit, GOLD, [0.72, 0.31, z], [0.5, 0.86, z], 0.028, { metal: true }));
    g.add(tube(kit, "#2b2d33", [-0.25, 0.42, 0.16], [-0.62, 0.6, 0.16], 0.055));
    g.add(
      profile(
        kit,
        W,
        [
          [0.0, 0.3],
          [0.42, 0.3],
          [0.62, 0.52],
          [0.84, 0.66],
          [0.74, 0.8],
          [0.48, 0.86],
          [0.3, 0.8],
          [0.1, 0.62],
          [-0.05, 0.45],
        ],
        0.34,
      ),
    );
    g.add(
      profile(
        kit,
        R,
        [
          [0.02, 0.3],
          [0.4, 0.3],
          [0.52, 0.42],
          [0.1, 0.45],
        ],
        0.36,
      ),
    );
    g.add(
      profile(
        kit,
        B,
        [
          [0.28, 0.68],
          [0.7, 0.68],
          [0.78, 0.74],
          [0.33, 0.75],
        ],
        0.36,
      ),
    );
    g.add(
      profile(
        kit,
        "#bcd6ee",
        [
          [0.54, 0.86],
          [0.73, 0.8],
          [0.62, 0.99],
        ],
        0.22,
        0,
        { glass: true },
      ),
    );
    g.add(
      profile(
        kit,
        R,
        [
          [-0.12, 0.78],
          [0.3, 0.8],
          [0.42, 0.92],
          [0.1, 0.99],
          [-0.15, 0.92],
        ],
        0.3,
      ),
    );
    g.add(
      profile(
        kit,
        BLACK,
        [
          [-0.45, 0.86],
          [-0.12, 0.82],
          [-0.12, 0.89],
          [-0.45, 0.93],
        ],
        0.24,
      ),
    );
    g.add(
      profile(
        kit,
        W,
        [
          [-0.38, 0.82],
          [-0.82, 0.96],
          [-0.9, 1.03],
          [-0.56, 1.0],
          [-0.36, 0.92],
        ],
        0.22,
      ),
    );
    g.add(
      profile(
        kit,
        R,
        [
          [-0.6, 0.9],
          [-0.84, 0.97],
          [-0.88, 1.01],
          [-0.62, 0.98],
        ],
        0.23,
      ),
    );
    for (const z of [-0.07, 0.07])
      g.add(box(kit, LAMP, [0.8, 0.66, z - 0.04], [0.85, 0.7, z + 0.04], { emissive: true }));
    g.add(bars(kit, 0.46, 0.86, 0.17, BLACK));
    g.add(
      rider(kit, {
        hip: [-0.28, 0.92],
        shoulder: [0.14, 1.12],
        hand: [0.44, 0.88],
        foot: [-0.25, 0.5],
        helmet: W,
        visor: "#29323d",
      }),
    );
  },
  rally(kit, g) {
    const O = "#f26a1b";
    const N = "#1d2d5c";
    const W = "#f2f2ef";
    const GOLD = "#d4a53a";
    g.add(wheel(kit, -0.72, { r: 0.37, tyre: 0.075, rim: GOLD, kind: "spoke", knobby: true }));
    g.add(wheel(kit, 0.82, { r: 0.4, tyre: 0.07, rim: GOLD, kind: "spoke", knobby: true }));
    g.add(tube(kit, ENGINE, [-0.72, 0.37, 0], [-0.1, 0.48, 0], 0.035));
    g.add(box(kit, ENGINE, [-0.15, 0.32, -0.12], [0.22, 0.66, 0.12]));
    g.add(box(kit, O, [-0.2, 0.26, -0.13], [0.28, 0.34, 0.13]));
    for (const z of [-0.09, 0.09]) {
      g.add(tube(kit, CHROME, [0.82, 0.4, z], [0.56, 1.08, z], 0.03, { metal: true }));
      g.add(tube(kit, O, [0.78, 0.48, z * 1.2], [0.7, 0.72, z * 1.2], 0.04));
    }
    g.add(
      profile(
        kit,
        O,
        [
          [0.62, 0.92],
          [1.04, 0.86],
          [1.07, 0.9],
          [0.66, 0.99],
        ],
        0.16,
      ),
    );
    g.add(
      profile(
        kit,
        O,
        [
          [0.42, 0.95],
          [0.66, 0.98],
          [0.71, 1.35],
          [0.52, 1.4],
          [0.4, 1.2],
        ],
        0.3,
      ),
    );
    g.add(
      profile(
        kit,
        "#bcd6ee",
        [
          [0.52, 1.4],
          [0.71, 1.35],
          [0.63, 1.56],
        ],
        0.26,
        0,
        { glass: true },
      ),
    );
    g.add(
      profile(
        kit,
        O,
        [
          [-0.15, 0.7],
          [0.42, 0.72],
          [0.48, 1.02],
          [0.1, 1.1],
          [-0.15, 0.98],
        ],
        0.5,
      ),
    );
    g.add(
      profile(
        kit,
        N,
        [
          [-0.1, 0.71],
          [0.42, 0.73],
          [0.44, 0.82],
          [-0.1, 0.83],
        ],
        0.52,
      ),
    );
    g.add(
      profile(
        kit,
        N,
        [
          [-0.62, 1.05],
          [0.14, 1.05],
          [0.16, 1.12],
          [-0.62, 1.12],
        ],
        0.26,
      ),
    );
    g.add(
      profile(
        kit,
        W,
        [
          [-0.6, 0.98],
          [-0.98, 1.05],
          [-0.98, 1.11],
          [-0.6, 1.08],
        ],
        0.2,
      ),
    );
    g.add(tube(kit, CHROME, [-0.1, 0.6, 0.18], [-0.64, 1.0, 0.18], 0.045, { metal: true }));
    g.add(headlight(kit, 0.69, 1.12, 0.06, O));
    g.add(bars(kit, 0.5, 1.22, 0.32, BLACK));
    g.add(
      rider(kit, {
        hip: [-0.1, 1.2],
        shoulder: [0.08, 1.64],
        hand: [0.48, 1.24],
        foot: [-0.05, 0.56],
        helmet: W,
        visor: O,
      }),
    );
  },
  cafe(kit, g) {
    const G = "#1f4d36";
    const C = "#efe2c4";
    g.add(wheel(kit, -0.68, { r: 0.33, tyre: 0.065, rim: CHROME, kind: "spoke" }));
    g.add(wheel(kit, 0.72, { r: 0.33, tyre: 0.06, rim: CHROME, kind: "spoke" }));
    g.add(tube(kit, BLACK, [-0.68, 0.33, 0], [-0.1, 0.42, 0], 0.03));
    g.add(box(kit, CHROME, [-0.14, 0.24, -0.15], [0.3, 0.56, 0.15], { metal: true }));
    for (let i = 0; i < 4; i++)
      g.add(box(kit, ENGINE, [-0.05 + i * 0.08, 0.4, -0.16], [0.0 + i * 0.08, 0.6, 0.16]));
    for (const z of [-0.17, 0.17])
      g.add(tube(kit, CHROME, [0.22, 0.3, z], [-0.86, 0.4, z], 0.04, { metal: true }));
    for (const z of [-0.08, 0.08])
      g.add(tube(kit, CHROME, [0.72, 0.33, z], [0.55, 0.88, z], 0.026, { metal: true }));
    g.add(
      profile(
        kit,
        G,
        [
          [-0.15, 0.8],
          [0.45, 0.82],
          [0.5, 0.92],
          [0.25, 1.02],
          [-0.1, 1.0],
        ],
        0.32,
      ),
    );
    g.add(box(kit, C, [-0.08, 0.985, -0.035], [0.32, 1.035, 0.035]));
    g.add(
      profile(
        kit,
        "#3b2a22",
        [
          [-0.45, 0.86],
          [-0.15, 0.84],
          [-0.15, 0.9],
          [-0.45, 0.92],
        ],
        0.26,
      ),
    );
    g.add(
      profile(
        kit,
        G,
        [
          [-0.45, 0.86],
          [-0.8, 0.9],
          [-0.82, 1.0],
          [-0.52, 1.02],
          [-0.43, 0.94],
        ],
        0.26,
      ),
    );
    g.add(
      profile(
        kit,
        C,
        [
          [-0.6, 0.97],
          [-0.78, 0.96],
          [-0.79, 0.99],
          [-0.6, 1.0],
        ],
        0.27,
      ),
    );
    g.add(headlight(kit, 0.66, 0.86, 0.1, CHROME));
    for (const z of [-0.18, 0.18])
      g.add(tube(kit, BLACK, [0.5, 0.86, z * 0.4], [0.44, 0.82, z], 0.018));
    g.add(
      rider(kit, {
        hip: [-0.33, 0.96],
        shoulder: [0.05, 1.14],
        hand: [0.43, 0.84],
        foot: [-0.25, 0.5],
        helmet: C,
        visor: "#29323d",
      }),
    );
  },
  scrambler(kit, g) {
    const Y = "#f2b705";
    g.add(wheel(kit, -0.68, { r: 0.34, tyre: 0.075, rim: BLACK, kind: "spoke", knobby: true }));
    g.add(wheel(kit, 0.72, { r: 0.36, tyre: 0.07, rim: BLACK, kind: "spoke", knobby: true }));
    g.add(tube(kit, BLACK, [-0.68, 0.34, 0], [-0.1, 0.44, 0], 0.03));
    g.add(box(kit, BLACK, [-0.16, 0.24, -0.14], [0.28, 0.56, 0.14]));
    g.add(box(kit, CHROME, [0.0, 0.3, -0.15], [0.2, 0.5, 0.15], { metal: true }));
    for (const z of [-0.08, 0.08]) {
      g.add(tube(kit, BLACK, [0.72, 0.36, z], [0.55, 0.96, z], 0.035));
    }
    g.add(tube(kit, CHROME, [0.0, 0.42, 0.17], [-0.56, 0.84, 0.17], 0.045, { metal: true }));
    g.add(
      profile(
        kit,
        Y,
        [
          [0.6, 0.72],
          [0.95, 0.7],
          [0.96, 0.74],
          [0.62, 0.77],
        ],
        0.16,
      ),
    );
    g.add(
      profile(
        kit,
        Y,
        [
          [-0.1, 0.78],
          [0.42, 0.8],
          [0.45, 0.9],
          [0.2, 1.02],
          [-0.1, 0.98],
        ],
        0.36,
      ),
    );
    g.add(
      profile(
        kit,
        BLACK,
        [
          [-0.1, 0.78],
          [0.3, 0.8],
          [0.28, 0.86],
          [-0.1, 0.86],
        ],
        0.38,
      ),
    );
    g.add(
      profile(
        kit,
        "#a8774a",
        [
          [-0.62, 0.88],
          [-0.08, 0.86],
          [-0.08, 0.93],
          [-0.62, 0.95],
        ],
        0.28,
      ),
    );
    g.add(
      profile(
        kit,
        BLACK,
        [
          [-0.6, 0.84],
          [-0.86, 0.86],
          [-0.86, 0.9],
          [-0.6, 0.9],
        ],
        0.18,
      ),
    );
    g.add(headlight(kit, 0.62, 0.98, 0.09, BLACK));
    g.add(bars(kit, 0.5, 1.13, 0.38, BLACK));
    g.add(
      rider(kit, {
        hip: [-0.32, 0.98],
        shoulder: [-0.16, 1.45],
        hand: [0.47, 1.13],
        foot: [-0.08, 0.5],
        helmet: Y,
        visor: "#29323d",
      }),
    );
  },
  adv(kit, g) {
    const W = "#f1f2f4";
    const B = "#1e5bb8";
    const R = "#d6312d";
    const AL = "#b9c0c7";
    g.add(wheel(kit, -0.72, { r: 0.38, tyre: 0.08, rim: "#2c2f35", kind: "spoke", knobby: true }));
    g.add(wheel(kit, 0.82, { r: 0.4, tyre: 0.07, rim: "#2c2f35", kind: "spoke", knobby: true }));
    g.add(tube(kit, ENGINE, [-0.72, 0.38, 0.06], [-0.1, 0.46, 0.06], 0.05));
    g.add(tube(kit, AL, [0.18, 0.44, -0.38], [0.18, 0.44, 0.38], 0.085, { metal: true }));
    for (const z of [-0.4, 0.4])
      g.add(box(kit, ENGINE, [0.1, 0.36, z - 0.05], [0.28, 0.52, z + 0.05]));
    g.add(box(kit, ENGINE, [-0.15, 0.28, -0.14], [0.3, 0.62, 0.14]));
    for (const z of [-0.09, 0.09]) g.add(tube(kit, ENGINE, [0.82, 0.4, z], [0.6, 1.0, z], 0.034));
    g.add(
      profile(
        kit,
        W,
        [
          [0.62, 0.82],
          [0.96, 0.62],
          [0.99, 0.66],
          [0.68, 0.93],
        ],
        0.2,
      ),
    );
    g.add(
      profile(
        kit,
        B,
        [
          [0.7, 0.76],
          [0.94, 0.64],
          [0.96, 0.67],
          [0.73, 0.8],
        ],
        0.21,
      ),
    );
    g.add(
      profile(
        kit,
        W,
        [
          [-0.15, 0.78],
          [0.55, 0.82],
          [0.62, 1.08],
          [0.2, 1.18],
          [-0.15, 1.05],
        ],
        0.5,
      ),
    );
    g.add(
      profile(
        kit,
        B,
        [
          [-0.12, 0.8],
          [0.52, 0.84],
          [0.54, 0.92],
          [-0.12, 0.9],
        ],
        0.52,
      ),
    );
    g.add(
      profile(
        kit,
        R,
        [
          [0.1, 1.12],
          [0.45, 1.07],
          [0.46, 1.1],
          [0.12, 1.15],
        ],
        0.3,
      ),
    );
    g.add(
      profile(
        kit,
        "#bcd6ee",
        [
          [0.5, 1.08],
          [0.68, 1.05],
          [0.63, 1.46],
          [0.5, 1.42],
        ],
        0.32,
        0,
        { glass: true },
      ),
    );
    g.add(
      profile(
        kit,
        BLACK,
        [
          [-0.55, 1.0],
          [-0.12, 0.98],
          [-0.12, 1.05],
          [-0.55, 1.06],
        ],
        0.3,
      ),
    );
    for (const side of [-1, 1]) {
      g.add(
        box(
          kit,
          AL,
          [-0.88, 0.48, side > 0 ? 0.22 : -0.42],
          [-0.36, 0.95, side > 0 ? 0.42 : -0.22],
          { metal: true },
        ),
      );
    }
    g.add(box(kit, AL, [-0.95, 1.06, -0.18], [-0.52, 1.34, 0.18], { metal: true }));
    g.add(headlight(kit, 0.72, 0.98, 0.07, W));
    g.add(bars(kit, 0.46, 1.26, 0.36, BLACK));
    g.add(
      rider(kit, {
        hip: [-0.3, 1.12],
        shoulder: [-0.14, 1.6],
        hand: [0.44, 1.26],
        foot: [-0.08, 0.58],
        helmet: W,
        visor: B,
      }),
    );
  },
  bobber(kit, g) {
    const K = "#121316";
    g.add(wheel(kit, -0.78, { r: 0.34, tyre: 0.1, rim: CHROME, kind: "disc" }));
    g.add(wheel(kit, 0.84, { r: 0.34, tyre: 0.09, rim: CHROME, kind: "disc" }));
    g.add(tube(kit, K, [-0.78, 0.34, 0], [-0.15, 0.38, 0], 0.04));
    g.add(box(kit, ENGINE, [-0.1, 0.18, -0.15], [0.4, 0.42, 0.15]));
    g.add(tube(kit, CHROME, [0.08, 0.3, 0], [-0.1, 0.7, 0], 0.095, { metal: true }));
    g.add(tube(kit, CHROME, [0.2, 0.3, 0], [0.38, 0.7, 0], 0.095, { metal: true }));
    for (const z of [-0.2, 0.2])
      g.add(tube(kit, CHROME, [0.05, 0.28, z], [-1.02, 0.32, z], 0.05, { metal: true }));
    for (const z of [-0.11, 0.11])
      g.add(tube(kit, CHROME, [0.84, 0.34, z], [0.62, 0.95, z], 0.045, { metal: true }));
    g.add(
      profile(
        kit,
        K,
        [
          [-0.15, 0.72],
          [0.45, 0.74],
          [0.48, 0.85],
          [0.2, 0.93],
          [-0.15, 0.88],
        ],
        0.44,
      ),
    );
    g.add(box(kit, CHROME, [0.05, 0.92, -0.04], [0.32, 0.95, 0.04], { metal: true }));
    g.add(
      profile(
        kit,
        "#3a2418",
        [
          [-0.5, 0.66],
          [-0.12, 0.7],
          [-0.12, 0.78],
          [-0.5, 0.75],
        ],
        0.34,
      ),
    );
    g.add(
      profile(
        kit,
        K,
        [
          [-0.62, 0.44],
          [-1.1, 0.4],
          [-1.14, 0.58],
          [-0.86, 0.69],
          [-0.55, 0.62],
        ],
        0.36,
      ),
    );
    g.add(
      profile(
        kit,
        K,
        [
          [0.6, 0.58],
          [1.08, 0.5],
          [1.1, 0.56],
          [0.7, 0.66],
        ],
        0.26,
      ),
    );
    g.add(headlight(kit, 0.7, 0.9, 0.12, CHROME));
    g.add(bars(kit, 0.52, 1.04, 0.4, CHROME));
    g.add(
      rider(kit, {
        hip: [-0.32, 0.82],
        shoulder: [-0.36, 1.32],
        hand: [0.5, 1.04],
        foot: [0.44, 0.42],
        helmet: K,
        visor: "#3a3d44",
      }),
    );
  },
  classic(kit, g) {
    const S = "#c3c8ce";
    const S2 = "#8f969f";
    g.add(wheel(kit, -0.68, { r: 0.33, tyre: 0.07, rim: BLACK, kind: "cast" }));
    g.add(wheel(kit, 0.7, { r: 0.33, tyre: 0.065, rim: BLACK, kind: "cast" }));
    g.add(tube(kit, BLACK, [-0.68, 0.33, 0], [-0.1, 0.42, 0], 0.032));
    g.add(box(kit, BLACK, [-0.16, 0.22, -0.13], [0.26, 0.58, 0.13]));
    g.add(tube(kit, BLACK, [0.0, 0.32, 0.16], [-0.46, 0.46, 0.17], 0.055));
    for (const z of [-0.08, 0.08]) g.add(tube(kit, BLACK, [0.7, 0.33, z], [0.52, 0.94, z], 0.034));
    g.add(
      profile(
        kit,
        S,
        [
          [-0.12, 0.8],
          [0.4, 0.82],
          [0.45, 0.95],
          [0.15, 1.02],
          [-0.12, 0.98],
        ],
        0.34,
      ),
    );
    g.add(
      profile(
        kit,
        S2,
        [
          [-0.1, 0.81],
          [0.32, 0.83],
          [0.3, 0.9],
          [-0.1, 0.9],
        ],
        0.36,
      ),
    );
    g.add(
      profile(
        kit,
        "#2b2b2e",
        [
          [-0.6, 0.88],
          [-0.1, 0.86],
          [-0.1, 0.92],
          [-0.6, 0.95],
        ],
        0.28,
      ),
    );
    g.add(
      profile(
        kit,
        S,
        [
          [-0.58, 0.86],
          [-0.86, 0.95],
          [-0.86, 0.99],
          [-0.58, 0.97],
        ],
        0.2,
      ),
    );
    g.add(headlight(kit, 0.62, 0.96, 0.09, BLACK));
    g.add(bars(kit, 0.48, 1.12, 0.36, BLACK));
    g.add(
      rider(kit, {
        hip: [-0.3, 0.98],
        shoulder: [-0.15, 1.45],
        hand: [0.46, 1.12],
        foot: [-0.08, 0.5],
        helmet: "#8a2a22",
        visor: "#29323d",
      }),
    );
  },
};

export const BIKE_NAMES: Record<BikeKind, string> = {
  superbike: "WinZO · superbike (Fireblade-inspired)",
  rally: "Zingle · Dakar rally (KTM-inspired)",
  cafe: "Expresso · café racer (Triumph-inspired)",
  scrambler: "Fun · scrambler (Ducati-inspired)",
  adv: "Astro · adventure (GSA-inspired)",
  bobber: "Personal · bobber (Fat Boy-inspired)",
  classic: "Murphy · roadster (Guerrilla 450-inspired, silver)",
};

export function buildBike(kit: Kit, kind: BikeKind): THREE.Group {
  const g = new THREE.Group();
  BIKES[kind](kit, g);
  return g;
}
