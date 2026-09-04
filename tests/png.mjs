/**
 * Just enough PNG to read what the browser drew.
 *
 * The screenshots come back as PNG because it is lossless: a test that asserts
 * a colour cannot be reading one that a compressor invented. Decoding it is
 * fifty lines and no dependency, which is cheaper than the alternative — asking
 * every machine that runs the tests to have an imaging library installed.
 *
 * Only what Chrome actually emits is handled: eight bits a channel, no
 * interlacing, colour with or without alpha. Anything else says so rather than
 * quietly returning wrong colours.
 */
import { inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** The byte a filtered row refers back to, or nought before the row starts. */
function paeth(left, above, corner) {
  const guess = left + above - corner;
  const dl = Math.abs(guess - left);
  const da = Math.abs(guess - above);
  const dc = Math.abs(guess - corner);
  if (dl <= da && dl <= dc) {
    return left;
  }
  return da <= dc ? above : corner;
}

export function readPng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("not a PNG");
  }
  let at = 8;
  let header = null;
  const parts = [];
  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString("ascii", at + 4, at + 8);
    const data = buffer.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colour: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      parts.push(data);
    } else if (type === "IEND") {
      break;
    }
    at += 12 + length;
  }
  if (header === null) {
    throw new Error("no header");
  }
  const channels = { 2: 3, 6: 4 }[header.colour];
  if (header.depth !== 8 || channels === undefined || header.interlace !== 0) {
    throw new Error(
      `unsupported PNG: depth ${header.depth}, colour type ${header.colour}, interlace ${header.interlace}`
    );
  }

  const { width, height } = header;
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const from = row * (stride + 1) + 1;
    const to = row * stride;
    const up = to - stride;
    for (let i = 0; i < stride; i += 1) {
      const value = raw[from + i];
      const left = i >= channels ? pixels[to + i - channels] : 0;
      const above = row > 0 ? pixels[up + i] : 0;
      const corner = row > 0 && i >= channels ? pixels[up + i - channels] : 0;
      let out = value;
      if (filter === 1) {
        out = value + left;
      } else if (filter === 2) {
        out = value + above;
      } else if (filter === 3) {
        out = value + ((left + above) >> 1);
      } else if (filter === 4) {
        out = value + paeth(left, above, corner);
      } else if (filter !== 0) {
        throw new Error(`unknown row filter ${filter}`);
      }
      pixels[to + i] = out & 0xff;
    }
  }

  return {
    width,
    height,
    /**
     * The average colour of a patch, rounded.
     *
     * An average rather than one pixel: a square's colour is what a reader sees
     * across it, and a single pixel would answer for wherever a stripe's edge
     * happened to fall — a difference of one device pixel in where the board is
     * laid out would then read as a different colour.
     */
    mean(x, y, w, h) {
      let r = 0;
      let g = 0;
      let b = 0;
      let seen = 0;
      for (let row = Math.max(0, y); row < Math.min(height, y + h); row += 1) {
        for (let col = Math.max(0, x); col < Math.min(width, x + w); col += 1) {
          const at = row * stride + col * channels;
          r += pixels[at];
          g += pixels[at + 1];
          b += pixels[at + 2];
          seen += 1;
        }
      }
      if (seen === 0) {
        throw new Error("patch is off the picture");
      }
      return [Math.round(r / seen), Math.round(g / seen), Math.round(b / seen)];
    },
  };
}
