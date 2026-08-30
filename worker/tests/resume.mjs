/** What is needed to come back to a game. */
import { connect, answered, until, token, gameId, check, summary } from "./lib.mjs";
console.log("What is needed to come back to a game\n");

const game = gameId(), bobToken = token(), aliceToken = token();
const bob = await connect(game);
bob.say({ type: "create", token: bobToken, name: "Bob", color: "w" });
await answered(bob);
const alice = await connect(game);
alice.say({ type: "answer", token: aliceToken, name: "Alice", accept: true });
await until(alice, "joined");
bob.close(); alice.close();

// The right token at the right game.
const right = await connect(game);
right.say({ type: "resume", token: bobToken });
await answered(right);
check("game id + token: comes back to the game",
  right.heard[0]?.type === "state" && right.heard[0].opponent === "Alice", JSON.stringify(right.heard[0]));

// The right token at the wrong game — no index to find it by.
const elsewhere = await connect(gameId());
elsewhere.say({ type: "resume", token: bobToken });
await answered(elsewhere);
check("a valid token at another game finds nothing",
  elsewhere.heard[0]?.code === "noSuchGame", JSON.stringify(elsewhere.heard[0]));

// The right game with somebody else's token.
const wrongToken = await connect(game);
wrongToken.say({ type: "resume", token: token() });
await answered(wrongToken);
check("the right game with a token it does not know refuses",
  wrongToken.heard[0]?.type === "error", JSON.stringify(wrongToken.heard[0]));

// Both players can be connected at once, each seeing their own side.
const bobBack = await connect(game);
bobBack.say({ type: "resume", token: bobToken });
const aliceBack = await connect(game);
aliceBack.say({ type: "resume", token: aliceToken });
await until(bobBack, "state");
await until(aliceBack, "state");
check("each side resumes to its own colour and opponent",
  bobBack.heard[0]?.you === "w" && bobBack.heard[0].opponent === "Alice" &&
  aliceBack.heard[0]?.you === "b" && aliceBack.heard[0].opponent === "Bob",
  JSON.stringify([bobBack.heard[0], aliceBack.heard[0]]));

/*
  A game that is over is still a game. Nothing is deleted when it ends — the
  record keeps its players, its tokens and its moves — so a token still opens
  it, and what comes back is the game as it finished rather than a refusal.

  It matters for what the two refusals mean. "No such game" is a number nobody
  ever used; a game that was played and ended is neither that nor a game to be
  joined, and each of the three says its own thing.
*/
bobBack.say({ type: "move", token: bobToken, ply: 0, san: "e4" });
await until(bobBack, "moved");
bobBack.say({ type: "resign", token: bobToken });
await until(bobBack, "ended");

const afterwards = await connect(game, "back, after it ended");
afterwards.say({ type: "resume", token: bobToken });
await answered(afterwards);
check("a token still comes back to a game that has finished",
  afterwards.heard[0]?.type === "state" &&
  afterwards.heard[0].status === "finished" &&
  afterwards.heard[0].result === "0-1" &&
  JSON.stringify(afterwards.heard[0].moves) === JSON.stringify(["e4"]),
  JSON.stringify(afterwards.heard[0]));

const strangerAfter = await connect(game, "a stranger, after it ended");
strangerAfter.say({ type: "resume", token: token() });
await answered(strangerAfter);
check("while a token it does not know is refused as unknown, not as missing",
  strangerAfter.heard[0]?.code === "unknownToken",
  JSON.stringify(strangerAfter.heard[0]));

const nowhere = await connect(gameId(), "a number nobody used");
nowhere.say({ type: "resume", token: token() });
await answered(nowhere);
check("and a game that never existed is not found, rather than not yours",
  nowhere.heard[0]?.code === "noSuchGame",
  JSON.stringify(nowhere.heard[0]));

for (const ws of [right, elsewhere, wrongToken, bobBack, aliceBack, afterwards, strangerAfter, nowhere]) ws.close();
process.exit(summary() ? 0 : 1);
