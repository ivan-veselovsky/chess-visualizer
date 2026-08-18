import type { Options } from "../options";
import { DEFAULT_OPTIONS } from "./DefaultOptions";

/**
 * A named, complete set of settings.
 *
 * Complete rather than partial on purpose: a preset that only overrode some
 * values would leave the rest to be inherited from somewhere, and "somewhere"
 * is what this refactor removed. Building one on top of another is a spread —
 * `{ ...DEFAULT_OPTIONS, attacks: { ... } }` — which stays explicit about what
 * it changes while still producing a whole object.
 */
export interface Preset {
  id: string;
  name: string;
  options: Options;
}

export const PRESETS: Preset[] = [
  { id: "default", name: "Default", options: DEFAULT_OPTIONS },
];

export { DEFAULT_OPTIONS };
