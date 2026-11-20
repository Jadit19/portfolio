/**
 * The rideable worlds: everything that differs from one journey to the next
 * (its scenery build, its stops and their cards, the props in its world, the
 * little moment when you pull over, a live board, the loader's lines). The
 * engine (scene, physics, camera, HUD) is shared.
 */

import * as THREE from "three";
import { ASTRO_INTRO, ASTRO_STOPS } from "../../content/astro";
import { EXPRESSO_INTRO, EXPRESSO_STOPS } from "../../content/expresso";
import type { RouteId, Stop } from "../../content/types";
import { WINZO_INTRO, WINZO_STOPS } from "../../content/winzo";
import { ZINGLE_INTRO, ZINGLE_STOPS } from "../../content/zingle";
import { ASTRO_LANDMARKS, type AstroLandmark } from "../lib/astroLandmarks";
import type { JourneyDef, WorldData } from "../lib/journey";
import { astroFlat } from "../lib/journeys/astroFlat";
import { expressoFlat } from "../lib/journeys/expressoFlat";
import { winzoFlat } from "../lib/journeys/winzoFlat";
import { zingleFlat } from "../lib/journeys/zingleFlat";
import type { WinzoLandmark } from "../lib/winzoLandmarks";
import type { ZingleLandmark } from "../lib/zingleLandmarks";
import { Brew, brewKindFor } from "./brew";
import type { Ground } from "./ground";
import { expressoProps, type PropSpot } from "./props";
import type { BrewSound } from "./sound";
import { type MomentEnv, StarMoment } from "./stars";

/** A stop's content, with the small line under its title (the drink, the star…). */
export interface RideStop extends Stop {
  sub: string;
}

/** The little scene that plays at a stop when you pull over. */
export interface Moment {
  readonly group: THREE.Object3D;
  /** Returns false once it's finished. */
  update(dt: number): boolean;
  dispose(): void;
}

export interface RideDef {
  id: RouteId;
  journey: JourneyDef;
  /** Content, in the order it's told (stop 1 first). */
  stops: RideStop[];
  intro: string;
  /** The card's kicker, e.g. "On the menu". */
  kicker: string;
  /** Card styling (every journey shares the same cream card). */
  theme: "menu";
  /** Content that must stand at a particular place in the world: stop id → world stop tag. */
  pinned?: Record<string, string>;
  props(data: WorldData, ground: Ground): PropSpot[];
  /** `bike` is where the bike has pulled up (heading: forward is (cos h, −sin h)). */
  moment(
    stopId: string,
    at: THREE.Vector3,
    yaw: number,
    bike?: { x: number; z: number; heading: number },
    env?: MomentEnv,
  ): Moment;
  momentSound(stopId: string): BrewSound;
  /** A board that pings a live site, by a landmark. */
  live?: { url: string; title: string; host: string; landmark: string };
  /** Lines under the fuel gauge while it loads. */
  tips: string[];
  /** Shooting stars at night; a shower near the stop tagged `near`. */
  meteors?: { near: string };
}

const BREW_SOUND: Record<string, BrewSound> = {
  shot: "shot",
  layers: "pour",
  kaapi: "pour",
  exchange: "clink",
  foam: "foam",
  drip: "drip",
  parallel: "clink",
  letter: "pour",
};

const EXPRESSO: RideDef = {
  id: "expresso",
  // Expresso is the first flat world (the flat-world language).
  journey: expressoFlat,
  stops: EXPRESSO_STOPS.map((s) => ({ ...s, sub: s.drink })),
  intro: EXPRESSO_INTRO,
  kicker: "On the menu",
  theme: "menu",
  // Each stop is its landmark (the build tags the stops with these).
  pinned: {
    "expresso/expresso": "roastery",
    "expresso/brewtils": "darshini",
    "expresso/bloomail": "post",
    "expresso/logger": "weighing",
    "expresso/json": "well",
    "expresso/mochios": "pavilion",
    "expresso/zippuccino": "pepper",
    "expresso/nexus": "bridge",
  },
  props: expressoProps,
  moment: (id, at, yaw) => new Brew(brewKindFor(id), at, yaw),
  momentSound: (id) => BREW_SOUND[brewKindFor(id)] ?? "clink",
  live: {
    url: "https://expresso.aditjain.me",
    title: "Expresso server",
    host: "expresso.aditjain.me",
    landmark: "roastery",
  },
  tips: [
    "Riding to Coorg…",
    "Up the ghat road, into the mist…",
    "Past the coffee estates…",
    "Smelling the roastery already.",
  ],
};

/** AstroClub's stops, by landmark (the build tags each stop with its landmark). */
const ASTRO_PINNED: Record<string, AstroLandmark> = {
  "astro/inter-iit-tech-meet-2022": "dome",
  "astro/jux": "solar",
  "astro/xuvi-2022": "deck",
  "astro/blast-off-2022": "rocket",
  "astro/hyperion-2022": "planetarium",
  "astro/hyperion-2021": "camp",
  "astro/wiki": "monastery",
  "astro/nasa-apod-discord-bot": "lake",
  "astro/ip-mail": "bungalow",
};

/** Nothing happens: a stand-in when a moment has nothing to show. */
const still = (): Moment => ({
  group: new THREE.Group(),
  update: () => false,
  dispose: () => {},
});

const ASTRO: RideDef = {
  id: "astro",
  journey: astroFlat,
  stops: ASTRO_STOPS.map((s) => ({ ...s, sub: s.star })),
  intro: ASTRO_INTRO,
  kicker: "On the star chart",
  theme: "menu",
  pinned: ASTRO_PINNED,
  props: () => [],
  // At night, the stop's star gathers in the sky above its landmark.
  moment: (id, at, _yaw, _bike, env) => {
    const key = ASTRO_PINNED[id];
    if (!key || !env) return still();
    return new StarMoment(ASTRO_LANDMARKS[key].star, at, env, key === "monastery" ? 9 : 7);
  },
  momentSound: () => "clink",
  meteors: { near: "deck" },
  tips: [
    "Riding to Hanle…",
    "Up past the BRO signs…",
    "Over Umling La, 5,798 m…",
    "Waiting for the stars to come out.",
  ],
};

/** WinZO's stops, by landmark (the build tags each stop with its landmark). */
const WINZO_PINNED: Record<string, WinzoLandmark> = {
  "winzo/payments-risk-engine": "flags",
  "winzo/fraud-ml-platform": "scrut",
  "winzo/zopass-subscriptions": "pass",
  "winzo/offer-engine": "merch",
  "winzo/data-platform": "tyres",
  "winzo/international-payments": "toll",
  "winzo/guest-sso-login": "gantry",
  "winzo/refund-orchestration": "hairpin",
};

const WINZO: RideDef = {
  id: "winzo",
  journey: winzoFlat,
  stops: WINZO_STOPS.map((s) => ({ ...s, sub: s.sector })),
  intro: WINZO_INTRO,
  kicker: "On the pit board",
  theme: "menu",
  pinned: WINZO_PINNED,
  props: () => [],
  moment: () => still(),
  momentSound: () => "clink",
  tips: [
    "Riding to Greater Noida…",
    "Down the expressway, FASTag ready…",
    "Past the mustard fields…",
    "Lights out in five.",
  ],
};

/** Zingle's waypoints, by landmark (the build tags each stop with its landmark). */
const ZINGLE_PINNED: Record<string, ZingleLandmark> = {
  "zingle/ai-optimisation-engine": "kund",
  "zingle/blue-green-deployments": "pols",
  "zingle/cost-ledger": "jantar",
  "zingle/migration-validation": "ghat",
  "zingle/custom-agent-platform": "bazaar",
  "zingle/mcp-tool-platform": "dera",
  "zingle/agent-sandbox": "toshakhana",
  "zingle/data-foundation": "stepwell",
  "zingle/production-reliability": "clock",
  "zingle/engineering-standards": "haveli",
};

const ZINGLE: RideDef = {
  id: "zingle",
  journey: zingleFlat,
  stops: ZINGLE_STOPS.map((s) => ({ ...s, sub: s.waypoint })),
  intro: ZINGLE_INTRO,
  kicker: "On the roadbook",
  theme: "menu",
  pinned: ZINGLE_PINNED,
  props: () => [],
  moment: () => still(),
  momentSound: () => "clink",
  tips: [
    "Riding into the Thar…",
    "Roadbook clipped on, tanks full…",
    "Past the khejris and the kunds…",
    "The fort's lights are coming on.",
  ],
};

export const RIDES: Partial<Record<RouteId, RideDef>> = {
  expresso: EXPRESSO,
  astro: ASTRO,
  winzo: WINZO,
  zingle: ZINGLE,
};
