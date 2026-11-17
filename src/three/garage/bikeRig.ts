/**
 * One bike moving in the garage with a little real physics:
 *  - it follows a path with a speed controller (limited acceleration, and
 *    braking that stops exactly on its mark);
 *  - each wheel follows the floor (so it drops off the turntable edge) on a
 *    stiff tyre spring;
 *  - the body rides on a softer, slightly under-damped suspension: it pitches
 *    and heaves with the wheels, dives under braking and squats when pulling
 *    away, then settles with a small bounce;
 *  - at rest it tips onto its side stand; it stands up before it moves.
 *
 * A path always runs from the bike's "away" spot (s = 0: the back room, or
 * Murphy's parking spot) to the turntable centre (s = len). Bikes leave by
 * reversing back down a path, the way they came.
 */

import * as THREE from "three";
import type { BikeKind } from "../../content/types";
import { angleDelta, type Spring1, stepSpring } from "../anim";
import { BIKE_SCALE, groundAt, PRESENT } from "./space";

interface Wheel {
  obj: THREE.Object3D;
  /** Axle position along the bike (local units). */
  x: number;
  r: number;
  y0: number;
  y: Spring1;
}

/**
 * rest  — stopped (on the turntable, or at its away spot), leaning on its stand
 * align — on the turntable, waiting for it to turn the bike square with its way out
 * lift  — standing up off the stand before moving
 * move  — rolling along its path
 */
export type RigPhase = "rest" | "align" | "lift" | "move";

const SIDE_STAND = -0.075;
const V_IN = 3.1;
const V_OUT = 2.1;
const ACCEL = 2.8;
const BRAKE = 3.0;
const LIFT_TIME = 0.28;

/** Heading (yaw) of a path at its turntable end. */
export function endYaw(path: THREE.CatmullRomCurve3): number {
  const t = path.getTangentAt(1);
  return Math.atan2(-t.z, t.x);
}

export class BikeRig {
  readonly root = new THREE.Group();
  private readonly lean = new THREE.Group();
  /** The sprung body (a rider sits on it, so they pitch and heave with it). */
  readonly body = new THREE.Group();
  private readonly wheels: Wheel[] = [];
  path!: THREE.CatmullRomCurve3;
  len = 1;
  s = 0;
  v = 0;
  private a = 0;
  target = 0;
  phase: RigPhase = "rest";
  /** Seconds left before this rig may start moving. */
  hold = 0;
  /** Turntable spin (relative to PRESENT) this rig needs before it can leave. */
  alignTo = 0;
  /** Set on the frame it arrives on the turntable (the scene reads and clears it). */
  justArrived = false;
  /** Turntable spin while it sits on the turntable. */
  spin = 0;
  /**
   * Leaving forwards: the bike faces away from the turntable and rides out
   * (s decreasing, heading reversed), rather than reversing out.
   */
  forwardOut = false;
  /**
   * Furthest it may go toward the turntable for now (path s). The scene sets
   * this to a waiting spot inside the door while the turntable is busy; the
   * bike brakes to a stop there, and rolls on once it's lifted.
   */
  cap = Number.POSITIVE_INFINITY;
  /** Someone's on it: held upright instead of leaning on its side stand. */
  upright = false;
  private liftT = 0;
  private pendingPath: THREE.CatmullRomCurve3 | null = null;
  private readonly pitch: Spring1 = { x: 0, v: 0 };
  private readonly heave: Spring1 = { x: 0, v: 0 };
  private readonly tilt: Spring1 = { x: SIDE_STAND, v: 0 };
  private readonly tmp = new THREE.Vector3();
  private readonly tan = new THREE.Vector3();
  private lastS = Number.NaN;

  /**
   * @param home if true the bike lives at its away spot (s = 0) and is never removed
   */
  constructor(
    readonly kind: BikeKind,
    bike: THREE.Group,
    path: THREE.CatmullRomCurve3,
    at: "away" | "centre",
    readonly home = false,
  ) {
    // bike = batched hero bike: merged body meshes + live wheel groups.
    for (const c of [...bike.children]) {
      const r = c.userData.wheelRadius;
      if (typeof r === "number") {
        this.wheels.push({ obj: c, x: c.position.x, r, y0: c.position.y, y: { x: 0, v: 0 } });
        this.lean.add(c);
      } else {
        this.body.add(c);
      }
    }
    this.lean.add(this.body);
    this.root.add(this.lean);
    this.root.scale.setScalar(BIKE_SCALE);
    this.reset(path, at);
  }

  /** Puts the rig at rest at one end of `path`. */
  reset(path: THREE.CatmullRomCurve3, at: "away" | "centre"): void {
    this.path = path;
    this.len = path.getLength();
    this.s = at === "centre" ? this.len : 0;
    this.target = this.s;
    this.v = 0;
    this.a = 0;
    this.phase = "rest";
    this.hold = 0;
    this.spin = 0;
    this.alignTo = 0;
    this.justArrived = false;
    this.forwardOut = false;
    this.pendingPath = null;
    this.pitch.x = this.pitch.v = 0;
    this.heave.x = this.heave.v = 0;
    this.tilt.x = SIDE_STAND;
    this.tilt.v = 0;
    for (const w of this.wheels) w.y = { x: 0, v: 0 };
    this.lastS = Number.NaN;
    this.place(0);
  }

  get onTurntable(): boolean {
    return this.s >= this.len && this.phase !== "move";
  }

  get atAway(): boolean {
    return this.s <= 0 && this.phase === "rest";
  }

  /** Finished leaving (and not a bike that lives here). */
  get gone(): boolean {
    return !this.home && this.target === 0 && this.atAway;
  }

  /** Come to the turntable (or turn back toward it). */
  arrive(): void {
    this.target = this.len;
    this.pendingPath = null;
    if (this.phase === "align" || (this.phase === "lift" && this.s >= this.len))
      this.phase = "rest";
    else if (this.phase === "rest" && this.s < this.len) this.startLift();
  }

  /**
   * Leave down `exit` from the turntable: reversing out (the way it came), or,
   * with `forward`, after the turntable turns it to face the way out, riding
   * out forwards. If it is still arriving, it simply turns back.
   */
  leave(exit: THREE.CatmullRomCurve3, forward = false): void {
    if (this.onTurntable) {
      if (this.phase === "rest") {
        this.pendingPath = exit;
        this.forwardOut = forward;
        this.alignTo = angleDelta(0, endYaw(exit) + (forward ? Math.PI : 0) - PRESENT);
        this.phase = "align";
      }
      return;
    }
    this.target = 0;
  }

  private startLift(): void {
    this.phase = "lift";
    this.liftT = 0;
  }

  update(dt: number): void {
    if (this.hold > 0) {
      this.hold -= dt;
      this.place(dt);
      return;
    }
    switch (this.phase) {
      case "align":
        if (Math.abs(angleDelta(this.spin, this.alignTo)) < 0.05) this.startLift();
        break;
      case "lift":
        this.liftT += dt;
        if (this.liftT > LIFT_TIME) {
          if (this.pendingPath) {
            this.path = this.pendingPath;
            this.len = this.path.getLength();
            this.s = this.len;
            this.lastS = this.s;
            this.target = 0;
            this.pendingPath = null;
          }
          this.phase = "move";
        }
        break;
      case "move":
        this.drive(dt);
        if (this.s === this.target && this.v === 0) {
          this.phase = "rest";
          if (this.s >= this.len) {
            // On the turntable: take its angle now (same frame, no snap) — the
            // way the bike happens to face — and the scene eases it round.
            this.spin = angleDelta(
              0,
              endYaw(this.path) + (this.forwardOut ? Math.PI : 0) - PRESENT,
            );
            this.forwardOut = false;
            this.justArrived = true;
          }
        }
        break;
      case "rest":
        break;
    }
    this.place(dt);
  }

  /** Speed controller: accelerate gently, brake to stop exactly on the mark. */
  private drive(dt: number): void {
    const goal = this.target > this.s ? Math.min(this.target, this.cap) : this.target;
    const d = goal - this.s;
    const vmax = d > 0 ? V_IN : this.forwardOut ? V_IN : V_OUT;
    const vDes = Math.sign(d) * Math.min(vmax, Math.sqrt(2 * BRAKE * Math.abs(d)));
    const speedingUp =
      Math.abs(vDes) > Math.abs(this.v) && Math.sign(vDes) === Math.sign(this.v || vDes);
    const lim = speedingUp ? ACCEL : BRAKE;
    const a = THREE.MathUtils.clamp((vDes - this.v) * 6, -lim, lim);
    this.v += a * dt;
    this.s = THREE.MathUtils.clamp(this.s + this.v * dt, 0, this.len);
    this.a = a;
    // Close enough and slow enough: settle on the mark (no last-centimetre creep).
    if (Math.abs(d) < 0.03 && Math.abs(this.v) < 0.3) {
      this.s = goal;
      this.v = 0;
      this.a = 0;
    }
  }

  private place(dt: number): void {
    const u = THREE.MathUtils.clamp(this.s / this.len, 0, 1);
    this.path.getPointAt(u, this.tmp);
    this.path.getTangentAt(u, this.tan);
    const pathYaw = Math.atan2(-this.tan.z, this.tan.x) + (this.forwardOut ? Math.PI : 0);
    const yaw = this.onTurntable ? PRESENT + this.spin : pathYaw;
    this.root.position.set(this.tmp.x, 0, this.tmp.z);
    this.root.rotation.y = yaw;
    const hx = Math.cos(yaw);
    const hz = -Math.sin(yaw);
    const travel = Number.isNaN(this.lastS) ? 0 : this.s - this.lastS;
    this.lastS = this.s;
    // Wheels: follow the floor on a stiff tyre spring, and turn with distance.
    const ground: number[] = [];
    for (const w of this.wheels) {
      const gx = this.tmp.x + hx * w.x * BIKE_SCALE;
      const gz = this.tmp.z + hz * w.x * BIKE_SCALE;
      const g = groundAt(gx, gz) / BIKE_SCALE;
      ground.push(g);
      if (dt > 0) stepSpring(w.y, g, 34, 0.7, dt);
      else w.y.x = g;
      w.obj.position.y = w.y0 + w.y.x;
      // Rolling forward turns the wheels one way, backward the other.
      const ahead = this.forwardOut ? -travel : travel;
      w.obj.rotation.z -= ahead / (w.r * BIKE_SCALE);
    }
    // Body: suspension pitch and heave from the wheels, plus dive and squat.
    const [rear, front] = sortedByX(this.wheels);
    if (rear && front) {
      const gr = ground[this.wheels.indexOf(rear)] ?? 0;
      const gf = ground[this.wheels.indexOf(front)] ?? 0;
      const base = Math.atan2(gf - gr, front.x - rear.x);
      // Acceleration along the bike's own heading: dive under braking, squat pulling away.
      const aHead = this.forwardOut ? -this.a : this.a;
      const dive = THREE.MathUtils.clamp(aHead * 0.02, -0.05, 0.05);
      const heaveTarget = (gr + gf) / 2 - Math.abs(this.a) * 0.004;
      if (dt > 0) {
        stepSpring(this.pitch, base + dive, 11, 0.32, dt);
        stepSpring(this.heave, heaveTarget, 11, 0.35, dt);
      } else {
        this.pitch.x = base;
        this.heave.x = heaveTarget;
      }
      this.body.rotation.z = this.pitch.x;
      this.body.position.y = this.heave.x;
    }
    // Side stand: lean onto it at rest, stand up to move.
    const lean =
      (this.phase === "rest" || this.phase === "align") && !this.upright ? SIDE_STAND : 0;
    if (dt > 0) stepSpring(this.tilt, lean, 6.5, 0.42, dt);
    else this.tilt.x = lean;
    this.lean.rotation.x = this.tilt.x;
  }
}

function sortedByX(ws: Wheel[]): [Wheel | undefined, Wheel | undefined] {
  const s = [...ws].sort((a, b) => a.x - b.x);
  return [s[0], s[s.length - 1]];
}
