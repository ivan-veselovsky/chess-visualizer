import { useId } from "react";
import type { Chess } from "chess.js";
import {
  kingAttackedSquares,
  queenAttackAxes,
  type AttackAxis,
  type RaySquare,
} from "../../chess/attacks";
import type { PlacedPiece } from "../../chess/model";
import {
  ATTACK_BASE_OPACITY,
  KING_STRIPE_WIDTH,
  QUEEN_STRIPE_WIDTH,
  kingAttackRingPath,
  rayPoint,
  squareBox,
  type Orientation,
} from "../geometry";

interface AttackLayerProps {
  position: Chess;
  pieces: PlacedPiece[];
  orientation?: Orientation;
}

/**
 * Draws the squares each piece attacks. Kings and queens are handled so far.
 */
export default function AttackLayer({
  position,
  pieces,
  orientation = "white",
}: AttackLayerProps) {
  // useId() yields ids like ":r0:"; the colons are awkward inside url(#...).
  const idPrefix = `attack-${useId().replace(/:/g, "")}`;

  return (
    <g className="attack-layer">
      {pieces.map((piece) => {
        if (piece.type === "k") {
          return (
            <KingAttacks
              key={piece.square}
              square={piece.square}
              clipId={`${idPrefix}-${piece.square}`}
              orientation={orientation}
            />
          );
        }
        if (piece.type === "q") {
          return (
            <QueenAttacks
              key={piece.square}
              position={position}
              square={piece.square}
              idPrefix={`${idPrefix}-${piece.square}`}
              orientation={orientation}
            />
          );
        }
        return null;
      })}
    </g>
  );
}

interface KingAttacksProps {
  square: PlacedPiece["square"];
  clipId: string;
  orientation: Orientation;
}

/**
 * The eight neighbouring squares as one rounded-square stripe, clipped to the
 * squares actually attacked so a king on an edge gets the ring trimmed at the
 * board boundary instead of hanging over squares that do not exist.
 */
function KingAttacks({ square, clipId, orientation }: KingAttacksProps) {
  return (
    <g>
      <clipPath id={clipId}>
        {kingAttackedSquares(square).map((target) => (
          <rect key={target} {...squareBox(target, orientation)} />
        ))}
      </clipPath>
      <path
        d={kingAttackRingPath(square, orientation)}
        className="attack-stripe attack-king"
        strokeWidth={KING_STRIPE_WIDTH}
        strokeOpacity={ATTACK_BASE_OPACITY}
        clipPath={`url(#${clipId})`}
      />
    </g>
  );
}

interface QueenAttacksProps {
  position: Chess;
  square: PlacedPiece["square"];
  idPrefix: string;
  orientation: Orientation;
}

/**
 * Four stripes crossing at the queen — two along the grid, two diagonal. Each
 * is drawn one square at a time so its opacity can drop at the far edge of
 * every piece it passes through.
 *
 * Every stripe is clipped to the squares that lie on its own line. A stroke of
 * finite width would otherwise bleed past the corners of the diagonal squares
 * into neighbours that are not on the diagonal at all, and would spill off the
 * board at the ends. Since consecutive diagonal squares meet only at a corner,
 * the clipped stripe necessarily narrows to a point there.
 */
function QueenAttacks({
  position,
  square,
  idPrefix,
  orientation,
}: QueenAttacksProps) {
  const axes = queenAttackAxes(position, square);

  /** Segment covering a single square on a ray; `sense` is +1 or -1 along the axis. */
  function segment(axis: AttackAxis, hit: RaySquare, sense: 1 | -1) {
    const from = rayPoint(
      square,
      axis.direction,
      sense * (hit.distance - 0.5),
      orientation
    );
    const to = rayPoint(
      square,
      axis.direction,
      sense * (hit.distance + 0.5),
      orientation
    );
    return (
      <line
        key={hit.square}
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        className="attack-stripe attack-queen"
        strokeWidth={QUEEN_STRIPE_WIDTH}
        strokeOpacity={ATTACK_BASE_OPACITY * hit.intensity}
      />
    );
  }

  return (
    <g>
      {axes.map((axis) => {
        const [df, dr] = axis.direction;
        // The stripe crosses the queen's own square, joining the two rays.
        const hubFrom = rayPoint(square, axis.direction, -0.5, orientation);
        const hubTo = rayPoint(square, axis.direction, 0.5, orientation);

        // Everything this stripe may paint on: its line, and nothing else.
        const clipId = `${idPrefix}-axis${df}_${dr}`;
        const onLine = [
          square,
          ...axis.positive.map((hit) => hit.square),
          ...axis.negative.map((hit) => hit.square),
        ];

        return (
          <g key={`${df},${dr}`}>
            <clipPath id={clipId}>
              {onLine.map((target) => (
                <rect key={target} {...squareBox(target, orientation)} />
              ))}
            </clipPath>
            <g clipPath={`url(#${clipId})`}>
              <line
                x1={hubFrom.x}
                y1={hubFrom.y}
                x2={hubTo.x}
                y2={hubTo.y}
                className="attack-stripe attack-queen"
                strokeWidth={QUEEN_STRIPE_WIDTH}
                strokeOpacity={ATTACK_BASE_OPACITY}
              />
              {axis.positive.map((hit) => segment(axis, hit, 1))}
              {axis.negative.map((hit) => segment(axis, hit, -1))}
            </g>
          </g>
        );
      })}
    </g>
  );
}
