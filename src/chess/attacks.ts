import type { Chess, Square } from "chess.js";
import { fileIndex, rankIndex, squareAt } from "./model";

/** A (file, rank) offset. */
export type Direction = readonly [number, number];

/** The eight king steps. */
const KING_STEPS: readonly Direction[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/** The eight knight leaps. */
const KNIGHT_STEPS: readonly Direction[] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

/** The four axes a queen radiates along, one entry per stripe. */
export const QUEEN_AXES: readonly Direction[] = [
  [1, 0], // rank
  [0, 1], // file
  [1, 1], // a1-h8 diagonal
  [1, -1], // h1-a8 diagonal
];

/** Intensity is divided by this for every piece the stripe has passed through. */
const DECAY_PER_BLOCKER = 1 / 3;

/**
 * Squares a king on `square` attacks: the eight neighbours, minus the ones that
 * fall off the board. Occupancy is deliberately ignored — a king attacks a
 * square whether or not something stands on it.
 */
export function kingAttackedSquares(square: Square): Square[] {
  const file = fileIndex(square);
  const rank = rankIndex(square);

  return KING_STEPS.map(([df, dr]) => squareAt(file + df, rank + dr)).filter(
    (target): target is Square => target !== null
  );
}

/**
 * Squares a knight on `square` attacks. Like the king, it leaps, so nothing
 * blocks it and occupancy is irrelevant.
 */
export function knightAttackedSquares(square: Square): Square[] {
  const file = fileIndex(square);
  const rank = rankIndex(square);

  return KNIGHT_STEPS.map(([df, dr]) => squareAt(file + df, rank + dr)).filter(
    (target): target is Square => target !== null
  );
}

/** One square along a ray, with the intensity the stripe has when it gets there. */
export interface RaySquare {
  square: Square;
  /** Distance from the origin square, in steps (1 = adjacent). */
  distance: number;
  /** 1 before any blocker, divided by 3 after each piece the ray has passed. */
  intensity: number;
}

/**
 * Walks outward from `origin` until the board edge, recording every square and
 * its intensity.
 *
 * Unlike normal move generation the ray does not stop at the first piece: it
 * keeps going with the intensity reduced, so a long line stays visible behind
 * whatever stands on it. A blocker's own square is still reported at the
 * intensity the ray had on arrival — the drop applies to what lies beyond it.
 */
export function attackRay(
  chess: Chess,
  origin: Square,
  [df, dr]: Direction
): RaySquare[] {
  const file = fileIndex(origin);
  const rank = rankIndex(origin);
  const squares: RaySquare[] = [];

  let intensity = 1;
  for (let distance = 1; ; distance += 1) {
    const target = squareAt(file + df * distance, rank + dr * distance);
    if (target === null) {
      return squares;
    }

    squares.push({ square: target, distance, intensity });

    if (chess.get(target) !== undefined) {
      intensity *= DECAY_PER_BLOCKER;
    }
  }
}

/**
 * The two opposite rays making up one queen stripe, in axis order: `negative`
 * runs against the axis direction, `positive` along it.
 */
export interface AttackAxis {
  direction: Direction;
  positive: RaySquare[];
  negative: RaySquare[];
}

/** The four stripes radiating from a queen, each decaying independently. */
export function queenAttackAxes(chess: Chess, origin: Square): AttackAxis[] {
  return QUEEN_AXES.map(([df, dr]) => ({
    direction: [df, dr] as Direction,
    positive: attackRay(chess, origin, [df, dr]),
    negative: attackRay(chess, origin, [-df, -dr]),
  }));
}
