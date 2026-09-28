import {
  GIFEncoder,
  applyPalette,
  quantize,
  type Palette,
} from "gifenc/dist/gifenc.esm.js";

/**
 * How frames are stored: each one whole, or only what changed since the last.
 *
 * Whole frames are the plain way — every frame a picture of its own — and cost
 * the same however little moved. Only what changed is four to six times
 * smaller for a board, whose frames mostly differ where a piece is travelling
 * or a mark is fading, and loses nothing: see `createGifWriter`.
 */
export type FrameStore = "changed" | "full";

export interface GifWriter {
  /**
   * A frame, and how long it stays up.
   *
   * `still` marks a position at rest — a frame somebody will look at for a
   * second or more, rather than one in the middle of a move — and a still frame
   * is stored exactly. See `TOLERANCE`.
   */
  add(rgba: Uint8Array | Uint8ClampedArray, delayMs: number, still: boolean): void;
  /** The file, ended. Nothing can be added after. */
  finish(): Uint8Array<ArrayBuffer>;
  /** How many frames have gone in. */
  readonly frames: number;
  /** How many bytes the file has come to so far. */
  readonly bytes: number;
}

/**
 * How many of the first frame's commonest colours every palette keeps.
 *
 * A board is mostly a few flat colours — the squares, the page, the washes at
 * rest — and those are the colours a moving piece uncovers. A palette fitted
 * only to what changed in one frame has no reason to hold them exactly, and
 * the squares a piece had just left came out a level or two off: a faint ghost
 * of the piece that stayed, since nothing afterwards changed there to put it
 * right. Keeping them in every palette, exactly, is what stops that.
 */
const SEEDS = 32;

/**
 * How far a pixel of a frame in motion may be off before it is sent again.
 *
 * A pixel that changes by a level or two in the middle of a fade is not worth a
 * byte of anybody's download. A frame at rest gets none of this allowance: the
 * last level of every fade is sent there, since it is what is looked at.
 */
const TOLERANCE = 2;

const pack = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

/**
 * Frame delays are hundredths of a second in a GIF. Two of them at the least:
 * browsers play anything shorter — nought and one both — as ten, so a frame
 * asked to last as little as possible would last longest of all.
 */
export const hundredths = (ms: number) => Math.max(20, Math.round(ms / 10) * 10);

/**
 * A GIF being written a frame at a time, as the frames are made.
 *
 * Both ways of storing frames give every frame a palette of its own, fitted to
 * what that frame holds, with the board's flat colours kept in it exactly (see
 * `SEEDS`). Storing only what changed goes further:
 *
 *   - a pixel is sent again when the board has changed there since that pixel
 *     was last sent — by more than a level or two in the middle of a move, by
 *     anything at all at rest (see `TOLERANCE`);
 *   - everything else in the frame is transparent, and the frame under it
 *     shows through.
 *
 * Measured against what was last sent rather than against what the GIF shows.
 * A board has thousands more colours than a GIF frame can hold — the edges of
 * every glyph and stripe are shades between two colours — so what is shown is
 * a level or two off in a great many places however it is sent, and a pixel
 * sent again because of it comes back just as far off. Chasing those sent the
 * same pixels on every frame and bought nothing.
 */
export function createGifWriter(
  width: number,
  height: number,
  store: FrameStore
): GifWriter {
  const gif = GIFEncoder();
  const n = width * height;
  /** What the board was, pixel by pixel, when each pixel was last sent. */
  const sent = new Uint8Array(n * 3);
  let seeds: Palette | null = null;
  let seedIndex: Map<number, number> | null = null;
  let frames = 0;
  /* Kept between frames rather than made for each: a board's frame is a couple
     of million pixels, and these are the size of one. */
  const changed = new Uint32Array(n);
  const index = new Uint8Array(n);

  /** The nearest palette colour for each pixel, the board's own colours exactly. */
  const mapColours = (rgba: Uint8Array | Uint8ClampedArray, palette: Palette) => {
    const mapped = applyPalette(rgba, palette);
    for (let p = 0, q = 0; p < mapped.length; p += 1, q += 4) {
      const exact = seedIndex!.get(pack(rgba[q], rgba[q + 1], rgba[q + 2]));
      if (exact !== undefined) {
        mapped[p] = exact;
      }
    }
    return mapped;
  };

  const remember = (p: number, rgba: Uint8Array | Uint8ClampedArray, q: number) => {
    sent[3 * p] = rgba[q];
    sent[3 * p + 1] = rgba[q + 1];
    sent[3 * p + 2] = rgba[q + 2];
  };

  const whole = (rgba: Uint8Array | Uint8ClampedArray, delay: number) => {
    const palette = [...seeds!, ...quantize(rgba, 256 - SEEDS)];
    const mapped = mapColours(rgba, palette);
    gif.writeFrame(mapped, width, height, { palette, delay, repeat: 0 });
    for (let p = 0; p < n; p += 1) {
      remember(p, rgba, 4 * p);
    }
  };

  return {
    add(rgba, delayMs, still) {
      const delay = hundredths(delayMs);
      if (seeds === null) {
        const counts = new Map<number, number>();
        for (let q = 0; q < rgba.length; q += 4) {
          const colour = pack(rgba[q], rgba[q + 1], rgba[q + 2]);
          counts.set(colour, (counts.get(colour) ?? 0) + 1);
        }
        seeds = [...counts.entries()]
          .sort((one, other) => other[1] - one[1])
          .slice(0, SEEDS)
          .map(([colour]) => [colour >> 16, (colour >> 8) & 255, colour & 255]);
        seedIndex = new Map(seeds.map((colour, i) => [pack(colour[0], colour[1], colour[2]), i]));
        whole(rgba, delay);
        frames += 1;
        return;
      }
      if (store === "full") {
        whole(rgba, delay);
        frames += 1;
        return;
      }

      const allowed = still ? 0 : TOLERANCE;
      let count = 0;
      for (let p = 0, q = 0; p < n; p += 1, q += 4) {
        if (
          Math.abs(rgba[q] - sent[3 * p]) > allowed ||
          Math.abs(rgba[q + 1] - sent[3 * p + 1]) > allowed ||
          Math.abs(rgba[q + 2] - sent[3 * p + 2]) > allowed
        ) {
          changed[count] = p;
          count += 1;
        }
      }
      let palette: Palette;
      let transparent: number;
      if (count === 0) {
        /* Nothing to send: a frame of nothing but the colour that is not there,
           which is how a GIF says "the same again, for this long". */
        palette = [[0, 0, 0], [0, 0, 0]];
        transparent = 1;
        index.fill(transparent);
      } else {
        const sub = new Uint8Array(count * 4);
        for (let k = 0; k < count; k += 1) {
          const q = changed[k] * 4;
          sub[4 * k] = rgba[q];
          sub[4 * k + 1] = rgba[q + 1];
          sub[4 * k + 2] = rgba[q + 2];
          sub[4 * k + 3] = 255;
        }
        palette = [...seeds, ...quantize(sub, 255 - SEEDS)];
        const mapped = mapColours(sub, palette);
        transparent = palette.length;
        index.fill(transparent);
        for (let k = 0; k < count; k += 1) {
          index[changed[k]] = mapped[k];
          remember(changed[k], rgba, 4 * changed[k]);
        }
        palette = [...palette, [0, 0, 0]];
      }
      gif.writeFrame(index, width, height, {
        palette,
        delay,
        transparent: true,
        transparentIndex: transparent,
        dispose: 1,
      });
      frames += 1;
    },
    finish() {
      gif.finish();
      return gif.bytes();
    },
    get frames() {
      return frames;
    },
    get bytes() {
      return gif.bytesView().length;
    },
  };
}
