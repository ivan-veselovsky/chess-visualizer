import { kingAttackedSquares } from "../../../chess/attacks";
import {
  ATTACK_BASE_OPACITY,
  SQUARE_SIZE,
  kingAttackRingPath,
  squareBox,
} from "../../geometry";
import type { PieceAttackProps } from "./types";

/**
 * The eight neighbouring squares as one rounded-square stripe, clipped to the
 * squares actually attacked so a king on an edge gets the ring trimmed at the
 * board boundary instead of hanging over squares that do not exist.
 */
export default function KingAttacks({
  piece,
  idPrefix,
  orientation,
  attackOptions,
}: PieceAttackProps) {
  const clipId = `${idPrefix}-ring`;
  const width = Math.max(attackOptions.kingStripeWidth, 0) * SQUARE_SIZE;
  if (width === 0) {
    return null;
  }

  return (
    <g>
      <clipPath id={clipId}>
        {kingAttackedSquares(piece.square).map((target) => (
          <rect key={target} {...squareBox(target, orientation)} />
        ))}
      </clipPath>
      <path
        d={kingAttackRingPath(piece.square, orientation)}
        className="attack-stripe attack-king"
        strokeWidth={width}
        strokeOpacity={ATTACK_BASE_OPACITY}
        clipPath={`url(#${clipId})`}
      />
    </g>
  );
}
