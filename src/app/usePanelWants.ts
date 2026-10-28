import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** How long the panel's width has to hold still before every tab is measured again: a window being dragged is measured once it is let go. */
const SETTLE_MS = 200;

/**
 * How tall the panel of tabs wants to be — the tallest of the tabs, not only
 * the one open — measured where the page scrolls, for `layout` to give it all
 * of that: see `LayoutInput.panelWants`.
 *
 * Every tab is measured, so the page is as long whichever is open and does not
 * jump as they are switched between. Most of them are not there to be
 * measured: only the open one is drawn, and the two kept while hidden have no
 * height. So, whenever the panel's width or the text's size changes, there is
 * a pass in which every tab is drawn — the ones not open out of the flow,
 * unseen, inert — measured, and taken away again, all before the browser
 * paints: `measuring` says when, and the page draws them while it is true.
 * Between passes the open tab is watched as it is, as a game is loaded into it
 * or a list grows.
 *
 * `watching` is whether the page scrolls: where it does not, the panel is the
 * room the window leaves it, and what its tabs want does not come into it.
 * `size` is anything that changes when the panel's width or the text's size
 * does. `onWants` is told the height, in pixels, whenever it changes.
 */
export function usePanelWants(
  watching: boolean,
  size: string,
  tab: string,
  onWants: (px: number) => void
): { tabbed: RefObject<HTMLDivElement | null>; measuring: boolean } {
  const tabbed = useRef<HTMLDivElement>(null);
  const [measuring, setMeasuring] = useState(false);
  /* Each tab's height when last measured, by its panel's id. */
  const heights = useRef(new Map<string, number>());
  const told = useRef(onWants);
  told.current = onWants;

  /* The strip of tabs and the tallest panel under it. */
  const settle = () => {
    const bar = tabbed.current?.querySelector<HTMLElement>(":scope > .tab-bar");
    told.current((bar?.offsetHeight ?? 0) + Math.max(0, ...heights.current.values()));
  };

  useEffect(() => {
    if (!watching) {
      return;
    }
    const timer = window.setTimeout(() => setMeasuring(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [watching, size]);

  /* The pass: drawn by now, every tab of them, and measured before the paint. */
  useLayoutEffect(() => {
    if (!measuring) {
      return;
    }
    const root = tabbed.current;
    if (root !== null) {
      heights.current.clear();
      for (const panel of root.querySelectorAll<HTMLElement>(":scope > .tab-panel")) {
        heights.current.set(panel.id, panel.offsetHeight);
      }
      settle();
    }
    setMeasuring(false);
  }, [measuring]);

  /* And the open tab, as it changes between passes. */
  useEffect(() => {
    if (!watching || measuring) {
      return;
    }
    const panel = tabbed.current?.querySelector<HTMLElement>(`:scope > #panel-${tab}`);
    if (panel === null || panel === undefined) {
      return;
    }
    const observer = new ResizeObserver(() => {
      heights.current.set(panel.id, panel.offsetHeight);
      settle();
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [watching, measuring, tab]);

  return { tabbed, measuring };
}
