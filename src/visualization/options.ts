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
 * How opaque the outline around a side's marks is, from 0 to 1 — set apart
 * from the marks themselves so the two can be told apart by either.
 *
 * Independence is the whole point of it: rays at zero and outlines at one
 * leaves a side showing as bare outlines with nothing filled in, which is a
 * useful way to read a crowded board and impossible with a single figure.
 */
export interface OutlineOpacity {
  me: number;
  opponent: number;
}

/**
 * How the knight's ring is finished off on each square it attacks.
 *
 * "arc" cuts it between two radii and leaves it at that. The two gammas add a
 * radial stripe as well: the first leaning in from `d`, above the arc; the
 * second rising from the corner by `b`, beneath it.
 *
 * "straight-ray" draws no ring at all. Each move gets a stripe of the ring's
 * thickness from the knight out to its outer radius, aimed at the square it
 * reaches and pointed at the end, and the whole journey shows — faintly where
 * it passes over, plainly where it arrives.
 */
export type KnightGeometry = "arc" | "gamma-1" | "gamma-2" | "straight-ray";

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
  /**
   * Whether a piece pinned against its own king is ringed.
   *
   * One setting for both sides, unlike the marks above: a pin is a fact about
   * the position rather than about whose reach is being read, and being able to
   * see one side's pins but not the other's would only mislead.
   */
  /** One choice for both sides: it is a shape, not a way of telling them apart. */
  knightGeometry: KnightGeometry;
  /**
   * What the straight-ray geometry's marks are drawn at where they are only
   * passing through — the knight's own square, and the ones between it and the
   * square it reaches.
   *
   * A factor on `rayOpacity` for that side rather than an opacity of its own,
   * so raising a side's rays raises its trails with them: 0.3 draws them at
   * three tenths of whatever that side's rays are drawn at. One draws the whole
   * length alike; zero shows only where each move arrives.
   */
  straightRayOpacityDecay: number;
  showPins: boolean;
  /** What that ring is drawn in. One colour, as the setting above is one flag. */
  pinRingColor: string;
  /**
   * How far across that ring is, in square sides. It stands clear of the piece
   * rather than framing anything else on the square, so it is given a size of
   * its own instead of borrowing the one the rays are measured against.
   */
  pinRingDiameter: number;
  /**
   * Whether the king in check, and the king mated, are shown by a disc laid
   * under the glyph — as wide across as the pin ring, so the two marks agree.
   *
   * Under it rather than over it, and never into it: the king keeps its own
   * colour exactly, and only its surroundings say what has happened. The disc
   * is part transparent so that it reads as the square tinted; the colours
   * themselves are solid, a colour input having no way to carry an alpha.
   */
  showCheck: boolean;
  showCheckmate: boolean;
  checkColor: string;
  checkmateColor: string;
  colors: SideAttackColors;
  outlineWidths: OutlineWidths;
  outlineColors: OutlineColors;
  rayOpacity: RayOpacity;
  outlineOpacity: OutlineOpacity;
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
