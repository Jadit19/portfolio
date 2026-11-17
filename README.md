# Adit Jain · Ride the portfolio

A portfolio you ride. Pick a bike in Murphy's garage and explore Adit's work as
isometric dioramas: a race circuit, a Dakar rally stage, a café, a village fair,
the climb to the Hanle observatory, a forest trail, and one secret route.

Live at **https://portfolio.aditjain.me**. The résumé is at https://resume.aditjain.me.

## Stack

- **Bun** for the runtime, package manager, bundler, dev server and tests
- **TypeScript** in strict mode
- **React 19** for the UI layer: menus, cards, HUD and dialogs, all real, accessible HTML
- **A small Canvas 2D engine** written for this project (`src/engine`):
  - fixed-timestep loop
  - isometric projection
  - camera
  - roads with filleted corners
  - input from keyboard, touch and gamepad
- **Procedural vector art and WebAudio sound**, with no image or audio assets
- **Biome** for linting and formatting

## Develop

```sh
bun install
bun run dev        # http://localhost:3000 with hot reload
bun run check      # typecheck + lint + tests
bun run build      # production build into dist/
bun run preview    # serve dist/ on :4173
```

Visual smoke tests, which need a Chromium-based browser installed:

```sh
bun run scripts/snap.ts snapshots                 # whole flow on 4 viewports
HOUR=22 bun run scripts/snap-route.ts astro shots # one route; HOUR fakes the clock
```

Deep link to a route: `/?route=winzo` (also `zingle`, `expresso`, `fun`,
`astro`, `personal` and `murphy`).

## Layout

| Path | What lives there |
|---|---|
| `src/engine` | Engine primitives: projection, roads, camera, input, drawing |
| `src/game` | The garage and route scenes, rider physics, tricks and combos |
| `src/world` | Bikes, props, lighting, weather, and one diorama per route |
| `src/content` | Content model, Murphy's lines, and placeholder/real data |
| `src/art` | SVG art used for signs, card badges and tank stickers |
| `src/ui` | React overlay: garage, HUD, cards, panels, finale and certificate |
| `src/state` | Small stores, plus saved progress (stored only in the visitor's browser) |
| `DECISIONS.md` | Every product decision, with the reason behind it |

Deploys run through GitHub Actions to GitHub Pages (`.github/workflows/deploy.yml`).
