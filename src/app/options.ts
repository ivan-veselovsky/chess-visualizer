import {
  DEFAULT_ATTACK_OPTIONS,
  DEFAULT_BOARD_COLORS,
  type AttackOptions,
  type BoardColors,
} from "../visualization/options";

export type { AttackOptions, BoardColors, KnightRingOptions } from "../visualization/options";
export { DEFAULT_KNIGHT_RING } from "../visualization/options";

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

/** Parses a positive number, or null when the input is not usable. */
export function parsePositiveNumber(input: string): number | null {
  const value = Number(input.trim());
  if (input.trim() === "" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}
