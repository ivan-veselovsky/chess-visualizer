import type { Square } from "chess.js";

/** Which side is at the bottom of the board. */
export type Orientation = "white" | "black";

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** All sizes are in SVG user units; the board is scaled via the viewBox. */
export const SQUARE_SIZE = 64;
export const BOARD_SIZE = FILES.length * SQUARE_SIZE;
/** Margin around the board that carries the file/rank labels. */
export const BORDER_SIZE = 24;
export const CANVAS_SIZE = BOARD_SIZE + 2 * BORDER_SIZE;

export interface Point {
  x: number;
  y: number;
}

/** 0 for file "a" .. 7 for file "h". */
export function fileIndex(square: Square): number {
  return square.charCodeAt(0) - "a".charCodeAt(0);
}

/** 0 for rank 1 .. 7 for rank 8. */
export function rankIndex(square: Square): number {
  return square.charCodeAt(1) - "1".charCodeAt(0);
}

export function squareName(file: number, rank: number): Square {
  return `${FILES[file]}${RANKS[rank]}` as Square;
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
