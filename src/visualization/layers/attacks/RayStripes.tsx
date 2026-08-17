import type { Square } from "chess.js";
import type { AttackAxis, RaySquare } from "../../../chess/attacks";
import {
  ATTACK_BASE_OPACITY,
  rayPoint,
  squareBox,
  type Orientation,
} from "../../geometry";

interface RayStripesProps {
  /** Square the stripes radiate from; it is not painted on itself. */
  origin: Square;
  axes: AttackAxis[];
  stripeClass: string;
  width: number;
  idPrefix: string;
  orientation: Orientation;
}

/**
 * Renders one stripe per axis for any sliding piece — queen (four axes), rook
 * and bishop (two each).
 *
 * Each stripe is drawn one square at a time rather than as a single line, so
 * its opacity can step down at the far edge of every piece it passes through.
 *
 * Each stripe is also clipped to the attacked squares on its own line — the
 * piece's own square is excluded, so the stripes stop at its edge instead of
 * crossing underneath it. A stroke of
 * finite width would otherwise bleed past the corners of the diagonal squares
 * into neighbours that are not on the diagonal at all, and would spill off the
 * board at the ends. Since consecutive diagonal squares meet only at a corner,
 * the clipped stripe necessarily narrows to a point there.
 */
export default function RayStripes({
  origin,
  axes,
  stripeClass,
  width,
  idPrefix,
  orientation,
}: RayStripesProps) {
  /** Segment covering a single square on a ray; `sense` is +1 or -1 along the axis. */
  function segment(axis: AttackAxis, hit: RaySquare, sense: 1 | -1) {
    const from = rayPoint(
      origin,
      axis.direction,
      sense * (hit.distance - 0.5),
      orientation
    );
    const to = rayPoint(
      origin,
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
        className={stripeClass}
        strokeWidth={width}
        strokeOpacity={ATTACK_BASE_OPACITY * hit.intensity}
      />
    );
  }

  return (
    <g>
      {axes.map((axis) => {
        const [df, dr] = axis.direction;

        // Everything this stripe may paint on: the attacked squares, and
        // nothing else. The piece's own square is not among them, so the two
        // opposite rays stay visually separate rather than crossing under it.
        const clipId = `${idPrefix}-axis${df}_${dr}`;
        const attacked = [
          ...axis.positive.map((hit) => hit.square),
          ...axis.negative.map((hit) => hit.square),
        ];

        return (
          <g key={`${df},${dr}`}>
            <clipPath id={clipId}>
              {attacked.map((target) => (
                <rect key={target} {...squareBox(target, orientation)} />
              ))}
            </clipPath>
            <g clipPath={`url(#${clipId})`}>
              {axis.positive.map((hit) => segment(axis, hit, 1))}
              {axis.negative.map((hit) => segment(axis, hit, -1))}
            </g>
          </g>
        );
      })}
    </g>
  );
}
