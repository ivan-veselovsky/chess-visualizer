import { OPTIONS_SCHEMA_VERSION, type Options } from "../options";
import type { AttackGeometry } from "../../visualization/options";

/**
 * The settings the app starts on, and the baseline every Reset button restores.
 *
 * Written as a TypeScript object rather than JSON so it can be checked against
 * `Options` at build time, carry the reasoning behind a value, and state a
 * derived figure as the expression it came from. A preset that has to be loaded
 * at runtime — imported from a file, fetched, stored in a browser — would be
 * JSON; these, which ship with the app, are better off type-checked.
 */

/*
 * The two sides are written out separately, and in full, even where they agree.
 * They are meant to drift apart — telling White's marks from Black's is what
 * these widths are for — and each side reads on its own at a glance rather than
 * as a list of departures from the other. Spreading one into the other would
 * also share the nested objects between them, which is a trap once they differ.
 *
 * The knight's radii sit either side of the sqrt(5) ~ 2.236 square sides at
 * which an attacked square's centre lies: 3/sqrt(2) and sqrt(13/2) are the
 * distances to two of that square's corners.
 */

const WHITE_ATTACK_GEOMETRY: AttackGeometry = {
  kingStripe: { rayWidth: 0.45, gapWidth: 0.15 },
  queenStripe: { rayWidth: 0.35, gapWidth: 0.15 },
  rookStripe: { rayWidth: 0.45, gapWidth: 0.15 },
  bishopStripe: { rayWidth: 0.45, gapWidth: 0.15 },
  knightRing: {
    innerRadius: 3 / Math.SQRT2, // ~2.1213
    outerRadius: Math.sqrt(13 / 2), // ~2.5495
    gapWidth: 0.15,
  },
  pawnStripe: { rayWidth: 0.45, gapWidth: 0.15 },
};

const BLACK_ATTACK_GEOMETRY: AttackGeometry = {
  kingStripe: { rayWidth: 0.45, gapWidth: 0 },
  queenStripe: { rayWidth: 0.3, gapWidth: 0 },
  rookStripe: { rayWidth: 0.45, gapWidth: 0 },
  bishopStripe: { rayWidth: 0.45, gapWidth: 0 },
  knightRing: {
    innerRadius: 3 / Math.SQRT2, // ~2.1213
    outerRadius: Math.sqrt(13 / 2), // ~2.5495
    gapWidth: 0,
  },
  pawnStripe: { rayWidth: 0.3, gapWidth: 0 },
};

export const DEFAULT_OPTIONS: Options = {
  optionsSchemaVersion: OPTIONS_SCHEMA_VERSION,
  theme: "dark",
  boardColors: {
    lightSquare: "#ccdccc",
    darkSquare: "#bfbfbf", //"#8b928d", //"#bdbdbd",
  },
  orientation: "white",
  showGrid: false,
  pieceTint: {
    lightenWhite: 1,
    darkenBlack: 0.7,
  },
  attacks: {
    colors: {
      king: "#ffd600",
      queen: "#e53935",
      rook: "#fb8c00",
      bishop: "#43a047",
      knight: "#00a7bd",
      pawn: "#6f7076", //"#9c9c9c",
    },
    outlineWidths: { 
      white: 0, 
      black: 0, 
    },
    rayOpacity: { white: 0.45, black: 0.45 },
    xRayDecayFactor: 0,
    rayInnerSquare: 0.75,
    rayInnerSquareCornerRadius: 0.15,
    fullWidthDiagonalRays: true,
    geometry: {
      white: WHITE_ATTACK_GEOMETRY,
      black: BLACK_ATTACK_GEOMETRY,
    },
  },
};
