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
   * boards are larger by enough to pay for it; see `LayoutParams`. Where the
   * page may not, the panel is always fitted into what the window leaves it,
   * its text made smaller where that is what it takes.
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
   * What the panel's tabs need to show all of them — the tab row and the
   * tallest of the tabs, the lists in them at their floors — at a width and
   * a size of their text, both in units of the window's width: how tall the
   * panel is to be, and how wide for nothing in the tabs to be cut. Read off
   * what the page measured — see `panelNeeds` — at every panel the layout
   * tries, the text's size for each chosen by what it is worth: see
   * `LayoutParams`. On a page that may scroll, the panel always has what its
   * tabs need at the size its text is set at, so that nothing in it scrolls
   * as well — a scroller inside a scroller fights the page over every turn
   * of the wheel; on one that may not, what the window leaves it, its tabs
   * scrolling, down or across, where that is worth more than smaller boards
   * or smaller text. Where nothing has been measured yet, `panelMinChars`
   * across and `panelMinLines` down: see `flatNeeds`.
   */
  needs?: PanelNeeds;
  /**
   * The least side a board may have, in units of the window's width: the
   * board with squares of `MIN_SQUARE_PX`, under which a piece is a smudge.
   * Kept as E's floor is — see `groupFloor` — which on most windows is the
   * larger of the two. None, where nothing is said.
   */
  minBoard?: number;
}

/**
 * What the tabs need at `width` and text of `f`, in units of the window's
 * width: how tall a panel that wide shows all of them in — at the width
 * nothing in them is cut at, where it is narrower, the panel scrolling
 * across — and that width. See `LayoutInput.needs`.
 */
export type PanelNeeds = (width: number, f: number) => { height: number; width: number };

/**
 * Tabs that need so many ems of their text down whatever the width, and so
 * many across: the guess there is before the tabs are measured, and the tabs
 * of a test. What the real ones come to past about 50 ems across, where every
 * tab is as short as it gets.
 */
export function flatNeeds(heightEm: number, widthEm: number): PanelNeeds {
  return (_width, f) => ({ height: heightEm * f, width: widthEm * f });
}

/** The room the panel is given at least, at a size of its text: under the boards a height, beside them a width; null where none does. */
interface PanelLeast {
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
   * The panel's least width beside the boards, in characters of its text, and
   * its least height under them, in lines of it — until the tabs have been
   * measured, and in a test that measures nothing: then what was measured is
   * the least, `LayoutInput.needs`. A guess, these, and a poor one: the
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
   * where full-size tabs would wrap (see `fitStrip`):
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
   * The least the boards, their bars and their rows cover together, as a
   * share of the square on the shorter side of the room under the header:
   * see `groupFloor`. A half lets two boards stand side by side across the
   * top of a window held upright and leave it the rest. Not in ems: a ratio.
   */
  boardsShare: number;
  /** What a layout is weighed by: see `LayoutParams`. */
  params: LayoutParams;
  /**
   * The least share of the panel worth showing above the window's foot, on a
   * page that scrolls: under it, what would show is a strip of the tabs too
   * thin to use, and the strip is left blank — the stub, with an arrow on it
   * to say there is more below — and the panel starts at the foot, to be
   * scrolled to whole. Not in ems: a share of the panel's least height.
   */
  stubShare: number;
}

/**
 * What a layout is weighed by. Every way of laying the page out is tried —
 * see `layout` — and the one taken is the one worth the most:
 *
 *   m = B · e(G) / ((1 + scroll·σ(s)) · (1 + down·s_v/s₀) · (1 + across·s_h/s₀)
 *                   · (1 + panelDown·p_v/p₀) · (1 + panelAcross·p_h/p₀)
 *                   · (1 + stack·σ(stack)) · (1 + text·((f₀/f)² − 1)))
 *
 * B is the boards' area, what the page is for. Under it, each a thing a
 * reader would rather not have, which the boards have to be the larger to
 * pay for: s_v and s_h the areas of the page past the window's foot and past
 * its right edge, s₀ the window's own, so that s_v/s₀ is the length scrolled
 * down against the window's height, and s_h/s₀ the length scrolled across
 * against its width; p_v and p_h the same of the panel, where its tabs
 * scroll inside it — what of them is past its foot and past its right edge
 * — and p₀ the panel's own area, so that p_v/p₀ is the length scrolled down
 * against the panel's height, and grows without end as the panel shrinks to
 * nothing: its tabs scroll only on a page that may not; σ(s) 1 where
 * anything scrolls at all, the page or the tabs; σ(stack) 1 where two boards
 * stand one over the other; and f the size the panel's text is set at, f₀
 * its own, never under the least text there is — squared, as the text's area
 * goes. The text's size is chosen with each panel tried, for what it is
 * worth: as large as the tabs fit at, or larger and its tabs scrolling,
 * whichever the costs say.
 *
 * And e(G), E's floor: 1 where the boards, their bars and the rows over and
 * under them cover E's floor F or more — see `groupFloor` — and under it
 *
 *   e(G) = 1 + th(steepness · (G − F)/F)
 *
 * falling away with the shortfall: the steeper, the more strictly the floor
 * is held. Never quite 0, so that where nothing keeps it, the nearest to it
 * is taken. Not a cost, then, but how hard a floor.
 *
 * Every factor a ratio, so the same shape of window is laid out the same at
 * any size. With the defaults: a page that scrolls at all needs boards 1.35
 * times the area; scrolling down half a window, 1.5 times on top of that;
 * across half a window, twice — a mouse's wheel scrolls down, and across only
 * with Shift held. Two boards one over the other need 1.8 times the area:
 * they are read against each other side by side, so stacked is for a window
 * much taller than wide. The panel's text at nine tenths of its size needs
 * boards 1.47 times the area, and from 12px down to 10, 1.88 times; the tabs
 * scrolling half a panel's height more than it shows, 1.35 × 2 = 2.7 times,
 * and half a panel's width, 1.35 × 3 = 4 times: dearer than the page
 * scrolling as far.
 * And a group a tenth short of E's floor is worth about half as much, a fifth
 * short a quarter.
 *
 * Kept in the browser and set in a dialog of their own: see `layoutParams`.
 */
export interface LayoutParams {
  /** The cost of a page that scrolls at all, either way, or of tabs that scroll inside the panel. */
  scroll: number;
  /** The cost of scrolling down a whole window's height. */
  down: number;
  /** The cost of scrolling across a whole window's width. */
  across: number;
  /** The cost of two boards standing one over the other. */
  stack: number;
  /** The cost of the panel's tabs scrolling down a whole panel's height inside it: on a page that may not scroll. */
  panelDown: number;
  /** And across a whole panel's width. */
  panelAcross: number;
  /** The cost of the panel's text set smaller than its own size, as its area goes: see the rule above. */
  text: number;
  /** How steeply a layout's worth falls under E's floor: not a cost, a steepness. */
  steepness: number;
}

export const DEFAULT_LAYOUT_PARAMS: LayoutParams = { scroll: 0.35, down: 1, across: 2, panelDown: 2, panelAcross: 4, stack: 0.8, text: 2, steepness: 5 };

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
  panelMinChars: 62,
  panelMinLines: 15,
  charEm: 0.48,
  lineEm: 1.375,
  tabsEm: 29.55,
  panelMaxWidth: 100,
  boardsShare: 0.5,
  params: DEFAULT_LAYOUT_PARAMS,
  stubShare: 0.2,
};

/** Metrics where they are to differ from the defaults: any of them, and the gaps and the parameters one by one. */
export type MetricsAsked = Partial<Omit<Metrics, "gaps" | "params">> & { gaps?: Partial<Gaps>; params?: Partial<LayoutParams> };

/** The defaults, with whatever is asked laid over them. */
export function metricsOf(asked: MetricsAsked = {}): Metrics {
  return { ...DEFAULT_METRICS, ...asked, gaps: { ...DEFAULT_GAPS, ...asked.gaps }, params: { ...DEFAULT_LAYOUT_PARAMS, ...asked.params } };
}

/** How two boards stand to each other: side by side, or one over the other. */
export type Flow = "row" | "column";

/** Where the panel of tabs goes: to the right of the boards, or under them. */
export type PanelPlace = "right" | "below";

/**
 * Which way the page runs past the window, where it does: down, with the
 * panel under the boards past the window's foot, or across, with the panel
 * beside them past its right edge. Never both: see `layout`.
 */
export type ScrollAxis = "none" | "down" | "across";

export interface Layout {
  flow: Flow;
  panelPlace: PanelPlace;
  /** Whether the page is larger than the window, and scrolls: see `scrollAxis`. */
  scrolls: boolean;
  /** Which way, where it does. */
  scrollAxis: ScrollAxis;
  /** The page's text size, in units of the window's width. */
  em: number;
  /** And the panel's: see `Metrics.settingsGrowth`. */
  settingsEm: number;
  /**
   * What the panel's text is set at, against `settingsEm`: f/f₀, never over 1
   * nor under the least text there is — chosen with the panel, by what each
   * is worth; see `LayoutParams.text`. As the layout reckons it, from what the
   * tabs were measured to need: the page measures them again in the room the
   * panel has, and sets their text to what they fit at; see `usePageLayout`.
   */
  panelScale: number;
  /** Whether the tabs scroll inside the panel, down or across: see `panelDown` and `panelAcross`. */
  panelScrolls: boolean;
  /**
   * How far they scroll: what is past the panel's foot, against the panel's
   * height, and past its right edge, against its width — p_v/p₀ and p_h/p₀;
   * see `LayoutParams.panelDown`. 0 where it shows them all.
   */
  panelDown: number;
  panelAcross: number;
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
  /** How tall the page is: the window's height, or more where it scrolls down. */
  height: number;
  /** How wide: the window's width, or more where it scrolls across. */
  width: number;
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
 * What the tabs need: as measured, where they have been, and otherwise so
 * many lines of their text down and characters of it across — see
 * `panelMinChars` — the row of tabs on one line at least.
 */
function needsOf(input: LayoutInput, metrics: Metrics): PanelNeeds {
  if (input.needs !== undefined) {
    return input.needs;
  }
  return flatNeeds(metrics.panelMinLines * metrics.lineEm, Math.max(metrics.panelMinChars * metrics.charEm, metrics.tabsEm));
}

/**
 * The room the panel would have, in each place, before any layout is chosen,
 * and the sizes its text may be set at — what the page measures the tabs at
 * to say what they need: see `LayoutInput.needs`. Under the boards, its
 * width: the page's, less its sides. Beside them, its height: the window's,
 * less the header and the gaps over and under; and the most it could be
 * across there, with nothing left of the boards. The text from the least
 * there is up to its own size, `settingsEm`.
 */
export function panelRooms(input: LayoutInput): { belowWidth: number; rightHeight: number; rightMost: number; leastText: number; ownText: number } {
  const metrics = metricsOf(input.metrics);
  const { em, settingsEm } = emsOf(input, metrics);
  const g = metrics.gaps;
  const inside = 1 - 2 * g.pageSide * em;
  return {
    belowWidth: inside,
    rightHeight: input.aspect - (g.pageTop + metrics.header + g.underHeader + g.pageBottom) * em,
    rightMost: Math.min(inside - g.panel * em, metrics.panelMaxWidth * settingsEm),
    leastText: Math.min(settingsEm, input.minEm ?? 0),
    ownText: settingsEm,
  };
}

/**
 * The gaps in units of the window's width, for the `em` a page is laid out
 * at: the last asked for kept, as every way of laying one window out asks
 * the same — made anew for each, they were most of the time a layout took.
 */
let gapsKept: { ems: Gaps; em: number; gaps: Gaps } | null = null;
function gapsAt(ems: Gaps, em: number): Gaps {
  if (gapsKept === null || gapsKept.ems !== ems || gapsKept.em !== em) {
    gapsKept = { ems, em, gaps: Object.fromEntries(Object.entries(ems).map(([name, size]) => [name, size * em])) as unknown as Gaps };
  }
  return gapsKept.gaps;
}

/**
 * One way of laying the page out — the boards side by side or one over the
 * other, the panel to their right or under them, the page running on past
 * the window's foot, past its right edge, or neither — with the boards as
 * large as it lets them be, or `sideAtMost` where that is less; null where it
 * cannot be had. The panel is given `least` at least: see `roomAt`.
 */
function arranged(
  input: LayoutInput,
  metrics: Metrics,
  em: number,
  settingsEm: number,
  flow: Flow,
  panelPlace: PanelPlace,
  scroll: ScrollAxis,
  least: PanelLeast,
  sideAtMost = Infinity
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
    the padding goes to the page's own end, under the panel. Across, the
    same: the panel beside them past the window's right edge leaves them the
    page's whole width.
  */
  const across = inside - (panelPlace === "right" && scroll !== "across" ? m(g.panel) + panelMinWidth : 0);
  const under =
    panelPlace === "right"
      ? m(g.pageBottom)
      : scroll === "down"
        ? m(g.panel)
        : m(g.panel + g.pageBottom) + panelMinHeight;
  const down = aspect - above - m(g.overBoards) - under;
  /* And a board's side in that room: so many boards across it, or down it,
     the bars beside them across it and the rows over and under them down. */
  const side = Math.min(
    sideAtMost,
    flow === "row"
      ? Math.min(sideAcross(input, metrics, em, across - (boards - 1) * gap, boards), sideDown(input, metrics, down, 1))
      : Math.min(sideAcross(input, metrics, em, across, 1), sideDown(input, metrics, down - (boards - 1) * gap, boards))
  );
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
     down to the window's foot; or under them, the page's width, to the foot.
     On a page that scrolls, its least where the window has less left,
     running on past the foot or past the right edge. */
  let panel: Box;
  let stub: Box | null = null;
  if (panelPlace === "right") {
    const x = group.x + group.w + m(g.panel);
    const room = 1 - left - x;
    const h = aspect - above - m(g.pageBottom);
    panel = { x, y: above, w: Math.min(scroll === "across" ? Math.max(room, panelMinWidth) : room, ms(metrics.panelMaxWidth)), h };
    /* Only a sliver of it on the screen: the sliver left blank, and the panel
       moved along to start where the window ends. */
    if (scroll === "across" && room > 0 && room < metrics.stubShare * panelMinWidth) {
      stub = { x, y: above, w: room, h };
      panel = { ...panel, x: 1 };
    }
  } else {
    const y = group.y + group.h + m(g.panel);
    const room = aspect - m(g.pageBottom) - y;
    panel = { x: left, y, w: inside, h: scroll === "down" ? Math.max(room, panelMinHeight) : room };
    /* Only a sliver of it on the screen — a sliver of what its tabs need —
       the sliver left blank, and the panel moved down to start where the
       window ends. */
    if (scroll === "down" && room > 0 && room < metrics.stubShare * panelMinHeight) {
      stub = { x: left, y, w: inside, h: room };
      panel = { ...panel, y: aspect };
    }
  }
  /* The window's height and width themselves where nothing runs past them,
     rather than the larger of each and a sum that comes to it: the sum is as
     often a hair over as under, and a page a ten-trillionth of a pixel
     larger than the window is one a browser may give a scrollbar to. */
  const endDown = panel.y + panel.h + m(g.pageBottom);
  const endAcross = panel.x + panel.w + left;
  const scrollAxis: ScrollAxis = endDown > aspect + 1e-9 ? "down" : endAcross > 1 + 1e-9 ? "across" : "none";
  return {
    flow,
    panelPlace,
    scrolls: scrollAxis !== "none",
    scrollAxis,
    em,
    settingsEm,
    panelScale: 1,
    panelScrolls: false,
    panelDown: 0,
    panelAcross: 0,
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
    gaps: gapsAt(g, em),
    height: scrollAxis === "down" ? endDown : aspect,
    width: scrollAxis === "across" ? endAcross : 1,
  };
}

/**
 * The least the boards, their bars and the rows over and under them are to
 * cover together, whatever the panel needs: `boardsShare` of the square on
 * the shorter side of the room under the header. The bars and the rows
 * counted with the boards, as the eye takes them in. A layout under it is
 * worth the less, steeply — see `LayoutParams.steepness` — so that where it
 * can be kept it is: a page that may scroll runs on past the window instead,
 * and one that may not sets the panel's text smaller.
 */
function groupFloor(input: LayoutInput, metrics: Metrics, em: number): number {
  const g = metrics.gaps;
  const wide = 1 - 2 * g.pageSide * em;
  const tall = input.aspect - (g.pageTop + metrics.header + g.underHeader + g.pageBottom) * em;
  const shorter = Math.max(0, Math.min(wide, tall));
  return metrics.boardsShare * shorter * shorter;
}

/**
 * What a layout is worth: see `LayoutParams`. The window's area is its
 * aspect, it being 1 wide; so the area past its foot over the window's is
 * the length past it over the aspect, and the area past its right edge over
 * the window's is the length past it. The panel's own, where its tabs
 * scroll inside it, are as `Layout.panelDown` has them already.
 */
function worthOf(laid: Layout, params: LayoutParams, floor: number): number {
  const area = laid.boards.length * laid.boards[0].w * laid.boards[0].w;
  const down = laid.scrollAxis === "down" ? (laid.height - laid.aspect) / laid.aspect : 0;
  const across = laid.scrollAxis === "across" ? laid.width - 1 : 0;
  const stacked = laid.flow === "column" && laid.boards.length > 1;
  /* How far short of E's floor the group is, as a share of it: none at the floor and over it. */
  const short = floor > 0 ? Math.min(0, (laid.group.w * laid.group.h) / floor - 1) : 0;
  const kept = 1 + Math.tanh(params.steepness * short);
  return (area * kept) / ((laid.scrolls || laid.panelScrolls ? 1 + params.scroll : 1) * (1 + params.down * down) * (1 + params.across * across) * panelCost(laid, params) * (stacked ? 1 + params.stack : 1));
}

/** What the panel costs, as `worthOf` weighs it: its tabs scrolling inside it, down and across, and its text set smaller. Not its scrolling at all, which is the page's as well. */
function panelCost(panel: { panelScale: number; panelDown: number; panelAcross: number }, params: LayoutParams): number {
  return (1 + params.panelDown * panel.panelDown) * (1 + params.panelAcross * panel.panelAcross) * (1 + params.text * (1 / (panel.panelScale * panel.panelScale) - 1));
}

/**
 * How finely the boards' size and the panel's text are tried: the boards at
 * so many sizes up to their largest, where the page scrolls or the panel is
 * given what the boards leave it, and the text at so many sizes from the
 * least there is up to its own; then, around the best of them, as many again
 * between the two either side, of each. Smaller boards are smaller in the
 * worth, and in what runs past the window too — there is a size at which the
 * panel comes up onto the screen, the page then not scrolling at all — so
 * the best of a layout that may scroll can be short of its largest boards;
 * and smaller text gives the boards more room, and a shorter page.
 */
const SIZES = 32;
const TEXTS = 8;
const FINER = 16;

/** How finely the size the tabs just fit at is found, halving: to a part in 2¹⁴ of what is left between the least and the whole. */
const FIT_STEPS = 14;

/** The least the panel's text may be set at, as a share of its own size: see `LayoutInput.minEm`. */
function leastShare(input: LayoutInput, settingsEm: number): number {
  return Math.min(1, (input.minEm ?? 0) / settingsEm);
}

/**
 * The narrowest the panel can be beside the boards, `height` tall, for its
 * tabs to show whole at text of `f`: from the width nothing in them is cut
 * at, halved down to; null where even `most` is too narrow — the tabs taller
 * than the panel at every width it may have.
 */
function widthFor(needs: PanelNeeds, f: number, height: number, most: number): number | null {
  const least = needs(most, f).width;
  if (!(least <= most) || needs(most, f).height > height) {
    return null;
  }
  if (needs(least, f).height <= height) {
    return least;
  }
  let low = least;
  let high = most;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (needs(middle, f).height <= height) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return high;
}

/**
 * The room the panel is to be given at text of `f`, for its tabs to show
 * whole: under the boards, as tall as they are at the page's width; beside
 * them, as wide as they fit the window's height at — null where no width the
 * panel may have there does, `most` the widest: past the window's right
 * edge, where the page scrolls across, as wide as a panel may be at all.
 */
function roomAt(needs: PanelNeeds, rooms: ReturnType<typeof panelRooms>, f: number, most = rooms.rightMost): PanelLeast {
  return { below: needs(rooms.belowWidth, f).height, right: widthFor(needs, f, rooms.rightHeight, most) };
}

/**
 * The room the panel's tabs need at their own size, in units of the window's
 * width: under the boards, how tall at the page's width; beside them, how
 * wide at the window's height, null where no width the panel may have there
 * shows them whole. What the page says it measured, for whoever checks that
 * a panel was given it.
 *
 * `across` where the page scrolls across: the panel may then run past the
 * window's right edge, as wide as a panel may be at all, as the layout lets
 * it — see `roomFor` in `layout`. Without it, a phone's panel beside its
 * boards, past the window's edge, was said to have no width that would do.
 */
export function panelLeastOf(input: LayoutInput, across = false): { below: number; right: number | null } {
  const metrics = metricsOf(input.metrics);
  const rooms = panelRooms(input);
  return roomAt(needsOf(input, metrics), rooms, rooms.ownText, across ? metrics.panelMaxWidth * rooms.ownText : rooms.rightMost);
}

/**
 * A layout's panel, its text at the size worth the most in the room it has:
 * as large as its tabs show whole at, up to its own; or, where the page may
 * not scroll and `mayScroll` says so, larger than that, or at any size down
 * to the least, its tabs scrolling inside it — whichever the costs say. Null
 * where its tabs show whole at no size and may not scroll.
 *
 * `fitting`, where known, is a share of the text the tabs show whole at, for
 * the size they just fit at to be halved down to from there.
 */
function withPanel(laid: Layout, needs: PanelNeeds, lowest: number, params: LayoutParams, mayScroll: boolean, fitting = lowest): Layout | null {
  const { w, h } = laid.panel;
  if (!(w > 0 && h > 0)) {
    return null;
  }
  /* The tabs at a share of their text: how far past the panel's right edge,
     where it is narrower than nothing in them is cut at, and so shown that
     wide; and past its foot. */
  const at = (share: number) => {
    const f = laid.settingsEm * share;
    const here = needs(w, f);
    const panelAcross = here.width > w * (1 + 1e-9) ? (here.width - w) / w : 0;
    const tall = panelAcross > 0 ? needs(here.width, f).height : here.height;
    const panelDown = tall > h * (1 + 1e-9) ? (tall - h) / h : 0;
    return { panelScale: share, panelDown, panelAcross };
  };
  const whole = (share: number) => {
    const seen = at(share);
    return seen.panelDown === 0 && seen.panelAcross === 0;
  };
  let best: { panelScale: number; panelDown: number; panelAcross: number; cost: number } | null = null;
  const consider = (share: number) => {
    const seen = at(share);
    const scrolls = seen.panelDown > 0 || seen.panelAcross > 0;
    if (scrolls && !mayScroll) {
      return;
    }
    const cost = (scrolls ? 1 + params.scroll : 1) * panelCost(seen, params);
    if (best === null || cost < best.cost * (1 - 1e-12)) {
      best = { ...seen, cost };
    }
  };
  /* The largest share they show whole at: all of it, or halved down to. */
  if (whole(1)) {
    consider(1);
  } else if (whole(fitting)) {
    let low = fitting;
    let high = 1;
    for (let step = 0; step < FIT_STEPS; step += 1) {
      const middle = (low + high) / 2;
      if (whole(middle)) {
        low = middle;
      } else {
        high = middle;
      }
    }
    consider(low);
  }
  /* And where they may scroll, every size, then finer about the best of them. */
  if (mayScroll && lowest < 1) {
    let around = 0;
    let aroundCost = Infinity;
    for (let step = 0; step <= TEXTS; step += 1) {
      consider(lowest + ((1 - lowest) * step) / TEXTS);
      const cost = best === null ? Infinity : (best as { cost: number }).cost;
      if (cost < aroundCost) {
        aroundCost = cost;
        around = step;
      }
    }
    for (let finer = 1; finer < 2 * FINER; finer += 1) {
      const step = around + finer / FINER - 1;
      if (finer !== FINER && step >= 0 && step <= TEXTS) {
        consider(lowest + ((1 - lowest) * step) / TEXTS);
      }
    }
  } else if (mayScroll) {
    consider(1);
  }
  if (best === null) {
    return null;
  }
  const { panelScale, panelDown, panelAcross } = best;
  return { ...laid, panelScale, panelDown, panelAcross, panelScrolls: panelDown > 0 || panelAcross > 0 };
}

/**
 * The layout for a window of the shape asked: of every one that can be had,
 * the one worth the most — see `LayoutParams`. Every one of them is
 *
 *   - the boards side by side or, two of them, one over the other;
 *   - the panel to their right or under them;
 *   - where the page may scroll, as well the panel under them run on past the
 *     window's foot, or beside them run on past its right edge — never both:
 *     F, the page scrolls one way at most;
 *   - the panel given the room its tabs need at every size of its text from
 *     the least there is up to its own — see `roomAt` — and the boards as
 *     large as that leaves them; where the page scrolls, at every size up to
 *     that as well;
 *   - and where the page may not scroll, the boards at every size, and held
 *     at E's floor — see `atFloor` — the panel given the rest, however
 *     little that is;
 *
 * and in each, the panel's text at the size worth the most in the room it
 * has, its tabs scrolling inside it where the page may not scroll and that
 * is worth the more: see `withPanel`.
 *
 * Squares of `minBoard` at least, where any layout has them: under that a
 * piece is a smudge, which no worth makes up for. Where two come out the
 * same, the first in the order tried: a page that fits before one that
 * scrolls, the panel to the right before under, the boards side by side
 * before one over the other, smaller text before larger, smaller boards
 * before larger.
 *
 * `branches`, where given, is told the best of each way tried, by its name —
 * `${scroll} ${place} ${flow}`, and `floor ${place} ${flow}` for the boards
 * held at E's floor — and what it is worth: for whoever would see what each
 * came to, as the layout playground does.
 */
export function layout(input: LayoutInput, branches?: Map<string, { laid: Layout; worth: number }>): Layout {
  const metrics = metricsOf(input.metrics);
  const { em, settingsEm } = emsOf(input, metrics);
  const needs = needsOf(input, metrics);
  const rooms = panelRooms(input);
  const floor = groupFloor(input, metrics, em);
  const minBoard = input.minBoard ?? 0;
  const lowest = leastShare(input, settingsEm);
  const params = metrics.params;
  const texts = lowest >= 1 ? 0 : TEXTS;
  const shareAt = (step: number) => (texts === 0 ? 1 : lowest + ((1 - lowest) * step) / texts);
  /* The room the panel is given at each step of its text, worked out once for every way of laying the page out. */
  const roomsAt = new Map<string, PanelLeast>();
  const roomFor = (step: number, scroll: ScrollAxis): PanelLeast => {
    const key = `${step} ${scroll === "across"}`;
    let room = roomsAt.get(key);
    if (room === undefined) {
      room = roomAt(needs, rooms, settingsEm * shareAt(step), scroll === "across" ? metrics.panelMaxWidth * settingsEm : rooms.rightMost);
      roomsAt.set(key, room);
    }
    return room;
  };
  /* The best of those with boards of their least size or more, and the best of all, for where none has; and, for where none
     shows the tabs whole on a page that may scroll — a window too small for anything — the best with them scrolling. */
  const best: { kept: { laid: Layout; worth: number } | null; any: { laid: Layout; worth: number } | null; forced: { laid: Layout; worth: number } | null } = {
    kept: null,
    any: null,
    forced: null,
  };
  const force = (laid: Layout | null) => {
    if (laid !== null) {
      const worth = worthOf(laid, params, floor);
      if (best.forced === null || worth > best.forced.worth * (1 + 1e-9)) {
        best.forced = { laid, worth };
      }
    }
  };
  let branch = "";
  const weigh = (laid: Layout | null): number => {
    if (laid === null) {
      return -Infinity;
    }
    const worth = worthOf(laid, params, floor);
    if (branches !== undefined && laid.boards[0].w >= minBoard - 1e-9 && worth > (branches.get(branch)?.worth ?? -Infinity)) {
      branches.set(branch, { laid, worth });
    }
    if (best.any === null || worth > best.any.worth * (1 + 1e-9)) {
      best.any = { laid, worth };
    }
    if (laid.boards[0].w < minBoard - 1e-9) {
      return -Infinity;
    }
    if (best.kept === null || worth > best.kept.worth * (1 + 1e-9)) {
      best.kept = { laid, worth };
    }
    return worth;
  };
  /*
    Whether a layout worth at most `bound` can be passed over: where one that
    keeps the boards' floor has been found already, and is worth as much — the
    layout could not be taken over it. Every factor of the worth but the
    boards' area and E's is a cost of 1 or more, and E's is 1 at most: so the
    boards' area alone, less what is fixed already — two boards stacked — is
    as much as a layout with boards that large can be worth, and a layout's
    worth with its panel free — its text whole, nothing scrolling inside it —
    as much as it can be worth whatever its panel comes to. Passed over, they
    are never weighed: most of a page that may scroll is boards too large to
    be worth their scrolling, or too small to be worth more than what fits.
    Not where every way's best is asked for: see `branches`.
  */
  const beaten = (bound: number): boolean => branches === undefined && best.kept !== null && bound <= best.kept.worth * (1 + 1e-9);
  /* The most a layout with boards `side` across can be worth: see `beaten`. */
  const atMost = (side: number, flow: Flow) => (input.boards * side * side) / (flow === "column" && input.boards > 1 ? 1 + params.stack : 1);
  /* And with its panel free. */
  const freeWorth = (laid: Layout) => worthOf(laid, params, floor);
  /* Each size of a family of layouts tried, then finer about the best of them. */
  const search = (count: number, laidAt: (size: number) => Layout | null) => {
    let around = count;
    let aroundWorth = -Infinity;
    for (let size = 1; size <= count; size += 1) {
      const worth = weigh(laidAt(size));
      if (worth > aroundWorth) {
        aroundWorth = worth;
        around = size;
      }
    }
    if (aroundWorth > -Infinity) {
      for (let finer = 1; finer < 2 * FINER; finer += 1) {
        const size = around + finer / FINER - 1;
        if (finer !== FINER && size > 0 && size <= count) {
          weigh(laidAt(size));
        }
      }
    }
  };
  const flows = input.boards === 2 ? (["row", "column"] as const) : (["row"] as const);
  const none: PanelLeast = { below: 0, right: 0 };
  for (const scroll of input.scrollable ? (["none", "down", "across"] as const) : (["none"] as const)) {
    for (const panelPlace of ["right", "below"] as const) {
      if ((scroll === "down" && panelPlace === "right") || (scroll === "across" && panelPlace === "below")) {
        continue;
      }
      for (const flow of flows) {
        branch = `${scroll} ${panelPlace} ${flow}`;
        /* At so many steps of the text, the boards so many `SIZES` of their largest at it. */
        const largest = new Map<number, Layout | null>();
        const at = (step: number, size: number): Layout | null => {
          const room = roomFor(step, scroll);
          let most = largest.get(step);
          if (most === undefined) {
            most = arranged(input, metrics, em, settingsEm, flow, panelPlace, scroll, room);
            largest.set(step, most);
          }
          if (most === null) {
            return null;
          }
          if (size < SIZES && beaten(atMost((most.boards[0].w * size) / SIZES, flow))) {
            return null;
          }
          const laid = size >= SIZES ? most : arranged(input, metrics, em, settingsEm, flow, panelPlace, scroll, room, (most.boards[0].w * size) / SIZES);
          if (laid === null || beaten(freeWorth(laid))) {
            return null;
          }
          const whole = withPanel(laid, needs, lowest, params, false, shareAt(step));
          if (whole === null && input.scrollable && best.kept === null && best.any === null) {
            force(withPanel(laid, needs, lowest, params, true));
          }
          return whole;
        };
        /* A page that fits is worth the more the larger its boards: its largest is its best. */
        const sizes = scroll === "none" ? [SIZES] : Array.from({ length: SIZES }, (_, index) => index + 1);
        let around = { step: 0, size: SIZES, worth: -Infinity };
        const tried = (step: number, size: number) => {
          const worth = weigh(at(step, size));
          if (worth > around.worth) {
            around = { step, size, worth };
          }
        };
        for (let step = 0; step <= texts; step += 1) {
          for (const size of sizes) {
            tried(step, size);
          }
        }
        /* Then finer, either side of the best of them: the boards' size at its text, and the text at its boards' size. */
        if (around.worth > -Infinity) {
          const { step, size } = around;
          for (let finer = 1; finer < 2 * FINER; finer += 1) {
            const shift = finer / FINER - 1;
            if (finer === FINER) {
              continue;
            }
            if (scroll !== "none" && size + shift > 0 && size + shift < SIZES) {
              tried(step, size + shift);
            }
            if (texts > 0 && step + shift >= 0 && step + shift <= texts) {
              tried(step + shift, size);
            }
          }
        }
        /* And on a page that may not scroll, the boards at every size, the panel what they leave. */
        if (!input.scrollable) {
          const most = arranged(input, metrics, em, settingsEm, flow, panelPlace, "none", none);
          if (most !== null) {
            search(SIZES, (size) => {
              if (beaten(atMost((most.boards[0].w * size) / SIZES, flow))) {
                return null;
              }
              const laid = arranged(input, metrics, em, settingsEm, flow, panelPlace, "none", none, (most.boards[0].w * size) / SIZES);
              return laid === null || beaten(freeWorth(laid)) ? null : withPanel(laid, needs, lowest, params, true);
            });
          }
        }
      }
    }
  }
  /* And on a page that may not scroll, the boards at E's floor, the panel what that leaves. */
  if (!input.scrollable) {
    for (const { key, laid } of atFloor(input, metrics, em, settingsEm, flows, floor, minBoard)) {
      const [flow, place] = key.split(" ");
      branch = `floor ${place} ${flow}`;
      weigh(beaten(freeWorth(laid)) ? null : withPanel(laid, needs, lowest, params, true));
    }
  }
  const taken = best.kept ?? best.any ?? best.forced;
  if (taken === null) {
    throw new Error(`No layout fits a window of aspect ${input.aspect}`);
  }
  return taken.laid;
}

/**
 * Each way of laying the page out with the boards at E's floor — see
 * `groupFloor` — and the panel the rest of the window, on a page that does
 * not scroll: the boards as small as they may be without falling under it,
 * so the panel as large as it may be, for where it needs more than the
 * window leaves it with the boards any larger. By a name of its own,
 * `${flow} ${place}`.
 */
function atFloor(
  input: LayoutInput,
  metrics: Metrics,
  em: number,
  settingsEm: number,
  flows: readonly Flow[],
  floor: number,
  minBoard: number
): { key: string; laid: Layout }[] {
  const none: PanelLeast = { below: 0, right: 0 };
  const found: { key: string; laid: Layout }[] = [];
  for (const panelPlace of ["right", "below"] as const) {
    for (const flow of flows) {
      const most = arranged(input, metrics, em, settingsEm, flow, panelPlace, "none", none);
      if (most === null) {
        continue;
      }
      /* The side whose group covers the floor, halved down to: the group grows
         with the side, so one side does it. */
      const area = (side: number) => {
        const at = arranged(input, metrics, em, settingsEm, flow, panelPlace, "none", none, side);
        return at === null ? 0 : at.group.w * at.group.h;
      };
      let low = 0;
      let high = most.boards[0].w;
      if (area(high) > floor) {
        for (let step = 0; step < 50; step += 1) {
          const middle = (low + high) / 2;
          if (area(middle) >= floor) {
            high = middle;
          } else {
            low = middle;
          }
        }
      }
      const side = Math.min(Math.max(high, minBoard), most.boards[0].w);
      const laid = arranged(input, metrics, em, settingsEm, flow, panelPlace, "none", none, side);
      if (laid !== null && laid.panel.w > 0 && laid.panel.h > 0) {
        found.push({ key: `${flow} ${panelPlace}`, laid });
      }
    }
  }
  return found;
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

/**
 * The least text size, in pixels, that is still read: the page's and the
 * panel's, on a small screen. 9: 10 before, then 8 on trial — how far the
 * panel's text can be set smaller before its tabs scroll, and whether a
 * browser's own least font size holds it up — which read too small.
 */
export const MIN_TEXT_PX = 9;

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
    width: laid.width * widthPx,
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
