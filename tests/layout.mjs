/*
  The computed layout, in two engines: the page opened with `?layout=debug`,
  which lays it out by `layout` and outlines each region it computed, at the
  sizes of a desktop, a laptop, a wide screen, a tablet and phones held
  upright — and each region checked against what is laid out in it, and the
  page against the window.

  Chromium and WebKit, through Playwright: WebKit is Safari's engine, and the
  page's width running past Safari's window is what this layout is for.
*/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { check, summary } from "./browser.mjs";
import { DEFAULT_METRICS, inPixels, layout, minEmFor, scaleFor } from "../src/app/layout.ts";

const PORT = Number(process.env.LAYOUT_PORT ?? 4871);
const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png" };

/* The built app, and the app again for any path it does not have, as the worker serves it. */
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://local").pathname);
  const file = path === "/" ? "/index.html" : path;
  try {
    const body = await readFile(join(dist, file));
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(await readFile(join(dist, "index.html")));
  }
});
await new Promise((done) => server.listen(PORT, done));

/* Window sizes, and how many boards on each: the cases the layout was proved on. */
const CASES = [
  { w: 1400, h: 950, boards: 1, expect: "right", stub: false },
  { w: 1400, h: 950, boards: 2, expect: null },
  { w: 1728, h: 1117, boards: 2, expect: null },
  { w: 2560, h: 1440, boards: 2, expect: null },
  { w: 820, h: 1180, boards: 1, expect: "below", stub: false },
  { w: 390, h: 844, boards: 1, expect: "below" },
  { w: 390, h: 1170, boards: 2, expect: "below", column: true },
  { w: 360, h: 800, boards: 2, expect: "below" },
  /*
    Too little of the panel left over the window's foot: a stub in its place.
    Sought rather than said: a phone's height where it comes is a band some
    tens of pixels deep, and where the band is depends on the font — the stub
    is on a page that scrolls, which it does where the panel's least height,
    so many lines of its text, does not fit under the boards, and a line of
    `system-ui` at 10px is 11px on one machine and 14px on another. The first
    height of these that has a stub is the one tested; none having one is a
    failure, not a check left out.
  */
  { w: 360, seek: [700, 710, 720, 730, 740, 750, 760, 770, 780, 790, 800, 810, 820, 830, 840, 850, 860], boards: 2, expect: "below", stub: true },
  /* Large windows, where the panel's text is smaller than the page's: a Mac's
     window the panel stood beside two boards in, full HD, and 4K. */
  { w: 2150, h: 1004, boards: 2, expect: "right" },
  { w: 1920, h: 1080, boards: 1, expect: "right" },
  { w: 3840, h: 2160, boards: 2, expect: "right" },
  { w: 1280, h: 1024, boards: 2, expect: "below" },
];

/* In the page: the game, the number of boards, and then every region against its outline. */
const measure = async (two) => {
  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  document.querySelector("#tab-manage")?.click();
  await sleep(400);
  const toggle = document.querySelector("#two-board-mode");
  if (toggle !== null && toggle.checked !== two) {
    toggle.click();
    await sleep(800);
  }
  [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.trim() === "Lab")?.click();
  await sleep(300);
  /* A game with a long line, whose list of lines is what carried Safari's page wide. */
  const list = document.querySelector("#stashed-game");
  const game = [...list.options].find((option) => option.textContent.includes("Immortal Game"));
  list.value = game.value;
  list.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(1500);
  const outlines = Object.fromEntries(
    [...document.querySelectorAll(".layout-debug > div")].map((outline) => [outline.textContent, outline.getBoundingClientRect()])
  );
  const offBy = (element, outline) => {
    const box = element.getBoundingClientRect();
    return Math.max(
      Math.abs(box.left - outline.left),
      Math.abs(box.top - outline.top),
      Math.abs(box.right - outline.right),
      Math.abs(box.bottom - outline.bottom)
    );
  };
  const regions = [
    [".app-header", "header"],
    [".side-column", "panel"],
    [".board-and-players > .player-name:first-child", "top row"],
    [".board-and-players > .player-name:last-child", "bottom row"],
    ...(outlines.stub === undefined ? [] : [[".layout-stub", "stub"]]),
  ];
  const off = regions
    .map(([selector, name]) => {
      const element = document.querySelector(selector);
      return element === null || outlines[name] === undefined ? `${name}: missing` : offBy(element, outlines[name]) < 1.5 ? null : `${name} off by ${offBy(element, outlines[name]).toFixed(1)}px`;
    })
    .filter((problem) => problem !== null);
  /* Each board on an outline of a board's, the same size. */
  const boardOutlines = Object.entries(outlines).filter(([name]) => name.startsWith("board")).map(([, box]) => box);
  for (const holder of document.querySelectorAll(".boards > .board-holder")) {
    if (!boardOutlines.some((outline) => offBy(holder, outline) < 1.5)) {
      off.push(`a board at ${Math.round(holder.getBoundingClientRect().left)},${Math.round(holder.getBoundingClientRect().top)} on no outline`);
    }
  }
  const app = document.querySelector(".app");
  /* The panel's text as the open tab draws it: a character of it on the
     average, and a line, from text of the panel's sort put in the tab. */
  const tab = document.querySelector(".tab-panel:not(.tab-panel-measure)");
  const probe = document.createElement("span");
  probe.style.cssText = "position: absolute; visibility: hidden; white-space: nowrap;";
  probe.textContent = "Pieces that attack the square are drawn with rays; the heat map shows how often each square is attacked, by whom.";
  tab.append(probe);
  const sample = probe.getBoundingClientRect();
  probe.remove();
  const side = document.querySelector(".side-column");
  return {
    wide: document.scrollingElement.scrollWidth - document.documentElement.clientWidth,
    off,
    boards: document.querySelectorAll(".boards > .board-holder").length,
    panel: app.classList.contains("app-panel-right") ? "right" : app.classList.contains("app-panel-below") ? "below" : "none",
    column: app.classList.contains("app-flow-column"),
    stub: document.querySelector(".layout-stub") !== null,
    panelTop: document.querySelector(".side-column").getBoundingClientRect().top,
    font: parseFloat(getComputedStyle(document.documentElement).fontSize),
    panelFont: parseFloat(getComputedStyle(side).fontSize),
    tabFont: parseFloat(getComputedStyle(tab).fontSize),
    charPx: sample.width / probe.textContent.length,
    linePx: sample.height,
    panelW: side.getBoundingClientRect().width,
    panelH: side.getBoundingClientRect().height,
  };
};

for (const [name, engine] of [["Chromium", chromium], ["WebKit", webkit]]) {
  console.log(`\nThe computed layout, in ${name}\n`);
  const browser = await engine.launch();
  try {
    for (const { w, h: asked, seek, boards, expect, column, stub } of CASES) {
      /* The window asked for, or the first of those sought that has a stub. */
      let h = asked;
      let page = null;
      let seen = null;
      for (const height of seek ?? [asked]) {
        await page?.close();
        h = height;
        page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.goto(`http://127.0.0.1:${PORT}/?layout=debug`);
        await page.waitForTimeout(1500);
        seen = await page.evaluate(measure, boards === 2);
        if (seen.stub) {
          break;
        }
      }
      const at = `${w} × ${seek === undefined ? h : `${h}${seen.stub ? "" : `, the tallest of ${seek[0]} to ${seek.at(-1)}`}`}, ${boards === 2 ? "two boards" : "one board"}`;
      check(`${at}: no wider than the window, and every region where it was computed`,
        seen.wide <= 0 && seen.off.length === 0 && seen.boards === boards,
        JSON.stringify(seen));
      if (expect !== null) {
        check(`${at}: the panel ${expect === "right" ? "beside the boards" : "under them"}${column ? ", the boards one over the other" : ""}`,
          seen.panel === expect && (column === undefined || seen.column === column), JSON.stringify(seen));
      }
      /*
        The panel's text at the size the layout gave it — its own, smaller
        than the page's on a large screen — and the panel the room for as much
        of it as the layout asks for: so many characters across, where it
        stands beside the boards, and so many lines down, where it is under
        them. Measured in the text the open tab draws, so a size the layout
        reckoned with and the stylesheet did not draw — a rem left unscaled, a
        tab with type of its own — is a panel too small for what it holds.
      */
      const sizes = inPixels(layout({ aspect: h / w, scrollable: true, boards, bars: 0, minEm: minEmFor(w), scale: scaleFor(w, h) }), w);
      const text = { panelFont: seen.panelFont, tabFont: seen.tabFont, root: seen.font, charPx: seen.charPx, linePx: seen.linePx };
      check(`${at}: the panel's text at the size the layout gave it, ${sizes.settingsEm.toFixed(2)}px`,
        Math.abs(seen.panelFont - sizes.settingsEm) < 0.05 && Math.abs(seen.tabFont - sizes.settingsEm) < 0.05,
        JSON.stringify(text));
      const M = DEFAULT_METRICS;
      if (seen.panel === "right") {
        check(`${at}: the panel beside the boards ${M.panelMinChars} characters of its text wide, at least`,
          seen.panelW >= M.panelMinChars * seen.charPx - 1,
          `${seen.panelW.toFixed(1)}px for ${M.panelMinChars} × ${seen.charPx.toFixed(2)}px: ${(seen.panelW / seen.charPx).toFixed(1)} characters`);
      }
      if (seen.panel === "below") {
        check(`${at}: the panel under the boards ${M.panelMinLines} lines of its text tall, at least`,
          seen.panelH >= M.panelMinLines * seen.linePx - 1,
          `${seen.panelH.toFixed(1)}px for ${M.panelMinLines} × ${seen.linePx.toFixed(2)}px: ${(seen.panelH / seen.linePx).toFixed(1)} lines`);
      }
      /* Where the case says: elsewhere a stub comes and goes with how tall the tabs are. */
      if (stub !== undefined) {
        check(`${at}: ${stub ? "a stub over the window's foot, the panel under it" : "no stub"}`,
          seen.stub === stub && (!stub || Math.abs(seen.panelTop - h) < 1.5), JSON.stringify(seen));
      }
      if (stub && seen.stub) {
        /* The stub's arrow taken hold of: the page scrolled to its foot, the
           panel filling the screen — the whole of it, or as much as there is
           room for where it is the taller. */
        await page.click(".layout-stub");
        await page.waitForTimeout(1200);
        const panel = await page.evaluate(() => {
          const box = document.querySelector(".side-column").getBoundingClientRect();
          const page = document.scrollingElement;
          return { top: box.top, bottom: box.bottom, height: window.innerHeight, left: page.scrollHeight - page.scrollTop - page.clientHeight };
        });
        check(`${at}: the stub's arrow scrolls down to the panel`,
          panel.left < 1.5 && panel.bottom <= panel.height && panel.top < panel.height / 2, JSON.stringify(panel));
        /* And scrolling switched off, in the Manage tab: everything in the window, the stub gone. */
        const fitted = await page.evaluate(async () => {
          const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
          document.querySelector("#tab-manage")?.click();
          await sleep(300);
          const toggle = document.querySelector("#allow-scrolling");
          if (toggle === null) {
            return { toggle: false };
          }
          toggle.click();
          await sleep(800);
          const panel = document.querySelector(".side-column").getBoundingClientRect();
          return {
            toggle: true,
            over: document.scrollingElement.scrollHeight - window.innerHeight,
            stub: document.querySelector(".layout-stub") !== null,
            panelBottom: panel.bottom + window.scrollY,
            height: window.innerHeight,
          };
        });
        check(`${at}: scrolling switched off, everything in the window and no stub`,
          fitted.toggle && fitted.over <= 0 && !fitted.stub && fitted.panelBottom <= fitted.height + 0.5, JSON.stringify(fitted));
      }
      await page.close();
    }
    /* The page scrolling, two boards over the panel: the panel as tall as its
       tallest tab, whichever is open, and nothing in it scrolling of its own.
       At 1920 × 1080, where two boards make the page scroll: at 1400 × 950
       the panel's least height fits under them since its text is smaller. */
    {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await page.goto(`http://127.0.0.1:${PORT}/?layout=debug`);
      await page.waitForTimeout(1500);
      const seen = [];
      for (const tab of ["tab-game", "tab-manage", "tab-rays", "tab-balance", "tab-gif"]) {
        await page.click(`#${tab}`);
        await page.waitForTimeout(600);
        seen.push(await page.evaluate((tab) => {
          const side = document.querySelector(".side-column");
          const inner = [side, ...side.querySelectorAll("*")].filter((element) => {
            const style = getComputedStyle(element);
            return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
          });
          return {
            tab,
            natural: document.querySelector(".app").classList.contains("app-panel-natural"),
            scrolling: inner.map((element) => element.className),
            page: document.scrollingElement.scrollHeight,
            tabbed: Math.round(document.querySelector(".tabbed").getBoundingClientRect().height),
            panel: Math.round(side.getBoundingClientRect().height),
          };
        }, tab));
      }
      check("1920 × 1080, two boards: the page scrolls",
        seen.every((tab) => tab.natural), JSON.stringify(seen.map(({ tab, natural, page }) => ({ tab, natural, page }))));
      check("and nothing in the panel scrolls, on any tab",
        seen.every((tab) => tab.scrolling.length === 0), JSON.stringify(seen));
      check("and the page as long whichever tab is open, the panel as tall as the tallest of them",
        seen.every((tab) => tab.page === seen[0].page && tab.panel === seen[0].panel) &&
          Math.abs(Math.max(...seen.map((tab) => tab.tabbed)) - seen[0].panel) <= 2,
        JSON.stringify(seen));
      await page.close();
    }

    /* The text in proportion to the window: the same shape twice the size, twice the text. */
    const fontAt = async (w, h) => {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(`http://127.0.0.1:${PORT}/?layout=computed`);
      await page.waitForTimeout(1200);
      const size = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      await page.close();
      return size;
    };
    const [once, twice] = [await fontAt(1400, 950), await fontAt(2800, 1900)];
    check("the text in proportion to the window: 16px at 1400 × 950, twice that at twice the size",
      Math.abs(once - 16) < 0.01 && Math.abs(twice - 32) < 0.01, `${once}px, ${twice}px`);
  } finally {
    await browser.close();
  }
}

server.close();
process.exit(summary() ? 0 : 1);
