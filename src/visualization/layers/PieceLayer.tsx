import { PIECE_GLYPHS, type PlacedPiece } from "../../chess/model";
import { squareCenter, type Orientation } from "../geometry";

interface PieceLayerProps {
  pieces: PlacedPiece[];
  orientation?: Orientation;
}

/** Draws every piece as a Unicode glyph centred on its square. */
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
            className={piece.color === "w" ? "piece piece-white" : "piece piece-black"}
          >
            {PIECE_GLYPHS[piece.type]}
          </text>
        );
      })}
    </g>
  );
}
