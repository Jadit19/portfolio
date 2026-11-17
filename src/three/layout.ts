/**
 * Screen layout shared by the CSS and the 3D framing. The UI either docks a
 * side panel on the right (wide screens) or a sheet at the bottom (phones,
 * portrait tablets); the camera centres the scene in the space that's left.
 * Phones held sideways (short and wide) also get the side panel.
 * Keep the breakpoint in sync with the media queries in src/styles/app.css:
 * `(min-width: 900px) and (min-aspect-ratio: 11/10)`, or
 * `(max-height: 520px) and (min-aspect-ratio: 16/10)`.
 */

export interface Layout {
  w: number;
  h: number;
  /** Side panel docked on the right. */
  side: boolean;
  /** Pixels covered by UI on the right / bottom. */
  insetRight: number;
  insetBottom: number;
  portrait: boolean;
}

/** What the UI actually covers, measured from the DOM (overrides the estimates). */
export interface Insets {
  right?: number;
  bottom?: number;
}

export function layoutFor(w: number, h: number, measured: Insets = {}): Layout {
  const side = (w >= 900 && w / h >= 1.1) || (h <= 520 && w / h >= 1.6);
  return {
    w,
    h,
    side,
    insetRight: side ? (measured.right ?? Math.min(400, w * 0.3) + 32) : 0,
    insetBottom: side ? 0 : (measured.bottom ?? Math.round(h * 0.42)),
    portrait: h > w,
  };
}
