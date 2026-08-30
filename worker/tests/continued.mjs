/** A game taken up where another one was left off. */
import { connect, answered, until, token, gameId, check, summary } from "./lib.mjs";

console.log("Continuing a game already played\n");

const LINE = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"];

/** A game created from a carried line, answered, and ready to play on. */
async function continued(line = LINE, takebacks = 2) {
  const game = gameId(), hostToken = token(), guestToken = token();
  const host = await connect(game, "host");
  host.say({ type: "create", token: hostToken, name: "Bob", color: "w", takebacks, line });
  await answered(host);
  const guest = await connect(game, "guest");
  guest.say({ type: "answer", token: guestToken, name: "Alice", accept: true });
  // The coupling is not finished until its last word has arrived; see the
  // note in moves.mjs. A `presence` still in flight would otherwise be the
  // "one more message" that the next step waits for.
  await until(guest, "presence");
  await until(host, "presence");
  return { game, host, guest, hostToken, guestToken };
}

// The line comes back as the game's own moves, and is counted as carried.
{
  const { host, guest } = await continued();
  const created = host.heard[0];
  check("a game can be created from a line already played",
    created?.type === "created" && created.terms.priorMoves === 6,
    JSON.stringify(created));
  const joined = guest.heard[0];
  check("whoever answers is handed the whole line, not just the position",
    joined?.type === "joined" &&
    JSON.stringify(joined.moves) === JSON.stringify(LINE),
    JSON.stringify(joined?.moves));
  check("and is told how much of it was carried in",
    joined?.terms.priorMoves === 6, JSON.stringify(joined?.terms));
  const answered = host.heard.find((m) => m.type === "answered");
  check("the challenger is handed it too, on the answer",
    answered !== undefined &&
    JSON.stringify(answered.moves) === JSON.stringify(LINE),
    JSON.stringify(answered?.moves));
  host.close(); guest.close();
}

// Play carries on from where the line left it: six moves played, White to move.
{
  const { host, guest, hostToken, guestToken } = await continued();
  guest.say({ type: "move", token: guestToken, ply: 6, san: "Ba4" });
  await until(guest, (m) => m.code === "notYourTurn");
  check("it is not the answerer's move — the line says whose it is",
    guest.heard.at(-1)?.code === "notYourTurn", JSON.stringify(guest.heard.at(-1)));
  host.say({ type: "move", token: hostToken, ply: 6, san: "Ba4" });
  await until(host, "moved");
  await until(guest, "moved");
  check("the game goes on from the end of the carried line",
    host.heard.at(-1)?.type === "moved" && host.heard.at(-1).ply === 6 &&
    host.heard.at(-1).san === "Ba4", JSON.stringify(host.heard.at(-1)));
  host.close(); guest.close();
}

// A takeback reaches its own moves and stops at the point of hand-over.
{
  const { host, guest, hostToken, guestToken } = await continued();
  host.say({ type: "move", token: hostToken, ply: 6, san: "Ba4" });
  await until(host, "moved");
  await until(guest, "moved");
  host.say({ type: "takeBack", token: hostToken });
  await until(host, "tookBack");
  await until(guest, "tookBack");
  check("a move played here can be taken back",
    host.heard.at(-1)?.type === "tookBack" && host.heard.at(-1).ply === 6,
    JSON.stringify(host.heard.at(-1)));

  host.say({ type: "takeBack", token: hostToken });
  await until(host, (m) => m.code === "nothingToTakeBack");
  check("but the carried moves cannot — they came with the game",
    host.heard.at(-1)?.code === "nothingToTakeBack" &&
    /came with the game/.test(host.heard.at(-1).reason),
    JSON.stringify(host.heard.at(-1)));

  guest.say({ type: "takeBack", token: guestToken });
  await until(guest, (m) => m.code === "nothingToTakeBack");
  check("and neither can the other side reach into them",
    guest.heard.at(-1)?.code === "nothingToTakeBack",
    JSON.stringify(guest.heard.at(-1)));
  host.close(); guest.close();
}

// What will not play is refused, rather than stored and fallen over later.
{
  const game = gameId(), host = await connect(game, "nonsense");
  host.say({ type: "create", token: token(), name: "Bob", color: "w",
    line: ["e4", "e5", "Qxf7"] });
  await answered(host);
  check("a line that will not play is refused, and says which move",
    host.heard[0]?.code === "badLine" && /Qxf7/.test(host.heard[0].reason),
    JSON.stringify(host.heard[0]));
  host.close();
}

// A game already decided has nothing left to continue.
{
  const game = gameId(), host = await connect(game, "finished");
  host.say({ type: "create", token: token(), name: "Bob", color: "w",
    line: ["f3", "e5", "g4", "Qh4#"] });
  await answered(host);
  check("a line that ends in mate cannot be taken up",
    host.heard[0]?.code === "badLine" && /already over/.test(host.heard[0].reason),
    JSON.stringify(host.heard[0]));
  host.close();
}

// Odds and a game to continue are two answers to one question.
{
  const game = gameId(), host = await connect(game, "both");
  host.say({ type: "create", token: token(), name: "Bob", color: "w",
    handicap: { giver: "challenger", piece: "knight" }, line: LINE });
  await answered(host);
  check("odds and a carried line cannot both be given",
    host.heard[0]?.code === "termsConflict", JSON.stringify(host.heard[0]));
  host.close();
}

// A line survives the players going away and coming back.
{
  const { game, host, guest, hostToken } = await continued();
  host.say({ type: "move", token: hostToken, ply: 6, san: "Ba4" });
  await until(host, "moved");
  const back = await connect(game, "returning");
  back.say({ type: "resume", token: hostToken });
  await until(back, "state");
  check("resuming gives the carried line and the played move as one line",
    back.heard[0]?.type === "state" &&
    JSON.stringify(back.heard[0].moves) === JSON.stringify([...LINE, "Ba4"]) &&
    back.heard[0].terms.priorMoves === 6,
    JSON.stringify(back.heard[0]?.moves));
  host.close(); guest.close(); back.close();
}

// And a game that starts from nothing carries nothing.
{
  const game = gameId(), host = await connect(game, "plain");
  host.say({ type: "create", token: token(), name: "Bob", color: "w" });
  await until(host, "created");
  check("an ordinary game says it carried no moves",
    host.heard[0]?.terms.priorMoves === 0, JSON.stringify(host.heard[0]?.terms));
  host.close();
}

process.exit(summary() ? 0 : 1);
