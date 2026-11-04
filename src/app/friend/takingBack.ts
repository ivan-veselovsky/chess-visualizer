import type { Color } from "chess.js";
import type { TakingBack } from "../../../worker/protocol";
import { halfMoves } from "./counting.ts";

/**
 * What is said about takebacks, to both players.
 *
 * A takeback is now a run of them — pressed as many times as it takes, some
 * of it undone, finished by a move — and the player across the board sees
 * none of the pressing. All they see is their board stepping back, and
 * forward, with nobody there having moved. So what is going on is said in
 * words, and said in full: whose takeback it is, how far it has gone, which
 * moves, and what everybody is waiting for. Worked out from the game as the
 * object keeps it, rather than added up from the messages along the way, so
 * that a page opened in the middle of one says the same as a page that saw
 * it all.
 */

/**
 * Moves `from` to `to` of a line, numbered as they are written: "3. Bc4 Bc5
 * 4. d3", or "3… Bc5 4. d3" from a move by Black. Plain letters rather than
 * the board's figurines, as the notices around them are.
 *
 * Counted from where the game started rather than played through: a move's
 * number is a matter of how many came before it, and so this needs only the
 * moves it says — which is all a notice has, at the moment it is said.
 */
export function movesSaid(initialFEN: string | null, line: string[], from: number, to: number): string {
  const said: string[] = [];
  for (let ply = from; ply < Math.min(to, line.length); ply += 1) {
    const [number, white] = numberOf(initialFEN, ply);
    said.push(white ? `${number}. ${line[ply]}` : ply === from ? `${number}… ${line[ply]}` : line[ply]);
  }
  return said.join(" ");
}

/** One move, its ply counted from 0, said with its number: "3. Bc4", "3… Bc5". */
export function moveSaid(initialFEN: string | null, ply: number, san: string): string {
  const [number, white] = numberOf(initialFEN, ply);
  return white ? `${number}. ${san}` : `${number}… ${san}`;
}

/** The number a ply is written with, and whether it is White's. */
function numberOf(initialFEN: string | null, ply: number): [number, boolean] {
  const [, side = "w", , , , full = "1"] = (initialFEN ?? "").split(" ");
  /* Half-moves since White's move of the starting number. */
  const at = ply + (side === "b" ? 1 : 0);
  return [Number(full) + Math.floor(at / 2), at % 2 === 0];
}

const takebacks = (count: number) => `${count} ${count === 1 ? "takeback" : "takebacks"}`;

/**
 * The takeback under way, as it is so far: the line it began from — the
 * oldest of its lines in `abandoned`, which is the game as it stood before
 * the first press — and how far back from it the game now is.
 */
function soFar(takingBack: TakingBack, abandoned: string[][], played: number) {
  const line = abandoned[abandoned.length - takingBack.count];
  if (line === undefined || line.length <= played) {
    return null;
  }
  return { line, gone: line.length - played };
}

/**
 * The line under the buttons while somebody is taking moves back: null when
 * nobody is.
 *
 * `played` is how many moves the board shows, which is where the game is
 * while a takeback is being played out on it a move at a time.
 */
export function takingBackSaid({
  you,
  opponent,
  takingBack,
  abandoned,
  initialFEN,
  played,
}: {
  you: Color;
  opponent: string;
  takingBack: TakingBack | null;
  abandoned: string[][];
  initialFEN: string | null;
  played: number;
}): string | null {
  if (takingBack === null) {
    return null;
  }
  const run = soFar(takingBack, abandoned, played);
  const howFar =
    run === null
      ? takebacks(takingBack.count)
      : `${halfMoves(run.gone)} so far, in ${takebacks(takingBack.count)}: ${movesSaid(initialFEN, run.line, played, run.line.length)}`;
  if (takingBack.by !== you) {
    return `${opponent} is taking moves back — ${howFar}. Your Takeback waits until they have made their move.`;
  }
  return `You are taking moves back — ${howFar}. ${
    takingBack.count > 1 ? "Undo takeback puts the last of them back." : "The first takeback cannot be undone."
  } Your next move ends it.`;
}

/**
 * Said to the other player when a takeback has been finished by a move:
 * everything it took back, and what was played instead. Null when the move
 * was not the end of one, or not the opponent's.
 *
 * `ply` is the move's own, counted from 0 — which is also how many moves the
 * takeback left.
 */
export function takenBackInAll({
  you,
  opponent,
  takingBack,
  abandoned,
  initialFEN,
  ply,
  san,
}: {
  you: Color;
  opponent: string;
  takingBack: TakingBack | null;
  abandoned: string[][];
  initialFEN: string | null;
  ply: number;
  san: string;
}): string | null {
  if (takingBack === null || takingBack.by === you) {
    return null;
  }
  const run = soFar(takingBack, abandoned, ply);
  if (run === null) {
    return null;
  }
  const played = movesSaid(initialFEN, [...run.line.slice(0, ply), san], ply, ply + 1);
  const again = run.line[ply] === san ? "again" : "instead";
  return `${opponent} took back ${halfMoves(run.gone)} (${movesSaid(initialFEN, run.line, ply, run.line.length)}) and played ${played} ${again}.`;
}
