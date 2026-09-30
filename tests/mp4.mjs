/**
 * Just enough MP4 to read back what the exporter wrote.
 *
 * The same reason as `gif.mjs`: a test that asserts what a file holds cannot
 * take a library's word for it, and the few facts asked of a video — what it
 * is encoded in, how big a picture, how long, how many frames — sit in a
 * handful of boxes a hundred lines can find. The pictures themselves are not
 * decoded: that is a video decoder's business, and a browser's.
 *
 * Boxes are walked from the top, into the ones that hold other boxes; the
 * first video track found is the one described.
 *
 * What colours it is in is read from the box that says so beside the codec,
 * which the writer fills from what the encoder says of its own stream.
 *
 * How long it lasts is how long a player plays it: every frame's own length,
 * added up, which is where the last one stops. Not the header's figure, which
 * a writer works out for itself and which counts, besides, how far the
 * encoder moved frames about to predict from them: a video whose last frame
 * had lost its hold came out with the header saying it was as long as ever.
 */
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts"]);

/* The colour box's numbers, as ISO/IEC 23091-2 gives them, for the ones a video here may say. */
const PRIMARIES = { 1: "bt709", 5: "bt470bg", 6: "smpte170m" };
const TRANSFERS = { 1: "bt709", 6: "smpte170m", 13: "iec61966-2-1" };
const MATRICES = { 0: "rgb", 1: "bt709", 5: "bt470bg", 6: "smpte170m" };

export function readMp4(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const text = (at, length) => String.fromCharCode(...data.subarray(at, at + length));
  const found = {};

  const walk = (from, to) => {
    let at = from;
    while (at + 8 <= to) {
      let size = view.getUint32(at);
      const type = text(at + 4, 4);
      let body = at + 8;
      if (size === 1) {
        size = Number(view.getBigUint64(at + 8));
        body = at + 16;
      } else if (size === 0) {
        size = to - at;
      }
      if (size < 8 || at + size > to) {
        throw new Error(`A box that does not fit: "${type}" of ${size} bytes at ${at}`);
      }
      const end = at + size;
      if (CONTAINERS.has(type)) {
        walk(body, end);
      } else if (type === "ftyp") {
        found.brand = text(body, 4);
      } else if (type === "mvhd") {
        const version = data[body];
        found.timescale = view.getUint32(body + (version === 1 ? 20 : 12));
        found.duration =
          version === 1 ? Number(view.getBigUint64(body + 24)) : view.getUint32(body + 16);
      } else if (type === "hdlr" && found.track === undefined) {
        found.handler = text(body + 8, 4);
      } else if (type === "stsd" && found.codec === undefined && found.handler === "vide") {
        /* The first sample entry: its type is the codec, and a visual entry
           carries the picture's size 24 bytes into its body. */
        const entry = body + 8;
        found.codec = text(entry + 4, 4);
        found.width = view.getUint16(entry + 8 + 24);
        found.height = view.getUint16(entry + 8 + 26);
        /* What colours it is in: a "colr" box among the entry's own, after
           its 78 bytes of fixed fields. */
        const entryEnd = entry + view.getUint32(entry);
        for (let at = entry + 8 + 78; at + 8 <= entryEnd; ) {
          const size = view.getUint32(at);
          if (size < 8) break;
          if (text(at + 4, 4) === "colr" && text(at + 8, 4) === "nclx") {
            const name = (table, n) => table[n] ?? String(n);
            found.colour = {
              primaries: name(PRIMARIES, view.getUint16(at + 12)),
              transfer: name(TRANSFERS, view.getUint16(at + 14)),
              matrix: name(MATRICES, view.getUint16(at + 16)),
              fullRange: (data[at + 18] & 0x80) !== 0,
            };
          }
          at += size;
        }
      } else if (type === "mdhd" && found.trackTimescale === undefined) {
        /* Before the handler in its box, so kept for whichever track is described. */
        found.pendingTimescale = view.getUint32(body + (data[body] === 1 ? 20 : 12));
      } else if (type === "stts" && found.played === undefined && found.handler === "vide") {
        found.trackTimescale = found.pendingTimescale;
        let played = 0;
        for (let entry = 0, count = view.getUint32(body + 4); entry < count; entry += 1) {
          played += view.getUint32(body + 8 + entry * 8) * view.getUint32(body + 12 + entry * 8);
        }
        found.played = played;
      } else if (type === "stsz" && found.samples === undefined && found.handler === "vide") {
        found.samples = view.getUint32(body + 8);
        found.track = true;
      }
      at = end;
    }
  };
  walk(0, data.length);
  return {
    brand: found.brand ?? null,
    codec: found.codec ?? null,
    width: found.width ?? 0,
    height: found.height ?? 0,
    durationMs: found.trackTimescale ? (found.played / found.trackTimescale) * 1000 : 0,
    frames: found.samples ?? 0,
    /* As the file says, where it says: primaries, transfer, matrix, range. */
    colour: found.colour ?? null,
  };
}
