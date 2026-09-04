import type { Square } from "chess.js";
import { useFading } from "../fading";
import { fileIndex, rankIndex } from "../../chess/model";
import type { LastMoveMark } from "../settings";
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
  /** How to mark them: a wash of a colour, or the squares' colours turned round. */
  mark: LastMoveMark;
  orientation?: Orientation;
  /** How long a spot takes to come and go, in milliseconds. */
  fadeTimeMs?: number;
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
  mark: { color, negative, diameter },
  fadeTimeMs = 0,
  orientation = "white",
}: HighlightLayerProps) {
  /*
    Laid on outright, not washed over.

    Both ways of marking now put a disc of one flat colour on the square: the
    negative one takes the other square's colour, this one takes the colour that
    was chosen. A wash was the older idea — a hue moved towards while the light
    and dark squares still showed through — but it left the mark reading as a
    tint of the square rather than as a thing on it, and the two ways of marking
    behaving differently was the worse half of that.
  */
  const radius = (Math.max(diameter, 0) * SQUARE_SIZE) / 2;
  /* The spots of the move before are kept for the length of a fade, so the
     mark is seen to move from one pair of squares to the next rather than to
     be somewhere else the next time it is looked at. */
  const spots = useFading(
    radius === 0 ? [] : squares,
    (square) => square,
    fadeTimeMs
  );
  if (spots.length === 0) {
    return null;
  }

  return (
    <g
      className="highlight-layer"
      fill={negative ? undefined : color}
    >
      {spots.map(({ key, item: square, leaving }) => {
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
            key={key}
            cx={x}
            cy={y}
            r={radius}
            className={[
              negative ? (light ? "mark-on-light" : "mark-on-dark") : "",
              leaving ? "mark-going" : "mark-coming",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        );
      })}
    </g>
  );
}
