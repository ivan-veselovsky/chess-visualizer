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
}: PieceAttackProps) {
  return (
    <RayStripes
      origin={piece.square}
      axes={bishopAttackAxes(
        position,
        piece.square,
        attackOptions.decayPerBlocker
      )}
      stripeClass="attack-stripe attack-bishop"
      stripe={attackOptions.bishopStripe}
      innerRadius={attackOptions.rayInnerRadius}
      innerSquare={attackOptions.rayInnerSquare}
      idPrefix={idPrefix}
      orientation={orientation}
    />
  );
}
