/**
 * The parts that need neither a server nor a browser.
 *
 *   npm run test:unit
 *
 * Run straight from the TypeScript: node strips the types, so there is no build
 * step between what is written and what is checked.
 */
import { toPgn } from "../src/chess/pgn.ts";
import { parseSettings, settingsToJson } from "../src/app/settingsFile.ts";
import { SETTINGS_SCHEMA_VERSION } from "../src/app/settings.ts";
import DEFAULT_SETTINGS_JSON from "../src/app/presets/default-settings.json" with { type: "json" };
const DEFAULT_SETTINGS = DEFAULT_SETTINGS_JSON;
import { lineOf as lineFromHistory } from "../src/chess/history.ts";
import { openingFromUrl } from "../src/app/sharing.ts";
import { reachSignature } from "../src/chess/attacks.ts";
import { halfMoves } from "../src/app/friend/counting.ts";
import { nextStashName } from "../src/chess/stash.ts";
import { pinnedSquares } from "../src/chess/pins.ts";
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
  check("Round is the question mark PGN uses when there is none", tag("Round") === "?", tag("Round"));
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
  check("the note about which one the app opens with is not",
    settingsFileName("Blue - orange - with attacks (default)") ===
      "Blue - orange - with attacks.json",
    settingsFileName("Blue - orange - with attacks (default)"));
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
  check("a file that names nobody says so rather than leaving a blank",
    bare.players.white === "Unknown" && bare.players.black === "Unknown",
    JSON.stringify(bare.players));

  const asked = parsePgn('[White "?"]\n[Black "  "]\n\n1. e4 *');
  check("and PGN's own question mark is nobody too",
    asked.players.white === "Unknown" && asked.players.black === "Unknown",
    JSON.stringify(asked.players));

  const broken = parsePgn("this is not a game");
  check("a file that will not read still answers about its players",
    broken.entries === null && broken.players.white === "Unknown");
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
  check("and the flag is read off the link", played?.autoplay === true);
  const quiet = openingFromUrl(`?game=${pgn}`);
  check("a link without it asks for nothing of the kind", quiet?.autoplay === false);
  const spot = openingFromUrl("?position=rnbqkbnr%2Fpppppppp%2F8%2F8%2F8%2F8%2FPPPPPPPP%2FRNBQKBNR+w+KQkq+-+0+1&autoplay=1");
  check("a position alone never plays, whatever the link says",
    spot !== null && spot.entries === null && spot.autoplay === false,
    JSON.stringify(spot));
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

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
