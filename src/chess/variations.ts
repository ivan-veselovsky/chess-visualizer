/*
  Written with its extensions, like the other modules `tests/unit.mjs` runs
  straight from the TypeScript.
*/
import { Chess, DEFAULT_POSITION } from "chess.js";
import type { HistoryEntry } from "./history.ts";

/**
 * A game with its variations: every position reached, and the moves on from
 * each, as a tree.
 *
 * `next` holds what follows this position: the first is the line the game goes
 * on in — the main line — and the rest are the variations given against that
 * move, in the order they were written. A position with nothing after it ends a
 * line.
 */
export interface MoveTree {
  fen: string;
  /** The move that reached this position, as chess.js writes it; null at the start. */
  move: string | null;
  /**
   * What the file calls that move, where it calls it anything: the comment
   * written after it — "Nf7 {case A}" — or, for the first move of a variation,
   * the one the variation opens with — "({case B} 1... Ne8". The first the
   * file says about the move, where it is written more than once; empty where
   * it says nothing. See `noteFrom` for how it is tidied.
   */
  note: string;
  /**
   * What the file writes after the move, whole — every comment there, joined
   * — and, for the first move of a line, what it writes before it: `note` is
   * these cut down to a name, and these are what a tree written back out
   * carries, so a file read in and written out again keeps what it said.
   */
  comment: string;
  lead: string;
  next: MoveTree[];
}

/**
 * One way through the tree, from the start to an end: what the board holds when
 * that line is on it.
 */
export interface TreeLine {
  /** As a history holds them: newest first, the start position last. */
  entries: HistoryEntry[];
  /** The moves, in the order they are played. */
  moves: string[];
  /**
   * Which way it goes at each position where the tree forks, as moves with
   * their numbers — "1… Ne8", "3. Qh5" — which is what tells this line from the
   * others, and with what the file calls each, where it calls it anything:
   * "1… Ne8 {case B}". Empty for a game with no variations.
   */
  choices: string[];
  /** How many moves into the line each of those choices is made: where each fork stands. */
  forks: number[];
  /**
   * How the line ends, where its last position says so by itself: "1-0" or
   * "0-1" for a mate, "1/2-1/2" for stalemate or too little left to mate with —
   * the endings a game with a friend is ended by as well. Null for a line that
   * simply stops, which is most of them in a game: a resignation, or analysis
   * that goes no further.
   */
  result: string | null;
}

/** The line a game with no variations has: all of it, forking nowhere. */
export function soleLine(entries: HistoryEntry[], moves: string[]): TreeLine {
  return { entries, moves, choices: [], forks: [], result: null };
}

/** What a PGN's moves are written in, less whatever says nothing about them. */
type Token =
  | { kind: "move"; move: string }
  | { kind: "comment"; text: string }
  | { kind: "open" }
  | { kind: "close" };

/**
 * Every token a PGN's moves are written in, with the ones that say nothing
 * about the moves already dropped: annotation glyphs, the marks after a move,
 * move numbers, the result, and lines of escaped text. Comments are kept, of
 * either kind — a comment on a move a line turns on is what the line is called.
 */
function tokens(movetext: string): Token[] {
  const out: Token[] = [];
  const text = movetext.replace(/^%.*$/gm, " ");
  let at = 0;
  while (at < text.length) {
    const c = text[at];
    if (c === "{" || c === ";") {
      /* In braces, or to the end of the line. */
      const end = text.indexOf(c === "{" ? "}" : "\n", at);
      out.push({ kind: "comment", text: text.slice(at + 1, end < 0 ? text.length : end) });
      at = end < 0 ? text.length : end + 1;
    } else if (c === "(" || c === ")") {
      out.push({ kind: c === "(" ? "open" : "close" });
      at += 1;
    } else if (/\s/.test(c)) {
      at += 1;
    } else {
      let end = at;
      while (end < text.length && !/[\s(){};]/.test(text[end])) {
        end += 1;
      }
      const word = text.slice(at, end);
      at = end;
      /* A move number may be glued to its move: "1.e4", "12...Nf6". */
      const move = word.replace(/^\d+\.+/, "").replace(/[!?]+$/, "");
      /* And the dots of a Black move's number written apart from it: "1. ... Qe5". */
      if (
        move === "" ||
        /^\.+$/.test(move) ||
        move.startsWith("$") ||
        /^(1-0|0-1|1\/2-1\/2|\*)$/.test(move)
      ) {
        continue;
      }
      out.push({ kind: "move", move });
    }
  }
  return out;
}

/** Where the game starts: the FEN tag, where there is one, and the usual start otherwise. */
function startOf(pgn: string): string {
  const fen = /\[\s*FEN\s+"([^"]*)"\s*\]/.exec(pgn);
  return fen === null ? DEFAULT_POSITION : fen[1].trim();
}

/**
 * A move as the file writes it: the comments either side of it, and the
 * variations given against it.
 */
interface Written {
  move: string;
  /** Written before it, which only the first move of a line can have. */
  before: string;
  after: string;
  variations: Written[][];
}

const joined = (one: string, other: string) => (one === "" ? other : `${one} ${other}`);

/**
 * The tokens as lines inside lines. A variation belongs to the move just
 * before it; one with no move before it to stand against is passed over. A
 * comment belongs to the move before it too — after a variation as well,
 * which stood against that same move — except at the start of a line, where
 * there is none, and it is the first move's.
 */
function writtenLines(list: Token[]): Written[] {
  let at = 0;
  const line = (): Written[] => {
    const moves: Written[] = [];
    let opening = "";
    while (at < list.length) {
      const token = list[at];
      at += 1;
      if (token.kind === "close") {
        break;
      }
      if (token.kind === "open") {
        const variation = line();
        if (moves.length > 0) {
          moves[moves.length - 1].variations.push(variation);
        }
        continue;
      }
      if (token.kind === "comment") {
        const last = moves[moves.length - 1];
        if (last === undefined) {
          opening = joined(opening, token.text);
        } else {
          last.after = joined(last.after, token.text);
        }
        continue;
      }
      moves.push({ move: token.move, before: moves.length === 0 ? opening : "", after: "", variations: [] });
    }
    return moves;
  };
  return line();
}

/** How long a line's name may be before it is cut short: room for "case A", and for most sentences' first words. */
const NOTE_LENGTH = 40;

/**
 * A comment as the name of a line: without the commands some programs keep in
 * comments — "[%clk 0:04:58]", "[%eval 0.3]" — on one line, and cut short at a
 * word, so that a paragraph of annotation does not crowd the moves out of the
 * row it is shown in.
 */
function noteFrom(comment: string): string {
  const text = comment.replace(/\[%[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= NOTE_LENGTH) {
    return text;
  }
  const cut = text.slice(0, NOTE_LENGTH);
  const space = cut.lastIndexOf(" ");
  return `${(space > NOTE_LENGTH / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * A PGN's moves as a tree, variations and all.
 *
 * Read here rather than by chess.js, which reads the variations and then keeps
 * only the main line; the tree it builds is not something it hands out. The
 * moves are replayed through chess.js all the same, from the position each
 * variation starts at, so every move in the tree is a legal one written the way
 * the rest of the app writes it.
 *
 * A variation, in parentheses, is an alternative to the move just before it:
 * it starts from the position that move was played from. One that goes wrong —
 * a move that is not legal there — is kept as far as it went right, rather than
 * refusing the whole game over a slip in a side line.
 *
 * Each line is grown whole before any of the variations against it, so the
 * line a file carries on in is always the first way on from a position. Taken
 * in the order written, a variation that begins by repeating the move it stands
 * against — "1. e4 e5 (1... e5 2. d4) 2. Nf3" — would have reached the
 * position after 1... e5 first, and 2. d4 would have become the main line.
 *
 * Null when the file will not read at all.
 */
export function readTree(pgn: string): MoveTree | null {
  /* As chess.js writes it back, which is not always as the tag has it — an en
     passant square nobody can take on is dropped — and it is chess.js's
     writing that the board's own line is compared with. */
  let start: string;
  try {
    start = new Chess(startOf(pgn)).fen();
  } catch {
    return null;
  }
  /* The tags, wherever they stand — some files put several on one line. */
  const movetext = pgn.replace(/\[\s*\w+\s+"(?:[^"\\]|\\.)*"\s*\]/g, " ");
  const root: MoveTree = { fen: start, move: null, note: "", comment: "", lead: "", next: [] };

  /* The position a move leads to from `here`: the one already in the tree when
     the move has been written before, a new one otherwise, and none when the
     move is not legal there. */
  const after = (here: MoveTree, written: string): MoveTree | null => {
    let played: string;
    let fen: string;
    try {
      const board = new Chess(here.fen);
      played = board.move(written).san;
      fen = board.fen();
    } catch {
      return null;
    }
    let child = here.next.find((node) => node.move === played);
    if (child === undefined) {
      child = { fen, move: played, note: "", comment: "", lead: "", next: [] };
      here.next.push(child);
    }
    return child;
  };

  /* A variation's first move is named by what the variation opens with, if it
     opens with anything; the game's own opening comment is about the game. */
  const grow = (from: MoveTree, line: Written[], variation: boolean): void => {
    const against: [MoveTree, Written[][]][] = [];
    let here = from;
    for (const [index, written] of line.entries()) {
      /* Kept even where the move itself goes wrong: they start from the
         position before it, which is a sound one. */
      against.push([here, written.variations]);
      const next = after(here, written.move);
      if (next === null) {
        break;
      }
      if (next.note === "") {
        next.note = noteFrom(
          variation && index === 0 && written.before !== "" ? written.before : written.after
        );
      }
      if (next.comment === "") {
        next.comment = written.after.trim();
      }
      if (index === 0 && next.lead === "") {
        next.lead = written.before.trim();
      }
      here = next;
    }
    for (const [before, variations] of against) {
      for (const variation of variations) {
        grow(before, variation, true);
      }
    }
  };
  grow(root, writtenLines(tokens(movetext)), false);
  return root;
}

/** How a position ends a game by itself, if it does; see `TreeLine.result`. */
function endingAt(fen: string): string | null {
  const board = new Chess(fen);
  if (board.isCheckmate()) {
    return board.turn() === "w" ? "0-1" : "1-0";
  }
  if (board.isStalemate() || board.isInsufficientMaterial()) {
    return "1/2-1/2";
  }
  return null;
}

/** "1. e4" for a move by White, "1… e5" for one by Black: its number, from the position it was played in. */
function numbered(fenBefore: string, move: string): string {
  const [, side, , , , full] = fenBefore.split(" ");
  return side === "b" ? `${full}… ${move}` : `${full}. ${move}`;
}

/** A choice at a fork as it is said: its move, numbered, and what the file calls it, in the braces it was written in. */
function choiceOf(fenBefore: string, child: MoveTree): string {
  const move = numbered(fenBefore, child.move!);
  return child.note === "" ? move : `${move} {${child.note}}`;
}

/**
 * Every line through the tree, in the order they are walked: the main line
 * first, then at the last fork before its end the next variation along, and so
 * on — each line's variations before the lines that branch off earlier.
 */
export function linesOf(tree: MoveTree): TreeLine[] {
  const out: TreeLine[] = [];
  const walk = (node: MoveTree, path: MoveTree[], choices: string[], forks: number[]) => {
    const here = [...path, node];
    if (node.next.length === 0) {
      const entries: HistoryEntry[] = here
        .map((step) => ({ fen: step.fen, move: step.move }))
        .reverse();
      out.push({
        entries,
        moves: here.slice(1).map((step) => step.move!),
        choices,
        forks,
        result: endingAt(node.fen),
      });
      return;
    }
    const fork = node.next.length > 1;
    for (const child of node.next) {
      walk(
        child,
        here,
        fork ? [...choices, choiceOf(node.fen, child)] : choices,
        fork ? [...forks, path.length] : forks
      );
    }
  };
  walk(tree, [], [], []);
  return out;
}

/**
 * The way a line has gone so far, with the board `depth` moves into it: its
 * choices at the forks it has come to, the one it is standing at included —
 * the move about to be played there is the one that says which line this is.
 * Nothing before the first fork, where every line is still the same.
 */
export function pathSoFar(line: TreeLine, depth: number): string[] {
  return line.choices.filter((_, index) => line.forks[index] <= depth);
}

/**
 * How the game came out, as it is said over the board while `line` is on it,
 * `depth` moves in.
 *
 * The line's own ending, once the line has been named — from the first fork
 * it comes to — and until then the file's result, `given`: before the first
 * fork every line is still the same one, and the file's is the only result
 * there is. A file's result belongs to its main line, which ends as the file
 * says wherever the file says anything, a resignation leaving nothing on the
 * board to tell it by. A variation ends as its last position says, or not at
 * all.
 */
export function resultShown(lines: TreeLine[], line: number, depth: number, given: string | null): string | null {
  const here = lines[line];
  if (here === undefined || pathSoFar(here, depth).length === 0) {
    return given;
  }
  return line === 0 && given !== null ? given : here.result;
}

/** How many moves two lines have in common from the start. */
export function sharedMoves(one: TreeLine, other: TreeLine): number {
  let shared = 0;
  while (shared < one.moves.length && shared < other.moves.length && one.moves[shared] === other.moves[shared]) {
    shared += 1;
  }
  return shared;
}

/**
 * One step of the walk through every line, as the board takes it: a move
 * played, a move taken back, or — at a fork, having come back to it — the next
 * line taken up, which moves nothing.
 */
export type Step =
  | { kind: "forward" }
  | { kind: "back" }
  | { kind: "switch"; line: number };

/**
 * The walk through every line from where the board is to the end of the last:
 * on to the end of the line it is on, back to where the next line leaves it,
 * over to that line, on to its end, and so on.
 *
 * Only as far back as the fork each time, and never further: a line is never
 * played from the start again when the part it shares with the one before is
 * still on the board.
 */
export function walk(lines: TreeLine[], line: number, depth: number): Step[] {
  const steps: Step[] = [];
  let at = depth;
  for (let current = line; current < lines.length; current += 1) {
    while (at < lines[current].moves.length) {
      steps.push({ kind: "forward" });
      at += 1;
    }
    const following = lines[current + 1];
    if (following === undefined) {
      break;
    }
    const fork = sharedMoves(lines[current], following);
    while (at > fork) {
      steps.push({ kind: "back" });
      at -= 1;
    }
    steps.push({ kind: "switch", line: current + 1 });
  }
  return steps;
}

/** Which line the board's own line is, if it is one of them. */
export function lineIndex(lines: TreeLine[], initialFEN: string, moves: string[]): number {
  const wanted = moves.join(" ");
  return lines.findIndex(
    (line) => line.entries[line.entries.length - 1].fen === initialFEN && line.moves.join(" ") === wanted
  );
}

/**
 * A line of positions as a tree with no forks: what a board that has only ever
 * gone one way holds, ready to be grown into more.
 */
export function lineTree(entries: HistoryEntry[]): MoveTree {
  const oldestFirst = [...entries].reverse();
  const root: MoveTree = { fen: oldestFirst[0].fen, move: null, note: "", comment: "", lead: "", next: [] };
  let here = root;
  for (const entry of oldestFirst.slice(1)) {
    const child: MoveTree = { fen: entry.fen, move: entry.move, note: "", comment: "", lead: "", next: [] };
    here.next.push(child);
    here = child;
  }
  return root;
}

/**
 * A move played from `path` into the tree: the position it reaches, found
 * where the tree already goes that way, and grown where it does not — as the
 * last way on from there, so the ways already there keep their order and the
 * first one played from a position stays its main line. Changes the tree it is
 * given. Null when `path` is not a way through it.
 */
export function playInto(tree: MoveTree, path: string[], move: string, fen: string): { grown: boolean } | null {
  let here = tree;
  for (const step of path) {
    const next = here.next.find((child) => child.move === step);
    if (next === undefined) {
      return null;
    }
    here = next;
  }
  if (here.next.some((child) => child.move === move)) {
    return { grown: false };
  }
  here.next.push({ fen, move, note: "", comment: "", lead: "", next: [] });
  return { grown: true };
}

/**
 * The tree's moves as a PGN writes them, variations and comments and all: each
 * move, what is said after it, the variations against it in parentheses, and
 * then the line going on. A move is numbered where White plays it, and where
 * Black does at the start of a line or after a comment or a variation has come
 * between it and the move before — "1. e4 (1. d4) 1... e5" — as PGN has it.
 */
export function writeMovetext(tree: MoveTree): string {
  const said = (text: string) => (text === "" ? [] : [`{${text}}`]);
  const written = (before: MoveTree, child: MoveTree, numbered: boolean): string => {
    const [, side, , , , full] = before.fen.split(" ");
    const number = side === "w" ? `${full}. ` : numbered ? `${full}... ` : "";
    return `${number}${child.move}`;
  };
  const line = (from: MoveTree, numbered: boolean): string[] => {
    const out: string[] = [];
    let here = from;
    let number = numbered;
    while (here.next.length > 0) {
      const [main, ...others] = here.next;
      out.push(...said(main.lead), written(here, main, number || main.lead !== ""), ...said(main.comment));
      for (const other of others) {
        const inner = [...said(other.lead), written(here, other, true), ...said(other.comment), ...line(other, other.comment !== "")];
        out.push(`(${inner.join(" ")})`);
      }
      number = others.length > 0 || main.comment !== "";
      here = main;
    }
    return out;
  };
  return line(tree, true).join(" ");
}
