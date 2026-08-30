/** Taking a move back, resigning, and offering a draw. */
import { connect, answered, replied, until, token, gameId, check, summary } from "./lib.mjs";

console.log("Takebacks, resignation and draws\n");

async function started(takebacks = 0) {
  const game = gameId(), hostToken = token(), guestToken = token();
  const host = await connect(game, "host");
  host.say({ type: "create", token: hostToken, name: "Bob", color: "w", takebacks });
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
  const { host, guest, hostToken, guestToken } = await started(2);
  host.say({ type: "move", token: hostToken, ply: 0, san: "e4" });
  await replied(host);
  check("a fresh game hands out the allowance it was created with",
    JSON.stringify(host.heard.at(-1)?.takebacksLeft) === JSON.stringify({ w: 2, b: 2 }),
    JSON.stringify(host.heard.at(-1)?.takebacksLeft));

  host.say({ type: "takeBack", token: hostToken });
  await replied(host);
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
  await replied(host);
  check("with nothing played there is nothing to take back",
    host.heard.at(-1)?.code === "nothingToTakeBack", JSON.stringify(host.heard.at(-1)));

  host.say({ type: "move", token: hostToken, ply: 0, san: "d4" });
  await replied(host);
  guest.say({ type: "takeBack", token: guestToken });
  await replied(guest);
  check("I cannot take back my opponent's move",
    guest.heard.at(-1)?.code === "nothingToTakeBack", JSON.stringify(guest.heard.at(-1)));

  guest.say({ type: "move", token: guestToken, ply: 1, san: "d5" });
  await replied(guest);
  host.say({ type: "takeBack", token: hostToken });
  await replied(host);
  check("nor my own once it has been answered",
    host.heard.at(-1)?.code === "nothingToTakeBack", JSON.stringify(host.heard.at(-1)));
  host.close(); guest.close();
}

{
  const { host, guest, hostToken, guestToken } = await started(1);
  host.say({ type: "move", token: hostToken, ply: 0, san: "e4" });
  await replied(host);
  host.say({ type: "takeBack", token: hostToken });
  await replied(host);
  host.say({ type: "move", token: hostToken, ply: 0, san: "d4" });
  await replied(host);
  host.say({ type: "takeBack", token: hostToken });
  await replied(host);
  check("the allowance runs out", host.heard.at(-1)?.code === "noTakebacksLeft",
    JSON.stringify(host.heard.at(-1)));
  guest.close(); host.close();
}

{
  const { host, guest, hostToken } = await started();
  host.say({ type: "resign", token: hostToken });
  await until(host, "ended");
  await until(guest, "ended");
  check("resigning gives the game to the other side",
    host.heard.at(-1)?.type === "ended" && host.heard.at(-1).result === "0-1" &&
    host.heard.at(-1).reason === "resignation", JSON.stringify(host.heard.at(-1)));
  check("and the other side hears it", guest.heard.at(-1)?.type === "ended");
  host.say({ type: "move", token: hostToken, ply: 0, san: "e4" });
  await replied(host);
  check("a resigned game takes no more moves",
    host.heard.at(-1)?.code === "notPlaying", JSON.stringify(host.heard.at(-1)));
  host.close(); guest.close();
}

{
  const { host, guest, hostToken, guestToken } = await started();
  host.say({ type: "offerDraw", token: hostToken });
  // The offer goes to both of them, and this asks about the one it was sent
  // to — so it is that arrival that has to be waited for, not the sender's
  // own copy. On a loopback the two are the same instant; they are not on a
  // network, which is how this came to fail only when deployed.
  await until(guest, "drawOffered");
  check("a draw offer reaches the other player",
    guest.heard.at(-1)?.type === "drawOffered" && guest.heard.at(-1).by === "w",
    JSON.stringify(guest.heard.at(-1)));
  host.say({ type: "answerDraw", token: hostToken, accept: true });
  await replied(host);
  check("you cannot accept your own offer",
    host.heard.at(-1)?.code === "noDrawOffered", JSON.stringify(host.heard.at(-1)));
  guest.say({ type: "answerDraw", token: guestToken, accept: false });
  await replied(guest);
  check("declining says so and leaves the game on",
    guest.heard.at(-1)?.type === "drawDeclined", JSON.stringify(guest.heard.at(-1)));

  host.say({ type: "offerDraw", token: hostToken });
  await replied(host);
  guest.say({ type: "answerDraw", token: guestToken, accept: true });
  await replied(guest);
  check("accepting ends it as a draw by agreement",
    guest.heard.at(-1)?.type === "ended" && guest.heard.at(-1).result === "1/2-1/2" &&
    guest.heard.at(-1).reason === "agreement", JSON.stringify(guest.heard.at(-1)));
  host.close(); guest.close();
}
process.exit(summary() ? 0 : 1);
