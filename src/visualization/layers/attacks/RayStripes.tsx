import type { Square } from "chess.js";
import type { AttackAxis, RaySquare } from "../../../chess/attacks";
import {
  ATTACK_BASE_OPACITY,
  BOARD_SIZE,
  SQUARE_SIZE,
  perpendicular,
  rayPoint,
  rayStopWedgePath,
  roundedRectPath,
  squareBox,
  squareCenter,
  type Orientation,
  type Rect,
} from "../../geometry";
import type { StripeStyle } from "../../options";

interface RayStripesProps {
  /** Square the stripes radiate from. */
  origin: Square;
  axes: AttackAxis[];
  stripeClass: string;
  stripe: StripeStyle;
  /**
   * Side, in square sides, of the square that bounds where a ray starts, where
   * it ends, and where it dims behind a piece it passes through.
   */
  innerSquare: number;
  /**
   * Corner radius, in square sides, of the inner square a ray starts beyond.
   * Applies to starts only — ends and dimming boundaries stay sharp.
   */
  startCornerRadius: number;
  /**
   * Keep each ray at full width along its whole length. Off, a ray is confined
   * to the squares it attacks, so a diagonal one pinches to a point at every
   * square corner, those squares meeting only there.
   */
  fullWidth: boolean;
  idPrefix: string;
  orientation: Orientation;
}

/** A rectangle as a closed subpath. */
function rectPath(box: Rect): string {
  return `M ${box.x} ${box.y} h ${box.width} v ${box.height} h ${-box.width} Z`;
}

const BOARD_BOX: Rect = { x: 0, y: 0, width: BOARD_SIZE, height: BOARD_SIZE };

/** One band of the stripe: how far off the centre line, and how thick. */
interface Band {
  offset: number;
  width: number;
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
  innerSquare,
  startCornerRadius,
  fullWidth,
  idPrefix,
  orientation,
}: RayStripesProps) {
  const bands = stripeBands(stripe);
  if (bands.length === 0) {
    return null;
  }

  const innerHalfSide = (Math.max(innerSquare, 0) * SQUARE_SIZE) / 2;

  // Where every ray starts: the board with this piece's inner square punched
  // out by the even-odd rule, so a ray leaving it is notched by the two sides
  // it crosses. Rounding those corners blunts the notch a diagonal would come
  // to. One hole serves every ray, the strokes all beginning at the centre.
  const center = squareCenter(origin, orientation);
  const startHoleId = `${idPrefix}-start`;
  const startHolePath = `${rectPath(BOARD_BOX)} ${roundedRectPath(
    {
      x: center.x - innerHalfSide,
      y: center.y - innerHalfSide,
      width: innerHalfSide * 2,
      height: innerHalfSide * 2,
    },
    Math.max(startCornerRadius, 0) * SQUARE_SIZE
  )}`;

  /** Everything up to where a ray stops on `square`, as a wedge. */
  const upTo = (square: Square, direction: readonly [number, number]): string =>
    rayStopWedgePath(square, direction, innerHalfSide, orientation);

  // Transparency is applied once, to the whole piece. Its stripes are stroked
  // opaque and composited together first, so where they overlap — which they do
  // wherever several rays leave the same square — the colour stays flat instead
  // of doubling up. Only the per-blocker dimming varies stroke by stroke, and
  // stripes at different intensities never cover each other.
  return (
    <g opacity={ATTACK_BASE_OPACITY}>
      <clipPath id={startHoleId}>
        <path d={startHolePath} clipRule="evenodd" />
      </clipPath>
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
                // The first stretch starts beyond the piece's own inner square,
                // which is the shared, possibly rounded hole. Later ones start
                // beyond a blocker's inner square: the board with everything
                // short of it removed, so the even-odd rule leaves a notch
                // rather than a straight cut. Either is nested with the stop at
                // the end's inner square, one clip path not intersecting two.
                const first = index === 0;
                const beyondId = first
                  ? startHoleId
                  : `${axisId}-${key}-beyond${index}`;
                const upToId = `${axisId}-${key}-upto${index}`;
                return (
                  <g key={index}>
                    {!first && (
                      <clipPath id={beyondId}>
                        <path
                          d={`${rectPath(BOARD_BOX)} ${upTo(
                            segment.start,
                            direction
                          )}`}
                          clipRule="evenodd"
                        />
                      </clipPath>
                    )}
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
