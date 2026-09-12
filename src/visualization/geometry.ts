import type { Square } from "chess.js";
/*
  Written with its extension, like the other modules `tests/unit.mjs` runs
  straight from the TypeScript: node resolves what is written and guesses at
  nothing.
*/
import { FILES, RANKS, fileIndex, rankIndex, squareAt } from "../chess/model.ts";

// Re-exported so the layers have a single import for everything layout-related.
export { FILES, RANKS };

/** Which side is at the bottom of the board. */
export type Orientation = "white" | "black";

/**
 * Which set of settings a piece is drawn with.
 *
 * Not the piece's colour but its end of the board: the near side is always
 * "me" and the far side always "opponent", so flipping the board hands the
 * near-side settings to the other army rather than turning the board's whole
 * appearance upside down with it.
 */
export type SettingsSide = "me" | "opponent";

export function settingsSide(
  color: "w" | "b",
  orientation: Orientation = "white"
): SettingsSide {
  const nearest = orientation === "black" ? "b" : "w";
  return color === nearest ? "me" : "opponent";
}

/** All sizes are in SVG user units; the board is scaled via the viewBox. */
export const SQUARE_SIZE = 64;
export const BOARD_SIZE = FILES.length * SQUARE_SIZE;
export interface Point {
  x: number;
  y: number;
}

/** Margin carrying the file/rank labels. */
export const BORDER_SIZE = 24;

/**
 * Where the board's own coordinates begin within the canvas.
 *
 * Only two margins are wanted: BorderLayer sets the rank labels down the left
 * and the file labels along the bottom, whichever way round the board is, so
 * margins above and to the right would only be blank. Dropping one from each
 * axis leaves the canvas square, which the pointer mapping depends on.
 */
export const BOARD_ORIGIN: Point = { x: BORDER_SIZE, y: 0 };
export const CANVAS_SIZE = BOARD_SIZE + BORDER_SIZE;

export interface Rect extends Point {
  width: number;
  height: number;
}

/** Light squares are the ones where file and rank indices have different parity. */
export function isLightSquare(file: number, rank: number): boolean {
  return (file + rank) % 2 === 1;
}

/** Top-left corner of a square, in board coordinates (border excluded). */
export function squareTopLeft(
  file: number,
  rank: number,
  orientation: Orientation = "white"
): Point {
  const flipped = orientation === "black";
  const column = flipped ? FILES.length - 1 - file : file;
  const row = flipped ? rank : RANKS.length - 1 - rank;
  return { x: column * SQUARE_SIZE, y: row * SQUARE_SIZE };
}

/** Centre of a square, in board coordinates (border excluded). */
export function squareCenter(
  square: Square,
  orientation: Orientation = "white"
): Point {
  const { x, y } = squareTopLeft(
    fileIndex(square),
    rankIndex(square),
    orientation
  );
  return { x: x + SQUARE_SIZE / 2, y: y + SQUARE_SIZE / 2 };
}

/** Bounding box of a square, in board coordinates. */
export function squareBox(
  square: Square,
  orientation: Orientation = "white"
): Point & { width: number; height: number } {
  const { x, y } = squareTopLeft(
    fileIndex(square),
    rankIndex(square),
    orientation
  );
  return { x, y, width: SQUARE_SIZE, height: SQUARE_SIZE };
}

/**
 * The square containing a point in board coordinates, or null when the point
 * falls outside the board. The inverse of squareTopLeft.
 */
export function squareAtPoint(
  point: Point,
  orientation: Orientation = "white"
): Square | null {
  const column = Math.floor(point.x / SQUARE_SIZE);
  const row = Math.floor(point.y / SQUARE_SIZE);
  if (
    column < 0 ||
    column >= FILES.length ||
    row < 0 ||
    row >= RANKS.length
  ) {
    return null;
  }
  const flipped = orientation === "black";
  return squareAt(
    flipped ? FILES.length - 1 - column : column,
    flipped ? row : RANKS.length - 1 - row
  );
}

/**
 * A (file, rank) offset expressed in screen pixels. Rank grows upward on the
 * board but downward in SVG, and flipping the board negates both axes.
 */
export function stepVector(
  [df, dr]: readonly [number, number],
  orientation: Orientation = "white"
): Point {
  const sign = orientation === "black" ? -1 : 1;
  return { x: sign * df * SQUARE_SIZE, y: -sign * dr * SQUARE_SIZE };
}

/** Unit vector at right angles to `direction`, in screen space. */
export function perpendicular(
  direction: readonly [number, number],
  orientation: Orientation = "white"
): Point {
  const { x, y } = stepVector(direction, orientation);
  const length = Math.hypot(x, y);
  return { x: -y / length, y: x / length };
}

/**
 * Angle, in degrees, of the point a ray is cut to where it stops — at its end
 * and wherever it dims behind a piece.
 *
 * A diagonal is cut by the two sides of the inner square meeting at the corner
 * it reaches, which are at right angles, so 90 is not a choice but a
 * description. An orthogonal ray reaches the middle of a side and has no corner
 * to inherit; it is given the same angle so that an end looks like an end
 * whichever way the ray runs. Kept as two constants because only one of them
 * is a description — the other could be changed.
 */
const DIAGONAL_TIP_ANGLE = 90;
const ORTHOGONAL_TIP_ANGLE = 90;

/**
 * The region a ray may occupy up to where it stops on `square`: a wedge with
 * its point on the inner square, opening backwards along the ray.
 *
 * The point sits at the farthest reach of the inner square along the ray — its
 * corner for a diagonal, the middle of a side for a rank or file — so every
 * ray stops at the same depth however it is angled. Only the sharpness differs.
 *
 * At 90 degrees the wedge is precisely the quadrant cut by the two sides of the
 * inner square, which is where the shape came from; the orthogonal case takes
 * the same angle across a side it meets square on.
 */
/**
 * Where a ray stops on the square it reaches: the far side of that square's
 * small inner square, measured along the ray.
 *
 * The point of the wedge below, and the point of a needle, are the same place —
 * taken from here by both so that a needle ends exactly where a stripe ends,
 * whatever either of them is drawn with.
 */
export function rayStopTip(
  square: Square,
  direction: readonly [number, number],
  halfSide: number,
  orientation: Orientation = "white"
): { x: number; y: number } {
  const step = stepVector(direction, orientation);
  const length = Math.hypot(step.x, step.y);
  const along = { x: step.x / length, y: step.y / length };
  /*
    Half a side along the ray, whichever way it runs — not as far as the corner
    on a diagonal.

    An inner square measured to its corner reaches half again as far on a
    diagonal as on a rank, so a queen's eight marks began and ended at two
    different distances and her figure came out square-ish rather than even.
    Measured this way the eight are all the same distance out, and the cuts,
    each square across its own ray, are the sides of a regular octagon.
  */
  const center = squareCenter(square, orientation);
  return { x: center.x + along.x * halfSide, y: center.y + along.y * halfSide };
}

export function rayStopWedgePath(
  square: Square,
  direction: readonly [number, number],
  halfSide: number,
  orientation: Orientation = "white"
): string {
  const step = stepVector(direction, orientation);
  const length = Math.hypot(step.x, step.y);
  const along = { x: step.x / length, y: step.y / length };
  const tip = rayStopTip(square, direction, halfSide, orientation);

  const diagonal = direction[0] !== 0 && direction[1] !== 0;
  const halfAngle =
    (((diagonal ? DIAGONAL_TIP_ANGLE : ORTHOGONAL_TIP_ANGLE) / 2) * Math.PI) /
    180;
  const cos = Math.cos(halfAngle);
  const sin = Math.sin(halfAngle);
  const back = { x: -along.x, y: -along.y };

  // Long enough that the wedge leaves the board before it closes.
  const far = 4 * BOARD_SIZE;
  const edges = [
    { x: back.x * cos - back.y * sin, y: back.x * sin + back.y * cos },
    { x: back.x * cos + back.y * sin, y: -back.x * sin + back.y * cos },
  ].map((edge) => `${tip.x + edge.x * far} ${tip.y + edge.y * far}`);

  return `M ${tip.x} ${tip.y} L ${edges[0]} L ${edges[1]} Z`;
}

/**
 * Where a ray picks up again once it has passed through a piece: everything
 * beyond where it stopped on that piece's square.
 *
 * The complement of the wedge `rayStopWedgePath` gives, so that the stretch
 * before a piece and the stretch after it are exactly the two halves of one
 * ray: the brighter one ends in a point on the small inner square, and the
 * dimmer one begins in the notch that point leaves. Nothing is drawn twice and
 * nothing is missed, whatever either stretch is drawn with.
 *
 * A ray that sets off from a piece begins on a straight cut instead — see
 * `rayStartPlanePath` — and leaves the clear gap around the glyph that a mark
 * arriving at that square also leaves. One passed straight through has no such
 * gap to leave: what is on the far side is the same ray, carried on.
 *
 * Two subpaths, the board and the wedge, to be filled even-odd: the caller has
 * to say `clip-rule="evenodd"`, or it will get the wedge itself back.
 */
export function rayResumePath(
  square: Square,
  direction: readonly [number, number],
  halfSide: number,
  orientation: Orientation = "white"
): string {
  /* Wide enough to hold every square of the board and whatever a mark paints
     past its edge; the wedge may run outside it, which even-odd does not
     mind. */
  const far = BOARD_SIZE;
  const board = [
    `M ${-far} ${-far}`,
    `h ${far * 3}`,
    `v ${far * 3}`,
    `h ${-far * 3}`,
    "Z",
  ].join(" ");
  return `${board} ${rayStopWedgePath(square, direction, halfSide, orientation)}`;
}

/**
 * The region a ray may occupy from where it starts: everything at or beyond a
 * straight cut taken square across the ray, half a side out from the centre.
 *
 * Half a side whichever way the ray runs, so that the eight marks of a queen
 * set off from one octagon rather than reaching further on the diagonals than
 * on the ranks and files. The cut is square across the ray, and on a diagonal
 * that makes it a chord of the inner square rather than anything to do with
 * its corner.
 */
/**
 * Where a needle's base sits: a chord square across the ray, half a side out
 * from the centre.
 *
 * The same distance whichever way the ray runs, so the eight bases of a queen
 * stand on one octagon; and square across, so the base is the width the reader
 * set, exactly, on a diagonal as on a file. A knight's eight are measured the
 * same way, their lines being oblique to the board but no different in this.
 */
export function rayBaseChord(
  center: { x: number; y: number },
  along: { x: number; y: number },
  halfSide: number,
  halfWidth: number
): [{ x: number; y: number }, { x: number; y: number }] {
  const across = { x: -along.y, y: along.x };
  const from = {
    x: center.x + along.x * halfSide,
    y: center.y + along.y * halfSide,
  };
  return [
    { x: from.x + across.x * halfWidth, y: from.y + across.y * halfWidth },
    { x: from.x - across.x * halfWidth, y: from.y - across.y * halfWidth },
  ];
}

/** The two shapes a needle can be given: straight-sided, or curved. */
export type NeedleShape = "triangle" | "ellipse";

/**
 * One ray as a needle: a shape whose base is the ray's own width, on the
 * boundary of the square the ray leaves, and whose point is where the ray
 * stops.
 *
 * The base is the same place and the same width a stripe has there — so
 * needles and stripes begin alike and differ only in what happens along the
 * way: one keeps its width to the end, the other closes to a point on the
 * square it attacks.
 *
 * A "triangle" gets there in straight lines, shedding width at a constant rate,
 * so a long ray is a hair from the halfway mark on. An "ellipse" is half of
 * one, its short axis lying across the square the ray leaves and its long axis
 * running down the ray: the sides set off square across the ray and bend in
 * slowly, so a ray keeps its weight for most of its length and gives it up near
 * the end.
 *
 * The ellipse is drawn as two quarter-arcs rather than one half: an arc is
 * drawn between its endpoints, and passing through the tip is the whole point
 * of this one.
 */
export function needlePath(
  base: readonly [{ x: number; y: number }, { x: number; y: number }],
  to: { x: number; y: number },
  shape: NeedleShape
): string {
  if (shape === "triangle") {
    return [
      `M ${base[0].x} ${base[0].y}`,
      `L ${to.x} ${to.y}`,
      `L ${base[1].x} ${base[1].y}`,
      "Z",
    ].join(" ");
  }
  const middle = {
    x: (base[0].x + base[1].x) / 2,
    y: (base[0].y + base[1].y) / 2,
  };
  const run = { x: to.x - middle.x, y: to.y - middle.y };
  const along = Math.hypot(run.x, run.y);
  const across = Math.hypot(base[0].x - base[1].x, base[0].y - base[1].y) / 2;
  if (along === 0 || across === 0) {
    return "";
  }
  /* The ellipse is turned to lie down the ray: its first radius runs that way
     and its second across. */
  const turn = (Math.atan2(run.y, run.x) * 180) / Math.PI;
  /*
    Which way round the two quarters sweep.

    The first corner is on one side of the ray and the second on the other, and
    which side is which depends on how the board is turned — so it is worked out
    from the corners themselves rather than assumed: the sign of the first
    corner against the ray decides it.
  */
  const side =
    (base[0].x - middle.x) * run.y - (base[0].y - middle.y) * run.x > 0 ? 1 : 0;
  const arc = (to: { x: number; y: number }) =>
    `A ${along} ${across} ${turn} 0 ${side} ${to.x} ${to.y}`;
  return [
    `M ${base[0].x} ${base[0].y}`,
    arc(to),
    arc({ x: base[1].x, y: base[1].y }),
    "Z",
  ].join(" ");
}

export function rayStartPlanePath(
  square: Square,
  direction: readonly [number, number],
  halfSide: number,
  orientation: Orientation = "white"
): string {
  return cutPlanePath(square, direction, halfSide, orientation, 1);
}

/**
 * The other half of the same cut: everything a ray covers before it reaches
 * that square's inner square.
 *
 * The two together are the whole of the ray, divided on one straight line —
 * which is what a weight that changes part way along a single shape wants. The
 * line is square across the ray: on a rank or a file it lies along the face of
 * the inner square the ray meets; on a diagonal it joins the two points where
 * the ray's own sides cross that square, which for a ray at 45 degrees is a
 * line at 45 degrees the other way.
 */
export function rayBeforeCutPath(
  square: Square,
  direction: readonly [number, number],
  halfSide: number,
  orientation: Orientation = "white"
): string {
  return cutPlanePath(square, direction, halfSide, orientation, -1);
}

/** One side or the other of the cut both of the above are taken from. */
function cutPlanePath(
  square: Square,
  direction: readonly [number, number],
  halfSide: number,
  orientation: Orientation,
  sense: 1 | -1
): string {
  const step = stepVector(direction, orientation);
  const length = Math.hypot(step.x, step.y);
  const along = { x: step.x / length, y: step.y / length };
  return cutPlaneFrom(
    squareCenter(square, orientation),
    along,
    halfSide,
    sense
  );
}

/**
 * The same cut, taken from a centre and a heading rather than from a square and
 * one of the board's own directions.
 *
 * For a knight, whose eight marks run at angles the board has no name for: the
 * rule they start by is the rule everything else starts by — half a side out,
 * square across the ray — and it is written once, here.
 */
export function cutPlaneFrom(
  center: Point,
  along: Point,
  halfSide: number,
  sense: 1 | -1 = 1
): string {
  // Half a side out, the same on every ray; never behind the centre.
  const start = Math.max(halfSide, 0);

  const from = { x: center.x + along.x * start, y: center.y + along.y * start };
  const across = { x: -along.y, y: along.x };

  // Long enough that the region leaves the board on every side.
  const far = 4 * BOARD_SIZE;
  const away = { x: along.x * far * sense, y: along.y * far * sense };
  const corners = [
    { x: from.x + across.x * far, y: from.y + across.y * far },
    { x: from.x - across.x * far, y: from.y - across.y * far },
  ];
  return [
    `M ${corners[0].x} ${corners[0].y}`,
    `L ${corners[1].x} ${corners[1].y}`,
    `L ${corners[1].x + away.x} ${corners[1].y + away.y}`,
    `L ${corners[0].x + away.x} ${corners[0].y + away.y}`,
    "Z",
  ].join(" ");
}

const TWO_PI = Math.PI * 2;

/** An angle brought into [0, 2π). */
function normalizeAngle(angle: number): number {
  const wrapped = angle % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

/** Every angle at which a circle about `center` meets a side of `rect`. */
function edgeCrossings(center: Point, radius: number, rect: Rect): number[] {
  const angles: number[] = [];
  for (const x of [rect.x, rect.x + rect.width]) {
    const cos = (x - center.x) / radius;
    if (cos >= -1 && cos <= 1) {
      const angle = Math.acos(cos);
      angles.push(normalizeAngle(angle), normalizeAngle(-angle));
    }
  }
  for (const y of [rect.y, rect.y + rect.height]) {
    const sin = (y - center.y) / radius;
    if (sin >= -1 && sin <= 1) {
      const angle = Math.asin(sin);
      angles.push(normalizeAngle(angle), normalizeAngle(Math.PI - angle));
    }
  }
  return angles;
}

/**
 * The widest run of angles over which a whole radial slice of a ring stays
 * inside a rectangle — the largest sector that can be cut from the ring without
 * any part of it leaving the square it belongs to.
 *
 * A radial slice is a straight segment and a rectangle is convex, so the slice
 * is inside exactly when both of its ends are. That leaves only the two
 * bounding circles to test, and only where they cross a side: between two such
 * crossings nothing changes, so one point in each stretch settles it.
 *
 * Angles run clockwise on screen, the board's y pointing down. The end returned
 * is never less than the start, running past 2π where the run wraps. Null means
 * no angle qualifies — a ring too thick to fit inside the square at all.
 */
export function ringSectorInsideRect(
  center: Point,
  innerRadius: number,
  outerRadius: number,
  rect: Rect
): [number, number] | null {
  const inner = Math.min(innerRadius, outerRadius);
  const outer = Math.max(innerRadius, outerRadius);
  if (outer <= 0 || rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const at = (angle: number, radius: number): Point => ({
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  });
  const within = ({ x, y }: Point): boolean =>
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height;
  const fits = (angle: number): boolean =>
    within(at(angle, inner)) && within(at(angle, outer));

  const cuts = [
    ...edgeCrossings(center, inner, rect),
    ...edgeCrossings(center, outer, rect),
  ].sort((a, b) => a - b);

  if (cuts.length === 0) {
    return fits(0) ? [0, TWO_PI] : null;
  }

  // The stretches between consecutive crossings, each wholly in or wholly out.
  const spans = cuts.map((from, index) => {
    const to = index + 1 < cuts.length ? cuts[index + 1] : cuts[0] + TWO_PI;
    return { from, to, fits: fits((from + to) / 2) };
  });
  if (spans.every((span) => span.fits)) {
    return [spans[0].from, spans[0].from + TWO_PI];
  }

  // The longest run of neighbouring stretches, counted round the circle. Their
  // lengths add up because each begins where the one before it ended.
  let best: [number, number] | null = null;
  for (let start = 0; start < spans.length; start += 1) {
    const previous = spans[(start - 1 + spans.length) % spans.length];
    if (!spans[start].fits || previous.fits) {
      continue;
    }
    let length = 0;
    for (let step = 0; step < spans.length; step += 1) {
      const span = spans[(start + step) % spans.length];
      if (!span.fits) {
        break;
      }
      length += span.to - span.from;
    }
    if (best === null || length > best[1] - best[0]) {
      best = [spans[start].from, spans[start].from + length];
    }
  }
  return best;
}

/**
 * The widest run of angles over which a piece of ring with rounded ends stays
 * inside a rectangle.
 *
 * A round end is a half-disc of the ring's own thickness, so the whole piece —
 * arc and both ends — is the set of points within half a thickness of the
 * middle circle between the two end angles. That piece is inside the square
 * exactly when the middle circle stays half a thickness clear of every side,
 * which is the same question asked of a square shrunk by that much on all four
 * sides.
 *
 * Where the run ends, the end's own half-disc touches the side that stopped it:
 * its centre is exactly half a thickness away, which is what tangency is. A
 * square with no room left for the end at all comes back null.
 */
export function ringCapSpanInsideRect(
  center: Point,
  midRadius: number,
  capRadius: number,
  rect: Rect
): [number, number] | null {
  const room = {
    x: rect.x + capRadius,
    y: rect.y + capRadius,
    width: rect.width - capRadius * 2,
    height: rect.height - capRadius * 2,
  };
  const span = ringSectorInsideRect(center, midRadius, midRadius, room);
  /* A run of no width is the middle circle grazing a corner of that shrunken
     square, not a piece of ring worth drawing. */
  return span === null || span[1] - span[0] < 1e-9 ? null : span;
}

/**
 * A sector as a closed subpath: the wedge between two radii, out to `radius`.
 * A run of a full turn has no two edges to draw and comes back as a circle.
 */
export function sectorPath(
  center: Point,
  from: number,
  to: number,
  radius: number
): string {
  const at = (angle: number): string =>
    `${center.x + radius * Math.cos(angle)} ${center.y + radius * Math.sin(angle)}`;

  if (to - from >= TWO_PI - 1e-9) {
    const arc = `A ${radius} ${radius} 0 1 1`;
    return `M ${at(0)} ${arc} ${at(Math.PI)} ${arc} ${at(0)} Z`;
  }
  const largeArc = to - from > Math.PI ? 1 : 0;
  return `M ${center.x} ${center.y} L ${at(from)} A ${radius} ${radius} 0 ${largeArc} 1 ${at(to)} Z`;
}

/**
 * A point `t` steps away from a square's centre along `direction`, where one
 * step is the distance to the neighbouring square along that direction.
 */
export function rayPoint(
  origin: Square,
  direction: readonly [number, number],
  t: number,
  orientation: Orientation = "white"
): Point {
  const center = squareCenter(origin, orientation);
  const step = stepVector(direction, orientation);
  return { x: center.x + step.x * t, y: center.y + step.y * t };
}
