import type { Chess, Color, PieceSymbol, Square } from "chess.js";

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** A piece together with the square it currently occupies. */
export interface PlacedPiece {
  square: Square;
  type: PieceSymbol;
  color: Color;
}

/** Flattens the 8x8 board returned by chess.js into a list of occupied squares. */
export function readPieces(chess: Chess): PlacedPiece[] {
  return chess
    .board()
    .flat()
    .filter((cell): cell is NonNullable<typeof cell> => cell !== null)
    .map(({ square, type, color }) => ({ square, type, color }));
}

/** 0 for file "a" .. 7 for file "h". */
export function fileIndex(square: Square): number {
  return square.charCodeAt(0) - "a".charCodeAt(0);
}

/** 0 for rank 1 .. 7 for rank 8. */
export function rankIndex(square: Square): number {
  return square.charCodeAt(1) - "1".charCodeAt(0);
}

/** Square at the given indices, or null when they fall outside the board. */
export function squareAt(file: number, rank: number): Square | null {
  if (file < 0 || file >= FILES.length || rank < 0 || rank >= RANKS.length) {
    return null;
  }
  return `${FILES[file]}${RANKS[rank]}` as Square;
}

/**
 * Solid (filled) Unicode glyphs for every piece kind. The same glyph is used for
 * both colours; white pieces are drawn with a white fill and a dark outline so
 * the two sides stay visually consistent across fonts.
 */
export const PIECE_GLYPHS: Record<PieceSymbol, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};
