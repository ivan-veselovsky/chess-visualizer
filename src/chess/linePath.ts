/*
  Written with its extension, like the other modules `tests/unit.mjs` runs
  straight from the TypeScript.
*/
import type { TreeLine } from "./variations.ts";

/**
 * A line of a game with variations, written out as it is played from the
 * first position — "1. Rhg7 Nf7 {case A} 2. Rg8#" — for the list the lines are
 * chosen from.
 *
 * Every move, rather than only the ones where the line parts from the others:
 * the list is read to find a line, and a line is recognised by the way it goes.
 * What the file calls a line, where it calls it anything, stays where the file
 * put it, after the move it parts with.
 */

/** One move as written in the path: its number where it needs one, the move, and the file's name for the line it starts. */
interface PathMove {
  /** "5." before White's move; "5..." before Black's, written only where the path starts with it. */
  number: string;
  black: boolean;
  san: string;
  /** " {case A}" — what the file calls the line this move parts on, or "". */
  note: string;
}

function pathMoves(line: TreeLine): PathMove[] {
  const start = line.entries[line.entries.length - 1]?.fen.split(" ") ?? [];
  let black = start[1] === "b";
  let number = Number(start[5]) || 1;
  const notes = new Map<number, string>();
  line.forks.forEach((at, index) => {
    const named = /\{[^}]*\}\s*$/.exec(line.choices[index] ?? "");
    if (named !== null) {
      notes.set(at, ` ${named[0].trim()}`);
    }
  });
  return line.moves.map((san, at) => {
    const move = { number: black ? `${number}...` : `${number}.`, black, san, note: notes.get(at) ?? "" };
    if (black) {
      number += 1;
    }
    black = !black;
    return move;
  });
}

/**
 * The moves from `from` up to `to`, numbered as a path that starts there would
 * be. `apart`, a space more before each White move after the first — a
 * no-break space, so a page's spaces cannot run it into one — setting each
 * pair of moves off from the next.
 */
function written(moves: PathMove[], from: number, to = moves.length, apart = false): string {
  return moves
    .slice(from, to)
    .map((move, index) => {
      const numbered = !move.black || index === 0 || moves[from + index - 1].note !== "";
      const gap = index === 0 ? "" : apart && !move.black ? "\u00a0 " : " ";
      return `${gap}${numbered ? `${move.number} ` : ""}${move.san}${move.note}`;
    })
    .join("");
}

/** A line's label, and which of its moves the label starts at — 0 unless its front was left off. */
export interface FittedLine {
  label: string;
  first: number;
  /** What comes before the first move shown: the name, and the ellipsis where the front was left off. */
  head: string;
}

/** "2: ", "Line 2 of 3: ", or nothing for a label with no name — and the ellipsis after it where `first` leaves moves off. */
function headOf(name: string, first: number): string {
  return `${name === "" ? "" : `${name}: `}${first > 0 ? "… " : ""}`;
}

/**
 * Where a label may start, past the line's first move: only at White's move,
 * so what shows always begins with a move number and the move after it, and
 * never with a Black move standing on its own. A line from a position with
 * Black to move starts with Black's move, and that is the one exception.
 */
function startsOf(moves: PathMove[]): number[] {
  return moves.flatMap((move, index) => (index === 0 || !move.black ? [index] : []));
}

/**
 * A line's label: its name — "2", "Line 2 of 3", or nothing — and the way it
 * goes from the first position: all of it where `fits` says it fits, and
 * otherwise as much of its end as fits, the moves before it said by an
 * ellipsis, starting at a White move (see `startsOf`). The end is what is kept:
 * the lines of a game share their beginnings and part towards their ends, so
 * the end is what tells one from another.
 *
 * `fits` is asked of whole labels, so the caller measures them in whatever the
 * label is shown in. Where nothing fits, the label starts at the last move pair.
 */
export function fitLine(line: TreeLine, name: string, fits: (label: string) => boolean): FittedLine {
  const moves = pathMoves(line);
  if (moves.length === 0) {
    return { label: `${headOf(name, 0)}no moves`, first: 0, head: headOf(name, 0) };
  }
  const starts = startsOf(moves);
  /* The fewest moves left off its front that makes it fit. Labels only get
     shorter as moves are left off, so the first that fits is the longest that
     does. */
  for (const from of starts) {
    const label = `${headOf(name, from)}${written(moves, from)}`;
    if (fits(label)) {
      return { label, first: from, head: headOf(name, from) };
    }
  }
  const from = starts[starts.length - 1];
  return { label: `${headOf(name, from)}${written(moves, from)}`, first: from, head: headOf(name, from) };
}

/** Just the label: see `fitLine`. */
export function lineLabel(line: TreeLine, name: string, fits: (label: string) => boolean): string {
  return fitLine(line, name, fits).label;
}

/**
 * A line's label for the row over the board, following the move the board is
 * on as a page follows a reader: `current` is that move, -1 at the first
 * position, and `width` what `measure` says the room is.
 *
 * All of the line where it fits. Where it does not, the room is three zones —
 * a quarter, a half, a quarter — and the move the board is on is kept in the
 * middle one. While it is there, the label does not move: stepping along it
 * moves the underline, not the text. Stepped past the middle zone, the label
 * turns a page forward — the move is put at the start of the middle zone, half
 * the room on from where it was — and stepped back out of it, a page back, the
 * move at its end. Pages start at a White move (see `startsOf`). Near the
 * start of a line there is nothing to turn, and the move may stand in the
 * first quarter; on the page that shows the line to its end there is nothing
 * further to turn to, and it may go on into the last. That last page is the
 * one a page turned forward lands on wherever it can.
 *
 * `previous` is where the label started last time, kept by the caller: it is
 * what lets the label stand still.
 */
export function pageLine(
  line: TreeLine,
  name: string,
  measure: (text: string) => number,
  width: number,
  current: number,
  previous: number | null
): FittedLine {
  const moves = pathMoves(line);
  const head = (from: number) => headOf(name, from);
  if (moves.length === 0) {
    return { label: `${head(0)}no moves`, first: 0, head: head(0) };
  }
  const whole = `${head(0)}${written(moves, 0, moves.length, true)}`;
  if (measure(whole) <= width) {
    return { label: whole, first: 0, head: head(0) };
  }
  const at = Math.min(current, moves.length - 1);
  const starts = startsOf(moves).filter((from) => from <= Math.max(at, 0));
  /* Where the move the board is on starts and ends, on a page starting at `from`. */
  const before = (from: number) => measure(`${head(from)}${at > from ? `${written(moves, from, at, true)} ` : ""}`);
  const after = (from: number) => measure(`${head(from)}${written(moves, from, at + 1, true)}`);
  /* Whether a page starting at `from` shows the line to its end, with nothing after it to be cut off. */
  const toTheEnd = (from: number) => measure(`${head(from)}${written(moves, from, moves.length, true)}`) <= width;
  /* Where the move may stand without the page turning: in the middle zone — or,
     on a page that shows the line to its end, anywhere on to that end, since
     there is nothing further to turn to. */
  const standing = (from: number) =>
    (from === 0 || before(from) >= width / 4) && (after(from) <= (width * 3) / 4 || (toTheEnd(from) && after(from) <= width));

  /* The pages that keep the move from running past the middle zone, from the
     one with most before it to the one with least. A move too wide for any —
     a long note, a narrow row — starts a page of its own. */
  const fitting = starts.filter((from) => after(from) <= (width * 3) / 4);
  let first: number;
  if (at < 0) {
    first = 0;
  } else if (previous !== null && starts.includes(previous) && standing(previous)) {
    first = previous;
  } else if (fitting.length === 0) {
    /* No page from a White move keeps the move in the middle zone. The last
       such page, if the move is on it at all; and where not even that has room
       for it — a long note, a narrow row — the move itself starts the page,
       Black's or not, rather than run off the end of the room. */
    const last = starts[starts.length - 1];
    first = after(last) <= width ? last : at;
  } else if (previous !== null && starts.includes(previous) && previous > 0 && before(previous) < width / 4) {
    /* A page back: the move at the end of the middle zone, as much before it as that leaves room for. */
    first = fitting[0];
  } else {
    /* A page on — or a first look. The last page, where it can be had: the one
       showing the line to its end with as much before the move as there is
       room for, the move past the first quarter. Otherwise the move at the
       start of the middle zone, or as near it as a page starting at a White
       move can put it. */
    const last = starts.find((from) => toTheEnd(from) && (from === 0 || before(from) >= width / 4));
    first = last ?? [...fitting].reverse().find((from) => before(from) >= width / 4) ?? fitting[0];
  }

  /* And on from the page's start as far as the room goes, an ellipsis after it where that is not all. */
  let to = Math.max(at + 1, first + 1);
  const ending = (end: number) => `${head(first)}${written(moves, first, end, true)}${end < moves.length ? " …" : ""}`;
  while (to < moves.length && measure(ending(to + 1)) <= width) {
    to += 1;
  }
  return { label: ending(to), first, head: head(first) };
}
