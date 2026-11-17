/**
 * A playable world (Expresso for now): the approved Coorg estate, ridden.
 *
 * - The scenery is the locked design build, batched by area at load.
 * - Physics runs at a fixed 120 Hz; what you see is interpolated between
 *   steps, so motion is smooth at any refresh rate.
 * - A third-person chase camera (shared by every journey): low or high,
 *   drag to look around.
 * - Stops: café counters. Ride up and "Stop here" appears; pulling over stops
 *   the bike, plays a little brew on the counter and opens the card. Finding
 *   them all earns the world's patch.
 * - Cruise rides along the roads to a stop for you; any steering takes over.
 * - Life: people and animals dodge you, the horn gets reactions, a gaur herd
 *   crosses the road now and then; the roastery's board pings the live server.
 */

import * as THREE from "three";
import type { RouteId } from "../../content/types";
import { world as worldInfo } from "../../content/worlds";
import { app, leaveWorld } from "../../state/app";
import { earnPatch, loadProgress, ride, saveProgress } from "../../state/ride";
import { angleDelta, prefersReducedMotion } from "../anim";
import { clay, LiveShadow, mix, paperShadow, toClay, toy } from "../flat/kit";
import type { Lamp, NightPass } from "../flat/night";
import type { Layout } from "../layout";
import {
  buildSliced,
  type MapArt,
  setTiling,
  textSprite,
  type V2,
  type WorldData,
} from "../lib/journey";
import { makeKit, setDetail } from "../lib/kit";
import { PASTEL } from "../lib/palette";
import { BG, LIGHTS, moodKit } from "../lib/zones";
import { batch } from "../merge";
import type { StageScene } from "../stage";
import { type BikeInput, BikePhysics, type Blocker } from "./bike";
import { RideCamera } from "./camera";
import { keepRoadsClear, solidOutlines } from "./clearance";
import { bend, setCurve } from "./curve";
import { Bushes, Clouds, Grove } from "./foliage";
import { Puffs } from "./fx";
import { Ground, polyDist } from "./ground";
import { Life } from "./life";
import { LiveBoard } from "./live";
import { Meteors } from "./meteors";
import { Props } from "./props";
import { Rider } from "./rider";
import { type Moment, RIDES, type RideDef, type RideStop } from "./rides";
import { LaneKeeper, Pilot, RoadGraph } from "./roads";
import { RideSound } from "./sound";
import { Train } from "./train";

const STEP = 1 / 120;
/** Scenery is batched in squares this size (metres), so off-screen parts are culled. */
const AREA = 58;
/** How close you must be to pull over at a stop. */
const NEAR = 7.5;
/** The sky overhead, per mood (the horizon is the mood's haze colour). */
const SKY_TOP: Record<string, string> = {
  golden: "#a9c7e8",
  vivid: "#8fbfe8",
  soft: "#bcd6ee",
  night: "#1b2550",
};

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

interface StopMark {
  x: number;
  z: number;
  y: number;
  /** The counter faces the road at this yaw. */
  yaw: number;
  /** Where to pull over: on the road beside the counter. */
  park: { x: number; z: number };
  pin: THREE.Sprite;
  ring: THREE.Mesh;
  /** Where the stop's moment plays (on a landmark's forecourt). */
  spot: { x: number; y: number; z: number };
}

export interface MapData {
  w: number;
  d: number;
  roads: { pts: V2[]; width: number }[];
  water: { pts: V2[]; width: number }[];
  stops: { x: number; z: number }[];
  /** A flat world's paper map extras (see MapArt). */
  art?: MapArt;
}

export class WorldScene implements StageScene {
  readonly scene = new THREE.Scene();
  /** Draws out to just past the fog, so far scenery costs nothing. */
  readonly camera = new THREE.PerspectiveCamera(56, 1, 0.3, 230);
  readonly id: RouteId;
  private ground!: Ground;
  private data!: WorldData;
  private bike!: BikePhysics;
  private rider!: Rider;
  private graph!: RoadGraph;
  private lanes!: LaneKeeper;
  /** No way to steer (no motion access): gas and brake follow the road. */
  private roadAssist = false;
  private cam!: RideCamera;
  private life: Life | null = null;
  /** The toy train, in a world with a railway. */
  private train: Train | null = null;
  private live: LiveBoard | null = null;
  private props: Props | null = null;
  private readonly bushMeshes: THREE.InstancedMesh[] = [];
  private readonly groveMeshes: THREE.InstancedMesh[] = [];
  /** People and animals in the way right now (a herd crossing). */
  private readonly lifeSolid: Blocker[] = [];
  private bushes: Bushes | null = null;
  private clouds: Clouds | null = null;
  private readonly puffs = new Puffs();
  private readonly sound = new RideSound();
  private brews: Moment[] = [];
  /** Drawn over the night, ungraded (stars, meteors): handed to the night pass. */
  private readonly skyLayer = new THREE.Group();
  private meteors: Meteors | null = null;
  /** How far into night it is (as last lit), and when that was. */
  private nightPhase = 0;
  private nightAt = -1;
  /** This world's ride: its stops, props, moments. */
  readonly def: RideDef;
  /** Stop ids and content, in world-stop order (stop i in the world shows content[i]). */
  private stopIds: string[] = [];
  stopContent: RideStop[] = [];
  private sky: THREE.Mesh | null = null;
  private readonly sun = new THREE.DirectionalLight();
  /** The rider's cut-paper shadow (flat worlds). */
  private riderShadow: LiveShadow | null = null;
  private stops: StopMark[] = [];
  /** Seconds left going round an obstacle after backing off it, and which way. */
  private sidestep = 0;
  private sideSign = 1;
  private pilot: Pilot | null = null;
  /** The stop cruise is riding to. */
  private cruiseTo = 0;
  /** Cruise's watchdog: the closest it's been, time since it got closer, re-plans so far. */
  private bestLeft = Number.POSITIVE_INFINITY;
  private sinceProgress = 0;
  private replans = 0;
  /** The last stop you pulled over at (cruise goes on from there). */
  private lastStop = -1;
  /** Cruise: seconds pushing without moving, and seconds left backing off. */
  private stuck = 0;
  private backOff = 0;
  private acc = 0;
  /** Previous physics state, for interpolation. */
  private prev = { x: 0, z: 0, y: 0, heading: 0, lean: 0 };
  private lastV = 0;
  private accel = 0;
  private throttle = 0;
  private readonly keys = new Set<string>();
  /** Two-thumb touch controls: steer −1…1, throttle and brake 0–1. */
  private touch = { steer: 0, throttle: 0, brake: 0 };
  private drag: { id: number; x: number; y: number } | null = null;
  private shake = 0;
  private readonly reduced = prefersReducedMotion();
  private saveIn = 3;
  private hudIn = 0;
  private emitT = 0;
  private t = 0;
  private height = 800;
  private unsub: (() => void) | null = null;
  private canvas: HTMLCanvasElement | null = null;

  private constructor(id: RouteId) {
    this.id = id;
    const def = RIDES[id];
    if (!def) throw new Error(`${id} isn't a rideable world yet`);
    this.def = def;
  }

  static async create(
    id: RouteId,
    canvas: HTMLCanvasElement,
    onProgress: (p: number) => void,
    o: { prebuild?: boolean } = {},
  ): Promise<WorldScene> {
    const w = new WorldScene(id);
    onProgress(0.05);
    await nextFrame();
    w.light();
    const base = makeKit("smooth");
    const journey = w.def.journey;
    const kit = moodKit(base, journey.mood);
    const raw = new THREE.Scene();
    onProgress(0.15);
    await nextFrame();
    // Scenery is seen from riding height, so it's built at a lighter detail.
    // An open world: the estate is built to tile, so it can wrap round.
    // Built a slice at a time; the settings are switched on only inside each
    // slice, so anything else built between slices (the garage) is unaffected.
    const built = await buildSliced(journey, raw, kit, base, (slice) => {
      setDetail(0.55);
      setTiling(true);
      try {
        return slice();
      } finally {
        setDetail(1);
        setTiling(false);
      }
    });
    if (!built.world) throw new Error(`${id} has no playable world data`);
    w.data = built.world;
    onProgress(0.6);
    await nextFrame();
    // Live things stay out of the batching: coffee bushes (they part as you
    // ride through), low clouds (they fade when they'd hide you), and people,
    // animals and birds (they move).
    const root = new THREE.Group();
    const puffs: THREE.Object3D[] = [];
    const living: THREE.Object3D[] = [];
    let coffee: THREE.InstancedMesh | null = null;
    const groves: Grove[] = [];
    // Detailed land (a world's terrain chunks): drawn as it is, culled chunk by chunk.
    const terrain: THREE.Object3D[] = [];
    for (const c of [...raw.children]) {
      if (c.userData.terrain) terrain.push(c);
      else if (c.userData.cloud) puffs.push(c);
      else if (c.userData.coffee) coffee = c as THREE.InstancedMesh;
      else if (c.userData.flora) groves.push(new Grove(c as THREE.InstancedMesh));
      else if (
        c.userData.dodge ||
        c.userData.birds ||
        c.userData.elephant ||
        c.userData.spin ||
        c.userData.route ||
        c.userData.wave
      )
        living.push(c);
      else root.add(c);
    }
    // Roads stay clear: nothing in the scenery may reach onto one.
    w.ground = new Ground(w.data);
    const moved = keepRoadsClear(root, w.data, (x, z) => w.ground.height(x, z));
    // What stood there goes with it: its solid outline, a stop, a landmark.
    const follow = (p: { x: number; z: number }) => {
      const n = moved.find(
        (m) => p.x >= m.from.minX && p.x <= m.from.maxX && p.z >= m.from.minZ && p.z <= m.from.maxZ,
      );
      if (n) {
        p.x += n.dx;
        p.z += n.dz;
      }
    };
    for (const b of w.data.blockers) follow(b);
    // Worlds that don't list their solid things get them from the scenery.
    if (w.data.blockers.length === 0 || w.data.autoSolids)
      w.data.blockers = [
        ...w.data.blockers,
        ...solidOutlines(root, (x, z) => w.ground.height(x, z)),
      ];
    for (const st of w.data.stops) follow(st);
    for (const l of Object.values(w.data.landmarks)) follow(l);
    if (new URLSearchParams(location.search).has("debug"))
      console.info(
        "roads cleared:",
        JSON.stringify(
          moved.map((m) => ({
            at: [
              Math.round((m.from.minX + m.from.maxX) / 2),
              Math.round((m.from.minZ + m.from.maxZ) / 2),
            ],
            by: +Math.hypot(m.dx, m.dz).toFixed(2),
          })),
        ),
      );
    const statics = w.batchByArea(root);
    for (const c of terrain) w.scene.add(c);
    if (coffee) {
      w.bushes = new Bushes(coffee);
      w.scene.add(w.bushes.group);
    }
    // Sign labels in the design boards draw on top of everything; in a world
    // you ride past them, so they sit behind what's in front of them.
    w.scene.traverse((o) => {
      if ((o as THREE.Sprite).isSprite) (o as THREE.Sprite).material.depthTest = true;
    });
    w.clouds = new Clouds(puffs);
    w.scene.add(w.clouds.group);
    onProgress(0.72);
    await nextFrame();
    // Roads always stay clear: a blocker that reaches onto one is trimmed back.
    const roadPolys = w.data.roads.map((r) => ({
      half: r.width / 2 + 0.8,
      pts: r.road.samples.map((q) => [q.x, q.z] as V2),
    }));
    w.data.blockers = w.data.blockers.flatMap((bl) => {
      const room = Math.min(...roadPolys.map((r) => polyDist(r.pts, bl.x, bl.z) - r.half));
      const r = Math.min(bl.r, room);
      return r > 0.18 ? [{ ...bl, r }] : [];
    });
    onProgress(0.85);
    await nextFrame();
    w.graph = new RoadGraph(
      w.data.roads.map((r, i) => ({ road: r.road, closed: r.closed ?? i === 0 })),
    );
    w.lanes = new LaneKeeper(
      w.data.roads.map((r, i) => ({ road: r.road, closed: r.closed ?? i === 0 })),
    );
    w.placeStops();
    w.assignContent();
    // Spawn: where you last were, or the arrival gateway on a first visit.
    const saved = loadProgress(id);
    const at = saved.at ?? w.data.spawn;
    const feel = worldInfo(id).feel;
    w.bike = new BikePhysics(
      w.ground,
      w.data.blockers,
      // Unhurried: about four seconds to 50 km/h on the café racer.
      { top: w.top, accel: 3 + feel.speed * 2.6, grip: feel.grip },
      at,
      9,
      true,
      w.data.walls ?? [],
    );
    w.prev = { x: at.x, z: at.z, y: w.ground.height(at.x, at.z), heading: at.heading, lean: 0 };
    w.rider = new Rider(base, worldInfo(id).bike.kind);
    if (journey.flat) {
      // Clay, like the toys, with a cut-paper shadow that follows.
      toClay(w.rider.root, clay(journey.flat.ground).matcap as THREE.Texture);
      w.riderShadow = new LiveShadow(
        w.rider.root,
        (w.data.shadow as THREE.ShaderMaterial | undefined) ??
          paperShadow(mix(journey.flat.ground, PASTEL.ink, 0.13)),
      );
      w.scene.add(w.riderShadow.group);
    }
    w.scene.add(w.rider.root);
    w.life = new Life(
      living,
      w.ground,
      w.lifeSolid,
      w.data.roads,
      w.data.landmarks.herd,
      w.data.size,
    );
    w.life.onHerdMoves = () => {
      if (w.near(w.data.landmarks.herd, 60)) w.sound.low();
    };
    w.scene.add(w.life.group);
    if (w.data.train && journey.flat) {
      w.train = new Train(
        w.data.train,
        clay(journey.flat.ground),
        journey.flat.ground,
        w.data.size,
      );
      w.scene.add(w.train.group);
      // All aboard: louder the nearer you are (heard up to ~120 m).
      w.train.onWhistle = (x, z) => {
        const b = w.bike;
        if (!b) return;
        let dx = x - b.x;
        let dz = z - b.z;
        dx -= w.data.size.w * Math.round(dx / w.data.size.w);
        dz -= w.data.size.d * Math.round(dz / w.data.size.d);
        w.sound.whistle(Math.max(0, 1 - Math.hypot(dx, dz) / 120));
      };
    }
    w.placeLiveBoard();
    onProgress(0.92);
    await nextFrame();
    // Things with weight (the physics engine loads here, only inside a world).
    const flatLook = journey.flat
      ? (() => {
          const base = clay(journey.flat.ground);
          const matcap = base.matcap as THREE.Texture;
          const made = new Map<string, THREE.Material>();
          return {
            toyMaterial: base,
            shadow: w.data.shadow ?? paperShadow(mix(journey.flat.ground, PASTEL.ink, 0.13)),
            clay: (c: THREE.Color) => {
              const k = c.getHexString();
              let m = made.get(k);
              if (!m) {
                m = new THREE.MeshMatcapMaterial({ matcap, color: c.clone(), toneMapped: false });
                made.set(k, m);
              }
              return m;
            },
          };
        })()
      : undefined;
    w.props = await Props.create(
      id,
      w.data,
      w.ground,
      w.data.blockers,
      w.def.props(w.data, w.ground),
      (w.data.pushables ?? []).map((p) => ({ ...p, geometry: toy(p.id) })),
      flatLook,
      (w.data.knockables ?? []).map((k) => ({ ...k, geometry: toy(k.id, k.tint) })),
    );
    w.scene.add(w.props.group);
    // The land carries on in every direction, on a planet you never see curve.
    for (const g of groves) w.scene.add(g.group);
    w.surround([
      ...statics,
      ...terrain,
      ...(w.bushes ? [w.bushes.group] : []),
      ...groves.map((g) => g.group),
    ]);
    // Flat worlds stay flat: no planet curve (the camera never sees a horizon).
    if (journey.flat) setCurve(0, 1);
    else {
      setCurve(18, Math.max(w.data.size.w, w.data.size.d));
      bend(w.scene);
    }
    // Every bush chunk, in the tile and its copies, for picking detail by distance;
    // every grove chunk, for drawing only as far as it can be seen.
    w.scene.traverse((o) => {
      if (typeof o.userData.reach === "number" && (o as THREE.InstancedMesh).isInstancedMesh)
        w.groveMeshes.push(o as THREE.InstancedMesh);
      if (o.userData.lod && (o as THREE.InstancedMesh).isInstancedMesh)
        w.bushMeshes.push(o as THREE.InstancedMesh);
    });
    w.scene.add(w.puffs.points);
    w.cam = new RideCamera(at.heading, !!journey.flat);
    if (w.def.meteors) {
      w.meteors = new Meteors();
      w.skyLayer.add(w.meteors.group);
    }
    onProgress(1);
    // Built ahead of time (in the background, from the yard): it waits, deaf to
    // input, until it's actually shown (see activate).
    if (!o.prebuild) w.activate(canvas);
    return w;
  }

  private active = false;

  /**
   * Shows up for riding: takes over the ride state (stops found, the HUD's
   * readings) and starts listening to keys and the pointer. Called once, when
   * the world is handed the stage (create does it itself unless prebuilding).
   */
  activate(canvas: HTMLCanvasElement): void {
    if (this.active) return;
    this.active = true;
    const saved = loadProgress(this.id);
    ride.set({
      found: saved.found.filter((s) => this.stopIds.includes(s)),
      near: null,
      open: null,
      cruising: null,
      kmh: 0,
      nearLive: false,
      live: this.live ? this.live.status : null,
      cam: this.cam.mode,
      sound: this.sound.enabled,
    });
    this.refreshPins();
    this.bind(canvas);
    // ?debug: let tests read and set the ride state.
    if (new URLSearchParams(location.search).has("debug")) {
      (window as unknown as { __ride?: typeof ride }).__ride = ride;
      (window as unknown as { __world?: WorldScene }).__world = this;
    }
  }

  private get top(): number {
    return 16 + worldInfo(this.id).feel.speed * 12;
  }

  // ── building ────────────────────────────────────────────────────────────

  /** Batch by area so the camera (and the sun's shadow camera) only draw nearby parts. */
  private batchByArea(root: THREE.Group): THREE.Object3D[] {
    const areas = new Map<string, THREE.Group>();
    const wide = new THREE.Group();
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const mid = new THREE.Vector3();
    for (const c of [...root.children]) {
      box.setFromObject(c);
      box.getSize(size);
      box.getCenter(mid);
      if (box.isEmpty() || Math.max(size.x, size.z) > AREA * 0.75) {
        wide.add(c);
        continue;
      }
      const key = `${Math.floor(mid.x / AREA)},${Math.floor(mid.z / AREA)}`;
      let g = areas.get(key);
      if (!g) {
        g = new THREE.Group();
        areas.set(key, g);
      }
      g.add(c);
    }
    const out = [batch(wide), ...[...areas.values()].map((g) => batch(g))];
    for (const o of out) this.scene.add(o);
    return out;
  }

  /**
   * The world wraps round: the eight neighbouring copies of the tile, sharing
   * geometry (and the bushes' live bending), so the land carries on in every
   * direction. Only the scenery is copied; life and stops live in the tile.
   */
  private surround(sources: THREE.Object3D[]): void {
    const { w, d } = this.data.size;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        if (a === 0 && b === 0) continue;
        for (const src of sources) {
          const copy = src.clone(true);
          const orig: THREE.Object3D[] = [];
          src.traverse((o) => {
            orig.push(o);
          });
          const lights: THREE.Object3D[] = [];
          let i = 0;
          copy.traverse((o) => {
            const from = orig[i++] as THREE.InstancedMesh | undefined;
            const inst = o as THREE.InstancedMesh;
            if (inst.isInstancedMesh && from?.isInstancedMesh) {
              inst.instanceMatrix = from.instanceMatrix;
              inst.instanceColor = from.instanceColor;
            }
            // Lights are costly, and labels (one draw each) are specks this far off.
            if ((o as THREE.Light).isLight || (o as THREE.Sprite).isSprite) lights.push(o);
          });
          for (const l of lights) l.removeFromParent();
          copy.position.x += a * w;
          copy.position.z += b * d;
          this.scene.add(copy);
        }
      }
  }

  private light(): void {
    const flatWorld = this.def.journey.flat;
    if (flatWorld) {
      // The ground is the sky; toys are clay (matcap), so light matters only for the odd lit prop.
      this.scene.background = new THREE.Color(flatWorld.ground);
      this.scene.fog = null;
      this.scene.environmentIntensity = 0.25;
      this.scene.add(new THREE.HemisphereLight("#ffffff", flatWorld.ground, 1.5));
      this.sun.color.set("#ffffff");
      this.sun.intensity = 1.2;
      this.sun.castShadow = false;
      this.sun.position.set(-45, 100, -30);
      this.scene.add(this.sun);
      return;
    }
    const mood = this.def.journey.mood;
    const l = LIGHTS[mood];
    const horizon = new THREE.Color(BG[mood]);
    this.scene.background = horizon;
    // Low, golden haze: far hills soften into the sky.
    // On the tiny planet, land past ~200 m has dipped below the horizon anyway.
    this.scene.fog = new THREE.Fog(horizon, 60, 210);
    this.scene.environmentIntensity = 0.25;
    this.scene.add(new THREE.HemisphereLight(l.sky, l.ground, l.hemi));
    this.sun.color.set(l.sun);
    this.sun.intensity = l.sunI;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    const s = this.sun.shadow.camera;
    Object.assign(s, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 240 });
    s.updateProjectionMatrix();
    this.scene.add(this.sun, this.sun.target);
    // A sky dome: warm at the horizon, clearer overhead (now that you look up at it).
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(220, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          low: { value: horizon },
          high: { value: new THREE.Color(SKY_TOP[mood]) },
        },
        vertexShader: `
          varying float vH;
          void main() {
            vH = normalize(position).y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 low;
          uniform vec3 high;
          varying float vH;
          void main() {
            gl_FragColor = vec4(mix(low, high, smoothstep(0.02, 0.55, vH)), 1.0);
          }`,
      }),
    );
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    this.sky = sky;
    this.scene.add(sky);
  }

  /**
   * Which content stands at which stop: pinned content first (e.g. the rocket
   * launch's project at the stop beside the launch pad), the rest in order.
   */
  private assignContent(): void {
    const n = Math.min(this.stops.length, this.def.stops.length);
    const slots: (RideStop | undefined)[] = new Array(this.stops.length).fill(undefined);
    const rest = [...this.def.stops];
    for (const [stopId, tag] of Object.entries(this.def.pinned ?? {})) {
      const at = this.data.stops.findIndex((st) => st.tag === tag);
      const k = rest.findIndex((c) => c.id === stopId);
      if (at >= 0 && k >= 0 && !slots[at]) {
        slots[at] = rest[k];
        rest.splice(k, 1);
      }
    }
    for (let i = 0; i < slots.length; i++) if (!slots[i]) slots[i] = rest.shift();
    this.stopContent = slots.slice(0, Math.max(n, slots.length)).filter((c): c is RideStop => !!c);
    this.stopIds = this.stopContent.map((c) => c.id);
  }

  private placeStops(): void {
    const ringGeo = new THREE.RingGeometry(2.2, 2.55, 48);
    this.stops = this.data.stops.map((s) => {
      // A landmark's pin floats just above it; a plain stop's pin at a fixed height.
      const y =
        s.top !== undefined
          ? this.ground.height(s.x, s.z) + s.top - 4
          : this.counterHeight(s.x, s.z);
      const pin = textSprite("?", "#ffffff", "#2f7d4f");
      pin.scale.set(1.7, 0.85, 1);
      pin.position.set(s.x, y + 5.4, s.z);
      this.scene.add(pin);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: "#ffd98a",
          transparent: true,
          opacity: 0.0,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      const p = s.road.at(s.t).p;
      ring.position.set(p.x, this.ground.height(p.x, p.z) + 0.2, p.z);
      // (A landmark is the stop itself: no circle on the road.)
      if (s.top === undefined) this.scene.add(ring);
      const yaw = Math.atan2(p.x - s.x, p.z - s.z);
      // Where its moment plays: at a landmark, out on the forecourt (between the road and it).
      const dx = s.x - p.x;
      const dz = s.z - p.z;
      const dl = Math.hypot(dx, dz) || 1;
      const spot =
        s.top !== undefined
          ? (() => {
              const x = p.x + (dx / dl) * Math.min(4, dl * 0.5);
              const z = p.z + (dz / dl) * Math.min(4, dl * 0.5);
              return { x, y: this.ground.height(x, z), z };
            })()
          : { x: s.x, y, z: s.z };
      return { x: s.x, z: s.z, y, yaw, park: { x: p.x, z: p.z }, pin, ring, spot };
    });
  }

  /** Counters sit level, at the lowest point of their footprint (as the build places them). */
  private counterHeight(x: number, z: number): number {
    let low = this.ground.height(x, z);
    for (const [dx, dz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const)
      low = Math.min(low, this.ground.height(x + dx * 1.3, z + dz * 1.3));
    return low;
  }

  /** A live board (if this world has one), beside the road by its landmark, facing riders. */
  private placeLiveBoard(): void {
    const live = this.def.live;
    const r = live ? this.data.landmarks[live.landmark] : undefined;
    if (!live || !r?.road) return;
    // Halfway between the roastery and its road, a little to one side.
    const x = r.road.x + (r.x - r.road.x) * 0.45;
    const z = r.road.z + (r.z - r.road.z) * 0.45;
    const yaw = Math.atan2(r.road.x - x, r.road.z - z);
    this.live = new LiveBoard(live.url, live.title, { x, z, yaw }, this.ground);
    this.scene.add(this.live.group);
  }

  /** New stops show a question mark; found ones none (the landmark is enough, and the map ticks it). */
  private refreshPins(): void {
    const found = ride.get().found;
    this.stops.forEach((m, i) => {
      const done = found.includes(this.stopIds[i] ?? "");
      m.pin.visible = !done;
      const next = textSprite(
        done ? "✓" : "?",
        done ? "#2f7d4f" : "#ffffff",
        done ? "#f6efdf" : "#2f7d4f",
      );
      const old = m.pin.material;
      next.material.depthTest = true;
      m.pin.material = next.material;
      old.map?.dispose();
      old.dispose();
    });
  }

  // ── input ───────────────────────────────────────────────────────────────

  private bind(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    let prev = ride.get();
    this.unsub = ride.subscribe(() => {
      const s = ride.get();
      if (s.found !== prev.found) this.refreshPins();
      if (s.open !== prev.open) {
        // Pulled over: turn to the counter (and its brew); back behind you after.
        const m = s.open !== null ? this.stops[s.open] : undefined;
        this.cam.focus = m ? new THREE.Vector3(m.x, m.y + 1.6, m.z) : null;
      }
      if (s.cruising !== prev.cruising) {
        this.pilot = null;
        if (s.cruising !== null) this.startCruise(s.cruising);
      }
      prev = s;
    });
  }

  dispose(): void {
    this.meteors?.dispose();
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    const c = this.canvas;
    if (c) {
      c.removeEventListener("pointerdown", this.onDown);
      c.removeEventListener("pointermove", this.onMove);
      c.removeEventListener("pointerup", this.onUp);
      c.removeEventListener("pointercancel", this.onUp);
    }
    this.unsub?.();
    this.save();
    setCurve(0, 1);
    this.sound.dispose();
    this.live?.dispose();
    this.props?.dispose();
    for (const b of this.brews) b.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
  }

  private static readonly DRIVE = new Set([
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "w",
    "a",
    "s",
    "d",
    " ",
  ]);

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const k = e.key.toLowerCase();
    if (k === "h" && !e.repeat) {
      this.honk();
      return;
    }
    if (k === "v" && !e.repeat) {
      this.toggleCamera();
      return;
    }
    if (!WorldScene.DRIVE.has(k)) return;
    // Arrow keys and space would scroll an open card; leave them to it.
    if (ride.get().open !== null) return;
    e.preventDefault();
    this.keys.add(k);
    // Steering by hand takes over from cruise.
    if (ride.get().cruising !== null && k !== " ") ride.patch({ cruising: null });
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.touch = { steer: 0, throttle: 0, brake: 0 };
  };

  // Drag on the scene to look around.
  private onDown = (e: PointerEvent): void => {
    if (this.drag) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.cam.drag(e.clientX - d.x, e.clientY - d.y, this.height);
    d.x = e.clientX;
    d.y = e.clientY;
  };

  private onUp = (e: PointerEvent): void => {
    if (this.drag?.id === e.pointerId) this.drag = null;
  };

  /** The two-thumb touch controls. */
  setTouch(steer: number, throttle: number, brake: number): void {
    this.touch = { steer, throttle, brake };
    if ((Math.abs(steer) > 0.2 || throttle > 0 || brake > 0) && ride.get().cruising !== null)
      ride.patch({ cruising: null });
  }

  /** Riders who can't steer: gas and brake keep to the road, no off-roading. */
  setRoadAssist(on: boolean): void {
    this.roadAssist = on;
  }

  toggleCamera(): void {
    ride.patch({ cam: this.cam.toggle() });
  }

  /** Sound on or off (call from a tap or click: browsers only start audio on a gesture). */
  setSound(on: boolean): void {
    this.sound.setEnabled(on);
    ride.patch({ sound: this.sound.enabled });
  }

  honk(): void {
    this.sound.horn();
    const heard = this.life?.honk(this.bike);
    if (!heard) return;
    // A beat later, the world answers.
    setTimeout(() => {
      if (heard.birds) this.sound.birds();
      if (heard.low) this.sound.low();
    }, 260);
    if (heard.trumpet) setTimeout(() => this.sound.trumpet(), 520);
  }

  private input(dt: number): BikeInput {
    const s = ride.get();
    // Reading a stop: stop the bike and hold it there.
    if (s.open !== null) return { throttle: 0, brake: 0, steer: 0, park: true };
    const b = this.bike;
    if (this.pilot) {
      const p = this.pilot.update(b.x, b.z, Math.abs(b.v), this.top);
      const goal = this.stops[this.cruiseTo];
      const straight = goal ? Math.hypot(goal.park.x - b.x, goal.park.z - b.z) : 0;
      // Watchdog: if the stop hasn't come any closer for a while (wedged
      // off-road, in a river, behind a building), plan again from here; if that
      // keeps failing, lift the bike back onto the road and carry on.
      if (straight < this.bestLeft - 1.5) {
        this.bestLeft = straight;
        this.sinceProgress = 0;
      } else {
        this.sinceProgress += dt;
      }
      if (this.sinceProgress > 4) {
        this.sinceProgress = 0;
        this.replans += 1;
        if (this.replans > 2) this.liftToRoad();
        this.startCruise(this.cruiseTo, false);
        return { throttle: 0, brake: 1, steer: 0 };
      }
      if (p.left < 5 || straight < 4) {
        // Arrived: pull over (a firm stop) and open the card straight away.
        const i = this.cruiseTo;
        this.pilot = null;
        ride.patch({ cruising: null });
        this.openStop(i);
        return { throttle: 0, brake: 0, steer: 0, park: true };
      }
      // Pure pursuit: the curvature that arcs onto the aim point (κ = 2·sin α / L),
      // as the steering angle the bike needs, over its lock at this speed.
      const alpha = angleDelta(b.heading, p.aim);
      const kappa = (2 * Math.sin(alpha)) / p.reach;
      const lock = 0.4 / (1 + Math.abs(b.v) * 0.17);
      const steer =
        Math.abs(alpha) > 1.2
          ? Math.sign(alpha)
          : THREE.MathUtils.clamp(Math.atan(1.78 * kappa) / lock, -1, 1);
      // Wedged against something: back off a little, turning, then go round it
      // (aim off to one side for a moment, the other side next time).
      if (this.backOff > 0) {
        this.backOff -= dt;
        if (this.backOff <= 0) this.sidestep = 1.1;
        return { throttle: 0, brake: 1, steer: -steer };
      }
      if (this.sidestep > 0) {
        this.sidestep -= dt;
        const side = this.sideSign * 0.9;
        return { throttle: 0.45, brake: 0, steer: b.steerToward(p.aim + side, 2.4) };
      }
      if (p.want > 1 && Math.abs(b.v) < 0.4) this.stuck += dt;
      else this.stuck = 0;
      if (this.stuck > 0.8) {
        this.stuck = 0;
        this.backOff = 0.9;
        this.sideSign = -this.sideSign;
      }
      // The way on is behind you: turn round on the spot first.
      const err = Math.abs(angleDelta(b.heading, p.aim));
      if (err > 1.2 && Math.abs(b.v) < 3) {
        // Brake to a walking pace first (gas would override the brake), then
        // paddle round.
        return b.v > 0.8 ? { throttle: 0, brake: 1, steer } : { throttle: 0.12, brake: 0, steer };
      }
      // Pointing well off the way on: stay slow until we're lined up.
      // (At a walking pace the rider paddles round, which turns far tighter.)
      const lined = THREE.MathUtils.clamp(1 - (err - 0.15) / 0.55, 0, 1) ** 1.5;
      const want = Math.min(p.want, 1.1 + lined * Math.max(0, p.want - 1.1));
      const dv = want - b.v;
      return {
        throttle: dv > 0 ? Math.min(1, dv * 0.6) : 0,
        brake: dv < -0.5 ? Math.min(1, -dv * 0.25) : 0,
        steer,
      };
    }
    const k = this.keys;
    const keyThrottle = k.has("arrowup") || k.has("w") ? 1 : 0;
    const keyBrake = k.has("arrowdown") || k.has("s") || k.has(" ") ? 1 : 0;
    const keySteer =
      (k.has("arrowleft") || k.has("a") ? 1 : 0) - (k.has("arrowright") || k.has("d") ? 1 : 0);
    let steer = THREE.MathUtils.clamp(keySteer + this.touch.steer, -1, 1);
    let throttle = Math.max(keyThrottle, this.touch.throttle);
    let brake = Math.max(keyBrake, this.touch.brake);
    // Following the road for riders who can't steer (going forward only): it
    // steers for you and eases off the gas for bends, so you never leave the road.
    if (this.roadAssist && keySteer === 0 && b.v > -0.2) {
      const lane = this.lanes.aim(b.x, b.z, b.heading, b.v);
      steer = b.steerToward(lane.aim, 2.8);
      const safe = this.top * Math.max(0.3, 1 - lane.bend * 0.75);
      if (b.v > safe && throttle > 0) {
        throttle = 0;
        brake = Math.max(brake, Math.min(1, (b.v - safe) * 0.3));
      }
    }
    return { throttle, brake, steer };
  }

  // ── stops and cruise ───────────────────────────────────────────────────

  private near(p: { x: number; z: number } | undefined, r: number): boolean {
    return Boolean(p && Math.hypot(p.x - this.bike.x, p.z - this.bike.z) < r);
  }

  startCruise(i: number, fresh = true): void {
    const m = this.stops[i];
    if (!m) return;
    if (fresh) {
      this.replans = 0;
      this.sinceProgress = 0;
      this.bestLeft = Math.hypot(m.park.x - this.bike.x, m.park.z - this.bike.z);
    }
    const r = this.graph.route(this.bike.x, this.bike.z, this.bike.heading, m.park.x, m.park.z);
    this.pilot = new Pilot(r.pts);
    this.cruiseTo = i;
  }

  /**
   * Cruise's last resort: set the bike down on the road a little way along its
   * route, facing the way on (the camera follows; physics carries on from there).
   */
  private liftToRoad(): void {
    const b = this.bike;
    const n = this.pilot?.ahead() ?? null;
    const at = n?.at ?? this.graph.nodes[this.graph.nearest(b.x, b.z)];
    if (!at) return;
    const then = n?.then ?? at;
    // Not a jump: the bike eases back onto the road over a second (see update).
    this.glide = {
      x0: b.x,
      z0: b.z,
      h0: b.heading,
      x1: at.x,
      z1: at.z,
      h1: then !== at ? Math.atan2(-(then.z - at.z), then.x - at.x) : b.heading,
      t: 0,
    };
    b.v = 0;
    b.slip = 0;
  }

  /** Easing the bike back onto the road (cruise, when it's stuck): from, to, how far along. */
  private glide: {
    x0: number;
    z0: number;
    h0: number;
    x1: number;
    z1: number;
    h1: number;
    t: number;
  } | null = null;

  /**
   * Where "Cruise to next stop" goes: the nearest stop not yet found (by road);
   * once all are found, the next one on the menu after the last you visited.
   * Never the stop you're already at.
   */
  nextStop(): number | null {
    const found = ride.get().found;
    const n = this.stops.length;
    const here = (i: number) => {
      const m = this.stops[i];
      return Boolean(m && Math.hypot(m.park.x - this.bike.x, m.park.z - this.bike.z) < NEAR + 1.5);
    };
    if (found.length >= n) {
      for (let k = 1; k <= n; k++) {
        const i = (this.lastStop + k) % n;
        if (!here(i)) return i;
      }
      return null;
    }
    let best: number | null = null;
    let bd = Number.POSITIVE_INFINITY;
    this.stops.forEach((m, i) => {
      if (found.includes(this.stopIds[i] ?? "") || here(i)) return;
      const d = this.graph.route(
        this.bike.x,
        this.bike.z,
        this.bike.heading,
        m.park.x,
        m.park.z,
      ).length;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /** Pull over at a stop: the bike stops, the counter brews, the card opens (marks it found). */
  openStop(i: number): void {
    const id = this.stopIds[i];
    const m = this.stops[i];
    if (!id || !m) return;
    const s = ride.get();
    const found = s.found.includes(id) ? s.found : [...s.found, id];
    ride.patch({ open: i, found, cruising: null });
    this.pilot = null;
    this.lastStop = i;
    // The little moment at the stop (a brew on the counter, a star flaring…).
    const moment = this.def.moment(
      id,
      new THREE.Vector3(m.spot.x, m.spot.y, m.spot.z),
      m.yaw,
      this.bike ? { x: this.bike.x, z: this.bike.z, heading: this.bike.heading } : undefined,
      {
        night: () => (this.t - this.nightAt < 0.3 ? this.nightPhase : 0),
        bike: () => ({ x: this.bike?.x ?? 0, z: this.bike?.z ?? 0 }),
        camera: this.camera,
      },
    );
    this.brews.push(moment);
    (moment.group.userData.overlay ? this.skyLayer : this.scene).add(moment.group);
    this.sound.brew(this.def.momentSound(id));
    const n = this.stopIds.length;
    if (found.length === n && s.found.length < n) {
      earnPatch(this.id);
      app.patch({ toast: `${worldInfo(this.id).name} patch earned: it's on your passport` });
    }
    this.save();
  }

  /** Open the live site (from the board's prompt). */
  openLive(): void {
    if (this.def.live) window.open(this.def.live.url, "_blank", "noopener");
  }

  private save(): void {
    if (!this.bike) return;
    saveProgress(this.id, {
      found: ride.get().found,
      at: { x: this.bike.x, z: this.bike.z, heading: this.bike.heading },
    });
  }

  /** For the mini-map. */
  mapData(): MapData {
    return {
      w: this.data.size.w,
      d: this.data.size.d,
      roads: this.data.roads.map((r) => ({
        pts: r.road.samples.map((s) => [s.x, s.z] as V2),
        width: r.width,
      })),
      water: this.data.water,
      stops: this.stops.map((m) => ({ x: m.x, z: m.z })),
      ...(this.data.mapArt ? { art: this.data.mapArt } : {}),
    };
  }

  player(): { x: number; z: number; heading: number } {
    return { x: this.bike.x, z: this.bike.z, heading: this.bike.heading };
  }

  /** Which way is "up" on the mini-map: the direction the camera looks. */
  mapYaw(): number {
    return this.cam.viewYaw;
  }

  // ── frame ───────────────────────────────────────────────────────────────

  resize(layout: Layout): void {
    const { w, h } = layout;
    const r = layout.insetRight;
    const b = layout.insetBottom;
    this.height = h;
    this.camera.aspect = w / h;
    // Keep the bike centred in the space the UI leaves free (an open card).
    this.camera.setViewOffset(w + r, h + b, r, b, w, h);
    this.camera.updateProjectionMatrix();
    this.puffs.setViewport(h, this.camera.fov);
  }

  private follow() {
    return {
      x: this.bike.x,
      y: this.ground.height(this.bike.x, this.bike.z),
      z: this.bike.z,
      heading: this.bike.heading,
      v: this.bike.v,
      top: this.top,
    };
  }

  /**
   * At night: the high beam ahead of the bike, the nearest lamps (the world
   * wraps: each at its copy nearest you), and the train's headlamp.
   */
  lights(night: NightPass): void {
    this.nightPhase = night.phase;
    this.nightAt = this.t;
    night.overlay = this.skyLayer;
    const b = this.bike;
    if (!b) return;
    night.beam = {
      x: b.x + Math.cos(b.heading) * 1.1,
      z: b.z - Math.sin(b.heading) * 1.1,
      heading: b.heading,
      on: true,
      y: b.y,
    };
    const { w, d } = this.data.size;
    const near: (Lamp & { d: number })[] = [];
    for (const l of this.data.lamps ?? []) {
      const x = l.x - w * Math.round((l.x - b.x) / w);
      const z = l.z - d * Math.round((l.z - b.z) / d);
      const dist = Math.hypot(x - b.x, z - b.z);
      if (dist < 70) near.push({ ...l, x, z, d: dist });
    }
    near.sort((a, c) => a.d - c.d);
    const lamps: Lamp[] = near.slice(0, 22);
    if (this.train) {
      // The train's headlamp: a pool on the line just ahead of it.
      const h = this.train.head();
      lamps.push({
        x: h.x + Math.sin(h.heading) * 2.2,
        y: 0.4,
        z: h.z + Math.cos(h.heading) * 2.2,
        r: 3.2,
        colour: [1, 0.96, 0.86],
      });
    }
    night.lamps = lamps;
  }

  /** Places the camera without easing (first frame). */
  snapCamera(): void {
    this.cam.snap(this.camera, this.follow(), (x, z) => this.ground.height(x, z));
  }

  update(dt: number, _t: number): void {
    if (!this.bike) return;
    this.t += dt;
    const b = this.bike;
    this.life?.update(b, dt, this.reduced);
    this.train?.update(this.reduced ? 0 : dt, b);
    // Anything moving you can bump into (a herd crossing the road).
    b.moving.length = 0;
    b.moving.push(...this.lifeSolid);
    if (this.train) b.moving.push(...this.train.solid);
    // Fixed-step physics.
    this.acc = Math.min(this.acc + dt, 0.25);
    const input = this.input(dt);
    this.throttle += (input.throttle - this.throttle) * Math.min(1, dt * 8);
    while (this.acc >= STEP) {
      this.prev = { x: b.x, z: b.z, y: b.y, heading: b.heading, lean: b.lean };
      if (this.glide) {
        // Gliding back onto the road: eased, the bike held level and still.
        const gl = this.glide;
        gl.t = Math.min(1, gl.t + STEP / 1.1);
        const f = gl.t * gl.t * (3 - 2 * gl.t);
        b.x = gl.x0 + (gl.x1 - gl.x0) * f;
        b.z = gl.z0 + (gl.z1 - gl.z0) * f;
        b.heading = gl.h0 + angleDelta(gl.h0, gl.h1) * f;
        b.y = this.ground.height(b.x, b.z);
        b.v = 0;
        b.vy = 0;
        b.air = false;
        if (gl.t >= 1) {
          this.glide = null;
          this.replans = 0;
          this.bestLeft = Number.POSITIVE_INFINITY;
        }
        this.acc -= STEP;
        continue;
      }
      b.step(input, STEP);
      // Wrapped round an edge: carry the camera, the dust and the in-between
      // frame along by the same jump, so nothing visibly moves.
      const jx = Math.round((b.x - this.prev.x) / this.data.size.w) * this.data.size.w;
      const jz = Math.round((b.z - this.prev.z) / this.data.size.d) * this.data.size.d;
      if (jx !== 0 || jz !== 0) {
        this.prev.x += jx;
        this.prev.z += jz;
        this.cam.shift(jx, jz);
        this.puffs.shift(jx, jz);
      }
      if (this.props) {
        // Shrubs, trees and rocks just ahead become bodies before you reach them.
        this.props.wakeNear(b.x, b.z, 3 + Math.abs(b.v) * 0.25);
        const fx = Math.cos(b.heading);
        const fz = -Math.sin(b.heading);
        const sx = Math.sin(b.heading);
        const sz = Math.cos(b.heading);
        const got = this.props.step({
          x: b.x,
          y: b.y,
          z: b.z,
          heading: b.heading,
          lean: b.lean,
          vx: fx * b.v + sx * b.slip,
          vz: fz * b.v + sz * b.slip,
        });
        // Momentum, both ways: what you hit took some of your speed (a pot
        // hardly any, a tree a lot). Knocks only ever slow you.
        const fwd = got.vx * fx + got.vz * fz;
        if (Math.abs(fwd) < Math.abs(b.v)) b.v = fwd;
        for (const kn of got.knocks) {
          this.sound.clang(kn.strength, kn.kind);
          if (kn.bike) this.rider.bump(kn.strength * Math.min(1, kn.mass / 120));
        }
      }
      // Down from a jump: always square on the wheels; a bounce in the forks and a thud.
      if (b.landed > 1.5) {
        this.rider.bump(Math.min(1, b.landed * 0.12));
        this.shake = Math.min(1, this.shake + b.landed * 0.03);
        this.sound.clang(Math.min(1, b.landed / 10), "soft");
      }
      if (b.impact > 1.5) {
        this.shake = Math.min(1, this.shake + b.impact * 0.08);
        this.rider.bump(b.impact * 0.25);
        this.sound.clang(Math.min(1, b.impact / 8), "wood");
      }
      this.acc -= STEP;
    }
    const k = this.acc / STEP;
    const s = {
      x: THREE.MathUtils.lerp(this.prev.x, b.x, k),
      z: THREE.MathUtils.lerp(this.prev.z, b.z, k),
      heading: this.prev.heading + angleDelta(this.prev.heading, b.heading) * k,
      lean: THREE.MathUtils.lerp(this.prev.lean, b.lean, k),
      v: b.v,
      steer: b.steerAngle,
      y: THREE.MathUtils.lerp(this.prev.y, b.y, k),
      air: b.air,
      vy: b.vy,
    };
    this.accel = THREE.MathUtils.lerp(this.accel, (b.v - this.lastV) / Math.max(dt, 1e-3), 0.2);
    this.lastV = b.v;
    this.rider.update(this.ground, s, this.accel, dt, this.reduced);
    if (this.riderShadow) {
      this.rider.root.updateMatrixWorld(true);
      this.riderShadow.update();
    }
    this.kickUp(s, dt);
    this.updateStops(dt);
    this.updateHud(dt);
    // Camera (follows the interpolated bike).
    const look = this.cam.update(
      this.camera,
      { ...this.follow(), x: s.x, z: s.z, heading: s.heading },
      (x, z) => this.ground.height(x, z),
      dt,
      this.reduced,
    );
    if (this.shake > 0.001 && !this.reduced) {
      this.camera.position.x += Math.sin(this.t * 47) * this.shake * 0.12;
      this.camera.position.y += Math.sin(this.t * 61) * this.shake * 0.09;
      this.shake *= Math.exp(-dt * 6);
    }
    this.sky?.position.copy(this.camera.position);
    // The sun's shadow follows you.
    const [sx, sy, sz] = LIGHTS[this.def.journey.mood].sunPos;
    this.sun.position.set(look.x + sx * 8, look.y + sy * 8, look.z + sz * 8);
    this.sun.target.position.copy(look);
    this.bushes?.update(b.x, b.z, dt, this.reduced);
    Bushes.lod(this.bushMeshes, this.camera.position);
    Grove.cull(this.groveMeshes, this.camera.position);
    this.clouds?.update(this.camera.position, look, dt);
    this.puffs.update(dt);
    this.props?.sync();
    this.live?.update(dt);
    if (this.meteors) {
      const tag = this.def.meteors?.near;
      const i = tag ? this.data.stops.findIndex((st) => st.tag === tag) : -1;
      const deck = this.stops[i];
      const shower = !!deck && Math.hypot(deck.x - b.x, deck.z - b.z) < 45;
      this.meteors.update(
        this.reduced ? 0 : dt,
        this.t - this.nightAt < 0.3 ? this.nightPhase : 0,
        this.camera,
        shower,
      );
    }
    this.brews = this.brews.filter((br) => {
      if (br.update(dt)) return true;
      br.group.removeFromParent();
      br.dispose();
      return false;
    });
    this.sound.engine(this.throttle, Math.abs(b.v), this.top, dt);
    // Save now and then (where you are, what you've found).
    this.saveIn -= dt;
    if (this.saveIn <= 0) {
      this.saveIn = 3;
      this.save();
    }
  }

  /** Dust off-road, spray through water. */
  private kickUp(s: { x: number; z: number; heading: number; v: number }, dt: number): void {
    const b = this.bike;
    const speed = Math.abs(s.v);
    if (speed < 2.5 || b.surface === "road") return;
    this.emitT += dt * speed * (b.surface === "water" ? 2.2 : 1.1);
    const fx = Math.cos(s.heading);
    const fz = -Math.sin(s.heading);
    const y = this.ground.height(s.x, s.z);
    while (this.emitT > 1) {
      this.emitT -= 1;
      const rx = s.x - fx * 1.05 + (Math.random() - 0.5) * 0.4;
      const rz = s.z - fz * 1.05 + (Math.random() - 0.5) * 0.4;
      if (b.surface === "water") {
        this.puffs.emit(
          rx,
          y + 0.2,
          rz,
          (Math.random() - 0.5) * 2 - fx * 1.5,
          2.5 + Math.random() * 2,
          (Math.random() - 0.5) * 2 - fz * 1.5,
          "#eaf7ff",
          0.35,
          0.7,
        );
      } else {
        this.puffs.emit(
          rx,
          y + 0.15,
          rz,
          (Math.random() - 0.5) * 1.2 - fx * speed * 0.15,
          0.6 + Math.random() * 0.6,
          (Math.random() - 0.5) * 1.2 - fz * speed * 0.15,
          Math.random() < 0.5 ? "#b9805a" : "#cfa57c",
          0.5,
          1.4,
        );
      }
    }
    if (b.surface === "water") this.sound.splash(Math.min(1, speed / 10));
  }

  private updateStops(dt: number): void {
    const s = ride.get();
    const b = this.bike;
    let near: number | null = null;
    let nd = NEAR;
    this.stops.forEach((m, i) => {
      const d = Math.hypot(m.park.x - b.x, m.park.z - b.z);
      if (d < nd) {
        nd = d;
        near = i;
      }
      // Pins bob gently; the ring on the road glows when you're close.
      if (!this.reduced) m.pin.position.y = m.y + 5.4 + Math.sin(this.t * 2 + i) * 0.25;
      const mat = m.ring.material as THREE.MeshBasicMaterial;
      const want = !m.ring.parent ? 0 : d < NEAR ? 0.75 : d < 26 ? 0.25 : 0;
      mat.opacity += (want - mat.opacity) * Math.min(1, dt * 5);
      m.ring.visible = mat.opacity > 0.01;
    });
    if (near !== s.near) ride.patch({ near });
    const nearLive = Boolean(this.live && this.near(this.live.group.position, 9));
    if (nearLive !== s.nearLive) ride.patch({ nearLive });
  }

  private updateHud(dt: number): void {
    this.hudIn -= dt;
    if (this.hudIn > 0) return;
    this.hudIn = 0.12;
    const kmh = Math.round(Math.abs(this.bike.v) * 3.6);
    if (kmh !== ride.get().kmh) ride.patch({ kmh });
    const live = this.live?.status;
    const cur = ride.get().live;
    if (live && (!cur || cur.ok !== live.ok || cur.ms !== live.ms))
      ride.patch({ live: { ...live } });
  }

  /** Leaves the world: the garage takes over. */
  /** The sky at the horizon (the veil's colour when handing over to and from the garage). */
  get tone(): string {
    const b = this.scene.background;
    return b instanceof THREE.Color ? `#${b.getHexString()}` : "#2b2723";
  }

  static leave(): void {
    leaveWorld();
  }
}
