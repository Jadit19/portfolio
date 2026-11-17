/**
 * State for riding a world: which stops you've found, which one you're near,
 * the open card, and cruise. The world scene writes it; the HUD renders it.
 *
 * Progress (stops found, where you last were) is kept only in the visitor's
 * own browser, and the site works the same if storage is unavailable.
 */

import type { RouteId } from "../content/types";
import { RIDES } from "../three/world/rides";
import { app } from "./app";
import { createStore } from "./store";

export interface RideState {
  /** Ids of the stops found in the current world. */
  found: string[];
  /** Index of the stop you're close enough to pull over at, if any. */
  near: number | null;
  /** Index of the stop whose card is open, if any. */
  open: number | null;
  /** Index of the stop cruise is riding to, if any. */
  cruising: number | null;
  /** Speed for the HUD, km/h (rounded). */
  kmh: number;
  /** Close enough to a live board to open the live site. */
  nearLive: boolean;
  /** The live server's status, when the world has a live board. */
  live: { ok: boolean | null; ms: number | null } | null;
  /** Riding camera view. */
  cam: "low" | "high";
  /** Sound on (muted by default). */
  sound: boolean;
}

export const ride = createStore<RideState>({
  found: [],
  near: null,
  open: null,
  cruising: null,
  kmh: 0,
  nearLive: false,
  live: null,
  cam: "low",
  sound: false,
});

interface Saved {
  found: string[];
  at?: { x: number; z: number; heading: number };
}

const key = (id: RouteId) => `portfolio:ride:${id}`;

export function loadProgress(id: RouteId): Saved {
  try {
    const raw = localStorage.getItem(key(id));
    if (!raw) return { found: [] };
    const v = JSON.parse(raw) as Partial<Saved>;
    const found = Array.isArray(v.found) ? v.found.filter((s) => typeof s === "string") : [];
    const at = v.at;
    const ok =
      at && [at.x, at.z, at.heading].every((n) => typeof n === "number" && Number.isFinite(n));
    return ok ? { found, at } : { found };
  } catch {
    return { found: [] };
  }
}

export function saveProgress(id: RouteId, s: Saved): void {
  try {
    localStorage.setItem(key(id), JSON.stringify(s));
  } catch {
    // Private mode or storage full: progress just isn't remembered.
  }
}

/** Stops in each playable world (worlds join this as they open). */
export const STOPS_IN: Partial<Record<RouteId, number>> = Object.fromEntries(
  Object.entries(RIDES).map(([id, def]) => [id, def?.stops.length ?? 0]),
);

/** Stops found in a world, from saved progress. */
export function foundIn(id: RouteId): number {
  return loadProgress(id).found.length;
}

/** On start: patches earned on an earlier visit go back on the passport. */
export function restorePatches(): void {
  for (const [id, n] of Object.entries(STOPS_IN) as [RouteId, number][]) {
    if (foundIn(id) >= n) earnPatch(id);
  }
}

/** Marks a world's patch as earned (all stops found), once, remembering when (for the stamp's date). */
export function earnPatch(id: RouteId): void {
  const s = app.get();
  try {
    const k = `portfolio:stamp:${id}`;
    if (!localStorage.getItem(k)) localStorage.setItem(k, String(Date.now()));
  } catch {
    // Without storage the stamp just shows today's date.
  }
  if (!s.stamped.includes(id)) app.patch({ stamped: [...s.stamped, id] });
}

/** When a world's stamp was earned (ms); today if unknown. */
export function stampedAt(id: RouteId): number {
  try {
    const v = Number(localStorage.getItem(`portfolio:stamp:${id}`));
    if (Number.isFinite(v) && v > 0) return v;
  } catch {
    // Fall through.
  }
  return Date.now();
}
