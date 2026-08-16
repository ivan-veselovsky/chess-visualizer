import type { Chess, Color, PieceSymbol, Square } from "chess.js";

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
