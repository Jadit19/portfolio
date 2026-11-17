---
name: portfolio-collaboration
description: How to work with Adit on this motorcycle-game portfolio — design-first process, multi-select questions, design boards, decision logging, the polish bar, and what never to do (commits, Bruno Simon assets, private info). Load at the start of any task in this repo, especially visual, world or UX work.
---

# Working on Adit's portfolio

This repo is Adit Jain's portfolio: a three.js motorcycle game where each "world" is a region of India and each stop is a piece of his work. Adit is the designer and the final judge of taste; you are the engineer **and** a creative partner. Most rework in past sessions came from skipping the steps below, so treat them as the contract.

## The loop: ask → board → pick → build → verify

1. **Ask, with multi-select.** When anything is ambiguous, use `AskUserQuestion` with numbered/labelled options and `multiSelect: true` where choices can combine. Adit answers by picking, often several at once, and adds notes.
   *Why:* he decides fast from concrete options and slowly from open questions; open prose questions stalled earlier sessions.
2. **Show a design board before touching the site** for any visual change (terrain, roads, landmarks, UI). Boards live in `design/3d/<name>-board.ts` + `<name>.html`, are served with `bun --port <N> design/3d/<name>.html`, and exported with `DSF=2 bun run scripts/capture-design.ts http://localhost:<N> design/3d/<dir>`. Label every variation (A/B, Y1/Y2, E1–E3 …) so he can answer "Y2, but …".
   *Why:* he explicitly asked "Show me designs, then we'll iterate". Building first and iterating in the live site cost several rounds (rock mountains went through ~6 boards before one was approved).
3. **Boards import the real modules** (`src/three/lib/*`), never copies. *Why:* what he approves is then exactly what ships; design code is throwaway but must not fork the engine.
4. **Build only what was picked**, then **verify in the running game** (see the `verify-in-browser` skill) before reporting. Screenshots of the real thing, not just green tests.
5. **Record the decision** (see below).

## Be a creative partner, not an order-taker
- Go beyond the brief with fitting, regional detail (monasteries on the Ladakh route, BRO signs, yaks by Pangong). Pitch ideas as numbered lists he can accept or reject.
- **Indian authenticity lives inside the worlds only.** The yard/landing UI stays modern and minimal (he rejected a rangoli turntable: "Only when the user explores the real world should they get a taste of the Indian culture").
- Never recreate Bruno Simon's site or assets. Principles (drivable toy world, physics props) are fine; his look, models, or layout are not.

## The polish bar ("Attention to detail is lacking" is the complaint to never hear again)
- Animations are gradual and eased (springs/ease-out); nothing snaps or teleports — even recovery logic (cruise un-sticking glides back over ~1.1 s).
- No hard edges: rock ridges have a border radius, junctions have fillets, road surfaces blend paved→gravel over ~20 m.
- **Responsiveness is the top priority** for UI: test laptop, tablet, phone landscape (844×390, 667×375) and phone portrait.
- Before reporting, look for the second-order defects yourself: overflowing text, gaps between meshes, things floating or buried, roads that dead-end. He finds these instantly.

## Hard rules
- **Commit only when he asks.** When he does: **small, focused commits straight to `main`, then push** (his own repo; no feature branches or PRs). Pushing `main` deploys to portfolio.aditjain.me via GitHub Pages, and CI runs `bun run check` first.
- **DECISIONS.md is local-only** (git-ignored). Read it for history, update it only when he asks; never rely on it existing in a fresh clone. Durable rules belong in these skills.
- Don't write AGENTS.md.
- Keep his private details (email, etc.) out of any external request.
- Report honestly: if a sim says fixed but you haven't seen it in the game, say so.

## Reading his feedback
- Screenshots + one line ("The bike is too slow climbing") usually point at a **symptom**; find the mechanism before tuning numbers (see `bike-physics` — the real cause of "slow uphill" was a hidden collision body, not engine power).
- Several bullets in one message = several independent fixes; track each to closure and report each.
- "X is better than Y" / "Y2 looks quite good, however …" means: keep Y2 as the base and change only what he named.
