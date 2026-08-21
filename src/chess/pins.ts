import { Chess, type Color, type Square } from "chess.js";

/**
 * The squares holding a piece pinned against its own king: one that cannot
 * leave the line it stands on without letting an enemy slider bear on the king.
 *
 * Found by lifting each piece off in turn and asking who attacks the king that
 * did not before. The comparison is between the two *sets* of attackers rather
 * than between yes and no, so a king already in check — where something attacks
 * it either way — still gives the right answer.
 *
 * Absolute pins only: a piece shielding a queen or a rook is not counted.
 */
export function pinnedSquares(position: Chess): Square[] {
  // One scratch board for the lot. `remove` and `put` mutate, and building a
  // board per piece is thirty-odd FEN parses for a thing drawn every frame.
  const board = new Chess(position.fen());
  const kings = new Map<Color, Square>();
  for (const color of ["w", "b"] as const) {
    const [square] = board.findPiece({ type: "k", color });
    if (square !== undefined) {
      kings.set(color, square);
    }
  }

  const pinned: Square[] = [];
  for (const row of board.board()) {
    for (const cell of row) {
      if (cell === null || cell.type === "k") {
        continue;
      }
      const king = kings.get(cell.color);
      if (king === undefined) {
        continue;
      }
      const enemy: Color = cell.color === "w" ? "b" : "w";
      const before = new Set(board.attackers(king, enemy));
      board.remove(cell.square);
      const exposed = board
        .attackers(king, enemy)
        .some((from) => !before.has(from));
      board.put({ type: cell.type, color: cell.color }, cell.square);
      if (exposed) {
        pinned.push(cell.square);
      }
    }
  }
  return pinned;
}
