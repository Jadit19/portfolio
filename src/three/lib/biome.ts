/**
 * Biome scattering: how the toys are sprinkled over a world, after the way
 * Minecraft dresses its land. Two slow noise fields (heat, wet) pick a biome
 * for every spot; each biome lists what grows there in layers, placed in a
 * fixed order so the big things claim room first:
 *
 *   hamlet    a few buildings and props on the road side, at given anchors
 *   landmark  a rare hero piece (a banyan), one in a big neighbourhood
 *   planted   things people planted, in rows (a coffee estate)
 *   canopy    trees, gated by a grove noise so they come in groves and clearings
 *   under     bushes, drawn to the feet of trees and to the road verge
 *   cover     ground cover in patches: one species and one colour per patch
 *   accent    rocks and odd bits, rare, sometimes in pairs
 *
 * Every piece keeps its own footprint clear, so nothing intersects, and every
 * layer keeps its distance from roads and stops. The bare ground between
 * groves is deliberate: the world should feel lived in, never crowded.
 *
 * With `wrap`, the bounds are one tile of a world that loops round (ride off
 * an edge, come back in at the other): every noise field repeats exactly once
 * per tile, pieces placed near an edge wrap to the other side, and spacing is
 * measured the short way round, so groves, biomes and patches run straight
 * across the seam. (Planted rows are laid per tile; an angled row grid can
 * meet itself at the seam with a small gap, never an overlap.)
 *
 * Pure and deterministic (same seed, same world); no Three.js here.
 */

export type LayerKind = "landmark" | "planted" | "canopy" | "under" | "cover" | "accent";

export interface Species {
  /** The toy's id (e.g. "T1"), plus an optional colour variant name. */
  id: string;
  tint?: string;
  weight?: number;
  /** Scale range. */
  scale?: [number, number];
}

export interface Layer {
  species: Species[];
  /** Chance a candidate spot is used (0–1), before the masks. */
  density: number;
  /** 0: spread evenly; 1: tightly in groves with open ground between. */
  clump?: number;
  /** Size of a grove (m). */
  grove?: number;
  /** Clear distance from roads and stops (m). */
  keep?: number;
  /** A band beyond `keep` where this layer grows thicker (a verge), and how much. */
  verge?: [number, number];
  /** Grows more near trees: [radius, boost]; elsewhere it thins. */
  nearTrees?: [number, number];
  /** Cover only: items per patch and the patch radius. */
  patch?: [number, number, number];
  /** Accent only: chance of a smaller partner beside it. */
  pair?: number;
  /** Pieces on the verge turn to run along the road (hedges, fences). */
  alignVerge?: boolean;
  /** Planted only: spacing along a row, between rows, and the row angle. */
  rows?: [number, number, number];
  /**
   * Planted only: rows follow the lie of the land instead of a ruler. They
   * sway sideways by up to `amp` m over `length` m (all together, like
   * contour lines), each plant is nudged by `jitter` m, and `gaps` (0–1) of
   * the field is left as breaks and clearings.
   */
  natural?: { amp: number; length: number; jitter: number; gaps: number };
}

export interface Hamlet {
  buildings: Species[];
  props: Species[];
}

export interface Biome {
  id: string;
  /** Where it sits in climate space: [heat, wet], 0–1. */
  climate: [number, number];
  layers: Partial<Record<LayerKind, Layer>>;
  hamlet?: Hamlet;
}

export interface Placement {
  id: string;
  tint?: string;
  x: number;
  z: number;
  yaw: number;
  scale: number;
  biome: string;
  layer: LayerKind | "hamlet";
}

export interface Anchor {
  x: number;
  z: number;
  /** The direction the hamlet faces (towards the road), radians about y. */
  yaw: number;
}

export interface ScatterOptions {
  biomes: Biome[];
  /** [minX, minZ, maxX, maxZ]. */
  bounds: [number, number, number, number];
  seed: number;
  /** Global density multiplier (1 = as designed). */
  density?: number;
  /** Distance to the nearest road or stop (m). */
  clear: (x: number, z: number) => number;
  /** A toy's footprint radius (m) at scale 1. */
  footprint: (id: string) => number;
  /** Size of the climate regions (m); bigger means larger biomes. */
  region?: number;
  /** Width of the dithered border between biomes (climate units). */
  edge?: number;
  anchors?: Anchor[];
  /** The road's heading near (x, z), radians about y, for aligned verges. */
  heading?: (x: number, z: number) => number;
  /**
   * The bounds are one tile of a looping world. `clear` and `heading` are then
   * only asked about points inside the bounds, and must themselves count roads
   * just across the seam.
   */
  wrap?: boolean;
}

// ── noise ────────────────────────────────────────────────────────────────

function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Wraps a lattice coordinate into 0…p−1 (p = 0: no wrap). */
function lat(i: number, p: number): number {
  return p > 0 ? ((i % p) + p) % p : i;
}

/** Value noise; with periods (in lattice cells) it repeats every px × py. */
function vnoise(x: number, y: number, s: number, px = 0, py = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = lat(xi, px);
  const x1 = lat(xi + 1, px);
  const y0 = lat(yi, py);
  const y1 = lat(yi + 1, py);
  const a = hash(x0, y0, s);
  const b = hash(x1, y0, s);
  const c = hash(x0, y1, s);
  const d = hash(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Two octaves, stretched back out to roughly 0–1. With periods it tiles: the
 * second octave runs at exactly twice the frequency so it repeats in step.
 */
export function fbm(x: number, y: number, s: number, px = 0, py = 0): number {
  const n =
    px > 0 || py > 0
      ? vnoise(x, y, s, px, py) * 0.65 + vnoise(x * 2 + 17, y * 2 - 9, s + 7, px * 2, py * 2) * 0.35
      : vnoise(x, y, s) * 0.65 + vnoise(x * 2.03 + 17, y * 2.03 - 9, s + 7) * 0.35;
  return Math.min(1, Math.max(0, (n - 0.5) * 2 + 0.5));
}

/**
 * Noise of feature size `size` (m) over the options' world: fbm(x/size, z/size),
 * except that on a looping world the size is nudged so a whole number of
 * cells fits the tile each way, and the noise repeats once per tile.
 */
function field(o: ScatterOptions, x: number, z: number, size: number, s: number): number {
  if (!o.wrap) return fbm(x / size, z / size, s);
  const [x0, z0, x1, z1] = o.bounds;
  const px = Math.max(1, Math.round((x1 - x0) / size));
  const pz = Math.max(1, Math.round((z1 - z0) / size));
  return fbm(((x - x0) / (x1 - x0)) * px, ((z - z0) / (z1 - z0)) * pz, s, px, pz);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── biome map ────────────────────────────────────────────────────────────

/** Which biome a spot belongs to; `dither` (0–1) picks the neighbour near borders. */
export function biomeAt(o: ScatterOptions, x: number, z: number, dither = 1): Biome {
  const r = o.region ?? 36;
  // A gentle warp keeps the borders from looking like noise contours.
  const wx = x + (field(o, x, z, 23, o.seed + 91) - 0.5) * r * 0.5;
  const wz = z + (field(o, x, z, 23, o.seed + 97) - 0.5) * r * 0.5;
  const heat = field(o, wx, wz, r, o.seed + 1);
  const wet = o.wrap ? field(o, wx, wz, r, o.seed + 2) : fbm(wx / r + 40, wz / r - 40, o.seed + 2);
  let best = o.biomes[0] as Biome;
  let next = best;
  let d1 = Number.POSITIVE_INFINITY;
  let d2 = Number.POSITIVE_INFINITY;
  for (const b of o.biomes) {
    const d = Math.hypot(b.climate[0] - heat, b.climate[1] - wet);
    if (d < d1) {
      d2 = d1;
      next = best;
      d1 = d;
      best = b;
    } else if (d < d2) {
      d2 = d;
      next = b;
    }
  }
  const edge = o.edge ?? 0.06;
  if (next !== best && d2 - d1 < edge && dither < 0.5 * (1 - (d2 - d1) / edge)) return next;
  return best;
}

// ── scattering ───────────────────────────────────────────────────────────

/** A grid of placed footprints, for clearance and "near a tree" tests. */
class Occupancy {
  private cells = new Map<number, Placement[]>();
  private radii = new Map<Placement, number>();
  /** On a looping world: the tile's size in cells (cells wrap), and in metres. */
  private gw = 0;
  private gd = 0;
  private tw = 0;
  private td = 0;
  constructor(
    private size: number,
    wrap?: [number, number],
  ) {
    if (wrap) {
      this.gw = Math.max(1, Math.round(wrap[0] / size));
      this.gd = Math.max(1, Math.round(wrap[1] / size));
      // Cells must tile the world exactly, so stretch them a touch.
      this.size = wrap[0] / this.gw;
      this.sizeZ = wrap[1] / this.gd;
      this.tw = wrap[0];
      this.td = wrap[1];
    } else this.sizeZ = size;
  }
  private sizeZ: number;
  private key(cx: number, cz: number) {
    return (lat(cx, this.gw) + 4096) * 8192 + (lat(cz, this.gd) + 4096);
  }
  /** Distance, the short way round on a looping world. */
  dist(ax: number, az: number, bx: number, bz: number): number {
    let dx = Math.abs(ax - bx);
    let dz = Math.abs(az - bz);
    if (this.tw) dx = Math.min(dx, this.tw - dx);
    if (this.td) dz = Math.min(dz, this.td - dz);
    return Math.hypot(dx, dz);
  }
  add(p: Placement, r: number) {
    const k = this.key(Math.floor(p.x / this.size), Math.floor(p.z / this.sizeZ));
    const list = this.cells.get(k);
    if (list) list.push(p);
    else this.cells.set(k, [p]);
    this.radii.set(p, r);
  }
  /** Calls `f` for every placement within `reach` of (x, z) (cell-coarse). */
  each(
    x: number,
    z: number,
    reach: number,
    f: (p: Placement, r: number) => boolean | undefined,
  ): boolean {
    const n = Math.ceil(reach / this.size);
    const m = Math.ceil(reach / this.sizeZ);
    const cx = Math.floor(x / this.size);
    const cz = Math.floor(z / this.sizeZ);
    // On a small looping grid, don't visit a wrapped cell twice.
    const ni = this.gw ? Math.min(n, Math.floor((this.gw - 1) / 2)) : n;
    const mj = this.gd ? Math.min(m, Math.floor((this.gd - 1) / 2)) : m;
    for (let i = -ni; i <= ni; i++) {
      for (let j = -mj; j <= mj; j++) {
        const list = this.cells.get(this.key(cx + i, cz + j));
        if (!list) continue;
        for (const p of list) if (f(p, this.radii.get(p) ?? 0)) return true;
      }
    }
    return false;
  }
  free(x: number, z: number, r: number): boolean {
    return !this.each(x, z, r + 4, (p, pr) => this.dist(p.x, p.z, x, z) < r + pr || undefined);
  }
  nearLayer(x: number, z: number, reach: number, layer: string): boolean {
    return this.each(
      x,
      z,
      reach,
      (p) => (p.layer === layer && this.dist(p.x, p.z, x, z) < reach) || undefined,
    );
  }
}

const ORDER: LayerKind[] = ["landmark", "planted", "canopy", "under", "cover", "accent"];
/** Candidate spacing per layer (m). */
const CELL: Record<LayerKind, number> = {
  landmark: 18,
  planted: 0,
  canopy: 2.6,
  under: 1.6,
  cover: 4.5,
  accent: 5,
};

function pick(list: Species[], r: number): Species {
  const total = list.reduce((s, sp) => s + (sp.weight ?? 1), 0);
  let t = r * total;
  for (const sp of list) {
    t -= sp.weight ?? 1;
    if (t <= 0) return sp;
  }
  return list[list.length - 1] as Species;
}

/** Scatters everything at once. */
export function scatter(o: ScatterOptions): Placement[] {
  const g = scatterSteps(o);
  for (;;) {
    const n = g.next();
    if (n.done) return n.value;
  }
}

/**
 * Scatters in steps: pauses between rows of candidates, so a big world can be
 * scattered in the background without holding a frame for long. Same result
 * as scatter().
 */
export function* scatterSteps(o: ScatterOptions): Generator<unknown, Placement[], unknown> {
  const out: Placement[] = [];
  const [x0, z0, x1, z1] = o.bounds;
  const tw = x1 - x0;
  const td = z1 - z0;
  // (Occupancy works in tile-local coordinates, so its cells line up with the tile.)
  const occ = new Occupancy(4, o.wrap ? [tw, td] : undefined);
  const rand = rng(o.seed * 7919 + 13);
  const global = o.density ?? 1;
  /** On a looping world, a point anywhere maps back into the tile. */
  const wx = (x: number) => (o.wrap ? x0 + ((((x - x0) % tw) + tw) % tw) : x);
  const wz = (z: number) => (o.wrap ? z0 + ((((z - z0) % td) + td) % td) : z);
  const clear = (x: number, z: number) => o.clear(wx(x), wz(z));

  const put = (
    sp: Species,
    x: number,
    z: number,
    biome: Biome,
    layer: Placement["layer"],
    yaw?: number,
    spread = 1,
  ) => {
    const [a, b] = sp.scale ?? [0.85, 1.15];
    const scale = a + (b - a) * rand();
    const r = o.footprint(sp.id) * scale * spread;
    if (o.wrap) {
      x = wx(x);
      z = wz(z);
    } else if (x < x0 + r || x > x1 - r || z < z0 + r || z > z1 - r) return false;
    // Never in water or on a road (hamlets and pairs aren't checked elsewhere).
    if (clear(x, z) < (layer === "hamlet" ? r * 0.7 : 0)) return false;
    if (!occ.free(x - x0, z - z0, r)) return false;
    const p: Placement = {
      id: sp.id,
      ...(sp.tint ? { tint: sp.tint } : {}),
      x,
      z,
      yaw: yaw ?? rand() * Math.PI * 2,
      scale,
      biome: biome.id,
      layer,
    };
    out.push(p);
    occ.add({ ...p, x: x - x0, z: z - z0 }, r);
    return true;
  };

  // Hamlets: buildings in a short row facing the road, props in front.
  for (const a of o.anchors ?? []) {
    // The anchor's own biome builds it, or else the place's default hamlet.
    const own = biomeAt(o, a.x, a.z);
    const b = own.hamlet ? own : o.biomes.find((x) => x.hamlet);
    if (!b?.hamlet) continue;
    const fx = Math.sin(a.yaw);
    const fz = Math.cos(a.yaw);
    const n = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const along = (i - (n - 1) / 2) * 5.2 + (rand() - 0.5) * 1.2;
      const back = 1.5 + rand() * 1.5;
      const sp = pick(b.hamlet.buildings, rand());
      put(
        { ...sp, scale: [1, 1] },
        a.x - fx * back + fz * along,
        a.z - fz * back - fx * along,
        b,
        "hamlet",
        a.yaw + (rand() - 0.5) * 0.25,
        0.85,
      );
    }
    for (let i = 0; i < 2; i++) {
      const sp = pick(b.hamlet.props, rand());
      const along = (rand() - 0.5) * 9;
      put(
        { ...sp, scale: [1, 1] },
        a.x + fx * 2.4 + fz * along,
        a.z + fz * 2.4 - fx * along,
        b,
        "hamlet",
        a.yaw + (rand() - 0.5) * 0.6,
      );
    }
  }

  for (const kind of ORDER) {
    if (kind === "planted") {
      for (const b of o.biomes) {
        const L = b.layers.planted;
        if (!L?.rows) continue;
        const [step, gap, ang] = L.rows;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const reach = Math.hypot(x1 - x0, z1 - z0);
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        for (let v = -reach / 2; v < reach / 2; v += gap) {
          for (let u = -reach / 2; u < reach / 2; u += step) {
            let x = cx + u * ca - v * sa;
            let z = cz + u * sa + v * ca;
            const nat = L.natural;
            if (nat) {
              // Sway the rows together (sideways to them), then nudge each plant.
              const sway = (field(o, x, z, nat.length, o.seed + 53) - 0.5) * 2 * nat.amp;
              x += -sa * sway + (rand() - 0.5) * 2 * nat.jitter;
              z += ca * sway + (rand() - 0.5) * 2 * nat.jitter;
              if (field(o, x, z, nat.length * 0.6, o.seed + 59) < nat.gaps) continue;
            } else {
              x += (rand() - 0.5) * 0.25;
              z += (rand() - 0.5) * 0.25;
            }
            if (x < x0 || x > x1 || z < z0 || z > z1) continue;
            if (biomeAt(o, x, z, 1) !== b) continue;
            if (clear(x, z) < (L.keep ?? 2)) continue;
            if (rand() > L.density * Math.min(1, global)) continue;
            put(pick(L.species, rand()), x, z, b, "planted", ang + (rand() - 0.5) * 0.6, 0.6);
          }
          yield;
        }
      }
      continue;
    }
    // On a looping world the cells divide the tile exactly (no doubled strip at the seam).
    const cx = o.wrap ? tw / Math.max(1, Math.round(tw / CELL[kind])) : CELL[kind];
    const cz = o.wrap ? td / Math.max(1, Math.round(td / CELL[kind])) : CELL[kind];
    for (let gz = z0; gz < z1 - 1e-6; gz += cz) {
      for (let gx = x0; gx < x1 - 1e-6; gx += cx) {
        const x = gx + rand() * cx;
        const z = gz + rand() * cz;
        const b = biomeAt(o, x, z, rand());
        const L = b.layers[kind];
        if (!L) continue;
        const d = clear(x, z);
        const keep = L.keep ?? 2;
        if (d < keep) continue;
        let p = L.density * global;
        // Groves and clearings.
        const clump = L.clump ?? 0;
        if (clump > 0) {
          const g = L.grove ?? 14;
          const n = field(o, x, z, g, o.seed + 31 + ORDER.indexOf(kind) * 11);
          const t = 0.3 + 0.35 * clump;
          p *= (1 - clump) * 0.5 + clump * smoothstep(t - 0.08, t + 0.08, n) * 1.8;
        }
        const onVerge = !!L.verge && d < keep + L.verge[0];
        if (onVerge && L.verge) p *= L.verge[1];
        if (L.nearTrees) {
          const near =
            occ.nearLayer(x - x0, z - z0, L.nearTrees[0], "canopy") ||
            occ.nearLayer(x - x0, z - z0, L.nearTrees[0], "landmark");
          p *= near ? L.nearTrees[1] : 1 / L.nearTrees[1];
        }
        if (rand() > p) continue;
        const sp = pick(L.species, rand());
        if (kind === "cover" && L.patch) {
          // A patch: one species (one colour), scattered round a centre.
          const [lo, hi, rad] = L.patch;
          const n = lo + Math.floor(rand() * (hi - lo + 1));
          for (let i = 0; i < n * 2 && i < 40; i++) {
            const a = rand() * Math.PI * 2;
            const rr = rad * Math.sqrt(-2 * Math.log(1 - rand() * 0.95)) * 0.5;
            const px = x + Math.cos(a) * rr;
            const pz = z + Math.sin(a) * rr;
            if (clear(px, pz) < keep) continue;
            put(sp, px, pz, b, kind, undefined, 0.7);
          }
          continue;
        }
        const yaw =
          L.alignVerge && o.heading
            ? onVerge
              ? o.heading(wx(x), wz(z))
              : Math.round(rand() * 4) * (Math.PI / 2) + o.heading(wx(x), wz(z))
            : undefined;
        if (put(sp, x, z, b, kind, yaw) && kind === "accent" && L.pair && rand() < L.pair) {
          const a = rand() * Math.PI * 2;
          const r = o.footprint(sp.id) * 1.6;
          put({ ...sp, scale: [0.45, 0.65] }, x + Math.cos(a) * r, z + Math.sin(a) * r, b, kind);
        }
      }
      yield;
    }
  }
  return out;
}
