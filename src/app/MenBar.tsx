import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Color, PieceSymbol } from "chess.js";
import { PIECE_GLYPHS } from "../chess/model";
import type { AttackSettings, PieceTint } from "../visualization/settings";
import { pieceVars } from "../visualization/pieceVars";

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

/** How many of one kind, in the order they are to be drawn. */
export interface ManCount {
  type: PieceSymbol;
  count: number;
}

/** One army's half of a bar: what to draw, whose it is, and how it is read out. */
export interface MenGroup {
  /**
   * The kinds and their counts, already in the order they hang — the group at
   * the top of the bar runs up to its queen, the one at the foot down from
   * hers, so the heavy men of both meet in the middle.
   */
  counted: ManCount[];
  /** Whose men these are: white are drawn light, black dark. */
  army: Color;
  /**
   * Which end of the board the army belongs to, which is what picks its
   * palette. It tracks `army` — the near player's men are always `"me"` — and
   * is passed rather than derived so the two never drift apart.
   */
  side: "me" | "opponent";
  /** How far this army is ahead, when it is; nothing when it is not. */
  lead: number | null;
  /** What a screen reader is told these are, e.g. "You have taken". */
  intro: string;
}

interface MenBarProps {
  /** A class of its own beside `men-bar`, for whatever is peculiar to this bar. */
  kind: string;
  label: string;
  title: string;
  /**
   * Whether each man is scored through — which is what tells a man who is off
   * the board from one who is still on it, the two bars being otherwise the
   * same picture.
   */
  struck: boolean;
  /** The army along the top of the bar, and the one along its foot. */
  top: MenGroup;
  bottom: MenGroup;
  pieceTint: PieceTint;
  attacks: AttackSettings;
}

/**
 * One army's men, stacked from the middle of the bar outwards.
 *
 * Repeats of a kind overlap. A side can hold fifteen men, and fifteen laid end
 * to end are taller than half a board; overlapping only within a kind keeps the
 * kinds themselves apart, so what is a stack of pawns still reads as one.
 */
function MenGroupColumn({
  group,
  struck,
  leadFirst,
}: {
  group: MenGroup;
  struck: boolean;
  /** Whether the count goes above the men or below, to keep it in the middle. */
  leadFirst: boolean;
}) {
  const { counted, army, side, lead, intro } = group;
  const spoken = counted
    .map(({ type, count }) => `${count} ${NAMES[type][count === 1 ? 0 : 1]}`)
    .join(", ");

  const count =
    lead === null ? null : (
      // No title of its own: hovering it should say what the bar says.
      <span className="men-bar-lead">+{lead}</span>
    );

  return (
    <div className="men-bar-group">
      <span className="visually-hidden">
        {intro}: {spoken === "" ? "nothing" : spoken}
        {lead === null ? "" : `, ahead by ${lead}`}
      </span>
      {leadFirst && count}
      {counted.map(({ type, count: howMany }) => (
        <div className="men-bar-run" key={type}>
          {Array.from({ length: howMany }, (_, index) => (
            <svg
              key={index}
              className="men-bar-piece"
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
              {/*
                And scored through, on the bar that holds men who are gone.

                One grey for every man, whichever army he was: the score says
                he is off the board, which is not a thing that differs between
                the two sides, and a line that took its colour from the man
                would have the reader reading it as though it did.

                Turned with him, so it is written across the man rather than
                across his box: the stroke runs from the foot of a piece
                standing up to the far side of his crown, which is what a man
                on his side makes a line leaning the other way. Saying it in
                his own frame is what keeps it that way — the rotation is
                stated once, here and on the glyph, and neither has to know
                which way round the other ended up.

                It crosses at `y=32` because that is where the glyph itself is
                anchored, and it is where the ink is: measured in this font, a
                man's ink runs from 13 to 49.5 of the 64, whose middle is
                31.25 — three quarters of a unit out, which is less than a
                pixel at any size the bar is drawn at.
              */}
              {struck && (
                <line
                  x1={12}
                  y1={52}
                  x2={52}
                  y2={12}
                  transform="rotate(90 32 32)"
                  className="men-bar-strike"
                />
              )}
            </svg>
          ))}
        </div>
      ))}
      {!leadFirst && count}
    </div>
  );
}

/**
 * A column of men beside the board, an army hanging from each end.
 *
 * The machinery both bars are: the fitting, the stacking, the palette, and the
 * count of who is ahead at the inner end of whoever's it is. What differs
 * between a bar of men taken and a bar of men left is which men are counted and
 * whether they are scored through, and both of those arrive as props — so the
 * two bars cannot fall out of step with each other, and a change to how a bar
 * behaves is made once.
 *
 * The men are drawn from the same glyphs and the same palette the board uses,
 * lying on their sides and smaller, so a man beside the board is recognisably
 * one who was standing on it.
 */
export default function MenBar({
  kind,
  label,
  title,
  struck,
  top,
  bottom,
  pieceTint,
  attacks,
}: MenBarProps) {
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
    const joins = [...box.querySelectorAll(".men-bar-run")].reduce(
      (total, run) => total + Math.max(run.childElementCount - 1, 0),
      0
    );
    if (joins === 0) {
      setFitted({ overlap: OVERLAP_EM.least, size: SIZE_EM.full });
      return;
    }
    const men = box.querySelectorAll(".men-bar-piece").length;
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

    What is watched for a change of men is the counts themselves, written out:
    the arrays are built afresh on every render, so the objects are never the
    same twice and only their content can say whether anything moved.
  */
  const held = JSON.stringify([top.counted, bottom.counted]);
  useLayoutEffect(() => {
    fit();
    const box = column.current;
    if (box === null || typeof ResizeObserver === "undefined") {
      return;
    }
    const watch = new ResizeObserver(fit);
    watch.observe(box);
    return () => watch.disconnect();
  }, [fit, held]);

  return (
    <aside
      className={`men-bar ${kind}`}
      aria-label={label}
      title={title}
      style={{
        ...pieceVars(pieceTint, attacks),
        "--men-bar-overlap": `${fitted.overlap}em`,
        "--men-bar-size": `${fitted.size}em`,
      } as CSSProperties}
    >
      {/* The board's own height, less the strip of coordinates along its foot,
          so the two groups sit against the board's own top and bottom edges. */}
      <div className="men-bar-column" ref={column}>
        <MenGroupColumn group={top} struck={struck} leadFirst={false} />
        <MenGroupColumn group={bottom} struck={struck} leadFirst />
      </div>
    </aside>
  );
}
