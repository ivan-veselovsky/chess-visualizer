/** What is needed to come back to a game. */
import { connect, settle, token, gameId, check, summary } from "./lib.mjs";
console.log("What is needed to come back to a game\n");

const game = gameId(), bobToken = token(), aliceToken = token();
const bob = await connect(game);
bob.say({ type: "create", token: bobToken, name: "Bob", color: "w" });
await settle();
const alice = await connect(game);
alice.say({ type: "answer", token: aliceToken, name: "Alice", accept: true });
await settle();
bob.close(); alice.close();

// The right token at the right game.
const right = await connect(game);
right.say({ type: "resume", token: bobToken });
await settle();
check("game id + token: comes back to the game",
  right.heard[0]?.type === "state" && right.heard[0].opponent === "Alice", JSON.stringify(right.heard[0]));

// The right token at the wrong game — no index to find it by.
const elsewhere = await connect(gameId());
elsewhere.say({ type: "resume", token: bobToken });
await settle();
check("a valid token at another game finds nothing",
  elsewhere.heard[0]?.type === "error", JSON.stringify(elsewhere.heard[0]));

// The right game with somebody else's token.
const wrongToken = await connect(game);
wrongToken.say({ type: "resume", token: token() });
await settle();
check("the right game with a token it does not know refuses",
  wrongToken.heard[0]?.type === "error", JSON.stringify(wrongToken.heard[0]));

// Both players can be connected at once, each seeing their own side.
const bobBack = await connect(game);
bobBack.say({ type: "resume", token: bobToken });
const aliceBack = await connect(game);
aliceBack.say({ type: "resume", token: aliceToken });
await settle();
check("each side resumes to its own colour and opponent",
  bobBack.heard[0]?.you === "w" && bobBack.heard[0].opponent === "Alice" &&
  aliceBack.heard[0]?.you === "b" && aliceBack.heard[0].opponent === "Bob",
  JSON.stringify([bobBack.heard[0], aliceBack.heard[0]]));

for (const ws of [right, elsewhere, wrongToken, bobBack, aliceBack]) ws.close();
process.exit(summary() ? 0 : 1);
