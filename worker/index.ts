export { Game } from "./game";

/**
 * The app's static files, and the way into a game beside them.
 *
 * `/ws?game=<id>` reaches the Durable Object of that name — the same object for
 * everyone who asks for the same id, wherever they are. Everything else is the
 * built app, served by the assets binding.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected a WebSocket upgrade", { status: 426 });
      }

      const game = url.searchParams.get("game");
      if (game === null || game === "") {
        return new Response("Which game? Ask for /ws?game=<id>", {
          status: 400,
        });
      }

      /*
        By name rather than by a fresh id: the name is the invite link's game
        id, and deriving the object from it is what makes two clients holding
        the same link arrive at the same object.
      */
      const id = env.GAME.idFromName(game);
      return env.GAME.get(id).fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
