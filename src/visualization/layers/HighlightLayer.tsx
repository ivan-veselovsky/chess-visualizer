import type { Square } from "chess.js";
import { fileIndex, rankIndex } from "../../chess/model";
import {
  isLightSquare,
  SQUARE_SIZE,
  squareCenter,
  type Orientation,
} from "../geometry";

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
  /**
   * Mark the squares with the colour of the other kind of square instead —
   * dark on a light square, light on a dark one — and leave the wash alone.
   */
  negative: boolean;
  /** Across, in squares — the same measure the pin ring and check disc take. */
  diameter: number;
  /** What the negative circle measures instead, when that is what is drawn. */
  negativeDiameter: number;
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
  negative,
  diameter,
  negativeDiameter,
  orientation = "white",
}: HighlightLayerProps) {
  const strength = negative ? 1 : Math.min(Math.max(opacity, 0), 1);
  const across = negative ? negativeDiameter : diameter;
  const radius = (Math.max(across, 0) * SQUARE_SIZE) / 2;
  if (squares.length === 0 || strength === 0 || radius === 0) {
    return null;
  }

  return (
    <g
      className="highlight-layer"
      fill={negative ? undefined : color}
      fillOpacity={strength}
    >
      {squares.map((square) => {
        const { x, y } = squareCenter(square, orientation);
        /*
          The other kind of square's colour, taken from the board's own two
          rather than from a setting of its own: the mark is the board's
          colours turned round, so it follows them wherever they are set to.

          A square's colour is the square's own, not the screen's — flipping
          the board turns e4 upside down but does not make it a dark square —
          so this asks about the square and not about where it is drawn.
        */
        const light = isLightSquare(fileIndex(square), rankIndex(square));
        return (
          <circle
            key={square}
            cx={x}
            cy={y}
            r={radius}
            className={
              negative ? (light ? "square-dark" : "square-light") : undefined
            }
          />
        );
      })}
    </g>
  );
}
