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
function measuredText(px: number): { charEm: number; lineEm: number } | null {
  const probe = document.createElement("div");
  probe.style.cssText = `position: absolute; visibility: hidden; left: 0; top: 0; white-space: nowrap; font-size: ${px}px; line-height: normal;`;
  probe.textContent = SAMPLE_TEXT;
  document.body.append(probe);
  const box = probe.getBoundingClientRect();
  probe.remove();
  if (!(box.width > 0 && box.height > 0)) {
    return null;
  }
  return { charEm: box.width / SAMPLE_TEXT.length / px, lineEm: box.height / px };
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
  const [text, setText] = useState<{ charEm: number; lineEm: number } | null>(null);


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
            metrics: text === null ? metrics : { ...text, ...metrics },
            minEm: minEmFor(size.w),
            scale: scaleFor(size.w, size.h),
            ...(panelWantsPx === null ? {} : { panelWants: panelWantsPx / size.w }),
          }),
          size.w
        );

  /* The font's character and line, measured at the size the panel's text is
     drawn at — once the layout has said what that is, which does not depend
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
          was !== null && measured !== null && was.charEm === measured.charEm && was.lineEm === measured.lineEm ? was : measured
        );
      }
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => {
      live = false;
    };
  }, [panelTextPx]);

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
