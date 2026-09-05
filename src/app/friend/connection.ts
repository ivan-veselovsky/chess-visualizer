import { PING, PONG } from "../../../worker/protocol";
import type { FromClient, FromServer } from "../../../worker/protocol";
import { gameOf } from "./storage";

export type { FromClient, FromServer };

/**
 * How often to ask whether the line is still up, and how long silence has to
 * last before saying it is not.
 *
 * A socket can be dead for a long time without saying so — a laptop closed, a
 * network handed over, a NAT table swept — and until something is sent nobody
 * finds out. So something is sent.
 *
 * Every three seconds, and silence called after six — the same rhythm the
 * probe to the other player runs at, so the two lights on the row are read
 * against the same clock rather than each against its own.
 */
const ASK_EVERY = 3_000;
const SILENT_FOR = 6_000;



/**
 * A connection to one game.
 *
 * The address is this page's own, with the scheme swapped: a page served over
 * https must open wss, and a page served over http can only open ws. Getting
 * that wrong is the whole of what "mixed content" refusals are.
 *
 * The game id travels in the URL because it is public — it is the thing people
 * read to each other. The token never does: it goes in the body of a message,
 * where it stays out of logs and out of anything that keeps a history.
 */
export interface Connection {
  send(message: FromClient): void;
  close(): void;
}

export function openGame(
  gameId: string,
  onMessage: (message: FromServer) => void,
  onClosed: () => void,
  /** Whether this end's line to the object is up, as often as that changes. */
  onLink: (up: boolean) => void = () => undefined,
): Connection {
  /*
    Unsigned, always. The object is found by this name, so a stray minus would
    name a second object — and the two players, each at their own, would sit
    waiting for a move from somebody who was never there.
  */
  const url = new URL(
    `/ws?game=${encodeURIComponent(gameOf(gameId))}`,
    window.location.href,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  const socket = new WebSocket(url.toString());
  const queued: FromClient[] = [];

  /*
    Anything arriving is proof the line is up, an answered ping being only the
    proof that can be asked for on demand.
  */
  let heardAt = Date.now();
  let asking: ReturnType<typeof setInterval> | null = null;

  socket.addEventListener("open", () => {
    heardAt = Date.now();
    onLink(true);
    asking = setInterval(() => {
      if (Date.now() - heardAt > SILENT_FOR) {
        onLink(false);
        /*
          Open, and dead. The socket says it is fine because nothing told it
          otherwise, and it never will — so it is hung up here, which turns a
          silence nobody can act on into a close somebody can: the caller's
          close handler is what goes and gets the game back.
        */
        socket.close();
        return;
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(PING);
      }
    }, ASK_EVERY);
    for (const message of queued.splice(0)) {
      socket.send(JSON.stringify(message));
    }
  });
  socket.addEventListener("message", (event) => {
    heardAt = Date.now();
    onLink(true);
    // The heartbeat is the runtime's answer, not the object's; nothing above
    // this line has anything to do with it.
    if (String(event.data) === PONG) {
      return;
    }
    try {
      onMessage(JSON.parse(String(event.data)) as FromServer);
    } catch {
      // A message that will not parse says nothing worth acting on.
    }
  });
  /*
    A hidden tab has its timers throttled — to once a second at first, and to
    once a minute once it has been hidden a while — so a beat can fall a long
    way behind while somebody is reading their mail. Coming back is the moment
    to catch up, rather than showing a light that has been wrong since before
    they looked away.
  */
  const onVisible = () => {
    if (
      document.visibilityState === "visible" &&
      socket.readyState === WebSocket.OPEN
    ) {
      socket.send(PING);
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  socket.addEventListener("close", () => {
    document.removeEventListener("visibilitychange", onVisible);
    if (asking !== null) {
      clearInterval(asking);
      asking = null;
    }
    onLink(false);
    onClosed();
  });

  return {
    // Held until the socket opens, so a caller need not wait to say anything.
    send(message) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      } else {
        queued.push(message);
      }
    },
    close() {
      if (asking !== null) {
        clearInterval(asking);
        asking = null;
      }
      document.removeEventListener("visibilitychange", onVisible);
      socket.close();
    },
  };
}

/**
 * The parameter that says which game this tab is at.
 *
 * Not `game`, which this app already spends on a shared PGN — a link to a game
 * to look at. This one is a seat at a game being played, which is a different
 * thing to ask for and so a different word.
 */
const PLAY_PARAM = "play";

/**
 * The link that brings someone to this game — and the address of the game
 * itself, which is the same string. There is no separate invite: what a link
 * does when it is opened depends on the game's own state and on whether the
 * browser opening it already holds a token, neither of which the address can
 * know or should claim.
 */
export function gameLink(gameId: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  // Always the game, never the seat: this is the link that goes to somebody
  // else, and the seat it would name is the one they cannot have.
  url.searchParams.set(PLAY_PARAM, gameOf(gameId));
  return url.toString();
}

/**
 * The game this page was opened at, if any.
 *
 * `invite` is read too, and means exactly the same: links written before the
 * two were one word are in people's chat histories, and the id inside them is
 * this id. What happens next no longer depends on which word was used.
 */
export function gameInUrl(): string | null {
  const asked = new URLSearchParams(window.location.search);
  return asked.get(PLAY_PARAM) ?? asked.get("invite");
}

/**
 * Asks one game how it stands, and hangs up.
 *
 * What the list of games is built on. A row has to say whether a game is still
 * being played and how it ended if it is not, and only the object knows —
 * neither browser is told anything while it is looking elsewhere. So each game
 * is asked in turn: a line opened, one message sent, the first answer of the
 * kind wanted taken, and the line dropped. The game being played keeps its own
 * connection throughout; this borrows nothing from it.
 *
 * Null for a question that got no answer at all: a line that will not open, or
 * a silence longer than the wait. A refusal is an answer and comes back as
 * itself — "there is no such game" and "nobody could be reached" are different
 * things to say about a game, and only the first of them is final.
 */
export function askGame(
  gameId: string,
  ask: FromClient,
  want: readonly FromServer["type"][],
  waitFor = 6000
): Promise<FromServer | null> {
  return new Promise((resolve) => {
    let answered = false;
    let connection: Connection | null = null;
    const finish = (answer: FromServer | null) => {
      if (answered) {
        return;
      }
      answered = true;
      window.clearTimeout(timer);
      connection?.close();
      resolve(answer);
    };
    const timer = window.setTimeout(() => finish(null), waitFor);
    connection = openGame(
      gameId,
      (message) => {
        if (want.includes(message.type) || message.type === "error") {
          finish(message);
        }
      },
      () => finish(null)
    );
    connection.send(ask);
  });
}

/**
 * Puts the game in the address bar, so that this tab and this game are one
 * thing: a reload comes back to it, the browser restores it with the window,
 * and a second tab is free to be a second game.
 *
 * Replaced rather than pushed — Back should leave the page, not walk backwards
 * out of a game that is still being played.
 */
export function showGameInUrl(seat: string): void {
  const url = new URL(window.location.href);
  url.search = "";
  // The seat, sign and all: this address is the tab's own, and which side of
  // the game it is sitting at is the whole of what makes it different from the
  // tab next to it.
  url.searchParams.set(PLAY_PARAM, seat);
  if (url.toString() !== window.location.href) {
    window.history.replaceState(null, "", url.toString());
  }
}

/** Takes it out again, when this tab is no longer at that game. */
export function forgetGameInUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PLAY_PARAM) && !url.searchParams.has("invite")) {
    return;
  }
  url.searchParams.delete(PLAY_PARAM);
  url.searchParams.delete("invite");
  window.history.replaceState(null, "", url.toString());
}
