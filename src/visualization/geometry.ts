import type { Square } from "chess.js";
import { FILES, RANKS, fileIndex, rankIndex } from "../chess/model";

// Re-exported so the layers have a single import for everything layout-related.
export { FILES, RANKS };

/** Which side is at the bottom of the board. */
export type Orientation = "white" | "black";

/** All sizes are in SVG user units; the board is scaled via the viewBox. */
export const SQUARE_SIZE = 64;
export const BOARD_SIZE = FILES.length * SQUARE_SIZE;
/** Margin around the board that carries the file/rank labels. */
export const BORDER_SIZE = 24;
export const CANVAS_SIZE = BOARD_SIZE + 2 * BORDER_SIZE;

/**
 * A thousandth of a square side. Lengths are given in square sides throughout,
 * but a hairline is a couple of thousandths of one, and "0.01" is harder to set
 * by eye than "10".
 */
export const MILLI_SQUARE = SQUARE_SIZE / 1000;

/** Opacity of an undimmed attack stripe. */
export const ATTACK_BASE_OPACITY = 0.55;

export interface Point {
  x: number;
  y: number;
}

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
 * to inherit, so it is given a blunter point of its own.
 */
const DIAGONAL_TIP_ANGLE = 90;
const ORTHOGONAL_TIP_ANGLE = 120;

/**
 * The region a ray may occupy up to where it stops on `square`: a wedge with
 * its point on the inner square, opening backwards along the ray.
 *
 * The point sits at the farthest reach of the inner square along the ray — its
 * corner for a diagonal, the middle of a side for a rank or file — so every
 * ray stops at the same depth however it is angled. Only the sharpness differs.
 *
 * At 90 degrees the wedge is precisely the quadrant cut by the two sides of the
 * inner square, which is where the shape came from; the orthogonal case simply
 * opens that angle out, having no corner of its own to follow.
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
 * A rectangle as a closed subpath, with its corners rounded by `radius`. The
 * radius is clamped to half the shorter side, and zero gives plain corners.
 */
export function roundedRectPath(box: Rect, radius: number): string {
  const r = Math.min(Math.max(radius, 0), box.width / 2, box.height / 2);
  const { x, y, width: w, height: h } = box;

  if (r === 0) {
    return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
  }
  const arc = `a ${r} ${r} 0 0 1`;
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `${arc} ${r} ${r}`,
    `V ${y + h - r}`,
    `${arc} ${-r} ${r}`,
    `H ${x + r}`,
    `${arc} ${-r} ${-r}`,
    `V ${y + r}`,
    `${arc} ${r} ${-r}`,
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
