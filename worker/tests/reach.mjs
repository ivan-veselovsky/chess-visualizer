/** The worker is reachable and a game can be played through it. */
import { base, connect, settle, token, gameId, check, summary } from "./lib.mjs";
const http = base.replace(/^ws/, "http");
console.log(`Testing ${base}\n`);

const page = await fetch(http + "/");
check("the app is served", page.status === 200 && /text\/html/.test(page.headers.get("content-type") ?? ""),
  `${page.status} ${page.headers.get("content-type")}`);
const invite = await fetch(http + "/game?id=" + gameId());
check("an invite link loads the app, not a 404", invite.status === 200, String(invite.status));

const t0 = Date.now();
const game = gameId(), bobToken = token(), aliceToken = token();
const bob = await connect(game, "Bob");
check("the socket opens", true, "");
const opened = Date.now() - t0;

bob.say({ type: "create", token: bobToken, name: "Bob", color: "w" });
await settle();
check("a game can be created", bob.heard[0]?.type === "created", JSON.stringify(bob.heard[0]));

const alice = await connect(game, "Alice");
alice.say({ type: "peek" });
await settle();
check("the invite reads back", alice.heard[0]?.type === "challenge" && alice.heard[0].challenger === "Bob",
  JSON.stringify(alice.heard[0]));

const sent = Date.now();
alice.say({ type: "answer", token: aliceToken, name: "Alice", accept: true });
await settle();
const roundTrip = Date.now() - sent;
check("answering couples the two", alice.heard[1]?.type === "joined", JSON.stringify(alice.heard[1]));
check("and the host hears about it", bob.heard[1]?.type === "answered", JSON.stringify(bob.heard[1]));

bob.close(); alice.close();
await settle(300);
const back = await connect(game, "Bob returning");
back.say({ type: "resume", token: bobToken });
await settle();
check("the game survives both sides disconnecting",
  back.heard[0]?.type === "state" && back.heard[0].status === "inProgress",
  JSON.stringify(back.heard[0]));
back.close();

console.log(`\n  socket opened in ${opened}ms; one exchange took under ${roundTrip}ms (including a 500ms wait)`);
process.exit(summary() ? 0 : 1);
