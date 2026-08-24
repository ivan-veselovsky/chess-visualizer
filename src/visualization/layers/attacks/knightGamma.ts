import type { Square } from "chess.js";
import { SQUARE_SIZE, squareBox, squareCenter, type Orientation, type Point } from "../../geometry";

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
  const from = squareCenter(knight, orientation);
  const to = squareCenter(target, orientation);
  const box = squareBox(target, orientation);
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
 * Orthogonal gamma's bar: a stripe of the ring's own thickness lying along `b`,
 * running from where the ring meets it back to `c`.
 *
 * Axis-aligned, which is where the name comes from — it follows the board's
 * own lines rather than the circle's.
 */
export function orthogonalGammaBar(
  knight: Point,
  sides: TargetSides,
  innerRadius: number,
  thickness: number
): { x: number; y: number; width: number; height: number } | null {
  const { b, c, box } = sides;
  // Where the ring's inner edge crosses the line `b` lies on.
  const offset = b.at - (b.axis === "x" ? knight.x : knight.y);
  const reach = innerRadius ** 2 - offset ** 2;
  if (reach <= 0) {
    return null;
  }
  const along = Math.sqrt(reach);
  const centreAlong = b.axis === "x" ? knight.y : knight.x;
  // The crossing on the same side of the knight as the square itself.
  const boxLow = b.axis === "x" ? box.y : box.x;
  const boxHigh = boxLow + (b.axis === "x" ? box.height : box.width);
  const ringAt =
    Math.abs(centreAlong + along - (boxLow + boxHigh) / 2) <
    Math.abs(centreAlong - along - (boxLow + boxHigh) / 2)
      ? centreAlong + along
      : centreAlong - along;

  const start = Math.min(Math.max(ringAt, boxLow), boxHigh);
  const stop = c.at;
  const lowAlong = Math.min(start, stop);
  const size = Math.abs(stop - start);
  if (size <= 0) {
    return null;
  }

  /*
    `b` is one of the box's two sides across the bar's run, and the bar lies on
    whichever side of it is inside the box. Both coordinates here have to be
    read on the across axis — the one `b` is fixed in — which is the opposite of
    the axis the bar runs along.
  */
  const acrossLow = b.axis === "x" ? box.x : box.y;
  const near = b.at === acrossLow ? b.at : b.at - thickness;

  // A side fixed in x runs along y, and the other way about.
  return b.axis === "x"
    ? { x: near, y: lowAlong, width: thickness, height: size }
    : { x: lowAlong, y: near, width: size, height: thickness };
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
 * A square cut back to one side of a line through the knight's centre — the
 * ray out to `through`.
 *
 * Orthogonal gamma needs its arc cut radially where it leaves by `d`, as the arc
 * geometry does, while still running out to `b` at the other end for the bar to
 * carry on from. Neither the square alone nor a sector alone says that, so the
 * two are intersected: the square, trimmed against the one radius that matters.
 *
 * `keep` is any point on the side to be kept. Returns null if nothing is left.
 */
export function squareBeyondRadius(
  knight: Point,
  through: Point,
  keep: Point,
  box: { x: number; y: number; width: number; height: number }
): string | null {
  const ray = { x: through.x - knight.x, y: through.y - knight.y };
  const length = Math.hypot(ray.x, ray.y);
  if (length === 0) {
    return null;
  }
  let normal = { x: -ray.y / length, y: ray.x / length };
  if ((keep.x - knight.x) * normal.x + (keep.y - knight.y) * normal.y < 0) {
    normal = { x: -normal.x, y: -normal.y };
  }
  const side = (p: Point) =>
    (p.x - knight.x) * normal.x + (p.y - knight.y) * normal.y;

  // Sutherland–Hodgman against the single half-plane.
  const corners: Point[] = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
  const kept: Point[] = [];
  for (let i = 0; i < corners.length; i += 1) {
    const current = corners[i];
    const previous = corners[(i + corners.length - 1) % corners.length];
    const now = side(current);
    const before = side(previous);
    if (now >= 0 !== before >= 0) {
      const t = before / (before - now);
      kept.push({
        x: previous.x + (current.x - previous.x) * t,
        y: previous.y + (current.y - previous.y) * t,
      });
    }
    if (now >= 0) {
      kept.push(current);
    }
  }
  if (kept.length < 3) {
    return null;
  }
  return `M ${kept.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;
}

/**
 * Diagonal gamma's stripe, as a long band between two parallel lines.
 *
 * One of those lines is strictly radial: it runs from the knight's centre out
 * through the point where the ring's outer edge meets `d`. The other is that
 * line moved sideways by the ring's thickness, away from the corner where `d`
 * and `c` meet — so the band leans across the square rather than clipping its
 * corner off.
 *
 * The band is returned long, to be clipped by the ring's outer circle at one
 * end and by a circle of its own at the other — `stopRadius`, which is where
 * the radial edge runs out through `c`. Both ends are then arcs about the
 * knight, which sits better against the ring than a flat cut along `c` did.
 */
export function diagonalGammaBand(
  knight: Point,
  sides: TargetSides,
  outerRadius: number,
  thickness: number
): { path: string; stopRadius: number } | null {
  const { c, d, box } = sides;
  const offset = d.at - (d.axis === "x" ? knight.x : knight.y);
  const reach = outerRadius ** 2 - offset ** 2;
  if (reach <= 0) {
    return null;
  }
  const along = Math.sqrt(reach);
  const centreAlong = d.axis === "x" ? knight.y : knight.x;
  const boxLow = d.axis === "x" ? box.y : box.x;
  const boxHigh = boxLow + (d.axis === "x" ? box.height : box.width);
  const middle = (boxLow + boxHigh) / 2;
  const meeting =
    Math.abs(centreAlong + along - middle) < Math.abs(centreAlong - along - middle)
      ? centreAlong + along
      : centreAlong - along;

  const onD: Point =
    d.axis === "x"
      ? { x: d.at, y: meeting }
      : { x: meeting, y: d.at };

  const ray = { x: onD.x - knight.x, y: onD.y - knight.y };
  const length = Math.hypot(ray.x, ray.y);
  if (length === 0) {
    return null;
  }
  const unit = { x: ray.x / length, y: ray.y / length };
  const side = { x: -unit.y, y: unit.x };

  // Away from the corner where `d` meets `c`, so the band crosses the square.
  const corner: Point =
    d.axis === "x" ? { x: d.at, y: c.at } : { x: c.at, y: d.at };
  const towardCorner =
    (corner.x - onD.x) * side.x + (corner.y - onD.y) * side.y;
  const sign = towardCorner > 0 ? -1 : 1;
  const shifted = {
    x: onD.x + side.x * thickness * sign,
    y: onD.y + side.y * thickness * sign,
  };

  // Where the radial edge — the one facing `d` — runs out through `c`. The
  // edge is radial, so how far along it that happens is the radius itself.
  const towards = c.axis === "x" ? unit.x : unit.y;
  if (towards === 0) {
    return null;
  }
  const stopRadius =
    (c.at - (c.axis === "x" ? knight.x : knight.y)) / towards;
  if (!(stopRadius > 0) || stopRadius >= outerRadius) {
    return null;
  }

  const far = 4 * SQUARE_SIZE * 8;
  const corners = [
    { x: onD.x + unit.x * far, y: onD.y + unit.y * far },
    { x: onD.x - unit.x * far, y: onD.y - unit.y * far },
    { x: shifted.x - unit.x * far, y: shifted.y - unit.y * far },
    { x: shifted.x + unit.x * far, y: shifted.y + unit.y * far },
  ];
  return {
    path: `M ${corners.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`,
    stopRadius,
  };
}
