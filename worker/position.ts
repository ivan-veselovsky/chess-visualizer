import { Chess, DEFAULT_POSITION, validateFen } from "chess.js";

/**
 * Whether a position can be played from, and why not when it cannot.
 *
 * `validateFen` alone is not enough. It reads a FEN as a piece of notation and
 * says whether it parses; it does not ask whether the position could have been
 * reached, or whether there is anything left to play. It accepts a checkmate,
 * a stalemate, and a board where the side that just moved left its own king
 * attacked — and chess.js will then generate moves from that last one quite
 * happily, from a position no game could have arrived at.
 *
 * Returns null when the position will do, or the reason it will not.
 */
export function whyNotPlayable(fen: string): string | null {
  const valid = validateFen(fen);
  if (!valid.ok) {
    return valid.error ?? "That is not a position";
  }
  if (leavesOpponentInCheck(fen)) {
    return "That position cannot arise in a legal game";
  }
  if (new Chess(fen).isGameOver()) {
    return "That game is already over";
  }
  return null;
}

/**
 * Whether the side that just moved left its own king attacked, which no legal
 * move can do. Asked by handing the move back to them and looking.
 */
function leavesOpponentInCheck(fen: string): boolean {
  const fields = fen.trim().split(/\s+/);
  fields[1] = fields[1] === "w" ? "b" : "w";
  // An en passant square belongs to the move just played and would not survive
  // the swap; it has no bearing on who is in check.
  fields[3] = "-";
  try {
    return new Chess(fields.join(" ")).isCheck();
  } catch {
    return false;
  }
}

export { DEFAULT_POSITION };
