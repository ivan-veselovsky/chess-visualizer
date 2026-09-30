/**
 * The export, made in Firefox and held up against the same export made in
 * Chrome.
 *
 *   npm run test:firefox
 *
 * Every other browser suite runs in Chrome. The export leans on things each
 * browser does its own way — when a transition that has been finished lets go
 * of the value it was animating, how an SVG comes out as pixels — and one of
 * them once cost every export made in Firefox its smoothness: a square that
 * faded as a piece took off snapped back at the landing and faded again, a
 * flicker in every file made there and in none made in Chrome. Chrome's export
 * is held to the board's own timing by the GIF suite; here Firefox's is held
 * to Chrome's:
 *
 *   - the same frames, each standing as long — the flicker came with a third
 *     as many frames again, fades running on past where they end;
 *   - the same changes in the pictures, frame by frame, to within what two
 *     browsers' lettering and edges differ by — a square a different colour
 *     for a few frames is far more than that;
 *   - the same file every time it is made, byte for byte;
 *   - and a video whose frames are its GIF's, at the same moments, the hold
 *     at the end included.
 *
 * The game is the start of the one the flicker was found in, played on two
 * boards: its fourth move, e3, is the pawn whose take-off fades d3 and f3 out
 * and whose landing, opening the bishop's and the queen's lines onto them,
 * fades them back in.
 *
 * Needs Firefox on the path as `firefox`, as well as Chrome.
 */
import { readGif } from "./gif.mjs";
import { readMp4 } from "./mp4.mjs";
import { check, HELPERS, open, openFirefox, pause, summary } from "./browser.mjs";

const PORT = Number(process.env.PORT ?? 4191);
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9436);
const FIREFOX_PORT = Number(process.env.FIREFOX_PORT ?? 4192);
const BIDI_PORT = Number(process.env.BIDI_PORT ?? 9437);

const PGN = [
  '[White "Mikhail Botvinnik"]',
  '[Black "Jose Raul Capablanca"]',
  '[Result "*"]',
  "",
  "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 d5 *",
  "",
].join("\n");

/*
  How far apart the two browsers' frames may be: the most any 16-pixel cell's
  change since the first frame may differ by, in levels out of 255.

  Changes, rather than the pictures themselves, because the two set the same
  lettering a hair differently — the title alone differs by some thirty levels
  — and what does not change cancels out. What is left is the move counter
  and the edges of the pieces in flight, and a correct Firefox export came
  within fifteen levels of Chrome's. A square of the board is sixty-odd
  pixels across at this size, so one caught off its fade fills whole cells
  with far more than the thirty allowed here.
*/
const CELL = 16;
const TOLERANCE = 30;

/**
 * The board set up as the flicker was found — two boards, a fifth of a second
 * of fade, the Lab's pace a second a position — and the game on it.
 * The same script for both browsers.
 */
const SETUP = `${HELPERS}
  document.querySelector("#tab-manage").click(); await sleep(400);
  const two = document.querySelector("#two-board-mode"); if (!two.checked) two.click(); await sleep(600);
  window.__tab("Pieces"); await sleep(300); __set("#fade-time", "200"); await sleep(200);
  window.__tab("Lab"); await sleep(300);
  __set("#play-initial-delay", "1"); __set("#play-period", "1"); __set("#play-back-step", "0.2"); __set("#play-line-end", "1"); await sleep(200);
  [...document.querySelectorAll("button")].find((b) => /import game/i.test(b.textContent)).click(); await sleep(400);
  const box = document.querySelector("#pgn-text");
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, ${JSON.stringify(PGN)});
  box.dispatchEvent(new Event("input", { bubbles: true })); await sleep(200);
  [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load").click(); await sleep(900);
  return "ok";`;

/**
 * Exports the board as a GIF at fifty frames a second, or as a video at the
 * same rate, both at the smallest resolution, and returns the file — or, for a
 * video in a browser that can encode none, null.
 */
async function exportFrom(page, format) {
  const said = JSON.parse(await page.run(`${HELPERS}
    window.__file = null;
    if (window.__click === undefined) {
      window.__click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download) {
          const name = this.download;
          fetch(this.href).then((r) => r.arrayBuffer()).then((b) => { window.__file = { name, bytes: new Uint8Array(b) }; });
          return;
        }
        return window.__click.call(this);
      };
    }
    document.querySelector("#tab-gif").click();
    for (let i = 0; i < 40 && document.querySelector("#export-format") === null; i += 1) await sleep(100);
    await sleep(300);
    const pick = (id, value) => { const s = document.querySelector(id); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, value); s.dispatchEvent(new Event("change", { bubbles: true })); };
    pick("#export-format", "${format}"); await sleep(300);
    let codec = null;
    if ("${format}" === "mp4") {
      const field = document.querySelector("#video-codec");
      for (let i = 0; i < 100 && /Checking/.test(field.selectedOptions[0].textContent); i += 1) await sleep(100);
      codec = field.value;
      if (codec === "") return JSON.stringify({ none: true });
      pick("#video-rate", "50");
    } else {
      pick("#gif-rate", "2");
    }
    pick("#gif-scale", "1"); await sleep(300);
    [...document.querySelectorAll("button")].find((b) => /^Export (animated GIF|MP4 video)/.test(b.textContent.trim())).click();
    await sleep(400);
    [...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Export").click();
    const started = performance.now();
    while (window.__file === null && performance.now() - started < 300000) {
      const trouble = document.querySelector(".preset-trouble[role=alert]");
      if (trouble) return JSON.stringify({ error: trouble.textContent });
      await sleep(100);
    }
    if (window.__file === null) return JSON.stringify({ error: "no file after five minutes" });
    await sleep(300);
    let bytes = "";
    for (const b of window.__file.bytes) bytes += String.fromCharCode(b);
    return JSON.stringify({ name: window.__file.name, codec, bytes: btoa(bytes) });`));
  if (said.error !== undefined) {
    throw new Error(said.error);
  }
  return said.none ? null : { codec: said.codec, bytes: Buffer.from(said.bytes, "base64") };
}

/**
 * Where one picture sits on the other. The two browsers measure lettering a
 * little differently, and the frame is cut an em from the ink, so one GIF can
 * be a few pixels bigger than the other with the same picture moved along in
 * it. Found from the first frame, by trying each offset in reach.
 */
function offset(one, other) {
  const [a, b] = [one.frames[0].rgba, other.frames[0].rgba];
  let best = { dx: 0, dy: 0, off: Infinity };
  for (let dy = -8; dy <= 8; dy += 1) {
    for (let dx = -8; dx <= 8; dx += 1) {
      let off = 0;
      let seen = 0;
      for (let y = 8; y < Math.min(one.height, other.height) - 8; y += 3) {
        for (let x = 8; x < Math.min(one.width, other.width) - 8; x += 3) {
          const p = (y * one.width + x) * 4;
          const q = ((y + dy) * other.width + x + dx) * 4;
          off += Math.abs(a[p] - b[q]) + Math.abs(a[p + 1] - b[q + 1]) + Math.abs(a[p + 2] - b[q + 2]);
          seen += 1;
        }
      }
      if (off / seen < best.off) {
        best = { dx, dy, off: off / seen };
      }
    }
  }
  return best;
}

/**
 * The most any cell of any frame differs by, and where: each frame of `one`
 * cut into cells, and how far each cell's average colour has come since the
 * first frame set against how far the same pixels of `other`, moved by
 * `shift`, have come.
 */
function farthest(one, other, { dx, dy }) {
  const across = Math.floor((Math.min(one.width, other.width) - 16) / CELL);
  const down = Math.floor((Math.min(one.height, other.height) - 16) / CELL);
  let worst = { by: 0, frame: 0, x: 0, y: 0 };
  const [a0, b0] = [one.frames[0].rgba, other.frames[0].rgba];
  one.frames.forEach(({ rgba: a }, frame) => {
    const b = other.frames[frame].rgba;
    for (let cy = 0; cy < down; cy += 1) {
      for (let cx = 0; cx < across; cx += 1) {
        const sums = [0, 0, 0];
        for (let y = 8 + cy * CELL; y < 8 + (cy + 1) * CELL; y += 1) {
          for (let x = 8 + cx * CELL; x < 8 + (cx + 1) * CELL; x += 1) {
            const p = (y * one.width + x) * 4;
            const q = ((y + dy) * other.width + x + dx) * 4;
            sums[0] += a[p] - a0[p] - (b[q] - b0[q]);
            sums[1] += a[p + 1] - a0[p + 1] - (b[q + 1] - b0[q + 1]);
            sums[2] += a[p + 2] - a0[p + 2] - (b[q + 2] - b0[q + 2]);
          }
        }
        const by = Math.max(...sums.map((sum) => Math.abs(sum) / (CELL * CELL)));
        if (by > worst.by) {
          worst = { by, frame, x: 8 + cx * CELL, y: 8 + cy * CELL };
        }
      }
    }
  });
  return worst;
}

const delaysOf = (gif) => gif.frames.map((frame) => frame.delayMs);
const lengthOf = (gif) => delaysOf(gif).reduce((sum, delay) => sum + delay, 0);

let chrome = null;
let firefox = null;
try {
  console.log("\nThe export made in Chrome, to hold Firefox's up against\n");
  chrome = await open({ port: PORT, debugPort: DEBUG_PORT, window: "1400,950" });
  await chrome.page.send("Page.enable");
  await chrome.page.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 950, deviceScaleFactor: 1, mobile: false });
  await chrome.page.send("Page.navigate", { url: chrome.app });
  await pause(2500);
  await chrome.page.run(SETUP);
  const reference = readGif((await exportFrom(chrome.page, "gif")).bytes);
  chrome.stop();
  chrome = null;
  console.log(`  ${reference.frames.length} frames, ${lengthOf(reference)} ms`);

  console.log("\nThe same, made in Firefox\n");
  firefox = await openFirefox({ port: FIREFOX_PORT, debugPort: BIDI_PORT, width: 1400, height: 950 });
  await firefox.page.goto(firefox.app);
  await pause(2500);
  await firefox.page.run(SETUP);
  const first = await exportFrom(firefox.page, "gif");
  const second = await exportFrom(firefox.page, "gif");
  const gif = readGif(first.bytes);

  check("it has as many frames as Chrome's",
    gif.frames.length === reference.frames.length, `${gif.frames.length} vs ${reference.frames.length}`);
  check("each standing exactly as long",
    JSON.stringify(delaysOf(gif)) === JSON.stringify(delaysOf(reference)),
    `${gif.frames.length} frames over ${lengthOf(gif)} ms vs ${reference.frames.length} over ${lengthOf(reference)} ms`);
  const shift = offset(gif, reference);
  check("the picture is the same, give or take a few pixels of margin",
    Math.abs(gif.width - reference.width) <= 8 && Math.abs(gif.height - reference.height) <= 8,
    `${gif.width} × ${gif.height} vs ${reference.width} × ${reference.height}`);
  if (gif.frames.length === reference.frames.length) {
    const worst = farthest(gif, reference, shift);
    check("each frame changes as Chrome's does, cell by cell",
      worst.by <= TOLERANCE,
      `${worst.by.toFixed(1)} levels apart in frame ${worst.frame}, at ${worst.x},${worst.y}`);
    console.log(`        (at most ${worst.by.toFixed(1)} levels apart, frame ${worst.frame}, at ${worst.x},${worst.y}; moved ${shift.dx},${shift.dy})`);
  }
  check("made twice, it is the same file, byte for byte",
    first.bytes.equals(second.bytes), `${first.bytes.length} bytes against ${second.bytes.length}`);

  console.log("\nA video of it, made in Firefox\n");
  const film = await exportFrom(firefox.page, "mp4");
  if (film === null) {
    console.log("  SKIP  this Firefox can encode no video, so there is none to look at");
  } else {
    const mp4 = readMp4(film.bytes);
    check(`it is an MP4 (${film.codec})`, mp4.brand !== null && mp4.codec !== null, `${mp4.brand} ${mp4.codec}`);
    check("with the same frames as the GIF, the last ending in a few copies of itself",
      mp4.frames - gif.frames.length >= 0 && mp4.frames - gif.frames.length <= 8, `${mp4.frames} vs ${gif.frames.length}`);
    /* Firefox's H.264 encoder sends frames ahead to predict from, and a video
       from it once stopped as the last piece landed, its hold at the end gone. */
    check("and plays as long, to the frame, the hold at the end and all",
      Math.abs(mp4.durationMs - lengthOf(gif)) <= 20, `${mp4.durationMs} ms vs ${lengthOf(gif)} ms`);
    /* Chrome's encoder, left to itself, says full range and sRGB, which VLC
       showed pale, fades flickering; see `yuv.ts`. */
    check("in BT.709's video range, as every player expects",
      JSON.stringify(mp4.colour) === JSON.stringify({ primaries: "bt709", transfer: "bt709", matrix: "bt709", fullRange: false }),
      JSON.stringify(mp4.colour));
  }
} catch (error) {
  check("the Firefox tests could not run", false, error.message);
}

chrome?.stop();
await firefox?.stop();
process.exit(summary() ? 0 : 1);
