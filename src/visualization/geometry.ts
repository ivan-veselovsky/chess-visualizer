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

/** Opacity of an undimmed attack stripe. */
export const ATTACK_BASE_OPACITY = 0.55;

export interface Point {
  x: number;
  y: number;
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
 * The part of a square a ray may reach when it ends there: everything not past
 * the sides of the inner square that lie farthest along the ray.
 *
 * Those sides are axis-aligned, so the result is simply a smaller rectangle. A
 * diagonal ray is bounded by two of them at once and comes to a point at the
 * corner where they meet, which is what turns its end into an arrow; an
 * orthogonal ray meets only one and keeps a flat end.
 *
 * `halfSide` is half the inner square's side, in pixels.
 */
export function rayEndBox(
  square: Square,
  direction: readonly [number, number],
  halfSide: number,
  orientation: Orientation = "white"
): Point & { width: number; height: number } {
  const box = squareBox(square, orientation);
  const center = squareCenter(square, orientation);
  const step = stepVector(direction, orientation);

  let { x, y, width, height } = box;
  if (step.x > 0) {
    width = Math.min(box.x + box.width, center.x + halfSide) - x;
  } else if (step.x < 0) {
    x = Math.max(box.x, center.x - halfSide);
    width = box.x + box.width - x;
  }
  if (step.y > 0) {
    height = Math.min(box.y + box.height, center.y + halfSide) - y;
  } else if (step.y < 0) {
    y = Math.max(box.y, center.y - halfSide);
    height = box.y + box.height - y;
  }
  return { x, y, width, height };
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
