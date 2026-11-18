/**
 * AstroClub in the flat-world language: Ladakh as one wrapping tile, three
 * times the first one's area (see ladakhWorld). A ridge of carved rock rings
 * the world along the top and bottom edges, snow above a wandering line,
 * Umling La on its crest with the Gata loops down each face (shelves cut in
 * the rock, stilts here and there); the valley between holds the river,
 * Pangong, the Tawang-style monastery, hamlets and gompas. Built a slice at a
 * time: the land, the terrain chunks, water and roads; the buildings; the
 * toys; then the world data the ride engine needs.
 */

import * as THREE from "three";
import {
  chunked,
  clay,
  drapedShadow,
  flatShape,
  footprint,
  heightsOf,
  instancedToys,
  lightToys,
  mix,
  ribbon,
  type ToySlot,
  toy,
} from "../../flat/kit";
import { ASTRO_LANDMARKS, type AstroLandmark } from "../astroLandmarks";
import {
  findJunctions,
  type JourneyBuild,
  type JourneyDef,
  makeRoad,
  type Ramp,
  type Road,
  type V2,
  type WorldData,
} from "../journey";
import {
  armyTruck,
  BRO_SLOGANS,
  barleyTerraces,
  broSign,
  chorten,
  flagGate,
  flagString,
  LADAKH_GROUND,
  ladakhiHouse,
  maniWall,
  milestone,
  smallGompa,
  tawangMonastery,
  tawangSolids,
  yak,
} from "../ladakh";
import {
  gradedRoad,
  junctionAprons,
  ladakhWorldSteps,
  roadColours,
  type WorldTile,
  woodBridge,
} from "../ladakhWorld";
import type { Landmark } from "../landmarks";
import { join } from "../nature";
import { PASTEL as P } from "../palette";
import { rockGeometry, rockMaterial } from "../rocks";
import { at, drum, type G, rbox } from "../toys";
import { big, knockable, solidity } from "./expressoFlat";

const BASE = LADAKH_GROUND;
/** Toys are instanced in chunks this size (m), so off-screen ones aren't drawn. */
const CHUNK = 60;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const TW = 520;
const TD = 420;
const BRIDGE = { len: 13, width: 3.4 };
/** The valley's mesh reaches this far either side of the middle; the mountains' chunks take over beyond. */
const ZB = 98;

type Pt = [number, number];
type P3 = [number, number, number];

/**
 * A piece of the land as a mesh: heights as drawn (rock carved, falling away under the
 * stilt bits), the floor's colours blending into the rock's, normals from the height grid
 * over a little span (so steep rock shades smoothly), and the snowline's offset per vertex.
 */
export function* terrainPiece(
  t: WorldTile,
  material: THREE.Material,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  step: number,
  /**
   * A border radius for the rock (m): the finished surface is rounded over about this
   * much (a soft blur of the heights), except on and right beside the roads, which stay level.
   */
  round = 0,
): Generator<unknown, THREE.Mesh, unknown> {
  const nx = Math.round((x1 - x0) / step);
  const nz = Math.round((z1 - z0) / step);
  const sx = (x1 - x0) / nx;
  const sz = (z1 - z0) / nz;
  // Heights on the grid plus a border (for the normals at the edges, and the rounding).
  const rc = Math.max(0, Math.round(round / step));
  const B = 2 + rc * 2;
  const ex = nx + 1 + 2 * B;
  const ez = nz + 1 + 2 * B;
  const hs = new Float32Array(ex * ez);
  for (let j = 0; j < ez; j++) {
    for (let i = 0; i < ex; i++)
      hs[j * ex + i] = t.renderAt(x0 + (i - B) * sx, z0 + (j - B) * sz).h;
    if (j % 24 === 23) yield;
  }
  if (rc > 0) {
    // Two passes of a box blur each way (close to a Gaussian), blended in away from the roads.
    let src = Float32Array.from(hs);
    for (let pass = 0; pass < 2; pass++) {
      const tmp = new Float32Array(hs.length);
      for (let j = 0; j < ez; j++)
        for (let i = 0; i < ex; i++) {
          let a = 0;
          let n = 0;
          for (let k = Math.max(0, i - rc); k <= Math.min(ex - 1, i + rc); k++) {
            a += src[j * ex + k] as number;
            n++;
          }
          tmp[j * ex + i] = a / n;
        }
      const out = new Float32Array(hs.length);
      for (let j = 0; j < ez; j++)
        for (let i = 0; i < ex; i++) {
          let a = 0;
          let n = 0;
          for (let k = Math.max(0, j - rc); k <= Math.min(ez - 1, j + rc); k++) {
            a += tmp[k * ex + i] as number;
            n++;
          }
          out[j * ex + i] = a / n;
        }
      src = out;
      yield;
    }
    for (let j = 0; j < ez; j++) {
      for (let i = 0; i < ex; i++) {
        const k = j * ex + i;
        const gap = t.roadGap(x0 + (i - B) * sx, z0 + (j - B) * sz);
        const w = THREE.MathUtils.smoothstep(gap, 1, 3.5);
        hs[k] = (hs[k] as number) + ((src[k] as number) - (hs[k] as number)) * w;
      }
      if (j % 48 === 47) yield;
    }
  }
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  g.deleteAttribute("uv");
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nrm = new Float32Array(pos.count * 3);
  const col = new Float32Array(pos.count * 3);
  const off = new Float32Array(pos.count);
  const H = (i: number, j: number) => hs[(j + B) * ex + (i + B)] as number;
  const c = new THREE.Color();
  const r = new THREE.Color();
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i;
      const x = x0 + i * sx;
      const z = z0 + j * sz;
      const h = H(i, j);
      pos.setXYZ(k, x, h, z);
      const dx = (H(i + 2, j) - H(i - 2, j)) / (4 * sx);
      const dz = (H(i, j + 2) - H(i, j - 2)) / (4 * sz);
      const l = Math.hypot(dx, 1, dz);
      nrm.set([-dx / l, 1 / l, -dz / l], k * 3);
      const at2 = t.renderAt(x, z);
      t.floorColour(x, z, h, c);
      if (at2.cell)
        c.lerp(
          t.rockColour(at2.cell, r),
          THREE.MathUtils.smoothstep(Math.max(at2.rock, h), 0.25, 1.3),
        );
      col.set([c.r, c.g, c.b], k * 3);
      off[k] = t.snowOff(x, z, h, at2.cell);
    }
    if (j % 24 === 23) yield;
  }
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("snowOff", new THREE.BufferAttribute(off, 1));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, material);
  // Drawn as it is (not batched), chunk by chunk; never nudged off a road.
  mesh.userData.terrain = true;
  mesh.userData.spansRoad = true;
  return mesh;
}

/** A road's stretch on wooden stilts: planks across, posts down into the gap, braces, rails. */
export function stiltDeck(pts: P3[], floor: (x: number, z: number) => number): G {
  const wood = "#b98a62";
  const dark = "#8f6a4c";
  const parts: G[] = [];
  let along = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as P3;
    const b = pts[i + 1] as P3;
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    const nx = Math.cos(yaw);
    const nz = -Math.sin(yaw);
    for (let d = 0; d < len; d += 0.42) {
      const f = d / len;
      const x = a[0] + (b[0] - a[0]) * f;
      const y = a[1] + (b[1] - a[1]) * f;
      const z = a[2] + (b[2] - a[2]) * f;
      parts.push(
        at(
          rbox(4.6, 0.12, 0.36, Math.floor((along + d) / 0.42) % 3 === 0 ? "#d2ad84" : wood, 0.02),
          x,
          y - 0.12,
          z,
          yaw,
        ),
      );
      if (Math.floor((along + d) / 4) !== Math.floor((along + d + 0.42) / 4))
        for (const sgn of [-1, 1]) {
          const px = x + nx * 2.1 * sgn;
          const pz = z + nz * 2.1 * sgn;
          // Each post reaches right down to the rock under it, on a stone footing.
          const fy = floor(px, pz);
          const len = Math.max(0.4, y - 0.12 - fy + 0.25);
          parts.push(at(drum(0.15, len, dark, 0.04, 8), px, y - 0.12 - len, pz));
          parts.push(at(rbox(0.55, 0.3, 0.55, "#cdbfb2", 0.08), px, fy - 0.12, pz));
          parts.push(at(rbox(0.12, 0.9, 0.12, dark, 0.03), px, y, pz));
        }
    }
    along += len;
    for (const sgn of [-1, 1])
      parts.push(
        at(
          rbox(0.1, 0.1, len, wood, 0.03),
          (a[0] + b[0]) / 2 + nx * 2.1 * sgn,
          (a[1] + b[1]) / 2 + 0.8,
          (a[2] + b[2]) / 2 + nz * 2.1 * sgn,
          yaw,
        ),
      );
  }
  return join(parts);
}

function* build(scene: THREE.Scene): Generator<unknown, JourneyBuild, unknown> {
  yield;
  // The landmarks first: the land leaves each a level bench its size.
  const made = new Map<string, Landmark>();
  for (const k of Object.keys(ASTRO_LANDMARKS) as AstroLandmark[])
    if (k !== "monastery") made.set(k, ASTRO_LANDMARKS[k].make());
  const t = yield* ladakhWorldSteps({
    // The rock's edges rounded (with the terrain's 3 m border radius below), Umling La's
    // roadwork (U2: a wide col, no stilts high up, gentle fills, the grade following the
    // mountain), tidy junctions.
    edge: 3,
    colR: 34,
    stiltMinD: 45,
    fill: 0.75,
    follow: true,
    tidy: true,
    footprint: (key) => {
      const lm = made.get(key);
      // The yaks graze the strip of shore between the lane and Pangong (their own pond isn't drawn).
      if (key === "lake") return { depth: 3.1, radius: 7 };
      return lm
        ? { depth: lm.half[1], radius: Math.hypot(lm.half[0], lm.half[1]) + 1.5 }
        : { depth: 3, radius: 5 };
    },
  });
  yield;
  const mat = clay(BASE);
  // Shadows drape over the land and darken what they fall on.
  const shadow = drapedShadow(heightsOf(t.ground));
  const H = (x: number, z: number) => t.heightAt(x, z);
  /** A static piece of scenery with its cut-paper shadow, kept exactly where it's put. */
  const place = (geo: THREE.BufferGeometry, x: number, z: number, yaw = 0, s = 1, y = H(x, z)) => {
    for (const m of [mat, shadow]) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.rotation.y = yaw;
      mesh.scale.setScalar(s);
      mesh.frustumCulled = m !== shadow;
      mesh.userData.spansRoad = true;
      scene.add(mesh);
    }
  };
  /** Boards and labels (they keep their own materials). */
  const hang = (boards: THREE.Object3D[], x: number, z: number, yaw = 0, y = H(x, z)) => {
    for (const b of boards) {
      const holder = new THREE.Group();
      holder.position.set(x, y, z);
      holder.rotation.y = yaw;
      holder.userData.spansRoad = true;
      holder.add(b);
      scene.add(holder);
    }
  };

  /** Flat things lying on the land (roads, water, fields): never nudged off the roads. */
  const lay = (...objs: THREE.Object3D[]) => {
    for (const o of objs) {
      o.userData.spansRoad = true;
      scene.add(o);
    }
  };

  // The land: the engine's grid (not drawn), the valley's mesh, the mountains in chunks.
  const ground = new THREE.Mesh(t.ground, mat);
  const rockMat = rockMaterial(mat.matcap as THREE.Texture, t.snowline, "cap", 0, true);
  rockMat.vertexColors = true;
  // The valley in pieces (8 across, 2 deep), so the camera draws only those in view.
  for (const [z0, z1] of [
    [-ZB, 0],
    [0, ZB],
  ] as const)
    for (let k = 0; k < 8; k++)
      scene.add(
        yield* terrainPiece(
          t,
          rockMat,
          -TW / 2 + (k * TW) / 8,
          -TW / 2 + ((k + 1) * TW) / 8,
          z0,
          z1,
          1,
          3,
        ),
      );
  for (const [z0, z1] of [
    [ZB, TD / 2],
    [-TD / 2, -ZB],
  ] as const)
    for (let k = 0; k < 8; k++)
      scene.add(
        yield* terrainPiece(
          t,
          rockMat,
          -TW / 2 + (k * TW) / 8,
          -TW / 2 + ((k + 1) * TW) / 8,
          z0,
          z1,
          0.6,
          3,
        ),
      );

  // Roads: binned segments, for "how far from a road" everywhere below.
  const segs: { ax: number; az: number; bx: number; bz: number; half: number }[] = [];
  for (const r of t.roads)
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i] as P3;
      const b = r.pts[i + 1] as P3;
      segs.push({ ax: a[0], az: a[2], bx: b[0], bz: b[2], half: r.half });
    }
  const bins = new Map<string, number[]>();
  const BIN = 12;
  segs.forEach((s, k) => {
    for (
      let gx = Math.floor((Math.min(s.ax, s.bx) - 4) / BIN);
      gx <= Math.floor((Math.max(s.ax, s.bx) + 4) / BIN);
      gx++
    )
      for (
        let gz = Math.floor((Math.min(s.az, s.bz) - 4) / BIN);
        gz <= Math.floor((Math.max(s.az, s.bz) + 4) / BIN);
        gz++
      ) {
        const key = `${gx},${gz}`;
        const l = bins.get(key) ?? [];
        l.push(k);
        bins.set(key, l);
      }
  });
  /** Clearance from the nearest road's edge (m); large when no road is near. */
  const roadGap = (x: number, z: number) => {
    let best = 99;
    for (const k of bins.get(`${Math.floor(x / BIN)},${Math.floor(z / BIN)}`) ?? []) {
      const s = segs[k] as (typeof segs)[number];
      const dx = s.bx - s.ax;
      const dz = s.bz - s.az;
      const l2 = dx * dx + dz * dz || 1;
      const u = Math.min(1, Math.max(0, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
      best = Math.min(best, Math.hypot(s.ax + dx * u - x, s.az + dz * u - z) - s.half);
    }
    return best;
  };
  const riverAt = (x: number) => {
    const i = Math.round((x + TW / 2) / 2);
    return (t.river[Math.max(0, Math.min(t.river.length - 1, i))] as Pt)[1];
  };
  const inLake = (x: number, z: number, m = 0) =>
    Math.abs(x - t.lake.x) < t.lake.a + m && Math.abs(z - t.lake.mid(x)) < t.lake.half(x) + m;
  const nearBridge = (x: number, z: number, m: number) =>
    t.bridges.some((b) => Math.hypot(b.x - x, b.z - z) < BRIDGE.len / 2 + m);

  // Water: the river (banked, banded) and Pangong (pale shallows to deep blue).
  for (const [w, c, y] of [
    [t.riverHalf + 1, mix(BASE, "#f4dcb8", 0.5), 0.02],
    [t.riverHalf, mix(P.aqua, "#ffffff", 0.45), 0.03],
    [t.riverHalf * 0.5, P.aqua, 0.04],
  ] as const)
    lay(ribbon(t.river, w, c, y));
  const lakeRing = (k: number) =>
    t.lake.outline.map(([x, z]): Pt => {
      const mz = t.lake.mid(x);
      return [t.lake.x + (x - t.lake.x) * (1 + (k - 1) * 0.12), mz + (z - mz) * k];
    });
  lay(
    flatShape(lakeRing(1.1), mix(BASE, "#f4dcb8", 0.5), 0.03),
    flatShape(lakeRing(1), "#bfe6df", 0.05),
    flatShape(lakeRing(0.82), "#5cc6c8", 0.07),
    flatShape(lakeRing(0.5), "#3f97c4", 0.09),
    flatShape(lakeRing(0.22), "#2f6fae", 0.11),
  );
  yield;

  // Roads: continuous strips on the land, their surface turning from paved to gravel
  // gradually (loose stones through each change); on the mountain, the stilt bits are decks
  // instead; they stop short of the bridges.
  const stones: { x: number; z: number; y: number; s: number }[] = [];
  let ss = 4242;
  const srnd = () => {
    ss = (ss * 16807) % 2147483647;
    return ss / 2147483647;
  };
  /** On another road's surface (not road `ri`)? */
  const onOther = (ri: number, x: number, z: number) =>
    t.roads.some((o, oi) => {
      if (oi === ri) return false;
      for (let i = 0; i < o.pts.length - 1; i++) {
        const a = o.pts[i] as P3;
        const b = o.pts[i + 1] as P3;
        if (Math.min(a[0], b[0]) - o.half > x || Math.max(a[0], b[0]) + o.half < x) continue;
        if (Math.min(a[2], b[2]) - o.half > z || Math.max(a[2], b[2]) + o.half < z) continue;
        const dx = b[0] - a[0];
        const dz = b[2] - a[2];
        const l2 = dx * dx + dz * dz || 1;
        const u = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[2]) * dz) / l2));
        if (Math.hypot(a[0] + dx * u - x, a[2] + dz * u - z) < o.half - 0.05) return true;
      }
      return false;
    });
  /**
   * A road's points with its ends cut exactly at the edge of any road it joins (so it never
   * lies across the other road; the fillets carry the corners), and which original point each is.
   */
  const trimmed = (ri: number): { pts: P3[]; orig: number[] } => {
    const r = t.roads[ri] as WorldTile["roads"][number];
    const pts = r.pts.map((p) => [...p] as P3);
    const orig = pts.map((_, i) => i);
    const edge = (inside: P3, outside: P3): P3 => {
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 14; k++) {
        const m = (lo + hi) / 2;
        const x = inside[0] + (outside[0] - inside[0]) * m;
        const z = inside[2] + (outside[2] - inside[2]) * m;
        if (onOther(ri, x, z)) lo = m;
        else hi = m;
      }
      return [
        inside[0] + (outside[0] - inside[0]) * hi,
        inside[1] + (outside[1] - inside[1]) * hi,
        inside[2] + (outside[2] - inside[2]) * hi,
      ];
    };
    let a = 0;
    while (a < pts.length - 1 && onOther(ri, (pts[a] as P3)[0], (pts[a] as P3)[2])) a++;
    let b = pts.length - 1;
    while (b > a && onOther(ri, (pts[b] as P3)[0], (pts[b] as P3)[2])) b--;
    const outP = pts.slice(a, b + 1);
    const outI = orig.slice(a, b + 1);
    if (a > 0) {
      outP.unshift(edge(pts[a - 1] as P3, pts[a] as P3));
      outI.unshift(a);
    }
    if (b < pts.length - 1) {
      outP.push(edge(pts[b + 1] as P3, pts[b] as P3));
      outI.push(b);
    }
    return { pts: outP, orig: outI };
  };
  for (const [ri, r] of t.roads.entries()) {
    const cols = roadColours(r);
    const cut = trimmed(ri);
    const lift = r.kind === "main" ? 0.07 : r.kind === "track" ? 0.055 : 0.04;
    let run: P3[] = [];
    let rc: THREE.Color[] = [];
    let onStilts = r.stilt?.[0] === true;
    const flush = () => {
      if (run.length > 1) {
        if (onStilts) {
          const deck = new THREE.Mesh(
            stiltDeck(run, (x, z) => t.renderAt(x, z).h),
            mat,
          );
          deck.userData.spansRoad = true;
          scene.add(deck);
        } else {
          const m = gradedRoad(run, rc, r.half, lift);
          if (m) lay(m);
        }
      }
      run = [];
      rc = [];
    };
    cut.pts.forEach((p, j) => {
      const i = cut.orig[j] as number;
      if (nearBridge(p[0], p[2], -0.4)) {
        flush();
        return;
      }
      const st = r.stilt?.[i] === true;
      if (st !== onStilts) {
        run.push(p);
        rc.push(cols[i] as THREE.Color);
        flush();
        onStilts = st;
      }
      run.push(p);
      rc.push(cols[i] as THREE.Color);
      const g0 = r.grit[i] ?? 0;
      if (g0 > 0.12 && g0 < 0.88 && !st)
        for (let k = 0; k < 3; k++) {
          const a2 = srnd() * Math.PI * 2;
          const d = srnd() * r.half * 0.9;
          stones.push({
            x: p[0] + Math.cos(a2) * d,
            z: p[2] + Math.sin(a2) * d,
            y: p[1] + lift + 0.01,
            s: 0.06 + srnd() * 0.08,
          });
        }
    });
    flush();
  }
  // Where roads meet: the corners filled with rounded fillets in the joining road's colour.
  for (const a of junctionAprons(t.roads))
    lay(flatShape(a.pts, `#${a.colour.getHexString()}`, a.y + 0.075));
  if (stones.length) {
    const geo = new THREE.CircleGeometry(1, 6);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color: "#c9a77f", toneMapped: false }),
      stones.length,
    );
    const m4 = new THREE.Matrix4();
    stones.forEach((st, i) => {
      m.setMatrixAt(i, m4.makeScale(st.s, 1, st.s).setPosition(st.x, st.y, st.z));
    });
    m.computeBoundingSphere();
    lay(m);
  }
  // The ford (F2): a low stone causeway across the river, water spilling over it,
  // black-and-yellow marker posts either side.
  {
    const { x, z } = t.ford;
    const half = t.riverHalf + 1.2;
    lay(
      flatShape(
        [
          [x - 2, z - half],
          [x + 2, z - half],
          [x + 2, z + half],
          [x - 2, z + half],
        ],
        "#d8cfc4",
        0.06,
      ),
    );
    for (let k = -Math.floor(half); k <= Math.floor(half); k++)
      lay(
        ribbon(
          [
            [x - 2, z + k + 0.2],
            [x + 2, z + k + 0.2],
          ],
          0.06,
          mix(P.aqua, "#ffffff", 0.5),
          0.065,
        ),
      );
    for (const sx of [-1, 1])
      for (const pz of [-half + 0.6, 0, half - 0.6]) {
        place(drum(0.08, 1.1, "#2a2730", 0.02, 8), x + sx * 2.3, z + pz, 0, 1, 0);
        place(drum(0.085, 0.3, "#f2c64b", 0.02, 8), x + sx * 2.3, z + pz, 0, 1, 0.5);
      }
  }
  // Wooden bridges where the lanes cross the river: log cribs with prayer flags (B1),
  // and cantilevered logs with a little roofed gate (B2), turn about.
  t.bridges.forEach((b, i) => {
    for (const m of [mat, shadow]) {
      const mesh = new THREE.Mesh(
        woodBridge(i % 2 ? "cantilever" : "crib", BRIDGE.len, BRIDGE.width),
        m,
      );
      mesh.position.set(b.x, 0, b.z);
      mesh.rotation.y = b.yaw;
      mesh.frustumCulled = m !== shadow;
      mesh.userData.spansRoad = true;
      mesh.userData.bridge = true;
      scene.add(mesh);
    }
  });
  // Scree tumbled down the fill below the mountain roads.
  if (t.scree.length) {
    const geos = [0, 1, 2, 3].map((k) => rockGeometry(90 + k, "boulder"));
    const rm = rockMaterial(mat.matcap as THREE.Texture, 1e4, "cap", 0);
    const tone = new THREE.Color("#cdb7a6");
    for (let v = 0; v < 4; v++) {
      const list = t.scree.filter((_, i) => i % 4 === v);
      const m = new THREE.InstancedMesh(geos[v] as G, rm, list.length);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      list.forEach((sc, i) => {
        q.setFromEuler(new THREE.Euler(sc.yaw * 0.2, sc.yaw, sc.yaw * 0.1));
        m.setMatrixAt(
          i,
          m4.compose(
            new THREE.Vector3(sc.x, sc.y, sc.z),
            q,
            new THREE.Vector3(sc.s, sc.s * 0.7, sc.s),
          ),
        );
        m.setColorAt(i, tone.clone().offsetHSL(0, 0, (i % 5) * 0.012 - 0.024));
      });
      m.userData.spansRoad = true;
      for (const part of chunked(m)) scene.add(part);
    }
  }
  yield;

  const blockers: WorldData["blockers"] = [];
  const walls: [number, number, number, number][] = [];
  const lamps: NonNullable<WorldData["lamps"]> = [];
  const houses: NonNullable<WorldData["mapArt"]>["houses"] = [];
  /** Local (x, z) of something turned by yaw at (ox, oz), in the world. */
  const toWorld = (ox: number, oz: number, yaw: number, lx: number, lz: number): Pt => {
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    return [ox + c * lx + sn * lz, oz - sn * lx + c * lz];
  };

  // The big monastery (after Tawang): the Wiki stop.
  const [mx, mz] = t.monastery;
  const tawang = tawangMonastery();
  tawang.computeBoundingBox();
  place(tawang, mx, mz, 0, 1, 0);
  {
    const sol = tawangSolids();
    for (const [x0, z0, x1, z1] of sol.walls) walls.push([mx + x0, mz + z0, mx + x1, mz + z1]);
    for (const [x, z, r] of sol.circles) blockers.push({ x: mx + x, z: mz + z, r });
    for (const [x, y, z, r] of [
      [0, 2.4, 14.6, 3.6],
      [0, 1.2, 5, 4],
      [-13, 1, 1, 3],
      [13, 1, 1, 3],
      [-13, 1, 10, 3],
      [13, 1, 10, 3],
      [0, 4, -6, 4.5],
    ] as const)
      lamps.push({ x: mx + x, y, z: mz + z, r });
    houses.push({ x: mx, z: mz, yaw: 0, s: 18 });
  }
  // Small gompas, each with its chorten and a lhatho of flags.
  for (const [gx, gz] of t.gompas) {
    const yaw = (Math.abs(Math.round(gx * 7)) % 3) * 0.2 - 0.2;
    place(smallGompa(), gx, gz, yaw);
    blockers.push({ x: gx, z: gz, r: 2.6 });
    const [cx, cz] = toWorld(gx, gz, yaw, 3.6, 1.6);
    blockers.push({ x: cx, z: cz, r: 0.6 });
    const [lx, lz] = toWorld(gx, gz, yaw, 0, 3);
    lamps.push({ x: lx, y: 1, z: lz, r: 2.6 });
    houses.push({ x: gx, z: gz, yaw, s: 2.4 });
  }
  yield;

  // The stops' landmarks, each on its bench beside its road.
  const marks: {
    key: string;
    x: number;
    z: number;
    y: number;
    yaw: number;
    top: number;
    road: number;
    i: number;
  }[] = [];
  for (const s of t.sites) {
    if (s.key === "monastery") {
      marks.push({ ...s, top: (tawang.boundingBox as THREE.Box3).max.y });
      continue;
    }
    const lm = made.get(s.key);
    if (!lm) continue;
    const holder = new THREE.Group();
    holder.position.set(s.x, s.y, s.z);
    holder.rotation.y = s.yaw;
    holder.userData.spansRoad = true;
    for (const m of [mat, shadow]) {
      const mesh = new THREE.Mesh(lm.body, m);
      mesh.frustumCulled = m !== shadow;
      holder.add(mesh);
    }
    for (const sg of lm.signs) holder.add(sg);
    scene.add(holder);
    for (const [lx, lz, r] of lm.solids) {
      const [x, z] = toWorld(s.x, s.z, s.yaw, lx, lz);
      blockers.push({ x, z, r });
    }
    for (const l of lm.lamps) {
      const [x, z] = toWorld(s.x, s.z, s.yaw, l.x, l.z);
      lamps.push({ x, y: s.y + l.y, z, r: l.r });
    }
    lm.body.computeBoundingBox();
    marks.push({ ...s, top: (lm.body.boundingBox as THREE.Box3).max.y });
    if (s.key !== "lake")
      houses.push({ x: s.x, z: s.z, yaw: s.yaw, s: Math.max(...lm.half) * 0.8 });
  }
  const nearSite = (x: number, z: number, m: number) =>
    marks.some((k) =>
      k.key === "monastery"
        ? Math.abs(x - k.x) < 26 + m && z > k.z - 19 - m && z < k.z + 17 + m
        : Math.hypot(x - k.x, z - k.z) < 6 + m,
    );
  yield;

  // Hamlets: a handful of whitewashed homes each, turned to face their lane, with fields.
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const homes: { x: number; z: number; yaw: number; s: number }[] = [];
  for (const h of t.hamlets) {
    const n = 5 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd() * 0.6;
      const r = 2.5 + rnd() * 5.5;
      const x = h.x + Math.cos(a) * r;
      const z = h.z + Math.sin(a) * r * 0.75;
      const s = 0.8 + rnd() * 0.35;
      if (roadGap(x, z) < 2.6 * s || nearSite(x, z, 2) || H(x, z) > 0.5) continue;
      if (homes.some((o) => Math.hypot(o.x - x, o.z - z) < 3.4)) continue;
      homes.push({ x, z, yaw: h.face + Math.round((rnd() - 0.5) * 2) * (Math.PI / 4), s });
    }
    const fx = h.x + (rnd() < 0.5 ? -14 : 14);
    if (roadGap(fx, h.z) > 6 && H(fx, h.z) < 0.1 && !nearSite(fx, h.z, 6))
      lay(barleyTerraces(fx, h.z, 0, 2, 3));
  }
  {
    // Hamlet homes, in chunks the camera can cull, at the lighter toy detail (seen small).
    const geo = lightToys(() => ladakhiHouse(1));
    for (const o of homes) {
      blockers.push({ x: o.x, z: o.z, r: 1.7 * o.s });
      lamps.push({ x: o.x, y: 0.8, z: o.z, r: 2.8 });
      houses.push({ x: o.x, z: o.z, yaw: o.yaw, s: 1.6 * o.s });
    }
    const { meshes } = instancedToys(
      geo,
      mat,
      shadow,
      homes.map((o) => ({ x: o.x, y: 0, z: o.z, yaw: o.yaw, scale: o.s })),
    );
    for (const m of meshes) {
      m.userData.spansRoad = true;
      scene.add(m);
    }
  }
  // Barley by the monastery town, too.
  lay(barleyTerraces(mx + 40, mz + 4, 0.1, 3, 4));
  yield;

  // Road life: Umling La's board and lhatho on the crest, BRO slogans on the hairpins,
  // milestones along the valley road, army trucks pulled over, chortens and mani walls.
  {
    const [px, py, pz] = t.pass;
    const bd = broSign(["UMLING LA", "5,798 M · 19,024 FT", "HIGHEST MOTORABLE PASS"]);
    place(bd.body, px + 5, pz - 4, 0, 1, py);
    hang(bd.boards, px + 5, pz - 4, 0, py);
    blockers.push({ x: px + 5, z: pz - 4, r: 0.5 });
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const lhatho = [drum(0.09, 4.2, "#b98a62", 0.03, 8)];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI;
      lhatho.push(
        flagString(V(0, 4.1, 0), V(Math.cos(a) * 7, 0.2, -Math.abs(Math.sin(a)) * 5 - 1), 0.4),
      );
    }
    for (const g of lhatho) place(g, px - 4, pz - 3, 0, 1, py);
    blockers.push({ x: px - 4, z: pz - 3, r: 0.3 });
  }
  {
    let n = 0;
    for (const ri of [0, 1]) {
      const road = t.roads[ri] as WorldTile["roads"][number];
      const r = road.pts;
      for (let i = 2; i < r.length - 2; i++) {
        const [x, , z] = r[i] as P3;
        const a = Math.abs(x - t.pass[0]);
        const pa = Math.abs((r[i - 1] as P3)[0] - t.pass[0]);
        const na = Math.abs((r[i + 1] as P3)[0] - t.pass[0]);
        // (Not beside a bend that's out on stilts.)
        if (!(a > 21 && a >= pa && a > na) || road.stilt?.[i]) continue;
        // On the outside of the bend (the inside is too tight).
        const sx = x + Math.sign(x - t.pass[0]) * 4.4;
        if (nearSite(sx, z, 1)) continue;
        const sy = t.heightAt(sx, z);
        const sign = broSign(BRO_SLOGANS[n++ % BRO_SLOGANS.length] as string[]);
        // Turned to the camera (it always sits to the south-east), so the slogans read.
        const yaw = Math.PI / 4;
        place(sign.body, sx, z, yaw, 1, sy);
        hang(sign.boards, sx, z, yaw, sy);
        blockers.push({ x: sx, z, r: 0.5 });
      }
    }
  }
  {
    const vr = (t.roads[2] as WorldTile["roads"][number]).pts;
    const places = ["HANLE", "NYOMA", "LOMA", "UMLING LA"];
    for (let k = 0; k < 9; k++) {
      const q = vr[Math.floor(((k + 0.5) / 9) * (vr.length - 1))] as P3;
      const [x, , z] = q;
      const sx = x;
      const sz = z - 3.6;
      if (nearSite(sx, sz, 1) || inLake(sx, sz, 3)) continue;
      const ms = milestone(places[k % places.length], 12 + k * 7);
      place(ms.body, sx, sz, 0, 1, 0);
      hang(ms.boards, sx, sz, 0, 0);
      blockers.push({ x: sx, z: sz, r: 0.35 });
    }
    // Army trucks, pulled onto the verge.
    for (const [fx, side] of [
      [-0.22, -1],
      [0.71, -1],
    ] as const) {
      const q = vr[Math.floor(fx * vr.length + vr.length / 2) % vr.length] as P3;
      const [x, , z] = q;
      const tz = z + side * 5.2;
      if (nearSite(x, tz, 3)) continue;
      place(armyTruck(), x, tz, 0, 1, H(x, tz));
      for (const dx of [-1.6, 0, 1.6]) blockers.push({ x: x + dx, z: tz, r: 1.2 });
    }
    // Chortens in a row and a mani wall where the monastery lane leaves the road.
    const lp = (t.roads[7] as WorldTile["roads"][number]).pts;
    const fork = lp[0] as P3;
    for (let k = 0; k < 4; k++) {
      const x = fork[0] + 6 + k * 3.2;
      const z = fork[2] - 6.5;
      if (roadGap(x, z) < 1.6 || nearSite(x, z, 1)) continue;
      place(chorten(0.9), x, z, 0, 1, 0);
      blockers.push({ x, z, r: 1 });
    }
    {
      const end = lp[lp.length - 1] as P3;
      const x = end[0] - 10;
      const z = end[2] - 5.5;
      if (roadGap(x, z) > 1.2 && !nearSite(x, z, 1)) {
        place(maniWall(9), x, z, 0, 1, 0);
        for (const dx of [-3.5, 0, 3.5]) blockers.push({ x: x + dx, z, r: 0.8 });
      }
    }
  }
  // The prayer-flag gate jump (G2): a ramp off the valley road, flying through a chorten gate.
  const ramps: Ramp[] = [];
  {
    const vr = (t.roads[2] as WorldTile["roads"][number]).pts;
    const q = vr[Math.round(((-60 + TW / 2) / TW) * (vr.length - 1))] as P3;
    const x = q[0];
    const z = q[2] - 5;
    const yaw = Math.PI;
    place(flagGate("chorten"), x, z, yaw, 1, 0);
    ramps.push({ x, z, yaw, w: 2.2, len: 3.2, h: 0.95 });
    for (const s of [-1, 1]) {
      const [bx, bz] = toWorld(x, z, yaw, s * 2.1, 4.2);
      blockers.push({ x: bx, z: bz, r: 0.6 });
    }
  }
  // Yaks grazing: by Pangong's east shore and out in the south fields.
  for (const [cx, cz, n] of [
    [t.lake.x + 50, t.lake.mid(t.lake.x + 50) - 20, 5],
    [-190, riverAt(-190) - 45, 6],
  ] as const) {
    for (let k = 0; k < n; k++) {
      const x = cx + (rnd() - 0.5) * 10;
      const z = cz + (rnd() - 0.5) * 6;
      if (roadGap(x, z) < 2 || inLake(x, z, 1) || nearSite(x, z, 1)) continue;
      place(yak(["#4a3b36", "#2f2826", "#5a4a42"][k % 3]), x, z, rnd() * 6);
      blockers.push({ x, z, r: 0.8 });
    }
  }
  yield;

  // The toys: Leh-like groves of light-green poplars and pines along the green floor;
  // sea-buckthorn and stones on the sand and up the slopes.
  type Toy = { id: string; tint?: string; x: number; z: number; yaw: number; scale: number };
  const toys: Toy[] = [];
  const free = (x: number, z: number, m: number) =>
    roadGap(x, z) > m &&
    Math.abs(z - riverAt(x)) > 4.5 &&
    !inLake(x, z, 4) &&
    !nearSite(x, z, 2) &&
    !t.gompas.some(([gx, gz]) => Math.hypot(gx - x, gz - z) < 6) &&
    !homes.some((o) => Math.hypot(o.x - x, o.z - z) < 3) &&
    !nearBridge(x, z, 2);
  for (let k = 0; k < 1800; k++) {
    const x = -TW / 2 + rnd() * TW;
    const z = riverAt(x) + (rnd() - 0.5) * 160;
    if (H(x, z) > 0.6 || !free(x, z, 1.8)) continue;
    const pine = rnd() < 0.45;
    toys.push({
      id: pine ? "T2" : "T3",
      tint: rnd() < 0.6 ? "pistachio" : "mint",
      x,
      z,
      yaw: rnd() * 6,
      scale: 0.75 + rnd() * 0.45,
    });
  }
  for (let k = 0; k < 1100; k++) {
    const x = -TW / 2 + rnd() * TW;
    const z = -ZB - 10 + rnd() * (2 * ZB + 20);
    if (!free(x, z, 1)) continue;
    const h = H(x, z);
    const roll = rnd();
    // (Not up on the carved rock: only on the floor and the low ground.)
    if (h > 3) continue;
    const id = roll < 0.25 && h < 8 ? "B3" : roll < 0.6 ? "R2" : "R5";
    toys.push({
      id,
      ...(id === "B3" ? { tint: "pistachio" } : {}),
      x,
      z,
      yaw: rnd() * 6,
      scale: id === "B3" ? 0.7 : 0.6 + rnd() * 0.8,
    });
  }
  const groups = new Map<string, (Toy & { y: number })[]>();
  const knocks: (Omit<NonNullable<WorldData["knockables"]>[number], "hide"> & {
    key: string;
    slot: number;
  })[] = [];
  const placed = new Map<string, ToySlot[]>();
  for (const p of toys) {
    const k = `${p.id}:${p.tint ?? ""}:${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}`;
    const list = groups.get(k) ?? [];
    const knock = knockable(p.id, p.scale);
    if (knock)
      knocks.push({
        id: p.id,
        ...(p.tint ? { tint: p.tint } : {}),
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        scale: p.scale,
        ...knock,
        key: k,
        slot: list.length,
      });
    list.push({ ...p, y: H(p.x, p.z) });
    groups.set(k, list);
    const r = solidity(p.id, p.scale);
    if (r > 0.15)
      blockers.push(
        p.id.startsWith("R")
          ? { x: p.x, z: p.z, r, h: ((toy(p.id).boundingBox as THREE.Box3).max.y || 1) * p.scale }
          : { x: p.x, z: p.z, r },
      );
  }
  {
    let n = 0;
    for (const [k, ps] of groups) {
      const [id, tint] = k.split(":") as [string, string, string];
      const { meshes, at } = instancedToys(toy(id, tint || undefined), mat, shadow, ps);
      for (const m of meshes) scene.add(m);
      placed.set(k, at);
      if (++n % 8 === 0) yield;
    }
  }
  yield;

  // ── the world data the ride engine needs ──
  const roads: WorldData["roads"] = [];
  for (const r of t.roads) {
    roads.push({
      road: makeRoad(
        r.pts.map((q) => [q[0], q[2]] as V2),
        H,
        false,
        4,
        // No corner-cutting: the ride follows the road exactly as drawn (hairpins included).
        0,
      ),
      // (A mountain road's whole level shelf rides as road, not just its paved width.)
      width: (r.half + (r.kind === "main" && r.stilt ? 1 : 0)) * 2,
      closed: false,
    });
    yield;
  }
  yield;
  // The river, and Pangong as broad strokes along its middle (narrower towards its ends).
  const water: WorldData["water"] = [{ pts: t.river as V2[], width: t.riverHalf * 2 }];
  for (let k = 0; k < 8; k++) {
    const x0 = t.lake.x - t.lake.a * 0.95 + (k / 8) * t.lake.a * 1.9;
    const x1 = x0 + (t.lake.a * 1.9) / 8;
    const xm = (x0 + x1) / 2;
    const w = 2 * t.lake.half(xm) * 0.9;
    if (w < 1) continue;
    water.push({
      pts: [
        [x0, t.lake.mid(x0)],
        [x1, t.lake.mid(x1)],
      ],
      width: w,
    });
  }
  // Bridge parapets are walls; their decks are road, humped.
  for (const b of t.bridges) {
    const fx = Math.sin(b.yaw);
    const fz = Math.cos(b.yaw);
    const half = BRIDGE.width / 2 - 0.15;
    for (const s of [-1, 1]) {
      const ox = Math.cos(b.yaw) * s * half;
      const oz = -Math.sin(b.yaw) * s * half;
      walls.push([
        b.x + ox - (fx * BRIDGE.len) / 2,
        b.z + oz - (fz * BRIDGE.len) / 2,
        b.x + ox + (fx * BRIDGE.len) / 2,
        b.z + oz + (fz * BRIDGE.len) / 2,
      ]);
    }
  }
  const tOn = (road: Road, x: number, z: number) => {
    let best = { t: 0, d: Number.POSITIVE_INFINITY };
    for (let i = 0; i <= 900; i++) {
      const p = road.at(i / 900).p;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best.d) best = { t: i / 900, d };
    }
    return best.t;
  };
  const stops: WorldData["stops"] = [];
  for (const m of marks) {
    const r = roads[m.road];
    const q = t.roads[m.road]?.pts[m.i];
    if (!r || !q) continue;
    stops.push({
      x: m.x,
      z: m.z,
      road: r.road,
      t: tOn(r.road, q[0], q[2]),
      tag: m.key,
      top: m.top,
    });
  }
  const valley = roads[2] as WorldData["roads"][number];
  const sp = valley.road.at(tOn(valley.road, -40, 0));
  // Curbs (invisible) along the mountain roads (never across one).
  for (const c of t.curbs) walls.push(c);
  // A coarse ground for the physics (the engine's grid is too fine to collide with cheaply).
  const physics = new THREE.PlaneGeometry(TW, TD, TW / 4, TD / 4);
  physics.rotateX(-Math.PI / 2);
  {
    const pp = physics.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) pp.setY(i, H(pp.getX(i), pp.getZ(i)));
  }
  const world: WorldData = {
    ground,
    physicsGround: new THREE.Mesh(physics),
    shadow,
    size: { w: TW, d: TD },
    roads,
    water,
    blockers,
    walls,
    decks: t.bridges.map((b) => ({
      pts: [
        [b.x - (Math.sin(b.yaw) * BRIDGE.len) / 2, b.z - (Math.cos(b.yaw) * BRIDGE.len) / 2],
        [b.x + (Math.sin(b.yaw) * BRIDGE.len) / 2, b.z + (Math.cos(b.yaw) * BRIDGE.len) / 2],
      ] as V2[],
      width: BRIDGE.width,
    })),
    ramps: [
      ...ramps,
      ...t.bridges.map((b) => ({
        x: b.x,
        z: b.z,
        yaw: b.yaw,
        w: BRIDGE.width,
        len: BRIDGE.len,
        // The deck: level a little above the water, its ends sloping down to the road.
        h: 0.6,
        hump: { base: 0 },
      })),
    ],
    lamps,
    knockables: knocks.map(({ key, slot, ...k }) => ({
      ...k,
      hide: () => {
        const at = placed.get(key)?.[slot];
        if (!at) return;
        at.mesh.setMatrixAt(at.slot, HIDDEN);
        at.mesh.instanceMatrix.needsUpdate = true;
      },
    })),
    mapArt: {
      ponds: [t.lake.outline as V2[]],
      rail: [],
      houses,
      rocks: toys
        .filter((p) => p.id.startsWith("R") && big(p.id, p.scale))
        .map((p) => ({ x: p.x, z: p.z, r: footprint(p.id) * p.scale * 0.8 })),
      trees: toys.filter((p) => p.id.startsWith("T")).map((p) => [p.x, p.z] as V2),
      bridges: t.bridges.map((b) => ({
        x: b.x,
        z: b.z,
        yaw: b.yaw,
        len: BRIDGE.len,
        width: BRIDGE.width,
      })),
    },
    stops,
    junctions: findJunctions(roads.map((r) => ({ road: r.road, closed: false }))),
    landmarks: {
      herd: { x: t.lake.x + 30, z: t.lake.mid(t.lake.x + 30) - 12 },
      monastery: { x: mx, z: mz },
    },
    spawn: { x: sp.p.x, z: sp.p.z, heading: sp.heading },
  };
  return {
    world,
    road: valley.road,
    moments: [],
    stops: [],
    mapZoom: Math.max(TW, TD),
    mapCentre: [0, 0],
  };
}

export const astroFlat: JourneyDef = {
  id: "astro",
  title: "AstroClub · Ladakh, flat (open world)",
  mood: "golden",
  bike: "adv",
  flat: { ground: BASE },
  build: (scene) => build(scene),
};
