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
 *
 * `idle` names squares whose piece is not attacking — one picked up, or one in
 * the air partway through its move. Such a piece still stands in the line and
 * still blocks it, which is why it is on the board at all, but it holds nothing
 * pinned: a pin is an attack, and it is making none. Without that, a piece that
 * unpinned by moving away kept its ring on the board for the whole journey and
 * released it on landing, a beat after its rays and its wash had gone.
 */
export function pinnedSquares(
  position: Chess,
  idle: readonly Square[] = []
): Square[] {
  // One scratch board for the lot. `remove` and `put` mutate, and building a
  // board per piece is thirty-odd FEN parses for a thing drawn every frame.
  /*
    A board mid-move has a piece lifted off it, and if that piece is a king the
    FEN will not read back at all. Nothing is pinned against a king that is in
    the air, so the honest answer then is none.
  */
  let board: Chess;
  try {
    board = new Chess(position.fen());
  } catch {
    return [];
  }
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
      /* Whoever bears on the king now and did not before is holding this piece
         where it stands — unless it is one of the pieces that is not attacking
         at the moment, which holds nothing. */
      const exposed = board
        .attackers(king, enemy)
        .some((from) => !before.has(from) && !idle.includes(from));
      board.put({ type: cell.type, color: cell.color }, cell.square);
      if (exposed) {
        pinned.push(cell.square);
      }
    }
  }
  return pinned;
}
