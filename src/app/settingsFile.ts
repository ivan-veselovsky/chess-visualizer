/*
  Written with its extension, unlike the imports elsewhere. This module is
  exercised by `tests/unit.mjs`, which node runs straight from the TypeScript
  with no bundler to guess at extensions — and the version it reads files
  against is a value rather than a type, so it has to resolve at run time.
  `allowImportingTsExtensions` is on for exactly this.
*/
import { SETTINGS_SCHEMA_VERSION, type Settings } from "./settings.ts";

export const SETTINGS_FILE_NAME = "chess-visualizer-settings.json";

/**
 * What to call the file, given the preset the settings are being used under.
 *
 * The preset's own name, because that is what the reader calls these settings
 * and what they will look for when they come to import them again. Two things
 * are taken off it: the "(default)" that says which built-in the app opens
 * with, which means nothing in somebody's downloads folder, and any character
 * a file system would rather not be given.
 */
export function settingsFileName(preset: string | null): string {
  const wanted = (preset ?? "")
    .replace(/\s*\(default\)\s*/i, " ")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
  return wanted === "" ? SETTINGS_FILE_NAME : `${wanted}.json`;
}

/**
 * Settings as they are written to a file: the whole `Settings` object, schema
 * version and all. Nothing is stripped — a file that omitted anything would
 * import as a partial object, which is what the version is there to prevent.
 */
export function settingsToJson(settings: Settings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

/** Hands the browser a settings file to save, named after the preset in use. */
export function downloadSettings(settings: Settings, preset: string | null = null): void {
  const blob = new Blob([settingsToJson(settings)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = settingsFileName(preset);
  link.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  settings: Settings | null;
  /** Why the file was rejected, when it was. */
  error: string | null;
}

/** Groups whose absence would leave the app reading undefined at render time. */
const REQUIRED_KEYS = ["board", "pieces", "lab", "attacks"] as const;

/**
 * A node's keys put in the order this build writes them, in place.
 *
 * A key added to an object goes on the end, so a record that has been migrated
 * carries whatever was added last after everything else — the same settings as
 * a file this build ships, read the same way, and a needless difference in
 * every file exported from it. Anything not on the list keeps its place after
 * the ones that are, rather than being dropped for not being known.
 */
function inOrder(node: Record<string, unknown>, first: readonly string[]): void {
  const written: Record<string, unknown> = {};
  for (const key of [...first, ...Object.keys(node)]) {
    if (key in node && !(key in written)) {
      written[key] = node[key];
    }
  }
  for (const key of Object.keys(node)) {
    delete node[key];
  }
  Object.assign(node, written);
}

/**
 * The two per-side switches, filled in where a record does not carry them.
 *
 * A picture drawn for neither side is a picture nobody asked to hide, so
 * silence is read as "both" — and read as "neither" it would be a blank board
 * with nothing on the panel to explain it.
 */
function sidesShown(node: Record<string, unknown>): void {
  if (typeof node.showMine !== "boolean") {
    node.showMine = true;
  }
  if (typeof node.showOpponent !== "boolean") {
    node.showOpponent = true;
  }
}

/**
 * Version 46's ray settings, gathered into the `rays` node version 47 keeps
 * them in.
 *
 * They lay loose in `attacks` beside the heatmap's own node, which made the two
 * pictures the board draws look like different kinds of thing when they are the
 * same kind. Nothing about any of them changed but where they live and, for
 * four of them, a name that no longer has to say "ray" now that the node does.
 *
 * Two settings added late to 46 and never given a version of their own are
 * filled in here as well: a record from before them is a record from when there
 * was no turning either picture off, so both come back on. The same goes for
 * the ray shape, which spent a while as a yes-or-no needle — no meant stripes,
 * yes meant the needle of the day, which is the elliptic one.
 *
 * Mutates what it is given, which is the freshly parsed object and nobody
 * else's.
 */
function liftRays(candidate: Record<string, unknown>): void {
  const attacks = candidate.attacks as Record<string, unknown> | undefined;
  if (attacks === undefined || attacks === null || typeof attacks !== "object") {
    return;
  }
  if (typeof attacks.rays === "object" && attacks.rays !== null) {
    return;
  }

  /* In the order `RaySettings` declares them, so that a lifted record written
     back out reads the way a file this build ships does. */
  const moved: [string, string][] = [
    ["showRays", "show"],
    ["rayIntensity", "intensity"],
    ["rayOpacity", "maxOpacity"],
    ["rayShape", "shape"],
    ["knightGeometry", "knightGeometry"],
    ["straightRayOpacityDecay", "straightRayOpacityDecay"],
    ["xRayDecayFactor", "xRayDecayFactor"],
    ["fullWidthDiagonalRays", "fullWidthDiagonals"],
    ["colors", "colors"],
    ["outlineWidths", "outlineWidths"],
    ["outlineColors", "outlineColors"],
    ["outlineOpacity", "outlineOpacity"],
    ["geometry", "geometry"],
  ];
  const rays: Record<string, unknown> = {};
  for (const [was, is] of moved) {
    if (was in attacks) {
      rays[is] = attacks[was];
      delete attacks[was];
    }
    /* The three switches together, in the order the interface declares them:
       46 had the first of them at the end of its life and neither of the other
       two, and a node written in a different order from the one this build
       writes is a needless difference in every file that comes out of it. */
    if (is === "show") {
      if (typeof rays.show !== "boolean") {
        rays.show = true;
      }
      sidesShown(rays);
    }
  }

  const shapes = ["stripe", "triangle", "ellipse"];
  if (!shapes.includes(rays.shape as string)) {
    rays.shape = attacks.needleRays === false ? "stripe" : "ellipse";
  }
  delete attacks.needleRays;
  const heatmap = attacks.heatmap as Record<string, unknown> | undefined;
  if (heatmap !== undefined) {
    /* Written afresh, in the order the interface declares: the strength is
       renamed for what it is — the most one attacker lays down, which the
       balance panel then takes its fraction of — and a record from before the
       switch is a record from when the wash could not be turned off. */
    attacks.heatmap = {
      show: typeof heatmap.show === "boolean" ? heatmap.show : true,
      showMine: true,
      showOpponent: true,
      intensity: heatmap.intensity,
      color: heatmap.color,
      maxStrength: heatmap.maxStrength ?? heatmap.strength,
    };
  }

  /* The knight's ring was set by two radii and is set by a radius and a width;
     what it came to on the screen is kept, which is the difference between
     them. A ring given the wrong way round drew the same ring either way, so
     the wider reading is the honest one to carry over. */
  const geometry = rays.geometry as Record<string, unknown> | undefined;
  for (const side of Object.values(geometry ?? {})) {
    const held = side as Record<string, unknown> | null;
    const ring = held?.knightRing as Record<string, unknown> | undefined;
    if (ring === undefined || typeof ring.outerRadius !== "number") {
      continue;
    }
    const inner = typeof ring.innerRadius === "number" ? ring.innerRadius : 0;
    /* Written afresh rather than patched, so the three come out in the order
       the interface declares them. The width is rounded because subtracting
       one of these fractions from another does not land on the number either
       of them was written as — 2.4 less 2.25 is 0.1499999999999999 — and that
       is what the reader would then see in the field. Six places is finer than
       anything anyone sets and coarse enough to hide the arithmetic. */
    held!.knightRing = {
      innerRadius: Math.min(inner, ring.outerRadius),
      width: Math.round(Math.abs(ring.outerRadius - inner) * 1e6) / 1e6,
      gapWidth: ring.gapWidth,
    };
  }

  attacks.rays = rays;

  /* And the switch that holds the two pictures' fractions together, which said
     only "linked" when there was nothing else it could have meant. */
  if ("linkedIntensity" in attacks) {
    attacks.raysAndHeatmapIntensityLinked = attacks.linkedIntensity;
    delete attacks.linkedIntensity;
  }

  /* Last, once every node is where it belongs and under the name it keeps. */
  inOrder(attacks, [
    "rays",
    "heatmap",
    "raysAndHeatmapIntensityLinked",
    "pins",
    "checkAndCheckmate",
  ]);
}

/**
 * Version 46's loose top-level settings, gathered into the `board`, `pieces`
 * and `lab` nodes version 47 keeps them in.
 *
 * The panel has always shown them in those two groups; the object simply did
 * not, so a setting was in one place on the screen and another in the file.
 * Four are renamed on the way in, each losing a word the node it now sits in
 * already says.
 *
 * What is left at the top is the attacks, which were a group already.
 */
function groupBoardAndPieces(candidate: Record<string, unknown>): void {
  if (typeof candidate.board === "object" && candidate.board !== null) {
    return;
  }
  const take = (from: string, to: string, into: Record<string, unknown>) => {
    if (from in candidate) {
      into[to] = candidate[from];
      delete candidate[from];
    }
  };

  const board: Record<string, unknown> = {};
  take("theme", "theme", board);
  take("darkThemeTextColor", "darkThemeTextColor", board);
  take("boardColors", "squares", board);
  take("lastMove", "lastMove", board);
  take("hedge", "hedging", board);
  take("grid", "grid", board);

  const pieces: Record<string, unknown> = {};
  take("pieceTint", "tint", pieces);
  take("showCapturedPiecesBar", "showCaptured", pieces);
  take("move", "moveMotion", pieces);
  take("fadeTimeMs", "fadeTimeMs", pieces);

  /* The Lab tab's own two, which in 46 were one setting lying on its own and
     one answer the app forgot between visits. */
  const lab: Record<string, unknown> = {};
  take("playPeriodPerPositionSec", "playPeriodPerPositionSec", lab);
  if (typeof lab.shareGameWithAutoplay !== "boolean") {
    lab.shareGameWithAutoplay = true;
  }

  candidate.board = board;
  candidate.pieces = pieces;
  candidate.lab = lab;

  /*
    And the whole record written out in the order this build writes it.

    A key added to an object goes on the end, so a lifted record would carry its
    groups after `attacks` while a file this build ships carries them before —
    the same settings, read the same way, and a needless difference in every
    exported file. Anything this build does not know about keeps its place after
    the four, rather than being dropped for not being on the list.
  */
  inOrder(candidate, ["schemaVersion", "board", "pieces", "lab", "attacks"]);
}

/**
 * What changed while version 47 was being written, put right in a record that
 * predates it: two names, and the two per-side switches.
 *
 * A version says what shape to expect, and a record whose version matches is
 * dereferenced rather than checked — so one written a build or two ago, with
 * `opacity` where `maxOpacity` now is, is worse than a refused file: the page
 * comes up blank. Renaming here costs two comparisons per load and keeps a
 * browser that was open through the change working.
 *
 * A record written by any released build passes through untouched.
 */
function renameWithinVersion(candidate: Record<string, unknown>): void {
  const attacks = candidate.attacks as Record<string, unknown> | undefined;
  if (attacks === undefined || attacks === null || typeof attacks !== "object") {
    return;
  }
  const move = (held: unknown, was: string, is: string) => {
    const node = held as Record<string, unknown> | undefined;
    if (node === undefined || node === null || typeof node !== "object") {
      return;
    }
    if (node[is] === undefined && node[was] !== undefined) {
      node[is] = node[was];
    }
    delete node[was];
  };
  move(attacks.rays, "opacity", "maxOpacity");
  move(attacks.heatmap, "strength", "maxStrength");
  /* And the per-side switches, which arrived in the same version. */
  for (const node of [attacks.rays, attacks.heatmap]) {
    if (node !== null && typeof node === "object") {
      sidesShown(node as Record<string, unknown>);
    }
  }
}

/**
 * Reads a settings file, refusing anything this build cannot be sure it
 * understands.
 *
 * A version other than the current one is rejected outright rather than guessed
 * at, save where this build knows exactly what changed and can say so in code:
 * 46 is read, its ray settings gathered into the node they now live in, and
 * everything else refused. Refusing the rest means a later migration can rely
 * on never having silently mis-read anything.
 */
export function parseSettings(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { settings: null, error: "That file is not valid JSON." };
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { settings: null, error: "That file does not hold a settings object." };
  }

  const candidate = raw as Record<string, unknown>;
  /*
    The field was called `optionsSchemaVersion` while the settings were called
    options, and files written then are still on people's disks. Read either
    name, and there is no need to raise the version over it: the shape those
    files hold is the shape this build reads, and only the label on the door
    has changed.
  */
  const version = candidate.schemaVersion ?? candidate.optionsSchemaVersion;

  if (typeof version !== "number") {
    return {
      settings: null,
      error: `No schema version in that file; this build reads ${SETTINGS_SCHEMA_VERSION}.`,
    };
  }
  if (version === 46) {
    liftRays(candidate);
    groupBoardAndPieces(candidate);
  } else if (version === SETTINGS_SCHEMA_VERSION) {
    renameWithinVersion(candidate);
  } else {
    return {
      settings: null,
      error: `Those settings are version ${version}; this build reads ${SETTINGS_SCHEMA_VERSION}.`,
    };
  }

  // The version says the shape should be right, but a truncated file would
  // still pass it, and a missing group renders as a blank screen rather than
  // an error.
  const missing = REQUIRED_KEYS.filter((key) => !(key in candidate));
  if (missing.length > 0) {
    return {
      settings: null,
      error: `Those settings are missing: ${missing.join(", ")}.`,
    };
  }

  /*
    Handed back under the modern name whichever it arrived under, so that
    nothing downstream has to know there were ever two, and so that exporting a
    file that was read from an old one writes the new name.

    Which way round the board faces used to be in here. It is not a setting —
    it is where the reader is sitting, and it lives in this browser now — so a
    file or a record that still carries it has it quietly taken out rather than
    refused. There is nothing to migrate: the value said what one browser was
    doing on the day it was written, and this browser has its own.
  */
  const settings = {
    ...candidate,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
  } as unknown as Settings;
  const held = settings as unknown as Record<string, unknown>;
  delete held.optionsSchemaVersion;
  delete held.orientation;

  return { settings, error: null };
}
