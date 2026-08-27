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
 * What a line starts from counts too. A position typed or pasted has no moves
 * behind it, so what is missing from it is worked out from the men that remain
 * — see `missingFrom` — and a game that begins mid-position keeps that deficit
 * showing as it goes on. A line that starts from the usual array adds nothing,
 * every man being present, so an ordinary game is exactly its own captures.
 */
export function capturesUpTo(history: PositionHistory): Capture[] {
  const start = history.entries[history.entries.length - 1];
  const taken: Capture[] = missingFrom(start.fen);
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

/** What each army starts with. */
const INITIAL: Record<PieceSymbol, number> = {
  k: 1,
  q: 1,
  r: 2,
  b: 2,
  n: 2,
  p: 8,
};

/** The men standing in a position, counted per army. */
function menInFen(fen: string): Record<Color, Record<PieceSymbol, number>> {
  const empty = (): Record<PieceSymbol, number> => ({
    k: 0,
    q: 0,
    r: 0,
    b: 0,
    n: 0,
    p: 0,
  });
  const men: Record<Color, Record<PieceSymbol, number>> = {
    w: empty(),
    b: empty(),
  };
  // The placement field alone, read directly rather than through a board: a
  // position to be counted need not be one that could be played from.
  for (const character of fen.split(" ")[0] ?? "") {
    const type = character.toLowerCase() as PieceSymbol;
    if (type in INITIAL) {
      men[character === type ? "b" : "w"][type] += 1;
    }
  }
  return men;
}

/**
 * What a position is missing, against the array both armies start from.
 *
 * Promotions are allowed for, since a man who left the board by promoting was
 * not taken. There is no telling a promoted queen from the original one, so the
 * count goes the only way it can: a side holding more of a kind than it started
 * with must have promoted that many pawns, and those pawns are struck off what
 * it is missing rather than counted as taken.
 *
 * That much is arithmetic; what it cannot recover is a side that lost its queen
 * and promoted another. The queen taken is invisible, both counts being one.
 * It is the price of reading a position instead of a game, and it only ever
 * understates.
 */
export function missingFrom(fen: string): Capture[] {
  const men = menInFen(fen);
  const gone: Capture[] = [];

  for (const colour of ["w", "b"] as Color[]) {
    const standing = men[colour];
    const promoted = (["q", "r", "b", "n"] as PieceSymbol[]).reduce(
      (total, type) => total + Math.max(0, standing[type] - INITIAL[type]),
      0,
    );
    for (const type of CAPTURE_ORDER) {
      const started = type === "p" ? INITIAL.p - promoted : INITIAL[type];
      const lost = Math.max(0, started - standing[type]);
      for (let index = 0; index < lost; index += 1) {
        // Whoever it belonged to, the other side took it.
        gone.push({ type, by: colour === "w" ? "b" : "w" });
      }
    }
  }
  return gone;
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
