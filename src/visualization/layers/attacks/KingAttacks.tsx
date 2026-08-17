import { kingAttackAxes } from "../../../chess/attacks";
import RayStripes from "./RayStripes";
import type { PieceAttackProps } from "./types";

/**
 * Four stripes crossing at the king, drawn exactly like the queen's — the rays
 * simply stop one square out.
 */
export default function KingAttacks({
  position,
  piece,
  idPrefix,
  orientation,
  attackOptions,
}: PieceAttackProps) {
  return (
    <RayStripes
      origin={piece.square}
      axes={kingAttackAxes(
        position,
        piece.square,
        attackOptions.decayPerBlocker
      )}
      stripeClass="attack-stripe attack-king"
      stripe={attackOptions.kingStripe}
      innerRadius={attackOptions.rayInnerRadius}
      innerSquare={attackOptions.rayInnerSquare}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
