/**
 * Geometry scan of the Ladakh world's roads: worst turn between consecutive
 * segments, and every gap longer than 4 m (uneven spacing makes the drawn
 * spline dip under the ground; kinks make bikes run off).
 *
 *   bun run .claude/skills/bike-physics/scripts/road-check.ts [roadIndex …]
 */
import { ladakhWorld } from "../../../../src/three/lib/ladakhWorld";

const t = ladakhWorld({ edge: 3, colR: 34, stiltMinD: 45, fill: 0.75, follow: true, tidy: true });
const which = process.argv.slice(2).map(Number);
for (const [ri, r] of t.roads.entries()) {
  if (which.length && !which.includes(ri)) continue;
  const p = r.pts;
  let worst = 0;
  let wi = 0;
  const gaps: string[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i] as [number, number, number];
    const c = p[i + 1] as [number, number, number];
    const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
    if (len > 4) gaps.push(`${i}: ${len.toFixed(1)} m at ${a[0].toFixed(0)},${a[2].toFixed(0)}`);
    if (i === 0) continue;
    const z = p[i - 1] as [number, number, number];
    const h0 = Math.atan2(a[2] - z[2], a[0] - z[0]);
    const h1 = Math.atan2(c[2] - a[2], c[0] - a[0]);
    let d = Math.abs(h1 - h0);
    d = Math.min(d, 2 * Math.PI - d);
    if (d > worst) {
      worst = d;
      wi = i;
    }
  }
  console.log(
    `road ${ri} (${r.kind}, ${p.length} pts): worst turn ${((worst * 180) / Math.PI).toFixed(0)}° at ${wi}; gaps > 4 m: ${gaps.length ? gaps.join("; ") : "none"}`,
  );
}
