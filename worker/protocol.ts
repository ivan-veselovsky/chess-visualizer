import type { Handicap } from "../src/chess/handicap";

/** Which army a player has. */
export type Color = "w" | "b";

/**
 * A side left to whoever answers the challenge — one cuts, the other chooses.
 *
 * A name rather than a null: "the challenger declined to pick" is a decision,
 * and a decision reads badly as an absence.
 */
export const OPPONENT_CHOOSES = "opponentChooses" as const;

/** A side, or the standing decision to let the other player pick it. */
export type ColorChoice = Color | typeof OPPONENT_CHOOSES;

/** One of the two people in a game. */
export interface Player {
  /**
   * The secret this player proves themselves with. Chosen by that client, kept
   * by it, and never sent to anyone else — not to the opponent, not in a URL.
   */
  token: string;
  name: string;
  /**
   * Which army. `OPPONENT_CHOOSES` only on the challenger, and only while the
   * invite is unanswered: it is the one term a challenger settles by declining
   * to settle it.
   */
  color: ColorChoice;
}

/**
 * Where a game has got to.
 *
 * `planning` is an invite waiting for its answer, and it is the only state an
 * invite can be answered from — which is the whole single-use guarantee, held
 * in one field rather than in a flag beside it. Nothing returns to it.
 *
 * A challenge turned down is `finished` like any other game that will see no
 * more moves; what tells the two apart is the reason, not the status.
 */
export type GameStatus = "planning" | "inProgress" | "finished";

/**
 * How a finished game stood, in the vocabulary the PGN Result tag uses — so a
 * game exported from here needs no translation. "*" is PGN's own "no result",
 * which is what a game that was never played has: it is not a draw.
 */
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

/**
 * Why a game ended, which the result does not say. "1-0 by checkmate" and
 * "1-0 by resignation" are the same result and different games, and a draw has
 * four causes that no result can distinguish.
 */
export type EndReason =
  | "challengeDeclined"
  /** The challenger took the invite back before anyone answered it. */
  | "challengeCancelled"
  | "checkmate"
  | "resignation"
  | "stalemate"
  | "agreement"
  | "repetition"
  | "fiftyMove"
  | "insufficientMaterial";

/**
 * A game as the object remembers it.
 *
 * Nothing here is a request. A color asked for at random is settled before it
 * is written, so what is stored is only ever "w" or "b"; the position asked for
 * is checked before it is written, so what is stored is only ever playable.
 */
export interface GameRecord {
  host: Player;
  guest: Player | null;
  status: GameStatus;
  /** "*" until there is one — which a declined challenge never has. */
  result: GameResult;
  /** Set when the status becomes `finished`, and only then. */
  reason: EndReason | null;
  /** The odds, as the challenger named them; null for an even game. */
  handicap: Handicap | null;
  /**
   * How many times each player may take a move back — their own last one, and
   * only while it is still the last. Nothing to do with chess; something to
   * play with a child.
   */
  takebacks: number;
  /**
   * Where the game starts, worked out from the odds and never read back.
   *
   * Null while the colors are open: odds are given by a person, and which
   * board that makes cannot be known until it is known which side they are.
   */
  initialFEN: string | null;
  /**
   * The moves played, in the notation a PGN carries. The position is not
   * stored: it is what these come to when played from `initialFEN`, and one
   * account of a game is easier to keep true than two.
   */
  moves: string[];
  /**
   * Takebacks each player has left, counted down from `takebacks`.
   *
   * Per player, and spent by using them: a game where one side has thought
   * better of three moves and the other of none is the ordinary case, and one
   * shared pool would let either of them use up both allowances.
   */
  takebacksLeft: Tally;
  /** Who has a draw on offer, when one is standing. */
  drawOfferedBy: Color | null;
  createdAt: number;
}

/**
 * The moves a game's state is allowed to make. Asserted on every write, since
 * an invite answered twice would be exactly a second `planning` transition.
 */
export function canMoveTo(from: GameStatus, to: GameStatus): boolean {
  if (from === "planning") {
    return to === "inProgress" || to === "finished";
  }
  if (from === "inProgress") {
    return to === "finished";
  }
  return false;
}

/** What a client sends. */
export type FromClient =
  | {
      type: "create";
      token: string;
      name: string;
      /** `OPPONENT_CHOOSES` to let whoever answers pick, and take the rest. */
      color: ColorChoice;
      /** The odds offered, said from the challenger's side. */
      handicap?: Handicap | null;
      /** Takebacks allowed each, 0 for none. */
      takebacks?: number;
      /**
       * A position to play from, for a game starting somewhere other than the
       * usual array. Not to be given together with odds: odds are what a
       * position is worked out from.
       */
      initialFEN?: string;
    }
  /** Asks what this invite is, claiming nothing and needing no token. */
  | { type: "peek" }
  | {
      type: "answer";
      token: string;
      name: string;
      accept: boolean;
      /** Required when the challenge left the choice open, refused otherwise. */
      color?: Color;
    }
  /** Comes back to a game already joined, on a new connection. */
  | { type: "resume"; token: string }
  /**
   * A move, and which ply it is meant to be.
   *
   * The number is what makes a move idempotent: sent twice after a connection
   * wobbles, the second arrives at a ply already played and is answered with
   * what happened rather than played again.
   */
  | { type: "move"; token: string; ply: number; san: string }
  /**
   * Takes back the move just made — your own, and only while it is still the
   * last. Once the opponent has replied it is part of the game.
   */
  | { type: "takeBack"; token: string }
  | { type: "resign"; token: string }
  /**
   * Takes an invite back. The challenger's own, and only while it is still
   * unanswered — an invite that has been taken up is a game, and a game is
   * given up by resigning.
   */
  | { type: "cancel"; token: string }
  | { type: "offerDraw"; token: string }
  | { type: "answerDraw"; token: string; accept: boolean };

/** What the object sends back. */
export type FromServer =
  | { type: "created"; you: ColorChoice; terms: Terms }
  /** `you` is `OPPONENT_CHOOSES` when the side is yours to pick. */
  | { type: "challenge"; challenger: string; you: ColorChoice; terms: Terms }
  | {
      type: "joined";
      you: Color;
      opponent: string;
      terms: Terms;
      /** Everything played so far — nothing, unless this is a reconnection. */
      moves: string[];
      takebacksLeft: Tally;
    }
  | { type: "declined" }
  /**
   * The invite has been answered.
   *
   * Carries the terms as they finally stand, which the challenger may not know
   * yet: a challenge that left the side open had no position until somebody
   * chose one, and the board it is played from follows from that choice.
   */
  | {
      type: "answered";
      accepted: boolean;
      opponent: string;
      you: Color;
      terms: Terms;
    }
  | {
      type: "state";
      you: ColorChoice;
      opponent: string | null;
      status: GameStatus;
      result: GameResult;
      reason: EndReason | null;
      terms: Terms;
      moves: string[];
      takebacksLeft: Tally;
      drawOfferedBy: Color | null;
    }
  /**
   * A move that has happened, told to both players by the one place that
   * decides. The position comes with it, so neither client has to agree with
   * the other about what the moves came to.
   */
  | {
      type: "moved";
      ply: number;
      san: string;
      fen: string;
      status: GameStatus;
      result: GameResult;
      reason: EndReason | null;
      takebacksLeft: Tally;
    }
  /** A move unmade, and what that left. */
  | { type: "tookBack"; ply: number; fen: string; takebacksLeft: Tally }
  /** The game is over by something other than a move. */
  | { type: "ended"; result: GameResult; reason: EndReason }
  | { type: "drawOffered"; by: Color }
  | { type: "drawDeclined" }
  | { type: "error"; code: ErrorCode; reason: string };

/**
 * What went wrong, in a form a client can act on.
 *
 * The `reason` beside it is for a log, not for a player: it is written from the
 * object's point of view, where "that game already exists" is exact and, to
 * someone who has just pressed a button once, baffling. Clients branch on the
 * code and say something of their own.
 */
export type ErrorCode =
  /** The id is taken by somebody else's game. Try another. */
  | "gameExists"
  | "noSuchGame"
  | "alreadyAnswered"
  | "ownInvite"
  | "unknownToken"
  | "badPosition"
  | "termsConflict"
  /** The challenge left the side open and the answer did not name one. */
  | "colorNeeded"
  | "badMessage"
  /** Not your move, or not your piece. */
  | "notYourTurn"
  /** The move will not play from the position it was sent for. */
  | "illegalMove"
  /** Sent for a ply that is not the one the game is waiting for. */
  | "staleMove"
  /** The game is over, or has not begun. */
  | "notPlaying"
  /** Nothing of yours to take back, or the opponent has already replied. */
  | "nothingToTakeBack"
  /** No takebacks left. */
  | "noTakebacksLeft"
  /** No draw is on offer, or the one on offer is your own. */
  | "noDrawOffered"
  /** The invite was taken back by whoever offered it. */
  | "challengeCancelled"
  /** Only the challenger may take their own invite back. */
  | "notYourInvite";

/**
 * What both players were told they were playing. Sent as one thing: a client
 * showing one of these without the others would be showing half a game.
 */
export interface Terms {
  handicap: Handicap | null;
  takebacks: number;
  /** Null while the colors are open; settled the moment they are. */
  initialFEN: string | null;
}

/** A number for each side. */
export interface Tally {
  w: number;
  b: number;
}

export const other = (color: Color): Color => (color === "w" ? "b" : "w");

export const termsOf = (record: GameRecord): Terms => ({
  handicap: record.handicap,
  takebacks: record.takebacks,
  initialFEN: record.initialFEN,
});
