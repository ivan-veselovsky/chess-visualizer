/**
 * The positions reached so far, and which one the board is showing.
 *
 * Newest first: index 0 is the position most recently arrived at, and walking
 * up the array walks back through the game. "Previous" therefore moves toward
 * the end of the array and "Next" toward its head, which reads backwards as
 * array arithmetic but matches how the list is meant to be read — most recent
 * at the top.
 */
/** A position, and the move that produced it — nothing, at the head of a line. */
export interface HistoryEntry {
  fen: string;
  /** The move in SAN, e.g. "Qxd6"; null for a position set outright. */
  move: string | null;
}

export interface PositionHistory {
  /** Newest at index 0. Never empty. */
  entries: HistoryEntry[];
  /** Index into `entries` of the one on the board. */
  current: number;
}

/** A history holding one position, which is where every line starts. */
export function startHistory(fen: string): PositionHistory {
  return { entries: [{ fen, move: null }], current: 0 };
}

/**
 * A history holding a whole line, positioned at the end of it.
 *
 * At the end rather than the beginning: a game arrives here from a library, a
 * link or a paste, and what somebody opening one wants first is to see where
 * it got to. Reading it from the start is a step away — the button for it is
 * right there — whereas landing at move zero puts a click between the reader
 * and the thing they opened, every time.
 *
 * It also makes the board say what it holds. A line shown at its first
 * position looks like an empty board, which is misleading when the game on it
 * is exactly what is about to be offered to a friend.
 */
export function historyFromLine(entries: HistoryEntry[]): PositionHistory {
  return { entries, current: 0 };
}

/**
 * A whole history as a starting point and the moves from it, in the order they
 * were played — the shape a game travels in, rather than the shape it is read
 * in here.
 *
 * The entries run newest first and each carries the move that produced it, so
 * the earliest entry is the position the line began at and every other entry's
 * move, read backwards, is the line.
 */
export function lineOf(history: PositionHistory): {
  initialFEN: string;
  moves: string[];
} {
  const { entries } = history;
  return {
    initialFEN: entries[entries.length - 1].fen,
    moves: entries
      .slice(0, entries.length - 1)
      .map((entry) => entry.move ?? "")
      .reverse(),
  };
}

export function currentPosition(history: PositionHistory): string {
  return history.entries[history.current].fen;
}

/**
 * Records a position arrived at from the current one.
 *
 * Anything newer than the current position is dropped first. Having stepped
 * back and then played, the line that had followed is no longer what happened,
 * so it does not survive as something "Next" could return to.
 */
export function pushPosition(
  history: PositionHistory,
  fen: string,
  move: string
): PositionHistory {
  return {
    entries: [{ fen, move }, ...history.entries.slice(history.current)],
    current: 0,
  };
}

/** Whether an earlier position exists to step back to. */
export function canGoPrevious(history: PositionHistory): boolean {
  return history.current + 1 < history.entries.length;
}

/** Whether a later position exists to step forward to. */
export function canGoNext(history: PositionHistory): boolean {
  return history.current > 0;
}

/** One step back through the game; unchanged at the earliest position. */
export function goPrevious(history: PositionHistory): PositionHistory {
  return canGoPrevious(history)
    ? { ...history, current: history.current + 1 }
    : history;
}

/** One step forward again; unchanged at the newest position. */
export function goNext(history: PositionHistory): PositionHistory {
  return canGoNext(history) ? { ...history, current: history.current - 1 } : history;
}

/**
 * Straight to where the game began, and to where it has got to.
 *
 * Available on the same terms as stepping: there is a first position to reach
 * only when there is one behind, and a last one only when there is one ahead.
 * The list runs newest first, so the two ends are the last index and index 0.
 */
export function goFirst(history: PositionHistory): PositionHistory {
  return goToPosition(history, history.entries.length - 1);
}

export function goLast(history: PositionHistory): PositionHistory {
  return goToPosition(history, 0);
}

/**
 * Whether two lines hold the same game: the same positions, reached by the same
 * moves, in the same order.
 *
 * Where the pointer sits is not part of it. Stepping back to look at an earlier
 * position leaves the game itself untouched; playing from there does not, and
 * shows up as a line of a different length or a move that differs.
 */
export function sameLine(a: HistoryEntry[], b: HistoryEntry[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (entry, index) =>
        entry.fen === b[index].fen && entry.move === b[index].move
    )
  );
}

/** Where a position sits in the list, or -1 if it is not one of them. */
export function indexOfPosition(history: PositionHistory, fen: string): number {
  const wanted = fen.trim();
  return history.entries.findIndex((entry) => entry.fen === wanted);
}

/**
 * Moves the pointer straight to one of the positions, leaving the list alone —
 * what picking from the list does, as against stepping through it.
 */
export function goToPosition(
  history: PositionHistory,
  index: number
): PositionHistory {
  return index >= 0 && index < history.entries.length
    ? { ...history, current: index }
    : history;
}

/**
 * How an entry reads in the list, as a game score is written: White's move
 * carries the move number, Black's is indented under it so the two columns
 * line up down the list.
 *
 * The mover is the side *not* to move in the position that followed, and when
 * that is Black the full-move counter has already advanced past them, so it is
 * read back by one.
 */
export function describeEntry(entry: HistoryEntry): string {
  if (entry.move === null) {
    return "start";
  }

  const fields = entry.fen.trim().split(/\s+/);
  const playedByWhite = fields[1] === "b";
  const fullmove = Number(fields[5]);

  if (!Number.isFinite(fullmove)) {
    return entry.move;
  }

  const number = playedByWhite ? fullmove : fullmove - 1;
  // No padding before the number: Black is indented by the width of its own
  // White prefix, which is what puts the pair in one column.
  //
  // Every space here is non-breaking, the one after the number included. An
  // ordinary space is collapsible, so a platform free to trim it would pull
  // White's move a column left of the indent that was measured against it.
  const prefix = `${number}.\u00a0`;
  return playedByWhite
    ? `${prefix}${entry.move}`
    : `${"\u00a0".repeat(prefix.length)}${entry.move}`;
}
