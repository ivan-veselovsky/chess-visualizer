/**
 * The animated GIF export, and the video export beside it, run as a reader
 * runs them: from their tab, through the dialog, to a file.
 *
 *   npm run test:gif-export
 *
 * What is asked of the file is what a reader would notice was wrong: that it is
 * the size the panel said it would be, and near the size it was estimated at
 * beforehand; that it plays at the board's own pace — the initial delay, a
 * frame a step through each move, the period after it, the last position held;
 * that a game with variations plays every one of them; that it has its
 * movement in it even for a reader who asked their system for none; and that a
 * video of the same game has the same frames at the same moments. What is
 * asked of the page is that it keeps hands off while the frames are made and
 * gives the board back as it was.
 *
 * The file is caught as the page hands it to the browser to download, rather
 * than looked for in a downloads folder: it is the bytes that are being tested,
 * and where a browser in a test harness puts downloads is its own business.
 */
import { readGif } from "./gif.mjs";
import { readMp4 } from "./mp4.mjs";
import { check, HELPERS, open, pause, summary } from "./browser.mjs";
import DEFAULTS from "../src/app/presets/default-settings.json" with { type: "json" };

const PORT = Number(process.env.PORT ?? 4181);
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9426);

/* A mate in two for Black, with who played it said. */
const PGN = [
  '[White "Anna, A. (2100)"]',
  '[Black "Boris, B. (2050)"]',
  '[FEN "7K/3kq1PP/8/8/8/8/8/8 b - - 0 1"]',
  '[SetUp "1"]',
  '[Result "0-1"]',
  "",
  "1... Qe5 2. Kg8 Qe8# 0-1",
  "",
].join("\n");

/* A mate in two for White with three defences, each answered. */
const BRANCHED = [
  '[White "Anna, A. (2100)"]',
  '[Black "Boris, B. (2050)"]',
  '[FEN "3k4/R6R/3n4/8/8/8/8/K7 w - - 0 1"]',
  '[SetUp "1"]',
  '[Result "1-0"]',
  "",
  "1. Rhg7 Nf7 (1... Ne8 2. Ra8#) (1... Ke8 2. Rg8#) 2. Rg8# 1-0",
  "",
].join("\n");

/** Puts a game on the board through the Lab's import dialog. */
const load = (pgn) =>
  page.run(`${HELPERS}
    window.__tab("Lab"); await sleep(300);
    [...document.querySelectorAll("button")].find((b) => /import game/i.test(b.textContent)).click(); await sleep(400);
    const box = document.querySelector("#pgn-text");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, ${JSON.stringify(pgn)});
    box.dispatchEvent(new Event("input", { bubbles: true })); await sleep(200);
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load").click(); await sleep(900);
    return "ok";`);

const lab = await open({ port: PORT, debugPort: DEBUG_PORT, window: "1400,950" });
const page = lab.page;

/**
 * Asks the panel what a GIF of the board would come to, and returns what it
 * said, and whether the page was closed to the reader while it worked it out.
 */
async function estimateOnce() {
  return JSON.parse(await page.run(`${HELPERS}
    document.querySelector("#tab-gif").click();
    for (let i = 0; i < 40 && document.querySelector(".gif-estimate") === null; i += 1) await sleep(100);
    await sleep(300);
    const said = () => document.querySelector(".gif-estimate-value").textContent;
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Estimate size").click();
    await sleep(150);
    const closedDuring = document.querySelector(".tab-bar").inert && document.querySelector(".board-pane").inert;
    const exportClosed = [...document.querySelectorAll("button")].find((b) => /Export animated GIF/.test(b.textContent)).disabled;
    const started = performance.now();
    while (/Estimating/.test(said()) && performance.now() - started < 120000) await sleep(100);
    const text = said();
    /* Gone once an option it was made for changes, and back when it is put back. */
    const rate = document.querySelector("#gif-rate");
    const pick = (value) => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(rate, value); rate.dispatchEvent(new Event("change", { bubbles: true })); };
    const was = rate.value;
    pick("4"); await sleep(200);
    const afterChange = said();
    pick(was); await sleep(200);
    return JSON.stringify({ text, closedDuring, exportClosed, afterChange, afterBack: said(),
      openAfter: !document.querySelector(".tab-bar").inert });`));
}

/**
 * Exports what is on the board and returns what the page and the file said.
 * With `scrolling`, the page is scrolled up and down for as long as it runs.
 */
async function exportOnce(scrolling = false, button = "Export animated GIF") {
  const said = await page.run(`${HELPERS}
    window.__file = null;
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        const name = this.download;
        fetch(this.href).then((r) => r.arrayBuffer()).then((b) => { window.__file = { name, bytes: new Uint8Array(b) }; });
        return;
      }
      return click.call(this);
    };
    document.querySelector("#tab-gif").click();
    for (let i = 0; i < 40 && document.querySelector(".gif-size") === null; i += 1) await sleep(100);
    await sleep(300);
    const size = document.querySelector(".gif-size").textContent;
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes(${JSON.stringify(button)})).click();
    await sleep(400);
    const offered = document.querySelector("#gif-name").value;
    const at = document.querySelector(".moves-select").selectedIndex;
    const onLine = document.querySelector(".branch-path")?.textContent ?? null;
    [...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Export").click();
    let scrolls = 0;
    const scroller = ${scrolling}
      ? setInterval(() => { window.scrollTo(0, window.scrollY > 0 ? 0 : 600); scrolls += 1; }, 7)
      : null;
    await sleep(200);
    const closedDuring = document.querySelector(".tab-bar").inert && document.querySelector(".board-pane").inert;
    const started = performance.now();
    let heading = null;
    while (window.__file === null && performance.now() - started < 240000) {
      const trouble = document.querySelector(".preset-trouble[role=alert]");
      if (trouble) return JSON.stringify({ error: trouble.textContent });
      heading = /~ [0-9.]+ MB in all/.exec(document.querySelector(".gif-progress-line span")?.textContent ?? "")?.[0] ?? heading;
      await sleep(50);
    }
    if (scroller !== null) clearInterval(scroller);
    await sleep(300);
    let bytes = "";
    for (const b of window.__file.bytes) bytes += String.fromCharCode(b);
    return JSON.stringify({
      size, offered, name: window.__file.name, closedDuring,
      openAfter: !document.querySelector(".tab-bar").inert && !document.querySelector(".board-pane").inert,
      atBefore: at, atAfter: document.querySelector(".moves-select").selectedIndex,
      lineBefore: onLine, lineAfter: document.querySelector(".branch-path")?.textContent ?? null,
      done: document.querySelector(".gif-done")?.textContent ?? "",
      heading,
      scrolls,
      bytes: btoa(bytes),
    });`);
  const result = JSON.parse(said);
  if (result.error !== undefined) {
    throw new Error(result.error);
  }
  const file = Buffer.from(result.bytes, "base64");
  return { ...result, gif: /\.gif$/.test(result.name) ? readGif(file) : null, mp4: /\.mp4$/.test(result.name) ? readMp4(file) : null };
}

try {
  await page.send("Page.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 950, deviceScaleFactor: 1, mobile: false });
  await page.send("Page.navigate", { url: lab.app });
  await pause(2500);
  await load(PGN);

  console.log("\nA GIF of a game with names\n");
  const guess = await estimateOnce();
  const first = await exportOnce();
  const { gif } = first;
  check("the name offered is the players'", first.offered === "Anna - Boris.gif", first.offered);
  check("and the file is saved under it", first.name === "Anna - Boris.gif", first.name);
  check("the GIF is the size the panel said it would be",
    first.size.startsWith(`${gif.width} × ${gif.height} px`), `${first.size} vs ${gif.width} × ${gif.height}`);
  check("and it plays for ever", gif.loops === 0, String(gif.loops));

  /*
    At the GIF tab's own default of 50 fps, and the pace of the preset the app
    ships with — taken from it rather than written down here, since it is the
    reader's to change: the Lab's initial delay, its period and its hold at the
    end of a branch, and the fade.
  */
  const STEP = 20;
  const FADE = DEFAULTS.pieces.fadeTimeMs;
  const INITIAL = DEFAULTS.lab.playInitialDelaySec * 1000;
  const PERIOD = Math.max(DEFAULTS.lab.playPeriodPerPositionSec, 0.1) * 1000;
  const HOLD = DEFAULTS.lab.playLineEndHoldSec * 1000;
  /* A position's rest, from the landing: its pace less what was shown of the
     fade in it — a frame a step, up to the fade's end, with the fade fitted
     into the pace where it would not go. */
  const restFor = (pace) => {
    const fade = Math.min(FADE, pace);
    return Math.max(pace - STEP * Math.max(Math.ceil(fade / STEP) - 1, 0), STEP);
  };
  const delays = gif.frames.map((frame) => frame.delayMs);
  const rests = delays.map((delay, i) => [delay, i]).filter(([delay]) => delay !== STEP);
  check("the first position stands for the Lab's initial delay", delays[0] === INITIAL, `${delays[0]} vs ${INITIAL}`);
  check("every frame of a move lasts one step at the chosen rate",
    delays.filter((delay) => delay === STEP).length === delays.length - rests.length && delays.length - rests.length > 40,
    delays.join(","));
  check("each position after a move stands for what is left of the period once its fade has shown",
    rests.slice(1, -1).every(([delay]) => delay === restFor(PERIOD)),
    `${rests.map(([delay]) => delay).join(",")} vs ${restFor(PERIOD)}`);
  check("the last stands for the Lab's hold at the end of a branch, less its fade, before the GIF starts again",
    delays[delays.length - 1] === restFor(HOLD), `${delays[delays.length - 1]} vs ${restFor(HOLD)}`);
  check("one position at rest for each position in the game", rests.length === 4, String(rests.length));

  /* What it was estimated to come to, beforehand: "~ 0.25 MB / 64 frames / 5.3 seconds". */
  const [, guessMb, guessFrames, guessSeconds] =
    /~ ([0-9.]+) MB \/ ([0-9,]+) frames \/ ([0-9.]+) seconds?/.exec(guess.text) ?? [];
  const fileMb = Buffer.from(first.bytes, "base64").length / (1024 * 1024);
  const playsFor = delays.reduce((sum, delay) => sum + delay, 0) / 1000;
  check("the size estimated beforehand says how many frames there will be, exactly",
    Number(guessFrames?.replace(/,/g, "")) === gif.frames.length, `${guess.text} vs ${gif.frames.length} frames`);
  check("and how long it plays for",
    Number(guessSeconds) === (playsFor >= 10 ? Math.round(playsFor) : Number(playsFor.toFixed(1))),
    `${guess.text} vs ${playsFor} s`);
  check("and what it comes to, near enough",
    Math.abs(Number(guessMb) - fileMb) / fileMb < 0.15, `${guess.text} vs ${fileMb.toFixed(3)} MB`);
  check("the page is closed to the reader while it is worked out, and so is the export",
    guess.closedDuring === true && guess.exportClosed === true && guess.openAfter === true);
  check("and the estimate goes when an option it was made for changes, and comes back with it",
    guess.afterChange === "" && guess.afterBack === guess.text, `${guess.afterChange} / ${guess.afterBack}`);
  check("while the export runs, it says what the file is heading for", first.heading !== null, String(first.heading));

  check("the page is closed to the reader while the frames are made", first.closedDuring === true);
  check("and open again afterwards", first.openAfter === true);
  check("the board is back where it was", first.atAfter === first.atBefore, `${first.atBefore} -> ${first.atAfter}`);
  check("and the panel says where the file went", /Saved “Anna - Boris.gif” to your downloads/.test(first.done), first.done);

  console.log("\nWith the page scrolled while it runs\n");
  /* Two boards, so the page is taller than the window and there is somewhere
     to scroll to: the reader scrolls up from the Export button to watch. A
     frame is the page at one moment, so the GIF cannot depend on it. */
  await page.run(`${HELPERS}
    document.querySelector("#tab-manage").click(); await sleep(400);
    const two = document.querySelector("#two-board-mode"); if (!two.checked) two.click(); await sleep(600);
    return "ok";`);
  const steady = await exportOnce(false);
  const scrolled = await exportOnce(true);
  check("the page really was scrolled as it ran", scrolled.scrolls > 50, String(scrolled.scrolls));
  check("and the GIF is the same, byte for byte, as one made with the page still",
    scrolled.bytes === steady.bytes,
    `${Buffer.from(scrolled.bytes, "base64").length} bytes against ${Buffer.from(steady.bytes, "base64").length}`);
  await page.run(`${HELPERS}
    document.querySelector("#tab-manage").click(); await sleep(400);
    const two = document.querySelector("#two-board-mode"); if (two.checked) two.click(); await sleep(600);
    return "ok";`);

  console.log("\nFor a reader who asked for less movement\n");
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const still = await exportOnce();
  check("the GIF still has its movement in it",
    still.gif.frames.length === gif.frames.length, `${still.gif.frames.length} frames against ${gif.frames.length}`);
  const reduced = await page.run(`return String(window.matchMedia("(prefers-reduced-motion: reduce)").matches && !document.documentElement.classList.contains("motion-forced"));`);
  check("and the page goes back to keeping still once it is made", reduced === "true", reduced);
  await page.send("Emulation.setEmulatedMedia", { features: [] });

  console.log("\nA GIF of a game with variations\n");
  /* The way back to a fork at half a second, so its rests stand out from a
     single frame: at the default fifth of a second, less the fade, a rest is
     one frame long and looks like part of a move. */
  await load(BRANCHED);
  await page.run(`${HELPERS}
    window.__tab("Lab"); await sleep(300);
    __set("#play-back-step", "0.5"); await sleep(200);
    return "ok";`);
  const branched = await exportOnce();
  const branchedRests = branched.gif.frames.map((frame) => frame.delayMs).filter((delay) => delay !== STEP);
  check("the panel counts the lines", /3 lines/.test(branched.size), branched.size);
  /*
    Every line played to its end and held there, taken back to the fork at the
    back step period, and the next played on from it: the initial delay, then
    for each line its moves at the period and its end at the hold, and between
    them the steps back — the last of which lands on the fork, where the next
    line is taken up and the period is the time there is to read its name.
  */
  const [p, h, b] = [restFor(PERIOD), restFor(HOLD), restFor(500)];
  const expected = [INITIAL, p, p, h, b, p, p, h, b, p, p, h];
  check("it plays every line, at the Lab's pace for each kind of step",
    JSON.stringify(branchedRests) === JSON.stringify(expected), `${branchedRests.join(",")} vs ${expected.join(",")}`);
  check("and leaves the board on the line it was on, where it was",
    branched.atAfter === branched.atBefore && branched.lineAfter === branched.lineBefore,
    `${branched.atBefore} ${branched.lineBefore} -> ${branched.atAfter} ${branched.lineAfter}`);

  /*
    A back step period shorter than the fade: the fade is fitted into it rather
    than shown whole and the step made to wait for it, so a step back stands
    for exactly the time set — three tenths less than at half a second, and
    nothing else in the GIF changes. Two of the four steps back rest at that
    period: the other two land on a fork, and rest for the period there is to
    read the next line's name.
  */
  await page.run(`${HELPERS}
    window.__tab("Lab"); await sleep(300);
    __set("#play-back-step", "0.2"); await sleep(200);
    return "ok";`);
  const quick = await exportOnce();
  const length = (gif) => gif.frames.reduce((sum, frame) => sum + frame.delayMs, 0);
  check("a step back shorter than the fade still takes exactly as long as it is set to",
    length(branched.gif) - length(quick.gif) === 2 * 300,
    `${length(branched.gif)} ms at 0.5 s, ${length(quick.gif)} ms at 0.2 s`);

  console.log("\nA video of the same game\n");
  /* At fifty frames a second, as the GIF was, so the two can be laid side by
     side: the same frames, standing as long. */
  const offered = JSON.parse(await page.run(`${HELPERS}
    document.querySelector("#tab-gif").click(); await sleep(600);
    const pick = (id, value) => { const s = document.querySelector(id); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, value); s.dispatchEvent(new Event("change", { bubbles: true })); };
    pick("#export-format", "mp4"); await sleep(300);
    const codec = () => document.querySelector("#video-codec");
    for (let i = 0; i < 100 && /Checking/.test(codec().selectedOptions[0].textContent); i += 1) await sleep(100);
    pick("#video-rate", "50"); await sleep(200);
    /* Each kind of file keeps its own size: a GIF for a page, a video for a screen. */
    const scale = () => document.querySelector("#gif-scale").value;
    pick("#gif-scale", "1"); await sleep(200);
    pick("#export-format", "gif"); await sleep(300);
    const gifScale = scale();
    pick("#export-format", "mp4"); await sleep(300);
    const videoScale = scale();
    pick("#gif-scale", "2"); await sleep(300);
    for (let i = 0; i < 100 && /Checking/.test(codec().selectedOptions[0].textContent); i += 1) await sleep(100);
    return JSON.stringify({
      formats: [...document.querySelector("#export-format").options].map((o) => o.textContent),
      gifScale, videoScale,
      codecs: [...codec().options].map((o) => o.value), size: document.querySelector(".gif-size").textContent });`));
  check("the two formats are called what they are",
    JSON.stringify(offered.formats) === JSON.stringify(["Animated GIF", "MP4 video"]), offered.formats.join(" / "));
  check("and each keeps its own resolution",
    offered.gifScale === "2" && offered.videoScale === "1", `GIF ${offered.gifScale}, video ${offered.videoScale}`);
  check("the browser is asked what it can encode, and H.264 comes first where it can",
    offered.codecs.length > 0 && offered.codecs.every((codec) => codec !== "") &&
      (!offered.codecs.includes("avc") || offered.codecs[0] === "avc"),
    offered.codecs.join(", "));
  const film = await exportOnce(false, "Export MP4 video");
  const { mp4 } = film;
  const [, filmWidth, filmHeight] = /^(\d+) × (\d+) px/.exec(offered.size) ?? [];
  check("it is an MP4, named for the game", film.name === "Anna - Boris.mp4" && mp4.brand !== null, `${film.name} ${mp4.brand}`);
  check("in the codec that was offered first", mp4.codec === { avc: "avc1", hevc: "hvc1", vp9: "vp09", av1: "av01" }[offered.codecs[0]],
    `${mp4.codec} for ${offered.codecs[0]}`);
  check("the size the panel said, each side made even as a video needs",
    mp4.width === Number(filmWidth) && mp4.height === Number(filmHeight) && mp4.width % 2 === 0 && mp4.height % 2 === 0,
    `${mp4.width} × ${mp4.height} vs ${offered.size}`);
  /* Its hold at the end made of the last picture and a run of short copies of
     it, so that it keeps its length whatever order the encoder puts frames out
     in; see `VIDEO_TAIL`. */
  check("with the same frames as the GIF of it, the last ending in a few copies of itself",
    mp4.frames - quick.gif.frames.length >= 0 && mp4.frames - quick.gif.frames.length <= 8,
    `${mp4.frames} vs ${quick.gif.frames.length}`);
  check("and plays as long, to the frame, the hold at the end and all",
    Math.abs(mp4.durationMs - length(quick.gif)) <= 20, `${mp4.durationMs} ms vs ${length(quick.gif)} ms`);
  /* Chrome's encoder, left to itself, says full range and sRGB, which VLC
     showed pale, fades flickering; see `yuv.ts`. */
  check("in BT.709's video range, as every player expects",
    JSON.stringify(mp4.colour) === JSON.stringify({ primaries: "bt709", transfer: "bt709", matrix: "bt709", fullRange: false }),
    JSON.stringify(mp4.colour));
  /* Some three fifths of the GIF for a mate in two at twice the size, and less
     the longer the game: a position at rest costs a video next to nothing. */
  check("and smaller", Buffer.from(film.bytes, "base64").length < Buffer.from(quick.bytes, "base64").length * 0.75,
    `${Buffer.from(film.bytes, "base64").length} vs ${Buffer.from(quick.bytes, "base64").length} bytes`);
  check("the board is back where it was after it too", film.atAfter === film.atBefore && film.openAfter === true);
  /* And back to a GIF, which is where the next run of this starts. */
  await page.run(`${HELPERS}
    const s = document.querySelector("#export-format");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, "gif");
    s.dispatchEvent(new Event("change", { bubbles: true })); await sleep(200);
    return "ok";`);
} catch (error) {
  check("the export tests could not run", false, error.message);
}

lab.stop();
process.exit(summary() ? 0 : 1);
