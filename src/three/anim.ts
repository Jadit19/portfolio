/** Frame-rate independent smoothing helpers. */

import type * as THREE from "three";

/** Exponential approach: moves `a` toward `b`; `lambda` ≈ 1 / time-constant. */
export function damp(a: number, b: number, lambda: number, dt: number): number {
  return b + (a - b) * Math.exp(-lambda * dt);
}

export function dampV3(a: THREE.Vector3, b: THREE.Vector3, lambda: number, dt: number): void {
  const k = Math.exp(-lambda * dt);
  a.set(b.x + (a.x - b.x) * k, b.y + (a.y - b.y) * k, b.z + (a.z - b.z) * k);
}

/** Shortest signed difference between two angles. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeIn = (t: number) => t * t * t;

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Critically damped spring toward a target (Game Programming Gems 4, 1.10):
 * eases in and out with no overshoot. `smooth` ≈ time to reach the target.
 */
export class SpringV3 {
  readonly value: THREE.Vector3;
  private readonly vel: THREE.Vector3;

  constructor(v: THREE.Vector3) {
    this.value = v.clone();
    this.vel = v.clone().set(0, 0, 0);
  }

  snap(v: THREE.Vector3): void {
    this.value.copy(v);
    this.vel.set(0, 0, 0);
  }

  /** Moves the value without disturbing the motion (e.g. the world wrapping round). */
  snapKeepVelocity(v: THREE.Vector3): void {
    this.value.copy(v);
  }

  step(target: THREE.Vector3, smooth: number, dt: number): THREE.Vector3 {
    const omega = 2 / Math.max(1e-4, smooth);
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    for (const k of ["x", "y", "z"] as const) {
      const change = this.value[k] - target[k];
      const temp = (this.vel[k] + omega * change) * dt;
      this.vel[k] = (this.vel[k] - omega * temp) * exp;
      this.value[k] = target[k] + (change + temp) * exp;
    }
    return this.value;
  }
}

/** A damped spring state (position, velocity). */
export interface Spring1 {
  x: number;
  v: number;
}

/**
 * Advances a damped spring toward `target` (angular frequency `omega`,
 * damping ratio `zeta`; zeta < 1 overshoots a little). Sub-stepped so stiff
 * springs stay stable at low frame rates.
 */
export function stepSpring(
  s: Spring1,
  target: number,
  omega: number,
  zeta: number,
  dt: number,
): number {
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = -2 * zeta * omega * s.v - omega * omega * (s.x - target);
    s.v += a * h;
    s.x += s.v * h;
  }
  return s.x;
}
