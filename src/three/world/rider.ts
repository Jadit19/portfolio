/**
 * What you see riding: the world's hero bike with Adit on it, in his black
 * jacket and helmet. Follows the physics: heading, pitch with the ground
 * (nose up uphill, down downhill), lean into corners, spinning wheels, and a
 * rider who tucks in and leans a little deeper than the bike.
 */

import * as THREE from "three";
import type { BikeKind } from "../../content/types";
import { type Spring1, stepSpring } from "../anim";
import { BIKE_SCALE } from "../garage/space";
import { aditRig, dress, RIG_JOINTS } from "../lib/adit";
import { heroBike } from "../lib/hero";
import type { Kit } from "../lib/kit";
import { batch } from "../merge";
import type { Ground } from "./ground";

export interface Pose {
  at: readonly [number, number, number];
  thigh: number;
  shin: number;
  torso: number;
  arm: number;
  fore: number;
  head: number;
}

/** Seated pose on the café racer: low seat, rear-set pegs, clip-ons. */
const CAFE: Pose = {
  at: [-0.36, 0.12, 0] as const,
  thigh: 0.94,
  shin: -1.38,
  torso: -0.78,
  arm: 1.12,
  fore: 0.42,
  head: 0.62,
};

/** Sitting up on an adventure bike: tall seat, pegs below, wide bars up high. */
const ADV: Pose = {
  at: [-0.3, 0.3, 0],
  thigh: 0.76,
  shin: -0.94,
  torso: -0.24,
  arm: 0.86,
  fore: 0.62,
  head: 0.22,
};

/** Rally: tall seat, sitting up and forward over the tower, elbows out. */
const RALLY: Pose = {
  at: [-0.26, 0.36, 0],
  thigh: 0.72,
  shin: -0.92,
  torso: -0.38,
  arm: 0.92,
  fore: 0.56,
  head: 0.34,
};

/** Superbike: tucked in behind the screen, knees gripping, chin over the tank. */
const SUPERBIKE: Pose = {
  at: [-0.34, 0.2, 0],
  thigh: 1.02,
  shin: -1.52,
  torso: -0.96,
  arm: 1.18,
  fore: 0.34,
  head: 0.82,
};

export const POSES: Partial<Record<BikeKind, Pose>> = {
  cafe: CAFE,
  adv: ADV,
  rally: RALLY,
  superbike: SUPERBIKE,
};

interface Wheel {
  obj: THREE.Object3D;
  r: number;
}

/** The seated pose for a bike (the café racer's when it has none of its own). */
export const seatPose = (kind: BikeKind): Pose => POSES[kind] ?? CAFE;

export class Rider {
  readonly root = new THREE.Group();
  private readonly leanGroup = new THREE.Group();
  private readonly wheels: Wheel[] = [];
  private readonly rig: THREE.Group;
  private readonly J: (n: string) => THREE.Object3D | undefined;
  private readonly pitch: Spring1 = { x: 0, v: 0 };
  private readonly heave: Spring1 = { x: 0, v: 0 };
  private readonly tuck: Spring1 = { x: 0, v: 0 };
  private readonly pose: Pose;

  constructor(kit: Kit, kind: BikeKind) {
    const POSE = POSES[kind] ?? CAFE;
    this.pose = POSE;
    const parked = heroBike(kit, kind, 0);
    // Riding: the side stand is folded away.
    const stand: THREE.Object3D[] = [];
    parked.traverse((o) => {
      if (o.userData.stand) stand.push(o);
    });
    for (const o of stand) o.removeFromParent();
    const bike = batch(parked, (o) => typeof o.userData.wheelRadius === "number");
    for (const c of [...bike.children]) {
      const r = c.userData.wheelRadius;
      if (typeof r === "number") this.wheels.push({ obj: c, r });
      this.leanGroup.add(c);
    }
    const rig = aditRig();
    dress(rig, { jacket: true, helmet: true });
    // Dressed before batching, so the shirt and hair layers are simply dropped.
    this.rig = batch(rig, (o) => RIG_JOINTS.has(o.name));
    this.rig.position.set(...POSE.at);
    this.J = (n) => this.rig.getObjectByName(n);
    for (const s of ["L", "R"]) {
      this.set(`leg${s}`, POSE.thigh);
      this.set(`shin${s}`, POSE.shin);
      this.set(`arm${s}`, POSE.arm);
      this.set(`fore${s}`, POSE.fore);
    }
    this.set("torso", POSE.torso);
    this.set("head", POSE.head);
    this.leanGroup.add(this.rig);
    this.root.add(this.leanGroup);
    this.root.scale.setScalar(BIKE_SCALE);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  private set(name: string, z: number): void {
    const j = this.J(name);
    if (j) j.rotation.z = z;
  }

  /**
   * @param s interpolated state: position, heading, lean, speed
   * @param accel forward acceleration (for the rider's tuck and the pitch dive)
   */
  update(
    ground: Ground,
    s: {
      x: number;
      z: number;
      heading: number;
      lean: number;
      v: number;
      steer: number;
      /** In the air (off a ramp): its height and vertical speed. */
      y?: number;
      air?: boolean;
      vy?: number;
    },
    accel: number,
    dt: number,
    reduced: boolean,
  ): void {
    const fx = Math.cos(s.heading);
    const fz = -Math.sin(s.heading);
    const half = 0.89;
    const yF = ground.height(s.x + fx * half, s.z + fz * half);
    const yR = ground.height(s.x - fx * half, s.z - fz * half);
    // In the air the nose follows the arc a little (up off the lip, then
    // level again to come down on both wheels).
    const slope = s.air
      ? THREE.MathUtils.clamp(Math.atan2(s.vy ?? 0, Math.abs(s.v) + 1) * 0.45, -0.12, 0.25)
      : Math.atan2(yF - yR, half * 2);
    // Braking dives the nose a touch; throttle squats it.
    const dive = THREE.MathUtils.clamp(-accel * 0.006, -0.05, 0.05);
    if (reduced) {
      this.pitch.x = slope;
      this.heave.x = 0;
    } else {
      stepSpring(this.pitch, slope - dive, 14, 0.8, dt);
      stepSpring(this.heave, 0, 18, 0.5, dt);
    }
    const y = s.air && s.y !== undefined ? s.y : (yF + yR) / 2;
    this.root.position.set(s.x, y + 0.06 + this.heave.x, s.z);
    this.root.rotation.set(0, s.heading, this.pitch.x);
    this.leanGroup.rotation.x = -s.lean;
    // Wheels roll with the distance covered.
    for (const w of this.wheels) w.obj.rotation.z -= (s.v * dt) / (w.r * BIKE_SCALE);
    // Tuck in at speed; sit up when slow. Lean the body a little deeper and keep the head level.
    stepSpring(this.tuck, THREE.MathUtils.clamp(Math.abs(s.v) / 22, 0, 1), 6, 1, dt);
    this.set("torso", this.pose.torso - this.tuck.x * 0.16);
    this.set("head", this.pose.head + this.tuck.x * 0.12);
    const hips = this.J("hips");
    if (hips) hips.rotation.x = -s.lean * 0.3;
    const head = this.J("head");
    if (head) {
      head.rotation.x = s.lean * 0.9;
      head.rotation.y = s.steer * 0.25;
    }
  }

  /** A little bounce (e.g. a knock or a bump). */
  bump(amount: number): void {
    this.heave.v -= amount;
  }
}
