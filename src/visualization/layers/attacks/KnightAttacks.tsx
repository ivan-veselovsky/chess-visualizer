import { knightAttackedSquares } from "../../../chess/attacks";
import {
  SQUARE_SIZE,
  ringSectorInsideRect,
  sectorPath,
  squareBox,
  squareCenter,
} from "../../geometry";
import { stripeBands } from "./bands";
import type { PieceAttackProps } from "./types";

/**
 * A ring bounded by two circles centred on the knight, shown on the eight
 * squares it attacks and nowhere else.
 *
 * The annulus is drawn as a single stroked circle: the stroke runs along the
 * mid-radius and its width spans the gap between the two bounding circles,
 * which avoids an even-odd two-subpath fill.
 *
 * Each square shows the widest piece of that ring which fits inside it whole,
 * cut at both ends along a radius from the knight. Cutting on the square's own
 * sides instead would leave the ring tapering into the corners it clips, an end
 * that says more about the square's geometry than about the knight's reach; a
 * radial cut keeps the piece the same thickness all the way to both ends.
 */
export default function KnightAttacks({
  piece,
  idPrefix,
  orientation,
  geometry,
}: PieceAttackProps) {
  const clipId = `${idPrefix}-ring`;
  const { innerRadius, outerRadius, gapWidth } = geometry.knightRing;

  // Tolerate the two radii being given the wrong way round.
  const inner = Math.min(innerRadius, outerRadius) * SQUARE_SIZE;
  const outer = Math.max(innerRadius, outerRadius) * SQUARE_SIZE;

  // The ring is a stripe bent into a circle: its thickness is the outer width
  // and the gap down its middle the inner one, so the same rule that doubles a
  // ray's stripe doubles this ring. Each band's offset is then radial.
  const bands = stripeBands({ rayWidth: (outer - inner) / SQUARE_SIZE, gapWidth });
  if (bands.length === 0) {
    return null;
  }
  const midRadius = (inner + outer) / 2;
  const center = squareCenter(piece.square, orientation);

  // Out past the ring, so the sector's own rim never cuts anything short.
  const sectorRadius = outer + SQUARE_SIZE;
  const sectors = knightAttackedSquares(piece.square)
    .map((target) => {
      const span = ringSectorInsideRect(
        center,
        inner,
        outer,
        squareBox(target, orientation)
      );
      return span === null
        ? null
        : { target, d: sectorPath(center, span[0], span[1], sectorRadius) };
    })
    .filter((sector) => sector !== null);

  if (sectors.length === 0) {
    return null;
  }

  return (
    <g>
      <clipPath id={clipId}>
        {sectors.map(({ target, d }) => (
          <path key={target} d={d} />
        ))}
      </clipPath>
      {bands.map((band, index) => {
        const radius = midRadius + band.offset;
        // A gap wider than the ring would push a band through the centre.
        return radius <= 0 ? null : (
          <circle
            key={index}
            cx={center.x}
            cy={center.y}
            r={radius}
            className="attack-stripe attack-knight"
            strokeWidth={band.width}
            clipPath={`url(#${clipId})`}
          />
        );
      })}
    </g>
  );
}
