import { Chess } from "chess.js";

/** Sample position: Italian/Ruy-Lopez style opening after 1.e4 e5 2.Nf3 Nc6. */
export const SAMPLE_FEN =
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";

export const chess = new Chess(SAMPLE_FEN);
