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
  /** Piece letter and destination, e.g. "Qd3"; null for a position set outright. */
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
 * How an entry reads in the list: the move that produced it, numbered and
 * lettered for the side that played it — "3 W: Qd3", "5 B: Pb5".
 *
 * The mover is the side *not* to move in the position that followed, and when
 * that is Black the full-move counter has already advanced past them, so it is
 * read back by one.
 */
export function describeEntry(entry: HistoryEntry): string {
  const fields = entry.fen.trim().split(/\s+/);
  const toMove = fields[1] === "b" ? "b" : "w";
  const fullmove = Number(fields[5]);

  if (!Number.isFinite(fullmove)) {
    return entry.fen.trim().slice(0, 24) || "(empty)";
  }
  if (entry.move === null) {
    return `${fullmove} ${toMove === "b" ? "B" : "W"}: start`;
  }

  const playedByWhite = toMove === "b";
  const number = playedByWhite ? fullmove : fullmove - 1;
  return `${number} ${playedByWhite ? "W" : "B"}: ${entry.move}`;
}
