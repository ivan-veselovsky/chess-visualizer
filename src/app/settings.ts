import type {
  AttackSettings,
  BoardColors,
  GridLines,
  HedgeLines,
  MoveMotion,
  LastMoveMark,
  PieceTint,
} from "../visualization/settings";

export type {
  AttackColors,
  AttackSettings,
  BoardColors,
  GridLines,
  HedgeLines,
  MoveMotion,
  KnightGeometry,
  LastMoveMark,
  KnightRingSettings,
  AttackGeometry,
  PieceTint,
  SideGeometry,
  Heatmap,
  HeatmapStrength,
  PinMarks,
  CheckMarks,
  OutlineColors,
  OutlineOpacity,
  OutlineWidths,
  RayOpacity,
  RaySettings,
  RayShape,
  RayStyle,
} from "../visualization/settings";

/**
 * Which palette the page itself uses. It reaches the frame behind everything,
 * the settings panel, and the board's coordinate labels — nothing that the board
 * colour and piece settings already decide, so a board looks the same either way.
 */
export type Theme = "light" | "dark";

/**
 * What `Settings` currently looks like: a whole number, raised by one whenever
 * the shape changes in a way an older saved object would not survive — a field
 * renamed, removed, or given a different meaning.
 *
 * That is all a schema version needs to do here. Settings restored from outside
 * this build can be recognised and migrated rather than silently misread, and a
 * plain integer both compares and orders correctly, which a dotted string does
 * not without a parser.
 *
 * Carried inside `Settings` itself, not just declared here, so it travels with
 * the settings wherever they are written to.
 */
export const SETTINGS_SCHEMA_VERSION = 47;

/**
 * The board itself: the ground every mark is drawn on, and nothing that is
 * drawn over it.
 *
 * Grouped as the panel groups them, one node per tab, so that finding a setting
 * in the object and finding it on the screen are the same search. The theme is
 * in here because that is where it is set and because the board is most of what
 * it colours, though it reaches the page around it too.
 */
export interface BoardSettings {
  theme: Theme;
  /**
   * Text colour under the dark theme. Reaches everything the theme does — the
   * page, the panel's borders, the board's coordinate labels — since those are
   * all mixed from it.
   */
  darkThemeTextColor: string;
  squares: BoardColors;
  /** The mark on the two squares the last move used. */
  lastMove: LastMoveMark;
  /** Hatching over the dark squares, which tells them apart without a colour. */
  hedging: HedgeLines;
  /** Thin lines on the square edges, readable even with identical colours. */
  grid: GridLines;
}

/**
 * The men: how they are coloured, whether the ones taken are shown, and how
 * they move.
 *
 * The fade is here rather than beside a mark of its own because it is one clock
 * for every mark there is, and because it is set on this tab, under the two
 * rates that say how a piece travels — how fast the board answers a move,
 * beside how fast the move itself goes.
 */
export interface PieceSettings {
  tint: PieceTint;
  /** The bar of captured men beside the board. */
  showCaptured: boolean;
  /** How a piece travels between squares when a move is played. */
  moveMotion: MoveMotion;
  /**
   * How long a change to the board's colouring takes to cross, in
   * milliseconds — every mark on it, by one clock: the wash on the squares,
   * the rays, the check disc, the last move's spots, the pin rings.
   *
   * A position changes all of them at once, and drawn instantly that reads as a
   * flash rather than as a board being redrawn; given a tenth of a second it
   * reads as the board settling into what it now says.
   *
   * Both ends of its range are wrong in obvious ways — nought is the flash this
   * was written to remove, and anything past a fifth of a second reads as a
   * board slow to answer — so it is set in milliseconds rather than offered as
   * a slider between two extremes nobody wants.
   */
  fadeTimeMs: number;
}

/**
 * Central description of everything the user can tweak: one object holding
 * every setting, with no partial or optional members.
 *
 * Its groups are the panel's tabs — the board, the men, the marks drawn over
 * them — so a setting is found in the same place either way round.
 *
 * A new group is added here, given a value in every preset under `presets/`,
 * and rendered in SettingsPanel. Values themselves live in the presets, never
 * here — so there is exactly one place a setting can come from.
 */
/**
 * Reading a game rather than drawing a position: the pace one plays itself at,
 * and what a link handed to somebody else asks their copy to do.
 *
 * Both are set on the Lab tab, where a game is stepped through and shared,
 * which is what makes them a group and what they are named after.
 */
export interface LabSettings {
  /**
   * How long each position is left standing when a game plays itself, in
   * seconds — counted from the moment a piece lands to the moment the next one
   * sets off, so a move slower than this is never cut in half by the next.
   *
   * A reader's pace through a game rather than a piece's pace across the board,
   * which is `pieces.moveMotion`'s business.
   */
  playPeriodPerPositionSec: number;
  /**
   * Whether a shared game link sets the game playing on arrival.
   *
   * The link carries the answer, and whoever opens it plays at their own pace —
   * this says what the link is built to ask for. Remembered rather than reset
   * with every visit: somebody who shares games shares them the same way twice.
   */
  shareGameWithAutoplay: boolean;
}

export interface Settings {
  /** Which revision of this shape the object was written against. */
  schemaVersion: number;
  board: BoardSettings;
  pieces: PieceSettings;
  lab: LabSettings;
  attacks: AttackSettings;
}

/**
 * Parses a number, or null when the input is not usable. Zero is rejected
 * unless `allowZero` is set — a zero radius is degenerate, but a zero inner
 * stripe width is meaningful.
 */
export function parseNumber(input: string, allowZero = false): number | null {
  const trimmed = input.trim();
  const value = Number(trimmed);
  if (trimmed === "" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  if (value === 0 && !allowZero) {
    return null;
  }
  return value;
}
