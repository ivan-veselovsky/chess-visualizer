import { pawnAttacks } from "../../../chess/attacks";
import {
  ATTACK_BASE_OPACITY,
  SQUARE_SIZE,
  rayPoint,
  squareBox,
  squareCenter,
} from "../../geometry";
import type { PieceAttackProps } from "./types";

/**
 * A mark on each of the two squares diagonally ahead of the pawn: a stripe
 * running in from the corner nearest the pawn, ending in a circle at the centre
 * of the square.
 *
 * Both halves come from a single round-capped stroke. The line runs from the
 * shared corner to the square's centre and stops there, so the round cap adds
 * exactly the half circle beyond the centre that the stripe does not already
 * cover — the two together make a full circle of the stroke's width centred on
 * the square. Clipping to the attacked square then trims the stroke where it
 * would spill over the corner into squares the pawn does not attack, which is
 * what tapers the mark to a point at the corner.
 */
export default function PawnAttacks({
  piece,
  idPrefix,
  orientation,
  attackOptions,
}: PieceAttackProps) {
  const width = Math.max(attackOptions.pawnMarkWidth, 0) * SQUARE_SIZE;
  if (width === 0) {
    return null;
  }

  const attacks = pawnAttacks(piece.square, piece.color);
  if (attacks.length === 0) {
    return null;
  }

  const clipId = `${idPrefix}-marks`;

  return (
    <g>
      <clipPath id={clipId}>
        {attacks.map((attack) => (
          <rect key={attack.square} {...squareBox(attack.square, orientation)} />
        ))}
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {attacks.map((attack) => {
          // Half a step out is the corner the pawn and the target square share.
          const corner = rayPoint(piece.square, attack.direction, 0.5, orientation);
          const center = squareCenter(attack.square, orientation);
          return (
            <line
              key={attack.square}
              x1={corner.x}
              y1={corner.y}
              x2={center.x}
              y2={center.y}
              className="attack-stripe attack-pawn"
              strokeWidth={width}
              strokeOpacity={ATTACK_BASE_OPACITY}
            />
          );
        })}
      </g>
    </g>
  );
}
