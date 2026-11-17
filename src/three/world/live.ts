/**
 * A live board: a chalkboard on two posts that pings a real server and shows
 * whether it's up ("brewing ✓ · 84 ms") or not ("resting"; never an error).
 * Riding up to it offers a link to the live site.
 *
 * The ping is a no-cors request from the visitor's own browser: it can't read
 * the response, but it reliably tells "reachable, and how fast" from "not".
 */

import * as THREE from "three";
import type { Ground } from "./ground";

export interface LiveStatus {
  ok: boolean | null;
  ms: number | null;
}

const W = 1024;
const H = 560;

export class LiveBoard {
  readonly group = new THREE.Group();
  status: LiveStatus = { ok: null, ms: null };
  private readonly canvas = document.createElement("canvas");
  private readonly texture: THREE.CanvasTexture;
  private timer = 0;
  private disposed = false;

  constructor(
    readonly url: string,
    private readonly title: string,
    at: { x: number; z: number; yaw: number },
    ground: Ground,
  ) {
    this.canvas.width = W;
    this.canvas.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const w = 2.6;
    const h = (w * H) / W;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.85 }),
    );
    face.position.set(0, 1.5 + h / 2, 0.06);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.08),
      new THREE.MeshStandardMaterial({ color: "#5a3b28", roughness: 0.8 }),
    );
    frame.position.set(0, 1.5 + h / 2, 0);
    const postMat = new THREE.MeshStandardMaterial({ color: "#4a2f1f", roughness: 0.85 });
    for (const x of [-w * 0.4, w * 0.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.6 + h, 10), postMat);
      post.position.set(x, (1.6 + h) / 2 - 0.1, -0.06);
      post.castShadow = true;
      this.group.add(post);
    }
    face.castShadow = true;
    frame.castShadow = true;
    this.group.add(frame, face);
    this.group.position.set(at.x, ground.height(at.x, at.z), at.z);
    this.group.rotation.y = at.yaw;
    this.draw();
    void this.ping();
  }

  /** Re-pings every 30 s while the world is open. */
  update(dt: number): void {
    this.timer += dt;
    if (this.timer > 30) {
      this.timer = 0;
      void this.ping();
    }
  }

  private async ping(): Promise<void> {
    const t0 = performance.now();
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    try {
      await fetch(this.url, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
      this.status = { ok: true, ms: Math.round(performance.now() - t0) };
    } catch {
      this.status = { ok: false, ms: null };
    } finally {
      clearTimeout(timeout);
    }
    if (!this.disposed) this.draw();
  }

  private draw(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#26302a";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgb(255 255 255 / 0.12)";
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.fillStyle = "rgb(246 239 223 / 0.6)";
    ctx.font = "700 44px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.title.toUpperCase(), W / 2, 110);
    const { ok, ms } = this.status;
    const main = ok === null ? "checking…" : ok ? "brewing ✓" : "resting";
    ctx.fillStyle = ok === false ? "#f6efdf" : "#bff0c4";
    ctx.font = "900 150px Outfit, sans-serif";
    ctx.fillText(main, W / 2, 300);
    ctx.fillStyle = "rgb(246 239 223 / 0.75)";
    ctx.font = "600 56px Inter, sans-serif";
    const sub = ok ? `live · ${ms} ms` : ok === false ? "back soon" : "";
    ctx.fillText(sub, W / 2, 400);
    ctx.fillStyle = "rgb(246 239 223 / 0.5)";
    ctx.font = "600 40px Inter, sans-serif";
    ctx.fillText(new URL(this.url).host, W / 2, 480);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.disposed = true;
    this.texture.dispose();
  }
}
