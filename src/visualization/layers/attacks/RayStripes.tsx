import type { Square } from "chess.js";
import type { AttackAxis, RaySquare } from "../../../chess/attacks";
import {
  ATTACK_BASE_OPACITY,
  SQUARE_SIZE,
  perpendicular,
  rayPoint,
  squareBox,
  type Orientation,
  type Point,
} from "../../geometry";
import type { StripeStyle } from "../../options";

interface RayStripesProps {
  /** Square the stripes radiate from; it is not painted on itself. */
  origin: Square;
  axes: AttackAxis[];
  stripeClass: string;
  stripe: StripeStyle;
  idPrefix: string;
  orientation: Orientation;
}

/** One band of the stripe: how far off the centre line, and how thick. */
interface Band {
  offset: number;
  width: number;
}

/**
 * Resolves a stripe style into the bands to actually stroke.
 *
 * The stripe is an outer stripe minus an inner one, which leaves two bands
 * running either side of the centre line. Rather than a real path subtraction
 * each band is stroked directly: it is `(outer - inner) / 2` thick and sits
 * `(outer + inner) / 4` off centre. When the inner width is zero there is
 * nothing to subtract, so a single centred band of the full width is used —
 * two touching bands would otherwise show a seam where they meet.
 */
export function stripeBands({ outerWidth, innerWidth }: StripeStyle): Band[] {
  // Both to pixels before clamping — an inner width above the outer one would
  // otherwise yield negative band widths.
  const outer = Math.max(outerWidth, 0) * SQUARE_SIZE;
  const inner = Math.min(Math.max(innerWidth, 0) * SQUARE_SIZE, outer);

  if (outer === 0) {
    return [];
  }
  if (inner === 0) {
    return [{ offset: 0, width: outer }];
  }
  const width = (outer - inner) / 2;
  if (width === 0) {
    return [];
  }
  const offset = (outer + inner) / 4;
  return [
    { offset: -offset, width },
    { offset, width },
  ];
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
 * crossing underneath it. A stroke of finite width would otherwise bleed past
 * the corners of the diagonal squares into neighbours that are not on the
 * diagonal at all, and would spill off the board at the ends. Since consecutive
 * diagonal squares meet only at a corner, the clipped stripe necessarily
 * narrows to a point there.
 */
export default function RayStripes({
  origin,
  axes,
  stripeClass,
  stripe,
  idPrefix,
  orientation,
}: RayStripesProps) {
  const bands = stripeBands(stripe);
  if (bands.length === 0) {
    return null;
  }

  /**
   * One band over one square of a ray. `sense` is +1 or -1 along the axis;
   * `shift` displaces the band sideways off the centre line.
   */
  function segment(
    axis: AttackAxis,
    hit: RaySquare,
    sense: 1 | -1,
    band: Band,
    shift: Point,
    key: string
  ) {
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
        key={key}
        x1={from.x + shift.x}
        y1={from.y + shift.y}
        x2={to.x + shift.x}
        y2={to.y + shift.y}
        className={stripeClass}
        strokeWidth={band.width}
        strokeOpacity={ATTACK_BASE_OPACITY * hit.intensity}
      />
    );
  }

  return (
    <g>
      {axes.map((axis) => {
        const [df, dr] = axis.direction;
        const normal = perpendicular(axis.direction, orientation);

        // Everything this stripe may paint on: the attacked squares, and
        // nothing else.
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
              {bands.map((band, index) => {
                const shift = {
                  x: normal.x * band.offset,
                  y: normal.y * band.offset,
                };
                return (
                  <g key={index}>
                    {axis.positive.map((hit) =>
                      segment(axis, hit, 1, band, shift, `${hit.square}-${index}`)
                    )}
                    {axis.negative.map((hit) =>
                      segment(axis, hit, -1, band, shift, `${hit.square}-${index}`)
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        );
      })}
    </g>
  );
}
