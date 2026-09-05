/**
 * How far a game has got, said in half-moves.
 *
 * A "move" in chess is a pair — White plays and Black answers — so a game
 * eleven half-moves in is at move six and a half, which is not a thing anyone
 * says. Rounding it hides the half that matters: at eleven it is Black to play
 * and at twelve it is White, and every place this count appears is a place
 * where that is the point. A game to be continued from is continued from a
 * position, and a game to be gone back to is at one.
 *
 * So the count is of half-moves and says so. It is only jargon in the sense
 * that a chessboard has files: it names something that has no shorter true
 * name, and the alternative was a number that could be off by one in a way the
 * reader could not see.
 */
export function halfMoves(played: number): string {
  if (played <= 0) {
    return "no moves yet";
  }
  return `${played} ${played === 1 ? "half-move" : "half-moves"}`;
}
