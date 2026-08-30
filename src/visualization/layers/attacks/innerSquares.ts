import { SQUARE_SIZE } from "../../geometry";
import type { AttackGeometry } from "../../settings";

/** The two inner squares as half-sides, in board units. */
export interface InnerSquares {
  /** The square every ray stops in a point on. */
  small: number;
  /** The square every ray sets off from. */
  large: number;
}

/**
 * The pair a side's rays are measured against, ordered so that the large square
 * holds the small one.
 *
 * Nothing in the drawing breaks when they are given the other way round: the
 * start simply falls behind the end and each ray doubles back over itself. But
 * that reads as a fault rather than as a setting, so the two are put in order
 * here, once, instead of at each place that measures against them — settings
 * arriving from a file included.
 */
export function innerSquares(geometry: AttackGeometry): InnerSquares {
  const small = Math.max(geometry.smallInnerSquare, 0);
  const large = Math.max(geometry.largeInnerSquare, small);
  return {
    small: (small * SQUARE_SIZE) / 2,
    large: (large * SQUARE_SIZE) / 2,
  };
}
