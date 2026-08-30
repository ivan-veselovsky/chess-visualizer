import type { Square } from "chess.js";
import type { AttackAxis, RaySquare } from "../../../chess/attacks";
import {
  SQUARE_SIZE,
  perpendicular,
  rayPoint,
  rayStartPlanePath,
  rayStopWedgePath,
  squareBox,
  type Orientation,
} from "../../geometry";
import type { RayStyle } from "../../settings";
import { stripeBands, type Band } from "./bands";
import type { InnerSquares } from "./innerSquares";

interface RayStripesProps {
  /** Square the stripes radiate from. */
  origin: Square;
  axes: AttackAxis[];
  stripeClass: string;
  stripe: RayStyle;
  /** The two squares this side's rays set off from and stop at. */
  innerSquares: InnerSquares;
  /**
   * Keep each ray at full width along its whole length. Off, a ray is confined
   * to the squares it attacks, so a diagonal one pinches to a point at every
   * square corner, those squares meeting only there.
   */
  fullWidth: boolean;
  idPrefix: string;
  orientation: Orientation;
}

/**
 * A stretch of ray at one intensity, bounded by the inner squares of the piece
 * it leaves and the piece it reaches.
 */
export interface RaySegment {
  intensity: number;
  /** Square whose inner square the stretch begins beyond. */
  start: Square;
  /** Square whose inner square the stretch stops at. */
  end: Square;
}

/**
 * Splits a ray into stretches of constant intensity.
 *
 * Every boundary in a ray is an inner square: the ray leaves its own piece's
 * inner square, dims on leaving the inner square of each piece it passes, and
 * stops at the inner square of the last square it reaches. Describing a stretch
 * by the two squares that bound it — rather than by distances along the ray —
 * lets all three be drawn by the same clip, so a diagonal comes to a point at
 * every one of them instead of being cut off square.
 *
 * The last square's own drop is skipped: it would dim a stretch with nothing
 * beyond it, and its boundary is already where the ray stops.
 */
export function raySegments(origin: Square, ray: RaySquare[]): RaySegment[] {
  const drops = ray
    .slice(0, -1)
    .filter((hit) => hit.intensityAfter !== hit.intensity);

  const bounds = [
    origin,
    ...drops.map((hit) => hit.square),
    ray[ray.length - 1].square,
  ];
  const intensities = [1, ...drops.map((hit) => hit.intensityAfter)];

  return intensities
    .map((intensity, index) => ({
      intensity,
      start: bounds[index],
      end: bounds[index + 1],
    }))
    .filter((segment) => segment.intensity > 0);
}

/**
 * Renders one stripe per axis for any sliding piece — queen and king (four axes
 * each), rook and bishop (two each).
 *
 * A stripe is cut only ever by inner squares, and always in the same way: a
 * stretch is drawn where it lies beyond one piece's inner square and not yet
 * past the next one's. A diagonal meets two sides of such a square at once, so
 * every boundary along it — start, each drop in intensity, and the end — is a
 * point; a rank or file meets one side and gets a flat edge at the same depth.
 *
 * Because those clips bound each stretch along its length, the stroke itself
 * runs the whole ray and needs no trimming.
 *
 * Sideways, a stripe is confined to the squares on its own line unless
 * `fullWidth` is set. That confinement is what stops a stroke of finite width
 * bleeding past the corners of the diagonal squares into neighbours that are
 * not on the diagonal at all — at the cost of pinching the stripe to a point at
 * every one of those corners, since consecutive diagonal squares meet only
 * there.
 */
export default function RayStripes({
  origin,
  axes,
  stripeClass,
  stripe,
  innerSquares,
  fullWidth,
  idPrefix,
  orientation,
}: RayStripesProps) {
  const bands = stripeBands(stripe);
  if (bands.length === 0) {
    return null;
  }

  const { small: smallHalfSide, large: largeHalfSide } = innerSquares;
  // The whole stripe's half-width, gap and all: it is the ray's own two sides
  // that the start is cut between, so a gap down the middle changes nothing
  // about where it begins, and both bands are cut off level with each other.
  const halfWidth = (Math.max(stripe.rayWidth, 0) * SQUARE_SIZE) / 2;

  /** Everything from where a ray sets off from `square`, as a half-plane. */
  const from = (square: Square, direction: readonly [number, number]): string =>
    rayStartPlanePath(
      square,
      direction,
      largeHalfSide,
      halfWidth,
      orientation
    );

  /** Everything up to where a ray stops on `square`, as a wedge. */
  const upTo = (square: Square, direction: readonly [number, number]): string =>
    rayStopWedgePath(square, direction, smallHalfSide, orientation);

  // Stripes are stroked opaque; AttackLayer composites the piece and applies the
  // transparency once, so where they overlap — which they do wherever several
  // rays leave the same square — the colour stays flat instead of doubling up.
  // Only the per-blocker dimming varies stroke by stroke, and stripes at
  // different intensities never cover each other.
  return (
    <g>
      {axes.map((axis) => {
        const [df, dr] = axis.direction;
        const normal = perpendicular(axis.direction, orientation);
        const axisId = `${idPrefix}-axis${df}_${dr}`;
        const squaresId = `${axisId}-squares`;

        const senses = [
          { key: "pos", sense: 1 as const, ray: axis.positive },
          { key: "neg", sense: -1 as const, ray: axis.negative },
        ].filter((entry) => entry.ray.length > 0);

        const rays = senses.map(({ key, sense, ray }) => {
          const direction = [df * sense, dr * sense] as const;
          const reach = ray[ray.length - 1].distance + 0.5;

          return (
            <g key={key}>
              {raySegments(origin, ray).map((segment, index) => {
                // Every stretch is bounded the same way, whether it sets off
                // from the piece itself or resumes past one it x-rays through:
                // a straight cut across the large inner square behind it, and
                // a point on the small inner square ahead. The two are nested
                // rather than combined, one clip path not intersecting two.
                const beyondId = `${axisId}-${key}-beyond${index}`;
                const upToId = `${axisId}-${key}-upto${index}`;
                return (
                  <g key={index}>
                    <clipPath id={beyondId}>
                      <path d={from(segment.start, direction)} />
                    </clipPath>
                    <clipPath id={upToId}>
                      <path d={upTo(segment.end, direction)} />
                    </clipPath>
                    <g clipPath={`url(#${beyondId})`}>
                      <g clipPath={`url(#${upToId})`}>
                        {bands.map((band, bandIndex) => {
                          const from = rayPoint(
                            origin,
                            axis.direction,
                            0,
                            orientation
                          );
                          const to = rayPoint(
                            origin,
                            axis.direction,
                            sense * reach,
                            orientation
                          );
                          const shift = {
                            x: normal.x * band.offset,
                            y: normal.y * band.offset,
                          };
                          return (
                            <line
                              key={bandIndex}
                              x1={from.x + shift.x}
                              y1={from.y + shift.y}
                              x2={to.x + shift.x}
                              y2={to.y + shift.y}
                              className={stripeClass}
                              strokeWidth={band.width}
                              strokeOpacity={segment.intensity}
                            />
                          );
                        })}
                      </g>
                    </g>
                  </g>
                );
              })}
            </g>
          );
        });

        if (fullWidth) {
          return <g key={`${df},${dr}`}>{rays}</g>;
        }

        // Confined: the piece's own square plus every square on this line.
        return (
          <g key={`${df},${dr}`}>
            <clipPath id={squaresId}>
              <rect {...squareBox(origin, orientation)} />
              {axis.positive.map((hit) => (
                <rect key={hit.square} {...squareBox(hit.square, orientation)} />
              ))}
              {axis.negative.map((hit) => (
                <rect key={hit.square} {...squareBox(hit.square, orientation)} />
              ))}
            </clipPath>
            <g clipPath={`url(#${squaresId})`}>{rays}</g>
          </g>
        );
      })}
    </g>
  );
}
