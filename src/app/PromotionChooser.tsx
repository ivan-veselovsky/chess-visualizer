import { useEffect, useLayoutEffect, useRef } from "react";
import type { Color } from "chess.js";
import type { PromotionPiece } from "../chess/moves";
import type { GlyphSet } from "../visualization/glyphs";
import PieceGlyph from "../visualization/PieceGlyph";

/** How close it is let come to the square's edge, and to the window's. */
const GAP = 4;

/** The smallest a piece in it is made, to fit a narrow strip: still big enough to hit. */
const SMALLEST = 26;

const CHOICES: { piece: PromotionPiece; name: string }[] = [
  { piece: "q", name: "Queen" },
  { piece: "r", name: "Rook" },
  { piece: "b", name: "Bishop" },
  { piece: "n", name: "Knight" },
];

interface PromotionChooserProps {
  /** Whose pawn it is, which is the colour the pieces are drawn in. */
  color: Color;
  /** Where the square the pawn is reaching is on the screen, on the board it was played on. */
  square: () => DOMRect | null;
  /** Whether that square is at the top of the board as it is drawn, or at the bottom. */
  at: "top" | "bottom";
  onChoose: (piece: PromotionPiece) => void;
  onCancel: () => void;
  /** The pictures the pieces are drawn with, as the board draws them. */
  glyphs: GlyphSet;
}

/**
 * What a pawn reaching the last rank becomes, asked of the reader: the four
 * pieces in a row, the queen first, in the colour of the side promoting.
 *
 * Nearly always a queen, and once in a while — a knight's check, a bishop or a
 * rook to avoid stalemate — not, which is the move a task is set for. So it is
 * asked every time rather than assumed, and answered with one click.
 *
 * At the square the pawn is reaching, centred on it, and just off the board
 * there — over its edge for a pawn reaching the top, under it for one reaching
 * the bottom — so the eye goes from the pawn to the choice without crossing
 * the board, and the board stays in view. The pieces are made smaller where
 * the window leaves only a narrow strip there, rather than the chooser coming
 * over the board.
 *
 * Nothing else on the page answers while it is open. A press anywhere else
 * takes the move back, and goes no further: a board that took it would pick a
 * piece up under an open question, which reads as two moves at once. Escape
 * takes it back too, for the keyboard. In the page's top layer, so no panel
 * clips it, and placed again as the page scrolls.
 */
export default function PromotionChooser({ color, square, at: end, onChoose, onCancel, glyphs }: PromotionChooserProps) {
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  function place() {
    const help = box.current;
    const target = square();
    if (help === null || target === null) {
      return;
    }
    const room = { width: window.innerWidth, height: window.innerHeight };
    /* At its own size to begin with; made smaller where the strip is narrow. */
    help.style.removeProperty("--choice");
    let { width, height } = help.getBoundingClientRect();
    const space = end === "top" ? target.top - 2 * GAP : room.height - target.bottom - 2 * GAP;
    if (height > space) {
      const piece = help.querySelector(".promotion-choice")?.getBoundingClientRect().height ?? height;
      help.style.setProperty("--choice", `${Math.max(SMALLEST, piece - (height - space))}px`);
      ({ width, height } = help.getBoundingClientRect());
    }
    const left = Math.min(Math.max(GAP, target.left + target.width / 2 - width / 2), room.width - GAP - width);
    const top =
      end === "top"
        ? Math.max(GAP, target.top - GAP - height)
        : Math.min(target.bottom + GAP, room.height - GAP - height);
    help.style.left = `${Math.round(left)}px`;
    help.style.top = `${Math.round(top)}px`;
  }

  useLayoutEffect(() => {
    const help = box.current;
    if (help === null) {
      return;
    }
    help.showPopover();
    place();
    first.current?.focus();
    return () => {
      if (help.matches(":popover-open")) {
        help.hidePopover();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shown once, on arrival.
  }, []);

  useEffect(() => {
    const follow = () => place();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    /*
      A press outside takes the move back and is kept from everything under
      it — and so are the mouse events and the click that follow it, which the
      browser sends after the chooser has gone: caught for this one press, at
      the window, before anything else on the page sees them.
    */
    const outside = (event: PointerEvent) => {
      if (box.current?.contains(event.target as Node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const swallow = (later: Event) => {
        later.preventDefault();
        later.stopPropagation();
      };
      const kinds = ["mousedown", "mouseup", "click", "pointerup", "contextmenu"] as const;
      for (const kind of kinds) {
        window.addEventListener(kind, swallow, { capture: true });
      }
      /* Until the press is over: what the browser sends for it comes in the
         same turn as its release, and nothing after that is this press's. */
      const release = () => {
        window.removeEventListener("pointerup", release, { capture: true });
        window.removeEventListener("pointercancel", release, { capture: true });
        setTimeout(() => {
          for (const kind of kinds) {
            window.removeEventListener(kind, swallow, { capture: true });
          }
        }, 0);
      };
      window.addEventListener("pointerup", release, { capture: true });
      window.addEventListener("pointercancel", release, { capture: true });
      onCancel();
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    window.addEventListener("keydown", escape);
    window.addEventListener("pointerdown", outside, { capture: true });
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("pointerdown", outside, { capture: true });
    };
  });

  return (
    <div
      ref={box}
      popover="manual"
      role="dialog"
      aria-label="Promote the pawn to"
      className="promotion-chooser"
    >
      {CHOICES.map(({ piece, name }, index) => (
        <button
          key={piece}
          ref={index === 0 ? first : undefined}
          type="button"
          className={`promotion-choice promotion-${color === "w" ? "white" : "black"}`}
          aria-label={name}
          title={name}
          onClick={() => onChoose(piece)}
        >
          {/* Not tinted as the board's men are, but plain white or black —
              see `.promotion-choice`; which end's palette is then nothing to
              it. */}
          <PieceGlyph set={glyphs} type={piece} color={color} side="me" />
        </button>
      ))}
    </div>
  );
}
