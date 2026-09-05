/** When a game began and when it finished. */
import { connect, answered, until, token, gameId, check, summary } from "./lib.mjs";

console.log("When a game began and when it ended\n");

/*
  The times belong to the object, not to either browser. Two players keep two
  clocks and play one game, and a game walked back into from somewhere else has
  to have times to show at all — so they are stamped where the game is kept, and
  handed out with it.
*/

const opened = Date.now();
const game = gameId(), host = token(), guest = token();
const bob = await connect(game);
bob.say({ type: "create", token: host, name: "Bob", color: "w" });
await answered(bob);

const alice = await connect(game);
alice.say({ type: "answer", token: guest, name: "Alice", accept: true });
const joined = await until(alice, "joined");
const toldTheHost = await until(bob, "answered");

check("the game that has just begun says when it began",
  typeof joined.startedAt === "number" && joined.startedAt >= opened,
  JSON.stringify({ startedAt: joined.startedAt, opened }));
check("and says it has not ended",
  joined.endedAt === null, JSON.stringify(joined.endedAt));
check("both players are told the same beginning",
  toldTheHost.startedAt === joined.startedAt,
  `${toldTheHost.startedAt} and ${joined.startedAt}`);

/* A game is resigned, which is one of the half-dozen ways one can end. */
bob.say({ type: "resign", token: host });
const ended = await until(alice, "ended");
check("an ending says when it happened",
  typeof ended.at === "number" && ended.at >= joined.startedAt,
  JSON.stringify({ at: ended.at, startedAt: joined.startedAt }));

/* And both times are still there for whoever comes back to it later. */
const back = await connect(game);
back.say({ type: "resume", token: host });
const state = await until(back, "state");
check("a game come back to remembers when it began",
  state.startedAt === joined.startedAt,
  `${state.startedAt} and ${joined.startedAt}`);
check("and when it ended",
  state.endedAt === ended.at, `${state.endedAt} and ${ended.at}`);

for (const ws of [bob, alice, back]) ws.close();

/* A challenge nobody took up never began, and says so. */
const spare = gameId(), lone = token();
const carol = await connect(spare);
carol.say({ type: "create", token: lone, name: "Carol", color: "w" });
await answered(carol);
const dave = await connect(spare);
dave.say({ type: "answer", token: token(), name: "Dave", accept: false });
await answered(dave);
const after = await connect(spare);
after.say({ type: "resume", token: lone });
const declined = await until(after, "state");
check("a challenge turned down has an ending but no beginning",
  declined.startedAt === null && typeof declined.endedAt === "number",
  JSON.stringify({ startedAt: declined.startedAt, endedAt: declined.endedAt }));
for (const ws of [carol, dave, after]) ws.close();

process.exit(summary() ? 0 : 1);
