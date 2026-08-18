import type { Square } from "chess.js";
import { PIECE_GLYPHS, type PlacedPiece } from "../../chess/model";
import { squareCenter, type Orientation } from "../geometry";

interface PieceLayerProps {
  pieces: PlacedPiece[];
  /** Square whose piece is being dragged, and so drawn under the pointer. */
  lifted?: Square | null;
  orientation?: Orientation;
}

/**
 * Draws every piece as a Unicode glyph centred on its square.
 *
 * The glyph carries a class per piece kind as well as per side, so the
 * stylesheet can tint each piece with the colour its attacks are drawn in.
 */
export default function PieceLayer({
  pieces,
  lifted = null,
  orientation = "white",
}: PieceLayerProps) {
  return (
    <g className="piece-layer">
      {pieces.map((piece) => {
        if (piece.square === lifted) {
          return null;
        }
        const { x, y } = squareCenter(piece.square, orientation);
        return (
          <text
            key={piece.square}
            x={x}
            y={y}
            className={[
              "piece",
              `piece-${piece.type}`,
              piece.color === "w" ? "piece-white" : "piece-black",
            ].join(" ")}
          >
            {PIECE_GLYPHS[piece.type]}
          </text>
        );
      })}
    </g>
  );
}
