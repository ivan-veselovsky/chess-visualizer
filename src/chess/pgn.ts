import { Chess } from "chess.js";
import type { HistoryEntry, PositionHistory } from "./history";

export interface PgnImport {
  /** The whole line, newest first, ready to become a history. Null on failure. */
  entries: HistoryEntry[] | null;
  error: string | null;
}

/**
 * Reads a game and returns every position it passes through.
 *
 * chess.js parses the moves; replaying them is what turns a move list into the
 * positions the board works in. The line starts wherever the game does — a PGN
 * carrying a FEN header begins there rather than at the initial position.
 *
 * Entries come back newest first, matching how a history is ordered.
 */
export function parsePgn(text: string): PgnImport {
  if (text.trim() === "") {
    return { entries: null, error: "That file is empty." };
  }

  const game = new Chess();
  try {
    game.loadPgn(text);
  } catch (cause) {
    return {
      entries: null,
      error: cause instanceof Error ? cause.message : "Could not read that PGN.",
    };
  }

  const moves = game.history({ verbose: true });
  if (moves.length === 0) {
    return { entries: null, error: "That PGN holds no moves." };
  }

  // `before` on the first move is where the game started, headers included.
  const line: HistoryEntry[] = [{ fen: moves[0].before, move: null }];
  for (const move of moves) {
    line.push({ fen: move.after, move: move.san });
  }

  return { entries: line.reverse(), error: null };
}

/**
 * Writes the whole line out as a game.
 *
 * The moves are replayed from the line's first position rather than assembled
 * by hand, so chess.js supplies the tag roster and — where the line began
 * somewhere other than the initial position — the SetUp and FEN headers that
 * make the result readable back in.
 *
 * The entire line is written, not merely as far as the pointer: stepping back
 * to look at an earlier position does not unplay what followed.
 *
 * `event` names the game in the tag chess.js would otherwise fill with "?".
 * Where a game is being kept under a name, that name is what it is called.
 */
export function toPgn(
  history: PositionHistory,
  event: string | null = null
): string | null {
  const line = [...history.entries].reverse();
  let game: Chess;
  try {
    game = new Chess(line[0].fen);
  } catch {
    return null;
  }

  for (const entry of line.slice(1)) {
    if (entry.move === null) {
      continue;
    }
    try {
      game.move(entry.move);
    } catch {
      return null;
    }
  }

  if (event !== null && event !== "") {
    game.setHeader("Event", event);
  }

  return game.pgn({ maxWidth: 72, newline: "\n" });
}
