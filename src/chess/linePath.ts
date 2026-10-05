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

/** The moves from `from` up to `to`, numbered as a path that starts there would be. */
function written(moves: PathMove[], from: number, to = moves.length): string {
  return moves
    .slice(from, to)
    .map((move, index) => {
      const numbered = !move.black || index === 0 || moves[from + index - 1].note !== "";
      return `${numbered ? `${move.number} ` : ""}${move.san}${move.note}`;
    })
    .join(" ");
}

/** A line's label, and which of its moves the label starts at — 0 unless its front was left off. */
export interface FittedLine {
  label: string;
  first: number;
}

/**
 * A line's label: its name — "2", or "Line 2" — and the way it goes from the
 * first position: all of it where `fits` says it fits, and otherwise as much
 * of its end as fits, the moves before it said by an ellipsis. The end is what
 * is kept: the lines of a game share their beginnings and part towards their
 * ends, so the end is what tells one from another.
 *
 * Unless that would leave off the move at `keep` — the one the board has just
 * played, where the label says so. That one is never left off: the label then
 * starts from it, and says as much of what follows it as fits, an ellipsis
 * after it where that is not all. What comes after the board's move is what
 * the reader is about to see played, which is worth more than what came
 * before.
 *
 * `fits` is asked of whole labels, so the caller measures them in whatever the
 * label is shown in. Where nothing fits, the label is the name, the ellipsis
 * and one move — the kept one, or the last — which a label is never without.
 */
export function fitLine(line: TreeLine, name: string, fits: (label: string) => boolean, keep = -1): FittedLine {
  const moves = pathMoves(line);
  if (moves.length === 0) {
    return { label: `${name}: no moves`, first: 0 };
  }
  const whole = `${name}: ${written(moves, 0)}`;
  if (fits(whole)) {
    return { label: whole, first: 0 };
  }
  /* The fewest moves left off its front that makes it fit — but none past the
     kept move. Labels only get shorter as moves are left off, so the first
     that fits is the longest that does. */
  const last = keep >= 0 && keep < moves.length ? keep : moves.length - 1;
  for (let from = 1; from <= last; from += 1) {
    const label = `${name}: … ${written(moves, from)}`;
    if (fits(label)) {
      return { label, first: from };
    }
  }
  if (last === moves.length - 1) {
    return { label: `${name}: … ${written(moves, last)}`, first: last };
  }
  /* From the kept move, then, and as far on from it as fits. */
  const front = last === 0 ? `${name}: ` : `${name}: … `;
  let to = last + 1;
  while (to < moves.length && fits(`${front}${written(moves, last, to + 1)} …`)) {
    to += 1;
  }
  return { label: `${front}${written(moves, last, to)}${to < moves.length ? " …" : ""}`, first: last };
}

/** Just the label: see `fitLine`. */
export function lineLabel(line: TreeLine, name: string, fits: (label: string) => boolean, keep = -1): string {
  return fitLine(line, name, fits, keep).label;
}
