/*
  Written with its extension, unlike the imports elsewhere. This module is
  exercised by `tests/unit.mjs`, which node runs straight from the TypeScript
  with no bundler to guess at extensions — and the version it reads files
  against is a value rather than a type, so it has to resolve at run time.
  `allowImportingTsExtensions` is on for exactly this.
*/
import { SETTINGS_SCHEMA_VERSION, type Settings } from "./settings.ts";

export const SETTINGS_FILE_NAME = "chess-visualizer-settings.json";

/**
 * Settings as they are written to a file: the whole `Settings` object, schema
 * version and all. Nothing is stripped — a file that omitted anything would
 * import as a partial object, which is what the version is there to prevent.
 */
export function settingsToJson(settings: Settings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

/** Hands the browser a settings file to save. */
export function downloadSettings(settings: Settings): void {
  const blob = new Blob([settingsToJson(settings)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = SETTINGS_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  settings: Settings | null;
  /** Why the file was rejected, when it was. */
  error: string | null;
}

/** Groups whose absence would leave the app reading undefined at render time. */
const REQUIRED_KEYS = [
  "theme",
  "darkThemeTextColor",
  "boardColors",
  "orientation",
  "showGrid",
  "pieceTint",
  "attacks",
] as const;

/**
 * Reads a settings file, refusing anything this build cannot be sure it
 * understands.
 *
 * A version other than the current one is rejected outright rather than guessed
 * at. Migrating an older file is a job for code that knows what changed between
 * the two, and there is nothing to know yet; refusing now means a later
 * migration can rely on never having silently mis-read anything.
 */
export function parseSettings(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { settings: null, error: "That file is not valid JSON." };
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { settings: null, error: "That file does not hold a settings object." };
  }

  const candidate = raw as Record<string, unknown>;
  /*
    The field was called `optionsSchemaVersion` while the settings were called
    options, and files written then are still on people's disks. Read either
    name, and there is no need to raise the version over it: the shape those
    files hold is the shape this build reads, and only the label on the door
    has changed.
  */
  const version = candidate.schemaVersion ?? candidate.optionsSchemaVersion;

  if (typeof version !== "number") {
    return {
      settings: null,
      error: `No schema version in that file; this build reads ${SETTINGS_SCHEMA_VERSION}.`,
    };
  }
  if (version !== SETTINGS_SCHEMA_VERSION) {
    return {
      settings: null,
      error: `Those settings are version ${version}; this build reads ${SETTINGS_SCHEMA_VERSION}.`,
    };
  }

  // The version says the shape should be right, but a truncated file would
  // still pass it, and a missing group renders as a blank screen rather than
  // an error.
  const missing = REQUIRED_KEYS.filter((key) => !(key in candidate));
  if (missing.length > 0) {
    return {
      settings: null,
      error: `Those settings are missing: ${missing.join(", ")}.`,
    };
  }

  /*
    Handed back under the modern name whichever it arrived under, so that
    nothing downstream has to know there were ever two, and so that exporting a
    file that was read from an old one writes the new name.
  */
  const settings = { ...candidate, schemaVersion: version } as unknown as Settings;
  delete (settings as unknown as Record<string, unknown>).optionsSchemaVersion;
  return { settings, error: null };
}
