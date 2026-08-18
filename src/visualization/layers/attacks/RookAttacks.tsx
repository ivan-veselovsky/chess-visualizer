import { rookAttackAxes } from "../../../chess/attacks";
import RayStripes from "./RayStripes";
import type { PieceAttackProps } from "./types";

/** Two stripes along the grid, drawn as a double stripe by default. */
export default function RookAttacks({
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
      axes={rookAttackAxes(
        position,
        piece.square,
        attackOptions.decayPerBlocker
      )}
      stripeClass="attack-stripe attack-rook"
      stripe={geometry.rookStripe}
      innerSquare={attackOptions.rayInnerSquare}
      startCornerRadius={attackOptions.rayStartCornerRadius}
      fullWidth={attackOptions.fullWidthRays}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
