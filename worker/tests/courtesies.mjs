/** Taking a move back, resigning, and offering a draw. */
import { connect, settle, token, gameId, check, summary } from "./lib.mjs";

console.log("Takebacks, resignation and draws\n");

async function started(takebacks = 0) {
  const game = gameId(), hostToken = token(), guestToken = token();
  const host = await connect(game, "host");
  host.say({ type: "create", token: hostToken, name: "Bob", color: "w", takebacks });
  await settle();
  const guest = await connect(game, "guest");
  guest.say({ type: "answer", token: guestToken, name: "Alice", accept: true });
  await settle();
  host.heard.length = 0;
  guest.heard.length = 0;
  return { game, host, guest, hostToken, guestToken };
}

{
  const { host, guest, hostToken, guestToken } = await started(2);
  host.say({ type: "move", token: hostToken, ply: 0, san: "e4" });
  await settle();
  check("a fresh game hands out the allowance it was created with",
    JSON.stringify(host.heard.at(-1)?.takebacksLeft) === JSON.stringify({ w: 2, b: 2 }),
    JSON.stringify(host.heard.at(-1)?.takebacksLeft));

  host.say({ type: "takeBack", token: hostToken });
  await settle();
  check("taking back my own last move unmakes it",
    host.heard.at(-1)?.type === "tookBack" && host.heard.at(-1).ply === 0 &&
    host.heard.at(-1).fen.startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP"),
    JSON.stringify(host.heard.at(-1)));
  check("and spends one of mine, not my opponent's",
    JSON.stringify(host.heard.at(-1)?.takebacksLeft) === JSON.stringify({ w: 1, b: 2 }),
    JSON.stringify(host.heard.at(-1)?.takebacksLeft));
  check("the opponent is told as well",
    guest.heard.at(-1)?.type === "tookBack", JSON.stringify(guest.heard.at(-1)));

  host.say({ type: "takeBack", token: hostToken });
  await settle();
  check("with nothing played there is nothing to take back",
    host.heard.at(-1)?.code === "nothingToTakeBack", JSON.stringify(host.heard.at(-1)));

  host.say({ type: "move", token: hostToken, ply: 0, san: "d4" });
  await settle();
  guest.say({ type: "takeBack", token: guestToken });
  await settle();
  check("I cannot take back my opponent's move",
    guest.heard.at(-1)?.code === "nothingToTakeBack", JSON.stringify(guest.heard.at(-1)));

  guest.say({ type: "move", token: guestToken, ply: 1, san: "d5" });
  await settle();
  host.say({ type: "takeBack", token: hostToken });
  await settle();
  check("nor my own once it has been answered",
    host.heard.at(-1)?.code === "nothingToTakeBack", JSON.stringify(host.heard.at(-1)));
  host.close(); guest.close();
}

{
  const { host, guest, hostToken, guestToken } = await started(1);
  host.say({ type: "move", token: hostToken, ply: 0, san: "e4" });
  await settle();
  host.say({ type: "takeBack", token: hostToken });
  await settle();
  host.say({ type: "move", token: hostToken, ply: 0, san: "d4" });
  await settle();
  host.say({ type: "takeBack", token: hostToken });
  await settle();
  check("the allowance runs out", host.heard.at(-1)?.code === "noTakebacksLeft",
    JSON.stringify(host.heard.at(-1)));
  guest.close(); host.close();
}

{
  const { host, guest, hostToken } = await started();
  host.say({ type: "resign", token: hostToken });
  await settle();
  check("resigning gives the game to the other side",
    host.heard.at(-1)?.type === "ended" && host.heard.at(-1).result === "0-1" &&
    host.heard.at(-1).reason === "resignation", JSON.stringify(host.heard.at(-1)));
  check("and the other side hears it", guest.heard.at(-1)?.type === "ended");
  host.say({ type: "move", token: hostToken, ply: 0, san: "e4" });
  await settle();
  check("a resigned game takes no more moves",
    host.heard.at(-1)?.code === "notPlaying", JSON.stringify(host.heard.at(-1)));
  host.close(); guest.close();
}

{
  const { host, guest, hostToken, guestToken } = await started();
  host.say({ type: "offerDraw", token: hostToken });
  await settle();
  check("a draw offer reaches the other player",
    guest.heard.at(-1)?.type === "drawOffered" && guest.heard.at(-1).by === "w",
    JSON.stringify(guest.heard.at(-1)));
  host.say({ type: "answerDraw", token: hostToken, accept: true });
  await settle();
  check("you cannot accept your own offer",
    host.heard.at(-1)?.code === "noDrawOffered", JSON.stringify(host.heard.at(-1)));
  guest.say({ type: "answerDraw", token: guestToken, accept: false });
  await settle();
  check("declining says so and leaves the game on",
    guest.heard.at(-1)?.type === "drawDeclined", JSON.stringify(guest.heard.at(-1)));

  host.say({ type: "offerDraw", token: hostToken });
  await settle();
  guest.say({ type: "answerDraw", token: guestToken, accept: true });
  await settle();
  check("accepting ends it as a draw by agreement",
    guest.heard.at(-1)?.type === "ended" && guest.heard.at(-1).result === "1/2-1/2" &&
    guest.heard.at(-1).reason === "agreement", JSON.stringify(guest.heard.at(-1)));
  host.close(); guest.close();
}
process.exit(summary() ? 0 : 1);
