import type { ColorChoice } from "../../../worker/protocol";

/**
 * What this browser knows about a game it is in.
 *
 * The token is the whole of the player's identity, and it is kept here and
 * nowhere else — the server never sends it to anyone, and it never travels in
 * a URL. Kept per game rather than per browser: a leak costs one game, and
 * being in two at once is expressible.
 */
export interface SavedGame {
  gameId: string;
  token: string;
  /** `OPPONENT_CHOOSES` while a challenge is out and the side is still open. */
  you: ColorChoice;
  myName: string;
  opponentName: string | null;
  /** Whether this side offered the game or answered it. */
  role: "challenger" | "opponent";
}

const KEY = (gameId: string) => `cv.game.${gameId}`;
const NAME_KEY = "cv.name";
const PENDING_KEY = "cv.pending";

/**
 * Reading and writing both go through a try: storage throws outright in a
 * private window and in browsers set to refuse it, and a game that cannot be
 * saved should still be playable for as long as the tab lives.
 */
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string): void {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Kept in memory alone: lost on reload, which beats refusing to play.
  }
}

function forget(key: string): void {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to undo.
  }
}

export function saveGame(game: SavedGame): void {
  write(KEY(game.gameId), JSON.stringify(game));
  write(PENDING_KEY, game.gameId);
}

export function loadGame(gameId: string): SavedGame | null {
  const saved = read(KEY(gameId));
  if (saved === null) {
    return null;
  }
  try {
    return JSON.parse(saved) as SavedGame;
  } catch {
    return null;
  }
}

/** The game this browser was last in, to come back to after a reload. */
export function pendingGame(): SavedGame | null {
  const gameId = read(PENDING_KEY);
  return gameId === null ? null : loadGame(gameId);
}

export function clearPending(): void {
  forget(PENDING_KEY);
}

/** The name last played under, so nobody types it twice. */
export function savedName(): string {
  return read(NAME_KEY) ?? "";
}

export function saveName(name: string): void {
  write(NAME_KEY, name);
}

/**
 * A token: 256 bits of randomness, which is the only thing standing between a
 * player and someone else moving their pieces.
 */
export function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A game id: nine digits, so it can be read down a telephone.
 *
 * Short enough to say in three groups of three, like a phone number, and never
 * starting with a zero — a leading zero is the first thing lost when a number
 * is dictated or retyped.
 *
 * It is not a secret, and cannot be: anything short enough to say aloud is
 * short enough to guess at. What it protects is small — an unanswered invite,
 * for as long as it goes unanswered — and a billion of them is enough that
 * finding one by guessing is not worth anybody's afternoon. The thing that
 * cannot be guessed is the player's token, which never leaves this browser.
 */
export function newGameId(): string {
  const range = 900_000_000;
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100_000_000 + (bytes[0] % range));
}

/** Grouped for reading out: "482 913 657". */
export function spellGameId(gameId: string): string {
  return gameId.replace(/(\d{3})(?=\d)/g, "$1 ");
}

/** However it was written down — spaces, dashes — back to the digits alone. */
export function readGameId(text: string): string | null {
  const digits = text.replace(/[^0-9]/g, "");
  return /^[1-9][0-9]{8}$/.test(digits) ? digits : null;
}
