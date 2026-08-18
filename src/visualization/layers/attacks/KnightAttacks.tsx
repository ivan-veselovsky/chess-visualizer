import { knightAttackedSquares } from "../../../chess/attacks";
import {
  SQUARE_SIZE,
  squareBox,
  squareCenter,
} from "../../geometry";
import { stripeBands } from "./bands";
import type { PieceAttackProps } from "./types";

/**
 * A ring bounded by two circles centred on the knight, clipped to the eight
 * squares it attacks so nothing shows on the squares in between or off board.
 *
 * The annulus is drawn as a single stroked circle: the stroke runs along the
 * mid-radius and its width spans the gap between the two bounding circles,
 * which avoids an even-odd two-subpath fill.
 */
export default function KnightAttacks({
  piece,
  idPrefix,
  orientation,
  geometry,
}: PieceAttackProps) {
  const clipId = `${idPrefix}-ring`;
  const { innerRadius, outerRadius, gap } = geometry.knightRing;

  // Tolerate the two radii being given the wrong way round.
  const inner = Math.min(innerRadius, outerRadius);
  const outer = Math.max(innerRadius, outerRadius);

  // The ring is a stripe bent into a circle: its thickness is the outer width
  // and the gap down its middle the inner one, so the same rule that doubles a
  // ray's stripe doubles this ring. Each band's offset is then radial.
  const bands = stripeBands({ outerWidth: outer - inner, innerWidth: gap });
  if (bands.length === 0) {
    return null;
  }
  const midRadius = ((inner + outer) / 2) * SQUARE_SIZE;
  const { x, y } = squareCenter(piece.square, orientation);

  return (
    <g>
      <clipPath id={clipId}>
        {knightAttackedSquares(piece.square).map((target) => (
          <rect key={target} {...squareBox(target, orientation)} />
        ))}
      </clipPath>
      {bands.map((band, index) => {
        const radius = midRadius + band.offset;
        // A gap wider than the ring would push a band through the centre.
        return radius <= 0 ? null : (
          <circle
            key={index}
            cx={x}
            cy={y}
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
