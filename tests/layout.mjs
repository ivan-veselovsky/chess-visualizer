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
  /* A phone, two boards, the page scrolling: one over the other, and the
     panel under them past the window's foot — scrolling down costs less
     than across, see `LayoutParams`. */
  { w: 360, h: 800, boards: 2, expect: "below", column: true },
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
  /* The room the page has, as the app measured it: the window less its scrollbar's gutter. */
  const room = document.querySelector(".layout-window").getBoundingClientRect();
  return {
    room: { w: room.width, h: room.height },
    wide: document.scrollingElement.scrollWidth - document.documentElement.clientWidth,
    across: document.documentElement.classList.contains("layout-scrolls-across"),
    panelLeft: document.querySelector(".side-column").getBoundingClientRect().left,
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
    /* What the tabs were measured to need: see `usePanelLeast`. */
    leastBelow: Number(document.querySelector(".tabbed").dataset.leastBelow),
    leastRight: document.querySelector(".tabbed").dataset.leastRight === "none" ? null : Number(document.querySelector(".tabbed").dataset.leastRight),
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
      check(`${at}: no wider than the window, unless the layout runs it on across, and every region where it was computed`,
        (seen.wide <= 0 || seen.across) && seen.off.length === 0 && seen.boards === boards,
        JSON.stringify(seen));
      if (expect !== null) {
        check(`${at}: the panel ${expect === "right" ? "beside the boards" : "under them"}${column ? ", the boards one over the other" : ""}`,
          seen.panel === expect && (column === undefined || seen.column === column), JSON.stringify(seen));
      }
      /*
        The panel's text at the size the layout gave it — its own, smaller
        than the page's on a large screen — and the panel the room its tabs
        were measured to need: so wide, where it stands beside the boards, and
        so tall, where it is under them, the page scrolling as it may here.

        For the room the page has, which is the window less a scrollbar's
        gutter where the browser keeps one.
      */
      const { room } = seen;
      const sizes = inPixels(layout({ aspect: room.h / room.w, scrollable: true, boards, bars: 0, minEm: minEmFor(room.w), scale: scaleFor(room.w, room.h) }), room.w);
      const text = { panelFont: seen.panelFont, tabFont: seen.tabFont, root: seen.font, charPx: seen.charPx, linePx: seen.linePx };
      check(`${at}: the panel's text at the size the layout gave it, ${sizes.settingsEm.toFixed(2)}px`,
        Math.abs(seen.panelFont - sizes.settingsEm) < 0.05 && Math.abs(seen.tabFont - sizes.settingsEm) < 0.05,
        JSON.stringify(text));
      if (seen.panel === "right") {
        check(`${at}: the panel beside the boards as wide as its tabs were measured to need, at least`,
          seen.leastRight !== null && seen.panelW >= seen.leastRight - 1, `${seen.panelW.toFixed(1)}px for ${seen.leastRight}px`);
      }
      if (seen.panel === "below") {
        check(`${at}: the panel under the boards as tall as its tabs were measured to need, at least`,
          seen.panelH >= seen.leastBelow - 1, `${seen.panelH.toFixed(1)}px for ${seen.leastBelow}px`);
      }
      /* Where the case says: elsewhere a stub comes and goes with how tall the tabs are. */
      if (stub !== undefined) {
        check(`${at}: ${stub ? "a stub at the window's edge, the panel past it" : "no stub"}`,
          seen.stub === stub && (!stub || (seen.across ? Math.abs(seen.panelLeft - w) < 1.5 : Math.abs(seen.panelTop - h) < 1.5)), JSON.stringify(seen));
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
          return {
            across: document.documentElement.classList.contains("layout-scrolls-across"),
            top: box.top, bottom: box.bottom, height: window.innerHeight,
            right: box.right, width: window.innerWidth,
            left: page.scrollHeight - page.scrollTop - page.clientHeight,
            leftAcross: page.scrollWidth - page.scrollLeft - page.clientWidth,
          };
        });
        check(`${at}: the stub's arrow scrolls to the panel`,
          panel.across
            ? panel.leftAcross < 1.5 && panel.right <= panel.width + 0.5
            : panel.left < 1.5 && panel.bottom <= panel.height && panel.top < panel.height / 2,
          JSON.stringify(panel));
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
            over: Math.max(document.scrollingElement.scrollHeight - window.innerHeight, document.scrollingElement.scrollWidth - window.innerWidth),
            stub: document.querySelector(".layout-stub") !== null,
            panelBottom: panel.bottom + window.scrollY,
            height: window.innerHeight,
          };
        });
        check(`${at}: scrolling switched off, everything in the window and no stub`,
          fitted.toggle && fitted.over <= 0 && !fitted.stub && fitted.panelBottom <= fitted.height + 0.5, JSON.stringify(fitted));
      }
      /*
        Nothing in the panel wider than it, whichever tab is open: the
        selected tab's fillet, drawn past the panel's side where the tab stood
        at the end of a full strip, gave the panel a scrollbar of the few
        pixels it reached beyond. And the last tab where that fillet takes it
        to be: flush with the panel's side where the row is full, and the
        fillet left out; a fillet's width or more short of it where it is not.
      */
      const across = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
        const side = document.querySelector(".side-column");
        const tabs = [...document.querySelectorAll('.tab-bar > [role="tab"]')];
        const wider = [];
        for (const tab of tabs) {
          tab.click();
          await sleep(150);
          if (side.scrollWidth > side.clientWidth) {
            wider.push(`${tab.id}: ${side.scrollWidth - side.clientWidth}px`);
          }
        }
        return {
          wider,
          full: document.querySelector(".tab-bar").classList.contains("tab-bar-full"),
          lastShort: side.getBoundingClientRect().right - tabs.at(-1).getBoundingClientRect().right,
          fillet: getComputedStyle(tabs.at(-1), "::after").display,
          rows: new Set(tabs.map((tab) => Math.round(tab.getBoundingClientRect().top))).size,
        };
      });
      check(`${at}: nothing in the panel wider than it, on any tab, and the last tab ${across.full ? "flush with its side, no fillet" : "a fillet's width or more short of it"}`,
        across.wider.length === 0 &&
          (across.full ? Math.abs(across.lastShort) < 0.5 && across.fillet === "none" : across.lastShort >= 6 && across.fillet !== "none"),
        JSON.stringify(across));
      /* And the strip on one line: wrapped, it costs the selected tab its join to the panel. */
      check(`${at}: the tabs in one row`, across.rows === 1, JSON.stringify(across));
      await page.close();
    }
    /*
      The tabs in one row in fonts other than this machine's own: the panel
      is as wide as so many average characters of its text, and the tabs are
      words of their own, which one font sets in fewer of its characters and
      another in more — DejaVu and Liberation, which a Linux machine without
      Noto draws `system-ui` in. The panel's least width is measured with the
      row on one line, in whatever font there is. A font the machine does not
      have falls back to its own, and is a check of that instead.
    */
    for (const font of ["DejaVu Sans", "Liberation Sans"]) {
      const page = await browser.newPage({ viewport: { width: 2150, height: 1004 } });
      await page.route("**/*", async (route) => {
        if (route.request().resourceType() !== "document") {
          return route.continue();
        }
        const response = await route.fetch();
        const body = (await response.text()).replace("<head>", `<head><style>:root { font-family: "${font}" !important; }</style>`);
        return route.fulfill({ response, body });
      });
      await page.goto(`http://127.0.0.1:${PORT}/`);
      await page.waitForTimeout(1500);
      const seen = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
        const side = document.querySelector(".side-column");
        const tabs = [...document.querySelectorAll('.tab-bar > [role="tab"]')];
        const wider = [];
        for (const tab of tabs) {
          tab.click();
          await sleep(150);
          if (side.scrollWidth > side.clientWidth) {
            wider.push(`${tab.id}: ${side.scrollWidth - side.clientWidth}px`);
          }
        }
        return {
          panel: document.querySelector(".app").classList.contains("app-panel-right") ? "right" : "below",
          width: side.getBoundingClientRect().width,
          rows: new Set(tabs.map((tab) => Math.round(tab.getBoundingClientRect().top))).size,
          wider,
        };
      });
      check(`2150 × 1004 in ${font}: the tabs in one row, and nothing in the panel wider than it`,
        seen.rows === 1 && seen.wider.length === 0, JSON.stringify(seen));
      await page.close();
    }

    /* The page scrolling, two boards and the panel beside them past the
       window's right edge — scrolling across made free and down dear in this
       browser, see `layoutParams`; at the costs it comes with, the page fits:
       the panel as wide as its tabs were measured to need, whichever is
       open, and nothing in it scrolling of its own but the lists, which do
       by design. */
    {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await page.addInitScript(() => localStorage.setItem("cv.layout-params", JSON.stringify({ scroll: 0, down: 10, across: 0 })));
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
            return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1 &&
              !element.matches(".games-scroll, .presets-scroll");
          });
          return {
            tab,
            scrolls: document.scrollingElement.scrollWidth > window.innerWidth && document.scrollingElement.scrollHeight <= window.innerHeight,
            scrolling: inner.map((element) => element.className),
            page: document.scrollingElement.scrollWidth,
            least: Number(document.querySelector(".tabbed").dataset.leastRight),
            panel: Math.round(side.getBoundingClientRect().width),
          };
        }, tab));
      }
      check("1920 × 1080, two boards: the page scrolls across, and only across",
        seen.every((tab) => tab.scrolls), JSON.stringify(seen.map(({ tab, scrolls, page }) => ({ tab, scrolls, page }))));
      check("and nothing in the panel scrolls, on any tab",
        seen.every((tab) => tab.scrolling.length === 0), JSON.stringify(seen));
      check("and the page as wide whichever tab is open, the panel as wide as its tabs were measured to need",
        seen.every((tab) => tab.page === seen[0].page && tab.panel === seen[0].panel) && Math.abs(seen[0].panel - seen[0].least) <= 1,
        JSON.stringify(seen));
      await page.close();
    }

    /*
      The panel's invariants, on every tab, in windows from a phone's to a
      large monitor's, one board and two, scrolling allowed and not — the
      1450 × 995 window among them, where two boards and a guessed least
      height once left the presets' block a box of no height, its rows drawn
      over the blocks under it.

      A, scrolling off: the page never scrolls, either way, and a tab scrolls
      of its own only where the layout set it to — its text at the least
      there is, and the tabs fitting at nothing down to it.
      B, scrolling on: no tab scrolls of its own.
      E: the boards, their bars and their rows cover half the square on the
      shorter side of the room under the header, at least.
      F: the page scrolls one way at most.
      In all, nothing in a tab drawn over what follows it, and nothing wider
      than the panel. The Live tab's list of games scrolls by design, and is
      left out. And the bars of men beside the boards drawn to their scale.
    */
    for (const [w, h] of [[1450, 995], [1280, 800], [1400, 950], [1920, 1080], [820, 1180], [360, 640], [390, 844], [2560, 1080]]) {
      for (const boards of [1, 2]) {
        for (const scroll of [true, false]) {
          const context = await browser.newContext({ viewport: { width: w, height: h } });
          await context.addInitScript(([scroll, two]) => {
            localStorage.setItem("cv.allow-scrolling", scroll ? "on" : "off");
            localStorage.setItem("cv.two-board", two ? "on" : "off");
          }, [scroll, boards === 2]);
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (error) => errors.push(String(error)));
          await page.goto(`http://127.0.0.1:${PORT}/`);
          await page.waitForTimeout(1500);
          const tabs = await page.evaluate(() => [...document.querySelectorAll('.tab-bar > [role="tab"]')].map((tab) => tab.id));
          const broken = [];
          /* The bars of men to the boards' scale: both of them up — the bar
             of men still standing full, as a game opens — each a third of a
             square across, and what is in it within the board's height,
             however small the board. */
          for (const id of tabs) {
            await page.click(`#${id}`);
            if ((await page.$("#show-available-pieces")) !== null) {
              await page.check("#show-taken-pieces");
              await page.check("#show-available-pieces");
              break;
            }
          }
          await page.waitForTimeout(300);
          const bars = await page.evaluate(() => {
            const board = document.querySelector(".boards > .board-holder").getBoundingClientRect();
            return [...document.querySelectorAll(".men-bar")].map((bar) => {
              const column = bar.querySelector(".men-bar-column").getBoundingClientRect();
              const groups = [...bar.querySelectorAll(".men-bar-group")].map((group) => group.getBoundingClientRect());
              return {
                share: bar.getBoundingClientRect().width / board.width,
                over: Math.max(0, ...groups.map((group) => Math.max(column.top - group.top, group.bottom - column.bottom))),
                men: bar.querySelectorAll(".men-bar-piece").length,
              };
            });
          });
          if (bars.length !== 2 || bars.every((bar) => bar.men === 0)) broken.push(`bars: ${bars.length} up, ${bars.map((bar) => bar.men).join(" and ")} men in them`);
          for (const bar of bars) {
            if (Math.abs(bar.share - 64 / 536 / 3) > 0.003) broken.push(`a bar ${bar.share.toFixed(4)} of the board's side across`);
            if (bar.over > 1) broken.push(`a bar's men ${Math.round(bar.over)}px past the board's height`);
          }
          for (const id of tabs) {
            await page.click(`#${id}`);
            await page.waitForTimeout(150);
            const seen = await page.evaluate(() => {
              const tabbed = document.querySelector(".tabbed");
              const panel = document.querySelector(".tab-panel:not(.tab-panel-measure):not([hidden])");
              /* Whether the layout set the panel's tabs to scroll: on a page that
                 may not, at the least text there is, where they fit at nothing. */
              const given = tabbed.dataset.panelScrolls !== "true";
              /* E: the boards, bars and rows against half the square on the
                 shorter side of the room under the header. */
              const group = document.querySelector(".board-pane").getBoundingClientRect();
              const header = document.querySelector(".app-header").getBoundingClientRect();
              const gap = (name) => parseFloat(getComputedStyle(document.querySelector(".app")).getPropertyValue(`--lay-gap-${name}`));
              const room = Math.min(header.width, window.innerHeight - header.bottom - gap("under-header") - gap("page-bottom"));
              /* A block whose content runs into the next, in any column of the tab. */
              let over = null;
              for (const column of [panel, ...panel.querySelectorAll(".settings-panel, .games-panel")]) {
                const blocks = [...column.children].filter((block) => getComputedStyle(block).position !== "absolute" && block.getBoundingClientRect().height > 0);
                for (let at = 0; at + 1 < blocks.length; at += 1) {
                  const [one, next] = [blocks[at], blocks[at + 1]];
                  const bottom = one.getBoundingClientRect().top + Math.max(one.scrollHeight, one.getBoundingClientRect().height);
                  if (getComputedStyle(one).overflowY === "visible" && bottom > next.getBoundingClientRect().top + 1) {
                    over = `${one.className.split(" ")[0]} ${Math.round(bottom - next.getBoundingClientRect().top)}px over ${next.className.split(" ")[0]}`;
                  }
                }
              }
              return {
                tab: panel.id.replace("panel-", ""),
                given,
                pageScrolls: document.scrollingElement.scrollHeight > window.innerHeight + 1 || document.scrollingElement.scrollWidth > window.innerWidth + 1,
                bothWays: document.scrollingElement.scrollHeight > window.innerHeight + 1 && document.scrollingElement.scrollWidth > window.innerWidth + 1,
                groupArea: group.width * group.height,
                floor: 0.5 * room * room,
                tabScrolls: panel.scrollHeight > panel.clientHeight + 1 ? `${panel.clientHeight} of ${panel.scrollHeight}px shown` : null,
                wider: panel.scrollWidth > panel.clientWidth + 1 ? `${panel.scrollWidth - panel.clientWidth}px` : null,
                over,
              };
            });
            if (seen.over !== null) broken.push(`${seen.tab}: ${seen.over}`);
            if (seen.wider !== null) broken.push(`${seen.tab}: ${seen.wider} wider than the panel`);
            if (!scroll && seen.pageScrolls) broken.push(`${seen.tab}: A, the page scrolls`);
            if (seen.bothWays) broken.push(`${seen.tab}: F, the page scrolls both ways`);
            if (seen.groupArea < seen.floor * 0.995) broken.push(`${seen.tab}: E, the boards' group ${Math.round(seen.groupArea)}px² under ${Math.round(seen.floor)}`);
            if (seen.tab !== "match" && seen.tabScrolls !== null && (scroll || seen.given)) {
              broken.push(`${seen.tab}: ${scroll ? "B" : "A"}, the tab scrolls, ${seen.tabScrolls}`);
            }
          }
          check(`${w} × ${h}, ${boards === 2 ? "two boards" : "one board"}, scrolling ${scroll ? "on" : "off"}: the panel's invariants on every tab`,
            broken.length === 0 && errors.length === 0, [...broken, ...errors].join(" | "));
          await context.close();
        }
      }
    }

    /*
      A game with a variation, loaded where the panel is under the boards, and
      the window then made wide: the panel back beside the boards. The Line
      list fits its labels to its own width, which under the boards is the
      page's; read as though it were the library's names, those labels said no
      narrower panel showed them whole, the panel never went back beside the
      boards, and two boards on a 1918 × 1077 screen were a few squares wide.
    */
    {
      const context = await browser.newContext({ viewport: { width: 1000, height: 1077 } });
      await context.addInitScript(() => {
        localStorage.setItem("cv.allow-scrolling", "off");
        localStorage.setItem("cv.two-board", "on");
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/`);
      await page.waitForTimeout(1500);
      await page.click("#tab-game");
      await page.evaluate(async (pgn) => {
        const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
        [...document.querySelectorAll("button")].find((button) => /import game/i.test(button.textContent)).click();
        await sleep(400);
        const text = document.querySelector("#pgn-text");
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(text, pgn);
        text.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(200);
        [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Load").click();
        await sleep(900);
      }, "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 " +
        "11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 (13... Bxc3 14. Nxc3 O-O 15. Rad1 d6 16. exd6 cxd6 17. Bxd6 Rd8 18. Bxe7 Nxe7 " +
        "19. Rxe7 Qxg2+ 20. Kxg2 Bh3+) 14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3 " +
        "20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0");
      const before = await page.evaluate(() => document.querySelector(".app").classList.contains("app-panel-right"));
      await page.setViewportSize({ width: 1918, height: 1077 });
      await page.waitForTimeout(1200);
      const after = await page.evaluate(() => ({
        right: document.querySelector(".app").classList.contains("app-panel-right"),
        board: Math.round(document.querySelector(".boards > .board-holder").getBoundingClientRect().width),
        least: document.querySelector(".tabbed").dataset.leastRight,
      }));
      check("a game with a variation loaded, the window then widened to 1918 × 1077: the panel beside the boards, and they large",
        after.right && after.board > 600, JSON.stringify({ before, ...after }));
      await context.close();
    }

    /* The text in proportion to the window: 16px at 1400 × 950, and in
       proportion to the root of the area elsewhere — the same shape twice the
       size, twice the text. Of the room the page has, the window less a
       scrollbar's gutter where the browser keeps one: 1385 × 950 is a hair
       under 16px. */
    const fontAt = async (w, h) => {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(`http://127.0.0.1:${PORT}/?layout=computed`);
      await page.waitForTimeout(1200);
      const seen = await page.evaluate(() => {
        const room = document.querySelector(".layout-window").getBoundingClientRect();
        return { size: parseFloat(getComputedStyle(document.documentElement).fontSize), room: [room.width, room.height] };
      });
      await page.close();
      return { ...seen, asked: 16 * scaleFor(...seen.room) };
    };
    const [once, twice] = [await fontAt(1400, 950), await fontAt(2800, 1900)];
    check("the text in proportion to the window: 16px at 1400 × 950, twice that at twice the size",
      Math.abs(once.size - once.asked) < 0.01 && Math.abs(twice.size - twice.asked) < 0.01, JSON.stringify([once, twice]));
  } finally {
    await browser.close();
  }
}

/*
  A screen drawn at 1.25 device pixels to the CSS one — a desktop scaled to
  125%, or a page zoomed to it — where a window is most often a fraction of a
  CSS pixel off a whole number of them: the page that fits the window as tall
  as it, exactly. Laid out for `innerHeight`, which rounds, it was a fifth of
  a pixel taller where the rounding went up, and Chrome gave it a scrollbar
  for that.

  And with scrollbars that take room, as Chrome's on Linux and Windows do:
  a page that fits as wide as the window, with no stripe kept down its edge
  for a scrollbar it never has; and one that scrolls laid out beside its
  scrollbar, and staying so — not narrowed by it into fitting, losing it, and
  widening again.

  Chromium alone: the one whose window can be sized here in device pixels,
  rather than handed a viewport in whole CSS ones.
*/
{
  console.log("\nAt 1.25 device pixels to the CSS one, in Chromium\n");
  const browser = await chromium.launch({ args: ["--force-device-scale-factor=1.25"], ignoreDefaultArgs: ["--hide-scrollbars"] });
  try {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    const sized = async (w, h) => {
      await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: w, height: h } });
      await page.waitForTimeout(400);
    };
    const look = () => page.evaluate(() => {
      const app = document.querySelector(".app").getBoundingClientRect();
      const page = document.scrollingElement;
      const at = [window.scrollX, window.scrollY];
      window.scrollTo(1e6, 1e6);
      const scrolled = [window.scrollX, window.scrollY];
      window.scrollTo(...at);
      return {
        window: [visualViewport.width, visualViewport.height],
        inner: [window.innerWidth, window.innerHeight],
        page: [app.width, app.height],
        fits: document.querySelector(".app").classList.contains("app-fits"),
        scrollbar: window.innerWidth - visualViewport.width,
        scrolled,
        wide: page.scrollWidth - page.clientWidth,
      };
    });
    /* Scrolling switched off, so that every one of these windows is one the page fits. */
    const scrolling = (on) => page.evaluate((on) => window.localStorage.setItem("cv.allow-scrolling", on ? "on" : "off"), on);
    await page.goto(`http://127.0.0.1:${PORT}/?layout=computed`);
    await scrolling(false);
    await page.reload();
    await page.waitForTimeout(1500);
    /* A laptop's 1920 × 1080 at 125%, give or take: heights through a whole five-pixel round of fractions, two widths. */
    const windows = [1536, 1535].flatMap((w) => [755, 756, 757, 758, 759, 760, 761, 762, 763, 764].map((h) => [w, h]));
    const seen = [];
    for (const [w, h] of windows) {
      await sized(w, h);
      seen.push({ asked: [w, h], ...(await look()) });
    }
    const off = seen.filter((one) =>
      !one.fits || one.scrolled[0] !== 0 || one.scrolled[1] !== 0 || one.wide > 0 ||
      Math.abs(one.page[1] - one.window[1]) > 0.01);
    check(`${windows.length} windows at 1.25: the page the window's height exactly, and not scrolling`,
      off.length === 0, JSON.stringify(off.length === 0 ? seen : off));
    check("among them windows whose `innerHeight` rounds up, as the page's height once did",
      seen.some((one) => one.inner[1] > one.window[1] + 0.01), JSON.stringify(seen.map((one) => [one.window[1], one.inner[1]])));
    /* The window's whole width, give or take the fifth of a pixel a window in device pixels is off its size in CSS ones. */
    const striped = seen.filter((one) => one.scrollbar > 0.01 || Math.abs(one.page[0] - one.asked[0]) > 0.25);
    check("and as wide as the window: no room kept for a scrollbar it does not have",
      striped.length === 0, JSON.stringify(striped.length === 0 ? seen.map((one) => [one.asked[0], one.page[0]]) : striped));

    /* Scrolling on, and a window two boards make the page run past the foot of: 1920 × 1080 at 125%, scrolling made free in this browser. */
    await scrolling(true);
    await page.evaluate(() => window.localStorage.setItem("cv.layout-params", JSON.stringify({ scroll: 0, down: 0, across: 0 })));
    await page.reload();
    await sized(1536, 864);
    await page.waitForTimeout(1100);
    const first = await look();
    await page.waitForTimeout(1500);
    const then = await look();
    /* Down, with the scrollbar beside it and the page laid out for the width
       left; or across, with the scrollbar along its foot and the page laid
       out for the height over it — whichever is worth the more. */
    const down = first.scrolled[1] > 0;
    check("1536 × 864 at 1.25, scrolling: the page scrolls one way, with a scrollbar, laid out beside it or over it",
      !first.fits && down !== first.scrolled[0] > 0 &&
        (down
          ? first.scrollbar > 1 && first.wide <= 0 && Math.abs(first.page[0] - first.window[0]) < 0.01
          : first.inner[1] - first.window[1] > 1 && first.wide > 0 && Math.abs(first.page[1] - first.window[1]) < 0.01),
      JSON.stringify(first));
    check("and stays so, rather than laid out over and over",
      JSON.stringify(then.page) === JSON.stringify(first.page) && then.fits === first.fits, JSON.stringify([first, then]));
  } finally {
    await browser.close();
  }
}

server.close();
process.exit(summary() ? 0 : 1);
