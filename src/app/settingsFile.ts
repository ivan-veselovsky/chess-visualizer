import { OPTIONS_SCHEMA_VERSION, type Options } from "./options";

export const SETTINGS_FILE_NAME = "chess-visualizer-settings.json";

/**
 * Settings as they are written to a file: the whole `Options` object, schema
 * version and all. Nothing is stripped — a file that omitted anything would
 * import as a partial object, which is what the version is there to prevent.
 */
export function settingsToJson(options: Options): string {
  return `${JSON.stringify(options, null, 2)}\n`;
}

/** Hands the browser a settings file to save. */
export function downloadSettings(options: Options): void {
  const blob = new Blob([settingsToJson(options)], {
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
  options: Options | null;
  /** Why the file was rejected, when it was. */
  error: string | null;
}

/** Groups whose absence would leave the app reading undefined at render time. */
const REQUIRED_KEYS = [
  "theme",
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
    return { options: null, error: "That file is not valid JSON." };
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { options: null, error: "That file does not hold a settings object." };
  }

  const candidate = raw as Record<string, unknown>;
  const version = candidate.optionsSchemaVersion;

  if (typeof version !== "number") {
    return {
      options: null,
      error: `No schema version in that file; this build reads ${OPTIONS_SCHEMA_VERSION}.`,
    };
  }
  if (version !== OPTIONS_SCHEMA_VERSION) {
    return {
      options: null,
      error: `Those settings are version ${version}; this build reads ${OPTIONS_SCHEMA_VERSION}.`,
    };
  }

  // The version says the shape should be right, but a truncated file would
  // still pass it, and a missing group renders as a blank screen rather than
  // an error.
  const missing = REQUIRED_KEYS.filter((key) => !(key in candidate));
  if (missing.length > 0) {
    return {
      options: null,
      error: `Those settings are missing: ${missing.join(", ")}.`,
    };
  }

  return { options: candidate as unknown as Options, error: null };
}
