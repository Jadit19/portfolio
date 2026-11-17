/**
 * Static batching: bakes a subtree's meshes into one mesh per material *kind*
 * (same shading settings, any colour; colours move into vertex colours), so a
 * scene of thousands of small parts draws in a handful of calls.
 *
 * Objects that must keep moving on their own are preserved as live subtrees
 * (and batched internally): anything for which `keep(obj)` returns true.
 * Sprites, lights and textured meshes are kept as they are.
 */

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

interface Bucket {
  material: THREE.Material;
  cast: boolean;
  receive: boolean;
  geos: THREE.BufferGeometry[];
}

function hasMap(m: THREE.Material): boolean {
  return Boolean(
    (m as THREE.MeshStandardMaterial).map || (m as THREE.MeshStandardMaterial).alphaMap,
  );
}

type Plain = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;

/** Shading settings that must match to share a draw; colour is not one of them. */
function signature(m: THREE.Material): string | null {
  const p = m as Plain;
  const common = `${m.transparent ? 1 : 0}|${m.opacity}|${m.side}|${m.depthWrite ? 1 : 0}|${m.toneMapped ? 1 : 0}|${m.polygonOffset ? m.polygonOffsetFactor : "-"}`;
  if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
    const s = m as THREE.MeshStandardMaterial;
    if (s.emissive.getHex() !== 0) return null;
    return `std|${s.roughness}|${s.metalness}|${s.flatShading ? 1 : 0}|${common}`;
  }
  if ((m as THREE.MeshLambertMaterial).isMeshLambertMaterial) {
    return `lam|${(m as THREE.MeshLambertMaterial).flatShading ? 1 : 0}|${common}`;
  }
  if ((m as THREE.MeshBasicMaterial).isMeshBasicMaterial && p.color) return `basic|${common}`;
  return null;
}

const shared = new Map<string, THREE.Material>();
function sharedMaterial(sig: string, like: THREE.Material): THREE.Material {
  let m = shared.get(sig);
  if (!m) {
    m = like.clone();
    (m as Plain).color.set(0xffffff);
    m.vertexColors = true;
    shared.set(sig, m);
  }
  return m;
}

/** Position + normal (+ vertex colour) only, non-indexed, in the root's space. */
function bake(mesh: THREE.Mesh, toRoot: THREE.Matrix4, colour?: THREE.Color): THREE.BufferGeometry {
  let g = mesh.geometry.clone();
  g.applyMatrix4(toRoot);
  if (g.index) g = g.toNonIndexed();
  // Keep vertex colours when the material uses them (e.g. painted terrain).
  const keepColour = (mesh.material as THREE.Material).vertexColors && !colour;
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal" && !(keepColour && name === "color"))
      g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (colour) {
    const n = g.attributes.position?.count ?? 0;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = colour.r;
      c[i * 3 + 1] = colour.g;
      c[i * 3 + 2] = colour.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

/**
 * Returns a new group equivalent to `root` with static meshes batched.
 * `root` keeps its own transform; children are expressed in its local space.
 */
export function batch(
  root: THREE.Object3D,
  keep: (o: THREE.Object3D) => boolean = () => false,
): THREE.Group {
  const out = new THREE.Group();
  out.name = root.name;
  out.userData = { ...root.userData };
  out.position.copy(root.position);
  out.quaternion.copy(root.quaternion);
  out.scale.copy(root.scale);
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, Bucket>();

  const visit = (o: THREE.Object3D) => {
    for (const c of o.children) {
      const live = keep(c);
      // Hidden parts are dropped, except live ones (e.g. a jacket layer shown later).
      if (!c.visible && !live) continue;
      if (live) {
        // Live subtree: batch it on its own and re-parent with the same local transform.
        const copy = batch(c, keep);
        const m = inv.clone().multiply(c.parent?.matrixWorld ?? new THREE.Matrix4());
        copy.applyMatrix4(m);
        copy.visible = c.visible;
        out.add(copy);
        continue;
      }
      const mesh = c as THREE.Mesh;
      if (
        mesh.isMesh &&
        !Array.isArray(mesh.material) &&
        !hasMap(mesh.material) &&
        !(mesh as unknown as THREE.InstancedMesh).isInstancedMesh
      ) {
        const mat = mesh.material;
        const sig = mat.vertexColors ? null : signature(mat);
        const shadow = `${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`;
        const key = sig ? `${sig}|${shadow}` : `${mat.uuid}|${shadow}`;
        let b = buckets.get(key);
        if (!b) {
          const material = sig ? sharedMaterial(sig, mat) : mat;
          b = { material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [] };
          buckets.set(key, b);
        }
        const colour = sig ? (mat as Plain).color : undefined;
        b.geos.push(bake(mesh, inv.clone().multiply(mesh.matrixWorld), colour));
        visit(c);
        continue;
      }
      if (
        mesh.isMesh ||
        (c as THREE.Sprite).isSprite ||
        (c as THREE.Light).isLight ||
        (c as THREE.Points).isPoints ||
        (c as THREE.Line).isLine
      ) {
        // Keep as is (textured, sprite, light…), in root space.
        const clone = c.clone(false);
        clone.matrixAutoUpdate = true;
        // Instanced copies share their instances (so a piece hidden later, e.g.
        // a shrub taken over by physics, disappears from every copy).
        const inst = c as THREE.InstancedMesh;
        if (inst.isInstancedMesh) {
          (clone as THREE.InstancedMesh).instanceMatrix = inst.instanceMatrix;
          if (inst.instanceColor) (clone as THREE.InstancedMesh).instanceColor = inst.instanceColor;
        }
        const m = inv.clone().multiply(c.matrixWorld);
        m.decompose(clone.position, clone.quaternion, clone.scale);
        out.add(clone);
        if (
          (c as THREE.SpotLight).isSpotLight ||
          (c as THREE.DirectionalLight).isDirectionalLight
        ) {
          const t = (c as THREE.SpotLight).target;
          if (t) out.add(t);
        }
      }
      visit(c);
    }
  };
  visit(root);

  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const m = new THREE.Mesh(merged, b.material);
    m.castShadow = b.cast;
    m.receiveShadow = b.receive;
    out.add(m);
  }
  return out;
}
