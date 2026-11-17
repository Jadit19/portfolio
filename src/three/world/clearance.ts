/**
 * Keeps a world's roads clear, for every journey: nothing (a building, a
 * stall, a parked jeep, a waterfall, a sign) may reach onto a road or its
 * verge. Anything that does is nudged straight off, away from the road, and
 * set back down on the ground. Things meant to cross a road (bridges, arches,
 * plazas: `userData.spansRoad`) and things up in the air are left alone.
 *
 * It checks real geometry (a sample of each object's vertices near the
 * ground), not bounding boxes, so a building beside a bend isn't moved just
 * because its box clips the curve.
 */

import * as THREE from "three";
import { polylineIndex, type V2, type WorldData } from "../lib/journey";

/** Clear space beyond the road's edge (the verge), metres. */
const VERGE = 0.6;

/** Ground-level points of an object (world space), sampled from its meshes. */
function footprint(o: THREE.Object3D, ground: (x: number, z: number) => number): V2[] {
  const out: V2[] = [];
  const v = new THREE.Vector3();
  o.updateWorldMatrix(true, true);
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 300));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      // Roofs and branches above head height may overhang; anything lower may not.
      if (v.y - ground(v.x, v.z) < 3.2) out.push([v.x, v.z]);
    }
  });
  return out;
}

/** One object moved off a road: where it stood (its ground footprint) and by how much. */
export interface Nudge {
  from: { minX: number; maxX: number; minZ: number; maxZ: number };
  dx: number;
  dz: number;
}

/**
 * Nudges anything that reaches onto a road off it, and returns the moves so
 * the world can move what goes with them (its solid outline, a stop, a
 * landmark).
 */
export function keepRoadsClear(
  root: THREE.Object3D,
  data: WorldData,
  ground: (x: number, z: number) => number,
): Nudge[] {
  const corridors = data.roads.map((r) => {
    const half = r.width / 2 + 0.25 + VERGE;
    return {
      half,
      // Footprint points only matter inside the corridor; the quick reject
      // looks a little further (up to half the largest object we check).
      inside: polylineIndex(r.road.samples, half),
      around: polylineIndex(r.road.samples, half + 22),
    };
  });
  const moved: Nudge[] = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const mid = new THREE.Vector3();
  for (const o of [...root.children]) {
    if (o.userData.spansRoad || (o as THREE.Light).isLight) continue;
    box.setFromObject(o);
    if (box.isEmpty()) continue;
    box.getSize(size);
    box.getCenter(mid);
    // The land, water and the roads themselves span the world; leave them.
    if (Math.max(size.x, size.z) > 30) continue;
    // Up in the air (mist, drizzle, butterflies) can't block a road.
    if (box.min.y > ground(mid.x, mid.z) + 1) continue;
    // Quick reject: nowhere near any road.
    const reach = Math.hypot(size.x, size.z) / 2;
    if (corridors.every((c) => (c.around(mid.x, mid.z)?.d ?? Infinity) > c.half + reach)) continue;
    const from = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
    const x0 = o.position.x;
    const z0 = o.position.z;
    for (let round = 0; round < 6; round++) {
      // The deepest point of the object inside any road corridor.
      let worst = { over: 0, px: 0, pz: 0 };
      for (const [x, z] of footprint(o, ground)) {
        for (const c of corridors) {
          const n = c.inside(x, z);
          if (!n) continue;
          const over = c.half - n.d;
          if (over > worst.over) worst = { over, px: n.px, pz: n.pz };
        }
      }
      if (worst.over <= 0.01) break;
      // Push straight away from the road, past the verge.
      box.setFromObject(o);
      box.getCenter(mid);
      let dx = mid.x - worst.px;
      let dz = mid.z - worst.pz;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const step = worst.over + 0.15;
      const before = ground(o.position.x, o.position.z);
      o.position.x += dx * step;
      o.position.z += dz * step;
      // Set it back down on the ground where it now stands.
      o.position.y += ground(o.position.x, o.position.z) - before;
    }
    const dx = o.position.x - x0;
    const dz = o.position.z - z0;
    if (dx !== 0 || dz !== 0) moved.push({ from, dx, dz });
  }
  return moved;
}

/**
 * Solid outlines for a world's scenery, worked out from the objects
 * themselves (for worlds that don't list them by hand): anything standing
 * taller than knee height gets circles along its footprint, so a long mani
 * wall becomes a chain of circles and a hut a single one. Flat things, roads,
 * anything up in the air, and land-sized pieces are skipped.
 */
export function solidOutlines(
  root: THREE.Object3D,
  ground: (x: number, z: number) => number,
): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const saved = new THREE.Quaternion();
  const euler = new THREE.Euler();
  for (const o of root.children) {
    if (o.userData.spansRoad || (o as THREE.Light).isLight || (o as THREE.Sprite).isSprite)
      continue;
    // Measure it in its own frame (unturned), so a wall at an angle stays a wall.
    saved.copy(o.quaternion);
    const yaw = euler.setFromQuaternion(o.quaternion, "YXZ").y;
    o.quaternion.identity();
    o.updateMatrixWorld(true);
    box.setFromObject(o);
    o.quaternion.copy(saved);
    o.updateMatrixWorld(true);
    if (box.isEmpty()) continue;
    box.getSize(size);
    box.getCenter(mid);
    if (Math.max(size.x, size.z) > 24) continue;
    // The centre, turned back round the object's own position.
    const cx =
      o.position.x +
      (mid.x - o.position.x) * Math.cos(yaw) +
      (mid.z - o.position.z) * Math.sin(yaw);
    const cz =
      o.position.z -
      (mid.x - o.position.x) * Math.sin(yaw) +
      (mid.z - o.position.z) * Math.cos(yaw);
    const g = ground(cx, cz);
    // Knee height or lower (fields, rugs, low kerbs) and things in the air don't block.
    if (box.max.y - g < 0.7 || box.min.y > g + 1.2) continue;
    // Circles along the long side, each as wide as the short side.
    const long = Math.max(size.x, size.z);
    const short = Math.max(0.4, Math.min(size.x, size.z));
    const n = Math.max(1, Math.round(long / short));
    const alongX = size.x >= size.z;
    // The long axis in the world: local x or z, turned by the yaw.
    const ax = alongX ? Math.cos(yaw) : Math.sin(yaw);
    const az = alongX ? -Math.sin(yaw) : Math.cos(yaw);
    for (let k = 0; k < n; k++) {
      const f = n === 1 ? 0 : (k / (n - 1) - 0.5) * (long - short);
      out.push({ x: cx + ax * f, z: cz + az * f, r: (short / 2) * 0.85 });
    }
  }
  return out;
}
