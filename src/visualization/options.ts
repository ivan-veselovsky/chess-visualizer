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
  lightSquare:"#ccdccc", //"#cccccc",
  darkSquare: "#bdbdbd",
};

/**
 * How far each side's pieces are pulled from the colour their attacks are drawn
 * in, as a fraction from 0 to 1: 0 leaves a piece exactly its attack colour, 1
 * bleaches it to pure white or pure black.
 *
 * Both sides share one hue per piece kind — that is what ties a piece to its
 * marks — so the only thing left to tell the sides apart is how light or dark
 * that hue is rendered.
 */
export interface PieceTint {
  /** Toward white, for White's pieces. */
  lighten: number;
  /** Toward black, for Black's. */
  darken: number;
}

export const DEFAULT_PIECE_TINT: PieceTint = {
  lighten: 0.7,
  darken: 0.7,
};

/**
 * Bounding circles of the knight's ring, in square sides. The eight target
 * squares sit at sqrt(5) ~ 2.236 square sides from the knight, so the defaults
 * straddle that distance.
 */
export interface KnightRingOptions {
  innerRadius: number;
  outerRadius: number;
  /**
   * A gap of this width, in square sides, down the middle of the ring, leaving
   * two concentric rings either side of it. Zero leaves the ring solid — the
   * same thing an inner width of zero does to a stripe.
   */
  gap: number;
}

export const DEFAULT_KNIGHT_RING: KnightRingOptions = {
  innerRadius: 3 / Math.SQRT2, // ~2.1213
  outerRadius: Math.sqrt(13 / 2), // ~2.5495
  gap: 0,
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

/** The pawn's mark is a stripe like any other, and can be doubled the same way. */
export const DEFAULT_PAWN_STRIPE: StripeStyle = {
  outerWidth: 0.35,
  innerWidth: 0,
};

/**
 * Colour each piece's attacks are drawn in. Board publishes these as CSS custom
 * properties on the board's root <svg>, which is also where the piece glyphs
 * pick up their tint — so a piece and its attacks can never disagree.
 */
/**
 * Widths of the outline traced around each side's attack marks — the one thing
 * that tells the two sides' marks apart, since a piece and its attacks share a
 * colour whatever side it is on. Zero draws none for that side.
 *
 * In milli-squares, not square sides: a hairline is a few thousandths of a
 * square, and the rest of this file's lengths would need three decimals to say
 * so. The only lengths here measured that way.
 */
export interface OutlineWidths {
  white: number;
  black: number;
}

export const DEFAULT_OUTLINE_WIDTHS: OutlineWidths = {
  white: 10,
  black: 10,
};

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

/**
 * The per-piece shapes, kept separately for each side so the two can be told
 * apart by stripe width as well as by outline. Colours stay shared: a piece and
 * its marks agree on hue whatever side it is on, and only lightness and these
 * widths distinguish the sides.
 */
export interface PieceGeometry {
  kingStripe: StripeStyle;
  queenStripe: StripeStyle;
  rookStripe: StripeStyle;
  bishopStripe: StripeStyle;
  knightRing: KnightRingOptions;
  pawnStripe: StripeStyle;
}

export const DEFAULT_PIECE_GEOMETRY: PieceGeometry = {
  kingStripe: DEFAULT_KING_STRIPE,
  queenStripe: DEFAULT_QUEEN_STRIPE,
  rookStripe: DEFAULT_ROOK_STRIPE,
  bishopStripe: DEFAULT_BISHOP_STRIPE,
  knightRing: DEFAULT_KNIGHT_RING,
  pawnStripe: DEFAULT_PAWN_STRIPE,
};

export interface SideGeometry {
  white: PieceGeometry;
  black: PieceGeometry;
}

export const DEFAULT_SIDE_GEOMETRY: SideGeometry = {
  white: DEFAULT_PIECE_GEOMETRY,
  black: DEFAULT_PIECE_GEOMETRY,
};

export interface AttackOptions {
  colors: AttackColors;
  /** In milli-squares — see DEFAULT_OUTLINE_WIDTHS. */
  outlineWidths: OutlineWidths;
  decayPerBlocker: number;
  rayInnerSquare: number;
  rayStartCornerRadius: number;
  fullWidthRays: boolean;
  geometry: SideGeometry;
}

export const DEFAULT_ATTACK_OPTIONS: AttackOptions = {
  colors: DEFAULT_ATTACK_COLORS,
  outlineWidths: DEFAULT_OUTLINE_WIDTHS,
  decayPerBlocker: DEFAULT_DECAY_PER_BLOCKER,
  rayInnerSquare: DEFAULT_RAY_INNER_SQUARE,
  rayStartCornerRadius: DEFAULT_RAY_START_CORNER_RADIUS,
  fullWidthRays: DEFAULT_FULL_WIDTH_RAYS,
  geometry: DEFAULT_SIDE_GEOMETRY,
};
