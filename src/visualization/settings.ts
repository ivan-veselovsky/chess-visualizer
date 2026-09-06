/**
 * The shape of everything the visualization can be told to draw — types only.
 *
 * They live here rather than next to the UI so the drawing code does not depend
 * on the app layer. `app/settings.ts` composes them into the full user-facing
 * `Settings`, and `app/presets/` holds the values.
 *
 * No defaults are declared in this file. A value belongs to a preset, and every
 * preset is a complete `Settings`, so there is one place to read a setting from
 * and no way for a half-filled object to exist.
 */


export interface BoardColors {
  lightSquare: string;
  darkSquare: string;
  /**
   * Draw the dark squares in the light squares' colour, leaving the board one
   * flat surface.
   *
   * For shading, which colours whole squares: a checkerboard underneath gives
   * every shade two readings, and a reader comparing two squares cannot tell
   * how much of the difference is the heatmap and how much is the board.
   *
   * A switch rather than setting the two colours the same, so that the
   * checkerboard is still there to come back to — the dark colour is kept, not
   * overwritten, and turning this off restores the board as it was.
   */
  useLightForDark: boolean;
}

/**
 * The mark laid on the two squares the last move used — and on the square a
 * piece has been lifted from, which is the same question asked a moment
 * earlier.
 *
 * Grouped, because these four are one decision. Three of them describe a mark
 * that is either a wash of a chosen colour or the squares' own colours turned
 * round, and choosing between those two is the fourth; flat in `Settings` they
 * read as four unrelated knobs, and two of them are dead whenever the third is
 * set one way.
 */
export interface LastMoveMark {
  /**
   * The wash laid over them, and how much of it from 0 to 1.
   *
   * One colour for both kinds of square: a wash moves each of them towards the
   * same hue while leaving the difference between them showing underneath,
   * which taking a fixed share off their brightness does not — that pulls the
   * light square down towards the dark one until the board stops reading as a
   * board.
   *
   * Not used while `negative` is set, which takes the colour from the board.
   */
  color: string;
  /**
   * Mark them with the other kind of square's colour instead — dark on a light
   * square, light on a dark one.
   *
   * A rule rather than a colour, which is why it takes the place of the two
   * above rather than sitting beside them: there is nothing to choose and
   * nothing to fade, since a mark that is half the other colour is not the
   * other colour.
   *
   * What it shows is the move's shape. A bishop's two squares are the same
   * colour and so are marked alike; a knight's never are. The board says what
   * kind of move it was before the pieces are read.
   */
  negative: boolean;
  /**
   * How far across the mark is, in square sides — the same either way it is
   * coloured, since it is one mark drawn two ways.
   */
  diameter: number;
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
export interface KnightRingSettings {
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
/** What one attacker of each side lays down, before the reader's fraction. */
export interface HeatmapStrength {
  me: number;
  opponent: number;
}

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
 * Colouring the squares themselves by what attacks them.
 *
 * Answers a different question from the rays, and is read differently: the rays
 * say where one piece can go, this says how contested a square is. They are
 * shown independently because a board can want either without the other.
 */
/** A colour per end of the board, for the wash on the squares. */
export interface HeatmapColors {
  me: string;
  opponent: string;
}

export interface Heatmap {
  /**
   * What fraction of `strength` each side's attackers lay down.
   *
   * Separate fractions rather than one: a board coloured by both ends at once
   * says which of them holds a square, and a board coloured by one says how far
   * that one reaches, which is not the same thing and is sometimes the thing
   * being looked for. Zero leaves a
   * side out of the count entirely rather than merely drawing it faintly: a
   * side that lays down no colour has no say in the blend either, so the other
   * side's picture is the same whether it is shown alone or beside its
   * opponent's.
   */
  intensity: SideIntensity;
  /** What a square attacked only by one end of the board is tinted with. */
  color: HeatmapColors;
  /**
   * How much colour a single attacker lays down, from 0 to 1. Each attacker
   * after it takes the same share of whatever transparency is left.
   *
   * One for each side, as the rays have an opacity each: the two ends of the
   * board are not always worth reading at the same weight, and a single number
   * made it impossible to say so.
   */
  strength: HeatmapStrength;
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
/**
 * How much of a side's marks is drawn, as a fraction of what its own settings
 * ask for: 1 draws them as configured, 0 not at all, and the values between
 * scale what is configured rather than replacing it.
 *
 * A fraction rather than an opacity of its own because it is the reader's
 * moment-to-moment control — turned down to glance past the marks and back up
 * again — while the settings it scales are chosen once and left. Both sides on
 * one scale, so the two can be held equal.
 */
/**
 * How a piece travels from one square to the next.
 *
 * A speed rather than a duration, so that a knight's hop and a rook's run down
 * the board move at the same rate and the long one simply takes longer. A fixed
 * duration would make the two look like different weights of piece.
 *
 * Bounded at both ends: below the floor a short move is a flicker nobody reads
 * as movement, and above the ceiling a long one holds the board up. Nought for
 * the speed turns it off, and the piece appears where it lands.
 */
export interface MoveMotion {
  /** Squares a second. Zero puts the piece down without moving it. */
  speed: number;
  /** Seconds a move takes when time is what is being held, rather than speed. */
  time: number;
  /**
   * Which of the two is held, from 0 for the speed to 1 for the time.
   *
   *   v = speed · (1 − blend) + blend · pi · L / (2 · time)
   *
   * At nought every move travels at the same rate, so a rook's run down the
   * board takes four times a knight's hop. At one the rate is chosen to make
   * every move take the same time, however far it goes. Between them the two
   * are mixed, which is the useful part: short moves stop being a flicker and
   * long ones stop being a wait, without either being wholly given up.
   */
  blend: number;
}

/** Thin lines on the square edges, readable even with identical colours. */
export interface GridLines {
  show: boolean;
  color: string;
}

/**
 * Hatching over the dark squares.
 *
 * A way of telling the two square colours apart without a second colour, which
 * matters most when the board is drawn in one: a wash laid over a checkerboard
 * reads as two different washes, but hatching sits under it without changing
 * what it is, and still says which squares are which.
 */
export interface HedgeLines {
  show: boolean;
  /**
   * Which way the lines run, in degrees, from flat round to flat again: 0 and
   * 180 both lie flat, 90 stands upright, and the half turn between them covers
   * every slope there is — a line has no front and back, so turning it further
   * only repeats what has already been drawn.
   */
  angle: number;
  /** The gap between one line and the next, in square sides. */
  step: number;
  /**
   * Whether a second set of lines is drawn across the first, square to it and
   * at the same spacing — hatching one way, cross-hatching both.
   */
  orthogonal: boolean;
  color: string;
}

export interface SideIntensity {
  me: number;
  opponent: number;
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
  knightRing: KnightRingSettings;
  pawnRay: RayStyle;
}

export interface SideGeometry {
  me: AttackGeometry;
  opponent: AttackGeometry;
}

/**
 * The ring drawn round a piece that cannot leave the line it stands on.
 *
 * One setting for both sides, unlike the rays: a pin is a fact about the
 * position rather than about whose reach is being read, and being able to see
 * one side's pins but not the other's would only mislead.
 */
export interface PinMarks {
  show: boolean;
  /** What the ring is drawn in. One colour, as the flag above is one flag. */
  ringColor: string;
  /**
   * How far across it is, in square sides. It stands clear of the piece rather
   * than framing anything else on the square, so it is given a size of its own
   * instead of borrowing the one the rays are measured against.
   */
  ringDiameter: number;
}

/**
 * The disc laid under a king that is in check, or mated.
 *
 * Under the glyph rather than over it, and never into it: the king keeps its
 * own colour exactly, and only its surroundings say what has happened. The
 * disc is part transparent so that it reads as the square tinted; the colours
 * themselves are solid, a colour input having no way to carry an alpha.
 *
 * The two live together because they are one question asked at two
 * severities — is this king in trouble, and is it over — and a reader who has
 * turned one off has almost certainly formed a view about the other.
 */
export interface CheckMarks {
  showCheck: boolean;
  checkColor: string;
  showCheckmate: boolean;
  checkmateColor: string;
}

export interface AttackSettings {
  /** What fraction of `rayOpacity` each side's rays are actually drawn at. */
  rayIntensity: SideIntensity;
  /**
   * Whether the two intensities are held equal to the heatmap's. Kept here
   * rather than beside either of them: it is a fact about the pair.
   */
  linkedIntensity: boolean;
  /**
   * Whether a piece pinned against its own king is ringed.
   *
   * One setting for both sides, unlike the marks above: a pin is a fact about
   * the position rather than about whose reach is being read, and being able to
   * see one side's pins but not the other's would only mislead.
   */
  /** One choice for both sides: it is a shape, not a way of telling them apart. */
  knightGeometry: KnightGeometry;
  /** Colouring every square by who attacks it, and how often. */
  heatmap: Heatmap;
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
  pins: PinMarks;
  checkAndCheckmate: CheckMarks;
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
