import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
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

/**
 * How much of each man the one before it may cover, at the least and at the
 * most, and how much clear bar to keep between the two armies.
 *
 * The men lie over each other by a fixed amount until they stop fitting, and
 * then by however much they must. Overlapping further is the right thing to
 * give up first: a stack of pawns still reads as a stack of pawns when they
 * lie closer, whereas the alternative — which is what happened before — is
 * that the flex box shrinks them, and men that shrink stop being legible at
 * all while also, on a short enough bar, running the two groups together.
 *
 * The gap is what makes the picture readable: two heaps with clear bar between
 * them are two players' trophies, and two heaps that touch are one heap.
 */
const OVERLAP_EM = { least: 0.35, most: 1.15 };
const GAP_EM = 4;

/**
 * How big a man is, and how small he may be made.
 *
 * Shrinking is the second thing tried and the last thing given up. Once the
 * men lie as close as they are allowed to, the only room left is in the men
 * themselves — but a man shrunk far enough stops being a knight or a bishop
 * and becomes a smudge, so there is a floor, below which the bar simply holds
 * more than it can show.
 */
const SIZE_EM = { full: 1.5, least: 0.85 };

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
  const column = useRef<HTMLDivElement>(null);
  const [fitted, setFitted] = useState({
    overlap: OVERLAP_EM.least,
    size: SIZE_EM.full,
  });

  /**
   * How far the men must lie over each other to leave the gap standing.
   *
   * Worked out from what is on the bar rather than guessed at: the two groups
   * are measured as they are drawn, and the shortfall is divided among the
   * joins that can absorb it — every man after the first of his kind, since
   * kinds are never overlapped into each other.
   *
   * One pass settles it, because the relationship is linear and known: closing
   * each join by a millimetre shortens the column by a millimetre per join. No
   * loop, no search, and nothing that can oscillate.
   */
  const fit = useCallback(() => {
    const box = column.current;
    if (box === null) {
      return;
    }
    const groups = [...box.children].filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    );
    const joins = [...box.querySelectorAll(".captured-run")].reduce(
      (total, run) => total + Math.max(run.childElementCount - 1, 0),
      0
    );
    if (joins === 0) {
      setFitted({ overlap: OVERLAP_EM.least, size: SIZE_EM.full });
      return;
    }
    const men = box.querySelectorAll(".captured-piece").length;
    const em = Number.parseFloat(getComputedStyle(box).fontSize) || 16;
    const taken = groups.reduce((total, group) => total + group.offsetHeight, 0);
    // In ems, so that the answer does not depend on what the page's text size
    // happens to be on this machine.
    const over = (taken + GAP_EM * em - box.clientHeight) / em;

    setFitted((was) => {
      /*
        Closing the joins first. Each one closed by a hair shortens the column
        by a hair, so what is needed divides straight across them.
      */
      const overlap = Math.min(
        Math.max(was.overlap + over / joins, OVERLAP_EM.least),
        OVERLAP_EM.most
      );
      /*
        Whatever the joins could not absorb comes off the men themselves, which
        is the same arithmetic over a different count: every man is shorter, not
        only the ones with a man above them.
      */
      const left = over - (overlap - was.overlap) * joins;
      const size =
        men === 0
          ? SIZE_EM.full
          : Math.min(
              Math.max(was.size - left / men, SIZE_EM.least),
              SIZE_EM.full
            );
      return was.overlap === overlap && was.size === size
        ? was
        : { overlap, size };
    });
  }, []);

  /*
    Re-measured when the bar changes size — a window resized, a panel opened,
    the board given more or less room — and when the men on it change. The
    column is watched rather than the groups: its height is the board's to
    decide, so nothing this does can change it, and there is no loop.
  */
  useLayoutEffect(() => {
    fit();
    const box = column.current;
    if (box === null || typeof ResizeObserver === "undefined") {
      return;
    }
    const watch = new ResizeObserver(fit);
    watch.observe(box);
    return () => watch.disconnect();
  }, [fit, captures]);
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
      style={{
        ...pieceVars(pieceTint, attacks),
        "--captured-overlap": `${fitted.overlap}em`,
        "--captured-size": `${fitted.size}em`,
      } as CSSProperties}
    >
      {/* The board's own height, less the strip of coordinates along its foot,
          so the two groups sit against the board's own top and bottom edges. */}
      <div className="captured-column" ref={column}>
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
