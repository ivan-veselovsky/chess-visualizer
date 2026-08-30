import { rookAttackAxes } from "../../../chess/attacks";
import { innerSquares } from "./innerSquares";
import RayStripes from "./RayStripes";
import type { PieceAttackProps } from "./types";

/** Two stripes along the grid, drawn as a double stripe by default. */
export default function RookAttacks({
  position,
  piece,
  idPrefix,
  orientation,
  attackSettings,
  geometry,
}: PieceAttackProps) {
  return (
    <RayStripes
      origin={piece.square}
      axes={rookAttackAxes(
        position,
        piece.square,
        attackSettings.xRayDecayFactor
      )}
      stripeClass="attack-stripe attack-rook"
      stripe={geometry.rookRay}
      innerSquares={innerSquares(geometry)}
      fullWidth={attackSettings.fullWidthDiagonalRays}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
