import { useEffect, useState } from "react";
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

/** The class the document carries while the layout is computed: see `html.layout-computed`. */
const COMPUTED_CLASS = "layout-computed";

/**
 * The page's regions for the window as it is now, in pixels — and the page's
 * text set to the size they were computed for — or nothing, where the layout
 * is the stylesheet's.
 *
 * Worked out again whenever the window changes size. The window's width is the
 * document's, without a scrollbar's: the document keeps the gutter for one
 * whether it scrolls or not (see `html.layout-computed`), so a page starting
 * or stopping scrolling does not change the width it was laid out for, which
 * would lay it out again, and again.
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
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!computed) {
      return;
    }
    const root = document.documentElement;
    root.classList.add(COMPUTED_CLASS);
    const measure = () => setSize({ w: root.clientWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      root.classList.remove(COMPUTED_CLASS);
      root.style.fontSize = "";
    };
  }, [computed]);

  const laid =
    !computed || size === null || size.w <= 0 || size.h <= 0
      ? null
      : inPixels(
          layout({
            aspect: size.h / size.w,
            scrollable,
            boards,
            bars,
            metrics,
            minEm: minEmFor(size.w),
            scale: scaleFor(size.w, size.h),
            ...(panelWantsPx === null ? {} : { panelWants: panelWantsPx / size.w }),
          }),
          size.w
        );

  /* A page that fits is the window's height to the pixel, as measured: the
     height in units of the width, times the width, can miss it by a hair. */
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
