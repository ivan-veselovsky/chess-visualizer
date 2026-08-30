import type { Orientation } from "../visualization/geometry";
import type {
  AttackSettings,
  BoardColors,
  PieceTint,
} from "../visualization/settings";

export type {
  AttackColors,
  AttackSettings,
  BoardColors,
  KnightGeometry,
  KnightRingSettings,
  AttackGeometry,
  PieceTint,
  SideGeometry,
  SquareShading,
  OutlineColors,
  OutlineOpacity,
  OutlineWidths,
  RayOpacity,
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
export const SETTINGS_SCHEMA_VERSION = 29;

/**
 * Central description of everything the user can tweak: one object holding
 * every setting, with no partial or optional members.
 *
 * A new group is added here, given a value in every preset under `presets/`,
 * and rendered in SettingsPanel. Values themselves live in the presets, never
 * here — so there is exactly one place a setting can come from.
 */
export interface Settings {
  /** Which revision of this shape the object was written against. */
  schemaVersion: number;
  theme: Theme;
  /**
   * Text colour under the dark theme. Reaches everything the theme does — the
   * page, the panel's borders, the board's coordinate labels — since those are
   * all mixed from it.
   */
  darkThemeTextColor: string;
  boardColors: BoardColors;
  /** Which side is at the bottom of the board. */
  orientation: Orientation;
  pieceTint: PieceTint;
  /** Thin lines on the square edges, readable even with identical colours. */
  showGrid: boolean;
  /** What those lines are drawn in, when they are drawn at all. */
  gridColor: string;
  /** The bar of taken men beside the board. */
  showTakenPieces: boolean;
  /**
   * The wash laid over the two squares of the move just played, and how much of
   * it, from 0 to 1.
   *
   * One colour for both, light square and dark alike: a wash moves each of them
   * towards the same hue while leaving the difference between them showing
   * underneath, which taking a fixed share off their brightness does not — that
   * pulls the light square down towards the dark one until the board stops
   * reading as a board.
   */
  lastMoveColor: string;
  lastMoveOpacity: number;
  /**
   * Mark the two squares with the other kind of square's colour instead — dark
   * on a light square, light on a dark one.
   *
   * A rule rather than a colour, and so it takes the place of the two settings
   * above rather than sitting beside them: there is nothing to choose and
   * nothing to fade, since a mark that is half the other colour is not the
   * other colour.
   *
   * What it shows is the move's shape. A bishop's two squares are the same
   * colour and so are marked alike; a pawn's are not, and are marked as each
   * other's opposite. The board says which kind of move it was before the
   * pieces are read.
   */
  lastMoveNegative: boolean;
  /**
   * How far across that circle is, in square sides.
   *
   * Its own measure rather than the pin ring's, which the plain highlight
   * borrows. The two marks are doing different jobs: the wash tints part of a
   * square and reads as a tint whatever size it is, while this one is the
   * square's own colour turned round and so reads as a smaller square of the
   * other kind — how much of the square it covers is the whole of its effect,
   * and is worth setting on its own.
   */
  lastMoveNegativeDiameter: number;
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
