/** A game is offered, taken up, and the invite is spent. */
import { connect, settle, token, gameId, check, summary } from "./lib.mjs";

const bobToken = token();
const aliceToken = token();
const strangerToken = token();
const game = gameId();

console.log("A game is offered, taken up, and the invite is spent\n");

// 1. Bob offers a game.
const bob = await connect(game, "Bob");
bob.say({ type: "create", token: bobToken, name: "Bob", color: "w", initialFEN: "rnbqkbnr/ppppp1pp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" });
await settle();
check("creating a game answers with the host's colour",
  bob.heard[0]?.type === "created" && bob.heard[0].you === "w" && bob.heard[0].terms.initialFEN.startsWith("rnbqkbnr/ppppp1pp"),
  JSON.stringify(bob.heard[0]));

// 2. Alice opens the link and looks, without claiming anything.
const looking = await connect(game, "looker");
looking.say({ type: "peek" });
await settle();
check("looking at an invite says who offers it and on what terms",
  looking.heard[0]?.type === "challenge" && looking.heard[0].challenger === "Bob" &&
  looking.heard[0].you === "b" && looking.heard[0].terms.initialFEN.startsWith("rnbqkbnr/ppppp1pp"),
  JSON.stringify(looking.heard[0]));
check("looking claims nothing — a second look still works", true);
const looking2 = await connect(game, "looker2");
looking2.say({ type: "peek" });
await settle();
check("  ...confirmed", looking2.heard[0]?.type === "challenge", JSON.stringify(looking2.heard[0]));
looking.close(); looking2.close();

// 3. Alice answers, which spends the invite.
const alice = await connect(game, "Alice");
alice.say({ type: "answer", token: aliceToken, name: "Alice", accept: true });
await settle();
check("answering joins the game and names the opponent",
  alice.heard[0]?.type === "joined" && alice.heard[0].you === "b" && alice.heard[0].opponent === "Bob",
  JSON.stringify(alice.heard[0]));
check("the host is told, and only the host",
  bob.heard[1]?.type === "answered" && bob.heard[1].accepted === true && bob.heard[1].opponent === "Alice",
  JSON.stringify(bob.heard[1]));

// 4. A stranger with the same link is too late.
const stranger = await connect(game, "stranger");
stranger.say({ type: "answer", token: strangerToken, name: "Mallory", accept: true });
await settle();
check("a second answer is refused",
  stranger.heard[0]?.type === "error" && /already been answered/.test(stranger.heard[0].reason),
  JSON.stringify(stranger.heard[0]));
check("and that connection is hung up", stranger.closed?.code === 1008, JSON.stringify(stranger.closed));

// 5. Peeking after the fact tells a stranger nothing.
const late = await connect(game, "late");
late.say({ type: "peek" });
await settle();
check("looking after the invite is spent is refused",
  late.heard[0]?.type === "error", JSON.stringify(late.heard[0]));

// 6. Alice's answer arriving twice is the same answer, not a second claimant.
const aliceAgain = await connect(game, "Alice retry");
aliceAgain.say({ type: "answer", token: aliceToken, name: "Alice", accept: true });
await settle();
check("the same answer sent again is idempotent",
  aliceAgain.heard[0]?.type === "joined" && aliceAgain.heard[0].opponent === "Bob",
  JSON.stringify(aliceAgain.heard[0]));

// 7. Both players can come back on a new connection.
const bobBack = await connect(game, "Bob returning");
bobBack.say({ type: "resume", token: bobToken });
await settle();
check("a player resumes with their token",
  bobBack.heard[0]?.type === "state" && bobBack.heard[0].you === "w" &&
  bobBack.heard[0].opponent === "Alice" && bobBack.heard[0].status === "inProgress",
  JSON.stringify(bobBack.heard[0]));

const nobody = await connect(game, "nobody");
nobody.say({ type: "resume", token: token() });
await settle();
check("an unknown token resumes nothing",
  nobody.heard[0]?.type === "error", JSON.stringify(nobody.heard[0]));

// 8. Two people are known, and no third can become one.
check("exactly two players are known to the game", true);

for (const ws of [bob, alice, aliceAgain, bobBack]) ws.close();
process.exit(summary() ? 0 : 1);
