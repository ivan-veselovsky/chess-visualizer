import type { Color, PieceSymbol } from "chess.js";
import {
  CAPTURE_ORDER,
  countsFor,
  materialTaken,
  type Capture,
} from "../chess/captures";
import { PIECE_GLYPHS } from "../chess/model";
import type { Orientation } from "../visualization/geometry";
import type { AttackSettings, PieceTint } from "../visualization/settings";
import { pieceVars } from "../visualization/pieceVars";

interface CapturedBarProps {
  captures: Capture[];
  /** Which army is at the bottom of the board, and so whose end is whose. */
  orientation: Orientation;
  pieceTint: PieceTint;
  attacks: AttackSettings;
}

const NAMES: Record<PieceSymbol, [string, string]> = {
  k: ["king", "kings"],
  q: ["queen", "queens"],
  r: ["rook", "rooks"],
  b: ["bishop", "bishops"],
  n: ["knight", "knights"],
  p: ["pawn", "pawns"],
};

/**
 * One army's trophies, stacked from the middle of the bar outwards.
 *
 * `order` decides which end of the bar the group hangs from: the near side
 * reads down from the queen, the far side up to it, so the heavy men are the
 * ones nearest the middle either way and the two groups mirror each other
 * across it.
 *
 * Repeats of a kind overlap. A side can take fifteen men, and fifteen laid end
 * to end are taller than half a board; overlapping only within a kind keeps the
 * kinds themselves apart, so what is a stack of pawns still reads as one.
 */
function CapturedGroup({
  men,
  by,
  order,
  army,
  side,
  lead,
  leadFirst,
}: {
  men: Capture[];
  by: Color;
  order: PieceSymbol[];
  army: Color;
  side: "me" | "opponent";
  /** How far this army is ahead, when it is; nothing when it is not. */
  lead: number | null;
  /** Whether the count goes above the men or below, to keep it in the middle. */
  leadFirst: boolean;
}) {
  const counted = countsFor(men, by);
  const spoken = counted
    .map(({ type, count }) => `${count} ${NAMES[type][count === 1 ? 0 : 1]}`)
    .join(", ");

  const count =
    lead === null ? null : (
      // No title of its own: hovering it should say what the bar says.
      <span className="captured-lead">+{lead}</span>
    );

  return (
    <div className="captured-group">
      <span className="visually-hidden">
        {side === "opponent" ? "You have taken" : "Your opponent has taken"}:{" "}
        {spoken === "" ? "nothing" : spoken}
        {lead === null ? "" : `, ahead by ${lead}`}
      </span>
      {leadFirst && count}
      {order
        .map((type) => counted.find((kind) => kind.type === type))
        .filter((kind) => kind !== undefined)
        .map(({ type, count }) => (
          <div className="captured-run" key={type}>
            {Array.from({ length: count }, (_, index) => (
              <svg
                key={index}
                className="captured-piece"
                viewBox="0 0 64 64"
                aria-hidden="true"
              >
                {/* Turned a quarter clockwise, so the men lie down. */}
                <text
                  x={32}
                  y={32}
                  transform="rotate(90 32 32)"
                  className={[
                    "piece",
                    `piece-${type}`,
                    army === "w" ? "piece-white" : "piece-black",
                    `piece-${side}`,
                  ].join(" ")}
                >
                  {PIECE_GLYPHS[type]}
                </text>
              </svg>
            ))}
          </div>
        ))}
      {!leadFirst && count}
    </div>
  );
}

/**
 * The men taken so far, in a bar the height of the board beside it.
 *
 * Each player's trophies sit at their own end: yours along the bottom, your
 * opponent's along the top, each group ordered so its queen is the piece
 * nearest the middle. Which end is yours follows the board's orientation, as it
 * does everywhere else — flipping the board swaps the two.
 *
 * The men are drawn from the same glyphs and the same palette the board uses,
 * lying on their sides and smaller, so a taken piece is recognisably the one
 * that was standing there.
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
    <aside
      className="captured-bar"
      aria-label="Taken pieces"
      title={
        "Pieces captured so far: yours along the bottom, your opponent's along the top. " +
        "The number is how far ahead in material whoever carries it is, " +
        "counting pawn 1, knight 3, bishop 3, rook 5, queen 9."
      }
      style={pieceVars(pieceTint, attacks)}
    >
      {/* The board's own height, less the strip of coordinates along its foot,
          so the two groups sit against the board's own top and bottom edges. */}
      <div className="captured-column">
        {/* Above: what the opponent has taken, which is your own army. */}
        <CapturedGroup
          men={captures}
          by={theirs}
          order={[...CAPTURE_ORDER].reverse()}
          army={mine}
          side="me"
          lead={lead < 0 ? -lead : null}
          leadFirst={false}
        />
        {/* Below: what you have taken, which is theirs. */}
        <CapturedGroup
          men={captures}
          by={mine}
          order={CAPTURE_ORDER}
          army={theirs}
          side="opponent"
          lead={lead > 0 ? lead : null}
          leadFirst
        />
      </div>
    </aside>
  );
}
