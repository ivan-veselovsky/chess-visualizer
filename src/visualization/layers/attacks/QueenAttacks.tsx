import { queenAttackAxes } from "../../../chess/attacks";
import RayStripes from "./RayStripes";
import type { PieceAttackProps } from "./types";

/** Four stripes crossing at the queen — two along the grid, two diagonal. */
export default function QueenAttacks({
  position,
  piece,
  idPrefix,
  orientation,
  attackOptions,
}: PieceAttackProps) {
  return (
    <RayStripes
      origin={piece.square}
      axes={queenAttackAxes(
        position,
        piece.square,
        attackOptions.decayPerBlocker
      )}
      stripeClass="attack-stripe attack-queen"
      stripe={attackOptions.queenStripe}
      innerSquare={attackOptions.rayInnerSquare}
      startCornerRadius={attackOptions.rayStartCornerRadius}
      fullWidth={attackOptions.fullWidthRays}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
