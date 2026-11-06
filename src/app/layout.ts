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
 * wall's. Everything here that is not a board is measured in it — but the
 * panel of tabs, which has text of its own, `settingsEm`: the same up to a
 * window of the size the text is calibrated at, and growing more slowly past
 * it, so that a large screen gives its room to the boards rather than to the
 * settings.
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
   * window leaves it, at least `panelMinLines` of it.
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
   * How large the window is against the one the text is calibrated at, 1400 ×
   * 950 pixels: the square root of their areas' ratio — see `scaleFor`. The
   * panel's text grows with it more slowly than the page's past 1; see
   * `settingsGrowth`. None, where nothing is said, and the two are the same.
   */
  scale?: number;
  /**
   * The least room the panel can show every tab in without scrolling — the
   * tab row and the tallest of the tabs, the lists in them at their floors —
   * as measured in the page, in units of the window's width: see
   * `usePanelLeast`. Under the boards, where its width is the page's and
   * known before the layout is, a height: the tabs measured at that width.
   * Beside them, where its height is known — the window's, less the header
   * and the gaps; see `panelRooms` — a width: the narrowest the tabs fit that
   * height at, and show the longest lines of the Lab tab whole in; null where
   * no width does.
   *
   * Every layout gives the panel this much at least: on a page that may
   * scroll, always, so that nothing in it scrolls as well — a scroller inside
   * a scroller fights the page over every turn of the wheel; on one that may
   * not, wherever the boards keep their least size with it — see `minBoard`
   * — and only there does a tab scroll of its own. Nothing, where nothing has
   * been measured yet, and the panel has `panelMinChars` and `panelMinLines`.
   */
  panelLeast?: PanelLeast;
  /**
   * The least side a board may have, in units of the window's width: the
   * board with squares of `MIN_SQUARE_PX`, under which a piece is a smudge.
   * A layout leaving less is taken only where no other can be had, and on a
   * page that may not scroll the panel then gives up room to the boards
   * rather than the boards to the panel. None, where nothing is said.
   */
  minBoard?: number;
}

/** The least room the panel needs: see `LayoutInput.panelLeast`. */
export interface PanelLeast {
  /** Under the boards, its least height. */
  below: number;
  /** Beside them, its least width; null where the tabs fit no width there. */
  right: number | null;
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
  /**
   * How the panel's text grows past the window the text is calibrated at, as
   * the power of `LayoutInput.scale` it grows by: 1 as the page's text does, ½
   * as the square root of it — a window twice as large each way has its page's
   * text twice as large, and the panel's √2. Under that window the two are the
   * same. Not in ems: a power.
   */
  settingsGrowth: number;
  /**
   * And the panel's text against the page's at that window, where it is to be
   * smaller or larger there as well: 1 the same, 0.9 a tenth smaller. Not in
   * ems: a ratio.
   */
  settingsSize: number;
  /** The spaces between the regions and round the page: see `Gaps`. */
  gaps: Gaps;
  /** The header's own line. */
  header: number;
  /**
   * The row over the boards — the line of moves, or a name — and the row
   * under them, in ems of their own text rather than the page's: see
   * `rowEmPerBoard`.
   */
  topRow: number;
  bottomRow: number;
  /**
   * The rows' text against a board's side, so that the line of moves, the
   * flowers and the names grow and shrink with the boards they are about:
   * a sixth of a square, which is the page's own 16px beside a board of
   * 811px, as 1400 × 950 has. Never under the least the page's text may be
   * — see `LayoutInput.minEm` — the rows being read, not looked at; which
   * they can be held at, unlike the bars, as their height is laid out from
   * it. Not in ems: a ratio.
   */
  rowEmPerBoard: number;
  /**
   * One bar of men, in ems of its own text rather than the page's: the bar
   * is drawn to the board's scale, not the text's — see `barEmPerBoard`.
   */
  bar: number;
  /**
   * A bar's text against the side of the board it stands beside, so that the
   * men in it and the counts by them grow and shrink with the men on the
   * board: a bar of men is a third of a square across, and its text is
   * `bar` of that. With no floor of its own, as the board's coordinates have
   * none: everything in a bar is in its ems, so what fits beside a large
   * board fits beside a small one — and text held at a size the board had
   * gone under ran past the board's foot. Not in ems: a ratio.
   */
  barEmPerBoard: number;
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
  /**
   * The panel's least width beside the boards, in characters of its text, and
   * its least height under them, in lines of it — until the tabs have been
   * measured, and in a test that measures nothing: then what was measured is
   * the least, `LayoutInput.panelLeast`. A guess, these, and a poor one: the
   * tabs want twice the lines at most widths. In the text's own size,
   * `settingsEm`, which grows more slowly than the boards past the window the
   * text is calibrated at.
   */
  panelMinChars: number;
  panelMinLines: number;
  /**
   * A character of the panel's text, on the average, and a line of it, in ems:
   * what `system-ui` measures on Linux, for the guess above.
   */
  charEm: number;
  lineEm: number;
  /**
   * The row of tabs over the panel, in ems of the panel's text, as it is set
   * in a panel narrower than 39 of them (see `@container (max-width: 39em)`):
   * the panel beside the boards is never narrower than this, whatever its
   * characters come to. The tabs are words of their own, not text of the
   * average sort: a font may set them in fewer of its characters or in more —
   * 61.4 in Noto Sans, 63.9 in Liberation Sans — and the last of them, with
   * the panel no wider than the characters asked, would go round onto a
   * second row. What `system-ui` measures on Linux, for the guess above.
   */
  tabsEm: number;
  /** The panel's most width beside the boards, in ems of its text. */
  panelMaxWidth: number;
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
   * scrolled to whole. Not in ems: a share of the panel's least height.
   */
  stubShare: number;
}

export const DEFAULT_METRICS: Metrics = {
  emPerRootArea: 16 / Math.sqrt(1400 * 950),
  settingsGrowth: 0.5,
  settingsSize: 0.75,
  gaps: DEFAULT_GAPS,
  header: 2.06,
  topRow: 1.75,
  bottomRow: 1.55,
  bar: 1.7,
  barEmPerBoard: 64 / 536 / 3 / 1.7,
  rowEmPerBoard: 64 / 536 / 6,
  columnFromAspect: 1.75,
  panelMinChars: 62,
  panelMinLines: 15,
  charEm: 0.48,
  lineEm: 1.375,
  tabsEm: 29.55,
  panelMaxWidth: 100,
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
  /** And the panel's: see `Metrics.settingsGrowth`. */
  settingsEm: number;
  /** And the bars of men's, which goes with the boards: see `Metrics.barEmPerBoard`. */
  barEm: number;
  /** And the rows' over and under the boards, which does as well: see `Metrics.rowEmPerBoard`. */
  rowEm: number;
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

/**
 * The text's sizes from the window's shape, the page's and the panel's: in
 * proportion to its area's square root, the panel's past `scale` 1 as its
 * `settingsGrowth` power, and `settingsSize` of it — and either never under
 * the least asked for.
 */
function emsOf(input: LayoutInput, metrics: Metrics): { em: number; settingsEm: number } {
  const minEm = input.minEm ?? 0;
  /* The area's square root, the window being 1 wide: √(1 × aspect). */
  const em = metrics.emPerRootArea * Math.sqrt(input.aspect);
  const scale = input.scale ?? 1;
  const slower = scale > 1 ? scale ** (metrics.settingsGrowth - 1) : 1;
  return { em: Math.max(em, minEm), settingsEm: Math.max(em * slower * metrics.settingsSize, minEm) };
}

/**
 * A board's side, where `count` of them share `room` across with the bars of
 * men — the gaps between the boards already taken off it. The bars go with
 * the boards, so the side is what the two together come to: see
 * `barEmPerBoard`.
 */
function sideAcross(input: LayoutInput, metrics: Metrics, em: number, room: number, count: number): number {
  const free = room - input.bars * metrics.gaps.besideBar * em;
  return free / (count + input.bars * metrics.bar * metrics.barEmPerBoard);
}

/** The rows' text over and under boards of this side: see `Metrics.rowEmPerBoard`. */
function rowEmFor(input: LayoutInput, metrics: Metrics, side: number): number {
  return Math.max(metrics.rowEmPerBoard * side, input.minEm ?? 0);
}

/**
 * A board's side, where `count` of them, one over the other, share `room`
 * down with the rows over and under them — the gaps between the boards
 * already taken off it. The rows go with the boards, so the side is what the
 * two together come to; and where that would set the rows' text under the
 * least, it is held there, and the boards have what the rows then leave.
 */
function sideDown(input: LayoutInput, metrics: Metrics, room: number, count: number): number {
  const rows = metrics.topRow + metrics.bottomRow;
  const minEm = input.minEm ?? 0;
  const scaled = room / (count + rows * metrics.rowEmPerBoard);
  if (metrics.rowEmPerBoard * scaled >= minEm) {
    return scaled;
  }
  return (room - rows * minEm) / count;
}

/**
 * The panel's least room: as measured, where it has been, and otherwise so
 * many characters of its text across and lines of it down — see
 * `panelMinChars` — the row of tabs on one line at least.
 */
function leastOf(input: LayoutInput, metrics: Metrics, settingsEm: number): PanelLeast {
  if (input.panelLeast !== undefined) {
    return input.panelLeast;
  }
  return {
    below: metrics.panelMinLines * metrics.lineEm * settingsEm,
    right: Math.max(metrics.panelMinChars * metrics.charEm, metrics.tabsEm) * settingsEm,
  };
}

/**
 * The room the panel would have, in each place, before any layout is chosen —
 * what the page measures the tabs in to say how much of it they need: see
 * `LayoutInput.panelLeast`. Under the boards, its width: the page's, less its
 * sides. Beside them, its height: the window's, less the header and the gaps
 * over and under. And the most it could be across there, with nothing left
 * of the boards, for a measure to stop at.
 */
export function panelRooms(input: LayoutInput): { belowWidth: number; rightHeight: number; rightMost: number } {
  const metrics = metricsOf(input.metrics);
  const { em, settingsEm } = emsOf(input, metrics);
  const g = metrics.gaps;
  const inside = 1 - 2 * g.pageSide * em;
  return {
    belowWidth: inside,
    rightHeight: input.aspect - (g.pageTop + metrics.header + g.underHeader + g.pageBottom) * em,
    rightMost: Math.min(inside - g.panel * em, metrics.panelMaxWidth * settingsEm),
  };
}

/**
 * One way of laying the page out — the boards side by side or one over the
 * other, the panel to their right or under them, the page scrolling or not —
 * with the boards as large as it lets them be; null where it cannot be had.
 * The panel is given `least` at least: see `LayoutInput.panelLeast`.
 */
function arranged(
  input: LayoutInput,
  metrics: Metrics,
  em: number,
  settingsEm: number,
  flow: Flow,
  panelPlace: PanelPlace,
  scroll: boolean,
  least: PanelLeast
): Layout | null {
  const { aspect, boards, bars } = input;
  const m = (ems: number) => ems * em;
  /* The panel's text's sizes: how wide it may be at most. */
  const ms = (ems: number) => ems * settingsEm;
  if (panelPlace === "right" && least.right === null) {
    return null;
  }
  const panelMinWidth = least.right ?? 0;
  const panelMinHeight = least.below;
  const g = metrics.gaps;
  const gap = m(g.betweenBoards);
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
  const across = inside - (panelPlace === "right" ? m(g.panel) + panelMinWidth : 0);
  const under =
    panelPlace === "right"
      ? m(g.pageBottom)
      : scroll
        ? m(g.panel)
        : m(g.panel + g.pageBottom) + panelMinHeight;
  const down = aspect - above - m(g.overBoards) - under;
  /* And a board's side in that room: so many boards across it, or down it,
     the bars beside them across it and the rows over and under them down. */
  const side =
    flow === "row"
      ? Math.min(sideAcross(input, metrics, em, across - (boards - 1) * gap, boards), sideDown(input, metrics, down, 1))
      : Math.min(sideAcross(input, metrics, em, across, 1), sideDown(input, metrics, down - (boards - 1) * gap, boards));
  if (!(side > 0)) {
    return null;
  }
  const rowEm = rowEmFor(input, metrics, side);
  const barEm = metrics.barEmPerBoard * side;
  const barWidth = metrics.bar * barEm;
  const barsWidth = bars * (barWidth + m(g.besideBar));

  /* The group, from the page's top left: the boards in a row or a column, the
     bars to the right of them all, the rows across the whole. */
  const boardsWidth = flow === "row" ? boards * side + (boards - 1) * gap : side;
  const boardsHeight = flow === "row" ? side : boards * side + (boards - 1) * gap;
  const groupWidth = boardsWidth + barsWidth;
  const top: Box = { x: left, y: above, w: groupWidth, h: metrics.topRow * rowEm };
  const boardsTop = top.y + top.h + m(g.overBoards);
  const boardBoxes: Box[] = Array.from({ length: boards }, (_, index) => ({
    x: left + (flow === "row" ? index * (side + gap) : 0),
    y: boardsTop + (flow === "column" ? index * (side + gap) : 0),
    w: side,
    h: side,
  }));
  const barBoxes: Box[] = Array.from({ length: bars }, (_, bar) => ({
    x: left + boardsWidth + m(g.besideBar) + bar * (barWidth + m(g.besideBar)),
    y: boardsTop,
    w: barWidth,
    h: boardsHeight,
  }));
  const bottom: Box = { x: left, y: boardsTop + boardsHeight, w: groupWidth, h: metrics.bottomRow * rowEm };
  const group: Box = { x: left, y: top.y, w: groupWidth, h: bottom.y + bottom.h - top.y };

  /* And the panel in what is left: beside the boards, as wide as it may be,
     down to the window's foot; or under them, the page's width, to the foot —
     or, on a page that scrolls, its least height where the window has less
     left, running on past it. */
  let panel: Box;
  let stub: Box | null = null;
  if (panelPlace === "right") {
    const x = group.x + group.w + m(g.panel);
    panel = { x, y: above, w: Math.min(1 - left - x, ms(metrics.panelMaxWidth)), h: aspect - above - m(g.pageBottom) };
  } else {
    const y = group.y + group.h + m(g.panel);
    const room = aspect - m(g.pageBottom) - y;
    panel = { x: left, y, w: inside, h: scroll ? Math.max(room, panelMinHeight) : room };
    /* Only a sliver of it on the screen — a sliver of what its tabs need —
       the sliver left blank, and the panel moved down to start where the
       window ends. */
    if (scroll && room > 0 && room < metrics.stubShare * panelMinHeight) {
      stub = { x: left, y, w: inside, h: room };
      panel = { ...panel, y: aspect };
    }
  }
  /* The window's height itself where nothing runs past its foot, rather than
     the larger of it and a sum that comes to it: the sum is as often a hair
     over as under, and a page a ten-trillionth of a pixel taller than the
     window is one a browser may give a scrollbar to. */
  const end = panel.y + panel.h + m(g.pageBottom);
  const scrolls = end > aspect + 1e-9;
  const height = scrolls ? end : aspect;
  return {
    flow,
    panelPlace,
    scrolls,
    em,
    settingsEm,
    barEm,
    rowEm,
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
 *
 * Every one of them gives the panel its least room — see `panelLeast` — and
 * only those whose boards keep their least size are weighed, where any do:
 * see `minBoard`. On a page that may not scroll and where none do, the
 * panel gives way instead: the boards at their least, and the panel what
 * that leaves it — its tabs then the only part of the page that scrolls.
 */
export function layout(input: LayoutInput): Layout {
  const metrics = metricsOf(input.metrics);
  const { em, settingsEm } = emsOf(input, metrics);
  const least = leastOf(input, metrics, settingsEm);
  const stacking = input.boards === 2 && input.aspect >= metrics.columnFromAspect;
  const flows = stacking ? (["row", "column"] as const) : (["row"] as const);
  const candidates: Layout[] = [];
  for (const scroll of input.scrollable ? [false, true] : [false]) {
    for (const panelPlace of ["right", "below"] as const) {
      if (scroll && panelPlace === "right") {
        continue;
      }
      for (const flow of flows) {
        const candidate = arranged(input, metrics, em, settingsEm, flow, panelPlace, scroll, least);
        if (candidate !== null) {
          candidates.push(candidate);
        }
      }
    }
  }
  const minBoard = input.minBoard ?? 0;
  const large = (candidate: Layout) => candidate.boards[0].w >= minBoard - 1e-9;
  let pool = candidates.filter(large);
  if (pool.length === 0 && !input.scrollable) {
    pool = givingWay(input, metrics, em, settingsEm, flows, least, minBoard);
  }
  if (pool.length === 0) {
    pool = candidates;
  }
  if (pool.length === 0) {
    throw new Error(`No layout fits a window of aspect ${input.aspect}`);
  }
  const worth = (candidate: Layout) => candidate.boards[0].w / (candidate.scrolls ? metrics.scrollPenalty : 1);
  return pool.reduce((best, candidate) => (worth(candidate) > worth(best) + 1e-9 ? candidate : best));
}

/**
 * A page that may not scroll, in a window too small for the panel's least
 * room and boards of their least size both: the boards at their least — or
 * as large as the window allows, where that is less — and the panel the
 * rest. Under the boards, and beside them where the tabs fit beside them at
 * all; of the two, the one that leaves the panel the larger share of what
 * it needs, which is the one whose tabs scroll the least. One or none.
 */
function givingWay(
  input: LayoutInput,
  metrics: Metrics,
  em: number,
  settingsEm: number,
  flows: readonly Flow[],
  least: PanelLeast,
  minBoard: number
): Layout[] {
  const g = metrics.gaps;
  const gap = g.betweenBoards * em;
  const rows = (metrics.topRow + metrics.bottomRow) * rowEmFor(input, metrics, minBoard) + g.overBoards * em;
  const above = (g.pageTop + metrics.header + g.underHeader) * em;
  const inside = 1 - 2 * g.pageSide * em;
  const barsWidth = input.bars * (metrics.bar * metrics.barEmPerBoard * minBoard + g.besideBar * em);
  const shares: { laid: Layout; share: number }[] = [];
  for (const flow of flows) {
    /* Under them: whatever the boards at their least leave down the window. */
    const boardsDown = flow === "row" ? minBoard : input.boards * minBoard + (input.boards - 1) * gap;
    const below = Math.max(0, input.aspect - above - rows - (g.panel + g.pageBottom) * em - boardsDown);
    const under = arranged(input, metrics, em, settingsEm, flow, "below", false, { ...least, below });
    if (under !== null) {
      shares.push({ laid: under, share: under.panel.h / least.below });
    }
    /* Beside them: whatever the boards at their least leave across it. */
    if (least.right !== null && flow === "row") {
      const boardsAcross = input.boards * minBoard + (input.boards - 1) * gap;
      const right = inside - g.panel * em - barsWidth - boardsAcross;
      const beside = right > 0 ? arranged(input, metrics, em, settingsEm, flow, "right", false, { ...least, right }) : null;
      if (beside !== null) {
        shares.push({ laid: beside, share: beside.panel.w / least.right });
      }
    }
  }
  if (shares.length === 0) {
    return [];
  }
  return [shares.reduce((best, next) => (next.share > best.share + 1e-9 ? next : best)).laid];
}

/**
 * The least a board's square may be, in pixels: under it a piece's glyph is a
 * blot, and what is drawn over it — a ray, an arrow — nothing at all. A
 * floor, like `MIN_TEXT_PX`, not a size the page is laid out to.
 */
export const MIN_SQUARE_PX = 10;

/** `minBoard` for a window so many pixels wide, a board being `canvasPerSquare` of its squares across, its coordinates and all. */
export function minBoardFor(widthPx: number, canvasPerSquare: number, minSquarePx = MIN_SQUARE_PX): number {
  return (minSquarePx * canvasPerSquare) / widthPx;
}

/** The least text size, in pixels, that is still read: the page's and the panel's, on a small screen. */
export const MIN_TEXT_PX = 10;

/** `minEm` for a window so many pixels wide, from the least text size in pixels that is still read. */
export function minEmFor(widthPx: number, minEmPx = MIN_TEXT_PX): number {
  return minEmPx / widthPx;
}

/** `scale` for a window so many pixels across and down: against 1400 × 950, the one the text is calibrated at. */
export function scaleFor(widthPx: number, heightPx: number): number {
  return Math.sqrt((widthPx * heightPx) / (1400 * 950));
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
    settingsEm: laid.settingsEm * widthPx,
    barEm: laid.barEm * widthPx,
    rowEm: laid.rowEm * widthPx,
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
