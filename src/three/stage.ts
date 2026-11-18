/**
 * The stage: one WebGL renderer and frame loop for the whole site. Scenes plug
 * in through `StageScene`. The pixel ratio adapts to keep the frame rate
 * smooth on slower devices.
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { NightPass } from "./flat/night";
import { type Insets, type Layout, layoutFor } from "./layout";

export interface StageScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(dt: number, t: number): void;
  resize(layout: Layout): void;
  /** At dusk and night: where its lights are (the bike's beam, lamps, the moon). */
  lights?(night: NightPass): void;
}

/** Day to night (and back) takes this long. */
const DUSK = 5;

const MAX_DPR = 2;
const MIN_DPR = 1;

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly env: THREE.Texture;
  private active: StageScene | null = null;
  private raf = 0;
  private last = 0;
  private time = 0;
  private dpr: number;
  /** Frame-time watch for the pixel ratio: seconds of slow / comfortable frames, and a settling delay. */
  private slow = 0;
  private fast = 0;
  private settle = 2;
  private readonly ro: ResizeObserver;
  /** The night pass, and whether it's heading for night. */
  readonly night = new NightPass();
  private nightOn = false;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      // Draped shadows use the stencil (so overlapping shadows shade once, like cut paper).
      stencil: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.renderer.setPixelRatio(this.dpr);
    const canvas = this.renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "stage";
    host.prepend(canvas);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    if (new URLSearchParams(location.search).has("debug")) {
      (window as unknown as { __stage?: Stage }).__stage = this;
    }
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  private insets: Insets = {};

  layout(): Layout {
    return layoutFor(this.host.clientWidth || 1, this.host.clientHeight || 1, this.insets);
  }

  /** The UI reports what it really covers, so the camera frames the space that's left. */
  setInsets(i: Insets): void {
    if (i.right === this.insets.right && i.bottom === this.insets.bottom) return;
    this.insets = i;
    this.resize();
  }

  /**
   * Gets a scene's shaders compiled before it's shown (in the background where
   * the browser can), so the hand-over doesn't stall on the first frame.
   */
  async precompile(s: StageScene): Promise<void> {
    s.scene.environment = this.env;
    s.resize(this.layout());
    try {
      await this.renderer.compileAsync(s.scene, s.camera);
    } catch {
      // Not critical: it compiles on the first frame instead.
    }
  }

  /**
   * Draws a scene once, off screen, so its geometry and textures are already
   * on the GPU when it's shown (the first real frame doesn't stall on uploads).
   */
  warm(s: StageScene): void {
    const target = new THREE.WebGLRenderTarget(64, 64);
    const before = this.renderer.getRenderTarget();
    s.scene.environment = this.env;
    s.resize(this.layout());
    try {
      this.renderer.setRenderTarget(target);
      this.renderer.render(s.scene, s.camera);
    } finally {
      this.renderer.setRenderTarget(before);
      target.dispose();
    }
  }

  /** Day (false) or night (true): eases there over DUSK seconds, or at once. */
  setNight(on: boolean, instant = false): void {
    this.nightOn = on;
    if (instant) this.night.phase = on ? 1 : 0;
  }

  setScene(s: StageScene): void {
    this.active = s;
    // A new scene's first frames upload and compile: don't judge the frame rate by them.
    this.settle = 2;
    s.scene.environment = this.env;
    s.resize(this.layout());
  }

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      // Clamp dt so a background tab or a hitch never makes things jump.
      const raw = (now - this.last) / 1000;
      const dt = Math.min(0.05, raw);
      this.last = now;
      this.time += dt;
      this.adapt(raw);
      const s = this.active;
      if (!s) return;
      s.update(dt, this.time);
      const n = this.night;
      n.phase = Math.min(1, Math.max(0, n.phase + ((this.nightOn ? 1 : -1) * dt) / DUSK));
      if (n.active) {
        n.beam = null;
        n.lamps = [];
        n.moon = null;
        n.overlay = null;
        s.lights?.(n);
        n.render(this.renderer, s.scene, s.camera);
      } else this.renderer.render(s.scene, s.camera);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose(): void {
    this.stop();
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    // Remove the canvas too: a stale canvas left on top would swallow every pointer event.
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.active?.resize(this.layout());
  }

  /**
   * Keeps the frame rate smooth: drops the pixel ratio a step after about a
   * second of frames under ~50 fps, and climbs back after ~3 s of comfortable
   * ones. Loading (a new scene's first seconds) and one-off hitches (a long
   * frame on its own: a tab switch, a world being built) don't count, so they
   * can't leave the picture soft for good.
   */
  private adapt(rawDt: number): void {
    if (this.settle > 0) {
      this.settle -= Math.min(rawDt, 0.05);
      return;
    }
    if (rawDt > 0.1) return;
    if (rawDt > 1 / 50) this.slow += rawDt;
    else this.slow = Math.max(0, this.slow - rawDt * 0.5);
    if (rawDt < 1 / 58) this.fast += rawDt;
    else this.fast = Math.max(0, this.fast - rawDt * 2);
    const cap = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (this.slow > 1 && this.dpr > MIN_DPR) {
      this.setDpr(Math.max(MIN_DPR, this.dpr - 0.25));
      this.slow = 0;
      this.fast = 0;
      this.settle = 0.5;
    } else if (this.fast > 3 && this.dpr < cap) {
      this.setDpr(Math.min(cap, this.dpr + 0.25));
      this.fast = 0;
      this.settle = 0.5;
    }
  }

  private setDpr(d: number): void {
    this.dpr = d;
    this.renderer.setPixelRatio(d);
    this.resize();
  }
}
