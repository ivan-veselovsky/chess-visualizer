import { useEffect, useState } from "react";
import { PIECE_GLYPH } from "../chess/figurine";

/**
 * How much larger the pieces in written moves — "♛h2#" — are drawn than the
 * letters round them: 1.11 is 11% larger. The figures are drawn small for
 * their type in every font that has them, and next to the letters of a move
 * they read as a size down without it.
 *
 * Here rather than in the stylesheet because a face's size is a descriptor of
 * the face, which takes no variables: the face is made here, from this.
 */
export const FIGURE_SCALE = 1.11;

/**
 * The family the pieces in written moves are drawn in, which the stylesheet
 * names first wherever moves are written — the line over the board, the list
 * of moves, the list of lines — and the rest of the text passes by.
 */
export const FIGURES_FAMILY = "Chess Figures";

/**
 * A face for the five characters alone, `FIGURE_SCALE` the size of the text
 * round them. A size of their own rather than of the text's, and by a face
 * rather than by a span round each: an option in a list the platform draws is
 * one run of text, and takes no markup.
 *
 * From a font the reader already has, whichever comes first that has the
 * pieces — DejaVu and Noto on Linux, Segoe on Windows, Apple Symbols on a Mac,
 * each by its full and its PostScript name — and from none of them where none
 * is there: the face fails to load then and is passed over, and the pieces
 * come at their own size from whatever the text falls back to.
 *
 * Drawn larger, but claiming no more height on the line than the letters do:
 * without the overrides, the fonts' own heights, scaled with the figures, made
 * the line a pixel taller than the row it sits in. Where the figures are drawn
 * is not changed by them, only the room they ask for.
 *
 * Added once, as the module is first read, and loaded when first asked for.
 */
function addFiguresFace(): void {
  if (typeof document === "undefined" || !("fonts" in document) || typeof FontFace === "undefined") {
    return;
  }
  const sources = [
    "DejaVu Sans",
    "DejaVuSans",
    "Noto Sans Symbols2",
    "NotoSansSymbols2-Regular",
    "Segoe UI Symbol",
    "SegoeUISymbol",
    "Apple Symbols",
    "AppleSymbols",
    "Arial Unicode MS",
    "ArialUnicodeMS",
  ]
    .map((name) => `local("${name}")`)
    .join(", ");
  try {
    document.fonts.add(
      /* `sizeAdjust` is taken by every browser the app runs in, but not yet
         known to TypeScript's own list of what a face may say. */
      new FontFace(FIGURES_FAMILY, sources, {
        unicodeRange: "U+265A-265E",
        sizeAdjust: `${Math.round(FIGURE_SCALE * 100)}%`,
        ascentOverride: "75%",
        descentOverride: "20%",
        lineGapOverride: "0%",
      } as FontFaceDescriptors & { sizeAdjust: string })
    );
  } catch {
    /* A browser that will not take the face draws the pieces at their own
       size, as it did before there was one. */
  }
}

addFiguresFace();

/**
 * Asks for the pieces' font, and renders again once it has come.
 *
 * What measures written moves — the line over the board, the list of lines —
 * measures them as they are drawn, on a canvas in the element's own font. A
 * font on the machine still loads when first asked for, and until then the
 * canvas measures the pieces at the size they would be without it, a little
 * narrower: a line fitted then is fitted a little short of its room. Asked
 * for at once, and measured again when it is in, the fit is the one drawn.
 */
export function useFiguresLoaded(): void {
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) {
      return;
    }
    let live = true;
    document.fonts
      .load(`1em "${FIGURES_FAMILY}"`, Object.values(PIECE_GLYPH).join(""))
      .then(() => {
        if (live) {
          setLoaded((count) => count + 1);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
}
