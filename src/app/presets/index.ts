import type { Settings } from "../settings";
import { DEFAULT_SETTINGS } from "./DefaultSettings";
import { CLASSIC_GREEN } from "./ClassicGreen";
import { CLASSIC_BROWN } from "./ClassicBrown";

/**
 * A named, complete set of settings.
 *
 * Complete rather than partial on purpose: a preset that only overrode some
 * values would leave the rest to be inherited from somewhere, and "somewhere"
 * is what this refactor removed. Building one on top of another is a spread —
 * `{ ...DEFAULT_SETTINGS, attacks: { ... } }` — which stays explicit about what
 * it changes while still producing a whole object.
 */
export interface Preset {
  id: string;
  name: string;
  settings: Settings;
}

export const PRESETS: Preset[] = [
  {
    id: "default",
    name: "Blue - orange - with attacks",
    settings: DEFAULT_SETTINGS,
  },
  { id: "classic-green", name: "Classic green", settings: CLASSIC_GREEN },
  { id: "classic-brown", name: "Classic brown", settings: CLASSIC_BROWN },
];

/**
 * The preset a browser opens with before anything has been chosen in it: the
 * main board's, with the attacks drawn — the classic board beside it, on from
 * the start, showing Classic green.
 */
export const STARTING_PRESET: Preset = PRESETS.find((preset) => preset.id === "default")!;

/**
 * Built-ins' names as an earlier build wrote them, to the names they go by now:
 * a choice remembered under the old name is the same preset, and is found again.
 */
const FORMER_NAMES: Record<string, string> = {
  "Blue - orange - with attacks (default)": "Blue - orange - with attacks",
};

/** A preset's name as this build calls it. */
export function currentName(name: string): string {
  return FORMER_NAMES[name] ?? name;
}

export { DEFAULT_SETTINGS };
