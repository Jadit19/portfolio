/**
 * The garage: the bike-select landing. A clean studio around the map table.
 *
 * Pick a world (on the table or in the list): the bike on the turntable
 * stands up off its side stand and rolls back out through the doorway, and
 * the new one rolls in, brakes onto the turntable and settles (see BikeRig).
 * Adit points at your pick; when you inspect a bike he walks round to the
 * turntable and presents it (see Guide). Inspect mode: drag to spin with
 * inertia, idle auto-rotate, wheel/pinch zoom — and he always stays in frame.
 */

import * as THREE from "three";
import type { BikeKind, RouteId } from "../../content/types";
import { world } from "../../content/worlds";
import { app } from "../../state/app";
import { angleDelta, damp, prefersReducedMotion, SpringV3, stepSpring } from "../anim";
import type { Layout } from "../layout";
import { heroBike } from "../lib/hero";
import { makeKit } from "../lib/kit";
import { type LiveTable, liveMapTable } from "../lib/opening/island";
import { batch } from "../merge";
import type { StageScene } from "../stage";
import { BikeRig, endYaw } from "./bikeRig";
import { Guide } from "./guide";
import { PassportBoard } from "./passportBoard";
import { JacketRack } from "./rack";
import { Ritual } from "./ritual";
import {
  DOOR,
  GUIDE_INSPECT,
  GUIDE_TABLE,
  lane,
  MURPHY_PATH,
  P,
  PLINTH_R,
  PLINTH_TOP,
  PRESENT,
  RACK,
  SIDE_X,
  STAMP_BOARD,
  TABLE,
  WALL_Z,
} from "./space";

const kit = makeKit("smooth");
const LANE_OUT = lane(-1);
/** Seconds Adit keeps following a still cursor before turning back to you. */
const CURSOR_LINGER = 1.4;
const LANE_IN = lane(1);

/** What the table view keeps in frame: the table top, the turntable bike, and Adit. */
const TABLE_POINTS = [
  ...[-TABLE.x, TABLE.x].flatMap((x) =>
    [-TABLE.z, TABLE.z].map((z) => new THREE.Vector3(x, TABLE.top, z)),
  ),
  ...[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map(
    (a) => new THREE.Vector3(P.x + Math.cos(a) * 1.25, 1.9, P.z + Math.sin(a) * 1.25),
  ),
  new THREE.Vector3(GUIDE_TABLE.x, 2.5, GUIDE_TABLE.z),
];
/**
 * Portrait screens: the world chips do the picking and the sheet covers the
 * table's front anyway, so frame the bike and Adit with the back of the table.
 */
const TABLE_POINTS_PORTRAIT = [
  // Phones frame Adit and the bike; the table can run off the edges of the shot.
  ...[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].flatMap((a) =>
    [TABLE.top, 1.85].map(
      (y) => new THREE.Vector3(P.x + Math.cos(a) * 1.15, y, P.z + Math.sin(a) * 1.15),
    ),
  ),
  new THREE.Vector3(GUIDE_TABLE.x, 2.5, GUIDE_TABLE.z),
  // The jacket rack and helmet: the top of the shot, so no bare wall shows above them.
  new THREE.Vector3((RACK.x0 + RACK.x1) / 2, RACK.y + 0.25, WALL_Z + 0.3),
];
/** On phones these must stay in from the sides: Adit, and the bike's middle. */
const PORTRAIT_ACROSS = [
  new THREE.Vector3(GUIDE_TABLE.x - 0.12, 2.35, GUIDE_TABLE.z),
  new THREE.Vector3(P.x, 1.0, P.z),
];
/** The passport board's corners. */
const BOARD_POINTS = [-1, 1].flatMap((sx) =>
  [-1, 1].map(
    (sy) =>
      new THREE.Vector3(
        STAMP_BOARD.x + (sx * STAMP_BOARD.w) / 2,
        STAMP_BOARD.y + (sy * STAMP_BOARD.h) / 2,
        STAMP_BOARD.z,
      ),
  ),
);
const PASSPORT_DIR = new THREE.Vector3(0.18, 0.06, 1);
/** Look directions for the table view: landscape, portrait. */
const TABLE_DIR: readonly [THREE.Vector3, THREE.Vector3] = [
  new THREE.Vector3(-1.3, 1.1, 6.4),
  new THREE.Vector3(-2.4, 2.3, 5.8),
];
/** The inspect view keeps the whole bike (at any yaw) and Adit beside it in frame. */
const INSPECT_POINTS = [
  ...[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].flatMap((a) =>
    [0.1, 2.0].map((y) => new THREE.Vector3(P.x + Math.cos(a) * 1.35, y, P.z + Math.sin(a) * 1.35)),
  ),
  new THREE.Vector3(GUIDE_INSPECT.x, 2.55, GUIDE_INSPECT.z),
  new THREE.Vector3(GUIDE_INSPECT.x + 0.35, 0, GUIDE_INSPECT.z + 0.2),
  // His shoulders and gesturing arm, whichever way he's turned.
  ...[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map(
    (t) =>
      new THREE.Vector3(
        GUIDE_INSPECT.x + Math.cos(t) * 0.5,
        1.9,
        GUIDE_INSPECT.z + Math.sin(t) * 0.5,
      ),
  ),
];
const INSPECT_DIR = new THREE.Vector3(2.2, 0.85, 2.6);
const ZOOM_MIN = 1;
const ZOOM_MAX = 1.45;

/** Where an arriving bike waits (path s) if the turntable is still busy: ~3.3 from its centre. */
const waitCache = new WeakMap<THREE.CatmullRomCurve3, number>();
function waitingSpot(path: THREE.CatmullRomCurve3): number {
  const hit = waitCache.get(path);
  if (hit !== undefined) return hit;
  const len = path.getLength();
  let s = len;
  for (let i = 200; i >= 0; i--) {
    const p = path.getPointAt(i / 200);
    if (p.distanceTo(P) >= 3.3) {
      s = (i / 200) * len;
      break;
    }
  }
  waitCache.set(path, s);
  return s;
}

/** The bike on the turntable for a pick; Murphy when nothing is picked yet. */
const bikeOf = (id: RouteId | null): BikeKind => (id ? world(id).bike.kind : "classic");

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** The back room: warm dark, a little lighter near the floor, as if lit from the doorway. */
function doorGradient(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 128;
  const x = c.getContext("2d");
  if (x) {
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "#120f0c");
    g.addColorStop(0.65, "#1d1813");
    g.addColorStop(1, "#3a3027");
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class GarageScene implements StageScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.05, 120);
  private table!: LiveTable;
  private readonly turntable = new THREE.Group();
  /** One rig per bike, built once and reused. */
  private readonly pool = new Map<BikeKind, BikeRig>();
  private rigs: BikeRig[] = [];
  private current: BikeRig | null = null;
  private guide!: Guide;
  /** Murphy, Adit's own Guerrilla: lives at her spot by the wall, rides to the turntable and backs home. */
  private murphy!: BikeRig;
  /** After a bike arrives, the turntable turns it to face you before you can spin it. */
  private settling = false;
  private board!: PassportBoard;
  /** The jacket rack (the ritual reaches for its jacket and the helmet). */
  rack!: JacketRack;
  /** Kitting up and riding out (and home again). */
  private ritual!: Ritual;
  /** Patches earned while away: they go on the board when he's back and pins them. */
  private pendingStamps: RouteId[] | null = null;
  private framing = {
    table: { pos: new THREE.Vector3(-0.9, 5.6, 5.9), look: new THREE.Vector3(0.45, 0.7, -0.5) },
    inspect: { pos: new THREE.Vector3(5, 3, 2), look: P.clone() },
    passport: {
      pos: new THREE.Vector3(-3.2, 2.4, -1.5),
      look: new THREE.Vector3(-3.55, 2.35, -5.2),
    },
  };
  private readonly camPos = new SpringV3(new THREE.Vector3(-1.2, 5.4, 5.6));
  private readonly camLook = new SpringV3(new THREE.Vector3(0.9, 0.6, 0.2));
  private readonly pointer = new THREE.Vector2();
  private readonly ray = new THREE.Raycaster();
  /** Scene time of the last cursor move (Adit's head follows it, then comes back to you). */
  private lastMove = -Infinity;
  private now = 0;
  private readonly cursorAt = new THREE.Vector3();
  private readonly tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE.top);
  private spin = 0;
  private spinVel = 0;
  /** Velocity of the turntable's eased turns (spring). */
  private spinV = 0;
  /** The turntable's resting angle: whatever the current bike rolled in at. */
  private restSpin = 0;
  private dragging = false;
  private dragX = 0;
  private idle = 0;
  private zoom = 1.15;
  private portrait = false;
  private pinch = 0;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private downAt = { x: 0, y: 0, t: 0 };
  private readonly reduced = prefersReducedMotion();
  private unsub: (() => void) | null = null;

  /** Builds the garage across several frames so the loader keeps animating. */
  static async create(
    canvas: HTMLCanvasElement,
    onProgress: (p: number) => void,
  ): Promise<GarageScene> {
    const g = new GarageScene();
    await document.fonts.ready;
    await Promise.all(
      ["800 40px Outfit", "700 40px Inter"].map((f) => document.fonts.load(f).catch(() => [])),
    );
    onProgress(0.1);
    await nextFrame();
    g.buildRoom();
    onProgress(0.25);
    await nextFrame();
    g.table = liveMapTable("terraced");
    g.scene.add(g.table.group);
    onProgress(0.65);
    await nextFrame();
    g.guide = new Guide();
    g.scene.add(g.guide.root);
    g.guide.face(new THREE.Vector3(0, 0, 0));
    g.buildTurntable();
    onProgress(0.8);
    await nextFrame();
    const sel = app.get().selected;
    g.table.setSelected(sel ?? "");
    g.placeBike(bikeOf(sel), true);
    g.ritual = new Ritual(g.ritualHost());
    onProgress(1);
    g.bind(canvas);
    g.prewarm();
    return g;
  }

  // ── building ────────────────────────────────────────────────────────────

  private buildRoom(): void {
    const s = this.scene;
    s.background = new THREE.Color("#2b2723");
    s.fog = new THREE.Fog("#2b2723", 22, 40);
    s.environmentIntensity = 0.2;
    s.add(new THREE.HemisphereLight("#fff1dc", "#5b4a38", 0.75));
    const lamp = new THREE.SpotLight("#ffe2b0", 130, 18, 0.68, 0.65, 1.3);
    lamp.position.set(0.9, 6.8, 0.0);
    lamp.target.position.set(1.0, 0.8, -1.2);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.bias = -0.0003;
    s.add(lamp, lamp.target);
    const key = new THREE.SpotLight("#ffe7c2", 55, 12, 0.55, 0.7, 1.2);
    key.position.set(P.x + 1.2, 5.5, P.z + 2);
    key.target.position.copy(P);
    s.add(key, key.target);
    const fill = new THREE.DirectionalLight("#bcd2ff", 0.45);
    fill.position.set(6, 5, -4);
    s.add(fill);
    // Clean studio: warm concrete floor, two soft walls, a doorway to the back room.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: "#bdb4a6", roughness: 0.92 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: "#e6ded1", roughness: 0.95 });
    const wall = (x0: number, x1: number, y0: number, y1: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), wallMat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z);
      m.receiveShadow = true;
      s.add(m);
    };
    wall(-16, SIDE_X, 0, 10);
    // The passport pin board, above Murphy's spot.
    this.board = new PassportBoard(app.get().stamped);
    s.add(this.board.group);
    // The jacket rack, where the doorway used to be.
    this.rack = new JacketRack();
    s.add(this.rack.group);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), wallMat);
    side.position.set(-7.5, 5, 0);
    side.rotation.y = Math.PI / 2;
    side.receiveShadow = true;
    s.add(side);
    // The right-hand wall, at 90° to the passport wall, with the garage door.
    const sideWall = (z0: number, z1: number, y0: number, y1: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, y1 - y0), wallMat);
      m.rotation.y = -Math.PI / 2;
      m.position.set(SIDE_X, (y0 + y1) / 2, (z0 + z1) / 2);
      m.receiveShadow = true;
      s.add(m);
    };
    sideWall(WALL_Z, DOOR.z0, 0, 10);
    sideWall(DOOR.z1, 12, 0, 10);
    sideWall(DOOR.z0, DOOR.z1, DOOR.h, 10);
    // Beyond the door: a warm dim space the bikes come from and go to.
    const dark = new THREE.MeshBasicMaterial({ color: "#1a1511" });
    const glow = new THREE.MeshBasicMaterial({ map: doorGradient() });
    const dw = DOOR.z1 - DOOR.z0;
    const zc = (DOOR.z0 + DOOR.z1) / 2;
    const beyond = new THREE.Mesh(new THREE.PlaneGeometry(dw + 0.6, DOOR.h + 0.2), glow);
    beyond.rotation.y = -Math.PI / 2;
    beyond.position.set(SIDE_X + DOOR.depth, DOOR.h / 2, zc);
    const sill = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.depth, dw), dark);
    sill.rotation.x = -Math.PI / 2;
    sill.position.set(SIDE_X + DOOR.depth / 2, 0.003, zc);
    const head = sill.clone();
    head.rotation.x = Math.PI / 2;
    head.position.y = DOOR.h;
    s.add(beyond, sill, head);
    for (const z of [DOOR.z0, DOOR.z1]) {
      const jamb = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.depth, DOOR.h), dark);
      jamb.position.set(SIDE_X + DOOR.depth / 2, DOOR.h / 2, z);
      if (z === DOOR.z1) jamb.rotation.y = Math.PI;
      s.add(jamb);
    }
    // A slim frame round the opening.
    const trim = new THREE.MeshStandardMaterial({ color: "#3a332d", roughness: 0.6 });
    for (const [z, y, sz, sh] of [
      [DOOR.z0 - 0.04, DOOR.h / 2, 0.08, DOOR.h],
      [DOOR.z1 + 0.04, DOOR.h / 2, 0.08, DOOR.h],
      [zc, DOOR.h + 0.04, dw + 0.16, 0.08],
    ] as [number, number, number, number][]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, sh, sz), trim);
      m.position.set(SIDE_X - 0.02, y, z);
      s.add(m);
    }
    // Adit's own Guerrilla, parked against the back wall.
    this.murphy = new BikeRig("classic", this.batchBike("classic"), MURPHY_PATH, "away", true);
    this.pool.set("classic", this.murphy);
    this.rigs.push(this.murphy);
    s.add(this.murphy.root);
  }

  private buildTurntable(): void {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(PLINTH_R, PLINTH_R + 0.03, PLINTH_TOP, 128),
      new THREE.MeshStandardMaterial({ color: "#2b2926", roughness: 0.55 }),
    );
    drum.position.y = PLINTH_TOP / 2;
    drum.castShadow = true;
    drum.receiveShadow = true;
    const top = new THREE.Mesh(
      new THREE.CircleGeometry(PLINTH_R - 0.01, 128),
      new THREE.MeshStandardMaterial({ color: "#33302c", roughness: 0.6 }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = PLINTH_TOP + 0.001;
    top.receiveShadow = true;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(PLINTH_R - 0.04, 0.007, 8, 180),
      new THREE.MeshBasicMaterial({ color: "#f5d9a8" }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = PLINTH_TOP + 0.002;
    this.turntable.add(drum, top, ring);
    this.turntable.position.copy(P);
    this.scene.add(this.turntable);
  }

  /** The batched hero bike: hundreds of parts → a few draws; wheels stay live so they roll. */
  private batchBike(kind: BikeKind): THREE.Group {
    return batch(heroBike(kit, kind, 0), (o) => typeof o.userData.wheelRadius === "number");
  }

  /** A bike's rig, built once and reused; lane bikes start in the back room or on the turntable. */
  private rigFor(kind: BikeKind, at: "away" | "centre"): BikeRig {
    let rig = this.pool.get(kind);
    if (!rig) {
      rig = new BikeRig(kind, this.batchBike(kind), LANE_IN, at);
      this.pool.set(kind, rig);
    } else if (!rig.home) {
      rig.reset(LANE_IN, at);
    }
    return rig;
  }

  /** Builds the remaining bikes in idle time so the first swap to each is smooth. */
  private prewarm(): void {
    const kinds: BikeKind[] = ["superbike", "rally", "cafe", "scrambler", "adv", "bobber"];
    const next = () => {
      const k = kinds.find((x) => !this.pool.has(x));
      if (!k) return;
      this.pool.set(k, new BikeRig(k, this.batchBike(k), LANE_IN, "away"));
      schedule();
    };
    const schedule = () => {
      if ("requestIdleCallback" in window) requestIdleCallback(next, { timeout: 2000 });
      else setTimeout(next, 120);
    };
    schedule();
  }

  // ── bike swap ───────────────────────────────────────────────────────────

  /** Where a bike goes when it leaves: Murphy backs home; the rest back out through the doorway. */
  private exitFor(r: BikeRig): THREE.CatmullRomCurve3 {
    return r.home ? MURPHY_PATH : LANE_OUT;
  }

  private placeBike(kind: BikeKind, instant = false): void {
    const now = instant || this.reduced;
    if (this.current?.kind === kind && this.current.target === this.current.len) return;
    // Everyone else heads out.
    // Bikes from the door turn to face it and ride out; Murphy backs home to her spot.
    // Every bike leaves by reversing straight back out the way it came.
    for (const r of this.rigs) if (r.kind !== kind) r.leave(this.exitFor(r));
    let rig = this.rigs.find((r) => r.kind === kind);
    if (rig && !now) {
      rig.arrive();
    } else {
      rig = rig ?? this.rigFor(kind, now ? "centre" : "away");
      if (now) rig.reset(rig.home ? MURPHY_PATH : LANE_IN, "centre");
      else rig.arrive();
      if (!this.rigs.includes(rig)) {
        this.rigs.push(rig);
        this.scene.add(rig.root);
      }
    }
    this.current = rig;
    if (now) {
      // Placed directly on the turntable: rest at the angle it would have rolled in at.
      const a = angleDelta(0, endYaw(rig.path) - PRESENT);
      this.spin = a;
      this.restSpin = a;
      rig.spin = a;
      // No choreography: everyone else is simply back where they live.
      for (const r of this.rigs) if (r !== rig && !r.home) this.scene.remove(r.root);
      if (rig !== this.murphy) this.murphy.reset(MURPHY_PATH, "away");
      this.rigs = this.rigs.filter((r) => r === rig || r.home);
    }
  }

  private stepRigs(dt: number): void {
    for (const r of this.rigs) {
      // An arriving bike rolls in straight away, but may only come as far as a
      // waiting spot inside the door until the turntable is clear (the bike
      // before it has rolled off it). It never follows a bike that is turning
      // back down its own path. So bikes never cross or tangle.
      if (r.target === r.len && r.phase !== "rest") {
        if (r.s < 0.3) {
          const behind = this.rigs.some(
            (o) => o !== r && o.path === r.path && o.target === 0 && o.phase === "move",
          );
          if (behind) r.hold = Math.max(r.hold, 0.05);
        }
        const busy = this.rigs.some(
          (o) =>
            o !== r &&
            (o.onTurntable ||
              (o.phase === "move" && o.target !== 0) ||
              // Then they pass on their own lanes (a full lane apart until right
              // by the turntable), or Murphy heads west, away from the door.
              (o.phase === "move" && o.root.position.distanceTo(P) < 1.9)),
        );
        r.cap = busy ? waitingSpot(r.path) : Number.POSITIVE_INFINITY;
      } else {
        r.cap = Number.POSITIVE_INFINITY;
      }
      r.spin = r.onTurntable ? this.spin : 0;
      r.update(dt);
      if (r.justArrived) {
        // It rolled on facing along its path; the turntable now turns it to face you.
        r.justArrived = false;
        // It stays at the angle it rolled in at: that's its resting angle.
        this.spin = r.spin;
        this.restSpin = r.spin;
        this.spinV = 0;
        r.spin = this.spin;
        this.settling = true;
      }
    }
    for (const r of this.rigs.filter((x) => x.gone)) this.scene.remove(r.root);
    this.rigs = this.rigs.filter((x) => !x.gone);
  }

  // ── input ───────────────────────────────────────────────────────────────

  private bind(canvas: HTMLCanvasElement): void {
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("pointerleave", this.onLeave);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    let prev = app.get();
    this.unsub = app.subscribe(() => {
      const s = app.get();
      if (s.selected !== prev.selected) {
        this.table.setSelected(s.selected ?? "");
        this.placeBike(bikeOf(s.selected));
      }
      if (s.stamped !== prev.stamped) {
        // Earned out on a ride: it goes up when he's home and pins it.
        if (s.mode === "world" || this.ritual?.active) this.pendingStamps = s.stamped;
        else this.board.setStamped(s.stamped);
      }
      if (s.view !== prev.view) {
        this.zoom = this.portrait ? 1 : 1.15;
        this.idle = 0;
      }
      prev = s;
    });
  }

  dispose(canvas: HTMLCanvasElement): void {
    this.unsub?.();
    canvas.removeEventListener("pointerdown", this.onDown);
    canvas.removeEventListener("pointermove", this.onMove);
    canvas.removeEventListener("pointerup", this.onUp);
    canvas.removeEventListener("pointercancel", this.onUp);
    canvas.removeEventListener("pointerleave", this.onLeave);
    canvas.removeEventListener("wheel", this.onWheel);
  }

  private setPointer(e: PointerEvent): void {
    const r = (e.target as HTMLElement).getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  }

  private onDown = (e: PointerEvent): void => {
    // Riding a world: the garage sleeps underneath and ignores the pointer.
    if (app.get().mode !== "garage" || this.ritual?.active) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (app.get().view === "inspect") {
      this.dragging = this.touches.size === 1;
      this.dragX = e.clientX;
      this.spinVel = 0;
      this.idle = 0;
      if (this.touches.size === 2) this.pinch = this.pinchDist();
    }
  };

  private onMove = (e: PointerEvent): void => {
    // Riding a world: the garage sleeps underneath and ignores the pointer.
    if (app.get().mode !== "garage" || this.ritual?.active) return;
    this.setPointer(e);
    this.lastMove = this.now;
    if (this.touches.has(e.pointerId))
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (app.get().view === "inspect") {
      if (this.touches.size === 2 && this.pinch > 0) {
        const d = this.pinchDist();
        this.zoom = THREE.MathUtils.clamp(this.zoom * (this.pinch / d), ZOOM_MIN, ZOOM_MAX);
        this.pinch = d;
        return;
      }
      if (this.dragging) {
        const w = (e.target as HTMLElement).clientWidth || 1;
        const delta = ((e.clientX - this.dragX) / w) * Math.PI * 2.2;
        this.dragX = e.clientX;
        this.spin += delta;
        this.spinVel = delta * 60;
        this.idle = 0;
      }
      return;
    }
    if (app.get().view === "passport") return;
    const hit = this.pickSpot();
    (e.target as HTMLElement).style.cursor =
      hit || this.overBike() || this.overBoard() ? "pointer" : "";
    const hovered = (hit as RouteId | null) ?? null;
    if (app.get().hovered !== hovered) app.patch({ hovered });
    this.table.setHovered(hit);
  };

  private onUp = (e: PointerEvent): void => {
    // Riding a world: the garage sleeps underneath and ignores the pointer.
    if (app.get().mode !== "garage" || this.ritual?.active) return;
    this.touches.delete(e.pointerId);
    if (this.touches.size < 2) this.pinch = 0;
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    const tap = moved < 8 && performance.now() - this.downAt.t < 400;
    if (app.get().view === "inspect") {
      this.dragging = false;
      return;
    }
    if (!tap || app.get().view === "passport") return;
    this.setPointer(e);
    const spot = this.pickSpot();
    if (spot) {
      app.patch({ selected: spot as RouteId });
      return;
    }
    if (this.overBike()) app.patch({ view: "inspect" });
    else if (this.overBoard()) app.patch({ view: "passport" });
  };

  private onLeave = (): void => {
    this.lastMove = -Infinity;
    this.table.setHovered(null);
    if (app.get().hovered) app.patch({ hovered: null });
  };

  private onWheel = (e: WheelEvent): void => {
    // Riding a world: the garage sleeps underneath and ignores the pointer.
    if (app.get().mode !== "garage" || this.ritual?.active) return;
    if (app.get().view !== "inspect") return;
    e.preventDefault();
    this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(e.deltaY * 0.0012), ZOOM_MIN, ZOOM_MAX);
    this.idle = 0;
  };

  private pinchDist(): number {
    const [a, b] = [...this.touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) || 1 : 1;
  }

  /**
   * Where the cursor points in the world: on the map if it's over the table,
   * otherwise out in the room at Adit's depth (so he looks "at" the cursor).
   */
  private cursorPoint(): THREE.Vector3 {
    this.ray.setFromCamera(this.pointer, this.camera);
    const r = this.ray.ray;
    const hit = r.intersectPlane(this.tablePlane, this.cursorAt);
    if (hit && Math.abs(hit.x) <= TABLE.x && Math.abs(hit.z) <= TABLE.z) return hit;
    const depth = r.origin.distanceTo(this.guide.root.position);
    return r.at(depth, this.cursorAt);
  }

  /** The world spot under the pointer, if any (table-top plane hit, nearest spot). */
  private pickSpot(): string | null {
    this.ray.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this.table.top + 0.12));
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(plane, hit)) return null;
    let best: string | null = null;
    let bestD = 0.42;
    for (const [id, p] of Object.entries(this.table.spots)) {
      const d = Math.hypot(hit.x - p.x, hit.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  private overBike(): boolean {
    if (!this.current) return false;
    this.ray.setFromCamera(this.pointer, this.camera);
    return this.ray.intersectObject(this.current.root, true).length > 0;
  }

  private overBoard(): boolean {
    this.ray.setFromCamera(this.pointer, this.camera);
    return this.ray.intersectObject(this.board.felt, false).length > 0;
  }

  /** Keyboard spin in inspect mode (radians). */
  nudge(delta: number): void {
    this.spinVel += delta * 4;
    this.idle = 0;
  }

  // ── camera ──────────────────────────────────────────────────────────────

  resize(layout: Layout): void {
    const { w, h, insetRight: r, insetBottom: b } = layout;
    this.camera.aspect = w / h;
    // Centre the scene in the space the UI leaves free.
    this.camera.setViewOffset(w + r, h + b, r, b, w, h);
    this.camera.fov = layout.portrait ? 44 : 36;
    this.camera.updateProjectionMatrix();
    this.portrait = layout.portrait;
    this.framing = {
      // Phones: height decides the zoom; only Adit and the heart of the bike
      // must stay in from the sides.
      table: this.fit(
        layout.portrait ? TABLE_POINTS_PORTRAIT : TABLE_POINTS,
        TABLE_DIR[layout.portrait ? 1 : 0],
        layout,
        layout.portrait ? PORTRAIT_ACROSS : undefined,
      ),
      inspect: this.fit(INSPECT_POINTS, INSPECT_DIR, layout),
      passport: this.fit(BOARD_POINTS, PASSPORT_DIR, layout),
    };
  }

  /**
   * Finds the closest camera, looking along `dir` at the points' centre, that
   * keeps every point inside the free area (not under the UI or the top bar).
   */
  private fit(
    points: THREE.Vector3[],
    dir: THREE.Vector3,
    layout: Layout,
    /** If given, only these points must fit left–right (the rest may crop off the sides). */
    across?: THREE.Vector3[],
  ): { pos: THREE.Vector3; look: THREE.Vector3 } {
    const box = new THREE.Box3().setFromPoints(points);
    const look = box.getCenter(new THREE.Vector3());
    const cam = this.camera.clone();
    const d = dir.clone().normalize();
    const edge = layout.side ? 14 : 4;
    const top = 1 - (2 * 78) / layout.h;
    const bottom = -1 + (2 * (layout.insetBottom + 14)) / layout.h;
    const right = 1 - (2 * (layout.insetRight + edge)) / layout.w;
    const left = -1 + (2 * edge) / layout.w;
    const v = new THREE.Vector3();
    const fits = (dist: number) => {
      cam.position.copy(look).addScaledVector(d, dist);
      cam.lookAt(look);
      cam.updateMatrixWorld();
      for (const p of points) {
        v.copy(p).project(cam);
        if (v.y < bottom || v.y > top || v.z > 1) return false;
        if (!across && (v.x < left || v.x > right)) return false;
      }
      for (const p of across ?? []) {
        v.copy(p).project(cam);
        if (v.x < left || v.x > right) return false;
      }
      return true;
    };
    let lo = 1;
    let hi = 60;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    // On portrait screens the width runs out first; rather than leave the spare
    // height as bare wall on top, slide the shot up so the highest point (the
    // rack) sits just under the top bar. The table's front runs under the sheet.
    if (layout.portrait) {
      cam.position.copy(look).addScaledVector(d, hi);
      cam.lookAt(look);
      cam.updateMatrixWorld();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      // Table view (with `across`): hang the shot from the top bar. Other views:
      // sit it just above the sheet. Camera down = content up on screen.
      const hang = across !== undefined;
      let a = hang ? -3 : 0;
      let b = hang ? 0 : 3;
      for (let i = 0; i < 24; i++) {
        const mid = (a + b) / 2;
        cam.position.copy(look).addScaledVector(d, hi).addScaledVector(up, mid);
        cam.updateMatrixWorld();
        let hiY = -Infinity;
        let loY = Infinity;
        for (const p of points) {
          const y = v.copy(p).project(cam).y;
          hiY = Math.max(hiY, y);
          loY = Math.min(loY, y);
        }
        if (hang) {
          if (hiY < top) b = mid;
          else a = mid;
        } else if (loY > bottom && hiY < top) a = mid;
        else b = mid;
      }
      if (hang) a = b;
      const shift = up.multiplyScalar(a);
      return { pos: look.clone().addScaledVector(d, hi).add(shift), look: look.clone().add(shift) };
    }
    return { pos: look.clone().addScaledVector(d, hi), look };
  }

  private targets(): { pos: THREE.Vector3; look: THREE.Vector3 } {
    if (app.get().view === "passport") {
      const f = this.framing.passport;
      return { pos: f.pos.clone(), look: f.look.clone() };
    }
    if (app.get().view === "inspect") {
      const f = this.framing.inspect;
      const look = f.look.clone();
      // Zoom only between "everything fits" and a little further out, so Adit never leaves the frame.
      return { pos: look.clone().add(f.pos.clone().sub(look).multiplyScalar(this.zoom)), look };
    }
    const f = this.framing.table;
    const pos = f.pos.clone();
    if (!this.reduced) {
      pos.x += this.pointer.x * 0.25;
      pos.y += this.pointer.y * 0.15;
    }
    return { pos, look: f.look.clone() };
  }

  // ── frame ───────────────────────────────────────────────────────────────

  update(dt: number, t: number): void {
    const view = app.get().view;
    const swapping =
      this.rigs.some((r) => r !== this.current && !(r.home && r.atAway)) ||
      (this.current !== null && this.current.phase !== "rest");
    const aligning = this.rigs.find((r) => r.phase === "align");
    // Spin: the turntable turns a leaving bike square with its way out; otherwise
    // inertia while inspecting with idle auto-rotate, or ease home to present.
    // The turntable turns on a critically damped spring: an eased start and stop, never a whip.
    const turn = (target: number) => {
      const st = { x: this.spin, v: this.spinV };
      stepSpring(st, target, this.reduced ? 20 : 6, 1, dt);
      this.spin = st.x;
      this.spinV = st.v;
    };
    if (aligning) {
      this.spinVel = 0;
      turn(this.spin + angleDelta(this.spin, aligning.alignTo));
    } else if (view === "inspect" && !swapping && !this.settling) {
      if (!this.dragging) {
        this.spin += this.spinVel * dt;
        this.spinVel = damp(this.spinVel, 0, 2.2, dt);
        this.idle += dt;
        if (this.idle > 2.5 && !this.reduced)
          this.spin += 0.32 * dt * Math.min(1, (this.idle - 2.5) / 1.5);
      }
    } else {
      this.spinVel = 0;
      // Ease back to the bike's resting angle (the way it rolled in).
      const home = this.spin + angleDelta(this.spin, this.restSpin);
      turn(home);
      if (Math.abs(this.spin - home) < 0.03 && Math.abs(this.spinV) < 0.12) {
        this.spin = this.restSpin;
        this.spinV = 0;
        this.settling = false;
      }
    }
    this.turntable.rotation.y = PRESENT + this.spin;
    this.stepRigs(dt);
    this.table.update(t);
    this.board.update(dt, this.reduced);
    // Adit looks at you (the camera). While the cursor moves his head follows
    // it; a moment after it goes still he turns back to you. Passport: the board.
    this.now = t;
    const inspect = view === "inspect";
    const face = inspect ? this.camera.position : new THREE.Vector3(0, 0, 0);
    const following = view !== "passport" && t - this.lastMove < CURSOR_LINGER;
    const boardAt = new THREE.Vector3(STAMP_BOARD.x, STAMP_BOARD.y, STAMP_BOARD.z);
    const look =
      view === "passport" ? boardAt : following ? this.cursorPoint() : this.camera.position;
    this.guide.update(dt, t, inspect, face, look, this.reduced, following);
    this.ritual.update(dt);
    const shot = this.ritual.cam;
    if (shot) {
      // The ritual holds the camera (the dive); the springs pick up from here after.
      this.camera.position.copy(shot.pos);
      this.camera.lookAt(shot.look);
      this.camPos.snap(shot.pos);
      this.camLook.snap(shot.look);
      return;
    }
    const { pos, look: lookAt } = this.targets();
    const smooth = this.reduced ? 0.05 : 0.6;
    this.camera.position.copy(this.camPos.step(pos, smooth, dt));
    this.camera.lookAt(this.camLook.step(lookAt, smooth, dt));
  }

  // ── the ride ritual ─────────────────────────────────────────────────────

  /** Kits up and rides out to world `id`; resolves once the camera hovers over its miniature. */
  depart(id: RouteId): Promise<void> {
    this.pendingStamps = null;
    return this.ritual.depart(id, bikeOf(id));
  }

  /** The last push into the miniature, just before the world takes over. */
  plunge(): Promise<void> {
    return this.ritual.plunge();
  }

  /** Home from world `id`: rides in, hangs the kit up, back to the table. */
  welcome(id: RouteId): Promise<void> {
    return this.ritual.welcome(id, bikeOf(id));
  }

  /** Jumps to the end of the ritual that's playing. */
  skipRitual(): void {
    this.ritual.skip();
  }

  /** Puts everything back at once (a ride abandoned before it began). */
  cancelRitual(): void {
    this.ritual.cancel();
  }

  private ritualHost() {
    return {
      scene: this.scene,
      rack: this.rack,
      guide: this.guide,
      spotOf: (id: RouteId) => {
        const p = this.table.spots[id];
        return p ? p.clone() : new THREE.Vector3(0, this.table.top, 0);
      },
      bike: () => this.current,
      rideOut: () => {
        this.current?.leave(LANE_OUT, true);
      },
      rideIn: (kind: BikeKind) => {
        // Whatever's on the turntable (Murphy, after a reload) makes way.
        this.placeBike(kind);
        return this.current as BikeRig;
      },
      parkNow: (kind: BikeKind) => {
        // Even if it's still on its way in: straight onto the turntable.
        const r = this.current;
        if (r && r.kind === kind && !r.onTurntable) r.target = 0;
        this.placeBike(kind, true);
      },
      clearBike: () => {
        const r = this.current;
        if (r && !r.home) r.reset(LANE_OUT, "away");
      },
      cameraNow: () => ({ pos: this.camera.position.clone(), look: this.camLook.value.clone() }),
      portrait: () => this.portrait,
      boardShot: () => {
        const f = this.framing.passport;
        return { pos: f.pos.clone(), look: f.look.clone() };
      },
      tableShot: () => {
        const f = this.framing.table;
        return { pos: f.pos.clone(), look: f.look.clone() };
      },
      hasPatch: () => this.pendingStamps !== null && this.board.hasNew(this.pendingStamps),
      pinPatch: () => {
        if (this.pendingStamps) this.board.setStamped(this.pendingStamps);
        this.pendingStamps = null;
      },
    };
  }

  /** Spin angle in degrees (0–360), for the UI dial. */
  spinDegrees(): number {
    const d = THREE.MathUtils.radToDeg(this.spin) % 360;
    return d < 0 ? d + 360 : d;
  }

  snapCamera(): void {
    const { pos, look } = this.targets();
    this.camPos.snap(pos);
    this.camLook.snap(look);
  }
}
