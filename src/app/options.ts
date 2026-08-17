import {
  DEFAULT_ATTACK_OPTIONS,
  DEFAULT_BOARD_COLORS,
  type AttackOptions,
  type BoardColors,
} from "../visualization/options";

export type {
  AttackColors,
  AttackOptions,
  BoardColors,
  KnightRingOptions,
  StripeStyle,
} from "../visualization/options";
export {
  DEFAULT_ATTACK_COLORS,
  DEFAULT_BISHOP_STRIPE,
  DEFAULT_FULL_WIDTH_RAYS,
  DEFAULT_DECAY_PER_BLOCKER,
  DEFAULT_KING_STRIPE,
  DEFAULT_KNIGHT_RING,
  DEFAULT_PAWN_MARK_WIDTH,
  DEFAULT_QUEEN_STRIPE,
  DEFAULT_RAY_INNER_SQUARE,
  DEFAULT_RAY_START_CORNER_RADIUS,
  DEFAULT_ROOK_STRIPE,
} from "../visualization/options";

/**
 * Central description of everything the user can tweak. New option groups are
 * added here, given a default below, and rendered in OptionsPanel.
 */
export interface Options {
  boardColors: BoardColors;
  /** Thin lines on the square edges, readable even with identical colours. */
  showGrid: boolean;
  attacks: AttackOptions;
}

export const DEFAULT_OPTIONS: Options = {
  boardColors: DEFAULT_BOARD_COLORS,
  showGrid: true,
  attacks: DEFAULT_ATTACK_OPTIONS,
};

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
