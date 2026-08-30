/** A challenge that leaves the side to whoever answers it. */
import { connect, answered, token, gameId, check, summary } from "./lib.mjs";

console.log("One cuts, the other chooses\n");

const openGame = async (extra = {}) => {
  const game = gameId(), host = token();
  const bob = await connect(game, "Bob");
  bob.say({ type: "create", token: host, name: "Bob", color: "opponentChooses", ...extra });
  return { game, host, bob, said: await answered(bob) };
};

{
  const { said } = await openGame();
  check("a challenge can be made without naming a side",
    said?.type === "created" && said.you === "opponentChooses", JSON.stringify(said));
  /*
    An even game is the same board whichever side anybody ends up playing, so
    leaving the colors open leaves nothing about the position open. Only odds
    wait for the choice: they are given by a person, and which board that makes
    cannot be known until it is known which side that person is.
  */
  check("and an even game has its position from the start",
    typeof said?.terms.initialFEN === "string", JSON.stringify(said?.terms));
  const withOdds = await openGame({ handicap: { giver: "challenger", piece: "pawn" } });
  check("while a game at odds has none until the side is picked",
    withOdds.said?.terms.initialFEN === null, JSON.stringify(withOdds.said?.terms));
  withOdds.bob.close();
}
{
  const { game, bob } = await openGame({ handicap: { giver: "challenger", piece: "pawn" } });
  const looker = await connect(game);
  looker.say({ type: "peek" });
  const seen = await answered(looker);
  check("the one answering is told the side is theirs", seen?.you === "opponentChooses", JSON.stringify(seen));
  check("while the odds still read plainly from their side",
    JSON.stringify(seen?.terms.handicap) === JSON.stringify({ giver: "challenger", piece: "pawn" }));
  bob.close(); looker.close();
}
{
  const { game, host, bob } = await openGame({ handicap: { giver: "challenger", piece: "pawn" } });
  const alice = await connect(game);
  alice.say({ type: "answer", token: token(), name: "Alice", accept: true, color: "b" });
  await answered(alice);
  check("choosing Black gets Black", alice.heard[0]?.you === "b", JSON.stringify(alice.heard[0]));
  check("and the board is settled at that moment",
    typeof alice.heard[0]?.terms.initialFEN === "string", JSON.stringify(alice.heard[0]?.terms));
  check("with the odds still coming off the challenger's side — now White",
    alice.heard[0]?.terms.initialFEN.startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPP1PP"),
    alice.heard[0]?.terms.initialFEN);
  const back = await connect(game);
  back.say({ type: "resume", token: host });
  await answered(back);
  check("the challenger is left with the other side", back.heard[0]?.you === "w", JSON.stringify(back.heard[0]));
  bob.close(); alice.close(); back.close();
}
{
  const { game, bob } = await openGame();
  const alice = await connect(game);
  alice.say({ type: "answer", token: token(), name: "Alice", accept: true });
  await answered(alice);
  check("answering without choosing is refused",
    alice.heard[0]?.code === "colorNeeded", JSON.stringify(alice.heard[0]));
  bob.close(); alice.close();
}
{
  const game = gameId();
  const bob = await connect(game);
  bob.say({ type: "create", token: token(), name: "Bob", color: "w" });
  await answered(bob);
  const alice = await connect(game);
  alice.say({ type: "answer", token: token(), name: "Alice", accept: true, color: "w" });
  await answered(alice);
  check("choosing a side that was already settled is refused",
    alice.heard[0]?.code === "termsConflict", JSON.stringify(alice.heard[0]));
  bob.close(); alice.close();
}
process.exit(summary() ? 0 : 1);
