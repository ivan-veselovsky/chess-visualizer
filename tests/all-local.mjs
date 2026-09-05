/**
 * Every test that needs nothing but this checkout and a browser.
 *
 *   npm run test:all-local
 *
 * "Local" as against the worker's own suites, which need a service running to
 * talk to. What is here is what a machine can be handed with no setup beyond
 * `npm install`, and what a pull request has to be green on.
 *
 * Three suites: the unit tests, the board's behaviour in a real browser, and
 * the picture it draws. Each suite is its own process, so
 * one that hangs a socket or leaves a browser behind cannot take the rest down
 * with it, and each reports its own tally before this one adds them up.
 *
 * The build runs once here rather than once per suite. Both browser suites drive
 * what is in `dist` — what is shipped, rather than what a dev server would make
 * of the sources — and building it three times is three times the wait for the
 * same bytes.
 *
 * The worker's own suites are not here. They need a worker running to talk to,
 * which is a service to start rather than a file to run:
 *
 *   npx wrangler dev --port 8787 &
 *   npm run test:ws
 *
 * A machine running this needs Chrome on the path as `google-chrome`; the two
 * browser suites say so themselves if it is not there.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** In the order that fails fastest: nothing below is worth running if the app
    does not build, and nothing in a browser is worth running if the rules the
    board draws from are wrong. */
const suites = [
  { name: "unit", file: "unit.mjs", args: ["--experimental-strip-types"] },
  { name: "board", file: "board.mjs", args: [] },
  { name: "rendering", file: "e2e-rendering.mjs", args: [] },
];

const run = (command, args, options = {}) =>
  new Promise((done) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("exit", (code) => done(code ?? 1));
    child.on("error", () => done(1));
  });

console.log("\nBuilding what the browser suites will drive\n");
const built = await run("npm", ["run", "build"], { cwd: join(here, "..") });
if (built !== 0) {
  console.log("\n  The app does not build. Nothing else was run.\n");
  process.exit(1);
}

const failed = [];
for (const suite of suites) {
  console.log("=".repeat(48));
  const code = await run(process.execPath, [...suite.args, join(here, suite.file)]);
  if (code !== 0) {
    failed.push(suite.name);
  }
}

console.log("=".repeat(48));
console.log(
  failed.length === 0
    ? `\n  ${suites.length} suites passed.\n`
    : `\n  ${failed.length} of ${suites.length} suites failed: ${failed.join(", ")}\n`
);
process.exit(failed.length === 0 ? 0 : 1);
