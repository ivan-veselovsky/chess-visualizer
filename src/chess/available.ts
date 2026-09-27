import type { Chess, Color, PieceSymbol } from "chess.js";
/*
  Written with their extensions, unlike the imports elsewhere. This module is
  exercised by `tests/unit.mjs`, which node runs straight from the TypeScript
  with no bundler to guess at extensions — and both of these are values rather
  than types, so they have to resolve at run time.
  `allowImportingTsExtensions` is on for exactly this.
*/
import { CAPTURE_ORDER, MATERIAL_VALUE } from "./captures.ts";
import { readPieces } from "./model.ts";

/**
 * The order the men hang in, which is the captured bar's order and the same
 * list — heaviest first, and no king.
 *
 * He is off it for a reason of his own at each end. The captured bar can never
 * name him, the game ending before one comes off. This bar could, and he would
 * stand in both columns at every moment of every game — a man who is always
 * there says nothing, and what is worth reading here is where the two armies
 * differ.
 */
export const AVAILABLE_ORDER: PieceSymbol[] = CAPTURE_ORDER;

/**
 * How many of each kind one army still has, in `AVAILABLE_ORDER`.
 *
 * Read off the board rather than worked out from a starting set and a list of
 * captures, which is what makes the bar right in the two places that sum would
 * be wrong. A game at odds starts short of a man, and the board knows it
 * without being told what the odds were; a pawn that promoted stands there as a
 * queen, and the board says queen. Nothing has to be reconciled, because there
 * is only ever one account of it.
 *
 * It is also why this bar says something on a position that arrived as a FEN,
 * where the captured bar stays empty: what is on the board is on the board,
 * whether or not there are moves behind it saying how it got that way.
 */
export function availableFor(
  position: Chess,
  color: Color,
): { type: PieceSymbol; count: number }[] {
  const men = readPieces(position).filter((man) => man.color === color);
  return AVAILABLE_ORDER.map((type) => ({
    type,
    count: men.filter((man) => man.type === type).length,
  })).filter((kind) => kind.count > 0);
}

/**
 * What one army has standing, added up, by the same values the captured bar
 * counts with — so a promoted pawn is the 8 the two men differ by, a queen's 9
 * arriving as the pawn's 1 leaves.
 */
export function materialOn(position: Chess, color: Color): number {
  return readPieces(position)
    .filter((man) => man.color === color)
    .reduce((total, man) => total + MATERIAL_VALUE[man.type], 0);
}
