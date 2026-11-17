/**
 * Arcade-real motorcycle handling on a height field. Pure maths (no Three.js
 * scene objects), stepped at a fixed rate so it behaves the same at any
 * refresh rate.
 *
 * - Speed: throttle against drag; brakes; a slow reverse. Slopes pull you back
 *   uphill and push you down. Each surface has its own grip, drag and top speed.
 * - Steering: a kinematic bicycle model. The steering lock narrows with speed,
 *   so it's nimble when slow and stable when fast.
 * - Lean comes from the cornering force (an invisible assist keeps it upright).
 * - Sideways slip decays with grip, so bumps and knocks slide a little.
 * - Collisions bounce you off with a wobble, never a crash.
 * - Ramps (and humped bridges) are part of the ground's height: ride up one
 *   fast and you leave the lip and fly; in the air the bike keeps its speed
 *   and line, levels out, and lands exactly where it comes down, upright.
 *   It never falls over.
 */

import { angleDelta } from "../anim";
import type { Ground, Surface } from "./ground";

export interface BikeInput {
  /** 0–1 */
  throttle: number;
  /** 0–1: brakes when moving forward, reverses slowly when stopped. */
  brake: number;
  /** −1 (right) … +1 (left) */
  steer: number;
  /** Pulling over to read a stop: come to a quick, firm stop and stay there. */
  park?: boolean;
}

export interface BikeFeel {
  /** Top speed on a road, units/s (1 unit ≈ 1 m). */
  top: number;
  accel: number;
  /** Cornering grip, 0–1 (higher = sideways slip dies faster). */
  grip: number;
}

export interface Blocker {
  x: number;
  z: number;
  r: number;
  /** How tall it is (world y), if a jump can clear it; otherwise always solid. */
  h?: number;
}

const G = 9.8;
/** Clamp to ±limit. */
const clampAbs = (x: number, limit: number) => Math.max(-limit, Math.min(limit, x));
const WHEELBASE = 1.78;
/** Collision radius of bike + rider. */
const BODY = 0.65;
/** Half-thickness of a wall (a parapet is about 0.4 m thick). */
const WALL = 0.2;
const SURFACES: Record<Surface, { top: number; drag: number; grip: number }> = {
  road: { top: 1, drag: 0.35, grip: 1 },
  ground: { top: 0.5, drag: 1.6, grip: 0.75 },
  // Wading: slow, but never a trap (see the climb in step()).
  water: { top: 0.22, drag: 2.4, grip: 0.5 },
};

export class BikePhysics {
  x: number;
  z: number;
  /** Heading (radians): forward is (cos h, −sin h) in x/z. */
  heading: number;
  /** Forward speed (negative = reversing). */
  v = 0;
  /** Sideways slip speed (to the bike's right). */
  slip = 0;
  /** Current steering angle (radians, + = left). */
  steerAngle = 0;
  /** Yaw rate (rad/s, + = turning left). */
  yawRate = 0;
  /** Roll (rad, + = leaning left) and its rate. */
  lean = 0;
  private leanV = 0;
  /** Impact this step (for camera nudge and sound), 0 when nothing was hit. */
  impact = 0;
  /** Height (world y) and vertical speed; `air` while flying off a ramp. */
  y = 0;
  vy = 0;
  air = false;
  /** How hard it came down this step (m/s), 0 when it didn't land. */
  landed = 0;
  /** On a ramp last step (only a ramp's lip launches; a bridge's hump never does). */
  private onRamp = false;
  surface: Surface = "road";
  /** Solid things that come and go (e.g. a herd crossing the road). */
  readonly moving: Blocker[] = [];
  /** Soft world bounds: rounded rectangle half-size. */
  private readonly hx: number;
  private readonly hz: number;

  constructor(
    private readonly ground: Ground,
    private readonly blockers: readonly Blocker[],
    private readonly feel: BikeFeel,
    at: { x: number; z: number; heading: number },
    margin = 9,
    /** Open world: wrap round at the edges instead of a soft boundary. */
    private readonly wraps = false,
    /** Straight solid edges, [ax, az, bx, bz] (e.g. bridge parapets). */
    private readonly walls: readonly (readonly [number, number, number, number])[] = [],
  ) {
    this.x = at.x;
    this.z = at.z;
    this.heading = at.heading;
    this.y = ground.height(at.x, at.z);
    this.hx = ground.w / 2 - margin;
    this.hz = ground.d / 2 - margin;
  }

  get speed(): number {
    return Math.hypot(this.v, this.slip);
  }

  /** Advances the bike by dt (call at a fixed rate, e.g. 1/120 s). */
  step(input: BikeInput, dt: number): void {
    this.impact = 0;
    this.landed = 0;
    if (this.air) {
      this.fly(dt);
      return;
    }
    this.surface = this.ground.surface(this.x, this.z);
    const s = SURFACES[this.surface];
    const fx = Math.cos(this.heading);
    const fz = -Math.sin(this.heading);
    // ── speed ──
    const top = this.feel.top * s.top;
    let a = 0;
    if (input.park) {
      // A firm stop (about half a second from riding speed), then hold still.
      if (Math.abs(this.v) < 0.8) this.v = 0;
      else a -= Math.sign(this.v) * 26;
      this.slip *= Math.exp(-dt * 10);
    } else if (input.throttle > 0)
      a += this.feel.accel * input.throttle * (1 - Math.max(0, this.v) / top);
    if (input.brake > 0) {
      if (this.v > 0.4) a -= 16 * input.brake;
      else a -= 4 * input.brake * (1 + this.v / 3.5); // gentle reverse up to ~3.5 u/s
    }
    // Rolling drag, more off-road; air drag grows with speed.
    a -= Math.sign(this.v) * (s.drag + 0.0016 * this.v * this.v);
    if (this.v > top) a -= (this.v - top) * 3; // over a surface's top speed: bleed off smoothly
    // Gravity along the slope (look a wheelbase ahead and behind).
    const h = WHEELBASE / 2;
    const slope =
      (this.ground.height(this.x + fx * h, this.z + fz * h) -
        this.ground.height(this.x - fx * h, this.z - fz * h)) /
      WHEELBASE;
    // Wading, the water carries some of the weight, so banks pull less.
    // On a made road the engine has the grade in hand (a climb slows it a little, not to a crawl).
    a -=
      G *
      (this.surface === "water" ? 0.35 : this.surface === "road" ? 0.24 : 0.7) *
      Math.sin(Math.atan(slope));
    // Gas held at a crawl: always enough push to creep up a bank or out of a
    // river, so you can never get stuck.
    // (On a made road, a firm push: pulling away uphill from a stop is easy.)
    if (input.throttle > 0 && !input.park && this.v < (this.surface === "water" ? 2 : 4))
      a = Math.max(a, (this.surface === "water" ? 1.4 : 3) * input.throttle);
    const before = this.v;
    this.v += a * dt;
    // Drag and braking never push you backwards through zero.
    if (input.throttle === 0 && Math.sign(this.v) !== Math.sign(before) && input.brake === 0)
      this.v = 0;
    if (Math.abs(this.v) < 0.02 && input.throttle === 0 && input.brake === 0) this.v = 0;
    // Parked: no creeping down a slope.
    if (input.park && Math.abs(this.v) < 0.8) this.v = 0;
    // ── steering ──
    const speed = Math.abs(this.v);
    // Lock narrows with speed; the bars ease to it (about a third of a second),
    // so direction changes build up instead of snapping.
    // (A little more lock at a crawl, so a hairpin taken slowly turns tight, and a touch more
    // at a touring pace, so a mountain bend doesn't run wide; unchanged at speed.)
    const lock =
      0.4 / (1 + speed * 0.17) +
      Math.max(0.12 * Math.max(0, 1 - speed / 6), 0.05 * Math.max(0, 1 - speed / 12));
    const target = input.steer * lock;
    this.steerAngle += (target - this.steerAngle) * Math.min(1, dt * 2.2);
    this.yawRate = clampAbs((this.v * Math.tan(this.steerAngle)) / WHEELBASE, 0.95);
    // Nearly stopped, a rider paddles the bike round with their feet: a slow
    // turn on the spot, so you can always get out of a tight spot.
    if (speed < 2 && (input.throttle > 0 || input.brake > 0)) {
      this.yawRate += input.steer * 1.1 * (1 - speed / 2);
    }
    this.heading += this.yawRate * dt;
    // ── slip: dies off with grip ──
    this.slip *= Math.exp(-dt * 7 * s.grip * (0.6 + this.feel.grip));
    // ── move ── (right of forward (cos h, −sin h) is (sin h, cos h))
    const sx = Math.sin(this.heading);
    const sz = Math.cos(this.heading);
    const nfx = Math.cos(this.heading);
    const nfz = -Math.sin(this.heading);
    this.x += (nfx * this.v + sx * this.slip) * dt;
    this.z += (nfz * this.v + sz * this.slip) * dt;
    this.collide(nfx, nfz, sx, sz);
    this.collideWalls(nfx, nfz, sx, sz);
    if (this.wraps) {
      // An open world: ride off one edge and you come in from the other.
      this.x = this.ground.wrapX(this.x);
      this.z = this.ground.wrapZ(this.z);
    } else {
      this.bounds(nfx, nfz, sx, sz, dt);
    }
    // ── lean: into the corner, eased by an upright assist ──
    const want = Math.max(-0.72, Math.min(0.72, Math.atan((this.v * this.yawRate) / G)));
    this.leanTo(want, dt);
    this.follow(dt);
  }

  /** Leans towards `want`; never past what the bike can hold (it never falls over). */
  private leanTo(want: number, dt: number): void {
    const acc = -110 * (this.lean - want) - 2 * 0.85 * Math.sqrt(110) * this.leanV;
    this.leanV += acc * dt;
    this.lean += this.leanV * dt;
    if (Math.abs(this.lean) > 0.75) {
      this.lean = Math.sign(this.lean) * 0.75;
      this.leanV = 0;
    }
  }

  /**
   * On the ground: follow its height (ramps and bridges included). If it
   * falls away faster than the bike would drop (off a ramp's lip, over a
   * hump at speed), take off with the climb's upward speed.
   */
  private follow(dt: number): void {
    const floor = this.ground.height(this.x, this.z);
    const rise = floor - this.y;
    if (rise > 0.25) {
      // A step up (onto the side of a ramp): just climb it.
      this.y = floor;
      this.vy = 0;
      return;
    }
    const need = rise / dt;
    const falling = this.vy - G * dt;
    const wasOnRamp = this.onRamp;
    this.onRamp = this.ground.onWedge(this.x, this.z);
    if (wasOnRamp && need < falling - 0.6 && Math.abs(this.v) > 3) {
      this.air = true;
      this.vy = Math.min(9, falling);
      this.y += this.vy * dt;
      return;
    }
    this.vy = clampAbs(need, 9);
    this.y = floor;
  }

  /**
   * In the air: on the same line at the same speed (no steering, no throttle,
   * the bars centred), levelling out, until it comes down exactly where it
   * meets the ground again.
   */
  private fly(dt: number): void {
    const nfx = Math.cos(this.heading);
    const nfz = -Math.sin(this.heading);
    const sx = Math.sin(this.heading);
    const sz = Math.cos(this.heading);
    this.slip *= Math.exp(-dt * 4);
    this.yawRate = 0;
    this.steerAngle *= Math.exp(-dt * 6);
    this.x += (nfx * this.v + sx * this.slip) * dt;
    this.z += (nfz * this.v + sz * this.slip) * dt;
    this.collide(nfx, nfz, sx, sz);
    this.collideWalls(nfx, nfz, sx, sz);
    if (this.wraps) {
      this.x = this.ground.wrapX(this.x);
      this.z = this.ground.wrapZ(this.z);
    }
    this.vy -= G * dt;
    this.y += this.vy * dt;
    // Level for the landing.
    this.leanTo(0, dt);
    const floor = this.ground.height(this.x, this.z);
    if (this.y <= floor) {
      this.landed = Math.max(0, -this.vy);
      this.y = floor;
      this.vy = 0;
      this.air = false;
      this.lean *= 0.3;
      this.leanV = 0;
      this.surface = this.ground.surface(this.x, this.z);
    }
  }

  /** Bounce off solid things, keeping the heading (a wobble, not a spin). */
  private collide(fx: number, fz: number, sx: number, sz: number): void {
    for (const b of [...this.blockers, ...this.moving]) {
      // The short way round, across an edge if that's nearer.
      let dx = this.x - b.x;
      let dz = this.z - b.z;
      if (this.wraps) {
        dx -= this.ground.w * Math.round(dx / this.ground.w);
        dz -= this.ground.d * Math.round(dz / this.ground.d);
      }
      const min = b.r + BODY;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      // Flying over something low (a rock, off a ramp): clear it.
      if (b.h !== undefined && this.y > b.h) continue;
      const d = Math.sqrt(d2) || 1e-4;
      const nx = dx / d;
      const nz = dz / d;
      // Push out.
      this.x += nx * (min - d);
      this.z += nz * (min - d);
      this.hit(nx, nz, fx, fz, sx, sz);
    }
  }

  /** Bounce off straight walls (treated as thin capsules). */
  private collideWalls(fx: number, fz: number, sx: number, sz: number): void {
    const R = WALL + BODY;
    for (const [ax0, az0, bx0, bz0] of this.walls) {
      let ax = ax0;
      let az = az0;
      let bx = bx0;
      let bz = bz0;
      if (this.wraps) {
        // Use the copy of the wall nearest the bike.
        const ox = this.ground.w * Math.round((this.x - (ax + bx) / 2) / this.ground.w);
        const oz = this.ground.d * Math.round((this.z - (az + bz) / 2) / this.ground.d);
        ax += ox;
        bx += ox;
        az += oz;
        bz += oz;
      }
      const abx = bx - ax;
      const abz = bz - az;
      const l2 = abx * abx + abz * abz || 1;
      const t = Math.min(1, Math.max(0, ((this.x - ax) * abx + (this.z - az) * abz) / l2));
      const dx = this.x - (ax + abx * t);
      const dz = this.z - (az + abz * t);
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const d = Math.sqrt(d2) || 1e-4;
      const nx = dx / d;
      const nz = dz / d;
      this.x += nx * (R - d);
      this.z += nz * (R - d);
      this.hit(nx, nz, fx, fz, sx, sz);
    }
  }

  /** The soft edge of the world: you ride into it and are eased back. */
  private bounds(fx: number, fz: number, sx: number, sz: number, dt: number): void {
    const ox = Math.abs(this.x) - this.hx;
    const oz = Math.abs(this.z) - this.hz;
    if (ox <= 0 && oz <= 0) return;
    const nx = ox > 0 ? -Math.sign(this.x) : 0;
    const nz = oz > 0 ? -Math.sign(this.z) : 0;
    const depth = Math.max(ox, oz);
    // A spring pulling you back in, plus a firm wall a few units further out.
    this.x += nx * Math.min(depth, 3) * dt * 4;
    this.z += nz * Math.min(depth, 3) * dt * 4;
    if (depth > 4) {
      this.x -= Math.sign(this.x) * (ox > 4 ? ox - 4 : 0);
      this.z -= Math.sign(this.z) * (oz > 4 ? oz - 4 : 0);
      const len = Math.hypot(nx, nz) || 1;
      this.hit(nx / len, nz / len, fx, fz, sx, sz);
    }
  }

  private hit(nx: number, nz: number, fx: number, fz: number, sx: number, sz: number): void {
    // Velocity in world space.
    const vx = fx * this.v + sx * this.slip;
    const vz = fz * this.v + sz * this.slip;
    const vn = vx * nx + vz * nz;
    if (vn >= 0) return; // already moving away
    const e = 0.35; // a soft bounce
    const nvx = vx - (1 + e) * vn * nx;
    const nvz = vz - (1 + e) * vn * nz;
    const scrub = 0.82;
    this.v = (nvx * fx + nvz * fz) * scrub;
    this.slip = (nvx * sx + nvz * sz) * scrub;
    this.impact = Math.max(this.impact, -vn);
    // A wobble: a kick to the lean, the way the knock pushes you.
    this.leanV += Math.sign(nx * sx + nz * sz || 1) * Math.min(3, -vn * 0.5);
  }

  /** Steering (−1…1) that turns toward a world heading, for stick and cruise. */
  steerToward(heading: number, gain = 2.2): number {
    return Math.max(-1, Math.min(1, angleDelta(this.heading, heading) * gain));
  }
}
