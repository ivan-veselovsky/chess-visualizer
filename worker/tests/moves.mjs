/** Moves: who may make them, in what order, and how a game ends. */
import { connect, answered, replied, until, token, gameId, check, summary } from "./lib.mjs";

console.log("Playing the game\n");

/** A game already under way, with both players connected. */
async function started(color = "w") {
  const game = gameId(), hostToken = token(), guestToken = token();
  const host = await connect(game, "host");
  host.say({ type: "create", token: hostToken, name: "Bob", color });
  await answered(host);
  const guest = await connect(game, "guest");
  guest.say({ type: "answer", token: guestToken, name: "Alice", accept: true });
  /*
    Waiting for the *last* thing the coupling says, not the first. Joining
    sends `joined` and `answered` and then a `presence` to each of them, so
    clearing as soon as the first arrives leaves the last to land in the
    freshly emptied list and be read as the answer to whatever comes next.
    Nothing local ever showed it; a real network shows it at once.
  */
  await until(guest, "presence");
  await until(host, "presence");
  host.heard.length = 0;
  guest.heard.length = 0;
  return { game, host, guest, hostToken, guestToken };
}

{
  const { host, guest, hostToken, guestToken } = await started("w");
  host.say({ type: "move", token: hostToken, ply: 0, san: "e4" });
  await until(host, "moved");
  await until(guest, "moved");
  check("a move reaches the player who made it",
    host.heard[0]?.type === "moved" && host.heard[0].san === "e4", JSON.stringify(host.heard[0]));
  check("and the opponent, with the position it made",
    guest.heard[0]?.type === "moved" && guest.heard[0].fen.startsWith("rnbqkbnr/pppppppp/8/8/4P3"),
    JSON.stringify(guest.heard[0]));

  host.say({ type: "move", token: hostToken, ply: 1, san: "e5" });
  await replied(host);
  check("the same player cannot move twice",
    host.heard.at(-1)?.code === "notYourTurn", JSON.stringify(host.heard.at(-1)));

  guest.say({ type: "move", token: guestToken, ply: 1, san: "e5" });
  await replied(guest);
  check("the other player can", guest.heard.at(-1)?.san === "e5", JSON.stringify(guest.heard.at(-1)));

  guest.say({ type: "move", token: guestToken, ply: 1, san: "e5" });
  await replied(guest);
  check("a move sent twice is answered, not played twice",
    guest.heard.at(-1)?.type === "moved" && guest.heard.at(-1).ply === 1,
    JSON.stringify(guest.heard.at(-1)));

  host.say({ type: "move", token: hostToken, ply: 2, san: "Qh9" });
  await replied(host);
  check("an impossible move is refused",
    host.heard.at(-1)?.code === "illegalMove", JSON.stringify(host.heard.at(-1)));

  host.say({ type: "move", token: hostToken, ply: 7, san: "Nf3" });
  await replied(host);
  check("a move for the wrong ply is refused",
    host.heard.at(-1)?.code === "staleMove", JSON.stringify(host.heard.at(-1)));

  host.close(); guest.close();
}

// Coming back to a game finds every move that was made while away.
{
  const { game, host, guest, hostToken, guestToken } = await started("w");
  host.say({ type: "move", token: hostToken, ply: 0, san: "e4" });
  await until(guest, "moved");
  guest.say({ type: "move", token: guestToken, ply: 1, san: "c5" });
  await replied(guest);
  host.close(); guest.close();
  const back = await connect(game, "returning");
  back.say({ type: "resume", token: guestToken });
  await answered(back);
  check("resuming brings the whole line back",
    JSON.stringify(back.heard[0]?.moves) === JSON.stringify(["e4", "c5"]),
    JSON.stringify(back.heard[0]?.moves));
  back.close();
}

// Fool's mate, which ends the game on the move that gives it.
{
  const { host, guest, hostToken, guestToken } = await started("w");
  const line = [["f3", hostToken], ["e5", guestToken], ["g4", hostToken], ["Qh4#", guestToken]];
  for (const [san, who] of line) {
    const from = who === hostToken ? host : guest;
    from.say({ type: "move", token: who, ply: line.findIndex(([s]) => s === san), san });
    // Both are told of every move; waiting for the mover's own copy is enough
    // to know the object has finished with it.
    await replied(from);
  }
  // The mating move was the guest's, and this reads what the host was told
  // about it, which is a second arrival on a second socket.
  await until(host, (m) => m.status === "finished");
  const last = host.heard.at(-1);
  check("checkmate finishes the game on the move that gives it",
    last?.status === "finished" && last.result === "0-1" && last.reason === "checkmate",
    JSON.stringify(last));
  host.say({ type: "move", token: hostToken, ply: 4, san: "Kf2" });
  await replied(host);
  check("and nothing more can be played",
    host.heard.at(-1)?.code === "notPlaying", JSON.stringify(host.heard.at(-1)));
  host.close(); guest.close();
}
process.exit(summary() ? 0 : 1);
