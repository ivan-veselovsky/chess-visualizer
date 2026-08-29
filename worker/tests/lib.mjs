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
  ws.say = (message) => ws.send(JSON.stringify(message));
  return ws;
}

export const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));

/** Waits for a socket to have heard `n` messages, or to have been hung up on. */
export async function heard(ws, n = 1, timeout = 4000) {
  const until = Date.now() + timeout;
  while (ws.heard.length < n && ws.closed === null && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 20));
  }
  return ws.heard;
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
