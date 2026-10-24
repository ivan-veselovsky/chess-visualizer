/**
 * Moves written with the pieces drawn rather than lettered — "♛h2#" for
 * "Qh2#" — as the lists of moves and lines show them. Figurine notation, as
 * printed books have it: read at a glance in any language, where the letters
 * are English.
 *
 * One glyph a kind, the filled one, for both sides: where a move is coloured
 * for its side, the colour says whose it is, as on the board.
 */
export const PIECE_GLYPH: Record<string, string> = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞" };

const GLYPHS = new Set(Object.values(PIECE_GLYPH));

/** Whether a character is one of the pieces `figurine` draws. */
export function isPieceGlyph(character: string): boolean {
  return GLYPHS.has(character);
}

/**
 * Every move in a text with its piece drawn: the letter a move begins with —
 * a capital followed by the square it goes to, with perhaps the file or rank it
 * comes from and a capture between, as "Nf3", "Nbd2", "R1e2", "Qxe5" are — and
 * the piece a pawn is promoted to, after its "=". Castling, pawn moves, numbers
 * and words are left as they are — a whole square, not just a file after the
 * capital, so "Kasparov" is not taken for a king's move; a comment that happens
 * to hold a move written the same way has it drawn too.
 */
export function figurine(text: string): string {
  return text
    .replace(/(^|[\s(. ])([KQRBN])(?=[a-h]?[1-8]?x?[a-h][1-8])/g, (_, before: string, piece: string) => before + PIECE_GLYPH[piece])
    .replace(/=([QRBN])/g, (_, piece: string) => `=${PIECE_GLYPH[piece]}`);
}

/** And back to letters: for comparing what is shown with what was written. */
export function lettered(text: string): string {
  return text.replace(/[♚♛♜♝♞]/g, (glyph) => Object.keys(PIECE_GLYPH).find((key) => PIECE_GLYPH[key] === glyph) ?? glyph);
}
