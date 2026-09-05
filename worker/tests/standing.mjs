/** How a game stands, asked without joining it. */
import { connect, settle, answered, until, token, gameId, check, summary } from "./lib.mjs";

console.log("Reading a game without joining it\n");

/*
  What a list of games is built on. A browser holding a seat at thirty games
  asks each of them how it stands whenever the list is opened — so the asking
  must cost the games nothing: no player bound to the connection, and no
  opponent told that anybody arrived.
*/
const game = gameId(), host = token(), guest = token();
const bob = await connect(game);
bob.say({ type: "create", token: host, name: "Bob", color: "w" });
await answered(bob);
const alice = await connect(game);
alice.say({ type: "answer", token: guest, name: "Alice", accept: true });
await until(alice, "joined");
await until(bob, "answered");
/* Both are in, and both have been told the other is here. */
await settle();
const beforePresence = alice.heard.filter((m) => m.type === "presence").length;

const looker = await connect(game);
looker.say({ type: "standing", token: host });
const state = await until(looker, "state");
check("a seat's own token is answered with the whole state",
  state.status === "inProgress" && state.opponent === "Alice",
  JSON.stringify({ status: state.status, opponent: state.opponent }));
check("including when it began",
  typeof state.startedAt === "number", JSON.stringify(state.startedAt));

await settle();
check("and nobody at the game was told anyone arrived",
  alice.heard.filter((m) => m.type === "presence").length === beforePresence,
  JSON.stringify(alice.heard.filter((m) => m.type === "presence")));

/* Which is the whole difference from resuming, so that is worth showing. */
const joiner = await connect(game);
joiner.say({ type: "resume", token: host });
await until(joiner, "state");
await settle();
check("where resuming does tell them",
  alice.heard.filter((m) => m.type === "presence").length > beforePresence);

const stranger = await connect(game);
stranger.say({ type: "standing", token: token() });
const refused = await answered(stranger);
check("a token belonging to nobody is refused",
  refused?.type === "error" && refused.code === "unknownToken",
  JSON.stringify(refused));

for (const ws of [bob, alice, looker, joiner, stranger]) ws.close();
process.exit(summary() ? 0 : 1);
