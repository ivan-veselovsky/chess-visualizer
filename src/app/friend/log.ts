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
 * open; off in a built app until somebody turns it on, since a reader looking
 * at their own console should see what their own page does and nothing else:
 *
 *   localStorage.setItem("cv.log", "on")   // and reload
 *   localStorage.removeItem("cv.log")
 */
const MARK = "♟";

function wanted(): boolean {
  try {
    if (window.localStorage.getItem("cv.log") !== null) {
      return true;
    }
  } catch {
    /* A browser refusing storage is not a reason to be noisy. */
  }
  return import.meta.env.DEV;
}

/* Read once: whether to keep a log is not a thing to change halfway through
   one, and asking storage on every line is a question asked thousands of
   times for an answer that does not move. */
const on = typeof window === "undefined" ? false : wanted();
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
    build a detail nobody will read. */
export const noting = on;
