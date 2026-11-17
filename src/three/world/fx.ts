/**
 * Small particle effects for riding: dust kicked up off-road and splashes
 * through water. One draw call: soft round points with their own size,
 * colour and fade, recycled from a fixed pool.
 */

import * as THREE from "three";

const MAX = 260;

export class Puffs {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly col = new Float32Array(MAX * 3);
  private readonly life = new Float32Array(MAX);
  private readonly age = new Float32Array(MAX);
  private readonly size = new Float32Array(MAX);
  private readonly alpha = new Float32Array(MAX);
  private next = 0;
  private readonly c = new THREE.Color();

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { scale: { value: 600 } },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        uniform float scale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.2, d) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }

  /** Points scale with the canvas height so they look the same on every screen. */
  setViewport(height: number, fovDeg: number): void {
    const m = this.points.material as THREE.ShaderMaterial;
    const u = m.uniforms.scale;
    if (u) u.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  /** One particle at (x, y, z) drifting with velocity v; colour as a hex string. */
  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colour: string,
    size: number,
    life: number,
  ): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.c.set(colour);
    this.col.set([this.c.r, this.c.g, this.c.b], i * 3);
    this.life[i] = life;
    this.age[i] = 0;
    this.size[i] = size;
  }

  /** Moves every particle (the world wrapping round under them). */
  shift(dx: number, dz: number): void {
    for (let i = 0; i < MAX; i++) {
      this.pos[i * 3] = (this.pos[i * 3] ?? 0) + dx;
      this.pos[i * 3 + 2] = (this.pos[i * 3 + 2] ?? 0) + dz;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      const life = this.life[i] ?? 0;
      if (life <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      const age = (this.age[i] ?? 0) + dt;
      this.age[i] = age;
      const k = age / life;
      if (k >= 1) {
        this.life[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      const j = i * 3;
      const drag = Math.exp(-dt * 2.2);
      for (let a = 0; a < 3; a++) {
        const v = (this.vel[j + a] ?? 0) * drag;
        this.vel[j + a] = v;
        this.pos[j + a] = (this.pos[j + a] ?? 0) + v * dt;
      }
      // Dust settles slowly; splash drops fall.
      this.vel[j + 1] = (this.vel[j + 1] ?? 0) - dt * 1.2;
      this.size[i] = (this.size[i] ?? 0) * (1 + dt * 0.9);
      // Fade in quickly, out slowly.
      this.alpha[i] = Math.min(1, k * 8) * (1 - k) * 0.55;
    }
    const g = this.points.geometry;
    for (const name of ["position", "color", "size", "alpha"]) {
      const attr = g.getAttribute(name);
      if (attr) attr.needsUpdate = true;
    }
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
