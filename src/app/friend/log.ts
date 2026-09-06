/**
 * What the app is doing, said out loud.
 *
 * A game with a friend is a conversation between two browsers and an object in
 * between, and almost nothing about it can be seen from the outside: a phase
 * changes, a socket comes and goes, a message arrives and the board moves. When
 * something goes wrong the question is always "what happened, in what order",
 * and that is exactly what is not written down anywhere.
 *
 * So it is written down here. Every line reads the same way — the time since
 * the page opened, a mark to pick the lines out with, what happened, and the
 * detail that makes it worth reading.
 *
 * Quiet unless asked for. On during development, where a console is already
 * open; off in a built app until somebody turns it on — a reader looking at
 * their own console should see what their own page does and nothing else.
 * There is a switch for it on the last settings tab, and this is the same thing
 * said by hand:
 *
 *   localStorage.setItem("cv.log", "on")    // or "off"
 *   localStorage.removeItem("cv.log")       // back to the default
 */
const KEY = "cv.log";
const MARK = "♟";

function wanted(): boolean {
  try {
    const said = window.localStorage.getItem(KEY);
    /* What was asked for, when anything was: "off" is as much an answer as
       "on", and a reader who turns it off during development means it. */
    if (said !== null) {
      return said !== "off";
    }
  } catch {
    /* A browser refusing storage is not a reason to be noisy. */
  }
  return import.meta.env.DEV;
}

/* Read once and kept, since asking storage on every line is a question asked
   thousands of times for an answer that rarely moves — but not read once and
   frozen: the switch below sets it, and another tab of the same app changing
   it says so through a `storage` event, which is the only way a tab hears of
   it at all. */
let on = typeof window === "undefined" ? false : wanted();
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === null) {
      on = wanted();
    }
  });
}
const opened = typeof performance === "undefined" ? 0 : performance.now();

/** When it happened, in seconds since the page opened. */
function at(): string {
  const seconds = (performance.now() - opened) / 1000;
  return seconds.toFixed(2).padStart(7, " ");
}

/**
 * Notes something worth knowing the order of.
 *
 * `detail` is printed as it is given: a string reads as part of the line, and
 * an object stays an object the console can be opened up.
 */
export function note(what: string, detail?: unknown): void {
  if (!on) {
    return;
  }
  if (detail === undefined) {
    console.log(`${MARK} ${at()}s  ${what}`);
  } else {
    console.log(`${MARK} ${at()}s  ${what}`, detail);
  }
}

/** Whether anything is being written down, for code that would rather not
    build a detail nobody will read, and for the switch that sets it. */
export function logging(): boolean {
  return on;
}

/**
 * Turns the log on or off, here and in every other tab of this app.
 *
 * Written down rather than merely set, so a reload keeps it; and set rather
 * than merely written down, so this tab does not have to be reloaded to obey
 * it. The other tabs hear about it through the `storage` event above.
 */
export function setLogging(value: boolean): void {
  on = value;
  try {
    window.localStorage.setItem(KEY, value ? "on" : "off");
  } catch {
    /* Then it holds for this tab and this visit, which is what was asked for
       even if it cannot be remembered. */
  }
}
