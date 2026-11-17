/**
 * The seven worlds as the landing shows them: where each one is, which bike
 * rides it, its colour, and Adit's line when you pick it.
 *
 * Written for recruiters: the work leads, the ride setting follows.
 * Blurbs are placeholder copy until the real content from references/ is
 * loaded (build plan, phase 5).
 */

import type { BikeKind, RouteId } from "./types";

export interface WorldFeel {
  speed: number;
  grip: number;
  lean: number;
}

export interface WorldInfo {
  id: RouteId;
  name: string;
  /** What this world is, for someone hiring: the card's eyebrow and the chip's subtitle. */
  kind: string;
  /** Where it's ridden: the setting, a small line on the card. */
  place: string;
  /** The Ride button's payoff, after "Ride in: ", e.g. "my time at WinZO". */
  cta: string;
  /** What the work is (the card's main line). */
  blurb: string;
  bike: { kind: BikeKind; name: string; inspired: string; engine: string };
  tint: string;
  feel: WorldFeel;
  /** What Adit says when you pick this world. */
  line: string;
  stops: number;
  /** Passport stamps needed before this world opens. */
  unlockAfter?: number;
}

export const WORLDS: readonly WorldInfo[] = [
  {
    id: "zingle",
    name: "Zingle AI",
    kind: "Work · Founding engineer",
    place: "Thar desert rally",
    cta: "my time at Zingle",
    blurb: "Founding engineer. Data platforms, built from scratch.",
    bike: { kind: "rally", name: "Dakar rally", inspired: "KTM-inspired", engine: "single" },
    tint: "#f26a1b",
    feel: { speed: 0.75, grip: 0.55, lean: 0.7 },
    line: "Sand is just a road that hasn't made up its mind. Keep the throttle on.",
    stops: 8,
  },
  {
    id: "winzo",
    name: "WinZO",
    kind: "Work · Gaming at scale",
    place: "The circuit",
    cta: "my time at WinZO",
    blurb: "Real-money gaming at scale: payments, leagues and the systems behind them.",
    bike: {
      kind: "superbike",
      name: "Superbike",
      inspired: "Fireblade-inspired",
      engine: "inline four",
    },
    tint: "#d93a2f",
    feel: { speed: 0.95, grip: 0.7, lean: 0.9 },
    line: "Fast, twitchy, and very red. Brake before the corner, not in it.",
    stops: 8,
  },
  {
    id: "expresso",
    name: "Expresso",
    kind: "Project · C++ web stack",
    place: "Coorg coffee estates",
    cta: "the Expresso build",
    blurb: "A web stack written from scratch in C++.",
    bike: {
      kind: "cafe",
      name: "Café racer",
      inspired: "Triumph-inspired",
      engine: "parallel twin",
    },
    tint: "#2f7d4f",
    feel: { speed: 0.7, grip: 0.6, lean: 0.85 },
    line: "Coffee country. Mind the elephants; they have right of way.",
    stops: 8,
  },
  {
    id: "astro",
    name: "AstroClub IITK",
    kind: "Club · IIT Kanpur",
    place: "Ladakh · Hanle",
    cta: "my AstroClub years",
    blurb: "IIT Kanpur's astronomy club: telescopes, dark skies and what we built for them.",
    bike: { kind: "adv", name: "Adventure", inspired: "GSA-inspired", engine: "boxer twin" },
    tint: "#1e5bb8",
    feel: { speed: 0.95, grip: 0.8, lean: 0.6 },
    line: "Thin air, big sky. The loops are slower than they look.",
    stops: 8,
  },
  {
    id: "fun",
    name: "C++ for fun",
    kind: "Side projects · C++",
    place: "Dussehra riverside mela",
    cta: "the C++ projects",
    blurb: "Side projects in C++, written for the joy of it.",
    bike: { kind: "scrambler", name: "Scrambler", inspired: "Ducati-inspired", engine: "L-twin" },
    tint: "#f2b705",
    feel: { speed: 0.65, grip: 0.7, lean: 0.75 },
    line: "The mela never closes. Neither did my editor.",
    stops: 8,
  },
  {
    id: "personal",
    name: "Personal",
    kind: "Side projects",
    place: "Sikkim & the North-East",
    cta: "my side projects",
    blurb: "The things I build for myself: tools, experiments and ideas I couldn't leave alone.",
    bike: { kind: "bobber", name: "Bobber", inspired: "Fat Boy-inspired", engine: "V-twin" },
    tint: "#3d8a52",
    feel: { speed: 0.6, grip: 0.75, lean: 0.5 },
    line: "Heavy, smooth, unhurried. Like a Sunday, but with red pandas.",
    stops: 8,
  },
  {
    id: "murphy",
    name: "Secret",
    kind: "3 stamps to unlock",
    place: "Delhi to Varkala",
    cta: "my own ride",
    blurb: "23 Before 23: my own ride, Delhi to Varkala.",
    bike: { kind: "classic", name: "Murphy", inspired: "Guerrilla 450", engine: "single" },
    tint: "#8a2a22",
    feel: { speed: 0.55, grip: 0.8, lean: 0.7 },
    line: "That one's mine. Earn three stamps and I'll take you.",
    stops: 8,
    unlockAfter: 3,
  },
];

export function world(id: RouteId): WorldInfo {
  const w = WORLDS.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown world: ${id}`);
  return w;
}
