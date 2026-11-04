/**
 * The game's revision: one more with every change, told to both players with
 * the change, and asked for back with every request that acts on the game.
 * See `GameRecord.revision`.
 *
 * The cases here are the ones the ply could not tell apart — two games with
 * the same number of moves — and the bookkeeping that makes a missed message
 * something a client can see.
 */
import { connect, answered, until, token, gameId, check, summary } from "./lib.mjs";

console.log("The game's revision\n");

/** A game under way, both players connected, each with nothing heard since. */
async function started(takebacks = 0) {
  const game = gameId(), hostToken = token(), guestToken = token();
  const host = await connect(game, "host");
  host.say({ type: "create", token: hostToken, name: "Bob", color: "w", takebacks });
  await answered(host);
  const created = host.heard.find((m) => m.type === "created");
  const guest = await connect(game, "guest");
  guest.say({ type: "answer", token: guestToken, name: "Alice", accept: true });
  await until(guest, "presence");
  await until(host, "presence");
  const joined = guest.heard.find((m) => m.type === "joined");
  const toHost = host.heard.find((m) => m.type === "answered");
  host.heard.length = 0;
  guest.heard.length = 0;
  return { game, host, guest, hostToken, guestToken, created, joined, toHost };
}

/** Says something, and waits for both players to hear what it changed. */
async function both(who, message, type, players) {
  for (const player of players) {
    player.heard.length = 0;
  }
  who.say(message);
  const heard = [];
  for (const player of players) {
    heard.push(await until(player, type));
  }
  return heard;
}

{
  const { host, guest, hostToken, guestToken, created, joined, toHost } = await started(2);
  check("a game is made at revision 1", created?.revision === 1, JSON.stringify(created));
  check("and answered at 2, said the same to both",
    joined?.revision === 2 && toHost?.revision === 2, `${joined?.revision} / ${toHost?.revision}`);

  /* Each change, one at a time: the revision one more each time, and the
     same number to both. */
  const players = [host, guest];
  const steps = [
    [host, { type: "move", token: hostToken, ply: 0, san: "e4" }, "moved"],
    [guest, { type: "move", token: guestToken, ply: 1, san: "e5" }, "moved"],
    [host, { type: "move", token: hostToken, ply: 2, san: "Bc4" }, "moved"],
    /* Bc4 back, then e4 and e5 with it: two takebacks, and one undone. */
    [host, { type: "takeBack", token: hostToken }, "tookBack"],
    [host, { type: "takeBack", token: hostToken }, "tookBack"],
    [host, { type: "undoTakeBack", token: hostToken }, "putBack"],
    [host, { type: "move", token: hostToken, ply: 2, san: "Nf3" }, "moved"],
    [guest, { type: "offerDraw", token: guestToken }, "drawOffered"],
    [host, { type: "answerDraw", token: hostToken, accept: false }, "drawDeclined"],
  ];
  let expected = 2;
  let counted = true;
  const said = [];
  for (const [who, message, type] of steps) {
    expected += 1;
    const [a, b] = await both(who, message, type, players);
    said.push(`${type} ${a?.revision}/${b?.revision}`);
    if (a?.revision !== expected || b?.revision !== expected) {
      counted = false;
    }
  }
  check("every change is one more, and both players are told the same", counted, said.join(", "));

  check("nothing that is not a change counts: a refused move leaves it where it was", await (async () => {
    host.heard.length = 0;
    host.say({ type: "move", token: hostToken, ply: 3, san: "Nf6" });
    await until(host, (m) => m.code === "notYourTurn");
    guest.heard.length = 0;
    guest.say({ type: "move", token: guestToken, ply: 3, san: "Nc6" });
    const moved = await until(guest, "moved");
    return moved?.revision === expected + 1;
  })());
  host.close(); guest.close();
}

{
  /* Turned down: the last change to a game that never began, told as well. */
  const game = gameId(), hostToken = token(), guestToken = token();
  const host = await connect(game, "host");
  host.say({ type: "create", token: hostToken, name: "Bob", color: "w" });
  await answered(host);
  const guest = await connect(game, "guest");
  guest.say({ type: "answer", token: guestToken, name: "Alice", accept: false });
  const declined = await until(guest, "declined");
  const toHost = await until(host, "answered");
  check("a challenge turned down is a change, told to both with its revision",
    declined?.revision === 2 && toHost?.revision === 2, `${declined?.revision} / ${toHost?.revision}`);
  host.close(); guest.close();
}

{
  /* Coming back: the revision comes with the game, so what is asked next is
     asked of the game as it now is. */
  const { game, host, guest, hostToken, guestToken } = await started();
  await both(host, { type: "move", token: hostToken, ply: 0, san: "d4" }, "moved", [host, guest]);
  host.close();
  const again = await connect(game, "host again");
  again.say({ type: "resume", token: hostToken });
  const state = await until(again, "state");
  check("a player coming back is told the revision", state?.revision === 3, JSON.stringify(state?.revision));
  const reading = await connect(game, "reading");
  reading.say({ type: "standing", token: guestToken });
  const standing = await until(reading, "state");
  check("and so is a list reading how the game stands", standing?.revision === 3, JSON.stringify(standing?.revision));
  reading.close(); again.close(); guest.close();
}

{
  /*
    The gap the ply left open. Black is about to reply to 3. d3 when White
    takes it back and plays 3. d4 instead: the same number of moves, so a
    reply checked by its ply alone was played against d4 — a position its
    sender never saw.
  */
  const { host, guest, hostToken, guestToken } = await started(1);
  const players = [host, guest];
  await both(host, { type: "move", token: hostToken, ply: 0, san: "e4" }, "moved", players);
  await both(guest, { type: "move", token: guestToken, ply: 1, san: "e5" }, "moved", players);
  await both(host, { type: "move", token: hostToken, ply: 2, san: "d3" }, "moved", players);
  const sawD3 = guest.revision;
  await both(host, { type: "takeBack", token: hostToken }, "tookBack", players);
  await both(host, { type: "move", token: hostToken, ply: 2, san: "d4" }, "moved", players);
  guest.heard.length = 0;
  guest.say({ type: "move", token: guestToken, ply: 3, san: "Nf6", revision: sawD3 });
  const no = await until(guest, (m) => m.code !== undefined || m.type === "moved");
  check("a reply to a move since taken back and replaced is refused, though the ply is the same",
    no?.code === "staleMove", JSON.stringify(no));
  guest.heard.length = 0;
  guest.say({ type: "move", token: guestToken, ply: 3, san: "exd4" });
  const moved = await until(guest, "moved");
  check("and the game waits for a reply to the move that is there", moved?.san === "exd4", JSON.stringify(moved));
  host.close(); guest.close();
}

{
  /*
    The same gap for a draw. Black offers, then moves, which withdraws it,
    then offers again. White's acceptance was of the first offer, in the
    position before Black's move, and arrives after the second: it is not an
    answer to the offer that is now on the table.
  */
  const { host, guest, hostToken, guestToken } = await started();
  const players = [host, guest];
  await both(host, { type: "move", token: hostToken, ply: 0, san: "e4" }, "moved", players);
  await both(guest, { type: "offerDraw", token: guestToken }, "drawOffered", players);
  const sawOffer = host.revision;
  await both(guest, { type: "move", token: guestToken, ply: 1, san: "c5" }, "moved", players);
  await both(guest, { type: "offerDraw", token: guestToken }, "drawOffered", players);
  host.heard.length = 0;
  host.say({ type: "answerDraw", token: hostToken, accept: true, revision: sawOffer });
  const no = await until(host, (m) => m.code !== undefined || m.type === "ended");
  check("accepting an offer since withdrawn and made again is refused", no?.code === "staleMove", JSON.stringify(no));
  host.heard.length = 0;
  host.say({ type: "answerDraw", token: hostToken, accept: true });
  const ended = await until(host, "ended");
  check("and the offer that stands can still be taken", ended?.reason === "agreement", JSON.stringify(ended));
  host.close(); guest.close();
}

{
  /* An offer made as a move arrives is about a position not yet seen. */
  const { host, guest, hostToken, guestToken } = await started();
  const players = [host, guest];
  const before = guest.revision;
  await both(host, { type: "move", token: hostToken, ply: 0, san: "e4" }, "moved", players);
  guest.heard.length = 0;
  guest.say({ type: "offerDraw", token: guestToken, revision: before });
  const no = await until(guest, (m) => m.code !== undefined || m.type === "drawOffered");
  check("a draw offered of a position since changed is refused", no?.code === "staleMove", JSON.stringify(no));

  /* Resigning carries no revision, and needs none. */
  guest.heard.length = 0;
  guest.say({ type: "resign", token: guestToken });
  const ended = await until(guest, "ended");
  check("resigning is taken whatever has happened since", ended?.reason === "resignation", JSON.stringify(ended));
  host.close(); guest.close();
}

process.exit(summary() ? 0 : 1);
