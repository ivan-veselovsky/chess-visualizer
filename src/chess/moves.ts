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
  /**
   * The move in standard algebraic notation, as PGN writes it — "Qxd6",
   * "Nxd6+", "O-O", "e8=Q#". Taken from chess.js, which works out the
   * captures, checks, promotions and disambiguation.
   */
  san: string;
}

/** What a pawn reaching the last rank may become. */
export type PromotionPiece = "q" | "r" | "b" | "n";

/** Whether moving from `from` to `to` is a pawn reaching the last rank, which has to say what it becomes. */
export function isPromotion(position: Chess, from: Square, to: Square): boolean {
  return position
    .moves({ square: from, verbose: true })
    .some((move) => move.to === to && move.promotion !== undefined);
}

/**
 * Plays a move and returns the FEN that follows, or null if it is not legal.
 *
 * The given position is left untouched: it is derived from the FEN in state,
 * and the move's result is a new FEN rather than a mutation of it.
 *
 * A pawn reaching the last rank becomes `promotion` — asked of the reader
 * before this is called; see `isPromotion` — and a queen when nothing says
 * otherwise.
 */
export function applyMove(
  position: Chess,
  from: Square,
  to: Square,
  promotion: PromotionPiece = "q"
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
    ...(candidates[0].promotion === undefined ? {} : { promotion }),
  });
  return { fen: next.fen(), san: played.san };
}
