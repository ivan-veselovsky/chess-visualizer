import { Chess, DEFAULT_POSITION, type Color, type Square } from "chess.js";

/** What may be given away. The traditional odds, in order of weight. */
export type HandicapPiece = "pawn" | "knight" | "rook" | "queen";

/**
 * Odds offered with a challenge, said from the challenger's side.
 *
 * One value serves both players: the challenger reads it as "I give", the one
 * challenged reads the same value as "I am given". Nothing is stored twice and
 * nothing has to be kept in step.
 */
export interface Handicap {
  giver: "challenger" | "opponent";
  piece: HandicapPiece;
}

/**
 * Where each man stands at the start, by tradition: the f-pawn, and the pieces
 * from the queen's side. Which of the two knights or rooks hardly matters to
 * the game, but a game has to name one.
 */
const SQUARES: Record<HandicapPiece, Record<Color, Square>> = {
  pawn: { w: "f2", b: "f7" },
  knight: { w: "b1", b: "b8" },
  rook: { w: "a1", b: "a8" },
  queen: { w: "d1", b: "d8" },
};

export const HANDICAP_PIECES: HandicapPiece[] = [
  "pawn",
  "knight",
  "rook",
  "queen",
];

/** The opposite army. */
const other = (color: Color): Color => (color === "w" ? "b" : "w");

/**
 * The position a game starts from, given the odds and who takes which side.
 *
 * The derivation runs this way only. Odds are the thing chosen and the thing
 * shown; the position is worked out from them, and never read back to guess
 * what was meant — a board missing a pawn cannot say whether that was odds or
 * a game already under way.
 *
 * Castling rights follow from the removal: chess.js clears the right on the
 * side a rook is taken from, which is what makes rook odds legal rather than
 * merely valid.
 */
export function positionWithHandicap(
  handicap: Handicap | null,
  challengerColor: Color,
): string {
  if (handicap === null) {
    return DEFAULT_POSITION;
  }
  const giver =
    handicap.giver === "challenger" ? challengerColor : other(challengerColor);
  const board = new Chess(DEFAULT_POSITION);
  board.remove(SQUARES[handicap.piece][giver]);
  return board.fen();
}

/** How the odds read to one player or the other. */
export function describeHandicap(
  handicap: Handicap | null,
  reading: "challenger" | "opponent",
): string {
  if (handicap === null) {
    return "None";
  }
  const mine = handicap.giver === reading;
  const piece = handicap.piece === "pawn" ? "a pawn" : `a ${handicap.piece}`;
  return mine ? `I give ${piece}` : `My opponent gives ${piece}`;
}
