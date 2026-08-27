import { Chess, type Color, type PieceSymbol } from "chess.js";
import type { PositionHistory } from "./history";

/** A man taken off the board, and which army took it. */
export interface Capture {
  /** What was taken. Never a king: the game ends before one comes off. */
  type: PieceSymbol;
  /** The colour that took it — the man itself is of the other colour. */
  by: Color;
}

/**
 * Captured men, most valuable first. Kings are absent by the same rule that
 * keeps them on the board.
 */
export const CAPTURE_ORDER: PieceSymbol[] = ["q", "r", "b", "n", "p"];

/**
 * Everything taken on the way to the position being shown.
 *
 * Replayed rather than recorded, for the reason `lastMove` replays: the list
 * keeps a move's notation and the position it led to, and notation alone does
 * not say what a capture took — `Qxd6` names the square, not the man. Playing
 * each move again on the position before it is what turns one into the other.
 *
 * Only the moves up to the shown position count, so stepping back through a
 * game puts the men back as it goes.
 *
 * A line that starts from a position rather than from a game — a FEN typed or
 * pasted, or a game beginning mid-board — has nothing behind it, and nothing is
 * claimed. What is missing from such a board could be read off the men that
 * remain, but only by guessing: a promoted man cannot be told from the one he
 * stands in for, so a side that lost a queen and promoted another looks whole,
 * and every pawn that promoted looks taken. Those are the positions where the
 * count would matter most and where it would be furthest out, so the bar stays
 * empty until it has moves to go on.
 */
export function capturesUpTo(history: PositionHistory): Capture[] {
  const taken: Capture[] = [];
  // Entries run newest first, so the oldest move is at the far end.
  for (
    let index = history.entries.length - 2;
    index >= history.current;
    index -= 1
  ) {
    const entry = history.entries[index];
    const before = history.entries[index + 1];
    if (entry.move === null) {
      continue;
    }
    try {
      const board = new Chess(before.fen);
      const move = board.move(entry.move);
      if (move.captured !== undefined) {
        taken.push({ type: move.captured, by: move.color });
      }
    } catch {
      // A move that will not replay says nothing about what it took.
    }
  }
  return taken;
}

/** How many of each kind one army has taken, in `CAPTURE_ORDER`. */
export function countsFor(
  captures: Capture[],
  by: Color,
): { type: PieceSymbol; count: number }[] {
  return CAPTURE_ORDER.map((type) => ({
    type,
    count: captures.filter(
      (capture) => capture.by === by && capture.type === type,
    ).length,
  })).filter((kind) => kind.count > 0);
}

/**
 * What each man is worth, for the running count of who is ahead: the classic
 * pawn 1, knight and bishop 3, rook 5, queen 9. Engines tune finer values —
 * a bishop a shade over a knight, a pair of them worth more than two — but
 * those come out in fractions, and this is a number read at a glance.
 */
export const MATERIAL_VALUE: Record<PieceSymbol, number> = {
  k: 0,
  q: 9,
  r: 5,
  b: 3,
  n: 3,
  p: 1,
};

/** What one army has taken, added up. */
export function materialTaken(captures: Capture[], by: Color): number {
  return captures
    .filter((capture) => capture.by === by)
    .reduce((total, capture) => total + MATERIAL_VALUE[capture.type], 0);
}
