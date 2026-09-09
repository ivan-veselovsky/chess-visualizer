/*
  Written with its extension, like the other modules `tests/unit.mjs` runs
  straight from the TypeScript.
*/
import type { Orientation } from "../visualization/geometry.ts";

/** Which way round this browser last had the board. */
const KEY = "cv.board-side";

/**
 * Which side is at the bottom of the board.
 *
 * Kept apart from the settings, and not because it is unimportant. A setting is
 * a thing about how a board is drawn — its colours, its marks, how long they
 * take to cross — and it belongs to the preset it was tuned in. Which way round
 * the board faces is not that: it is where the reader is sitting. Held in the
 * settings, turning the board round marked the preset as edited, which asked
 * somebody who had changed nothing whether they wanted to save it.
 *
 * It is also written by the game rather than only by the reader: sitting down
 * at a seat turns the board to that side. Nothing about that belongs in a
 * preset either — it is a fact about the game, and it outlives whichever
 * colours are in use.
 *
 * One value per browser, last write wins, read once when the page opens.
 */
export function boardSide(): Orientation {
  try {
    return window.localStorage.getItem(KEY) === "black" ? "black" : "white";
  } catch {
    return "white";
  }
}

/**
 * Keeps it, at once rather than on a clock.
 *
 * One word, written when somebody turns the board or sits down at a game —
 * both rare, both worth surviving a tab that closes a moment later.
 */
export function setBoardSide(side: Orientation): void {
  try {
    window.localStorage.setItem(KEY, side);
  } catch {
    /* A browser refusing storage still runs the app; it just opens White at
       the bottom next time. */
  }
}
