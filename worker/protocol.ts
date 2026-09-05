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
   * How many moves at the head of `moves` were carried in rather than played
   * here.
   *
   * They are moves of the game like any other — they are what the position
   * stands on, they are numbered with the rest, and they come out in the PGN —
   * but they are not this game's to unmake. A takeback reaches back only as
   * far as the point the players started from; before that is somebody's
   * history, possibly their own from a week ago.
   */
  priorMoves: number;
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
  /**
   * When the game began and when it finished — set as the status reaches each,
   * and null until it does.
   *
   * Kept by the object rather than by either browser, because they are facts
   * about the game and not about a chair at it: both players should be told the
   * same times, a game walked back into from another browser has times to show,
   * and a clock that is wrong is then wrong for the record rather than for one
   * reader. A challenge nobody answered never started, and keeps a null.
   */
  startedAt: number | null;
  endedAt: number | null;
  /**
   * When the game was last written to, which is what it is kept by.
   *
   * Every change goes through one place and stamps this, so "nothing has
   * happened here since" is a subtraction rather than a search.
   */
  touchedAt: number;
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
      /** What revision this end speaks; see PROTOCOL_VERSION. */
      v?: number;
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
      /**
       * Moves already played, carried into the game — a game abandoned and
       * taken up again, or one read in from a PGN.
       *
       * Played from `initialFEN`, and refused if they will not play. They
       * become the head of the game's own move list rather than a separate
       * account of it, so what the players are shown, what a takeback may
       * reach, and what comes out as a PGN are all read from one line.
       *
       * Not to be given together with odds either, for the same reason: a game
       * that has been played is not a game that starts with a piece missing.
       */
      line?: string[];
    }
  /** Asks what this invite is, claiming nothing and needing no token. */
  | { type: "peek"; v?: number }
  /**
   * A question put to the opponent, for them to answer in person.
   *
   * The object does not answer it and does not look at it — it carries it
   * across and carries the answer back. What is being tested is the whole
   * round trip: this client's line up, the object, the opponent's line down,
   * their code running well enough to read a message and reply, and the whole
   * way back again. A socket that is open at one end and dead at the other
   * cannot fake it, because the answer has to be computed.
   */
  | { type: "probe"; token: string; text: string }
  /** The answer to one, on its way back. */
  | { type: "probed"; token: string; text: string }
  | {
      type: "answer";
      v?: number;
      token: string;
      name: string;
      accept: boolean;
      /** Required when the challenge left the choice open, refused otherwise. */
      color?: Color;
    }
  /** Comes back to a game already joined, on a new connection. */
  | { type: "resume"; v?: number; token: string }
  /**
   * How a game stands, for somebody keeping a list of them rather than playing
   * one.
   *
   * `resume` would answer the same question, and answer it by sitting down: it
   * binds the connection to the player and tells the opponent they are here.
   * A browser looking over its games would light and unlight every opponent's
   * lamp in turn, having joined nothing. This reads and says nothing to anyone.
   */
  | { type: "standing"; v?: number; token: string }
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
      startedAt: number | null;
      endedAt: number | null;
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
      startedAt: number | null;
      endedAt: number | null;
      /**
       * The line the game starts on: empty for a game beginning from nothing
       * played, and the carried moves for one being continued. The challenger
       * has been looking at an invite, not at a game, and this is the board
       * they are being handed.
       */
      moves: string[];
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
      startedAt: number | null;
      endedAt: number | null;
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
  | { type: "ended"; result: GameResult; reason: EndReason; at: number }
  | { type: "drawOffered"; by: Color }
  | { type: "drawDeclined" }
  /**
   * Whether the other player has a connection open at this moment.
   *
   * Told rather than asked: only the object knows what sockets it holds, and a
   * client pinging its opponent through the object would be asking the object
   * that same question the long way round — and getting no answer at all in
   * precisely the case it cares about.
   */
  | { type: "presence"; opponent: boolean }
  /** The opponent's question, to be answered. */
  | { type: "probe"; text: string }
  /** Their answer to yours. */
  | { type: "probed"; text: string }
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
  /** Answered already, and being played: there is no seat to take. */
  | "alreadyAnswered"
  /** Answered, played, and finished. */
  | "gameOver"
  | "ownInvite"
  | "unknownToken"
  /** The two ends are not speaking the same revision of this conversation. */
  | "versionMismatch"
  | "badPosition"
  /** The moves carried in will not play from the position given. */
  | "badLine"
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
  /**
   * How many of the game's moves were carried in with it, as a count — the
   * moves themselves arrive with the game, and saying them twice would be two
   * accounts of one line. Zero for a game that started from nothing played.
   */
  priorMoves: number;
}

/**
 * The heartbeat, as two fixed strings.
 *
 * Fixed because the object answers them without waking: a hibernating Durable
 * Object can be told one exact message to reply to one exact way, and the
 * runtime does it while the object stays asleep. So a client may ask "are you
 * there" as often as it likes without costing a wake-up — which is the only
 * reason asking often is affordable at all.
 *
 * They are not part of `FromClient` or `FromServer`: nothing in the object or
 * the app ever sees one.
 */
/**
 * What revision of this conversation both ends are speaking.
 *
 * Raised whenever a change would leave the two ends misunderstanding each
 * other — a message renamed, a field given a different meaning, a refusal
 * where there used to be an answer. Not raised for anything an older end would
 * simply ignore, since ignoring is what an unknown field already gets.
 *
 * The app and the object are one deployment, so they are only ever out of step
 * for one reason: a page open since before a deploy. That page has last week's
 * code and is about to be told about a game by an object running today's, and
 * the honest thing is to say so rather than carry on and be subtly wrong.
 *
 * A client that sends nothing here is older than the version that started
 * sending it, and is treated as a mismatch on those grounds.
 */
/**
 * How long a game is kept after nothing more happens to it.
 *
 * Untouched for this long, not created this long ago: a game being played is
 * written to on every move, so the clock on it keeps going back to the start,
 * and only a game nobody has come near for a week is one nobody is coming back
 * to. A finished game is untouched from the moment it ends, which is the same
 * thing said the other way.
 *
 * A week is a guess, and the only one that matters is that it be longer than a
 * game left overnight and shorter than forever. It can be overridden per
 * deployment with a `GAME_TTL_MS` variable, which is also how the tests give
 * themselves a few seconds instead of a week.
 */
export const KEPT_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export const PROTOCOL_VERSION = 3;

/**
 * How often each player asks the other, and how long an unanswered question
 * waits before the light goes out.
 *
 * Two of these are the round trip and the timeout; the third is the answer
 * itself. A question is eight characters of nothing in particular and the
 * answer is those characters backwards — trivial to compute and impossible to
 * produce without having read the question, which is the whole point of asking
 * it this way rather than trusting a socket to still be attached to somebody.
 */
export const PROBE_EVERY = 3_000;
export const PROBE_SILENT = 6_000;

/** What a probe's text must come back as. */
export const answerTo = (text: string): string =>
  [...text].reverse().join("");

export const PING = '{"type":"ping"}';
export const PONG = '{"type":"pong"}';

/**
 * How long a connection may go without a sign of life before it is treated as
 * gone.
 *
 * Sockets do not always close. A tab navigated away, a laptop shut, a network
 * handed over — the far end stops existing and nothing says so, and the object
 * goes on holding a socket that will never carry anything again. Counting
 * those as a player who is present is how a light stays green over an empty
 * chair.
 *
 * Measured against the beat that reaches the object, not the heartbeat that
 * stops short of it: three of those, so that one late beat is not read as
 * somebody leaving, and somebody leaving is noticed within a few seconds.
 */
export const STALE_AFTER = 6_000;

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
  // Records written before games could be continued carried none.
  priorMoves: record.priorMoves ?? 0,
});
