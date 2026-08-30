/** A game number taken by somebody else, and the way out of it. */
import { connect, answered, token, gameId, check, summary } from "./lib.mjs";

console.log("Two clients, one game number\n");

const taken = gameId();

// Bob gets there first.
const bob = await connect(taken, "Bob");
bob.say({ type: "create", token: token(), name: "Bob", color: "w" });
await answered(bob);
check("the first to arrive gets the number", bob.heard[0]?.type === "created");

// Carol picks the same number, not knowing.
const carol = await connect(taken, "Carol");
carol.say({ type: "create", token: token(), name: "Carol", color: "w" });
await answered(carol);
const refused = carol.heard[0];
check("the second is refused", refused?.type === "error", JSON.stringify(refused));
check("with a code a client can act on, not prose to show a player",
  refused?.code === "gameExists", JSON.stringify(refused));

// Which is all her client needs to try again somewhere else — silently.
const second = gameId();
const carolAgain = await connect(second, "Carol again");
carolAgain.say({ type: "create", token: token(), name: "Carol", color: "w" });
await answered(carolAgain);
check("retrying with another number simply works",
  carolAgain.heard[0]?.type === "created", JSON.stringify(carolAgain.heard[0]));
check("and the two games are separate", taken !== second);

for (const ws of [bob, carol, carolAgain]) ws.close();
process.exit(summary() ? 0 : 1);
