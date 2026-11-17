import { useEffect, useState } from "react";

/**
 * Phones held sideways: short and wide. Keep in sync with layoutFor() in
 * src/three/layout.ts and the `(max-height: 520px)` styles in app.css.
 */
const QUERY = "(max-height: 520px) and (min-aspect-ratio: 16 / 10)";

const matches = () => typeof matchMedia === "function" && matchMedia(QUERY).matches;

/** True on a phone held sideways (the list-first garage layout). */
export function useCompact(): boolean {
  const [on, setOn] = useState(matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(QUERY);
    const change = () => setOn(mq.matches);
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);
  return on;
}
