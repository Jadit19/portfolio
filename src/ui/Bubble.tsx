import { world } from "../content/worlds";
import { app } from "../state/app";
import { useStore } from "../state/store";

const HELLO = "Hey, I'm Adit. Pick a world on the map and I'll bring its bike round.";

/** Adit's line for the picked world (a hello before the first pick). */
export function Bubble() {
  const selected = useStore(app, (s) => s.selected);
  const line = selected ? world(selected).line : HELLO;
  return (
    <div className="bubble" aria-live="polite" key={selected ?? "hello"}>
      <b>Adit</b>
      <p>{line}</p>
    </div>
  );
}
