import { useCallback, useEffect, useRef, useState } from "react";
import type { Color } from "chess.js";
import type { Handicap } from "../../chess/handicap";
import type {
  ColorChoice,
  EndReason,
  ErrorCode,
  GameResult,
  GameStatus,
  Tally,
  Terms,
} from "../../../worker/protocol";
import {
  answerTo,
  OPPONENT_CHOOSES,
  PROBE_EVERY,
  PROBE_SILENT,
  PROTOCOL_VERSION,
} from "../../../worker/protocol";
import {
  forgetGameInUrl,
  gameInUrl,
  gameLink,
  askGame,
  openGame,
  showGameInUrl,
  type Connection,
  type FromClient,
  type FromServer,
} from "./connection";
import {
  forgetGame,
  forgetSeats,
  gameOf,
  markGameOver,
  isChallengerSeat,
  loadGame,
  newGameId,
  newToken,
  saveGame,
  saveName,
  savedGames,
  savedName,
  seatOf,
  type SavedGame,
} from "./storage";

/**
 * What to tell a player, for each way the object can say no.
 *
 * The object's own wording is written from where it stands — "that game
 * already exists" is exact, and means nothing to someone who has pressed a
 * button once. These are the same events, said to the person in front of them.
 */
function explain(code: ErrorCode): string {
  switch (code) {
    case "colorNeeded":
      return "Choose a side before accepting.";
    case "gameExists":
      return "That game id is taken. Try sending the challenge again.";
    case "noSuchGame":
      return "Game not found.";
    case "alreadyAnswered":
      return "That game is under way.";
    case "gameOver":
      return "That game is over.";
    case "ownInvite":
      return "This is your own challenge — send it to a friend instead.";
    case "unknownToken":
      return "This browser is not one of the players in that game.";
    case "versionMismatch":
      return "This page is out of date. Reload it to carry on.";
    case "badPosition":
      return "That position cannot be played from.";
    case "badLine":
      return "That game cannot be continued.";
    case "termsConflict":
      return "Choose odds or a game to continue, not both.";
    case "notYourTurn":
      return "It is not your move.";
    case "illegalMove":
      return "That move cannot be played here.";
    case "staleMove":
      return "That was for an earlier position — the game has moved on.";
    case "notPlaying":
      return "That game is not being played.";
    case "nothingToTakeBack":
      return "There is no move of yours to take back.";
    case "noTakebacksLeft":
      return "You have no takebacks left.";
    case "noDrawOffered":
      return "There is no draw on offer to you.";
    case "challengeCancelled":
      return "That challenge was taken back.";
    case "notYourInvite":
      return "That challenge is not yours to take back.";
    case "badMessage":
      return "Something went wrong talking to the server.";
  }
}

/**
 * Eight characters of nothing in particular, minted fresh for every question.
 *
 * Drawn from the same source the tokens are, for no reason but that it is the
 * source at hand; nothing here is a secret. What matters is only that the
 * opponent cannot have seen this one before, so that answering it means having
 * read it — a fixed question could be answered by anything that had ever heard
 * the answer once.
 */
function newProbe(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => letters[b % letters.length]).join("");
}

/**
 * The refusals that happen inside a game that is otherwise fine.
 *
 * Everything else means this browser is not in the game it thinks it is, and
 * there is nothing to go back to.
 */
/**
 * What a game hands out when it says nothing about it.
 *
 * A record written by an older build has no such field, and a client that
 * reads one should show a game it cannot take back moves in rather than fall
 * over. Cheap insurance against exactly the kind of rename this field has
 * already been through once.
 */
const NO_TAKEBACKS: Tally = { w: 0, b: 0 };

const DURING_PLAY = new Set<ErrorCode>([
  "notYourTurn",
  "illegalMove",
  "staleMove",
  "nothingToTakeBack",
  "noTakebacksLeft",
  "noDrawOffered",
]);

/**
 * How the line stands, from this end.
 *
 * `mine` is known here: the socket is open and answering, or it is not.
 * `theirs` can only be told by the object, so it is `null` — not false —
 * whenever this end cannot reach the object. A light that cannot be seen is
 * not a light that is off, and saying otherwise would be reporting an outage
 * on somebody else's side of the world on no evidence at all.
 */
export interface Link {
  mine: boolean;
  theirs: boolean | null;
}

const OFFLINE: Link = { mine: false, theirs: null };

/** What the challenger fills in. */
export interface ChallengeTerms {
  name: string;
  /** `OPPONENT_CHOOSES` leaves the side to whoever takes the game up. */
  color: ColorChoice;
  handicap: Handicap | null;
  takebacks: number;
  /**
   * A game to be taken up where it was left, instead of odds: where it began
   * and what has been played. Null for a game starting from nothing played.
   *
   * The two are alternatives because they are two answers to one question —
   * where this game starts — and a game that has been played for twenty moves
   * is not a game that starts with a piece missing.
   */
  continueFrom: { initialFEN: string; moves: string[] } | null;
}

/**
 * Where the friendly game has got to, from this browser's point of view.
 *
 * One phase at a time, each carrying exactly what its screen needs. A phase
 * that has a game id has one because the game exists; nothing here holds a
 * half-made game waiting for a field to be filled in.
 */
export type Phase =
  | { kind: "idle" }
  /** Composing a challenge; nothing has been created yet. */
  | { kind: "challenging" }
  /*
    A game named by the address, before the server has said what it is. The
    address carries an id and nothing else, so until the object answers there
    is no telling whether this is a seat to take up, a game to come back to, or
    somebody else's game entirely — and showing any one of the three on a guess
    would mean showing the wrong one for as long as the round trip takes.
  */
  | { kind: "opening"; gameId: string }
  /** Created, invite out, nobody has answered. */
  | {
      kind: "waiting";
      gameId: string;
      link: string;
      you: ColorChoice;
      terms: Terms;
    }
  /** Looking at someone else's invite. */
  | {
      kind: "invited";
      gameId: string;
      challenger: string;
      /** `OPPONENT_CHOOSES` when picking a side is part of answering. */
      you: ColorChoice;
      terms: Terms;
    }
  | {
      kind: "playing";
      gameId: string;
      you: Color;
      opponent: string;
      terms: Terms;
      /** Takebacks each side has left. */
      takebacksLeft: Tally;
      /** Who has a draw on offer, when one is standing. */
      drawOffered: Color | null;
      /** How it ended, once it has; the game stays on screen either way. */
      over: { result: GameResult; reason: EndReason } | null;
      /**
       * When the game began and when it finished, as the object has them.
       *
       * Its clock and not this one's: two players in different places have two
       * clocks and one game, and the times a game is described by should be the
       * same for both of them. Null until the object has said — a game ending
       * while it is being watched is stamped from here, and corrected by the
       * object's own answer the next time this comes back to it.
       */
      startedAt: number | null;
      endedAt: number | null;
    }
  /** Over before it began: turned down by one side or the other. */
  | { kind: "declined"; mine: boolean }
  | { kind: "error"; reason: string };

/**
 * What the object says about a seat, as of the last time the list was read.
 *
 * Held apart from the saved record rather than written into it: the record is
 * what this browser knows on its own, and this is what the game itself says.
 * When the two disagree it is this one that is right, and the record is brought
 * up to date behind it.
 */
export interface Standing {
  status: GameStatus;
  result: GameResult;
  reason: EndReason | null;
  opponent: string | null;
  /** How far the game has got, in plies. */
  moves: number;
  startedAt: number | null;
  endedAt: number | null;
}

/**
 * The friendly-game side of the app: one connection, one phase, and the moves
 * between them.
 *
 * Every phase change comes from something the server said, not from what was
 * sent — a challenge is `waiting` because the object said `created`, and
 * `playing` because it said `joined` or `answered`. What the client believes
 * therefore cannot drift from what the object holds.
 */
/** What the app is told when the game moves on without it. */
export interface FriendListeners {
  /** A move that has been played, by either side, and where it left the board. */
  onMoved: (move: { ply: number; san: string; fen: string }) => void;
  /** A move unmade, and the position it went back to. */
  onTookBack: (back: { ply: number; fen: string }) => void;
  /** The whole line, on joining or coming back to a game. */
  onLine: (line: { initialFEN: string; moves: string[] }) => void;
}

export function useFriendGame(listeners: FriendListeners) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  /**
   * Something the object said no to, while the game goes on.
   *
   * A move out of turn or a takeback too late is a player being told no, not
   * a game falling over — and telling them so must not cost them the game they
   * are in the middle of.
   */
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState(savedName);
  const [link, setLink] = useState<Link>(OFFLINE);
  /**
   * The question put to the opponent that has not been answered yet, and when
   * the last one was answered properly.
   *
   * Every question is new. A fixed one could be answered by anything that had
   * ever seen the answer — a stale reply still in flight, a socket replaying
   * what it heard last time — and the whole reason for asking this way is that
   * the answer has to be worked out from the question just sent.
   */
  const asked = useRef<{ text: string; at: number } | null>(null);
  const answeredAt = useRef(0);
  /*
    The games this browser could still walk back into, read when there is a
    reason for the answer to have changed. Every one of them is entered or left
    through a phase change, so that is when to look again.
  */
  const [games, setGames] = useState<SavedGame[]>(savedGames);
  /*
    What each of those games says about itself, by seat, and whether the object
    could be reached at all to ask. A list nobody could refresh is shown as it
    was last known and said to be out of date, rather than quietly presented as
    the truth.
  */
  const [standings, setStandings] = useState<Map<string, Standing>>(new Map());
  const [reading, setReading] = useState(false);
  const [reachedThem, setReachedThem] = useState(true);
  /* Whether the games have been asked at all since the page opened. Before
     that, a row saying "in play" is this browser's own memory and is not
     claiming to be more. */
  const [beenAsked, setBeenAsked] = useState(false);
  const connection = useRef<Connection | null>(null);
  /*
    Held in a ref and refreshed every render. The socket's handler is set up
    once, and a handler that closed over the app's first render would be
    telling a version of the app that no longer exists.
  */
  const told = useRef(listeners);
  told.current = listeners;
  const token = useRef<string | null>(null);
  /**
   * Which seat this tab is at — the game's id, with a minus in front of it for
   * the side that offered the game. It is what the address says and what the
   * saved record is filed under, and it is the only thing distinguishing two
   * tabs of one browser sitting at the two ends of one board.
   */
  const seat = useRef<string | null>(null);
  /**
   * Whether the address this tab was opened at named a seat of its own — the
   * minus in front of the id.
   *
   * It decides what silence means. A number somebody read out, or a link a
   * friend sent, that turns out to name no game is worth saying so about: the
   * digits are wrong, or the game is long gone, and the reader can do
   * something about it. One's own old address is not. It is a page left open
   * in a tab since last week, or a bookmark of a game that has since been
   * played and forgotten, and the useful thing to do with it is to put a clean
   * board up and say nothing at all.
   */
  const cameFromOwnAddress = useRef(false);
  /** A retry waiting to happen, and how many have been waited for. */
  const retry = useRef<number | null>(null);
  /** Consecutive failures, which is what the waiting is measured against. */
  const attempts = useRef(0);
  /**
   * Whether this page has been told it is older than the game it is playing.
   *
   * Nothing is retried after that. A page that cannot be understood will not
   * be understood any better on the fourth attempt, and going quiet is what
   * makes the one thing worth doing — reloading — the only thing left to do.
   */
  const [outdated, setOutdated] = useState(false);
  /** The challenge being made, kept in case its id turns out to be taken. */
  const offering = useRef<{ terms: ChallengeTerms; tries: number } | null>(
    null
  );

  const stopRetrying = useCallback(() => {
    if (retry.current !== null) {
      window.clearTimeout(retry.current);
      retry.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    stopRetrying();
    connection.current?.close();
    connection.current = null;
    setLink(OFFLINE);
  }, [stopRetrying]);

  /**
   * Goes back for a game whose line has dropped.
   *
   * Nothing about the phase is touched. A connection coming and going is not
   * something happening to the game — the game is on the object, and this end
   * is only finding its way back to it — so the board stays as it was and the
   * lights say what is going on. What comes back from `resume` is the truth
   * about the game, and it lands through the ordinary handler.
   *
   * Held in a ref so that the close handler, which was made once, can reach
   * today's version of it.
   */
  const comeBack = useRef<() => void>(() => undefined);

  const connect = useCallback(
    (gameId: string, onMessage: (message: FromServer) => void) => {
      disconnect();
      connection.current = openGame(
        gameId,
        onMessage,
        () => comeBack.current(),
        // Losing this end makes the other end unknowable, which is a different
        // thing from knowing it is gone.
        (up) => {
          if (up) {
            // Back on the line: the next drop starts its waiting over.
            attempts.current = 0;
          }
          setLink((was) => (up ? { ...was, mine: true } : OFFLINE));
        }
      );
      return connection.current;
    },
    [disconnect]
  );

  /** Everything the object can say, and what this browser does about it. */
  const handle = useCallback(
    (gameId: string, message: FromServer) => {
      switch (message.type) {
        case "created":
          offering.current = null;
          // From here the tab is at this game, and its address says so.
          showGameInUrl(seat.current ?? gameId);
          setPhase({
            kind: "waiting",
            gameId,
            link: gameLink(gameId),
            you: message.you,
            terms: message.terms,
          });
          break;
        case "challenge":
          setPhase({
            kind: "invited",
            gameId,
            challenger: message.challenger,
            you: message.you,
            terms: message.terms,
          });
          break;
        case "moved":
          setNotice(null);
          // A move can be the one that ends it — mate, or a draw on the board.
          if (message.status === "finished" && message.reason !== null) {
            markGameOver(gameId, {
              result: message.result,
              reason: message.reason,
            });
          }
          told.current.onMoved(message);
          setPhase((current) =>
            current.kind === "playing"
              ? {
                  ...current,
                  takebacksLeft: message.takebacksLeft ?? NO_TAKEBACKS,
                  drawOffered: null,
                  over:
                    message.status === "finished" && message.reason !== null
                      ? { result: message.result, reason: message.reason }
                      : current.over,
                  /* Stamped here, because a move carries no time: it is
                     happening now, and now is accurate to the millisecond it
                     took to arrive. The object's own stamp replaces this the
                     next time the game is come back to. */
                  endedAt:
                    message.status === "finished"
                      ? (current.endedAt ?? Date.now())
                      : current.endedAt,
                }
              : current
          );
          break;
        case "tookBack":
          setNotice(null);
          told.current.onTookBack(message);
          setPhase((current) =>
            current.kind === "playing"
              ? {
                  ...current,
                  takebacksLeft: message.takebacksLeft ?? NO_TAKEBACKS,
                  drawOffered: null,
                }
              : current
          );
          break;
        case "ended":
          setNotice(null);
          markGameOver(gameId, {
            result: message.result,
            reason: message.reason,
          });
          setPhase((current) =>
            current.kind === "playing"
              ? {
                  ...current,
                  drawOffered: null,
                  over: { result: message.result, reason: message.reason },
                  endedAt: message.at,
                }
              : current
          );
          break;
        case "drawOffered":
          setNotice(null);
          setPhase((current) =>
            current.kind === "playing"
              ? { ...current, drawOffered: message.by }
              : current
          );
          break;
        case "drawDeclined":
          setNotice(null);
          setPhase((current) =>
            current.kind === "playing"
              ? { ...current, drawOffered: null }
              : current
          );
          break;
        case "joined":
          showGameInUrl(seat.current ?? gameId);
          told.current.onLine({
            initialFEN: message.terms.initialFEN ?? "",
            moves: message.moves,
          });
          saveGame({
            gameId,
            token: token.current ?? "",
            you: message.you,
            myName: nameAt(seat.current),
            opponentName: message.opponent,
            role: "opponent",
          });
          setPhase({
            kind: "playing",
            gameId,
            you: message.you,
            opponent: message.opponent,
            terms: message.terms,
            takebacksLeft: message.takebacksLeft ?? NO_TAKEBACKS,
            drawOffered: null,
            over: null,
            startedAt: message.startedAt,
            endedAt: message.endedAt,
          });
          break;
        case "answered":
          setNotice(null);
          /*
            The record was written when the invite went out, when there was
            nobody to name. Now there is, and the list of games to come back to
            is read from these records — a game that says "waiting for an
            answer" long after one arrived is a list telling the reader
            something that stopped being true.
          */
          if (message.accepted && token.current !== null) {
            saveGame({
              gameId,
              token: token.current,
              you: message.you,
              myName: nameAt(seat.current),
              opponentName: message.opponent,
              role: "challenger",
            });
          }
          /*
            The board the game starts from, which the challenger may be seeing
            for the first time: the terms settle at the moment somebody answers,
            and until then this browser was showing whatever was on it.
          */
          if (message.accepted && message.terms.initialFEN !== null) {
            told.current.onLine({
              initialFEN: message.terms.initialFEN,
              // Empty for a game starting from scratch; the carried line for
              // one being continued, which the challenger's board must show
              // whatever they have been pushing around since offering it.
              moves: message.moves,
            });
          }
          setPhase((current) =>
            current.kind === "waiting" && message.accepted
              ? {
                  kind: "playing",
                  gameId,
                  // Whatever the challenger asked for, what they have now is
                  // whatever the answer left them.
                  you: message.you,
                  opponent: message.opponent,
                  terms: message.terms,
                  takebacksLeft: {
                    w: message.terms.takebacks,
                    b: message.terms.takebacks,
                  },
                  drawOffered: null,
                  over: null,
                  startedAt: message.startedAt,
                  endedAt: message.endedAt,
                }
              : { kind: "declined", mine: false }
          );
          break;
        case "declined":
          setPhase({ kind: "declined", mine: true });
          break;
        case "state":
          showGameInUrl(seat.current ?? gameId);
          /*
            The record is rewritten before it is marked, not after. Writing it
            is writing the whole of it, so a rewrite that knows nothing about
            an ending is a rewrite that removes one — and coming back to a game
            that finished last week would quietly turn it into a game still
            being played.
          */
          // Coming back is a chance to hear who the opponent turned out to be,
          // for a browser that left before they answered.
          if (
            message.opponent !== null &&
            token.current !== null &&
            seat.current !== null
          ) {
            saveGame({
              gameId,
              token: token.current,
              you: message.you,
              myName: nameAt(seat.current),
              opponentName: message.opponent,
              /*
                Read off the seat this tab came back to, not looked up by the
                game. A browser can hold both seats at one game, and asking the
                game which of them this is has two answers — one of which files
                this player's token over the other player's record.
              */
              role: isChallengerSeat(seat.current)
                ? "challenger"
                : "opponent",
            });
          }
          // And now the ending, which outlasts everything above it.
          if (message.status === "finished" && message.reason !== null) {
            markGameOver(gameId, {
              result: message.result,
              reason: message.reason,
            });
          }
          if (message.terms.initialFEN !== null) {
            told.current.onLine({
              initialFEN: message.terms.initialFEN,
              moves: message.moves,
            });
          }
          setPhase(
            message.opponent === null || message.you === OPPONENT_CHOOSES
              ? {
                  kind: "waiting",
                  gameId,
                  link: gameLink(gameId),
                  you: message.you,
                  terms: message.terms,
                }
              : {
                  kind: "playing",
                  gameId,
                  you: message.you,
                  opponent: message.opponent,
                  terms: message.terms,
                  takebacksLeft: message.takebacksLeft ?? NO_TAKEBACKS,
                  drawOffered: message.drawOfferedBy,
                  over:
                    message.status === "finished" && message.reason !== null
                      ? { result: message.result, reason: message.reason }
                      : null,
                  startedAt: message.startedAt,
                  endedAt: message.endedAt,
                }
          );
          break;
        case "presence":
          /*
            The object's own view, which is worth having at the moment a game
            is joined or come back to: it is right there and there is no reason
            to look at an unknown light for three seconds waiting for a probe.
            After that the probes are the measure, and a probe that goes
            unanswered puts the light out whatever this said.
          */
          setLink((was) => ({ ...was, theirs: message.opponent }));
          if (message.opponent) {
            answeredAt.current = Date.now();
          }
          break;
        case "probe":
          // Their question. Answering it is what proves this end is a player
          // and not a socket somebody forgot to close.
          if (token.current !== null) {
            connection.current?.send({
              type: "probed",
              token: token.current,
              text: answerTo(message.text),
            });
          }
          break;
        case "probed":
          // Ours, answered. Only the answer to the question actually
          // outstanding counts; anything else is late, or was not worked out.
          if (
            asked.current !== null &&
            message.text === answerTo(asked.current.text)
          ) {
            asked.current = null;
            answeredAt.current = Date.now();
            setLink((was) => ({ ...was, theirs: true }));
          }
          break;
        case "error":
          /*
            Nine digits are short enough to say down a telephone and short
            enough to collide, once in a very long while. The object is the
            arbiter — it is single-threaded, so of two clients arriving at the
            same number one is simply second — and being second is recoverable:
            pick another number and offer again.

            Which is why the id is minted here rather than asked for. A server
            handing them out would have to be asked, and an answer that went
            astray would leave a game nobody could reach; minting locally means
            a retry carries the same token to the same object, and the object
            recognises it.
          */
          if (
            offering.current !== null &&
            offering.current.tries < 10 &&
            message.code === "gameExists"
          ) {
            const retry = offering.current;
            offering.current = null;
            offer(retry.terms, retry.tries + 1);
            break;
          }
          offering.current = null;
          if (DURING_PLAY.has(message.code)) {
            setNotice(explain(message.code));
            break;
          }
          /*
            A token the object does not recognise, or a game it has never heard
            of, is a saved game that has stopped being one — the record was
            wiped, or the id was mistyped in the first place. Dropped here so
            that the list of games to come back to does not go on offering a
            door that opens onto nothing.
          */
          if (message.code === "versionMismatch") {
            setOutdated(true);
            stopRetrying();
            break;
          }
          const gone =
            message.code === "unknownToken" || message.code === "noSuchGame";
          if (gone && seat.current !== null) {
            forgetGame(seat.current);
          }
          /*
            An address of this tab's own that names nothing: an old link, a
            game since forgotten, an object long collected. Nothing to tell
            anybody — the board is cleared of it and the page is as it would
            have been had they typed the address without the question.
          */
          if (gone && cameFromOwnAddress.current) {
            cameFromOwnAddress.current = false;
            seat.current = null;
            forgetGameInUrl();
            setPhase({ kind: "idle" });
            break;
          }
          setPhase({ kind: "error", reason: explain(message.code) });
          break;
      }
    },
    [name]
  );

  /** Offers a game, and holds the invite open until it is answered. */
  const offer = useCallback(
    (terms: ChallengeTerms, tries = 0) => {
      offering.current = { terms, tries };
      const gameId = newGameId();
      token.current = newToken();
      seat.current = seatOf(gameId, "challenger");
      setName(terms.name);
      saveName(terms.name);
      saveGame({
        // Written before the message is sent: a reply that never arrives must
        // not take the only copy of the token with it.
        gameId,
        token: token.current,
        you: terms.color,
        myName: terms.name,
        opponentName: null,
        role: "challenger",
      });
      connect(gameId, (message) => handle(gameId, message)).send({
        type: "create",
        v: PROTOCOL_VERSION,
        token: token.current,
        name: terms.name,
        color: terms.color,
        handicap: terms.handicap,
        takebacks: terms.takebacks,
        // Sent only when there is one; an absent line is a game that starts
        // where games start.
        ...(terms.continueFrom === null
          ? {}
          : {
              initialFEN: terms.continueFrom.initialFEN,
              line: terms.continueFrom.moves,
            }),
      });
    },
    [connect, handle]
  );

  const challenge = useCallback(
    (terms: ChallengeTerms) => offer(terms),
    [offer]
  );

  /**
   * Goes to a game by its id alone, which is all a link or a spoken number
   * carries.
   *
   * What comes back decides what it was: an invite to take up, a game already
   * under way, or nothing at all. Held in `opening` until then rather than
   * guessed at.
   */
  const openInvite = useCallback(
    (gameId: string) => {
      seat.current = null;
      setPhase({ kind: "opening", gameId });
      connect(gameId, (message) => handle(gameId, message)).send({
        type: "peek",
        v: PROTOCOL_VERSION,
      });
    },
    [connect, handle]
  );

  /**
   * Back into a game this browser still holds a token for.
   *
   * The token is what does it — the id alone would only ask to be let in, and
   * the object would rightly say the seat is taken.
   */
  const rejoinQuietly = useCallback(
    (mine: string) => {
      const saved = loadGame(mine);
      if (saved === null) {
        return;
      }
      const gameId = gameOf(mine);
      token.current = saved.token;
      seat.current = mine;
      connect(gameId, (message) => handle(gameId, message)).send({
        type: "resume",
        v: PROTOCOL_VERSION,
        token: saved.token,
      });
    },
    [connect, handle]
  );

  const rejoin = useCallback(
    (mine: string) => {
      if (loadGame(mine) === null) {
        return;
      }
      // Said out loud, unlike the one the retry uses: this is somebody asking
      // for a game, and the wait is theirs to see.
      setPhase({ kind: "opening", gameId: gameOf(mine) });
      rejoinQuietly(mine);
    },
    [rejoinQuietly]
  );

  /** Answers one, either way. Both spend the invite. */
  const answer = useCallback(
    (accept: boolean, myName: string, color?: Color) => {
      if (phase.kind !== "invited") {
        return;
      }
      token.current = newToken();
      seat.current = seatOf(phase.gameId, "opponent");
      setName(myName);
      saveName(myName);
      const mine = phase.you === OPPONENT_CHOOSES ? (color ?? "w") : phase.you;
      saveGame({
        gameId: phase.gameId,
        token: token.current,
        you: mine,
        myName,
        opponentName: phase.challenger,
        role: "opponent",
      });
      connection.current?.send({
        type: "answer",
        v: PROTOCOL_VERSION,
        token: token.current,
        name: myName,
        accept,
        // Sent only when the challenge asked for it; sending it otherwise is
        // an attempt to change terms that were already settled.
        ...(phase.you === OPPONENT_CHOOSES && color !== undefined
          ? { color }
          : {}),
      });
    },
    [phase]
  );

  /**
   * Offers a move. Nothing is put on the board here: the object decides, and
   * what comes back is what happened — which is also what the opponent is told,
   * so the two boards cannot come to differ.
   */
  const move = useCallback((ply: number, san: string) => {
    if (token.current === null) {
      return;
    }
    connection.current?.send({
      type: "move",
      token: token.current,
      ply,
      san,
    });
  }, []);

  /** The four things a player can do besides move. */
  const say = useCallback((message: Omit<FromClient, "token">) => {
    if (token.current !== null) {
      connection.current?.send({
        ...message,
        token: token.current,
      } as FromClient);
    }
  }, []);

  const takeBack = useCallback(() => say({ type: "takeBack" } as never), [say]);
  const resign = useCallback(() => say({ type: "resign" } as never), [say]);
  const offerDraw = useCallback(
    () => say({ type: "offerDraw" } as never),
    [say]
  );
  const answerDraw = useCallback(
    (accept: boolean) => say({ type: "answerDraw", accept } as never),
    [say]
  );

  const start = useCallback(() => setPhase({ kind: "challenging" }), []);

  /**
   * The name a seat was taken under, which is not always the name this browser
   * goes by now.
   *
   * Somebody who played a game as Bob and has since renamed themselves is still
   * Bob in that game — it is what the other player saw, what the object holds,
   * and what a PGN of it says. Written afresh on every rejoin, the record was
   * quietly restating the game's history in the present tense, and a list that
   * names its rows by their players was the first thing to show it.
   */
  const nameAt = useCallback(
    (where: string | null) =>
      (where === null ? null : loadGame(where)?.myName) ?? name,
    [name]
  );

  /**
   * Remembers the name to play under, whether or not a game comes of it.
   *
   * Naming yourself is naming yourself: somebody who types a name and then
   * thinks better of the game has still said what they are called, and being
   * asked again by the next dialog — with the old name in the field — is being
   * told the first answer was not listened to. Answering a challenge and
   * offering one both already keep it; this is the same thing for the ways out
   * that are not a game.
   */
  const remember = useCallback((typed: string) => {
    const named = typed.trim();
    if (named === "") {
      return;
    }
    setName(named);
    saveName(named);
  }, []);

  /**
   * Asks every game this browser holds a seat at how it stands.
   *
   * The list is only as true as its last answer, and the object is the only
   * thing that knows: a game left this morning may have been resigned since,
   * and nothing would have said so to a browser that was looking elsewhere. So
   * the list asks, whenever it is opened and whenever the reader asks it to.
   *
   * A few at a time rather than all at once: thirty games is thirty sockets,
   * and a browser that opens thirty at once spends longer on the last of them
   * than on all the rest. Each is asked with `standing`, which reads the game
   * without joining it, so no opponent sees a light blink for this.
   *
   * What comes back is also written into the records, since a game that has
   * ended since it was last seen should still say so if the next refresh
   * cannot reach anyone.
   */
  const readGames = useCallback(async () => {
    const seats = savedGames();
    setReading(true);
    const found = new Map<string, Standing>();
    let answers = 0;
    const AT_ONCE = 5;
    for (let from = 0; from < seats.length; from += AT_ONCE) {
      await Promise.all(
        seats.slice(from, from + AT_ONCE).map(async (game) => {
          const said = await askGame(
            game.gameId,
            { type: "standing", v: PROTOCOL_VERSION, token: game.token },
            ["state"]
          );
          if (said === null || said.type !== "state") {
            return;
          }
          answers += 1;
          found.set(seatOf(game.gameId, game.role), {
            status: said.status,
            result: said.result,
            reason: said.reason,
            opponent: said.opponent,
            moves: said.moves.length,
            startedAt: said.startedAt,
            endedAt: said.endedAt,
          });
          /* Brought up to date while the answer is here. */
          const ending =
            said.status === "finished" && said.reason !== null
              ? { result: said.result, reason: said.reason }
              : undefined;
          const changed =
            (said.opponent ?? null) !== game.opponentName ||
            (ending !== undefined) !== (game.ending !== undefined);
          if (changed) {
            saveGame({
              ...game,
              opponentName: said.opponent ?? game.opponentName,
              ending: ending ?? game.ending,
            });
          }
        })
      );
    }
    setStandings(found);
    setBeenAsked(true);
    /* Nothing answered, and there was something to ask: the line is down, and
       the list says so rather than showing yesterday as though it were now. */
    setReachedThem(seats.length === 0 || answers > 0);
    setGames(savedGames());
    setReading(false);
  }, []);

  /**
   * Gives up seats, which for a challenge nobody has answered means taking it
   * back.
   *
   * A seat at a game that can still be played is not a thing to drop quietly:
   * the token is the only way back to it, and a challenge whose token is gone
   * would go on standing, answerable by anyone holding the link, with nobody
   * able to play the game it made. So a challenge still waiting is withdrawn at
   * the object first, and only then forgotten here.
   *
   * One seat at a time, not one game: a browser can hold both ends of a game,
   * and the row that was ticked is one of them.
   */
  const forgetSelected = useCallback(
    async (seats: readonly string[]) => {
      for (const dropping of seats) {
        const saved = loadGame(dropping);
        if (saved === null) {
          continue;
        }
        const standing = standings.get(dropping);
        const waiting =
          standing === undefined
            ? saved.ending === undefined && saved.opponentName === null
            : standing.status === "planning";
        if (waiting) {
          await askGame(
            saved.gameId,
            { type: "cancel", token: saved.token },
            ["ended"],
            3000
          );
        }
        forgetGame(dropping);
        /* The one being shown goes with it: what the panel above is describing
           has just stopped being anything this browser holds. */
        if (dropping === seat.current) {
          seat.current = null;
          disconnect();
          forgetGameInUrl();
          setPhase({ kind: "idle" });
        }
      }
      setGames(savedGames());
      await readGames();
    },
    [disconnect, readGames, standings]
  );

  /**
   * A game begun or taken up without leaving the one being played.
   *
   * A browser can hold a seat at any number of games, and only one of them is
   * on the board — so offering a game, or accepting somebody's, is not a reason
   * to walk out of the game in front of you. The connection is: there is one,
   * and the game being played has it.
   *
   * So these three do their business on a line of their own, opened for one
   * exchange and dropped: the seat is written, the object is told, and the new
   * game appears in the list as a game to go to. Nothing is watching it — a
   * challenge answered while you are elsewhere is found the next time the list
   * is read, not announced. That is the price of not being interrupted, and it
   * is the right way round.
   */
  const challengeAside = useCallback(
    async (terms: ChallengeTerms): Promise<string | null> => {
      const gameId = newGameId();
      const mine = newToken();
      setName(terms.name);
      saveName(terms.name);
      /* Written before the message goes, as on the main line: a reply that
         never arrives must not take the only copy of the token with it. */
      saveGame({
        gameId,
        token: mine,
        you: terms.color,
        myName: terms.name,
        opponentName: null,
        role: "challenger",
      });
      const said = await askGame(
        gameId,
        {
          type: "create",
          v: PROTOCOL_VERSION,
          token: mine,
          name: terms.name,
          color: terms.color,
          handicap: terms.handicap,
          takebacks: terms.takebacks,
          ...(terms.continueFrom === null
            ? {}
            : {
                initialFEN: terms.continueFrom.initialFEN,
                line: terms.continueFrom.moves,
              }),
        },
        ["created"]
      );
      if (said === null) {
        /* Nobody answered, so there is no game — and a seat at no game is a row
           in the list that goes nowhere. */
        forgetGame(seatOf(gameId, "challenger"));
        setGames(savedGames());
        return null;
      }
      setGames(savedGames());
      await readGames();
      return seatOf(gameId, "challenger");
    },
    [readGames]
  );

  /** What a challenge is, for somebody deciding whether to take it up. */
  const lookAside = useCallback(
    async (
      gameId: string
    ): Promise<{
      gameId: string;
      challenger: string;
      you: ColorChoice;
      terms: Terms;
    } | null> => {
      const said = await askGame(
        gameId,
        { type: "peek", v: PROTOCOL_VERSION },
        ["challenge"]
      );
      if (said === null || said.type !== "challenge") {
        return null;
      }
      return {
        gameId,
        challenger: said.challenger,
        you: said.you,
        terms: said.terms,
      };
    },
    []
  );

  /** Answering one of those, still without leaving the game being played. */
  const answerAside = useCallback(
    async (
      looked: { gameId: string; challenger: string; you: ColorChoice },
      accept: boolean,
      myName: string,
      color?: Color
    ): Promise<string | null> => {
      const mine = newToken();
      const side = looked.you === OPPONENT_CHOOSES ? (color ?? "w") : looked.you;
      setName(myName);
      saveName(myName);
      saveGame({
        gameId: looked.gameId,
        token: mine,
        you: side,
        myName,
        opponentName: looked.challenger,
        role: "opponent",
      });
      const said = await askGame(
        looked.gameId,
        {
          type: "answer",
          v: PROTOCOL_VERSION,
          token: mine,
          name: myName,
          accept,
          ...(looked.you === OPPONENT_CHOOSES && color !== undefined
            ? { color }
            : {}),
        },
        ["joined", "declined"]
      );
      if (said === null || !accept) {
        forgetGame(seatOf(looked.gameId, "opponent"));
        setGames(savedGames());
        return null;
      }
      setGames(savedGames());
      await readGames();
      return seatOf(looked.gameId, "opponent");
    },
    [readGames]
  );

  const leave = useCallback(() => {
    /*
      An invite still waiting for its answer is taken back, not merely
      forgotten: the object would otherwise go on offering a game to whoever
      held the link, while this browser threw away the token needed to play it.
    */
    if (phase.kind === "waiting" && token.current !== null) {
      connection.current?.send({ type: "cancel", token: token.current });
    }
    /*
      What is kept is what could still be walked back into. An invite just
      withdrawn could not, and neither could a game already over — closing one
      is saying so. A game still being played is kept whatever this tab does
      with it, since the seat is not given up by looking away.

      Both seats go, not only this tab's. A browser holding the two ends of one
      board holds two tokens that can no longer play anything, and closing the
      game is a statement about the game rather than about the chair.
    */
    if (
      seat.current !== null &&
      (phase.kind === "waiting" ||
        (phase.kind === "playing" && phase.over !== null))
    ) {
      forgetSeats(gameOf(seat.current));
    }
    seat.current = null;
    disconnect();
    forgetGameInUrl();
    setPhase({ kind: "idle" });
  }, [disconnect, phase]);


  /**
   * Goes to a game by id, whichever way the id arrived — a link followed, or
   * nine digits read down a telephone and typed in.
   *
   * Holding a token for it is what decides: with one this is coming back to
   * your own seat, without one it is asking for the empty one. The same id
   * therefore does different things in different browsers, which is what makes
   * a single link enough for both the player who sent it and the friend who
   * received it.
   */
  /*
    A line that dropped while a game was on, gone back for: after a second, then
    two, then four, to a quarter of a minute — quickly enough that a blink is
    hardly noticed, slowly enough that an object which is down stays down
    rather than being knocked on thirty times a minute.
  */
  useEffect(() => {
    comeBack.current = () => {
      const mine = seat.current;
      if (mine === null || outdated || retry.current !== null) {
        return;
      }
      const wait = Math.min(1000 * 2 ** attempts.current, 15_000);
      retry.current = window.setTimeout(() => {
        retry.current = null;
        if (seat.current === null || outdated) {
          return;
        }
        attempts.current += 1;
        // If this one does not take either, its own close comes back here.
        rejoinQuietly(mine);
      }, wait);
    };
  });

  const goTo = useCallback(
    (asked: string) => {
      if (loadGame(asked) !== null) {
        rejoin(asked);
        return;
      }
      /*
        A challenger's address, opened by a browser that holds no such seat.
        The seat it names is the one seat nobody else can have — it belongs to
        whoever offered the game, and only their token opens it — so this is
        somebody who copied their own address bar instead of the invite. Read
        as the invite they meant to send, which is the only thing it can be.
      */
      if (isChallengerSeat(asked)) {
        // And the address is put right at once, so that a refresh does the
        // same thing as the first visit and nobody is shown a mark for a seat
        // they do not have.
        showGameInUrl(gameOf(asked));
        goTo(gameOf(asked));
        return;
      }
      openInvite(asked);
    },
    [openInvite, rejoin]
  );

  /*
    On the way in the address is the whole of it: a tab is at the game its own
    URL names, and at no game at all when it names none. Nothing is resumed
    behind the reader's back — a tab opened for something else stays free, and
    the games worth coming back to are offered instead of entered.

    Which of the two things a named game is, this does not decide: a token for
    it means coming back, no token means asking to be let in, and the object
    settles the rest.
  */
  useEffect(() => {
    const gameId = gameInUrl();
    if (gameId !== null) {
      cameFromOwnAddress.current = isChallengerSeat(gameId);
      goTo(gameId);
    }
    // Once, on the way in. Later changes are driven by what the player does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    Asking the opponent, for as long as there is one to ask.

    Only while a game is on: an invite nobody has answered has nobody at the
    other end, and a question sent into that is one the object must wake up to
    carry nowhere. It also keeps the second light honest — it is about a
    person, and until somebody answers the invite there is no person.
  */
  useEffect(() => {
    if (phase.kind !== "playing" || phase.over !== null) {
      asked.current = null;
      /*
        Nobody is being asked any more, so nothing is known about them. A game
        that has ended needs no opponent — there is no move to wait for — and a
        light left showing the last answer would go on making a claim that
        nothing is checking, which is worse than saying nothing.
      */
      setLink((was) => ({ ...was, theirs: null }));
      return;
    }
    answeredAt.current = Date.now();
    const tick = () => {
      if (token.current === null) {
        return;
      }
      /*
        Unanswered for too long, and their light goes out. This end's own light
        is left alone: it is measured by its own heartbeat, and "my line is
        down" and "they are not answering" are different things to be told.
      */
      if (Date.now() - answeredAt.current > PROBE_SILENT) {
        setLink((was) => ({ ...was, theirs: was.mine ? false : null }));
      }
      const text = newProbe();
      asked.current = { text, at: Date.now() };
      connection.current?.send({ type: "probe", token: token.current, text });
    };
    tick();
    const timer = window.setInterval(tick, PROBE_EVERY);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind, phase.kind === "playing" ? phase.over : null]);

  useEffect(() => setGames(savedGames()), [phase.kind]);

  /*
    And when another tab changes what this browser is in. Storage events fire
    in every tab but the one that wrote, which is exactly the set of tabs whose
    idea of the list has just gone stale — a game entered in one window should
    not still be offered as unentered in the next window along.
  */
  useEffect(() => {
    const reread = () => setGames(savedGames());
    window.addEventListener("storage", reread);
    return () => window.removeEventListener("storage", reread);
  }, []);

  useEffect(() => disconnect, [disconnect]);

  return {
    phase,
    link,
    /** Whether this page has been told it is older than the game it is in. */
    outdated,
    notice,
    dismissNotice: () => setNotice(null),
    name,
    remember,
    start,
    challenge,
    goTo,
    rejoin,
    /** Games this browser holds a seat at, whether or not one is being shown. */
    games,
    /** What the object last said about each of them, by seat. */
    standings,
    /** Whether the last reading of the list reached the object at all. */
    reachedThem,
    /** Whether the games have been asked how they stand since the page opened. */
    asked: beenAsked,
    /** Whether a reading is going on now. */
    reading,
    readGames,
    forgetSelected,
    /** The seat the panel above the list is showing, if any. */
    showingSeat: seat.current,
    challengeAside,
    lookAside,
    answerAside,
    answer,
    move,
    takeBack,
    resign,
    offerDraw,
    answerDraw,
    leave,
    loadGame,
  };
}
