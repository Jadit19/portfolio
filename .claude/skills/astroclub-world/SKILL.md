---
name: astroclub-world
description: Everything decided for the AstroClub IITK world (Ladakh / Hanle) — layout, Gata loops and Umling La geometry, carved mountains, Pangong, monastery and hamlets, bridges and ford, stop-to-landmark pairings, night stars and meteors, and tuning values with their reasons. Load before changing src/three/lib/ladakhWorld.ts, carve.ts, journeys/astroFlat.ts, astroLandmarks.ts, or AstroClub content.
---

# AstroClub IITK — Ladakh / Hanle

Built by `ladakhWorldSteps` (layout) → `journeys/astroFlat.ts` (scene). Build options in use: `{ edge: 3, colR: 34, stiltMinD: 45, fill: 0.75, follow: true, tidy: true }`. Reference boards: `design/3d/astro6` (Y2 rock look), `design/3d/astro7` (edges, Umling La, junctions, stilts).

## Layout (520 × 420 m, wrapping)
- 3× the area of the first version, so landmarks can spread out. *Why:* Adit found it cramped, with landmarks bunched on the loops.
- **One mountain ridge whose crest is the north/south seam**, with **Umling La** on the crest; the valley between; the river parallel to the ridge (wraps east↔west).
- **Pangong is separate from the river**: a broad lake on the valley's north side, a bare shingle shore, the road hugging the shore for a stretch, and a track along the north shore.
- Valley roads wander and cross the river at acute/obtuse angles; plenty of hamlet lanes; **no dead ends**.
- **Tawang-style monastery** (walled, white hall, gold roofs, red pavilion, monk quarters) on level ground; small gompas and hamlets of village homes scattered around.
- Leh-like green valley (light-green poplars/pines), cold-desert sand ground, prayer flags, chortens, mani walls, BRO signs, army trucks, milestones, yaks, G2 chorten gate jump on the valley road.

## Gata loops (both faces) — geometry with reasons
- **3 loops**, hairpins as broad half-ellipses (12 m out, 22 m across; tightest radius ~10 m), plus a **quarter turn (r = 9 m) over the pass** into the first leg. The run-out from the last hairpin is a **smooth curve leaving along the bend's tangent**, resampled every ~2.5 m, down to the valley road.
  *Why:* earlier versions had 2.5 m hairpins (unrideable), a 157° double-back at the pass, and a sign bug that cut 51 m diagonally across the rock face. The bike's turning radius at 7–8 m/s is ~9.5–10 m.
- Road profile follows the mountain envelope, smoothed, monotone, ≤ 15% grade, eased to 0 at the valley. Paved at the top and bottom, gravel in the middle (graded over 14–22% and 58–66% of the length).
- **Stilts in bits:** one of the two lower hairpins per face is a stilt platform; some legs bridge gullies (at x = passX −14, 6, 20). Never continuous; never by the seam.
- **Curbs along the whole climb** (see `world-engine`).
- Umling La roadwork style **U2**. One landmark on the loops (the Hanle dome, on a bend), one at Umling La (the XUVI meteor deck).

## Mountains
Carved, not stacked (`Carving` in `carve.ts`; see `flat-world-art` for the rules): blocks 7–18 m, erode 0.12, plateaus above 82% of the top, 3 m edge radius plus terrain blur, irregular crisp snowline with gully dips and patches, fine blocks and scree along road cuts.

## Water
River with **wooden bridges alternating B1 (log cribs + prayer flags) and B2 (cantilever + roofed gate)**, 13 m × 3.4 m; the pass roads meet across the river at an **F2 stone causeway ford**.

## Stops → landmarks (9)
| Content | Landmark |
|---|---|
| Inter IIT Tech Meet 2022 | Hanle observatory dome (ribbed silver tower, hemispherical dome, shutter hood, barrel-roofed annex), on a Gata-loop bend |
| jux (PyPI) | solar observatory |
| XUVI | meteor deck at Umling La |
| Blast Off 2022 | rocket pad |
| Hyperion 2022 | planetarium tent (links the GW150914 paper, arXiv 1602.03837) |
| Hyperion 2021 | star-party camp |
| Wiki | Tawang monastery |
| NASA APOD Discord bot | yaks on the Pangong shore |
| IP Mail | dak bungalow in a hamlet |

## Night
Follows the day/night toggle. Pulling in at a stop at night draws that stop's constellation (Sol, Algol, HR 8799, Altair, Mars, Hyperion, Andromeda, Venus, Polaris) ~7 m above the landmark (9 m at the monastery — higher went off screen), fading as you ride away; meteor showers near the deck. Both draw on the night pass overlay so the grade doesn't darken them.

## Feel
`feel: { speed: 0.95, grip: 0.8, lean: 0.6 }` — raised from 0.7 because the world is 3× larger and 0.7 felt sluggish. A clean climb of either face takes ~35 s at ~10 m/s average; use `bike-physics/scripts/climb-sim.ts` to confirm after any change to the loops.
