/** Two ends that must be speaking the same revision before anything else. */
import { connect, answered, until, untilClosed, token, gameId, check, summary } from "./lib.mjs";
import { PROTOCOL_VERSION } from "../protocol.ts";

console.log("Speaking the same version\n");

/** What each of the four opening messages is answered with, at version `v`. */
async function opens(v) {
  const game = gameId(), host = token();
  const bob = await connect(game, `create v=${v}`);
  bob.say({ type: "create", v, token: host, name: "Bob", color: "w" });
  return { bob, said: await answered(bob) };
}

{
  const { bob, said } = await opens(PROTOCOL_VERSION);
  check("the version this build speaks is accepted",
    said?.type === "created", JSON.stringify(said));
  bob.close();
}
{
  const { bob, said } = await opens(PROTOCOL_VERSION + 1);
  check("a version from the future is refused",
    said?.code === "versionMismatch", JSON.stringify(said));
  // The refusal is sent and the socket is closed after it. Two events, and on
  // anything slower than a loopback they arrive at two different moments.
  await untilClosed(bob);
  check("and that connection is hung up, not left half-understood",
    bob.closed !== null, JSON.stringify(bob.closed));
}
{
  // What a page written before versions existed sends: nothing at all.
  const game = gameId(), old = await connect(game, "an older build");
  // Straight down the socket: `say` would helpfully stamp a version on it,
  // and the whole point of this one is that there is not one.
  old.send(JSON.stringify({ type: "create", token: token(), name: "Bob", color: "w" }));
  await answered(old);
  check("a client that says no version is one from before there were any",
    old.heard[0]?.code === "versionMismatch", JSON.stringify(old.heard[0]));
}

// The other three openers are gated the same way, and nothing is acted on.
{
  const game = gameId(), host = token();
  const bob = await connect(game, "host");
  bob.say({ type: "create", v: PROTOCOL_VERSION, token: host, name: "Bob", color: "w" });
  await answered(bob);

  const looker = await connect(game, "peek");
  looker.say({ type: "peek", v: PROTOCOL_VERSION + 1 });
  await answered(looker);
  check("peeking at the wrong version is refused",
    looker.heard[0]?.code === "versionMismatch", JSON.stringify(looker.heard[0]));

  const answerer = await connect(game, "answer");
  answerer.say({ type: "answer", v: PROTOCOL_VERSION + 1, token: token(), name: "Alice", accept: true });
  await answered(answerer);
  check("answering at the wrong version is refused",
    answerer.heard[0]?.code === "versionMismatch", JSON.stringify(answerer.heard[0]));

  // And the refusal was a refusal: the invite is still there to be answered.
  const proper = await connect(game, "answer, properly");
  proper.say({ type: "answer", v: PROTOCOL_VERSION, token: token(), name: "Alice", accept: true });
  await until(proper, "joined");
  check("and the game was not spent by the refusal",
    proper.heard[0]?.type === "joined", JSON.stringify(proper.heard[0]));

  const back = await connect(game, "resume");
  back.say({ type: "resume", v: PROTOCOL_VERSION + 1, token: host });
  await answered(back);
  check("resuming at the wrong version is refused",
    back.heard[0]?.code === "versionMismatch", JSON.stringify(back.heard[0]));

  bob.close(); proper.close();
}

process.exit(summary() ? 0 : 1);
