/**
 * Mountains built from rocks (design; after the user's stacked-rock canyon
 * reference): chunky rocks with flat faces and soft, rounded edges (rounded
 * boxes, nudged out of true so no two are alike), stacked into tiers,
 * columns or boulder piles; and a clay material that lays snow on them with
 * a crisp line partway up each rock (white above, on the faces that look up
 * or everything above a cap line), not a blur.
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type RockShape = "slab" | "column" | "boulder" | "spire";

const rng = (seed: number) => {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

/**
 * One rock, about 1 m across at scale 1, standing on y = 0: a rounded box
 * (flat faces, rounded edges) whose eight corners are each pushed a little
 * (so its faces lean and its outline is irregular), tapering a touch upward.
 */
export function rockGeometry(seed: number, shape: RockShape): THREE.BufferGeometry {
  const r = rng(seed);
  const [w, h, d] =
    shape === "slab"
      ? [1, 0.42 + 0.18 * r(), 0.8 + 0.3 * r()]
      : shape === "column" || shape === "spire"
        ? [0.45 + 0.15 * r(), 1, 0.45 + 0.2 * r()]
        : [1, 0.75 + 0.3 * r(), 0.85 + 0.3 * r()];
  let g: THREE.BufferGeometry = new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.17);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g);
  const corner: [number, number, number][] = [];
  // A spire's top is cut on a slant (one side higher), so its point leans.
  const slant = shape === "spire" ? 0.1 + 0.08 * r() : 0;
  for (let c = 0; c < 8; c++)
    corner.push([
      (r() - 0.5) * 0.22 * w,
      (r() - 0.5) * 0.18 * h + (c & 4 ? (c & 1 ? slant : -slant) : 0),
      (r() - 0.5) * 0.22 * d,
    ]);
  const taper = shape === "spire" ? 0.34 : shape === "column" ? 0.12 : 0.18;
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = x / w + 0.5;
    const v = y / h + 0.5;
    const t = z / d + 0.5;
    let ox = 0;
    let oy = 0;
    let oz = 0;
    for (let c = 0; c < 8; c++) {
      const k = (c & 1 ? u : 1 - u) * (c & 2 ? t : 1 - t) * (c & 4 ? v : 1 - v);
      const o = corner[c] as [number, number, number];
      ox += o[0] * k;
      oy += o[1] * k;
      oz += o[2] * k;
    }
    const s = 1 - taper * v;
    pos.setXYZ(i, x * s + ox, y + oy + h / 2, z * s + oz);
  }
  g.computeVertexNormals();
  return g;
}

export type SnowMode = "tops" | "cap" | "both";

/**
 * Clay for rocks, with snow: white where a face looks up and is above the
 * snow line ("tops"), everything above the line ("cap"), or tops above the
 * line and everything a little higher ("both"). The line wanders gently, and
 * its edge is crisp (anti-aliased, not blurred). Rocks take their colour
 * from their instance colour.
 */
export function rockMaterial(
  matcap: THREE.Texture,
  line: number,
  mode: SnowMode = "both",
  cap = 8,
  /** The geometry carries its own snowline offset per vertex (attribute `snowOff`) instead of a gentle wave. */
  perVertex = false,
): THREE.MeshMatcapMaterial {
  const m = new THREE.MeshMatcapMaterial({ matcap, color: "#ffffff", toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnow = { value: line };
    sh.uniforms.uCap = { value: cap };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vW;
        varying vec3 vWN;
        varying float vOff;
        ${perVertex ? "attribute float snowOff;" : ""}`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vOff = ${perVertex ? "snowOff" : "0.0"};
        vec4 wp = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          wn = mat3(instanceMatrix) * wn;
        #endif
        vW = (modelMatrix * wp).xyz;
        vWN = normalize(mat3(modelMatrix) * wn);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;\nvarying float vOff;\nuniform float uSnow;\nuniform float uCap;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float line = uSnow + ${perVertex ? "vOff" : "sin(vW.x * 0.045 + vW.z * 0.02) * 2.2 + sin(vW.z * 0.07) * 1.4"};
        float e = max(fwidth(vW.y), 0.02);
        float above = smoothstep(line - e, line + e, vW.y);
        float up = smoothstep(0.42, 0.5, normalize(vWN).y);
        float capped = smoothstep(line + uCap - e, line + uCap + e, vW.y);
        float s = ${mode === "tops" ? "above * up" : mode === "cap" ? "above" : "max(above * up, capped)"};
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.975, 0.97, 0.965), s);`,
      );
  };
  return m;
}

/** A rock placed: where, how big (x, y, z), turned, tilted, its tone. */
export interface RockSpot {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  tilt: number;
  tone: THREE.Color;
  variant: number;
}

/** Rocks as instanced meshes, one per rock variant. */
export function rockMeshes(
  spots: RockSpot[],
  geos: THREE.BufferGeometry[],
  material: THREE.Material,
): THREE.InstancedMesh[] {
  const by = new Map<number, RockSpot[]>();
  for (const s of spots) {
    const l = by.get(s.variant) ?? [];
    l.push(s);
    by.set(s.variant, l);
  }
  const out: THREE.InstancedMesh[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const [v, list] of by) {
    const mesh = new THREE.InstancedMesh(geos[v] as THREE.BufferGeometry, material, list.length);
    list.forEach((s, i) => {
      e.set(s.tilt * 0.6, s.yaw, s.tilt, "YXZ");
      q.setFromEuler(e);
      mesh.setMatrixAt(
        i,
        m4.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.sx, s.sy, s.sz)),
      );
      mesh.setColorAt(i, s.tone);
    });
    mesh.frustumCulled = false;
    out.push(mesh);
  }
  return out;
}
