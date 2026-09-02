import { Chess, type Move, type Square } from "chess.js";
import type { Traveller } from "../visualization/layers/MovingPieceLayer";

/**
 * The pieces a move sets in motion, and the squares they are arriving on.
 *
 * Most moves send one piece. Castling sends two, and they travel together —
 * chess.js reports it as the king's move alone, so the rook is worked out from
 * which side the king went.
 *
 * A capture sends only the taker. The piece being taken stays where it is for
 * the whole journey and goes when the taker lands on it, which is what makes
 * the arrival read as a capture rather than as a square that emptied by itself.
 * Nothing here has to name it: it is simply still on the board that the flight
 * is drawn from, and gone from the one that follows.
 */
export function travellersOf(move: Move): { travellers: Traveller[] } {
  const moved: Traveller = {
    // A promoting pawn travels as a pawn and arrives as a queen: it is a pawn
    // for the whole of the journey, and only the last rank changes it.
    type: move.piece,
    color: move.color,
    from: move.from,
    to: move.to,
  };
  const travellers = [moved];
  const rank = move.color === "w" ? "1" : "8";
  if (move.flags.includes("k")) {
    travellers.push({
      type: "r",
      color: move.color,
      from: `h${rank}` as Square,
      to: `f${rank}` as Square,
    });
  }
  if (move.flags.includes("q")) {
    travellers.push({
      type: "r",
      color: move.color,
      from: `a${rank}` as Square,
      to: `d${rank}` as Square,
    });
  }
  return { travellers };
}

/**
 * The board as it looks while the move is being made: everything as it was,
 * less whatever is in the air.
 *
 * This is what makes the order of things readable. The moving piece is off the
 * board for the length of its journey, so its rays and its share of the heatmap
 * go with it and come back at the other end; the piece being taken stays until
 * the taker reaches it, because it is still there until then.
 */
export function boardDuring(
  before: string,
  travellers: Traveller[],
  without: Square[]
): Chess | null {
  try {
    const board = new Chess(before);
    for (const piece of travellers) {
      board.remove(piece.from);
    }
    for (const square of without) {
      board.remove(square);
    }
    /*
      The board itself, not its FEN.

      Castling puts two pieces in the air, one of them the king, and a position
      with no king is one chess.js will write out but refuse to read back —
      "Invalid FEN: missing white king". Going out through a FEN and in again
      therefore threw on every castle. Nothing needs the round trip: what the
      layers want is a board to look at, and this is one.
    */
    return board;
  } catch {
    return null;
  }
}

/**
 * The move that took the board from one position to the other, or null if the
 * two are not one move apart.
 *
 * Asked of the positions themselves rather than of what the app believes it
 * did: a move typed in, played by an opponent, or stepped forward through a
 * game all arrive by different routes, and all of them are the same thing to
 * look at. Anything further apart than a single move — a game loaded, a
 * position pasted, several moves stepped at once — has no journey to draw and
 * comes back null.
 */
export function moveBetween(before: string, after: string): Move | null {
  let board: Chess;
  try {
    board = new Chess(before);
  } catch {
    return null;
  }
  /*
    One board, played and taken back, rather than a fresh one per candidate.
    This runs before the browser is allowed to paint — the move has to be known
    in time to hold the piece back — and a position has thirty-odd legal moves,
    so a board apiece meant thirty-odd FEN parses standing between a click and
    the screen.
  */
  for (const candidate of board.moves({ verbose: true })) {
    board.move(candidate);
    const same = board.fen() === after;
    board.undo();
    if (same) {
      return candidate;
    }
  }
  return null;
}
