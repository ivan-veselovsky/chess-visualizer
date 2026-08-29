/**
 * The parts that need neither a server nor a browser.
 *
 *   npm run test:unit
 *
 * Run straight from the TypeScript: node strips the types, so there is no build
 * step between what is written and what is checked.
 */
import { toPgn } from "../src/chess/pgn.ts";
import {
  describeHandicap,
  positionWithHandicap,
} from "../src/chess/handicap.ts";
import { readGameId, spellGameId } from "../src/app/friend/storage.ts";
import { friendlyGameName } from "../src/app/friend/gameName.ts";
import { describeEnding } from "../src/app/friend/ending.ts";
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

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
