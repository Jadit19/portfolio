/**
 * The riding camera, shared by every journey: a third-person chase camera.
 *
 * - Two views: "low" (just behind and above the rider's shoulder, the
 *   default) and "high" (further back and up, more road ahead). V or the
 *   camera button switches; the choice is remembered.
 * - It swings round behind the bike with a little lag, so turns feel weighty.
 * - Drag to look around; after a moment it eases back behind you.
 * - It never dips into the ground, and widens slightly with speed.
 */

import * as THREE from "three";
import { angleDelta, SpringV3 } from "../anim";

export type CamMode = "low" | "high";

const VIEWS: Record<
  CamMode,
  { dist: number; distFast: number; up: number; ahead: number; lookUp: number; fov: number }
> = {
  low: { dist: 5.6, distFast: 7, up: 1.9, ahead: 3.5, lookUp: 1.25, fov: 56 },
  high: { dist: 10.5, distFast: 12.5, up: 5.2, ahead: 6, lookUp: 0.9, fov: 50 },
};
const KEY = "portfolio:camera";

export interface Follow {
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Forward speed (m/s) and the bike's top speed, for the speed feel. */
  v: number;
  top: number;
}

export class RideCamera {
  mode: CamMode = "low";
  /** The yaw the camera sits behind (follows the heading with a lag). */
  private yaw: number;
  /** Look-around from dragging: yaw and pitch offsets (radians). */
  private orbitYaw = 0;
  private orbitPitch = 0;
  private sinceDrag = 99;
  private readonly pos = new SpringV3(new THREE.Vector3());
  private readonly look = new SpringV3(new THREE.Vector3());
  private fov = VIEWS.low.fov;
  /** Blend between views when switching (0 = low … 1 = high). */
  private blend = 0;
  private readonly tmp = new THREE.Vector3();
  /** Something to turn and look at (e.g. the counter you've pulled over at), or null. */
  focus: THREE.Vector3 | null = null;

  /**
   * Flat worlds (the flat-world language): "low" is C1, a fixed three-quarter
   * view from high up (42° down, from the south-east) that slides along with
   * the bike and never turns; "high" is C5, the same height but swinging round
   * behind the rider. Pulling over at a stop eases to a closer fixed view of
   * the rider and the stop.
   */
  private readonly flat: boolean;

  constructor(heading: number, flat = false) {
    this.flat = flat;
    this.yaw = heading;
    try {
      if (localStorage.getItem(KEY) === "high") this.mode = "high";
    } catch {
      // Storage unavailable: start in the default view.
    }
    this.blend = this.mode === "high" ? 1 : 0;
  }

  toggle(): CamMode {
    this.mode = this.mode === "low" ? "high" : "low";
    try {
      localStorage.setItem(KEY, this.mode);
    } catch {
      // Not remembered; that's fine.
    }
    return this.mode;
  }

  /** Drag to look around (pixels moved; the canvas height scales the feel). */
  drag(dx: number, dy: number, height: number): void {
    const k = 3.2 / Math.max(300, height);
    this.orbitYaw = THREE.MathUtils.clamp(this.orbitYaw - dx * k, -Math.PI * 0.95, Math.PI * 0.95);
    this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * k, -0.25, 0.7);
    this.sinceDrag = 0;
  }

  /** The direction the camera looks along the ground (for the mini-map). */
  get viewYaw(): number {
    if (this.flat && !(this.mode === "high" && !this.focus)) {
      // C1 holds one world angle: it sits to the south-east and looks north-west.
      const a = Math.PI / 4 + this.orbitYaw;
      return Math.atan2(Math.cos(a), -Math.sin(a));
    }
    return this.yaw + this.orbitYaw;
  }

  private target(f: Follow, ground: (x: number, z: number) => number) {
    if (this.flat) {
      // Never inside a mountainside (flat worlds with mountains: keep well above the land).
      const v = this.flatTarget(f);
      const floor = ground(v.pos.x, v.pos.z) + 4;
      if (v.pos.y < floor) v.pos.y = floor;
      return v;
    }
    if (this.focus) return this.framing(f, this.focus, ground);
    const a = VIEWS.low;
    const b = VIEWS.high;
    const m = (k: keyof typeof a) => THREE.MathUtils.lerp(a[k], b[k], this.blend);
    const speed = THREE.MathUtils.clamp(Math.abs(f.v) / Math.max(1, f.top), 0, 1);
    const dist = THREE.MathUtils.lerp(m("dist"), m("distFast"), speed);
    const yaw = this.yaw + this.orbitYaw;
    const fx = Math.cos(yaw);
    const fz = -Math.sin(yaw);
    const pitchUp = this.orbitPitch * dist;
    const pos = new THREE.Vector3(
      f.x - fx * dist * Math.cos(this.orbitPitch * 0.6),
      f.y + m("up") + pitchUp,
      f.z - fz * dist * Math.cos(this.orbitPitch * 0.6),
    );
    // Never inside the hillside behind you.
    const floor = ground(pos.x, pos.z) + 0.9;
    if (pos.y < floor) pos.y = floor;
    const hx = Math.cos(f.heading);
    const hz = -Math.sin(f.heading);
    const ahead = m("ahead") * (0.6 + speed * 0.6);
    const look = new THREE.Vector3(f.x + hx * ahead, f.y + m("lookUp"), f.z + hz * ahead);
    return { pos, look, fov: m("fov") + speed * 8 };
  }

  /** The flat views (see the constructor). */
  private flatTarget(f: Follow) {
    const C1 = { elev: 42, dist: 34, fov: 38 };
    const near = { elev: 36, dist: 17, fov: 40 };
    const v = this.focus ? near : C1;
    // C1 and the stop view hold one world angle (camera to the south-east); C5 sits behind.
    const behind = this.mode === "high" && !this.focus;
    const yaw = behind ? this.yaw + Math.PI : Math.PI / 4 + this.orbitYaw;
    const e = THREE.MathUtils.degToRad(v.elev + this.orbitPitch * 20);
    // Behind the bike, "forward" is (cos h, −sin h), so the camera sits at −forward.
    const dx = behind ? -Math.cos(this.yaw) : Math.sin(yaw);
    const dz = behind ? Math.sin(this.yaw) : Math.cos(yaw);
    const centre = this.focus
      ? new THREE.Vector3(f.x, f.y, f.z).lerp(
          new THREE.Vector3(this.focus.x, f.y, this.focus.z),
          0.5,
        )
      : new THREE.Vector3(f.x + Math.cos(f.heading) * 2, f.y, f.z - Math.sin(f.heading) * 2);
    const pos = new THREE.Vector3(
      centre.x + dx * Math.cos(e) * v.dist,
      centre.y + Math.sin(e) * v.dist,
      centre.z + dz * Math.cos(e) * v.dist,
    );
    const look = centre.clone().add(new THREE.Vector3(0, 0.6, 0));
    return { pos, look, fov: v.fov };
  }

  /**
   * Turned toward a focus point: stand off to the rider's far side, a little
   * up, so both the rider and the thing beside them are in the shot.
   */
  private framing(f: Follow, at: THREE.Vector3, ground: (x: number, z: number) => number) {
    const away = new THREE.Vector3(f.x - at.x, 0, f.z - at.z);
    if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
    away.normalize();
    // Swing a little to the side so it's a three-quarter view, not head-on.
    const side = new THREE.Vector3(-away.z, 0, away.x);
    const pos = new THREE.Vector3(f.x, f.y, f.z)
      .addScaledVector(away, 4.2)
      .addScaledVector(side, 2.4)
      .add(new THREE.Vector3(0, 2.4, 0));
    const floor = ground(pos.x, pos.z) + 0.9;
    if (pos.y < floor) pos.y = floor;
    const look = new THREE.Vector3(f.x, f.y + 1.2, f.z).lerp(at, 0.62);
    return { pos, look, fov: 50 };
  }

  /** Moves the camera along with the world wrapping round (no visible jump). */
  shift(dx: number, dz: number): void {
    const d = new THREE.Vector3(dx, 0, dz);
    this.pos.snapKeepVelocity(this.pos.value.clone().add(d));
    this.look.snapKeepVelocity(this.look.value.clone().add(d));
    this.focus?.add(d);
  }

  /** Places the camera at once (first frame, or after a teleport). */
  snap(cam: THREE.PerspectiveCamera, f: Follow, ground: (x: number, z: number) => number): void {
    this.yaw = f.heading;
    const t = this.target(f, ground);
    this.pos.snap(t.pos);
    this.look.snap(t.look);
    this.fov = t.fov;
    this.apply(cam);
  }

  update(
    cam: THREE.PerspectiveCamera,
    f: Follow,
    ground: (x: number, z: number) => number,
    dt: number,
    reduced: boolean,
  ): THREE.Vector3 {
    // Swing round behind the bike with a lag (snappier when reduced motion is on).
    const lag = reduced ? 12 : 3.4 + Math.min(2.5, Math.abs(f.v) * 0.12);
    // Going backwards (or looking at something), stay put rather than whipping round.
    if (f.v > -0.5 && !this.focus)
      this.yaw += angleDelta(this.yaw, f.heading) * (1 - Math.exp(-lag * dt));
    // Ease the look-around back once you let go.
    this.sinceDrag += dt;
    if (this.sinceDrag > 1.4) {
      const k = 1 - Math.exp(-2.2 * dt);
      this.orbitYaw -= this.orbitYaw * k;
      this.orbitPitch -= this.orbitPitch * k;
    }
    this.blend += ((this.mode === "high" ? 1 : 0) - this.blend) * (1 - Math.exp(-4 * dt));
    const t = this.target(f, ground);
    const smooth = reduced ? 0.05 : 0.12;
    this.pos.step(t.pos, smooth, dt);
    this.look.step(t.look, smooth * 0.8, dt);
    this.fov += (t.fov - this.fov) * (1 - Math.exp(-3 * dt));
    this.apply(cam);
    return this.look.value;
  }

  private apply(cam: THREE.PerspectiveCamera): void {
    cam.position.copy(this.pos.value);
    cam.lookAt(this.tmp.copy(this.look.value));
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }
}
