/**
 * Meteors at night (AstroClub): now and then a shooting star streaks across
 * the sky in front of you, a bright head trailing a fading tail. Near the
 * meteor deck it's a shower: one every second or so. Drawn ungraded, over
 * the night (the night pass's overlay), so they glow.
 */

import * as THREE from "three";

interface Streak {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  from: THREE.Vector3;
  dir: THREE.Vector3;
  t: number;
  life: number;
}

/** A thin wedge: bright at the head (x = 0), fading to nothing along the tail (+x). */
function streakGeometry(len: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const w = 0.09;
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, w, 0, 0, -w, 0, len, 0, 0, -0.12, 0, 0], 3),
  );
  g.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      [1, 0.98, 0.9, 1, 1, 0.98, 0.9, 1, 0.75, 0.85, 1, 0, 1, 1, 1, 1],
      4,
    ),
  );
  g.setIndex([0, 1, 2, 3, 1, 0]);
  return g;
}

export class Meteors {
  readonly group = new THREE.Group();
  private readonly live: Streak[] = [];
  private wait = 2;
  private readonly geo = streakGeometry(7);

  /** `night` 0–1; `shower`: near the deck (meteors come thick and fast). */
  update(dt: number, night: number, camera: THREE.Camera, shower: boolean): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i] as Streak;
      s.t += dt;
      const k = s.t / s.life;
      if (k >= 1) {
        this.group.remove(s.mesh);
        s.mat.dispose();
        this.live.splice(i, 1);
        continue;
      }
      s.mesh.position.copy(s.from).addScaledVector(s.dir, k * 26);
      // Flares up, then burns out.
      s.mat.opacity = Math.sin(Math.PI * Math.min(1, k * 1.15)) * night;
    }
    if (night < 0.7) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = shower ? 0.5 + Math.random() * 1.1 : 3 + Math.random() * 6;
    // Somewhere in view, high over the land, falling across and down the frame.
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const from = camera.position
      .clone()
      .addScaledVector(fwd, 30 + Math.random() * 10)
      .addScaledVector(right, (Math.random() - 0.5) * 30)
      .addScaledVector(up, 6 + Math.random() * 6);
    const side = Math.random() < 0.5 ? -1 : 1;
    const dir = right
      .clone()
      .multiplyScalar(side)
      .addScaledVector(up, -0.55 - Math.random() * 0.3)
      .normalize();
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    // The tail points back along where it came from, lying in the view plane.
    const back = dir.clone().negate();
    const normal = fwd.clone().negate();
    const y = new THREE.Vector3().crossVectors(normal, back).normalize();
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(back, y, normal));
    mesh.position.copy(from);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.live.push({ mesh, mat, from, dir, t: 0, life: 0.7 + Math.random() * 0.4 });
  }

  dispose(): void {
    for (const s of this.live) s.mat.dispose();
    this.live.length = 0;
    this.geo.dispose();
    this.group.clear();
  }
}
