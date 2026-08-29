/** Taking an invite back. */
import { connect, settle, token, gameId, check, summary } from "./lib.mjs";

console.log("Withdrawing a challenge\n");

const offered = async () => {
  const game = gameId(), host = token();
  const bob = await connect(game, "Bob");
  bob.say({ type: "create", token: host, name: "Bob", color: "w" });
  await settle();
  bob.heard.length = 0;
  return { game, host, bob };
};

{
  const { game, host, bob } = await offered();
  bob.say({ type: "cancel", token: host });
  await settle();
  check("the challenger can take their invite back",
    bob.heard[0]?.type === "ended" && bob.heard[0].reason === "challengeCancelled",
    JSON.stringify(bob.heard[0]));
  check("and it has no result, having never been played",
    bob.heard[0]?.result === "*", JSON.stringify(bob.heard[0]));

  const looker = await connect(game, "someone with the link");
  looker.say({ type: "peek" });
  await settle();
  check("the link then says the invite was withdrawn, not answered",
    looker.heard[0]?.code === "challengeCancelled", JSON.stringify(looker.heard[0]));

  const taker = await connect(game, "someone answering anyway");
  taker.say({ type: "answer", token: token(), name: "Alice", accept: true });
  await settle();
  await settle(400);
  check("and nobody can take it up",
    taker.heard[0]?.code === "challengeCancelled", JSON.stringify(taker.heard[0]));
  bob.close(); looker.close(); taker.close();
}

{
  const { game, bob } = await offered();
  const stranger = await connect(game, "stranger");
  stranger.say({ type: "cancel", token: token() });
  await settle();
  check("only the challenger may take it back",
    stranger.heard[0]?.code === "notYourInvite", JSON.stringify(stranger.heard[0]));
  bob.close(); stranger.close();
}

{
  const { game, host, bob } = await offered();
  const alice = await connect(game, "Alice");
  alice.say({ type: "answer", token: token(), name: "Alice", accept: true });
  await settle();
  bob.heard.length = 0;
  bob.say({ type: "cancel", token: host });
  await settle();
  check("an invite that has been answered cannot be withdrawn",
    bob.heard[0]?.code === "alreadyAnswered", JSON.stringify(bob.heard[0]));
  check("and the game is untouched — the line stays open",
    bob.closed === null, JSON.stringify(bob.closed));
  bob.close(); alice.close();
}
process.exit(summary() ? 0 : 1);
