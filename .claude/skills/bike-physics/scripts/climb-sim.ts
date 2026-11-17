/**
 * Rides one of the Ladakh world's roads with the real Ground + BikePhysics
 * (no Rapier, no blockers) and a pure-pursuit driver that brakes for bends.
 *
 *   ROAD=1 BEND=8 bun run .claude/skills/bike-physics/scripts/climb-sim.ts 0.95
 *   ROAD   road index (0 = north face pass road, 1 = south face)   default 1
 *   DOWN=1 ride from the road's start (the pass) down; default rides up
 *   BEND   speed (m/s) the driver takes bends at                    default 7
 *   arg    the world's feel.speed                                    default 0.95
 */
import * as THREE from "three";
import { type V2, makeRoad } from "../../../../src/three/lib/journey";
import { ladakhWorld } from "../../../../src/three/lib/ladakhWorld";
import { BikePhysics } from "../../../../src/three/world/bike";
import { Ground } from "../../../../src/three/world/ground";

const speed = Number(process.argv[2] ?? 0.95);
const feel = { top: 16 + speed * 12, accel: 3 + speed * 2.6, grip: 0.8 };
const bendSpeed = Number(process.env.BEND ?? 7);
const t = ladakhWorld({ edge: 3, colR: 34, stiltMinD: 45, fill: 0.75, follow: true, tidy: true });
const roads = t.roads.map((r) => ({
  road: makeRoad(r.pts.map((q) => [q[0], q[2]] as V2), t.heightAt, false, 4, 0),
  width: (r.half + (r.kind === "main" && r.stilt ? 1 : 0)) * 2,
}));
const ground = new Ground({
  ground: new THREE.Mesh(t.ground),
  size: { w: t.W, d: t.D },
  roads,
  water: [{ pts: t.river as V2[], width: t.riverHalf * 2 }],
});
const R0 = (t.roads[Number(process.env.ROAD ?? 1)] as (typeof t.roads)[number]).pts;
const pts = process.env.DOWN ? [...R0] : [...R0].reverse();
const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))] as [number, number, number];
const b = new BikePhysics(
  ground,
  [],
  feel,
  { x: P(0)[0], z: P(0)[2], heading: Math.atan2(-(P(3)[2] - P(0)[2]), P(3)[0] - P(0)[0]) },
  9,
  true,
  t.curbs,
);
const ahead = (from: number, m: number) => {
  let i = from;
  let acc = 0;
  while (i < pts.length - 1 && acc < m) {
    acc += Math.hypot(P(i + 1)[0] - P(i)[0], P(i + 1)[2] - P(i)[2]);
    i++;
  }
  return i;
};
let near = 0;
let time = 0;
let dist = 0;
let lx = b.x;
let lz = b.z;
const surf: Record<string, number> = {};
const off: string[] = [];
while (near < pts.length - 3 && time < 300) {
  let dmin = 1e9;
  for (let i = Math.max(0, near - 3); i < Math.min(pts.length, near + 8); i++) {
    const d = Math.hypot(P(i)[0] - b.x, P(i)[2] - b.z);
    if (d < dmin) {
      dmin = d;
      near = i;
    }
  }
  const q = P(ahead(near, 7));
  const q2 = P(ahead(ahead(near, 7), 10));
  const aim = Math.atan2(-(q[2] - b.z), q[0] - b.x);
  const turn = Math.abs(Math.atan2(-(q2[2] - q[2]), q2[0] - q[0]) - aim);
  const want = Math.min(turn, Math.PI * 2 - turn) > 0.5 ? bendSpeed : 99;
  const steer = b.steerToward(aim, 2.4);
  for (let k = 0; k < 12; k++)
    b.step({ throttle: b.v < want ? 1 : 0, brake: b.v > want + 1 ? 1 : 0, steer }, 1 / 120);
  time += 0.1;
  dist += Math.hypot(b.x - lx, b.z - lz);
  lx = b.x;
  lz = b.z;
  surf[b.surface] = (surf[b.surface] ?? 0) + 1;
  if (b.surface !== "road" && off.length < 15)
    off.push(
      `t${time.toFixed(1)} point ${near}: ${dmin.toFixed(1)} m from centre, v ${b.v.toFixed(1)}, bike y ${b.y.toFixed(1)} vs road ${P(near)[1].toFixed(1)}`,
    );
}
console.log(
  `${process.env.DOWN ? "descent" : "climb"}: ${time.toFixed(0)} s, ${dist.toFixed(0)} m, avg ${(dist / time).toFixed(1)} m/s, top ${feel.top.toFixed(1)}; surfaces ${JSON.stringify(surf)}; reached ${near}/${pts.length}`,
);
if (off.length) console.log(`left the road:\n  ${off.join("\n  ")}`);
