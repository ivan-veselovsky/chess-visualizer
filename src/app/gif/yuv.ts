/**
 * A frame of the canvas as a video encoder is best given it: in the video
 * range of BT.709, the colours every player expects of a picture this size,
 * and said to be so.
 *
 * Handed the canvas itself, an encoder chooses for itself how to turn its
 * red, green and blue into a video's brightness and colour, and says what it
 * chose. Chrome's chooses the full range and sRGB's curve; Firefox's the
 * video range and BT.709's. Both are right as far as they go, and most players
 * show the two alike — but VLC, given the full range, showed the mate disc
 * pale, and its fade as a flicker, from Chrome and from nowhere else. Made
 * here the one way, the video is the same from either browser, and the same
 * in every player.
 *
 * The planes are laid out as WebCodecs' I420 has them: every pixel's
 * brightness, then the blue and the red difference, each at half the width and
 * half the height, a 2 × 2 block of pixels sharing one of each.
 */

/** What the frames made here are, said to the encoder with each. */
export const VIDEO_COLOUR_SPACE = {
  primaries: "bt709",
  transfer: "bt709",
  matrix: "bt709",
  fullRange: false,
} as const;

/* BT.709's weights for red and blue in the brightness; green's is the rest. */
const KR = 0.2126;
const KB = 0.0722;
const KG = 1 - KR - KB;

/* The video range: brightness from 16 to 235, the differences 16 to 240
   about 128 — 219 and 224 steps where the canvas has 255. */
const Y_SCALE = 219 / 255;
const C_SCALE = 224 / 255;

/* In sixty-five-thousand-and-thirty-sixths, so each pixel is sums of whole
   numbers; the half added before the shift rounds to nearest. */
const ONE = 1 << 16;
const fixed = (x: number) => Math.round(x * ONE);
const YR = fixed(KR * Y_SCALE);
const YG = fixed(KG * Y_SCALE);
const YB = fixed(KB * Y_SCALE);
const UR = fixed((-KR / (2 * (1 - KB))) * C_SCALE);
const UG = fixed((-KG / (2 * (1 - KB))) * C_SCALE);
const UB = fixed(0.5 * C_SCALE);
const VR = fixed(0.5 * C_SCALE);
const VG = fixed((-KG / (2 * (1 - KR))) * C_SCALE);
const VB = fixed((-KB / (2 * (1 - KR))) * C_SCALE);
const Y_OFFSET = 16 * ONE + ONE / 2;
const C_OFFSET = 128 * ONE + ONE / 2;

/** How many bytes the planes of a frame this size take. */
export function i420Size(width: number, height: number): number {
  return width * height + 2 * Math.ceil(width / 2) * Math.ceil(height / 2);
}

/**
 * The canvas's pixels, as `getImageData` gives them, made into I420 in
 * `into` — which is made if not given, and may be given again frame after
 * frame. Alpha is not looked at: the canvas is painted on the page's ground
 * first, and is opaque throughout.
 *
 * A block's colour difference is taken from the block's average colour, which
 * is the same as averaging the pixels' differences, since both are sums; at
 * an odd edge the block is the pixels there are.
 */
export function toI420(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  into: Uint8Array = new Uint8Array(i420Size(width, height))
): Uint8Array {
  const halfWidth = Math.ceil(width / 2);
  const halfHeight = Math.ceil(height / 2);
  const uPlane = width * height;
  const vPlane = uPlane + halfWidth * halfHeight;
  for (let by = 0; by < halfHeight; by += 1) {
    for (let bx = 0; bx < halfWidth; bx += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let y = by * 2; y < Math.min(by * 2 + 2, height); y += 1) {
        for (let x = bx * 2; x < Math.min(bx * 2 + 2, width); x += 1) {
          const p = (y * width + x) * 4;
          const pr = rgba[p];
          const pg = rgba[p + 1];
          const pb = rgba[p + 2];
          into[y * width + x] = (YR * pr + YG * pg + YB * pb + Y_OFFSET) >> 16;
          r += pr;
          g += pg;
          b += pb;
          count += 1;
        }
      }
      r /= count;
      g /= count;
      b /= count;
      const block = by * halfWidth + bx;
      into[uPlane + block] = (UR * r + UG * g + UB * b + C_OFFSET) >> 16;
      into[vPlane + block] = (VR * r + VG * g + VB * b + C_OFFSET) >> 16;
    }
  }
  return into;
}
