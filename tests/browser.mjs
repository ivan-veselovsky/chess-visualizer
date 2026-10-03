/**
 * The plumbing the browser tests share: the built app on a port, a headless
 * browser pointed at it, and enough of the DevTools protocol to drive a page
 * and watch what it draws — and, for the one suite that holds Firefox up
 * against Chrome, enough of WebDriver BiDi to drive a page in Firefox.
 *
 * The app is served from `dist` rather than by the dev server, in both tests:
 * what is asserted is what is shipped, and the dev server's own machinery has
 * no business in it.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import DEFAULTS from "../src/app/presets/default-settings.json" with { type: "json" };

/*
  What every suite here says about what it found, said the same way.

  Two files kept their own copy of this, differing in where the detail of a
  failure went — one put it after the line and one under it — which is the kind
  of difference that is invisible until two failures are read side by side. It
  goes under when it is long enough to need the room, and after when it is not,
  by measure rather than by which file it happened to be in.
*/
let passed = 0;
let failed = 0;

export function check(what, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${what}`);
    return;
  }
  failed += 1;
  const said =
    detail === "" ? "" : detail.length > 48 ? `\n          ${detail}` : `  <- ${detail}`;
  console.log(`  FAIL  ${what}${said}`);
}

/** The tally, and whether it is worth exiting cleanly on. */
export function summary() {
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

/**
 * Anything a particular machine needs to say to Chrome beyond the ordinary.
 *
 * Empty here, and `--no-sandbox` on a CI runner: Chrome's own sandbox wants
 * unprivileged user namespaces, and the images these tests run on refuse them,
 * so a browser started without it never comes up at all. Held in a variable
 * rather than written into the suites, because the machine that needs it is the
 * one that should be asking — the sandbox is worth having everywhere it works.
 */
export const extraChromeFlags = () =>
  (process.env.CHROME_FLAGS ?? "").split(" ").filter((flag) => flag !== "");

/** Waits for something to answer on a port, or gives up. */
export async function waitFor(url, seconds = 30) {
  for (let tries = 0; tries < seconds * 4; tries += 1) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise((done) => setTimeout(done, 250));
    }
  }
  return false;
}

export const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * A thin CDP client: evaluate in the page, click on it, and listen to a stream
 * of events such as the compositor's screencast.
 */
export async function attach(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((open) => socket.addEventListener("open", open));
  let next = 0;
  const waiting = new Map();
  const listeners = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) {
      waiting.get(message.id)(message);
      waiting.delete(message.id);
    } else if (message.method && listeners.has(message.method)) {
      listeners.get(message.method)(message.params);
    }
  });
  const send = (method, params = {}) => {
    const id = (next += 1);
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((done) => waiting.set(id, done));
  };
  const run = async (code) => {
    const answer = await send("Runtime.evaluate", {
      expression: `(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); ${code} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (answer.result?.exceptionDetails) {
      throw new Error(JSON.stringify(answer.result.exceptionDetails.exception));
    }
    return answer.result.result.value;
  };
  const click = async (x, y) => {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", {
        type,
        x,
        y,
        button: "left",
        clickCount: 1,
      });
    }
  };
  return {
    send,
    run,
    click,
    on: (method, handler) => listeners.set(method, handler),
    close: () => socket.close(),
  };
}

/**
 * The built app on a port.
 *
 * Vite's own preview server, started here rather than as `npx vite preview`
 * in a child process.
 *
 * The child was silent by design — its output went nowhere so that a suite's
 * own lines were all that was printed — and when it failed to start, all that
 * was left was this end saying "nothing serving", which is the symptom and
 * never the reason. On a CI runner that is the whole of what one gets to read.
 * Started in this process it either serves or throws, and what it throws says
 * which of the two it was.
 */
async function serve(port) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  try {
    return await preview({
      root,
      configFile: join(root, "vite.config.ts"),
      /* The address the tests will ask for, said outright: left to itself a
         preview server binds whatever `localhost` means on the machine, which
         on some is the IPv6 one and on others both. */
      preview: { host: "127.0.0.1", port, strictPort: true },
    });
  } catch (trouble) {
    throw new Error(
      `the built app could not be served on ${port}: ${trouble.message}`
    );
  }
}

/**
 * Serves the built app, opens a browser on it, and hands back a page.
 *
 * The browser gets a profile of its own each run, so nothing a previous run
 * stored — the reader's settings among it — can change what is drawn.
 */
export async function open({ port, debugPort, window = "1400,900" }) {
  const serving = await serve(port);
  const profile = mkdtempSync(join(tmpdir(), "chess-browser-test-"));

  const browser = spawn(
    "google-chrome",
    [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      `--window-size=${window}`,
      ...extraChromeFlags(),
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let stopped = false;
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    void serving.close();
    browser.kill("SIGKILL");
    /* The browser is still writing its profile as it goes; what is left of a
       temporary directory is the operating system's business, not a failure. */
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* left for /tmp to clear */
    }
  };
  process.on("exit", stop);

  const app = `http://127.0.0.1:${port}/`;
  if (!(await waitFor(app))) {
    stop();
    throw new Error(
      `${app} does not answer, though the server said it was listening`
    );
  }
  if (!(await waitFor(`http://127.0.0.1:${debugPort}/json`))) {
    stop();
    throw new Error(
      `chrome did not come up on ${debugPort}. It is started as ` +
        `\`google-chrome\`; a machine that needs anything more said to it — ` +
        `\`--no-sandbox\` on a CI runner — passes it in CHROME_FLAGS.`
    );
  }
  const page = await attach(debugPort);
  return { page, app, stop };
}

/**
 * A thin WebDriver BiDi client: a command, and the answer to it.
 *
 * Null when nothing answers on the port. A connection that closes with
 * commands still out answers them itself, as failures, rather than leaving
 * them waited on for ever.
 */
async function attachBidi(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
  const connected = await new Promise((done) => {
    socket.addEventListener("open", () => done(true));
    socket.addEventListener("error", () => done(false));
  });
  if (!connected) {
    return null;
  }
  let next = 0;
  const waiting = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined && waiting.has(message.id)) {
      waiting.get(message.id)(message);
      waiting.delete(message.id);
    }
  });
  socket.addEventListener("close", () => {
    for (const done of waiting.values()) {
      done({ type: "error", error: "closed", message: "the connection to Firefox closed" });
    }
    waiting.clear();
  });
  const send = async (method, params = {}) => {
    if (socket.readyState !== WebSocket.OPEN) {
      throw new Error(`${method}: the connection to Firefox is closed`);
    }
    const id = (next += 1);
    const answer = await new Promise((done) => {
      waiting.set(id, done);
      socket.send(JSON.stringify({ id, method, params }));
    });
    if (answer.type === "error") {
      throw new Error(`${method}: ${answer.error}: ${answer.message}`);
    }
    return answer.result;
  };
  return { send, close: () => socket.close() };
}

/**
 * The same, in Firefox: the built app served as it is for Chrome, and a page in
 * headless Firefox driven over WebDriver BiDi, the one protocol Firefox still
 * speaks to a program.
 *
 * Only what is asked of a page in Firefox is here — a viewport, a page to go
 * to, code to run in it — and `run` takes and gives back what Chrome's does, so
 * a script written for one browser runs in the other unchanged. It should end
 * by returning a string, as every script here does: BiDi hands anything else
 * back described rather than as itself.
 *
 * Two things about Firefox as Ubuntu ships it, as a snap. It may write only
 * under its own corner of the home folder, and a profile anywhere else leaves
 * it unable to start; so the profile is made there wherever that corner
 * exists, and in the usual place wherever it does not. And no signal from
 * outside may reach it, so it is closed by asking it to close, over the same
 * connection, before it is killed; one that will not answer is still killed,
 * which is all a Firefox from anywhere else ever needs.
 *
 * `stop` is asynchronous, as Chrome's is not: it waits for the browser to have
 * gone before it clears away the profile the browser was writing to.
 */
export async function openFirefox({ port, debugPort, width = 1400, height = 900 }) {
  const serving = await serve(port);
  const snapped = join(homedir(), "snap", "firefox", "common");
  const profile = mkdtempSync(
    join(existsSync(snapped) ? snapped : tmpdir(), "chess-browser-test-")
  );

  const browser = spawn(
    "firefox",
    [
      "--headless",
      "--no-remote",
      "--profile",
      profile,
      `--remote-debugging-port=${debugPort}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  /* What it last said, for when it does not come up; and whatever it says read
     to the end, since a pipe nobody reads fills, and a browser writing to a
     full one stops where it is. */
  let said = "";
  const hear = (chunk) => {
    said = (said + chunk).slice(-2000);
  };
  browser.stdout.on("data", hear);
  browser.stderr.on("data", hear);
  /* Not starting at all — no `firefox` to start — and a kill refused both come
     here, and are dealt with where they happen. */
  let trouble = null;
  browser.on("error", (error) => {
    trouble = error;
  });
  const exited = new Promise((done) => browser.once("exit", () => done(true)));
  const gone = (ms) => Promise.race([exited, pause(ms).then(() => false)]);

  let client = null;
  let stopped = false;
  const kill = () => {
    try {
      browser.kill("SIGKILL");
    } catch {
      /* already gone, or not ours to kill */
    }
  };
  const stop = async () => {
    if (stopped) {
      return;
    }
    stopped = true;
    if (client !== null) {
      await Promise.race([client.send("browser.close").catch(() => undefined), pause(5000)]);
      client.close();
    }
    if (trouble === null && !(await gone(5000))) {
      kill();
      await gone(2000);
    }
    await serving.close();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* left for whatever clears that folder */
    }
  };
  process.on("exit", () => {
    if (!stopped) {
      kill();
    }
  });
  const failed = async (why) => {
    await stop();
    return new Error(why);
  };

  const app = `http://127.0.0.1:${port}/`;
  if (!(await waitFor(app))) {
    throw await failed(`${app} does not answer, though the server said it was listening`);
  }
  const listening = await new Promise((done) => {
    const look = () => {
      if (/WebDriver BiDi listening/.test(said)) {
        done(true);
      } else if (trouble !== null) {
        done(false);
      }
    };
    browser.stdout.on("data", look);
    browser.stderr.on("data", look);
    browser.once("error", look);
    void exited.then(() => done(false));
    void pause(30000).then(() => done(false));
    look();
  });
  if (!listening) {
    throw await failed(
      trouble?.code === "ENOENT"
        ? "there is no `firefox` on the path to start"
        : `firefox did not come up on ${debugPort}. It last said: ${said.trim().slice(-400) || "nothing"}`
    );
  }

  client = await attachBidi(debugPort);
  if (client === null) {
    throw await failed(`firefox said it was listening on ${debugPort}, and then did not answer there`);
  }
  const { send } = client;
  let context;
  try {
    await send("session.new", { capabilities: {} });
    context = (await send("browsingContext.getTree")).contexts[0].context;
    await send("browsingContext.setViewport", {
      context,
      viewport: { width, height },
      devicePixelRatio: 1,
    });
  } catch (error) {
    throw await failed(`firefox would not give a page to drive: ${error.message}`);
  }

  const page = {
    send,
    goto: (url) => send("browsingContext.navigate", { context, url, wait: "complete" }),
    run: async (code) => {
      const answer = await send("script.evaluate", {
        expression: `(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); ${code} })()`,
        target: { context },
        awaitPromise: true,
      });
      if (answer.type === "exception") {
        throw new Error(answer.exceptionDetails.text);
      }
      return answer.result.value;
    },
  };
  return { page, app, stop };
}

/**
 * A fresh browser put back the way the suites were written against: one board,
 * in the blue and orange preset with the attacks — which is how the app opened
 * until it opened on two boards in Classic green. What the suites assert of
 * the picture, the timing and the layout was measured from that start, and
 * the start a new browser gets is checked once, on its own, by the board
 * suite. Written into the browser's own store, as the app would have left it,
 * and the page loaded again to read it.
 */
export async function openAsBefore(page) {
  const record = JSON.stringify({ target: "Blue - orange - with attacks", working: DEFAULTS, sets: {} });
  /* Before the app is on the page to read it — the page that is there writes
     its own settings back as it goes, over anything written beside it — and
     for the one load only. */
  const { identifier } = (
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `localStorage.setItem("cv.two-board", "off"); localStorage.setItem("cv.settings", ${JSON.stringify(record)});`,
    })
  ).result;
  await page.send("Page.reload");
  await pause(2500);
  await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
}

/**
 * Where each square is on the screen, and how to set the reader's settings.
 *
 * Installed in the page rather than worked out here: the board is laid out by
 * the browser, and asking it is the only answer that stays right when the
 * layout changes.
 */
export const HELPERS = `
  window.__set = (id, value) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const field = document.querySelector(id);
    set.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  };
  window.__tab = (name) =>
    [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim() === name).click();
  window.__sq = (name) => {
    const rects = [...document.querySelectorAll(".square-layer rect")];
    const xs = rects.map((r) => +r.getAttribute("x"));
    const x0 = Math.min(...xs), step = (Math.max(...xs) - x0) / 7;
    const y0 = Math.min(...rects.map((r) => +r.getAttribute("y")));
    const hit = rects.find((r) =>
      Math.abs(+r.getAttribute("x") - (x0 + (name.charCodeAt(0) - 97) * step)) < 1 &&
      Math.abs(+r.getAttribute("y") - (y0 + (8 - +name[1]) * step)) < 1);
    const b = hit.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
             cx: Math.round(b.x + b.width / 2), cy: Math.round(b.y + b.height / 2) };
  };
`;
