/*
  Written with its extensions, like the other modules `tests/unit.mjs` runs
  straight from the TypeScript.
*/
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

/**
 * A position being set up in the board editor, and what may be done to it.
 *
 * The editor is not a game: pieces go where they are put, rather than where a
 * move could take them, and as many of a kind as anybody likes. What it keeps
 * to is what a board must have to be shown at all — one king a side, which can
 * be moved but not taken off — and no pawn on the first or the last rank,
 * where there is no such thing as a pawn. Everything else a position could get
 * wrong it may get wrong, and `boardEditorProblems` says what.
 *
 * Every position comes out with White or Black to move as the editor says, no
 * castling, no en passant square, and the move counts at their start: what the
 * pieces cannot say is not guessed, and the FEN field is there for anybody who
 * wants it said.
 */

/** Where the editor starts: the two kings, on their own squares, and nothing else. */
export const TWO_KINGS = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

/** What may be put on the board from the palette — a king being there already, and the one of him there can be. */
export type BoardEditorPiece = { type: Exclude<PieceSymbol, "k">; color: Color };

/** A board read whatever it holds: the editor shows positions no game could reach. */
function boardOf(fen: string): Chess | null {
  const board = new Chess();
  try {
    board.load(fen, { skipValidation: true });
  } catch {
    return null;
  }
  return board;
}

/** The editor's position from a board's pieces and the side to move: nothing else said. */
function written(board: Chess, turn: Color): string {
  return `${board.fen().split(" ")[0]} ${turn} - - 0 1`;
}

/** Whose move the editor's position is. */
export function turnOf(fen: string): Color {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

/** The same pieces with the other side to move — or the side given. */
export function withTurn(fen: string, turn: Color = turnOf(fen) === "w" ? "b" : "w"): string {
  const board = boardOf(fen);
  return board === null ? fen : written(board, turn);
}

/** Any position, as the editor holds one: its pieces and its side to move, and nothing else. */
export function asBoardEditorPosition(fen: string): string | null {
  const board = boardOf(fen);
  return board === null ? null : written(board, turnOf(fen));
}

const onEdge = (square: Square) => square[1] === "1" || square[1] === "8";

/**
 * `piece` put on `square`, over whatever stood there — or, with `piece` null,
 * whatever stood there taken off. Null where it may not be: over a king, or a
 * pawn on the first or last rank.
 */
export function place(fen: string, square: Square, piece: BoardEditorPiece | null): string | null {
  const board = boardOf(fen);
  if (board === null || board.get(square)?.type === "k") {
    return null;
  }
  if (piece !== null && piece.type === "p" && onEdge(square)) {
    return null;
  }
  board.remove(square);
  if (piece !== null && !board.put(piece, square)) {
    return null;
  }
  return written(board, turnOf(fen));
}

/**
 * The piece on `from` put on `to`, over whatever stood there — or, with `to`
 * null, taken off the board. Null where it may not be: a king taken off, a
 * piece put over a king, a pawn put on the first or last rank.
 */
export function shift(fen: string, from: Square, to: Square | null): string | null {
  const board = boardOf(fen);
  const piece = board?.get(from);
  if (board === null || piece === undefined || piece === null || from === to) {
    return null;
  }
  if (to === null) {
    if (piece.type === "k") {
      return null;
    }
    board.remove(from);
    return written(board, turnOf(fen));
  }
  if (board.get(to)?.type === "k" || (piece.type === "p" && onEdge(to))) {
    return null;
  }
  board.remove(from);
  board.remove(to);
  if (!board.put(piece, to)) {
    return null;
  }
  return written(board, turnOf(fen));
}

const SIDES: Record<Color, string> = { w: "White", b: "Black" };

/**
 * What is wrong with a position as a position a game could reach, in words —
 * nothing, for one that could be played from. The editor lets every one of
 * these be set up, and shows them as the red of its signal.
 */
export function boardEditorProblems(fen: string): string[] {
  const board = boardOf(fen);
  if (board === null) {
    return ["The position cannot be read."];
  }
  const problems: string[] = [];
  const turn = turnOf(fen);
  const squares = board.board().flat().filter((cell) => cell !== null);
  for (const color of ["w", "b"] as Color[]) {
    const own = squares.filter((cell) => cell.color === color);
    const count = (type: PieceSymbol) => own.filter((cell) => cell.type === type).length;
    const kings = count("k");
    if (kings !== 1) {
      problems.push(`${SIDES[color]} has ${kings === 0 ? "no king" : `${kings} kings`}.`);
    }
    if (own.some((cell) => cell.type === "p" && onEdge(cell.square))) {
      problems.push(`${SIDES[color]} has a pawn on the first or last rank.`);
    }
    if (count("p") > 8) {
      problems.push(`${SIDES[color]} has more than eight pawns.`);
    }
    /* A piece beyond the ones a side starts with can only have come from a
       pawn, and every pawn can make one at most. */
    const promoted =
      Math.max(0, count("q") - 1) + Math.max(0, count("r") - 2) + Math.max(0, count("b") - 2) + Math.max(0, count("n") - 2);
    if (count("p") <= 8 && count("p") + promoted > 8) {
      problems.push(`${SIDES[color]} has more pieces than its pawns could have become.`);
    }
    if (own.length > 16) {
      problems.push(`${SIDES[color]} has more than sixteen men.`);
    }
  }
  /* The side that has just moved cannot be left in check: its king would be
     taken. Kings side by side are the same thing, said the way it is seen. */
  const waiting = turn === "w" ? "b" : "w";
  const king = squares.find((cell) => cell.type === "k" && cell.color === waiting);
  const mover = squares.find((cell) => cell.type === "k" && cell.color === turn);
  if (king !== undefined && mover !== undefined) {
    const apart = Math.max(
      Math.abs(king.square.charCodeAt(0) - mover.square.charCodeAt(0)),
      Math.abs(Number(king.square[1]) - Number(mover.square[1]))
    );
    if (apart <= 1) {
      problems.push("The two kings stand next to each other.");
    } else if (board.isAttacked(king.square, turn)) {
      problems.push(`${SIDES[waiting]} is in check, with ${SIDES[turn]} to move.`);
    }
  }
  return problems;
}
