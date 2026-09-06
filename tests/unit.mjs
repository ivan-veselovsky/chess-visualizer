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

  check("nothing kept yet means nothing to open with",
    loadSettings() === null);

  const mine = { ...DEFAULT_SETTINGS, fadeMs: 1234 };
  saveSettings(mine);
  check("a change is not written the instant it is made",
    store.has(SETTINGS_KEY) === false);
  /* Forty changes in a drag are one write, of the value landed on. The clock
     that would have done it is half a minute long; what it calls when it comes
     round is what is called here. */
  for (let n = 0; n < 40; n += 1) {
    saveSettings({ ...mine, fadeMs: 1000 + n });
  }
  flushSettings();
  check("and a run of them is one write, of the last",
    store.size === 1 && JSON.parse(store.get(SETTINGS_KEY)).fadeMs === 1039,
    String(store.size));
  flushSettings();
  check("with nothing to write, nothing is written",
    JSON.parse(store.get(SETTINGS_KEY)).fadeMs === 1039);

  /* A tab opened and left alone hands the settings back unchanged, which is
     not a change and is not worth a write. */
  let writes = 0;
  const counting = globalThis.window.localStorage.setItem;
  globalThis.window.localStorage.setItem = (key, value) => {
    writes += 1;
    counting(key, value);
  };
  saveSettings({ ...mine, fadeMs: 1039 });
  flushSettings();
  check("and settings that come back the same are not written again",
    writes === 0, String(writes));
  globalThis.window.localStorage.setItem = counting;

  check("what was kept is what opens next time",
    loadSettings()?.fadeMs === 1039);

  /* One unlucky write, landing as half a record — which is what the read-back
     is there to catch. The store is itself again straight after, as a store
     that could never write would leave nothing to put anything back with. */
  const whole = store.get(SETTINGS_KEY);
  const keep = globalThis.window.localStorage.setItem;
  globalThis.window.localStorage.setItem = (key, value) => {
    globalThis.window.localStorage.setItem = keep;
    store.set(key, String(value).slice(0, 40));
  };
  saveSettings({ ...mine, fadeMs: 4321 });
  flushSettings();
  check("a write that lands half-written puts back the one that did not",
    store.get(SETTINGS_KEY) === whole, store.get(SETTINGS_KEY).slice(0, 44));
  check("so the settings still read back whole",
    loadSettings()?.fadeMs === 1039);

  store.set(SETTINGS_KEY, JSON.stringify({ ...mine, schemaVersion: 999 }));
  check("settings from another revision are dropped, not guessed at",
    loadSettings() === null && store.has(SETTINGS_KEY) === false);

  store.set(SETTINGS_KEY, '{"schemaVersion":' + SETTINGS_SCHEMA_VERSION + ',"theme"');
  check("and so is a record a dying tab cut in half",
    loadSettings() === null && store.has(SETTINGS_KEY) === false);

  store.set(SETTINGS_KEY, JSON.stringify({ schemaVersion: SETTINGS_SCHEMA_VERSION }));
  check("as is one with the settings missing from it",
    loadSettings() === null);

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
