/**
 * Day and night for the flat worlds and the yard. The clay toys ignore real
 * lights, so night is a repaint, done once over the whole frame:
 *
 *  - The scene is drawn (with its depth) into a buffer; one full-screen pass
 *    grades every pixel from day through golden hour and blue hour to the
 *    night palette (`phase` 0 → 1, eased over ~5 s by whoever drives it).
 *  - Light shows things in their true day colours: inside the bike's headlight
 *    cone (a soft white beam ~15 m ahead), and in warm pools round lamps,
 *    lanterns and lit windows, which come on one by one as dusk falls.
 *  - The paper shadows swing round to the moon (longer, from the other side).
 *  - Where the background shows (the yard), a full moon hangs in it.
 *
 * World positions come from the depth buffer, so the light works on anything
 * drawn: ground, roads, water, toys, the rider.
 */

import * as THREE from "three";
import { SUN } from "./kit";

export type NightName = "indigo" | "plum" | "navy";

/** How night repaints the day colours (in display space, 0–1). */
export interface NightGrade {
  /** Multiplies each channel. */
  mul: [number, number, number];
  /** Then adds (lifts the darks). */
  add: [number, number, number];
  /** Saturation (1 = as is). */
  sat: number;
  /** Contrast round mid-grey (1 = as is). */
  contrast: number;
}

/** The three night directions (see the design board). */
export const NIGHTS: Record<NightName, NightGrade> = {
  // Cool blue-violets, a dusty indigo ground, readable and calm.
  indigo: { mul: [0.44, 0.5, 0.82], add: [0.03, 0.04, 0.1], sat: 0.62, contrast: 0.95 },
  // Warmer ink-plum: mauve foliage, warm lights pop.
  plum: { mul: [0.58, 0.42, 0.66], add: [0.06, 0.03, 0.08], sat: 0.7, contrast: 0.92 },
  // Near-navy and high contrast: the moon and the lamps do the work.
  navy: { mul: [0.25, 0.32, 0.58], add: [0.01, 0.02, 0.06], sat: 0.55, contrast: 1.15 },
};

const DAY: NightGrade = { mul: [1, 1, 1], add: [0, 0, 0], sat: 1, contrast: 1 };
/** On the way: golden hour (warm, rich), then blue hour (cool, soft). */
const GOLDEN: NightGrade = {
  mul: [1.04, 0.91, 0.78],
  add: [0.03, 0.01, 0],
  sat: 1.06,
  contrast: 1.03,
};
const BLUE: NightGrade = {
  mul: [0.66, 0.68, 0.92],
  add: [0.02, 0.03, 0.08],
  sat: 0.78,
  contrast: 0.96,
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: NightGrade, b: NightGrade, t: number): NightGrade => ({
  mul: a.mul.map((v, i) => v + ((b.mul[i] as number) - v) * t) as [number, number, number],
  add: a.add.map((v, i) => v + ((b.add[i] as number) - v) * t) as [number, number, number],
  sat: a.sat + (b.sat - a.sat) * t,
  contrast: a.contrast + (b.contrast - a.contrast) * t,
});

/** The grade at a point of the transition (0 day, 0.35 golden, 0.68 blue hour, 1 night). */
export function gradeAt(phase: number, night: NightGrade): NightGrade {
  if (phase <= 0.35) return lerp(DAY, GOLDEN, smooth(0, 0.35, phase));
  if (phase <= 0.68) return lerp(GOLDEN, BLUE, smooth(0.35, 0.68, phase));
  return lerp(BLUE, night, smooth(0.68, 1, phase));
}

/** A lamp: where, how far its pool reaches, and its colour. */
export interface Lamp {
  x: number;
  y: number;
  z: number;
  r: number;
  colour?: [number, number, number];
}

const MAX_LAMPS = 24;
const DAY_SUN = SUN.clone();
/** The moon: from the other side, lower, so shadows fall longer. */
const MOON = new THREE.Vector3(0.5, 0.78, 0.4).normalize();
const WARM: [number, number, number] = [1.0, 0.82, 0.58];

export class NightPass {
  /** 0 day … 1 night. */
  phase = 0;
  night: NightGrade = NIGHTS.indigo;
  /** The headlight: the bike's position and heading (forward is (cos h, −sin h)). */
  beam: {
    x: number;
    z: number;
    heading: number;
    on: boolean;
    /** The ground's height under the bike (the beam lights what's near that, up a hill too). */
    y?: number;
  } | null = null;
  /** Lamps (the nearest are used); they light one by one as dusk falls. */
  lamps: Lamp[] = [];
  /** A full moon in the background (screen position 0–1 from the bottom left, radius as a share of the height). */
  moon: { u: number; v: number; r: number } | null = null;
  /** Drawn over the graded frame, ungraded (things that glow at night: stars, constellations). */
  overlay: THREE.Object3D | null = null;

  private readonly target: THREE.WebGLRenderTarget;
  private readonly quad: THREE.Mesh;
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mat: THREE.ShaderMaterial;
  private readonly u: {
    tColor: { value: THREE.Texture };
    tDepth: { value: THREE.Texture };
    uInvProj: { value: THREE.Matrix4 };
    uCamWorld: { value: THREE.Matrix4 };
    uMul: { value: THREE.Vector3 };
    uAdd: { value: THREE.Vector3 };
    uSat: { value: number };
    uContrast: { value: number };
    uDark: { value: number };
    uBeam: { value: THREE.Vector4 };
    uBeamY: { value: number };
    uBeamOn: { value: number };
    uLamps: { value: THREE.Vector4[] };
    uLampCols: { value: THREE.Vector4[] };
    uMoon: { value: THREE.Vector4 };
    uAspect: { value: number };
  };
  private readonly lampsU = Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4());
  private readonly colsU = Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4());

  constructor() {
    // Depth and stencil (draped shadows mark what they've shaded in the stencil).
    const depth = new THREE.DepthTexture(4, 4, THREE.UnsignedInt248Type);
    depth.format = THREE.DepthStencilFormat;
    this.target = new THREE.WebGLRenderTarget(4, 4, {
      depthTexture: depth,
      stencilBuffer: true,
      // On high-density screens the pixels are already fine enough; multisampling would
      // cost a colour and depth resolve every frame (heavy on phones) for little to see.
      samples: (window.devicePixelRatio || 1) >= 1.75 ? 0 : 4,
    });
    this.u = {
      tColor: { value: this.target.texture },
      tDepth: { value: this.target.depthTexture as THREE.Texture },
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uMul: { value: new THREE.Vector3(1, 1, 1) },
      uAdd: { value: new THREE.Vector3() },
      uSat: { value: 1 },
      uContrast: { value: 1 },
      uDark: { value: 0 },
      uBeam: { value: new THREE.Vector4() },
      uBeamY: { value: 0 },
      uBeamOn: { value: 0 },
      uLamps: { value: this.lampsU },
      uLampCols: { value: this.colsU },
      uMoon: { value: new THREE.Vector4() },
      uAspect: { value: 1 },
    };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        #define LAMPS ${MAX_LAMPS}
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform mat4 uInvProj;
        uniform mat4 uCamWorld;
        uniform vec3 uMul;
        uniform vec3 uAdd;
        uniform float uSat;
        uniform float uContrast;
        uniform float uDark;
        uniform vec4 uBeam;
        uniform float uBeamY;
        uniform float uBeamOn;
        uniform vec4 uLamps[LAMPS];
        uniform vec4 uLampCols[LAMPS];
        uniform vec4 uMoon;
        uniform float uAspect;
        varying vec2 vUv;

        vec3 toDisplay(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
        vec3 toLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }

        void main() {
          vec3 lin = texture2D(tColor, vUv).rgb;
          float depth = texture2D(tDepth, vUv).x;
          vec3 day = toDisplay(lin);
          // The grade: tint, lift, saturation, contrast.
          vec3 g = day * uMul + uAdd;
          float l = dot(g, vec3(0.299, 0.587, 0.114));
          g = mix(vec3(l), g, uSat);
          g = (g - 0.5) * uContrast + 0.5;
          vec3 col = g;
          if (depth < 0.9999) {
            vec4 ndc = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
            vec4 view = uInvProj * ndc;
            view /= view.w;
            vec3 w = (uCamWorld * view).xyz;
            // The headlight: a soft cone along the ground ahead of the bike.
            if (uBeamOn > 0.0) {
              vec2 rel = w.xz - uBeam.xy;
              vec2 dir = uBeam.zw;
              float along = dot(rel, dir);
              float across = length(rel - dir * along);
              float width = 0.7 + along * 0.32;
              float m = smoothstep(width, width * 0.45, across)
                * smoothstep(15.0, 8.0, along)
                * smoothstep(-0.2, 1.4, along)
                * smoothstep(3.2, 1.6, w.y - uBeamY);
              // (A touch under day, so the pale road reads as lit, not blown out.)
              col = mix(col, day * vec3(0.94, 0.95, 0.98), m * uBeamOn * 0.9);
            }
            // Lamps: warm pools of true colour.
            for (int i = 0; i < LAMPS; i++) {
              vec4 L = uLamps[i];
              if (L.w <= 0.0) continue;
              float d = length(w - L.xyz);
              float m = smoothstep(L.w, L.w * 0.25, d) * uLampCols[i].w;
              col = mix(col, day * uLampCols[i].rgb, m * 0.9);
            }
          }
          if (uMoon.z > 0.0 && uDark > 0.0) {
            // The full moon, with a soft glow, high in the corner of the view.
            vec2 p = vec2((vUv.x - uMoon.x) * uAspect, vUv.y - uMoon.y);
            float d = length(p);
            float disc = smoothstep(uMoon.z, uMoon.z * 0.96, d);
            float glow = smoothstep(uMoon.z * 3.2, uMoon.z, d) * 0.22;
            vec3 moon = vec3(0.98, 0.96, 0.88);
            col = mix(col, moon, (disc + glow * (1.0 - disc)) * uDark);
          }
          gl_FragColor = vec4(toLinear(col), 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
  }

  /** Whether the pass is needed at all (in full day it isn't). */
  get active(): boolean {
    return this.phase > 0.001;
  }

  /** Draws the scene through the grade (call instead of renderer.render when active). */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (this.target.width !== size.x || this.target.height !== size.y)
      this.target.setSize(size.x, size.y);
    this.update(camera, size.x / Math.max(1, size.y));
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.quad, this.cam);
    if (this.overlay) {
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(this.overlay, camera);
      renderer.autoClear = auto;
    }
  }

  private update(camera: THREE.Camera, aspect: number): void {
    const u = this.u;
    const p = this.phase;
    const g = gradeAt(p, this.night);
    u.uMul.value.set(...g.mul);
    u.uAdd.value.set(...g.add);
    u.uSat.value = g.sat;
    u.uContrast.value = g.contrast;
    u.uDark.value = smooth(0.6, 1, p);
    u.uAspect.value = aspect;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    // The headlight fades up through blue hour.
    const b = this.beam;
    u.uBeamOn.value = b?.on ? smooth(0.5, 0.9, p) : 0;
    if (b) {
      u.uBeam.value.set(b.x, b.z, Math.cos(b.heading), -Math.sin(b.heading));
      u.uBeamY.value = b.y ?? 0;
    }
    // Lamps come on one by one (each at its own moment of dusk).
    for (let i = 0; i < MAX_LAMPS; i++) {
      const L = this.lamps[i];
      const at = this.lampsU[i] as THREE.Vector4;
      const col = this.colsU[i] as THREE.Vector4;
      if (!L) {
        at.w = 0;
        continue;
      }
      const when =
        0.5 + ((((Math.sin(L.x * 12.9898 + L.z * 78.233) * 43758.5453) % 1) + 1) % 1) * 0.3;
      const on = smooth(when, when + 0.06, p);
      at.set(L.x, L.y, L.z, on > 0 ? L.r : 0);
      const c = L.colour ?? WARM;
      col.set(c[0], c[1], c[2], on);
    }
    const m = this.moon;
    u.uMoon.value.set(m?.u ?? 0, m?.v ?? 0, m ? m.r : 0, 0);
    // Shadows swing round to the moon as night falls.
    SUN.copy(DAY_SUN)
      .lerp(MOON, smooth(0.45, 0.85, p))
      .normalize();
  }

  dispose(): void {
    this.target.dispose();
    this.mat.dispose();
    this.quad.geometry.dispose();
    SUN.copy(DAY_SUN);
  }
}
