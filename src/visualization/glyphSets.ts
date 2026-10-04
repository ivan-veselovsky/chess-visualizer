import { glyphSetNamed, glyphSetsFrom, type GlyphSet } from "./glyphs";

/*
  Every set under `src/pieces/`, gathered when the app is built: a folder of
  six pictures added there is a set the settings offer, with nothing else to
  change, and its `meta-info.json`, where it has one, is read with it. See
  `glyphs.ts`.
*/
const FILES = import.meta.glob(["../pieces/*/*.svg", "../pieces/*/meta-info.json"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const GLYPH_SETS: GlyphSet[] = glyphSetsFrom(FILES);

/** The set the settings name, or the default for a name no set here answers to. */
export function glyphSet(name: string): GlyphSet {
  return glyphSetNamed(GLYPH_SETS, name);
}
