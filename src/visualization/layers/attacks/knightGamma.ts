import type { Square } from "chess.js";
import {
  SQUARE_SIZE,
  sectorPath,
  squareBox,
  squareCenter,
  type Orientation,
  type Point,
} from "../../geometry";

/**
 * The three sides of an attacked square the gamma geometries are built on.
 *
 * Join the knight's centre to the attacked square's and the line crosses that
 * square's boundary once: the side it crosses is `c`. Of the two sides running
 * off it, the nearer one to where it crossed is `b`, and `d` is opposite `b`.
 *
 * Everything is in screen coordinates, so turning the board round is already
 * accounted for: the squares stay axis-aligned either way and only which side
 * earns which name changes.
 */
export interface TargetSides {
  /** The line each side lies on, as a coordinate and which axis it is fixed in. */
  c: { axis: "x" | "y"; at: number };
  b: { axis: "x" | "y"; at: number };
  d: { axis: "x" | "y"; at: number };
  /** Where the centre-to-centre line met `c`. */
  entry: Point;
  box: { x: number; y: number; width: number; height: number };
}

export function targetSides(
  knight: Square,
  target: Square,
  orientation: Orientation
): TargetSides | null {
  return targetSidesAt(
    squareCenter(knight, orientation),
    squareCenter(target, orientation),
    squareBox(target, orientation)
  );
}

/**
 * The same, for a square given by where it is rather than by name.
 *
 * A knight's move can run off the board, and the corner figures on its own
 * square are drawn as though both moves into a corner existed — so the square
 * one of them would have landed on has to be describable without being real.
 */
function targetSidesAt(
  from: Point,
  to: Point,
  box: { x: number; y: number; width: number; height: number }
): TargetSides | null {
  const [x0, y0] = [box.x, box.y];
  const [x1, y1] = [box.x + box.width, box.y + box.height];

  // The first of the four edge lines the segment reaches. Gathered rather than
  // tracked in a closure, which TypeScript cannot narrow afterwards.
  const crossings = ([
    ["x", x0], ["x", x1], ["y", y0], ["y", y1],
  ] as const)
    .flatMap(([axis, at]) => {
      const span = axis === "x" ? to.x - from.x : to.y - from.y;
      if (span === 0) {
        return [];
      }
      const t = (at - (axis === "x" ? from.x : from.y)) / span;
      if (t <= 0 || t > 1) {
        return [];
      }
      const point = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      };
      const within =
        axis === "x"
          ? point.y >= y0 - 1e-6 && point.y <= y1 + 1e-6
          : point.x >= x0 - 1e-6 && point.x <= x1 + 1e-6;
      return within ? [{ t, axis, at, point }] : [];
    })
    .sort((a, b) => a.t - b.t);

  const first = crossings[0];
  if (first === undefined) {
    return null;
  }
  const { axis, at, point } = first;

  // The two sides running off `c`; `b` is the one the crossing landed nearer.
  const across: "x" | "y" = axis === "x" ? "y" : "x";
  const [low, high] = across === "x" ? [x0, x1] : [y0, y1];
  const where = across === "x" ? point.x : point.y;
  const nearer = Math.abs(where - low) <= Math.abs(where - high) ? low : high;
  const farther = nearer === low ? high : low;

  return {
    c: { axis, at },
    b: { axis: across, at: nearer },
    d: { axis: across, at: farther },
    entry: point,
    box,
  };
}

/**
 * Where the ring's outer edge meets a given side of the square, on the side of
 * the knight the square itself lies. Null when the circle misses that line.
 */
export function outerMeeting(
  knight: Point,
  side: { axis: "x" | "y"; at: number },
  box: { x: number; y: number; width: number; height: number },
  radius: number
): Point | null {
  const across = side.at - (side.axis === "x" ? knight.x : knight.y);
  const reach = radius ** 2 - across ** 2;
  if (reach <= 0) {
    return null;
  }
  const along = Math.sqrt(reach);
  const base = side.axis === "x" ? knight.y : knight.x;
  const low = side.axis === "x" ? box.y : box.x;
  const middle = low + (side.axis === "x" ? box.height : box.width) / 2;
  const meeting =
    Math.abs(base + along - middle) < Math.abs(base - along - middle)
      ? base + along
      : base - along;
  return side.axis === "x"
    ? { x: side.at, y: meeting }
    : { x: meeting, y: side.at };
}

/**
 * An angle brought within half a turn of what it is being compared against.
 *
 * A sector's span arrives measured from zero upwards while `atan2` answers
 * between -π and π; comparing the two as they come would put one end most of a
 * turn from the other and leave an arc running nearly the whole way round.
 */
function near(angle: number, reference: number): number {
  const turn = Math.PI * 2;
  return angle + Math.round((reference - angle) / turn) * turn;
}

/**
 * How far past the corner's radius the arc runs on towards `b`, in square
 * sides. Larger leaves less daylight at `b`, not more.
 */
const CLEARANCE_FROM_B = 0.1;

/**
 * The arc's span with the end away from `d` brought in to the radius through
 * the corner where `c` and `b` meet.
 *
 * The other end is left exactly where it was — it is the ray out to where the
 * outer circle meets `d`, which the stripe is anchored on too, and moving it
 * would part the two.
 */
export function spanFromCorner(
  knight: Point,
  sides: TargetSides,
  outerRadius: number,
  thickness: number,
  span: [number, number]
): [number, number] {
  const { b, c, box } = sides;
  const onD = outerMeeting(knight, sides.d, box, outerRadius);
  if (onD === null) {
    return span;
  }
  const middle = (span[0] + span[1]) / 2;
  const atD = near(Math.atan2(onD.y - knight.y, onD.x - knight.x), middle);
  const kept =
    Math.abs(span[0] - atD) < Math.abs(span[1] - atD) ? span[0] : span[1];

  const corner: Point =
    c.axis === "x" ? { x: c.at, y: b.at } : { x: b.at, y: c.at };
  const atCorner = near(
    Math.atan2(corner.y - knight.y, corner.x - knight.x),
    kept
  );

  /*
    Turned a little further on towards `b`. The corner's bare radius leaves the
    arc ending sooner than it looks as though it should, the corner being well
    inside the ring; a set distance along the ring carries the end back out to
    where the eye expects it, while still leaving daylight before `b`.

    A set distance rather than one taken from the ring's own thickness: tying it
    to the ring closes the gap almost to nothing as the ring is widened, and a
    couple of pixels of daylight reads as none at all.
  */
  const further = (CLEARANCE_FROM_B * SQUARE_SIZE) / outerRadius;
  const reached = atCorner + Math.sign(atCorner - kept) * further;
  return [Math.min(kept, reached), Math.max(kept, reached)];
}

/**
 * The arc's span with the end towards `b` brought in to the far side of the
 * stripe that comes up to meet it there.
 *
 * The first diagonal does the same thing at its other end, where arc and stripe
 * share the radius out to `d`. Left alone, the arc runs on past its stripe to
 * `b` and leaves a step at the join, the arc being wider there than the stripe
 * that arrives.
 */
export function spanToStripe(
  knight: Point,
  sides: TargetSides,
  outerRadius: number,
  thickness: number,
  span: [number, number]
): [number, number] {
  const stripe = diagonalTailFromB(knight, sides, outerRadius, thickness);
  const onD = outerMeeting(knight, sides.d, sides.box, outerRadius);
  if (stripe === null || onD === null) {
    return span;
  }

  const middle = (span[0] + span[1]) / 2;
  const atD = near(Math.atan2(onD.y - knight.y, onD.x - knight.x), middle);
  const kept =
    Math.abs(span[0] - atD) < Math.abs(span[1] - atD) ? span[0] : span[1];

  // The stripe's two sides: one runs through the b/c corner, the other is the
  // far one, and it is the far one the arc should stop on.
  const { b, c } = sides;
  const corner: Point =
    c.axis === "x" ? { x: c.at, y: b.at } : { x: b.at, y: c.at };
  const atCorner = Math.atan2(corner.y - knight.y, corner.x - knight.x);
  const far =
    Math.abs(near(stripe.from, atCorner) - atCorner) >
    Math.abs(near(stripe.to, atCorner) - atCorner)
      ? stripe.from
      : stripe.to;

  const reached = near(far, kept);
  return [Math.min(kept, reached), Math.max(kept, reached)];
}

/**
 * The second diagonal's stripe: a sector running out from the corner where `b`
 * and `c` meet to the ring's inner edge, so it meets the arc from beneath,
 * along `b`, rather than from above along `d`.
 *
 * The side towards `d` is the radius through that corner. The other is turned
 * away from `d` by just enough that the wedge would be the ring's thickness
 * across where it met the ring's outer edge — the same rule the first diagonal
 * uses, so the two stripes are the same width where they touch the ring.
 *
 * That corner is a corner of the square, so the square itself decides where the
 * stripe begins, and the ring's inner circle where it ends.
 */
export function diagonalTailFromB(
  knight: Point,
  sides: TargetSides,
  outerRadius: number,
  thickness: number
): { path: string; from: number; to: number } | null {
  const { b, c, d } = sides;
  const corner: Point =
    c.axis === "x" ? { x: c.at, y: b.at } : { x: b.at, y: c.at };

  const ray = { x: corner.x - knight.x, y: corner.y - knight.y };
  const length = Math.hypot(ray.x, ray.y);
  if (length === 0) {
    return null;
  }
  const unit = { x: ray.x / length, y: ray.y / length };
  const across = { x: -unit.y, y: unit.x };

  // Turned away from the corner where `d` meets `c`, which is to say away from
  // `d` — the stripe lies on the `b` side of the radius through its own corner.
  const far: Point =
    d.axis === "x" ? { x: d.at, y: c.at } : { x: c.at, y: d.at };
  const towardsD =
    (far.x - corner.x) * across.x + (far.y - corner.y) * across.y;

  const spread = Math.asin(Math.min(thickness / outerRadius, 1));
  const first = Math.atan2(ray.y, ray.x);
  const second = first + (towardsD > 0 ? -spread : spread);
  const from = Math.min(first, second);
  const to = Math.max(first, second);

  return {
    path: sectorPath(knight, from, to, outerRadius + SQUARE_SIZE),
    from,
    to,
  };
}

/**
 * Diagonal gamma's stripe, as a sector: a wedge whose two sides are both radii
 * out of the knight's centre.
 *
 * One of those radii runs through the point where the ring's outer edge meets
 * `d`, which is the same ray the arc is cut on, so the two meet without a seam.
 * The other is turned away from the corner where `d` meets `c`, by just enough
 * that the wedge is the ring's own thickness where it joins the ring — narrowing
 * as it runs inward, the way anything drawn out of a centre does.
 *
 * Returned as a wedge reaching well past the ring, to be clipped by the square,
 * by the ring's outer circle, and — for the second of the two diagonals — by
 * `stopRadius`, the radius at which the first side runs out through `c`.
 *
 * The two bounding angles come back as well, so that wedges sharing a corner of
 * the knight's own square can be joined into one figure there.
 */
export function diagonalGammaSector(
  knight: Point,
  sides: TargetSides,
  outerRadius: number,
  thickness: number
): { path: string; stopRadius: number; from: number; to: number } | null {
  const { c, d, box } = sides;
  const onD = outerMeeting(knight, d, box, outerRadius);
  if (onD === null) {
    return null;
  }

  const ray = { x: onD.x - knight.x, y: onD.y - knight.y };
  const length = Math.hypot(ray.x, ray.y);
  if (length === 0) {
    return null;
  }
  const unit = { x: ray.x / length, y: ray.y / length };

  // Where the first side runs out through `c`. It is a radius, so how far along
  // it that happens is the radius itself.
  const towards = c.axis === "x" ? unit.x : unit.y;
  if (towards === 0) {
    return null;
  }
  const stopRadius = (c.at - (c.axis === "x" ? knight.x : knight.y)) / towards;
  if (!(stopRadius > 0) || stopRadius >= outerRadius) {
    return null;
  }

  // Wide enough to be `thickness` across where it meets the ring's outer edge.
  const spread = Math.asin(Math.min(thickness / outerRadius, 1));
  const first = Math.atan2(ray.y, ray.x);

  // Turned away from the corner where `d` and `c` meet.
  const corner: Point =
    d.axis === "x" ? { x: d.at, y: c.at } : { x: c.at, y: d.at };
  const across = { x: -unit.y, y: unit.x };
  const towardCorner =
    (corner.x - onD.x) * across.x + (corner.y - onD.y) * across.y;
  const second = first + (towardCorner > 0 ? -spread : spread);

  const far = outerRadius + SQUARE_SIZE;
  const from = Math.min(first, second);
  const to = Math.max(first, second);
  return { path: sectorPath(knight, from, to, far), stopRadius, from, to };
}
