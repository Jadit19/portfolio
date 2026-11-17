import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { RouteId } from "../content/types";
import { WORLDS, type WorldInfo, world } from "../content/worlds";
import { app, patchCount } from "../state/app";
import { stampedAt } from "../state/ride";
import { useStore } from "../state/store";
import { prefersReducedMotion } from "../three/anim";
import { COLOUR } from "../three/lineup/yard";
import { enterFullscreen, smallScreen } from "./fullscreen";
import { RideLabel, ride } from "./Picker";
import { CLOSE_SLIDE, drawPassport, type Stamped } from "./passportArt";

const band = (w: WorldInfo) => ({ "--band": COLOUR[w.bike.kind] }) as CSSProperties;

/**
 * The yard's UI, kept off the plot (the centrepiece): the picked bike's card
 * as a short caption bar along the bottom, always in the same place (the
 * passport button lives in the top bar). On a phone held upright, a note asks
 * for landscape. The bikes themselves are picked in the scene. While the
 * passport is out (`away`), the card slides down off the bottom of the frame,
 * and back up as the passport goes.
 */
export function YardUi({ away = false }: { away?: boolean }) {
  const selected = useStore(app, (s) => s.selected);
  return (
    <>
      <div className={`yard-dock${away ? " away" : ""}`} inert={away}>
        {selected ? <YardCard w={world(selected)} /> : <Hello />}
      </div>
      <RotateHint />
    </>
  );
}

function YardCard({ w }: { w: WorldInfo }) {
  const locked = Boolean(w.unlockAfter && patchCount(app.get()) < w.unlockAfter);
  return (
    <section className="yard-card" style={band(w)} key={w.id} aria-live="polite">
      <div className="who">
        <p className="eyebrow">{w.kind}</p>
        <h2>{w.name}</h2>
      </div>
      <div className="what">
        <p className="lede">{w.blurb}</p>
        <p className="bike">
          {w.bike.name} · {w.bike.inspired} · {w.place}
        </p>
      </div>
      <button
        type="button"
        className="ride"
        onClick={() => {
          // Phones and small screens: the ride is full screen (asked for here, still inside the tap).
          if (ride(w) && smallScreen()) void enterFullscreen();
        }}
        aria-disabled={locked}
      >
        {locked ? `Earn ${w.unlockAfter} stamps to ride` : <RideLabel w={w} locked={false} />}
      </button>
    </section>
  );
}

/** Before a pick: a hello and how to pick, in the card's place. */
function Hello() {
  return (
    <section className="yard-card hello" style={{ "--band": "#fec766" } as CSSProperties}>
      <div className="who">
        <p className="eyebrow">Adit Jain</p>
        <h2>Pick a bike</h2>
      </div>
      <div className="what">
        <p className="lede">
          Each bike rides into a different part of my work. Tap one to see where it goes.
        </p>
      </div>
    </section>
  );
}

/** Phones held upright: the yard needs the width, so ask for landscape (shown by CSS only then). */
function RotateHint() {
  return (
    <div className="rotate-hint" role="note">
      <div className="phone" aria-hidden="true">
        <i />
      </div>
      <h2>Turn your phone sideways</h2>
      <p>The yard and the worlds are built for landscape.</p>
    </div>
  );
}

const OPEN_SECONDS = 2.8;
const CLOSE_SECONDS = 1.6;

/**
 * The passport: slides in from the right, opens and riffles to the stamps. A
 * click anywhere (or Esc, or P again) closes it: the book shuts and slides
 * away right, then the yard comes back.
 */
export function PassportBook({ onLeaving }: { onLeaving?: () => void }) {
  const stamped = useStore(app, (s) => s.stamped);
  const canvas = useRef<HTMLCanvasElement>(null);
  /** Set when closing starts (the loop then runs the opening backwards). */
  const closing = useRef<number | null>(null);
  const [, rerender] = useState(0);
  const leavingRef = useRef(onLeaving);
  leavingRef.current = onLeaving;

  const close = () => {
    if (closing.current !== null) return;
    closing.current = performance.now();
    rerender((n) => n + 1);
  };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const stamps: Stamped[] = stamped
      .map((id: RouteId) => ({ kind: world(id).bike.kind, when: stampedAt(id) }))
      .sort((a, b) => a.when - b.when);
    let raf = 0;
    const start = performance.now();
    const still = prefersReducedMotion();
    /** How open it was when closing began (so a quick click mid-opening closes from there). */
    let from = 0;
    let shown = 0;
    let leaving = false;
    const frame = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(c.clientWidth * dpr);
      const h = Math.round(c.clientHeight * dpr);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      const shut = closing.current;
      if (shut !== null) {
        if (!from) from = shown || 1;
        // (A frame can be stamped a touch before the click: clamp.)
        const t = still ? 1 : Math.min(1, Math.max(0, (now - shut) / 1000 / CLOSE_SECONDS));
        // Fully open: the cover swings shut and it slides away right. Caught mid-opening:
        // the opening runs back from there. (Each part eases itself in drawPassport,
        // so time runs straight here.)
        shown = from * (1 - t);
        drawPassport(c, shown, stamps, undefined, from >= 1);
        // Once the cover is shut and it starts to slide away, the yard's card rises back.
        if (!leaving && (from < 1 || shown <= CLOSE_SLIDE)) {
          leaving = true;
          leavingRef.current?.();
        }
        if (t < 1) raf = requestAnimationFrame(frame);
        else app.patch({ view: "table" });
        return;
      }
      const t = still ? 1 : Math.min(1, Math.max(0, (now - start) / 1000 / OPEN_SECONDS));
      shown = t;
      drawPassport(c, shown, stamps);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [stamped]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc or P (it opened with P) closes it.
      if (e.key === "Escape" || (e.key.toLowerCase() === "p" && !e.repeat)) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const earned = patchCount(app.get());
  return (
    <div className="passport-book" role="dialog" aria-modal="true" aria-label="Your passport">
      <canvas ref={canvas} onClick={close} />
      <div className="sr-only">
        <p>{earned} of 6 stamps. Three stamps open the secret ride.</p>
        <ul>
          {WORLDS.map((w) => (
            <li key={w.id}>
              {w.name}: {stamped.includes(w.id) ? "stamped" : "not yet"}
            </li>
          ))}
        </ul>
        {/* Seen only by screen readers and keyboards: clicking anywhere closes it for everyone else. */}
        <button type="button" onClick={close}>
          Close the passport
        </button>
      </div>
    </div>
  );
}
