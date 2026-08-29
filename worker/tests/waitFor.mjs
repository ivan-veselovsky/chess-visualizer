/**
 * Waits until a deployment can actually do what the suites are about to ask of
 * it, and says so.
 *
 * A 200 from the front page is not that. Static assets can be served while the
 * script is still going out, and on a redeploy the previous version answers 200
 * throughout — so a check that stops there passes at the exact moment the first
 * suite is going to fail.
 *
 * The three probes below tighten in turn:
 *
 *   1. the page is served at all;
 *   2. `/ws` without an upgrade answers 426, which only the worker's own code
 *      says — assets alone would give the app's HTML or a 404;
 *   3. a real socket opens and a Durable Object answers a question, which is
 *      what every suite depends on and the last thing to come up after a
 *      migration.
 *
 *   WS_BASE=wss://…workers.dev node worker/tests/waitFor.mjs [seconds]
 */
const base = process.env.WS_BASE ?? "ws://127.0.0.1:8787";
const http = base.replace(/^ws/, "http");
const limit = Number(process.argv[2] ?? 90) * 1000;
const started = Date.now();
const left = () => limit - (Date.now() - started);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tries `probe` until it is true or the time runs out. */
async function until(what, probe) {
  let wait = 250;
  for (;;) {
    if (left() <= 0) {
      console.error(`  not ready: ${what} (gave up after ${limit / 1000}s)`);
      process.exit(1);
    }
    try {
      if (await probe()) {
        console.log(`  ready: ${what} (${Math.round((Date.now() - started) / 1000)}s)`);
        return;
      }
    } catch {
      // Not up yet, which is the whole reason for waiting.
    }
    await pause(wait);
    wait = Math.min(wait * 1.5, 3000);
  }
}

await until("the app is served", async () => {
  const answer = await fetch(http + "/", { redirect: "manual" });
  return answer.status === 200;
});

await until("the worker is live", async () => {
  const answer = await fetch(http + "/ws");
  // 426 is the worker saying "this endpoint wants an upgrade" — assets alone
  // could not produce it.
  return answer.status === 426;
});

await until("a game object answers", async () => {
  const game = String(Math.floor(Math.random() * 900_000_000) + 100_000_000);
  const socket = new WebSocket(`${base}/ws?game=${game}`);
  const answered = await new Promise((resolve) => {
    const done = (value) => resolve(value);
    socket.addEventListener("open", () =>
      socket.send(JSON.stringify({ type: "peek" }))
    );
    // Asking about a game nobody made: being told so is a working object.
    socket.addEventListener("message", (event) => {
      try {
        done(JSON.parse(String(event.data)).type === "error");
      } catch {
        done(false);
      }
    });
    socket.addEventListener("error", () => done(false));
    setTimeout(() => done(false), Math.min(8000, Math.max(1000, left())));
  });
  socket.close();
  return answered;
});

console.log(`  ${base} is ready\n`);
