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
  outerWidth: 0.35,
  innerWidth: 0,
};

export const DEFAULT_BISHOP_STRIPE: StripeStyle = {
  outerWidth: 0.45,
  innerWidth: 0,
};

export const DEFAULT_ROOK_STRIPE: StripeStyle = {
  outerWidth: 0.45,
  innerWidth: 0,
};

/**
 * What a ray's intensity is multiplied by for each piece it passes through.
 * 0 hides everything beyond the first piece (no x-ray at all); 1 lets a ray
 * run to the board edge undimmed.
 */
export const DEFAULT_DECAY_PER_BLOCKER = 0;

/**
 * Radius of the circle around a sliding piece, in square sides, inside which
 * its own outgoing rays are not drawn. The rays are visible on the piece's own
 * square only outside this circle.
 *
 * Note the square's corners lie 1/sqrt(2) ~ 0.7071 from its centre and its
 * edges only 0.5, so a radius at or above 0.5 hides the orthogonal rays on the
 * origin square entirely, and one at or above 0.7071 hides every ray there.
 */
export const DEFAULT_RAY_INNER_RADIUS = 0.45; //0.36;

/**
 * Side of the inner square, in square sides: concentric with its square and
 * parallel to it, sized independently of the inner circle.
 *
 * A diagonal ray that ends on a square may not pass the two sides of that
 * square's inner square farthest along the ray, so it tapers to a point at the
 * corner where they meet — an arrow-shaped end rather than a flat cut.
 */
export const DEFAULT_RAY_INNER_SQUARE = 0.5;

export const DEFAULT_KING_STRIPE: StripeStyle = {
  outerWidth: 0.45,
  innerWidth: 0,
};

/**
 * Width of a pawn's mark, in square sides. It doubles as the diameter of the
 * circle the mark ends in, so the stripe and its rounded end always match.
 */
export const DEFAULT_PAWN_MARK_WIDTH = 0.45;

/**
 * Colour each piece's attacks are drawn in. Board publishes these as CSS custom
 * properties on the board's root <svg>, which is also where the piece glyphs
 * pick up their tint — so a piece and its attacks can never disagree.
 */
export interface AttackColors {
  king: string;
  queen: string;
  rook: string;
  bishop: string;
  knight: string;
  pawn: string;
}

export const DEFAULT_ATTACK_COLORS: AttackColors = {
  king: "#ffd600",
  queen: "#e53935",
  rook: "#fb8c00",
  bishop: "#43a047",
  knight: "#00a7bd", //"#00bcd4",
  pawn: "#9c9c9c", //"#616161",
};

export interface AttackOptions {
  colors: AttackColors;
  decayPerBlocker: number;
  rayInnerRadius: number;
  rayInnerSquare: number;
  pawnMarkWidth: number;
  kingStripe: StripeStyle;
  knightRing: KnightRingOptions;
  queenStripe: StripeStyle;
  bishopStripe: StripeStyle;
  rookStripe: StripeStyle;
}

export const DEFAULT_ATTACK_OPTIONS: AttackOptions = {
  colors: DEFAULT_ATTACK_COLORS,
  decayPerBlocker: DEFAULT_DECAY_PER_BLOCKER,
  rayInnerRadius: DEFAULT_RAY_INNER_RADIUS,
  rayInnerSquare: DEFAULT_RAY_INNER_SQUARE,
  pawnMarkWidth: DEFAULT_PAWN_MARK_WIDTH,
  kingStripe: DEFAULT_KING_STRIPE,
  knightRing: DEFAULT_KNIGHT_RING,
  queenStripe: DEFAULT_QUEEN_STRIPE,
  bishopStripe: DEFAULT_BISHOP_STRIPE,
  rookStripe: DEFAULT_ROOK_STRIPE,
};
