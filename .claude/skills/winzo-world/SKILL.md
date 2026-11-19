---
name: winzo-world
description: Everything decided for the WinZO world (a circuit on the Greater Noida plains) — layout L2 "expressway spine", the circuit and paddock arrangement, stop-to-landmark pairings, the toll booms, extras, and the build's invariants. Load before changing src/three/lib/journeys/winzoFlat.ts, winzoLandmarks.ts, or WinZO content.
---

# WinZO — a circuit on the Greater Noida plains

Built by `winzoFlat` (`src/three/lib/journeys/winzoFlat.ts`) from landmarks in `src/three/lib/winzoLandmarks.ts`. Design boards: `design/3d/winzo-board.ts` (layouts + hero, port 4334) and `design/3d/winzo-landmarks-board.ts` (landmarks, port 4335). Ground: **lilac** (picked over wheat). **Dead flat** (no carved terrain). 520 × 400 m, wrapping.

## Layout (L2, "Expressway spine")
- **Expressway** along the south, `hwZ(x)` periodic in x so it wraps without a kink; 4 lanes (12 m). It runs **dead straight and level for 24 m either side of India Gate's avenue**, so the avenue meets it at 90°, then eases back into its sweep over 50 m with a smootherstep. *Why:* Adit didn't want the avenue meeting it at a slant. The **toll plaza** sits across it at x = 0; the **dhaba under a neem** beside it.
- An **exit** climbs to the **market town** (the fan market stop); the **ring road** runs on round the west, along the **paddock** behind the garages, and back down the east to the expressway. A **lane** crosses the middle; a **canal** (`canalZ`, periodic) crosses the plain, **bridged** wherever a road meets it (bridges found automatically).
- **Circuit** (our own design, not a copy of Buddh): long pit straight, heavy-braking T1, esses, long back straight, wide sweeper, the hairpin, a last U onto the pit straight. It is built from **straights and true circular arcs** (`CIRCUIT_SEGS`, walked by `turtle()`), with two straights solved so the loop closes exactly. *Why:* the first version used Catmull-Rom through control points, which made two V-corners with 3–4 m centreline radii on a 9 m-wide track, so the inside edge and kerbs folded over themselves ("glitchy", "downright weird"). **No corner under R 14** (half-width 4.5 + kerb 0.9 + margin). Parts of the track must stay at least 22 m apart. Check a new layout offline before building it. Kerbs are continuous strips on every corner.
- **Pit lane mouths:** the pit lane is a plain ribbon drawn *under* the track (y 0.02 < 0.03), running on to the circuit's centreline. The track and its white edge line paint over it, like a real pit exit. Never trim it or give it junction aprons: at a shallow merge they make wedges and curled bands. `junctionAprons` gets every road except the track.
- **Paddock outside the pit straight**: track → pit wall (solid) → pit lane → garages → paddock (race control, scrutineering, tyre warehouse, podium) → paddock road. *Why:* the paddock must be reachable by road without crossing the track. A link road runs from the paddock road down to the pit lane, and the pit lane joins the circuit at both ends. The season-pass kiosk stands at the paddock gate.
- **Grandstands** on the infield side facing the pits; their crowds do the Mexican wave (`userData.wave`). The **kart loop** sits in the infield (its own closed road).
- **Floodlight towers** round the outside every ~45 m; each adds a lamp on the track (night pools).

## Where the stops are (S2, spread out)
No two stops closer than ~95 m (the gantry–hairpin pair, fixed by the circuit). *Why:* race control, scrutineering, tyres and ZoPass were 14–55 m apart in the paddock, and Adit found them crowded. Sites are placed with `besideNear(key, road, x, z)`, which picks the side of the road with room (clear of roads, the canal, the circuit and India Gate):
- scrutineering: the paddock's west end (ring road, near −104, −176);
- race control: the north-east corner of the ring road, over T1 (near 222, −130);
- tyre depot: the lane through the middle, by the canal (near 10, 26);
- ZoPass kiosk: the west gate on the ring road (near −210, 16);
- the fan market, toll, gantry and hairpin are unchanged; the podium stays behind the garages.

## Presence: each landmark adds a different kind of bigness (not a scale-up)
Picked on `design/3d/winzo-presence-board.ts` (port 4336):
- **Race control → flag fan:** a half-ring of seven 9 m poles behind the tower flying the marshal flags big, over a chequered plaza.
- **Scrutineering → shamiana:** a striped event tent over the bay, about three times its footprint. The front is open; poles stand only at the corners and the back middle.
- **Tyre depot → tyre arch over the lane** (`tyreArch()`), just past the depot, so you ride through it.
- **ZoPass → red-carpet plaza:** a gold apron, the carpet with queue posts, and two 6 m ZOPASS banners.
- **Fan market → bunting over the road** (`bunting()`): near-side poles only at the ends, so the forecourt stays open. Plus a SALE % cut-out on the roofs.
- **Flat paint** (plazas, lawns) goes in `Landmark.flats`, drawn without a shadow and under the shadow floor (y 0.012). In the body it would cast a "shadow" of itself and vanish under it. **Every WinZO shadow** (scenery, toys, the rider) is `tintShadow(BASE, shade)` from `flat/kit.ts`, a multiply that darkens whatever it lands on and is exactly `shade` on lilac. A plain painted shadow showed as a lilac patch on the ZoPass plaza and India Gate's lawn, and made the bike's shadow look pale on grass. Its stencil makes overlapping pieces shade a pixel only once; without it, India Gate's shadow stacked into dark rectangles. Road paint (start line, grid boxes, edge lines) is a flat `ribbon` just above the track (y 0.036), never a slab whose top is level with it (that flickered).

## India Gate (a monument, not a stop)
At `GATE` (130, 76), between the canal and the expressway. It sits in a **true circle** of a roundabout (R 17, `ROUND_R`). Its round lawn fills right up to the road (radius R − 2.4, tucked under the road's edge), with a path on the axis, four rounded pools, and the canopy behind. The avenue's lawn is cut along the roundabout's outer edge, so no bare ground shows between them; its far corners, the canals and the paved walk are rounded. *Why:* Adit found the hexagon, square corners and slivers of bare ground rough. **Smooth edges are the taste here: circles and rounded corners, with no wedges of bare ground between shapes.** An avenue runs up from the expressway with lawns, two canals and rows of round trees, and carries on north over the canal to the lane. The toll stays International Payments. *Why:* the WinZO role was based in Delhi. **Mirror-symmetric** like Kartavya Path: the avenue's lawns, canals and tree rows all end on one straight line along the expressway, closed by a paved walk. The precinct within ROUND_R + 26 is kept clear of fields and props (`free()`). The paddy field that stood beside it was moved west.

## Farmland: five estates (`src/three/lib/winzoFarms.ts`)
Picked on `design/3d/winzo-farms-board.ts` (port 4337). *Why:* Adit found the square crop tiles "too neat", "inorganic", and the plains "sparse and lifeless".
- **A few huge estates, not many small fields.** Each is a square (u, v) space mapped onto the land and divided into sub-fields that **share their edges exactly**: soil polygons tile, and a bund runs along every edge, so no lilac shows inside an estate. `assignCrops` gives each sub-field a crop unlike every neighbour's. The crops are mustard, wheat, sugarcane and paddy; the only ploughed plot is the one the tractor works.
- **E4 roadside** (`roadside(hwZ, …)`): bands follow the expressway's curve, cut across at staggered places, with rounded far corners. A farm track (`withTrack`) runs from the road to the pump house. A (two estates, west of the toll) and B (east of India Gate's avenue) are E4 on the expressway's south side.
- **E2 round patchwork** (`disc` + `jgrid`): C sits between the canal and the expressway, D inside the ring road west of the circuit.
- Scatter (`free()`) keeps off every estate. Each sub-field is its own small mesh, so `batchByArea` chunks and culls it; only sugarcane casts shadows.
- **Still life:** Ta (a tractor and cane trolley parked on A's track), Tc (ploughing in B, with egrets behind), and P1 pump houses (whitewashed, a solar-panel roof, neems either side) at each track's end. The water gushes (`userData.gush`).
- **Birds** (`userData.fowl` → `Life.updateFowl`):
  - Peafowl potter and peck. Egrets hop.
  - All of them edge away from a bike that comes close.
  - B's displaying peacock opens its fan within 20 m, folds it beyond 28 m, and turns to face you.
  - Each bird's moving part (head, fan, train) carries its own shadow mesh as a child, so the shadow follows.
- Budget over the estates (2026-11-19): ~120 draw calls, 0.57–0.73 M triangles.

## Stops (8) → landmarks
| Content | Landmark | Key |
|---|---|---|
| Payments risk engine | Race control tower (flag rack) | `flags` |
| Fraud ML platform | Scrutineering bay | `scrut` |
| ZoPass subscriptions | Season-pass kiosk | `pass` |
| Offer engine & checkout | Fan-market stall row (town) | `merch` |
| Data platform | Tyre warehouse | `tyres` |
| International payments | Four-lane toll plaza — **never name markets** | `toll` |
| Guest & SSO login | Start gantry over the grid | `gantry` |
| Refund orchestration | Hairpin + marshal post, CNG-auto marshal | `hairpin` |
Not stops: the **podium** (finale), the **kart loop**, the **dhaba**. Pinned in `rides.ts` (`WINZO_PINNED`); the card kicker is "On the pit board", the sub-line is each stop's `sector`.

## Behaviours
- **Toll booms** (`tollBoom()`, `userData.gate` → `Life.updateGates`): the arm lifts briskly when the bike enters its lane and settles gently after; a green **APPROVED** board flashes ~1.6 s. Anything animated must carry a `userData` flag the scene's living filter knows (`gate`, `wave`, …) or it gets frozen into static scenery.

- **Start lights** (`startLights()`, `userData.lights` → `Life.updateLights`): an F1-style panel hangs under the gantry beam, with 5 columns of 2 red lamps and a green row, on both faces. When a bike comes within 28 m, the red columns light one every 0.7 s, all go out at 4.3 s, and the green row shows for 2 s. It re-arms once the bike is 45 m away. The garlands are wound round the posts, never on the lights. *Why:* Adit asked for real start lights instead of decoration bulbs.
- **Crowd:** each fan is a torso (shirt colour) and a head (varied skin tones), with arms that rise with the wave (`arm: true` part). *Why:* "people look like dots".
- **Marshal post:** a two-storey tower (glass cab, roof flags on 9 m poles, a red MARSHAL POST 8 board on the roof, amber beacon). *Why:* the first one was too small to notice at the hairpin.

## Build invariants
- **The expressway is drawn above the roads that join it** (y 0.16, over their strips and fillets at ≤ 0.14). A joining road's end is cut square, so at a slanted join one corner poked out over the carriageway. It is sampled every 2 m so its curves don't show facets.
- **Field plots are checked at all four corners** (a plot is 3.3 × 2.2 m), not just at the centre, or the edge plots spill over roads. Keep fields on open land, away from junctions.
- **Roads that end on another road snap onto its centreline** (`nearestOn`) — smoothed curves don't pass through their control points, and one lane once dead-ended 5 m short.
- Junction strips and fillets come from the shared `trimmedRoad` / `junctionAprons` in `ladakhWorld.ts`.
- Scenery follows the `world-engine` performance rules (chunked instancing, light toys). Budget check (2026-11-18): ~113 draw calls, 0.43 M triangles.
