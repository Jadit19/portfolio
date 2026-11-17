/**
 * The passport pin board on the garage wall (the "sewn" design): felt in a
 * slim wood frame under a warm picture light. When a world is earned its
 * patch is stitched on: a needle runs thread round the outline in stepped
 * 12 fps frames, then the patch pops on with a little squash.
 */

import * as THREE from "three";
import type { RouteId } from "../../content/types";
import { STAMP_BOARD } from "./space";
import { drawStampBoard } from "./stampArt";

const PX = 1400;
const SEW_SECONDS = 1.3;
const FPS = 12;

export class PassportBoard {
  readonly group = new THREE.Group();
  /** The felt surface (for tap detection). */
  readonly felt: THREE.Mesh;
  private readonly canvas = document.createElement("canvas");
  private readonly texture: THREE.CanvasTexture;
  private shown: RouteId[] = [];
  private queue: RouteId[] = [];
  private sewing: { id: RouteId; t: number } | null = null;
  private frameClock = 0;

  constructor(stamped: readonly RouteId[]) {
    const { w, h } = STAMP_BOARD;
    this.canvas.width = PX;
    this.canvas.height = Math.round((PX * h) / w);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.felt = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: this.texture, roughness: 1 }),
    );
    this.felt.position.z = 0.03;
    this.felt.receiveShadow = true;
    this.group.add(this.felt);
    const wood = new THREE.MeshStandardMaterial({ color: "#5d4330", roughness: 0.55 });
    const f = 0.07;
    for (const [x, y, fw, fh] of [
      [0, h / 2 + f / 2, w + 2 * f, f],
      [0, -h / 2 - f / 2, w + 2 * f, f],
      [-w / 2 - f / 2, 0, f, h],
      [w / 2 + f / 2, 0, f, h],
    ] as [number, number, number, number][]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.06), wood);
      m.position.set(x, y, 0.03);
      m.castShadow = true;
      this.group.add(m);
    }
    this.group.position.set(STAMP_BOARD.x, STAMP_BOARD.y, STAMP_BOARD.z);
    // A warm picture light washing the board.
    const wash = new THREE.SpotLight("#ffe6c2", 40, 7, 0.62, 0.8, 1.4);
    wash.position.set(0, 2.2, 1.6);
    wash.target.position.set(0, -0.1, 0);
    this.group.add(wash, wash.target);
    this.shown = [...stamped];
    this.redraw();
  }

  /** Whether `stamped` has a patch the board doesn't show (or have queued) yet. */
  hasNew(stamped: readonly RouteId[]): boolean {
    return stamped.some((id) => !this.shown.includes(id) && !this.queue.includes(id));
  }

  /** Call when the earned list changes; new patches queue up to be stitched on. */
  setStamped(stamped: readonly RouteId[]): void {
    for (const id of stamped)
      if (!this.shown.includes(id) && !this.queue.includes(id)) this.queue.push(id);
    // Removed (e.g. a reset): drop them at once.
    const removed = this.shown.filter((id) => !stamped.includes(id));
    if (removed.length) {
      this.shown = this.shown.filter((id) => stamped.includes(id));
      this.redraw();
    }
  }

  update(dt: number, reduced: boolean): void {
    if (!this.sewing) {
      const next = this.queue.shift();
      if (!next) return;
      this.shown.push(next);
      if (reduced) {
        this.redraw();
        return;
      }
      this.sewing = { id: next, t: 0 };
      this.frameClock = 1;
    }
    const s = this.sewing;
    if (!s) return;
    s.t = Math.min(1, s.t + dt / SEW_SECONDS);
    // Stepped animation: redraw on twos-ish (12 fps), not every frame.
    this.frameClock += dt;
    if (this.frameClock >= 1 / FPS || s.t >= 1) {
      this.frameClock = 0;
      this.redraw();
    }
    if (s.t >= 1) {
      this.sewing = null;
      this.redraw();
    }
  }

  private redraw(): void {
    drawStampBoard(this.canvas, "sewn", this.shown, this.sewing ?? undefined);
    this.texture.needsUpdate = true;
  }
}
