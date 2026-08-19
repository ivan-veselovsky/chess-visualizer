import { Chess } from "chess.js";
import type { HistoryEntry } from "./history";

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
