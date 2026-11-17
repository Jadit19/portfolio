---
name: verify-in-browser
description: How to prove a change works in this portfolio — bun run check, headless runs of the real site with a scriptable world probe (teleport, drive, cruise, night, stop cards, screenshots), design-board capture, and the measurement pitfalls (swiftshader slowness, sim vs game divergence). Load before reporting any world, physics, rendering or UI change as done.
---

# Verify in the browser

Green tests are necessary, not sufficient: most defects Adit reports (road gaps, floating stilts, text overflow, invisible headlight, slow climbs) pass every test. Look at the real thing before you say "done".

## 1. Static checks (always)
```
bun run check        # tsc + biome + bun test (29+ tests); must be clean
bunx biome check --write src tests   # fixes formatting after scripted edits
```
The one standing warning is an old CSS specificity note in `src/styles/app.css`; anything else is yours.

## 2. Pure-data checks (fast, seconds)
World layouts are plain TypeScript, so check geometry and physics in Bun before opening a browser:
- `bun run .claude/skills/bike-physics/scripts/road-check.ts` — kinks and gaps.
- `bun run .claude/skills/bike-physics/scripts/climb-sim.ts` — ride a road with the real physics.
Write throwaway checks in the session scratchpad, not in the repo.

## 3. The real site, headless (minutes)
Start a dev server once (`bun --port 4310 ./index.html`, in the background) — it serves source directly, so edits show up on the next load without restarting it. Then:
```
WORLD=astro OUT=<scratchpad>/probe bun run .claude/skills/verify-in-browser/scripts/world-probe.ts \
  stop:dome  at:100,-40,1.5708  road:1:0.5  cruise  night  e
```
and **Read the PNGs**. Commands and env are documented in the script header. It uses `?debug`, which exposes `window.__world` (`bike`, `ground`, `data.roads/stops/blockers`, `scene`, `camera`) — add your own commands for one-off probes (e.g. list meshes whose bounds contain a point, or sample a mesh's vertex heights against `ground.height`), which is how the hidden-road-gap bug was found.

### Pitfalls
- **Big worlds take ~150 s to load headless**; budget a 10-minute timeout and batch several commands into one run.
- **Swiftshader is slow**, so the sim runs slowly in wall time: compare **ratios** (uphill vs flat at the same spot and duration), never absolute speeds.
- **Night fades in over seconds**; a screenshot right after `night` shows dusk, not night. Wait or take two.
- **If the offline sim and the game disagree, the bug is in what the game adds** (Rapier props coupling, blockers, walls, render-only geometry). Don't "fix" the sim to match.
- Bounding-box probes only tell you a mesh exists near a point; to know what's *visible*, compare heights (mesh vertex y vs `ground.height`) or hide candidates and re-shoot.

## 4. Design boards
```
bun --port <N> design/3d/<name>.html &
DSF=2 bun run scripts/capture-design.ts http://localhost:<N> design/3d/<dir>
```
Exports each labelled variation as `NN-*.png` at 2× (sharpness matters — blurry exports were mistaken for blurry design). Read the PNGs before sending them to Adit.

## 5. UI responsiveness
`bun run scripts/smoke.ts <url>` drives laptop and phone viewports. For layout work also check ~1461×775, 1920×1080, 1024×768, 844×390, 667×375 and 390×844 (phones held upright should show "Turn your phone sideways").

## 6. Reporting
State what you verified and how (sim numbers, screenshot), and what you couldn't (e.g. "night beam not captured, the fade hadn't finished"). Never claim a visual result you didn't look at.
