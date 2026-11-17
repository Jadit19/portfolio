import { useEffect } from "react";
import { app } from "../state/app";
import { useStore } from "../state/store";

/**
 * Over the garage while the ride ritual plays: tap anywhere (or press Esc,
 * Space or Enter) to skip it. While it waits over the map for the world to
 * finish building, a thin ring shows how far along it is.
 */
/** Whatever plays the ritual (the opening yard). */
interface Ritualist {
  skipRitual(): void;
}

export function RitualHud({ garage }: { garage: Ritualist }) {
  const ritual = useStore(app, (s) => s.ritual);
  const loading = useStore(app, (s) => s.loading);
  const skippable = ritual === "out" || ritual === "in";
  useEffect(() => {
    if (!skippable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        garage.skipRitual();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skippable, garage]);
  if (ritual === "hold") {
    const r = 15;
    const c = 2 * Math.PI * r;
    return (
      <div className="ritual-hold" role="status" aria-live="polite">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r={r} className="track" />
          <circle
            cx="20"
            cy="20"
            r={r}
            className="fill"
            strokeDasharray={`${c * Math.max(0.04, loading)} ${c}`}
          />
        </svg>
        <span className="sr-only">Getting the world ready: {Math.round(loading * 100)}%</span>
      </div>
    );
  }
  if (!skippable) return null;
  return (
    <button type="button" className="ritual-skip" onClick={() => garage.skipRitual()}>
      <span className="hint">Tap to skip</span>
    </button>
  );
}

/** A full-screen wash of colour that covers the hand-over between garage and world. */
export function Veil() {
  const veil = useStore(app, (s) => s.veil);
  const tone = useStore(app, (s) => s.tone);
  return (
    <div
      className={`veil ${veil ? "is-on" : ""}`}
      style={{ background: veil ?? tone }}
      aria-hidden="true"
    />
  );
}
