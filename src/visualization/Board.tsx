import type { Chess } from "chess.js";
import { readPieces } from "../chess/model";
import {
  BORDER_SIZE,
  CANVAS_SIZE,
  type Orientation,
} from "./geometry";
import BorderLayer from "./layers/BorderLayer";
import PieceLayer from "./layers/PieceLayer";
import SquareLayer from "./layers/SquareLayer";

interface BoardProps {
  position: Chess;
  orientation?: Orientation;
}

/**
 * Composes the board layers into a single SVG. Every layer works in board
 * coordinates (0..BOARD_SIZE); the outer <g> shifts them inside the border.
 */
export default function Board({ position, orientation = "white" }: BoardProps) {
  const pieces = readPieces(position);

  return (
    <svg
      className="board"
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      role="img"
      aria-label="Chess board"
    >
      <g transform={`translate(${BORDER_SIZE}, ${BORDER_SIZE})`}>
        <SquareLayer orientation={orientation} />
        <BorderLayer orientation={orientation} />
        <PieceLayer pieces={pieces} orientation={orientation} />
      </g>
    </svg>
  );
}
