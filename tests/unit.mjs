/**
 * The parts that need neither a server nor a browser.
 *
 *   npm run test:unit
 *
 * Run straight from the TypeScript: node strips the types, so there is no build
 * step between what is written and what is checked.
 */
import { parsePgn, toPgn, withoutUnknownTags } from "../src/chess/pgn.ts";
import { lineIndex, linesOf, withOnlyLine, withoutLinesAfter, withoutLinesBefore, lineTree, pathSoFar, playInto, readTree, resultShown, soleLine, tourIndex, tourPlaces, walk, writeMovetext } from "../src/chess/variations.ts";
import { parseSettings, settingsToJson } from "../src/app/settingsFile.ts";
import { SETTINGS_SCHEMA_VERSION } from "../src/app/settings.ts";
import DEFAULT_SETTINGS_JSON from "../src/app/presets/default-settings.json" with { type: "json" };
const DEFAULT_SETTINGS = DEFAULT_SETTINGS_JSON;
import { lineOf as lineFromHistory } from "../src/chess/history.ts";
import { addressWithoutOpening, fromBase64Url, openingFromUrl, toBase64Url } from "../src/app/sharing.ts";
import { reachSignature } from "../src/chess/attacks.ts";
import { halfMoves } from "../src/app/friend/counting.ts";
import { nextStashName } from "../src/chess/stash.ts";
import { pinnedSquares } from "../src/chess/pins.ts";
import { availableFor, materialOn } from "../src/chess/available.ts";
import { createGifWriter } from "../src/app/gif/encoder.ts";
import { asFileName, asGifName, suggestedFileName, suggestedGifName, surnameOf } from "../src/app/gif/fileName.ts";
import { FRAME_STEPS, frameStepLabel, restAfterFade } from "../src/app/gif/timing.ts";
import { i420Size, toI420, VIDEO_COLOUR_SPACE } from "../src/app/gif/yuv.ts";
import { readGif } from "./gif.mjs";
import {
  attackersOn,
  boardDuring,
  moveBetween,
  travellersOf,
} from "../src/chess/flight.ts";
import {
  describeHandicap,
  positionWithHandicap,
} from "../src/chess/handicap.ts";
import {
  forgetGame,
  forgetSeats,
  gameOf,
  markGameOver,
  isChallengerSeat,
  loadGame,
  readGameId,
  saveGame,
  savedGames,
  seatOf,
  playersOf,
  spellGameId,
} from "../src/app/friend/storage.ts";
import { friendlyGameName } from "../src/app/friend/gameName.ts";
import { describeEnding } from "../src/app/friend/ending.ts";
import { mix, readRgb, toHex, toLinear, toSrgb } from "../src/visualization/color.ts";
import { applyMove, isPromotion } from "../src/chess/moves.ts";
import { asBoardEditorPosition, place, boardEditorProblems, boardEditorWarnings, shift, TWO_KINGS, withTurn } from "../src/chess/boardEditor.ts";
import { lineLabel, pageLine } from "../src/chess/linePath.ts";
import { DEFAULT_GLYPH_SET, glyphSetNamed, glyphSetsFrom, readGlyph, readShift } from "../src/visualization/glyphs.ts";
import { readdirSync, readFileSync } from "node:fs";
import CLASSIC_BROWN_JSON from "../src/app/presets/settings-classic-brown.json" with { type: "json" };
import CLASSIC_GREEN_JSON from "../src/app/presets/settings-classic-green.json" with { type: "json" };
import { Chess } from "chess.js";

let passed = 0;
let failed = 0;
function check(what, ok, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}${ok ? "" : "  <- " + detail}`);
}

/** A history of a few moves, newest first, as the app keeps one. */
function lineOf(sans) {
  const board = new Chess();
  const entries = [{ fen: board.fen(), move: null }];
  for (const san of sans) {
    board.move(san);
    entries.unshift({ fen: board.fen(), move: san });
  }
  return { entries, current: 0 };
}

console.log("\nPGN headers\n");
{
  /* A task: where it starts, how it came out, and nothing that says nothing —
     as tasks/task-NN.pgn reads. */
  const start = "7k/1QBb3P/8/8/8/2K5/8/6R1 w - - 0 1";
  const task = new Chess(start);
  const taskLine = [{ fen: start, move: null }];
  for (const san of ["Bf4", "Be8", "Be5#"]) {
    task.move(san);
    taskLine.unshift({ fen: task.fen(), move: san });
  }
  const written = toPgn({ entries: taskLine, current: 0 });
  check("a task with nobody's names is written with its position and its result, and no unknowns",
    written === '[Result "1-0"]\n[SetUp "1"]\n[FEN "7k/1QBb3P/8/8/8/2K5/8/6R1 w - - 0 1"]\n\n1. Bf4 Be8 2. Be5# 1-0', JSON.stringify(written));
  check("and reads back as a game between nobody, at the same position",
    parsePgn(written).players.white === "White" && parsePgn(written).entries?.at(-1)?.fen === start);
  const read = '[Event "?"]\n[Site "?"]\n[Date "2024.??.??"]\n[Round "?"]\n[White "Anna"]\n[Black "?"]\n[Result "*"]\n\n1. e4 {what now?} e5 *\n';
  check("a game read in loses only its unknowns: a partly known date, a name and a question in a comment all stay",
    withoutUnknownTags(read) === '[Date "2024.??.??"]\n[White "Anna"]\n[Result "*"]\n\n1. e4 {what now?} e5 *\n', JSON.stringify(withoutUnknownTags(read)));
  check("and a PGN with no tags at all is left as it is", withoutUnknownTags("1. e4 e5 *") === "1. e4 e5 *");
  const history = lineOf(["e4", "e5", "Nf3"]);
  const pgn = toPgn(history, null, {
    white: "Bob",
    black: "Alice",
    site: "chess.example.org",
  });
  const tag = (name) => new RegExp(`\\[${name} "([^"]*)"\\]`).exec(pgn)?.[1];
  check("White and Black carry the players' names",
    tag("White") === "Bob" && tag("Black") === "Alice", pgn?.slice(0, 200));
  check("Site is where the game was played", tag("Site") === "chess.example.org", tag("Site"));
  check("Round, which nobody knows, is not written at all", tag("Round") === undefined && !/\?"\]/.test(pgn), pgn);
  check("Event, likewise", tag("Event") === undefined, tag("Event"));
  const today = new Date();
  const expected = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  check("Date is today, written the way PGN writes dates", tag("Date") === expected, tag("Date"));
  check("and the moves are still there", /1\. e4 e5 2\. Nf3/.test(pgn ?? ""), pgn?.slice(-80));
}
{
  const pgn = toPgn(lineOf(["d4"]), null, null);
  const tag = (name) => new RegExp(`\\[${name} "([^"]*)"\\]`).exec(pgn)?.[1];
  check("a game with nobody in it invents nobody",
    (tag("White") ?? "?") === "?" && (tag("Black") ?? "?") === "?",
    `White=${tag("White")} Black=${tag("Black")}`);
}
{
  const pgn = toPgn(lineOf(["e4"]), "My study", {
    white: "Bob", black: "Alice", site: "here",
  });
  check("a name for the game survives beside the players",
    /\[Event "My study"\]/.test(pgn ?? ""), pgn?.slice(0, 120));
}

console.log("\nHow a game ended\n");
{
  const pgn = toPgn(lineOf(["e4", "e5"]), null,
    { white: "Bob", black: "Alice", site: "here" },
    { result: "1/2-1/2", how: describeEnding("agreement") });
  const tag = (name) => new RegExp(`\\[${name} "([^"]*)"\\]`).exec(pgn)?.[1];
  check("a draw by agreement is a draw in the Result tag",
    tag("Result") === "1/2-1/2", tag("Result"));
  check("and says so in words after the last move",
    /\{Draw by agreement\} 1\/2-1\/2$/.test((pgn ?? "").trim()), (pgn ?? "").slice(-60));
  check("with PGN's own word for a game that ended by the rules",
    tag("Termination") === "normal", tag("Termination"));
}
{
  const pgn = toPgn(lineOf(["e4", "e5"]), null, null,
    { result: "0-1", how: describeEnding("resignation") });
  const tag = (name) => new RegExp(`\\[${name} "([^"]*)"\\]`).exec(pgn)?.[1];
  check("a resignation gives the game to the other side",
    tag("Result") === "0-1", tag("Result"));
  check("and names itself", /\{Resignation\}/.test(pgn ?? ""), (pgn ?? "").slice(-60));
}
{
  const pgn = toPgn(lineOf(["e4"]), null, null, null);
  const tag = (name) => new RegExp(`\\[${name} "([^"]*)"\\]`).exec(pgn)?.[1];
  check("a game still being played is still unfinished",
    tag("Result") === "*" && !/Termination/.test(pgn ?? ""), tag("Result"));
}
{
  // Fool's mate: the board says it, and the exporter must not disagree.
  const pgn = toPgn(lineOf(["f3", "e5", "g4", "Qh4#"]), null, null,
    { result: "0-1", how: describeEnding("checkmate") });
  check("a mate on the board reads the same way",
    /\[Result "0-1"\]/.test(pgn ?? "") && /\{Checkmate\} 0-1$/.test((pgn ?? "").trim()),
    (pgn ?? "").slice(-70));
}
{
  // The same mate, studied rather than played: nobody says how it ended but the board.
  const pgn = toPgn(lineOf(["f3", "e5", "g4", "Qh4#"]), null, null, null);
  const tag = (name) => new RegExp(`\\[${name} "([^"]*)"\\]`).exec(pgn)?.[1];
  check("a line that ends in mate is won, with nobody having said so",
    tag("Result") === "0-1" && /Qh4# 0-1$/.test((pgn ?? "").trim()), (pgn ?? "").slice(-70));
  check("and a line with nobody in it says no more than that: no comment, no Termination",
    !/\{/.test(pgn ?? "") && tag("Termination") === undefined, (pgn ?? "").slice(-70));
  const scholar = toPgn(lineOf(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]), null, null, null);
  check("by White as well as by Black",
    /\[Result "1-0"\]/.test(scholar ?? "") && /Qxf7# 1-0$/.test((scholar ?? "").trim()),
    (scholar ?? "").slice(-70));
  const named = toPgn(lineOf(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]), null,
    { white: "Bob", black: "Alice", site: "here" }, null);
  check("while a game somebody played says how it ended, in words and in the Termination tag",
    /\[Termination "normal"\]/.test(named ?? "") && /\{Checkmate\} 1-0$/.test((named ?? "").trim()),
    (named ?? "").slice(-70));
  // Sam Loyd's stalemate in ten.
  const loyd = toPgn(lineOf(["e3", "a5", "Qh5", "Ra6", "Qxa5", "h5", "h4", "Rah6", "Qxc7", "f6", "Qxd7+", "Kf7",
    "Qxb7", "Qd3", "Qxb8", "Qh7", "Qxc8", "Kg6", "Qe6"]), null, null, null);
  check("a line that ends in stalemate is drawn",
    /\[Result "1\/2-1\/2"\]/.test(loyd ?? "") && /Qe6 1\/2-1\/2$/.test((loyd ?? "").trim()),
    (loyd ?? "").slice(-70));
  const going = toPgn(lineOf(["e4", "e5", "Qh5"]), null, null, null);
  check("and one that has only reached a check or a threat is still unfinished",
    /\[Result "\*"\]/.test(going ?? "") && !/Termination/.test(going ?? ""), (going ?? "").slice(-40));
}

console.log("\nOdds\n");
{
  const fen = positionWithHandicap({ giver: "challenger", piece: "pawn" }, "w");
  check("the challenger's own f-pawn comes off when they give one",
    fen.startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPP1PP"), fen);
}
{
  const fen = positionWithHandicap({ giver: "opponent", piece: "pawn" }, "w");
  check("the other side's does when they do",
    fen.startsWith("rnbqkbnr/ppppp1pp"), fen);
}
{
  const fen = positionWithHandicap({ giver: "challenger", piece: "rook" }, "w");
  check("giving a rook gives up that side's castling",
    fen.split(" ")[2] === "Kkq", fen.split(" ")[2]);
}
{
  const white = positionWithHandicap({ giver: "challenger", piece: "knight" }, "w");
  const black = positionWithHandicap({ giver: "challenger", piece: "knight" }, "b");
  check("the odds follow the person, not the color", white !== black, `${white}\n${black}`);
}
{
  check("no odds is the usual array",
    positionWithHandicap(null, "w") === new Chess().fen(), positionWithHandicap(null, "w"));
}
{
  const given = { giver: "challenger", piece: "pawn" };
  check("one value reads both ways",
    describeHandicap(given, "challenger") === "I give a pawn" &&
    describeHandicap(given, "opponent") === "My opponent gives a pawn",
    `${describeHandicap(given, "challenger")} / ${describeHandicap(given, "opponent")}`);
  check("and an even game says so", describeHandicap(null, "challenger") === "None");
}

console.log("\nGame ids\n");
{
  check("read however it was written down",
    readGameId("482 913 657") === "482913657" &&
    readGameId("482-913-657") === "482913657" &&
    readGameId("  482913657 ") === "482913657");
  check("said in threes, as it would be read out", spellGameId("482913657") === "482 913 657",
    spellGameId("482913657"));
  check("too short, too long, or leading zero are not ids",
    readGameId("12345678") === null &&
    readGameId("1234567890") === null &&
    readGameId("082913657") === null);
  check("and neither is prose", readGameId("hello") === null);
}

console.log("\nNaming a game that was played\n");
{
  const name = friendlyGameName("Bob", "Alice", "482913657", new Date(2026, 7, 27));
  check("both players, the day, and the id it was played under",
    name === "Bob - Alice - 2026.08.27 - 482913657", name);
}
{
  const name = friendlyGameName("Bob", "Alice", "482913657", new Date(2026, 0, 5));
  check("months and days are padded, so names sort by date",
    name === "Bob - Alice - 2026.01.05 - 482913657", name);
}

console.log("\nColour on the two scales\n");
{
  check("black and white are the same on either scale",
    toLinear(0) === 0 && toLinear(255) === 1 &&
    Math.round(toSrgb(0)) === 0 && Math.round(toSrgb(1)) === 255);
  check("the curve is its own way back",
    [0, 1, 17, 64, 128, 200, 255].every(
      (v) => Math.abs(toSrgb(toLinear(v)) - v) < 1e-9));
  check("mid grey carries about a fifth of white's light",
    Math.abs(toLinear(128) - 0.216) < 0.001, toLinear(128));
  check("half the light is written 188, not 128",
    Math.round(toSrgb(0.5)) === 188, toSrgb(0.5));
}

console.log("\nShading colours mixed as light\n");
{
  const red = readRgb("#ff0000");
  const green = readRgb("#00ff00");
  check("a colour with nothing to mix into is left as it was",
    toHex(mix(red, green, 1)) === "#ff0000" &&
    toHex(mix(red, green, 0)) === "#00ff00",
    toHex(mix(red, green, 1)) + " " + toHex(mix(red, green, 0)));
  check("red and green in equal measure make a bright yellow, not a brown",
    toHex(mix(red, green, 0.5)) === "#bcbc00", toHex(mix(red, green, 0.5)));
  check("three attackers to one leans that way without hiding the other",
    toHex(mix(red, green, 0.75)) === "#e18900", toHex(mix(red, green, 0.75)));
  check("mixing is symmetric: the same pair either way round",
    toHex(mix(red, green, 0.3)) === toHex(mix(green, red, 0.7)));
  check("a pair that averages near grey is not blown up to white",
    toHex(mix(readRgb("#ff0080"), readRgb("#00ff80"), 0.5)) === "#bcbc80",
    toHex(mix(readRgb("#ff0080"), readRgb("#00ff80"), 0.5)));
  check("short hex is read as the long form",
    toHex(readRgb("#f80")) === "#ff8800", toHex(readRgb("#f80")));
}

console.log("\nSettings files, old and new\n");
{
  const now = JSON.parse(settingsToJson(DEFAULT_SETTINGS));
  check("what this build writes carries the modern name",
    now.schemaVersion === SETTINGS_SCHEMA_VERSION &&
    now.optionsSchemaVersion === undefined,
    JSON.stringify(Object.keys(now).slice(0, 2)));

  check("and reads back what it wrote",
    parseSettings(JSON.stringify(now)).settings?.schemaVersion ===
      SETTINGS_SCHEMA_VERSION);

  // A file from when the settings were called options.
  const { schemaVersion, ...rest } = now;
  const legacy = { optionsSchemaVersion: schemaVersion, ...rest };
  const read = parseSettings(JSON.stringify(legacy));
  check("a file written under the old name is still read",
    read.settings !== null, read.error ?? "");
  check("and comes back under the new one, with the old one gone",
    read.settings?.schemaVersion === SETTINGS_SCHEMA_VERSION &&
    read.settings?.optionsSchemaVersion === undefined,
    JSON.stringify(read.settings && Object.keys(read.settings).slice(0, 2)));
  check("so exporting it again writes the new name",
    JSON.parse(settingsToJson(read.settings)).optionsSchemaVersion === undefined);

  // Neither name at all is still a file this build will not touch.
  const nameless = { ...rest };
  check("a file with no version at all is refused",
    parseSettings(JSON.stringify(nameless)).settings === null);
  check("and one from another revision too",
    parseSettings(JSON.stringify({ ...now, schemaVersion: 999 })).settings === null);
}

console.log("\nWhat an exported file is called\n");
{
  const { settingsFileName, SETTINGS_FILE_NAME } = await import(
    "../src/app/settingsFile.ts"
  );
  check("a preset of one's own is what the file is called",
    settingsFileName("Evening board") === "Evening board.json",
    settingsFileName("Evening board"));
  check("and so is a built-in's",
    settingsFileName("Blue - orange - with attacks") === "Blue - orange - with attacks.json",
    settingsFileName("Blue - orange - with attacks"));
  check("nor is anything a file system would rather not be given",
    settingsFileName('a/b:c*d?e"f<g>h|i') === "abcdefghi.json",
    settingsFileName('a/b:c*d?e"f<g>h|i'));
  check("and with no name at all it falls back to the app's own",
    settingsFileName(null) === SETTINGS_FILE_NAME &&
    settingsFileName("   ") === SETTINGS_FILE_NAME);
}

console.log("\nRays drawn as needles\n");
{
  const {
    cutPlaneFrom,
    needlePath,
    rayBaseChord,
    rayStopTip,
    rayStopWedgePath,
    squareCenter,
  } = await import("../src/visualization/geometry.ts");

  /* A needle has a base across the piece and a point where the ray stops. Read
     the corners back out of the path it draws. */
  const corners = (d) =>
    d
      .split(/[ML]\s*/)
      .slice(1)
      .map((pair) => pair.replace("Z", "").trim().split(/\s+/).map(Number));

  const base = rayBaseChord({ x: 0, y: 0 }, { x: 1, y: 0 }, 20, 6);

  /* Straight-sided, it is three corners: the two of the base, and the point. */
  const straight = needlePath(base, { x: 100, y: 0 }, "triangle");
  check("a triangle needle is its base and the point, and nothing else",
    JSON.stringify(corners(straight)) ===
      JSON.stringify([[20, 6], [100, 0], [20, -6]]),
    straight);
  check("and it is drawn in straight lines — no arcs about it",
    !straight.includes("A"), straight);

  /*
    Half an ellipse: the base across the square, and the two quarters that meet
    at the point. What matters about the path is that both quarters bend the
    same way round — the same sweep — or the needle comes out an hourglass,
    fat at both ends and pinched in the middle, which is what a mirrored
    ellipse looks like.
  */
  const said = needlePath(base, { x: 100, y: 0 }, "ellipse");
  const arcs = [...said.matchAll(/A ([-\d.]+) ([-\d.]+) ([-\d.]+) (\d) (\d) ([-\d.]+) ([-\d.]+)/g)]
    .map((found) => found.slice(1).map(Number));
  check("a needle is two arcs from the base, meeting at the point",
    arcs.length === 2 && arcs[0][5] === 100 && arcs[0][6] === 0,
    said);
  check("both bend the same way round, or it is an hourglass",
    arcs[0][4] === arcs[1][4], said);
  check("its long radius runs to the point and its short one is the width",
    arcs.every((arc) => arc[0] === 80 && arc[1] === 6), said);

  /* How wide a base is across the ray, which is the width a reader set. */
  const width = (pair, along) => {
    const across = { x: -along.y, y: along.x };
    return Math.abs(
      (pair[0].x - pair[1].x) * across.x + (pair[0].y - pair[1].y) * across.y
    );
  };
  /* A ray on one of the board's own lines starts on a chord instead: half a
     side out, whichever way it runs, so the eight of a queen stand on one
     octagon. */
  const lines = [
    ["a file", { x: 0, y: -1 }],
    ["a rank", { x: 1, y: 0 }],
    ["a diagonal", { x: Math.SQRT1_2, y: Math.SQRT1_2 }],
    ["the other diagonal", { x: -Math.SQRT1_2, y: Math.SQRT1_2 }],
    ["a knight's line", { x: 2 / Math.sqrt(5), y: 1 / Math.sqrt(5) }],
  ];
  for (const [name, along] of lines) {
    const pair = rayBaseChord({ x: 0, y: 0 }, along, 20, 6);
    const middle = {
      x: (pair[0].x + pair[1].x) / 2,
      y: (pair[0].y + pair[1].y) / 2,
    };
    check(`a ray along ${name} starts half a side out from the centre`,
      Math.abs(Math.hypot(middle.x, middle.y) - 20) < 1e-9,
      String(Math.hypot(middle.x, middle.y)));
    check(`and its base is square across the ray, along ${name}`,
      Math.abs((pair[0].x - pair[1].x) * along.x + (pair[0].y - pair[1].y) * along.y) < 1e-9);
    check(`and exactly the width it was given, along ${name}`,
      Math.abs(width(pair, along) - 12) < 1e-9, String(width(pair, along)));
  }

  /* A knight's eight run at angles the board has no name for, and start on the
     same rule: half a side out, square across each one's own aim. */
  const knightLines = [
    [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2], [1, -2], [2, -1],
  ].map(([dx, dy]) => {
    const length = Math.hypot(dx, dy);
    return { x: dx / length, y: dy / length };
  });
  const knightStarts = knightLines.map((along) => {
    const d = cutPlaneFrom({ x: 0, y: 0 }, along, 20);
    const n = d.match(/-?[\d.]+/g).map(Number);
    /* The cut is the line between the first two corners; how far out the ray
       begins is that line's nearest point to the centre. */
    const a = { x: n[0], y: n[1] };
    const b = { x: n[2], y: n[3] };
    const run = { x: b.x - a.x, y: b.y - a.y };
    const at = -(a.x * run.x + a.y * run.y) / (run.x * run.x + run.y * run.y);
    return Math.hypot(a.x + run.x * at, a.y + run.y * at);
  });
  check("a knight's eight start half a side out, like everything else",
    knightStarts.every((far) => Math.abs(far - 20) < 1e-9),
    JSON.stringify(knightStarts.map((far) => +far.toFixed(3))));
  check("and each on a cut square across its own aim",
    knightLines.every((along) => {
      const n = cutPlaneFrom({ x: 0, y: 0 }, along, 20).match(/-?[\d.]+/g).map(Number);
      const run = { x: n[2] - n[0], y: n[3] - n[1] };
      return Math.abs(run.x * along.x + run.y * along.y) < 1e-9;
    }));

  /* Which is the same as saying the eight bases of a queen are one octagon. */
  const round = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: Math.SQRT1_2, y: Math.SQRT1_2 }, { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
    { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  ].map((along) => {
    const pair = rayBaseChord({ x: 0, y: 0 }, along, 20, 6);
    return Math.hypot((pair[0].x + pair[1].x) / 2, (pair[0].y + pair[1].y) / 2);
  });
  check("so a queen's eight rays all set off from one octagon",
    round.every((far) => Math.abs(far - 20) < 1e-9), JSON.stringify(round));

  /* And they stop as evenly as they start: a diagonal no longer reaches half
     again as far into the square it ends on. */
  const stops = [
    ["d4", [1, 0]],
    ["d4", [0, 1]],
    ["d4", [1, 1]],
    ["d4", [-1, 1]],
  ].map(([square, direction]) => {
    const tip = rayStopTip(square, direction, 12);
    const middle = squareCenter(square);
    return Math.hypot(tip.x - middle.x, tip.y - middle.y);
  });
  check("and every ray stops the same distance into the square it reaches",
    stops.every((far) => Math.abs(far - 12) < 1e-9), JSON.stringify(stops));

  /* The point is where a stripe stops: the wedge below starts at the same
     place, which is what keeps the two kinds of ray the same length. */
  for (const [square, direction] of [["d4", [1, 0]], ["d4", [1, 1]], ["e5", [0, -1]]]) {
    const tip = rayStopTip(square, direction, 12);
    const wedge = rayStopWedgePath(square, direction, 12).split(/[ML]\s*/)[1].trim().split(/\s+/).map(Number);
    check(`a needle ends where a stripe ends, on ${square} along ${direction}`,
      Math.abs(tip.x - wedge[0]) < 1e-9 && Math.abs(tip.y - wedge[1]) < 1e-9,
      JSON.stringify({ tip, wedge }));
  }

  /* And it stops beyond the middle of the square it reaches, not at it. */
  const middle = squareCenter("d4");
  const beyond = rayStopTip("d4", [1, 0], 12);
  check("which is past the middle of that square",
    beyond.x > middle.x && Math.abs(beyond.y - middle.y) < 1e-9);

}

console.log("\nA ray through a piece, as needles\n");
{
  const { needlePath, rayBaseChord } =
    await import("../src/visualization/geometry.ts");

  /* One base, and a needle to each of the places the ray stops: the first man
     it meets, the second, and the end of the board. */
  const base = rayBaseChord({ x: 0, y: 0 }, { x: 1, y: 0 }, 20, 10);
  const tips = [80, 200, 320].map((far) => ({ x: far, y: 0 }));

  /* How wide a needle is at a given distance along it, read off the shape. */
  const across = (shape, tip, at) => {
    if (shape === "triangle") {
      /* Straight sides, from the base's half-width down to nothing. */
      const half = Math.abs(base[0].y);
      return half * (1 - at / tip.x) * 2;
    }
    const half = Math.abs(base[0].y);
    const along = tip.x - base[0].x;
    const from = at - base[0].x;
    return 2 * half * Math.sqrt(Math.max(1 - (from / along) ** 2, 0));
  };

  for (const shape of ["triangle", "ellipse"]) {
    /* Nested: a needle that reaches further is wider everywhere between. The
       drawing leans on this — each is drawn with the one inside it cut out,
       and a shape that broke out of its neighbour would leave the cut showing
       through as a hole. */
    let holds = true;
    for (let at = base[0].x + 1; at < tips[0].x; at += 5) {
      const widths = tips.map((tip) => across(shape, tip, at));
      holds &&= widths[0] < widths[1] && widths[1] < widths[2];
    }
    check(`a ${shape} needle that reaches further is the wider one all the way`,
      holds);

    /* And what is drawn for a stretch past the first man is the two shapes in
       one path, to be filled even-odd — the band between them. */
    const band = `${needlePath(base, tips[1], shape)} ${needlePath(base, tips[0], shape)}`;
    check(`so a dimmer ${shape} stretch is drawn as one shape inside another`,
      (band.match(/M /g) ?? []).length === 2 &&
        band.startsWith(needlePath(base, tips[1], shape)),
      band.slice(0, 60));
  }
}

console.log("\nWhere a ray picks up again\n");
{
  const { BOARD_SIZE, rayResumePath, rayStopTip, rayStopWedgePath, squareCenter } =
    await import("../src/visualization/geometry.ts");

  /* The two subpaths the resume region is made of, read back as polygons: a
     board-sized rectangle, and the wedge the ray stopped in. */
  const polygons = (d) =>
    d
      .split("M ")
      .slice(1)
      .map((piece) => {
        const numbers = piece.match(/-?[\d.]+/g).map(Number);
        const points = [];
        let x = numbers[0];
        let y = numbers[1];
        points.push([x, y]);
        /* Either absolute corners, or the h/v run the rectangle is written in. */
        const steps = piece.trim().slice(piece.trim().indexOf(" ", piece.trim().indexOf(" ") + 1));
        for (const move of steps.matchAll(/([hvL])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?/g)) {
          if (move[1] === "h") x += Number(move[2]);
          else if (move[1] === "v") y += Number(move[2]);
          else {
            x = Number(move[2]);
            y = Number(move[3]);
          }
          points.push([x, y]);
        }
        return points;
      });

  /* Even-odd, as the clip is filled: a point is in the region when it is inside
     an odd number of the subpaths. */
  const inside = (shapes, [px, py]) =>
    shapes.filter((points) =>
      points.reduce((got, [x1, y1], i) => {
        const [x2, y2] = points[(i + 1) % points.length];
        const crosses =
          y1 > py !== y2 > py && px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1;
        return crosses ? !got : got;
      }, false)
    ).length % 2 === 1;

  const half = 0.55 * 64;
  for (const [square, direction, name] of [
    ["d4", [0, 1], "up a file"],
    ["d4", [1, 0], "along a rank"],
    ["d4", [1, 1], "up a diagonal"],
  ]) {
    const shapes = polygons(rayResumePath(square, direction, half));
    const tip = rayStopTip(square, direction, half);
    const step = { x: tip.x - squareCenter(square).x, y: tip.y - squareCenter(square).y };
    const length = Math.hypot(step.x, step.y);
    const along = { x: step.x / length, y: step.y / length };
    const at = (far) => [tip.x + along.x * far, tip.y + along.y * far];
    check(`a ray ${name} picks up at the point it stopped at`,
      inside(shapes, at(0.5)) && !inside(shapes, at(-0.5)),
      JSON.stringify({ beyond: inside(shapes, at(0.5)), behind: inside(shapes, at(-0.5)) }));
    check(`and is drawn all the way out from there, ${name}`,
      inside(shapes, at(30)) && inside(shapes, at(120)));
    /* What it does not take is what the stretch before it already has: the
       wedge behind that point. */
    check(`while the stretch before it keeps its own wedge, ${name}`,
      !inside(shapes, at(-20)));
  }

  /* And the two really are complementary: the stop wedge is the whole of what
     the resume region leaves out. */
  const d = rayResumePath("d4", [1, 1], half);
  check("the region is the board with that wedge taken out of it",
    d.endsWith(rayStopWedgePath("d4", [1, 1], half)) && d.startsWith(`M ${-BOARD_SIZE}`),
    d.slice(0, 40));
}

console.log("\nDrawn at all, or not\n");
{
  const { raysShown, heatmapShown } = await import("../src/visualization/visible.ts");

  const attacks = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)).attacks;
  check("both are drawn as things stand",
    raysShown(attacks.rays, "me") && heatmapShown(attacks.heatmap, "opponent"));

  /* The switch answers on its own, and the fractions it does not touch are
     still there to come back to. */
  const hushed = JSON.parse(JSON.stringify(attacks));
  hushed.rays.show = false;
  hushed.heatmap.show = false;
  check("a switch turned off draws neither side",
    !raysShown(hushed.rays, "me") && !raysShown(hushed.rays, "opponent") &&
    !heatmapShown(hushed.heatmap, "me") &&
    !heatmapShown(hushed.heatmap, "opponent"));
  check("and leaves the balance where it stood",
    JSON.stringify(hushed.rays.intensity) ===
      JSON.stringify(attacks.rays.intensity) &&
    JSON.stringify(hushed.heatmap.intensity) ===
      JSON.stringify(attacks.heatmap.intensity));

  /* And a side turned off is left out of that picture, whatever the picture's
     own switch says: the two are read together, not one instead of the other. */
  const oneSide = JSON.parse(JSON.stringify(attacks));
  oneSide.rays.showOpponent = false;
  oneSide.heatmap.showOpponent = false;
  check("a side left out is drawn in neither picture",
    !raysShown(oneSide.rays, "opponent") &&
      !heatmapShown(oneSide.heatmap, "opponent"));
  check("while the other side goes on being drawn",
    raysShown(oneSide.rays, "me") && heatmapShown(oneSide.heatmap, "me"));
  const bothWays = JSON.parse(JSON.stringify(attacks));
  bothWays.rays.show = false;
  bothWays.rays.showMine = true;
  check("and a picture turned off draws a side it was told to draw",
    !raysShown(bothWays.rays, "me"));

  /* One switch says nothing about the other. */
  const half = JSON.parse(JSON.stringify(attacks));
  half.rays.show = false;
  check("turning the rays off leaves the wash alone",
    !raysShown(half.rays, "me") && heatmapShown(half.heatmap, "me"));
}

console.log("\nSettings written for version 46\n");
{
  const { parseSettings } = await import("../src/app/settingsFile.ts");
  const { SETTINGS_SCHEMA_VERSION } = await import("../src/app/settings.ts");

  /*
    The shipped settings, put back into the shape version 46 held them in: the
    rays lying loose in `attacks` under the names they had there. Written out of
    the current file rather than kept as a copy of an old one, so it cannot
    drift away from what is actually being lifted.
  */
  const asVersion46 = (settings) => {
    const older = JSON.parse(JSON.stringify(settings));
    older.schemaVersion = 46;
    const rays = older.attacks.rays;
    delete older.attacks.rays;
    older.attacks.linkedIntensity = older.attacks.raysAndHeatmapIntensityLinked;
    delete older.attacks.raysAndHeatmapIntensityLinked;
    older.attacks.heatmap.strength = older.attacks.heatmap.maxStrength;
    delete older.attacks.heatmap.maxStrength;
    const rayNames = {
      show: "showRays",
      intensity: "rayIntensity",
      maxOpacity: "rayOpacity",
      shape: "rayShape",
      fullWidthDiagonals: "fullWidthDiagonalRays",
    };
    for (const [key, value] of Object.entries(rays)) {
      /* 46 had no per-side switches at all, in either picture. */
      if (key === "showMine" || key === "showOpponent") {
        continue;
      }
      older.attacks[rayNames[key] ?? key] = value;
    }
    /* The knight's ring was two radii then. */
    for (const side of Object.values(older.attacks.geometry)) {
      const ring = side.knightRing;
      side.knightRing = {
        innerRadius: ring.innerRadius,
        outerRadius: ring.innerRadius + ring.width,
        gapWidth: ring.gapWidth,
      };
    }
    /* And the board and the men, which lay loose at the top of the object. */
    const loose = {
      squares: "boardColors",
      hedging: "hedge",
      tint: "pieceTint",
      showCaptured: "showCapturedPiecesBar",
      moveMotion: "move",
    };
    for (const group of ["board", "pieces", "lab"]) {
      for (const [key, value] of Object.entries(older[group])) {
        older[loose[key] ?? key] = value;
      }
      delete older[group];
    }
    /* 46 had no answer to this one at all: the tab asked afresh every visit. */
    delete older.shareGameWithAutoplay;
    /* And it had one bar of men rather than two, so no switch for the second.
       Flattening today's defaults leaves it lying at the top with the rest;
       a record actually written by 46 never had it anywhere. */
    delete older.showAvailable;
    /* Nor a wait of its own before a game's first move: that was a quarter of
       the period, worked out rather than stored. */
    delete older.playInitialDelaySec;
    /* Nor the paces for a game with variations, which it could not play. */
    delete older.playBackStepSec;
    delete older.playBackStepSpeedup;
    delete older.playLineEndHoldSec;
    /* Nor a choice of piece set: the men were the font's glyphs. */
    delete older.glyphSet;
    return older;
  };

  const older = asVersion46(DEFAULT_SETTINGS);
  const read = parseSettings(JSON.stringify(older)).settings;
  check("a version 46 record is read rather than refused",
    read !== null, parseSettings(JSON.stringify(older)).error ?? "");
  check("and comes back as this build's version",
    read?.schemaVersion === SETTINGS_SCHEMA_VERSION);
  check("its rays are gathered into a node of their own",
    JSON.stringify(read?.attacks.rays) ===
      JSON.stringify(DEFAULT_SETTINGS.attacks.rays),
    JSON.stringify(read?.attacks.rays));
  check("the knight's ring comes back as a radius and a width",
    JSON.stringify(read?.attacks.rays.geometry.me.knightRing) ===
      JSON.stringify(DEFAULT_SETTINGS.attacks.rays.geometry.me.knightRing),
    JSON.stringify(read?.attacks.rays.geometry.me.knightRing));
  check("and a ring given the wrong way round keeps the ring it drew",
    (() => {
      const turned = asVersion46(DEFAULT_SETTINGS);
      const ring = turned.attacks.geometry.me.knightRing;
      const swapped = { ...ring, innerRadius: ring.outerRadius, outerRadius: ring.innerRadius };
      turned.attacks.geometry.me.knightRing = swapped;
      const back = parseSettings(JSON.stringify(turned)).settings;
      return (
        JSON.stringify(back?.attacks.rays.geometry.me.knightRing) ===
        JSON.stringify(DEFAULT_SETTINGS.attacks.rays.geometry.me.knightRing)
      );
    })());
  check("and nothing of them is left lying beside the heatmap",
    ["showRays", "rayIntensity", "rayOpacity", "rayShape", "colors",
     "geometry", "knightGeometry", "outlineWidths", "outlineColors",
     "outlineOpacity", "xRayDecayFactor", "straightRayOpacityDecay",
     "fullWidthDiagonalRays"].every((key) => !(key in read.attacks)),
    JSON.stringify(Object.keys(read?.attacks ?? {})));
  check("the board and the men are gathered into two nodes of their own",
    JSON.stringify(read?.board) === JSON.stringify(DEFAULT_SETTINGS.board) &&
      JSON.stringify(read?.pieces) === JSON.stringify(DEFAULT_SETTINGS.pieces),
    JSON.stringify({ board: read?.board, pieces: read?.pieces }));
  check("and nothing of them is left loose at the top",
    ["theme", "darkThemeTextColor", "boardColors", "grid", "lastMove", "hedge",
     "pieceTint", "showCapturedPiecesBar", "move", "fadeTimeMs"].every(
      (key) => !(key in read)
    ),
    JSON.stringify(Object.keys(read ?? {})));
  check("the pace a game plays at goes with it, into the lab's own node",
    read?.lab.playPeriodPerPositionSec ===
      DEFAULT_SETTINGS.lab.playPeriodPerPositionSec &&
      !("playPeriodPerPositionSec" in read));
  check("and sharing with autoplay, which 46 never wrote down, comes back on",
    read?.lab.shareGameWithAutoplay === true);
  check("and the wait before the first move, which it worked out, is the one a new reader gets",
    read?.lab.playInitialDelaySec === DEFAULT_SETTINGS.lab.playInitialDelaySec, String(read?.lab.playInitialDelaySec));
  check("and the paces for variations, which it never had, are this build's",
    read?.lab.playBackStepSec === DEFAULT_SETTINGS.lab.playBackStepSec &&
      read?.lab.playBackStepSpeedup === DEFAULT_SETTINGS.lab.playBackStepSpeedup &&
      read?.lab.playLineEndHoldSec === DEFAULT_SETTINGS.lab.playLineEndHoldSec,
    JSON.stringify(read?.lab));
  /* And it is written the way this build writes a settings file: same keys, in
     the same order, so an export of a migrated record and one of a shipped
     preset differ only where a setting differs. */
  const order = (node, path = "") =>
    Object.entries(node).flatMap(([key, value]) =>
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? [path + key, ...order(value, `${path}${key}.`)]
        : [path + key]
    );
  check("and the whole record is written in the order this build writes",
    JSON.stringify(order(read)) === JSON.stringify(order(DEFAULT_SETTINGS)),
    JSON.stringify(order(read)));

  check("the heatmap's strength is renamed for what it is",
    JSON.stringify(read?.attacks.heatmap.maxStrength) ===
      JSON.stringify(DEFAULT_SETTINGS.attacks.heatmap.maxStrength) &&
      !("strength" in read.attacks.heatmap),
    JSON.stringify(read?.attacks.heatmap));
  check("and so is the rays' opacity",
    JSON.stringify(read?.attacks.rays.maxOpacity) ===
      JSON.stringify(DEFAULT_SETTINGS.attacks.rays.maxOpacity) &&
      !("opacity" in read.attacks.rays),
    JSON.stringify(read?.attacks.rays.maxOpacity));
  check("while the heatmap and the rest are where they were",
    JSON.stringify(read?.attacks.heatmap) ===
      JSON.stringify(DEFAULT_SETTINGS.attacks.heatmap) &&
    JSON.stringify(read?.attacks.pins) ===
      JSON.stringify(DEFAULT_SETTINGS.attacks.pins) &&
    read?.attacks.raysAndHeatmapIntensityLinked ===
      DEFAULT_SETTINGS.attacks.raysAndHeatmapIntensityLinked);

  /* Three settings arrived in 46 without a version of their own, so a record
     from that time may be silent about them — or answer the yes-or-no question
     the ray shape was asked as at first. */
  const shapeOf = (record) =>
    parseSettings(JSON.stringify(record)).settings?.attacks.rays.shape;
  const quiet = asVersion46(DEFAULT_SETTINGS);
  delete quiet.attacks.rayShape;
  check("a record from before needles gets the shape they settled on",
    shapeOf(quiet) === "ellipse");
  const yes = asVersion46(DEFAULT_SETTINGS);
  delete yes.attacks.rayShape;
  yes.attacks.needleRays = true;
  check("one from when needles were a yes-or-no answer keeps its needle",
    shapeOf(yes) === "ellipse");
  const no = asVersion46(DEFAULT_SETTINGS);
  delete no.attacks.rayShape;
  no.attacks.needleRays = false;
  check("while one that says no keeps its stripes",
    shapeOf(no) === "stripe");
  check("and the old word is not carried on once it has been read",
    parseSettings(JSON.stringify(no)).settings?.attacks.needleRays ===
      undefined);
  const named = asVersion46(DEFAULT_SETTINGS);
  named.attacks.rayShape = "triangle";
  check("a record that names its shape is taken at its word",
    shapeOf(named) === "triangle");
  const nonsense = asVersion46(DEFAULT_SETTINGS);
  nonsense.attacks.rayShape = "banana";
  check("and one that names a shape there is none of falls back",
    shapeOf(nonsense) === "ellipse");

  const dark = asVersion46(DEFAULT_SETTINGS);
  delete dark.attacks.showRays;
  delete dark.attacks.heatmap.show;
  const lit = parseSettings(JSON.stringify(dark)).settings;
  check("a record from before the per-side switches has all four turned on",
    read?.attacks.rays.showMine === true &&
      read?.attacks.rays.showOpponent === true &&
      read?.attacks.heatmap.showMine === true &&
      read?.attacks.heatmap.showOpponent === true);
  check("a record from before the two switches gets them, both on",
    lit?.attacks.rays.show === true && lit?.attacks.heatmap.show === true);
  const hushed = asVersion46(DEFAULT_SETTINGS);
  hushed.attacks.showRays = false;
  hushed.attacks.heatmap.show = false;
  const back = parseSettings(JSON.stringify(hushed)).settings;
  check("while one that says they are off keeps its answer",
    back?.attacks.rays.show === false && back?.attacks.heatmap.show === false);

  /* Only 46 is known. Anything older is still refused rather than guessed at. */
  const ancient = asVersion46(DEFAULT_SETTINGS);
  ancient.schemaVersion = 45;
  const refused = parseSettings(JSON.stringify(ancient));
  check("a version this build knows nothing of is still refused",
    refused.settings === null && refused.error !== null, refused.error ?? "");
}

console.log("\nRecords written while this version was being written\n");
{
  const { parseSettings } = await import("../src/app/settingsFile.ts");

  /* Two names changed inside version 47, so a browser left open through the
     change holds a record that says 47 and reads like 46 in two places. Its
     version matches, so nothing refuses it — and what the app then reaches for
     is not there. */
  const held = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  held.attacks.rays.opacity = held.attacks.rays.maxOpacity;
  delete held.attacks.rays.maxOpacity;
  held.attacks.heatmap.strength = held.attacks.heatmap.maxStrength;
  delete held.attacks.heatmap.maxStrength;
  held.attacks.rays.xRayNeedles = "each";

  const read = parseSettings(JSON.stringify(held)).settings;
  check("a record from mid-version is read under the names in use now",
    JSON.stringify(read?.attacks.rays.maxOpacity) ===
      JSON.stringify(DEFAULT_SETTINGS.attacks.rays.maxOpacity) &&
    JSON.stringify(read?.attacks.heatmap.maxStrength) ===
      JSON.stringify(DEFAULT_SETTINGS.attacks.heatmap.maxStrength),
    parseSettings(JSON.stringify(held)).error ?? "");
  check("and the per-side switches it never had come back on",
    read?.attacks.rays.showMine === true &&
      read?.attacks.heatmap.showOpponent === true);
  check("and the names it was written under are gone",
    !("opacity" in read.attacks.rays) &&
      !("strength" in read.attacks.heatmap));
  /* And a setting that was tried and taken away again goes with them, rather
     than riding along in every file written from here on. */
  check("as is the say a needle briefly had over x-rays",
    !("xRayNeedles" in read.attacks.rays));

  /* And a record already in the shape this build writes is left alone. */
  const now = parseSettings(JSON.stringify(DEFAULT_SETTINGS)).settings;
  check("while one written by this build passes through untouched",
    JSON.stringify(now?.attacks) === JSON.stringify(DEFAULT_SETTINGS.attacks));
}

console.log("\nA knight's ring, ended round\n");
{
  const {
    SQUARE_SIZE,
    ringCapSpanInsideRect,
    ringSectorInsideRect,
    squareBox,
    squareCenter,
  } = await import("../src/visualization/geometry.ts");

  /* A ring of the shipped proportions round a knight on d4, and one of the
     eight squares it reaches. */
  const SQUARE = SQUARE_SIZE;
  const center = squareCenter("d4");
  const inner = 2.25 * SQUARE;
  const outer = 2.4 * SQUARE;
  const mid = (inner + outer) / 2;
  const cap = (outer - inner) / 2;
  const box = squareBox("f5");

  const span = ringCapSpanInsideRect(center, mid, cap, box);
  const at = (angle) => ({
    x: center.x + mid * Math.cos(angle),
    y: center.y + mid * Math.sin(angle),
  });
  /* How far an end's half-disc is from the nearest side of the square: nothing
     if it is touching one, which is what "rounded off against the side" means. */
  const clearance = (point) =>
    Math.min(
      point.x - box.x,
      box.x + box.width - point.x,
      point.y - box.y,
      box.y + box.height - point.y
    );
  check("a rounded end is drawn where its half-disc still fits in the square",
    span !== null && clearance(at(span[0])) >= cap - 1e-9 &&
      clearance(at(span[1])) >= cap - 1e-9,
    JSON.stringify(span));
  check("and it goes as far as it can, up against that side",
    Math.abs(clearance(at(span[0])) - cap) < 1e-6 &&
      Math.abs(clearance(at(span[1])) - cap) < 1e-6,
    JSON.stringify([clearance(at(span[0])), clearance(at(span[1])), cap]));

  /* A round end reaches further than a radial cut, so it has to stop sooner:
     the piece of ring it leaves is inside the one a square cut would take. */
  const straight = ringSectorInsideRect(center, inner, outer, box);
  check("a rounded piece of ring stops short of what a square cut would take",
    span[0] > straight[0] - 1e-9 && span[1] < straight[1] + 1e-9 &&
      span[1] - span[0] < straight[1] - straight[0],
    JSON.stringify({ span, straight }));

  /* And a ring too thick for the square to hold one end has no rounded piece
     at all, rather than a pinched one. */
  check("a ring too thick for the square is not drawn round at all",
    ringCapSpanInsideRect(center, mid, SQUARE, box) === null);
}

console.log("\nWho played a game that was read in\n");
{
  const { parsePgn } = await import("../src/chess/pgn.ts");
  const named = parsePgn(
    '[White "Adolf Anderssen"]\n[Black "Jean Dufresne"]\n\n1. e4 e5 2. Nf3 *'
  );
  check("the names come back as the file says them",
    named.players.white === "Adolf Anderssen" && named.players.black === "Jean Dufresne",
    JSON.stringify(named.players));

  const bare = parsePgn("1. e4 e5 2. Nf3 *");
  check("a file that names nobody calls the players by their colours rather than leaving a blank",
    bare.players.white === "White" && bare.players.black === "Black",
    JSON.stringify(bare.players));

  const asked = parsePgn('[White "?"]\n[Black "  "]\n\n1. e4 *');
  check("and PGN's own question mark is nobody too",
    asked.players.white === "White" && asked.players.black === "Black",
    JSON.stringify(asked.players));

  const broken = parsePgn("this is not a game");
  check("a file that will not read still answers about its players",
    broken.entries === null && broken.players.white === "White" && broken.players.black === "Black");
}

console.log("\nWhich way round the board faces\n");
{
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
  };
  const { boardSide, setBoardSide } = await import("../src/app/boardSide.ts");

  check("a browser that has never said opens White at the bottom",
    boardSide() === "white");
  setBoardSide("black");
  check("and comes back to whichever side it was left on",
    boardSide() === "black");
  setBoardSide("white");
  check("either way round", boardSide() === "white");
  store.set("cv.board-side", "sideways");
  check("anything else is not a side, and White stands",
    boardSide() === "white");

  /* And it is nobody's setting: a settings file that still carries one has it
     taken out rather than being refused. */
  const { parseSettings } = await import("../src/app/settingsFile.ts");
  const older = { ...DEFAULT_SETTINGS, orientation: "black" };
  const read = parseSettings(JSON.stringify(older));
  check("a settings file from when it was a setting still reads",
    read.settings !== null, read.error ?? "");
  check("and the board's side is not in what comes back",
    read.settings !== null && !("orientation" in read.settings));

  globalThis.window = undefined;
}

console.log("\nGames put aside, kept between visits\n");
{
  /* One browser's store, and two tabs reading and writing it. */
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
  };
  const { STASH_KEY, loadStash, mergeStash, saveStash, strangeNames } =
    await import("../src/app/stashStore.ts");
  const { stashGame } = await import("../src/chess/stash.ts");

  const line = (fen) => ({ entries: [{ fen, move: null }], current: 0 });
  const opening = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  check("a browser that has stashed nothing opens with nothing",
    loadStash().length === 0);

  const mine = stashGame([], "Tuesday", line(opening));
  saveStash(mine);
  check("what is put aside is written, and reads back the same",
    JSON.stringify(loadStash()) === JSON.stringify(mine),
    JSON.stringify(loadStash()));
  check("under one key of its own",
    store.size === 1 && store.has(STASH_KEY));

  /* Another tab, which knows what was there when it opened and stashes its own
     game beside it. */
  const theirs = stashGame(loadStash(), "Wednesday", line(opening));
  saveStash(theirs);

  /* This tab still has only its own, and merging takes in the other's. */
  check("a tab that has not looked since does not know of the other's",
    mine.length === 1);
  const merged = mergeStash(mine, loadStash());
  check("and picks it up on looking again",
    merged.map((game) => game.name).join(", ") === "Tuesday, Wednesday",
    JSON.stringify(merged.map((game) => game.name)));
  check("which is the name it never used",
    JSON.stringify(strangeNames(mine, loadStash())) === '["Wednesday"]');
  check("while a name it does know is its own to write over",
    !strangeNames(mine, loadStash()).includes("Tuesday"));

  /* Writing after a merge keeps both, which is the point of merging first. */
  const both = stashGame(merged, "Tuesday", line("8/8/8/8/8/8/8/K6k w - - 0 1"));
  saveStash(both);
  const back = loadStash();
  check("writing one back does not take the other with it",
    back.length === 2 && back[1].name === "Wednesday");
  check("and the one written over is the one that changed",
    back[0].history.entries[0].fen.startsWith("8/8"));

  /* A store that holds nonsense costs the nonsense, not the stash. */
  store.set(STASH_KEY, JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    games: [
      { name: "Good", history: line(opening) },
      { name: "No history" },
      { history: line(opening) },
      { name: "Past the end", history: { entries: [{ fen: opening, move: null }], current: 3 } },
    ],
  }));
  check("a game that cannot be read is dropped, and the rest kept",
    loadStash().map((game) => game.name).join() === "Good",
    JSON.stringify(loadStash().map((game) => game.name)));

  store.set(STASH_KEY, "{not json");
  check("and a record that is not a record at all reads as nothing",
    loadStash().length === 0);
  store.set(STASH_KEY, JSON.stringify({ version: 99, games: [] }));
  check("as does one from a version this build does not know",
    loadStash().length === 0);

  /* Throwing them all away takes the record out of the store, so a browser
     that has emptied its stash and one that never had a game look alike. */
  const { clearStash } = await import("../src/app/stashStore.ts");
  saveStash(mine);
  clearStash();
  check("removing them all leaves nothing in the store",
    !store.has(STASH_KEY) && loadStash().length === 0);

  /* A store that refuses leaves the games in hand rather than losing them. */
  store.clear();
  globalThis.window.localStorage.setItem = () => {
    throw new Error("no room");
  };
  check("a browser that will not keep them still lets this visit have them",
    saveStash(mine).length === 1 && store.size === 0);
}

console.log("\nSettings kept between visits\n");
{
  /* A store of one browser's worth, standing in for the real one: what the app
     writes goes in here and is read back out, which is the whole contract. */
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
  };
  const { SETTINGS_KEY, flushSettings, loadSettings, saveSettings } = await import(
    "../src/app/settingsStore.ts"
  );
  const held = () => JSON.parse(store.get(SETTINGS_KEY));

  check("nothing kept yet means nothing to open with",
    loadSettings().working === null && loadSettings().target === null);

  const mine = { ...DEFAULT_SETTINGS, fadeTimeMs: 1234 };
  saveSettings({ target: "Mine", working: mine, sets: { Mine: mine } });
  check("a change is not written the instant it is made",
    store.has(SETTINGS_KEY) === false);
  /* Forty changes in a drag are one write, of the value landed on. The clock
     that would have done it is half a minute long; what it calls when it comes
     round is what is called here. */
  for (let n = 0; n < 40; n += 1) {
    const step = { ...mine, fadeTimeMs: 1000 + n };
    saveSettings({ target: "Mine", working: step, sets: { Mine: step } });
  }
  flushSettings();
  check("and a run of them is one write, of the last",
    store.size === 1 && held().working.fadeTimeMs === 1039, String(store.size));

  let writes = 0;
  const counting = globalThis.window.localStorage.setItem;
  globalThis.window.localStorage.setItem = (key, value) => { writes += 1; counting(key, value); };
  const same = { ...mine, fadeTimeMs: 1039 };
  saveSettings({ target: "Mine", working: same, sets: { Mine: same } });
  flushSettings();
  check("and settings that come back the same are not written again",
    writes === 0, String(writes));
  globalThis.window.localStorage.setItem = counting;

  const back = loadSettings();
  check("what was kept is what opens next time",
    back.target === "Mine" && back.working?.fadeTimeMs === 1039 &&
    back.sets.Mine?.fadeTimeMs === 1039);

  check("the name and the settings it names travel in one record",
    Object.keys(store).length === 0 && store.size === 1 &&
    "target" in held() && "working" in held() && "sets" in held());

  /* One unlucky write, landing as half a record — which is what the read-back
     is there to catch. The store is itself again straight after, as a store
     that could never write would leave nothing to put anything back with. */
  const whole = store.get(SETTINGS_KEY);
  const keep = globalThis.window.localStorage.setItem;
  globalThis.window.localStorage.setItem = (key, value) => {
    globalThis.window.localStorage.setItem = keep;
    store.set(key, String(value).slice(0, 40));
  };
  const later = { ...mine, fadeTimeMs: 4321 };
  saveSettings({ target: "Mine", working: later, sets: { Mine: later } });
  flushSettings();
  check("a write that lands half-written puts back the one that did not",
    store.get(SETTINGS_KEY) === whole, store.get(SETTINGS_KEY).slice(0, 44));
  check("so the settings still read back whole",
    loadSettings().working?.fadeTimeMs === 1039);

  /* A preset from another version sits beside the ones this build reads. */
  store.set(SETTINGS_KEY, JSON.stringify({
    target: "Mine",
    working: mine,
    sets: { Mine: mine, Ancient: { ...mine, schemaVersion: 12 } },
  }));
  const mixed = loadSettings();
  check("a preset from another version is kept, and told apart from the rest",
    Object.keys(mixed.sets).join() === "Mine" &&
    mixed.unreadable.Ancient === 12,
    JSON.stringify({ sets: Object.keys(mixed.sets), unreadable: mixed.unreadable }));
  check("and it is still in the store, for the reader to decide about",
    JSON.parse(store.get(SETTINGS_KEY)).sets.Ancient !== undefined);

  /* Settings written before presets had names: taken as what is in use, under
     no name at all. */
  store.set(SETTINGS_KEY, JSON.stringify(mine));
  const old = loadSettings();
  check("settings from before presets had names still open",
    old.working?.fadeTimeMs === 1234 && old.target === null &&
    Object.keys(old.sets).length === 0);

  store.set(SETTINGS_KEY, '{"target":"Mine","working"');
  check("a record a dying tab cut in half is dropped",
    loadSettings().working === null && store.has(SETTINGS_KEY) === false);

  globalThis.window = undefined;
}

console.log("\nSeats, and the games they are at\n");
{
  check("the side that offered the game sits at the minus",
    seatOf("482913657", "challenger") === "-482913657" &&
    seatOf("482913657", "opponent") === "482913657");
  check("and either way the game is the digits",
    gameOf("-482913657") === "482913657" && gameOf("482913657") === "482913657");
  check("which seat is which is read off the sign",
    isChallengerSeat("-482913657") && !isChallengerSeat("482913657"));
}

console.log("\nGames this browser is in\n");
{
  // Enough of a browser for the part of the app that keeps games in one.
  const held = new Map();
  globalThis.window = {
    localStorage: {
      get length() {
        return held.size;
      },
      key: (i) => [...held.keys()][i] ?? null,
      getItem: (k) => held.get(k) ?? null,
      setItem: (k, v) => void held.set(k, String(v)),
      removeItem: (k) => void held.delete(k),
    },
  };
  const seat = (gameId, opponentName, role = "challenger") => ({
    gameId,
    token: `t-${role}-${gameId}`,
    you: "w",
    myName: "Bob",
    opponentName,
    role,
  });
  const listed = () =>
    savedGames()
      .map((g) => seatOf(g.gameId, g.role))
      .sort()
      .join();

  check("a browser in no game has nothing to offer", savedGames().length === 0);

  saveGame(seat("482913657", "Alice"));
  saveGame(seat("913447201", "Carol"));
  check("two games at once are two seats, not one that replaced the other",
    listed() === "-482913657,-913447201", listed());
  check("each keeps its own token",
    loadGame("-482913657")?.token === "t-challenger-482913657" &&
    loadGame("-913447201")?.token === "t-challenger-913447201");
  check("and is not to be found at the seat it does not hold",
    loadGame("482913657") === null);

  // The point of the whole business: both ends of one game, in one browser.
  saveGame(seat("482913657", "Bob", "opponent"));
  check("both seats at one game are two records",
    listed() === "-482913657,-913447201,482913657", listed());

  saveGame(seat("482913657", "Alice again"));
  check("saving the same seat again updates it rather than doubling it",
    listed() === "-482913657,-913447201,482913657" &&
    loadGame("-482913657")?.opponentName === "Alice again", listed());

  // A game that has ended stays in the list and says how it went — at both
  // seats, since the tab at the other end may not have been open to hear it.
  markGameOver("482913657", { result: "1-0", reason: "resignation" });
  check("ending a game marks both of its seats",
    loadGame("-482913657")?.ending?.reason === "resignation" &&
    loadGame("482913657")?.ending?.result === "1-0");
  check("and leaves them in the list, to be told about",
    listed() === "-482913657,-913447201,482913657", listed());
  check("while a game still being played has no ending",
    loadGame("-913447201")?.ending === undefined);

  // Closing a finished game gives up every seat this browser holds at it.
  forgetSeats("482913657");
  check("closing it drops both of them",
    listed() === "-913447201", listed());

  forgetGame("-913447201");
  check("and giving up a single seat drops that one alone",
    savedGames().length === 0);
}

console.log("\nWrites that would quietly lose something\n");
{
  const held = new Map();
  globalThis.window = {
    localStorage: {
      get length() {
        return held.size;
      },
      key: (i) => [...held.keys()][i] ?? null,
      getItem: (k) => held.get(k) ?? null,
      setItem: (k, v) => void held.set(k, String(v)),
      removeItem: (k) => void held.delete(k),
    },
  };
  // The complaints are the point; the test should not be read as failing.
  const complaints = [];
  const spoke = console.error;
  console.error = (...said) => complaints.push(said.join(" "));

  const mine = {
    gameId: "800000001",
    token: "mine",
    you: "w",
    myName: "Bob",
    opponentName: "Alice",
    role: "challenger",
  };
  saveGame(mine);
  saveGame({ ...mine, token: "somebody else's" });
  check("a seat is not written over with a different token",
    loadGame("-800000001")?.token === "mine", loadGame("-800000001")?.token);
  check("and the attempt says so rather than passing quietly",
    complaints.some((c) => /different token/.test(c)), complaints.join(" | "));

  complaints.length = 0;
  markGameOver("800000001", { result: "1-0", reason: "checkmate" });
  // The write that lost an ending once: it knows about the opponent's name
  // and nothing about how the game finished.
  saveGame({ ...mine, opponentName: "Alice again" });
  check("an ending is not dropped by a write that does not know about it",
    loadGame("-800000001")?.ending?.reason === "checkmate",
    JSON.stringify(loadGame("-800000001")));
  check("and that is said out loud too",
    complaints.some((c) => /Keeping the ending/.test(c)), complaints.join(" | "));
  check("while the write itself still went through",
    loadGame("-800000001")?.opponentName === "Alice again");

  console.error = spoke;
  // Tidied up after: the storage module keeps a copy of what it writes in
  // memory, and that copy outlives this block and would be counted by the next.
  forgetSeats("800000001");
}

console.log("\nRecords this build did not write\n");
{
  const held = new Map();
  globalThis.window = {
    localStorage: {
      get length() {
        return held.size;
      },
      key: (i) => [...held.keys()][i] ?? null,
      getItem: (k) => held.get(k) ?? null,
      setItem: (k, v) => void held.set(k, String(v)),
      removeItem: (k) => void held.delete(k),
    },
  };
  const shape = {
    gameId: "700000001",
    token: "t-old",
    you: "w",
    myName: "Bob",
    opponentName: "Alice",
    role: "challenger",
  };

  held.set("cv.game.-700000001", JSON.stringify(shape));
  check("a record with no version is not one this build reads",
    loadGame("-700000001") === null);

  held.set("cv.game.-700000002", JSON.stringify({ ...shape, gameId: "700000002", v: 0 }));
  check("nor is one written against another version",
    loadGame("-700000002") === null);

  held.set("cv.game.rubbish", "{not json");
  check("and neither is something that will not parse",
    savedGames().length === 0, JSON.stringify(savedGames()));
  check("all three are swept up rather than walked past every time",
    held.size === 0, [...held.keys()].join());

  held.set("cv.name", "Bob");
  saveGame({ ...shape, gameId: "700000003" });
  check("what this build wrote is read back",
    savedGames().length === 1 && loadGame("-700000003")?.token === "t-old");
  check("and nothing but games is read as one", held.get("cv.name") === "Bob");
}

console.log("\nA line, as it travels\n");
{
  const history = lineOf(["e4", "e5", "Nf3"]);
  const line = lineFromHistory(history);
  check("the moves come out in the order they were played",
    JSON.stringify(line.moves) === JSON.stringify(["e4", "e5", "Nf3"]),
    JSON.stringify(line.moves));
  check("and the position they were played from comes with them",
    line.initialFEN.startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w"),
    line.initialFEN);
}
{
  const board = new Chess();
  const line = lineFromHistory({ entries: [{ fen: board.fen(), move: null }], current: 0 });
  check("a board nobody has moved on is a line of no moves",
    line.moves.length === 0 && line.initialFEN === board.fen());
}

console.log("\nWhat a piece's marks come to\n");
{
  const board = new Chess();
  const bishop = reachSignature(board, "f1", "b");
  const queen = reachSignature(board, "d1", "q");
  check("a knight draws the same marks wherever the men stand",
    reachSignature(board, "g1", "n") === "" && reachSignature(board, "e1", "k") === "");
  board.move("e4");
  check("a bishop the move unblocks is drawing something else",
    reachSignature(board, "f1", "b") !== bishop,
    `${bishop} -> ${reachSignature(board, "f1", "b")}`);
  check("and so is the queen behind the same pawn",
    reachSignature(board, "d1", "q") !== queen,
    `${queen} -> ${reachSignature(board, "d1", "q")}`);
  check("while a rook the move did not touch is drawing what it was",
    reachSignature(board, "a1", "r") === reachSignature(new Chess(), "a1", "r"),
    reachSignature(board, "a1", "r"));
}

console.log("\nWhat a shared link asks for\n");
{
  const pgn = encodeURIComponent("1. e4 e5 2. Nf3 *");
  const played = openingFromUrl(`?game=${pgn}&autoplay=1`);
  check("a game arrives with its moves",
    played !== null && played.entries !== null && played.entries.length === 4,
    played === null ? "nothing" : String(played.entries?.length));
  check("and the flag is read off the link — as an older link wrote it", played?.autoplay === true);
  check("and as a link is written now",
    openingFromUrl(`?game=${pgn}&autoplay=true`)?.autoplay === true && openingFromUrl(`?game=${pgn}&autoplay=false`)?.autoplay === false);
  const quiet = openingFromUrl(`?game=${pgn}`);
  check("a link without it asks for nothing of the kind", quiet?.autoplay === false);
  const spot = openingFromUrl("?position=rnbqkbnr%2Fpppppppp%2F8%2F8%2F8%2F8%2FPPPPPPPP%2FRNBQKBNR+w+KQkq+-+0+1&autoplay=1");
  check("a position alone never plays, whatever the link says",
    spot !== null && spot.entries === null && spot.autoplay === false,
    JSON.stringify(spot));
  check("a link asking for Black at the bottom says so, for a game and for a position",
    openingFromUrl(`?game=${pgn}&blackAtBottom=true`)?.blackAtBottom === true &&
      openingFromUrl("?position=4k3%2F8%2F8%2F8%2F8%2F8%2F8%2F4K3+w+-+-+0+1&blackAtBottom=true")?.blackAtBottom === true);
  check("and one that does not, or says anything but true, leaves the board as the reader keeps it",
    quiet?.blackAtBottom === false && openingFromUrl(`?game=${pgn}&blackAtBottom=false`)?.blackAtBottom === false &&
      openingFromUrl(`?game=${pgn}&blackAtBottom=1`)?.blackAtBottom === false);

  /*
    What a link carries beyond the moves. Encoded the way a link is built —
    base64 into `URLSearchParams`, which is what `gameLink` writes with — so
    the round trip here is the one a real link makes.
  */
  const linked = (text) => openingFromUrl("?" + new URLSearchParams({ gameBase64: toBase64Url(text) }));
  const MATE_IN_A_LINE = '[Result "1-0"]\n[SetUp "1"]\n[FEN "7k/1QBb3P/8/8/8/2K5/8/6R1 w - - 0 1"]\n\n1. Bf4 Be8 (1... Bg4 2. Be5#) 2. Be5# 1-0\n';
  const encoded = toBase64Url(MATE_IN_A_LINE);
  check("a game is written into a link as letters, digits, - and _, and nothing else",
    /^[A-Za-z0-9_-]+$/.test(encoded), encoded);
  check("and read back as the very text it was",
    fromBase64Url(encoded) === MATE_IN_A_LINE && openingFromUrl(`?gameBase64=${encoded}&fbclid=IwY2x`)?.entries?.length === 4,
    String(fromBase64Url(encoded)));
  check("names in any script survive the trip",
    fromBase64Url(toBase64Url('[White "Иван Веселовский"]\n[Black "李"]')) === '[White "Иван Веселовский"]\n[Black "李"]');
  check("plain base64 with its padding is read as well, for a link put together by hand",
    fromBase64Url(btoa("1. e4 e5 *")) === "1. e4 e5 *" && fromBase64Url("MS4gZTQgZTUgKg==") === "1. e4 e5 *");
  check("and what is not base64 of text is no game, rather than a garbled one",
    fromBase64Url("not base64!") === null && fromBase64Url("_w") === null && openingFromUrl("?gameBase64=%25%25") === null);
  check("once read, a shared link is taken out of the address, Facebook's tag with it, to the bare page",
    addressWithoutOpening("https://chess.example/?gameBase64=MS4gZTQ&autoplay=true&blackAtBottom=true&fbclid=IwY2x") === "/" &&
      addressWithoutOpening("https://chess.example/app/?position=8%2F8+w&x=1#here") === "/app/?x=1#here");
  check("and an address that carried nothing of the kind is left alone, play link and all",
    addressWithoutOpening("https://chess.example/?play=123456789") === null && addressWithoutOpening("https://chess.example/?fbclid=Iw") === null);
  check("a link shared before, with the PGN as text, still opens its game",
    openingFromUrl("?" + new URLSearchParams({ game: MATE_IN_A_LINE }))?.entries?.length === 4);
  const named = [
    '[Event "Club championship"]',
    '[White "Anna"]',
    '[Black "Boris"]',
    '[Result "0-1"]',
    "",
    "1. e4 {the usual} e5 $1 2. Nf3 (2. f4 exf4) Nc6 0-1",
    "",
  ].join("\n");
  const arrived = linked(named);
  check("a game that names its players arrives with them",
    arrived?.game?.players.white === "Anna" && arrived?.game?.players.black === "Boris",
    JSON.stringify(arrived?.game?.players));
  check("and with how it ended", arrived?.game?.result === "0-1", String(arrived?.game?.result));
  check("and as the very text it was — tags, comment, variation and all",
    arrived?.game?.pgn === named, JSON.stringify(arrived?.game?.pgn));
  const scored = linked('[Result "1/2-1/2"]\n\n1. d4 d5 1/2-1/2\n');
  check("a result with nobody named is still a game to open as one read in",
    scored?.game?.result === "1/2-1/2", JSON.stringify(scored?.game));
  check("while one that names nobody and says nothing of how it ended opens as a plain line",
    quiet !== null && quiet.game === null, JSON.stringify(quiet?.game));
  const own = toPgn(lineOf(["e4", "e5", "Nf3"]), null, null);
  check("which is what this app writes for a line with nobody in it",
    linked(own)?.game === null, JSON.stringify(linked(own)?.game));
  check("and a position carries no game at all", spot?.game === null);
}

console.log("\nA piece in the air\n");
{
  // 1.d4, caught halfway: the pawn has left d2 and not yet reached d4.
  const start = new Chess();
  const before = start.fen();
  const move = moveBetween(before, (() => {
    const played = new Chess(before);
    played.move("d4");
    return played.fen();
  })());
  check("the move is read back off the two positions",
    move !== null && move.from === "d2" && move.to === "d4",
    move === null ? "none" : `${move.from}${move.to}`);
  const flying = travellersOf(move).travellers.map((piece) => piece.from);
  check("and the piece it sends is the one that left d2",
    flying.join() === "d2", flying.join());

  const held = boardDuring(before);
  check("the travelling piece is still on the board",
    held !== null && held.get("d2") !== undefined);
  check("so the queen's file stays shut behind it",
    attackersOn(held, "d4", "w", flying).length === 0,
    attackersOn(held, "d4", "w", flying).join());
  const gone = new Chess(before);
  gone.remove("d2");
  check("where taking it off the board would have opened it",
    gone.attackers("d4", "w").join() === "d1",
    gone.attackers("d4", "w").join());
  check("but the piece in the air attacks nothing itself",
    attackersOn(held, "e3", "w", flying).join() === "f2",
    attackersOn(held, "e3", "w", flying).join());
  check("while it stands there for everyone else",
    attackersOn(held, "e3", "w", []).sort().join() === "d2,f2",
    attackersOn(held, "e3", "w", []).sort().join());
}
{
  // The same pawn picked up and not yet put down: the landing square is not
  // chosen, so nothing about the board has changed except what the pawn covers.
  const board = new Chess();
  const lifted = ["d2"];
  check("a piece picked up stops attacking",
    attackersOn(board, "e3", "w", lifted).join() === "f2",
    attackersOn(board, "e3", "w", lifted).join());
  check("but it does not open the queen's file",
    attackersOn(board, "d4", "w", lifted).length === 0 &&
      attackersOn(board, "d3", "w", lifted).sort().join() === "c2,e2",
    attackersOn(board, "d3", "w", lifted).sort().join());
  check("nor the bishop's diagonal behind it",
    attackersOn(board, "f4", "w", lifted).length === 0 &&
      attackersOn(board, "g5", "w", lifted).length === 0);
  check("and its own square is still covered by whoever covered it",
    attackersOn(board, "d2", "w", lifted).sort().join() === "b1,c1,d1,e1",
    attackersOn(board, "d2", "w", lifted).sort().join());
}
{
  // Castling sends the king as well, and a board is still a board without one.
  const board = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  const before = board.fen();
  board.move("O-O");
  const move = moveBetween(before, board.fen());
  const flying = travellersOf(move).travellers.map((piece) => piece.from);
  check("castling sends two pieces, from e1 and h1",
    flying.sort().join() === "e1,h1", flying.sort().join());
  const held = boardDuring(before);
  check("and the board it is drawn from still reads",
    held !== null && held.get("e1") !== undefined && held.get("h1") !== undefined);
  check("with neither of them attacking while they travel",
    attackersOn(held, "f1", "w", flying).length === 0,
    attackersOn(held, "f1", "w", flying).join());
}

{
  /*
    A piece in the air pins nothing.

    1.d4 Nf6 2.c4 e6 3.Nc3 Bb4: the bishop holds the knight on c3, which cannot
    step off the diagonal without giving the king away. Lift the bishop — it is
    partway to somewhere else — and the knight is free, however much of the line
    the bishop is still standing in.
  */
  const board = new Chess();
  for (const san of ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]) {
    board.move(san);
  }
  check("a bishop on b4 pins the knight on c3",
    pinnedSquares(board).join() === "c3", pinnedSquares(board).join());
  check("and holds nothing while it is in the air",
    pinnedSquares(board, ["b4"]).length === 0,
    pinnedSquares(board, ["b4"]).join());
  check("while a piece in the air elsewhere changes nothing",
    pinnedSquares(board, ["f6"]).join() === "c3",
    pinnedSquares(board, ["f6"]).join());
}

{
  /*
    One browser at both ends of one game: two seats, two tokens, one number.
    The list shows the game twice and the two rows disagree about who won, so
    each has to say which side it is speaking for.
  */
  const played = { v: 1, gameId: "829115739", token: "t", ending: undefined };
  const mine = { ...played, you: "w", myName: "Bob", opponentName: "Alice", role: "challenger" };
  const theirs = { ...played, you: "b", myName: "Alice", opponentName: "Bob", role: "opponent" };
  check("the two seats of one game are two records",
    seatOf(mine.gameId, mine.role) !== seatOf(theirs.gameId, theirs.role),
    `${seatOf(mine.gameId, mine.role)} and ${seatOf(theirs.gameId, theirs.role)}`);
  const white = playersOf(mine);
  const black = playersOf(theirs);
  check("and both name the same pair, White first",
    white.white === "Bob" && white.black === "Alice" &&
      black.white === "Bob" && black.black === "Alice",
    JSON.stringify([white, black]));
  check("each from its own side",
    white.yours === "w" && black.yours === "b",
    `${white.yours} and ${black.yours}`);
  check("while a challenge nobody has answered names nobody",
    playersOf({ ...mine, you: "opponentChooses", opponentName: null }) === null);
}

{
  /*
    How far a game has got, in one wording wherever it is said. Two places once
    counted the same thing differently — the challenge dialog in half-moves and
    the game's own panel in moves — so a game offered as twelve came back as
    six, and eleven of them would have come back as six and a half.
  */
  check("nothing played says so", halfMoves(0) === "no moves yet", halfMoves(0));
  check("one is singular", halfMoves(1) === "1 half-move", halfMoves(1));
  check("and the rest are not",
    halfMoves(11) === "11 half-moves" && halfMoves(12) === "12 half-moves",
    `${halfMoves(11)} / ${halfMoves(12)}`);
  check("a count below nothing is still nothing", halfMoves(-3) === "no moves yet");
}

{
  /*
    What to call something being put aside. The dialog takes the name as given
    and a stash replaces whatever is already under that name, so a suggestion
    that collides is a suggestion to write over yesterday's — or over the one
    set aside ten minutes ago.
  */
  const day = new Date(2026, 8, 6);
  const first = nextStashName([], day);
  check("the first of a day is named after the day",
    first === "Set aside " + day.toLocaleDateString(), first);
  const second = nextStashName([first], day);
  check("the next one says which it is", second === first + " (2)", second);
  check("and it goes on counting",
    nextStashName([first, second], day) === first + " (3)",
    nextStashName([first, second], day));
  check("names of other things are not in the way",
    nextStashName(["Ruy Lopez", "Endgame"], day) === first);
  check("and a gap in the numbers is filled rather than stepped over",
    nextStashName([first, first + " (3)"], day) === first + " (2)");
}

console.log("\nSettings added since a record was written\n");
{
  /*
    A record this build's own version wrote before two settings were added to
    it: the switch for the second bar of men, and the wait before a game's
    first move. Stored settings are read through the same door as a file, so
    this is also what a browser that was open through the change comes back to.
  */
  const earlier = structuredClone(DEFAULT_SETTINGS);
  delete earlier.pieces.showAvailable;
  delete earlier.lab.playInitialDelaySec;
  delete earlier.lab.playBackStepSec;
  delete earlier.lab.playBackStepSpeedup;
  delete earlier.lab.playLineEndHoldSec;
  const back = parseSettings(JSON.stringify(earlier)).settings;
  check("a record from before the second bar reads back with it off",
    back?.pieces.showAvailable === false, String(back?.pieces.showAvailable));
  check("and one from before the initial delay, with the one a new reader gets",
    back?.lab.playInitialDelaySec === DEFAULT_SETTINGS.lab.playInitialDelaySec, String(back?.lab.playInitialDelaySec));
  check("and one from before variations were played, with the paces a new reader gets",
    back?.lab.playBackStepSec === DEFAULT_SETTINGS.lab.playBackStepSec &&
      back?.lab.playBackStepSpeedup === DEFAULT_SETTINGS.lab.playBackStepSpeedup &&
      back?.lab.playLineEndHoldSec === DEFAULT_SETTINGS.lab.playLineEndHoldSec,
    JSON.stringify(back?.lab));
  check("each where the interface puts it",
    JSON.stringify(Object.keys(back?.pieces ?? {})) ===
      JSON.stringify(Object.keys(DEFAULT_SETTINGS.pieces)) &&
      JSON.stringify(Object.keys(back?.lab ?? {})) ===
        JSON.stringify(Object.keys(DEFAULT_SETTINGS.lab)),
    JSON.stringify({ pieces: Object.keys(back?.pieces ?? {}), lab: Object.keys(back?.lab ?? {}) }));

  const own = structuredClone(DEFAULT_SETTINGS);
  own.lab.playInitialDelaySec = 3;
  check("while a record that says its own delay keeps it",
    parseSettings(JSON.stringify(own)).settings?.lab.playInitialDelaySec === 3);
  /* Nought is a value, and a check for a missing one that tested for a falsy
     one would quietly turn "start at once" into a whole second. */
  const none = structuredClone(DEFAULT_SETTINGS);
  none.lab.playInitialDelaySec = 0;
  check("including nought, which is no delay rather than a missing one",
    parseSettings(JSON.stringify(none)).settings?.lab.playInitialDelaySec === 0);
  const quick = structuredClone(DEFAULT_SETTINGS);
  quick.lab.playBackStepSec = 0;
  quick.lab.playLineEndHoldSec = 0;
  const quickBack = parseSettings(JSON.stringify(quick)).settings;
  check("and so do the paces for variations, nought and all",
    quickBack?.lab.playBackStepSec === 0 && quickBack?.lab.playLineEndHoldSec === 0,
    JSON.stringify(quickBack?.lab));
}

console.log("\nThe men still standing\n");
{
  /*
    The bar of available men is read off the board and nothing else, which is
    what these check: the opening set, a set short of a man because the game is
    at odds, and a pawn who became a queen. Each is a position that the other
    sum — a starting set less what was taken — gets wrong.
  */
  const opening = new Chess();
  const kinds = (position, color) =>
    availableFor(position, color)
      .map(({ type, count }) => `${type}${count}`)
      .join(" ");
  check("the opening set is the opening position, heaviest first",
    kinds(opening, "w") === "q1 r2 b2 n2 p8", kinds(opening, "w"));
  check("and the king, who is on the board at every moment, is on neither bar",
    availableFor(opening, "w").every(({ type }) => type !== "k"),
    kinds(opening, "w"));
  check("and both armies weigh the same",
    materialOn(opening, "w") === materialOn(opening, "b") &&
      materialOn(opening, "w") === 39,
    `${materialOn(opening, "w")} vs ${materialOn(opening, "b")}`);

  /* Rook odds, as the friendly game offers them: White starts without a1. */
  const odds = new Chess(positionWithHandicap(
    { giver: "challenger", piece: "rook" }, "w"));
  check("a game at odds opens a man short, and says which man",
    kinds(odds, "w") === "q1 r1 b2 n2 p8", kinds(odds, "w"));
  check("and the odds are the difference the bar shows",
    materialOn(odds, "b") - materialOn(odds, "w") === 5,
    `${materialOn(odds, "w")} vs ${materialOn(odds, "b")}`);

  /*
    A pawn who reaches the eighth rank is a queen on the board and a queen
    here. The count moves by the 8 the two men differ by, which is the thing a
    tally of captures alone cannot see.
  */
  const promoting = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
  const before = materialOn(promoting, "w");
  promoting.move({ from: "a7", to: "a8", promotion: "q" });
  check("a pawn promoted is the queen he became",
    kinds(promoting, "w") === "q1", kinds(promoting, "w"));
  check("and moves the count by the 8 the two men differ by",
    materialOn(promoting, "w") - before === 8,
    `${before} -> ${materialOn(promoting, "w")}`);

  check("an army down to its king alone has nothing on the bar",
    kinds(promoting, "b") === "", kinds(promoting, "b"));
  check("though he still stands, and is still worth nothing",
    materialOn(promoting, "b") === 0, String(materialOn(promoting, "b")));
}

console.log("\nAnimated GIF\n");
{
  /*
    A little board, the way a real one changes: a flat ground, a dark piece
    travelling across it, and a band of many colours that changes every frame
    — standing in for a fade, and crowding each frame's palette the way a fade
    does on a real board. That crowding is what once left a ghost of the piece
    wherever it had been: the ground it uncovered came out a level or two off.
  */
  const W = 48;
  const H = 24;
  const GROUND = [204, 220, 204];
  const scene = (pieceX, shade) => {
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const p = (y * W + x) * 4;
        let colour = GROUND;
        if (y >= 16) {
          /* The crowded band: a different colour at every pixel. */
          colour = [(x * 5 + shade) % 256, (y * 11 + shade * 3) % 256, (x * 3 + y * 7 + shade) % 256];
        } else if (x >= pieceX && x < pieceX + 8 && y >= 4 && y < 12) {
          colour = [60, 30, 20];
        }
        rgba.set([...colour, 255], p);
      }
    }
    return rgba;
  };
  const plan = [
    { rgba: scene(2, 0), delay: 1000, still: true },
    { rgba: scene(10, 40), delay: 40, still: false },
    { rgba: scene(18, 80), delay: 40, still: false },
    { rgba: scene(26, 120), delay: 750, still: true },
  ];
  const worstOff = (one, other) => {
    let worst = 0;
    for (let i = 0; i < one.length; i += 4) {
      worst = Math.max(worst, Math.abs(one[i] - other[i]), Math.abs(one[i + 1] - other[i + 1]), Math.abs(one[i + 2] - other[i + 2]));
    }
    return worst;
  };
  for (const store of ["changed", "full"]) {
    const writer = createGifWriter(W, H, store);
    plan.forEach(({ rgba, delay, still }) => writer.add(rgba, delay, still));
    const bytes = writer.finish();
    const gif = readGif(bytes);
    check(`${store}: a GIF of the right size, looping for ever`,
      gif.width === W && gif.height === H && gif.loops === 0, JSON.stringify({ w: gif.width, h: gif.height, loops: gif.loops }));
    check(`${store}: one frame for each, each up for as long as it was asked`,
      gif.frames.map((frame) => frame.delayMs).join() === "1000,40,40,750",
      gif.frames.map((frame) => frame.delayMs).join());
    /* Where the piece was and is no more: the ground, exactly. */
    const left = gif.frames[3].rgba;
    const uncovered = [];
    for (let y = 4; y < 12; y += 1) {
      for (let x = 2; x < 26; x += 1) {
        const p = (y * W + x) * 4;
        uncovered.push(left[p] === GROUND[0] && left[p + 1] === GROUND[1] && left[p + 2] === GROUND[2]);
      }
    }
    check(`${store}: what a piece uncovers is the ground exactly — no ghost of it left behind`,
      uncovered.every(Boolean), `${uncovered.filter((ok) => !ok).length} pixels off`);
    /* The band holds more colours than one frame of a GIF can — every pixel of
       it different — so it can only come back close; the rest of the picture is
       flat colours, and at rest comes back exactly. */
    const flat = (rgba) => rgba.subarray(0, 16 * W * 4);
    check(`${store}: at rest, everything flat comes back exactly`,
      worstOff(flat(gif.frames[0].rgba), flat(plan[0].rgba)) === 0 && worstOff(flat(gif.frames[3].rgba), flat(plan[3].rgba)) === 0,
      `${worstOff(flat(gif.frames[0].rgba), flat(plan[0].rgba))} / ${worstOff(flat(gif.frames[3].rgba), flat(plan[3].rgba))}`);
    check(`${store}: and every frame is near enough to be the same picture, band and all`,
      gif.frames.every((frame, i) => worstOff(frame.rgba, plan[i].rgba) <= 24),
      gif.frames.map((frame, i) => worstOff(frame.rgba, plan[i].rgba)).join(" / "));
  }
  {
    /* As a board changes from frame to frame: a piece moving, and the rest the same. */
    const moving = [2, 6, 10, 14, 18, 22, 26].map((x) => scene(x, 0));
    const size = (store) => {
      const writer = createGifWriter(W, H, store);
      moving.forEach((rgba, i) => writer.add(rgba, 40, i === 0 || i === moving.length - 1));
      return writer.finish().length;
    };
    const changed = size("changed");
    const full = size("full");
    check("storing only what changed is much smaller than every frame whole, when little changes",
      changed * 2 < full, JSON.stringify({ changed, full }));
  }
  {
    const writer = createGifWriter(W, H, "changed");
    writer.add(plan[0].rgba, 0, true);
    writer.add(plan[1].rgba, 5, false);
    const gif = readGif(writer.finish());
    check("a delay shorter than two hundredths is made two, which browsers keep to",
      gif.frames.every((frame) => frame.delayMs === 20), gif.frames.map((frame) => frame.delayMs).join());
  }
  {
    const writer = createGifWriter(W, H, "changed");
    writer.add(plan[0].rgba, 1000, true);
    writer.add(plan[0].rgba, 500, true);
    const gif = readGif(writer.finish());
    check("a frame with nothing new in it shows the frame before, for longer",
      worstOff(gif.frames[1].rgba, gif.frames[0].rgba) === 0 && gif.frames[1].delayMs === 500,
      `${worstOff(gif.frames[1].rgba, gif.frames[0].rgba)} / ${gif.frames[1].delayMs}`);
  }

  check("the frame rates are the ones a GIF keeps exactly: a hundred over a whole number",
    FRAME_STEPS.every((step) => Number.isInteger(step) && step >= 2) && frameStepLabel(4) === "25 fps (40 ms a frame)",
    frameStepLabel(4));
  check("a position rests for what is left of the period once its fade has been shown",
    restAfterFade(750, 240, 40) === 510, String(restAfterFade(750, 240, 40)));
  check("and never for less than a frame",
    restAfterFade(100, 240, 40) === 40, String(restAfterFade(100, 240, 40)));

  check("a PGN name comes down to the surname",
    surnameOf("Krylov, Mikhail (2489)") === "Krylov" && surnameOf("Magnus Carlsen") === "Magnus Carlsen",
    `${surnameOf("Krylov, Mikhail (2489)")} / ${surnameOf("Magnus Carlsen")}`);
  check("a game between two players is named after them",
    suggestedGifName({ white: "Krylov, Mikhail (2489)", black: "Arslanov, Shamil (2411)" }, null) === "Krylov - Arslanov.gif",
    suggestedGifName({ white: "Krylov, Mikhail (2489)", black: "Arslanov, Shamil (2411)" }, null));
  check("one between nobody — White and Black — goes by the name it is kept under",
    suggestedGifName({ white: "White", black: "Black" }, "Rook endings") === "Rook endings.gif",
    suggestedGifName({ white: "White", black: "Black" }, "Rook endings"));
  check("while somebody actually called White is somebody",
    suggestedGifName({ white: "White, John", black: "Kowalski, Jan" }, null) === "White - Kowalski.gif",
    suggestedGifName({ white: "White, John", black: "Kowalski, Jan" }, null));
  check("and with no name at all, by the app and the day",
    suggestedGifName(null, null, new Date(2026, 8, 28)) === "chess-visualizer-2026-09-28.gif",
    suggestedGifName(null, null, new Date(2026, 8, 28)));
  check("a typed name loses what no file system allows, and ends in .gif once",
    asGifName("Club: round 1 / game?.GIF") === "Club round 1 game.gif" && asGifName("  ") === "",
    asGifName("Club: round 1 / game?.GIF"));
  check("a video is named the same way, ending in .mp4",
    suggestedFileName({ white: "Krylov, Mikhail (2489)", black: "Arslanov, Shamil (2411)" }, null, "mp4") === "Krylov - Arslanov.mp4" &&
      suggestedFileName(null, null, "mp4", new Date(2026, 8, 28)) === "chess-visualizer-2026-09-28.mp4",
    suggestedFileName({ white: "Krylov, Mikhail (2489)", black: "Arslanov, Shamil (2411)" }, null, "mp4"));
  check("and a name kept from a GIF of the same game does not end up ending in both",
    asFileName("Krylov - Arslanov.gif", "mp4") === "Krylov - Arslanov.mp4" &&
      asFileName("Krylov - Arslanov.MP4", "gif") === "Krylov - Arslanov.gif",
    asFileName("Krylov - Arslanov.gif", "mp4"));
}

console.log("\nA game with variations\n");
{
  /* A mate in two with three defences, each answered: the example the feature
     was asked for with. */
  const TASK = [
    '[FEN "3k4/R6R/3n4/8/8/8/8/K7 w - - 0 1"]',
    '[SetUp "1"]',
    "",
    "1. Rhg7 Nf7 {case A} (1... Ne8 {case B} 2. Ra8#) (1... Ke8 {case C} 2. Rg8#) 2. Rg8# 1-0",
  ].join("\n");
  const lines = linesOf(readTree(TASK));
  const said = (steps) =>
    steps.map((step) => (step.kind === "switch" ? `>${step.line}` : step.kind === "forward" ? "f" : "b")).join(" ");
  check("every way through the game is a line of its own, the main line first",
    JSON.stringify(lines.map((line) => line.moves.join(" "))) ===
      JSON.stringify(["Rhg7 Nf7 Rg8#", "Rhg7 Ne8 Ra8#", "Rhg7 Ke8 Rg8#"]),
    JSON.stringify(lines.map((line) => line.moves)));
  check("each named by its move at the fork, numbered as it is written, and by the file's comment on it",
    JSON.stringify(lines.map((line) => line.choices)) ===
      JSON.stringify([["1… Nf7 {case A}"], ["1… Ne8 {case B}"], ["1… Ke8 {case C}"]]),
    JSON.stringify(lines.map((line) => line.choices)));
  const main = parsePgn(TASK).entries;
  check("and the main line is the very line chess.js reads, position for position",
    JSON.stringify(lines[0].entries) === JSON.stringify(main), JSON.stringify(lines[0].entries[2]));
  check("walked as the board walks it: to each end, back to the fork, over, and on",
    said(walk(lines, 0, 0)) === "f f f b b >1 f f b b >2 f f", said(walk(lines, 0, 0)));
  check("and from the middle of a line, only what is left of the walk",
    said(walk(lines, 1, 2)) === "f b b >2 f f" && said(walk(lines, 2, 3)) === "",
    `${said(walk(lines, 1, 2))} / ${said(walk(lines, 2, 3))}`);
  check("the way it has gone says nothing before the fork, and the choice from the fork on",
    pathSoFar(lines[1], 0).length === 0 && JSON.stringify(pathSoFar(lines[1], 1)) === JSON.stringify(["1… Ne8 {case B}"]),
    JSON.stringify([pathSoFar(lines[1], 0), pathSoFar(lines[1], 1)]));
  const start = lines[0].entries[lines[0].entries.length - 1].fen;
  check("the board's own line is found among them, and a line of the reader's own is not",
    lineIndex(lines, start, ["Rhg7", "Ke8", "Rg8#"]) === 2 &&
      lineIndex(lines, start, ["Rhg7", "Ke8"]) === -1 &&
      lineIndex(lines, start, ["Rhg7", "Kc8"]) === -1);

  /* Variations inside variations, each one's own before those that leave
     earlier, and a path that grows a choice at every fork it comes to. */
  const NESTED = "1. e4 e5 (1... c5 2. Nf3 (2. c3 d5) d6) 2. Nf3 Nc6 *";
  const nested = linesOf(readTree(NESTED));
  check("a variation inside a variation is a line as well",
    JSON.stringify(nested.map((line) => line.moves.join(" "))) ===
      JSON.stringify(["e4 e5 Nf3 Nc6", "e4 c5 Nf3 d6", "e4 c5 c3 d5"]),
    JSON.stringify(nested.map((line) => line.moves)));
  check("and its path names both forks",
    JSON.stringify(nested[2].choices) === JSON.stringify(["1… c5", "2. c3"]) &&
      JSON.stringify(nested[2].forks) === JSON.stringify([1, 2]),
    JSON.stringify(nested[2]));
  check("of which only the ones the board has come to are said",
    JSON.stringify(pathSoFar(nested[2], 1)) === JSON.stringify(["1… c5"]) &&
      JSON.stringify(pathSoFar(nested[2], 4)) === JSON.stringify(["1… c5", "2. c3"]));
  check("the walk goes back only as far as each fork",
    said(walk(nested, 0, 0)) === "f f f f b b b >1 f f f b b >2 f f", said(walk(nested, 0, 0)));

  /* How files are actually written. */
  const TIDY = linesOf(readTree("1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *")).map((line) => line.moves.join(" "));
  const MESSY = linesOf(readTree(
    '[Event "?"] [White "A"] [Black "B"]\n1.e4!? {best by test} e5 $1 (1...c5?! ; a comment to the end of the line\n2.Nf3) 2.Nf3 *'
  )).map((line) => line.moves.join(" "));
  check("tags on one line, comments, glyphs and move numbers glued on read the same as a tidy file",
    JSON.stringify(MESSY) === JSON.stringify(TIDY), JSON.stringify(MESSY));
  const slip = linesOf(readTree("1. e4 e5 (1... c5 2. Ke3 d6) 2. Nf3 *")).map((line) => line.moves.join(" "));
  check("a variation that goes wrong is kept as far as it went right",
    JSON.stringify(slip) === JSON.stringify(["e4 e5 Nf3", "e4 c5"]), JSON.stringify(slip));
  const again = linesOf(readTree("1. e4 e5 (1... e5 2. d4) 2. Nf3 *"));
  check("a variation that starts with the move already played forks where it first differs",
    JSON.stringify(again.map((line) => line.choices)) === JSON.stringify([["2. Nf3"], ["2. d4"]]),
    JSON.stringify(again.map((line) => line.choices)));
  const plain = linesOf(readTree("1. e4 e5 2. Nf3 *"));
  check("a game with no variations is one line, with no choices in it",
    plain.length === 1 && plain[0].choices.length === 0 && said(walk(plain, 0, 1)) === "f f");
  /* chess.js writes back only an en passant square a pawn can take on; the
     board's line starts where chess.js says, so the tree has to as well. */
  const PASSANT = '[FEN "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2"]\n\n2. Nf3 Nc6 (2... d6) *';
  const passant = linesOf(readTree(PASSANT));
  check("a start position is written the way the board writes it",
    passant[0].entries[passant[0].entries.length - 1].fen ===
      parsePgn(PASSANT).entries[parsePgn(PASSANT).entries.length - 1].fen,
    passant[0].entries[passant[0].entries.length - 1].fen);
  check("and a file that will not read at all is no tree", readTree('[FEN "not a position"]\n\n1. e4 *') === null);

  /* What a line is called: the file's comment on the move it turns on. */
  const named = (pgn) => linesOf(readTree(pgn)).map((line) => line.choices);
  check("a variation may say what it is called at its opening instead",
    JSON.stringify(named("1. e4 e5 ({Sicilian} 1... c5 2. Nf3) 2. Nf3 *")) ===
      JSON.stringify([["1… e5"], ["1… c5 {Sicilian}"]]),
    JSON.stringify(named("1. e4 e5 ({Sicilian} 1... c5 2. Nf3) 2. Nf3 *")));
  check("while the game's own opening comment is about the game, and names no line",
    JSON.stringify(named("{Which first move?} 1. e4 (1. d4) *")) === JSON.stringify([["1. e4"], ["1. d4"]]),
    JSON.stringify(named("{Which first move?} 1. e4 (1. d4) *")));
  check("a comment after the variations against a move is that move's",
    JSON.stringify(named("1. e4 (1. d4 {Queen's pawn}) {King's pawn} *")) ===
      JSON.stringify([["1. e4 {King's pawn}"], ["1. d4 {Queen's pawn}"]]),
    JSON.stringify(named("1. e4 (1. d4 {Queen's pawn}) {King's pawn} *")));
  check("each fork of a nested line keeps its own name",
    JSON.stringify(named("1. e4 e5 (1... c5 {Sicilian} 2. Nf3 (2. c3 {Alapin} d5) d6) 2. Nf3 *")[2]) ===
      JSON.stringify(["1… c5 {Sicilian}", "2. c3 {Alapin}"]),
    JSON.stringify(named("1. e4 e5 (1... c5 {Sicilian} 2. Nf3 (2. c3 {Alapin} d5) d6) 2. Nf3 *")));
  check("the commands programs keep in comments are left out, and so is a comment of nothing else",
    JSON.stringify(named("1. e4 { [%clk 0:05:00] } (1. d4 { [%clk 0:04:59] Queen's\n  pawn [%eval 0.2] }) *")) ===
      JSON.stringify([["1. e4"], ["1. d4 {Queen's pawn}"]]),
    JSON.stringify(named("1. e4 { [%clk 0:05:00] } (1. d4 { [%clk 0:04:59] Queen's\n  pawn [%eval 0.2] }) *")));
  const long = named("1. e4 (1. d4 {The quieter way, and the one this whole book is about in the end}) *")[1][0];
  check("and a paragraph is cut short at a word", long === "1. d4 {The quieter way, and the one this whole…}", long);

  /* Each line's own ending, from its last position: the file's result is the
     main line's and says nothing about where a variation goes. */
  check("a line ending in mate has the mating side's result",
    lines.every((line) => line.result === "1-0"), JSON.stringify(lines.map((line) => line.result)));
  const ENDINGS = '[FEN "7k/8/5KQ1/8/8/8/8/8 w - - 0 1"]\n\n1. Qg7# (1. Qf7) (1. Qe8+ Kh7) *';
  const endings = linesOf(readTree(ENDINGS));
  check("stalemate is a draw, and a line that simply stops has no result",
    JSON.stringify(endings.map((line) => line.result)) === JSON.stringify(["1-0", "1/2-1/2", null]),
    JSON.stringify(endings.map((line) => line.result)));
  const bare = linesOf(readTree('[FEN "8/8/8/8/3k4/8/1r6/K7 w - - 0 1"]\n\n1. Kxb2 *'));
  check("and so is a board with too little left to mate with",
    bare[0].result === "1/2-1/2", String(bare[0].result));
  const FOOL = "1. f3 e5 (1... e6 2. g4 Qh4#) 2. e4 1-0";
  const fool = linesOf(readTree(FOOL));
  check("a mate by Black is Black's",
    fool[1].result === "0-1" && fool[0].result === null, JSON.stringify(fool.map((line) => line.result)));
  check("the result over the board is the file's until a line is named",
    resultShown(fool, 1, 0, "1-0") === "1-0", String(resultShown(fool, 1, 0, "1-0")));
  check("and the named line's own from then on",
    resultShown(fool, 1, 1, "1-0") === "0-1" && resultShown(fool, 1, 4, "1-0") === "0-1",
    `${resultShown(fool, 1, 1, "1-0")} / ${resultShown(fool, 1, 4, "1-0")}`);
  check("the main line's is the file's, where the file gives one, and its last position's where it does not",
    resultShown(fool, 0, 3, "1-0") === "1-0" && resultShown(fool, 0, 3, null) === null &&
      resultShown(endings, 0, 1, null) === "1-0",
    `${resultShown(fool, 0, 3, "1-0")} / ${resultShown(fool, 0, 3, null)} / ${resultShown(endings, 0, 1, null)}`);
  const only = soleLine(lineOf(["e4", "e5"]).entries, ["e4", "e5"]);
  check("and a game that goes only one way says the file's result wherever it stands",
    resultShown([only], 0, 0, "0-1") === "0-1" && resultShown([only], 0, 2, "0-1") === "0-1");
}

console.log("\nA video's colours\n");
{
  /* BT.709 in the video range, as the standard tabulates its colour bars. */
  const one = (r, g, b) => [...toI420(new Uint8ClampedArray([r, g, b, 255]), 1, 1)];
  const said = (colour) => colour.join(" ");
  check("white is brightness 235, no colour", said(one(255, 255, 255)) === "235 128 128", said(one(255, 255, 255)));
  check("black is 16", said(one(0, 0, 0)) === "16 128 128", said(one(0, 0, 0)));
  check("red is 63 102 240", said(one(255, 0, 0)) === "63 102 240", said(one(255, 0, 0)));
  check("green is 173 42 26", said(one(0, 255, 0)) === "173 42 26", said(one(0, 255, 0)));
  check("blue is 32 240 118", said(one(0, 0, 255)) === "32 240 118", said(one(0, 0, 255)));
  /* A 3 × 3 picture: black on the left two columns, white on the right. */
  const rgba = new Uint8ClampedArray(3 * 3 * 4);
  for (let p = 0; p < 9; p += 1) rgba.set(p % 3 === 2 ? [255, 255, 255, 255] : [0, 0, 0, 255], p * 4);
  const planes = toI420(rgba, 3, 3);
  check("an odd-sized picture has a colour sample for every 2 × 2 block, the edge's as far as it goes",
    planes.length === i420Size(3, 3) && planes.length === 9 + 2 * 4, String(planes.length));
  check("and every pixel its own brightness",
    [...planes.subarray(0, 9)].join(" ") === "16 16 235 16 16 235 16 16 235", [...planes.subarray(0, 9)].join(" "));
  check("and says it is BT.709 in the video range",
    VIDEO_COLOUR_SPACE.matrix === "bt709" && VIDEO_COLOUR_SPACE.transfer === "bt709" && VIDEO_COLOUR_SPACE.fullRange === false);
}

console.log("\nA tree of moves, grown and written out\n");
{
  const TEXT = "1. e4 {King's pawn} e5 (1... c5 {Sicilian} 2. Nf3 d6) 2. Nf3 Nc6 (2... d6 3. d4) 3. Bb5 *";
  const tree = readTree(TEXT);
  const written = writeMovetext(tree);
  check("a tree is written as PGN writes one: comments, variations, and a Black move numbered after either",
    written === "1. e4 {King's pawn} 1... e5 (1... c5 {Sicilian} 2. Nf3 d6) 2. Nf3 Nc6 (2... d6 3. d4) 3. Bb5", written);
  const again = readTree(`${written} *`);
  const shape = (t) => JSON.stringify(linesOf(t).map((line) => [line.moves, line.choices]));
  check("and read back, it is the same tree", shape(again) === shape(tree), shape(again));
  const long = readTree(`{${"a very long comment ".repeat(4)}} 1. e4 {${"said at length ".repeat(5)}} e5 *`);
  check("with its comments whole, not cut down to a line's name",
    writeMovetext(long).includes("said at length said at length said at length said at length said at length") &&
      writeMovetext(long).startsWith("{a very long comment"),
    writeMovetext(long).slice(0, 80));

  const grown = lineTree(lineOf(["e4", "e5", "Nf3"]).entries);
  const board = new Chess();
  board.move("e4");
  board.move("c5");
  const added = playInto(grown, ["e4"], "c5", board.fen());
  const followed = playInto(grown, ["e4"], "e5", "unused");
  check("a move from an earlier position grows a branch after the line already there",
    added?.grown === true && writeMovetext(grown) === "1. e4 e5 (1... c5) 2. Nf3", writeMovetext(grown));
  check("and one the tree already makes is followed, not added",
    followed?.grown === false && linesOf(grown).length === 2, String(linesOf(grown).length));
  check("and a way the tree does not go is refused", playInto(grown, ["d4"], "d5", "unused") === null);

  const separated = readTree('[SetUp "1"]\n[FEN "7K/3kq1PP/8/8/8/8/8/8 b - - 0 1"]\n\n1. ... Qe5 2. Kg8 Qe8# 0-1');
  check("a Black move numbered with its dots apart from it — \"1. ... Qe5\" — is read",
    linesOf(separated)[0].moves.join(" ") === "Qe5 Kg8 Qe8#", linesOf(separated)[0].moves.join(" "));
}

console.log("\nPromotion\n");
{
  const board = new Chess("8/4P3/8/8/8/8/k7/4K3 w - - 0 1");
  check("a pawn's move to the last rank is a promotion, and a king's is not",
    isPromotion(board, "e7", "e8") && !isPromotion(board, "e1", "e2"));
  const made = ["q", "r", "b", "n"].map((piece) => applyMove(board, "e7", "e8", piece)?.san);
  check("and becomes the piece asked for", JSON.stringify(made) === JSON.stringify(["e8=Q", "e8=R", "e8=B", "e8=N"]), made.join(" "));
  check("a queen when nothing is asked", applyMove(board, "e7", "e8")?.san === "e8=Q");
}

console.log("\nThe walk through every line, a position at a time\n");
{
  const lines = linesOf(readTree("1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *"));
  const places = tourPlaces(lines).map(({ line, depth }) => `${line}:${depth}`).join(" ");
  check("every position Play passes, in order, the next line taken up at its fork",
    places === "0:0 0:1 0:2 0:3 0:2 1:1 1:2 1:3", places);
  const all = tourPlaces(lines);
  check("a position is found where the board stands, on any line that passes it",
    tourIndex(lines, all, 1, 1) === 1 && tourIndex(lines, all, 0, 3) === 3 && tourIndex(lines, all, 1, 3) === 7,
    [tourIndex(lines, all, 1, 1), tourIndex(lines, all, 0, 3), tourIndex(lines, all, 1, 3)].join(" "));
  check("and the place last stepped to is kept where it is that position",
    tourIndex(lines, all, 1, 1, 5) === 5 && tourIndex(lines, all, 0, 1, 2) === 1, String(tourIndex(lines, all, 1, 1, 5)));
}

console.log("\nThe board editor\n");
{
  const knight = place(TWO_KINGS, "d4", { type: "n", color: "w" });
  check("a man is put where he is put, the move White's and nothing else said",
    knight === "4k3/8/8/8/3N4/8/8/4K3 w - - 0 1", String(knight));
  check("but never over a king, nor a pawn on the first or last rank",
    place(TWO_KINGS, "e1", { type: "q", color: "w" }) === null && place(TWO_KINGS, "a8", { type: "p", color: "w" }) === null &&
      place(TWO_KINGS, "h1", { type: "p", color: "b" }) === null);
  check("a king can be moved but not taken off, by the eraser or by being dragged off",
    shift(TWO_KINGS, "e1", "c3") === "4k3/8/8/8/8/2K5/8/8 w - - 0 1" && place(TWO_KINGS, "e8", null) === null && shift(TWO_KINGS, "e1", null) === null);
  check("any other man can be taken off either way",
    place(knight, "d4", null) === TWO_KINGS && shift(knight, "d4", null) === TWO_KINGS);
  check("the move given to the other side", withTurn(TWO_KINGS) === "4k3/8/8/8/8/8/8/4K3 b - - 0 1", withTurn(TWO_KINGS));
  check("and a position from a game taken as it stands, castling and en passant left out",
    asBoardEditorPosition("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1") === "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b - - 0 1");
  const checked = place(TWO_KINGS, "e2", { type: "r", color: "b" });
  check("a king in check with his own side to move is a position a game reaches",
    boardEditorProblems(checked).length === 0, boardEditorProblems(checked).join(" "));
  check("with the other side to move it is not, and the editor says why",
    boardEditorProblems(withTurn(checked)).join(" ") === "White is in check, with Black to move.", boardEditorProblems(withTurn(checked)).join(" "));
  check("nor are kings side by side",
    boardEditorProblems(shift(TWO_KINGS, "e8", "e2")).join(" ") === "The two kings stand next to each other.");
  let herd = TWO_KINGS;
  for (const square of ["a1", "b1", "c1", "d1", "a2", "b2", "c2", "d2", "f2", "g2", "h2"]) {
    herd = place(herd, square, { type: "n", color: "w" });
  }
  check("eleven knights can be put down, and are more than a side's pawns could have become — a warning, not a problem",
    boardEditorProblems(herd).length === 0 &&
      boardEditorWarnings(herd).join(" ") === "White has more pieces than its pawns could have become.",
    `${boardEditorProblems(herd).join(" ")} / ${boardEditorWarnings(herd).join(" ")}`);
  const crowd = "4k3/pppppppp/p7/8/8/QQQQQQQQ/QQQQQQQQ/4K3 w - - 0 1";
  check("nine pawns and sixteen queens can be played from, and are each said as unusual",
    boardEditorProblems(crowd).length === 0 &&
      boardEditorWarnings(crowd).join(" ") ===
        "White has more pieces than its pawns could have become. White has more than sixteen men. Black has more than eight pawns.",
    `${boardEditorProblems(crowd).join(" ")} / ${boardEditorWarnings(crowd).join(" ")}`);
  check("an ordinary position has nothing to warn of", boardEditorWarnings("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1").length === 0);
  check("and a warning does not hide a problem: nine pawns with the kings side by side is still red",
    boardEditorProblems("8/pppppppp/p7/8/8/8/3k4/4K3 w - - 0 1").join(" ") === "The two kings stand next to each other.");
}

console.log("\nPiece sets\n");
{
  /* The files under src/pieces, keyed as the build's glob keys them. */
  const root = new URL("../src/pieces/", import.meta.url);
  const files = {};
  for (const folder of readdirSync(root, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    for (const name of readdirSync(new URL(`${folder.name}/`, root))) {
      files[`../pieces/${folder.name}/${name}`] = readFileSync(new URL(`${folder.name}/${name}`, root), "utf8");
    }
  }
  const sets = glyphSetsFrom(files);
  check("every folder under src/pieces is a whole set, the default among them",
    sets.length === readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length &&
      sets.some((set) => set.name === DEFAULT_GLYPH_SET),
    sets.map((set) => set.name).join(", "));
  check("each of their pictures is a square with something drawn in it",
    sets.every((set) => Object.values(set.pieces).every((glyph) =>
      glyph.viewBox[2] === glyph.viewBox[3] && glyph.viewBox[2] > 0 && /<(path|g|circle|rect|polygon|ellipse)\b/.test(glyph.body))));

  const square = (inside) => `<?xml version="1.0"?>\n<!-- made by hand -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${inside}</svg>\n`;
  const whole = (folder) => Object.fromEntries(["k", "q", "r", "b", "n", "p"].map((kind) => [`../pieces/${folder}/${kind}.svg`, square(`<path d="M0 0h${kind === "k" ? 2 : 1}"/>`)]));
  const made = glyphSetsFrom({
    ...whole("Hand made"),
    ...Object.fromEntries(Object.entries(whole("Five only")).filter(([path]) => !path.endsWith("/p.svg"))),
    "../pieces/Hand made/LICENSE.txt": "free",
    "../pieces/Hand made/x.svg": square("<path/>"),
  });
  check("a folder of six makes a set called after it, and one short of a man makes none",
    made.length === 1 && made[0].name === "Hand made", made.map((set) => set.name).join(", "));
  check("a picture is read past its prolog and comments, in the units it was drawn in",
    JSON.stringify(made[0]?.pieces.k) === JSON.stringify({ viewBox: [0, 0, 45, 45], body: '<path d="M0 0h2"/>' }),
    JSON.stringify(made[0]?.pieces.k));
  check("one with a width and height and no viewBox is a square of that size",
    JSON.stringify(readGlyph('<svg width="40" height="40"><circle r="3"/></svg>')?.viewBox) === "[0,0,40,40]");
  check("and a file that is not a picture is not read as one",
    readGlyph("<html></html>") === null && readGlyph('<svg viewBox="0 0 0 0"></svg>') === null);
  check("a set's meta-info.json moves its men, and a set without one stays where it is drawn",
    JSON.stringify(sets.find((set) => set.name === "Noto Sans Symbols2")?.shift) === '{"x":0,"y":0.1}' &&
      JSON.stringify(sets.find((set) => set.name === DEFAULT_GLYPH_SET)?.shift) === '{"x":0,"y":0}',
    JSON.stringify(sets.map((set) => [set.name, set.shift])));
  const moved = glyphSetsFrom({ ...whole("Moved"), "../pieces/Moved/meta-info.json": '{ "correction": { "delta_x": -0.05, "delta_y": 0.1 }, "author": "anyone" }' });
  check("read from beside the pictures, whatever else the file holds",
    JSON.stringify(moved[0]?.shift) === '{"x":-0.05,"y":0.1}', JSON.stringify(moved[0]?.shift));
  check("and a file that is not JSON, or a correction that is not a number, is no correction",
    JSON.stringify([readShift("{ correction: oops"), readShift('{"correction":{"delta_y":"0.1"}}'), readShift('{"correction":{"delta_x":0.2}}'), readShift(undefined)]) ===
      '[{"x":0,"y":0},{"x":0,"y":0},{"x":0.2,"y":0},{"x":0,"y":0}]');
  check("a set asked for by name is that set, and one no set answers to is the default",
    glyphSetNamed(sets, sets.at(-1).name) === sets.at(-1) && glyphSetNamed(sets, "Gone since").name === DEFAULT_GLYPH_SET);

  for (const [name, preset] of [["default", DEFAULT_SETTINGS], ["classic brown", CLASSIC_BROWN_JSON], ["classic green", CLASSIC_GREEN_JSON]]) {
    check(`the ${name} preset names a set this build has`, sets.some((set) => set.name === preset.pieces.glyphSet), preset.pieces.glyphSet);
  }
  const older = structuredClone(DEFAULT_SETTINGS);
  delete older.pieces.glyphSet;
  const read = parseSettings(JSON.stringify(older)).settings;
  check("settings written before there were sets are read with the default set, first in their group",
    read?.pieces.glyphSet === DEFAULT_GLYPH_SET && Object.keys(read.pieces)[0] === "glyphSet", JSON.stringify(read?.pieces));
}

console.log("\nLines removed either side of the one on the board\n");
{
  const PGN = "1. e4 e5 (1... c5 2. Nf3) (1... e6 2. d4) 2. Nf3 *";
  const lines = linesOf(readTree(PGN));
  const before = readTree(PGN);
  withoutLinesBefore(before, lines, 1);
  const after = readTree(PGN);
  withoutLinesAfter(after, lines, 1);
  check("before the second of three: the second, first now, and the third",
    writeMovetext(before) === "1. e4 c5 (1... e6 2. d4) 2. Nf3", writeMovetext(before));
  check("after it: the first, and the second",
    writeMovetext(after) === "1. e4 e5 (1... c5 2. Nf3) 2. Nf3", writeMovetext(after));
  const last = readTree(PGN);
  withoutLinesAfter(last, lines, 2);
  check("and after the last there is nothing to take", writeMovetext(last) === writeMovetext(readTree(PGN)), writeMovetext(last));
  const only = readTree(PGN);
  withOnlyLine(only, lines, 2);
  check("and with only the line on the board kept, all of it is kept, to its end",
    writeMovetext(only) === "1. e4 e6 2. d4", writeMovetext(only));
}

console.log("\nA line written out for the list of lines\n");
{
  const task = linesOf(readTree('[SetUp "1"]\n[FEN "3k4/R6R/3n4/8/8/8/8/K7 w - - 0 1"]\n\n1. Rhg7 Nf7 {case A} (1... Ne8 {case B} 2. Ra8#) 2. Rg8# 1-0\n'));
  const everything = () => true;
  check("a line is its number and every move from the first position, the file's name for it where it parts",
    lineLabel(task[0], "1", everything) === "1: 1. Rhg7 Nf7 {case A} 2. Rg8#" &&
      lineLabel(task[1], "Line 2", everything) === "Line 2: 1. Rhg7 Ne8 {case B} 2. Ra8#",
    `${lineLabel(task[0], "1", everything)} / ${lineLabel(task[1], "Line 2", everything)}`);
  check("a line with no name to give it is the way it goes, and nothing before it",
    lineLabel(task[0], "", everything) === "1. Rhg7 Nf7 {case A} 2. Rg8#", lineLabel(task[0], "", everything));
  const opening = linesOf(readTree("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 (3... Nf6 4. O-O) 4. Ba4 *"))[0];
  const upTo = (n) => (label) => label.length <= n;
  check("too long, it keeps its end, its front said with an ellipsis — starting at a White move, never a Black one",
    lineLabel(opening, "1", upTo(30)) === "1: … 3. Bb5 a6 4. Ba4", lineLabel(opening, "1", upTo(30)));
  check("and keeps its last pair however little room there is",
    lineLabel(opening, "1", () => false) === "1: … 4. Ba4", lineLabel(opening, "1", () => false));
  const fromBlack = linesOf(readTree('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 7"]\n\n7... Kd7 8. e4 (8. e3 Kc6) Ke6 *'))[0];
  check("a line from a position with Black to move starts at Black's move, by the position's own number",
    lineLabel(fromBlack, "1", everything) === "1: 7... Kd7 8. e4 Ke6", lineLabel(fromBlack, "1", everything));
  check("and cut short, starts at White's move after it",
    lineLabel(fromBlack, "1", upTo(14)) === "1: … 8. e4 Ke6", lineLabel(fromBlack, "1", upTo(14)));

  /* Paged over the board: forty characters of room, so the middle half is from the 10th to the 30th. */
  const long = linesOf(readTree("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 *"))[0];
  const chars = (text) => text.length;
  const walk = (from, to, step, start = null) => {
    const pages = [];
    let previous = start;
    for (let move = from; move !== to + step; move += step) {
      const page = pageLine(long, "", chars, 40, move, previous);
      pages.push({ move, ...page });
      previous = page.first;
    }
    return pages;
  };
  const forward = walk(-1, long.moves.length - 1, 1);
  const shownMoves = (page) => page.label.slice(page.head.length).replace(/ …$/, "");
  /* Where on a page's label a move of the line stands, by characters: null where it is not on the page. */
  const spanOf = (page, move) => {
    let at = page.head.length;
    let index = page.first;
    for (const token of page.label.slice(page.head.length).replace(/\u00a0/g, " ").split(" ")) {
      if (token !== "" && token !== "…" && !/^\d+\.(\.\.)?$/.test(token)) {
        if (index === move) return [at, at + token.length];
        index += 1;
      }
      at += token.length + 1;
    }
    return null;
  };
  const toTheEnd = (page) => !page.label.endsWith("…");
  check("a line that fits is all there, at every move",
    [-1, 0, 1, 2].every((move) => pageLine(task[0], "", chars, 40, move, null).label.replace(/\s+/g, " ") === "1. Rhg7 Nf7 {case A} 2. Rg8#"));
  check("too long, the move it is at is always in the middle half — or before it, where the page starts the line, or after it, where it ends it",
    forward.slice(1).every((page) => {
      const span = spanOf(page, page.move);
      return span !== null && (page.first === 0 || span[0] >= 10) && (span[1] <= 30 || toTheEnd(page));
    }),
    forward.slice(1).map((page) => `${page.move}:${JSON.stringify(spanOf(page, page.move))}`).join(" "));
  check("and the page stands still until the move would run past it",
    forward.slice(2).every((page, index) => {
      const was = forward[index + 1];
      if (page.first === was.first) return true;
      const there = spanOf(was, page.move);
      return !toTheEnd(was) && (there === null || there[1] > 30);
    }),
    forward.map((page) => page.first).join(","));
  check("turning, to put the move at the start of the middle half",
    forward.slice(2).every((page, index) => page.first === forward[index + 1].first || toTheEnd(page) || spanOf(page, page.move)[0] >= 10));
  check("every page starting at a White move, its number first",
    forward.every((page) => /^\d+\. /.test(shownMoves(page))), forward.map((page) => shownMoves(page).slice(0, 8)).join(" | "));
  check("pairs of moves set a space further apart than the moves of a pair",
    /a6\u00a0 4\. Ba4/.test(forward.find((page) => page.label.includes("Ba4")).label));
  const end = forward.filter(toTheEnd);
  check("the page that shows the line to its end stays, the move running on into its last quarter",
    end.length >= 3 && end.every((page) => page.first === end[0].first) && end[end.length - 1].move === long.moves.length - 1 &&
      spanOf(end[end.length - 1], long.moves.length - 1)[1] > 30,
    end.map((page) => `${page.move}:${page.first}`).join(" "));
  check("and is the page a board opened at the end of the line is on",
    pageLine(long, "", chars, 40, long.moves.length - 1, null).first === end[0].first);
  const back = walk(long.moves.length - 1, -1, -1, end[0].first);
  check("stepping back, it turns a page back once the move is in the first quarter, the move then at the end of the middle half",
    back.slice(1).every((page, index) => {
      const was = back[index];
      if (page.first === was.first) return page.first === 0 || spanOf(page, page.move) === null || spanOf(page, page.move)[0] >= 10 || page.move < 0;
      const there = spanOf(was, page.move);
      return (there === null || there[0] < 10) && (page.move < 0 || spanOf(page, page.move)[1] <= 30);
    }),
    back.map((page) => `${page.move}:${page.first}`).join(" "));
  check("and at the first position, the line from its start",
    back[back.length - 1].first === 0, back[back.length - 1].label);
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
