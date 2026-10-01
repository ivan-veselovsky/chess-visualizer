/**
 * A game with variations, played in the Lab as a reader plays it: every line in
 * turn, each to its end, back to the fork the next one leaves from, and on.
 *
 *   npm run test:branches
 *
 * What is asked is what a reader would notice was wrong: that the lines come in
 * the order the file gives them, that the name over the board says which line
 * is up and changes at the fork rather than anywhere else, that each kind of
 * step keeps its own pace, and that the board does not change size on the way
 * — nor for having variations at all: the line's name goes in the row the
 * players' names are already in. And, with two boards, that the rows of names
 * run across both.
 */
import { check, HELPERS, open, pause, summary } from "./browser.mjs";
import DEFAULTS from "../src/app/presets/default-settings.json" with { type: "json" };

const PORT = Number(process.env.PORT ?? 4191);
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9436);

/* A mate in two for White with three defences, each answered. */
const PGN = [
  '[White "Anna"]',
  '[Black "Boris"]',
  '[FEN "3k4/R6R/3n4/8/8/8/8/K7 w - - 0 1"]',
  '[SetUp "1"]',
  '[Result "1-0"]',
  "",
  "1. Rhg7 Nf7 {case A} (1... Ne8 {case B} 2. Ra8#) (1... Ke8 {case C} 2. Rg8#) 2. Rg8# 1-0",
  "",
].join("\n");

/* The same game with its variations taken out. */
const PLAIN = PGN.replace(/ \(1\.\.\. Ne8[^)]*\)| \(1\.\.\. Ke8[^)]*\)/g, "");

/* Long names, and a line whose name is longer than the row has room for. */
const CROWDED = [
  '[White "Karjakin, Sergey Alexandrovich (2750)"]',
  '[Black "Nepomniachtchi, Ian Alexandrovich (2780)"]',
  '[Result "1/2-1/2"]',
  "",
  "1. e4 e5 (1... c5 {The Sicilian Defence, the sharpest reply there is} 2. Nf3",
  "(2. c3 {Alapin: the quiet way to meet it} d5) d6) 2. Nf3 1/2-1/2",
  "",
].join("\n");

/* A game White won, with a line in it where Black mates instead. */
const TWO_WAYS = [
  '[White "Anna"]',
  '[Black "Boris"]',
  '[Result "1-0"]',
  "",
  "1. f3 e5 (1... e6 2. g4 Qh4#) 2. e4 1-0",
  "",
].join("\n");

/*
  Paces far enough apart that a rest cannot be taken for the wrong kind: the
  period a tenth of a second either side of none of the others.
*/
const INITIAL = 0.2;
const PERIOD = 0.6;
const BACK = 0.1;
const HOLD = 1.2;

const lab = await open({ port: PORT, debugPort: DEBUG_PORT, window: "1400,950" });
const page = lab.page;

/* Where the board is, as the reader reads it: the move the list is on, and the line named over the board. */
const WHERE = `
  const where = () => [
    /* The list sets its numbers off with no-break spaces, to keep them in a column. */
    document.querySelector(".moves-select").selectedOptions[0].textContent.replace(/\\s+/g, " ").trim(),
    document.querySelector(".branch-path")?.textContent ?? "",
  ];
  const key = (k, ctrl = false) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, ctrlKey: ctrl, bubbles: true }));
  const load = async (pgn) => {
    window.__tab("Lab"); await sleep(300);
    [...document.querySelectorAll("button")].find((b) => /import game/i.test(b.textContent)).click(); await sleep(400);
    const text = document.querySelector("#pgn-text");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(text, pgn);
    text.dispatchEvent(new Event("input", { bubbles: true })); await sleep(200);
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load").click(); await sleep(900);
  };
  const box = (selector, index = 0) => {
    const found = document.querySelectorAll(selector)[index];
    if (!found) return null;
    const r = found.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
`;

try {
  await page.send("Page.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 950, deviceScaleFactor: 1, mobile: false });
  await page.send("Page.navigate", { url: lab.app });
  await pause(2500);

  console.log("\nThe line on the board, named over it\n");
  const named = JSON.parse(await page.run(`${HELPERS}${WHERE}
    await load(${JSON.stringify(PLAIN)});
    const boardPlain = box(".board-holder svg");
    await load(${JSON.stringify(PGN)});
    const loaded = where();
    const choices = [...document.querySelector("#branch").options].map((o) => o.textContent);
    key("ArrowLeft", true); await sleep(700);
    const start = where();
    const boardAtStart = box(".board-holder svg");
    key("ArrowRight"); await sleep(900);
    const fork = where();
    const boardAtFork = box(".board-holder svg");
    const row = box(".board-and-players > .player-name");
    const middle = box(".board-and-players > .player-name .player-result");
    return JSON.stringify({ loaded, choices, start, fork, boardPlain, boardAtStart, boardAtFork, row, middle });`));
  check("a game read in with variations offers each of its lines",
    JSON.stringify(named.choices) === JSON.stringify(["1 of 3: 1… Nf7 {case A}", "2 of 3: 1… Ne8 {case B}", "3 of 3: 1… Ke8 {case C}"]),
    JSON.stringify(named.choices));
  check("and arrives at the end of its main line, named as the first of them",
    JSON.stringify(named.loaded) === JSON.stringify(["2. Rg8#", "Line 1 of 3: 1… Nf7 {case A}"]), JSON.stringify(named.loaded));
  check("before the fork no line is named — every line is still the same one",
    JSON.stringify(named.start) === JSON.stringify(["start", ""]), JSON.stringify(named.start));
  check("at the fork the line is named by the move it goes on with",
    JSON.stringify(named.fork) === JSON.stringify(["1. Rhg7", "Line 1 of 3: 1… Nf7 {case A}"]), JSON.stringify(named.fork));
  check("and the board is the same size with the name up as without it",
    JSON.stringify(named.boardAtStart) === JSON.stringify(named.boardAtFork),
    `${JSON.stringify(named.boardAtStart)} vs ${JSON.stringify(named.boardAtFork)}`);
  check("and as big as for the same game with no variations: the name takes no row of its own",
    JSON.stringify(named.boardPlain) === JSON.stringify(named.boardAtFork),
    `${JSON.stringify(named.boardPlain)} vs ${JSON.stringify(named.boardAtFork)}`);
  check("it goes in the middle of the row the names are in",
    named.middle.top === named.row.top && named.middle.bottom === named.row.bottom,
    `${JSON.stringify(named.middle)} in ${JSON.stringify(named.row)}`);

  console.log("\nEvery line played, one after another\n");
  const played = JSON.parse(await page.run(`${HELPERS}${WHERE}
    __set("#play-initial-delay", "${INITIAL}"); __set("#play-period", "${PERIOD}");
    __set("#play-back-step", "${BACK}"); __set("#play-line-end", "${HOLD}");
    await sleep(200);
    key("ArrowLeft", true); await sleep(700);
    const play = [...document.querySelectorAll("button")].find((b) => /Play \\/ Resume/.test(b.textContent));
    const seen = [where()];
    const flights = [];
    const lifts = [];
    const lands = [];
    let flying = false;
    const look = () => {
      const now = where();
      const last = seen[seen.length - 1];
      if (now[0] !== last[0] || now[1] !== last[1]) seen.push(now);
      const up = document.querySelector(".flight-layer") !== null;
      if (up !== flying) flights.push([up ? "off" : "down", performance.now()]);
      /* How long the board's fades take, as each move sets off. */
      const fadeTime = document.querySelector(".board-holder svg").style.getPropertyValue("--fade-time");
      if (up && !flying) {
        /* Taken off: the fade, against how long the flight is. */
        const flight = document.getAnimations().find((a) => a.effect?.target?.classList?.contains("flying-piece"));
        lifts.push([parseFloat(fadeTime), flight ? flight.effect.getComputedTiming().duration : null]);
      }
      if (!up && flying) lands.push(fadeTime);
      flying = up;
    };
    const started = performance.now();
    play.click();
    const watching = setInterval(look, 4);
    await sleep(500);
    for (let i = 0; i < 300 && !(/Play \\/ Resume/.test(play.textContent) && !flying); i += 1) await sleep(100);
    clearInterval(watching);
    look();
    return JSON.stringify({ seen, flights, lifts, lands, started, closed: play.disabled, after: document.querySelector(".board-holder svg").style.getPropertyValue("--fade-time") });`));
  const expected = [
    ["start", ""],
    ["1. Rhg7", "Line 1 of 3: 1… Nf7 {case A}"],
    ["Nf7", "Line 1 of 3: 1… Nf7 {case A}"],
    ["2. Rg8#", "Line 1 of 3: 1… Nf7 {case A}"],
    ["Nf7", "Line 1 of 3: 1… Nf7 {case A}"],
    ["1. Rhg7", "Line 1 of 3: 1… Nf7 {case A}"],
    ["1. Rhg7", "Line 2 of 3: 1… Ne8 {case B}"],
    ["Ne8", "Line 2 of 3: 1… Ne8 {case B}"],
    ["2. Ra8#", "Line 2 of 3: 1… Ne8 {case B}"],
    ["Ne8", "Line 2 of 3: 1… Ne8 {case B}"],
    ["1. Rhg7", "Line 2 of 3: 1… Ne8 {case B}"],
    ["1. Rhg7", "Line 3 of 3: 1… Ke8 {case C}"],
    ["Ke8", "Line 3 of 3: 1… Ke8 {case C}"],
    ["2. Rg8#", "Line 3 of 3: 1… Ke8 {case C}"],
  ];
  check("each line to its end, back to the fork, and the next line named there before it moves",
    JSON.stringify(played.seen) === JSON.stringify(expected),
    played.seen.map((step) => step.join(" | ")).join(" ; "));
  check("and the game stops at the end of the last, where Play has nothing left to do",
    played.closed === true);

  /*
    Each rest from a landing to the next take-off, which is how the board
    counts them: the period before a move on, the hold at the end of a line,
    the back step period on the way to the fork — and the period again after
    the fork, which is the time there is to read the new name.
  */
  const offs = played.flights.filter(([kind]) => kind === "off").map(([, at]) => at);
  const downs = played.flights.filter(([kind]) => kind === "down").map(([, at]) => at);
  const rests = offs.slice(1).map((at, i) => (at - downs[i]) / 1000);
  const paces = [PERIOD, PERIOD, HOLD, BACK, PERIOD, PERIOD, HOLD, BACK, PERIOD, PERIOD];
  const near = (measured, wanted) => measured > wanted - 0.03 && measured < wanted + 0.2;
  check("the first move waits the initial delay",
    offs.length > 0 && near((offs[0] - played.started) / 1000, INITIAL),
    String(offs.length > 0 ? (offs[0] - played.started) / 1000 : "no move"));
  check("and every step after it the pace of its kind",
    rests.length === paces.length && rests.every((rest, i) => near(rest, paces[i])),
    rests.map((rest) => rest.toFixed(2)).join(", "));
  /*
    A fade a landing sets off, longer than the rest after its move, is fitted
    into it, so it has finished by the time the next move sets off: the steps
    back, which rest a tenth of a second, fade in a tenth as they land. Every
    other landing keeps the fade the settings give, and so does
    the board once the game has stopped. What a piece held as it lifts fades
    for the whole of its flight, and is gone as the piece lands: a mate's disc
    no longer goes in a flicker when the game steps back from it.
  */
  /* The preset's own fade, which this suite does not set: longer than a step
     back's tenth, as a fade has to be for there to be anything to fit. */
  const FADE = `${DEFAULTS.pieces.fadeTimeMs}ms`;
  const fitted = [FADE, FADE, FADE, "100ms", FADE, FADE, FADE, "100ms", FADE, FADE, FADE];
  check("a fade a landing sets off, longer than the rest after it, is shortened to fit it, and no other",
    JSON.stringify(played.lands) === JSON.stringify(fitted), played.lands.join(", "));
  check("while what a piece held fades for as long as the piece is in the air, whatever comes after",
    played.lifts.length === fitted.length && played.lifts.every(([fade, flight]) => flight !== null && Math.abs(fade - flight) < 0.5),
    played.lifts.map(([fade, flight]) => `${fade}/${flight}`).join(", "));
  check("and once the game stops, the fade is the settings' own again", played.after === FADE, played.after);
  /*
    The steps back take the moves just played back over the same ground —
    2. Rg8# then 1... Nf7, the third flight and the second — at the Lab's
    speedup: each the same move's flight forward, divided by it.
  */
  const SPEEDUP = DEFAULTS.lab.playBackStepSpeedup;
  const flightOf = (index) => played.lifts[index]?.[1] ?? NaN;
  check(`a step back is played ${SPEEDUP} times as fast as the move it takes back`,
    Math.abs(flightOf(3) - flightOf(2) / SPEEDUP) < 1 && Math.abs(flightOf(4) - flightOf(1) / SPEEDUP) < 1 &&
      Math.abs(flightOf(7) - flightOf(6) / SPEEDUP) < 1,
    played.lifts.map(([, flight]) => Math.round(flight)).join(", "));

  console.log("\nChoosing a line by hand\n");
  const chosen = JSON.parse(await page.run(`${HELPERS}${WHERE}
    const pick = document.querySelector("#branch");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(pick, "0");
    pick.dispatchEvent(new Event("change", { bubbles: true })); await sleep(900);
    const atFork = where();
    key("ArrowRight", true); await sleep(900);
    const atEnd = where();
    return JSON.stringify({ atFork, atEnd });`));
  check("another line, chosen from the end of this one, is taken up at the fork they share",
    JSON.stringify(chosen.atFork) === JSON.stringify(["1. Rhg7", "Line 1 of 3: 1… Nf7 {case A}"]), JSON.stringify(chosen.atFork));
  check("and runs on to its own end",
    JSON.stringify(chosen.atEnd) === JSON.stringify(["2. Rg8#", "Line 1 of 3: 1… Nf7 {case A}"]), JSON.stringify(chosen.atEnd));

  console.log("\nStopped on the way back, and started again\n");
  /* From the end of the line just chosen, with the way back slowed right down
     so there is time to stop halfway along it. */
  const resumed = JSON.parse(await page.run(`${HELPERS}${WHERE}
    __set("#play-initial-delay", "0.1"); __set("#play-back-step", "1.5"); await sleep(200);
    const play = () => [...document.querySelectorAll("button")].find((b) => /Play \\/ Resume|Pause \\/ Stop/.test(b.textContent));
    const seen = [where()];
    const look = () => {
      const now = where();
      const last = seen[seen.length - 1];
      if (now[0] !== last[0] || now[1] !== last[1]) seen.push(now);
    };
    const watching = setInterval(look, 4);
    play().click();
    for (let i = 0; i < 60 && seen.length < 2; i += 1) await sleep(50);
    await sleep(900);
    play().click();
    await sleep(300);
    const stoppedAt = seen.length;
    play().click();
    for (let i = 0; i < 100 && seen.length < stoppedAt + 3; i += 1) await sleep(50);
    play().click();
    clearInterval(watching);
    await sleep(600);
    return JSON.stringify({ seen, stoppedAt });`));
  check("stopped one step back from the end",
    JSON.stringify(resumed.seen.slice(0, resumed.stoppedAt)) ===
      JSON.stringify([["2. Rg8#", "Line 1 of 3: 1… Nf7 {case A}"], ["Nf7", "Line 1 of 3: 1… Nf7 {case A}"]]),
    resumed.seen.map((step) => step.join(" | ")).join(" ; "));
  check("and started again, it carries on back to the fork and over, rather than going to the end again",
    JSON.stringify(resumed.seen.slice(resumed.stoppedAt, resumed.stoppedAt + 3)) ===
      JSON.stringify([
        ["1. Rhg7", "Line 1 of 3: 1… Nf7 {case A}"],
        ["1. Rhg7", "Line 2 of 3: 1… Ne8 {case B}"],
        ["Ne8", "Line 2 of 3: 1… Ne8 {case B}"],
      ]),
    resumed.seen.map((step) => step.join(" | ")).join(" ; "));

  console.log("\nBack to the start\n");
  /*
    Stepping back stays on the line the board is on, down to its first
    position; "First position" goes over to the first line as well, so that
    Play from there walks every line.
  */
  const back = JSON.parse(await page.run(`${HELPERS}${WHERE}
    const pick = document.querySelector("#branch");
    const choose = async (value) => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(pick, value);
      pick.dispatchEvent(new Event("change", { bubbles: true })); await sleep(900);
    };
    const first = document.querySelector('[aria-label="First position"]');
    const at = () => [...where(), document.querySelector("#branch").value, first.disabled];
    await choose("2");
    key("ArrowRight", true); await sleep(900);
    const said = { end: at() };
    for (let i = 0; i < 4; i += 1) { key("ArrowLeft"); await sleep(800); }
    said.stepped = at();
    first.click(); await sleep(900);
    said.first = at();
    await choose("1");
    key("ArrowRight"); await sleep(900); key("ArrowRight"); await sleep(900);
    said.inside = at();
    key("ArrowLeft", true); await sleep(900);
    said.ctrl = at();
    return JSON.stringify(said);`));
  check("stepping back stays on the line, and stops at its first position",
    JSON.stringify(back.end) === JSON.stringify(["2. Rg8#", "Line 3 of 3: 1… Ke8 {case C}", "2", false]) &&
      JSON.stringify(back.stepped) === JSON.stringify(["start", "", "2", false]),
    `${JSON.stringify(back.end)} -> ${JSON.stringify(back.stepped)}`);
  check("where \"First position\" still has the first line to go to",
    JSON.stringify(back.first) === JSON.stringify(["start", "", "0", true]), JSON.stringify(back.first));
  check("and from inside another line its key goes there too",
    JSON.stringify(back.inside) === JSON.stringify(["Ne8", "Line 2 of 3: 1… Ne8 {case B}", "1", false]) &&
      JSON.stringify(back.ctrl) === JSON.stringify(["start", "", "0", true]),
    `${JSON.stringify(back.inside)} -> ${JSON.stringify(back.ctrl)}`);

  console.log("\nEach line with its own result\n");
  const results = JSON.parse(await page.run(`${HELPERS}${WHERE}
    const result = () => document.querySelector(".board-and-players > .player-name .player-score")?.textContent ?? "";
    await load(${JSON.stringify(TWO_WAYS)});
    const said = { main: [...where(), result()] };
    const pick = document.querySelector("#branch");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(pick, "1");
    pick.dispatchEvent(new Event("change", { bubbles: true })); await sleep(900);
    said.fork = [...where(), result()];
    /* One step back, which stays on the line: "First position" would go over
       to the first line as well. */
    key("ArrowLeft"); await sleep(900);
    said.start = [...where(), result()];
    key("ArrowRight", true); await sleep(900);
    said.end = [...where(), result()];
    return JSON.stringify(said);`));
  check("the main line comes out as the file says",
    JSON.stringify(results.main) === JSON.stringify(["2. e4", "Line 1 of 2: 1… e5", "1 : 0"]), JSON.stringify(results.main));
  check("a line where Black mates says so, from the fork where it is named",
    JSON.stringify(results.fork) === JSON.stringify(["1. f3", "Line 2 of 2: 1… e6", "0 : 1"]) &&
      JSON.stringify(results.end) === JSON.stringify(["Qh4#", "Line 2 of 2: 1… e6", "0 : 1"]),
    `${JSON.stringify(results.fork)} ${JSON.stringify(results.end)}`);
  check("and before the fork, with no line named, the result is the file's",
    JSON.stringify(results.start) === JSON.stringify(["start", "", "1 : 0"]), JSON.stringify(results.start));

  console.log("\nA line's name longer than the row\n");
  const crowded = JSON.parse(await page.run(`${HELPERS}${WHERE}
    await load(${JSON.stringify(CROWDED)});
    const pick = document.querySelector("#branch");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(pick, "2");
    pick.dispatchEvent(new Event("change", { bubbles: true })); await sleep(900);
    key("ArrowRight", true); await sleep(900);
    const path = document.querySelector(".branch-path");
    return JSON.stringify({
      board: box(".board-holder svg"),
      who: box(".board-and-players > .player-name .player-who"),
      middle: box(".board-and-players > .player-name .player-result"),
      position: box(".board-and-players > .player-name .player-position"),
      cut: path.scrollWidth > path.clientWidth,
      counter: document.querySelector(".board-and-players > .player-name .player-position").textContent,
    });`));
  check("it is cut short in the middle",
    crowded.cut === true, JSON.stringify(crowded.middle));
  check("without running into the name or the counter",
    crowded.who.right < crowded.middle.left && crowded.middle.right < crowded.position.left,
    `${crowded.who.right} < ${crowded.middle.left}, ${crowded.middle.right} < ${crowded.position.left}`);
  check("and the counter is still whole, and still over the board",
    crowded.counter === "half-move 4 of 4" && crowded.position.right <= crowded.board.right + 1,
    `${crowded.counter} ending at ${crowded.position.right} for a board ending at ${crowded.board.right}`);

  console.log("\nWith two boards\n");
  const two = JSON.parse(await page.run(`${HELPERS}${WHERE}
    await load(${JSON.stringify(TWO_WAYS)});
    const pick = document.querySelector("#branch");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(pick, "1");
    pick.dispatchEvent(new Event("change", { bubbles: true })); await sleep(900);
    document.querySelector("#tab-manage").click(); await sleep(400);
    const toggle = document.querySelector("#two-board-mode"); if (!toggle.checked) toggle.click(); await sleep(700);
    window.scrollTo(0, 0); await sleep(200);
    return JSON.stringify({
      left: box(".board-holder svg", 0), right: box(".board-holder svg", 1),
      who: box(".board-and-players > .player-name .player-who"),
      position: box(".board-and-players > .player-name .player-position"),
      branch: box(".branch-path"),
      score: box(".player-score"),
    });`));
  const firstFile = two.left.left + (two.left.width * 24) / 536;
  check("the row over the boards ends where the right-hand board does",
    Math.abs(two.position.right - two.right.right) < 3, `${two.position.right} vs ${two.right.right}`);
  check("the line's name and its result are in the middle of the pair",
    Math.abs((two.branch.left + two.score.right) / 2 - (firstFile + two.right.right) / 2) < 3,
    `${(two.branch.left + two.score.right) / 2} vs ${(firstFile + two.right.right) / 2}`);
  check("and the name begins over the first file",
    Math.abs(two.who.left - firstFile) < 2, `${two.who.left} vs ${firstFile}`);

  console.log("\nA game with nobody named, and a move of one's own, variations not kept\n");
  /*
    Names over the board only where the file gives them. A task names nobody,
    and gets the one row a board of one's own has: which line is up from where
    the first file begins, its result in the middle, the counter at the end —
    one row given up rather than two, so a bigger board, and the same size
    whatever is played on it.
  */
  const NAMELESS = PGN.replace(/\[(White|Black) "[^"]*"\]\n/g, "");
  const rows = `({
    named: document.querySelectorAll(".board-and-players > .player-name:not(.board-counter)").length,
    row: [...(document.querySelector(".board-counter")?.children ?? [])].map((c) => c.textContent),
    branch: box(".board-counter .branch-path"),
    board: box(".board-holder svg"),
  })`;
  const at = (square) => page.run(`${HELPERS} return window.__sq("${square}");`);
  const handMove = async (from, to) => {
    const a = await at(from);
    await page.click(a.cx, a.cy);
    await pause(200);
    const b = await at(to);
    await page.click(b.cx, b.cy);
    await pause(1500);
  };
  /* One line at a time: with variations kept, a move of one's own grows the
     game rather than leaving it, which the section after this one is about. */
  const namesOff = JSON.parse(await page.run(`${HELPERS}${WHERE}
    document.querySelector("#tab-manage").click(); await sleep(400);
    const toggle = document.querySelector("#two-board-mode"); if (toggle.checked) toggle.click(); await sleep(700);
    window.__tab("Lab"); await sleep(300);
    const keep = document.querySelector("#keep-variations"); if (keep.checked) keep.click(); await sleep(300);
    await load(${JSON.stringify(PGN)});
    const named = ${rows};
    await load(${JSON.stringify(NAMELESS)});
    window.scrollTo(0, 0); await sleep(200);
    return JSON.stringify({ named, nameless: ${rows} });`));
  const { named: withNames, nameless } = namesOff;
  const noNamesFirstFile = nameless.board.left + (nameless.board.width * 24) / 536;
  check("a file that names nobody puts no names over the board",
    withNames.named === 2 && nameless.named === 0, `${withNames.named} rows with names, ${nameless.named} without`);
  check("but one row: the line, its result, and where the board stands in it",
    nameless.row.length === 3 && /^Line 1 of 3:/.test(nameless.row[0]) && nameless.row[1] === "1 : 0" &&
      nameless.row[2] === "half-move 3 of 3",
    JSON.stringify(nameless.row));
  check("the line's name beginning where the first file does",
    nameless.branch !== null && Math.abs(nameless.branch.left - noNamesFirstFile) < 2,
    `${nameless.branch?.left} vs ${noNamesFirstFile}`);
  check("and the board a row's height bigger than a game with names has",
    nameless.board.height > withNames.board.height + 5, `${nameless.board.height} vs ${withNames.board.height}`);
  /* A move of one's own on it, from the position before the mate. */
  await page.run(`${WHERE} key("ArrowLeft"); await sleep(900); return "ok";`);
  await handMove("a7", "b7");
  const ownOnNameless = JSON.parse(await page.run(`${HELPERS}${WHERE} return JSON.stringify(${rows});`));
  check("a move of one's own leaves the board the size it was, with the line's name gone",
    Math.abs(ownOnNameless.board.height - nameless.board.height) < 1 && ownOnNameless.named === 0 &&
      ownOnNameless.row[0] === "" && ownOnNameless.row[2] === "half-move 3 of 3",
    `${ownOnNameless.board.height} vs ${nameless.board.height}; ${JSON.stringify(ownOnNameless.row)}`);

  /*
    And, with variations not kept, a game that does name its players loses
    them at the first move the reader makes — any move, even the file's own. Played by hand, the mate
    that ends the first line is the reader's line, not the game's, and the
    names do not come back with it.
  */
  await page.run(`${HELPERS}${WHERE} await load(${JSON.stringify(PGN)}); key("ArrowLeft"); await sleep(900); return "ok";`);
  const before = JSON.parse(await page.run(`${HELPERS}${WHERE} return JSON.stringify(${rows});`));
  await handMove("g7", "g8");
  const own = JSON.parse(await page.run(`${HELPERS}${WHERE} return JSON.stringify(${rows});`));
  check("a game with names keeps them while it is walked",
    before.named === 2, `${before.named} rows with names`);
  check("and loses them at a move of one's own, even the file's own mate",
    own.named === 0 && own.row[0] === "" && own.row[1] === "1 : 0" && own.row[2] === "half-move 3 of 3",
    `${own.named} rows with names; ${JSON.stringify(own.row)}`);
  /* As it does at a position typed in, which starts a board of one's own. */
  const typed = JSON.parse(await page.run(`${HELPERS}${WHERE}
    await load(${JSON.stringify(PGN)});
    const withNames = ${rows}.named;
    window.__tab("Lab"); await sleep(300);
    __set("#fen", "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1"); await sleep(900);
    return JSON.stringify({ withNames, after: ${rows} });`));
  check("and at a position typed in",
    typed.withNames === 2 && typed.after.named === 0 && typed.after.row.join("") === "",
    `${typed.withNames} rows with names before, ${typed.after.named} after; ${JSON.stringify(typed.after.row)}`);

  console.log("\nRecording a tree of lines in the Lab\n");
  /*
    A task's answers recorded by hand: the first line played, then back to the
    defence and the next one played from there, and the next — each a branch
    of its own, where out of the mode each would have replaced the last.
  */
  const tree = `
    const state = () => ({
      row: [...(document.querySelector(".board-counter")?.children ?? [])].map((c) => c.textContent),
      branches: [...(document.querySelector("#branch")?.options ?? [])].map((o) => o.textContent),
      moves: [...document.querySelector(".moves-select").options].map((o) => o.textContent.replace(/\\s+/g, " ").trim()),
      named: document.querySelectorAll(".board-and-players > .player-name:not(.board-counter)").length,
    });
    const exported = async () => {
      [...document.querySelectorAll("button")].find((b) => /Export game \\(PGN\\)/.test(b.textContent)).click(); await sleep(500);
      const text = document.querySelector("dialog[open] .pgn-text").value;
      document.querySelector("dialog[open] .dialog-close").click(); await sleep(300);
      return text;
    };`;
  const twoBack = () => page.run(`${WHERE} key("ArrowLeft"); await sleep(700); key("ArrowLeft"); await sleep(900); return "ok";`);
  await page.run(`${HELPERS}${WHERE}
    window.__tab("Lab"); await sleep(300);
    __set("#fen", "3k4/R6R/3n4/8/8/8/8/K7 w - - 0 1"); await sleep(800);
    const mode = document.querySelector("#keep-variations"); if (!mode.checked) mode.click(); await sleep(300);
    return "ok";`);
  await handMove("h7", "g7");
  await handMove("d6", "f7");
  await handMove("g7", "g8");
  await twoBack();
  await handMove("d6", "e8");
  await handMove("a7", "a8");
  await twoBack();
  await handMove("d8", "e8");
  await handMove("g7", "g8");
  const recorded = JSON.parse(await page.run(`${HELPERS}${WHERE}${tree} return JSON.stringify(state());`));
  check("each answer played from the defence it meets is a branch of its own",
    JSON.stringify(recorded.branches) === JSON.stringify(["1 of 3: 1… Nf7", "2 of 3: 1… Ne8", "3 of 3: 1… Ke8"]),
    JSON.stringify(recorded.branches));
  check("with the board on the last one played, named over it",
    recorded.row[0] === "Line 3 of 3: 1… Ke8" && recorded.row[1] === "1 : 0", JSON.stringify(recorded.row));
  await twoBack();
  await handMove("d6", "f7");
  const followed = JSON.parse(await page.run(`${HELPERS}${WHERE}${tree} return JSON.stringify(state());`));
  check("a move the tree already has is followed rather than made a branch again",
    followed.branches.length === 3 && followed.row[0] === "Line 1 of 3: 1… Nf7" && followed.row[2] === "half-move 2 of 3",
    JSON.stringify(followed));
  const written = await page.run(`${HELPERS}${WHERE}${tree} return await exported();`);
  check("and the game is exported with every branch in it",
    written.includes("1. Rhg7 Nf7 (1... Ne8 2. Ra8#) (1... Ke8 2. Rg8#) 2. Rg8# 1-0") && /\[Result "1-0"\]/.test(written),
    written.split("\n\n").pop());
  /*
    Stashed, it is that same export, kept in the browser: put something else
    on the board and take it back out, and every line is there again, the
    board on the one it was on, and it exports as it did.
  */
  const restored = JSON.parse(await page.run(`${HELPERS}${WHERE}${tree}
    [...document.querySelectorAll("button")].find((b) => /Stash game as/.test(b.textContent)).click(); await sleep(400);
    const name = document.querySelector("dialog[open] input");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(name, "Three defences");
    name.dispatchEvent(new Event("input", { bubbles: true })); await sleep(100);
    [...document.querySelectorAll("dialog[open] button")].find((b) => /^(Stash|Replace)$/.test(b.textContent.trim())).click(); await sleep(400);
    __set("#fen", "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1"); await sleep(800);
    const away = state();
    const pick = document.querySelector("#stashed-game");
    pick.dispatchEvent(new Event("focus")); await sleep(100);
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(pick, "Three defences");
    pick.dispatchEvent(new Event("change", { bubbles: true })); await sleep(900);
    return JSON.stringify({ away, back: state(), text: await exported() });`));
  check("stashed, the tree comes back whole, the board on the line it was on",
    restored.away.branches.length === 0 && JSON.stringify(restored.back.branches) === JSON.stringify(followed.branches) &&
      JSON.stringify(restored.back.row) === JSON.stringify(followed.row),
    `${JSON.stringify(restored.back.branches)} ${JSON.stringify(restored.back.row)}`);
  check("and exports exactly as it did before it was stashed", restored.text === written,
    restored.text.split("\n\n").pop());
  const off = JSON.parse(await page.run(`${HELPERS}${WHERE}${tree}
    document.querySelector("#keep-variations").click(); await sleep(600);
    const after = state(); const text = await exported();
    return JSON.stringify({ ...after, text });`));
  check("switched off, only the way from the start to the board's position is left",
    off.branches.length === 0 && off.row[0] === "" && off.moves.join(" | ") === "Nf7 | 1. Rhg7 | start" &&
      !off.text.includes("(") && !off.text.includes("Rg8"),
    `${JSON.stringify(off.branches)} ${off.moves.join(" | ")} / ${off.text.split("\n\n").pop()}`);
  /* And at the first position, nothing: switched off and on again, there is no
     tree and no line, only the position. */
  const emptied = JSON.parse(await page.run(`${HELPERS}${WHERE}${tree}
    const mode = document.querySelector("#keep-variations"); if (!mode.checked) mode.click(); await sleep(300);
    await load(${JSON.stringify(PGN)});
    key("ArrowLeft", true); await sleep(900);
    mode.click(); await sleep(400); mode.click(); await sleep(400);
    return JSON.stringify({ ...state(), text: await exported(), on: mode.checked });`));
  check("switched off and on at the first position, the game is empty",
    emptied.on === true && emptied.branches.length === 0 && emptied.moves.join(" | ") === "start" &&
      !/\d\./.test(emptied.text.split("\n\n").pop()),
    `${emptied.moves.join(" | ")} / ${emptied.text.split("\n\n").pop()}`);

  /*
    A game read in, grown in the mode: its tags, its names and what it says
    about its moves stay, and the branch played is added to its variations.
  */
  const grownGame = JSON.parse(await page.run(`${HELPERS}${WHERE}${tree}
    const mode = document.querySelector("#keep-variations"); if (!mode.checked) mode.click(); await sleep(300);
    await load(${JSON.stringify(PGN)});
    key("ArrowLeft"); await sleep(700); key("ArrowLeft"); await sleep(900);
    return JSON.stringify(state());`));
  await handMove("d8", "c8");
  await handMove("a7", "a8");
  const extended = JSON.parse(await page.run(`${HELPERS}${WHERE}${tree}
    const after = state(); const text = await exported();
    document.querySelector("#keep-variations").click(); await sleep(400);
    return JSON.stringify({ ...after, text });`));
  check("a game read in keeps its names as it is grown",
    grownGame.named === 2 && extended.named === 2, `${grownGame.named} and ${extended.named} rows with names`);
  check("and gains the branch played, after its own",
    extended.branches.length === 4 && /4 of 4: 1… Kc8/.test(extended.branches[3]), JSON.stringify(extended.branches));
  check("with its tags and its comments kept in what is exported",
    /\[White "Anna"\]/.test(extended.text) && extended.text.includes("{case A}") && extended.text.includes("(1... Kc8 2. Ra8#)"),
    extended.text.split("\n\n").pop());
} catch (error) {
  check("the branch tests could not run", false, error.message);
}

lab.stop();
process.exit(summary() ? 0 : 1);
