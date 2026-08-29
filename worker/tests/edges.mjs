/** The other ways an invite can end. */
import { connect, settle, token, gameId, check, summary } from "./lib.mjs";

console.log("The other ways an invite can end\n");

// Declining also spends the invite — which is what you asked for.
{
  const game = gameId(), host = token(), guest = token();
  const bob = await connect(game, "Bob");
  bob.say({ type: "create", token: host, name: "Bob", color: "b" });
  await settle();
  const alice = await connect(game);
  alice.say({ type: "answer", token: guest, name: "Alice", accept: false });
  await settle();
  check("declining tells the one who declined", alice.heard[0]?.type === "declined", JSON.stringify(alice.heard[0]));
  check("and tells the host it was declined, by whom",
    bob.heard[1]?.type === "answered" && bob.heard[1].accepted === false && bob.heard[1].opponent === "Alice",
    JSON.stringify(bob.heard[1]));

  const other = await connect(game, "someone else");
  other.say({ type: "answer", token: token(), name: "Carol", accept: true });
  await settle();
  check("a declined invite is spent too — nobody else can take it up",
    other.heard[0]?.type === "error", JSON.stringify(other.heard[0]));
  bob.close(); alice.close();
}

// The host cannot answer their own invite.
{
  const game = gameId(), host = token();
  const bob = await connect(game);
  bob.say({ type: "create", token: host, name: "Bob", color: "w" });
  await settle();
  const same = await connect(game);
  same.say({ type: "answer", token: host, name: "Bob", accept: true });
  await settle();
  check("the host cannot answer their own invite",
    same.heard[0]?.type === "error" && /your own invite/.test(same.heard[0].reason),
    JSON.stringify(same.heard[0]));
  bob.close();
}

// Two people opening the same invite at the same instant.
{
  const game = gameId(), host = token();
  const bob = await connect(game);
  bob.say({ type: "create", token: host, name: "Bob", color: "w" });
  await settle();
  const racers = await Promise.all([connect(game, "A"), connect(game, "B"), connect(game, "C")]);
  racers.forEach((ws, i) => ws.say({ type: "answer", token: token(), name: `Racer${i}`, accept: true }));
  await settle(600);
  const joined = racers.filter((ws) => ws.heard[0]?.type === "joined");
  const refused = racers.filter((ws) => ws.heard[0]?.type === "error");
  check("three answering at once: exactly one gets in",
    joined.length === 1 && refused.length === 2,
    `joined=${joined.length} refused=${refused.length}`);
  bob.close(); racers.forEach((ws) => ws.close());
}

// Nothing at all at an unknown game id.
{
  const stranger = await connect(gameId(), "wanderer");
  stranger.say({ type: "peek" });
  await settle();
  check("an invite that was never created says so",
    stranger.heard[0]?.type === "error" && /no such game/.test(stranger.heard[0].reason),
    JSON.stringify(stranger.heard[0]));
}

// A creator returning to their own game before anyone answers.
{
  const game = gameId(), host = token();
  const bob = await connect(game);
  bob.say({ type: "create", token: host, name: "Bob", color: "w", initialFEN: "rnbqkbnr/ppppp1pp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" });
  await settle();
  bob.close();
  const bobBack = await connect(game, "Bob returning");
  bobBack.say({ type: "resume", token: host });
  await settle();
  check("the host can come back while still waiting",
    bobBack.heard[0]?.type === "state" && bobBack.heard[0].status === "planning" && bobBack.heard[0].opponent === null,
    JSON.stringify(bobBack.heard[0]));
  bobBack.close();
}

process.exit(summary() ? 0 : 1);
