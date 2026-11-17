import { useCallback, useEffect, useRef, useState } from "react";
import { world } from "../content/worlds";
import { app, leaveWorld, setNight } from "../state/app";
import { useStore } from "../state/store";
import { prefersReducedMotion } from "../three/anim";
import { Arrow } from "./Arrow";
import {
  canFullscreen,
  enterFullscreen,
  exitFullscreen,
  homeScreenOnly,
  inFullscreen,
} from "./fullscreen";

export const RESUME_URL = "https://resume.aditjain.me";

export function TopBar() {
  const riding = useStore(app, (s) => (s.mode === "world" ? s.world : null));
  return (
    <header className="topbar">
      <div className="brand">
        <b>ADIT JAIN</b>
        <span>{riding ? `${world(riding).name} · ${world(riding).place}` : "The yard"}</span>
      </div>
      <nav>
        {riding ? (
          // On a journey the way back is what matters (the passport lives in the yard).
          <button type="button" className="chip" onClick={leaveWorld}>
            <Arrow dir="back" /> Yard
          </button>
        ) : null}
        {/* In a ride you're already full screen (Ride asks for it), and the passport lives in the yard. */}
        {riding ? null : <FullscreenButton />}
        {riding ? null : <PassportButton />}
        <NightButton />
        <a className="resume" href={RESUME_URL} target="_blank" rel="noopener">
          Résumé <Arrow dir="out" />
        </a>
      </nav>
    </header>
  );
}

/** Two diagonal arrows: pointing out to go full screen, in to come back. */
function FullscreenIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {on ? (
          <path d="M4 4l6 6M5 10h5V5M20 20l-6-6M19 14h-5v5" />
        ) : (
          <path d="M10 10L4 4M4 9V4h5M14 14l6 6M20 15v5h-5" />
        )}
      </g>
    </svg>
  );
}

/**
 * Full screen, for small screens where every pixel counts (shown by CSS only
 * on small or touch screens). On iPhone, which can't, it explains the Home
 * Screen instead (see HomeScreenTip).
 */
function FullscreenButton() {
  const [on, setOn] = useState(inFullscreen);
  useEffect(() => {
    const sync = () => setOn(inFullscreen());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);
  if (homeScreenOnly()) return <HomeScreenTip />;
  if (!canFullscreen()) return null;
  return (
    <button
      type="button"
      className="icon-btn fs-btn"
      aria-label={on ? "Leave full screen" : "Go full screen"}
      aria-pressed={on}
      onClick={() => void (on ? exitFullscreen() : enterFullscreen())}
    >
      <FullscreenIcon on={on} />
    </button>
  );
}

const TIP_SEEN = "portfolio:homescreen-tip";

const ShareIcon = () => (
  <svg className="tip-glyph" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M8 10V2M5 4.5 8 1.5l3 3M4 7H3v7h10V7h-1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AddIcon = () => (
  <svg className="tip-glyph" viewBox="0 0 16 16" aria-hidden="true">
    <rect
      x="2"
      y="2"
      width="12"
      height="12"
      rx="3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/**
 * iPhone Safari can't go full screen, but the site added to the Home Screen
 * opens edge to edge. The full-screen button stays and opens these steps; the
 * first visit they open once by themselves (H2 on the app-icon board).
 */
function HomeScreenTip() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(TIP_SEEN, "1");
    } catch {
      // Storage blocked: it may show again next visit, which is fine.
    }
  }, []);
  // The first visit: open once, after the yard has settled.
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(TIP_SEEN) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    const t = setTimeout(() => {
      setOpen(true);
      try {
        localStorage.setItem(TIP_SEEN, "1");
      } catch {
        // As above.
      }
    }, 1400);
    return () => clearTimeout(t);
  }, []);
  // Closes on a tap anywhere else, or Esc.
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, close]);
  return (
    <span className="tip-wrap" ref={wrap}>
      <button
        type="button"
        className="icon-btn fs-btn"
        aria-label="How to go full screen"
        aria-expanded={open}
        aria-controls="homescreen-tip"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <FullscreenIcon on={false} />
      </button>
      <div
        id="homescreen-tip"
        className={`tip-pop${open ? " is-open" : ""}`}
        role="dialog"
        aria-label="Full screen on iPhone"
        aria-hidden={!open}
      >
        <b className="tip-title">Full screen on iPhone</b>
        <ol>
          <li>
            Tap <ShareIcon /> <strong>Share</strong>
          </li>
          <li>
            Tap <AddIcon /> <strong>Add to Home Screen</strong>
          </li>
          <li>
            Open <strong>Adit Jain</strong> from your Home Screen
          </li>
        </ol>
        <button type="button" className="tip-ok" onClick={close} tabIndex={open ? 0 : -1}>
          Got it
        </button>
      </div>
    </span>
  );
}

/** The passport: a round button like the full-screen one, with a book on it. */
function PassportButton() {
  const open = useStore(app, (s) => s.view === "passport");
  return (
    <button
      type="button"
      className="icon-btn passport-btn"
      aria-label="Open your passport"
      aria-pressed={open}
      onClick={() => app.patch({ view: "passport" })}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* The cover with its rounded spine, the page edge rolled at the foot, a label, a ribbon. */}
          <path d="M19 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21H19V3Z" />
          <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19" />
          <path d="M8 3v13" />
          <path d="M7.5 18.5H19" />
          <rect x="11" y="6.5" width="5.5" height="3.5" rx="0.3" />
          <path d="M10.5 18.5v4.3l1.4-1.2 1.4 1.2v-4.3" />
        </g>
      </svg>
    </button>
  );
}

/**
 * Day and night: a round button like its neighbours. Its sun draws in its
 * rays as a bite closes it into a crescent moon, over the same ~5 s as the
 * world's dusk (and back at dawn). Shortcut: N.
 */
function NightButton() {
  const night = useStore(app, (s) => s.night);
  const [t, setT] = useState(night ? 1 : 0);
  const shown = useRef(t);
  useEffect(() => {
    const goal = night ? 1 : 0;
    if (prefersReducedMotion()) {
      shown.current = goal;
      setT(goal);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // (A frame's timestamp can be a touch earlier than when this started.)
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const v = shown.current;
      const next = goal > v ? Math.min(goal, v + dt / 5) : Math.max(goal, v - dt / 5);
      shown.current = next;
      setT(next);
      if (next !== goal) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [night]);
  // The icon's shape eases (slow in and out) over the linear time.
  const c = Math.min(1, Math.max(0, t));
  const e = c * c * (3 - 2 * c);
  const r = 4.6 + 3.2 * e;
  const bx = 24 - 7.4 * e;
  const by = 7.4 * e;
  return (
    <button
      type="button"
      className="icon-btn night-btn"
      aria-label={night ? "Switch to day" : "Switch to night"}
      aria-pressed={night}
      onClick={() => setNight(!night)}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <defs>
          <mask id="night-bite">
            <rect width="24" height="24" fill="white" />
            <circle cx={bx} cy={by} r={r * 0.82} fill="black" />
          </mask>
        </defs>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const r0 = 6.6;
          const r1 = 6.6 + 3.2 * (1 - e);
          return (
            <line
              // biome-ignore lint/suspicious/noArrayIndexKey: eight fixed rays
              key={i}
              x1={12 + Math.cos(a) * r0}
              y1={12 + Math.sin(a) * r0}
              x2={12 + Math.cos(a) * r1}
              y2={12 + Math.sin(a) * r1}
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity={1 - e}
            />
          );
        })}
        <circle cx="12" cy="12" r={r} fill="currentColor" mask="url(#night-bite)" />
      </svg>
    </button>
  );
}
