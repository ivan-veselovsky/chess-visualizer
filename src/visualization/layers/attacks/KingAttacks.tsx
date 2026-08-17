import { kingAttackedSquares } from "../../../chess/attacks";
import {
  ATTACK_BASE_OPACITY,
  KING_STRIPE_WIDTH,
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
}: PieceAttackProps) {
  const clipId = `${idPrefix}-ring`;

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
        strokeWidth={KING_STRIPE_WIDTH}
        strokeOpacity={ATTACK_BASE_OPACITY}
        clipPath={`url(#${clipId})`}
      />
    </g>
  );
}
