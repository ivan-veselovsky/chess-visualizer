import { useId } from "react";
import {
  FILES,
  RANKS,
  SQUARE_SIZE,
  isLightSquare,
  squareTopLeft,
  type Orientation,
} from "../geometry";
import type { HedgeLines } from "../settings";

interface HedgeLayerProps {
  hedge: HedgeLines;
  orientation?: Orientation;
}

/**
 * Hatching over the dark squares.
 *
 * One tile, repeated: a single line across a square of the given spacing, so
 * the lines come out that far apart however the tile is turned. Turning the
 * pattern rather than the line is what keeps the spacing true — a line drawn at
 * an angle inside an upright tile would come out closer together than asked
 * for, by the cosine of the angle.
 *
 * The line sits at the middle of its tile rather than the edge, where half its
 * width would be clipped away: a pattern tiles what it is given, and does not
 * carry the clipped half round to the other side.
 */
export default function HedgeLayer({
  hedge,
  orientation = "white",
}: HedgeLayerProps) {
  // useId() yields ids like ":r0:"; the colons are awkward inside url(#...).
  const id = `hedge-${useId().replace(/:/g, "")}`;
  const step = Math.max(hedge.step, 0) * SQUARE_SIZE;
  if (!hedge.show || step <= 0) {
    return null;
  }

  return (
    <g className="hedge-layer">
      <defs>
        <pattern
          id={id}
          patternUnits="userSpaceOnUse"
          width={step}
          height={step}
          /*
            Negated: the screen's y runs downwards, so a positive turn there
            takes a line clockwise and thirty degrees would come out as "\\".
            Measured from the horizontal the way an angle usually is, thirty is
            "/", which is what the setting has to mean.
          */
          patternTransform={`rotate(${-hedge.angle})`}
        >
          <line
            x1={0}
            y1={step / 2}
            x2={step}
            y2={step / 2}
            stroke={hedge.color}
            strokeWidth={1}
            /* A hairline whatever the board is scaled to, rather than a line
               that thickens with it: the hatching is a texture, and a texture
               that grows stops reading as one. */
            vectorEffect="non-scaling-stroke"
          />
          {/*
            The cross, drawn as a second line down the same tile rather than as
            a second pattern turned a right angle. The tile is square and is
            turned as a whole, so a line down it comes out square to the one
            across it, at the same spacing, whatever the angle — and the two
            stay in step because they are the same tile.
          */}
          {hedge.orthogonal && (
            <line
              x1={step / 2}
              y1={0}
              x2={step / 2}
              y2={step}
              stroke={hedge.color}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </pattern>
      </defs>
      {FILES.map((_, file) =>
        RANKS.map((_, rank) => {
          if (isLightSquare(file, rank)) {
            return null;
          }
          const { x, y } = squareTopLeft(file, rank, orientation);
          return (
            <rect
              key={`${file}-${rank}`}
              x={x}
              y={y}
              width={SQUARE_SIZE}
              height={SQUARE_SIZE}
              fill={`url(#${id})`}
              className="hedge-square"
            />
          );
        })
      )}
    </g>
  );
}
