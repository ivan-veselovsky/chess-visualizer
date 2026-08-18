import { Chess, DEFAULT_POSITION, validateFen } from "chess.js";

/**
 * The position the board opens on, and what Reset returns to: the standard
 * initial setup, taken from chess.js rather than written out again here.
 */
export const DEFAULT_FEN = DEFAULT_POSITION;

export interface ParsedFen {
  position: Chess | null;
  /** Why the FEN was rejected, when it was. */
  error: string | null;
}

/**
 * Reads a FEN into a position. Invalid input is reported rather than thrown, so
 * a half-typed FEN can leave the board showing the last one that parsed.
 */
export function parseFen(fen: string): ParsedFen {
  const trimmed = fen.trim();
  if (trimmed === "") {
    return { position: null, error: "Enter a FEN" };
  }

  const validation = validateFen(trimmed);
  if (!validation.ok) {
    return { position: null, error: validation.error ?? "Invalid FEN" };
  }

  try {
    return { position: new Chess(trimmed), error: null };
  } catch (cause) {
    // validateFen and the constructor disagree on a few edge cases.
    return {
      position: null,
      error: cause instanceof Error ? cause.message : "Invalid FEN",
    };
  }
}
