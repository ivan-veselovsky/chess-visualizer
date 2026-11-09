import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { DEFAULT_POSITION } from "chess.js";
import { BUILD_INFO } from "./buildInfo";
import { note } from "./friend/log";
import { Lru, needsAt, POINT_REACH, pointNear, ROW_WIDTHS, rowSizesFor, withPoint, withWidth, type NeedsRow, type NeedsTable } from "./panelNeeds";

/**
 * How tall a tab has to come, against the tallest, for a pass that adds to a
 * table to draw it: three quarters, at any width and size of text it was
 * measured at with every tab drawn. The panel is as tall as its tallest tab,
 * and of the eleven only two have ever been that — the Lab tab and the Rays
 * tab, each the other's nearest — the next coming to four fifths of them: so
 * a pass draws those few, the open one, and nothing else, rather than every
 * tab drawn and laid out for nothing, which was most of what a pass took.
 * Every tab is drawn where a row is measured from nothing, and where the
 * tabs have changed: see `drawnFor`.
 */
const TALL_SHARE = 0.75;

/**
 * How long the window has to hold still before the tabs are measured again:
 * a window being dragged is measured once it is let go. Longer than a frame
 * of the drag takes: at 100ms, a busy Firefox took that between one size and
 * the next, and measured the tabs — a few hundred milliseconds more, when a
 * pass drew every one of them — at every size it passed through. 150 since a
 * pass draws only the tabs that stand tall, and is the quicker for it.
 */
const SETTLE_MS = 150;

/**
 * The tab that is allowed to scroll inside the panel, and is left out of what
 * the panel has to hold: the list of games with friends, which is as long as
 * the games are, and is scrolled through on purpose.
 */
const SCROLLS_BY_DESIGN = "panel-match";

/**
 * How much of the starting position's FEN the Lab tab's field has to show:
 * four fifths, most positions being shorter, and a longer one scrolling in
 * the field. The stylesheet sends the field onto a line of its own before it
 * is any narrower — see `.fen-row > .fen-input` — so this binds only where
 * the panel itself is narrower than that.
 */
const FEN_SHOWN = 0.8;

/**
 * The most times the tabs are measured in the room the layout gave the panel,
 * to set its text to what they really fit at there: the table says nearly,
 * and a measure that differs from it says by how much, for the next try. Past
 * this the table is no use, and the tabs scroll at the size the layout chose.
 */
export const MOST_CHECKS = 3;

/** The panel's room before a layout is chosen, in pixels, and the sizes its text may be set at — see `panelRooms` — and the panels to be measured in. */
export interface PanelRoomsPx {
  belowWidth: number;
  /**
   * Where the tabs are to be measured exactly, at the panel's own size of
   * text — see `NeedsTable.points`: under the boards, at the page's width
   * with a scrollbar beside it and without; and beside them, at the width
   * the table says they fit the window's height at.
   */
  points: { width: number; f: number }[];
  rightHeight: number;
  rightMost: number;
  /** The least the panel's text may be set at, and its own size, in pixels: the table is to be read between them. */
  leastText: number;
  ownText: number;
  /**
   * The panel the layout chose, where its tabs are to show whole in it, at
   * the size of text it chose — by its name, see `checkKey` — for the tabs
   * to be measured in: see `PanelMeasuredPx.checks`. None where nothing is
   * to be measured, the tabs scrolling there whatever.
   */
  checks: CheckRoomPx[];
  /**
   * The panels the layout would choose with another table, to be measured in
   * instead: where a pass adds to the table, the layout chosen without what
   * it added is about to be chosen again with it, and its panel is the one
   * to check — in the same pass, rather than in a pass of its own once the
   * page has been laid out again, every tab drawn and measured twice.
   */
  checksFor: (table: NeedsTable) => CheckRoomPx[];
}

/** A panel to be measured in: its name — see `checkKey` — its room, in pixels, and the size of text the layout chose for it. */
export interface CheckRoomPx {
  key: string;
  w: number;
  h: number;
  f: number;
}

/** What the tabs were measured in a panel to fit at: the size of text, in pixels; whether they show whole at it; and how many measures that took. */
export interface CheckPx {
  f: number;
  fits: boolean;
  tries: number;
}

/** What has been measured: the table — see `panelNeeds` — and the checks asked, by their names. */
export interface PanelMeasuredPx {
  table: NeedsTable | null;
  checks: Record<string, CheckPx>;
}

/** The name a panel and its text are measured under: the room to the pixel, the text to the hundredth of one. */
export function checkKey(w: number, h: number, f: number): string {
  return `${Math.floor(w)}x${Math.floor(h)}@${f.toFixed(2)}`;
}

/**
 * What has been measured, kept for the session and shared by every render:
 * the tables, by whether the fonts were in when they were measured, with
 * the widths each row took beyond its own in the order they were added; and
 * the checks, by the same and the room. Each at most so many, the one used
 * longest ago dropped for another.
 */
const TABLES_KEPT = 4;
/**
 * A table, with the widths each row took beyond its own in the order they
 * were added, and the tabs that stand tall enough to be drawn in a pass that
 * adds to it: see `TALL_SHARE`. Undefined until a pass drew them all.
 */
interface Kept {
  table: NeedsTable;
  added: Map<number, number[]>;
  tall?: string[];
}
const tables = new Lru<string, Kept>(TABLES_KEPT);
const checked = new Lru<string, CheckPx>(512);

/**
 * And the tables kept in the browser as well, for the next time the page is
 * opened, which then measures only what its window adds: the same tables at
 * every window, so a page opened again need not measure them again. For this
 * build only — another may draw the tabs otherwise — and only those measured
 * with the fonts in. The same few `TABLES_KEPT` at most, small: a few rows of
 * a few dozen numbers each.
 */
const STORED_KEY = "cv.panel-needs";

/** The tables as stored: Infinity, which JSON has not got, as null, and each row's widths added as a list. */
type StoredTables = { build: string; tables: [string, { table: NeedsTable; added: [number, number[]][]; tall?: string[] }][] };

(function loadStored() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORED_KEY) ?? "null") as StoredTables | null;
    if (stored === null || stored.build !== BUILD_INFO.built || !Array.isArray(stored.tables)) {
      return;
    }
    for (const [content, { table, added, tall }] of stored.tables.slice(-TABLES_KEPT)) {
      const rows = table.rows.map((row) => ({ ...row, uncut: row.uncut === null ? Infinity : row.uncut }));
      tables.set(content, { table: { rows, points: table.points }, added: new Map(added), tall: Array.isArray(tall) ? tall : undefined });
    }
  } catch {
    /* Nothing kept, or nothing readable: measured afresh, as on the first visit. */
  }
})();

/** The tables measured with the fonts in, written to the browser — see `STORED_KEY` — oldest first, as they are to be read back. */
function storeTables(): void {
  try {
    const kept: StoredTables["tables"] = [];
    for (const [content, { table, added, tall }] of tables.all()) {
      if (content === "true") {
        kept.push([content, { table, added: [...added.entries()], tall }]);
      }
    }
    window.localStorage.setItem(STORED_KEY, JSON.stringify({ build: BUILD_INFO.built, tables: kept }));
  } catch {
    /* A browser refusing storage measures the tables again next time; nothing else is lost. */
  }
}

/** How the checks have gone this session, for the log and for the tests: see `MOST_CHECKS`. */
export const checkStats = { checks: 0, tries: 0, most: 0, unfitted: 0 };

/**
 * What the panel of tabs needs, measured: a table of how tall the tabs are
 * at each of a few widths, at each of a few sizes of their text — see
 * `panelNeeds` — that the layout reads at every panel it tries; and the
 * panel it chose measured itself, at most `MOST_CHECKS` times, for its text
 * to be set to what the tabs really fit at there.
 *
 * Measured rather than guessed, as the tabs are text in the machine's own
 * font, set at a size the window decides, and wrapped as the width allows —
 * and held up by a browser's own least font size, where it has one, which
 * nothing but a measure shows. The same at every window and every zoom: so
 * a row of the table, once measured, is kept for the session, and only the
 * width the panel has under the boards — the page's — is measured again for
 * each window, as a width more in the rows asked for.
 *
 * Every tab is drawn for it: most are not there to be measured, only the open
 * one being drawn and the two kept while hidden having no height. So there is
 * a pass in which every tab is drawn — the ones not open out of the flow,
 * unseen, inert — and measured with the panel's column set to each width and
 * text size in turn, its lists at their floors, and everything then put back,
 * all before the browser paints: `measuring` says when, and the page draws
 * them while it is true. Only where something is to be measured: where it all
 * has been, what was is said at once.
 *
 * Measured when the room changes, once the window holds still; when the fonts
 * have loaded; and when `version` changes, which the page moves when a tab
 * arrives that was not there to be measured — at once the first time. And at
 * once, too, where only the panel the layout chose changed, the window as it
 * was. Not when what is in a tab changes: the boards would change size every
 * time a game was read in or a setting opened a row, and a page that moves
 * under the reader's hand is worse than a tab that scrolls, now and then,
 * until the window is next resized.
 *
 * `onMeasured` is told what was measured, and says it in the log: see `note`.
 */
export function usePanelLeast(
  rooms: PanelRoomsPx | null,
  version: number,
  onMeasured: (measured: PanelMeasuredPx) => void
): { tabbed: RefObject<HTMLDivElement | null>; measuring: boolean; drawn: (panelId: string) => boolean } {
  const tabbed = useRef<HTMLDivElement>(null);
  /* Whether a pass is on, and which tabs it draws: every one, or the tall ones. See `TALL_SHARE`. */
  const [measuring, setMeasuring] = useState<Drawn | null>(null);
  /* The tabs as they were when the tall ones were last found among them all: a tab come since may be taller. */
  const versionNow = useRef(version);
  versionNow.current = version;
  const tallAt = useRef(version);
  const told = useRef(onMeasured);
  told.current = onMeasured;
  const roomsNow = useRef(rooms);
  roomsNow.current = rooms;
  const measuredOnce = useRef(false);
  /* The fonts, once they have loaded: a measure taken in a stand-in is not one of the real thing. */
  const [fontsIn, setFontsIn] = useState(false);
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) {
        setFontsIn(true);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  /* What the table is kept by: the fonts in or not — while they are on
     their way, the table measured with them in, where one was kept from
     before, rather than one measured in a stand-in. Not the tabs that have
     arrived: the one that comes late, the GIF tab, is never the tallest.
     Then the window's room, and the panels to be checked as well. */
  const content = fontsIn || tables.get("true") !== undefined ? "true" : "false";
  const contentNow = useRef(content);
  contentNow.current = content;
  const windowKey =
    rooms === null
      ? null
      : `${content} ${version} ${Math.floor(rooms.belowWidth)} ${Math.floor(rooms.rightMost)} ${rooms.leastText.toFixed(2)} ${rooms.ownText.toFixed(2)}`;
  const key = windowKey === null || rooms === null ? null : `${windowKey} ${rooms.checks.map(({ key: room }) => room).join(",")}`;
  const windowNow = useRef(windowKey);
  windowNow.current = windowKey;
  const measuredFor = useRef<string | null>(null);

  /* The first time before anything is painted, so the page never shows the
     guess; after that once the window has held still — or at once, where it
     is the window last measured. And where nothing is left to measure, what
     was, at once, with no pass. */
  useLayoutEffect(() => {
    if (key === null || rooms === null) {
      return;
    }
    const kept = known(content, rooms);
    if (kept !== null) {
      told.current(kept);
      return;
    }
    /* Looked at again when the time comes: a pass in between may have measured all of it, and a pass that measures nothing still draws the tabs. */
    const pass = () => {
      const now = roomsNow.current === null ? null : known(contentNow.current, roomsNow.current);
      if (now !== null) {
        told.current(now);
        return;
      }
      setMeasuring(drawnFor(contentNow.current, roomsNow.current, versionNow.current === tallAt.current));
    };
    if (!measuredOnce.current || windowKey === measuredFor.current) {
      measuredOnce.current = true;
      pass();
      return;
    }
    const timer = window.setTimeout(pass, SETTLE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` names everything the rest is read from.
  }, [key]);

  /* The pass: drawn by now, the tabs it is to measure, and measured before the paint. */
  useLayoutEffect(() => {
    if (measuring === null) {
      return;
    }
    const root = tabbed.current;
    const room = roomsNow.current;
    measuredFor.current = windowNow.current;
    if (root !== null && room !== null) {
      const measured = measureTabs(root, room, contentNow.current, measuring);
      if (measured !== null) {
        note("the panel of tabs measured", measured.said);
        told.current(measured.measured);
      }
      if (measuring === "all") {
        tallAt.current = versionNow.current;
      }
    }
    setMeasuring(null);
  }, [measuring]);

  const tall = measuring === "tall" ? tables.get(content)?.tall : undefined;
  const drawn = (panelId: string) => measuring === "all" || (measuring === "tall" && tall !== undefined && tall.includes(panelId));
  return { tabbed, measuring: measuring !== null, drawn };
}

/**
 * Which tabs a pass draws to measure: every one, or only those that stand
 * tall — see `TALL_SHARE`. Every one where the table has not got a row the
 * room asks for, which a pass then measures from nothing; where it has not
 * been found yet which tabs stand tall, or the tabs have changed since —
 * `trusted` says not; and where nothing has been measured at all.
 */
type Drawn = "all" | "tall";

function drawnFor(content: string, rooms: PanelRoomsPx | null, trusted: boolean): Drawn {
  const kept = tables.get(content);
  if (kept === undefined || kept.tall === undefined || !trusted || rooms === null) {
    return "all";
  }
  return sizesFor(rooms).every((f) => kept.table.rows.some((row) => row.f === f)) ? "tall" : "all";
}

/** The row sizes a window's room asks for, in pixels: see `rowSizesFor`. */
function sizesFor(rooms: PanelRoomsPx): number[] {
  return rowSizesFor(rooms.leastText, rooms.ownText);
}

/** The width the page gives the panel under the boards, in ems of a row's text: a width more in each, measured for the window. */
function belowIn(row: NeedsRow, rooms: PanelRoomsPx): number {
  return Math.floor(rooms.belowWidth) / row.f;
}

/** The points the room asks to be measured exactly, to the whole pixel: see `PanelRoomsPx.points`. */
function pointsFor(rooms: PanelRoomsPx): { width: number; f: number }[] {
  return rooms.points.map(({ width, f }) => ({ width: Math.floor(width), f }));
}

/**
 * Whether a point the room asks for is in the table, or one near enough to
 * stand for it: within `POINT_REACH` of it in width and in size of text both,
 * as near as a point is to put the rows right — see `pointNear`. Not to the
 * hundredth of a pixel of text: the panel's own size moves with the window's,
 * so that every window, however little it moved, asked for points of its own,
 * each a measure of every tab — most of what a window's pass took. The panel
 * the layout chooses is measured itself, exactly, all the same: see
 * `MOST_CHECKS`.
 */
function hasPoint(table: NeedsTable, width: number, f: number): boolean {
  const near = pointNear(table, width, f);
  return near !== undefined && Math.abs(Math.log(near.f / f)) <= POINT_REACH;
}

/** Whether a row has a width measured near enough to `width` ems to be read between it and the next — as near as a point is to stand for one: see `hasPoint`. */
function hasWidth(row: NeedsRow, width: number): boolean {
  return row.widths.some((at) => Math.abs(Math.log(at / width)) <= POINT_REACH);
}

/** Everything the room asks for, where all of it has been measured already; null where anything has not. */
function known(content: string, rooms: PanelRoomsPx): PanelMeasuredPx | null {
  const kept = tables.get(content);
  if (kept === undefined) {
    return null;
  }
  if (pointsFor(rooms).some(({ width, f }) => !hasPoint(kept.table, width, f))) {
    return null;
  }
  for (const f of sizesFor(rooms)) {
    const row = kept.table.rows.find((each) => each.f === f);
    if (row === undefined || !hasWidth(row, belowIn(row, rooms))) {
      return null;
    }
  }
  const checks: Record<string, CheckPx> = {};
  for (const { key } of rooms.checks) {
    const done = checked.get(`${content} ${key}`);
    if (done === undefined) {
      return null;
    }
    checks[key] = done;
  }
  return { table: kept.table, checks };
}

/** The tabs at one width of the panel, and one size of its text: how tall, and what is cut, if anything. */
interface AtWidth {
  /** The row of tabs and the tallest tab under it, the one scrolling by design left out. */
  height: number;
  /** What is read whole and is not at this width — nothing, where everything is. */
  cut: string | null;
}

/**
 * Every tab measured: drawn already, by the page, for the pass — the rows of
 * the table the room asks for that have not been, the page's width in each,
 * and the panels to be checked. Null where there is no column to set widths
 * on, as there is not where the stylesheet lays the page out.
 */
function measureTabs(
  root: HTMLElement,
  rooms: PanelRoomsPx,
  content: string,
  drawn: Drawn
): { measured: PanelMeasuredPx; said: Record<string, unknown> } | null {
  const column = root.closest<HTMLElement>(".side-column");
  if (column === null) {
    return null;
  }
  const started = performance.now();
  const panels = [...root.querySelectorAll<HTMLElement>(":scope > .tab-panel")];
  const bar = root.querySelector<HTMLElement>(":scope > .tab-bar");
  /* The open tab out of the flow as well, as the others are, for its own
     height rather than the panel's; where it was scrolled to, kept to be put
     back. */
  const lists = [...root.querySelectorAll<HTMLElement>(".games-scroll, .presets-scroll")];
  const scrolled = [...panels, ...lists].map((element) => [element, element.scrollTop] as const);
  const open = panels.filter((panel) => !panel.classList.contains("tab-panel-measure"));
  open.forEach((panel) => panel.classList.add("tab-panel-measure"));
  /* The lists at their floors: they scroll by design, and are as long as what
     they hold — the panel is not to grow with every game and preset. */
  const listHeights = lists.map((list) => [list, list.style.maxHeight] as const);
  lists.forEach((list) => {
    list.style.maxHeight = getComputedStyle(list).minHeight;
  });
  const widthWas = column.style.width;
  const scaleWas = column.style.getPropertyValue("--set-scale");

  /* The panel's text at `f` pixels: its sizes are the page's text times
     `--set-scale`, and the page's text is the root's. */
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  let text = 0;
  const setText = (f: number) => {
    text = f;
    column.style.setProperty("--set-scale", String(f / rootPx));
  };

  /* What is read whole. */
  const fen = root.querySelector<HTMLInputElement>("#fen");
  /* The library's games are in the list of stashed games, under a heading of
     their own: their names, and not the reader's stashes', which are as long
     as a reader made them — nor the Line list's, a line of moves as long as
     the game, which never fits and once put the panel under the boards. */
  const library = root.querySelector<HTMLSelectElement>("#stashed-game");
  const libraryNames = library === null ? [] : [...library.querySelectorAll<HTMLOptionElement>('optgroup[label="Library"] > option')];

  /* How wide those are at each size of text tried; and how wide the library's
     list is with the panel as wide as it can be, which is as wide as it gets
     — it stops short of its longest name where the stylesheet says so. */
  const widths = new Map<number, { fen: number; library: number; widest: number }>();
  const widthsNow = () => {
    let read = widths.get(text);
    if (read === undefined) {
      column.style.width = `${rooms.rightMost}px`;
      read = {
        fen: fen === null ? 0 : textWidth(fen, DEFAULT_POSITION),
        library: library === null ? 0 : Math.max(0, ...libraryNames.map((option) => textWidth(library, option.text))),
        widest: library === null ? Infinity : contentWidth(library),
      };
      widths.set(text, read);
    }
    return read;
  };

  let measures = 0;
  const at = (width: number): AtWidth => {
    const read = widthsNow();
    measures += 1;
    column.style.width = `${width}px`;
    let tallest = 0;
    let wide: string | null = null;
    const heights: [string, number][] = [];
    for (const panel of panels) {
      if (panel.id !== SCROLLS_BY_DESIGN) {
        const height = panel.offsetHeight;
        heights.push([panel.id, height]);
        tallest = Math.max(tallest, height);
      }
      if (wide === null && panel.scrollWidth > panel.clientWidth + 1) {
        wide = `${panel.id.replace("panel-", "")} tab wider than the panel`;
      }
    }
    const tabTops = bar === null ? [] : [...bar.querySelectorAll<HTMLElement>(".tab")].map((tab) => tab.offsetTop);
    const cut =
      tabTops.some((top) => top !== tabTops[0])
        ? "the row of tabs on two lines"
        : fen !== null && contentWidth(fen) < FEN_SHOWN * read.fen - 0.5
          ? "the FEN field under four fifths of the starting FEN"
          : library !== null && contentWidth(library) < Math.min(read.library, read.widest) - 0.5
            ? "a library game's name cut short"
            : wide;
    /* How near the tallest each came, where every tab is drawn: see `TALL_SHARE`. */
    if (drawn === "all" && tallest > 0) {
      for (const [id, height] of heights) {
        shares.set(id, Math.max(shares.get(id) ?? 0, height / tallest));
      }
    }
    return { height: (bar?.offsetHeight ?? 0) + tallest, cut };
  };
  const shares = new Map<string, number>();

  /* The table as kept for what the tabs hold, the rows the room asks for
     that it has not got measured: the narrowest width nothing is cut at,
     halved down to a pixel from the widest a row is measured at, and the
     tabs at each of its widths. */
  const kept = tables.get(content) ?? { table: { rows: [], points: [] }, added: new Map<number, number[]>() };
  const rows = new Map(kept.table.rows.map((row) => [row.f, row] as const));
  const added = new Map(kept.added);
  const measuredRows: number[] = [];
  for (const f of sizesFor(rooms)) {
    if (rows.has(f)) {
      continue;
    }
    setText(f);
    const most = ROW_WIDTHS[ROW_WIDTHS.length - 1] * f;
    let uncut = Infinity;
    if (at(most).cut === null) {
      /* To a quarter of an em: what is cut is cut by more than that. */
      let low = 0;
      let high = most;
      while (high - low > f / 4) {
        const middle = Math.floor((low + high) / 2);
        if (at(middle).cut === null) {
          high = middle;
        } else {
          low = middle;
        }
      }
      uncut = high / f;
    }
    rows.set(f, { f, uncut, widths: [...ROW_WIDTHS], heights: ROW_WIDTHS.map((width) => at(width * f).height / f) });
    added.set(f, []);
    measuredRows.push(f);
  }
  /* And in each, the width the page gives the panel under the boards. */
  let widthsAdded = 0;
  for (const f of sizesFor(rooms)) {
    const row = rows.get(f) as NeedsRow;
    const width = belowIn(row, rooms);
    if (hasWidth(row, width)) {
      continue;
    }
    setText(f);
    const grown = withWidth(row, added.get(f) ?? [], width, at(Math.floor(rooms.belowWidth)).height / f);
    rows.set(f, grown.row);
    added.set(f, grown.added);
    widthsAdded += 1;
  }
  /* And exactly, where the panel under the boards most often is: at the page's width, at the panel's own size of text. */
  let table: NeedsTable = { rows: [...rows.values()].sort((a, b) => a.f - b.f), points: kept.table.points };
  let pointsAdded = 0;
  for (const { width, f } of pointsFor(rooms)) {
    if (!hasPoint(table, width, f)) {
      setText(f);
      table = withPoint(table, width, f, at(width).height);
      pointsAdded += 1;
    }
  }
  tables.set(content, { table, added, tall: kept.tall });
  if (measuredRows.length > 0 || widthsAdded > 0 || pointsAdded > 0) {
    storeTables();
  }

  /*
    The panels the layout chose, each measured at the size of text it chose:
    where the tabs show whole, that; where not, the size the table says they
    would, its height there scaled by how far it was out at the size just
    measured — at most `MOST_CHECKS` measures in all, and where none of them
    fit, the size the layout chose, the tabs scrolling.
  */
  /* Where the table was changed just now, the panel the layout will choose
     with it, rather than the one it chose without what was added. */
  const changed = measuredRows.length > 0 || widthsAdded > 0 || pointsAdded > 0;
  const toCheck = changed ? rooms.checksFor(table) : rooms.checks;
  const checks: Record<string, CheckPx> = {};
  for (const room of toCheck) {
    const done = checked.get(`${content} ${room.key}`);
    if (done !== undefined) {
      checks[room.key] = done;
      continue;
    }
    /* At the width it has, to the fraction: a panel given what nothing is cut at, measured a pixel narrower, would have it cut. */
    const width = room.w;
    let f = room.f;
    let tries = 0;
    let found: CheckPx | null = null;
    while (tries < MOST_CHECKS) {
      setText(f);
      const seen = at(width);
      tries += 1;
      if (seen.cut === null && seen.height <= room.h) {
        found = { f, fits: true, tries };
        break;
      }
      /* By how much the table was out here, and the size it then says fits —
         never larger than the tabs' measured height, scaled down with their
         text, says. */
      const out = seen.height / needsAt(table, width, f).height;
      const scaled = seen.cut === null ? (f * room.h) / seen.height : f;
      const fitting = (size: number) => {
        const needs = needsAt(table, width, size);
        return needs.width <= width && needs.height * out <= room.h;
      };
      let low = rooms.leastText;
      let high = f;
      if (!fitting(low)) {
        break;
      }
      for (let step = 0; step < 20; step += 1) {
        const middle = (low + high) / 2;
        if (fitting(middle)) {
          low = middle;
        } else {
          high = middle;
        }
      }
      /* Smaller than the last by a hundredth at least, so that each try is a new one, and never under the least. */
      f = Math.min(low, scaled, f * 0.99);
      if (f < rooms.leastText - 1e-9) {
        break;
      }
    }
    /* Not kept in the table: the layout read off it would move with every check, and be checked again where it moved. */
    const result = found ?? { f: room.f, fits: false, tries };
    checks[room.key] = result;
    checked.set(`${content} ${room.key}`, result);
    checkStats.checks += 1;
    checkStats.tries += result.tries;
    checkStats.most = Math.max(checkStats.most, result.tries);
    checkStats.unfitted += result.fits ? 0 : 1;
  }

  /* Where every tab was drawn, those that stand tall, for the next pass to draw: see `TALL_SHARE`. */
  let tall = kept.tall;
  if (drawn === "all" && shares.size > 0) {
    tall = [...shares].filter(([, share]) => share >= TALL_SHARE).map(([id]) => id);
    tables.set(content, { table, added, tall });
    storeTables();
  }

  /* Everything as it was. */
  column.style.width = widthWas;
  if (scaleWas === "") {
    column.style.removeProperty("--set-scale");
  } else {
    column.style.setProperty("--set-scale", scaleWas);
  }
  for (const [list, was] of listHeights) {
    list.style.maxHeight = was;
  }
  open.forEach((panel) => panel.classList.remove("tab-panel-measure"));
  for (const [element, top] of scrolled) {
    element.scrollTop = top;
  }

  return {
    measured: { table, checks },
    said: {
      "measures taken": `${measures}, in ${(performance.now() - started).toFixed(1)}ms`,
      "tabs drawn": drawn === "all" ? `every one; standing tall: ${tall?.join(", ") ?? "none"}` : `those standing tall, and the open one: ${tall?.join(", ") ?? "none"}`,
      "rows measured": measuredRows.length === 0 ? "none: all kept" : measuredRows.map((f) => `${f}px`).join(", "),
      "the page's width added": `${Math.floor(rooms.belowWidth)}px, in ${widthsAdded} row${widthsAdded === 1 ? "" : "s"}; ${pointsAdded} measured exactly`,
      "rows kept": table.rows.map(
        (row) => `${row.f}px: ${row.widths.length} widths, nothing cut from ${Number.isFinite(row.uncut) ? `${(row.uncut * row.f).toFixed(0)}px` : "no width"}`
      ),
      ...(toCheck.length === 0
        ? {}
        : {
            [changed ? "in the room the layout gives it with what was added" : "in the room the layout gave it"]: Object.fromEntries(
              toCheck.map(({ key }) => [
                key,
                checks[key].fits
                  ? `fits at ${checks[key].f.toFixed(2)}px, ${checks[key].tries} measure${checks[key].tries === 1 ? "" : "s"}`
                  : `fits at nothing in ${checks[key].tries} measures: the tabs scroll`,
              ])
            ),
            "checks this session": { ...checkStats },
          }),
    },
  };
}

/** How wide a line of text is in a field's own font. */
function textWidth(field: HTMLElement, text: string): number {
  const style = getComputedStyle(field);
  const context = document.createElement("canvas").getContext("2d");
  if (context === null) {
    return 0;
  }
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText(text).width;
}

/** The width a field has for its text: its own, less its padding and border. */
function contentWidth(field: HTMLElement): number {
  const style = getComputedStyle(field);
  return field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}
