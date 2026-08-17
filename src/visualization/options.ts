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
  // lightSquare: "#f0d9b5",
  // darkSquare: "#b58863",
  lightSquare: "#cccccc",
  darkSquare: "#cccccc",
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

/**
 * A ray stripe, described as a wide outer stripe with a narrower inner stripe
 * cut out of it, leaving two parallel bands. Both widths are in square sides
 * and measured across the full stripe, so `innerWidth: 0` degenerates to a
 * single solid stripe of `outerWidth`.
 *
 * Every sliding piece carries its own pair, so stripes of different pieces can
 * be given different widths and nest inside one another where they overlap.
 */
export interface StripeStyle {
  outerWidth: number;
  innerWidth: number;
}

export const DEFAULT_QUEEN_STRIPE: StripeStyle = {
  outerWidth: 0.45,
  innerWidth: 0,
};

export const DEFAULT_BISHOP_STRIPE: StripeStyle = {
  outerWidth: 1,
  innerWidth: 0.45,
};

export const DEFAULT_ROOK_STRIPE: StripeStyle = {
  outerWidth: 1,
  innerWidth: 0.45,
};

/**
 * What a ray's intensity is multiplied by for each piece it passes through.
 * 0 hides everything beyond the first piece (no x-ray at all); 1 lets a ray
 * run to the board edge undimmed.
 */
export const DEFAULT_DECAY_PER_BLOCKER = 0;

/** Thickness of the king's ring, in square sides. */
export const DEFAULT_KING_STRIPE_WIDTH = 0.45;

/**
 * Width of a pawn's mark, in square sides. It doubles as the diameter of the
 * circle the mark ends in, so the stripe and its rounded end always match.
 */
export const DEFAULT_PAWN_MARK_WIDTH = 0.45;

export interface AttackOptions {
  decayPerBlocker: number;
  kingStripeWidth: number;
  pawnMarkWidth: number;
  knightRing: KnightRingOptions;
  queenStripe: StripeStyle;
  bishopStripe: StripeStyle;
  rookStripe: StripeStyle;
}

export const DEFAULT_ATTACK_OPTIONS: AttackOptions = {
  decayPerBlocker: DEFAULT_DECAY_PER_BLOCKER,
  kingStripeWidth: DEFAULT_KING_STRIPE_WIDTH,
  pawnMarkWidth: DEFAULT_PAWN_MARK_WIDTH,
  knightRing: DEFAULT_KNIGHT_RING,
  queenStripe: DEFAULT_QUEEN_STRIPE,
  bishopStripe: DEFAULT_BISHOP_STRIPE,
  rookStripe: DEFAULT_ROOK_STRIPE,
};
