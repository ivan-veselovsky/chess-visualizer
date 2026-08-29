import type { FromClient, FromServer } from "../../../worker/protocol";

export type { FromClient, FromServer };

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
): Connection {
  const url = new URL(
    `/ws?game=${encodeURIComponent(gameId)}`,
    window.location.href,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  const socket = new WebSocket(url.toString());
  const queued: FromClient[] = [];

  socket.addEventListener("open", () => {
    for (const message of queued.splice(0)) {
      socket.send(JSON.stringify(message));
    }
  });
  socket.addEventListener("message", (event) => {
    try {
      onMessage(JSON.parse(String(event.data)) as FromServer);
    } catch {
      // A message that will not parse says nothing worth acting on.
    }
  });
  socket.addEventListener("close", onClosed);

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
      socket.close();
    },
  };
}

/** The link that brings someone to this game. */
export function inviteLink(gameId: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("invite", gameId);
  return url.toString();
}

/** The game id an invite link carries, if this page was opened by one. */
export function invitedTo(): string | null {
  return new URLSearchParams(window.location.search).get("invite");
}

/**
 * Takes the invite out of the address bar, once it has been answered.
 *
 * An invite is a thing that happens once, and a link that goes on saying so is
 * a link that reopens a spent question on every reload — the same address then
 * means "look at this invite" long after the only honest answer is "you are
 * playing it". Replaced rather than pushed, so Back does not lead into it.
 */
export function forgetInviteInUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("invite")) {
    return;
  }
  url.searchParams.delete("invite");
  window.history.replaceState(null, "", url.toString());
}
