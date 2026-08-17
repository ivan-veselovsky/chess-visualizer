import { pawnAttacks } from "../../../chess/attacks";
import {
  ATTACK_BASE_OPACITY,
  SQUARE_SIZE,
  rayEndBox,
  rayPoint,
  squareBox,
  squareCenter,
  type Orientation,
  type Point,
} from "../../geometry";
import type { PieceAttackProps } from "./types";

function rectPath(box: Point & { width: number; height: number }): string {
  return `M ${box.x} ${box.y} h ${box.width} v ${box.height} h ${-box.width} Z`;
}

function circlePath({ x, y }: Point, r: number): string {
  return (
    `M ${x - r} ${y}` +
    ` a ${r} ${r} 0 1 0 ${r * 2} 0` +
    ` a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`
  );
}

/**
 * A mark on each of the two squares diagonally ahead of the pawn: a stripe
 * running from the pawn itself, across the shared corner, past the centre of
 * the attacked square, and ending in an arrow point.
 *
 * The clip does all the shaping. It admits the pawn's own square minus its
 * inner circle, so the stripe emerges from behind the pawn; and the part of
 * each attacked square within its inner square, so the stroke — drawn all the
 * way out to the far corner — is cut by two perpendicular sides at once and
 * comes to a point. In between it pinches at the corner it crosses and never
 * touches the squares to either side of it.
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

  const radius = Math.max(attackOptions.rayInnerRadius, 0) * SQUARE_SIZE;
  const innerHalfSide = (Math.max(attackOptions.rayInnerSquare, 0) * SQUARE_SIZE) / 2;
  const center = squareCenter(piece.square, orientation);
  const clipId = `${idPrefix}-marks`;

  // Subpaths resolved by the even-odd rule: the circle sits inside the pawn's
  // own square rect and so punches a hole in it.
  const clipPathData = [
    ...attacks.map((attack) =>
      rectPath(
        rayEndBox(attack.square, attack.direction, innerHalfSide, orientation)
      )
    ),
    rectPath(squareBox(piece.square, orientation)),
    radius > 0 ? circlePath(center, radius) : "",
  ].join(" ");

  // Transparency applied once to the pair: the two marks leave the pawn's
  // circle close together and overlap there, and compositing them opaque first
  // keeps that junction the same shade as the rest.
  return (
    <g opacity={ATTACK_BASE_OPACITY}>
      <clipPath id={clipId}>
        <path d={clipPathData} clipRule="evenodd" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {attacks.map((attack) => {
          const to = rayPoint(piece.square, attack.direction, 1.5, orientation);
          return (
            <line
              key={attack.square}
              x1={center.x}
              y1={center.y}
              x2={to.x}
              y2={to.y}
              className="attack-stripe attack-pawn"
              strokeWidth={width}
            />
          );
        })}
      </g>
    </g>
  );
}
