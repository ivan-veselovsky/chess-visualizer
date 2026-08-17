import { queenAttackAxes } from "../../../chess/attacks";
import { QUEEN_STRIPE_WIDTH } from "../../geometry";
import RayStripes from "./RayStripes";
import type { PieceAttackProps } from "./types";

/** Four stripes crossing at the queen — two along the grid, two diagonal. */
export default function QueenAttacks({
  position,
  piece,
  idPrefix,
  orientation,
}: PieceAttackProps) {
  return (
    <RayStripes
      origin={piece.square}
      axes={queenAttackAxes(position, piece.square)}
      stripeClass="attack-stripe attack-queen"
      width={QUEEN_STRIPE_WIDTH}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
