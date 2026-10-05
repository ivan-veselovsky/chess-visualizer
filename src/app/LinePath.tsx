import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TreeLine } from "../chess/variations";
import { fitLine, lineLabel } from "../chess/linePath";

interface LinePathProps {
  line: TreeLine;
  /** Its number among the game's lines, from 1, and how many there are. */
  number: number;
  of: number;
  /**
   * Where it stands: at the start of the row over a board without names,
   * where it has a column of its own to fill, or in the middle of the names'
   * row, between the two names.
   */
  between: boolean;
  /**
   * The hue each side's moves are tinted with — the colour its men are drawn
   * in, at a low chroma (see `moveTint`) — or null for a side whose colour
   * cannot be read, whose moves keep the text's colour.
   */
  tints: { w: { c: number; h: number } | null; b: { c: number; h: number } | null };
  /** How many of the line's moves the board has played: the last of them is underlined. */
  at: number;
}

/**
 * The line on the board, over it: "Line 2 of 3: 1. Rhg7 Ne8 {case B} 2. Ra8#" —
 * the whole way it goes from the first position, as the list of lines says
 * it, and like the list cut short at its front rather than its end where the
 * row has less room than that. See `lineLabel`.
 *
 * Its room is measured rather than left to the row, because the row takes
 * its own measure from it. Over a board without names it is a column of its
 * own, sized by the row, and its width is its room. Between the names it is
 * in a column as wide as what it holds, so the room is worked out from the
 * row instead: the row's width, less the floor each name is kept to (see
 * `.player-name`), the gaps either side of the middle, and whatever else the
 * middle holds — how the line came out. Measured again on every render, and
 * whenever the row is resized; a measure that has not changed changes
 * nothing.
 */
export default function LinePath({ line, number, of, between, tints, at }: LinePathProps) {
  const span = useRef<HTMLSpanElement>(null);
  const [room, setRoom] = useState<{ width: number; font: string } | null>(null);

  const measure = () => {
    const self = span.current;
    if (self === null) {
      return;
    }
    const font = getComputedStyle(self).font;
    let width = self.clientWidth;
    const row = self.closest<HTMLElement>(".player-name");
    const middle = self.parentElement;
    if (between && row !== null && middle !== null) {
      const seen = getComputedStyle(row);
      const inner = row.clientWidth - parseFloat(seen.paddingLeft) - parseFloat(seen.paddingRight);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const floor = Math.min(10 * rem, 0.3 * inner);
      const gap = parseFloat(seen.columnGap) || 0;
      const inside = parseFloat(getComputedStyle(middle).columnGap) || 0;
      let others = 0;
      for (const other of middle.children) {
        if (other !== self) {
          others += other.getBoundingClientRect().width + inside;
        }
      }
      width = inner - 2 * floor - 2 * gap - others;
    }
    setRoom((was) => (was !== null && was.width === width && was.font === font ? was : { width, font }));
  };

  useLayoutEffect(measure);

  useLayoutEffect(() => {
    const watched = between ? span.current?.closest(".player-name") : span.current;
    if (watched == null) {
      return;
    }
    const watching = new ResizeObserver(() => measure());
    watching.observe(watched);
    return () => watching.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `measure` reads
    // the element afresh each time; what is watched only changes with `between`.
  }, [between]);

  const name = `Line ${number} of ${of}`;
  const whole = lineLabel(line, name, () => true);
  const context = room === null ? null : document.createElement("canvas").getContext("2d");
  /* Fitted round the move the board has just played, which stays in it. */
  let shown = { label: whole, first: 0 };
  if (room !== null && context !== null) {
    context.font = room.font;
    shown = fitLine(line, name, (label) => context.measureText(label).width <= room.width, at - 1);
  }

  const style = {
    ...(tints.w === null ? {} : { "--move-white-c": tints.w.c, "--move-white-h": tints.w.h }),
    ...(tints.b === null ? {} : { "--move-black-c": tints.b.c, "--move-black-h": tints.b.h }),
  } as CSSProperties;

  return (
    <span ref={span} className="branch-path" title={whole} style={style}>
      {coloured(shown.label, tints, at - 1 - shown.first)}
    </span>
  );
}

/**
 * A label with its parts set apart for colour: the move numbers — "1.",
 * "5..." — in the page's livery, so the moves read as a game's moves rather
 * than a run of words; and each side's moves tinted with the colour its men
 * are drawn in, so whose move is whose is seen without counting.
 *
 * Read off the label as `lineLabel` writes it: after the line's name, and the
 * ellipsis where its front is left off, a number says whose move follows — "5."
 * White's, "5..." Black's — and the moves after it take turns. What the file
 * calls a line, in braces, is neither, and keeps the text's colour.
 *
 * And the move the board has just played underlined: `current` is where it
 * stands among the moves the label shows, from 0, which `fitLine` keeps in it.
 * At the line's first position no move has been played, and it is below 0.
 */
function coloured(label: string, tints: LinePathProps["tints"], current: number): ReactNode[] {
  const head = /^[^:]*:\s(?:…\s)?/.exec(label)?.[0] ?? "";
  const parts: ReactNode[] = [head];
  let side: "w" | "b" = "w";
  const body = label.slice(head.length);
  const pieces = body.match(/\{[^}]*\}|\S+|\s+/g) ?? [];
  let moveIndex = 0;
  for (const [index, piece] of pieces.entries()) {
    const number = /^(\d+)\.(\.\.)?$/.exec(piece);
    if (number !== null) {
      side = number[2] === undefined ? "w" : "b";
      parts.push(
        <span key={index} className="move-number">
          {piece}
        </span>
      );
    } else if (/^\s+$/.test(piece) || piece.startsWith("{") || piece === "…") {
      parts.push(piece);
    } else {
      const classes = [
        tints[side] === null ? null : side === "w" ? "move-white" : "move-black",
        moveIndex === current ? "move-current" : null,
      ].filter((name) => name !== null);
      parts.push(
        <span key={index} className={classes.length > 0 ? classes.join(" ") : undefined}>
          {piece}
        </span>
      );
      side = side === "w" ? "b" : "w";
      moveIndex += 1;
    }
  }
  return parts;
}
