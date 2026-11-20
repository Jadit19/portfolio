import { describe, expect, test } from "bun:test";
import {
  checkRoads,
  curve,
  type Pt,
  type RoadSpec,
  zingleLayout,
} from "../src/three/lib/zingleLayout";

const road = (name: string, ctrl: Pt[], more: Partial<RoadSpec> = {}): RoadSpec => ({
  name,
  pts: curve(ctrl, false),
  half: 1.6,
  kind: "lane",
  draw: "road",
  ...more,
});
/** A long straight through road for the test roads to join. */
const spine = road("spine", [
  [-100, 0],
  [0, 0],
  [100, 0],
]);
const issues = (...roads: RoadSpec[]) => checkRoads([{ ...spine, wraps: true }, ...roads]);

describe("Zingle's roads", () => {
  test("every road is continuous and meets the others cleanly", () => {
    expect(checkRoads(zingleLayout().roads)).toEqual([]);
  });

  test("the roads through the twin pols are mirror images of each other", () => {
    const lay = zingleLayout();
    const a = lay.roads[lay.RI.A]?.pts as Pt[];
    const loop = lay.roads[lay.RI.polLoop]?.pts as Pt[];
    for (const [x, z] of loop) {
      const mx = 2 * lay.pols.x - x;
      expect(Math.min(...a.map(([ax, az]) => Math.hypot(ax - mx, az - z)))).toBeLessThan(1e-6);
    }
  });

  test("a lane meeting a road at a right angle, at an interior point, is fine", () => {
    expect(
      issues(
        road(
          "branch",
          [
            [0, 0],
            [0, 40],
            [0, 80],
          ],
          { terminus: "end" },
        ),
      ),
    ).toEqual([]);
  });

  test("a road that carries on from another's end is a seam", () => {
    const a = road("a", [
      [20, 0],
      [20, 40],
      [20, 60],
    ]);
    const b = road("b", [
      [20, 60],
      [50, 70],
      [80, 0],
    ]);
    expect(issues(a, b).some((m) => m.includes("carries straight on"))).toBe(true);
  });

  test("a road that stops in the open is a dead end", () => {
    expect(
      issues(
        road("stub", [
          [0, 0],
          [0, 30],
        ]),
      ).some((m) => m.includes("dead end")),
    ).toBe(true);
  });

  test("a terminus may stop", () => {
    expect(
      issues(
        road(
          "ramp",
          [
            [0, 0],
            [0, 30],
          ],
          { terminus: "end" },
        ),
      ),
    ).toEqual([]);
  });

  test("a kink, a shallow join and a crossing are caught", () => {
    const kinked: RoadSpec = {
      ...road("kinked", [
        [0, 0],
        [0, 30],
      ]),
      terminus: "end",
    };
    kinked.pts = [...kinked.pts, [12, 32]];
    expect(issues(kinked).some((m) => m.includes("kinks"))).toBe(true);
    const shallow = road("shallow", [
      [0, 0],
      [40, 6],
      [80, 30],
    ]);
    shallow.terminus = "end";
    expect(issues(shallow).some((m) => m.includes("meets spine at only"))).toBe(true);
    const across = road("across", [
      [-40, 0],
      [-30, -40],
      [-10, 40],
      [0, 0],
    ]);
    expect(issues(across).some((m) => m.includes("cross or touch"))).toBe(true);
  });
});
