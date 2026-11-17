/**
 * The toy train: an engine and two coaches running on the line round the
 * world. It waits at the station (~20 s), whistles, pulls away, runs once
 * round the loop and slows to a stop at the platform again, over and over.
 * Every car is solid: it never runs you over, you bounce off it.
 */

import * as THREE from "three";
import { mix, paperShadow, toy } from "../flat/kit";
import type { TrainLine } from "../lib/journey";
import { PASTEL } from "../lib/palette";
import type { Blocker } from "./bike";

/** The cars, measured along the line from the engine's middle (m), and their half-lengths. */
const CARS: [number, string, number][] = (() => {
  const ENGINE = 2.2;
  const COACH = 2.3;
  const GAP = 0.45;
  const c1 = -(ENGINE + GAP + COACH);
  const c2 = c1 - (2 * COACH + GAP);
  return [
    [0, "engine", ENGINE],
    [c1, "coachAqua", COACH],
    [c2, "coachMarigold", COACH],
    [-(ENGINE + GAP / 2), "coupler", 0],
    [c1 - COACH - GAP / 2, "coupler", 0],
  ];
})();
/** From the engine's middle to the middle of the whole train. */
const MID = (CARS[0]?.[0] ?? 0) / 2 + (CARS[2]?.[0] ?? 0) / 2;

const DWELL = 20;
const TOP = 9;
const ACCEL = 1.1;

export class Train {
  readonly group = new THREE.Group();
  /** Solid circles along each car (refreshed every frame). */
  readonly solid: Blocker[] = [];
  private readonly cars: { off: number; half: number; mesh: THREE.Mesh; shadow: THREE.Mesh }[] = [];
  /** How far the engine is along the line (m), its speed, and what it's doing. */
  private s: number;
  private v = 0;
  private left = 0;
  private wait = 6;
  /** Fires when it whistles (with the train's position, for the volume). */
  onWhistle: ((x: number, z: number) => void) | null = null;

  constructor(
    private readonly line: TrainLine,
    material: THREE.Material,
    ground: string,
    private readonly size: { w: number; d: number },
  ) {
    const shadow = paperShadow(mix(ground, PASTEL.ink, 0.13));
    for (const [off, id, half] of CARS) {
      const geo = toy(id);
      const mesh = new THREE.Mesh(geo, material);
      const sh = new THREE.Mesh(geo, shadow);
      sh.frustumCulled = false;
      this.group.add(mesh, sh);
      this.cars.push({ off, half, mesh, shadow: sh });
    }
    // Waiting at the platform, centred on it.
    this.s = line.station - MID;
  }

  /** The point and heading `d` metres along the line (wrapped into one loop). */
  private at(d: number): { x: number; z: number; yaw: number } {
    const { s, pts, from, period } = this.line;
    let u = (((d - from) % period) + period) % period;
    u += from;
    let lo = 0;
    let hi = s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((s[mid] as number) < u) lo = mid;
      else hi = mid;
    }
    const t = (u - (s[lo] as number)) / ((s[hi] as number) - (s[lo] as number) || 1);
    const [ax, az] = pts[lo] as [number, number];
    const [bx, bz] = pts[hi] as [number, number];
    return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw: Math.atan2(bx - ax, bz - az) };
  }

  update(dt: number, bike: { x: number; z: number }): void {
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        // All aboard: a whistle, then off round the world.
        this.left = this.line.period;
        const p = this.at(this.s);
        this.onWhistle?.(p.x, p.z);
      }
    } else {
      // Pull away gently; brake to stop at the platform exactly a loop later.
      const brake = Math.sqrt(2 * ACCEL * Math.max(0, this.left));
      this.v = Math.min(TOP, this.v + ACCEL * dt, brake);
      const step = Math.min(this.left, this.v * dt);
      this.s += step;
      this.left -= step;
      if (this.left <= 0.01) {
        this.v = 0;
        this.wait = DWELL;
        this.s = this.line.station - MID;
      }
    }
    this.solid.length = 0;
    for (const c of this.cars) {
      const p = this.at(this.s + c.off);
      // The copy nearest you (the world wraps).
      const x = p.x - this.size.w * Math.round((p.x - bike.x) / this.size.w);
      const z = p.z - this.size.d * Math.round((p.z - bike.z) / this.size.d);
      c.mesh.position.set(x, 0.12, z);
      c.mesh.rotation.set(0, p.yaw, 0);
      c.shadow.position.copy(c.mesh.position);
      c.shadow.rotation.copy(c.mesh.rotation);
      if (c.half > 0) {
        const fx = Math.sin(p.yaw);
        const fz = Math.cos(p.yaw);
        for (let k = -c.half + 0.9; k <= c.half - 0.9 + 1e-3; k += (c.half * 2 - 1.8) / 2)
          this.solid.push({ x: x + fx * k, z: z + fz * k, r: 0.95 });
      }
    }
  }

  /** Where the engine's front is, and which way it's going (for its headlamp). */
  head(): { x: number; z: number; heading: number } {
    const m = this.cars[0]?.mesh;
    if (!m) return { x: 0, z: 0, heading: 0 };
    const yaw = m.rotation.y;
    return {
      x: m.position.x + Math.sin(yaw) * 2.4,
      z: m.position.z + Math.cos(yaw) * 2.4,
      heading: yaw,
    };
  }

  dispose(): void {
    this.group.clear();
  }
}
