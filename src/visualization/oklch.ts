/**
 * A colour's lightness, chroma and hue in OKLCH, from its hex — what CSS's
 * `oklch()` takes, so a colour from the settings can lend its hue to another
 * without lending its lightness: see `moveTint`.
 *
 * Björn Ottosson's OKLab, from sRGB, as the CSS Color 4 specification gives it.
 * Null for anything that is not a #rgb or #rrggbb colour.
 */
export function oklchOf(hex: string): { l: number; c: number; h: number } | null {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  const parts = long ?? (short === null ? null : [short[0], ...short.slice(1).map((digit) => digit + digit)]);
  if (parts === null) {
    return null;
  }
  const [r, g, b] = parts.slice(1, 4).map((pair) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(bb, a) * 180) / Math.PI;
  return { l: lightness, c: Math.hypot(a, bb), h: hue < 0 ? hue + 360 : hue };
}

/**
 * How a side's moves are tinted where they are written out over the board:
 * the hue its men are drawn in, at a chroma low enough to tint the text rather
 * than recolour it — the text keeps its own lightness, so a side whose men are
 * dark is not written darker for it. As CSS's `oklch()` wants its chroma and
 * hue; null where the colour cannot be read, and the text keeps its colour.
 */
export function moveTint(hex: string): { c: number; h: number } | null {
  const colour = oklchOf(hex);
  if (colour === null) {
    return null;
  }
  return { c: Math.min(colour.c * 0.35, 0.06), h: colour.h };
}
