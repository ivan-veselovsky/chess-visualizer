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
 * Side of the inner square, in square sides: concentric with its square and
 * parallel to it. It is the one boundary every ray is measured against — where
 * a ray starts, where it ends, and where it dims behind a piece it passes.
 *
 * A ray may not pass the sides of that square lying farthest along it. A
 * diagonal meets two of them at once and so tapers to a point at the corner
 * where they meet; a rank or file meets one and gets a flat cut.
 */
export const DEFAULT_RAY_INNER_SQUARE = 0.75;

/**
 * Corner radius, in square sides, of the inner square where a ray *starts*.
 * Rounding it blunts the point a diagonal is otherwise notched to as it leaves
 * its piece. Ray endings, and the boundaries where a ray dims behind a piece it
 * passes, keep the square's sharp corners — so a start never looks like an end.
 */
export const DEFAULT_RAY_START_CORNER_RADIUS = 0.15;

/**
 * Whether rays keep their full width along their whole length. Off, a ray shows
 * only on the squares it attacks, so a diagonal one narrows to a point at every
 * square corner; on, it stays the same width throughout. Either way it starts
 * and ends in the same place — only its width in the corners changes.
 */
export const DEFAULT_FULL_WIDTH_RAYS = true;

export const DEFAULT_KING_STRIPE: StripeStyle = {
  outerWidth: 0.45,
  innerWidth: 0,
};

/**
 * Width of a pawn's mark, in square sides. It doubles as the diameter of the
 * circle the mark ends in, so the stripe and its rounded end always match.
 */
export const DEFAULT_PAWN_MARK_WIDTH = 0.35;

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
  rayInnerSquare: number;
  rayStartCornerRadius: number;
  fullWidthRays: boolean;
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
  rayInnerSquare: DEFAULT_RAY_INNER_SQUARE,
  rayStartCornerRadius: DEFAULT_RAY_START_CORNER_RADIUS,
  fullWidthRays: DEFAULT_FULL_WIDTH_RAYS,
  pawnMarkWidth: DEFAULT_PAWN_MARK_WIDTH,
  kingStripe: DEFAULT_KING_STRIPE,
  knightRing: DEFAULT_KNIGHT_RING,
  queenStripe: DEFAULT_QUEEN_STRIPE,
  bishopStripe: DEFAULT_BISHOP_STRIPE,
  rookStripe: DEFAULT_ROOK_STRIPE,
};
