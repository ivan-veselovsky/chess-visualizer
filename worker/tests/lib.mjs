import { PROTOCOL_VERSION } from "../protocol.ts";

export const token = () => crypto.randomUUID() + crypto.randomUUID();
export const gameId = () => crypto.randomUUID();

/** A client: connects, remembers what it was told, and can be closed. */
/** Where to test: local by default, or wherever WS_BASE points. */
export const base = process.env.WS_BASE ?? "ws://127.0.0.1:8787";

export async function connect(game, label = "client") {
  const ws = new WebSocket(`${base}/ws?game=${game}`);
  ws.heard = [];
  ws.closed = null;
  ws.label = label;
  ws.onmessage = (e) => ws.heard.push(JSON.parse(e.data));
  ws.onclose = (e) => (ws.closed = { code: e.code, reason: e.reason });
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error(`${label} could not connect`));
    setTimeout(() => reject(new Error(`${label} timed out connecting`)), 5000);
  });
  /*
    Stamped with the version this build speaks, the way the app's own
    connection stamps it — the four messages that open a conversation carry it,
    and a suite should no more have to remember that at every call site than a
    client does. A test that means to send the wrong version, or none, says so
    explicitly and that is left alone.
  */
  ws.say = (message) => {
    const opens =
      message.type === "create" ||
      message.type === "answer" ||
      message.type === "peek" ||
      message.type === "resume";
    ws.send(
      JSON.stringify(
        opens && !("v" in message)
          ? { ...message, v: PROTOCOL_VERSION }
          : message
      )
    );
  };
  return ws;
}

/**
 * A flat pause, for the one thing a wait cannot express: that nothing arrives.
 *
 * Everywhere else, wait for the thing itself. A sleep long enough for a warm
 * object is not long enough for a cold one, and a suite built on sleeps says
 * "the object is broken" when it means "the object was slow" — which is a
 * failure that comes and goes with the weather and teaches nobody anything.
 */
export const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));

/** Waits for a socket to have heard `n` messages, or to have been hung up on. */
export async function heard(ws, n = 1, timeout = 4000) {
  const stop = Date.now() + timeout;
  while (ws.heard.length < n && ws.closed === null && Date.now() < stop) {
    await new Promise((r) => setTimeout(r, 20));
  }
  return ws.heard;
}

/**
 * Waits until this socket has heard something the test is waiting for.
 *
 * Given a string, that is a message of that type; given a function, whatever
 * it says yes to. Returns the message, or undefined if it never came — which
 * the check that follows will then report in its own words.
 *
 * Preferred over counting, because counting breaks the moment the object
 * learns to say one more thing. A game being answered now brings a `presence`
 * along with it, and a suite that waited for "two messages" would have been
 * waiting for the wrong two.
 *
 * It looks at everything the socket has heard, not only at what arrives next —
 * so where the same kind of message has come before, clear `heard` first, or
 * the wait is answered by the old one and returns at once.
 *
 * There was a "wait for one more message than there is now" helper here too,
 * and it is gone. It read well and was wrong twice in production: most of what
 * this object says goes to *both* players, so at almost any moment there is a
 * message already on its way, and "one more" turns out to be that one rather
 * than the answer being waited for. Naming the message is the whole point —
 * a wait that does not say what it is waiting for is a sleep with extra steps.
 */
export async function until(ws, what, timeout = 4000) {
  const matches =
    typeof what === "function" ? what : (message) => message.type === what;
  const found = () => ws.heard.find(matches);
  const stop = Date.now() + timeout;
  while (found() === undefined && ws.closed === null && Date.now() < stop) {
    await new Promise((r) => setTimeout(r, 20));
  }
  return found();
}

/**
 * Waits for the object to say anything at all to this socket.
 *
 * The commonest wait there is, and the right one wherever the test does not
 * care which answer came — a suite checking that something is refused should
 * not have to name the refusal twice, once to wait for it and once to read it.
 */
export const answered = (ws, timeout = 4000) =>
  until(ws, () => true, timeout);

/** The same, for a socket expected to be hung up on rather than answered. */
export async function untilClosed(ws, timeout = 4000) {
  const stop = Date.now() + timeout;
  while (ws.closed === null && Date.now() < stop) {
    await new Promise((r) => setTimeout(r, 20));
  }
  return ws.closed;
}

let passed = 0;
let failed = 0;
export function check(what, ok, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}${detail && !ok ? "  <- " + detail : ""}`);
}
export function summary() {
  console.log(`\n  ${passed} passed, ${failed} failed`);
  return failed === 0;
}
