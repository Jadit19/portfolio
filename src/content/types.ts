/**
 * Content model. The demo ships placeholder content in this exact shape; the
 * real data from references/ is loaded into the same types later.
 */

export const ROUTE_IDS = [
  "zingle",
  "winzo",
  "expresso",
  "astro",
  "fun",
  "personal",
  "murphy",
] as const;
export type RouteId = (typeof ROUTE_IDS)[number];

export type BikeKind = "superbike" | "rally" | "cafe" | "scrambler" | "adv" | "bobber" | "classic";

/** Visual skin of the content card for a route. */
export type CardTheme =
  | "pitboard"
  | "roadbook"
  | "menu"
  | "poster"
  | "starchart"
  | "notebook"
  | "postcard";

export type LinkKind = "github" | "live" | "pypi" | "docker" | "blog" | "docs" | "video" | "other";

export interface LinkRef {
  label: string;
  href: string;
  kind: LinkKind;
}

export interface Fact {
  label: string;
  value: string;
}

export type Block =
  | { kind: "p"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "quote"; text: string };

export interface Stop {
  /** Globally unique, stable id (used for progress and stickers). */
  id: string;
  title: string;
  /** One-line pitch shown on the in-world sign and in map mode. */
  tagline: string;
  /** Key into the SVG art library. */
  art: string;
  period?: string;
  role?: string;
  facts: Fact[];
  body: Block[];
  tech: string[];
  links: LinkRef[];
}

export interface BikeInfo {
  kind: BikeKind;
  /** Display name, e.g. "Superbike". */
  name: string;
  /** Short spec-plate line. */
  spec: string;
}

export interface RouteContent {
  id: RouteId;
  title: string;
  subtitle: string;
  /** Shown on the bike's spec plate in the garage. */
  blurb: string;
  bike: BikeInfo;
  theme: CardTheme;
  /** Estimated ride time shown on the spec plate. */
  rideTime: string;
  stops: Stop[];
  /** Locked routes need this many passport stamps first. */
  unlockAfterStamps?: number;
}

export interface LogbookEntry {
  period: string;
  place: string;
  role: string;
  note: string;
}

export interface Profile {
  name: string;
  headline: string;
  intro: string;
  resumeUrl: string;
  blogUrl: string;
  contacts: LinkRef[];
  logbook: LogbookEntry[];
}
