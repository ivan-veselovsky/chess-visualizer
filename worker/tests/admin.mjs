/**
 * The admin's games: one read — its record without tokens, and its PGN — and
 * one deleted, with everything that should go with it.
 *
 * Needs the admin's token, which `.dev.vars` gives `wrangler dev`, and a
 * worker started for tests (`KEEPING_TEST=on`, also in `.dev.vars`), so that
 * the game is counted in a registry of this test's own and its row can be
 * seen to go. Without either it says so and stops.
 */
import { readFile } from "node:fs/promises";
import { connect, until, untilClosed, answered, token, gameId, check, summary, base } from "./lib.mjs";

console.log("The admin reads a game, and deletes one\n");

const http = base.replace(/^ws/, "http");

const vars = await readFile(new URL("../../.dev.vars", import.meta.url), "utf8").catch(() => "");
const admin = vars.match(/^ADMIN_TOKEN=(.*)$/m)?.[1]?.trim();
const probe = await fetch(`${http}/keeping/t-probe`).catch(() => null);
if (admin === undefined || !(probe?.headers.get("content-type") ?? "").includes("json")) {
  console.log("  SKIP  needs ADMIN_TOKEN in .dev.vars and a worker started for tests (KEEPING_TEST=on)\n");
  process.exit(0);
}

/** The admin asking about a game, by its number or its object's id. */
const asking = (id, method = "GET", auth = `Bearer ${admin}`) =>
  fetch(`${http}/admin/api/games/${encodeURIComponent(id)}`, { method, headers: auth === null ? {} : { Authorization: auth } });

/* A game in a registry of this test's own, two moves in. */
const registry = `t-${crypto.randomUUID()}`;
const stats = async () => (await fetch(`${http}/keeping/${registry}?rows=5`)).json();
const game = gameId();
const host = token();
const guestToken = token();
const hostWs = await connect(game, "host", registry);
hostWs.say({ type: "create", token: host, name: "Bob", color: "w" });
await answered(hostWs);
const guestWs = await connect(game, "guest", registry);
guestWs.say({ type: "answer", token: guestToken, name: "Alice", accept: true });
await until(guestWs, "joined");
hostWs.say({ type: "move", token: host, ply: 0, san: "e4" });
await until(guestWs, "moved");
guestWs.heard = [];
guestWs.say({ type: "move", token: guestToken, ply: 1, san: "e5" });
await until(guestWs, "moved");

/* --- Read. --- */
{
  const nobody = await asking(game, "GET", null);
  check("a game is not shown to anyone without the admin's token", nobody.status === 401, String(nobody.status));

  const response = await asking(game);
  const text = await response.text();
  const seen = JSON.parse(text);
  check("the admin is shown the game by its number", response.status === 200 && seen.name === game, text.slice(0, 300));
  check("with its PGN", seen.pgn?.includes("1. e4 e5") && seen.pgn.includes('[White "Bob"]') && seen.pgn.includes('[Black "Alice"]'),
    seen.pgn);
  check("and its record, but neither player's token anywhere in it",
    seen.record?.moves?.join(" ") === "e4 e5" && !text.includes(host) && !text.includes(guestToken) && !text.includes('"token"'));
  check("and the registry it is counted in", seen.registry === registry, seen.registry);

  const row = (await stats()).games.find((each) => each.id === seen.id);
  check("the registry lists it under the object's id", row !== undefined, JSON.stringify((await stats()).games));
  const byId = await asking(seen.id);
  check("and by that id the admin is shown the same game", byId.status === 200 && (await byId.json()).pgn === seen.pgn);

  check("a game there is not is a 404", (await asking(gameId())).status === 404);
  const wrongId = await asking("f".repeat(64));
  check("an id no game could have is refused, not a crash", wrongId.status === 400 || wrongId.status === 404, String(wrongId.status));
  check("and a game is only read or deleted", (await asking(game, "PUT")).status === 405);
}

/* --- Delete. --- */
{
  const response = await asking(game, "DELETE");
  const done = await response.json().catch(() => null);
  check("the admin deletes the game, and its registry row with it",
    response.status === 200 && done?.existed === true && done?.rowRemoved === true, JSON.stringify(done));
  check("its players are let go", (await untilClosed(hostWs)) !== null && (await untilClosed(guestWs)) !== null);
  const after = await stats();
  check("the registry no longer counts it", after.n === 0 && after.counted === 0, JSON.stringify({ n: after.n, counted: after.counted }));
  const back = await connect(game, "back again");
  back.say({ type: "resume", token: host });
  check("and a player coming back is told there is no such game", (await answered(back))?.code === "noSuchGame");
  back.close();
  check("reading it now is a 404", (await asking(game)).status === 404);
  check("and so is deleting it again: there is nothing to delete", (await asking(game, "DELETE")).status === 404);
}

process.exit(summary() ? 0 : 1);
