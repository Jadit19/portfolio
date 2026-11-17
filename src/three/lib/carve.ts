/**
 * Mountains carved into rock (the AstroClub look, Y2 on the design board):
 * a mountain's smooth form split along joints into blocks, each block a mesa
 * (a gently tilted, domed top; a rounded shoulder; a smooth flank), the rock
 * the highest of all the mesas at each point, so it is one continuous
 * surface with no torn edges; the high blocks level off into plateaus.
 * Everything wraps (the world is a torus), so cells near an edge are also
 * seen across it.
 */

import * as THREE from "three";

export interface CarveCell {
  x: number;
  z: number;
  /** Its top's height at its centre. */
  t: number;
  gx: number;
  gz: number;
  r: number;
  /** Its rock tone (0 low … 1 high). */
  f: number;
  /** Keeps a patch of snow on its top though it's a little below the snowline. */
  patch: boolean;
}

const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

export class Carving {
  readonly cells: CarveCell[] = [];
  private readonly bins = new Map<string, number[]>();
  private readonly BIN = 8;

  constructor(
    private readonly o: {
      env: (x: number, z: number) => number;
      top: number;
      W: number;
      D: number;
      /** Block size (m) low down and up high. */
      small: number;
      big: number;
      erode: number;
      /** Blocks above this share of `top` level off together (plateaus). */
      plateau: number;
      /** The snowline (for which blocks keep a patch). */
      snowline: number;
      rnd: () => number;
      /**
       * How round the ridges are where blocks meet (m), like a border radius: the rock
       * is the smooth maximum of the blocks (0 is the plain maximum: crisp creases).
       */
      edge?: number;
    },
  ) {
    const { W, D, rnd } = o;
    const tries = Math.round(((W * D) / (o.small * o.small)) * 2.2);
    for (let k = 0; k < tries; k++) {
      const x = -W / 2 + rnd() * W;
      const z = -D / 2 + rnd() * D;
      const E = o.env(x, z);
      if (E < 0.6) continue;
      const r = (o.small + (o.big - o.small) * Math.min(1, E / o.top)) * 0.5;
      if (this.nearest(x, z, (c) => Math.hypot(c.x - x, c.z - z) < (c.r + r) * 0.9)) continue;
      let t = E * (1 - o.erode * (0.3 + 0.7 * rnd()));
      if (E > o.top * o.plateau)
        t = o.top * o.plateau + (E - o.top * o.plateau) * 0.35 + rnd() * 0.8;
      const a = rnd() * Math.PI * 2;
      const tilt = 0.03 + 0.05 * rnd();
      const cell: CarveCell = {
        x,
        z,
        t: Math.max(0, t),
        gx: Math.cos(a) * tilt,
        gz: Math.sin(a) * tilt,
        r,
        f: Math.min(1, t / o.top),
        patch: t > o.snowline - 9 && t < o.snowline - 1 && rnd() < 0.3,
      };
      this.cells.push(cell);
      // Seen across the edges too (the world wraps).
      const i = this.cells.length - 1;
      for (const ox of [0, -W, W])
        for (const oz of [0, -D, D]) {
          const px = x + ox;
          const pz = z + oz;
          if (Math.abs(px) > W / 2 + 40 || Math.abs(pz) > D / 2 + 40) continue;
          const key = `${Math.floor(px / this.BIN)},${Math.floor(pz / this.BIN)}`;
          const l = this.bins.get(key) ?? [];
          l.push(i);
          this.bins.set(key, l);
          if (ox || oz) this.offsets.set(`${i}:${key}`, [ox, oz]);
        }
    }
  }

  /** For cells seen across an edge: their offset, by cell index and bin. */
  private readonly offsets = new Map<string, [number, number]>();

  private nearest(x: number, z: number, hit: (c: CarveCell) => boolean): boolean {
    const bx = Math.floor(x / this.BIN);
    const bz = Math.floor(z / this.BIN);
    for (let i = -3; i <= 3; i++)
      for (let j = -3; j <= 3; j++) {
        const key = `${bx + i},${bz + j}`;
        for (const ci of this.bins.get(key) ?? []) {
          const c = this.cells[ci] as CarveCell;
          const off = this.offsets.get(`${ci}:${key}`);
          if (hit(off ? { ...c, x: c.x + off[0], z: c.z + off[1] } : c)) return true;
        }
      }
    return false;
  }

  /**
   * The carved rock's height at (x, z) (0 where there's none) and the block it
   * belongs to. Each block is a mesa; the rock is the highest of them.
   */
  surface(x: number, z: number): { h: number; cell: CarveCell | null } {
    const bx = Math.floor(x / this.BIN);
    const bz = Math.floor(z / this.BIN);
    const near: { c: CarveCell; cx: number; cz: number; d2: number }[] = [];
    let d1 = 1e9;
    for (let i = -3; i <= 3; i++)
      for (let j = -3; j <= 3; j++) {
        const key = `${bx + i},${bz + j}`;
        for (const ci of this.bins.get(key) ?? []) {
          const c = this.cells[ci] as CarveCell;
          const off = this.offsets.get(`${ci}:${key}`);
          const cx = c.x + (off ? off[0] : 0);
          const cz = c.z + (off ? off[1] : 0);
          const d2 = (cx - x) ** 2 + (cz - z) ** 2;
          near.push({ c, cx, cz, d2 });
          if (d2 < d1) d1 = d2;
        }
      }
    if (!near.length) return { h: 0, cell: null };
    const reach = (Math.sqrt(d1) + 22) ** 2;
    let best = 0;
    let first = true;
    const k = this.o.edge ?? 0;
    let owner: CarveCell | null = null;
    let ownD = 1e9;
    const top = this.o.top;
    for (const a of near) {
      if (a.d2 > reach) continue;
      let e = 1e9;
      for (const b of near) {
        if (b === a || b.d2 > reach) continue;
        const sep = Math.hypot(b.cx - a.cx, b.cz - a.cz) || 1;
        e = Math.min(e, (b.d2 - a.d2) / (2 * sep));
      }
      const dx = x - a.cx;
      const dz = z - a.cz;
      const t = Math.max(0, a.c.t + a.c.gx * dx + a.c.gz * dz - 0.0035 * (dx * dx + dz * dz));
      const hi = THREE.MathUtils.smoothstep(a.c.t, top * 0.55, top * 0.85);
      const wIn = 1.3 + hi * 2.2;
      const wOut = 1.5 + t * 0.4;
      const u = Math.min(1, Math.max(0, (e + wOut) / (wIn + wOut)));
      const v = t * smoother(u);
      if (first) {
        best = v;
        first = false;
      } else if (k > 0) {
        // Smooth maximum: where two blocks meet, the crease is rounded over about k.
        const hk = Math.max(k - Math.abs(best - v), 0) / k;
        best = Math.max(best, v) + hk * hk * k * 0.25;
      } else if (v > best) best = v;
      if (a.d2 < ownD) {
        ownD = a.d2;
        owner = a.c;
      }
    }
    return { h: best, cell: owner };
  }
}

/**
 * Small blocks along a road's cut and fill, so the rock stays blocky right up
 * to the road: each a small, steep-shouldered mesa whose top follows the
 * slope the road leaves (above it, the cut; below, the fill).
 */
type FineCell = { x: number; z: number; t: number; gx: number; gz: number };

export class FineBlocks {
  private readonly cells: FineCell[] = [];
  private readonly bins = new Map<string, number[]>();
  private readonly B = 4;

  add(x: number, z: number, t: number, rnd: () => number): boolean {
    const r = 1.6 + rnd() * 0.8;
    const bx = Math.floor(x / this.B);
    const bz = Math.floor(z / this.B);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const fi of this.bins.get(`${bx + i},${bz + j}`) ?? []) {
          const f = this.cells[fi] as FineCell;
          if (Math.hypot(f.x - x, f.z - z) < r * 1.8) return false;
        }
    const a = rnd() * Math.PI * 2;
    this.cells.push({ x, z, t, gx: Math.cos(a) * 0.06, gz: Math.sin(a) * 0.06 });
    const key = `${bx},${bz}`;
    const l = this.bins.get(key) ?? [];
    l.push(this.cells.length - 1);
    this.bins.set(key, l);
    return true;
  }

  /** The highest small mesa at (x, z), or null where there are none. */
  at(x: number, z: number): number | null {
    const bx = Math.floor(x / this.B);
    const bz = Math.floor(z / this.B);
    const near: { f: FineCell; d2: number }[] = [];
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++)
        for (const fi of this.bins.get(`${bx + i},${bz + j}`) ?? []) {
          const f = this.cells[fi] as FineCell;
          near.push({ f, d2: (f.x - x) ** 2 + (f.z - z) ** 2 });
        }
    if (!near.length) return null;
    let best: number | null = null;
    for (const a of near) {
      if (a.d2 > 64) continue;
      let e = 1e9;
      for (const b of near) {
        if (b === a) continue;
        const sep = Math.hypot(b.f.x - a.f.x, b.f.z - a.f.z) || 1;
        e = Math.min(e, (b.d2 - a.d2) / (2 * sep));
      }
      const t = a.f.t + a.f.gx * (x - a.f.x) + a.f.gz * (z - a.f.z);
      const u = Math.min(1, Math.max(0, (e + 1.1) / 1.6));
      const v = t - Math.max(1.5, t * 0.08) * (1 - smoother(u));
      if (best === null || v > best) best = v;
    }
    return best;
  }
}
