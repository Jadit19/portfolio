/**
 * The garage floor plan, shared by the scene, the bike rigs and the guide.
 *
 *   back wall (z = -5.2) ───┐ doorway ┌─────────────────
 *                            lanes ↘ ↗
 *                  A → B           ◯ turntable P
 *        ┌──────────────┐
 *        │  map table   │
 *        └──────────────┘
 */

import * as THREE from "three";

export const BIKE_SCALE = 1.25;
export const PLINTH_TOP = 0.1;
export const PLINTH_R = 1.5;
/** Turntable centre, behind and right of the table. */
export const P = new THREE.Vector3(1.9, 0, -3.3);
/** How a parked bike presents itself (¾ front, facing the camera's right). */
export const PRESENT = -0.8;
/** Unit forward of a presented bike, and its back and left/right. */
export const FWD = new THREE.Vector3(Math.cos(PRESENT), 0, -Math.sin(PRESENT));
export const BACK = FWD.clone().negate();
export const LAT = new THREE.Vector3(FWD.z, 0, -FWD.x);

export const WALL_Z = -5.2;
/** Doorway in the back wall, through which bikes come and go. */
/** The right-hand wall, at 90° to the back (passport) wall. */
export const SIDE_X = 5.4;
/** The garage door in the right-hand wall, beside the turntable (spans z). */
export const DOOR = { z0: -4.85, z1: -1.75, h: 2.4, depth: 0.9 };

/** The jacket rack where the doorway used to be: rail span and height. */
export const RACK = { x0: -1.4, x1: 1.45, y: 2.05 };

export const TABLE = { x: 1.9, z: 1.5, top: 1.0 };

/**
 * Adit's spots: behind the table (table view), and a short stroll away at the
 * turntable's side (inspect), facing you, never between you and the bike.
 */
export const GUIDE_TABLE = new THREE.Vector3(-0.55, 0, -1.95);
export const GUIDE_INSPECT = new THREE.Vector3(0.4, 0, -2.2);
export const GUIDE_PATH = new THREE.CatmullRomCurve3(
  [GUIDE_TABLE, new THREE.Vector3(-0.05, 0, -2.12), GUIDE_INSPECT],
  false,
  "centripetal",
);

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Floor height at (x, z): the turntable top, with a soft rounded edge. */
export function groundAt(x: number, z: number): number {
  const d = Math.hypot(x - P.x, z - P.z);
  return PLINTH_TOP * smoothstep(PLINTH_R + 0.04, PLINTH_R - 0.04, d);
}

/**
 * A lane from outside the garage door (right-hand wall) straight in and onto
 * the turntable (outside → centre). `side` −1 is the way out, +1 the way in:
 * two parallel lanes through the wide door, joining only at the turntable,
 * which the scene keeps one bike at a time. Bikes ride in heading west; the
 * turntable then turns them to face you, and back to face the door to leave.
 */
export function lane(side: -1 | 1): THREE.CatmullRomCurve3 {
  const z = P.z + side * 0.75;
  return new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(SIDE_X + 2.3, 0, z),
      new THREE.Vector3(SIDE_X + 1.2, 0, z),
      new THREE.Vector3(SIDE_X - 0.3, 0, z),
      new THREE.Vector3(P.x + 2.2, 0, P.z + side * 0.75),
      new THREE.Vector3(P.x + 1.15, 0, P.z + side * 0.42),
      // Both lanes finish dead straight from the same side, so a bike rolls in
      // and reverses out at exactly the same angle: the turntable never turns.
      new THREE.Vector3(P.x + 0.6, 0, P.z),
      P.clone(),
    ],
    false,
    "centripetal",
  );
}

/** Murphy's parking spot by the left wall. She rides from here to the turntable and backs home. */
export const MURPHY_SPOT = new THREE.Vector3(-4.1, 0, -3.95);
export const MURPHY_PATH = new THREE.CatmullRomCurve3(
  [
    MURPHY_SPOT,
    new THREE.Vector3(-2.7, 0, -3.78),
    new THREE.Vector3(-1.2, 0, -3.55),
    new THREE.Vector3(0.0, 0, -3.4),
    new THREE.Vector3(1.0, 0, -3.32),
    P.clone(),
  ],
  false,
  "centripetal",
);

/** The passport pin board, on the back wall above Murphy's spot. */
export const STAMP_BOARD = { x: -3.55, y: 2.35, z: WALL_Z + 0.03, w: 2.7, h: 1.54 };
