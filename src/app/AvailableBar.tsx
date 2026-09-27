import type { Chess, Color } from "chess.js";
import { availableFor, materialOn } from "../chess/available";
import type { Orientation } from "../visualization/geometry";
import type { AttackSettings, PieceTint } from "../visualization/settings";
import MenBar, { type ManCount } from "./MenBar";

interface AvailableBarProps {
  /** The position on the board, which is the whole of what this bar counts. */
  position: Chess;
  /** Which army is at the bottom of the board, and so whose end is whose. */
  orientation: Orientation;
  pieceTint: PieceTint;
  attacks: AttackSettings;
}

/** One army's men, in the order this end of the bar hangs them. */
function standing(
  position: Chess,
  color: Color,
  order: "up" | "down",
): ManCount[] {
  const counted = availableFor(position, color);
  return order === "down" ? counted : [...counted].reverse();
}

/**
 * The men still on the board, in a bar beside the one holding the men who are
 * not.
 *
 * The same picture as the captured bar and read the same way, with two
 * differences. These men are whole rather than scored through, being men who
 * are still there. And each army stands at its own end — yours along the
 * bottom, your opponent's along the top — which is the end each is playing
 * from, so the bar reads as the board's two armies rather than as two players'
 * winnings.
 *
 * What it starts from is the position itself, so the opening picture is the
 * game's own opening set: a game at odds shows the odds, because the board it
 * is counting is already a man short. See `availableFor`, which is also why a
 * promoted pawn shows as the queen he became and moves the count by the 8 the
 * two men differ by.
 *
 * Whoever is ahead carries the difference at the inner end of their own group,
 * by the same values the captured bar counts with.
 */
export default function AvailableBar({
  position,
  orientation,
  pieceTint,
  attacks,
}: AvailableBarProps) {
  const mine: Color = orientation === "white" ? "w" : "b";
  const theirs: Color = mine === "w" ? "b" : "w";
  // Positive when the near player has more standing. Against whoever leads,
  // and against neither when the two armies weigh the same.
  const lead = materialOn(position, mine) - materialOn(position, theirs);

  return (
    <MenBar
      kind="men-bar-available"
      label="Available pieces"
      title={
        "Pieces still on the board: yours along the bottom, your opponent's along the top. " +
        "The number is how far ahead in material whoever carries it is, " +
        "counting pawn 1, knight 3, bishop 3, rook 5, queen 9."
      }
      struck={false}
      /* Above: the far player's army, at the end they are playing from. */
      top={{
        counted: standing(position, theirs, "up"),
        army: theirs,
        side: "opponent",
        lead: lead < 0 ? -lead : null,
        intro: "Your opponent still has",
      }}
      /* Below: your own. */
      bottom={{
        counted: standing(position, mine, "down"),
        army: mine,
        side: "me",
        lead: lead > 0 ? lead : null,
        intro: "You still have",
      }}
      pieceTint={pieceTint}
      attacks={attacks}
    />
  );
}
