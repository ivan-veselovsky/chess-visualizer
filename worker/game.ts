import { DurableObject } from "cloudflare:workers";
import {
  other,
  type FromClient,
  type FromServer,
  type GameRecord,
  type Player,
} from "./protocol";
import {
  canMoveTo,
  OPPONENT_CHOOSES,
  termsOf,
  type ErrorCode,
} from "./protocol";
import { positionWithHandicap, type Handicap } from "../src/chess/handicap";
import type { Color } from "./protocol";

/**
 * Where a game begins: worked out from the odds, or taken as given for a game
 * that starts somewhere other than the usual array.
 */
function startingPosition(
  handicap: Handicap | null,
  challengerColor: Color,
  given: string | undefined
): string {
  return handicap === null
    ? (given ?? DEFAULT_POSITION)
    : positionWithHandicap(handicap, challengerColor);
}
import { Chess } from "chess.js";
import { DEFAULT_POSITION, whyNotPlayable } from "./position";
import type { EndReason, GameResult } from "./protocol";

/**
 * How a game ended, if the move just played ended it.
 *
 * Only the endings that happen on their own. A draw by repetition or by the
 * fifty-move rule is a claim a player makes in real chess, and claiming is not
 * something this can do on their behalf.
 */
function endOf(board: Chess): { result: GameResult; reason: EndReason } | null {
  if (board.isCheckmate()) {
    return {
      result: board.turn() === "w" ? "0-1" : "1-0",
      reason: "checkmate",
    };
  }
  if (board.isStalemate()) {
    return { result: "1/2-1/2", reason: "stalemate" };
  }
  if (board.isInsufficientMaterial()) {
    return { result: "1/2-1/2", reason: "insufficientMaterial" };
  }
  return null;
}

/** What a socket has proved about itself, kept where hibernation cannot lose it. */
interface Bound {
  token: string;
}

/**
 * One game: two players, and the invite that couples them.
 *
 * A Durable Object is one instance per name, and the name is the game id out of
 * the invite link — so everyone holding that link arrives here, and nowhere
 * else. Being single-threaded is what makes the claim safe: two people opening
 * the invite at the same moment are still two messages one after another, and
 * the second one finds the game already answered.
 *
 * The invite is spent by *answering* it, not by opening it. A link fetched by a
 * chat client building a preview, or opened by someone curious, claims nothing:
 * `peek` says what the game is and carries no token. Only `answer` binds.
 *
 * Nothing is broadcast. A message goes to a named player's own connections, and
 * a third party never becomes a named player, so there is nothing for it to
 * receive.
 */
export class Game extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    // Hibernating: the object may leave memory between messages while the
    // socket stays open, and comes back when one arrives.
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    ws: WebSocket,
    raw: string | ArrayBuffer
  ): Promise<void> {
    let message: FromClient;
    try {
      message = JSON.parse(typeof raw === "string" ? raw : "");
    } catch {
      return this.refuse(ws, "badMessage", "That was not a message I can read");
    }

    switch (message.type) {
      case "create":
        return this.create(ws, message);
      case "peek":
        return this.peek(ws);
      case "answer":
        return this.answer(ws, message);
      case "resume":
        return this.resume(ws, message);
      case "move":
        return this.play(ws, message);
      case "takeBack":
        return this.takeBack(ws, message);
      case "resign":
        return this.resign(ws, message);
      case "cancel":
        return this.cancel(ws, message);
      case "offerDraw":
        return this.offerDraw(ws, message);
      case "answerDraw":
        return this.answerDraw(ws, message);
      default:
        return this.refuse(
          ws,
          "badMessage",
          "I do not know that kind of message"
        );
    }
  }

  /** Starts a game, on the terms whoever asked for it named. */
  private async create(
    ws: WebSocket,
    message: Extract<FromClient, { type: "create" }>
  ): Promise<void> {
    const already = await this.read();
    if (already !== null) {
      // The same host asking twice is a retry, not a second game.
      if (already.host.token !== message.token) {
        return this.refuse(ws, "gameExists", "That game already exists");
      }
      this.bind(ws, message.token);
      return this.tell(ws, {
        type: "created",
        you: already.host.color,
        terms: termsOf(already),
      });
    }

    /*
      The odds are what was chosen; the position is worked out from them. A
      caller may name a position instead, for a game starting somewhere other
      than the usual array — but not both, since then two things would be
      saying where the game begins.
    */
    const handicap = message.handicap ?? null;
    if (handicap !== null && message.initialFEN !== undefined) {
      return this.refuse(
        ws,
        "termsConflict",
        "Give odds or a position, not both"
      );
    }
    const takebacks = Math.max(0, Math.trunc(message.takebacks ?? 0));
    /*
      The board can only be worked out once it is known who plays which side.
      A challenge that leaves the choice to whoever answers therefore has no
      position yet, and gets one at the moment the choice is made.
    */
    const initialFEN =
      message.color === OPPONENT_CHOOSES
        ? null
        : startingPosition(handicap, message.color, message.initialFEN);
    if (initialFEN !== null) {
      const unplayable = whyNotPlayable(initialFEN);
      if (unplayable !== null) {
        return this.refuse(ws, "badPosition", unplayable);
      }
    }

    const record: GameRecord = {
      host: {
        token: message.token,
        name: message.name,
        color: message.color,
      },
      guest: null,
      status: "planning",
      result: "*",
      reason: null,
      handicap,
      takebacks,
      initialFEN,
      moves: [],
      takebacksLeft: { w: takebacks, b: takebacks },
      drawOfferedBy: null,
      createdAt: Date.now(),
    };
    await this.write(record);
    this.bind(ws, message.token);
    return this.tell(ws, {
      type: "created",
      you: record.host.color,
      terms: termsOf(record),
    });
  }

  /** What this invite is, for someone deciding whether to take it up. */
  private async peek(ws: WebSocket): Promise<void> {
    const record = await this.read();
    if (record === null) {
      return this.refuse(ws, "noSuchGame", "There is no such game");
    }
    if (record.status !== "planning") {
      // Withdrawn and answered are different things to be told.
      return record.reason === "challengeCancelled"
        ? this.refuse(ws, "challengeCancelled", "That invite was taken back")
        : this.refuse(
            ws,
            "alreadyAnswered",
            "This invite has already been answered"
          );
    }
    return this.tell(ws, {
      type: "challenge",
      challenger: record.host.name,
      // Null says the side is theirs to pick.
      you:
        record.host.color === OPPONENT_CHOOSES
          ? OPPONENT_CHOOSES
          : other(record.host.color),
      terms: termsOf(record),
    });
  }

  /**
   * Takes the invite up, or turns it down. Either way it is spent.
   *
   * The guest's own token comes with the answer rather than being handed out
   * here, which is what makes a lost reply harmless: the same answer sent again
   * carries the same token, and is recognised as the same person finishing what
   * they started rather than as a second claimant.
   */
  private async answer(
    ws: WebSocket,
    message: Extract<FromClient, { type: "answer" }>
  ): Promise<void> {
    const record = await this.read();
    if (record === null) {
      return this.refuse(ws, "noSuchGame", "There is no such game");
    }

    if (record.status !== "planning") {
      if (record.reason === "challengeCancelled") {
        return this.refuse(
          ws,
          "challengeCancelled",
          "That invite was taken back"
        );
      }
      if (record.guest?.token === message.token) {
        // The same guest again: say what was settled, and settle nothing new.
        this.bind(ws, message.token);
        return this.tell(
          ws,
          record.status === "inProgress"
            ? {
                type: "joined",
                you: record.guest.color as Color,
                opponent: record.host.name,
                terms: termsOf(record),
                moves: record.moves,
                takebacksLeft: record.takebacksLeft,
              }
            : { type: "declined" }
        );
      }
      return this.refuse(
        ws,
        "alreadyAnswered",
        "This invite has already been answered"
      );
    }

    if (record.host.token === message.token) {
      return this.refuse(ws, "ownInvite", "You cannot answer your own invite");
    }

    /*
      The side, settled here when the challenge left it open. One cuts and the
      other chooses: the challenger fixed every term but this one, and fixing
      this one is what answering does.
    */
    if (record.host.color === OPPONENT_CHOOSES && message.color === undefined) {
      return this.refuse(
        ws,
        "colorNeeded",
        "This challenge needs you to choose a side"
      );
    }
    if (record.host.color !== OPPONENT_CHOOSES && message.color !== undefined) {
      return this.refuse(
        ws,
        "termsConflict",
        "The sides were settled by the challenge"
      );
    }
    const guestColor =
      record.host.color === OPPONENT_CHOOSES
        ? (message.color as Color)
        : other(record.host.color);
    const hostColor = other(guestColor);
    const guest: Player = {
      token: message.token,
      name: message.name,
      color: guestColor,
    };
    const initialFEN =
      record.initialFEN ??
      startingPosition(record.handicap, hostColor, undefined);
    const unplayable = whyNotPlayable(initialFEN);
    if (unplayable !== null) {
      return this.refuse(ws, "badPosition", unplayable);
    }
    /*
      The one write that spends the invite: the only way out of `planning`, and
      nothing returns to it. A second answer therefore finds a status it cannot
      be answered from, whoever sends it and however close together they arrive.
    */
    const status = message.accept ? "inProgress" : "finished";
    if (!canMoveTo(record.status, status)) {
      return this.refuse(
        ws,
        "alreadyAnswered",
        "That game cannot be answered now"
      );
    }
    await this.write({
      ...record,
      host: { ...record.host, color: hostColor },
      guest,
      initialFEN,
      status,
      // A challenge turned down was never played, so it has no result — only
      // a reason. PGN spells that "*".
      result: "*",
      reason: message.accept ? null : "challengeDeclined",
    });

    /*
      The terms as they finally stand. The challenger is told them too: a
      challenge that left the side open had no position until this moment, and
      a board cannot be set up from terms nobody has been given.
    */
    const settled = {
      handicap: record.handicap,
      takebacks: record.takebacks,
      initialFEN,
    };

    this.bind(ws, message.token);
    if (!message.accept) {
      this.tell(ws, { type: "declined" });
      return this.sendTo(record.host.token, {
        type: "answered",
        accepted: false,
        opponent: guest.name,
        you: hostColor,
        terms: settled,
      });
    }

    this.tell(ws, {
      type: "joined",
      you: guestColor,
      opponent: record.host.name,
      terms: settled,
      moves: [],
      takebacksLeft: record.takebacksLeft,
    });
    return this.sendTo(record.host.token, {
      type: "answered",
      accepted: true,
      opponent: guest.name,
      you: hostColor,
      terms: settled,
    });
  }

  /** A player coming back on a new connection, which is the usual case. */
  private async resume(
    ws: WebSocket,
    message: Extract<FromClient, { type: "resume" }>
  ): Promise<void> {
    const record = await this.read();
    const player = this.playerFor(record, message.token);
    if (record === null || player === null) {
      return this.refuse(
        ws,
        "unknownToken",
        "That token belongs to no one here"
      );
    }
    this.bind(ws, message.token);
    const opponent = player === record.host ? record.guest : record.host;
    return this.tell(ws, {
      type: "state",
      you: player.color,
      opponent: opponent?.name ?? null,
      status: record.status,
      result: record.result,
      reason: record.reason,
      terms: termsOf(record),
      moves: record.moves,
      takebacksLeft: record.takebacksLeft,
      drawOfferedBy: record.drawOfferedBy,
    });
  }

  /**
   * One move, checked and kept.
   *
   * The object holds the position and is the only thing that decides. A client
   * may be mistaken about whose turn it is, about what is legal, or about which
   * ply it is on — a lost connection makes all three ordinary — and each of
   * those is answered rather than believed.
   */
  private async play(
    ws: WebSocket,
    message: Extract<FromClient, { type: "move" }>
  ): Promise<void> {
    const record = await this.read();
    const player = this.playerFor(record, message.token);
    if (record === null || player === null) {
      return this.refuse(
        ws,
        "unknownToken",
        "That token belongs to no one here"
      );
    }
    if (record.status !== "inProgress" || record.initialFEN === null) {
      return this.deny(ws, "notPlaying", "That game is not being played");
    }

    /*
      Sent again after a wobble: the ply is already behind us. If it is the move
      we already have, say so again rather than play it twice; if it is not,
      this client is somewhere else entirely and needs the game as it stands.
    */
    if (message.ply < record.moves.length) {
      if (record.moves[message.ply] === message.san) {
        return this.tell(ws, this.movedMessage(record, message.ply));
      }
      return this.deny(
        ws,
        "staleMove",
        "That move was for an earlier position"
      );
    }
    if (message.ply > record.moves.length) {
      return this.deny(ws, "staleMove", "That move is ahead of the game");
    }

    const board = new Chess(record.initialFEN);
    for (const played of record.moves) {
      board.move(played);
    }
    if (board.turn() !== player.color) {
      return this.deny(ws, "notYourTurn", "It is not your move");
    }

    let san: string;
    try {
      san = board.move(message.san).san;
    } catch {
      return this.deny(ws, "illegalMove", "That move cannot be played here");
    }

    // A game can end on the move that was just made, and the same message says
    // so — nobody has to ask afterwards.
    const ending = endOf(board);
    const moves = [...record.moves, san];
    const played: GameRecord = {
      ...record,
      moves,
      // A move answers a draw offer as surely as declining it does.
      drawOfferedBy: null,
      status: ending === null ? record.status : "finished",
      result: ending?.result ?? record.result,
      reason: ending?.reason ?? record.reason,
    };
    await this.write(played);

    this.both(played, this.movedMessage(played, moves.length - 1));
  }

  /** What a given ply came to, said the same way to both players. */
  private movedMessage(record: GameRecord, ply: number): FromServer {
    const board = new Chess(record.initialFEN ?? undefined);
    for (const played of record.moves.slice(0, ply + 1)) {
      board.move(played);
    }
    return {
      type: "moved",
      ply,
      san: record.moves[ply],
      fen: board.fen(),
      status: record.status,
      result: record.result,
      reason: record.reason,
      takebacksLeft: record.takebacksLeft,
    };
  }

  /**
   * Unmakes the move just played, if it was yours and nobody has answered it.
   *
   * Not a chess rule — a courtesy, and one worth having when the opponent is
   * eight years old. Each side is given a number of them at the start, and
   * each takeback spends one of that player's own.
   */
  private async takeBack(
    ws: WebSocket,
    message: Extract<FromClient, { type: "takeBack" }>
  ): Promise<void> {
    const record = await this.read();
    const player = this.playerFor(record, message.token);
    if (record === null || player === null) {
      return this.refuse(
        ws,
        "unknownToken",
        "That token belongs to no one here"
      );
    }
    if (record.status !== "inProgress" || record.initialFEN === null) {
      return this.deny(ws, "notPlaying", "That game is not being played");
    }
    if (record.moves.length === 0) {
      return this.deny(ws, "nothingToTakeBack", "Nothing has been played yet");
    }

    /*
      The last move must be yours. Whose it was follows from the count: the side
      to move now is the side that did not just move.
    */
    const board = new Chess(record.initialFEN);
    for (const san of record.moves) {
      board.move(san);
    }
    if (board.turn() === player.color) {
      return this.deny(
        ws,
        "nothingToTakeBack",
        "The last move was not yours to take back"
      );
    }
    const colour = player.color as Color;
    if (record.takebacksLeft[colour] <= 0) {
      return this.deny(ws, "noTakebacksLeft", "No takebacks left");
    }

    const moves = record.moves.slice(0, -1);
    const takebacksLeft = {
      ...record.takebacksLeft,
      [colour]: record.takebacksLeft[colour] - 1,
    };
    await this.write({ ...record, moves, takebacksLeft, drawOfferedBy: null });

    const back = new Chess(record.initialFEN);
    for (const san of moves) {
      back.move(san);
    }
    this.both(record, {
      type: "tookBack",
      ply: moves.length,
      fen: back.fen(),
      takebacksLeft,
    });
  }

  /**
   * Takes an unanswered invite back.
   *
   * Without this, a challenger who changed their mind could only forget the
   * invite, not withdraw it: the object would go on offering a game to whoever
   * held the link, while their own client had thrown away the token needed to
   * play it.
   */
  private async cancel(
    ws: WebSocket,
    message: Extract<FromClient, { type: "cancel" }>
  ): Promise<void> {
    const record = await this.read();
    if (record === null) {
      return this.refuse(ws, "noSuchGame", "There is no such game");
    }
    if (record.host.token !== message.token) {
      return this.refuse(
        ws,
        "notYourInvite",
        "Only the challenger can take an invite back"
      );
    }
    if (record.status !== "planning") {
      return this.deny(ws, "alreadyAnswered", "That invite has been answered");
    }
    await this.write({
      ...record,
      status: "finished",
      result: "*",
      reason: "challengeCancelled"
    });
    this.tell(ws, {
      type: "ended",
      result: "*",
      reason: "challengeCancelled"
    });
  }

  /** Gives the game up. The only ending a player can bring about alone. */
  private async resign(
    ws: WebSocket,
    message: Extract<FromClient, { type: "resign" }>
  ): Promise<void> {
    const record = await this.read();
    const player = this.playerFor(record, message.token);
    if (record === null || player === null) {
      return this.refuse(
        ws,
        "unknownToken",
        "That token belongs to no one here"
      );
    }
    if (record.status !== "inProgress") {
      return this.deny(ws, "notPlaying", "That game is not being played");
    }
    const result: GameResult = player.color === "w" ? "0-1" : "1-0";
    await this.write({
      ...record,
      status: "finished",
      result,
      reason: "resignation",
      drawOfferedBy: null,
    });
    this.both(record, { type: "ended", result, reason: "resignation" });
  }

  /** Offers a draw, which stands until it is answered or a move is taken back. */
  private async offerDraw(
    ws: WebSocket,
    message: Extract<FromClient, { type: "offerDraw" }>
  ): Promise<void> {
    const record = await this.read();
    const player = this.playerFor(record, message.token);
    if (record === null || player === null) {
      return this.refuse(
        ws,
        "unknownToken",
        "That token belongs to no one here"
      );
    }
    if (record.status !== "inProgress") {
      return this.deny(ws, "notPlaying", "That game is not being played");
    }
    const by = player.color as Color;
    await this.write({ ...record, drawOfferedBy: by });
    this.both(record, { type: "drawOffered", by });
  }

  /** Takes a draw, or turns it down. Only the other player may answer one. */
  private async answerDraw(
    ws: WebSocket,
    message: Extract<FromClient, { type: "answerDraw" }>
  ): Promise<void> {
    const record = await this.read();
    const player = this.playerFor(record, message.token);
    if (record === null || player === null) {
      return this.refuse(
        ws,
        "unknownToken",
        "That token belongs to no one here"
      );
    }
    if (
      record.status !== "inProgress" ||
      record.drawOfferedBy === null ||
      record.drawOfferedBy === player.color
    ) {
      return this.deny(ws, "noDrawOffered", "No draw is on offer to you");
    }
    if (!message.accept) {
      await this.write({ ...record, drawOfferedBy: null });
      this.both(record, { type: "drawDeclined" });
      return;
    }
    await this.write({
      ...record,
      status: "finished",
      result: "1/2-1/2",
      reason: "agreement",
      drawOfferedBy: null,
    });
    this.both(record, {
      type: "ended",
      result: "1/2-1/2",
      reason: "agreement",
    });
  }

  /** Says the same thing to both players, which is all this object ever does. */
  private both(record: GameRecord, message: FromServer): void {
    this.sendTo(record.host.token, message);
    if (record.guest !== null) {
      this.sendTo(record.guest.token, message);
    }
  }

  private playerFor(record: GameRecord | null, token: string): Player | null {
    if (record === null) {
      return null;
    }
    if (record.host.token === token) {
      return record.host;
    }
    return record.guest?.token === token ? record.guest : null;
  }

  /**
   * Remembers which player this socket is.
   *
   * On the socket rather than in a field: the object can be dropped from memory
   * between two messages, and only what was serialised onto the socket comes
   * back with it.
   */
  private bind(ws: WebSocket, token: string): void {
    const bound: Bound = { token };
    ws.serializeAttachment(bound);
  }

  /** Every connection that has proved itself to be this player. */
  private socketsFor(token: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((socket) => {
      const bound = socket.deserializeAttachment() as Bound | null;
      return bound?.token === token;
    });
  }

  private tell(ws: WebSocket, message: FromServer): void {
    ws.send(JSON.stringify(message));
  }

  private sendTo(token: string, message: FromServer): void {
    const text = JSON.stringify(message);
    for (const socket of this.socketsFor(token)) {
      socket.send(text);
    }
  }

  /**
   * Says no, and hangs up: nothing more will be accepted from this socket.
   *
   * For someone who has no business here — a stranger answering an invite that
   * is spent, a token belonging to nobody. There is nothing they could say next
   * that would be worth reading.
   */
  private refuse(ws: WebSocket, code: ErrorCode, reason: string): void {
    this.tell(ws, { type: "error", code, reason });
    ws.close(1008, reason);
  }

  /**
   * Says no, and goes on listening.
   *
   * For a player who is welcome but wrong: a move out of turn, a move that will
   * not play, a move for a ply the game has passed. All three are ordinary — a
   * connection that dropped and came back has a client believing an older
   * account of the game — and none is a reason to stop talking to them.
   */
  private deny(ws: WebSocket, code: ErrorCode, reason: string): void {
    this.tell(ws, { type: "error", code, reason });
  }

  private async read(): Promise<GameRecord | null> {
    return (await this.ctx.storage.get<GameRecord>("game")) ?? null;
  }

  private async write(record: GameRecord): Promise<void> {
    await this.ctx.storage.put("game", record);
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string
  ): Promise<void> {
    /*
      Closing from this end too, with the code that came in — where that code
      can be sent at all. 1004, 1005 and 1006 are statuses the runtime reports
      to say how a connection ended; no close frame is allowed to carry them,
      and handing one back throws. Anything outside the allowed range becomes a
      plain "closed normally".
    */
    const sendable =
      code >= 1000 &&
      code <= 4999 &&
      code !== 1004 &&
      code !== 1005 &&
      code !== 1006;
    ws.close(sendable ? code : 1000, reason);
  }
}
