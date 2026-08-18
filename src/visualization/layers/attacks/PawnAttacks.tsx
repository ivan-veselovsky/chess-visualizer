import { pawnAttacks, type PawnAttack } from "../../../chess/attacks";
import {
  BOARD_SIZE,
  SQUARE_SIZE,
  perpendicular,
  rayPoint,
  rayStopWedgePath,
  roundedRectPath,
  squareBox,
  squareCenter,
  type Rect,
} from "../../geometry";
import { stripeBands } from "./bands";
import type { PieceAttackProps } from "./types";

function rectPath(box: Rect): string {
  return `M ${box.x} ${box.y} h ${box.width} v ${box.height} h ${-box.width} Z`;
}

const BOARD_BOX: Rect = { x: 0, y: 0, width: BOARD_SIZE, height: BOARD_SIZE };

/**
 * A mark on each of the two squares diagonally ahead of the pawn: a stripe
 * running from the pawn itself, across the shared corner, past the centre of
 * the attacked square, and stopping in a point.
 *
 * The clips do all the shaping, exactly as they do for a sliding piece's rays:
 * the stroke simply runs out to the far corner, and three nested regions decide
 * what shows. It must lie beyond the pawn's own inner square, whose rounded
 * corners blunt the notch it leaves through; within the wedge that stops it on
 * the target's inner square, which brings it to a point; and, unless rays are
 * drawn at full width, within the two squares it belongs to, which pinches it
 * at the corner they share and keeps it off their neighbours.
 */
export default function PawnAttacks({
  piece,
  idPrefix,
  orientation,
  attackOptions,
  geometry,
}: PieceAttackProps) {
  const bands = stripeBands(geometry.pawnStripe);
  if (bands.length === 0) {
    return null;
  }

  const attacks = pawnAttacks(piece.square, piece.color);
  if (attacks.length === 0) {
    return null;
  }

  const fullWidth = attackOptions.fullWidthDiagonalRays;
  const innerHalfSide =
    (Math.max(attackOptions.rayInnerSquare, 0) * SQUARE_SIZE) / 2;
  const center = squareCenter(piece.square, orientation);
  const startClipId = `${idPrefix}-start`;

  // The board with the pawn's inner square punched out by the even-odd rule.
  const startClipPath = [
    rectPath(BOARD_BOX),
    innerHalfSide > 0
      ? roundedRectPath(
          {
            x: center.x - innerHalfSide,
            y: center.y - innerHalfSide,
            width: innerHalfSide * 2,
            height: innerHalfSide * 2,
          },
          Math.max(attackOptions.rayInnerSquareCornerRadius, 0) * SQUARE_SIZE
        )
      : "",
  ].join(" ");

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

  // The two marks leave the pawn's inner square close together and overlap
  // there. They are stroked opaque and AttackLayer applies the transparency to
  // the composited pair, which keeps that junction the same shade as the rest.
  return (
    <g>
      <clipPath id={startClipId}>
        <path d={startClipPath} clipRule="evenodd" />
      </clipPath>
      <g clipPath={`url(#${startClipId})`}>
        {attacks.map((attack) => {
          const stopId = `${idPrefix}-${attack.square}-stop`;
          const squaresId = `${idPrefix}-${attack.square}-squares`;
          const stopped = (
            <g clipPath={`url(#${stopId})`}>{mark(attack)}</g>
          );

          return (
            <g key={attack.square}>
              <clipPath id={stopId}>
                <path
                  d={rayStopWedgePath(
                    attack.square,
                    attack.direction,
                    innerHalfSide,
                    orientation
                  )}
                />
              </clipPath>
              {fullWidth ? (
                stopped
              ) : (
                <>
                  <clipPath id={squaresId}>
                    <rect {...squareBox(piece.square, orientation)} />
                    <rect {...squareBox(attack.square, orientation)} />
                  </clipPath>
                  <g clipPath={`url(#${squaresId})`}>{stopped}</g>
                </>
              )}
            </g>
          );
        })}
      </g>
    </g>
  );
}
