import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { ROUTE_IDS } from "../src/content/types";
import { WORLDS, world } from "../src/content/worlds";
import { layoutFor } from "../src/three/layout";
import { batch } from "../src/three/merge";

describe("worlds", () => {
  test("every route has exactly one world, in garage order", () => {
    expect(WORLDS.map((w) => w.id)).toEqual([...ROUTE_IDS]);
  });

  test("only the secret world is locked, behind 3 stamps", () => {
    expect(WORLDS.filter((w) => w.unlockAfter).map((w) => [w.id, w.unlockAfter])).toEqual([
      ["murphy", 3],
    ]);
  });

  test("lookup throws on an unknown id", () => {
    expect(world("zingle").bike.kind).toBe("rally");
    expect(() => world("nope" as never)).toThrow();
  });
});

describe("layout", () => {
  test("wide landscape docks a side panel", () => {
    const l = layoutFor(1440, 900);
    expect(l.side).toBe(true);
    expect(l.insetRight).toBeGreaterThan(0);
    expect(l.insetBottom).toBe(0);
  });

  test("phones in portrait and portrait tablets use a bottom sheet", () => {
    for (const [w, h] of [
      [390, 844],
      [820, 1180],
    ] as const) {
      const l = layoutFor(w, h);
      expect(l.side).toBe(false);
      expect(l.insetBottom).toBeGreaterThan(0);
    }
  });

  test("phones held sideways get the compact side panel", () => {
    for (const [w, h] of [
      [844, 390],
      [932, 430],
    ] as const) {
      const l = layoutFor(w, h);
      expect(l.side).toBe(true);
      expect(l.insetBottom).toBe(0);
    }
  });
});

describe("batch", () => {
  test("merges same-kind meshes into one draw and keeps live parts separate", () => {
    const root = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: "#ff0000", roughness: 0.6 });
    const blue = new THREE.MeshStandardMaterial({ color: "#0000ff", roughness: 0.6 });
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), i % 2 ? red : blue);
      m.position.x = i * 2;
      root.add(m);
    }
    const wheel = new THREE.Group();
    wheel.userData.wheelRadius = 0.3;
    wheel.add(new THREE.Mesh(new THREE.SphereGeometry(0.3), red));
    wheel.position.set(5, 1, 0);
    root.add(wheel);
    const out = batch(root, (o) => typeof o.userData.wheelRadius === "number");
    const meshes = out.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
    expect(meshes).toHaveLength(1);
    expect(meshes[0]?.geometry.getAttribute("color")).toBeDefined();
    const live = out.children.find((c) => c.userData.wheelRadius === 0.3);
    expect(live?.position.toArray()).toEqual([5, 1, 0]);
    const box = new THREE.Box3().setFromObject(out);
    expect(box.max.x).toBeCloseTo(18.5, 5);
  });
});

describe("batch keeps painted vertex colours", () => {
  test("a vertex-coloured mesh keeps its colours", () => {
    const root = new THREE.Group();
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.setAttribute("color", new THREE.Float32BufferAttribute(new Array(4 * 3).fill(0.5), 3));
    root.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true })));
    const out = batch(root);
    const m = out.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh;
    expect(m.geometry.getAttribute("color")?.getX(0)).toBeCloseTo(0.5);
  });
});
