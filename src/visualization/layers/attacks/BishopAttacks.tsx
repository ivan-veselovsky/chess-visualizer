import { bishopAttackAxes } from "../../../chess/attacks";
import RayStripes from "./RayStripes";
import type { PieceAttackProps } from "./types";

/** Two diagonal stripes, drawn as a double stripe by default. */
export default function BishopAttacks({
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
      axes={bishopAttackAxes(
        position,
        piece.square,
        attackOptions.xRayDecayFactor
      )}
      stripeClass="attack-stripe attack-bishop"
      stripe={geometry.bishopRay}
      innerSquare={attackOptions.rayInnerSquare}
      startCornerRadius={attackOptions.rayInnerSquareCornerRadius}
      fullWidth={attackOptions.fullWidthDiagonalRays}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
