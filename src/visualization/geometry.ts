import type { Square } from "chess.js";
import { FILES, RANKS, fileIndex, rankIndex, squareAt } from "../chess/model";

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
export function rayStopWedgePath(
  square: Square,
  direction: readonly [number, number],
  halfSide: number,
  orientation: Orientation = "white"
): string {
  const step = stepVector(direction, orientation);
  const length = Math.hypot(step.x, step.y);
  const along = { x: step.x / length, y: step.y / length };

  // How far the inner square reaches along the ray: to a corner on a diagonal,
  // to the middle of a side otherwise.
  const reach = halfSide * (Math.abs(along.x) + Math.abs(along.y));
  const center = squareCenter(square, orientation);
  const tip = {
    x: center.x + along.x * reach,
    y: center.y + along.y * reach,
  };

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
 * The region a ray may occupy from where it starts: everything at or beyond a
 * straight cut taken square across the ray.
 *
 * The cut runs between the two points where the ray's own sides meet the inner
 * square. On a diagonal those two points lie level with each other — each side
 * crosses one of the two faces the ray heads between, and by symmetry both do
 * so at the same depth — so the ray begins on a chord of the square instead of
 * being notched by its corner. A rank or file crosses a single face square on,
 * where it is level already and its width makes no difference.
 */
export function rayStartPlanePath(
  square: Square,
  direction: readonly [number, number],
  halfSide: number,
  halfWidth: number,
  orientation: Orientation = "white"
): string {
  const step = stepVector(direction, orientation);
  const length = Math.hypot(step.x, step.y);
  const along = { x: step.x / length, y: step.y / length };
  const diagonal = direction[0] !== 0 && direction[1] !== 0;

  // How far the inner square reaches along the ray, then back by the width the
  // ray's own sides cut off. Never behind the centre: a ray broader than the
  // square it leaves would otherwise start on the far side of its own piece.
  const reach = halfSide * (Math.abs(along.x) + Math.abs(along.y));
  const start = Math.max(reach - (diagonal ? halfWidth : 0), 0);

  const center = squareCenter(square, orientation);
  const from = { x: center.x + along.x * start, y: center.y + along.y * start };
  const across = { x: -along.y, y: along.x };

  // Long enough that the region leaves the board on every side.
  const far = 4 * BOARD_SIZE;
  const corners = [
    { x: from.x + across.x * far, y: from.y + across.y * far },
    { x: from.x - across.x * far, y: from.y - across.y * far },
  ];
  return [
    `M ${corners[0].x} ${corners[0].y}`,
    `L ${corners[1].x} ${corners[1].y}`,
    `L ${corners[1].x + along.x * far} ${corners[1].y + along.y * far}`,
    `L ${corners[0].x + along.x * far} ${corners[0].y + along.y * far}`,
    "Z",
  ].join(" ");
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
