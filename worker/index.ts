import type { Health } from "./keeping";
import { REGISTRY } from "./registry";

export { Game } from "./game";
export { Registry } from "./registry";

/**
 * A health report, as HTTP: 503 where something has failed, so that a
 * monitor polling it needs to read nothing but the status; 200 for the rest,
 * warnings included, with the checks in the body.
 */
function healthSaid(health: Health): Response {
  return Response.json(health, { status: health.status === "fail" ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}

/**
 * Whether a request is the admin's: `Authorization: Bearer <ADMIN_TOKEN>`,
 * the token a secret of the deployment's (`wrangler secret put ADMIN_TOKEN`)
 * or, for `wrangler dev`, in `.dev.vars`. Compared in constant time, as a
 * comparison that stops at the first wrong character says how many were
 * right.
 *
 * Null where the deployment has no token at all: then there is no admin,
 * and its routes are not there.
 */
function adminAsks(request: Request, env: Env): boolean | null {
  const token = (env as { ADMIN_TOKEN?: string }).ADMIN_TOKEN;
  if (token === undefined || token === "") {
    return null;
  }
  const given = (request.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  const encoder = new TextEncoder();
  const [a, b] = [encoder.encode(given), encoder.encode(token)];
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

/**
 * The admin's questions, of the deployment's own registry and at the real
 * time — never a time of the asker's choosing, as a sweep at a time ahead
 * would take games before their keep is out.
 *
 *   GET /admin/api/health?deep=1   how the keeping of games is: see `healthOf`
 *                                  (deep=1 checks the tally against every row)
 *
 * Under /admin/api/ and nothing wider, so that /admin/ itself is left for a
 * page of the admin's, served as any other file.
 */
async function adminAsked(request: Request, env: Env, url: URL): Promise<Response> {
  const allowed = adminAsks(request, env);
  if (allowed === null) {
    return new Response("Not found", { status: 404 });
  }
  if (!allowed) {
    return new Response("Who is asking?", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  const registry = env.REGISTRY.get(env.REGISTRY.idFromName(REGISTRY));
  if (url.pathname === "/admin/api/health" && request.method === "GET") {
    return healthSaid(await registry.health(Date.now(), url.searchParams.get("deep") === "1"));
  }
  return new Response("Not a question the admin can ask", { status: 404 });
}

/**
 * Whether this deployment is one tests are run against: `KEEPING_TEST=on`,
 * which `.dev.vars` says for `wrangler dev` and no deployment says. Only then
 * does the registry answer the questions below, and only then may a line
 * name the registry its game is counted in.
 */
function testing(env: Env): boolean {
  return ((env as { KEEPING_TEST?: string }).KEEPING_TEST ?? "off").toLowerCase() === "on";
}

/**
 * A registry of a test's own, by name: so that the games one test makes are
 * not counted against another's, nor against the games of a person playing
 * on the same worker meanwhile. Letters, digits and dashes, a few dozen at
 * most. Null for the deployment's own — which is what every game outside a
 * test is counted in.
 */
function registryFor(asked: string | null): string | null {
  return asked !== null && /^[A-Za-z0-9-]{1,64}$/.test(asked) ? asked : null;
}

/**
 * The registry, asked by a test: how it stands, a policy of the test's own,
 * and a sweep now as though at a time the test names — the days a keep
 * lasts tried in a moment, rather than waited out.
 *
 *   GET  /keeping/<name>?rows=20&now=<ms>   what it holds and how it stands
 *   GET  /keeping/<name>/health?now=&deep=1 its health at that time: see `healthOf`
 *   POST /keeping/<name>/policy             { "KEEP_N1": 2, ... } — see `policyFrom`
 *   POST /keeping/<name>/sweep?now=<ms>     what a sweep then did
 *   POST /keeping/<name>/unschedule          the next sweep dropped, as a lost alarm
 *   POST /keeping/<name>/fail?sweeps=<n>     the next n sweeps made to throw
 */
async function keepingAsked(request: Request, env: Env, url: URL): Promise<Response> {
  const [, , asked, action] = url.pathname.split("/");
  const name = registryFor(asked ?? null);
  if (name === null) {
    return new Response("Which registry? Ask for /keeping/<name>", { status: 400 });
  }
  const registry = env.REGISTRY.get(env.REGISTRY.idFromName(name));
  const at = url.searchParams.get("now");
  const now = at === null ? Date.now() : Number(at);
  if (!Number.isFinite(now)) {
    return new Response("now= is a time in milliseconds", { status: 400 });
  }
  /* JSON says no infinity: a cut of minus infinity, which nothing is before, comes out as null. */
  const said = (value: unknown) => Response.json(JSON.parse(JSON.stringify(value)));
  if (action === undefined && request.method === "GET") {
    return said(await registry.stats(Number(url.searchParams.get("rows") ?? 0), now));
  }
  if (action === "policy" && request.method === "POST") {
    return said(await registry.setPolicy((await request.json()) as Record<string, unknown>));
  }
  if (action === "health" && request.method === "GET") {
    return healthSaid(await registry.health(now, url.searchParams.get("deep") === "1"));
  }
  if (action === "sweep" && request.method === "POST") {
    return said(await registry.sweepNow(now));
  }
  if (action === "unschedule" && request.method === "POST") {
    await registry.unschedule();
    return said(await registry.stats(0, now));
  }
  if (action === "fail" && request.method === "POST") {
    const sweeps = Number(url.searchParams.get("sweeps") ?? 1);
    if (!Number.isInteger(sweeps) || sweeps < 0) {
      return new Response("sweeps= is how many sweeps to fail", { status: 400 });
    }
    await registry.failSweeps(sweeps);
    return said(await registry.stats(0, now));
  }
  return new Response("Not a question the registry answers", { status: 404 });
}

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
      /*
        A test's own registry, passed on where this is a test deployment and
        nowhere else: a header from outside is dropped, so that no one can
        have a game counted somewhere it will never be swept from.
      */
      const forwarded = new Request(request);
      forwarded.headers.delete("X-Keeping-Registry");
      const registry = testing(env) ? registryFor(url.searchParams.get("registry")) : null;
      if (registry !== null) {
        forwarded.headers.set("X-Keeping-Registry", registry);
      }
      return env.GAME.get(id).fetch(forwarded);
    }

    if (url.pathname.startsWith("/admin/api/")) {
      return adminAsked(request, env, url);
    }

    if (url.pathname.startsWith("/keeping/") && testing(env)) {
      return keepingAsked(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
