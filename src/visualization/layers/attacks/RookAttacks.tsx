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
        attackOptions.xRayDecayFactor
      )}
      stripeClass="attack-stripe attack-rook"
      stripe={geometry.rookRay}
      innerSquare={attackOptions.rayInnerSquare}
      startCornerRadius={attackOptions.rayInnerSquareCornerRadius}
      fullWidth={attackOptions.fullWidthDiagonalRays}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
