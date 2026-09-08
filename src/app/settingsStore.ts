/*
  Written with its extension for the same reason `settingsFile.ts` is: this is
  exercised by `tests/unit.mjs`, which node runs straight from the TypeScript.
*/
import { parseSettings } from "./settingsFile.ts";
import type { Settings } from "./settings.ts";

/** Where this browser's settings live, beside its other things. */
export const SETTINGS_KEY = "cv.settings";

/** How many presets of their own a reader may keep. */
export const MOST_PRESETS = 50;

/** How long a name may be. */
export const LONGEST_NAME = 32;

/**
 * Everything about settings, in one record.
 *
 * One record and not several, because the pieces refer to each other: the
 * settings in use, the name they are being saved under, and the presets saved
 * so far. Written as separate keys, a crash between two writes could leave the
 * name pointing at a preset that was never written — and a store gives no way
 * to write two keys as one act. Written as one key it is one act by
 * construction: either the whole picture moves or none of it does.
 *
 * `working` is what the board is drawing with, whatever its name. It is saved
 * whether or not it has been given one, so a tab that dies mid-tweak comes back
 * to what the reader was looking at rather than to what they last named.
 */
export interface StoredPresets {
  /** The preset being saved to, or being worked on top of. */
  target: string;
  /** The settings in use, saved every time round the clock. */
  working: Settings;
  /** The reader's own presets, by name. Built-in ones are code, not storage. */
  sets: Record<string, Settings>;
  savedAt: number;
}

/** What a launch finds: everything readable, and a note of what was not. */
export interface OpenedPresets {
  /** Null when nothing has been stored yet. */
  target: string | null;
  working: Settings | null;
  sets: Record<string, Settings>;
  /**
   * Presets this build cannot read, by name, with the version they were
   * written against where there was one.
   *
   * Kept rather than dropped: a version this build has moved past is a reason
   * not to load somebody's preset, not a reason to delete it. They are listed,
   * said to be from another version, and removed only if the reader says so.
   */
  unreadable: Record<string, number | null>;
}

/**
 * How long changes are allowed to gather before they are written.
 *
 * Every write is the whole record and a synchronous trip to the store, and a
 * setting changes as often as a slider is dragged. So a change starts this
 * clock rather than being written; when it comes round, whatever the settings
 * are by then is written once and the clock stops. A browser nobody is
 * touching writes nothing at all.
 *
 * What it costs is the last half minute if the tab dies without warning.
 * Everything that gives warning — a tab closing, a page hidden, a preset being
 * changed — is flushed at once: see `flushSettings`.
 */
const SAVE_EVERY_MS = 30_000;

let waiting: Omit<StoredPresets, "savedAt"> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
/**
 * What was last written: the record itself, and the same thing without its
 * stamp.
 *
 * Two, because they answer two questions. "Has anything changed?" must not
 * count the time of writing, or every write differs from the last and nothing
 * is ever skipped — which is how a browser nobody was touching came to write
 * every half minute. "What was there before?" wants the record exactly as it
 * went in, stamp and all, so a write that lands badly can be put back.
 */
let lastBody: string | null = null;
let lastText: string | null = null;

/**
 * One write, and a check that the whole of it landed.
 *
 * A store writes a key whole or not at all, and a write that cannot be made
 * throws and leaves what was there before. But this is the only copy of a
 * reader's settings, and the cost of being sure is one read every half minute:
 * the record is read back, and if what comes back is not what went in, the last
 * one that was is put back.
 */
function put(state: Omit<StoredPresets, "savedAt">): void {
  const body = bodyOf(state);
  /* Nothing is written twice. What counts as a change upstream is a new
     settings object, and a tab that has only been opened has one of those. */
  if (body === lastBody) {
    return;
  }
  const text = JSON.stringify({ ...state, savedAt: Date.now() });
  try {
    window.localStorage.setItem(SETTINGS_KEY, text);
    const back = window.localStorage.getItem(SETTINGS_KEY);
    if (back === text) {
      lastBody = body;
      lastText = text;
      return;
    }
    if (lastText !== null) {
      window.localStorage.setItem(SETTINGS_KEY, lastText);
    } else {
      window.localStorage.removeItem(SETTINGS_KEY);
    }
  } catch {
    /* A browser refusing storage still runs the app; it just opens at the
       defaults next time. Nothing here is worth interrupting a reader for. */
  }
}

/**
 * Says the settings have changed, without writing them.
 *
 * Call it on every change: when the change is written — and how many changes
 * one write covers — is this module's business.
 */
export function saveSettings(state: Omit<StoredPresets, "savedAt">): void {
  waiting = state;
  if (timer !== null) {
    return;
  }
  timer = setTimeout(flushSettings, SAVE_EVERY_MS);
}

/**
 * Writes anything gathered, now, and stops the clock.
 *
 * For a page about to go away, for a preset about to be left, and for the turn
 * of the clock itself — they all want the same thing done.
 */
export function flushSettings(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  const held = waiting;
  waiting = null;
  if (held !== null) {
    put(held);
  }
}

/** A record as it is compared: everything but when it was written. */
function bodyOf(state: Omit<StoredPresets, "savedAt">): string {
  return JSON.stringify({
    target: state.target,
    working: state.working,
    sets: state.sets,
  });
}

/** One stored preset, checked the way an imported file is checked. */
function readOne(value: unknown): { settings: Settings | null; version: number | null } {
  const version =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>).schemaVersion
      : undefined;
  const { settings } = parseSettings(JSON.stringify(value));
  return {
    settings,
    version: typeof version === "number" ? version : null,
  };
}

/**
 * What this browser has: the settings in use, the name they are under, and the
 * presets saved so far.
 *
 * Read through the same reader an imported file goes through, preset by preset,
 * so one unreadable preset costs that preset and nothing else. A record that
 * cannot be parsed at all is dropped rather than left to be refused on every
 * launch for the rest of the browser's life; presets inside a record that can
 * be parsed are kept whatever their version.
 */
export function loadSettings(): OpenedPresets {
  const empty: OpenedPresets = {
    target: null,
    working: null,
    sets: {},
    unreadable: {},
  };
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(SETTINGS_KEY);
  } catch {
    return empty;
  }
  if (saved === null) {
    return empty;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(saved);
  } catch {
    forgetRecord();
    return empty;
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    forgetRecord();
    return empty;
  }
  const held = raw as Record<string, unknown>;

  /*
    A record from before presets had names: the settings themselves, written
    straight into this key. Taken as the settings in use, under no name — the
    app puts them on the board and offers to save them like anything else.
  */
  if (typeof held.schemaVersion === "number" || "optionsSchemaVersion" in held) {
    const { settings } = parseSettings(saved);
    if (settings === null) {
      forgetRecord();
      return empty;
    }
    /* Not remembered as written: the next save is in the modern shape and is
       meant to happen. */
    return { ...empty, working: settings };
  }

  const sets: Record<string, Settings> = {};
  const unreadable: Record<string, number | null> = {};
  const stored = held.sets;
  if (stored !== null && typeof stored === "object" && !Array.isArray(stored)) {
    for (const [name, value] of Object.entries(stored as Record<string, unknown>)) {
      const { settings, version } = readOne(value);
      if (settings === null) {
        unreadable[name] = version;
      } else {
        sets[name] = settings;
      }
    }
  }
  const { settings: working } = readOne(held.working);
  const target = typeof held.target === "string" ? held.target : null;
  if (working !== null && target !== null) {
    /* What was found is a whole record: it is what a write that lands badly is
       put back to, and re-writing it unchanged is work nobody asked for. */
    lastText = saved;
    lastBody = bodyOf({ target, working, sets });
  }
  return { target, working, sets, unreadable };
}

function forgetRecord(): void {
  try {
    window.localStorage.removeItem(SETTINGS_KEY);
  } catch {
    /* Nothing to undo. */
  }
}
