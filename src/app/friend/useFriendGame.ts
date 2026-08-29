import { useCallback, useEffect, useRef, useState } from "react";
import type { Color } from "chess.js";
import type { Handicap } from "../../chess/handicap";
import type {
  ColorChoice,
  EndReason,
  ErrorCode,
  GameResult,
  Tally,
  Terms,
} from "../../../worker/protocol";
import { OPPONENT_CHOOSES } from "../../../worker/protocol";
import {
  forgetInviteInUrl,
  inviteLink,
  invitedTo,
  openGame,
  type Connection,
  type FromClient,
  type FromServer,
} from "./connection";
import {
  clearPending,
  loadGame,
  newGameId,
  newToken,
  pendingGame,
  saveGame,
  saveName,
  savedName,
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
      return "That game id is taken. Try creating the invite again.";
    case "noSuchGame":
      return "No game with that id. Check the digits, or ask for a new invite.";
    case "alreadyAnswered":
      return "Somebody has already answered this invite.";
    case "ownInvite":
      return "This is your own invite — send it to a friend instead.";
    case "unknownToken":
      return "This browser is not one of the players in that game.";
    case "badPosition":
      return "That position cannot be played from.";
    case "termsConflict":
      return "Choose odds or a position, not both.";
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
      return "That invite was taken back.";
    case "notYourInvite":
      return "That invite is not yours to take back.";
    case "badMessage":
      return "Something went wrong talking to the server.";
  }
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

/** What the challenger fills in. */
export interface ChallengeTerms {
  name: string;
  /** `OPPONENT_CHOOSES` leaves the side to whoever takes the game up. */
  color: ColorChoice;
  handicap: Handicap | null;
  takebacks: number;
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
    }
  /** Over before it began: turned down by one side or the other. */
  | { kind: "declined"; mine: boolean }
  | { kind: "error"; reason: string };

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
  const connection = useRef<Connection | null>(null);
  /*
    Held in a ref and refreshed every render. The socket's handler is set up
    once, and a handler that closed over the app's first render would be
    telling a version of the app that no longer exists.
  */
  const told = useRef(listeners);
  told.current = listeners;
  const token = useRef<string | null>(null);
  /** The challenge being made, kept in case its id turns out to be taken. */
  const offering = useRef<{ terms: ChallengeTerms; tries: number } | null>(
    null
  );

  const disconnect = useCallback(() => {
    connection.current?.close();
    connection.current = null;
  }, []);

  const connect = useCallback(
    (gameId: string, onMessage: (message: FromServer) => void) => {
      disconnect();
      connection.current = openGame(gameId, onMessage, () => undefined);
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
          setPhase({
            kind: "waiting",
            gameId,
            link: inviteLink(gameId),
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
          setPhase((current) =>
            current.kind === "playing"
              ? {
                  ...current,
                  drawOffered: null,
                  over: { result: message.result, reason: message.reason },
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
          told.current.onLine({
            initialFEN: message.terms.initialFEN ?? "",
            moves: message.moves,
          });
          saveGame({
            gameId,
            token: token.current ?? "",
            you: message.you,
            myName: name,
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
          });
          break;
        case "answered":
          setNotice(null);
          /*
            The board the game starts from, which the challenger may be seeing
            for the first time: the terms settle at the moment somebody answers,
            and until then this browser was showing whatever was on it.
          */
          if (message.accepted && message.terms.initialFEN !== null) {
            told.current.onLine({
              initialFEN: message.terms.initialFEN,
              moves: [],
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
                }
              : { kind: "declined", mine: false }
          );
          break;
        case "declined":
          setPhase({ kind: "declined", mine: true });
          break;
        case "state":
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
                  link: inviteLink(gameId),
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
                }
          );
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
        token: token.current,
        name: terms.name,
        color: terms.color,
        handicap: terms.handicap,
        takebacks: terms.takebacks,
      });
    },
    [connect, handle]
  );

  const challenge = useCallback(
    (terms: ChallengeTerms) => offer(terms),
    [offer]
  );

  /** Looks at an invite without taking it up. */
  const openInvite = useCallback(
    (gameId: string) => {
      connect(gameId, (message) => handle(gameId, message)).send({
        type: "peek",
      });
    },
    [connect, handle]
  );

  /** Answers one, either way. Both spend the invite. */
  const answer = useCallback(
    (accept: boolean, myName: string, color?: Color) => {
      if (phase.kind !== "invited") {
        return;
      }
      token.current = newToken();
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
      // The question has been answered; the address should stop asking it.
      forgetInviteInUrl();
      connection.current?.send({
        type: "answer",
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

  const leave = useCallback(() => {
    /*
      An invite still waiting for its answer is taken back, not merely
      forgotten: the object would otherwise go on offering a game to whoever
      held the link, while this browser threw away the token needed to play it.
    */
    if (phase.kind === "waiting" && token.current !== null) {
      connection.current?.send({ type: "cancel", token: token.current });
    }
    disconnect();
    clearPending();
    setPhase({ kind: "idle" });
  }, [disconnect, phase]);

  /*
    On the way in: an invite link takes precedence over whatever this browser
    was last doing, since following one is a deliberate act. Otherwise a game
    left open is resumed, which is what a reload in the middle of one looks
    like from here.
  */
  useEffect(() => {
    /*
      A link to a game this browser is already in is not an invite any more,
      whatever the address says: someone reopening it from a chat weeks later
      should find their game, not be told that somebody answered it.
    */
    const invited = invitedTo();
    const saved = invited === null ? pendingGame() : loadGame(invited);
    if (saved !== null) {
      forgetInviteInUrl();
      token.current = saved.token;
      connect(saved.gameId, (message) => handle(saved.gameId, message)).send({
        type: "resume",
        token: saved.token,
      });
      return;
    }
    if (invited !== null) {
      openInvite(invited);
    }
    // Once, on the way in. Later changes are driven by what the player does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => disconnect, [disconnect]);

  return {
    phase,
    notice,
    dismissNotice: () => setNotice(null),
    name,
    start,
    challenge,
    openInvite,
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
