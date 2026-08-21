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
 * How far each army's pieces are pulled from the colour their attacks are drawn
 * in, as a fraction from 0 to 1: 0 leaves a piece exactly its attack colour, 1
 * bleaches it to pure white or pure black.
 *
 * Keyed on colour, not position — unlike everything else here. White's pieces
 * are the light ones wherever they stand, which is what makes flipping the
 * board visibly move an army rather than merely relabel the ends.
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
   * same thing a zero gap does to a ray, which is what this is: one bent round
   * into a circle.
   */
  gapWidth: number;
}

/**
 * A ray's shape: its full width, with a gap cut down the middle leaving two
 * parallel bands. Both are in square sides and measured across the ray, so
 * `gapWidth: 0` degenerates to a single solid band of `rayWidth`.
 *
 * Every piece carries its own pair, so the rays of different pieces can be
 * given different widths and nest inside one another where they overlap.
 */
export interface RayStyle {
  rayWidth: number;
  gapWidth: number;
}

/**
 * Widths of the outline traced around each side's attack marks — the one thing
 * that tells the two sides' marks apart, since a piece and its attacks share a
 * colour whatever side it is on. Zero draws none for that side.
 *
 * In square sides, as every other length in the model is. An outline is a
 * hairline and so reads in hundredths where the rest read in tenths, which is
 * a smaller price than being the one measurement in a different unit.
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
  me: number;
  opponent: number;
}

/**
 * Whether each side's attacks are drawn at all. Turning both off leaves the
 * board as any other program shows it, which is worth being able to get back
 * to: the marks are there to be compared against the plain position.
 */
export interface AttackVisibility {
  me: boolean;
  opponent: boolean;
}

/** The colour each side's outline is traced in, when it has any width. */
export interface OutlineColors {
  me: string;
  opponent: string;
}

export interface OutlineWidths {
  me: number;
  opponent: number;
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

/** A palette per side, so the two can be told apart by hue as well as by size. */
export interface SideAttackColors {
  me: AttackColors;
  opponent: AttackColors;
}

/**
 * The shape of every piece kind's attack marks, kept separately for each side
 * so the two can be told apart by ray width as well as by outline. Colours
 * stay shared: a piece and its marks agree on hue whatever side it is on, and
 * only lightness and these widths distinguish the sides.
 */
export interface AttackGeometry {
  /**
   * Sides, in square sides, of the two squares concentric with every square and
   * parallel to it, against which every ray is measured.
   *
   * A ray leaves the large one and stops at the small one: it starts on a
   * straight cut across the large square and ends in a point on the small one,
   * having run through the centre on the way. Keeping the small one inside the
   * large leaves a clear gap around each piece between what arrives and what
   * sets off again; the other way round they overlap.
   */
  smallInnerSquare: number;
  largeInnerSquare: number;
  kingRay: RayStyle;
  queenRay: RayStyle;
  rookRay: RayStyle;
  bishopRay: RayStyle;
  knightRing: KnightRingOptions;
  pawnRay: RayStyle;
}

export interface SideGeometry {
  me: AttackGeometry;
  opponent: AttackGeometry;
}

export interface AttackOptions {
  showAttacks: AttackVisibility;
  colors: SideAttackColors;
  outlineWidths: OutlineWidths;
  outlineColors: OutlineColors;
  rayOpacity: RayOpacity;
  /**
   * What a ray's intensity is multiplied by for each piece it passes through.
   * 0 hides everything beyond the first piece (no x-ray at all); 1 lets a ray
   * run to the board edge undimmed.
   */
  xRayDecayFactor: number;
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
