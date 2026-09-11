import { queenAttackAxes } from "../../../chess/attacks";
import { innerSquares } from "./innerSquares";
import RayStripes from "./RayStripes";
import type { PieceAttackProps } from "./types";

/** Four stripes crossing at the queen — two along the grid, two diagonal. */
export default function QueenAttacks({
  position,
  piece,
  idPrefix,
  orientation,
  rays,
  geometry,
}: PieceAttackProps) {
  return (
    <RayStripes
      origin={piece.square}
      axes={queenAttackAxes(
        position,
        piece.square,
        rays.xRayDecayFactor
      )}
      stripeClass="attack-stripe attack-queen"
      stripe={geometry.queenRay}
      innerSquares={innerSquares(geometry)}
      fullWidth={rays.fullWidthDiagonals}
      shape={rays.shape}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
