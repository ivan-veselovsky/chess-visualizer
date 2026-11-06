import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { DEFAULT_POSITION } from "chess.js";
import { note } from "./friend/log";

/** How long the window has to hold still before the tabs are measured again: a window being dragged is measured once it is let go. */
const SETTLE_MS = 200;

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

/** The room the panel would have, in pixels, before a layout is chosen: see `panelRooms`. */
export interface PanelRoomsPx {
  belowWidth: number;
  rightHeight: number;
  rightMost: number;
}

/** What the tabs need, in pixels: see `LayoutInput.panelLeast`, and `PanelLeastPx.why` for what set it. */
export interface PanelLeastPx {
  below: number;
  right: number | null;
}

/**
 * The least room the panel of tabs can show every one of them in without
 * scrolling, measured: under the boards, how tall, and beside them, how wide.
 * See `LayoutInput.panelLeast`, which this is for.
 *
 * Measured rather than guessed, as the tabs are text in the machine's own
 * font, set at a size the window decides, and wrapped as the width allows.
 * One of the two sizes is always known before the layout is chosen — see
 * `panelRooms` — and that is what makes the measure exact: under the boards
 * the panel is the page's width, so the tabs are measured at that width and
 * the tallest is the height; beside them it is the window's height less the
 * header, so the width is the narrowest the tabs fit that height at — found
 * by halving, the tabs measured at each width tried.
 *
 * Beside the boards the panel is wide enough as well for what is read whole
 * or not at all: the row of tabs on one line, the Lab tab's FEN field showing
 * most of the starting position's FEN — see `FEN_SHOWN` — the library's list
 * showing its longest game's name, and no tab wider than the panel.
 *
 * Every tab is drawn for it: most are not there to be measured, only the open
 * one being drawn and the two kept while hidden having no height. So there is
 * a pass in which every tab is drawn — the ones not open out of the flow,
 * unseen, inert — and measured with the panel's column set to each width in
 * turn, its lists at their floors, and everything then put back, all before
 * the browser paints: `measuring` says when, and the page draws them while it
 * is true.
 *
 * Measured when the room changes — the window, or the text's size with it —
 * when the fonts have loaded, and when `version` changes, which the page
 * moves when a tab arrives that was not there to be measured; at once the
 * first time, and once the window holds still after that. Not when what is
 * in a tab changes: the boards would change size every time a game was read
 * in or a setting opened a row, and a page that moves under the reader's hand
 * is worse than a tab that scrolls, now and then, until the window is next
 * resized.
 *
 * `onLeast` is told what was measured, and says it in the log: see `note`.
 */
export function usePanelLeast(
  rooms: PanelRoomsPx | null,
  textPx: number | null,
  version: number,
  onLeast: (least: PanelLeastPx) => void
): { tabbed: RefObject<HTMLDivElement | null>; measuring: boolean } {
  const tabbed = useRef<HTMLDivElement>(null);
  const [measuring, setMeasuring] = useState(false);
  const told = useRef(onLeast);
  told.current = onLeast;
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

  const key =
    rooms === null || textPx === null
      ? null
      : `${Math.floor(rooms.belowWidth)} ${Math.floor(rooms.rightHeight)} ${Math.floor(rooms.rightMost)} ${textPx} ${version} ${fontsIn}`;

  /* The first time before anything is painted, so the page never shows the
     guess; after that once the window has held still. */
  useLayoutEffect(() => {
    if (key === null) {
      return;
    }
    if (!measuredOnce.current) {
      measuredOnce.current = true;
      setMeasuring(true);
      return;
    }
    const timer = window.setTimeout(() => setMeasuring(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [key]);

  /* The pass: drawn by now, every tab of them, and measured before the paint. */
  useLayoutEffect(() => {
    if (!measuring) {
      return;
    }
    const root = tabbed.current;
    const room = roomsNow.current;
    if (root !== null && room !== null) {
      const measured = measureTabs(root, room);
      if (measured !== null) {
        note("the panel of tabs measured", measured.said);
        told.current(measured.least);
      }
    }
    setMeasuring(false);
  }, [measuring]);

  return { tabbed, measuring };
}

/** The tabs at one width of the panel: whether they fit it, and if not, why. */
interface AtWidth {
  /** The row of tabs and the tallest tab under it, the one scrolling by design left out. */
  height: number;
  /** Each tab's own height, by its panel's id. */
  tabs: Record<string, number>;
  /** What is read whole and is not at this width — nothing, where everything is. */
  cut: string | null;
}

/**
 * Every tab measured: drawn already, by the page, for the pass. Null where
 * there is no column to set widths on, as there is not where the stylesheet
 * lays the page out.
 */
function measureTabs(root: HTMLElement, rooms: PanelRoomsPx): { least: PanelLeastPx; said: Record<string, unknown> } | null {
  const column = root.closest<HTMLElement>(".side-column");
  if (column === null) {
    return null;
  }
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

  /* What is read whole, and how wide it is when the panel is as wide as it gets. */
  const fen = root.querySelector<HTMLInputElement>("#fen");
  /* The library's games are in the list of stashed games, under a heading of
     their own: their names, and not the reader's stashes', which are as long
     as a reader made them — nor the Line list's, a line of moves as long as
     the game, which never fits and once put the panel under the boards. */
  const library = root.querySelector<HTMLSelectElement>("#stashed-game");
  const fenText = fen === null ? 0 : textWidth(fen, DEFAULT_POSITION);
  const libraryNames = library === null ? [] : [...library.querySelectorAll<HTMLOptionElement>('optgroup[label="Library"] > option')];
  const libraryText = library === null ? 0 : Math.max(0, ...libraryNames.map((option) => textWidth(library, option.text)));

  /* As wide as the panel can be: how wide the library's list is there, which
     is as wide as it gets — it stops short of its longest name where the
     stylesheet says so. */
  column.style.width = `${rooms.rightMost}px`;
  const widest = { library: library === null ? Infinity : contentWidth(library) };

  const at = (width: number): AtWidth => {
    column.style.width = `${width}px`;
    const tabs: Record<string, number> = {};
    let tallest = 0;
    let wide: string | null = null;
    for (const panel of panels) {
      tabs[panel.id] = panel.offsetHeight;
      if (panel.id !== SCROLLS_BY_DESIGN) {
        tallest = Math.max(tallest, panel.offsetHeight);
      }
      if (wide === null && panel.scrollWidth > panel.clientWidth + 1) {
        wide = `${panel.id.replace("panel-", "")} tab wider than the panel`;
      }
    }
    const tabTops = bar === null ? [] : [...bar.querySelectorAll<HTMLElement>(".tab")].map((tab) => tab.offsetTop);
    const cut =
      tabTops.some((top) => top !== tabTops[0])
        ? "the row of tabs on two lines"
        : fen !== null && contentWidth(fen) < FEN_SHOWN * fenText - 0.5
          ? "the FEN field under four fifths of the starting FEN"
          : library !== null && contentWidth(library) < Math.min(libraryText, widest.library) - 0.5
            ? "a library game's name cut short"
            : wide;
    return { height: (bar?.offsetHeight ?? 0) + tallest, tabs, cut };
  };

  /* Under the boards: the page's width, and the tallest tab at it. */
  const belowWidth = Math.floor(rooms.belowWidth);
  const under = at(belowWidth);

  /* Beside them: the narrowest width the tabs fit the window's height at,
     everything read whole. Halved down to a pixel; then tried at widths over
     it, as a wider panel is now and then a taller one — a row that wrapped
     under one width and not another — and searched again above any that
     does not fit. */
  const fits = (width: number) => {
    const seen = at(width);
    return seen.cut === null && seen.height <= rooms.rightHeight;
  };
  const most = Math.floor(rooms.rightMost);
  let right: number | null = null;
  let from = 0;
  for (let round = 0; round < 3 && fits(most); round += 1) {
    let low = from;
    let high = most;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (fits(middle)) {
        high = middle;
      } else {
        low = middle;
      }
    }
    right = high;
    const over = Array.from({ length: 8 }, (_, step) => Math.round(high + ((most - high) * (step + 1)) / 9)).find((width) => !fits(width));
    if (over === undefined) {
      break;
    }
    from = over;
    right = null;
  }
  /* What set it: what stops fitting a pixel narrower. */
  const short = right === null ? null : at(right - 1);
  const beside = right === null ? null : at(right);

  /* Everything as it was. */
  column.style.width = widthWas;
  for (const [list, was] of listHeights) {
    list.style.maxHeight = was;
  }
  open.forEach((panel) => panel.classList.remove("tab-panel-measure"));
  for (const [element, top] of scrolled) {
    element.scrollTop = top;
  }

  const below = Math.ceil(under.height);
  return {
    least: { below, right },
    said: {
      "under the boards": `${belowWidth}px wide, needs ${below}px down${under.cut === null ? "" : ` (and has ${under.cut})`}`,
      "beside the boards":
        right === null
          ? `no width up to ${most}px fits ${Math.floor(rooms.rightHeight)}px down`
          : `${Math.floor(rooms.rightHeight)}px down, needs ${right}px across, set by ${
              short === null ? "nothing" : (short.cut ?? `the tallest tab, ${Math.ceil(short.height)}px at a pixel narrower`)
            }`,
      "tabs under the boards": under.tabs,
      ...(beside === null ? {} : { "tabs beside the boards": beside.tabs }),
      "scrolls by design": SCROLLS_BY_DESIGN.replace("panel-", ""),
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
