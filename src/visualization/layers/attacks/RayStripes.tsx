import type { Square } from "chess.js";
import type { AttackAxis, RaySquare } from "../../../chess/attacks";
import {
  SQUARE_SIZE,
  needlePath,
  perpendicular,
  rayBaseChord,
  rayBeforeCutPath,
  rayPoint,
  rayResumePath,
  rayStopTip,
  rayStartPlanePath,
  rayStopWedgePath,
  squareBox,
  type Orientation,
} from "../../geometry";
import type { RayShape, RayStyle } from "../../settings";
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
  /**
   * What shape to draw each ray in: a stripe of one width, or a needle
   * narrowing from the piece to where the ray stops.
   */
  shape: RayShape;
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
  shape,
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
    rayStartPlanePath(square, direction, largeHalfSide, orientation);

  /** Everything past where a ray stopped on `square`, for the stretch beyond a
      piece it x-rays through: the complement of that stop. */
  const past = (square: Square, direction: readonly [number, number]): string =>
    rayResumePath(square, direction, smallHalfSide, orientation);

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
          /* Where a needle starts: on the large inner square, at the width the
             reader asked for — the same place and width a stripe begins with,
             so the two kinds of ray leave a piece alike. Where each of them
             ends is asked per stretch below. */
          const middle = rayPoint(origin, axis.direction, 0, orientation);
          const onward = rayPoint(origin, axis.direction, sense, orientation);
          const run = { x: onward.x - middle.x, y: onward.y - middle.y };
          const length = Math.hypot(run.x, run.y);
          const along = { x: run.x / length, y: run.y / length };
          const base = rayBaseChord(middle, along, largeHalfSide, halfWidth);

          const stretches = raySegments(origin, ray);

          /*
            A needle is one shape from the piece to where the ray stops, dimmed
            in steps along its length where the ray passes through a man — the
            way a stripe is drawn, and for the same reason: it is one ray, and
            what changes along it is its weight.

            Each stretch is the whole of that needle, shown only between the two
            cuts that bound it: straight lines square across the ray, half a
            side out from the centre of the man it passes. A stripe is cut with
            a chevron there, which is the shape its own end has; a needle has an
            end of its own and a step in its weight should not look like a
            second shape beginning.

            The first stretch has nothing behind it and the last nothing ahead:
            a needle starts at its base on the large inner square and ends in
            its own point, which is what the two clips of a stripe are for.
          */
          if (shape !== "stripe") {
            const furthest = needlePath(
              base,
              rayStopTip(
                ray[ray.length - 1].square,
                direction,
                smallHalfSide,
                orientation
              ),
              shape
            );
            return (
              <g key={key}>
                {stretches.map((stretch, index) => {
                  const beyondId = `${axisId}-${key}-from${index}`;
                  const untilId = `${axisId}-${key}-until${index}`;
                  const opens =
                    index === 0
                      ? null
                      : rayStartPlanePath(
                          stretches[index - 1].end,
                          direction,
                          smallHalfSide,
                          orientation
                        );
                  const closes =
                    index === stretches.length - 1
                      ? null
                      : rayBeforeCutPath(
                          stretch.end,
                          direction,
                          smallHalfSide,
                          orientation
                        );
                  let mark = (
                    <path
                      d={furthest}
                      className={`${stripeClass} attack-needle`}
                      fillOpacity={stretch.intensity}
                    />
                  );
                  if (closes !== null) {
                    mark = <g clipPath={`url(#${untilId})`}>{mark}</g>;
                  }
                  if (opens !== null) {
                    mark = <g clipPath={`url(#${beyondId})`}>{mark}</g>;
                  }
                  return (
                    <g key={index}>
                      {opens !== null && (
                        <clipPath id={beyondId}>
                          <path d={opens} />
                        </clipPath>
                      )}
                      {closes !== null && (
                        <clipPath id={untilId}>
                          <path d={closes} />
                        </clipPath>
                      )}
                      {mark}
                    </g>
                  );
                })}
              </g>
            );
          }

          return (
            <g key={key}>
              {stretches.map((segment, index) => {
                /*
                  Every stretch stops the same way: in a point on the small
                  inner square of the square it reaches.

                  Where it begins depends on what is behind it. The first
                  stretch sets off from the piece, on a straight cut across its
                  large inner square, leaving the clear gap around the glyph
                  that every mark leaves. A stretch that resumes past a piece
                  the ray x-rays through begins exactly where the stretch
                  before it ended — in the notch that stretch's point left — so
                  the two read as one ray that changes weight rather than as
                  two rays with a gap between them.

                  The two bounds are nested rather than combined, one clip path
                  not intersecting two.
                */
                const beyondId = `${axisId}-${key}-beyond${index}`;
                const upToId = `${axisId}-${key}-upto${index}`;
                const opening =
                  segment.start === origin
                    ? from(segment.start, direction)
                    : past(segment.start, direction);
                const marks = (
                  <>
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
                  </>
                );
                return (
                  <g key={index}>
                    <clipPath id={beyondId} clipRule="evenodd">
                      <path clipRule="evenodd" d={opening} />
                    </clipPath>
                    <clipPath id={upToId}>
                      <path d={upTo(segment.end, direction)} />
                    </clipPath>
                    <g clipPath={`url(#${beyondId})`}>
                      <g clipPath={`url(#${upToId})`}>{marks}</g>
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
