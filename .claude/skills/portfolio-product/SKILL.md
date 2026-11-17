---
name: portfolio-product
description: Product decisions for Adit's portfolio game — audience, stack, worlds and their bikes, stops-as-landmarks, content confidentiality rules, yard/passport/HUD UX, controls, and which older decisions are superseded. Load before changing content, UI, world lists, stops, or anything a recruiter sees.
---

# Product: what the portfolio is and why

## Goal and audience
- A personal portfolio Adit sends to **recruiters and job portals**, hosted statically on GitHub Pages at `portfolio.aditjain.me` (résumé at `resume.aditjain.me`, blog at `blogs.aditjain.me`).
- It plays like a toy motorcycle game, but **a recruiter must get the work without playing**: every world card leads with what the work is (*Work · Founding engineer*, *Club · IIT Kanpur* …), there is an always-visible **Résumé ↗** button, and stops open readable HTML cards.
  *Why:* the game is the hook; the work is the payload. Nothing important may depend on riding skill.

## Stack (and why)
- **Bun** (runtime, bundler, dev server, tests), **TypeScript strict**, **Biome**, **React 19** for all text/UI (real, selectable, accessible HTML — never text drawn on canvas), **three.js 0.187** for the worlds (models built in code from primitives; no asset pipeline), **Rapier** (`@dimforge/rapier3d-compat`) for props physics.
- `bun run check` = typecheck + lint + tests; must pass before you report.
- `bun run dev` serves `index.html`; `?debug` exposes `window.__world`.

## Worlds (garage order) and bikes
| World | Region / theme | Bike (original, inspired by; no logos) |
|---|---|---|
| Zingle AI | Thar desert rally | KTM 450 Rally-style |
| WinZO | Spa-style circuit, Indian dressing | Fireblade-style superbike |
| Expresso | Coorg coffee estates (first flat world) | Speed Twin café racer-style |
| AstroClub IITK | Ladakh / Hanle (see `astroclub-world`) | R 1300 GSA-style adventure |
| C++ for fun | Dussehra riverside mela | Scrambler 1100-style |
| Personal | Sikkim & North-East | Fat Boy-style bobber |
| Secret ("23 Before 23") | Delhi → Varkala, south | Royal Enfield Guerrilla 450, silver (Adit's real bike, "Murphy") |

Each world has its own `feel` (`speed`, `grip`, `lean`) in `src/content/worlds.ts`; top speed = `16 + speed·12`, accel = `3 + speed·2.6`.

## Worlds are open, wrapping, discovered
- No start/end; the world **wraps like a torus** (ride off east, arrive west) and feels endless.
- Roads guide but **free roam everywhere**; off-road is slower (surface drag), cliffs/buildings/deep water block.
- **Roads never dead-end**; lanes loop or join. Rail tracks wrap across seams.
- **Every stop is a landmark** beside the road with its own forecourt (lit at night) — never an empty ring on the road. Discovering all stops earns the world's passport stamp; 3 stamps unlock Secret.
- **Cruise** auto-rides along roads to the next/selected stop; any steering hands control back; if stuck it glides back to the road (never teleports).
- Activities (ramps, gate jumps, fords, train races) are just there to be found — no UI beyond a small toast.

## Content rules (hard)
- Positive framing only: no weaknesses, issues, "future work".
- WinZO: no international market names, volumes or GMV; ZoPass's only number is 6% MoM.
- Zingle: internal codenames → generic descriptions; self-reported numbers shown plainly.
- Links wherever possible (GitHub, PyPI, Docker Hub, papers — e.g. Hyperion 2022 links GW150914, arXiv 1602.03837).

## Opening, yard and HUD (current — supersedes the older "garage map table")
- The opening is a **dhaba yard on a raised diorama plot** with painted parking bays (left→right: C++ for fun, Expresso, WinZO, Zingle AI, AstroClub, Personal; Secret apart at front right), sign **ADIT JAIN**, Adit the only person, no cow.
- Plot always centred and symmetric; the card is a caption bar along the bottom; phones held upright show "Turn your phone sideways".
- Passport = a round icon button that opens a **booklet** with immigration-style stamps (varied shapes, tilted, wholly within one page).
- Keys: arrows/WASD ride, E/Enter stop or ride, Esc closes a card / deselects, F full screen, P passport, N night toggle.
- **The world builds only when the ride starts** (never on selection) — building in the background made the yard lag.
- **Arrows in UI text are drawn, never characters.** Use `<Arrow dir="out|back|next" />` (`src/ui/Arrow.tsx`); iOS renders `↗ ← →` as colour emoji (it happened on the Résumé button).
- **Full screen:** where the browser supports it, the top-bar button toggles it (and Ride enters it on small screens). **iPhone Safari can't**, so there the same button opens a three-step "Add to Home Screen" popover, once by itself on the first visit (`portfolio:homescreen-tip`), then on tap. The site is an installable web app (`public/manifest.webmanifest`, `display: fullscreen`, landscape; `apple-mobile-web-app-*` tags in `index.html`), so from the Home Screen it opens edge to edge. App icon = Murphy side-on in clay on linen (I1 on the `design/3d/appicon` board), exported to `public/apple-touch-icon.png` and `public/icons/`.
- `index.html` links to files under `./public/…` (Bun's bundler resolves every `<link href>`; absolute `/…` paths fail the build).

## Superseded decisions (don't resurrect)
Isometric dioramas, voxel/pixel art, the 2D canvas engine, paint shop, garage map table/turntable/jacket rack ritual, pin-board passport, planet-curved hilly terrain with haze. They appear in old notes; the flat toy world + dhaba yard replaced them.
