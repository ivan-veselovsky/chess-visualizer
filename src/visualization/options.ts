/**
 * The shape of everything the visualization can be told to draw — types only.
 *
 * They live here rather than next to the UI so the drawing code does not depend
 * on the app layer. `app/options.ts` composes them into the full user-facing
 * `Options`, and `app/presets/` holds the values.
 *
 * No defaults are declared in this file. A value belongs to a preset, and every
 * preset is a complete `Options`, so there is one place to read a setting from
 * and no way for a half-filled object to exist.
 */

export interface BoardColors {
  lightSquare: string;
  darkSquare: string;
}

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
  lightenWhite: number;
  /** Toward black, for Black's. */
  darkenBlack: number;
}

/**
 * Bounding circles of the knight's ring, in square sides. The eight target
 * squares sit at sqrt(5) ~ 2.236 square sides from the knight, so useful radii
 * straddle that distance.
 */
export interface KnightRingOptions {
  innerRadius: number;
  outerRadius: number;
  /**
   * A gap of this width, in square sides, down the middle of the ring, leaving
   * two concentric rings either side of it. Zero leaves the ring solid — the
   * same thing a zero gap does to a stripe, which is what it is.
   */
  gapWidth: number;
}

/**
 * A ray's stripe: its full width, with a gap cut down the middle leaving two
 * parallel bands. Both are in square sides and measured across the stripe, so
 * `gapWidth: 0` degenerates to a single solid stripe of `rayWidth`.
 *
 * Every piece carries its own pair, so stripes of different pieces can be given
 * different widths and nest inside one another where they overlap.
 */
export interface StripeStyle {
  rayWidth: number;
  gapWidth: number;
}

/**
 * Widths of the outline traced around each side's attack marks — the one thing
 * that tells the two sides' marks apart, since a piece and its attacks share a
 * colour whatever side it is on. Zero draws none for that side.
 *
 * In milli-squares, not square sides: a hairline is a few thousandths of a
 * square, and every other length here would need three decimals to say so. The
 * only lengths in the model measured that way.
 */
/**
 * How opaque an undimmed attack mark is, from 0 to 1, per side. Applied once
 * per piece to its whole set of marks, so overlapping marks of the same piece
 * stay one flat shade; marks of different pieces still blend where they cross,
 * which is the point of the display.
 *
 * Kept per side alongside the outline widths and the stripe geometry: another
 * way of telling one side's marks from the other's, without touching the hue
 * that ties a mark to its piece.
 */
export interface RayOpacity {
  white: number;
  black: number;
}

export interface OutlineWidths {
  white: number;
  black: number;
}

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

/**
 * The shape of every piece kind's attack marks, kept separately for each side
 * so the two can be told apart by stripe width as well as by outline. Colours
 * stay shared: a piece and its marks agree on hue whatever side it is on, and
 * only lightness and these widths distinguish the sides.
 */
export interface AttackGeometry {
  kingStripe: StripeStyle;
  queenStripe: StripeStyle;
  rookStripe: StripeStyle;
  bishopStripe: StripeStyle;
  knightRing: KnightRingOptions;
  pawnStripe: StripeStyle;
}

export interface SideGeometry {
  white: AttackGeometry;
  black: AttackGeometry;
}

export interface AttackOptions {
  colors: AttackColors;
  /** In milli-squares — see OutlineWidths. */
  outlineWidths: OutlineWidths;
  rayOpacity: RayOpacity;
  /**
   * What a ray's intensity is multiplied by for each piece it passes through.
   * 0 hides everything beyond the first piece (no x-ray at all); 1 lets a ray
   * run to the board edge undimmed.
   */
  xRayDecayFactor: number;
  /**
   * Side of the inner square, in square sides: concentric with its square and
   * parallel to it. It is the one boundary every ray is measured against —
   * where a ray starts, where it ends, and where it dims behind a piece.
   *
   * A ray may not pass the sides of that square lying farthest along it. A
   * diagonal meets two of them at once and so tapers to a point at the corner
   * where they meet; a rank or file meets one and gets a blunter point.
   */
  rayInnerSquare: number;
  /**
   * Corner radius, in square sides, of the inner square where a ray *starts*.
   * Rounding it blunts the point a diagonal is otherwise notched to as it
   * leaves its piece. Ray endings, and the boundaries where a ray dims behind a
   * piece it passes, keep the square's sharp corners — so a start never looks
   * like an end.
   */
  rayInnerSquareCornerRadius: number;
  /**
   * Whether rays keep their full width along their whole length. Off, a ray
   * shows only on the squares it attacks, so a diagonal one narrows to a point
   * at every square corner; on, it stays the same width throughout. Either way
   * it starts and ends in the same place — only its width in the corners
   * changes.
   */
  fullWidthDiagonalRays: boolean;
  geometry: SideGeometry;
}
