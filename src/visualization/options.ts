/**
 * Option types owned by the visualization, and their defaults. They live here
 * rather than next to the UI so the drawing code does not depend on the app
 * layer; `app/options.ts` composes these into the full user-facing settings.
 */

export interface BoardColors {
  lightSquare: string;
  darkSquare: string;
}

export const DEFAULT_BOARD_COLORS: BoardColors = {
  lightSquare: "#f0d9b5",
  darkSquare: "#b58863",
};

/**
 * Bounding circles of the knight's ring, in square sides. The eight target
 * squares sit at sqrt(5) ~ 2.236 square sides from the knight, so the defaults
 * straddle that distance.
 */
export interface KnightRingOptions {
  innerRadius: number;
  outerRadius: number;
}

export const DEFAULT_KNIGHT_RING: KnightRingOptions = {
  innerRadius: 3 / Math.SQRT2, // ~2.1213
  outerRadius: Math.sqrt(13 / 2), // ~2.5495
};

export interface AttackOptions {
  knightRing: KnightRingOptions;
}

export const DEFAULT_ATTACK_OPTIONS: AttackOptions = {
  knightRing: DEFAULT_KNIGHT_RING,
};
