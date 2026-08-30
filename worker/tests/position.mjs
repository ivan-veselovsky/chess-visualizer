/** The position a game starts from. */
import { connect, answered, token, gameId, check, summary } from "./lib.mjs";

console.log("The position a game starts from\n");

const start = async (initialFEN, color = "w") => {
  const game = gameId();
  const ws = await connect(game);
  ws.say({ type: "create", token: token(), name: "Bob", color, ...(initialFEN ? { initialFEN } : {}) });
  return await answered(ws);
};

const standard = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const blackFirst = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1";
const pawnOdds = "rnbqkbnr/ppppp1pp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

check("omitting the position starts from the usual array",
  (await start(undefined))?.terms.initialFEN === standard, JSON.stringify(await start(undefined)));
check("Black to move is allowed — odds of the move",
  (await start(blackFirst))?.terms.initialFEN === blackFirst);
check("a position with odds is kept as given",
  (await start(pawnOdds))?.terms.initialFEN === pawnOdds);

const bad = [
  ["nonsense", "not a fen"],
  ["a game already checkmate", "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 1"],
  ["a game already stalemate", "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"],
  ["a position no legal game reaches", "rnbqkbnr/ppppQppp/8/8/8/8/PPPP1PPP/RNB1KBNR w KQkq - 0 1"],
];
for (const [what, fen] of bad) {
  const said = await start(fen);
  check(`refused: ${what}`, said?.type === "error", JSON.stringify(said));
}

// The terms reach the guest, whichever way round the colours fall.
{
  const game = gameId(), host = token();
  const bob = await connect(game);
  bob.say({ type: "create", token: host, name: "Bob", color: "b", initialFEN: blackFirst });
  await answered(bob);
  const looker = await connect(game);
  looker.say({ type: "peek" });
  const c = await answered(looker);
  check("the guest is shown the challenger, their own color and the position",
    c?.challenger === "Bob" && c.you === "w" && c.terms.initialFEN === blackFirst, JSON.stringify(c));
  check("the challenger takes Black and so moves first here", c?.you === "w");
  bob.close(); looker.close();
}
process.exit(summary() ? 0 : 1);
