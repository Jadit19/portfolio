---
name: world-engine
description: Architecture and invariants of the ride-world engine — wrapping torus worlds, heightAt vs renderAt, terrain chunks, carving, road pipeline (generation, point spacing, trimming, fillets, curbs, stilts), physics ground, batching and stepwise loading. Load before editing src/three/lib/ladakhWorld.ts, journeys/*Flat.ts, carve.ts, kit.ts, world/ground.ts or world/scene.ts.
---

# World engine

## Layers and where they live
| Layer | File | Role |
|---|---|---|
| World layout (pure data) | `src/three/lib/ladakhWorld.ts` (`ladakhWorldSteps` generator) | roads, river, lake, heights, landmarks sites, curbs |
| Rock carving | `src/three/lib/carve.ts` | `Carving` (mesa blocks, smooth max), `FineBlocks` (road cut/fill) |
| Scene build | `src/three/lib/journeys/astroFlat.ts` (Expresso: `expressoFlat.ts`) | meshes, toys, landmarks, `WorldData` |
| Shared flat kit | `src/three/flat/kit.ts` | clay, flat shapes, `heightsOf`, `drapedShadow` |
| Ride engine | `src/three/world/*` | `Ground`, `BikePhysics`, `Props` (Rapier), camera, cruise, night |

Keep layout code free of three.js scene objects so it can run in Bun scripts and tests — that is what makes the physics sim and geometry checks possible.

## Invariants
1. **The world is a torus.** Everything that crosses an edge continues on the other side: cells are binned with wrap ghosts, terrain meshes get wrap copies (`userData.terrain` meshes are not batched and are surrounded), toys/scatter are seamless. Test near seams.
2. **Two heights, on purpose.** `heightAt` is what you ride (stilt decks count as the deck); `renderAt` is what you see (rock lowered under stilts). Physics ground, toys and signs use `heightAt`; terrain meshes use `renderAt`. Mixing them up gives floating posts or bikes sinking.
3. **Posts and stilts reach the rock** below them (`stiltDeck(pts, floor)` sizes posts to `renderAt` + footing). "Stilts not connected to the ground" was a real bug.
4. **Load in steps.** World generation is a generator (`yield` between heavy loops) so the UI stays responsive; the world builds only when a ride starts.
5. **Static scenery is batched** by material; things that must be culled or wrapped (terrain chunks, instanced toys per 60 m chunk) are not.

## Road pipeline — rules learnt the hard way
- **Even point spacing (≤ ~4 m) along every road.** Strips are drawn with a centripetal Catmull-Rom through the points; with uneven spacing (we had 2 m next to 15 m) the spline dips under the ground between points and **grass shows through as a gap in the road**. Resample curves by arc length, not by parameter `t`.
- **No kinks.** Every segment must join the next smoothly — measure the turn between consecutive segments (worst should be ~10–15° at 2–4 m spacing). A sign-flip bug once made the Gata loops jump 51 m diagonally across rock with an 80° kink; another doubled back 157° at the pass. Both were invisible in code review and obvious in a turn/gap scan.
- **Curvature must suit the bike.** Tightest radius ≥ the bike's turning radius at a sensible corner speed (~10 m at 7–8 m/s; see `bike-physics`). A half-ellipse's tightest radius is b²/a, not a or b.
- **Joins:** `trimmed(ri)` cuts a strip's ends at the edge of the road it joins (binary search on `onOther`), and `junctionAprons` draws fillets (radius capped by the joint angle). Don't overlap strips.
- **Engine roads are unsmoothed** (`makeRoad(pts, H, false, 4, 0)`) so the ridden road matches the drawn one; any smoothing must happen in the layout, once.
- **Ridden width = the whole level shelf** on mountain roads (half + 1 m), so the shoulder isn't treated as rough ground.
- **Curbs** (invisible walls) run along the **entire mountain section** (y > 1.5 m, stilts, or any drop across the shoulder), skipping only where another road is near (`roadGap > 0.9`) so a curb never crosses a road. Partial curbs are worse than none: a bike that slips through a gap gets trapped outside.
- Stilts are scattered **in bits**: one lower hairpin per face as a platform, some legs bridging gullies — never continuous.

## Physics ground
- `WorldData.physicsGround` is a **coarse** (4 m) plane for Rapier props only. It cuts through road shelves on mountains. **The bike's Rapier body must not collide with it** (`GROUND_GROUPS`/`BIKE_GROUPS` in `src/three/world/props.ts`) — the ride already keeps the bike on the ground, and a level box on a slope digs in and drags the bike uphill.

## Checking your change
- Write a Bun script that builds the layout and asserts geometry (gaps, turns, heights vs `heightAt`) — see `bike-physics/scripts/road-check.ts`.
- Then look at it in the running game (`verify-in-browser`).
