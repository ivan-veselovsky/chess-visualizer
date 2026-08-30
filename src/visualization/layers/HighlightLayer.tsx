import type { Square } from "chess.js";
import { SQUARE_SIZE, squareCenter, type Orientation } from "../geometry";

/** Where the move that reached this position started and finished. */
export interface LastMove {
  from: Square;
  to: Square;
}

interface HighlightLayerProps {
  /** Squares to mark. Repeats are harmless; the same wash is laid down twice. */
  squares: Square[];
  /** The wash laid over them. */
  color: string;
  /** How much of it, from 0 to 1. Zero draws nothing. */
  opacity: number;
  /** Across, in squares — the same measure the pin ring and check disc take. */
  diameter: number;
  orientation?: Orientation;
}

/**
 * The squares worth pointing at: the two the last move used, and the one a
 * piece has been picked out on and not yet moved from.
 *
 * One appearance for both, deliberately. They are the same question asked at
 * two moments — which squares is the move about — and answering it twice over
 * in two styles would suggest two different kinds of thing were going on.
 *
 * A colour mixed in rather than a shade taken off: darkening a square by a
 * factor pulls a light one down towards a dark one's colour, and squares that
 * no longer read as light and dark say the wrong thing about the board. A wash
 * moves them towards one hue while the difference between them survives under
 * it.
 *
 * A disc rather than the whole square, the size a check is marked with. The
 * square is the board's own shape and saying something in it competes with
 * whatever else the square is being used to say — the shading, most of all,
 * which is a colour laid over the whole of it.
 *
 * Laid over the board and under everything else, so it colours the squares
 * themselves and leaves the marks and pieces on them alone.
 */
export default function HighlightLayer({
  squares,
  color,
  opacity,
  diameter,
  orientation = "white",
}: HighlightLayerProps) {
  const strength = Math.min(Math.max(opacity, 0), 1);
  const radius = (Math.max(diameter, 0) * SQUARE_SIZE) / 2;
  if (squares.length === 0 || strength === 0 || radius === 0) {
    return null;
  }

  return (
    <g className="highlight-layer" fill={color} fillOpacity={strength}>
      {squares.map((square) => {
        const { x, y } = squareCenter(square, orientation);
        return <circle key={square} cx={x} cy={y} r={radius} />;
      })}
    </g>
  );
}
