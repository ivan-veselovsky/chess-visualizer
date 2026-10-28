/**
 * The page's main regions — the header, the boards with the row over them, the
 * row under them and the bars beside them, and the panel of tabs — worked out
 * from the shape of the window alone, as boxes.
 *
 * In units of the window's width: the window is 1 wide and `aspect` (its
 * height over its width) tall, so a phone held upright at 3:1 is 3 units tall
 * and a 16:9 screen 0.5625. Pixels come in only at the end — see `inPixels` —
 * so a window of the same shape gets the same layout at any size, and the
 * whole of it can be tested without a browser.
 *
 * The type is part of the layout: `em`, the size of the page's text, comes out
 * of it like any other size, in proportion to the window's area, so the text
 * takes the same share of the screen whether the screen is a laptop's or a
 * wall's. Everything here that is not a board is measured in it.
 *
 * Written with its extensions, like the other modules `tests/unit.mjs` runs
 * straight from the TypeScript.
 */

/** A region of the page: its top left corner, its width and its height, in units of the window's width. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the layout is asked for. */
export interface LayoutInput {
  /** The window's height over its width: 0.5625 for 16:9, 3 for a tall phone upright. */
  aspect: number;
  /**
   * Whether the page may scroll — not that it will. Scrolling is a nuisance,
   * the more so on a phone, and a layout that scrolls is taken only where its
   * boards are larger by `scrollPenalty` than the best one that does not; see
   * `layout`. Where the page may not, the panel is always fitted into what the
   * window leaves it, at least `panelMinHeight` of it.
   */
  scrollable: boolean;
  /** One board, or two. */
  boards: 1 | 2;
  /** How many bars of men stand beside the boards: none, one or two. */
  bars: number;
  /** The fixed sizes, in ems, where they are to differ from `DEFAULT_METRICS`: any of them, the gaps one by one. */
  metrics?: MetricsAsked;
  /**
   * The least the text may be, in units of the window's width: on a small
   * screen, text in proportion to it would be too small to read. Whoever knows
   * the window's width in pixels says what this is — see `minEmFor`. None,
   * where nothing is said.
   */
  minEm?: number;
  /**
   * How tall the panel's contents are — the tallest of its tabs, not only the
   * one open — at the width the panel has under the boards, in units of the
   * window's width. On a page that scrolls the panel is given all of it, so
   * that nothing in it scrolls as well: the page scrolling a little further
   * costs next to nothing, a scroller inside a scroller a good deal. Whoever
   * can measure the tabs says what it is; nothing, where nothing is said, and
   * the panel has its least height.
   */
  panelWants?: number;
}

/**
 * Every space the layout leaves, between the regions and round the page, by
 * name, in ems of the page's text — the one place each is said. The page has
 * them as `--lay-gap-…` too, in pixels: `pageTop` as `--lay-gap-page-top`, and
 * so on; see App.
 */
export interface Gaps {
  /** Above the header: the page's top. */
  pageTop: number;
  /** Either side of the page. */
  pageSide: number;
  /**
   * Under the last thing on the page: the panel, or — where they run down to
   * the window's foot — the boards and the panel beside them. Where the panel
   * is under the boards and the page scrolls, the boards stand off the foot by
   * `panel` instead, the gap over the panel kept on the screen; this is then
   * the page's own end, under the panel.
   */
  pageBottom: number;
  /** Between the header and the row over the boards. */
  underHeader: number;
  /** Between the row over the boards and the boards: the row stands off them rather than sitting on their edge. */
  overBoards: number;
  /** Between two boards, side by side or one over the other. */
  betweenBoards: number;
  /** Between the boards and the first bar of men, and between one bar and the next. */
  besideBar: number;
  /** Between the boards and the panel, beside them or under them. */
  panel: number;
}

export const DEFAULT_GAPS: Gaps = {
  pageTop: 1.5,
  pageSide: 0.75,
  pageBottom: 0.5,
  underHeader: 0.75,
  overBoards: 0.6,
  betweenBoards: 1,
  besideBar: 0.4,
  panel: 0.5,
};

/**
 * The sizes of everything but the boards, in ems of the page's text: taken from
 * the stylesheet as it stood when the layout was moved here, so a desktop
 * window comes out much as it did.
 */
export interface Metrics {
  /** The text's size, against the square root of the window's area. Calibrated so that a 1400 × 950 window has 16px text. */
  emPerRootArea: number;
  /** The spaces between the regions and round the page: see `Gaps`. */
  gaps: Gaps;
  /** The header's own line. */
  header: number;
  /** The row over the boards — the line of moves, or a name — and the row under them. */
  topRow: number;
  bottomRow: number;
  /** One bar of men. */
  bar: number;
  /**
   * How many times taller than wide a window has to be for two boards to stand
   * one over the other: under it they stand side by side, whatever that costs
   * them. Not in ems: a shape, the window's height over its width.
   *
   * Side by side is the way the two are read against each other, and the panel
   * of tabs is laid out across rather than down too: a window no taller than
   * it is wide never has them stacked, and one only a little taller — where
   * stacked boards can come out a touch larger — keeps them side by side as
   * well. Stacked is for a phone held upright, near 1:2 or taller.
   */
  columnFromAspect: number;
  /** The panel's least and most width beside the boards, and its least height under them. */
  panelMinWidth: number;
  /**
   * And its least width beside them as a share of a board's side, with one
   * board and with two: 1 is as wide as a board. Where the window is not wide
   * enough for that, the boards give up width to it — and the panel goes
   * under them instead, where that leaves them larger. Nought asks nothing
   * beyond `panelMinWidth`. Not in ems: a share.
   */
  panelBesideOneBoard: number;
  panelBesideTwoBoards: number;
  panelMaxWidth: number;
  panelMinHeight: number;
  /**
   * How much larger its boards must be for a page that scrolls to be taken
   * over one that does not: 1.25 is a quarter larger. Not in ems: a ratio.
   */
  scrollPenalty: number;
  /**
   * The least share of the panel worth showing above the window's foot, on a
   * page that scrolls: under it, what would show is a strip of the tabs too
   * thin to use, and the strip is left blank — the stub, with an arrow on it
   * to say there is more below — and the panel starts at the foot, to be
   * scrolled to whole. Not in ems: a share of the tallest tab's height, where
   * the tabs have been measured — see `LayoutInput.panelWants` — and of the
   * panel's where they have not.
   */
  stubShare: number;
}

export const DEFAULT_METRICS: Metrics = {
  emPerRootArea: 16 / Math.sqrt(1400 * 950),
  gaps: DEFAULT_GAPS,
  header: 2.06,
  topRow: 1.75,
  bottomRow: 1.55,
  bar: 1.7,
  columnFromAspect: 1.75,
  panelMinWidth: 27,
  panelBesideOneBoard: 0.65,
  panelBesideTwoBoards: 0.91,
  panelMaxWidth: 100,
  panelMinHeight: 25,
  scrollPenalty: 1.3,
  stubShare: 0.2,
};

/** Metrics where they are to differ from the defaults: any of them, and the gaps one by one. */
export type MetricsAsked = Partial<Omit<Metrics, "gaps">> & { gaps?: Partial<Gaps> };

/** The defaults, with whatever is asked laid over them. */
export function metricsOf(asked: MetricsAsked = {}): Metrics {
  return { ...DEFAULT_METRICS, ...asked, gaps: { ...DEFAULT_GAPS, ...asked.gaps } };
}

/** How two boards stand to each other: side by side, or one over the other. */
export type Flow = "row" | "column";

/** Where the panel of tabs goes: to the right of the boards, or under them. */
export type PanelPlace = "right" | "below";

export interface Layout {
  flow: Flow;
  panelPlace: PanelPlace;
  /** Whether the page is taller than the window, and scrolls. */
  scrolls: boolean;
  /** The page's text size, in units of the window's width. */
  em: number;
  /** The window's height over its width, as asked. */
  aspect: number;
  header: Box;
  /**
   * The boards and what stands round them, as one: the row over them, from the
   * left edge of the first board to the right edge of the last bar; the boards
   * themselves, coordinates and all, each square; the bars of men beside them,
   * nearest first, as tall as the boards; and the row under them.
   */
  group: Box;
  top: Box;
  boards: Box[];
  bars: Box[];
  bottom: Box;
  panel: Box;
  /**
   * The blank in the panel's place above the window's foot, where too little
   * of the panel would show there to be of use — see `stubShare` — and the
   * panel below it, past the foot; null where the panel shows as it is.
   */
  stub: Box | null;
  /** The gaps it was laid out with, in units of the window's width like everything else: see `Gaps`. */
  gaps: Gaps;
  /** How tall the page is: the window's height, or more where it scrolls. */
  height: number;
}

/** The text's size from the window's shape: in proportion to its area, and never under the least asked for. */
function emOf(aspect: number, metrics: Metrics, minEm: number): number {
  /* The area's square root, the window being 1 wide: √(1 × aspect). */
  return Math.max(metrics.emPerRootArea * Math.sqrt(aspect), minEm);
}

/**
 * One way of laying the page out — the boards side by side or one over the
 * other, the panel to their right or under them, the page scrolling or not —
 * with the boards as large as it lets them be; null where it cannot be had.
 */
function arranged(
  input: LayoutInput,
  metrics: Metrics,
  em: number,
  flow: Flow,
  panelPlace: PanelPlace,
  scroll: boolean
): Layout | null {
  const { aspect, boards, bars } = input;
  const m = (ems: number) => ems * em;
  const g = metrics.gaps;
  const barsWidth = bars * m(metrics.bar + g.besideBar);
  const gap = m(g.betweenBoards);
  const rows = m(metrics.topRow + g.overBoards + metrics.bottomRow);
  const left = m(g.pageSide);
  const above = m(g.pageTop + metrics.header + g.underHeader);
  const inside = 1 - 2 * left;

  /*
    The room the group has, across and down: the page's, less the panel's
    where it stands beside the boards, or under them and on the screen.

    Down, something always stands between the boards and the window's foot:
    the page's padding, where the boards run to the foot; the panel's least
    height and the gap over it, where the panel is under them on the screen;
    and the gap alone where it is under them past the foot, the page running
    on — so the row under the boards never stands on the window's edge, and
    the padding goes to the page's own end, under the panel.
  */
  const across = inside - (panelPlace === "right" ? m(g.panel + metrics.panelMinWidth) : 0);
  const under =
    panelPlace === "right"
      ? m(g.pageBottom)
      : scroll
        ? m(g.panel)
        : m(g.panel + metrics.panelMinHeight + g.pageBottom);
  const down = aspect - above - rows - under;
  /* And a board's side in that room: so many boards across it, or down it. */
  const many = (room: number) => (room - (boards - 1) * gap) / boards;
  let side =
    flow === "row" ? Math.min(many(across - barsWidth), down) : Math.min(across - barsWidth, many(down));
  /* Beside them, the panel as wide as its share of a board, as well as its
     least width: the boards across the row, and the panel's share, out of
     what the row has once the gaps and the bars are taken from it. */
  const besideShare = boards === 1 ? metrics.panelBesideOneBoard : metrics.panelBesideTwoBoards;
  if (panelPlace === "right" && besideShare > 0) {
    const inRow = flow === "row" ? boards : 1;
    const shared = inside - m(g.panel) - barsWidth - (flow === "row" ? (boards - 1) * gap : 0);
    side = Math.min(side, shared / (inRow + besideShare));
  }
  if (!(side > 0)) {
    return null;
  }

  /* The group, from the page's top left: the boards in a row or a column, the
     bars to the right of them all, the rows across the whole. */
  const boardsWidth = flow === "row" ? boards * side + (boards - 1) * gap : side;
  const boardsHeight = flow === "row" ? side : boards * side + (boards - 1) * gap;
  const groupWidth = boardsWidth + barsWidth;
  const top: Box = { x: left, y: above, w: groupWidth, h: m(metrics.topRow) };
  const boardsTop = top.y + top.h + m(g.overBoards);
  const boardBoxes: Box[] = Array.from({ length: boards }, (_, index) => ({
    x: left + (flow === "row" ? index * (side + gap) : 0),
    y: boardsTop + (flow === "column" ? index * (side + gap) : 0),
    w: side,
    h: side,
  }));
  const barBoxes: Box[] = Array.from({ length: bars }, (_, bar) => ({
    x: left + boardsWidth + m(g.besideBar) + bar * m(metrics.bar + g.besideBar),
    y: boardsTop,
    w: m(metrics.bar),
    h: boardsHeight,
  }));
  const bottom: Box = { x: left, y: boardsTop + boardsHeight, w: groupWidth, h: m(metrics.bottomRow) };
  const group: Box = { x: left, y: top.y, w: groupWidth, h: bottom.y + bottom.h - top.y };

  /* And the panel in what is left: beside the boards, as wide as it may be,
     down to the window's foot; or under them, the page's width, to the foot —
     or, on a page that scrolls, its least height where the window has less
     left, running on past it. */
  let panel: Box;
  let stub: Box | null = null;
  if (panelPlace === "right") {
    const x = group.x + group.w + m(g.panel);
    panel = { x, y: above, w: Math.min(1 - left - x, m(metrics.panelMaxWidth)), h: aspect - above - m(g.pageBottom) };
  } else {
    const y = group.y + group.h + m(g.panel);
    const room = aspect - m(g.pageBottom) - y;
    panel = { x: left, y, w: inside, h: scroll ? Math.max(room, m(metrics.panelMinHeight), input.panelWants ?? 0) : room };
    /* Only a sliver of it on the screen — a sliver of the tallest tab, where
       the tabs have been measured — the sliver left blank, and the panel moved
       down to start where the window ends. */
    if (scroll && room > 0 && room < metrics.stubShare * (input.panelWants ?? panel.h)) {
      stub = { x: left, y, w: inside, h: room };
      panel = { ...panel, y: aspect };
    }
  }
  const height = Math.max(aspect, panel.y + panel.h + m(g.pageBottom));
  return {
    flow,
    panelPlace,
    scrolls: height > aspect + 1e-9,
    em,
    aspect,
    header: { x: left, y: m(g.pageTop), w: inside, h: m(metrics.header) },
    group,
    top,
    boards: boardBoxes,
    bars: barBoxes,
    bottom,
    panel,
    stub,
    gaps: Object.fromEntries(Object.entries(g).map(([name, ems]) => [name, m(ems)])) as unknown as Gaps,
    height,
  };
}

/**
 * The layout for a window of the shape asked, of every one that can be had:
 * the boards side by side or — two of them, in a window tall enough for it,
 * see `columnFromAspect` — one over the other, the panel to
 * their right or under them, and, where the page may scroll, a panel under
 * them run on past the window's foot.
 *
 * The one with the largest boards, they being what the page is for — but a
 * page that scrolls only where its boards are larger by `scrollPenalty` than
 * the best that does not: scrolling is a nuisance, on a phone above all, and
 * is had only where it buys a good deal. Where two come out the same, the
 * first in the order tried: the panel to the right before under, the boards
 * side by side before one over the other.
 */
export function layout(input: LayoutInput): Layout {
  const metrics = metricsOf(input.metrics);
  const em = emOf(input.aspect, metrics, input.minEm ?? 0);
  const candidates: Layout[] = [];
  for (const scroll of input.scrollable ? [false, true] : [false]) {
    for (const panelPlace of ["right", "below"] as const) {
      if (scroll && panelPlace === "right") {
        continue;
      }
      const stacking = input.boards === 2 && input.aspect >= metrics.columnFromAspect;
      for (const flow of stacking ? (["row", "column"] as const) : (["row"] as const)) {
        const candidate = arranged(input, metrics, em, flow, panelPlace, scroll);
        if (candidate !== null) {
          candidates.push(candidate);
        }
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error(`No layout fits a window of aspect ${input.aspect}`);
  }
  const worth = (candidate: Layout) => candidate.boards[0].w / (candidate.scrolls ? metrics.scrollPenalty : 1);
  return candidates.reduce((best, candidate) => (worth(candidate) > worth(best) + 1e-9 ? candidate : best));
}

/** `minEm` for a window so many pixels wide, from the least text size in pixels that is still read. */
export function minEmFor(widthPx: number, minEmPx = 12): number {
  return minEmPx / widthPx;
}

/** A box in pixels, for a window so many pixels wide. */
export function boxInPixels(box: Box, widthPx: number): Box {
  return { x: box.x * widthPx, y: box.y * widthPx, w: box.w * widthPx, h: box.h * widthPx };
}

/** The whole layout in pixels: the last step, and the only one that knows the window's size. */
export function inPixels(laid: Layout, widthPx: number): Layout {
  const px = (box: Box) => boxInPixels(box, widthPx);
  return {
    ...laid,
    em: laid.em * widthPx,
    header: px(laid.header),
    group: px(laid.group),
    top: px(laid.top),
    boards: laid.boards.map(px),
    bars: laid.bars.map(px),
    bottom: px(laid.bottom),
    panel: px(laid.panel),
    stub: laid.stub === null ? null : px(laid.stub),
    gaps: Object.fromEntries(Object.entries(laid.gaps).map(([name, size]) => [name, size * widthPx])) as unknown as Gaps,
    height: laid.height * widthPx,
  };
}

/** Every region of a layout, by name: for drawing them, and for testing them. */
export function regionsOf(laid: Layout): { name: string; box: Box }[] {
  return [
    { name: "header", box: laid.header },
    { name: "top row", box: laid.top },
    ...laid.boards.map((box, index) => ({ name: `board ${index + 1}`, box })),
    ...laid.bars.map((box, index) => ({ name: `bar ${index + 1}`, box })),
    { name: "bottom row", box: laid.bottom },
    { name: "panel", box: laid.panel },
    ...(laid.stub === null ? [] : [{ name: "stub", box: laid.stub }]),
  ];
}
