import type { Color } from "chess.js";
import type { EndReason, GameResult } from "../../../worker/protocol";

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

/**
 * The same ending, said to one of the two people it happened to.
 *
 * A result is written from nobody's point of view — "0-1" is a fact about the
 * board. This is the same fact told to a player, which is what somebody
 * reading their own list of games wants to know.
 */
export function endingOf(
  over: { result: GameResult; reason: EndReason },
  you: Color
): string {
  const mine = over.result === "1-0" ? "w" : over.result === "0-1" ? "b" : null;
  const how: Record<EndReason, string> = {
    checkmate: "checkmate",
    resignation: "resignation",
    stalemate: "stalemate",
    agreement: "agreement",
    repetition: "repetition",
    fiftyMove: "the fifty-move rule",
    insufficientMaterial: "too little material to mate",
    challengeDeclined: "the challenge being declined",
    challengeCancelled: "the invite being taken back",
  };
  if (mine === null) {
    return `Drawn by ${how[over.reason]}.`;
  }
  return mine === you
    ? `You won by ${how[over.reason]}.`
    : `You lost by ${how[over.reason]}.`;
}
