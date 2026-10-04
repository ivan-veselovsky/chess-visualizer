import type { Color, PieceSymbol } from "chess.js";
import { SQUARE_SIZE, type SettingsSide } from "./geometry";
import type { GlyphSet } from "./glyphs";

interface PieceGlyphProps {
  set: GlyphSet;
  type: PieceSymbol;
  color: Color;
  /** Whose palette he is tinted from: the near end's or the far one's. */
  side: SettingsSide;
  /**
   * Inside a drawing: the middle of where he stands, in its units, and he is a
   * square of the board across. Left out on a page, where the stylesheet gives
   * him the box he fills.
   */
  at?: { x: number; y: number };
  className?: string;
}

/**
 * One man, drawn from the chosen set's picture of his kind.
 *
 * An `<svg>` of the picture's own, in a drawing or on a page alike, so a set's
 * pictures can be drawn in whatever units they were made in and still fill
 * exactly one square. It carries the classes the stylesheet tints a man by —
 * his kind for the attack colour, his army for lightening or darkening it, his
 * end for which palette that colour comes from — and what the picture draws
 * with no fill of its own inherits the tint.
 *
 * The outline is said here rather than in the stylesheet: it is 1.2 of the
 * board's 64-unit square, and a picture made in other units needs it scaled
 * into them to come out the same.
 *
 * The set's correction is made by looking at the picture from that much the
 * other way — its viewBox moved, not the picture — so it holds wherever a man
 * is drawn, on a square, on a bar where he lies on his side, or in the air.
 */
export default function PieceGlyph({ set, type, color, side, at, className }: PieceGlyphProps) {
  const { viewBox: [left, top, width, height], body } = set.pieces[type];
  const viewBox = [left - set.shift.x * width, top - set.shift.y * height, width, height];
  const placed =
    at === undefined
      ? {}
      : { x: at.x - SQUARE_SIZE / 2, y: at.y - SQUARE_SIZE / 2, width: SQUARE_SIZE, height: SQUARE_SIZE };
  return (
    <svg
      {...placed}
      viewBox={viewBox.join(" ")}
      /* As an attribute rather than a rule: a picture whose ink reaches past
         its square is drawn whole, and the GIF's copy of the board, which has
         no stylesheet, says the same. */
      overflow="visible"
      aria-hidden="true"
      className={[
        "piece",
        `piece-${type}`,
        color === "w" ? "piece-white" : "piece-black",
        `piece-${side}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <g
        style={{ strokeWidth: (1.2 * viewBox[2]) / SQUARE_SIZE }}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </svg>
  );
}
