import { useEffect, useLayoutEffect, useState } from "react";
import { inPixels, layout, minEmFor, scaleFor, type Layout, type MetricsAsked } from "./layout";

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
 * Text of the sort the panel holds, to measure an average character of it by:
 * words of the lengths its labels and its explanations have, with the spaces
 * between them — a character being any of them, as a reader counts.
 */
const SAMPLE_TEXT =
  "Pieces that attack the square are drawn with rays; the heat map shows how often each square is attacked, by whom.";

/**
 * A character of the page's text, on the average, and a line of it, in ems, as
 * this browser draws them in the font it has: see `Metrics.charEm`. Measured
 * rather than assumed, as the font is the machine's own — `system-ui` is one
 * font on a Mac and another on Linux, the one a few hundredths of an em wider
 * a character than the other — and the panel asks for its room in characters
 * of it, which is only room for so many where they are the ones drawn.
 *
 * At the size the panel's text is drawn at, not at a larger one for the
 * measure's precision: a line's height is rounded to whole pixels, so a line
 * of 14px text is a larger share of an em than a line of 100px text is.
 */
type MeasuredText = { charEm: number; lineEm: number; tabsEm?: number };

function measuredText(px: number): MeasuredText | null {
  const probe = document.createElement("div");
  probe.style.cssText = `position: absolute; visibility: hidden; left: 0; top: 0; white-space: nowrap; font-size: ${px}px; line-height: normal;`;
  probe.textContent = SAMPLE_TEXT;
  document.body.append(probe);
  const box = probe.getBoundingClientRect();
  probe.remove();
  if (!(box.width > 0 && box.height > 0)) {
    return null;
  }
  const tabs = measuredTabs(px);
  return { charEm: box.width / SAMPLE_TEXT.length / px, lineEm: box.height / px, ...(tabs === null ? {} : { tabsEm: tabs }) };
}

/**
 * The row of tabs, in ems of the panel's text, as it is set in a panel
 * narrower than 39 of them — see `Metrics.tabsEm` — or nothing where there is
 * no row to measure.
 *
 * A copy of the row as it is drawn, in a box that is a container of no width
 * at all, so that its tabs are set as in the narrowest panel whatever the
 * width of the one they are in now: measured in a panel wide enough for them
 * at full size, the least width would be theirs at full size — a panel set
 * beside the boards that much wider, where its tabs would have been narrower.
 * The copy itself as wide as its tabs want, on one row — not the box's no
 * width, in which they would wrap, and shrink to their words in plain type
 * rather than the room they keep for them in bold (see `.tab-label`). And
 * rounded up to the whole pixel, as the panel's width, set from a sum of
 * fractions, may come out a sixty-fourth short of a sum of them.
 */
function measuredTabs(px: number): number | null {
  const row = document.querySelector(".tab-bar");
  if (row === null) {
    return null;
  }
  const holder = document.createElement("div");
  holder.style.cssText = `position: absolute; visibility: hidden; left: 0; top: 0; width: 0; container-type: inline-size; font-size: ${px}px;`;
  const copy = row.cloneNode(true) as HTMLElement;
  /* Not twice on the page, even for a moment: the ids are the tabs'. */
  for (const named of copy.querySelectorAll("[id]")) {
    named.removeAttribute("id");
  }
  copy.style.width = "max-content";
  copy.style.flexWrap = "nowrap";
  holder.append(copy);
  document.body.append(holder);
  const width = copy.getBoundingClientRect().width;
  holder.remove();
  return width > 0 ? Math.ceil(width) / px : null;
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
  /* How tall the panel's tabs are, in pixels, at the width they have under the boards; see `LayoutInput.panelWants`. */
  panelWantsPx: number | null
): Layout | null {
  const computed = mode !== "css";
  /* The window: its whole width, a scrollbar's included; its height; and a scrollbar's width. */
  const [size, setSize] = useState<{ w: number; h: number; bar: number } | null>(null);
  const [text, setText] = useState<MeasuredText | null>(null);


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

  /* Laid out for a window this wide. */
  const laidFor = (w: number, h: number): Layout =>
    inPixels(
      layout({
        aspect: h / w,
        scrollable,
        boards,
        bars,
        metrics: text === null ? metrics : { ...text, ...metrics },
        minEm: minEmFor(w),
        scale: scaleFor(w, h),
        ...(panelWantsPx === null ? {} : { panelWants: panelWantsPx / w }),
      }),
      w
    );
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

  /* The font's character and line, and the row of tabs, measured at the
     size the panel's text is drawn at — once the layout has said what that is, which does not depend
     on them, so one measure settles it — and again when the fonts have
     loaded, in case the first measure was of one standing in. */
  const panelTextPx = laid?.settingsEm;
  /* Before the page is painted, so it is never seen laid out for a font it does not have. */
  useLayoutEffect(() => {
    if (panelTextPx === undefined) {
      return;
    }
    let live = true;
    const measure = () => {
      if (live) {
        const measured = measuredText(panelTextPx);
        setText((was) =>
          was !== null &&
          measured !== null &&
          was.charEm === measured.charEm &&
          was.lineEm === measured.lineEm &&
          was.tabsEm === measured.tabsEm
            ? was
            : measured
        );
      }
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => {
      live = false;
    };
  }, [panelTextPx]);

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

  return laid;
}
