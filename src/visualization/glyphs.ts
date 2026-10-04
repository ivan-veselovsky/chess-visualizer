import type { PieceSymbol } from "chess.js";

/**
 * How the men are drawn: a set of six pictures, one a kind, each a single
 * silhouette the board colours for either side — the attack colour of its
 * kind, lightened for White and darkened for Black, with the outline round it
 * — as it coloured the font's glyphs it once drew them with.
 *
 * A set is a folder under `src/pieces/` holding `k.svg`, `q.svg`, `r.svg`,
 * `b.svg`, `n.svg` and `p.svg`, and is called what the folder is called; a
 * folder short of any of the six is not a set. Each picture's viewBox is one
 * square of the board, and the man is drawn in it as he should stand on one.
 * What it draws with no fill of its own takes the man's colour, and the
 * outline is drawn round it; a part given a fill keeps it, which is how a set
 * marks details in a colour of their own. See `scripts/font-glyphs-to-svg.py`
 * for a set made from a font's chess glyphs.
 *
 * Beside them the folder may hold a `meta-info.json` saying how far the whole
 * set is to be moved on its squares, which is how a set whose men stand too
 * high or too low — as a font's glyphs can, placed by its own metrics — is put
 * right without redrawing six pictures:
 *
 *     { "correction": { "delta_x": 0, "delta_y": 0.1 } }
 *
 * In sides of a square, and the way the board's own drawing counts: x to the
 * right, y down, so 0.1 moves every man a tenth of a square lower. Anything
 * else in the file is left for whatever else comes to want it; a correction
 * left out, or one that is not a number, is no correction.
 */

/** One man's picture: the square it is drawn in, and what is drawn there. */
export interface Glyph {
  viewBox: [number, number, number, number];
  /** The picture's elements, as they stand inside its `<svg>`. */
  body: string;
}

export interface GlyphSet {
  name: string;
  pieces: Record<PieceSymbol, Glyph>;
  /** How far every man is moved on his square, in sides of a square: x right, y down. */
  shift: { x: number; y: number };
}

const KINDS: PieceSymbol[] = ["k", "q", "r", "b", "n", "p"];

/** The set the app draws with until another is chosen: the font it drew with on the machines it was made on. */
export const DEFAULT_GLYPH_SET = "DejaVu Sans";

/** A picture's square and elements, from its file; null for a file that is not an `<svg>`. */
export function readGlyph(svg: string): Glyph | null {
  const text = svg.replace(/<\?xml[^>]*\?>/g, "").replace(/<!DOCTYPE[^>]*>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const open = /<svg\b[^>]*>/i.exec(text);
  const close = text.lastIndexOf("</svg>");
  if (open === null || close < open.index) {
    return null;
  }
  const tag = open[0];
  const attribute = (name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];
  const box = attribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const viewBox: [number, number, number, number] | null =
    box !== undefined && box.length === 4 && box.every(Number.isFinite)
      ? [box[0], box[1], box[2], box[3]]
      : Number.isFinite(Number.parseFloat(attribute("width") ?? "")) && Number.isFinite(Number.parseFloat(attribute("height") ?? ""))
        ? [0, 0, Number.parseFloat(attribute("width")!), Number.parseFloat(attribute("height")!)]
        : null;
  if (viewBox === null || viewBox[2] <= 0 || viewBox[3] <= 0) {
    return null;
  }
  return { viewBox, body: text.slice(open.index + tag.length, close).trim() };
}

/** How far a set's `meta-info.json` moves its men; none for a file that says nothing usable. */
export function readShift(json: string | undefined): { x: number; y: number } {
  let meta: unknown;
  try {
    meta = json === undefined ? null : JSON.parse(json);
  } catch {
    meta = null;
  }
  const correction =
    meta !== null && typeof meta === "object" ? (meta as Record<string, unknown>).correction : null;
  const along = (key: string) => {
    const value =
      correction !== null && typeof correction === "object"
        ? (correction as Record<string, unknown>)[key]
        : undefined;
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return { x: along("delta_x"), y: along("delta_y") };
}

/**
 * The sets in a collection of files, by path — `…/pieces/<set>/<kind>.svg`,
 * and `…/pieces/<set>/meta-info.json` beside them — as the build gathers them:
 * every folder holding all six pictures, by name.
 */
export function glyphSetsFrom(files: Record<string, string>): GlyphSet[] {
  const folders = new Map<string, Partial<Record<PieceSymbol, Glyph>>>();
  const metas = new Map<string, string>();
  for (const [path, text] of Object.entries(files)) {
    const meta = /([^/]+)\/meta-info\.json$/.exec(path);
    if (meta !== null) {
      metas.set(meta[1], text);
      continue;
    }
    const match = /([^/]+)\/([kqrbnp])\.svg$/.exec(path);
    const glyph = match === null ? null : readGlyph(text);
    if (match === null || glyph === null) {
      continue;
    }
    const folder = folders.get(match[1]) ?? {};
    folder[match[2] as PieceSymbol] = glyph;
    folders.set(match[1], folder);
  }
  const sets: GlyphSet[] = [];
  for (const [name, pieces] of folders) {
    if (KINDS.every((kind) => pieces[kind] !== undefined)) {
      sets.push({ name, pieces: pieces as Record<PieceSymbol, Glyph>, shift: readShift(metas.get(name)) });
    }
  }
  return sets.sort((one, other) => one.name.localeCompare(other.name));
}

/** The set called `name`, or — for a name no set answers to — the default, or the first there is. */
export function glyphSetNamed(sets: GlyphSet[], name: string): GlyphSet {
  return (
    sets.find((set) => set.name === name) ??
    sets.find((set) => set.name === DEFAULT_GLYPH_SET) ??
    sets[0]
  );
}
