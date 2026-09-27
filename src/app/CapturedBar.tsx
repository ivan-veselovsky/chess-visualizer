import type { Color } from "chess.js";
import {
  CAPTURE_ORDER,
  countsFor,
  materialTaken,
  type Capture,
} from "../chess/captures";
import type { Orientation } from "../visualization/geometry";
import type { AttackSettings, PieceTint } from "../visualization/settings";
import MenBar, { type ManCount } from "./MenBar";

interface CapturedBarProps {
  captures: Capture[];
  /** Which army is at the bottom of the board, and so whose end is whose. */
  orientation: Orientation;
  pieceTint: PieceTint;
  attacks: AttackSettings;
}

/** The kinds one army has taken, in the order this end of the bar hangs them. */
function taken(
  captures: Capture[],
  by: Color,
  order: "up" | "down",
): ManCount[] {
  const counted = countsFor(captures, by);
  const wanted = order === "down" ? CAPTURE_ORDER : [...CAPTURE_ORDER].reverse();
  return wanted
    .map((type) => counted.find((kind) => kind.type === type))
    .filter((kind) => kind !== undefined);
}

/**
 * The men taken so far, in a bar the height of the board beside it.
 *
 * Each player's trophies sit at their own end: yours along the bottom, your
 * opponent's along the top, each group ordered so its queen is the piece
 * nearest the middle. Which end is yours follows the board's orientation, as it
 * does everywhere else — flipping the board swaps the two.
 *
 * Every man on this bar is scored through, because every man on it is gone.
 * That is the one thing told apart at a glance from the bar of men still
 * standing, which is otherwise the same picture drawn the same way.
 *
 * Whoever is ahead carries the difference as a number at the inner end of their
 * own group — the usual pawn 1, knight and bishop 3, rook 5, queen 9.
 */
export default function CapturedBar({
  captures,
  orientation,
  pieceTint,
  attacks,
}: CapturedBarProps) {
  const mine: Color = orientation === "white" ? "w" : "b";
  const theirs: Color = mine === "w" ? "b" : "w";
  // Positive when the near player is ahead. Shown against whoever leads, and
  // against neither when the two have taken as much as each other.
  const lead = materialTaken(captures, mine) - materialTaken(captures, theirs);

  return (
    <MenBar
      kind="men-bar-captured"
      label="Taken pieces"
      title={
        "Pieces captured so far: yours along the bottom, your opponent's along the top. " +
        "The number is how far ahead in material whoever carries it is, " +
        "counting pawn 1, knight 3, bishop 3, rook 5, queen 9."
      }
      struck
      /* Above: what the opponent has taken, which is your own army. */
      top={{
        counted: taken(captures, theirs, "up"),
        army: mine,
        side: "me",
        lead: lead < 0 ? -lead : null,
        intro: "Your opponent has taken",
      }}
      /* Below: what you have taken, which is theirs. */
      bottom={{
        counted: taken(captures, mine, "down"),
        army: theirs,
        side: "opponent",
        lead: lead > 0 ? lead : null,
        intro: "You have taken",
      }}
      pieceTint={pieceTint}
      attacks={attacks}
    />
  );
}
