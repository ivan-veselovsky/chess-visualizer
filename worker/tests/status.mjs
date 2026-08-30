/** Status, result and reason. */
import { connect, answered, until, token, gameId, check, summary } from "./lib.mjs";

console.log("Status, result and reason\n");

const play = async (accept) => {
  const game = gameId(), host = token(), guest = token();
  const bob = await connect(game);
  bob.say({ type: "create", token: host, name: "Bob", color: "w" });
  await answered(bob);
  const alice = await connect(game);
  alice.say({ type: "answer", token: guest, name: "Alice", accept });
  await answered(alice);
  const back = await connect(game);
  back.say({ type: "resume", token: host });
  const state = await until(back, "state");
  for (const ws of [bob, alice, back]) ws.close();
  return state;
};

const accepted = await play(true);
check("accepting puts the game in progress",
  accepted.status === "inProgress", JSON.stringify(accepted));
check("an unfinished game has no result yet — PGN's '*'",
  accepted.result === "*" && accepted.reason === null, JSON.stringify(accepted));

const declined = await play(false);
check("declining finishes the game",
  declined.status === "finished", JSON.stringify(declined));
check("a challenge declined has a reason, not a result",
  declined.result === "*" && declined.reason === "challengeDeclined", JSON.stringify(declined));
check("and the two are told apart by the reason alone",
  accepted.status !== declined.status && declined.reason === "challengeDeclined");

// Only `planning` can be answered — from either terminal state.
for (const [what, accept] of [["accepted", true], ["declined", false]]) {
  const game = gameId(), host = token();
  const bob = await connect(game);
  bob.say({ type: "create", token: host, name: "Bob", color: "w" });
  await answered(bob);
  const first = await connect(game);
  first.say({ type: "answer", token: token(), name: "Alice", accept });
  await answered(first);
  const second = await connect(game);
  second.say({ type: "answer", token: token(), name: "Mallory", accept: true });
  await answered(second);
  check(`a game already ${what} cannot be answered again`,
    second.heard[0]?.type === "error", JSON.stringify(second.heard[0]));
  bob.close(); first.close(); second.close();
}
process.exit(summary() ? 0 : 1);
