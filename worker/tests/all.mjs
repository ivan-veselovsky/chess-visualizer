/**
 * Every test against a running worker, local by default.
 *
 *   npm run test:ws
 *   WS_BASE=wss://your-worker.workers.dev npm run test:ws
 *
 * Each file is its own process, so one hanging socket cannot take the rest
 * down with it, and each reports its own tally.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const suites = ["reach", "invite", "edges", "position", "status", "resume", "handicap", "collision", "openColor", "moves", "courtesies", "cancel", "continued", "presence", "version", "times", "standing", "keeping"];
const base = process.env.WS_BASE ?? "ws://127.0.0.1:8787";

console.log(`\nTesting ${base}\n${"=".repeat(40)}`);

/*
  One request and one socket before anything is asserted. The first of each
  wakes the runtime — locally that is workerd starting, deployed it is the
  object being placed — and a suite that measures its first exchange against
  that is measuring the wake-up.
*/
const http = base.replace(/^ws/, "http");
try {
  await fetch(http + "/");
  await new Promise((resolve) => {
    const socket = new WebSocket(`${base}/ws?game=warmup`);
    socket.addEventListener("open", () => {
      socket.close();
      resolve();
    });
    socket.addEventListener("error", resolve);
    setTimeout(resolve, 3000);
  });
} catch {
  // If the warm-up cannot reach it, the suites will say so in their own words.
}

let failed = 0;
for (const suite of suites) {
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [join(here, `${suite}.mjs`)], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", resolve);
  });
  if (code !== 0) {
    failed += 1;
  }
  console.log("-".repeat(40));
}

console.log(
  failed === 0
    ? `\n${suites.length - failed} suite(s) passed.\n`
    : `\n${failed} suite(s) failed.\n`
);
process.exit(failed === 0 ? 0 : 1);
