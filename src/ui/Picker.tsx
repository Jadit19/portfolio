import type { CSSProperties } from "react";
import { WORLDS, type WorldInfo, world } from "../content/worlds";
import { app, patchCount } from "../state/app";
import { useStore } from "../state/store";
import { RIDES } from "../three/world/rides";
import { Arrow } from "./Arrow";
import { useCompact } from "./useCompact";

const tint = (w: WorldInfo) => ({ "--tint": w.tint }) as CSSProperties;

/** Starts riding a world if it's open; returns whether a ride started. */
export function ride(w: WorldInfo): boolean {
  if (w.unlockAfter && patchCount(app.get()) < w.unlockAfter) {
    app.patch({ toast: `Earn ${w.unlockAfter} passport stamps to unlock this one.` });
    return false;
  }
  // Expresso is the first world you can ride; the others follow.
  if (RIDES[w.id]) {
    app.patch({ mode: "world", world: w.id, worldReady: false, view: "table" });
    return true;
  }
  app.patch({ toast: `${w.name} opens in the next build.` });
  return false;
}

/**
 * A button label with its arrow: the arrow is glued to the last word, so a
 * long label wraps as words and the arrow never ends up alone on a line.
 */
export function Label({ text }: { text: string }) {
  const i = text.lastIndexOf(" ");
  return (
    <>
      {i < 0 ? "" : `${text.slice(0, i)} `}
      <span className="nowrap">
        {text.slice(i + 1)} <Arrow dir="next" />
      </span>
    </>
  );
}

/** The Ride button: a small "Ride in" over the payoff, e.g. "My time at WinZO →". */
export function RideLabel({ w, locked }: { w: WorldInfo; locked: boolean }) {
  if (locked) return "Locked";
  return (
    <>
      <small className="kicker">Ride in</small>
      <Label text={w.cta.charAt(0).toUpperCase() + w.cta.slice(1)} />
    </>
  );
}

/** The world list and the selected world's card. A side panel on wide screens, a sheet on phones. */
export function Picker() {
  const compact = useCompact();
  const selected = useStore(app, (s) => s.selected);
  return (
    <aside className="panel" aria-label="Choose a world">
      <p className="eyebrow">Choose a world</p>
      <ol className="worlds">
        {WORLDS.map((x) => (
          <li key={x.id} style={tint(x)}>
            <button
              type="button"
              className={`world ${x.id === selected ? "on" : ""} ${x.unlockAfter ? "locked" : ""}`}
              aria-pressed={x.id === selected}
              // Phones held sideways go straight to the bike in 360°, with its card.
              onClick={() =>
                app.patch(compact ? { selected: x.id, view: "inspect" } : { selected: x.id })
              }
              onMouseEnter={() => app.patch({ hovered: x.id })}
              onMouseLeave={() => app.patch({ hovered: null })}
            >
              <i className="dot" aria-hidden="true" />
              <b>{x.name}</b>
              <span>{x.kind}</span>
            </button>
          </li>
        ))}
      </ol>
      {compact ? null : selected ? <WorldCard w={world(selected)} /> : <Welcome />}
    </aside>
  );
}

function WorldCard({ w }: { w: WorldInfo }) {
  const locked = Boolean(w.unlockAfter && patchCount(app.get()) < w.unlockAfter);
  return (
    <section className="card" style={tint(w)} key={w.id}>
      <p className="eyebrow">{w.kind}</p>
      <h2>{w.name}</h2>
      <p className="lede">{w.blurb}</p>
      <p className="bike">
        {w.bike.name} · {w.bike.inspired} <span>· {w.stops} stops</span>
      </p>
      <p className="where">The ride · {w.place}</p>
      <div className="actions">
        <button type="button" className="ghost" onClick={() => app.patch({ view: "inspect" })}>
          Inspect 360°
        </button>
        <button type="button" className="ride" onClick={() => ride(w)} aria-disabled={locked}>
          <RideLabel w={w} locked={locked} />
        </button>
      </div>
    </section>
  );
}

/** Before a pick: Murphy is on the turntable and the card invites a choice. */
function Welcome() {
  const first = WORLDS[0];
  return (
    <section className="card welcome" style={{ "--tint": "#8a2a22" } as CSSProperties}>
      <p className="eyebrow">Murphy's garage</p>
      <h2>Pick a world</h2>
      <p className="lede">
        Seven worlds, each with its own bike. Tap one on the map or in the list and its bike rolls
        in. That's Murphy on the turntable; she's mine.
      </p>
      <div className="actions">
        <button type="button" className="ghost" onClick={() => app.patch({ view: "inspect" })}>
          Inspect 360°
        </button>
        <button
          type="button"
          className="ride"
          onClick={() => first && app.patch({ selected: first.id })}
        >
          <Label text={`Start with ${first?.name ?? ""}`} />
        </button>
      </div>
    </section>
  );
}
