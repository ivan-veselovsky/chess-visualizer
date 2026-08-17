import type { Square } from "chess.js";
import type { AttackAxis, RaySquare } from "../../../chess/attacks";
import {
  ATTACK_BASE_OPACITY,
  SQUARE_SIZE,
  perpendicular,
  rayEndBox,
  rayPoint,
  squareBox,
  squareCenter,
  stepVector,
  type Orientation,
  type Point,
} from "../../geometry";
import type { StripeStyle } from "../../options";

interface RayStripesProps {
  /** Square the stripes radiate from. */
  origin: Square;
  axes: AttackAxis[];
  stripeClass: string;
  stripe: StripeStyle;
  /** Radius, in square sides, of the circle drawn around every piece. */
  innerRadius: number;
  /** Side, in square sides, of the square bounding where a ray ends. */
  innerSquare: number;
  idPrefix: string;
  orientation: Orientation;
}

/** One band of the stripe: how far off the centre line, and how thick. */
interface Band {
  offset: number;
  width: number;
}

/** A run of constant intensity along a ray, in step units from the origin. */
interface Run {
  from: number;
  to: number;
  intensity: number;
}

/** Where the ray's intensity changes, in step units from the origin. */
interface Step {
  at: number;
  intensity: number;
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
 * Where along the ray each drop in intensity happens.
 *
 * A blocker dims the ray at the far edge of its own inner circle, not at the
 * edge of its square: the ray runs in at full strength, stays that strength
 * through the circle, and comes out behind it dimmed. `circle` is that radius
 * expressed in step units, so a circle wider than a square simply pushes the
 * drop into a later square, which the splitting below handles.
 *
 * The last square of a ray is skipped: a drop there would dim a stretch with
 * nothing beyond it, and at zero decay would cut the stroke off on the circle —
 * putting the inner circle back in charge of where the ray ends, which is the
 * inner square's job.
 */
export function intensitySteps(ray: RaySquare[], circle: number): Step[] {
  return ray
    .slice(0, -1)
    .filter((hit) => hit.intensityAfter !== hit.intensity)
    .map((hit) => ({ at: hit.distance + circle, intensity: hit.intensityAfter }));
}

/**
 * Cuts one square's stretch of ray into runs of constant intensity. Usually a
 * single run, or two when a drop falls inside the square.
 *
 * Runs span the whole square. Where a ray ends, the clip trims it back to the
 * inner square rather than the run doing so, which keeps every ending — flat
 * for a rank or file, arrow-shaped for a diagonal — a matter of one rule.
 */
export function squareRuns(hit: RaySquare, steps: Step[]): Run[] {
  const from = hit.distance - 0.5;
  const to = hit.distance + 0.5;

  // Steps are ordered by distance, so the last one at or before the square's
  // near edge gives the intensity the ray enters with.
  let intensity = 1;
  for (const step of steps) {
    if (step.at <= from) {
      intensity = step.intensity;
    }
  }

  const runs: Run[] = [];
  let cursor = from;
  for (const step of steps) {
    if (step.at <= from || step.at >= to) {
      continue;
    }
    if (step.at > cursor) {
      runs.push({ from: cursor, to: step.at, intensity });
    }
    cursor = step.at;
    intensity = step.intensity;
  }
  if (to > cursor) {
    runs.push({ from: cursor, to, intensity });
  }
  return runs.filter((run) => run.intensity > 0);
}

/**
 * Renders one stripe per axis for any sliding piece — queen (four axes), rook
 * and bishop (two each).
 *
 * Each stripe is drawn in pieces rather than as a single line, so its opacity
 * can step down where it passes behind a piece's inner circle.
 *
 * Each stripe is clipped to the squares on its own line. A stroke of finite
 * width would otherwise bleed past the corners of the diagonal squares into
 * neighbours that are not on the diagonal at all, and would spill off the board
 * at the ends. Since consecutive diagonal squares meet only at a corner, the
 * clipped stripe necessarily narrows to a point there.
 *
 * On the origin square the stripe is clipped to everything outside that piece's
 * own inner circle, so its rays emerge from behind it.
 */
export default function RayStripes({
  origin,
  axes,
  stripeClass,
  stripe,
  innerRadius,
  innerSquare,
  idPrefix,
  orientation,
}: RayStripesProps) {
  const bands = stripeBands(stripe);
  if (bands.length === 0) {
    return null;
  }

  const radius = Math.max(innerRadius, 0) * SQUARE_SIZE;
  const innerHalfSide = (Math.max(innerSquare, 0) * SQUARE_SIZE) / 2;

  // The origin square with a circular hole punched in the middle. The hole is a
  // second subpath resolved by the even-odd rule, which keeps the cut circular
  // instead of squaring it off the way a per-band cut-off distance would.
  const hubClipId = `${idPrefix}-hub`;
  const box = squareBox(origin, orientation);
  const center = squareCenter(origin, orientation);
  const hubClipPath = [
    `M ${box.x} ${box.y} h ${box.width} v ${box.height} h ${-box.width} Z`,
    radius > 0
      ? `M ${center.x - radius} ${center.y}` +
        ` a ${radius} ${radius} 0 1 0 ${radius * 2} 0` +
        ` a ${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`
      : "",
  ].join(" ");

  /** A stretch of ray, offset sideways onto one band. */
  function stroke(
    axis: AttackAxis,
    sense: 1 | -1,
    run: Run,
    band: Band,
    shift: Point,
    key: string
  ) {
    const from = rayPoint(origin, axis.direction, sense * run.from, orientation);
    const to = rayPoint(origin, axis.direction, sense * run.to, orientation);
    return (
      <line
        key={key}
        x1={from.x + shift.x}
        y1={from.y + shift.y}
        x2={to.x + shift.x}
        y2={to.y + shift.y}
        className={stripeClass}
        strokeWidth={band.width}
        strokeOpacity={run.intensity}
      />
    );
  }

  // Transparency is applied once, to the whole piece. Its stripes are stroked
  // opaque and composited together first, so where they overlap — which they do
  // wherever several rays leave the same square — the colour stays flat instead
  // of doubling up. Only the per-blocker dimming varies stroke by stroke, and
  // stripes at different intensities never cover each other.
  return (
    <g opacity={ATTACK_BASE_OPACITY}>
      <clipPath id={hubClipId}>
        <path d={hubClipPath} clipRule="evenodd" />
      </clipPath>
      {axes.map((axis) => {
        const [df, dr] = axis.direction;
        const normal = perpendicular(axis.direction, orientation);

        // One step is a square along a rank or file, but a square's diagonal
        // across a diagonal, so the circle covers less of a diagonal step.
        const step = stepVector(axis.direction, orientation);
        const circle = radius / Math.hypot(step.x, step.y);

        const positiveSteps = intensitySteps(axis.positive, circle);
        const negativeSteps = intensitySteps(axis.negative, circle);

        // Everything this stripe may paint on: the attacked squares, and
        // nothing else — trimmed to the inner square where a diagonal ray ends.
        const clipId = `${idPrefix}-axis${df}_${dr}`;

        // Every ray ends on its last square, whether it ran out of board, was
        // stopped by a piece, or simply reached a king's one-square limit. That
        // end is trimmed to the inner square: two of its sides at once on a
        // diagonal, giving an arrow, and a single side on a rank or file,
        // giving a flat edge at the same depth.
        const clipBox = (hit: RaySquare, sense: 1 | -1, ray: RaySquare[]) =>
          hit === ray[ray.length - 1]
            ? rayEndBox(
                hit.square,
                [df * sense, dr * sense],
                innerHalfSide,
                orientation
              )
            : squareBox(hit.square, orientation);

        return (
          <g key={`${df},${dr}`}>
            <clipPath id={clipId}>
              {axis.positive.map((hit) => (
                <rect key={hit.square} {...clipBox(hit, 1, axis.positive)} />
              ))}
              {axis.negative.map((hit) => (
                <rect key={hit.square} {...clipBox(hit, -1, axis.negative)} />
              ))}
            </clipPath>

            <g clipPath={`url(#${clipId})`}>
              {bands.map((band, index) => {
                const shift = {
                  x: normal.x * band.offset,
                  y: normal.y * band.offset,
                };
                const draw = (ray: RaySquare[], steps: Step[], sense: 1 | -1) =>
                  ray.flatMap((hit) =>
                    squareRuns(hit, steps).map((run, part) =>
                      stroke(
                        axis,
                        sense,
                        run,
                        band,
                        shift,
                        `${hit.square}-${index}-${part}`
                      )
                    )
                  );
                return (
                  <g key={index}>
                    {draw(axis.positive, positiveSteps, 1)}
                    {draw(axis.negative, negativeSteps, -1)}
                  </g>
                );
              })}
            </g>

            <g clipPath={`url(#${hubClipId})`}>
              {bands.map((band, index) => {
                const shift = {
                  x: normal.x * band.offset,
                  y: normal.y * band.offset,
                };
                // Only where a ray actually leaves: a rook on a1 has no ray
                // running off the board, so nothing crosses its square that way.
                const half = { from: 0, to: 0.5, intensity: 1 };
                return (
                  <g key={index}>
                    {axis.positive.length > 0 &&
                      stroke(axis, 1, half, band, shift, `pos-${index}`)}
                    {axis.negative.length > 0 &&
                      stroke(axis, -1, half, band, shift, `neg-${index}`)}
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
