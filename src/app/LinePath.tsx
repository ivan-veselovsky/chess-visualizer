import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TreeLine } from "../chess/variations";
import { lineLabel, pageAround, pageLine } from "../chess/linePath";
import { figurine, isPieceGlyph } from "../chess/figurine";
import { useFiguresLoaded } from "./useFiguresLoaded";

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
  /** The colours the board marks a check and a mate in: a move's "+" and "#" are written in them. */
  marks: { check: string; mate: string };
  /** The colour each side's pieces are drawn in, in a move: its men's, lightened. */
  pieces: { w: string; b: string };
  /** A move clicked: the board to the position it reached, `ply` moves into the line. */
  onPick?: (ply: number) => void;
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
export default function LinePath({ line, number, of, between, tints, at, marks, pieces, onPick }: LinePathProps) {
  const span = useRef<HTMLSpanElement>(null);
  const [room, setRoom] = useState<{ width: number; font: string } | null>(null);
  useFiguresLoaded();

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

  /* Named among the others where there are others; the one line a game has
     is simply the way it goes. */
  const name = of > 1 ? `Line ${number} of ${of}` : "";
  const whole = lineLabel(line, name, () => true);
  const context = room === null ? null : document.createElement("canvas").getContext("2d");
  /* Paged round the move the board has just played: see `pageLine`. Where the
     page started last time is what keeps it still while that move is in the
     middle of the room; a different line starts afresh. */
  const page = useRef<{ line: string; first: number } | null>(null);
  const which = `${line.entries[line.entries.length - 1]?.fen ?? ""} ${line.moves.join(" ")}`;
  /*
    A page the reader has put the row on: by pressing a move in it, which
    holds the row still under the pointer while the board goes there, or by
    pressing an ellipsis, which turns it — see `pageLine`. For as long as the
    board stays on the move it was on then: a step by the keys, by Play or by
    the buttons lets go of it, and the row follows the board again.
  */
  const [held, setHeld] = useState<{ line: string; at: number; first: number; showingCurrent: boolean } | null>(null);
  const holding = held !== null && held.line === which && held.at === at ? held : null;
  let shown = { label: whole, first: 0, head: name === "" ? "" : `${name}: ` };
  /* What the ellipses turn to: see `pageAround`. Nothing where the line fits. */
  let around: ((move: number) => number) | null = null;
  if (room !== null && context !== null) {
    context.font = room.font;
    const previous = page.current !== null && page.current.line === which ? page.current.first : null;
    /* Less what the frame round the move the board is on adds to it: see
       `.branch-path .move-current`. */
    const frame = 0.2 * parseFloat(room.font.match(/([\d.]+)px/)?.[1] ?? "16");
    /* Measured as it is shown, the pieces drawn: see `figurine`. */
    const measured = (text: string) => context.measureText(figurine(text)).width;
    shown = pageLine(line, name, measured, room.width - frame, at - 1, previous, holding);
    around = (move) => pageAround(line, name, measured, room.width - frame, move);
  }
  const first = shown.first;
  /* How many moves the page shows: where the ellipsis after it picks up. */
  const count = (figurine(shown.label).slice(shown.head.length).match(/\{[^}]*\}|\S+/g) ?? []).filter(
    (piece) => !/^\d+\.(\.\.)?$/.test(piece) && !piece.startsWith("{") && piece !== "…"
  ).length;
  /* A page turned by an ellipsis, with the first move it left off in the middle. */
  const turn = (move: number) => {
    if (around !== null) {
      setHeld({ line: which, at, first: around(move), showingCurrent: false });
    }
  };
  useLayoutEffect(() => {
    page.current = { line: which, first };
  });

  const style = {
    "--line-check": marks.check,
    "--line-mate": marks.mate,
    "--line-piece-w": pieces.w,
    "--line-piece-b": pieces.b,
    ...(tints.w === null ? {} : { "--move-white-c": tints.w.c, "--move-white-h": tints.w.h }),
    ...(tints.b === null ? {} : { "--move-black-c": tints.b.c, "--move-black-h": tints.b.h }),
  } as CSSProperties;

  return (
    <span ref={span} className="branch-path" title={whole} style={style}>
      {coloured(
        figurine(shown.label),
        shown.head,
        tints,
        at - 1 - shown.first,
        (index) => {
          /* The board to that move, the row held where it is: see `held`. */
          setHeld({ line: which, at: shown.first + index + 1, first: shown.first, showingCurrent: true });
          onPick?.(shown.first + index + 1);
        },
        () => turn(shown.first - 1),
        () => turn(shown.first + count)
      )}
    </span>
  );
}

/**
 * A label with its parts set apart for colour: the move numbers — "1.",
 * "5..." — in the page's livery, so the moves read as a game's moves rather
 * than a run of words; and each side's moves tinted with the colour its men
 * are drawn in, so whose move is whose is seen without counting.
 *
 * Read off the label as `pageLine` writes it: after its `head` — the line's
 * name, and the ellipsis where its front is left off — a number says whose
 * move follows — "5." White's, "5..." Black's — and the moves after it take
 * turns. What the file calls a line, in braces, is neither, and keeps the
 * text's colour; nor is the ellipsis at the end where its end is left off.
 *
 * And the move the board has just played underlined: `current` is where it
 * stands among the moves the label shows, from 0, which `pageLine` keeps in
 * it. At the line's first position no move has been played, and it is below 0.
 *
 * A move pressed is `pick`ed; an ellipsis pressed turns the page — `back` the
 * one before the moves shown, `on` the one after.
 */
function coloured(
  label: string,
  head: string,
  tints: LinePathProps["tints"],
  current: number,
  pick: (index: number) => void,
  back: () => void,
  on: () => void
): ReactNode[] {
  const more = (key: string, title: string, turn: () => void) => (
    <span key={key} className="line-more" title={title} onClick={turn}>
      …
    </span>
  );
  const parts: ReactNode[] =
    head.endsWith("… ") ? [head.slice(0, -2), more("back", "Earlier moves", back), " "] : [head];
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
    } else if (piece === "…") {
      parts.push(more(`on-${index}`, "Later moves", on));
    } else if (piece.startsWith("{")) {
      /* What the file says about a move, without the braces PGN keeps it in:
         those are for the file's reader, not this one. Set apart by its slant
         instead, so it is not read as moves. */
      parts.push(
        <span key={index} className="move-comment">
          {piece.replace(/^\{\s*|\s*\}$/g, "")}
        </span>
      );
    } else if (/^\s+$/.test(piece)) {
      parts.push(piece);
    } else {
      const classes = [
        "move-pick",
        tints[side] === null ? null : side === "w" ? "move-white" : "move-black",
        moveIndex === current ? "move-current" : null,
      ].filter((name) => name !== null);
      /* Pressed, the board goes to where this move left it. */
      const which = moveIndex;
      parts.push(
        <span key={index} className={classes.join(" ")} onClick={() => pick(which)}>
          {marked(piece, side)}
        </span>
      );
      side = side === "w" ? "b" : "w";
      moveIndex += 1;
    }
  }
  return parts;
}

/**
 * A move with the signs in it set apart: the piece, drawn — see `figurine` —
 * in its side's colour, lightened; the "x" of a capture in the page's livery,
 * as the move numbers are; and a "+" or a "#" at its end in the colour the
 * board marks a check or a mate in — so who moved what, a capture, a check
 * and a mate are seen in the line without reading it.
 */
function marked(move: string, side: "w" | "b"): ReactNode[] {
  return (move.match(/[♚♛♜♝♞]|x|[+#]$|[^x+#♚♛♜♝♞]+|[+#]/g) ?? [move]).map((part, index) => {
    const kind = isPieceGlyph(part)
      ? `move-piece move-piece-${side}`
      : part === "x" ? "move-capture" : part === "+" ? "move-check" : part === "#" ? "move-mate" : null;
    return kind === null ? (
      part
    ) : (
      <span key={index} className={kind}>
        {part}
      </span>
    );
  });
}
