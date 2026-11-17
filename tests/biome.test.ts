import { describe, expect, test } from "bun:test";
import { type Biome, biomeAt, type ScatterOptions, scatter } from "../src/three/lib/biome";

const BIOMES: Biome[] = [
  {
    id: "grove",
    climate: [0.3, 0.7],
    layers: {
      canopy: { species: [{ id: "T1" }], density: 0.6, clump: 0.7, keep: 2.5 },
      under: { species: [{ id: "B1" }], density: 0.2, nearTrees: [3, 2], keep: 1 },
      cover: { species: [{ id: "B9", tint: "rose" }], density: 0.1, patch: [3, 6, 2], keep: 0.5 },
    },
  },
  {
    id: "meadow",
    climate: [0.7, 0.3],
    layers: { cover: { species: [{ id: "B8" }], density: 0.3, patch: [3, 6, 2], keep: 0.5 } },
  },
];

/** A straight road along z = 0. */
const options = (seed: number): ScatterOptions => ({
  biomes: BIOMES,
  bounds: [-30, -20, 30, 20],
  seed,
  clear: (_x, z) => Math.abs(z) - 1.5,
  footprint: (id) => (id[0] === "T" ? 1 : 0.4),
});

describe("biome scatter", () => {
  test("is deterministic for a seed", () => {
    expect(scatter(options(3))).toEqual(scatter(options(3)));
    expect(scatter(options(3))).not.toEqual(scatter(options(4)));
  });

  test("keeps the road clear and footprints apart", () => {
    const list = scatter(options(5));
    expect(list.length).toBeGreaterThan(40);
    for (const p of list) expect(Math.abs(p.z) - 1.5).toBeGreaterThanOrEqual(0.5 - 1e-9);
    const trees = list.filter((p) => p.layer === "canopy");
    for (const a of trees)
      for (const b of trees)
        if (a !== b)
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.scale + b.scale - 1e-6);
  });

  test("leaves open ground", () => {
    // Fewer than half of the 2 m cells hold anything: the world breathes.
    const list = scatter(options(6));
    const cells = new Set(list.map((p) => `${Math.floor(p.x / 2)},${Math.floor(p.z / 2)}`));
    expect(cells.size / (30 * 20)).toBeLessThan(0.5);
  });

  describe("on a looping world", () => {
    // A 96 × 64 tile with a road along z = 0 (and its repeat at z = ±64).
    const W = 96;
    const D = 64;
    const loop = (seed: number): ScatterOptions => ({
      biomes: BIOMES,
      bounds: [-W / 2, -D / 2, W / 2, D / 2],
      seed,
      wrap: true,
      region: 30,
      clear: (_x, z) => Math.min(Math.abs(z), D - Math.abs(z)) - 1.5,
      footprint: (id) => (id[0] === "T" ? 1 : 0.4),
    });
    const short = (a: number, b: number, p: number) => {
      const d = Math.abs(a - b);
      return Math.min(d, p - d);
    };

    test("the biome map repeats once per tile", () => {
      const o = loop(8);
      for (let i = 0; i < 200; i++) {
        const x = ((i * 37) % W) - W / 2;
        const z = ((i * 53) % D) - D / 2;
        const here = biomeAt(o, x, z).id;
        expect(biomeAt(o, x + W, z).id).toBe(here);
        expect(biomeAt(o, x, z - D).id).toBe(here);
      }
    });

    test("everything lands in the tile and nothing overlaps across the seam", () => {
      const list = scatter(loop(9));
      expect(list.length).toBeGreaterThan(60);
      for (const p of list) {
        expect(p.x).toBeGreaterThanOrEqual(-W / 2);
        expect(p.x).toBeLessThan(W / 2);
        expect(p.z).toBeGreaterThanOrEqual(-D / 2);
        expect(p.z).toBeLessThan(D / 2);
      }
      const trees = list.filter((p) => p.layer === "canopy");
      for (const a of trees)
        for (const b of trees)
          if (a !== b)
            expect(Math.hypot(short(a.x, b.x, W), short(a.z, b.z, D))).toBeGreaterThan(
              a.scale + b.scale - 1e-6,
            );
    });

    test("the seam is neither bare nor crowded", () => {
      // Pieces within 6 m of the x seam vs a same-width band through the middle,
      // over a few seeds: the seam should look like anywhere else.
      let seam = 0;
      let mid = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        for (const p of scatter(loop(seed))) {
          if (W / 2 - Math.abs(p.x) < 6) seam++;
          if (Math.abs(p.x) < 6) mid++;
        }
      }
      expect(seam / mid).toBeGreaterThan(0.6);
      expect(seam / mid).toBeLessThan(1.6);
    });
  });
});
