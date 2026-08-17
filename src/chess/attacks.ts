import type { Chess, Color, Square } from "chess.js";
import { fileIndex, rankIndex, squareAt } from "./model";

/** A (file, rank) offset. */
export type Direction = readonly [number, number];

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

/** Axes the sliding pieces radiate along, one entry per stripe. */
export const ROOK_AXES: readonly Direction[] = [
  [1, 0], // rank
  [0, 1], // file
];

export const BISHOP_AXES: readonly Direction[] = [
  [1, 1], // a1-h8 diagonal
  [1, -1], // h1-a8 diagonal
];

export const QUEEN_AXES: readonly Direction[] = [...ROOK_AXES, ...BISHOP_AXES];


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

/** The two forward diagonals, by the colour of the pawn taking them. */
const PAWN_STEPS: Record<Color, readonly Direction[]> = {
  w: [
    [-1, 1],
    [1, 1],
  ],
  b: [
    [-1, -1],
    [1, -1],
  ],
};

/** An attacked square together with the direction the attack came from. */
export interface PawnAttack {
  square: Square;
  direction: Direction;
}

/**
 * Squares a pawn attacks: the two squares diagonally ahead of it. The direction
 * is reported alongside, since the mark drawn on the square points back at the
 * pawn.
 */
export function pawnAttacks(square: Square, color: Color): PawnAttack[] {
  const file = fileIndex(square);
  const rank = rankIndex(square);

  return PAWN_STEPS[color].flatMap((direction) => {
    const target = squareAt(file + direction[0], rank + direction[1]);
    return target === null ? [] : [{ square: target, direction }];
  });
}

/** One square along a ray, with the intensity the stripe has when it gets there. */
export interface RaySquare {
  square: Square;
  /** Distance from the origin square, in steps (1 = adjacent). */
  distance: number;
  /** Intensity the ray arrives with, before any piece standing here. */
  intensity: number;
  /**
   * Intensity once past a piece standing here; equal to `intensity` on an empty
   * square. Where the drop is placed within the square is the renderer's call.
   */
  intensityAfter: number;
}

/**
 * Walks outward from `origin` until the board edge, recording every square and
 * its intensity.
 *
 * Unlike normal move generation the ray does not stop at the first piece: it
 * keeps going with the intensity scaled by `decay`, so a long line stays
 * visible behind whatever stands on it. A blocker's own square is still
 * reported at the intensity the ray had on arrival — the drop applies to what
 * lies beyond it.
 *
 * `decay` is clamped to 0..1. At 0 the ray stops at the first piece, which is
 * the no-x-ray case; at 1 it never dims.
 */
export function attackRay(
  chess: Chess,
  origin: Square,
  [df, dr]: Direction,
  decay: number
): RaySquare[] {
  const factor = Math.min(Math.max(decay, 0), 1);
  const file = fileIndex(origin);
  const rank = rankIndex(origin);
  const squares: RaySquare[] = [];

  let intensity = 1;
  for (let distance = 1; ; distance += 1) {
    const target = squareAt(file + df * distance, rank + dr * distance);
    if (target === null) {
      return squares;
    }

    const occupied = chess.get(target) !== undefined;
    const intensityAfter = occupied ? intensity * factor : intensity;
    squares.push({ square: target, distance, intensity, intensityAfter });

    // Nothing further would be visible; stop rather than emit dead squares.
    if (intensityAfter === 0) {
      return squares;
    }
    intensity = intensityAfter;
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

/** The stripes radiating from a sliding piece, each decaying independently. */
export function slidingAttackAxes(
  chess: Chess,
  origin: Square,
  axes: readonly Direction[],
  decay: number
): AttackAxis[] {
  return axes.map(([df, dr]) => ({
    direction: [df, dr] as Direction,
    positive: attackRay(chess, origin, [df, dr], decay),
    negative: attackRay(chess, origin, [-df, -dr], decay),
  }));
}

export function queenAttackAxes(
  chess: Chess,
  origin: Square,
  decay: number
): AttackAxis[] {
  return slidingAttackAxes(chess, origin, QUEEN_AXES, decay);
}

/**
 * The king radiates along the same four axes as the queen, but every ray stops
 * after one square. The cut is unconditional: a king's reach is one square
 * whatever stands there, so nothing beyond it is ever drawn.
 */
export function kingAttackAxes(
  chess: Chess,
  origin: Square,
  decay: number
): AttackAxis[] {
  return slidingAttackAxes(chess, origin, QUEEN_AXES, decay).map((axis) => ({
    direction: axis.direction,
    positive: axis.positive.slice(0, 1),
    negative: axis.negative.slice(0, 1),
  }));
}

export function rookAttackAxes(
  chess: Chess,
  origin: Square,
  decay: number
): AttackAxis[] {
  return slidingAttackAxes(chess, origin, ROOK_AXES, decay);
}

export function bishopAttackAxes(
  chess: Chess,
  origin: Square,
  decay: number
): AttackAxis[] {
  return slidingAttackAxes(chess, origin, BISHOP_AXES, decay);
}
