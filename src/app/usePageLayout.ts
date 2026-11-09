import { startTransition, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { DEFAULT_LAYOUT_PARAMS, inPixels, layout, minBoardFor, minEmFor, panelLeastOf, panelRooms, scaleFor, type Layout, type LayoutInput, type LayoutParams, type MetricsAsked, type PanelNeeds } from "./layout";
import { CANVAS_SIZE, SQUARE_SIZE } from "../visualization/geometry";
import { note } from "./friend/log";
import { needsAt, type NeedsTable } from "./panelNeeds";
import { checkKey, type PanelMeasuredPx, type PanelRoomsPx } from "./usePanelLeast";

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

/**
 * What the layout is weighed by — scrolling, and how far, which way,
 * stacking two boards, the panel's text set smaller, and how hard E's floor
 * is: see `LayoutParams`. Kept in this browser beside whether the page may
 * scroll at all, and for the same reason: it is about the screen and the
 * hand on it, not about how a board is drawn.
 *
 * Stored whole, as JSON, and read back one by one: one that is missing, or
 * is not a number of 0 or more, is the default's — so one added later comes
 * up at its default in a browser that stored the others before it.
 */
const PARAMS_KEY = "cv.layout-params";

export function layoutParams(): LayoutParams {
  let stored: unknown = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(PARAMS_KEY) ?? "null");
  } catch {
    stored = null;
  }
  const params = { ...DEFAULT_LAYOUT_PARAMS };
  if (typeof stored === "object" && stored !== null) {
    for (const name of Object.keys(params) as (keyof LayoutParams)[]) {
      const value = (stored as Record<string, unknown>)[name];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        params[name] = value;
      }
    }
  }
  return params;
}

export function setLayoutParams(params: LayoutParams): void {
  try {
    window.localStorage.setItem(PARAMS_KEY, JSON.stringify(params));
  } catch {
    /* As with scrolling: they hold for this visit, and the next opens at the defaults. */
  }
}

/** The class the document carries while the layout is computed: see `html.layout-computed`. */
const COMPUTED_CLASS = "layout-computed";

/**
 * How much taller than the table says the layout takes the tabs to be: a
 * margin of 1.5%. The table reads them between sizes and widths measured, and
 * reads them about 1% short where the panel ends up, its text then set a hair
 * larger than they fit at; the panel the layout chose is measured once the
 * window holds still, and its text set smaller to what fits — a jump, a
 * moment after the window stopped moving. With the margin the text the layout
 * chose mostly fits as it is, the measure says so, and nothing moves: for
 * text at most 1.5% smaller than it might have been. See `usePanelLeast`.
 */
const NEEDS_MARGIN = 1.015;

/** The box the window is measured by: see `.layout-window`. */
const WINDOW_CLASS = "layout-window";

/** The class the document carries while the page runs past the window's foot, and has a scrollbar for it: see `html.layout-scrolls`. */
const SCROLLS_CLASS = "layout-scrolls";

/** And while it runs past the window's right edge: see `html.layout-scrolls-across`. */
const SCROLLS_ACROSS_CLASS = "layout-scrolls-across";

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
 * beside it — and one that runs past its right edge, for the height over
 * the scrollbar along its foot. Settled for the width it is then laid out for, a scrollbar
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
  /* What the panel's tabs were measured to need, in pixels; see `LayoutInput.needs`. */
  measured: PanelMeasuredPx | null
): { laid: Layout | null; rooms: PanelRoomsPx | null; least: { below: number; right: number | null } | null } {
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
    const measure = (later: boolean) => {
      const box = frame.getBoundingClientRect();
      const bar = scrollbarWidth();
      /* The box's width and height, and the scrollbar's beside it or under it where the page has one. */
      const w = box.width + (root.classList.contains(SCROLLS_CLASS) ? bar : 0);
      const h = box.height + (root.classList.contains(SCROLLS_ACROSS_CLASS) ? bar : 0);
      const update = () => setSize((was) => (was !== null && was.w === w && was.h === h && was.bar === bar ? was : { w, h, bar }));
      if (later) {
        startTransition(update);
      } else {
        update();
      }
    };
    /* The first at once, before the page is painted. Every one after as a
       transition: a window being dragged is a new size every frame, and
       laying the page out takes a good part of one — so React is left free
       to drop a size the window has already moved on from, and lay out the
       one it is at, rather than every size it passed through in turn, the
       page falling further behind the hand the longer the drag. */
    measure(false);
    const watching = new ResizeObserver(() => measure(true));
    watching.observe(frame);
    return () => {
      watching.disconnect();
      frame.remove();
      root.classList.remove(COMPUTED_CLASS, SCROLLS_CLASS, SCROLLS_ACROSS_CLASS);
      root.style.fontSize = "";
    };
  }, [computed]);

  /* What the tabs need, read off the table in pixels — the one measured, or one that is about to be — for a window `w` wide, in units of its width. */
  const table = measured?.table ?? null;
  const needsFor = (w: number, from = table): PanelNeeds | undefined =>
    from === null || from.rows.length === 0
      ? undefined
      : (width, f) => {
          const needs = needsAt(from, width * w, f * w);
          return { height: (needs.height * NEEDS_MARGIN) / w, width: needs.width / w };
        };
  /* What is asked of the layout for a window this wide; and laid out for it. */
  const inputFor = (w: number, h: number, from = table): LayoutInput => ({
    aspect: h / w,
    scrollable,
    boards,
    bars,
    metrics,
    minEm: minEmFor(w),
    scale: scaleFor(w, h),
    minBoard: minBoardFor(w, CANVAS_SIZE / SQUARE_SIZE),
    needs: needsFor(w, from),
  });
  const laidFor = (w: number, h: number, from = table): Layout => inPixels(layout(inputFor(w, h, from)), w);
  /* For the whole window, which settles whether the page scrolls, and which
     way; and where it does, for the width beside its scrollbar, or the
     height over it. Should that smaller page fit after all, it keeps the
     scrollbar, with nothing to scroll: taking it away would hand the page
     the whole window, which it does not fit.

     Worked out again only when something it is worked out from changes,
     not on every drawing of the page: it tries every way of laying the page
     out at every size of its boards and its panel's text, which takes a few
     milliseconds — and the page is drawn again on every move. */
  const metricsKey = JSON.stringify(metrics);
  const chosenWith = (from: NeedsTable | null): { whole: Layout | null; model: Layout | null } => {
    const whole = !computed || size === null || size.w <= 0 || size.h <= 0 ? null : laidFor(size.w, size.h, from);
    const axis = whole?.scrollAxis ?? "none";
    const model =
      whole === null || size === null || size.bar <= 0
        ? whole
        : axis === "down"
          ? laidFor(size.w - size.bar, size.h, from)
          : axis === "across"
            ? laidFor(size.w, size.h - size.bar, from)
            : whole;
    return { whole, model };
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- what `inputFor` reads, the metrics by what they say rather than which object says it.
  const { whole, model } = useMemo(() => chosenWith(table), [computed, size, scrollable, boards, bars, metricsKey, table]);
  const axis = whole?.scrollAxis ?? "none";

  /* The panel the layout chose, where its tabs are to show whole in it: at
     the size of text it chose, by its name, to be measured in — see
     `usePanelLeast` — and none where they scroll there whatever, nor before
     the table is measured, the layout then a guess to be put right. */
  const checkOf = (chosen: Layout | null, from: NeedsTable | null) =>
    chosen === null || chosen.panelScrolls || from === null
      ? null
      : { key: checkKey(chosen.panel.w, chosen.panel.h, chosen.settingsEm * chosen.panelScale), w: chosen.panel.w, h: chosen.panel.h, f: chosen.settingsEm * chosen.panelScale };
  const check = checkOf(model, table);
  /* And the panel's text as the tabs were measured to fit it there: the
     layout reads what they need off a table, which is near and not exact,
     and the tabs say exactly. Where they fit at nothing the measures tried,
     at the size chosen, and scrolling. Not weighed again: the layout is
     chosen by the table, so that what was measured never moves it, and the
     measure never has another room to be taken in. */
  const result = check === null ? undefined : measured?.checks[check.key];
  const laid =
    model === null || result === undefined
      ? model
      : { ...model, panelScale: result.fits ? result.f / model.settingsEm : model.panelScale, panelScrolls: !result.fits };

  /* The scrollbar there or not as settled, before the page is painted. */
  useLayoutEffect(() => {
    if (computed) {
      document.documentElement.classList.toggle(SCROLLS_CLASS, axis === "down");
      document.documentElement.classList.toggle(SCROLLS_ACROSS_CLASS, axis === "across");
    }
  }, [computed, axis]);

  /* What the tabs need at their own size, in pixels, for the window as it is: see `panelLeastOf`. */
  const least: { below: number; right: number | null } | null = (() => {
    if (!computed || size === null || size.w <= 0 || size.h <= 0 || table === null) {
      return null;
    }
    const found = panelLeastOf(inputFor(size.w, size.h));
    return { below: found.below * size.w, right: found.right === null ? null : found.right * size.w };
  })();

  /*
    The room the panel would have, for the tabs to be measured in: see
    `panelRooms`. Under the boards, for the width beside a scrollbar where
    there is one to be had — narrower by it, and the tabs as tall or taller,
    so what they need there they have on a page without one too, and whether
    the page scrolls never changes what was measured. Beside the boards, the
    same: for the height over a scrollbar along the foot, where the page may
    scroll across, the tabs as wide there or wider.

    And the sizes the panel's text may be set at, which the table is to be
    read between; and the panel the layout chose, to be measured in.
  */
  const rooms: PanelRoomsPx | null = (() => {
    if (!computed || size === null || size.w <= 0 || size.h <= 0) {
      return null;
    }
    const whole = panelRooms(inputFor(size.w, size.h));
    const narrow = size.w - size.bar;
    const under = panelRooms(inputFor(narrow, size.h));
    const short = size.h - (scrollable ? size.bar : 0);
    const beside = panelRooms(inputFor(size.w, short));
    return {
      belowWidth: under.belowWidth * narrow,
      points: [
        ...(size.bar > 0 ? [under.belowWidth * narrow, whole.belowWidth * size.w] : [whole.belowWidth * size.w]).map((width) => ({ width, f: whole.ownText * size.w })),
        ...(least === null || least.right === null ? [] : [{ width: least.right, f: whole.ownText * size.w }]),
      ],
      rightHeight: beside.rightHeight * size.w,
      rightMost: whole.rightMost * size.w,
      leastText: whole.leastText * size.w,
      ownText: whole.ownText * size.w,
      checks: check === null ? [] : [check],
      checksFor: (from) => {
        const again = checkOf(chosenWith(from).model, from);
        return again === null ? [] : [again];
      },
    };
  })();

  /* What was chosen, in the log, as the page changes: see `note`. */
  const chosen =
    laid === null
      ? null
      : `${laid.panelPlace} ${laid.flow} ${laid.scrollAxis} ${Math.round(laid.boards[0].w)} ${Math.round(laid.panel.w)} ${Math.round(laid.panel.h)} ${laid.panelScale.toFixed(3)}`;
  useEffect(() => {
    if (laid === null || chosen === null) {
      return;
    }
    note("the page laid out", {
      window: size === null ? null : `${size.w} × ${size.h}`,
      panel: `${laid.panelPlace} the boards, ${Math.round(laid.panel.w)} × ${Math.round(laid.panel.h)}px${
        laid.stub === null ? "" : laid.scrollAxis === "across" ? ", past the right edge" : ", past the foot"
      }`,
      "panel text": `${(laid.settingsEm * laid.panelScale).toFixed(1)}px${laid.panelScale < 1 ? `, set smaller to fit (${laid.panelScale.toFixed(3)})` : ""}${
        laid.panelScrolls ? ", and its tabs scroll" : ""
      }`,
      boards: `${laid.boards.length}, ${laid.flow === "row" ? "side by side" : "one over the other"}, ${Math.round(laid.boards[0].w)}px each`,
      scrolls: laid.scrollAxis === "none" ? false : laid.scrollAxis,
      "the panel needs": least === null ? "not measured yet" : least,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- said once for each layout chosen, which `chosen` names.
  }, [chosen]);

  /* A page that does not scroll down is the window's height exactly, as
     measured — over the scrollbar along its foot, where it scrolls across:
     the height in units of the width, times the width, can miss it by a
     hair. */
  if (laid !== null && laid.scrollAxis !== "down" && size !== null) {
    laid.height = size.h - (axis === "across" ? size.bar : 0);
  }

  /* The page's text, at the size the regions were computed for: everything
     the stylesheet measures in rems grows and shrinks with it. */
  useEffect(() => {
    if (laid !== null) {
      document.documentElement.style.fontSize = `${laid.em}px`;
    }
  }, [laid?.em]);

  return { laid, rooms, least };
}
