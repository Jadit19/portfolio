/**
 * Life that notices you, shared by every journey.
 *
 * - People and animals tagged `userData.dodge` ("person", "animal", "herd")
 *   step or trot out of your way, and are solid if you still touch one (a
 *   gentle bounce; they're never pushed). Once you've gone they wander home.
 * - The horn: flocks (`userData.birds`) scatter and drift back, people hop,
 *   animals look up, and elephants (`userData.elephant`) trumpet if you're near.
 * - A herd (the "herd" dodgers) crosses the road now and then: a wait moment.
 *   While they're on the road they're solid, so you stop and let them pass.
 */

import * as THREE from "three";
import { angleDelta } from "../anim";
import type { Road } from "../lib/journey";
import type { Blocker } from "./bike";
import type { Ground } from "./ground";

type Kind = "person" | "animal" | "herd";

interface Dodger {
  obj: THREE.Object3D;
  kind: Kind;
  home: THREE.Vector2;
  /** Where it's heading now. */
  goal: THREE.Vector2;
  pos: THREE.Vector2;
  yaw: number;
  hop: number;
  /** Seconds since the bike was last close. */
  calm: number;
  /** Set while the herd is crossing: where this animal is walking to. */
  cross: THREE.Vector2 | null;
  delay: number;
  look: number;
}

interface Flock {
  obj: THREE.Object3D;
  /** Where the flock circles, and how (so the sky is never the same twice). */
  home: THREE.Vector3;
  orbit: { r: number; speed: number; phase: number };
  base: THREE.Vector3;
  off: THREE.Vector3;
  vel: THREE.Vector3;
  scare: number;
}

/** A route for something that travels (userData.route on the object). */
export interface Route {
  pts: [number, number][];
  /** Metres per second. */
  speed: number;
  /** How far behind the route's start it is (for a column, like a caravan). */
  offset?: number;
  closed?: boolean;
  /** Solid radius, if you can bump into it, and how long it is (front to back). */
  solid?: number;
  length?: number;
  /** A fixed height instead of the ground's (e.g. a train on its rails). */
  y?: number;
  lift?: number;
  /** Extra turn (for models built facing another way). */
  yaw?: number;
  /** Always face this way (a push-pull train shuttling back and forth). */
  face?: number;
  /** Seconds it waits at a repeated point (a train at the station). */
  dwell?: number;
  /** How far ahead of its origin the front is (where its solid circles start). */
  front?: number;
}

export interface Bike {
  x: number;
  z: number;
  heading: number;
  v: number;
}

export interface HonkHeard {
  birds: boolean;
  trumpet: boolean;
  low: boolean;
}

export class Life {
  readonly group = new THREE.Group();
  private readonly dodgers: Dodger[] = [];
  private readonly flocks: Flock[] = [];
  private readonly elephants: THREE.Object3D[] = [];
  /** Things that turn (dust devils), radians per second in userData.spin. */
  private readonly spinners: THREE.Object3D[] = [];
  /** Crowds doing a Mexican wave (userData.wave: instanced fans on a stand). */
  private readonly waves: {
    pts: number[];
    len: number;
    parts: { mesh: THREE.InstancedMesh; dy: number; arm?: boolean }[];
    speed: number;
  }[] = [];
  /**
   * Toll booms (userData.gate: { arm, flash }): the arm lifts as a bike rides
   * through its lane, with a green APPROVED flash, and settles back after.
   */
  private readonly gates: {
    obj: THREE.Object3D;
    arm: THREE.Object3D;
    flash: THREE.Object3D;
    lift: number;
    shown: number;
    clear: number;
  }[] = [];
  /**
   * Start lights (userData.lights: { reds, green }): as a bike rolls up to the gantry the five
   * red columns come on one by one, go out together, and the green row shows: lights out.
   */
  private readonly lights: {
    obj: THREE.Object3D;
    reds: THREE.Object3D[];
    green: THREE.Object3D;
    /** Seconds into the sequence (−1: waiting for a bike). */
    t: number;
  }[] = [];
  /**
   * Birds in the fields (userData.fowl: { kind, head, fan?, train? }): peacocks and peahens
   * potter and peck, egrets hop about; all edge away from a bike that comes close. A
   * displaying peacock opens its fan as a bike nears and turns to show it off.
   */
  private readonly fowl: {
    obj: THREE.Object3D;
    kind: "peck" | "display" | "egret";
    head: THREE.Object3D;
    fan?: THREE.Object3D;
    train?: THREE.Object3D;
    home: THREE.Vector2;
    pos: THREE.Vector2;
    goal: THREE.Vector2 | null;
    yaw: number;
    /** Peck progress (0–1), or −1 between pecks; seconds to the next peck and the next stroll. */
    peck: number;
    nextPeck: number;
    nextWalk: number;
    open: number;
    want: number;
    shy: number;
    t: number;
  }[] = [];
  /** A pump's gushing water (userData.gush: { jet, splash }). */
  private readonly gushes: { jet: THREE.Object3D; splash: THREE.Object3D; t: number }[] = [];
  /** Things on a route (a train, a caravan, a sandstorm): userData.route. */
  private readonly movers: {
    obj: THREE.Object3D;
    route: Route;
    lengths: number[];
    total: number;
  }[] = [];
  /** The herd's two grazing grounds, either side of the road. */
  private herdSides: [THREE.Vector2, THREE.Vector2] | null = null;
  private herdSide = 0;
  private nextCross = 40 + Math.random() * 30;
  private crossing = false;
  private trumpetBob = 0;
  private clock = 0;
  /** Fires when the herd sets off across the road (for a sound). */
  onHerdMoves: (() => void) | null = null;

  constructor(
    objs: THREE.Object3D[],
    private readonly ground: Ground,
    private readonly blockers: Blocker[],
    roads: { road: Road; width: number }[],
    herd?: { x: number; z: number },
    /** The world's tile, so travellers show on your side of the seam. */
    private readonly size?: { w: number; d: number },
  ) {
    for (const obj of objs) {
      this.group.add(obj);
      const d = obj.userData.dodge as Kind | undefined;
      if (d) {
        const p = new THREE.Vector2(obj.position.x, obj.position.z);
        this.dodgers.push({
          obj,
          kind: d,
          home: p.clone(),
          goal: p.clone(),
          pos: p.clone(),
          yaw: obj.rotation.y,
          hop: 0,
          calm: 99,
          cross: null,
          delay: 0,
          look: 0,
        });
      } else if (obj.userData.birds) {
        const k = this.flocks.length;
        this.flocks.push({
          obj,
          home: obj.position.clone(),
          orbit: { r: 14 + k * 6, speed: (k % 2 ? -1 : 1) * (0.05 + k * 0.012), phase: k * 2.1 },
          base: obj.position.clone(),
          off: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          scare: 0,
        });
      } else if (obj.userData.elephant) {
        this.elephants.push(obj);
      } else if (typeof obj.userData.spin === "number") {
        this.spinners.push(obj);
      } else if (obj.userData.fowl) {
        const f = obj.userData.fowl as {
          kind: "peck" | "display" | "egret";
          head: THREE.Object3D;
          fan?: THREE.Object3D;
          train?: THREE.Object3D;
        };
        const p = new THREE.Vector2(obj.position.x, obj.position.z);
        this.fowl.push({
          obj,
          ...f,
          home: p.clone(),
          pos: p.clone(),
          goal: null,
          yaw: obj.rotation.y,
          peck: -1,
          nextPeck: 1 + Math.random() * 3,
          nextWalk: 2 + Math.random() * 8,
          open: 0,
          want: 0,
          shy: 0,
          t: Math.random() * 10,
        });
      } else if (obj.userData.gush) {
        const g = obj.userData.gush as { jet: THREE.Object3D; splash: THREE.Object3D };
        this.gushes.push({ ...g, t: Math.random() * 5 });
      } else if (obj.userData.lights) {
        const l = obj.userData.lights as { reds: THREE.Object3D[]; green: THREE.Object3D };
        this.lights.push({ obj, reds: l.reds, green: l.green, t: -1 });
      } else if (obj.userData.gate) {
        const g = obj.userData.gate as { arm: THREE.Object3D; flash: THREE.Object3D };
        this.gates.push({ obj, arm: g.arm, flash: g.flash, lift: 0, shown: 0, clear: 99 });
      } else if (obj.userData.wave) {
        this.waves.push({ ...obj.userData.wave, speed: 5 + (this.waves.length % 3) });
      } else if (obj.userData.route) {
        const route = obj.userData.route as Route;
        const lengths = [0];
        let total = 0;
        const pts = route.closed ? [...route.pts, route.pts[0] ?? [0, 0]] : route.pts;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          // A repeated point is a pause (dwell seconds there).
          if (a && b)
            total += Math.hypot(b[0] - a[0], b[1] - a[1]) || (route.dwell ?? 0) * route.speed;
          lengths.push(total);
        }
        this.movers.push({ obj, route: { ...route, pts }, lengths, total });
      }
    }
    // The herd's crossing: from its clearing straight over the nearest road.
    if (herd && this.dodgers.some((d) => d.kind === "herd")) {
      let best = { x: herd.x, z: herd.z, d: Number.POSITIVE_INFINITY };
      for (const { road } of roads)
        for (const s of road.samples) {
          const d = Math.hypot(s.x - herd.x, s.z - herd.z);
          if (d < best.d) best = { x: s.x, z: s.z, d };
        }
      const h = new THREE.Vector2(herd.x, herd.z);
      const r = new THREE.Vector2(best.x, best.z);
      const across = r.clone().add(r.clone().sub(h).setLength(Math.min(12, best.d)));
      this.herdSides = [h, across];
    }
  }

  /** The horn: who heard it, so the caller can play the right sounds. */
  honk(b: Bike): HonkHeard {
    const heard: HonkHeard = { birds: false, trumpet: false, low: false };
    for (const f of this.flocks) {
      const d = Math.hypot(f.base.x - b.x, f.base.z - b.z);
      if (d > 45) continue;
      heard.birds = true;
      // Burst away from the noise and up.
      const away = new THREE.Vector3(f.base.x - b.x, 0, f.base.z - b.z).setLength(9);
      f.vel.set(away.x, 7, away.z);
      f.scare = 3.5;
    }
    for (const d of this.dodgers) {
      const dist = d.pos.distanceTo(new THREE.Vector2(b.x, b.z));
      if (dist > 30) continue;
      if (d.kind === "person")
        d.hop = 1; // a little hop and a wave
      else {
        d.look = 1.6; // heads up
        if (d.kind === "herd") heard.low = true;
      }
    }
    for (const e of this.elephants) {
      if (Math.hypot(e.position.x - b.x, e.position.z - b.z) < 50) {
        heard.trumpet = true;
        this.trumpetBob = 1;
      }
    }
    return heard;
  }

  /** Lifts a toll boom while a bike is in its lane (local −3…0 across, ±4.5 along). */
  private updateGates(b: Bike, dt: number, reduced: boolean): void {
    const v = new THREE.Vector3();
    for (const g of this.gates) {
      // The bike in the gate's frame (the nearest copy across the seam).
      let bx = b.x;
      let bz = b.z;
      if (this.size) {
        const p = g.obj.position;
        bx -= this.size.w * Math.round((bx - p.x) / this.size.w);
        bz -= this.size.d * Math.round((bz - p.z) / this.size.d);
      }
      g.obj.updateMatrixWorld();
      v.set(bx, 0, bz).applyMatrix4(g.obj.matrixWorld.clone().invert());
      const inLane = v.x > -3.2 && v.x < 0.2 && Math.abs(v.z) < 4.5;
      if (inLane) {
        if (g.clear > 1.5) g.shown = 1.6;
        g.clear = 0;
      } else g.clear += dt;
      const want = g.clear < 1.2 ? 1 : 0;
      // Up briskly, down gently (eased, never a snap).
      g.lift += (want - g.lift) * (1 - Math.exp(-dt * (want > g.lift ? 7 : 2.5)));
      if (reduced) g.lift = want;
      g.arm.rotation.z = -g.lift * 1.35;
      g.shown = Math.max(0, g.shown - dt);
      g.flash.visible = g.shown > 0;
    }
  }

  /** Peacocks, peahens and egrets: pottering, pecking, hopping, shying, displaying. */
  private updateFowl(b: Bike, dt: number, reduced: boolean): void {
    for (const f of this.fowl) {
      f.t += dt;
      let dx = b.x - f.pos.x;
      let dz = b.z - f.pos.y;
      if (this.size) {
        dx -= this.size.w * Math.round(dx / this.size.w);
        dz -= this.size.d * Math.round(dz / this.size.d);
      }
      const d = Math.hypot(dx, dz);
      // Too close (and coming): edge away from the bike, then wander home later.
      if (!reduced && d < (f.kind === "display" ? 3.5 : 6) && (Math.abs(b.v) > 0.8 || d < 2.5)) {
        const l = d || 1;
        f.goal = new THREE.Vector2(f.pos.x - (dx / l) * 3.5, f.pos.y - (dz / l) * 3.5);
        f.shy = 1.5;
        f.peck = -1;
      }
      f.shy = Math.max(0, f.shy - dt);
      if (!reduced && f.kind !== "display" && !f.goal) {
        f.nextWalk -= dt;
        if (f.nextWalk <= 0) {
          const r = f.kind === "egret" ? 2.8 : 1.8;
          const a = Math.random() * Math.PI * 2;
          f.goal = new THREE.Vector2(
            f.home.x + Math.cos(a) * r * Math.random(),
            f.home.y + Math.sin(a) * r * Math.random(),
          );
          f.nextWalk = f.kind === "egret" ? 3 + Math.random() * 4 : 5 + Math.random() * 7;
        }
      }
      let lift = 0;
      if (f.goal) {
        const want = f.goal.clone().sub(f.pos);
        const gap = want.length();
        if (gap < 0.05) f.goal = null;
        else {
          const speed = f.shy > 0 ? 2.4 : f.kind === "egret" ? 0.9 : 0.5;
          f.pos.add(want.setLength(Math.min(gap, speed * dt)));
          const yaw = Math.atan2(-(f.goal.y - f.pos.y), f.goal.x - f.pos.x);
          f.yaw += angleDelta(f.yaw, yaw) * (1 - Math.exp(-5 * dt));
          // Egrets go in little hops; the peafowl bob as they walk.
          lift =
            f.kind === "egret"
              ? 0.14 * Math.abs(Math.sin(f.t * 8))
              : 0.02 * Math.abs(Math.sin(f.t * 9));
        }
      } else if (f.kind !== "display" && !reduced) {
        // Standing: a peck now and then (the head dips forward and comes back up, eased).
        if (f.peck < 0) {
          f.nextPeck -= dt;
          if (f.nextPeck <= 0) {
            f.peck = 0;
            f.nextPeck = 1.5 + Math.random() * 3;
          }
        } else {
          f.peck += dt / 0.8;
          if (f.peck >= 1) f.peck = -1;
        }
      }
      const p = f.peck < 0 ? 0 : Math.sin(f.peck * Math.PI) ** 2;
      f.head.rotation.z = -p * 1.1;
      if (f.kind === "display" && f.fan) {
        // Opens as a bike comes within 20 m, folds once it's 28 m off; faces the bike while open.
        if (d < 20) f.want = 1;
        else if (d > 28) f.want = 0;
        f.open = reduced ? f.want : f.open + (f.want - f.open) * (1 - Math.exp(-1.8 * dt));
        const o = Math.max(0.02, f.open);
        f.fan.scale.set(1, o, o);
        f.fan.rotation.z = (1 - f.open) * 0.9;
        f.fan.visible = f.open > 0.03;
        if (f.train) f.train.visible = f.open < 0.5;
        if (f.open > 0.3 && !reduced) {
          const yaw = Math.atan2(-dz, dx);
          f.yaw += angleDelta(f.yaw, yaw) * (1 - Math.exp(-1.2 * dt));
        }
      }
      f.obj.position.set(f.pos.x, lift, f.pos.y);
      f.obj.rotation.y = f.yaw;
    }
    for (const g of this.gushes) {
      g.t += dt;
      if (reduced) continue;
      g.jet.scale.set(1, 1 + 0.15 * Math.sin(g.t * 11), 1 + 0.1 * Math.sin(g.t * 7));
      g.splash.position.y = 0.06 * Math.abs(Math.sin(g.t * 13));
      g.splash.rotation.y += dt * 0.8;
    }
  }

  /** One red column every 0.7 s, all five held, then lights out and green for 2 s. */
  private updateLights(b: Bike, dt: number, reduced: boolean): void {
    for (const l of this.lights) {
      let dx = b.x - l.obj.position.x;
      let dz = b.z - l.obj.position.z;
      if (this.size) {
        dx -= this.size.w * Math.round(dx / this.size.w);
        dz -= this.size.d * Math.round(dz / this.size.d);
      }
      const d = Math.hypot(dx, dz);
      if (l.t < 0 && d < 28) l.t = 0;
      else if (l.t >= 0) l.t += dt;
      // Re-arm once the bike has gone and the sequence has finished.
      if (l.t > 6.5 && d > 45) l.t = -1;
      const t = reduced && l.t >= 0 ? 4.5 : l.t;
      l.reds.forEach((r, k) => {
        r.visible = t >= 0.7 * (k + 1) && t < 4.3;
      });
      l.green.visible = t >= 4.3 && t < 6.5;
    }
  }

  update(b: Bike, dt: number, reduced: boolean): void {
    this.herd(b, dt);
    const bike = new THREE.Vector2(b.x, b.z);
    const fx = Math.cos(b.heading);
    const fz = -Math.sin(b.heading);
    this.blockers.length = 0;
    for (const d of this.dodgers) {
      const toMe = d.pos.clone().sub(bike);
      const dist = toMe.length();
      const reach = d.kind === "person" ? 4.2 : 5.5;
      const coming = dist < reach && (Math.abs(b.v) > 0.8 || dist < 2.4);
      if (d.cross) {
        // Crossing: walk on, in a loose line, after a short stagger.
        d.delay -= dt;
        if (d.delay <= 0) d.goal.copy(d.cross);
        if (d.pos.distanceTo(d.cross) < 0.3) {
          d.home.copy(d.cross);
          d.cross = null;
        }
      } else if (coming) {
        // Step aside: off the bike's line, to whichever side we're already on.
        const side = Math.sign(fx * toMe.y - fz * toMe.x) || 1;
        const rx = -fz * side;
        const rz = fx * side;
        const step = d.kind === "person" ? 2.6 : 3.4;
        d.goal.set(d.pos.x + rx * step + fx * 0.6, d.pos.y + rz * step + fz * 0.6);
        d.calm = 0;
        if (d.kind === "person" && d.hop < 0.05) d.hop = 1;
      } else {
        d.calm += dt;
        if (d.calm > 3) d.goal.copy(d.home); // wander back home once you've gone
      }
      // Move toward the goal: brisk when dodging, an amble otherwise.
      const want = d.goal.clone().sub(d.pos);
      const gap = want.length();
      const speed = d.cross ? 1.3 : d.calm < 1 ? (d.kind === "person" ? 3.6 : 4.5) : 0.9;
      if (gap > 0.05) {
        const stepLen = Math.min(gap, speed * dt);
        d.pos.add(want.setLength(stepLen));
        const yaw = Math.atan2(-(d.goal.y - d.pos.y), d.goal.x - d.pos.x);
        d.yaw += angleDelta(d.yaw, yaw) * (1 - Math.exp(-6 * dt));
      }
      const walking = gap > 0.05 ? 1 : 0;
      d.hop = Math.max(0, d.hop - dt * 1.6);
      d.look = Math.max(0, d.look - dt);
      const y = this.ground.height(d.pos.x, d.pos.y);
      const hop = reduced ? 0 : Math.sin(d.hop * Math.PI * 2) ** 2 * 0.22 * d.hop;
      const bob = reduced ? 0 : Math.abs(Math.sin(performance.now() / 160)) * 0.05 * walking;
      d.obj.position.set(d.pos.x, y + hop + bob, d.pos.y);
      if (d.kind !== "person") {
        d.obj.rotation.set(0, d.yaw, Math.min(1, d.look) * 0.18);
      } else {
        d.obj.rotation.y = d.yaw;
      }
      // A herd on the road is solid: you wait for it. Otherwise they step aside,
      // and if you still touch one it's solid too (a gentle bounce, never a push).
      this.blockers.push({
        x: d.pos.x,
        z: d.pos.y,
        r: d.cross && d.kind === "herd" ? 1.1 : d.kind === "person" ? 0.35 : 0.65,
      });
    }
    // Flocks: wander the sky in slow loops; scatter on the horn, drift back.
    this.clock += dt;
    for (const f of this.flocks) {
      const a = f.orbit.phase + this.clock * f.orbit.speed;
      f.base.set(
        f.home.x + Math.cos(a) * f.orbit.r,
        f.home.y + Math.sin(a * 2.3) * 1.5,
        f.home.z + Math.sin(a) * f.orbit.r * 0.7,
      );
      if (!reduced) f.obj.rotation.y = -a + (f.orbit.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
      f.scare = Math.max(0, f.scare - dt);
      if (f.scare > 0) {
        f.off.addScaledVector(f.vel, dt);
        f.vel.multiplyScalar(Math.exp(-dt * 0.6));
      } else {
        f.off.multiplyScalar(Math.exp(-dt * 0.35));
      }
      f.obj.position.copy(f.base).add(f.off);
      if (!reduced) {
        const flap = f.scare > 0 ? 18 : 5;
        f.obj.children.forEach((bird, i) => {
          bird.rotation.x = Math.sin(performance.now() / (1000 / flap) + i) * 0.3;
        });
      }
    }
    for (const s of this.spinners) if (!reduced) s.rotation.y += (s.userData.spin as number) * dt;
    this.updateGates(b, dt, reduced);
    this.updateLights(b, dt, reduced);
    this.updateFowl(b, dt, reduced);
    // Mexican waves: a crest rolls along each stand, fans rising and arms up as it passes.
    if (!reduced) {
      const m4 = new THREE.Matrix4();
      for (const w of this.waves) {
        const span = w.len + 10;
        const crest = ((this.clock * w.speed) % span) - 5;
        const n = w.pts.length / 3;
        for (const part of w.parts) {
          for (let i = 0; i < n; i++) {
            const x = w.pts[i * 3] ?? 0;
            const lift = Math.exp(-(((x + w.len / 2 - crest) / 1.3) ** 2));
            const y = (w.pts[i * 3 + 1] ?? 0) + lift * 0.42;
            const sy = part.arm ? Math.max(0.001, (lift - 0.3) / 0.7) : 1;
            m4.makeScale(1, sy, 1).setPosition(x, y + part.dy, w.pts[i * 3 + 2] ?? 0);
            part.mesh.setMatrixAt(i, m4);
          }
          part.mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
    // On their routes: along the line, facing the way they go, solid if they're big.
    for (const m of this.movers) {
      if (m.total <= 0) continue;
      const d =
        (((this.clock * m.route.speed - (m.route.offset ?? 0)) % m.total) + m.total) % m.total;
      let i = 1;
      while (i < m.lengths.length - 1 && (m.lengths[i] ?? 0) < d) i++;
      const a = m.route.pts[i - 1];
      const b = m.route.pts[i];
      if (!a || !b) continue;
      const l0 = m.lengths[i - 1] ?? 0;
      const seg = (m.lengths[i] ?? l0) - l0 || 1;
      const f = (d - l0) / seg;
      let x = a[0] + (b[0] - a[0]) * f;
      let z = a[1] + (b[1] - a[1]) * f;
      // On a round world: the copy nearest you (seamless across the edge).
      if (this.size) {
        x -= this.size.w * Math.round((x - bike.x) / this.size.w);
        z -= this.size.d * Math.round((z - bike.y) / this.size.d);
      }
      const yaw = m.route.face ?? Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      m.obj.position.set(x, (m.route.y ?? this.ground.height(x, z)) + (m.route.lift ?? 0), z);
      m.obj.rotation.y = yaw + (m.route.yaw ?? 0);
      const r = m.route.solid;
      if (r) {
        // Circles along its length, trailing back from the front.
        const n = Math.max(1, Math.ceil((m.route.length ?? 0) / (r * 1.6)));
        const f0 = m.route.front ?? 0;
        for (let k = 0; k < n; k++)
          this.blockers.push({
            x: x + Math.cos(yaw) * (f0 - k * r * 1.6),
            z: z - Math.sin(yaw) * (f0 - k * r * 1.6),
            r,
          });
      }
    }
    // Elephants lift a little when they trumpet.
    this.trumpetBob = Math.max(0, this.trumpetBob - dt * 0.9);
    for (const e of this.elephants)
      e.rotation.z = reduced ? 0 : Math.sin(this.trumpetBob * Math.PI) * 0.08;
  }

  /** Now and then, when you're around to see it, the herd crosses the road. */
  private herd(b: Bike, dt: number): void {
    if (!this.herdSides) return;
    const herd = this.dodgers.filter((d) => d.kind === "herd");
    this.crossing = herd.some((d) => d.cross);
    if (this.crossing) return;
    this.nextCross -= dt;
    const from = this.herdSides[this.herdSide];
    const near = from ? Math.hypot(from.x - b.x, from.y - b.z) : 999;
    if (this.nextCross > 0 || near > 70) return;
    this.nextCross = 70 + Math.random() * 70;
    this.herdSide = 1 - this.herdSide;
    const to = this.herdSides[this.herdSide];
    if (!from || !to) return;
    herd.forEach((d, i) => {
      // Keep the herd's shape, shifted to the far side, setting off one by one.
      const off = d.home.clone().sub(from);
      d.cross = to.clone().add(off);
      d.delay = i * 0.9;
      d.calm = 99;
    });
    this.onHerdMoves?.();
  }
}
