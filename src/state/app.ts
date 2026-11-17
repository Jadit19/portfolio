/**
 * App state shared by the 3D scene and the React UI. The scene subscribes to
 * changes (selection, view); the UI renders from the same store.
 */

import type { RouteId } from "../content/types";
import { createStore } from "./store";

export type View = "table" | "inspect" | "passport";

export interface AppState {
  /** 0–1 while the garage is being built; 1 when ready. */
  loading: number;
  ready: boolean;
  view: View;
  /** The picked world; null until the visitor picks one (Murphy waits on the turntable). */
  selected: RouteId | null;
  hovered: RouteId | null;
  /** Worlds whose patch is on the passport board (all stops discovered). */
  stamped: RouteId[];
  /** A short, dismissible message (e.g. "This ride opens soon"). */
  toast: string | null;
  /** Where you are: the garage, or riding a world. */
  mode: "garage" | "world";
  /** The world being ridden (or loading), when mode is "world". */
  world: RouteId | null;
  /** The world is built and showing. */
  worldReady: boolean;
  /**
   * The ride ritual in the garage: kitting up and riding "out", waiting over
   * the map ("hold") while the world finishes building, or coming home ("in").
   */
  ritual: "out" | "hold" | "in" | null;
  /** A full-screen wash of colour over the hand-over between garage and world. */
  veil: string | null;
  /** The world's sky colour (the veil's colour on the way in and out). */
  tone: string;
  /** Night (the toggle): the yard and the worlds go from day to night (and back) over ~5 s. */
  night: boolean;
}

const NIGHT_KEY = "portfolio:night";
/** Night as last chosen, or (first visit) the device's dark setting. */
function nightAtStart(): boolean {
  try {
    const saved = localStorage.getItem(NIGHT_KEY);
    if (saved === "1" || saved === "0") return saved === "1";
  } catch {
    // Storage blocked: fall through to the device setting.
  }
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export const app = createStore<AppState>({
  loading: 0,
  ready: false,
  view: "table",
  selected: null,
  hovered: null,
  stamped: [],
  toast: null,
  mode: "garage",
  world: null,
  worldReady: false,
  ritual: null,
  veil: null,
  tone: "#2b2723",
  night: nightAtStart(),
});

/** Day or night, remembered for next time. */
export function setNight(on: boolean): void {
  app.patch({ night: on });
  try {
    localStorage.setItem(NIGHT_KEY, on ? "1" : "0");
  } catch {
    // Not remembered; fine.
  }
}

/** Seconds the veil takes to wash over (keep in step with .veil in the CSS). */
export const VEIL_IN = 0.32;

/** Back to the garage: wash over in the world's colour, then hand over. */
export function leaveWorld(): void {
  const s = app.get();
  if (s.mode !== "world") return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !s.worldReady) {
    app.patch({ mode: "garage", world: null, worldReady: false });
    return;
  }
  app.patch({ veil: s.tone });
  setTimeout(() => app.patch({ mode: "garage", world: null, worldReady: false }), VEIL_IN * 1000);
}

/** Patches earned (the Secret world's own patch doesn't count toward unlocking it). */
export const patchCount = (s: AppState): number => s.stamped.filter((id) => id !== "murphy").length;
