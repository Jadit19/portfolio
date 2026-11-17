/**
 * The road network as a graph, for cruise: points every couple of metres along
 * each road, linked along the road and wherever roads meet or cross. Finds
 * the shortest way along the roads from where you are to a stop.
 */

import type { Road } from "../lib/journey";

export interface Pt {
  x: number;
  z: number;
}

const SPACING = 2;

export class RoadGraph {
  readonly nodes: Pt[] = [];
  private readonly edges: { to: number; w: number }[][] = [];

  constructor(roads: { road: Road; closed?: boolean }[]) {
    const chains: number[][] = [];
    for (const { road, closed } of roads) {
      const n = Math.max(2, Math.round(road.length / SPACING));
      const ids: number[] = [];
      for (let i = 0; i <= n; i++) {
        if (closed && i === n) break;
        const p = road.at(i / n).p;
        ids.push(this.add({ x: p.x, z: p.z }));
      }
      for (let i = 1; i < ids.length; i++) this.link(ids[i - 1] ?? 0, ids[i] ?? 0);
      if (closed && ids.length > 2) this.link(ids[ids.length - 1] ?? 0, ids[0] ?? 0);
      chains.push(ids);
    }
    // Junctions and crossings: link close nodes that aren't neighbours on a road.
    const near = SPACING * 0.9;
    const chainOf = new Map<number, { c: number; i: number }>();
    chains.forEach((ids, c) => {
      ids.forEach((id, i) => {
        chainOf.set(id, { c, i });
      });
    });
    for (let a = 0; a < this.nodes.length; a++) {
      for (let b = a + 1; b < this.nodes.length; b++) {
        const pa = this.nodes[a];
        const pb = this.nodes[b];
        if (!pa || !pb) continue;
        if ((pa.x - pb.x) ** 2 + (pa.z - pb.z) ** 2 > near * near) continue;
        const ca = chainOf.get(a);
        const cb = chainOf.get(b);
        if (ca && cb && ca.c === cb.c) {
          const len = chains[ca.c]?.length ?? 0;
          const gap = Math.abs(ca.i - cb.i);
          if (Math.min(gap, len - gap) < 4) continue; // already neighbours along the road
        }
        this.link(a, b);
      }
    }
  }

  private add(p: Pt): number {
    this.nodes.push(p);
    this.edges.push([]);
    return this.nodes.length - 1;
  }

  private link(a: number, b: number): void {
    const pa = this.nodes[a];
    const pb = this.nodes[b];
    if (!pa || !pb) return;
    const w = Math.hypot(pa.x - pb.x, pa.z - pb.z);
    this.edges[a]?.push({ to: b, w });
    this.edges[b]?.push({ to: a, w });
  }

  nearest(x: number, z: number): number {
    let best = 0;
    let bd = Number.POSITIVE_INFINITY;
    this.nodes.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /**
   * Shortest route along the roads from (x, z) to (tx, tz). The route starts
   * with the nearest road point ahead of you (so you don't double back for a
   * point just behind) and ends at the target.
   */
  route(
    x: number,
    z: number,
    heading: number,
    tx: number,
    tz: number,
  ): { pts: Pt[]; length: number } {
    const goal = this.nearest(tx, tz);
    // Start from a few nearby nodes, preferring ones ahead of you.
    const fx = Math.cos(heading);
    const fz = -Math.sin(heading);
    const n = this.nodes.length;
    const dist = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
    const prev = new Int32Array(n).fill(-1);
    const open: number[] = [];
    this.nodes.forEach((p, i) => {
      const dx = p.x - x;
      const dz = p.z - z;
      const d = Math.hypot(dx, dz);
      if (d > 14) return;
      const behind = (dx * fx + dz * fz) / (d || 1) < -0.2 ? 6 : 0;
      dist[i] = d + behind;
      open.push(i);
    });
    if (!open.length) {
      const i = this.nearest(x, z);
      const p = this.nodes[i];
      dist[i] = p ? Math.hypot(p.x - x, p.z - z) : 0;
      open.push(i);
    }
    // Dijkstra (the graph is small: a few hundred nodes).
    const done = new Uint8Array(n);
    for (;;) {
      let u = -1;
      let best = Number.POSITIVE_INFINITY;
      for (const i of open) {
        const d = dist[i] ?? Number.POSITIVE_INFINITY;
        if (!done[i] && d < best) {
          best = d;
          u = i;
        }
      }
      if (u < 0 || u === goal) break;
      done[u] = 1;
      for (const e of this.edges[u] ?? []) {
        const nd = best + e.w;
        if (nd < (dist[e.to] ?? Number.POSITIVE_INFINITY)) {
          if (!Number.isFinite(dist[e.to] ?? Number.POSITIVE_INFINITY)) open.push(e.to);
          dist[e.to] = nd;
          prev[e.to] = u;
        }
      }
    }
    const pts: Pt[] = [];
    for (let i = goal; i >= 0; i = prev[i] ?? -1) {
      const p = this.nodes[i];
      if (p) pts.push(p);
      if (prev[i] === -1) break;
    }
    pts.reverse();
    pts.push({ x: tx, z: tz });
    return { pts, length: dist[goal] ?? 0 };
  }
}

/**
 * The fastest the bike can take a bend of radius R on its steering lock
 * (lock = 0.4 / (1 + 0.17·v), as in BikePhysics), with a margin for the
 * bars easing to it.
 */
function lockSpeed(R: number): number {
  const need = Math.atan(1.78 / Math.max(0.5, R)) * 1.25;
  return Math.max(0, (0.4 / need - 1) / 0.17);
}

/**
 * Pure pursuit along a polyline: where to aim, and how fast to go so corners
 * and the final stop come gently. Keeps its place along the route.
 */
export class Pilot {
  private i = 0;
  constructor(readonly pts: Pt[]) {}

  /** The route point it's heading for next, and the one after (for a heading). */
  ahead(): { at: Pt; then: Pt } | null {
    const at = this.pts[Math.min(this.pts.length - 1, this.i + 1)];
    const then = this.pts[Math.min(this.pts.length - 1, this.i + 2)];
    return at && then ? { at, then } : null;
  }

  /** Returns the heading to aim at, a target speed, and the distance left. */
  update(
    x: number,
    z: number,
    speed: number,
    top: number,
  ): { aim: number; want: number; left: number; reach: number } {
    // Keep our place: the nearest route point a little way ahead (never back),
    // so a wide line through a corner doesn't lose the route.
    let bi = this.i;
    let bd = Number.POSITIVE_INFINITY;
    for (let k = this.i; k < Math.min(this.pts.length, this.i + 14); k++) {
      const p = this.pts[k];
      if (!p) break;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) {
        bd = d;
        bi = k;
      }
    }
    this.i = bi;
    // Aim a short way ahead: far enough to be smooth, near enough not to cut
    // across the inside of a tight corner.
    const look = Math.min(12, 2.5 + speed * 0.6);
    let target = this.pts[this.pts.length - 1] ?? { x, z };
    let acc = 0;
    let px = x;
    let pz = z;
    for (let k = this.i; k < this.pts.length; k++) {
      const p = this.pts[k];
      if (!p) break;
      acc += Math.hypot(p.x - px, p.z - pz);
      px = p.x;
      pz = p.z;
      if (acc >= look) {
        target = p;
        break;
      }
    }
    // Distance left along the route.
    let left = 0;
    px = x;
    pz = z;
    for (let k = this.i; k < this.pts.length; k++) {
      const p = this.pts[k];
      if (!p) break;
      left += Math.hypot(p.x - px, p.z - pz);
      px = p.x;
      pz = p.z;
    }
    // Plan the speed for the road ahead: every bend has a speed it can be
    // taken at (v = √(a·R)), and we must be able to brake to it in time.
    const LAT = 4.5; // comfortable sideways acceleration, m/s²
    const DECEL = 4.5; // comfortable braking, m/s²
    const horizon = 12 + (speed * speed) / (2 * DECEL) + speed;
    let cornering = top * 0.85;
    let s0 = Math.hypot((this.pts[this.i]?.x ?? x) - x, (this.pts[this.i]?.z ?? z) - z);
    for (let k = this.i + 1; k < this.pts.length - 1 && s0 < horizon; k++) {
      const a = this.pts[k - 1];
      const b = this.pts[k];
      const c = this.pts[k + 1];
      if (!a || !b || !c) break;
      const l1 = Math.hypot(b.x - a.x, b.z - a.z);
      const l2 = Math.hypot(c.x - b.x, c.z - b.z);
      s0 += l1;
      if (l1 < 1e-3 || l2 < 1e-3) continue;
      const h1 = Math.atan2(b.z - a.z, b.x - a.x);
      const h2 = Math.atan2(c.z - b.z, c.x - b.x);
      let d = Math.abs(h2 - h1);
      if (d > Math.PI) d = Math.PI * 2 - d;
      // Curvature: turn per metre (short segments can't fake a hairpin).
      const k1 = d / Math.max(1.2, (l1 + l2) / 2);
      // Two limits: grip (√(a·R)), and the bike's steering lock, which
      // narrows with speed (see BikePhysics), so a tight bend needs a slow bike.
      const R = 1 / Math.max(k1, 1e-4);
      // (Below 2 m/s the rider paddles round, so the tightest junction is
      // still possible at a walking pace.)
      const vBend = Math.max(1.2, Math.min(Math.sqrt(LAT * R), lockSpeed(R)));
      cornering = Math.min(cornering, Math.sqrt(vBend * vBend + 2 * DECEL * Math.max(0, s0 - 1)));
    }
    // Stop smoothly at the end: v = sqrt(2·a·d) with a comfortable deceleration.
    const arriving = Math.sqrt(2 * 4 * Math.max(0, left - 1.5));
    // Close to the end, never so fast that the stop is inside our turning
    // circle (or we'd orbit it instead of pulling in).
    const end = this.pts[this.pts.length - 1];
    const straight = end ? Math.hypot(end.x - x, end.z - z) : 0;
    const approach = straight < 18 ? 1.6 + 0.4 * straight : Number.POSITIVE_INFINITY;
    return {
      aim: Math.atan2(-(target.z - z), target.x - x),
      reach: Math.max(1, Math.hypot(target.x - x, target.z - z)),
      want: Math.min(cornering, arriving, approach),
      left,
    };
  }
}

/**
 * Keeps a bike on the road without steering input (for riders who can't
 * steer, e.g. no motion access on a phone): finds where you are on the
 * nearest road and aims a little way along it in the direction you're
 * heading. It sticks to the road it's on, so junctions don't make it twitch.
 */
export class LaneKeeper {
  private readonly lines: { pts: Pt[]; closed: boolean }[];
  private current = -1;

  constructor(roads: { road: Road; closed?: boolean }[]) {
    this.lines = roads.map(({ road, closed }) => {
      const n = Math.max(8, Math.round(road.length / 1.5));
      const pts: Pt[] = [];
      for (let i = 0; i < (closed ? n : n + 1); i++) {
        const p = road.at(i / n).p;
        pts.push({ x: p.x, z: p.z });
      }
      return { pts, closed: Boolean(closed) };
    });
  }

  /**
   * The heading to aim at to follow the road ahead, and how much the road
   * bends over the next stretch (radians), so the caller can ease off for it.
   */
  aim(x: number, z: number, heading: number, speed: number): { aim: number; bend: number } {
    let best = { line: 0, i: 0, d: Number.POSITIVE_INFINITY };
    this.lines.forEach((l, li) => {
      l.pts.forEach((p, i) => {
        const d = Math.hypot(p.x - x, p.z - z) - (li === this.current ? 1.5 : 0);
        if (d < best.d) best = { line: li, i, d };
      });
    });
    this.current = best.line;
    const line = this.lines[best.line];
    if (!line) return { aim: heading, bend: 0 };
    const n = line.pts.length;
    const at = (i: number) =>
      line.pts[line.closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))] ?? { x, z };
    const a = at(best.i - 1);
    const b = at(best.i + 1);
    const fx = Math.cos(heading);
    const fz = -Math.sin(heading);
    const dir = (b.x - a.x) * fx + (b.z - a.z) * fz >= 0 ? 1 : -1;
    const steps = Math.ceil((2.5 + Math.abs(speed) * 0.35) / 1.5);
    const t = at(best.i + dir * steps);
    // How sharply the road turns over the next ~25 m.
    const h = (i: number) => {
      const p = at(i);
      const q = at(i + dir);
      return Math.atan2(q.z - p.z, q.x - p.x);
    };
    let bend = 0;
    for (let k = 0; k < 16; k++) {
      let d = Math.abs(h(best.i + dir * (k + 1)) - h(best.i + dir * k));
      if (d > Math.PI) d = Math.PI * 2 - d;
      bend += d;
    }
    return { aim: Math.atan2(-(t.z - z), t.x - x), bend };
  }
}
