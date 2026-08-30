import type { Settings } from "../settings";
import { parseSettings } from "../settingsFile";
import defaults from "./default-settings.json";

/**
 * The settings the app starts on, and the baseline every Reset button restores.
 *
 * Kept as JSON in exactly the shape "Export settings" writes, so a set of
 * settings tuned in the browser can be exported and dropped in here as the new
 * default with no translation step. That is the whole reason it is not a
 * TypeScript object: the file is meant to be interchangeable with an exported
 * one.
 *
 * The cost is that JSON carries only literals — the knight's radii, once
 * written as the expressions they came from, are now the numbers those
 * expressions produced — and that a JSON import types `theme` as `string`
 * rather than as its two allowed values. So the file is read through the same
 * door an imported file uses, which checks the schema version and that nothing
 * is missing, and fails loudly here at startup rather than quietly at render.
 */
const parsed = parseSettings(JSON.stringify(defaults));

if (parsed.settings === null) {
  throw new Error(`default-settings.json is unusable: ${parsed.error}`);
}

export const DEFAULT_SETTINGS: Settings = parsed.settings;
