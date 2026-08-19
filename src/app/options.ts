import type { Orientation } from "../visualization/geometry";
import type {
  AttackOptions,
  BoardColors,
  PieceTint,
} from "../visualization/options";

export type {
  AttackColors,
  AttackOptions,
  BoardColors,
  KnightRingOptions,
  AttackGeometry,
  PieceTint,
  SideGeometry,
  OutlineWidths,
  RayOpacity,
  StripeStyle,
} from "../visualization/options";

/**
 * Which palette the page itself uses. It reaches the frame behind everything,
 * the options panel, and the board's coordinate labels — nothing that the board
 * colour and piece options already decide, so a board looks the same either way.
 */
export type Theme = "light" | "dark";

/**
 * What `Options` currently looks like: a whole number, raised by one whenever
 * the shape changes in a way an older saved object would not survive — a field
 * renamed, removed, or given a different meaning.
 *
 * That is all a schema version needs to do here. Settings restored from outside
 * this build can be recognised and migrated rather than silently misread, and a
 * plain integer both compares and orders correctly, which a dotted string does
 * not without a parser.
 *
 * Carried inside `Options` itself, not just declared here, so it travels with
 * the settings wherever they are written to.
 */
export const OPTIONS_SCHEMA_VERSION = 1;

/**
 * Central description of everything the user can tweak: one object holding
 * every setting, with no partial or optional members.
 *
 * A new group is added here, given a value in every preset under `presets/`,
 * and rendered in OptionsPanel. Values themselves live in the presets, never
 * here — so there is exactly one place a setting can come from.
 */
export interface Options {
  /** Which revision of this shape the object was written against. */
  optionsSchemaVersion: number;
  theme: Theme;
  boardColors: BoardColors;
  /** Which side is at the bottom of the board. */
  orientation: Orientation;
  pieceTint: PieceTint;
  /** Thin lines on the square edges, readable even with identical colours. */
  showGrid: boolean;
  attacks: AttackOptions;
}

const SHORT_HEX = /^#[0-9a-f]{3}$/i;
const FULL_HEX = /^#[0-9a-f]{6}$/i;

/**
 * Accepts "#rgb", "#rrggbb" or the same without the leading "#" and returns the
 * canonical "#rrggbb" form. Returns null when the input is not a valid colour.
 */
export function normalizeHexColor(input: string): string | null {
  const candidate = input.trim().startsWith("#")
    ? input.trim()
    : `#${input.trim()}`;

  if (FULL_HEX.test(candidate)) {
    return candidate.toLowerCase();
  }
  if (SHORT_HEX.test(candidate)) {
    const [r, g, b] = candidate.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
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
