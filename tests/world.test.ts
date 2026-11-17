import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { EXPRESSO_STOPS } from "../src/content/expresso";
import { makeRoad, tileHeight, type V2 } from "../src/three/lib/journey";
import { BikePhysics } from "../src/three/world/bike";
import { Ground } from "../src/three/world/ground";
import { Pilot, RoadGraph } from "../src/three/world/roads";

/** A flat (or sloped) test world with one straight road along x. */
function world(slope = 0) {
  const w = 120;
  const d = 80;
  const geo = new THREE.PlaneGeometry(w, d, 120, 80);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getX(i) * slope);
  const height = (x: number) => x * slope;
  const road = makeRoad(
    [
      [-50, 0],
      [0, 0],
      [50, 0],
    ],
    height,
  );
  const ground = new Ground({
    ground: new THREE.Mesh(geo),
    size: { w, d },
    roads: [{ road, width: 3 }],
    water: [
      {
        pts: [
          [-50, 20],
          [50, 20],
        ] as V2[],
        width: 6,
      },
    ],
  });
  return { ground, road };
}

const FEEL = { top: 24, accel: 10, grip: 0.6 };
const run = (b: BikePhysics, sec: number, input = { throttle: 1, brake: 0, steer: 0 }) => {
  for (let i = 0; i < sec * 120; i++) b.step(input, 1 / 120);
};

describe("ground", () => {
  test("reads heights from the terrain grid", () => {
    const { ground } = world(0.1);
    expect(ground.height(10, 5)).toBeCloseTo(1, 3);
    expect(ground.height(-25.5, 0)).toBeCloseTo(-2.55, 3);
  });

  test("knows road, water and open ground apart", () => {
    const { ground } = world();
    expect(ground.surface(0, 0)).toBe("road");
    expect(ground.surface(0, 20)).toBe("water");
    expect(ground.surface(0, 10)).toBe("ground");
  });
});

describe("bike", () => {
  test("accelerates on the road and tops out near its top speed", () => {
    const { ground } = world();
    const b = new BikePhysics(ground, [], FEEL, { x: -45, z: 0, heading: 0 });
    run(b, 1);
    expect(b.v).toBeGreaterThan(5);
    run(b, 4.5); // still on the 100 m test road
    expect(b.surface).toBe("road");
    expect(b.v).toBeGreaterThan(FEEL.top * 0.7);
    expect(b.v).toBeLessThanOrEqual(FEEL.top);
  });

  test("is slower off-road, and slower again in water", () => {
    const { ground } = world();
    const road = new BikePhysics(ground, [], FEEL, { x: -45, z: 0, heading: 0 });
    const grass = new BikePhysics(ground, [], FEEL, { x: -45, z: 10, heading: 0 });
    const water = new BikePhysics(ground, [], FEEL, { x: -45, z: 20, heading: 0 });
    for (const b of [road, grass, water]) run(b, 4);
    expect(grass.v).toBeLessThan(road.v * 0.7);
    expect(water.v).toBeLessThan(grass.v * 0.5);
  });

  test("steering turns it, and it leans into the turn", () => {
    const { ground } = world();
    const b = new BikePhysics(ground, [], FEEL, { x: -30, z: 0, heading: 0 });
    run(b, 2);
    run(b, 0.6, { throttle: 0.6, brake: 0, steer: 1 });
    expect(b.heading).toBeGreaterThan(0.2); // + is a left turn
    expect(b.lean).toBeGreaterThan(0.1); // leaning left, into it
  });

  test("brakes to a stop and then reverses slowly", () => {
    const { ground } = world();
    const b = new BikePhysics(ground, [], FEEL, { x: -30, z: 0, heading: 0 });
    run(b, 2);
    run(b, 3, { throttle: 0, brake: 1, steer: 0 });
    expect(b.v).toBeLessThan(0);
    expect(b.v).toBeGreaterThan(-4);
  });

  test("bounces off a blocker instead of passing through", () => {
    const { ground } = world();
    const b = new BikePhysics(ground, [{ x: 0, z: 0, r: 1 }], FEEL, {
      x: -20,
      z: 0,
      heading: 0,
    });
    let hit = 0;
    for (let i = 0; i < 6 * 120; i++) {
      b.step({ throttle: 1, brake: 0, steer: 0 }, 1 / 120);
      hit = Math.max(hit, b.impact);
      expect(Math.hypot(b.x, b.z)).toBeGreaterThan(1.6);
    }
    expect(hit).toBeGreaterThan(1);
  });

  test("you can always ride out of a river, up its bank", () => {
    // The Kaveri's shape: a river 6 m wide in a 4.4 m deep trench.
    const w = 120;
    const d = 80;
    const geo = new THREE.PlaneGeometry(w, d, 240, 160);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      pos.setY(i, -4.4 * (1 - THREE.MathUtils.smoothstep(Math.abs(z - 20), 3, 9)));
    }
    const ground = new Ground({
      ground: new THREE.Mesh(geo),
      size: { w, d },
      roads: [],
      water: [
        {
          pts: [
            [-60, 20],
            [60, 20],
          ] as V2[],
          width: 6,
        },
      ],
    });
    // Stopped mid-river, facing the bank (−z), then gas, on the café racer's real figures.
    const cafe = { top: 24.4, accel: 4.8, grip: 0.6 };
    const b = new BikePhysics(ground, [], cafe, { x: 0, z: 20, heading: Math.PI / 2 });
    expect(b.surface === "water" || ground.surface(0, 20) === "water").toBe(true);
    run(b, 6);
    expect(ground.surface(b.x, b.z)).toBe("ground");
    expect(b.z).toBeLessThan(14);
  });

  test("slopes slow you uphill", () => {
    const up = new BikePhysics(world(0.15).ground, [], FEEL, { x: -45, z: 0, heading: 0 });
    const flat = new BikePhysics(world(0).ground, [], FEEL, { x: -45, z: 0, heading: 0 });
    run(up, 3);
    run(flat, 3);
    // (On a made road the engine has the grade in hand: a climb costs a little, not a crawl.)
    expect(up.v).toBeLessThan(flat.v - 0.3);
  });

  test("never leaves the world", () => {
    const { ground } = world();
    const b = new BikePhysics(ground, [], FEEL, { x: 40, z: 30, heading: 0.6 });
    run(b, 20);
    expect(Math.abs(b.x)).toBeLessThan(ground.w / 2);
    expect(Math.abs(b.z)).toBeLessThan(ground.d / 2);
  });
});

describe("open world", () => {
  test("tiled heights meet themselves across every edge", () => {
    const h = tileHeight(
      (x, z) => Math.sin(x * 0.13) * 3 + z * 0.05 + Math.cos(z * 0.21),
      120,
      80,
      14,
    );
    for (const z of [-30, -5, 12, 33]) expect(h(60, z)).toBeCloseTo(h(-60, z), 6);
    for (const x of [-50, 0, 21, 44]) expect(h(x, 40)).toBeCloseTo(h(x, -40), 6);
  });

  test("riding off one edge brings you in from the other", () => {
    const { ground } = world();
    const b = new BikePhysics(ground, [], FEEL, { x: 50, z: 30, heading: 0 }, 9, true);
    run(b, 6);
    expect(Math.abs(b.x)).toBeLessThanOrEqual(ground.w / 2);
    expect(b.x).toBeLessThan(0); // it came back in from the west
    expect(ground.height(ground.w / 2 + 3, 0)).toBeCloseTo(ground.height(-ground.w / 2 + 3, 0), 6);
  });
});

describe("cruise", () => {
  test("routes along a loop the short way round", () => {
    const loop: V2[] = [
      [-30, -20],
      [30, -20],
      [30, 20],
      [-30, 20],
    ];
    const road = makeRoad(loop, () => 0, true);
    const g = new RoadGraph([{ road, closed: true }]);
    const p0 = road.at(0).p;
    const goal = road.at(0.12).p;
    const r = g.route(p0.x, p0.z, road.at(0).heading, goal.x, goal.z);
    expect(r.length).toBeLessThan(road.length * 0.25);
  });

  test("the pilot rides a bike to the end of a route and stops there", () => {
    const { ground, road } = world();
    const g = new RoadGraph([{ road }]);
    const end = road.at(0.9).p;
    const b = new BikePhysics(ground, [], FEEL, { x: -40, z: 0, heading: 0 });
    const pilot = new Pilot(g.route(b.x, b.z, b.heading, end.x, end.z).pts);
    let left = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 20 * 120 && !(left < 2 && Math.abs(b.v) < 0.6); i++) {
      const p = pilot.update(b.x, b.z, Math.abs(b.v), FEEL.top);
      left = p.left;
      const dv = p.want - b.v;
      b.step(
        {
          throttle: dv > 0 ? Math.min(1, dv * 0.6) : 0,
          brake: dv < -0.5 ? Math.min(1, -dv * 0.25) : 0,
          steer: b.steerToward(p.aim, 2.4),
        },
        1 / 120,
      );
    }
    expect(Math.hypot(b.x - end.x, b.z - end.z)).toBeLessThan(3);
    expect(Math.abs(b.v)).toBeLessThan(0.6);
  });
});

describe("expresso content", () => {
  test("eight stops, unique ids, each with a drink, facts and a GitHub link", () => {
    expect(EXPRESSO_STOPS).toHaveLength(8);
    expect(new Set(EXPRESSO_STOPS.map((s) => s.id)).size).toBe(8);
    for (const s of EXPRESSO_STOPS) {
      expect(s.drink.length).toBeGreaterThan(3);
      expect(s.facts.length).toBeGreaterThan(0);
      expect(s.links.some((l) => l.kind === "github")).toBe(true);
    }
  });
});
