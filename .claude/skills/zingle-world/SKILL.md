---
name: zingle-world
description: Everything decided for the Zingle AI world (a Thar desert rally on flat sand-peach ground) — layout L3c "spine + village web", the ten stop landmarks (Rajasthani heritage), the extras (fort, Hawa Mahal, Thar Jn station, caravanserai, bivouac), dunes, dust plume, and the build's invariants. Load before changing src/three/lib/journeys/zingleFlat.ts, zingleLandmarks.ts, or Zingle content.
---

# Zingle world: a Thar desert rally

Files:
- `src/three/lib/journeys/zingleFlat.ts`: the layout and the build.
- `src/three/lib/zingleLandmarks.ts`: the landmarks, ported from `design/3d/zingle-board.ts`.
- `src/three/world/rides.ts`: `ZINGLE`, with the stop→landmark pins.

## Look
- **Ground:** sand peach (`P.peach`).
- **Fort:** cream sandstone F2 (`#f5e2c3` / `#e2c49a`).
- **Landmark rule:** every landmark is real Thar or Rajasthani heritage, in the world's palette (sandstone, terracotta, cream, lime-wash) with only muted accents.
  - Never generic props: Adit rejected an armoured vault and a shed.
  - Never scale a prop up to make it read. Keep the bike's true scale and add more pieces instead. The Lohar cart and the kathputli puppets were rejected for exactly this.
- **Dunes:** M1, blob dunes on a ripple carpet, painted flat and low (y < 0.03) under the roads and kept off them.
- **Life:** only camels, resting at the bivouac. No other animals or birds, and no people except Adit.
- **No shooting stars:** they belong to AstroClub only (Adit, 2026-11-20).
- **No plain box houses:** the flat-roofed `townHouse` boxes read as "concentration camps" (Adit, 2026-11-20), so they were removed from all three cities. The cities are their roads and landmarks for now; any new houses need a real Rajasthani design (jharokhas, chhatris, stepped parapets) approved on the board first.

## Layout (L3c)
- **The highway:** knots eased by cosine, periodic across the 520 × 400 tile.
- **The town web**, north of the highway: lanes A–E.
  - Lane A runs from the highway to the fort's ramp foot, through the twin pols.
- **East:** lanes F and G (kunds, toshakhana, solar farm, turbines).
- **South:**
  - lanes H and I (dera, bivouac);
  - the station road along the railway;
  - lanes J and K to the oasis (the ghat);
  - lane L across the salt pan.
- **The sand track:** a closed loop through the dune sea. `dusty: true` makes it ride as road but throw a dust plume, via `Ground.dusty` and `WorldData.dust` colours.
- **Railway:** wraps the world (points every 1 m over three tiles, like Expresso's). It is level and straight for 45 m either side of Thar Jn (`STX`). The toy train stops there.
  - Level crossings are fine. The track never ends.

## Stops (pins in rides.ts)

| # | Landmark (key) | The fit |
|---|---|---|
| 1 | kund | every drop saved |
| 2 | pols: Suraj Pol and Chand Pol | Lane A runs through the moon arch; the loop runs through the sun arch. The washes are on both faces. |
| 3 | jantar: the Misra Yantra, from the Sketchfab model | |
| 4 | ghat: Gadisar-like | garden, lotus, a boat, reflections; its lake is wadeable water |
| 5 | bazaar | a shop for every job |
| 6 | dera: Gadiya Lohar camp | every tool laid out |
| 7 | toshakhana | |
| 8 | stepwell | |
| 9 | clock: Ghanta Ghar | |
| 10 | haveli | |

Extras (not stops): the fort, Hawa Mahal (on the highway's north side, so its screen faces south), Thar Jn (R2), the caravanserai (R4), the bivouac, the salt pan and the villages of round huts. The solar farm and turbines were removed: Adit doesn't like them.

## Standing rules from Adit
- **The fort is FD,** after Junagarh, Bikaner: a desert fort on the flat. It has:
  - an angular wall ring with round and square bastions, a low outer curtain, and a water moat that is wadeable (`world.water` along its centreline);
  - a bridge (a `decks` entry) to Suraj Pol, with both rings of wall open at the gate;
  - palaces, a charbagh and a temple inside.
  - `fortMoat()` is in zingleLandmarks.ts.
- **The toshakhana always stands INSIDE the fort,** facing the gate. You must ride across the moat bridge and through Suraj Pol to reach it. Lane A runs on through the gate to its forecourt (that's lane A's terminus).
- **Sonar Qila is rideable rock** (`src/three/lib/sonarQila.ts`, not yet in a world). It uses the mountains' method at a much lower height:
  - **The rock:** a `Carving` of mesa blocks with rounded creases, held to the hill's footprint (unheld, low blocks spread ~30 m into flat aprons). It's about 9 m high, with its top levelled into the town plateau (`QILA_TOP` 8.4).
  - **The ramp:** a 143 m road climbing the south face, eased so it's never steeper than 8%. Its cut and fill are `FineBlocks` stones, kept within 1 m of the smooth slope (unheld, fill stones build a bench that ends in a cliff).
  - **Inside:** a closed lane loop through the town, the only rideable path.
  - **Curbs** line the ramp and both sides of the lane. At the junction, only the lane curb facing the ramp opens.
  - **The walls are the terrain's steps** (Adit: rock showing above the walls "defeats the purpose of them").
    - Inside the rim wall's own line, the town floor is dead flat.
    - Outside it, the carved rock is held at least 1.8 m below the floor, so the rim wall stands as a retaining wall from the rock up to its parapet. The bastions rise from the rock outside to above it.
    - The lower wall retains a 1.2 m stone terrace round the foot, with gate towers closing the drop where the ramp passes.
    - Steps follow the wall polylines exactly, not a distance from the hill's edge.
  - **Terrain colour is sharp, like the houses on it** (Adit, 2026-11-19: the crisp buildings clashed with soft ground). Colour goes per triangle, never smeared across a boundary:
    - each carved block gets one tone;
    - the town floor, the sand line and the roads are flat bands with hard edges;
    - the only gradient is wide, over the full height.
    - Shading uses smooth grid normals, so steep faces don't zebra-stripe.
    - The roads are their own surfaces, wound to face up (a single-sided strip wound the other way is never drawn).
    - The town floor is dead flat right out to the rim wall.
  - **Proven offline** with the real `Ground` and `BikePhysics`: climbs in 13.6 s all on road, laps the lane, and 0 of 50 attempts escaped the lane or the ramp.
- **No raised forts,** except Sonar Qila in the carved-rock style. Adit rejected hills, cliffs and plateaus built as stacked slabs (Mehrangarh, Amer and Gwalior-style) as "weird". He asked for Sonar Qila to be raised the way the mountains are, with stone placement, but much lower.
- **Twin pols:** the two roads through them are exact mirror images (a symmetric Y fork about the gates' centre line). Only their washes differ. A test asserts the mirror.
- **Ghanta Ghar's clock** always shows the rider's local time: live hands (`userData.clock`) turned by the life loop from `new Date()`.
- **Khejris and neems are knockable:** light trees of about 55–70 kg, never solid walls. That includes trees inside landmarks, which `withLooseTrees` lifts out as `zkhejri` and `zneem` toys.
- **Stops are spaced out with room to explore.** Next is the 3× world (1560 × 1200 m) across Jaisalmer, Jodhpur and Jaipur (the W3 map, awaiting approval).

## The world (W3 shrunk to 70% of its area, 2026-11-20)
- **Size:** 1312 × 1008 m (was 1560 × 1200). Every W3 coordinate goes through `W(x, z)` in zingleLayout.ts: scaled by `K` = 0.84, but rigid within ~120 m of Sonar Qila (blending out by 220 m), so roads still hug the unshrunk hill. Single lengths use `s(v)`. **Landmarks, the fort, the pols and Sonar Qila keep their real size**: never scale them with the map. The scatter caps scale with the area.
- **Regions:** Jaisalmer is in the west (Sonar Qila at `QILA`, the havelis, the ghat, Bada Bagh, the dune sea), Jodhpur in the middle (a blue walled city in a ring road, the pols at its gate, Ghanta Ghar, Jaswant Thada; the fort with the toshakhana inside, south at `FORT`), and Jaipur in the east (a pink T-junction grid, Hawa Mahal, Johari bazaar; Jantar Mantar, Sambhar, the stepwell to the south).
- **Roads:** 28 of them, all in `zingleLayout`, T-junctions only. The highway and the ridge road wrap. Sonar Qila's ramp and lane are world roads carrying heights (`ys`).
- **Heights:** the world's ground is flat except at Sonar Qila (the height function `H`). Its terrain is a terrain chunk, and its curbs are world `walls`.
- **Flat paint** (dunes, salt) goes in 40 m cells marked `userData.terrain`, so each culls on its own. Folded into the scene's wide batch, the dune sea alone cost ~1.2 M triangles, drawn by every wrap copy.
- **Measured at W3 (Metal, 1864 × 860 at 2×):** qila 1.38 M triangles / 108 draw calls, Jodhpur 1.36 M / 114, fort 1.15 M / 89, Jaipur 0.79 M / 108, dunes 0.59 M / 98.
- **Load time (Adit wants < 10 s):** ~5.7 s of pure build (reduced motion) and 6.8 s with the ride-out skipped. With the full first-ride ritual it's ~15 s, because the ritual alone is ~11.7 s and long build tasks freeze its clock (capped at 50 ms a frame). Keep the build fast:
  - "Clear of every road / dune" queries go through `SegGrid` (zingleLayout.ts), never an all-roads `polyDist` loop. That loop alone was 10 s.
  - The build yields per landmark, village, toy group and every 500 scatter tries.
  - Sonar Qila is built in its own slice and handed to `zingleLayout(qila)`.

## Invariants
- **Roads are proven, not eyeballed.**
  - The layout lives in `src/three/lib/zingleLayout.ts`, pure data testable in Bun.
  - `checkRoads()` runs at the end of the build (errors go to the console) and in `tests/zingle.test.ts`.
  - It fails on:
    - dead ends (only the fort ramp is a terminus);
    - carry-on joins, where one road ends exactly where another begins, giving a notched seam (the bug Adit hit at the kund corner);
    - joins shallower than 25°;
    - kinks over 18° per 2.5 m;
    - segments over 4 m;
    - crossings or roads touching away from a junction.
  - A chain of lanes is ONE road. Every other road starts and ends on an interior point of another.
- **Facing:** landmarks prefer the side of their road that makes them face south (+z), so façades face the usual view.
- **Wide pieces:**
  - A landmark wider than 40 m comes in ~36 m `pieces`. The scene puts anything wider than ~44 m in one "wide" batch that every wrap copy draws.
  - Never join scattered things (km stones) into one world-spanning mesh. That once cost ~4 M triangles.
- **Detail:** landmarks build under `lightToys`.
- **Solids:**
  - Suraj Pol's passage is cleared of solids. Fort walls are built in 3 m pieces so slanted walls keep a wall's footprint.
  - Solids come from the parts (`solidsOf`: knee-high and up, touching the ground).
  - The pols' arches and the sarai's gate are cleared, with piers added back.
- **Budget, measured 2026-11-19 (Metal, 1864 × 860 at 2×):**
  - town 1.33 M triangles / 100 draw calls;
  - fort 0.83 M / 87;
  - ghat 0.63 M / 97.
  - Keep ≲ 2 M and ≲ 500 draw calls.
