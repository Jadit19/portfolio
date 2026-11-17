/**
 * The opening: Adit's yard (see yard.ts), the bike-select landing.
 *
 * Click a bike to pick it: it glides out of its bay along the bay lines (the
 * secret bike turns on its pad to face Adit instead) and Adit turns to point
 * at it (the card is React UI, in a fixed place).
 *
 * Ride (`depart`): Adit walks over to the bike, steps up and sits on it
 * (helmet and jacket going on as he does), swings right (screen-left), rolls
 * along the front of the yard, down the ramp off the plot's left edge and out
 * of the frame. The stage then hands over to the world under a wash of colour.
 *
 * Back from a world (`welcome`): the bike rides in from the left, up the ramp
 * and along the front, turns to face out in front of its bay and backs into
 * it; Adit gets off and walks back to his spot.
 *
 * The camera is fixed (the flat-world three-quarter view), framing the whole
 * plot centred whatever the screen shape. Bikes cast no shadow in the yard;
 * Adit does.
 */

import * as THREE from "three";
import type { BikeKind, RouteId } from "../../content/types";
import { WORLDS, world } from "../../content/worlds";
import { app } from "../../state/app";
import { prefersReducedMotion } from "../anim";
import { LiveShadow, mix, paperShadow, toClay } from "../flat/kit";
import type { Lamp, NightPass } from "../flat/night";
import type { Layout } from "../layout";
import { aditRig, dress } from "../lib/adit";
import { PASTEL as P } from "../lib/palette";
import type { StageScene } from "../stage";
import { RideSound } from "../world/sound";
import {
  ADIT_AT,
  ALL,
  at,
  BAY_V,
  BIKE_SCALE,
  buildYard,
  heading,
  home,
  LEAN,
  LIFT,
  OUTSIDE,
  PAD,
  PARKED,
  PULL,
  pulled,
  RAMP,
  SECRET,
  SECRET_AT,
  TOWARD,
  U,
  V0,
  V1,
  YARD,
  type Yard,
} from "./yard";

const INK = P.ink;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const kindOf = (id: RouteId | null): BikeKind | null => (id ? world(id).bike.kind : null);
const routeOf = (k: BikeKind): RouteId =>
  (WORLDS.find((w) => w.bike.kind === k) as (typeof WORLDS)[number]).id;
const smooth = (t: number) => t * t * (3 - 2 * t);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
function setShadowColour(m: THREE.ShaderMaterial, hex: string): void {
  const c = new THREE.Color(hex);
  (m.uniforms.uC as { value: THREE.Vector3 }).value.set(c.r, c.g, c.b);
}
/** The parked lean (onto the side stand) of the bike's inner model. */
const STAND_LEAN = -0.07;
/** Walking pace (m/s). */
const WALK = 1.5;
/** Adit about the yard: riding jacket on, helmet in his left hand. */
const AROUND = { jacket: true, helmet: false, carry: true };
/** Riding: the helmet on. */
const RIDING = { jacket: true, helmet: true, carry: false };

interface BikeState {
  group: THREE.Group;
  /** How far out of its bay (0–PULL), on a spring, and how fast. */
  pull: number;
  pullV: number;
  /** Its turn (the secret bike turns to face Adit instead of rolling out), on a spring. */
  yaw: number;
  yawV: number;
}

/** A critically damped spring: smooth to start, smooth to settle (no overshoot). */
function spring(x: number, v: number, target: number, w: number, dt: number): [number, number] {
  const a = w * w * (target - x) - 2 * w * v;
  const nv = v + a * dt;
  return [x + nv * dt, nv];
}

/**
 * Adit standing on his spot (a rig, dressed like he is when he walks over, so
 * nothing changes when he sets off): waving with his right hand, or pointing
 * it at the picked bike; the helmet hangs from his left.
 */
function standPose(a: THREE.Object3D, pose: "wave" | "point"): void {
  const j = (n: string) => a.getObjectByName(n) as THREE.Object3D;
  j("armL").rotation.set(0.14, 0, 0.0);
  j("foreL").rotation.z = 0.05;
  if (pose === "wave") {
    // Upper arm out to the side at shoulder height, forearm up: a hello.
    j("armR").rotation.set(-1.35, 0, 0.1);
    j("foreR").rotation.set(-1.75, 0, 0.1);
  } else {
    j("armR").rotation.set(-0.12, 0, 1.4);
    j("foreR").rotation.set(0, 0, 0.12);
  }
}

/** The yard's lights at night: where, how far their warm pool reaches, and their colour. */
const YARD_LAMPS: Lamp[] = (
  [
    [2.2, -5.2, 2.2, 3.4],
    [-2, -5.6, 1, 3.6],
    [6.2, -5.8, 1, 3],
    [10.4, -4.9, 0.8, 2.4],
    [7.6, 0, 2.4, 2.6, [1, 0.86, 0.6]],
    [8.8, -3.4, 2.4, 2.6, [1, 0.8, 0.7]],
    [10.6, -3.4, 2.4, 2.4, [0.85, 0.95, 1]],
    [7.6, -2.2, 2.4, 2.4, [1, 0.9, 0.6]],
  ] as [number, number, number, number, [number, number, number]?][]
).map(([u, v, h, r, colour]) => {
  const [x, z] = at(u, v);
  return { x, y: LIFT + h, z, r, ...(colour ? { colour } : {}) };
});

/** One step of a sequence: returns true once it's finished. */
type Step = (dt: number) => boolean;

interface Sequence {
  kind: BikeKind;
  steps: Step[];
  /** Back to rest when it ends (coming home); a ride out stays out of frame instead. */
  settle: boolean;
  /** Runs every step at once (skipping to the end). */
  finish: () => void;
  done: () => void;
}

export class LineupScene implements StageScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  private yard!: Yard;
  private readonly bikes = new Map<BikeKind, BikeState>();
  /** Adit standing still: waving, or pointing at the picked bike. */
  private standing!: {
    wave: THREE.Group;
    point: THREE.Group;
    shadow: { wave: LiveShadow; point: LiveShadow };
  };
  /** Adit on the move (walking, getting on and off, riding): a posable rig. */
  private walker!: THREE.Group;
  /** The carried helmet (its frame matches the helmet on his head), and where it hangs in his hand. */
  private grip!: THREE.Object3D;
  private gripHome!: {
    parent: THREE.Object3D;
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  };
  /** His left hand holds the helmet (so that arm hangs by his side rather than reaching for the bars). */
  private holding = true;
  private walkerShadow!: LiveShadow;
  private aditYaw = heading(0, 1);
  /** The bike being ridden, with Adit on it, while a sequence plays. */
  private rig: THREE.Group | null = null;
  private seq: Sequence | null = null;
  private hovered: BikeKind | null = null;
  private readonly ray = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private downAt = { x: 0, y: 0 };
  private canvas: HTMLCanvasElement | null = null;
  private readonly reduced = prefersReducedMotion();
  /** The engine: running from when Adit starts the bike to when it's parked (heard if sound is on). */
  private readonly sound = new RideSound();
  private engineOn = false;
  /** How fast the bike's going, and a moment of revs as it fires up. */
  private engineV = 0;
  private rev = 0;

  /** Builds the yard across a few frames so the loader keeps animating. */
  static async create(
    canvas: HTMLCanvasElement,
    onProgress: (p: number) => void,
  ): Promise<LineupScene> {
    const g = new LineupScene();
    await document.fonts.ready;
    await Promise.all(
      ["800 40px Outfit", "900 40px Outfit"].map((f) => document.fonts.load(f).catch(() => [])),
    );
    onProgress(0.15);
    await nextFrame();
    g.scene.background = new THREE.Color(OUTSIDE);
    g.yard = buildYard();
    g.scene.add(g.yard.root);
    onProgress(0.6);
    await nextFrame();
    for (const [k, group] of g.yard.bikes) {
      g.scene.add(group);
      g.bikes.set(k, { group, pull: 0, pullV: 0, yaw: PARKED, yawV: 0 });
    }
    g.buildAdit();
    onProgress(0.9);
    await nextFrame();
    g.bind(canvas);
    onProgress(1);
    return g;
  }

  private buildAdit(): void {
    const make = (pose: "wave" | "point") => {
      const a = aditRig();
      dress(a, AROUND);
      standPose(a, pose);
      toClay(a, this.yard.matcap);
      const [x, z] = at(...ADIT_AT);
      a.position.set(x, LIFT, z);
      a.rotation.y = this.aditYaw;
      this.scene.add(a);
      const shadow = new LiveShadow(a, paperShadow(mix(YARD, INK, 0.14), LIFT + 0.012));
      this.scene.add(shadow.group);
      return { a, shadow };
    };
    const wave = make("wave");
    const point = make("point");
    point.a.visible = false;
    point.shadow.group.visible = false;
    this.standing = {
      wave: wave.a,
      point: point.a,
      shadow: { wave: wave.shadow, point: point.shadow },
    };
    // The posable Adit (all layers present; `dress` picks what he wears and carries).
    this.walker = aditRig();
    toClay(this.walker, this.yard.matcap);
    dress(this.walker, AROUND);
    this.grip = this.walker.getObjectByName("grip") as THREE.Object3D;
    this.gripHome = {
      parent: this.grip.parent as THREE.Object3D,
      position: this.grip.position.clone(),
      quaternion: this.grip.quaternion.clone(),
    };
    this.walker.visible = false;
    this.scene.add(this.walker);
    this.walkerShadow = new LiveShadow(
      this.walker,
      paperShadow(mix(YARD, INK, 0.14), LIFT + 0.012),
    );
    this.walkerShadow.group.visible = false;
    this.scene.add(this.walkerShadow.group);
  }

  /** Shows Adit standing still (true) or on the move (false). */
  private still(on: boolean): void {
    this.standing.wave.visible = on;
    this.standing.shadow.wave.group.visible = on;
    this.standing.point.visible = false;
    this.standing.shadow.point.group.visible = false;
    this.walker.visible = !on;
    this.walkerShadow.group.visible = !on;
  }

  /**
   * Poses the rig: `walk` is the stride phase and `stride` how big (0 = standing
   * still); `ride` blends to sitting on a bike (0 standing, 1 riding).
   */
  private pose(walk: number, stride: number, ride: number): void {
    const r = this.walker;
    const j = (n: string) => r.getObjectByName(n) as THREE.Object3D;
    const mixf = (a: number, b: number) => a + (b - a) * ride;
    const sw = Math.sin(walk) * stride;
    for (const [s, sign] of [
      ["L", 1],
      ["R", -1],
    ] as const) {
      const leg = sw * sign;
      j(`leg${s}`).rotation.z = mixf(leg * 0.55, 1.35);
      j(`leg${s}`).rotation.x = mixf(0, sign * 0.12);
      j(`shin${s}`).rotation.z = mixf(-Math.max(0, -leg) * 0.75, -1.55);
      j(`arm${s}`).rotation.z = mixf(-leg * 0.45, 1.05);
      j(`fore${s}`).rotation.z = mixf(0.15 * stride, 0.35);
    }
    j("torso").rotation.z = mixf(-0.04 * stride, -0.42);
    if (this.holding) {
      // The helmet hangs from his left hand, a little out from his side; it swings less.
      j("armL").rotation.z = mixf(-sw * 0.2, 0.35);
      j("armL").rotation.x = 0.14;
      j("foreL").rotation.z = mixf(0.05, 0.25);
    } else j("armL").rotation.x = mixf(0, 0.12);
  }

  /** The carried helmet back in his left hand. */
  private regrip(): void {
    const h = this.gripHome;
    h.parent.add(this.grip);
    this.grip.position.copy(h.position);
    this.grip.quaternion.copy(h.quaternion);
  }

  /**
   * Seated on the bike: puts the helmet on (`on`) or takes it off. His left arm
   * lifts the helmet from his hand up over his head and settles it (then reaches
   * for the bars), or the reverse; the helmet travels between hand and head.
   */
  private helmet(on: boolean, seconds = 1.6): Step {
    let t = 0;
    const w = this.walker;
    const head = () => w.getObjectByName("head") as THREE.Object3D;
    const worn = () => head().children.find((c) => c.userData.layer === "helmet") as THREE.Object3D;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    const lerpKeys = (k: [number, number][], x: number) => {
      for (let i = 1; i < k.length; i++) {
        const [t1, v1] = k[i] as [number, number];
        const [t0, v0] = k[i - 1] as [number, number];
        if (x <= t1) return v0 + (v1 - v0) * smooth((x - t0) / (t1 - t0));
      }
      return (k[k.length - 1] as [number, number])[1];
    };
    return (dt) => {
      t = Math.min(1, t + dt / seconds);
      // Going on runs forwards; coming off is the same motion backwards.
      const x = on ? t : 1 - t;
      const j = (n: string) => w.getObjectByName(n) as THREE.Object3D;
      // Hand by his side (holding) › up beside his head › out to the bars.
      j("armL").rotation.z = lerpKeys(
        [
          [0, 0.35],
          [0.5, 2.35],
          [1, 1.05],
        ],
        x,
      );
      j("armL").rotation.x = lerpKeys(
        [
          [0, 0.14],
          [0.5, 0.3],
          [1, 0.12],
        ],
        x,
      );
      j("foreL").rotation.z = lerpKeys(
        [
          [0, 0.25],
          [0.5, 1.25],
          [1, 0.35],
        ],
        x,
      );
      // The helmet: in the hand until x = 0.15, travels to the head by x = 0.55.
      const travel = smooth(Math.min(1, Math.max(0, (x - 0.15) / 0.4)));
      w.updateMatrixWorld(true);
      if (travel <= 0) {
        if (this.grip.parent !== this.gripHome.parent) this.regrip();
        dress(w, AROUND);
      } else if (travel >= 1) {
        dress(w, RIDING);
      } else {
        dress(w, { jacket: true, helmet: false, carry: true });
        // Out of the hand, between where the hand holds it and where it sits on his head.
        this.regrip();
        w.updateMatrixWorld(true);
        this.grip.getWorldPosition(a);
        this.grip.getWorldQuaternion(qa);
        worn().getWorldPosition(b);
        worn().getWorldQuaternion(qb);
        this.scene.add(this.grip);
        this.grip.position.lerpVectors(a, b, travel);
        // (A little arc up and over, rather than straight through his shoulder.)
        this.grip.position.y += Math.sin(Math.PI * travel) * 0.12;
        this.grip.quaternion.slerpQuaternions(qa, qb, travel);
        const sc = new THREE.Vector3();
        this.gripHome.parent.getWorldScale(sc);
        this.grip.scale.copy(sc);
      }
      if (travel <= 0 || travel >= 1) this.grip.scale.set(1, 1, 1);
      this.holding = travel <= 0;
      this.walkerShadow.rebuild();
      if (t < 1) return false;
      if (this.grip.parent !== this.gripHome.parent) this.regrip();
      dress(w, on ? RIDING : AROUND);
      this.holding = !on;
      return true;
    };
  }

  // ── input ───────────────────────────────────────────────────────────────

  private bind(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointerup", this.onUp);
  }

  private pick(e: PointerEvent): BikeKind | null {
    const c = this.canvas;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    let best: { k: BikeKind; d: number } | null = null;
    for (const [k, b] of this.bikes) {
      const hit = this.ray.intersectObject(b.group, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { k, d: hit.distance };
    }
    return best?.k ?? null;
  }

  private readonly onMove = (e: PointerEvent) => {
    if (this.seq || app.get().view !== "table") return;
    const k = this.pick(e);
    if (k !== this.hovered) {
      this.hovered = k;
      app.patch({ hovered: k ? routeOf(k) : null });
    }
    if (this.canvas) this.canvas.style.cursor = k ? "pointer" : "";
  };

  private readonly onDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };

  private readonly onUp = (e: PointerEvent) => {
    if (this.seq || app.get().view !== "table" || app.get().mode !== "garage") return;
    if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 8) return;
    const k = this.pick(e);
    if (k) app.patch({ selected: routeOf(k) });
  };

  // ── the pieces of a sequence ────────────────────────────────────────────

  /** Puts the bike into a riding rig (upright) at its current place; Adit not on it yet. */
  private takeBike(k: BikeKind): THREE.Group {
    const b = this.bikes.get(k) as BikeState;
    const rig = new THREE.Group();
    rig.rotation.order = "YXZ";
    rig.position.copy(b.group.position);
    rig.rotation.y = b.group.rotation.y;
    b.group.position.set(0, 0, 0);
    b.group.rotation.set(0, 0, 0);
    rig.add(b.group);
    this.scene.add(rig);
    this.rig = rig;
    // The seat: a little behind the middle, just under the top of the bike (in the rig's frame).
    rig.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(b.group);
    const top = box.max.y - rig.position.y;
    this.seatAt.set(-0.22 * BIKE_SCALE, top * 0.62 - 0.83, 0);
    return rig;
  }

  /** The bike's inner model (its lean onto the side stand lives here). */
  private lean(k: BikeKind, x: number): void {
    const inner = this.bikes.get(k)?.group.children[0];
    if (inner) inner.rotation.x = x;
  }

  /** Where Adit sits, in the rig's frame (his hips' origin): worked out when the bike is taken. */
  private seatAt = new THREE.Vector3();
  private seat(_k: BikeKind): THREE.Vector3 {
    return this.seatAt.clone();
  }

  /** The spot beside the bike where Adit stands to get on or off (the side nearer his spot). */
  private sideOf(rig: THREE.Group): THREE.Vector3 {
    const [ax, az] = at(...ADIT_AT);
    const best = [-1, 1]
      .map((s) => new THREE.Vector3(-0.15, 0, s * 0.95).applyMatrix4(rig.matrixWorld))
      .sort(
        (a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az),
      )[0] as THREE.Vector3;
    best.y = LIFT;
    return best;
  }

  /** Walks Adit to a point (world x, z), facing where he goes; then optionally turns to `face`. */
  private walkTo(to: () => THREE.Vector3, face?: () => number): Step {
    let phase = 0;
    let turned = 0;
    return (dt) => {
      const w = this.walker;
      const target = to();
      const dx = target.x - w.position.x;
      const dz = target.z - w.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.04) {
        const step = Math.min(d, WALK * dt);
        w.position.x += (dx / d) * step;
        w.position.z += (dz / d) * step;
        const want = Math.atan2(-dz, dx);
        w.rotation.y += wrapAngle(want - w.rotation.y) * (1 - Math.exp(-10 * dt));
        phase += dt * 8.5;
        this.pose(phase, 1, 0);
        return false;
      }
      // Arrived: settle the stride, then turn.
      this.pose(0, 0, 0);
      if (!face) return true;
      const want = face();
      const diff = wrapAngle(want - w.rotation.y);
      turned += dt;
      w.rotation.y += diff * (1 - Math.exp(-9 * dt));
      return Math.abs(diff) < 0.03 || turned > 1;
    };
  }

  /** Getting on (`on`) or off the bike in the rig: a little step up and swing, the pose blending to riding. */
  private mount(k: BikeKind, on: boolean, seconds = 1.2): Step {
    let t = 0;
    let from: THREE.Vector3 | null = null;
    let fromYaw = 0;
    return (dt) => {
      const rig = this.rig as THREE.Group;
      rig.updateMatrixWorld(true);
      const seat = this.seat(k).applyMatrix4(rig.matrixWorld);
      if (!from) {
        if (on) {
          from = this.walker.position.clone();
          fromYaw = this.walker.rotation.y;
        } else {
          // Off: from the seat, out of the rig, into the world (his shadow back with him).
          this.walkerShadow.group.visible = true;
          this.walker.removeFromParent();
          this.scene.add(this.walker);
          from = seat.clone();
          fromYaw = rig.rotation.y;
        }
      }
      t = Math.min(1, t + dt / seconds);
      const e = smooth(t);
      const side = on ? (from as THREE.Vector3) : this.sideOf(rig);
      const a = on ? (from as THREE.Vector3) : seat;
      const b = on ? seat : side;
      const w = this.walker;
      w.position.lerpVectors(a, b, e);
      w.position.y += Math.sin(Math.PI * e) * 0.28;
      const yawA = on ? fromYaw : rig.rotation.y;
      const yawB = on ? rig.rotation.y : rig.rotation.y + Math.PI / 2;
      w.rotation.y = yawA + wrapAngle(yawB - yawA) * e;
      this.pose(0, 0, on ? e : 1 - e);
      // The bike comes off its side stand as he sits (and back onto it after).
      this.lean(k, on ? STAND_LEAN * (1 - e) : STAND_LEAN * e);
      this.walkerShadow.rebuild();
      if (t < 1) return false;
      if (on) {
        // Sitting: ride with the bike. No shadow while riding (the bikes have none here).
        this.walkerShadow.group.visible = false;
        rig.add(w);
        w.position.copy(this.seat(k));
        w.rotation.set(0, 0, 0);
      }
      return true;
    };
  }

  /**
   * Rides the rig along a path in the frame (u, v), forwards, or backwards when
   * `reverse` (the bike keeps facing the way it faced). Climbs or drops the
   * ramp off the plot's left edge on the way. Slows to a stop at the end when
   * `stop`.
   */
  private rideAlong(
    pts: [number, number][],
    o: { top: number; reverse?: boolean; stop?: boolean; leave?: boolean; v0?: number },
  ): Step {
    const path = new THREE.CatmullRomCurve3(
      pts.map(([u, v]) => new THREE.Vector3(u, 0, v)),
      false,
      "centripetal",
    );
    const length = path.getLength();
    let s = 0;
    let v = o.v0 ?? 0;
    let yaw: number | null = null;
    return (dt) => {
      const rig = this.rig as THREE.Group;
      const left = length - s;
      const cap = o.stop ? Math.min(o.top, 0.4 + Math.sqrt(Math.max(0, left)) * 1.6) : o.top;
      v = Math.min(cap, v + dt * 4.5);
      this.engineV = v;
      if (o.stop && v > cap) v = cap;
      s = Math.min(length, s + v * dt);
      const t = s / length;
      const p = path.getPointAt(t);
      const tan = path.getTangentAt(t);
      const [x, z] = at(p.x, p.z);
      // On the plot until its left edge, the ramp, then the ground.
      const edge = -U;
      const foot = -U - RAMP.len;
      const down = Math.min(1, Math.max(0, (edge - p.x) / (edge - foot)));
      const y = LIFT * (1 - down);
      rig.position.set(x, y, z);
      if (o.reverse) {
        if (yaw === null) yaw = rig.rotation.y;
        rig.rotation.y = yaw;
      } else {
        const want = heading(tan.x, tan.z);
        rig.rotation.y += wrapAngle(want - rig.rotation.y) * (1 - Math.exp(-14 * dt));
      }
      // Nose down (or up) on the ramp, eased at its ends.
      const onRamp = down > 0 && down < 1 ? smooth(Math.min(1, down * 6, (1 - down) * 6)) : 0;
      const climbing = tan.x > 0;
      rig.rotation.z = Math.atan2(LIFT, RAMP.len) * onRamp * (climbing ? 1 : -1);
      this.walkerShadow.setFloor(y + 0.012);
      setShadowColour(this.walkerShadow.material, mix(down >= 1 ? OUTSIDE : YARD, INK, 0.14));
      // Riding out: done the moment bike and rider have left the frame (no riding on unseen).
      if (o.leave && s > length * 0.5 && this.offscreen(rig)) return true;
      return s >= length;
    };
  }

  /** Whether something has gone wholly out of view past the left edge (where the ride out leaves). */
  private offscreen(o: THREE.Object3D): boolean {
    const box = new THREE.Box3().setFromObject(o);
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          if (new THREE.Vector3(x, y, z).project(this.camera).x >= -1) return false;
        }
    return true;
  }

  /** Turns the rig on the spot to a yaw. */
  private turnTo(yaw: number): Step {
    let t = 0;
    return (dt) => {
      const rig = this.rig as THREE.Group;
      t += dt;
      const diff = wrapAngle(yaw - rig.rotation.y);
      rig.rotation.y += diff * (1 - Math.exp(-6 * dt));
      return Math.abs(diff) < 0.02 || t > 1.5;
    };
  }

  /** Starts (a blip of revs) or stops the engine. */
  private ignite(on: boolean): Step {
    return () => {
      this.engineOn = on;
      this.engineV = 0;
      if (on) this.rev = 0.7;
      return true;
    };
  }

  /** A pause. */
  private wait(seconds: number): Step {
    let t = 0;
    return (dt) => {
      t += dt;
      return t >= seconds;
    };
  }

  private run(kind: BikeKind, steps: Step[], finish: () => void, settle = false): Promise<void> {
    return new Promise((done) => {
      this.seq = { kind, steps, finish, done, settle };
    });
  }

  // ── the ride out ────────────────────────────────────────────────────────

  /** Plays the ride out on the selected bike; resolves once it's left the frame. */
  depart(id: RouteId): Promise<void> {
    const k = kindOf(id);
    const b = k ? this.bikes.get(k) : undefined;
    if (!k || !b) return Promise.resolve();
    this.cancelRitual();
    if (this.reduced) return Promise.resolve();
    const rig = this.takeBike(k);
    rig.updateMatrixWorld(true);
    // Adit sets off from where he stands.
    this.still(false);
    const [ax, az] = at(...ADIT_AT);
    this.walker.position.set(ax, LIFT, az);
    this.walker.rotation.set(0, this.aditYaw, 0);
    this.regrip();
    this.holding = true;
    dress(this.walker, AROUND);
    this.pose(0, 0, 0);
    this.walkerShadow.setFloor(LIFT + 0.012);
    this.walkerShadow.rebuild();
    const side = this.sideOf(rig);
    // Out: forward, swing right (screen-left), along the front, down the ramp, away.
    const [u0, v0] = pulled(k, b.pull);
    const out: [number, number][] = [
      [u0, v0],
      [u0 - 0.2, v0 + 0.8],
      [u0 - 1.4, RAMP.v - 0.05],
      [u0 - 3.2, RAMP.v],
      [-U + 0.4, RAMP.v],
      [-U - RAMP.len * 0.5, RAMP.v],
      [-U - RAMP.len - 2, RAMP.v + 0.2],
      [-U - RAMP.len - 26, RAMP.v + 1.6],
    ];
    const steps: Step[] = [
      // Over to the bike, then face it.
      this.walkTo(
        () => side,
        () =>
          Math.atan2(
            -(rig.position.z - this.walker.position.z),
            rig.position.x - this.walker.position.x,
          ),
      ),
      this.mount(k, true),
      this.wait(0.15),
      // Helmet on, the engine fires up, then off he goes.
      this.helmet(true),
      this.ignite(true),
      this.wait(0.6),
      this.rideAlong(out, { top: 6.5, leave: true }),
    ];
    return this.run(k, steps, () => {
      // Skipped: straight to the end (already out of frame).
      const [x, z] = at(...(out[out.length - 1] as [number, number]));
      if (this.walker.parent !== rig) {
        rig.add(this.walker);
        this.walker.position.copy(this.seat(k));
        this.walker.rotation.set(0, 0, 0);
        this.pose(0, 0, 1);
      }
      this.regrip();
      this.grip.scale.set(1, 1, 1);
      this.holding = false;
      this.walkerShadow.group.visible = false;
      dress(this.walker, RIDING);
      this.pose(0, 0, 1);
      rig.position.set(x, 0, z);
    });
  }

  /** The hand-over to the world happens under the veil; nothing to play here. */
  plunge(): Promise<void> {
    return new Promise((r) => setTimeout(r, 120));
  }

  // ── coming home ─────────────────────────────────────────────────────────

  /**
   * Back from a world: the bike rides in from the left, up the ramp and along
   * the front, turns to face out in front of its bay, backs in; Adit gets off
   * and walks back to his spot.
   */
  welcome(id: RouteId): Promise<void> {
    const k = kindOf(id);
    this.cancelRitual();
    // Home: nothing picked any more (the bike goes back into its bay).
    app.patch({ selected: null });
    const b = k ? this.bikes.get(k) : undefined;
    if (!k || !b || this.reduced) return Promise.resolve();
    // Start out of frame on the left, Adit already on the bike.
    const rig = this.takeBike(k);
    this.lean(k, 0);
    this.still(false);
    rig.add(this.walker);
    this.walker.position.copy(this.seat(k));
    this.walker.rotation.set(0, 0, 0);
    this.regrip();
    this.holding = false;
    dress(this.walker, RIDING);
    this.pose(0, 0, 1);
    // On the bike, no shadow (the bikes have none in the yard); the engine running.
    this.walkerShadow.group.visible = false;
    this.engineOn = true;
    this.engineV = 6;
    // Start just out of view on the left, already riding, so it's in frame at once.
    rig.rotation.y = heading(1, 0);
    this.camera.updateMatrixWorld();
    const lane = RAMP.v + 0.2;
    let u0 = -U - RAMP.len - 2.5;
    for (let k = 0; k < 120; k++) {
      const [x, z] = at(u0, lane);
      rig.position.set(x, 0, z);
      rig.updateMatrixWorld(true);
      if (this.offscreen(rig)) break;
      u0 -= 0.5;
    }
    const start: [number, number] = [u0 - 0.5, lane];
    rig.position.set(
      ...(() => {
        const [x, z] = at(...start);
        return [x, 0, z] as [number, number, number];
      })(),
    );
    // Where it backs in from: in front of its bay on the bay line (or in front of the pad).
    const secret = k === SECRET;
    const lineDir: [number, number] = secret ? [0, 1] : [Math.sin(LEAN), Math.cos(LEAN)];
    const front: [number, number] = secret
      ? [SECRET_AT[0], SECRET_AT[1] + 3]
      : pulled(k, (RAMP.v + 1.9 - BAY_V) / Math.cos(LEAN));
    const homeAt = home(k);
    const approach: [number, number][] = [
      start,
      ...(start[0] < -U - RAMP.len - 3
        ? ([[-U - RAMP.len - 2, RAMP.v + 0.2]] as [number, number][])
        : []),
      [-U - RAMP.len * 0.5, RAMP.v],
      [-U + 0.6, RAMP.v],
      [front[0] - 4.2, RAMP.v],
      [front[0] - 1.2, front[1] - 1.1],
      front,
    ];
    const outYaw = heading(...lineDir);
    const steps: Step[] = [
      this.rideAlong(approach, { top: 6, stop: true, v0: 6 }),
      this.turnTo(outYaw),
      this.wait(0.2),
      this.rideAlong([front, homeAt], { top: 1.1, reverse: true, stop: true }),
      // Parked: the engine off.
      this.ignite(false),
      this.wait(0.25),
      // Parked: helmet off and into his left hand, then he gets off.
      this.helmet(false),
      this.wait(0.15),
      this.mount(k, false),
      this.walkTo(
        () => {
          const [x, z] = at(...ADIT_AT);
          return new THREE.Vector3(x, LIFT, z);
        },
        () => heading(0, 1),
      ),
    ];
    return this.run(k, steps, () => this.cancelRitual(), true);
  }

  /** Jumps a sequence to its end. */
  skipRitual(): void {
    const s = this.seq;
    if (!s) return;
    s.finish();
    s.steps = [];
  }

  /** Puts everything back as it is at rest: bikes parked, Adit on his spot. */
  cancelRitual(): void {
    const s = this.seq;
    this.seq = null;
    this.engineOn = false;
    const rig = this.rig;
    this.rig = null;
    if (rig) {
      for (const [k, b] of this.bikes) {
        if (b.group.parent !== rig) continue;
        this.scene.add(b.group);
        // It rests where it is (in its bay, or back at its pulled-out spot if cancelled
        // early), turned as it ended up; the springs ease it from there.
        b.yaw = rig.rotation.y;
        b.yawV = 0;
        b.pullV = 0;
        b.group.rotation.set(0, b.yaw, 0);
        this.lean(k, STAND_LEAN);
      }
      rig.removeFromParent();
    }
    this.walker.removeFromParent();
    this.scene.add(this.walker);
    this.regrip();
    this.grip.scale.set(1, 1, 1);
    this.holding = true;
    dress(this.walker, AROUND);
    this.still(true);
    s?.done();
  }

  // ── frame ───────────────────────────────────────────────────────────────

  update(dt: number, _t: number): void {
    // The engine, while it runs: revs as it fires up, then with the bike's speed.
    if (this.engineOn) {
      this.rev = Math.max(0, this.rev - dt);
      const blip = this.rev > 0 ? Math.sin((this.rev / 0.7) * Math.PI) : 0;
      this.sound.engine(
        Math.max(blip, this.engineV > 0.3 ? 0.55 : 0.12),
        this.engineV + blip * 3,
        7,
        dt,
      );
    }
    const s = app.get();
    // The picked bike stays out even as the app switches to the world (Ride sets the
    // mode a frame before the ride out starts): nothing here is shown in a world anyway.
    const sel = kindOf(s.selected);
    const [ax, az] = at(...ADIT_AT);
    for (const [k, b] of this.bikes) {
      if (this.rig && b.group.parent === this.rig) continue;
      const picked = k === sel;
      // A picked bike glides out of its bay along the bay lines; the secret
      // bike stays on its pad and turns to face Adit instead.
      const pullTo = picked && k !== SECRET ? PULL : 0;
      const [x0, z0] = at(...home(k));
      const face = Math.atan2(-(az - z0), ax - x0);
      let yawTo = picked && k === SECRET ? face : PARKED;
      yawTo = b.yaw + wrapAngle(yawTo - b.yaw);
      if (this.reduced) {
        b.pull = pullTo;
        b.yaw = yawTo;
      } else {
        [b.pull, b.pullV] = spring(b.pull, b.pullV, pullTo, 4.2, dt);
        [b.yaw, b.yawV] = spring(b.yaw, b.yawV, yawTo, 4.2, dt);
      }
      const [x, z] = at(...pulled(k, b.pull));
      b.group.position.set(x, LIFT + (k === SECRET ? PAD : 0), z);
      b.group.rotation.y = b.yaw;
    }
    // Adit standing: waves until a bike is picked, then turns and points at it.
    if (!this.seq) {
      const picked = sel ? this.bikes.get(sel) : undefined;
      const pointing = !!picked;
      this.standing.wave.visible = !pointing;
      this.standing.point.visible = pointing;
      this.standing.shadow.wave.group.visible = !pointing;
      this.standing.shadow.point.group.visible = pointing;
      const want = picked
        ? Math.atan2(-(picked.group.position.z - az), picked.group.position.x - ax)
        : heading(0, 1);
      const d = wrapAngle(want - this.aditYaw);
      this.aditYaw += this.reduced ? d : d * (1 - Math.exp(-8 * dt));
      for (const a of [this.standing.wave, this.standing.point]) a.rotation.y = this.aditYaw;
      this.standing.shadow.wave.update();
      this.standing.shadow.point.update();
    }
    this.step(dt);
  }

  private step(dt: number): void {
    const s = this.seq;
    if (!s) return;
    const head = s.steps[0];
    if (head?.(dt)) s.steps.shift();
    this.rig?.updateMatrixWorld(true);
    this.walker.updateMatrixWorld(true);
    this.walkerShadow.update();
    if (s.steps.length === 0) {
      // Coming home settles back to rest; a ride out stays where it ended (out of
      // frame) until the stage hands over.
      if (s.settle) {
        this.cancelRitual();
        return;
      }
      const done = s.done;
      s.done = () => {};
      done();
    }
  }

  // ── framing ─────────────────────────────────────────────────────────────

  /**
   * Frames the whole plot (and the ramp) in the part of the screen the UI
   * leaves free, keep in step with the yard's CSS:
   *  - the top bar across the top;
   *  - the card's caption bar (and the passport button) along the bottom.
   * The plot stays the centrepiece: centred left to right, nothing over it.
   * The plot is fitted into that free region (by projecting its corners) and
   * centred in it; the camera's angle never changes.
   */
  resize(layout: Layout): void {
    const { w, h } = layout;
    const short = h <= 520 && w > h;
    const portrait = h > w;
    const top = short ? 52 : 76;
    const left = 0;
    const bottom = short ? 84 : 142;
    const rw = Math.max(1, w - left);
    const rh = Math.max(1, h - top - bottom);
    const FOV = 38;
    const e = THREE.MathUtils.degToRad(42);
    const target = at(0, (V0 + V1) / 2 + 0.6);
    // Everything that must be on screen: the plot's corners (with the ramp), at ground and head height.
    const pts: THREE.Vector3[] = [];
    // (Tall things stand at the back; at the front only the plot's edge and the steps.)
    // (In portrait the width is precious: fit the plot itself and let the ramp run off the edge.)
    for (const u of [portrait ? -U - 0.3 : -U - RAMP.len * 0.7, U + 0.5])
      for (const [v, y] of [
        [V0 - 0.4, 0],
        [V0 + 1.5, 3.2],
        [V1 + 1.4, 0],
      ] as const) {
        const [x, z] = at(u, v);
        pts.push(new THREE.Vector3(x, y, z));
      }
    // Fit them into the free region: a camera with the region's own shape.
    const probe = new THREE.PerspectiveCamera(FOV, rw / rh, 0.5, 400);
    const place = (cam: THREE.PerspectiveCamera, dist: number) => {
      cam.position.set(
        target[0] + Math.cos(e) * TOWARD[0] * dist,
        Math.sin(e) * dist,
        target[1] + Math.cos(e) * TOWARD[1] * dist,
      );
      cam.lookAt(target[0], 0.6, target[1]);
      cam.updateMatrixWorld(true);
    };
    let lo = 8;
    let hi = 200;
    const v = new THREE.Vector3();
    for (let i = 0; i < 28; i++) {
      const dist = (lo + hi) / 2;
      place(probe, dist);
      probe.updateProjectionMatrix();
      const fits = pts.every((p) => {
        v.copy(p).project(probe);
        return Math.abs(v.x) < 0.97 && Math.abs(v.y) < 0.95;
      });
      if (fits) hi = dist;
      else lo = dist;
    }
    // The real camera: the same view, widened to the whole screen and shifted so
    // the region's middle is the plot's middle.
    const cam = this.camera;
    place(cam, hi);
    cam.aspect = w / h;
    cam.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (h / rh)),
    );
    const dx = left / 2;
    const dy = (top - bottom) / 2;
    if (dx || dy) cam.setViewOffset(w, h, -dx, -dy, w, h);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }

  /** The camera is fixed; nothing to snap. */
  snapCamera(): void {}

  /**
   * At night: the full moon high in the corner, the sign, the chai shop, the
   * cottage, the chai cart and the string lights lit, and the bike's beam
   * while it's ridden out or home.
   */
  lights(night: NightPass): void {
    night.moon = { u: 0.13, v: 0.8, r: 0.07 };
    night.lamps = YARD_LAMPS;
    const rig = this.rig;
    if (rig && this.walker.parent === rig) {
      const h = rig.rotation.y;
      night.beam = {
        x: rig.position.x + Math.cos(h) * 1.1,
        z: rig.position.z - Math.sin(h) * 1.1,
        heading: h,
        on: true,
      };
    }
  }

  /** No 360° view in the yard. */
  spinDegrees(): number {
    return 0;
  }

  nudge(_delta: number): void {}

  /** Ids of every bike, in bay order (for keyboard picking). */
  static order(): RouteId[] {
    return ALL.map(routeOf);
  }

  dispose(canvas: HTMLCanvasElement): void {
    canvas.removeEventListener("pointermove", this.onMove);
    canvas.removeEventListener("pointerdown", this.onDown);
    canvas.removeEventListener("pointerup", this.onUp);
    canvas.style.cursor = "";
    this.sound.dispose();
    // Toy geometries are shared (cached in the kit) and reused by the worlds: leave them.
  }
}
