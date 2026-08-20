import { bishopAttackAxes } from "../../../chess/attacks";
import { innerSquares } from "./innerSquares";
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
      innerSquares={innerSquares(geometry)}
      fullWidth={attackOptions.fullWidthDiagonalRays}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
