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
  geometry,
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
      stripe={geometry.kingStripe}
      innerSquare={attackOptions.rayInnerSquare}
      startCornerRadius={attackOptions.rayStartCornerRadius}
      fullWidth={attackOptions.fullWidthRays}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
