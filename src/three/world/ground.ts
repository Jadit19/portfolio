/**
 * Fast ground lookups for riding: the terrain's height (bilinear on its own
 * grid, no raycasts) and what the surface is (road, estate, water), baked
 * once into a coarse grid when the world loads.
 */

import type * as THREE from "three";
import type { Ramp, V2, WorldData } from "../lib/journey";

export type Surface = "road" | "ground" | "water";

/** Distance from (x, z) to a polyline. */
export function polyDist(pts: readonly V2[], x: number, z: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    const abx = b[0] - a[0];
    const abz = b[1] - a[1];
    const l2 = abx * abx + abz * abz || 1;
    const t = Math.min(1, Math.max(0, ((x - a[0]) * abx + (z - a[1]) * abz) / l2));
    best = Math.min(best, Math.hypot(a[0] + abx * t - x, a[1] + abz * t - z));
  }
  return best;
}

export class Ground {
  readonly w: number;
  readonly d: number;
  private readonly sx: number;
  private readonly sz: number;
  private readonly ys: Float32Array;
  /** Surface grid: 0 ground, 1 road, 2 water; one cell per CELL units. */
  private readonly kind: Uint8Array;
  private readonly cw: number;
  private readonly cd: number;
  static readonly CELL = 0.5;
  /** Ramps on the ground (their height adds to the terrain's). */
  private readonly ramps: readonly Ramp[];

  constructor(world: Pick<WorldData, "ground" | "size" | "roads" | "water" | "decks" | "ramps">) {
    this.ramps = world.ramps ?? [];
    this.w = world.size.w;
    this.d = world.size.d;
    const geo = world.ground.geometry as THREE.PlaneGeometry;
    const { widthSegments, heightSegments } = geo.parameters;
    this.sx = widthSegments;
    this.sz = heightSegments;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    this.ys = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) this.ys[i] = pos.getY(i);
    // Surfaces, baked at CELL resolution.
    const C = Ground.CELL;
    this.cw = Math.ceil(this.w / C);
    this.cd = Math.ceil(this.d / C);
    this.kind = new Uint8Array(this.cw * this.cd);
    // Each road and stream segment stamps the cells it covers (much faster
    // than measuring every cell against every segment). Water first, then
    // roads over it: a road (a bridge, a ford) wins where they meet.
    const cw = this.cw;
    const cd = this.cd;
    const w = this.w;
    const d = this.d;
    const stamp = (pts: readonly V2[], half: number, k: number, wrap: boolean) => {
      for (let n = 0; n < pts.length - 1; n++) {
        const a = pts[n];
        const b = pts[n + 1];
        if (!a || !b) continue;
        const abx = b[0] - a[0];
        const abz = b[1] - a[1];
        const l2 = abx * abx + abz * abz || 1;
        const i0 = Math.floor((Math.min(a[0], b[0]) - half + w / 2) / C - 0.5);
        const i1 = Math.ceil((Math.max(a[0], b[0]) + half + w / 2) / C - 0.5);
        const j0 = Math.floor((Math.min(a[1], b[1]) - half + d / 2) / C - 0.5);
        const j1 = Math.ceil((Math.max(a[1], b[1]) + half + d / 2) / C - 0.5);
        for (let j = j0; j <= j1; j++) {
          const z = -d / 2 + (j + 0.5) * C;
          let jj = j;
          if (wrap) jj = ((j % cd) + cd) % cd;
          else if (j < 0 || j >= cd) continue;
          for (let i = i0; i <= i1; i++) {
            let ii = i;
            if (wrap) ii = ((i % cw) + cw) % cw;
            else if (i < 0 || i >= cw) continue;
            const x = -w / 2 + (i + 0.5) * C;
            const t = Math.min(1, Math.max(0, ((x - a[0]) * abx + (z - a[1]) * abz) / l2));
            const dist = Math.hypot(a[0] + abx * t - x, a[1] + abz * t - z);
            if (dist < half) this.kind[jj * cw + ii] = k;
          }
        }
      }
    };
    // Water may run across an edge (the world wraps), so it stamps round it.
    for (const wt of world.water) stamp(wt.pts, wt.width / 2, 2, true);
    for (const r of world.roads)
      stamp(
        r.road.samples.map((q) => [q.x, q.z] as V2),
        r.width / 2 + 0.35,
        1,
        false,
      );
    // Bridge decks are road, over whatever water runs underneath.
    for (const dk of world.decks ?? []) stamp(dk.pts, dk.width / 2, 1, true);
  }

  /** On a launching ramp (a wedge, not a bridge's hump) at (x, z)? */
  onWedge(px: number, pz: number): boolean {
    const x = this.wrapX(px);
    const z = this.wrapZ(pz);
    for (const r of this.ramps) {
      if (r.hump) continue;
      const dx = x - r.x;
      const dz = z - r.z;
      const s = Math.sin(r.yaw);
      const c = Math.cos(r.yaw);
      if (Math.abs(dx * c - dz * s) <= r.w / 2 && Math.abs(dx * s + dz * c) <= r.len / 2)
        return true;
    }
    return false;
  }

  /** How high a ramp lifts the ground at (x, z), in the tile (0 off every ramp). */
  rampHeight(x: number, z: number): number {
    let best = 0;
    for (const r of this.ramps) {
      const dx = x - r.x;
      const dz = z - r.z;
      if (dx * dx + dz * dz > (r.len * r.len + r.w * r.w) / 4) continue;
      const s = Math.sin(r.yaw);
      const c = Math.cos(r.yaw);
      // Local: +z up the slope, x across.
      const lz = dx * s + dz * c;
      const lx = dx * c - dz * s;
      if (Math.abs(lx) > r.w / 2 || Math.abs(lz) > r.len / 2) continue;
      const u = (2 * lz) / r.len;
      best = Math.max(best, r.hump ? r.hump.base + r.h * (1 - u * u) : r.h * (u / 2 + 0.5));
    }
    return best;
  }

  /** Brings any point into the tile: the world wraps round (east meets west). */
  wrapX(x: number): number {
    return x - this.w * Math.floor((x + this.w / 2) / this.w);
  }

  wrapZ(z: number): number {
    return z - this.d * Math.floor((z + this.d / 2) / this.d);
  }

  /** Terrain height at (x, z); the world wraps, so any point has ground. */
  height(px: number, pz: number): number {
    const x = this.wrapX(px);
    const z = this.wrapZ(pz);
    const fx = Math.min(this.sx, Math.max(0, ((x + this.w / 2) / this.w) * this.sx));
    const fz = Math.min(this.sz, Math.max(0, ((z + this.d / 2) / this.d) * this.sz));
    const ix = Math.min(this.sx - 1, Math.floor(fx));
    const iz = Math.min(this.sz - 1, Math.floor(fz));
    const tx = fx - ix;
    const tz = fz - iz;
    const row = this.sx + 1;
    const a = this.ys[iz * row + ix] ?? 0;
    const b = this.ys[iz * row + ix + 1] ?? 0;
    const c = this.ys[(iz + 1) * row + ix] ?? 0;
    const e = this.ys[(iz + 1) * row + ix + 1] ?? 0;
    const terrain = (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
    return this.ramps.length ? terrain + this.rampHeight(x, z) : terrain;
  }

  surface(px: number, pz: number): Surface {
    const x = this.wrapX(px);
    const z = this.wrapZ(pz);
    const C = Ground.CELL;
    const i = Math.floor((x + this.w / 2) / C);
    const j = Math.floor((z + this.d / 2) / C);
    if (i < 0 || j < 0 || i >= this.cw || j >= this.cd) return "ground";
    const k = this.kind[j * this.cw + i];
    return k === 1 ? "road" : k === 2 ? "water" : "ground";
  }
}
