import { Chess } from "chess.js";
import { withoutUnknownTags } from "../src/chess/pgn.ts";
import type { EndReason, GameRecord } from "./protocol";

/**
 * What the admin is shown of games: plain functions of a record, so that
 * what is shown — and what is never shown — is tried in a unit test.
 */

/**
 * A record with every `token` taken out, at any depth.
 *
 * A token is the whole of a player's identity: whoever has it is that player.
 * The admin has no use for one, and a reply to the admin is a thing that gets
 * pasted into a terminal, a ticket, a chat. Taken out by name rather than by
 * listing what to keep, so that a field added to the record later is shown
 * without anyone remembering to — and a token added later is still not.
 */
export function withoutTokens<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((each) => withoutTokens(each)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== "token").map(([key, each]) => [key, withoutTokens(each)])
    ) as T;
  }
  return value;
}

/** How a game ended, in words, for the comment after its last move. */
const ENDED: Record<EndReason, string> = {
  challengeDeclined: "Challenge declined",
  challengeCancelled: "Challenge withdrawn",
  checkmate: "Checkmate",
  resignation: "Resignation",
  stalemate: "Stalemate",
  agreement: "Draw agreed",
  repetition: "Draw by repetition",
  fiftyMove: "Draw by the fifty-move rule",
  insufficientMaterial: "Draw — too little material to mate",
};

/** A time as PGN dates a game: yyyy.mm.dd, in UTC, as a server has no other zone. */
function pgnDate(at: number): string {
  const day = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${day.getUTCFullYear()}.${pad(day.getUTCMonth() + 1)}.${pad(day.getUTCDate())}`;
}

/**
 * The game as a PGN: the moves played from where it started, the players by
 * the colors they took, its result, and how it ended.
 *
 * The line played only. The lines taken back (`abandoned`) are in the record
 * beside this; the client's own PGN writes them as variations, which chess.js
 * cannot, and the admin reading a game wants what stands.
 *
 * Null where the moves do not play from the position — a record that is not
 * what it should be, which the admin is better told of than shown half of.
 */
export function pgnOf(record: GameRecord, name: string | null, site: string): string | null {
  let game: Chess;
  try {
    game = record.initialFEN === null ? new Chess() : new Chess(record.initialFEN);
    for (const san of record.moves) {
      game.move(san);
    }
  } catch {
    return null;
  }
  const colorOf = (player: { color: string } | null) => player?.color;
  const named = (color: "w" | "b") =>
    colorOf(record.host) === color ? record.host.name : colorOf(record.guest) === color ? (record.guest?.name ?? "?") : "?";
  if (name !== null) {
    game.setHeader("Event", `Game ${name}`);
  }
  game.setHeader("Site", site);
  game.setHeader("Date", pgnDate(record.startedAt ?? record.createdAt));
  game.setHeader("White", named("w"));
  game.setHeader("Black", named("b"));
  game.setHeader("Result", record.result);
  if (record.reason !== null) {
    game.setHeader("Termination", "normal");
    if (record.moves.length > 0) {
      game.setComment(ENDED[record.reason] ?? record.reason);
    }
  }
  return withoutUnknownTags(game.pgn());
}
