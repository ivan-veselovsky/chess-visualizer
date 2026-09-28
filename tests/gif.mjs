/**
 * Just enough GIF to read back what the exporter wrote.
 *
 * The same reason as `png.mjs`: a test that asserts what a picture holds cannot
 * take a library's word for it, and reading a GIF is a hundred lines with no
 * dependency. Frames come back as a viewer shows them — each drawn over what
 * the ones before it left, transparent pixels letting the frame below show
 * through — which is the only reading of a GIF that matters.
 *
 * What the exporter writes is handled, and a little more: global and local
 * colour tables, transparency, the three disposals a viewer honours. Not
 * interlacing, which it never writes; that says so rather than guessing.
 */
export function readGif(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let at = 0;
  const byte = () => data[at++];
  const word = () => {
    const value = data[at] | (data[at + 1] << 8);
    at += 2;
    return value;
  };
  const table = (size) => {
    const colours = [];
    for (let i = 0; i < size; i += 1) {
      colours.push([byte(), byte(), byte()]);
    }
    return colours;
  };

  const signature = String.fromCharCode(...data.subarray(0, 6));
  if (signature !== "GIF89a" && signature !== "GIF87a") {
    throw new Error("not a GIF");
  }
  at = 6;
  const width = word();
  const height = word();
  const packed = byte();
  byte(); // background colour index
  byte(); // aspect ratio
  const global = packed & 0x80 ? table(1 << ((packed & 7) + 1)) : null;

  const screen = new Uint8ClampedArray(width * height * 4);
  const frames = [];
  let control = { delayMs: 0, transparent: null, disposal: 0 };
  let loops = null;

  while (at < data.length) {
    const kind = byte();
    if (kind === 0x3b) {
      break;
    }
    if (kind === 0x21) {
      const label = byte();
      const blocks = [];
      for (let size = byte(); size > 0; size = byte()) {
        blocks.push(data.subarray(at, at + size));
        at += size;
      }
      if (label === 0xf9 && blocks[0]) {
        const block = blocks[0];
        control = {
          disposal: (block[0] >> 2) & 7,
          delayMs: (block[1] | (block[2] << 8)) * 10,
          transparent: block[0] & 1 ? block[3] : null,
        };
      } else if (label === 0xff && blocks[0] && String.fromCharCode(...blocks[0]) === "NETSCAPE2.0") {
        loops = blocks[1][1] | (blocks[1][2] << 8);
      }
      continue;
    }
    if (kind !== 0x2c) {
      throw new Error(`unexpected block 0x${kind.toString(16)} at ${at - 1}`);
    }
    const left = word();
    const top = word();
    const w = word();
    const h = word();
    const flags = byte();
    if (flags & 0x40) {
      throw new Error("interlaced frames are not read");
    }
    const colours = flags & 0x80 ? table(1 << ((flags & 7) + 1)) : global;
    const minimum = byte();
    const chunks = [];
    for (let size = byte(); size > 0; size = byte()) {
      chunks.push(data.subarray(at, at + size));
      at += size;
    }
    const indices = decompress(concat(chunks), minimum, w * h);

    const before = control.disposal === 3 ? screen.slice() : null;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const index = indices[y * w + x];
        if (index === control.transparent) {
          continue;
        }
        const colour = colours[index];
        const p = ((top + y) * width + (left + x)) * 4;
        screen[p] = colour[0];
        screen[p + 1] = colour[1];
        screen[p + 2] = colour[2];
        screen[p + 3] = 255;
      }
    }
    frames.push({ delayMs: control.delayMs, rgba: screen.slice(), disposal: control.disposal, transparent: control.transparent !== null });
    if (control.disposal === 2) {
      for (let y = 0; y < h; y += 1) {
        screen.fill(0, ((top + y) * width + left) * 4, ((top + y) * width + left + w) * 4);
      }
    } else if (before !== null) {
      screen.set(before);
    }
    control = { delayMs: 0, transparent: null, disposal: 0 };
  }
  return { width, height, frames, loops };
}

function concat(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** GIF's LZW: variable-width codes, least significant bit first, a clear code and an end code. */
function decompress(data, minimum, count) {
  const clear = 1 << minimum;
  const end = clear + 1;
  const out = new Uint8Array(count);
  let written = 0;
  let size = minimum + 1;
  let dictionary = [];
  const reset = () => {
    dictionary = [];
    for (let i = 0; i < clear; i += 1) {
      dictionary.push([i]);
    }
    dictionary.push(null, null);
    size = minimum + 1;
  };
  reset();
  let previous = null;
  let bits = 0;
  let held = 0;
  for (let i = 0; i < data.length && written < count; ) {
    while (held < size && i < data.length) {
      bits |= data[i++] << held;
      held += 8;
    }
    if (held < size) {
      break;
    }
    const code = bits & ((1 << size) - 1);
    bits >>>= size;
    held -= size;
    if (code === clear) {
      reset();
      previous = null;
      continue;
    }
    if (code === end) {
      break;
    }
    let entry;
    if (code < dictionary.length && dictionary[code] !== undefined && dictionary[code] !== null) {
      entry = dictionary[code];
      if (previous !== null) {
        dictionary.push([...previous, entry[0]]);
      }
    } else if (previous !== null) {
      entry = [...previous, previous[0]];
      dictionary.push(entry);
    } else {
      throw new Error("a code before anything to build it from");
    }
    for (const value of entry) {
      if (written < count) {
        out[written++] = value;
      }
    }
    previous = entry;
    if (dictionary.length === 1 << size && size < 12) {
      size += 1;
    }
  }
  return out;
}
