/**
 * Central description of everything the user can tweak. New option groups are
 * added here, given a default below, and rendered in OptionsPanel.
 */
export interface BoardColors {
  lightSquare: string;
  darkSquare: string;
}

export interface Options {
  boardColors: BoardColors;
  /** Thin lines on the square edges, readable even with identical colours. */
  showGrid: boolean;
}

export const DEFAULT_OPTIONS: Options = {
  boardColors: {
    lightSquare: "#f0d9b5",
    darkSquare: "#b58863",
  },
  showGrid: true,
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
