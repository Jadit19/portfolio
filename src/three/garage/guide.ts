/**
 * Adit, the guide, in the garage. He stands at the map table pointing at your
 * pick; when you inspect a bike he walks round to the turntable and presents
 * it, facing you. Procedural walk: legs and arms swing with stride, the body
 * bobs, and he turns into the walk and back toward what he's looking at.
 */

import * as THREE from "three";
import { angleDelta, type Spring1, stepSpring } from "../anim";
import { adit } from "../lib/adit";
import { batch } from "../merge";
import { BIKE_SCALE, GUIDE_PATH } from "./space";

const SPEED = 1.15;
const STRIDE = 5.2;

export class Guide {
  readonly root: THREE.Group;
  private readonly head: THREE.Object3D | null;
  private readonly legs: [THREE.Object3D | null, THREE.Object3D | null];
  private readonly arms: [THREE.Object3D | null, THREE.Object3D | null];
  private readonly len = GUIDE_PATH.getLength();
  private s = 0;
  private v = 0;
  private phase = 0;
  private yaw = 0;
  private readonly gesture: Spring1 = { x: 0, v: 0 };
  /** Head turn (yaw) and nod (pitch), on soft springs so the neck never snaps. */
  private readonly neckYaw: Spring1 = { x: 0, v: 0 };
  private readonly neckPitch: Spring1 = { x: 0, v: 0 };
  private readonly headAt = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tan = new THREE.Vector3();

  constructor() {
    const rigged = adit({ pose: "stand", toy: 0.35, rig: true });
    const live = new Set(["head", "legL", "legR", "armL", "armR"]);
    this.root = batch(rigged, (o) => live.has(o.name));
    this.root.scale.setScalar(BIKE_SCALE);
    const by = (n: string) => this.root.getObjectByName(n) ?? null;
    this.head = by("head");
    this.legs = [by("legL"), by("legR")];
    this.arms = [by("armL"), by("armR")];
    this.place();
  }

  /** Whether he's (nearly) at the turntable. */
  get atInspect(): boolean {
    return this.s > this.len - 0.05;
  }

  /**
   * @param inspect walk to the turntable (true) or the table (false)
   * @param face world point to face when standing still
   * @param look world point to look at (head)
   * @param eager follow `look` briskly (a moving cursor) rather than drift calmly
   */
  update(
    dt: number,
    t: number,
    inspect: boolean,
    face: THREE.Vector3,
    look: THREE.Vector3,
    reduced: boolean,
    eager = false,
  ): void {
    const target = inspect ? this.len : 0;
    if (reduced) {
      this.s = target;
      this.v = 0;
    } else {
      const d = target - this.s;
      const vDes = Math.sign(d) * Math.min(SPEED, Math.sqrt(2 * 1.6 * Math.abs(d)));
      this.v += THREE.MathUtils.clamp((vDes - this.v) * 5, -2.4, 2.4) * dt;
      this.s = THREE.MathUtils.clamp(this.s + this.v * dt, 0, this.len);
      if (Math.abs(d) < 0.003 && Math.abs(this.v) < 0.03) {
        this.s = target;
        this.v = 0;
      }
    }
    const walking = Math.min(1, Math.abs(this.v) / 0.7);
    this.phase += Math.abs(this.v) * dt * STRIDE;
    this.place();
    // Turn into the walk; when standing, turn toward what he's attending to.
    const p = this.root.position;
    GUIDE_PATH.getTangentAt(this.s / this.len, this.tan);
    const walkYaw = Math.atan2(
      -this.tan.z * Math.sign(this.v || 1),
      this.tan.x * Math.sign(this.v || 1),
    );
    const faceYaw = Math.atan2(-(face.z - p.z), face.x - p.x);
    const want = walking > 0.15 ? walkYaw : faceYaw;
    this.yaw += angleDelta(this.yaw, want) * (1 - Math.exp(-7 * dt));
    this.root.rotation.y = this.yaw;
    // Walk cycle.
    const swing = Math.sin(this.phase) * walking;
    const [legL, legR] = this.legs;
    if (legL) legL.rotation.z = swing * 0.5;
    if (legR) legR.rotation.z = -swing * 0.5;
    this.root.position.y = Math.abs(Math.sin(this.phase)) * 0.035 * walking;
    // Arms: swing while walking; at rest, point at the table or present the bike.
    stepSpring(this.gesture, walking > 0.2 ? 0 : 1, 7, 0.75, dt);
    const g = Math.max(0, this.gesture.x);
    // At the table his right hand points at the map; at the turntable his left
    // hand (the side nearer the bike as he faces you) presents it.
    const [armL, armR] = this.arms;
    if (armL) {
      const restZ = inspect ? 0.5 : 0;
      const restX = inspect ? 0.6 : 0.06;
      armL.rotation.z = -swing * 0.35 * (1 - g) + restZ * g;
      armL.rotation.x = 0.06 * (1 - g) + restX * g;
    }
    if (armR) {
      const restZ = inspect ? 0 : 1.1;
      const restX = inspect ? -0.06 : -0.05;
      armR.rotation.z = swing * 0.35 * (1 - g) + restZ * g;
      armR.rotation.x = -0.06 * (1 - g) + restX * g;
    }
    // Head: turn and nod toward `look` within a natural range. The limits are
    // soft (tanh), so he eases into the end of his range instead of hitting it,
    // and critically damped springs keep every move smooth, never a snap.
    if (this.head) {
      const local = this.root.worldToLocal(this.tmp.copy(look));
      this.root.worldToLocal(this.head.getWorldPosition(this.headAt));
      local.sub(this.headAt);
      const soft = (x: number, lim: number) => lim * Math.tanh(x / lim);
      const yaw = soft(Math.atan2(-local.z, local.x), 1.0);
      const pitch = soft(Math.atan2(local.y, Math.hypot(local.x, local.z)), 0.38);
      if (reduced) {
        this.neckYaw.x = yaw;
        this.neckPitch.x = pitch;
      } else {
        const w = eager ? 5.5 : 3;
        stepSpring(this.neckYaw, yaw, w, 1, dt);
        stepSpring(this.neckPitch, pitch, w, 1, dt);
      }
      this.head.rotation.y = this.neckYaw.x;
      this.head.rotation.z = this.neckPitch.x;
    }
    if (!reduced) this.root.scale.y = BIKE_SCALE * (1 + Math.sin(t * 1.6) * 0.006 * (1 - walking));
  }

  private place(): void {
    GUIDE_PATH.getPointAt(THREE.MathUtils.clamp(this.s / this.len, 0, 1), this.tmp);
    this.root.position.x = this.tmp.x;
    this.root.position.z = this.tmp.z;
  }

  /** Snap facing (first frame). */
  face(point: THREE.Vector3): void {
    const p = this.root.position;
    this.yaw = Math.atan2(-(point.z - p.z), point.x - p.x);
    this.root.rotation.y = this.yaw;
  }
}
