import type { CSSProperties } from "react";
import type { Chess } from "chess.js";
import { readPieces } from "../chess/model";
import type { BoardColors } from "../app/options";
import { BORDER_SIZE, CANVAS_SIZE, type Orientation } from "./geometry";
import AttackLayer from "./layers/AttackLayer";
import BorderLayer from "./layers/BorderLayer";
import GridLayer from "./layers/GridLayer";
import PieceLayer from "./layers/PieceLayer";
import SquareLayer from "./layers/SquareLayer";

interface BoardProps {
  position: Chess;
  colors: BoardColors;
  showGrid?: boolean;
  orientation?: Orientation;
}

/**
 * Composes the board layers into a single SVG. Every layer works in board
 * coordinates (0..BOARD_SIZE); the outer <g> shifts them inside the border.
 *
 * Colours are published as CSS custom properties on the root <svg> so the
 * layers stay styled from the stylesheet rather than through inline attributes.
 */
export default function Board({
  position,
  colors,
  showGrid = true,
  orientation = "white",
}: BoardProps) {
  const pieces = readPieces(position);

  const themeVars = {
    "--square-light": colors.lightSquare,
    "--square-dark": colors.darkSquare,
  } as CSSProperties;

  return (
    <svg
      className="board"
      style={themeVars}
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      role="img"
      aria-label="Chess board"
    >
      <g transform={`translate(${BORDER_SIZE}, ${BORDER_SIZE})`}>
        <SquareLayer orientation={orientation} />
        {showGrid && <GridLayer />}
        <AttackLayer
          position={position}
          pieces={pieces}
          orientation={orientation}
        />
        <BorderLayer orientation={orientation} />
        <PieceLayer pieces={pieces} orientation={orientation} />
      </g>
    </svg>
  );
}
