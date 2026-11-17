/**
 * The ride ritual in the garage.
 *
 * Out (on "Ride"): Adit walks to the rack, lifts his black jacket off the
 * rail and shrugs it on, takes the helmet off its hook and pulls it on (the
 * first time in a visit: a nod and a two-finger wave to you), walks round to
 * the bike, swings a leg over, kicks it into life (a shudder, a puff) and
 * rides it out of the door. The camera tips down to the map table and dives
 * toward the world's miniature, and hovers there until the world is built;
 * then it plunges in.
 *
 * In (back to the garage): the camera pulls back out of the miniature, he
 * rides in and parks on the turntable, climbs off, hangs the helmet and the
 * jacket back up, pins the world's patch on the board if he earned it, and
 * goes back to his place at the table.
 *
 * Choreography is a coroutine stepped once a frame (each `yield` waits a
 * frame and hands back dt), so beats read top to bottom. Either way can be
 * skipped: everything jumps to where it would have ended.
 */

import * as THREE from "three";
import type { BikeKind, RouteId } from "../../content/types";
import { angleDelta } from "../anim";
import { aditRig, dress } from "../lib/adit";
import { seatPose } from "../world/rider";
import type { BikeRig } from "./bikeRig";
import type { Guide } from "./guide";
import type { JacketRack } from "./rack";
import { BIKE_SCALE, GUIDE_TABLE, groundAt, STAMP_BOARD, WALL_Z } from "./space";

/** What the ritual needs from the garage. */
export interface RitualHost {
  readonly scene: THREE.Scene;
  readonly rack: JacketRack;
  readonly guide: Guide;
  /** The world's miniature on the map table. */
  spotOf(id: RouteId): THREE.Vector3;
  /** The bike on (or rolling onto) the turntable. */
  bike(): BikeRig | null;
  /** Rides the bike on the turntable out of the door. */
  rideOut(): void;
  /** Brings `kind` in through the door to the turntable. */
  rideIn(kind: BikeKind): BikeRig;
  /** Puts `kind` straight onto the turntable (when skipping). */
  parkNow(kind: BikeKind): void;
  /** Sends the bike that rode out away at once (when skipping). */
  clearBike(): void;
  /** Where the camera is now (position and the point it looks at). */
  cameraNow(): { pos: THREE.Vector3; look: THREE.Vector3 };
  /** The table view's camera (where the garage frames everything). */
  tableShot(): { pos: THREE.Vector3; look: THREE.Vector3 };
  /** A portrait screen (framed tighter). */
  portrait(): boolean;
  /** The passport board view's camera. */
  boardShot(): { pos: THREE.Vector3; look: THREE.Vector3 };
  /** Is there a patch earned while away, waiting to go on the board? */
  hasPatch(): boolean;
  /** Puts it on the board. */
  pinPatch(): void;
}

/** One frame: each `yield` hands back the frame's dt. */
type Co = Generator<void, void, number>;

const JOINTS = [
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
] as const;
type Joint = (typeof JOINTS)[number];
/** Joint rotations (radians): z swings forward/back, x out to the side. */
type Pose = Partial<Record<Joint, { x?: number; z?: number }>>;
type Snapshot = Record<Joint, { x: number; z: number }>;

const STAND: Pose = { armL: { x: 0.06 }, armR: { x: -0.06 } };
/** Right hand up to the rail. */
const REACH_UP: Pose = {
  armR: { z: 2.45, x: -0.05 },
  foreR: { z: 0.3 },
  armL: { z: 0.25, x: 0.1 },
  head: { z: 0.18 },
};
/** Something held in front, at the chest (right hand, or both). */
const HOLD: Pose = {
  armR: { z: 0.9, x: -0.08 },
  foreR: { z: 1.05 },
  armL: { z: 0.3, x: 0.08 },
};
const HOLD_BOTH: Pose = {
  armR: { z: 0.95, x: -0.22 },
  foreR: { z: 0.95 },
  armL: { z: 0.95, x: 0.22 },
  foreL: { z: 0.95 },
};
/** Arms back into the sleeves. */
const SLEEVES: Pose = {
  armL: { z: -0.75, x: 0.28 },
  armR: { z: -0.75, x: -0.28 },
  foreL: { z: 0.55 },
  foreR: { z: 0.55 },
  torso: { z: -0.1 },
  head: { z: 0.06 },
};
/** The shrug that settles the jacket on the shoulders. */
const SHRUG: Pose = {
  armL: { z: 0.2, x: 0.16 },
  armR: { z: 0.2, x: -0.16 },
  foreL: { z: 0.2 },
  foreR: { z: 0.2 },
  torso: { z: 0.05 },
};
/** Both hands at the head (helmet on or off). */
const AT_HEAD: Pose = {
  armL: { z: 2.55, x: 0.42 },
  armR: { z: 2.55, x: -0.42 },
  foreL: { z: 1.75 },
  foreR: { z: 1.75 },
  head: { z: -0.08 },
};
/** A two-finger wave (right hand up by the visor). */
const WAVE: Pose = {
  armR: { z: 2.25, x: -0.4 },
  foreR: { z: 1.35 },
  armL: { x: 0.08 },
  head: { z: -0.16 },
};
/** Reaching to the board (pressing the patch on). */
const PRESS: Pose = {
  armR: { z: 1.75, x: -0.04 },
  foreR: { z: 0.12 },
  armL: { x: 0.08 },
  head: { z: 0.1 },
};

/** The arms and head (to pose them while the legs walk). */
const UPPER: readonly Joint[] = ["armL", "armR", "foreL", "foreR", "head"];

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const lerpAngle = (a: number, b: number, u: number) => a + angleDelta(a, b) * u;
/** Yaw that faces from (x, z) toward (tx, tz) (the rig faces +x). */
const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tz - z), tx - x);
/** Facing the back wall (−z). */
const TO_WALL = Math.PI / 2;

export class Ritual {
  private readonly rig: THREE.Group;
  private readonly J: Record<Joint, THREE.Object3D>;
  private readonly handR = new THREE.Object3D();
  private readonly handL = new THREE.Object3D();
  private readonly now: Snapshot;
  private yaw = 0;
  private phase = 0;
  private co: Co | null = null;
  private done: (() => void) | null = null;
  /** Where the jacket and helmet live on the rack (to hang them back exactly). */
  private readonly homes = new Map<
    THREE.Object3D,
    { parent: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }
  >();
  private puffs: THREE.Group | null = null;
  private mounted: BikeRig | null = null;
  /** When set, the camera sits exactly here (else the garage frames as usual). */
  cam: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  /** "out" until it hovers over the miniature; "hover" waiting; "in" coming home. */
  mode: "out" | "hover" | "plunge" | "in" | null = null;
  /** Rides out so far this visit (the first is the full ritual). */
  private rides = 0;
  private world: RouteId | null = null;
  private kind: BikeKind = "cafe";

  constructor(private readonly host: RitualHost) {
    this.rig = aditRig();
    this.rig.scale.setScalar(BIKE_SCALE);
    this.rig.visible = false;
    this.rig.traverse((o) => {
      o.castShadow = true;
    });
    const J = {} as Record<Joint, THREE.Object3D>;
    for (const n of JOINTS) {
      const o = this.rig.getObjectByName(n);
      if (!o) throw new Error(`ritual rig: no ${n}`);
      J[n] = o;
    }
    this.J = J;
    // The hands: just past each wrist, where carried things are held.
    this.handR.position.set(0.05, -0.27, 0);
    this.handL.position.set(0.05, -0.27, 0);
    J.foreR.add(this.handR);
    J.foreL.add(this.handL);
    this.now = Object.fromEntries(JOINTS.map((n) => [n, { x: 0, z: 0 }])) as Snapshot;
    host.scene.add(this.rig);
    const { black, helmet } = host.rack;
    for (const o of [black, helmet]) {
      if (o.parent)
        this.homes.set(o, {
          parent: o.parent,
          p: o.position.clone(),
          q: o.quaternion.clone(),
          s: o.scale.clone(),
        });
    }
  }

  get active(): boolean {
    return this.mode !== null;
  }

  /** Rides out to world `id` on `kind`; resolves once it hovers over the miniature. */
  depart(id: RouteId, kind: BikeKind): Promise<void> {
    this.reset();
    this.world = id;
    this.kind = kind;
    this.mode = "out";
    const full = this.rides === 0;
    this.rides += 1;
    return new Promise((resolve) => {
      this.done = resolve;
      this.co = this.out(full);
    });
  }

  /** The last push into the miniature (the world takes over at the end). */
  plunge(): Promise<void> {
    if (!this.world) return Promise.resolve();
    this.mode = "plunge";
    return new Promise((resolve) => {
      this.done = resolve;
      this.co = this.dive();
    });
  }

  /** Coming home from `id` on `kind`; resolves when he's back at the table. */
  welcome(id: RouteId, kind: BikeKind): Promise<void> {
    this.reset();
    this.world = id;
    this.kind = kind;
    this.mode = "in";
    return new Promise((resolve) => {
      this.done = resolve;
      this.co = this.in();
    });
  }

  /** Jumps to the end of what's playing. */
  skip(): void {
    if (this.mode === "out") this.endOut();
    else if (this.mode === "in") this.endIn();
  }

  /** Puts everything straight back (e.g. a ride was abandoned before it began). */
  cancel(): void {
    if (this.mode === null) return;
    this.endIn();
  }

  update(dt: number): void {
    this.stepPuff(dt);
    const co = this.co;
    if (!co) return;
    // (A beat may hand over to another coroutine as it ends: keep that one.)
    if (co.next(dt).done && this.co === co) this.co = null;
  }

  // ── the two ways ───────────────────────────────────────────────────────

  private *out(full: boolean): Co {
    if (!full) {
      yield* this.outShort();
      return;
    }
    const { rack, guide } = this.host;
    this.cam = null;
    // Ease in a little toward the rack and the bike while he kits up.
    const kit = this.kitShot();
    this.showAt(guide.root.position, guide.root.rotation.y, { jacket: false, helmet: false });
    const brisk = full ? 2.1 : 2.3;
    const peg = rack.spots.blackPeg;
    const hook = rack.spots.helmetHook;
    // To the rack: round behind the table's corner, never across the turntable.
    const atPeg = new THREE.Vector3(peg.x - 0.5, 0, WALL_Z + 0.62);
    yield* this.both(
      this.walk([new THREE.Vector3(-0.35, 0, -3.6), atPeg], brisk),
      this.camTo(kit, 1.4),
    );
    yield* this.turn(yawTo(atPeg.x, atPeg.z, peg.x, peg.z), 0.16);
    // Lift the jacket off the rail, bring it down, then into the sleeves.
    yield* this.pose(REACH_UP, full ? 0.3 : 0.22);
    this.carry(rack.black, this.handR);
    yield* this.pose(HOLD, full ? 0.22 : 0.16);
    yield* this.both(this.turn(-Math.PI / 2, 0.24), this.pose(SLEEVES, full ? 0.28 : 0.22));
    this.stow(rack.black);
    dress(this.rig, { jacket: true, helmet: false });
    yield* this.pose(SHRUG, 0.15);
    yield* this.pose(STAND, 0.12);
    // The helmet off its hook.
    const atHook = new THREE.Vector3(hook.x - 0.42, 0, WALL_Z + 0.62);
    yield* this.walk([atHook], brisk);
    yield* this.turn(yawTo(atHook.x, atHook.z, hook.x, hook.z), 0.14);
    yield* this.pose(REACH_UP, full ? 0.24 : 0.2);
    this.carry(rack.helmet, this.handR);
    yield* this.pose(HOLD_BOTH, 0.18);
    // Face you, and on with it.
    const eye = this.host.cameraNow().pos;
    const p = this.rig.position;
    yield* this.both(this.turn(yawTo(p.x, p.z, eye.x, eye.z), 0.22), this.pose(AT_HEAD, 0.24));
    this.stow(rack.helmet);
    dress(this.rig, { jacket: true, helmet: true });
    yield* this.pose(STAND, 0.16);
    if (full) {
      // A nod, and a two-finger wave.
      yield* this.pose({ ...STAND, head: { z: -0.3 } }, 0.14);
      yield* this.pose(WAVE, 0.22);
      yield* this.wait(0.22);
      yield* this.pose(STAND, 0.18);
    }
    // Round to the bike's left side and on.
    const bike = this.host.bike();
    if (bike) {
      // (Picked and ridden straight away, it may still be rolling in.)
      let waited = 0;
      while (!(bike.onTurntable && bike.phase === "rest") && waited < 6) waited += yield;
      const side = this.beside(bike, this.rig.position);
      yield* this.walk(this.around(bike, this.rig.position, side), brisk);
      yield* this.mount(bike, full ? 0.5 : 0.42);
      // Kick it into life as the turntable turns it to the door; it pulls away
      // as the camera goes.
      this.host.rideOut();
      yield* this.both(
        this.startUp(bike, 0.55),
        (function* (self: Ritual): Co {
          yield* self.wait(0.4);
          yield* self.diveToHover(1.2);
        })(this),
      );
    } else {
      yield* this.diveToHover(1.2);
    }
    this.hover();
  }

  /**
   * Second time round: one stop at the rack for both, the helmet goes on as
   * he walks to the bike, and the camera goes as the bike pulls away.
   */
  private *outShort(): Co {
    const { rack, guide } = this.host;
    this.showAt(guide.root.position, guide.root.rotation.y, { jacket: false, helmet: false });
    const kit = this.kitShot();
    const peg = rack.spots.blackPeg;
    const hook = rack.spots.helmetHook;
    const at = new THREE.Vector3((peg.x + hook.x) / 2 - 0.3, 0, WALL_Z + 0.62);
    yield* this.both(this.walk([new THREE.Vector3(-0.35, 0, -3.6), at], 2.4), this.camTo(kit, 1.1));
    yield* this.turn(yawTo(at.x, at.z, peg.x, peg.z), 0.12);
    yield* this.pose(REACH_UP, 0.18);
    this.carry(rack.black, this.handR);
    yield* this.both(this.turn(-Math.PI / 2, 0.2), this.pose(SLEEVES, 0.2));
    this.stow(rack.black);
    dress(this.rig, { jacket: true, helmet: false });
    yield* this.turn(yawTo(at.x, at.z, hook.x, hook.z), 0.12);
    yield* this.pose(REACH_UP, 0.16);
    this.carry(rack.helmet, this.handR);
    const bike = this.host.bike();
    if (bike) {
      let waited = 0;
      while (!(bike.onTurntable && bike.phase === "rest") && waited < 6) waited += yield;
      const side = this.beside(bike, this.rig.position);
      // On with the helmet on the way over.
      yield* this.both(
        this.walk(this.around(bike, this.rig.position, side), 2.2),
        (function* (self: Ritual): Co {
          yield* self.pose(AT_HEAD, 0.3, UPPER);
          self.stow(rack.helmet);
          dress(self.rig, { jacket: true, helmet: true });
          yield* self.pose(STAND, 0.2, UPPER);
        })(this),
      );
      yield* this.mount(bike, 0.4);
      this.host.rideOut();
      yield* this.both(this.startUp(bike, 0.3), this.diveToHover(1.1));
    } else {
      yield* this.diveToHover(1.0);
    }
    this.hover();
  }

  private *in(): Co {
    const { rack } = this.host;
    const spot = this.host.spotOf(this.world as RouteId);
    // Start right down in the miniature, then pull back out over the table.
    const close = this.closeShot(spot, 0.14);
    this.cam = { pos: close.pos.clone(), look: close.look.clone() };
    rack.black.visible = false;
    rack.helmet.visible = false;
    const bike = this.host.rideIn(this.kind);
    this.mountNow(bike);
    const table = this.tableShot();
    yield* this.camTo(this.closeShot(spot, 0.9), 0.5);
    yield* this.camTo(table, 1.0);
    this.cam = null;
    // Wait for him to roll onto the turntable and stop.
    let waited = 0;
    while (!(bike.onTurntable && bike.phase === "rest") && waited < 8) waited += yield;
    yield* this.wait(0.12);
    const rackSide = new THREE.Vector3(rack.spots.helmetHook.x, 0, WALL_Z + 0.62);
    yield* this.dismount(bike, 0.45, rackSide);
    // Helmet off, carried to its hook.
    const eye = this.host.cameraNow().pos;
    const p = this.rig.position;
    yield* this.both(this.turn(yawTo(p.x, p.z, eye.x, eye.z), 0.2), this.pose(AT_HEAD, 0.22));
    dress(this.rig, { jacket: true, helmet: false });
    this.holdOut(rack.helmet, this.handR);
    yield* this.pose(HOLD_BOTH, 0.18);
    const hook = rack.spots.helmetHook;
    const atHook = new THREE.Vector3(hook.x - 0.42, 0, WALL_Z + 0.62);
    yield* this.walk(this.around(bike, this.rig.position, atHook), 1.9);
    yield* this.turn(yawTo(atHook.x, atHook.z, hook.x, hook.z), 0.14);
    yield* this.pose(REACH_UP, 0.22);
    this.hangBack(rack.helmet);
    yield* this.pose(STAND, 0.14);
    // Out of the jacket, and onto the rail.
    yield* this.pose(SLEEVES, 0.24);
    dress(this.rig, { jacket: false, helmet: false });
    this.holdOut(rack.black, this.handR);
    yield* this.pose(HOLD, 0.16);
    const peg = rack.spots.blackPeg;
    const atPeg = new THREE.Vector3(peg.x - 0.5, 0, WALL_Z + 0.62);
    yield* this.walk([atPeg], 1.9);
    yield* this.turn(yawTo(atPeg.x, atPeg.z, peg.x, peg.z), 0.14);
    yield* this.pose(REACH_UP, 0.22);
    this.hangBack(rack.black);
    yield* this.pose(STAND, 0.14);
    // A new patch for the board.
    if (this.host.hasPatch()) {
      const at = new THREE.Vector3(STAMP_BOARD.x + 0.75, 0, WALL_Z + 0.7);
      // The camera goes with him to the board, and watches it go on.
      yield* this.both(this.walk([at], 2.0), this.camTo(this.host.boardShot(), 1.1));
      yield* this.turn(TO_WALL, 0.16);
      yield* this.pose(PRESS, 0.24);
      this.host.pinPatch();
      yield* this.wait(0.3);
      yield* this.pose(STAND, 0.18);
      yield* this.wait(1.2);
    }
    // Back to his place at the table.
    yield* this.both(
      this.walk([new THREE.Vector3(-0.35, 0, -3.6), GUIDE_TABLE.clone()], 2.0),
      this.cam ? this.camTo(table, 1.2) : this.wait(0),
    );
    this.cam = null;
    yield* this.turn(yawTo(GUIDE_TABLE.x, GUIDE_TABLE.z, 0, 0), 0.2);
    this.endIn();
  }

  // ── endings ─────────────────────────────────────────────────────────────

  /** Out, skipped or finished: he's gone with the bike, the camera over the miniature. */
  private endOut(): void {
    this.dismountNow();
    this.rig.visible = false;
    this.host.clearBike();
    this.stow(this.host.rack.black);
    this.stow(this.host.rack.helmet);
    this.host.guide.root.visible = false;
    this.clearPuffs();
    this.cam = this.closeShot(this.host.spotOf(this.world as RouteId), 0.9);
    this.co = null;
    this.hover();
  }

  private hover(): void {
    this.mode = "hover";
    const resolve = this.done;
    this.done = null;
    // Drift gently while it waits.
    const base = this.cam ? { pos: this.cam.pos.clone(), look: this.cam.look.clone() } : null;
    this.co = (function* (self: Ritual): Co {
      let t = 0;
      while (self.mode === "hover") {
        t += yield;
        if (base && self.cam)
          self.cam.pos
            .copy(base.pos)
            .add(new THREE.Vector3(Math.sin(t * 0.7) * 0.02, Math.sin(t * 0.9) * 0.012, 0));
      }
    })(this);
    resolve?.();
  }

  /** In, skipped or finished: the bike parked, the kit on the rack, Adit at the table. */
  private endIn(): void {
    this.dismountNow();
    this.clearPuffs();
    this.rig.visible = false;
    this.hangBack(this.host.rack.black);
    this.hangBack(this.host.rack.helmet);
    this.host.parkNow(this.kind);
    // Anything earned while away goes up now (a no-op if he already pinned it).
    this.host.pinPatch();
    this.host.guide.root.visible = true;
    this.cam = null;
    this.co = null;
    this.mode = null;
    const resolve = this.done;
    this.done = null;
    resolve?.();
  }

  private reset(): void {
    this.co = null;
    this.clearPuffs();
    this.dismountNow();
  }

  // ── beats ───────────────────────────────────────────────────────────────

  private *wait(sec: number): Co {
    let t = 0;
    while (t < sec) t += yield;
  }

  private *tween(sec: number, f: (u: number) => void): Co {
    let t = 0;
    while (t < sec) {
      t += yield;
      f(ease(Math.min(1, t / sec)));
    }
    f(1);
  }

  /** Two beats at once (ends when both have). */
  private *both(a: Co, b: Co): Co {
    let ad = false;
    let bd = false;
    let dt = 0;
    while (!ad || !bd) {
      if (!ad) ad = !!a.next(dt).done;
      if (!bd) bd = !!b.next(dt).done;
      if (!ad || !bd) dt = yield;
    }
  }

  private *pose(target: Pose, sec: number, only: readonly Joint[] = JOINTS): Co {
    const from = this.snapshot();
    yield* this.tween(sec, (u) => {
      for (const n of only) {
        const a = from[n];
        const b = target[n] ?? {};
        this.setJoint(n, a.x + ((b.x ?? 0) - a.x) * u, a.z + ((b.z ?? 0) - a.z) * u);
      }
    });
  }

  private *turn(yaw: number, sec: number): Co {
    const from = this.yaw;
    yield* this.tween(sec, (u) => {
      this.yaw = lerpAngle(from, yaw, u);
      this.rig.rotation.y = this.yaw;
    });
  }

  /** Walks a path of floor points at `speed` m/s, legs and arms swinging. */
  private *walk(points: THREE.Vector3[], speed: number): Co {
    const path = [this.rig.position.clone().setY(0), ...points.map((q) => q.clone().setY(0))];
    const lens: number[] = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const l = (path[i] as THREE.Vector3).distanceTo(path[i - 1] as THREE.Vector3);
      lens.push(l);
      total += l;
    }
    if (total < 0.02) return;
    const from = this.snapshot();
    const armsFree = Math.abs(from.armR.z) < 0.5 && Math.abs(from.armL.z) < 0.5;
    let s = 0;
    let v = 0;
    const at = new THREE.Vector3();
    while (s < total) {
      const dt = yield;
      const left = total - s;
      const want = Math.min(speed, Math.sqrt(2 * 3.2 * left) + 0.2);
      v += THREE.MathUtils.clamp(want - v, -5 * dt, 5 * dt);
      s = Math.min(total, s + v * dt);
      // Where along the path.
      let d = s;
      let i = 1;
      while (i < path.length - 1 && d > (lens[i - 1] ?? 0)) {
        d -= lens[i - 1] ?? 0;
        i++;
      }
      const a = path[i - 1] as THREE.Vector3;
      const b = path[i] as THREE.Vector3;
      const l = lens[i - 1] || 1;
      at.lerpVectors(a, b, Math.min(1, d / l));
      // Turn into the walk.
      const want_yaw = yawTo(a.x, a.z, b.x, b.z);
      this.yaw = lerpAngle(this.yaw, want_yaw, 1 - Math.exp(-10 * dt));
      this.rig.rotation.y = this.yaw;
      // Stride.
      const gait = Math.min(1, v / 0.8);
      this.phase += v * dt * 5.2;
      const sw = Math.sin(this.phase) * gait;
      this.setJoint("legL", 0, sw * 0.5);
      this.setJoint("legR", 0, -sw * 0.5);
      this.setJoint("shinL", 0, -Math.max(0, -sw) * 0.45);
      this.setJoint("shinR", 0, -Math.max(0, sw) * 0.45);
      if (armsFree) {
        this.setJoint("armL", 0.06, -sw * 0.35);
        this.setJoint("armR", -0.06, sw * 0.35);
      }
      this.rig.position.set(
        at.x,
        groundAt(at.x, at.z) + Math.abs(Math.sin(this.phase)) * 0.035 * gait,
        at.z,
      );
    }
    // Feet together.
    yield* this.pose(
      { ...this.toPose(this.snapshot()), legL: {}, legR: {}, shinL: {}, shinR: {} },
      0.12,
    );
  }

  /** Where he stands to get on or off: beside the seat, on the side nearer `toward`. */
  private beside(bike: BikeRig, toward: THREE.Vector3): THREE.Vector3 {
    bike.root.updateMatrixWorld(true);
    const local = bike.root.worldToLocal(toward.clone());
    const side = local.z < 0 ? -1 : 1;
    const p = bike.root.localToWorld(new THREE.Vector3(-0.32, 0, side * 0.62));
    p.y = 0;
    return p;
  }

  /**
   * A path from `from` to `to` that goes round the bike's nearer end if the
   * straight line would cross it.
   */
  private around(bike: BikeRig, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    bike.root.updateMatrixWorld(true);
    const inv = bike.root.matrixWorld.clone().invert();
    const a = from.clone().applyMatrix4(inv);
    const b = to.clone().applyMatrix4(inv);
    // The bike's footprint in its own frame (unscaled units), with a margin.
    const HL = 1.25;
    const HW = 0.5;
    const crosses = () => {
      for (let i = 0; i <= 20; i++) {
        const q = a.clone().lerp(b, i / 20);
        if (Math.abs(q.x) < HL && Math.abs(q.z) < HW) return true;
      }
      return false;
    };
    if (!crosses()) return [to.clone()];
    // Round whichever end is nearer.
    const endX =
      Math.abs(a.x + HL + 0.3) + Math.abs(b.x + HL + 0.3) <
      Math.abs(a.x - HL - 0.3) + Math.abs(b.x - HL - 0.3)
        ? -HL - 0.35
        : HL + 0.35;
    const w1 = new THREE.Vector3(endX, 0, Math.sign(a.z || 1) * (HW + 0.2));
    const w2 = new THREE.Vector3(endX, 0, Math.sign(b.z || 1) * (HW + 0.2));
    const out = [w1, w2].map((w) => bike.root.localToWorld(w).setY(0));
    return [...out, to.clone()];
  }

  /** Climbs on: a little hop and a leg swung over, into the seated pose. */
  private *mount(bike: BikeRig, sec: number): Co {
    const pose = seatPose(bike.kind);
    bike.root.updateMatrixWorld(true);
    const seat = bike.body.localToWorld(new THREE.Vector3(...pose.at));
    const from = this.rig.position.clone();
    const fromYaw = this.yaw;
    const bikeYaw = bike.root.rotation.y;
    const start = this.snapshot();
    const seated = this.seated(bike.kind);
    yield* this.tween(sec, (u) => {
      this.rig.position.lerpVectors(from, seat, u);
      this.rig.position.y += Math.sin(Math.PI * u) * 0.22;
      this.yaw = lerpAngle(fromYaw, bikeYaw, Math.min(1, u * 1.6));
      this.rig.rotation.y = this.yaw;
      for (const n of JOINTS) {
        const a = start[n];
        const b = seated[n] ?? {};
        this.setJoint(n, a.x + ((b.x ?? 0) - a.x) * u, a.z + ((b.z ?? 0) - a.z) * u);
      }
      // The right leg swings high over the seat.
      this.setJoint("legR", 0, this.now.legR.z + Math.sin(Math.PI * u) * 1.1);
    });
    this.mountNow(bike);
  }

  /** Seated on `bike` right now. */
  private mountNow(bike: BikeRig): void {
    const pose = seatPose(bike.kind);
    bike.body.add(this.rig);
    this.rig.position.set(...pose.at);
    this.rig.rotation.set(0, 0, 0);
    this.rig.scale.setScalar(1);
    this.rig.visible = true;
    this.yaw = 0;
    dress(this.rig, { jacket: true, helmet: true });
    this.host.guide.root.visible = false;
    for (const n of JOINTS) this.setJoint(n, 0, 0);
    const seated = this.seated(bike.kind);
    for (const n of JOINTS) this.setJoint(n, seated[n]?.x ?? 0, seated[n]?.z ?? 0);
    bike.upright = true;
    this.mounted = bike;
  }

  private *dismount(bike: BikeRig, sec: number, toward: THREE.Vector3): Co {
    const to = this.beside(bike, toward);
    const off = bike.root.worldToLocal(to.clone()).z < 0 ? 1 : -1;
    to.y = groundAt(to.x, to.z);
    this.dismountNow();
    const from = this.rig.position.clone();
    const fromYaw = this.yaw;
    yield* this.both(
      this.tween(sec, (u) => {
        this.rig.position.lerpVectors(from, to, u);
        this.rig.position.y += Math.sin(Math.PI * u) * 0.22;
        this.setJoint("legR", 0, this.now.legR.z + Math.sin(Math.PI * u) * 0.9);
        this.yaw = lerpAngle(fromYaw, fromYaw + (off * Math.PI) / 2, u);
        this.rig.rotation.y = this.yaw;
      }),
      this.pose(STAND, sec),
    );
  }

  /** Off the bike, standing where he was (no motion). */
  private dismountNow(): void {
    const bike = this.mounted;
    if (!bike) return;
    bike.upright = false;
    this.mounted = null;
    const p = new THREE.Vector3();
    this.rig.getWorldPosition(p);
    const yaw = bike.root.rotation.y;
    this.host.scene.add(this.rig);
    this.rig.position.copy(p);
    this.rig.rotation.set(0, yaw, 0);
    this.rig.scale.setScalar(BIKE_SCALE);
    this.yaw = yaw;
  }

  /** Kick, shudder, a puff of exhaust (which drifts and fades on its own). */
  private *startUp(bike: BikeRig, sec: number): Co {
    this.clearPuffs();
    const puffs = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: "#d8d2c8",
      transparent: true,
      opacity: 0.55,
      roughness: 1,
      depthWrite: false,
    });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1 + i * 0.03, 14, 10), mat);
      m.position.set(-1.0 - i * 0.2, 0.5 + i * 0.07, 0.22 + i * 0.05);
      m.scale.setScalar(0.01);
      puffs.add(m);
    }
    bike.body.add(puffs);
    this.puffs = puffs;
    this.puffT = 0;
    let t = 0;
    while (t < sec) {
      t += yield;
      // The shudder as it catches.
      const k = 1 - t / sec;
      bike.body.position.y += Math.sin(t * 95) * 0.006 * k;
    }
  }

  private puffT = 0;

  private stepPuff(dt: number): void {
    const p = this.puffs;
    if (!p) return;
    this.puffT += dt;
    const t = this.puffT;
    p.children.forEach((b, i) => {
      const u = THREE.MathUtils.clamp((t - i * 0.08) / 0.8, 0, 1);
      b.scale.setScalar(0.01 + u * 1.1);
      b.position.x = -1.0 - i * 0.2 - u * 0.35;
    });
    const m = (p.children[0] as THREE.Mesh | undefined)?.material as THREE.MeshStandardMaterial;
    if (m) m.opacity = 0.55 * (1 - THREE.MathUtils.clamp((t - 0.35) / 1.0, 0, 1));
    if (t > 1.4) this.clearPuffs();
  }

  private clearPuffs(): void {
    const p = this.puffs;
    if (!p) return;
    p.removeFromParent();
    const mats = new Set<THREE.Material>();
    p.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        mats.add(m.material as THREE.Material);
      }
    });
    for (const m of mats) m.dispose();
    this.puffs = null;
  }

  // ── camera ──────────────────────────────────────────────────────────────

  private tableShot(): { pos: THREE.Vector3; look: THREE.Vector3 } {
    return this.host.tableShot();
  }

  /** The table shot, eased in toward the rack and the turntable. */
  private kitShot(): { pos: THREE.Vector3; look: THREE.Vector3 } {
    const t = this.tableShot();
    // Portrait screens are already framed tight: no push-in.
    if (this.host.portrait()) return t;
    const focus = new THREE.Vector3(1.1, 1.15, -3.9);
    const look = t.look.clone().lerp(focus, 0.5);
    const pos = look.clone().add(t.pos.clone().sub(t.look).multiplyScalar(0.84));
    return { pos, look };
  }

  /** Over the miniature, `dist` metres away, along the line from the table camera. */
  private closeShot(
    spot: THREE.Vector3,
    dist: number,
  ): { pos: THREE.Vector3; look: THREE.Vector3 } {
    const from = this.host.tableShot().pos;
    const dir = from.clone().sub(spot);
    dir.y = Math.max(dir.y, dir.length() * 0.55);
    dir.normalize();
    return { pos: spot.clone().addScaledVector(dir, dist), look: spot.clone() };
  }

  private *camTo(to: { pos: THREE.Vector3; look: THREE.Vector3 }, sec: number): Co {
    const now = this.cam ?? this.host.cameraNow();
    const from = { pos: now.pos.clone(), look: now.look.clone() };
    this.cam = { pos: from.pos.clone(), look: from.look.clone() };
    const cam = this.cam;
    yield* this.tween(sec, (u) => {
      cam.pos.lerpVectors(from.pos, to.pos, u);
      cam.look.lerpVectors(from.look, to.look, u);
    });
  }

  private *diveToHover(sec: number): Co {
    const spot = this.host.spotOf(this.world as RouteId);
    yield* this.camTo(this.closeShot(spot, 0.9), sec);
    this.rig.visible = false;
    this.dismountNow();
    this.rig.visible = false;
  }

  private *dive(): Co {
    const spot = this.host.spotOf(this.world as RouteId);
    yield* this.camTo(this.closeShot(spot, 0.1), 0.45);
    const resolve = this.done;
    this.done = null;
    this.mode = null;
    resolve?.();
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private showAt(p: THREE.Vector3, yaw: number, kit: { jacket: boolean; helmet: boolean }): void {
    this.host.scene.add(this.rig);
    this.rig.position.set(p.x, groundAt(p.x, p.z), p.z);
    this.rig.scale.setScalar(BIKE_SCALE);
    this.yaw = yaw;
    this.rig.rotation.set(0, yaw, 0);
    for (const n of JOINTS) this.setJoint(n, STAND[n]?.x ?? 0, STAND[n]?.z ?? 0);
    dress(this.rig, kit);
    this.rig.visible = true;
    this.host.guide.root.visible = false;
  }

  /** Takes a rack piece in hand (it was hanging just by the hand). */
  private carry(o: THREE.Object3D, hand: THREE.Object3D): void {
    this.toHand(o, hand);
  }

  /** A piece just taken off (helmet, jacket), now held in the hand, hanging as on the rack. */
  private holdOut(o: THREE.Object3D, hand: THREE.Object3D): void {
    this.hangBack(o);
    this.toHand(o, hand);
  }

  /**
   * Moves a rack piece (in its rack orientation) so the top of it, its hook
   * or hanger, sits in the hand; then the hand carries it.
   */
  private toHand(o: THREE.Object3D, hand: THREE.Object3D): void {
    const parent = o.parent;
    if (!parent) return;
    o.visible = true;
    o.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(o);
    const hook = new THREE.Vector3(
      (box.min.x + box.max.x) / 2,
      box.max.y,
      (box.min.z + box.max.z) / 2,
    );
    const at = hand.getWorldPosition(new THREE.Vector3());
    const world = o.getWorldPosition(new THREE.Vector3()).add(at.sub(hook));
    o.position.copy(parent.worldToLocal(world));
    hand.attach(o);
  }

  /** Put away while he wears it. */
  private stow(o: THREE.Object3D): void {
    o.visible = false;
  }

  /** Back on the rack exactly where it lives. */
  private hangBack(o: THREE.Object3D): void {
    const home = this.homes.get(o);
    if (!home) return;
    home.parent.add(o);
    o.position.copy(home.p);
    o.quaternion.copy(home.q);
    o.scale.copy(home.s);
    o.visible = true;
  }

  private seated(kind: BikeKind): Pose {
    const p = seatPose(kind);
    return {
      legL: { z: p.thigh },
      legR: { z: p.thigh },
      shinL: { z: p.shin },
      shinR: { z: p.shin },
      torso: { z: p.torso },
      armL: { z: p.arm },
      armR: { z: p.arm },
      foreL: { z: p.fore },
      foreR: { z: p.fore },
      head: { z: p.head },
    };
  }

  private setJoint(n: Joint, x: number, z: number): void {
    const j = this.J[n];
    j.rotation.x = x;
    j.rotation.z = z;
    this.now[n].x = x;
    this.now[n].z = z;
  }

  private snapshot(): Snapshot {
    return Object.fromEntries(JOINTS.map((n) => [n, { ...this.now[n] }])) as Snapshot;
  }

  private toPose(s: Snapshot): Pose {
    return s as Pose;
  }
}
