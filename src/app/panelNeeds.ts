/**
 * What the panel of tabs needs to show all of them, at any width and any size
 * of its text: read off a table of what the page measured, so that the layout
 * can ask it of every panel it tries — hundreds of them — where measuring the
 * tabs themselves takes a millisecond or more a time. See `usePanelLeast`,
 * which measures it, and `LayoutInput.needs`, which is asked it.
 *
 * In pixels throughout, and the same for every window: the tabs at a given
 * size of their text, in a panel of a given width, take the same room
 * whatever the window or the page's own text — measured so — and whatever the
 * browser's zoom. What changes them is what is in them, and the fonts.
 *
 * Written with its extensions, like the other modules `tests/unit.mjs` runs
 * straight from the TypeScript.
 */

/**
 * The tabs at one size of their text, measured: how tall the tallest of them
 * is, with the row of tabs over it, at each width tried — as many ems of its
 * text, in ems of it, which is what scales with the text and so what the
 * table is read in between sizes — and the narrowest width nothing in them is
 * cut at: the row of tabs on one line, the Lab tab's FEN field and the
 * library's names shown, no tab wider than the panel.
 */
export interface NeedsRow {
  /** The text's size, in pixels. */
  f: number;
  /** The narrowest width nothing is cut at, in ems of the text; Infinity where no width is. */
  uncut: number;
  /** Widths tried, in ems of the text, ascending; and how tall the tabs are at each, in ems of it. */
  widths: number[];
  heights: number[];
}

/**
 * Every size of the text measured, ascending: see `NeedsRow`. And the tabs
 * measured at a width and a size exactly, each in pixels: where a window put
 * its panel under the boards at the panel's own size of text, the panel most
 * often is — read as they are, rather than between rows, which can miss by a
 * pixel or two, and a panel given a pixel too little sets its text smaller.
 * The latest `EXACT_POINTS` of them.
 */
export interface NeedsTable {
  rows: NeedsRow[];
  points: { width: number; f: number; height: number }[];
}

/**
 * At most so many points measured exactly, the oldest dropped: see
 * `NeedsTable.points`. Each a few dozen bytes, kept in the browser with the
 * rows, and found by halving — see `PointIndex`. Every window gone back to
 * that still has its own is a window not measured again; but a point stands
 * for any window within `POINT_REACH` of it, so a few dozen windows' worth
 * covers most of what a reader goes back to — and 512 made a layout a fifth
 * slower than 128 does, for windows seldom gone back to.
 */
export const EXACT_POINTS = 128;

/**
 * The point measured at `width` — to the whole pixel, as the page measures
 * at, a panel never narrower than that and so never needing more — and `f`,
 * to the hundredth of one; undefined where there is none.
 */
export function pointAt(table: NeedsTable, width: number, f: number): { width: number; f: number; height: number } | undefined {
  return table.points.find((point) => Math.floor(point.width) === Math.floor(width) && Math.abs(point.f - f) < 0.005);
}

/** How far from a point measured exactly a width may be for the point to put the rows right there: see `pointNear`. */
export const POINT_REACH = 0.03;

/** The same as a ratio, the wider of two widths to the narrower: what is compared, rather than a logarithm worked out every time. */
const REACH_RATIO = Math.exp(POINT_REACH);

type Point = { width: number; f: number; height: number };

/**
 * A table's points, ordered by their width, and each with how far the rows
 * read there were out — the measured height over theirs — so that the layout,
 * asking the table thousands of times a window, finds the points near a
 * width by halving rather than looking at every one, and reads how far the
 * rows were out at one rather than reading the rows again. Worked out once
 * for each table, which is never changed — a point more is a table more,
 * see `withPoint` — and dropped with it.
 */
interface PointIndex {
  points: Point[];
  widths: number[];
  /** Where each point is in the table's own list: of two as near, the one earlier there is taken, as it always was. */
  order: number[];
  outs: number[];
}

const indexes = new WeakMap<NeedsTable, PointIndex>();

function indexOf(table: NeedsTable): PointIndex {
  let index = indexes.get(table);
  if (index === undefined) {
    const sorted = table.points.map((point, at) => ({ point, at })).sort((a, b) => a.point.width - b.point.width);
    index = {
      points: sorted.map(({ point }) => point),
      widths: sorted.map(({ point }) => point.width),
      order: sorted.map(({ at }) => at),
      outs: sorted.map(({ point }) => point.height / betweenRows(table, point.width, point.f).height),
    };
    indexes.set(table, index);
  }
  return index;
}

/** Where in the index the point nearest `width` and `f` is: -1 where none is within reach. See `pointNear`. */
function nearIn(index: PointIndex, width: number, f: number): number {
  const { points, widths, order } = index;
  /* The first point that may be within reach: halved down to, a pixel under the reach for those at the same whole pixel. */
  const from = width / REACH_RATIO - 1;
  let low = 0;
  let high = widths.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (widths[middle] < from) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const to = width * REACH_RATIO + 1;
  let near = -1;
  let nearest = Infinity;
  for (let at = low; at < widths.length && widths[at] <= to; at += 1) {
    const point = points[at];
    const off = point.width > width ? point.width / width : width / point.width;
    if (off > REACH_RATIO && Math.floor(point.width) !== Math.floor(width)) {
      continue;
    }
    /* How far, as a share, in width and in size together: the product of the two ratios, as the sum of their logarithms. */
    const distance = off * (point.f > f ? point.f / f : f / point.f);
    if (distance < nearest || (distance === nearest && order[at] < order[near])) {
      nearest = distance;
      near = at;
    }
  }
  return near;
}

/**
 * Of the points measured within `POINT_REACH` of `width`, the nearest — by
 * how far, as a share, in width and in size of text together; undefined
 * where there is none. What it says of how far the rows are out holds near
 * it as well: a panel a few pixels wider or narrower wraps much the same.
 */
export function pointNear(table: NeedsTable, width: number, f: number): Point | undefined {
  const index = indexOf(table);
  const near = nearIn(index, width, f);
  return near < 0 ? undefined : index.points[near];
}

/** A table with a point more, over one at the same width and size, and the oldest dropped past `EXACT_POINTS`. */
export function withPoint(table: NeedsTable, width: number, f: number, height: number): NeedsTable {
  const others = table.points.filter((point) => point !== pointAt(table, width, f));
  return { ...table, points: [...others, { width, f, height }].slice(-EXACT_POINTS) };
}

/** What the tabs need at a width and a size of their text: how tall a panel shows all of them, and how wide it has to be for nothing in them to be cut. */
export interface Needs {
  height: number;
  width: number;
}

/**
 * The sizes of the text the table is measured at, in pixels: a row for each
 * of those either side of whatever is asked of it, so that a size between
 * two is read between them. Apart by about a quarter, the tabs needing much
 * the same in ems at sizes that close — they scale with their text but for a
 * pixel's border here and there.
 */
export const ROW_SIZES = [8, 10, 13, 17, 22, 28, 36];

/**
 * The widths each row is measured at, in ems of its text: closer where the
 * tabs grow quickly as the panel narrows, wider apart where they stop
 * growing — past about 50, every tab is as short as it gets. Under the least
 * a panel is ever given, and over the most, the nearest is taken.
 */
export const ROW_WIDTHS = [20, 25, 30, 36, 43, 52, 75, 130];

/** At most so many widths a row keeps besides its own: measured where a window had its panel, and dropped longest unused first. Read by halving: see `heightIn`. */
export const ROW_EXTRA_WIDTHS = 64;

/** The rows of the sizes either side of `f`, and how far between them it is: the one row and 0 under the first and over the last. */
function rowsAround(table: NeedsTable, f: number): { low: NeedsRow; high: NeedsRow; at: number } {
  const rows = table.rows;
  if (f <= rows[0].f) {
    return { low: rows[0], high: rows[0], at: 0 };
  }
  for (let index = 1; index < rows.length; index += 1) {
    if (f <= rows[index].f) {
      const low = rows[index - 1];
      const high = rows[index];
      return { low, high, at: (f - low.f) / (high.f - low.f) };
    }
  }
  const last = rows[rows.length - 1];
  return { low: last, high: last, at: 0 };
}

/** How tall the tabs are at `width` ems, in ems: between the widths measured either side, and the nearest's outside them. The two either side found by halving. */
function heightIn(row: NeedsRow, width: number): number {
  const { widths, heights } = row;
  if (width <= widths[0]) {
    return heights[0];
  }
  if (width > widths[widths.length - 1]) {
    return heights[heights.length - 1];
  }
  /* The first width at or over it: one at least, the last being. */
  let low = 1;
  let high = widths.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (widths[middle] < width) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const share = (width - widths[low - 1]) / (widths[low] - widths[low - 1]);
  return heights[low - 1] + (heights[low] - heights[low - 1]) * share;
}

/**
 * What the tabs need at `width` pixels across, at text of `f` pixels: read
 * in ems of the text, between the two sizes measured either side of it, and
 * at the width nothing is cut at where `width` is narrower — the panel then
 * scrolling across to show them at that. As measured, where it was exactly,
 * and put right by it at other sizes at the same width: see
 * `NeedsTable.points`.
 */
export function needsAt(table: NeedsTable, width: number, f: number): Needs {
  const between = betweenRows(table, width, f);
  /* Where a point was measured at this width or near it, the rows read here put right by as much as they were out at
     it: the same at its own width and size, and near them by as much — so that no width or size a hair off it reads
     less, for the room it would save. */
  if (table.points.length > 0 && width >= between.width) {
    const index = indexOf(table);
    const near = nearIn(index, width, f);
    if (near >= 0) {
      return { height: between.height * index.outs[near], width: between.width };
    }
  }
  return between;
}

/** What the rows say the tabs need at `width` and `f`, read between them: see `needsAt`. */
function betweenRows(table: NeedsTable, width: number, f: number): Needs {
  const { low, high, at } = rowsAround(table, f);
  const uncut = low.uncut + (high.uncut - low.uncut) * at;
  const shown = Math.max(width / f, Number.isFinite(uncut) ? uncut : 0);
  const height = heightIn(low, shown) + (heightIn(high, shown) - heightIn(low, shown)) * at;
  return { height: height * f, width: uncut * f };
}

/** Whether the table can be read at sizes from `least` up to `most`: a row at or under the one, and at or over the other. */
export function covers(table: NeedsTable | null, least: number, most: number): boolean {
  return table !== null && table.rows.length > 0 && table.rows[0].f <= least + 1e-9 && table.rows[table.rows.length - 1].f >= most - 1e-9;
}

/** The sizes of `ROW_SIZES` a table has to have rows at to be read from `least` up to `most`: those either side of each, and all between. */
export function rowSizesFor(least: number, most: number): number[] {
  const under = ROW_SIZES.filter((f) => f <= least + 1e-9);
  const over = ROW_SIZES.filter((f) => f >= most - 1e-9);
  const from = under.length > 0 ? under[under.length - 1] : ROW_SIZES[0];
  const to = over.length > 0 ? over[0] : ROW_SIZES[ROW_SIZES.length - 1];
  return ROW_SIZES.filter((f) => f >= from && f <= to);
}

/**
 * A row with a width more measured: in its place among the others, or over
 * one measured at the same width; and where that makes more than its own and
 * `ROW_EXTRA_WIDTHS`, the one of those added longest ago dropped. `added`
 * says in which order those were added, oldest first.
 */
export function withWidth(row: NeedsRow, added: number[], width: number, height: number): { row: NeedsRow; added: number[] } {
  const pairs = row.widths.map((at, index) => [at, row.heights[index]] as const).filter(([at]) => Math.abs(at - width) > 1e-9);
  let order = [...added.filter((at) => Math.abs(at - width) > 1e-9), width];
  if (order.length > ROW_EXTRA_WIDTHS) {
    const dropped = order[0];
    order = order.slice(1);
    const kept = pairs.filter(([at]) => Math.abs(at - dropped) > 1e-9);
    pairs.length = 0;
    pairs.push(...kept);
  }
  pairs.push([width, height]);
  pairs.sort((a, b) => a[0] - b[0]);
  return { row: { ...row, widths: pairs.map(([at]) => at), heights: pairs.map(([, at]) => at) }, added: order };
}

/**
 * A map that keeps at most `limit` entries, dropping the one used longest ago
 * to take another: what the page keeps of the tables, each for what the tabs
 * held when it was measured, and of what it measured in a room, so that a
 * window gone back to is not measured again — never more than so much.
 */
export class Lru<K, V> {
  private readonly entries = new Map<K, V>();
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value as K;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  /** Every entry, the one used longest ago first. */
  all(): [K, V][] {
    return [...this.entries.entries()];
  }
}
