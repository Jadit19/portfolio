import { app } from "../state/app";
import { useStore } from "../state/store";
import { RIDES } from "../three/world/rides";

const TIPS = [
  "Fuelling up…",
  "Checking tyre pressure…",
  "Polishing the chrome…",
  "Finding the keys. They were in the other jacket.",
];

/** A fuel gauge filling from E to F while the garage builds. */
export function Loader() {
  const p = useStore(app, (s) => s.loading);
  const ready = useStore(app, (s) => s.ready);
  const riding = useStore(app, (s) => (s.mode === "world" ? s.world : null));
  const worldReady = useStore(app, (s) => s.worldReady);
  const angle = -110 + p * 220;
  const tips = (riding && RIDES[riding]?.tips) || TIPS;
  const tip = tips[Math.min(tips.length - 1, Math.floor(p * tips.length))];
  // Riding with the ritual, the garage itself is the loading screen.
  const ritual = useStore(app, (s) => s.ritual !== null || s.veil !== null);
  const done = ready && (!riding || worldReady || ritual);
  return (
    <div
      className={`loader ${done ? "is-done" : ""} ${riding ? "is-ride" : ""}`}
      role="status"
      aria-live="polite"
    >
      <svg viewBox="0 0 200 130" className="gauge" aria-hidden="true">
        <path d="M30 110 A80 80 0 0 1 170 110" className="arc" />
        <path
          d="M30 110 A80 80 0 0 1 170 110"
          className="fill"
          pathLength={1}
          strokeDasharray={`${p} 1`}
        />
        <text x="26" y="128">
          E
        </text>
        <text x="166" y="128">
          F
        </text>
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 110px" }}>
          <line x1="100" y1="110" x2="100" y2="48" className="needle" />
        </g>
        <circle cx="100" cy="110" r="7" className="hub" />
      </svg>
      <p>{tip}</p>
      <span className="sr-only">Loading {Math.round(p * 100)}%</span>
    </div>
  );
}
