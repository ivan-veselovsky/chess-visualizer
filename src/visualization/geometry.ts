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

/**
 * Path for the ring of squares a king attacks: a rounded square centred on the
 * king, whose straight sides run through the centres of the four orthogonal
 * neighbours and whose corner arcs are quarter circles inscribed in the four
 * diagonal neighbours.
 *
 * The half-side is one square, so the sides land exactly on the neighbouring
 * centres; the corner radius is half a square, so each arc starts and ends on
 * the edges of its diagonal square.
 */
export function kingAttackRingPath(
  square: Square,
  orientation: Orientation = "white"
): string {
  const { x: cx, y: cy } = squareCenter(square, orientation);
  const half = SQUARE_SIZE;
  const radius = SQUARE_SIZE / 2;

  const left = cx - half;
  const right = cx + half;
  const top = cy - half;
  const bottom = cy + half;

  // Clockwise from the top-left arc end; every arc sweeps in the same direction.
  const arc = `a ${radius} ${radius} 0 0 1`;
  return [
    `M ${left + radius} ${top}`,
    `H ${right - radius}`,
    `${arc} ${radius} ${radius}`,
    `V ${bottom - radius}`,
    `${arc} ${-radius} ${radius}`,
    `H ${left + radius}`,
    `${arc} ${-radius} ${-radius}`,
    `V ${top + radius}`,
    `${arc} ${radius} ${-radius}`,
    "Z",
  ].join(" ");
}
