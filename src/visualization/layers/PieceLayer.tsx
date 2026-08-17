import { PIECE_GLYPHS, type PlacedPiece } from "../../chess/model";
import { squareCenter, type Orientation } from "../geometry";

interface PieceLayerProps {
  pieces: PlacedPiece[];
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
  orientation = "white",
}: PieceLayerProps) {
  return (
    <g className="piece-layer">
      {pieces.map((piece) => {
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
