import { Chess, type Square } from "chess.js";

/**
 * Squares a piece on `square` may legally move to. Everything about legality —
 * pins, castling rights, en passant — comes from chess.js; nothing here knows
 * the rules.
 */
export function legalTargets(position: Chess, square: Square): Square[] {
  return position
    .moves({ square, verbose: true })
    .map((move) => move.to as Square);
}

export interface PlayedMove {
  /** The position that follows. */
  fen: string;
  /** Piece letter and destination, e.g. "Qd3", "Pa8=Q" — what the list shows. */
  label: string;
}

/**
 * Plays a move and returns the FEN that follows, or null if it is not legal.
 *
 * The given position is left untouched: it is derived from the FEN in state,
 * and the move's result is a new FEN rather than a mutation of it.
 *
 * A pawn reaching the last rank must name what it becomes. Rather than ask,
 * this promotes to a queen — the choice in nearly every game, and a position
 * wanting anything else can be typed straight into the FEN.
 */
export function applyMove(
  position: Chess,
  from: Square,
  to: Square
): PlayedMove | null {
  const candidates = position
    .moves({ square: from, verbose: true })
    .filter((move) => move.to === to);

  if (candidates.length === 0) {
    return null;
  }

  const next = new Chess(position.fen());
  const played = next.move({
    from,
    to,
    ...(candidates[0].promotion === undefined ? {} : { promotion: "q" }),
  });
  const promotion =
    played.promotion === undefined ? "" : `=${played.promotion.toUpperCase()}`;
  return {
    fen: next.fen(),
    label: `${played.piece.toUpperCase()}${played.to}${promotion}`,
  };
}
