/** Taking a move back, resigning, and offering a draw. */
import { connect, answered, until, token, gameId, check, summary } from "./lib.mjs";

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
  await until(host, "moved");
  await until(guest, "moved");
  check("a fresh game hands out the allowance it was created with",
    JSON.stringify(host.heard.at(-1)?.takebacksLeft) === JSON.stringify({ w: 2, b: 2 }),
    JSON.stringify(host.heard.at(-1)?.takebacksLeft));

  host.say({ type: "takeBack", token: hostToken });
  await until(host, "tookBack");
  await until(guest, "tookBack");
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
  await until(host, (m) => m.code === "nothingToTakeBack");
  check("with nothing played there is nothing to take back",
    host.heard.at(-1)?.code === "nothingToTakeBack", JSON.stringify(host.heard.at(-1)));

  host.heard.length = 0;
  guest.heard.length = 0;
  host.say({ type: "move", token: hostToken, ply: 0, san: "d4" });
  await until(host, "moved");
  await until(guest, "moved");
  guest.say({ type: "takeBack", token: guestToken });
  await until(guest, (m) => m.code === "nothingToTakeBack");
  check("I cannot take back my opponent's move",
    guest.heard.at(-1)?.code === "nothingToTakeBack", JSON.stringify(guest.heard.at(-1)));

  host.heard.length = 0;
  guest.heard.length = 0;
  guest.say({ type: "move", token: guestToken, ply: 1, san: "d5" });
  await until(guest, "moved");
  await until(host, "moved");
  host.say({ type: "takeBack", token: hostToken, ply: 2 });
  await until(host, "tookBack");
  await until(guest, "tookBack");
  const pair = host.heard.at(-1);
  check("my own move once it has been answered comes back too, with the answer to it",
    pair?.type === "tookBack" && pair.ply === 0 && JSON.stringify(pair.undone) === JSON.stringify(["d4", "d5"]) && pair.by === "w",
    JSON.stringify(pair));
  check("for one takeback, not two",
    JSON.stringify(pair?.takebacksLeft) === JSON.stringify({ w: 0, b: 2 }), JSON.stringify(pair?.takebacksLeft));
  check("and every line taken back is kept, whole, oldest first",
    JSON.stringify(pair?.abandoned) === JSON.stringify([["e4"], ["d4", "d5"]]) &&
      JSON.stringify(guest.heard.at(-1)?.abandoned) === JSON.stringify(pair?.abandoned),
    JSON.stringify(pair?.abandoned));
  host.close(); guest.close();
}

{
  /* A takeback is of the game as it was seen: a second press, or one sent
     before a reply arrived, is refused rather than unmaking more. */
  const { game, host, guest, hostToken, guestToken } = await started(3);
  host.say({ type: "move", token: hostToken, ply: 0, san: "e4" });
  await until(guest, "moved");
  guest.say({ type: "move", token: guestToken, ply: 1, san: "e5" });
  await until(host, (m) => m.type === "moved" && m.ply === 1);
  host.heard.length = 0;
  host.say({ type: "takeBack", token: hostToken, ply: 1 });
  await until(host, (m) => m.code === "nothingToTakeBack");
  check("a takeback of a game that has moved on since is refused",
    host.heard.at(-1)?.code === "nothingToTakeBack" && /moved on/.test(host.heard.at(-1).reason),
    JSON.stringify(host.heard.at(-1)));

  /* Several in a row, as far as the allowance goes. */
  host.say({ type: "move", token: hostToken, ply: 2, san: "Nf3" });
  await until(guest, (m) => m.type === "moved" && m.ply === 2);
  guest.say({ type: "move", token: guestToken, ply: 3, san: "Nc6" });
  await until(host, (m) => m.type === "moved" && m.ply === 3);
  host.heard.length = 0;
  host.say({ type: "takeBack", token: hostToken, ply: 4 });
  await until(host, "tookBack");
  host.heard.length = 0;
  host.say({ type: "takeBack", token: hostToken, ply: 2 });
  await until(host, "tookBack");
  check("takebacks follow one another, a pair at a time, back to the start",
    host.heard.at(-1)?.ply === 0 && JSON.stringify(host.heard.at(-1).undone) === JSON.stringify(["e4", "e5"]) &&
      JSON.stringify(host.heard.at(-1).abandoned) === JSON.stringify([["e4", "e5", "Nf3", "Nc6"], ["e4", "e5"]]),
    JSON.stringify(host.heard.at(-1)));

  /* And a player coming back is given them with the game. */
  const again = await connect(game, "host again");
  again.say({ type: "resume", token: hostToken });
  await until(again, "state");
  const state = again.heard.find((m) => m.type === "state");
  check("and a player coming back is handed them with the game",
    JSON.stringify(state?.abandoned) === JSON.stringify([["e4", "e5", "Nf3", "Nc6"], ["e4", "e5"]]) && state?.moves.length === 0,
    JSON.stringify(state?.abandoned));
  again.close(); host.close(); guest.close();
}

{
  /* The move that finishes a game is not taken back: the game is over. */
  const { host, guest, hostToken, guestToken } = await started(2);
  const play = async (who, token, ply, san) => {
    who.say({ type: "move", token, ply, san });
    await until(host, (m) => m.type === "moved" && m.ply === ply);
  };
  await play(host, hostToken, 0, "f3");
  await play(guest, guestToken, 1, "e5");
  await play(host, hostToken, 2, "g4");
  await play(guest, guestToken, 3, "Qh4#");
  host.heard.length = 0;
  host.say({ type: "takeBack", token: hostToken, ply: 4 });
  await until(host, (m) => m.code === "notPlaying");
  check("the mate that ends a game is not taken back, nor the move it answered",
    host.heard.at(-1)?.code === "notPlaying", JSON.stringify(host.heard.at(-1)));
  host.close(); guest.close();
}

{
  const { host, guest, hostToken, guestToken } = await started(1);
  host.say({ type: "move", token: hostToken, ply: 0, san: "e4" });
  await until(host, "moved");
  host.say({ type: "takeBack", token: hostToken });
  await until(host, "tookBack");
  host.heard.length = 0;
  host.say({ type: "move", token: hostToken, ply: 0, san: "d4" });
  await until(host, "moved");
  host.say({ type: "takeBack", token: hostToken });
  await until(host, (m) => m.code === "noTakebacksLeft");
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
  await until(host, (m) => m.code === "notPlaying");
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
  /*
    Both copies, not just the far one. An offer is broadcast to the two of
    them, so waiting only for the opponent's leaves the offerer's own copy in
    flight — and the next step, which asks the offerer something else, is then
    answered by that instead. Everything below waits for the message it is
    about to read, on the socket it is about to read it from.
  */
  await until(guest, "drawOffered");
  await until(host, "drawOffered");
  check("a draw offer reaches the other player",
    guest.heard.at(-1)?.type === "drawOffered" && guest.heard.at(-1).by === "w",
    JSON.stringify(guest.heard.at(-1)));

  host.say({ type: "answerDraw", token: hostToken, accept: true });
  await until(host, (m) => m.code === "noDrawOffered");
  check("you cannot accept your own offer",
    host.heard.at(-1)?.code === "noDrawOffered", JSON.stringify(host.heard.at(-1)));

  guest.say({ type: "answerDraw", token: guestToken, accept: false });
  await until(guest, "drawDeclined");
  await until(host, "drawDeclined");
  check("declining says so and leaves the game on",
    guest.heard.at(-1)?.type === "drawDeclined", JSON.stringify(guest.heard.at(-1)));

  /*
    Cleared before the second offer: a wait is answered by anything already
    heard, and both of them are holding the first offer's messages.
  */
  host.heard.length = 0;
  guest.heard.length = 0;
  host.say({ type: "offerDraw", token: hostToken });
  await until(guest, "drawOffered");
  await until(host, "drawOffered");
  guest.say({ type: "answerDraw", token: guestToken, accept: true });
  await until(guest, "ended");
  check("accepting ends it as a draw by agreement",
    guest.heard.at(-1)?.type === "ended" && guest.heard.at(-1).result === "1/2-1/2" &&
    guest.heard.at(-1).reason === "agreement", JSON.stringify(guest.heard.at(-1)));
  host.close(); guest.close();
}
process.exit(summary() ? 0 : 1);
