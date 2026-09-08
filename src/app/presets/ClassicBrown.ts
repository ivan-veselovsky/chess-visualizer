import type { Settings } from "../settings";
import { parseSettings } from "../settingsFile";
import brown from "./settings-classic-brown.json";

/**
 * A second built-in, and the reason the built-ins are a list rather than a
 * constant: a board in the greens of a printed diagram, against the default's
 * blue and orange.
 *
 * Read through the same door as the default, for the same reason — the file is
 * meant to be interchangeable with one exported from the browser, so it is
 * checked here at startup rather than misread at render.
 */
const parsed = parseSettings(JSON.stringify(brown));

if (parsed.settings === null) {
  throw new Error(`settings-classic-green.json is unusable: ${parsed.error}`);
}

export const CLASSIC_BROWN: Settings = parsed.settings;
