/*
  Written with its extension, like the other modules `tests/unit.mjs` runs
  straight from the TypeScript: node resolves what is written and guesses at
  nothing.
*/
import type { GameStash, StashedGame } from "../chess/stash.ts";

export const STASH_KEY = "cv.stash";

/**
 * What this build writes into that key. Raised when the shape changes in a way
 * an older record would not survive; a record of any other version is left
 * where it is and read as nothing, rather than guessed at.
 */
const STASH_VERSION = 1;

interface StoredStash {
  version: number;
  savedAt: number;
  games: GameStash;
}

/** A stashed game, if that is what this is — and nothing if it is not. */
function readGame(value: unknown): StashedGame | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const held = value as Record<string, unknown>;
  const history = held.history as Record<string, unknown> | undefined;
  if (typeof held.name !== "string" || held.name.trim() === "") {
    return null;
  }
  if (history === undefined || history === null || typeof history !== "object") {
    return null;
  }
  const entries = history.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }
  for (const entry of entries) {
    if (entry === null || typeof entry !== "object") {
      return null;
    }
    const step = entry as Record<string, unknown>;
    if (typeof step.fen !== "string") {
      return null;
    }
    if (step.move !== null && typeof step.move !== "string") {
      return null;
    }
  }
  const current = history.current;
  if (typeof current !== "number" || current < 0 || current >= entries.length) {
    return null;
  }
  return { name: held.name, history: { entries, current } as StashedGame["history"] };
}

/**
 * Everything this browser has put aside, as it stands now.
 *
 * Read afresh rather than remembered, because another tab of the same app may
 * have stashed something since — see `mergeStash`. A game that cannot be read
 * is dropped and the rest kept: one bad entry is worth one game, not all of
 * them.
 */
export function loadStash(): GameStash {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(STASH_KEY);
  } catch {
    return [];
  }
  if (saved === null) {
    return [];
  }
  let raw: unknown;
  try {
    raw = JSON.parse(saved);
  } catch {
    return [];
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const held = raw as Record<string, unknown>;
  if (held.version !== STASH_VERSION || !Array.isArray(held.games)) {
    return [];
  }
  return held.games
    .map(readGame)
    .filter((game): game is StashedGame => game !== null);
}

/**
 * One browser's stash, from two tabs' worth of it.
 *
 * What this tab holds, and then whatever is in the store under a name this tab
 * has never used. Ours wins on a name we both know: this tab is the one that
 * has just been asked to write something, and the game in hand is the one the
 * reader is looking at. A name only the store knows is another tab's work and
 * is kept — the alternative is one tab quietly undoing the other.
 *
 * Nothing is ever dropped, which is the whole of the policy: a stash has no way
 * to forget a game, so a name that exists anywhere still exists.
 */
export function mergeStash(mine: GameStash, stored: GameStash): GameStash {
  const names = new Set(mine.map((game) => game.name));
  return [...mine, ...stored.filter((game) => !names.has(game.name))];
}

/**
 * Names in the store that this tab has never seen.
 *
 * What another tab has stashed while this one was open. Stashing over one of
 * them would throw away a game this tab knows nothing about and cannot offer
 * back, so the reader is asked for another name instead — see `App`.
 */
export function strangeNames(mine: GameStash, stored: GameStash): string[] {
  const names = new Set(mine.map((game) => game.name));
  return stored
    .map((game) => game.name)
    .filter((name) => !names.has(name));
}

/**
 * Empties the stash, in this browser and not only in this tab.
 *
 * The record is removed rather than written empty: nothing is left to read, and
 * a browser that has never stashed anything and one that has thrown everything
 * away look the same, which they are.
 */
export function clearStash(): void {
  try {
    window.localStorage.removeItem(STASH_KEY);
  } catch {
    /* A store that will not have the key taken out is a store that never had
       it; there is nothing to tell the reader and nothing to undo. */
  }
}

/**
 * Writes the stash, and says what is in the store afterwards.
 *
 * The record is read back and compared: this is the only copy of games that
 * exist nowhere else, and a write that half-lands is worth knowing about at the
 * cost of one read. A store that refuses — a browser in private mode, a quota
 * reached — leaves the games in memory for this visit and says so by returning
 * what it was given, which is what the app goes on showing.
 */
export function saveStash(stash: GameStash): GameStash {
  const record: StoredStash = {
    version: STASH_VERSION,
    savedAt: Date.now(),
    games: stash,
  };
  const text = JSON.stringify(record);
  try {
    window.localStorage.setItem(STASH_KEY, text);
    if (window.localStorage.getItem(STASH_KEY) !== text) {
      return stash;
    }
  } catch {
    return stash;
  }
  return stash;
}
