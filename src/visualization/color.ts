/**
 * Colour numbers, and the difference between the two scales they come on.
 *
 * A channel written "128" is not half the light of one written "255". Everything
 * stored as a hex colour — CSS, this app's settings, every image — is sRGB
 * *encoded*: bent through a curve close to a square, so that the 256 steps land
 * where the eye can tell them apart rather than spread evenly over the light
 * they stand for. On that scale 128 carries about 22% of white's light, and 188
 * carries half.
 *
 * The bend is why colours must be decoded before they are averaged. Arithmetic
 * on encoded numbers is arithmetic on a perceptual scale, and mixing two lights
 * is a question about light: full red and full green shone on one square make a
 * bright yellow, but their encoded midpoint is a dark olive.
 */

/** One channel, from what is written to the share of the light it stands for. */
export function toLinear(value: number): number {
  const c = value / 255;
  // The curve is a plain power except very near black, where it is a straight
  // segment: the power's slope goes to zero there, and quantising against it
  // would throw away the darkest steps.
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** The way back: a share of light to the number that is written for it. */
export function toSrgb(light: number): number {
  const c =
    light <= 0.0031308 ? 12.92 * light : 1.055 * light ** (1 / 2.4) - 0.055;
  return c * 255;
}

/** A colour written "#rrggbb", as three numbers. */
export function readRgb(color: string): [number, number, number] {
  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? [...hex].map((digit) => digit + digit).join("")
      : hex.padEnd(6, "0").slice(0, 6);
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/** Three numbers back to "#rrggbb", clamped and rounded to what can be written. */
export function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(Math.max(v, 0), 255))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

/**
 * Two colours mixed as two lights would mix, `share` of the first to the rest of
 * the second: decode both, average, encode the answer.
 *
 * Brightness is not restored afterwards. Scaling the mixture up to full strength
 * turns any pair that averages near grey — #ff0080 with #00ff80, say — into
 * white, which reads as a square nobody is looking at at all.
 */
export function mix(
  first: [number, number, number],
  second: [number, number, number],
  share: number
): [number, number, number] {
  const channel = (a: number, b: number) =>
    toSrgb(toLinear(a) * share + toLinear(b) * (1 - share));
  return [
    channel(first[0], second[0]),
    channel(first[1], second[1]),
    channel(first[2], second[2]),
  ];
}
