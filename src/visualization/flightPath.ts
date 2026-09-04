import type { Color, PieceSymbol, Square } from "chess.js";
import { SQUARE_SIZE, squareCenter, type Orientation } from "./geometry";

/** One glyph on its way from one square to another. */
export interface Traveller {
  type: PieceSymbol;
  color: Color;
  from: Square;
  to: Square;
}

/** A move in flight: what is travelling, and how long it has. */
export interface Flight {
  travellers: Traveller[];
  ms: number;
}

/**
 * How far along the journey the piece is, as a fraction, after a fraction of
 * the time.
 *
 * The speed follows a half sine — nothing at the start, most in the middle,
 * nothing at the end:
 *
 *   v(t) = v0 · sin(pi · t / T)
 *
 * which integrates to this. `v0` is then exactly the speed at the middle of the
 * journey, and the distance covered comes to `L` at `t = T` when `T` is chosen
 * as `flightTime` chooses it.
 */
export function travelled(fraction: number): number {
  return (1 - Math.cos(Math.PI * fraction)) / 2;
}

/**
 * How long a move takes at a given speed.
 *
 * From the same profile: the average speed of a half sine is `2/pi` of its
 * peak, so covering `L` squares at a peak of `v0` takes `pi·L / (2·v0)`. A move
 * therefore takes about half as long again as it would at a constant `v0`,
 * which is the price of starting and stopping gently.
 *
 * Unclamped on purpose. A speed of a tenth of a square a second is a legitimate
 * thing to ask for — it is how the order of everything else is watched — and a
 * ceiling would quietly refuse it.
 */
export function flightTime(squares: number, speed: number): number {
  if (speed <= 0 || squares <= 0) {
    return 0;
  }
  return (Math.PI * squares) / (2 * speed) * 1000;
}

/** The distance between two squares, in squares. */
export function squaresApart(
  from: Square,
  to: Square,
  orientation: Orientation
): number {
  const a = squareCenter(from, orientation);
  const b = squareCenter(to, orientation);
  return Math.hypot(b.x - a.x, b.y - a.y) / SQUARE_SIZE;
}

/**
 * How finely the sine is sampled for the browser to move between.
 *
 * The path is handed over as a list of places along it rather than as an
 * easing: the profile is a sine, and no cubic curve is one. Sampled this finely
 * and walked between in straight lines, the difference is far below what an eye
 * following a chess piece can see — and a keyframe list of plain translations
 * is something the compositor can run on its own, which a custom easing
 * function would not be.
 */
export const STEPS = 32;
