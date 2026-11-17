import type { CSSProperties } from "react";
import { WORLDS } from "../content/worlds";
import { app, patchCount } from "../state/app";
import { foundIn, STOPS_IN } from "../state/ride";
import { useStore } from "../state/store";
import { Arrow } from "./Arrow";

/**
 * The passport: opened by tapping the pin board (or the Passport button).
 * Every world with its patch, stops found and how to open the Secret world;
 * the printable certificate lives here too.
 */
export function Passport() {
  const stamped = useStore(app, (s) => s.stamped);
  const earned = useStore(app, patchCount);
  return (
    <>
      <button type="button" className="back" onClick={() => app.patch({ view: "table" })}>
        <Arrow dir="back" /> Map table
      </button>
      <aside className="panel passport" aria-label="Passport">
        <p className="eyebrow">Passport</p>
        <h2>{earned} of 6 patches</h2>
        <p className="lede">
          Find every stop in a world to earn its patch. Three patches open the Secret ride.
        </p>
        <ol className="stamps">
          {WORLDS.map((w) => {
            const has = stamped.includes(w.id);
            const left = w.unlockAfter ? Math.max(0, w.unlockAfter - earned) : 0;
            return (
              <li
                key={w.id}
                style={{ "--tint": w.tint } as CSSProperties}
                className={has ? "has" : ""}
              >
                <i className="mark" aria-hidden="true" />
                <b>{w.name}</b>
                <span className="note">
                  {has
                    ? "Patch earned"
                    : left
                      ? `${left} more ${left === 1 ? "patch" : "patches"} to unlock`
                      : `${foundIn(w.id)} of ${STOPS_IN[w.id] ?? w.stops} stops found`}
                </span>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="ride"
          aria-disabled={earned === 0}
          onClick={() =>
            app.patch({
              toast:
                earned === 0
                  ? "Earn your first patch to unlock the certificate."
                  : "The printable certificate arrives in the next build.",
            })
          }
        >
          Print certificate <Arrow dir="out" />
        </button>
      </aside>
    </>
  );
}
