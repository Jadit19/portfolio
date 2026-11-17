---
name: bike-physics
description: How the bike rides (BikePhysics kinematic model, surfaces, slopes, steering lock, curbs, Rapier props coupling, cruise) and how to diagnose "too slow / stuck / runs wide" reports with an offline climb simulation before tuning. Load when touching src/three/world/bike.ts, props.ts, cruise, road geometry that affects riding, or world feel values.
---

# Bike physics

## The model (src/three/world/bike.ts)
- Kinematic bicycle (wheelbase 1.78 m) stepped at a fixed timestep with interpolation.
- Per-world feel: `top = 16 + speed·12`, `accel = 3 + speed·2.6`, from `src/content/worlds.ts`. Acceleration eases toward top (`a = accel·(1 − v/top)`), so the time constant is `top/accel` (~5 s) — in big worlds raise `speed` rather than hacking the curve.
- Surfaces: road (top ×1, drag 0.35), ground (×0.5, drag 1.6), water (×0.22). Off-road is meant to be slow; being off-road by accident is a geometry bug.
- Slope pull = g·sin(slope)·factor: road 0.24, ground 0.7, water 0.35. *Why:* full gravity made 15% climbs crawl; roads should feel engineered, rough slopes should not.
- Pull-away push below 4 m/s (2 in water) so a stopped bike can always restart on a slope.
- Steering lock narrows with speed: `0.4/(1+0.17v)` plus a boost at a crawl and a small one up to 12 m/s. Turning radius ≈ 1.78 / tan(lock): ~9.5 m at 8 m/s. **Hairpins must be wider than that** or riders run wide.
- Curbs are walls passed to `BikePhysics` (`WorldData.walls`).

## Rapier coupling — the trap
`WorldScene` steps Rapier after the bike and copies back the body's remaining speed (`if |fwd| < |v| then v = fwd`), so knocks slow you. **Anything the bike's Rapier body touches silently brakes the bike.** It once touched the coarse physics ground on slopes: uphill felt slow everywhere, downhill felt fine, and the offline sim (no Rapier) climbed perfectly. The bike body now ignores the ground via collision groups. If you add colliders, decide explicitly whether the bike should feel them.

## Diagnose before you tune
Reports like "too slow climbing" or "gets stuck" have had three different causes: road geometry (kinks, gaps, tight bends), missing curbs, and the Rapier drag. Tuning `accel` would have hidden all three. Do this instead:

1. **Simulate the ride offline** — `scripts/climb-sim.ts` builds the Ladakh layout, the real `Ground` and `BikePhysics`, and rides a road with a pure-pursuit driver that brakes for bends:
   ```
   ROAD=1 BEND=8 bun run .claude/skills/bike-physics/scripts/climb-sim.ts 0.95   # arg = feel.speed
   DOWN=1 ...  # ride it downhill
   ```
   It prints time, average speed, surfaces (should be ~all `road`) and where the bike left the road (distance from centre, road vs bike height).
2. **Scan the geometry** — `scripts/road-check.ts` prints the worst turn per point and every gap > 4 m for each road.
3. **If the sim is fine but the game isn't, the difference is in the game** (Rapier, blockers, walls, frame pacing). Measure in the browser with the same input (`verify-in-browser`, `at:` command) and compare uphill vs flat — ratios, not absolutes, since headless runs slow.
4. Only then tune numbers, and re-run all directions/faces at several corner speeds (6–10 m/s).

**Driver pitfall:** a waypoint driver that waits to get within N m of a point loses the road when it overshoots — use nearest-point + lookahead (pure pursuit), as the bundled sim does. A naive driver produced a fake "bike leaves the road" result once.

## Cruise
The pilot follows roads to a stop; after repeated replans it glides back onto the road over ~1.1 s (`this.glide`), never teleporting. Frequent glides mean the road or physics has a problem — fix that, don't tune the glide.

## Tests
`tests/world.test.ts` asserts behaviour like "slopes slow you uphill" (`up.v < flat.v − 0.3`). Update thresholds only when the change is intended, and say so.
