#!/usr/bin/env python3
"""
A font's six chess pieces as a glyph set the app can draw: one .svg a piece,
k q r b n p, each a square of 64 units with the piece where the board drew the
font's glyph as text — 48 units high, centred on its advance across, and on
the font's central baseline down, as `text-anchor: middle` and
`dominant-baseline: central` put it. So a set made from the font a board was
drawn in looks as that board did.

    python3 scripts/font-glyphs-to-svg.py FONT.ttf "src/pieces/Set name"

The filled ("black") glyphs, U+265A to U+265F: one silhouette, coloured by the
app for either side, as the font's glyph was. Needs fontTools
(`pip install fonttools`), and is only for making a set; the app reads the
files it writes.
"""

import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

PIECES = {"k": 0x265A, "q": 0x265B, "r": 0x265C, "b": 0x265D, "n": 0x265E, "p": 0x265F}
SQUARE = 64
SIZE = 48  # the font size the board drew its glyphs at


def main(font_path: str, out_dir: str) -> None:
    font = TTFont(font_path)
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    units = font["head"].unitsPerEm
    scale = SIZE / units
    hhea = font["hhea"]
    # The central baseline sits half way between the ascent and the descent,
    # which is what `dominant-baseline: central` centres on the text's y.
    baseline = SQUARE / 2 + scale * (hhea.ascent + hhea.descent) / 2
    family = font["name"].getDebugName(1)
    os.makedirs(out_dir, exist_ok=True)
    for piece, code in PIECES.items():
        name = cmap.get(code)
        if name is None:
            sys.exit(f"{family} has no glyph for U+{code:04X}")
        glyph = glyphs[name]
        left = SQUARE / 2 - scale * glyph.width / 2
        pen = SVGPathPen(glyphs, ntos=lambda value: f"{value:.2f}".rstrip("0").rstrip("."))
        # Font units, y up, into the square's units, y down.
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, left, baseline)))
        path = pen.getCommands()
        with open(os.path.join(out_dir, f"{piece}.svg"), "w") as out:
            out.write(
                f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SQUARE} {SQUARE}">\n'
                f"  <!-- U+{code:04X} from {family}, drawn at {SIZE} units in a square of {SQUARE}. -->\n"
                f'  <path d="{path}"/>\n'
                "</svg>\n"
            )
    print(f"{family}: six pieces written to {out_dir}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
