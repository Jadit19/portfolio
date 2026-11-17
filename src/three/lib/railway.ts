/**
 * The toy railway's big pieces, in the flat kit's language (soft rounded
 * blocks, flat pastel colours, painted as vertex colours): bridges over the
 * water for roads and for the railway, the track itself, and the station.
 *
 * Everything runs along +z (length), is centred on the origin, and stands on
 * y = 0. Rail bridges keep the track flat and continuous (rails and sleepers
 * right across); trains never hump.
 */

import * as THREE from "three";
import { join, paint } from "./nature";
import { PASTEL as P } from "./palette";
import { at, drum, type G, gable, rbox } from "./toys";

const RAIL = "#8a8494";
const STEEL = "#6f7d8c";
const WOOD = "#b98a62";
/** Track gauge: rails at ±GAUGE/2. */
export const GAUGE = 1.24;
/** Top of the rails above the ground. */
export const RAIL_TOP = 0.16;

/** A length of track along z: sleepers every 0.55 m and two rails, from z0 to z1. */
export function track(z0: number, z1: number, y = 0): G {
  const parts: G[] = [];
  for (let z = z0 + 0.25; z < z1 - 0.1; z += 0.55)
    parts.push(at(rbox(1.75, 0.08, 0.24, WOOD, 0.03), 0, y, z));
  for (const x of [-GAUGE / 2, GAUGE / 2])
    parts.push(at(rbox(0.08, 0.08, z1 - z0, RAIL, 0.02), x, y + 0.08, (z0 + z1) / 2));
  return join(parts);
}

/** A side profile along z (u from −len/2 to len/2), extruded `depth` across x at `x`. */
function profile(
  len: number,
  lo: (u: number) => number,
  hi: (u: number) => number,
  depth: number,
  x: number,
  hex: string,
): G {
  const shape = new THREE.Shape();
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const u = -len / 2 + (len * i) / n;
    if (i) shape.lineTo(u, hi(u));
    else shape.moveTo(u, hi(u));
  }
  for (let i = n; i >= 0; i--) {
    const u = -len / 2 + (len * i) / n;
    shape.lineTo(u, lo(u));
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 6,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  g.translate(x, 0, 0);
  const f = g.toNonIndexed();
  f.deleteAttribute("uv");
  f.computeVertexNormals();
  return paint(f, hex);
}

// ── road bridges ────────────────────────────────────────────────────────────

export type RoadBridgeStyle = "arch" | "planks" | "causeway";

/** How a road bridge lifts the bike: its deck height at the ends and mid-span. */
export function roadDeck(style: RoadBridgeStyle): { base: number; rise: number } {
  if (style === "arch") return { base: 0.08, rise: 0.45 };
  if (style === "planks") return { base: 0.32, rise: 0 };
  return { base: 0.12, rise: 0 };
}

/**
 * A road bridge `len` long and `width` wide:
 *  - arch: a humped stone bridge, a cream deck on top and chunky cream
 *    parapets with round caps at the ends;
 *  - planks: a flat timber deck on two stone piers, with post-and-rail
 *    railings (a Coorg estate footbridge, widened for a bike);
 *  - causeway: a low concrete slab with black-and-white kerb stones and
 *    culvert pipes for the water (the rural Indian "nala" crossing).
 */
export function roadBridge(style: RoadBridgeStyle, len: number, width: number): G {
  const parts: G[] = [];
  if (style === "arch") {
    const top = (u: number) => 0.08 + 0.45 * (1 - ((2 * u) / len) ** 2);
    const under = (u: number) =>
      Math.max(0, top(u) - 0.28 - 0.35 * Math.max(0, 1 - ((2 * u) / (len * 0.55)) ** 2));
    parts.push(profile(len, under, top, width, 0, P.stone));
    parts.push(profile(len, top, (u) => top(u) + 0.04, width - 0.5, 0, P.cream));
    for (const s of [-1, 1]) {
      parts.push(
        profile(
          len,
          (u) => top(u) + 0.02,
          (u) => top(u) + 0.45,
          0.3,
          s * (width / 2 - 0.15),
          P.cream,
        ),
      );
      for (const e of [-1, 1])
        parts.push(
          at(drum(0.24, 0.62, P.cream, 0.08, 16), s * (width / 2 - 0.15), 0, e * (len / 2)),
        );
    }
  } else if (style === "planks") {
    const y = 0.32;
    for (const e of [-1, 1])
      parts.push(at(rbox(width + 0.3, y - 0.06, 0.9, P.stone, 0.1), 0, 0, e * (len / 2 - 0.9)));
    for (let z = -len / 2 + 0.2; z < len / 2 - 0.1; z += 0.42)
      parts.push(at(rbox(width - 0.2, 0.08, 0.36, WOOD, 0.03), 0, y - 0.08, z + 0.18));
    for (const s of [-1, 1]) {
      const x = s * (width / 2 - 0.12);
      for (let z = -len / 2 + 0.3; z <= len / 2 - 0.2; z += len / 6)
        parts.push(at(rbox(0.14, 0.62, 0.14, WOOD, 0.04), x, y, z));
      parts.push(at(rbox(0.1, 0.09, len - 0.4, P.clay, 0.04), x, y + 0.56, 0));
      parts.push(at(rbox(0.08, 0.07, len - 0.4, P.clay, 0.03), x, y + 0.3, 0));
    }
  } else {
    const y = 0.12;
    parts.push(rbox(width + 0.2, y, len, P.cream, 0.05));
    for (const s of [-1, 1]) {
      const n = Math.round(len / 0.7);
      for (let i = 0; i < n; i++)
        parts.push(
          at(
            rbox(0.26, 0.24, 0.6, i % 2 ? P.ink : "#fbf6ec", 0.06),
            s * (width / 2 + 0.05),
            y,
            -len / 2 + 0.35 + i * (len / n),
          ),
        );
    }
    for (const x of [-1, 0, 1])
      parts.push(
        at(
          drum(0.22, width + 0.6, P.stone, 0.05, 14),
          x * 0.7,
          -0.06,
          0,
          Math.PI / 2,
          0,
          Math.PI / 2,
        ),
      );
  }
  return join(parts);
}

// ── rail bridges ────────────────────────────────────────────────────────────

export type RailBridgeStyle = "truss" | "girder" | "arch";

/**
 * A railway bridge: the track runs flat and unbroken across it, rails and
 * sleepers and all.
 *  - truss: two steel lattice girders either side (Indian Railways' classic
 *    through-truss), portal beams over the ends;
 *  - girder: low plate girders, painted, with a walkway rail;
 *  - arch: a stone arch carrying the ballast, with low parapets.
 */
export function railBridge(style: RailBridgeStyle, len: number): G {
  const parts: G[] = [track(-len / 2 - 0.3, len / 2 + 0.3)];
  const half = 1.25;
  if (style === "truss") {
    const h = 1.5;
    for (const s of [-1, 1]) {
      const x = s * half;
      parts.push(at(rbox(0.18, 0.2, len, STEEL, 0.04), x, 0, 0));
      parts.push(at(rbox(0.16, 0.16, len - 1.2, STEEL, 0.04), x, h, 0));
      const bays = Math.max(3, Math.round(len / 1.6));
      for (let i = 0; i <= bays; i++) {
        const z = -len / 2 + 0.6 + (i * (len - 1.2)) / bays;
        parts.push(at(rbox(0.12, h, 0.12, STEEL, 0.03), x, 0.1, z));
        if (i < bays) {
          const dz = (len - 1.2) / bays;
          const d = rbox(0.1, Math.hypot(h, dz), 0.1, STEEL, 0.03);
          d.translate(0, -Math.hypot(h, dz) / 2, 0);
          d.rotateX((i % 2 ? 1 : -1) * Math.atan2(dz, h));
          parts.push(at(d, x, 0.1 + h / 2, z + dz / 2));
        }
      }
    }
    for (const e of [-1, 1])
      parts.push(at(rbox(half * 2 + 0.2, 0.16, 0.18, STEEL, 0.04), 0, h, e * (len / 2 - 0.6)));
  } else if (style === "girder") {
    for (const s of [-1, 1]) {
      parts.push(at(rbox(0.16, 0.7, len, P.aqua, 0.05), s * half, -0.05, 0));
      parts.push(at(rbox(0.26, 0.08, len, STEEL, 0.03), s * half, 0.65, 0));
      for (let z = -len / 2 + 0.5; z < len / 2; z += 1.1)
        parts.push(at(rbox(0.18, 0.5, 0.06, STEEL, 0.02), s * half, 0.05, z));
    }
  } else {
    const top = () => 0.04;
    const under = (u: number) =>
      Math.max(-0.1, 0.04 - 0.1 - 0.3 * Math.max(0, 1 - ((2 * u) / (len * 0.6)) ** 2));
    parts.push(profile(len, under, top, half * 2 + 0.4, 0, P.stone));
    for (const s of [-1, 1])
      parts.push(
        profile(
          len,
          () => 0.04,
          () => 0.5,
          0.26,
          s * (half + 0.1),
          P.stone,
        ),
      );
  }
  return join(parts);
}

// ── the station ─────────────────────────────────────────────────────────────

export type StationStyle = "halt" | "house" | "shed";

/** A painted canvas: the yellow station nameboard, in Kannada, Hindi and English. */
function nameboard(name: { kn: string; hi: string; en: string }, w: number, h: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#f6c94a";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#1c1820";
  g.lineWidth = 14;
  g.strokeRect(7, 7, c.width - 14, c.height - 14);
  g.fillStyle = "#1c1820";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const rows = [name.kn, name.hi, name.en];
  rows.forEach((t, i) => {
    g.font = `${i === 2 ? 900 : 700} ${c.height * (i === 2 ? 0.26 : 0.2)}px ${i === 2 ? "Outfit, sans-serif" : "sans-serif"}`;
    g.fillText(t, c.width / 2, c.height * (0.22 + i * 0.29));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // Two faces back to back, so it reads the right way round from either side.
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  const back = m.clone();
  back.rotation.y = Math.PI;
  m.add(back);
  return m;
}

/** "Kaapi Junction" (coffee junction), on the boards as Indian Railways writes it. */
export const STATION_NAME = { kn: "ಕಾಪಿ ಜಂ.", hi: "कापी जं.", en: "KAAPI JN." };

/** Platform length and its offset from the track centre (platform on +x). */
export const PLATFORM = { len: 18, w: 3.2, h: 0.45, x: 0.95 + 1.6 };

/**
 * A small station by the track (track along z through the origin, platform
 * on +x), returned as its body geometry plus the nameboard meshes:
 *  - halt: a platform with a shelter on posts, a bench, the nameboard;
 *  - house: a colonial station house (cream walls, red-tiled roof, a clock);
 *  - shed: a tin-roofed shed, a semaphore signal at the end, a shade tree.
 */
export function station(
  style: StationStyle,
  name = STATION_NAME,
): { body: G; boards: THREE.Mesh[] } {
  const L = PLATFORM.len;
  const px = PLATFORM.x;
  const parts: G[] = [
    at(rbox(PLATFORM.w, PLATFORM.h, L, P.cream, 0.06), px, 0, 0),
    at(rbox(0.22, 0.03, L, "#f6c94a", 0.01), px - PLATFORM.w / 2 + 0.16, PLATFORM.h, 0),
  ];
  const y = PLATFORM.h;
  const bench = (x: number, z: number) => {
    parts.push(at(rbox(0.5, 0.08, 1.4, WOOD, 0.03), x, y + 0.4, z));
    for (const e of [-0.55, 0.55]) parts.push(at(rbox(0.4, 0.4, 0.08, P.ink, 0.02), x, y, z + e));
  };
  if (style === "halt") {
    for (const zx of [-2.2, 2.2])
      for (const xx of [px - 0.9, px + 0.9])
        parts.push(at(rbox(0.14, 2.1, 0.14, P.ink, 0.04), xx, y, zx));
    parts.push(at(gable(2.6, 5.6, 0.7, P.coral, 0.2), px, y + 2.1, 0));
    bench(px + 0.5, 0);
  } else if (style === "house") {
    const hx = px + 0.7;
    parts.push(at(rbox(2.2, 2.2, 5.2, "#fbf3e2", 0.08), hx, y, 0));
    parts.push(at(gable(2.6, 5.8, 1.1, P.coral, 0.25), hx, y + 2.2, 0));
    for (const z of [-1.6, 0, 1.6])
      parts.push(
        at(
          rbox(0.06, z === 0 ? 1.5 : 0.9, 0.7, z === 0 ? WOOD : P.aqua, 0.03),
          hx - 1.11,
          y + (z === 0 ? 0 : 0.8),
          z,
        ),
      );
    parts.push(at(drum(0.3, 0.08, "#ffffff", 0.03, 20), hx - 1.13, y + 2.75, 0, 0, 0, Math.PI / 2));
    bench(px - 0.6, 4.4);
  } else {
    for (const zx of [-2.8, 0, 2.8])
      parts.push(at(rbox(0.12, 2.0, 0.12, STEEL, 0.03), px + 1.2, y, zx));
    const roof = rbox(2.8, 0.08, 6.4, P.aqua, 0.03);
    roof.rotateZ(-0.12);
    parts.push(at(roof, px + 0.2, y + 2.05, 0));
    bench(px + 0.6, 0);
    // A semaphore signal past the end of the platform, and a shade tree.
    const sx = -1.4;
    const sz = L / 2 + 3;
    parts.push(at(rbox(0.14, 3.2, 0.14, P.ink, 0.04), sx, 0, sz));
    parts.push(at(rbox(0.9, 0.18, 0.06, P.coral, 0.03), sx + 0.45, 2.8, sz, 0, 0, 0.5));
    parts.push(at(drum(0.12, 0.6, P.clay, 0.04, 10), px + 1.4, y, -L / 2 + 1.5));
    parts.push(at(drum(1.1, 1.2, P.fern, 0.4, 16), px + 1.4, y + 0.6, -L / 2 + 1.5));
  }
  // Nameboards: one at each end of the platform, facing the track.
  const boards: THREE.Mesh[] = [];
  for (const e of [-1, 1]) {
    const bz = e * (L / 2 - 1.6);
    const bx = px + 0.6;
    for (const o of [-0.85, 0.85]) parts.push(at(rbox(0.1, 1.6, 0.1, P.ink, 0.03), bx, y, bz + o));
    const b = nameboard(name, 2, 0.95);
    b.position.set(bx - 0.06, y + 1.55, bz);
    b.rotation.y = -Math.PI / 2;
    boards.push(b);
  }
  return { body: join(parts), boards };
}
