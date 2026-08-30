import type {
  ColorChoice,
  EndReason,
  GameResult,
} from "../../../worker/protocol";

/**
 * What revision of a saved seat this build writes and reads.
 *
 * Raised whenever the shape changes. Records at any other revision are not
 * migrated and not shown — they are treated as the settings files of an older
 * schema are: not this build's to interpret. A seat is worth little enough
 * that guessing at an old one is not worth the risk of guessing wrong, and the
 * game it names is still on the server for anyone holding the link.
 */
export const SEAT_SCHEMA = 1;

/**
 * What this browser knows about a game it is in.
 *
 * The token is the whole of the player's identity, and it is kept here and
 * nowhere else — the server never sends it to anyone, and it never travels in
 * a URL. Kept per game rather than per browser: a leak costs one game, and
 * being in two at once is expressible.
 */
export interface SavedGame {
  /** Which revision of this shape it was written against. */
  v: number;
  gameId: string;
  token: string;
  /** `OPPONENT_CHOOSES` while a challenge is out and the side is still open. */
  you: ColorChoice;
  myName: string;
  opponentName: string | null;
  /** Whether this side offered the game or answered it. */
  role: "challenger" | "opponent";
  /**
   * How the game ended, once this browser has been told that it has.
   *
   * Kept, not dropped: the list says what each game is, and "finished, and
   * here is how" is a thing to say rather than a reason to say nothing. It is
   * also what a reload reads to put a finished game back on the board when the
   * moves in memory are gone.
   */
  ending?: { result: GameResult; reason: EndReason };
}

const PREFIX = "cv.game.";
const KEY = (seat: string) => `${PREFIX}${seat}`;
const NAME_KEY = "cv.name";

/**
 * A seat at a game, which is what this browser actually holds — not a game.
 *
 * Written as the game's id with a minus in front for the side that offered the
 * game, and as the id itself for the side that took it up. Two seats at one
 * game are therefore two different strings, which is what lets one browser sit
 * at both of them: two records, two tokens, two tabs, and an object that sees
 * nothing but a pair of ordinary players.
 *
 * The sign is this app's own notation and goes no further. The server is never
 * told it — a signed id there would name a different object, and the two
 * players would never meet — and nobody is ever shown it or asked to read it
 * out. What people say to each other is nine digits.
 */
export const seatOf = (gameId: string, role: SavedGame["role"]): string =>
  role === "challenger" ? `-${gameId}` : gameId;

/** The game a seat is at. */
export const gameOf = (seat: string): string =>
  seat.startsWith("-") ? seat.slice(1) : seat;

/** Whether that seat is the one the game was offered from. */
export const isChallengerSeat = (seat: string): boolean => seat.startsWith("-");

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

/**
 * Every key held, from both stores at once: what localStorage has, plus
 * anything this session could only keep in memory. A browser refusing storage
 * still knows what it is in the middle of.
 */
function keys(): string[] {
  const found = new Set(memory.keys());
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key !== null) {
        found.add(key);
      }
    }
  } catch {
    // Whatever memory holds is the whole of it.
  }
  return [...found];
}

function forget(key: string): void {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to undo.
  }
}

export function saveGame(game: Omit<SavedGame, "v">): void {
  const seat = seatOf(game.gameId, game.role);
  const before = loadGame(seat);
  let written: SavedGame = { ...game, v: SEAT_SCHEMA };

  /*
    Two things that must not happen when a seat is written over, both of which
    have happened here, and neither of which announced itself.

    A record is written whole, so a writer that knows nothing about a field
    removes it. That is how a finished game turned back into one being played:
    coming back to it refreshed the opponent's name and, in doing so, dropped
    the ending. And a token is minted once per seat, so writing a different one
    means the seat was worked out wrongly — which is how one player's token
    came to be filed over the other's when both seats were held here.

    Said out loud rather than thrown: this runs while somebody is playing, and
    an exception here would take their board with it. The safe half of each is
    then done anyway, because a developer reading a console is a better place
    for a bug to end up than a reader's lost game.
  */
  if (before !== null && before.token !== written.token) {
    console.error(
      `saveGame: seat ${seat} already holds a different token; refusing to ` +
        `write over it. Whatever worked this seat out has it wrong.`
    );
    return;
  }
  if (before?.ending !== undefined && written.ending === undefined) {
    console.error(
      `saveGame: seat ${seat} is at a game that has ended, and this write ` +
        `does not say so. Keeping the ending.`
    );
    written = { ...written, ending: before.ending };
  }

  write(KEY(seat), JSON.stringify(written));
}

/**
 * Notes that the game at this seat has ended, if the seat is still held.
 *
 * Kept rather than dropped: the record is the way back to a finished game
 * after a reload, and the reader may not have taken the PGN off the board yet.
 * Closing the game is what throws it away, and closing it is a thing somebody
 * does on purpose.
 */
export function markGameOver(
  gameId: string,
  ending: { result: GameResult; reason: EndReason }
): void {
  /*
    Both seats, not merely the one this tab is at. A browser can hold the two
    ends of one game, and a game ends for both of them at once — so a tab shut
    before the last move would otherwise go on offering a game to be played.
  */
  for (const seat of [seatOf(gameId, "challenger"), seatOf(gameId, "opponent")]) {
    const saved = loadGame(seat);
    if (saved !== null && saved.ending === undefined) {
      saveGame({ ...saved, ending });
    }
  }
}

/** Drops a seat this browser has no further business at. */
export function forgetGame(seat: string): void {
  forget(KEY(seat));
}

/**
 * Drops every seat this browser holds at that game.
 *
 * What closing a finished game does. One browser can be sitting at both ends
 * of one board — two tabs, two tokens — and when the game is over neither of
 * them can play another move; what is left is the transcript, which is on the
 * board and in the PGN rather than in these. So both go, and the game stops
 * being anything this browser holds.
 */
export function forgetSeats(gameId: string): void {
  forgetGame(seatOf(gameId, "challenger"));
  forgetGame(seatOf(gameId, "opponent"));
}

export function loadGame(seat: string): SavedGame | null {
  return parse(read(KEY(seat)));
}

/** A record this build wrote, or null for anything else at all. */
function parse(saved: string | null): SavedGame | null {
  if (saved === null) {
    return null;
  }
  try {
    const game = JSON.parse(saved) as SavedGame;
    return game.v === SEAT_SCHEMA ? game : null;
  } catch {
    return null;
  }
}

/**
 * Every game this browser could still walk back into, newest last.
 *
 * There is no "the" game any more, and there was never a good reason for there
 * to be one: a browser can hold a seat at as many games as it has tokens for,
 * and which of them a tab is showing is the tab's own business — it is in the
 * address. This is only the list to choose from when a tab is showing none.
 *
 * A game leaves this list when it is walked out of for good: an invite taken
 * back, or a finished game closed. What is left is what is worth offering.
 */
export function savedGames(): SavedGame[] {
  const games: SavedGame[] = [];
  // Finished games among them: the list says what each one is, and a game
  // that has been played is a thing to be told about rather than hidden.
  for (const key of keys()) {
    if (!key.startsWith(PREFIX)) {
      continue;
    }
    const saved = parse(read(key));
    if (saved === null) {
      // Unreadable, or written by a build whose records this one does not
      // claim to understand. Swept up rather than left to be walked past
      // every time the list is read.
      forget(key);
      continue;
    }
    games.push(saved);
  }
  /*
    In the order they are worth looking at: games being played first, since
    somebody may be waiting on a move; then invites still hoping for an answer;
    then games that are over and only want putting away. Within a group, by the
    game's number, so that the two seats at one game sit together and the list
    does not reshuffle itself between one reading and the next.
  */
  const rank = (game: SavedGame) =>
    game.ending !== undefined ? 2 : game.opponentName === null ? 1 : 0;
  return games.sort(
    (a, b) => rank(a) - rank(b) || a.gameId.localeCompare(b.gameId)
  );
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
