/**
 * Living scenery for a ridden world.
 *
 * - Bushes: the coffee rows, split into spatial chunks so the camera only
 *   draws the nearby ones, at a lighter mesh. Bushes you ride into lean and
 *   squash out of your way, then spring slowly back.
 * - Clouds: low cloud puffs fade out of the way when they'd hide the bike.
 */

import * as THREE from "three";

const CHUNK = 44;
const REACH = 1.6;

interface Chunk {
  mesh: THREE.InstancedMesh;
  base: THREE.Matrix4[];
  pos: THREE.Vector3[];
}

interface Bent {
  chunk: number;
  i: number;
  bend: number;
  dx: number;
  dz: number;
}

export class Bushes {
  readonly group = new THREE.Group();
  /** Two levels of detail: round up close, a simple shape far away (where it's a speck). */
  static readonly near = new THREE.SphereGeometry(0.55, 8, 5);
  static readonly far = new THREE.IcosahedronGeometry(0.55, 0);
  private readonly chunks: Chunk[] = [];

  /**
   * Picks each chunk's detail by its distance from the camera, for every
   * bush chunk under `root` (the tile and its neighbouring copies).
   */
  static lod(meshes: THREE.InstancedMesh[], camera: THREE.Vector3): void {
    const c = new THREE.Vector3();
    for (const m of meshes) {
      const s = m.boundingSphere;
      if (!s) continue;
      c.copy(s.center).applyMatrix4(m.matrixWorld);
      const want = c.distanceTo(camera) - s.radius < 55 ? Bushes.near : Bushes.far;
      if (m.geometry !== want) m.geometry = want;
    }
  }
  private readonly grid = new Map<string, number>();
  private readonly bent = new Map<string, Bent>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly tmpQ = new THREE.Quaternion();

  constructor(source: THREE.InstancedMesh) {
    // A lighter bush than the design boards use: a fraction of the triangles,
    // and still round at gameplay distance.
    const geo = Bushes.near;
    const buckets = new Map<string, { m: THREE.Matrix4; c: THREE.Color }[]>();
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < source.count; i++) {
      source.getMatrixAt(i, m);
      const at = new THREE.Vector3().setFromMatrixPosition(m);
      if (source.instanceColor) source.getColorAt(i, c);
      else c.set("#26994f");
      const key = `${Math.floor(at.x / CHUNK)},${Math.floor(at.z / CHUNK)}`;
      let b = buckets.get(key);
      if (!b) {
        b = [];
        buckets.set(key, b);
      }
      b.push({ m: m.clone(), c: c.clone() });
    }
    for (const [key, list] of buckets) {
      const mesh = new THREE.InstancedMesh(geo, source.material, list.length);
      const chunk: Chunk = { mesh, base: [], pos: [] };
      list.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, it.c);
        chunk.base.push(it.m);
        chunk.pos.push(new THREE.Vector3().setFromMatrixPosition(it.m));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.userData.lod = true;
      this.grid.set(key, this.chunks.length);
      this.chunks.push(chunk);
      this.group.add(mesh);
    }
  }

  /** Bends bushes the bike is pushing through; lets the others spring back. */
  update(x: number, z: number, dt: number, reduced: boolean): void {
    if (reduced) return;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const touched = new Set<string>();
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const ci = this.grid.get(`${cx + a},${cz + b}`);
        if (ci === undefined) continue;
        const chunk = this.chunks[ci];
        if (!chunk) continue;
        chunk.pos.forEach((p, i) => {
          const dx = p.x - x;
          const dz = p.z - z;
          const d = Math.hypot(dx, dz);
          if (d > REACH) return;
          const key = `${ci}:${i}`;
          touched.add(key);
          const want = 1 - d / REACH;
          const cur = this.bent.get(key);
          const len = d || 1;
          if (cur) {
            cur.bend += (want - cur.bend) * Math.min(1, dt * 14);
            cur.dx = dx / len;
            cur.dz = dz / len;
          } else {
            this.bent.set(key, { chunk: ci, i, bend: want * 0.5, dx: dx / len, dz: dz / len });
          }
        });
      }
    }
    const dirty = new Set<number>();
    for (const [key, b] of this.bent) {
      if (!touched.has(key)) b.bend *= Math.exp(-dt * 2.5); // spring slowly back
      const chunk = this.chunks[b.chunk];
      const base = chunk?.base[b.i];
      if (!chunk || !base) continue;
      base.decompose(this.p, this.q, this.s);
      if (b.bend < 0.01) {
        chunk.mesh.setMatrixAt(b.i, base);
        this.bent.delete(key);
      } else {
        // Lean away from the bike (about a horizontal axis) and squash a little.
        this.axis.set(b.dz, 0, -b.dx).normalize();
        this.tmpQ.setFromAxisAngle(this.axis, b.bend * 0.85);
        this.p.x += b.dx * b.bend * 0.35;
        this.p.z += b.dz * b.bend * 0.35;
        this.p.y -= b.bend * 0.18;
        this.s.y *= 1 - b.bend * 0.35;
        this.m.compose(this.p, this.tmpQ.multiply(this.q), this.s);
        chunk.mesh.setMatrixAt(b.i, this.m);
      }
      dirty.add(b.chunk);
    }
    for (const ci of dirty) {
      const mesh = this.chunks[ci]?.mesh;
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

export class Clouds {
  readonly group = new THREE.Group();
  private readonly puffs: {
    obj: THREE.Object3D;
    mats: THREE.Material[];
    base: number;
    r: number;
    home: THREE.Vector3;
    phase: number;
  }[] = [];
  private clock = 0;
  private readonly line = new THREE.Line3();
  private readonly at = new THREE.Vector3();
  private readonly near = new THREE.Vector3();

  constructor(puffs: THREE.Object3D[]) {
    for (const obj of puffs) {
      const mats: THREE.Material[] = [];
      let r = 1;
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Each puff fades on its own, so it gets its own material.
        const mat = (mesh.material as THREE.Material).clone();
        mat.transparent = true;
        mat.depthWrite = false;
        mesh.material = mat;
        mats.push(mat);
        mesh.geometry.computeBoundingSphere();
        r = Math.max(r, mesh.geometry.boundingSphere?.radius ?? 1);
      });
      const base = (mats[0] as THREE.MeshLambertMaterial | undefined)?.opacity ?? 0.8;
      this.puffs.push({
        obj,
        mats,
        base,
        r,
        home: obj.position.clone(),
        phase: this.puffs.length * 1.7,
      });
      this.group.add(obj);
    }
  }

  /** Fades puffs that sit between the camera and what it's looking at. */
  update(camera: THREE.Vector3, look: THREE.Vector3, dt: number): void {
    this.line.set(camera, look);
    this.clock += dt;
    for (const p of this.puffs) {
      // Clouds drift on the breeze, wandering slowly round where they sit.
      const a = p.phase + this.clock * 0.02;
      p.obj.position.set(
        p.home.x + Math.cos(a) * 7 + Math.sin(this.clock * 0.013 + p.phase) * 4,
        p.home.y + Math.sin(a * 1.7) * 0.4,
        p.home.z + Math.sin(a) * 5,
      );
      p.obj.getWorldPosition(this.at);
      this.line.closestPointToPoint(this.at, true, this.near);
      const d = this.near.distanceTo(this.at);
      const clear = p.r + 5;
      const k = THREE.MathUtils.smoothstep(d, clear * 0.5, clear * 1.4);
      const want = p.base * (0.12 + 0.88 * k);
      for (const m of p.mats) m.opacity += (want - m.opacity) * Math.min(1, dt * 4);
    }
  }
}

/** How far each kind of plant is drawn (metres): small things vanish first. */
const GROVE_REACH: Record<string, number> = {
  flowers: 50,
  grass: 55,
  ber: 90,
  buckthorn: 70,
  apple: 110,
  willow: 130,
  poplar: 140,
  poplarGold: 140,
  pine: 160,
  deodar: 170,
  khejri: 150,
};

/**
 * Trees, orchards, scrub and flowers drawn as instanced meshes, split into
 * chunks so off-screen ones are skipped, and drawn only as far as they can be
 * seen (a flower tuft vanishes long before a deodar does).
 */
export class Grove {
  readonly group = new THREE.Group();

  constructor(source: THREE.InstancedMesh, size = 48) {
    const reach = GROVE_REACH[String(source.userData.flora)] ?? 150;
    const buckets = new Map<string, THREE.Matrix4[]>();
    const tints = new Map<string, THREE.Color[]>();
    const m = new THREE.Matrix4();
    const at = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < source.count; i++) {
      source.getMatrixAt(i, m);
      at.setFromMatrixPosition(m);
      const key = `${Math.floor(at.x / size)},${Math.floor(at.z / size)}`;
      let b = buckets.get(key);
      if (!b) {
        b = [];
        buckets.set(key, b);
      }
      b.push(m.clone());
      if (source.instanceColor) {
        source.getColorAt(i, c);
        const t = tints.get(key) ?? [];
        t.push(c.clone());
        tints.set(key, t);
      }
    }
    for (const [key, list] of buckets) {
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, list.length);
      const tint = tints.get(key);
      list.forEach((mm, i) => {
        mesh.setMatrixAt(i, mm);
        const col = tint?.[i];
        if (col) mesh.setColorAt(i, col);
      });
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.userData.reach = reach;
      this.group.add(mesh);
    }
  }

  /** Shows each chunk only while it's within its kind's reach of the camera. */
  static cull(meshes: THREE.InstancedMesh[], camera: THREE.Vector3): void {
    const c = new THREE.Vector3();
    for (const mesh of meshes) {
      const s = mesh.boundingSphere;
      if (!s) continue;
      c.copy(s.center).applyMatrix4(mesh.matrixWorld);
      mesh.visible = c.distanceTo(camera) - s.radius < (mesh.userData.reach as number);
    }
  }
}
