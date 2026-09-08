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
    name: "Blue - orange - with attacks (default)",
    settings: DEFAULT_SETTINGS,
  },
  { id: "classic-green", name: "Classic green", settings: CLASSIC_GREEN },
  { id: "classic-brown", name: "Classic brown", settings: CLASSIC_BROWN },
];

export { DEFAULT_SETTINGS };
