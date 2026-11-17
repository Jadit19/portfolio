/**
 * The tiny planet: open worlds bend gently away from the camera, like the
 * surface of a small planet whose curve you never notice. Near you the ground
 * is flat; far-off land, including the world repeating as it wraps round,
 * sinks below the horizon into the haze.
 *
 * Done in the vertex shader (only where things are drawn): physics, shadows
 * and lighting all stay in the flat world, so nothing else changes.
 */

import type * as THREE from "three";

/** Drop per metre² of distance from the camera (0 = flat). */
export const curve = { value: 0 };

/** A planet whose ground has dropped `drop` metres one `span` away (a whole tile). */
export function setCurve(drop: number, span: number): void {
  curve.value = drop / (span * span);
}

/** Bends every material under `root` (call again for things added later). */
export function bend(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) bendMaterial(mat);
  });
}

function bendMaterial(m: THREE.Material): void {
  // Custom shaders (the sky, particles) handle themselves.
  if (m.userData.curved || (m as THREE.ShaderMaterial).isShaderMaterial) return;
  m.userData.curved = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.uniforms.uCurve = curve;
    const header = "#include <common>\nuniform float uCurve;";
    if (shader.vertexShader.includes("#include <project_vertex>")) {
      shader.vertexShader = shader.vertexShader.replace("#include <common>", header).replace(
        "#include <project_vertex>",
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 curvedW = modelMatrix * mvPosition;
        vec2 fromEye = curvedW.xz - cameraPosition.xz;
        curvedW.y -= dot( fromEye, fromEye ) * uCurve;
        mvPosition = viewMatrix * curvedW;
        gl_Position = projectionMatrix * mvPosition;`,
      );
    } else {
      // Sprites (sign labels): the whole label drops with its centre.
      shader.vertexShader = shader.vertexShader.replace("#include <common>", header).replace(
        "gl_Position = projectionMatrix * mvPosition;",
        `vec3 labelW = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
        vec2 fromEyeL = labelW.xz - cameraPosition.xz;
        mvPosition.y -= dot( fromEyeL, fromEyeL ) * uCurve;
        gl_Position = projectionMatrix * mvPosition;`,
      );
    }
  };
  m.needsUpdate = true;
}
