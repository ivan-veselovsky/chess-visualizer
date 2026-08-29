/** A challenge that leaves the side to whoever answers it. */
import { connect, settle, token, gameId, check, summary } from "./lib.mjs";

console.log("One cuts, the other chooses\n");

const openGame = async (extra = {}) => {
  const game = gameId(), host = token();
  const bob = await connect(game, "Bob");
  bob.say({ type: "create", token: host, name: "Bob", color: "opponentChooses", ...extra });
  await settle();
  return { game, host, bob, said: bob.heard[0] };
};

{
  const { said } = await openGame();
  check("a challenge can be made without naming a side",
    said?.type === "created" && said.you === "opponentChooses", JSON.stringify(said));
  check("and has no position yet — odds are given by a person, not a color",
    said?.terms.initialFEN === null, JSON.stringify(said?.terms));
}
{
  const { game, bob } = await openGame({ handicap: { giver: "challenger", piece: "pawn" } });
  const looker = await connect(game);
  looker.say({ type: "peek" });
  await settle();
  const seen = looker.heard[0];
  check("the one answering is told the side is theirs", seen?.you === "opponentChooses", JSON.stringify(seen));
  check("while the odds still read plainly from their side",
    JSON.stringify(seen?.terms.handicap) === JSON.stringify({ giver: "challenger", piece: "pawn" }));
  bob.close(); looker.close();
}
{
  const { game, host, bob } = await openGame({ handicap: { giver: "challenger", piece: "pawn" } });
  const alice = await connect(game);
  alice.say({ type: "answer", token: token(), name: "Alice", accept: true, color: "b" });
  await settle();
  check("choosing Black gets Black", alice.heard[0]?.you === "b", JSON.stringify(alice.heard[0]));
  check("and the board is settled at that moment",
    typeof alice.heard[0]?.terms.initialFEN === "string", JSON.stringify(alice.heard[0]?.terms));
  check("with the odds still coming off the challenger's side — now White",
    alice.heard[0]?.terms.initialFEN.startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPP1PP"),
    alice.heard[0]?.terms.initialFEN);
  const back = await connect(game);
  back.say({ type: "resume", token: host });
  await settle();
  check("the challenger is left with the other side", back.heard[0]?.you === "w", JSON.stringify(back.heard[0]));
  bob.close(); alice.close(); back.close();
}
{
  const { game, bob } = await openGame();
  const alice = await connect(game);
  alice.say({ type: "answer", token: token(), name: "Alice", accept: true });
  await settle();
  check("answering without choosing is refused",
    alice.heard[0]?.code === "colorNeeded", JSON.stringify(alice.heard[0]));
  bob.close(); alice.close();
}
{
  const game = gameId();
  const bob = await connect(game);
  bob.say({ type: "create", token: token(), name: "Bob", color: "w" });
  await settle();
  const alice = await connect(game);
  alice.say({ type: "answer", token: token(), name: "Alice", accept: true, color: "w" });
  await settle();
  check("choosing a side that was already settled is refused",
    alice.heard[0]?.code === "termsConflict", JSON.stringify(alice.heard[0]));
  bob.close(); alice.close();
}
process.exit(summary() ? 0 : 1);
