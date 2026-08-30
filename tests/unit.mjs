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

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
