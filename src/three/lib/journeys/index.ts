import type { JourneyDef } from "../journey";
import { expresso } from "./expresso";
import { fair } from "./fair";
import { forest } from "./forest";
import { murphy } from "./murphy";

/** Route journeys in garage order. */
export const JOURNEYS: JourneyDef[] = [expresso, fair, forest, murphy];
