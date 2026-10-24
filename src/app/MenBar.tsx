import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Color, PieceSymbol } from "chess.js";
import type { AttackSettings, PieceTint } from "../visualization/settings";
import { pieceVars } from "../visualization/pieceVars";
import type { GlyphSet } from "../visualization/glyphs";
import PieceGlyph from "../visualization/PieceGlyph";

/**
 * How much clear bar to keep between the two armies.
 *
 * The gap is what makes the picture readable: two heaps with clear bar between
 * them are two players' trophies, and two heaps that touch are one heap.
 */
const GAP_EM = 4;

/**
 * How big a man is, and how small he may be made.
 *
 * One man of each kind, with how many there are beside him, is at most six
 * men an army, which a bar beside any board holds at their full size. A board
 * short enough is the one case left, and there the men are made smaller to
 * keep the gap — but a man shrunk far enough stops being a knight or a bishop
 * and becomes a smudge, so there is a floor, below which the bar simply holds
 * more than it can show.
 */
const SIZE_EM = { full: 1.5, least: 0.85 };

/**
 * How large a man is drawn in his box, against the size a set draws him at in
 * a square of the board: a little larger, the box being a tally's rather than
 * a square's and the man the thing in it to be told apart. The disc a black
 * man lies on stays the box's own size; only the man grows on it.
 */
const MAN_SCALE = 1.21;

/** A man laid on his side in the middle of his 64-unit box, at `MAN_SCALE`. */
const LYING = `translate(32 32) rotate(90) scale(${MAN_SCALE}) translate(-32 -32)`;

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
  /** The pictures the men are drawn with, as the board draws them. */
  glyphs: GlyphSet;
  attacks: AttackSettings;
}

/**
 * One army's men, stacked from the middle of the bar outwards.
 *
 * One man of each kind, and before him how many of that kind there are,
 * where there is more than one: a number is read at a glance, where a stack of
 * pawns had to be counted, and a side's fifteen men laid end to end were taller
 * than half a board. Written as a row is — "5♟ 2♞ ♛" — and the row turned a
 * quarter clockwise, numbers and men alike, to run down the bar: the numbers
 * above their men, in the bar's own width, rather than beside them in a wider
 * one. See `.men-bar-count`.
 */
function MenGroupColumn({
  group,
  struck,
  leadFirst,
  glyphs,
}: {
  group: MenGroup;
  struck: boolean;
  glyphs: GlyphSet;
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
          {/* Read out with the rest above; only seen here. */}
          {howMany > 1 && (
            <span className="men-bar-count" aria-hidden="true">
              {howMany}
            </span>
          )}
          <svg
            className="men-bar-piece"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
            {/*
              Under each of Black's men, a disc of the page's text colour.
              On the dark page a black man is very nearly the ground he lies
              on; laid on a disc he keeps the colour he has on the board and
              is still seen. The discs of a kind overlap as the men do. Drawn
              by the dark theme only — see `.men-bar-ground` — the light page
              being ground enough for a black man as he is.
            */}
            {army === "b" && <circle cx={32} cy={32} r={29} className="men-bar-ground" />}
            {/* Turned a quarter clockwise, so the men lie down, and drawn a
                little larger than on the board: see `MAN_SCALE`. */}
            <g transform={LYING}>
              <PieceGlyph set={glyphs} type={type} color={army} side={side} at={{ x: 32, y: 32 }} />
            </g>
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

              It crosses at `y=32` because that is the middle of the square
              the man is drawn in, and a set draws him standing in the middle
              of his square: measured in the DejaVu set, a man's ink runs
              from 13 to 49.5 of the 64, whose middle is 31.25 — three
              quarters of a unit out, which is less than a pixel at any size
              the bar is drawn at.
            */}
            {struck && (
              <line
                x1={12}
                y1={52}
                x2={52}
                y2={12}
                transform={LYING}
                className="men-bar-strike"
              />
            )}
          </svg>
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
  glyphs,
  attacks,
}: MenBarProps) {
  const column = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(SIZE_EM.full);

  /**
   * How big the men can be and leave the gap standing.
   *
   * Worked out from what is on the bar rather than guessed at: the two groups
   * are measured as they are drawn, and the shortfall is shared among the men,
   * each made shorter by his share. One pass settles it, the relationship being
   * linear and known: a man a millimetre shorter shortens the column by a
   * millimetre. No loop, no search, and nothing that can oscillate.
   */
  const fit = useCallback(() => {
    const box = column.current;
    if (box === null) {
      return;
    }
    const groups = [...box.children].filter(
      (child): child is HTMLElement => child instanceof HTMLElement
    );
    const men = box.querySelectorAll(".men-bar-piece").length;
    if (men === 0) {
      setSize(SIZE_EM.full);
      return;
    }
    const em = Number.parseFloat(getComputedStyle(box).fontSize) || 16;
    const taken = groups.reduce((total, group) => total + group.offsetHeight, 0);
    // In ems, so that the answer does not depend on what the page's text size
    // happens to be on this machine.
    const over = (taken + GAP_EM * em - box.clientHeight) / em;
    setSize((was) => Math.min(Math.max(was - over / men, SIZE_EM.least), SIZE_EM.full));
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
        "--men-bar-size": `${size}em`,
      } as CSSProperties}
    >
      {/* The board's own height, less the strip of coordinates along its foot,
          so the two groups sit against the board's own top and bottom edges. */}
      <div className="men-bar-column" ref={column}>
        <MenGroupColumn group={top} struck={struck} leadFirst={false} glyphs={glyphs} />
        <MenGroupColumn group={bottom} struck={struck} leadFirst glyphs={glyphs} />
      </div>
    </aside>
  );
}
