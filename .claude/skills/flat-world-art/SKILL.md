---
name: flat-world-art
description: The visual language of the ride worlds — flat clay-toy look, fixed high camera, draped cut-paper shadows, regional Indian landscapes, carved-rock mountains with rounded edges and an irregular snowline, natural roads, bridges, lights and night. Load before designing or changing anything visible in a world.
---

# Flat toy-world art direction

The worlds are **toy dioramas of Indian regions** in one shared pastel clay language. Sharpness and naturalness beat realism; anything that looks "generated" gets rejected.

## Core look (why each choice exists)
- **Flat ground, one colour per world (G1)**, fixed high ¾ camera, **no haze, fog, planet curve or horizon**. *Why:* earlier rolling/hazy renders read as "blur"; a flat ground keeps the toys the focus.
- **Clay matcap** (`MeshMatcapMaterial`), no real lights; colour from vertex/instance colours. Ink outlines were rejected ("look terrible").
- **Shadows: draped, darkening, non-stacking (S1).** `drapedShadow` in `src/three/flat/kit.ts` projects onto a heightmap texture with multiply blending and a stencil (`NotEqual/Replace`) so overlapping shadows never get darker. Requires `stencil: true` on the renderer and a DepthStencil target in the night pass.
- **Density:** rich but calm; Expresso balanced, AstroClub a little sparse. Scatter is natural (no ruler-straight rows) and seamless across the wrap.
- **No barren land; everything sits on the ground** — nothing floats, nothing is buried, buildings on level pads.

## Roads
- Organic curves, never mechanical straight/perpendicular grids, never zigzag. Lanes cross rivers at acute/obtuse angles.
- **Never dead-end.** Never cross water without a bridge (roads stop at the bank otherwise).
- Surface changes are **gradual** (paved → gravel over ~20 m with scattered loose stones), not a hard switch.
- **Junctions are tidy:** a joining strip is trimmed exactly at the through road's edge and the corners get true fillets in the joining road's colour. *Why:* overlapping rectangles at joins were called out as "weird".
- Mountain roads get curbs at the shelf edge and stilt galleries in **bits**, never one continuous run.

## Mountains (approved: Y2 base, `design/3d/astro6`)
Arrived at after many rejected boards — keep to these rules:
- **Subtractive:** start from a mountain's smooth form and carve it into blocks (Voronoi joints, each block a gently tilted mesa), not stacked towers. *Why:* stacked rocks, spires and random yaw all "looked generated".
- **No spikes, no needles, coherent orientation, gentle height gradient**, natural plateaus up high (a squashed rock resting on similar-height boulders) — but no flat caps that stand out.
- **Border radius ~3 m on every ridge** (smooth max between blocks + a light terrain blur that leaves roads untouched). Think CSS `border-radius`, not low-poly facets.
- **Snowline:** crisp edge (anti-aliased, not blurred), rises and falls randomly (~±7 m), lower in gullies, patches below the line.
- **Near roads:** finer blocks along the cut and fill, scree below — so the rock stays blocky right up to the tarmac.

## Water and crossings
- Rivers are banded (bank, shallows, deep). Bridges in Ladakh are **wooden**: B1 log cribs + prayer flags, B2 cantilever with a roofed gate, alternating. Fords are an F2 stone causeway with water spilling over and marker posts.

## Lights and night
- Lights cast **one smooth translucent white-yellow pool** — no nested rings, wedges or faceted shapes.
- Night is a full-screen repaint (`src/three/flat/night.ts`): day colours graded to a night palette, true colours inside the headlight cone and lamp pools. Any height test in that shader must be **relative to the bike/ground**, never absolute world Y (the beam vanished on mountains for exactly this reason).
- Overlays that must not be darkened (stars, meteors, constellations) draw on the night pass's overlay layer.

## Signs and text in the world
- Indian road furniture: NHAI-style green boards (English always present), km stones, BRO slogan boards in Ladakh. Board text is **fitted to the board width** (`board(..., fit = true)` shrinks lines to 88%). Overflowing text is a defect.
