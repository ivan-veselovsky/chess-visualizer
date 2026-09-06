/*
  Written with its extension for the same reason `settingsFile.ts` is: this is
  exercised by `tests/unit.mjs`, which node runs straight from the TypeScript.
*/
import { parseSettings } from "./settingsFile.ts";
import type { Settings } from "./settings.ts";

/** Where the settings in use are kept, beside this browser's other things. */
export const SETTINGS_KEY = "cv.settings";

/**
 * How long changes are allowed to gather before they are written.
 *
 * Every write is the whole object and a synchronous trip to the store, and a
 * setting changes as often as a slider is dragged — tens of times a second. So
 * a change starts this clock rather than being written; when it comes round,
 * whatever the settings are by then is written once and the clock stops. A
 * browser nobody is touching writes nothing at all, and a drag of two hundred
 * intermediate values is one write of the value that was landed on.
 *
 * What it costs is the last half minute of changes if the tab dies without
 * warning. Everything that gives warning — a tab closing, a page hidden, a
 * phone putting the browser to sleep — is flushed at once: see
 * `flushSettings`.
 */
const SAVE_EVERY_MS = 30_000;

let waiting: Settings | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
/** The last thing written that was read back whole; see `put`. */
let good: string | null = null;

/**
 * One write, and a check that the whole of it landed.
 *
 * A store writes a key whole or not at all — the value handed to `setItem` is
 * held as one string, and a write that cannot be made throws and leaves what
 * was there before. But this is the only copy of a reader's settings, and the
 * cost of being sure is one read of two kilobytes every half minute: the record
 * is read back and parsed, and if what comes back is not what went in, the last
 * one that was is put back. Nothing is left half written for the next launch to
 * find — either the new settings are there or the ones before them are.
 */
function put(settings: Settings): void {
  const text = JSON.stringify(settings);
  /*
    Nothing is written twice.

    What counts as a change upstream is a new settings object, and a tab that
    has only been opened has one of those — the one it was handed at startup.
    Left to itself that wrote the record back over itself half a minute into
    every visit, for a reader who had touched nothing. Comparing here rather
    than at each change is what makes it cheap: the text is being made anyway,
    once per write, instead of on every drag of a slider.
  */
  if (text === good) {
    return;
  }
  try {
    window.localStorage.setItem(SETTINGS_KEY, text);
    const back = window.localStorage.getItem(SETTINGS_KEY);
    if (back === text) {
      good = text;
      return;
    }
    if (good !== null) {
      window.localStorage.setItem(SETTINGS_KEY, good);
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
export function saveSettings(settings: Settings): void {
  waiting = settings;
  if (timer !== null) {
    return;
  }
  timer = setTimeout(flushSettings, SAVE_EVERY_MS);
}

/**
 * Writes anything gathered, now, and stops the clock.
 *
 * For a page about to go away, and for the turn of the clock itself — the two
 * want exactly the same thing done.
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

/**
 * The settings last used, or null for none this build can read.
 *
 * Null rather than the defaults: what to fall back to is the app's business,
 * and this module's is the store. Read through the same reader an imported file
 * goes through, which is the point of doing it this way — that reader refuses
 * anything whose schema version is not this build's and anything missing a
 * group, so a build that has moved on starts afresh rather than on a
 * half-understood object, and a record cut short by a tab dying mid-write is
 * refused for the same reason without anybody having to know that is what
 * happened.
 *
 * A refused record is dropped rather than left to be refused again on every
 * launch for the rest of the browser's life.
 */
export function loadSettings(): Settings | null {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(SETTINGS_KEY);
  } catch {
    return null;
  }
  if (saved === null) {
    return null;
  }
  const { settings } = parseSettings(saved);
  if (settings !== null) {
    /* What was found is by definition a whole record, so it is what a write
       that lands badly is put back to. */
    good = saved;
  }
  if (settings === null) {
    try {
      window.localStorage.removeItem(SETTINGS_KEY);
    } catch {
      /* Nothing to undo. */
    }
    return null;
  }
  return settings;
}
