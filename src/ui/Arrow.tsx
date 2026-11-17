/**
 * A drawn arrow for buttons and links, in the text's colour and size. Not a
 * text arrow (↗ ← →): iOS draws those as colour emoji.
 */
export type ArrowDir = "out" | "back" | "next";

const PATHS: Record<ArrowDir, string> = {
  // Opens elsewhere (↗).
  out: "M5 11 11 5M6.5 5H11v4.5",
  back: "M12 8H4m3.5-3.5L4 8l3.5 3.5",
  next: "M4 8h8M8.5 4.5 12 8l-3.5 3.5",
};

export function Arrow({ dir }: { dir: ArrowDir }) {
  return (
    <svg className="arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={PATHS[dir]}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
