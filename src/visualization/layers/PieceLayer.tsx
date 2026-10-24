import type { Square } from "chess.js";
import type { PlacedPiece } from "../../chess/model";
import { settingsSide, squareCenter, type Orientation } from "../geometry";
import type { GlyphSet } from "../glyphs";
import PieceGlyph from "../PieceGlyph";

interface PieceLayerProps {
  pieces: PlacedPiece[];
  /** Square whose piece is being dragged, and so drawn under the pointer. */
  lifted?: Square | null;
  /** Squares whose piece is in the air, and so is drawn by the flight instead
      of here — it is still on the board, being still in everything's way. */
  flying?: Square[];
  orientation?: Orientation;
  /** The pictures the men are drawn with. */
  glyphs: GlyphSet;
  /** The square of a king that is mated, who is drawn fallen over: see `.piece-fallen`. */
  fallen?: Square | null;
}

/**
 * Draws every piece on its square, as the chosen set pictures his kind.
 *
 * The picture carries a class per piece kind as well as per side, so the
 * stylesheet can tint each piece with the colour its attacks are drawn in.
 */
export default function PieceLayer({
  pieces,
  lifted = null,
  flying = [],
  orientation = "white",
  glyphs,
  fallen = null,
}: PieceLayerProps) {
  return (
    <g className="piece-layer">
      {pieces.map((piece) => {
        if (piece.square === lifted || flying.includes(piece.square)) {
          return null;
        }
        const man = (
          <PieceGlyph
            key={piece.square}
            set={glyphs}
            type={piece.type}
            // Two independent things: the army decides how the man is
            // tinted, the end of the board decides whose palette it draws
            // from.
            color={piece.color}
            side={settingsSide(piece.color, orientation)}
            at={squareCenter(piece.square, orientation)}
          />
        );
        /*
          A king, in a group of his own whether or not he is mated: the group
          is what falls over on a mate — see `.piece-fallen` — and, being the
          same group before and after, what stands up again once the mate is
          taken back, rather than a king drawn upright from nothing.
        */
        return piece.type === "k" ? (
          <g key={piece.square} className={piece.square === fallen ? "piece-king piece-fallen" : "piece-king"}>
            {man}
          </g>
        ) : (
          man
        );
      })}
    </g>
  );
}
