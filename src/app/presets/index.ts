import type { Settings } from "../settings";
import { DEFAULT_SETTINGS } from "./DefaultSettings";

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
  { id: "default", name: "Default", settings: DEFAULT_SETTINGS },
];

export { DEFAULT_SETTINGS };
