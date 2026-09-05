/** How long a game is kept, and what is left when it is not. */
import { connect, settle, answered, until, token, gameId, check, summary } from "./lib.mjs";

console.log("Games are kept for a while and then swept away\n");

/*
  A week is not a thing a test can wait for, so the keep is a deployment
  variable and this suite asks for a worker started with a short one:

    npx wrangler dev --var GAME_TTL_MS:2500

  Run against an ordinary worker it says so and stops, rather than passing
  quietly without having tested anything.
*/
const keep = Number(process.env.GAME_TTL_MS);
if (!Number.isFinite(keep) || keep <= 0 || keep > 20_000) {
  console.log(
    "  SKIP  needs a worker kept short: GAME_TTL_MS=2500 npx wrangler dev --var GAME_TTL_MS:2500\n"
  );
  process.exit(0);
}

const game = gameId(), host = token(), guest = token();
const bob = await connect(game);
bob.say({ type: "create", token: host, name: "Bob", color: "w" });
await answered(bob);
const alice = await connect(game);
alice.say({ type: "answer", token: guest, name: "Alice", accept: true });
await until(alice, "joined");

/* Well inside the keep: still there, and a move puts the clock back to the
   start, which is what makes this a keep rather than a lifespan. */
await settle(keep * 0.6);
bob.say({ type: "move", token: host, ply: 0, san: "e4" });
const moved = await until(bob, "moved");
check("a game being played outlives its keep", moved.san === "e4", JSON.stringify(moved));

await settle(keep * 0.6);
const midway = await connect(game);
midway.say({ type: "standing", token: host });
const still = await until(midway, "state");
check("because every move puts the clock back to the start",
  still.status === "inProgress", JSON.stringify(still.status));

/* And now nothing happens to it for longer than it is kept. */
await settle(keep * 1.6);
const after = await connect(game);
after.say({ type: "standing", token: host });
const gone = await answered(after);
check("left alone for longer than that, it is swept away",
  gone?.type === "error" && gone.code === "noSuchGame", JSON.stringify(gone));

/* Swept means swept: the number is nobody's again, not merely unreadable. */
const stranger = await connect(game);
stranger.say({ type: "peek" });
const looked = await answered(stranger);
check("and the game is gone for anyone else who asks",
  looked?.type === "error" && looked.code === "noSuchGame", JSON.stringify(looked));

for (const ws of [bob, alice, midway, after, stranger]) ws.close();
process.exit(summary() ? 0 : 1);
