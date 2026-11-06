import { useEffect, useLayoutEffect, useState } from "react";
import { inPixels, layout, minBoardFor, minEmFor, panelRooms, scaleFor, type Layout, type LayoutInput, type MetricsAsked } from "./layout";
import { CANVAS_SIZE, SQUARE_SIZE } from "../visualization/geometry";
import { note } from "./friend/log";
import type { PanelLeastPx, PanelRoomsPx } from "./usePanelLeast";

/**
 * How the page is laid out: by `layout`, the regions computed from the
 * window's shape and placed where it says, as it is unless asked otherwise;
 * computed and with each region outlined, for seeing what was computed apart
 * from what is laid out inside it; or by the stylesheet alone, as it was
 * before, kept for setting the two side by side.
 */
export type LayoutMode = "css" | "computed" | "debug";

/** The mode asked for in the address — `?layout=debug`, `?layout=css` — read as the page opens; computed where nothing is asked. */
export function layoutModeFromLocation(): LayoutMode {
  if (typeof window === "undefined") {
    return "computed";
  }
  const asked = new URLSearchParams(window.location.search).get("layout");
  return asked === "css" || asked === "debug" ? asked : "computed";
}

/**
 * Whether the page may run on past the window's foot, and be scrolled: see
 * `LayoutInput.scrollable`. On, unless switched off in this browser — on a
 * large screen a reader may rather have everything in the window at once,
 * the panel the smaller for it.
 *
 * Kept beside the settings rather than in them, as two board mode is: it is
 * about the screen the page is read on, not about how a board is drawn, and a
 * preset carried to another screen should not carry it along.
 */
const SCROLLING_KEY = "cv.allow-scrolling";

export function allowScrolling(): boolean {
  try {
    return window.localStorage.getItem(SCROLLING_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setAllowScrolling(on: boolean): void {
  try {
    window.localStorage.setItem(SCROLLING_KEY, on ? "on" : "off");
  } catch {
    /* A browser refusing storage still runs the app; it just opens as a new
       browser does next time, the page allowed to scroll. */
  }
}

/** The class the document carries while the layout is computed: see `html.layout-computed`. */
const COMPUTED_CLASS = "layout-computed";

/** The box the window is measured by: see `.layout-window`. */
const WINDOW_CLASS = "layout-window";

/** The class the document carries while the page runs past the window's foot, and has a scrollbar for it: see `html.layout-scrolls`. */
const SCROLLS_CLASS = "layout-scrolls";

/**
 * How wide a scrollbar is in this browser, to the fraction of a pixel — the
 * device's pixels it is drawn in, in CSS ones — and none where scrollbars are
 * drawn over what they scroll rather than beside it.
 */
function scrollbarWidth(): number {
  const outer = document.createElement("div");
  outer.style.cssText = "position: absolute; visibility: hidden; left: 0; top: 0; width: 100px; height: 50px; overflow-y: scroll;";
  const inner = document.createElement("div");
  outer.append(inner);
  document.body.append(outer);
  const width = outer.getBoundingClientRect().width - inner.getBoundingClientRect().width;
  outer.remove();
  return width;
}

/**
 * The page's regions for the window as it is now, in pixels — and the page's
 * text set to the size they were computed for — or nothing, where the layout
 * is the stylesheet's.
 *
 * Worked out again whenever the window changes size. The window's size is
 * what a box fixed to all four of its edges measures: the room the page has,
 * to the fraction of a pixel, less the scrollbar where there is one.
 *
 * Not `innerHeight` and the document's `clientWidth`, which are whole pixels:
 * on a screen drawn at 1.25 device pixels to the CSS one — a desktop scaled to
 * 125%, or a page zoomed to it — a window 971 device pixels tall is 776.8 CSS
 * ones, `innerHeight` says 777, and a page that tall is a fifth of a pixel
 * taller than the window, which Chrome gives a scrollbar to.
 *
 * Whether the page scrolls is settled for the window's whole width, the
 * scrollbar's included, which a scrollbar coming or going does not change:
 * a page that fits has no scrollbar and the whole width, and one that runs
 * past the window's foot always has one, and is laid out for the width
 * beside it. Settled for the width it is then laid out for, a scrollbar
 * coming would narrow the page, which might then fit, and lose the scrollbar,
 * and widen again — and so on, for as long as the window was left alone.
 * The page used to keep a scrollbar's room at its side for that, scrolling or
 * not, and a page that fitted had a stripe of nothing down its edge.
 *
 * Watched rather than asked on `resize`, which does not come when a page is
 * zoomed.
 */
export function usePageLayout(
  mode: LayoutMode,
  scrollable: boolean,
  boards: 1 | 2,
  bars: number,
  /* The sizes that are the page's to say rather than the layout's: a bar's width, the row under the boards. */
  metrics: MetricsAsked,
  /* The least room the panel's tabs need, in pixels, as measured; see `LayoutInput.panelLeast`. */
  panelLeastPx: PanelLeastPx | null
): { laid: Layout | null; rooms: PanelRoomsPx | null } {
  const computed = mode !== "css";
  /* The window: its whole width, a scrollbar's included; its height; and a scrollbar's width. */
  const [size, setSize] = useState<{ w: number; h: number; bar: number } | null>(null);

  useEffect(() => {
    if (!computed) {
      return;
    }
    const root = document.documentElement;
    root.classList.add(COMPUTED_CLASS);
    const frame = document.createElement("div");
    frame.className = WINDOW_CLASS;
    frame.setAttribute("aria-hidden", "true");
    document.body.append(frame);
    const measure = () => {
      const box = frame.getBoundingClientRect();
      const bar = scrollbarWidth();
      /* The box's width, and the scrollbar's beside it where the page has one. */
      const w = box.width + (root.classList.contains(SCROLLS_CLASS) ? bar : 0);
      setSize((was) => (was !== null && was.w === w && was.h === box.height && was.bar === bar ? was : { w, h: box.height, bar }));
    };
    measure();
    const watching = new ResizeObserver(measure);
    watching.observe(frame);
    return () => {
      watching.disconnect();
      frame.remove();
      root.classList.remove(COMPUTED_CLASS, SCROLLS_CLASS);
      root.style.fontSize = "";
    };
  }, [computed]);

  /* What is asked of the layout for a window this wide; and laid out for it. */
  const inputFor = (w: number, h: number): LayoutInput => ({
    aspect: h / w,
    scrollable,
    boards,
    bars,
    metrics,
    minEm: minEmFor(w),
    scale: scaleFor(w, h),
    minBoard: minBoardFor(w, CANVAS_SIZE / SQUARE_SIZE),
    ...(panelLeastPx === null
      ? {}
      : { panelLeast: { below: panelLeastPx.below / w, right: panelLeastPx.right === null ? null : panelLeastPx.right / w } }),
  });
  const laidFor = (w: number, h: number): Layout => inPixels(layout(inputFor(w, h)), w);
  /* For the whole width, which settles whether the page scrolls; and where
     it does, for the width beside its scrollbar. Should that narrower page
     fit after all, it keeps the scrollbar, with nothing to scroll: taking it
     away would hand the page the whole width, which it does not fit. */
  const whole = !computed || size === null || size.w <= 0 || size.h <= 0 ? null : laidFor(size.w, size.h);
  const scrolls = whole?.scrolls ?? false;
  const laid = whole !== null && size !== null && scrolls && size.bar > 0 ? laidFor(size.w - size.bar, size.h) : whole;

  /* The scrollbar there or not as settled, before the page is painted. */
  useLayoutEffect(() => {
    if (computed) {
      document.documentElement.classList.toggle(SCROLLS_CLASS, scrolls);
    }
  }, [computed, scrolls]);

  /*
    The room the panel would have, for the tabs to be measured in: see
    `panelRooms`. Under the boards, for the width beside a scrollbar where
    there is one to be had — narrower by it, and the tabs as tall or taller,
    so what they need there they have on a page without one too, and whether
    the page scrolls never changes what was measured. Beside the boards, for
    the window's whole width: a page with the panel there never scrolls.
  */
  const rooms: PanelRoomsPx | null = (() => {
    if (!computed || size === null || size.w <= 0 || size.h <= 0) {
      return null;
    }
    const whole = panelRooms(inputFor(size.w, size.h));
    const narrow = size.w - size.bar;
    const under = panelRooms(inputFor(narrow, size.h));
    return { belowWidth: under.belowWidth * narrow, rightHeight: whole.rightHeight * size.w, rightMost: whole.rightMost * size.w };
  })();

  /* What was chosen, in the log, as the page changes: see `note`. */
  const chosen =
    laid === null
      ? null
      : `${laid.panelPlace} ${laid.flow} ${laid.scrolls} ${Math.round(laid.boards[0].w)} ${Math.round(laid.panel.w)} ${Math.round(laid.panel.h)}`;
  useEffect(() => {
    if (laid === null || chosen === null) {
      return;
    }
    note("the page laid out", {
      window: size === null ? null : `${size.w} × ${size.h}`,
      panel: `${laid.panelPlace} the boards, ${Math.round(laid.panel.w)} × ${Math.round(laid.panel.h)}px${laid.stub === null ? "" : ", past the foot"}`,
      boards: `${laid.boards.length}, ${laid.flow === "row" ? "side by side" : "one over the other"}, ${Math.round(laid.boards[0].w)}px each`,
      scrolls: laid.scrolls,
      "the panel needs": panelLeastPx === null ? "not measured yet" : panelLeastPx,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- said once for each layout chosen, which `chosen` names.
  }, [chosen]);

  /* A page that fits is the window's height exactly, as measured: the height
     in units of the width, times the width, can miss it by a hair. */
  if (laid !== null && !laid.scrolls && size !== null) {
    laid.height = size.h;
  }

  /* The page's text, at the size the regions were computed for: everything
     the stylesheet measures in rems grows and shrinks with it. */
  useEffect(() => {
    if (laid !== null) {
      document.documentElement.style.fontSize = `${laid.em}px`;
    }
  }, [laid?.em]);

  return { laid, rooms };
}
