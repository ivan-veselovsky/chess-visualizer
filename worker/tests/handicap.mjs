/** Odds, takebacks, and the position they imply. */
import { connect, answered, token, gameId, check, summary } from "./lib.mjs";

console.log("Odds and takebacks\n");

const offer = async (extra, color = "w") => {
  const game = gameId();
  const ws = await connect(game);
  ws.say({ type: "create", token: token(), name: "Bob", color, ...extra });
  return { said: await answered(ws), game, ws };
};

{
  const { said } = await offer({ handicap: { giver: "challenger", piece: "pawn" } });
  check("the challenger giving a pawn takes it off their own side",
    said?.terms.initialFEN.startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPP1PP"), JSON.stringify(said?.terms));
}
{
  const { said } = await offer({ handicap: { giver: "opponent", piece: "pawn" } });
  check("the opponent giving a pawn takes it off theirs",
    said?.terms.initialFEN.startsWith("rnbqkbnr/ppppp1pp"), JSON.stringify(said?.terms));
}
{
  const { said } = await offer({ handicap: { giver: "challenger", piece: "rook" } }, "w");
  const castling = said?.terms.initialFEN.split(" ")[2];
  check("giving a rook gives up that side's castling", castling === "Kkq", String(castling));
}
{
  const { said } = await offer({ handicap: { giver: "challenger", piece: "knight" } }, "b");
  check("the odds follow the challenger's color, not White",
    said?.terms.initialFEN.startsWith("r1bqkbnr"), JSON.stringify(said?.terms.initialFEN));
}
{
  const { said } = await offer({ takebacks: 3 });
  check("takebacks are carried", said?.terms.takebacks === 3, JSON.stringify(said?.terms));
  check("and no odds means an even game", said?.terms.handicap === null, JSON.stringify(said?.terms));
}
{
  const { said } = await offer({ takebacks: -2 });
  check("a negative allowance is clamped to none", said?.terms.takebacks === 0, JSON.stringify(said?.terms));
}
{
  const { said } = await offer({
    handicap: { giver: "challenger", piece: "pawn" },
    initialFEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  });
  check("odds and a position together are refused", said?.type === "error", JSON.stringify(said));
}

// Both players are told the same odds, and read them from their own side.
{
  const handicap = { giver: "challenger", piece: "knight" };
  const { said, game, ws } = await offer({ handicap, takebacks: 2 });
  const looker = await connect(game);
  looker.say({ type: "peek" });
  await answered(looker);
  const seen = looker.heard[0];
  check("the guest is shown the same odds value",
    JSON.stringify(seen?.terms.handicap) === JSON.stringify(handicap), JSON.stringify(seen?.terms));
  check("and the same position and allowance",
    seen?.terms.initialFEN === said.terms.initialFEN && seen?.terms.takebacks === 2, JSON.stringify(seen?.terms));
  ws.close(); looker.close();
}
process.exit(summary() ? 0 : 1);
