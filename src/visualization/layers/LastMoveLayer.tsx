import type { Square } from "chess.js";
import { squareBox, type Orientation } from "../geometry";

/** Where the move that reached this position started and finished. */
export interface LastMove {
  from: Square;
  to: Square;
}

interface LastMoveLayerProps {
  move: LastMove | null;
  /** The wash laid over those two squares. */
  color: string;
  /** How much of it, from 0 to 1. Zero draws nothing. */
  opacity: number;
  orientation?: Orientation;
}

/**
 * The two squares of the move just played, washed over with a colour.
 *
 * A colour mixed in rather than a shade taken off: darkening both squares by
 * one factor pulls the light one down towards the dark one's colour, and two
 * squares that no longer read as light and dark say the wrong thing about the
 * board. A wash moves both towards the same hue while the difference between
 * them survives underneath it.
 *
 * Laid over the board and under everything else, so it colours the squares
 * themselves and leaves the marks and pieces on them alone.
 */
export default function LastMoveLayer({
  move,
  color,
  opacity,
  orientation = "white",
}: LastMoveLayerProps) {
  const strength = Math.min(Math.max(opacity, 0), 1);
  if (move === null || strength === 0) {
    return null;
  }

  return (
    <g className="last-move-layer" fill={color} fillOpacity={strength}>
      {[move.from, move.to].map((square) => (
        <rect key={square} {...squareBox(square, orientation)} />
      ))}
    </g>
  );
}
