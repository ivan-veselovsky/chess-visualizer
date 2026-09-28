/**
 * The animated GIF export, run as a reader runs it: from its tab, through its
 * dialog, to a file.
 *
 *   npm run test:gif-export
 *
 * What is asked of the file is what a reader would notice was wrong: that it is
 * the size the panel said it would be, that it plays at the board's own pace —
 * the initial delay, a frame a step through each move, the period after it,
 * the last position held — and that it has its movement in it even for a
 * reader who asked their system for none. What is asked of the page is that it
 * keeps hands off while the frames are made and gives the board back as it was.
 *
 * The file is caught as the page hands it to the browser to download, rather
 * than looked for in a downloads folder: it is the bytes that are being tested,
 * and where a browser in a test harness puts downloads is its own business.
 */
import { readGif } from "./gif.mjs";
import { check, HELPERS, open, pause, summary } from "./browser.mjs";

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

const lab = await open({ port: PORT, debugPort: DEBUG_PORT, window: "1400,950" });
const page = lab.page;

/** Exports what is on the board and returns what the page and the file said. */
async function exportOnce() {
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
    [...document.querySelectorAll("button")].find((b) => /Export animated GIF/.test(b.textContent)).click();
    await sleep(400);
    const offered = document.querySelector("#gif-name").value;
    const at = document.querySelector(".moves-select").selectedIndex;
    [...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Export").click();
    await sleep(200);
    const closedDuring = document.querySelector(".tab-bar").inert && document.querySelector(".board-pane").inert;
    const started = performance.now();
    while (window.__file === null && performance.now() - started < 240000) {
      const trouble = document.querySelector(".preset-trouble[role=alert]");
      if (trouble) return JSON.stringify({ error: trouble.textContent });
      await sleep(200);
    }
    await sleep(300);
    let bytes = "";
    for (const b of window.__file.bytes) bytes += String.fromCharCode(b);
    return JSON.stringify({
      size, offered, name: window.__file.name, closedDuring,
      openAfter: !document.querySelector(".tab-bar").inert && !document.querySelector(".board-pane").inert,
      atBefore: at, atAfter: document.querySelector(".moves-select").selectedIndex,
      done: document.querySelector(".gif-done")?.textContent ?? "",
      bytes: btoa(bytes),
    });`);
  const result = JSON.parse(said);
  if (result.error !== undefined) {
    throw new Error(result.error);
  }
  return { ...result, gif: readGif(Buffer.from(result.bytes, "base64")) };
}

try {
  await page.send("Page.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 950, deviceScaleFactor: 1, mobile: false });
  await page.send("Page.navigate", { url: lab.app });
  await pause(2500);
  await page.run(`${HELPERS}
    window.__tab("Lab"); await sleep(300);
    [...document.querySelectorAll("button")].find((b) => /import game/i.test(b.textContent)).click(); await sleep(400);
    const box = document.querySelector("#pgn-text");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, ${JSON.stringify(PGN)});
    box.dispatchEvent(new Event("input", { bubbles: true })); await sleep(200);
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load").click(); await sleep(900);
    return "ok";`);

  console.log("\nA GIF of a game with names\n");
  const first = await exportOnce();
  const { gif } = first;
  check("the name offered is the players'", first.offered === "Anna - Boris.gif", first.offered);
  check("and the file is saved under it", first.name === "Anna - Boris.gif", first.name);
  check("the GIF is the size the panel said it would be",
    first.size.startsWith(`${gif.width} × ${gif.height} px`), `${first.size} vs ${gif.width} × ${gif.height}`);
  check("and it plays for ever", gif.loops === 0, String(gif.loops));

  /* The defaults: 50 fps, the Lab's 0.2 s initial delay and 0.75 s period, a
     quarter-second fade, and the last position held for 3 s. */
  const STEP = 20;
  const delays = gif.frames.map((frame) => frame.delayMs);
  const rests = delays.map((delay, i) => [delay, i]).filter(([delay]) => delay !== STEP);
  check("the first position stands for the Lab's initial delay", delays[0] === 200, String(delays[0]));
  check("every frame of a move lasts one step at the chosen rate",
    delays.filter((delay) => delay === STEP).length === delays.length - rests.length && delays.length - rests.length > 40,
    delays.join(","));
  check("each position after a move stands for what is left of the period once its fade has shown",
    rests.slice(1, -1).every(([delay]) => delay === 510), rests.map(([delay]) => delay).join(","));
  check("the last stands for as long as the panel said", delays[delays.length - 1] === 3000, String(delays[delays.length - 1]));
  check("one position at rest for each position in the game", rests.length === 4, String(rests.length));

  check("the page is closed to the reader while the frames are made", first.closedDuring === true);
  check("and open again afterwards", first.openAfter === true);
  check("the board is back where it was", first.atAfter === first.atBefore, `${first.atBefore} -> ${first.atAfter}`);
  check("and the panel says where the file went", /Saved “Anna - Boris.gif” to your downloads/.test(first.done), first.done);

  console.log("\nFor a reader who asked for less movement\n");
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const still = await exportOnce();
  check("the GIF still has its movement in it",
    still.gif.frames.length === gif.frames.length, `${still.gif.frames.length} frames against ${gif.frames.length}`);
  const reduced = await page.run(`return String(window.matchMedia("(prefers-reduced-motion: reduce)").matches && !document.documentElement.classList.contains("motion-forced"));`);
  check("and the page goes back to keeping still once it is made", reduced === "true", reduced);
} catch (error) {
  check("the export tests could not run", false, error.message);
}

lab.stop();
process.exit(summary() ? 0 : 1);
