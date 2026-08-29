import type { EndReason } from "../../../worker/protocol";

/**
 * How a game ended, in plain words.
 *
 * Written once and read twice: the panel says it to the player, and the PGN
 * carries it in a comment after the last move, where the result tag alone
 * would not say whether "0-1" was a mate or a handshake.
 */
export function describeEnding(reason: EndReason): string {
  switch (reason) {
    case "checkmate":
      return "Checkmate";
    case "resignation":
      return "Resignation";
    case "stalemate":
      return "Stalemate";
    case "agreement":
      return "Draw by agreement";
    case "repetition":
      return "Draw by repetition";
    case "fiftyMove":
      return "Draw by the fifty-move rule";
    case "insufficientMaterial":
      return "Draw — too little material to mate";
    case "challengeDeclined":
      return "Challenge declined";
    case "challengeCancelled":
      return "Invite taken back";
  }
}
