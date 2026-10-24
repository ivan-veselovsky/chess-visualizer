import { useEffect, useState } from "react";
import { PIECE_GLYPH } from "../chess/figurine";

/**
 * The family the pieces in written moves are drawn in — see `@font-face` for
 * "Chess Figures" in the stylesheet: a font already on the reader's machine,
 * for those five characters only, drawn a size up from the text round them.
 */
export const FIGURES_FAMILY = "Chess Figures";

/**
 * Asks for the pieces' font, and renders again once it has come.
 *
 * What measures written moves — the line over the board, the list of lines —
 * measures them as they are drawn, on a canvas in the element's own font. A
 * font on the machine still loads when first asked for, and until then the
 * canvas measures the pieces at the size they would be without it, a fifth
 * narrower: a line fitted then is fitted a little short of its room. Asked for
 * at once, and measured again when it is in, the fit is the one drawn.
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
