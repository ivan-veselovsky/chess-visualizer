import { pawnAttacks, type PawnAttack } from "../../../chess/attacks";
import {
  SQUARE_SIZE,
  perpendicular,
  rayPoint,
  rayStartPlanePath,
  rayStopWedgePath,
  squareBox,
  squareCenter,
} from "../../geometry";
import { stripeBands } from "./bands";
import { innerSquares } from "./innerSquares";
import type { PieceAttackProps } from "./types";

/**
 * A mark on each of the two squares diagonally ahead of the pawn: a stripe
 * running from the pawn itself, across the shared corner, past the centre of
 * the attacked square, and stopping in a point.
 *
 * The clips do all the shaping, exactly as they do for a sliding piece's rays:
 * the stroke simply runs out to the far corner, and three nested regions decide
 * what shows. It must lie beyond the straight cut across the pawn's own large
 * inner square; within the wedge that stops it on the target's small one, which
 * brings it to a point past that square's centre; and, unless rays are drawn at
 * full width, within the two squares it belongs to, which pinches it at the
 * corner they share and keeps it off their neighbours.
 */
export default function PawnAttacks({
  piece,
  idPrefix,
  orientation,
  attackSettings,
  geometry,
}: PieceAttackProps) {
  const bands = stripeBands(geometry.pawnRay);
  if (bands.length === 0) {
    return null;
  }

  const attacks = pawnAttacks(piece.square, piece.color);
  if (attacks.length === 0) {
    return null;
  }

  const fullWidth = attackSettings.fullWidthDiagonalRays;
  const { small: smallHalfSide, large: largeHalfSide } = innerSquares(geometry);
  const halfWidth = (Math.max(geometry.pawnRay.rayWidth, 0) * SQUARE_SIZE) / 2;
  const center = squareCenter(piece.square, orientation);

  /**
   * The mark runs out to the far corner; the clips decide where it stops. A
   * doubled stripe is two bands set either side of that line, offset across it
   * — the same construction the sliding pieces' rays use.
   */
  const mark = (attack: PawnAttack) => {
    const to = rayPoint(piece.square, attack.direction, 1.5, orientation);
    const normal = perpendicular(attack.direction, orientation);
    return bands.map((band, index) => {
      const shift = {
        x: normal.x * band.offset,
        y: normal.y * band.offset,
      };
      return (
        <line
          key={index}
          x1={center.x + shift.x}
          y1={center.y + shift.y}
          x2={to.x + shift.x}
          y2={to.y + shift.y}
          className="attack-stripe attack-pawn"
          strokeWidth={band.width}
        />
      );
    });
  };

  // The two marks set off close together and overlap where they do. They are
  // stroked opaque and AttackLayer applies the transparency to the composited
  // pair, which keeps that junction the same shade as the rest.
  return (
    <g>
      {attacks.map((attack) => {
        const startId = `${idPrefix}-${attack.square}-start`;
        const stopId = `${idPrefix}-${attack.square}-stop`;
        const squaresId = `${idPrefix}-${attack.square}-squares`;
        const bounded = (
          <g clipPath={`url(#${startId})`}>
            <g clipPath={`url(#${stopId})`}>{mark(attack)}</g>
          </g>
        );

        return (
          <g key={attack.square}>
            <clipPath id={startId}>
              <path
                d={rayStartPlanePath(
                  piece.square,
                  attack.direction,
                  largeHalfSide,
                  halfWidth,
                  orientation
                )}
              />
            </clipPath>
            <clipPath id={stopId}>
              <path
                d={rayStopWedgePath(
                  attack.square,
                  attack.direction,
                  smallHalfSide,
                  orientation
                )}
              />
            </clipPath>
            {fullWidth ? (
              bounded
            ) : (
              <>
                <clipPath id={squaresId}>
                  <rect {...squareBox(piece.square, orientation)} />
                  <rect {...squareBox(attack.square, orientation)} />
                </clipPath>
                <g clipPath={`url(#${squaresId})`}>{bounded}</g>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}
