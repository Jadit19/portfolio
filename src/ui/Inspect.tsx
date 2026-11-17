import { type CSSProperties, useEffect, useRef } from "react";
import { WORLDS, world } from "../content/worlds";
import { app, patchCount } from "../state/app";
import { useStore } from "../state/store";
import type { GarageScene } from "../three/garage/scene";
import { Arrow } from "./Arrow";
import { RideLabel, ride } from "./Picker";
import { useCompact } from "./useCompact";

const FEEL: [keyof ReturnType<typeof world>["feel"], string][] = [
  ["speed", "Speed"],
  ["grip", "Grip"],
  ["lean", "Lean"],
];

/** Inspect 360°: the spin hint with a live dial, the spec card, back and next/previous. */
export function Inspect({ garage }: { garage: GarageScene }) {
  const selected = useStore(app, (s) => s.selected);
  const compact = useCompact();
  // Before a pick it's Murphy on the turntable.
  const w = world(selected ?? "murphy");
  const dial = useRef<HTMLSpanElement>(null);
  const locked = Boolean(w.unlockAfter && patchCount(app.get()) < w.unlockAfter);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      dial.current?.style.setProperty("--a", `${garage.spinDegrees().toFixed(1)}deg`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [garage]);

  const step = (d: number) => {
    const i = WORLDS.findIndex((x) => x.id === (selected ?? "murphy"));
    const next = WORLDS[(i + d + WORLDS.length) % WORLDS.length];
    if (next) app.patch({ selected: next.id });
  };

  return (
    <>
      <button type="button" className="back" onClick={() => app.patch({ view: "table" })}>
        <Arrow dir="back" /> {compact ? "Journeys" : "Map table"}
      </button>
      <div className="spin" aria-hidden="true">
        <span className="dial" ref={dial} />
        <b>Drag to spin</b>
        <span>360° · pinch or scroll to zoom</span>
      </div>
      <aside className="panel inspect" aria-label={`${w.bike.name} details`}>
        <section className="card" style={{ "--tint": w.tint } as CSSProperties} key={w.id}>
          <div className="cycle">
            <button type="button" onClick={() => step(-1)} aria-label="Previous bike">
              ‹
            </button>
            <p className="eyebrow">{w.kind}</p>
            <button type="button" onClick={() => step(1)} aria-label="Next bike">
              ›
            </button>
          </div>
          {compact ? (
            // On a phone held sideways this is the journey's card (the bike spins beside it).
            <>
              <h2>{w.name}</h2>
              <p className="bike">
                {w.bike.name} · {w.bike.inspired} <span>· {w.stops} stops</span>
              </p>
            </>
          ) : (
            <>
              <h2>{w.bike.name}</h2>
              <p className="bike">
                {w.bike.inspired} · {w.bike.engine} <span>· for the {w.name} world</span>
              </p>
            </>
          )}
          <dl className="feel">
            {FEEL.map(([k, label]) => (
              <div key={k}>
                <dt>{label}</dt>
                <dd>
                  <i style={{ "--v": w.feel[k] } as CSSProperties} />
                </dd>
              </div>
            ))}
          </dl>
          <button type="button" className="ride" onClick={() => ride(w)} aria-disabled={locked}>
            <RideLabel w={w} locked={locked} />
          </button>
        </section>
      </aside>
    </>
  );
}
