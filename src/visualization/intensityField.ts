import { mix, readRgb, toHex, toLinear, toSrgb } from "./color";

/** The average of several colours, taken in linear light as every other blend
 * here is: the mean of a set of ray colours stands in for the side when one
 * colour has to speak for all six piece kinds. */
export function meanColor(colors: string[]): string {
  const channels = colors.map(readRgb);
  const mean = (index: 0 | 1 | 2) =>
    toSrgb(
      channels.reduce((sum, c) => sum + toLinear(c[index]), 0) / channels.length
    );
  return toHex([mean(0), mean(1), mean(2)]);
}

/** Laying `over` on `under` at `alpha`, the way the browser stacks two
 * translucent shapes: straight source-over, in sRGB, because that is what the
 * board itself does with one ray drawn across another. */
function over(
  under: [number, number, number],
  paint: [number, number, number],
  alpha: number
): [number, number, number] {
  const channel = (i: 0 | 1 | 2) => paint[i] * alpha + under[i] * (1 - alpha);
  return [channel(0), channel(1), channel(2)];
}

/**
 * What a square looks like under both sides' rays at the given fractions: mine
 * laid on the board and the opponent's laid on that, which is the same
 * arithmetic the browser does when one ray crosses another.
 *
 * Mine goes underneath. On the board the order follows the order the pieces are
 * drawn in, so both stacks occur there; one of them has to be shown here, and
 * this is the one that matches the labels.
 */
export function raysOver(
  square: string,
  myColor: string,
  theirColor: string,
  x: number,
  y: number
): [number, number, number] {
  const board = readRgb(square);
  return over(over(board, readRgb(myColor), x), readRgb(theirColor), y);
}

/**
 * What a square looks like under one attacker from each side, at the given
 * strengths: the same two steps the heatmap layer takes — how much colour each
 * side lays down, the two hues mixed in that proportion, and the whole washed
 * over the square.
 */
export function heatOver(
  square: string,
  myColor: string,
  theirColor: string,
  x: number,
  y: number
): [number, number, number] {
  if (x + y === 0) {
    return readRgb(square);
  }
  const hue = mix(readRgb(myColor), readRgb(theirColor), x / (x + y));
  return over(readRgb(square), hue, 1 - (1 - x) * (1 - y));
}
