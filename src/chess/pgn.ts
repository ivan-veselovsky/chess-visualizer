import { Chess } from "chess.js";
import type { HistoryEntry, PositionHistory } from "./history";

export interface PgnImport {
  /** The whole line, newest first, ready to become a history. Null on failure. */
  entries: HistoryEntry[] | null;
  /**
   * Who played it, as the file says.
   *
   * Exactly as written, and the colour they played — "White", "Black" — where
   * a file says nothing: a game with nobody in it is still a game between two
   * people, and a blank over the board reads as a fault rather than as an
   * absence. The colour is the one thing about a nameless player that is
   * known, and it says which row is which at a glance. PGN's own "?" is treated
   * as nothing said, since that is what it means.
   */
  players: { white: string; black: string };
  /**
   * How it came out, in PGN's own vocabulary — "1-0", "0-1", "1/2-1/2" — or
   * null where the file says nothing or says "*", which is PGN for a game with
   * no result yet.
   */
  result: string | null;
  error: string | null;
}

/**
 * What a player a file says nothing about is called: the colour they played.
 * Exported so that whatever needs to know whether a file named anybody asks
 * the same question this answers, rather than a copy of the words.
 */
export const UNNAMED = { white: "White", black: "Black" } as const;

/** What a file says a player was called, or the colour they played. */
function playerNamed(said: string | undefined, side: "white" | "black"): string {
  const name = (said ?? "").trim();
  return name === "" || name === "?" ? UNNAMED[side] : name;
}

/**
 * Reads a game and returns every position it passes through.
 *
 * chess.js parses the moves; replaying them is what turns a move list into the
 * positions the board works in. The line starts wherever the game does — a PGN
 * carrying a FEN header begins there rather than at the initial position.
 *
 * Entries come back newest first, matching how a history is ordered.
 */
export function parsePgn(text: string): PgnImport {
  const nobody = { white: UNNAMED.white, black: UNNAMED.black };
  if (text.trim() === "") {
    return {
      entries: null,
      players: nobody,
      result: null,
      error: "That file is empty.",
    };
  }

  const game = new Chess();
  try {
    game.loadPgn(text);
  } catch (cause) {
    return {
      entries: null,
      players: nobody,
      result: null,
      error:
        cause instanceof Error ? cause.message : "Could not read that PGN.",
    };
  }

  const moves = game.history({ verbose: true });
  const players = {
    white: playerNamed(game.getHeaders().White, "white"),
    black: playerNamed(game.getHeaders().Black, "black"),
  };
  const said = (game.getHeaders().Result ?? "").trim();
  const result = said === "" || said === "*" ? null : said;
  if (moves.length === 0) {
    return { entries: null, players, result, error: "That PGN holds no moves." };
  }

  // `before` on the first move is where the game started, headers included.
  const line: HistoryEntry[] = [{ fen: moves[0].before, move: null }];
  for (const move of moves) {
    line.push({ fen: move.after, move: move.san });
  }

  return { entries: line.reverse(), players, result, error: null };
}

/**
 * Writes the whole line out as a game.
 *
 * The moves are replayed from the line's first position rather than assembled
 * by hand, so chess.js supplies the tag roster and — where the line began
 * somewhere other than the initial position — the SetUp and FEN headers that
 * make the result readable back in.
 *
 * The entire line is written, not merely as far as the pointer: stepping back
 * to look at an earlier position does not unplay what followed.
 *
 * `event` names the game in the tag chess.js would otherwise fill with "?".
 * Where a game is being kept under a name, that name is what it is called.
 *
 * `players` fills the tags a game between two people has answers for and a
 * position being studied does not: who played it, where, and when. Left out,
 * chess.js writes "?" in each, which is the honest answer for a line somebody
 * pushed around a board on their own.
 */
export interface PgnPlayers {
  white: string;
  black: string;
  /** Where it was played — this app's own address. */
  site: string;
}

/**
 * How a game finished, for the tags that cannot be worked out from the moves.
 *
 * A resignation and a draw by agreement leave no trace on the board: the last
 * position is an ordinary one, and chess.js reads "*" from it — which says the
 * game is still going. Only the players know otherwise, so they have to say.
 */
export interface PgnEnding {
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  /** In plain words, for the comment after the last move. */
  how: string;
}

/**
 * How the game ended, where the last position says so by itself: a mate, a
 * stalemate, or too little left for either side to mate. Those end a game by
 * the rules, with nobody having to claim anything, so a line that reaches one
 * is over, and a PGN of it that called it unfinished would be wrong.
 *
 * A repetition or fifty moves without a capture are left alone: they end a
 * game only when a player claims them, and a line being studied can pass
 * through either on its way somewhere.
 *
 * The words are the ones `describeEnding` gives the same endings, so a game
 * ended on the board reads as one that ended in play.
 */
function endingOnBoard(game: Chess): PgnEnding | null {
  if (game.isCheckmate()) {
    return { result: game.turn() === "w" ? "0-1" : "1-0", how: "Checkmate" };
  }
  if (game.isStalemate()) {
    return { result: "1/2-1/2", how: "Stalemate" };
  }
  if (game.isInsufficientMaterial()) {
    return { result: "1/2-1/2", how: "Draw — too little material to mate" };
  }
  return null;
}

/**
 * The result a position has settled by itself, as PGN writes it, or null for
 * one still open: for the board to say over a line nobody named, as a file
 * of it would.
 */
export function resultOnBoard(game: Chess): PgnEnding["result"] | null {
  return endingOnBoard(game)?.result ?? null;
}

export function toPgn(
  history: PositionHistory,
  event: string | null = null,
  players: PgnPlayers | null = null,
  ending: PgnEnding | null = null
): string | null {
  const line = [...history.entries].reverse();
  let game: Chess;
  try {
    game = new Chess(line[0].fen);
  } catch {
    return null;
  }

  for (const entry of line.slice(1)) {
    if (entry.move === null) {
      continue;
    }
    try {
      game.move(entry.move);
    } catch {
      return null;
    }
  }

  if (event !== null && event !== "") {
    game.setHeader("Event", event);
  }

  if (players !== null) {
    game.setHeader("Site", players.site);
    // PGN dates are yyyy.mm.dd, and a game played today is dated today.
    const today = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    game.setHeader(
      "Date",
      `${today.getFullYear()}.${pad(today.getMonth() + 1)}.${pad(today.getDate())}`,
    );
    game.setHeader("Round", "?");
    game.setHeader("White", players.white);
    game.setHeader("Black", players.black);
  }

  /* Worked out from the board, rather than said by whoever called this. */
  const onBoard = ending === null;
  if (ending === null) {
    ending = endingOnBoard(game);
  }
  if (ending !== null) {
    game.setHeader("Result", ending.result);
    /*
      "normal" in PGN's own vocabulary means the game ended by the rules of
      chess, which a resignation and an agreed draw both do. What actually
      happened goes in a comment after the last move, where a reader will see
      it and no parser will trip over it.
    */
    /*
      Not for a line with nobody in it — a task, an exercise — that the board
      alone ended: it is kept as short as it goes, its result saying who won
      and its last move's "#" already saying how. A game somebody played says
      it in full, and so does any ending the board could not show, such as a
      resignation, which the comment is the only record of.
    */
    if (ending.result !== "*" && !(onBoard && players === null)) {
      game.setHeader("Termination", "normal");
      game.setComment(ending.how);
    }
  }

  return game.pgn({ maxWidth: 72, newline: "\n" });
}
