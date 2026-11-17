/**
 * Building the world to ride. Starts only when the ride does (Ride In or
 * Enter), never earlier, so moving between bikes in the yard stays smooth.
 * It builds in slices while Adit walks over, gets on and rides out, then gets
 * its shaders compiled and is drawn once off screen, so the hand-over doesn't
 * stall. It stays deaf to input until it's handed the stage
 * (WorldScene.activate).
 */

import type { RouteId } from "../content/types";
import type { Stage } from "../three/stage";
import { WorldScene } from "../three/world/scene";

export async function buildWorld(
  id: RouteId,
  stage: Stage,
  onProgress: (p: number) => void,
): Promise<WorldScene> {
  const w = await WorldScene.create(id, stage.canvas, onProgress, { prebuild: true });
  await stage.precompile(w);
  // From where it starts, so the first frame shown is already on the GPU.
  w.snapCamera();
  stage.warm(w);
  return w;
}
