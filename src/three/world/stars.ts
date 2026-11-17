/**
 * AstroClub's moment at a stop: at night, the stop's star (its constellation)
 * gathers in the sky above the landmark, twinkling, and stays while you're
 * there; ride away and it fades. By day the sky's too bright to see it.
 */

import * as THREE from "three";
import { constellation, type StarName } from "../lib/astroLandmarks";
import type { Moment } from "./rides";

/** What a moment can see of the world round it. */
export interface MomentEnv {
  /** 0 day … 1 night. */
  night(): number;
  bike(): { x: number; z: number };
  camera: THREE.Camera;
}

/** How near (m) counts as still being at the stop. */
const STAY = 24;

export class StarMoment implements Moment {
  readonly group = new THREE.Group();
  private readonly sky: THREE.Group;
  private readonly mats: { m: THREE.Material & { opacity: number }; base: number }[] = [];
  private readonly main: THREE.Object3D[] = [];
  private k = 0;
  private t = 0;

  constructor(
    star: StarName,
    private readonly at: THREE.Vector3,
    private readonly env: MomentEnv,
    height = 7,
  ) {
    // Glows over the night (drawn ungraded, on the night pass's overlay).
    this.group.userData.overlay = true;
    this.sky = constellation(star, 7);
    this.sky.position.set(at.x, at.y + height, at.z);
    this.group.add(this.sky);
    const seen = new Set<THREE.Material>();
    this.sky.traverse((o) => {
      const m = (o as THREE.Mesh).material as (THREE.Material & { opacity: number }) | undefined;
      if (!m || seen.has(m)) return;
      seen.add(m);
      m.transparent = true;
      m.depthWrite = false;
      this.mats.push({ m, base: m.opacity });
    });
    // The biggest discs are the star itself (and its glow): they twinkle.
    let biggest = 0;
    this.sky.traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.CircleGeometry | undefined;
      const r = g?.parameters?.radius;
      if (r !== undefined) biggest = Math.max(biggest, r);
    });
    this.sky.traverse((o) => {
      const r = ((o as THREE.Mesh).geometry as THREE.CircleGeometry | undefined)?.parameters
        ?.radius;
      if (r !== undefined && r > biggest * 0.6) this.main.push(o);
    });
    this.apply(0);
  }

  private apply(v: number): void {
    for (const { m, base } of this.mats) m.opacity = base * v;
    this.sky.visible = v > 0.005;
  }

  update(dt: number): boolean {
    this.t += dt;
    const b = this.env.bike();
    const here = Math.hypot(b.x - this.at.x, b.z - this.at.z) < STAY;
    // Gathers slowly; fades a little quicker once you've gone.
    this.k += ((here ? 1 : 0) - this.k) * Math.min(1, dt * (here ? 0.7 : 1.1));
    const n = this.env.night();
    const dark = n * n * (3 - 2 * n);
    this.apply(this.k * dark);
    // Face the camera, and twinkle.
    this.sky.quaternion.copy(this.env.camera.quaternion);
    const tw = 1 + Math.sin(this.t * 2.3) * 0.06 + Math.sin(this.t * 5.1) * 0.03;
    for (const o of this.main) o.scale.setScalar(tw);
    return here || this.k > 0.01 || this.t < 1;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.sky.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    for (const { m } of this.mats) m.dispose();
  }
}
