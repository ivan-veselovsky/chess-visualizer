import { Chess, type Color, type Move, type Square } from "chess.js";
import type { Traveller } from "../visualization/flightPath";

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
 * The board as it looks while the move is being made: the position the move was
 * played from, exactly as it stands.
 *
 * Nothing is taken off it, the travelling piece included. A piece in the air is
 * not attacking anything — it has left one square and not yet reached the next
 * — but it is still *in the way*: the lines it was standing in stay shut until
 * it lands, and the piece it is about to take is still on its square. Lifting
 * it off the board opened those lines for the length of the journey, showing a
 * queen's file swept clear behind a pawn that was still in front of it — a
 * picture of the board that no move ever produces.
 *
 * So the piece stays, and what has to go is only what it does: its own rays,
 * its own share of the heatmap, its ring, and the glyph standing on its square,
 * which the flight draws instead. Those are the layers' business — each is told
 * which squares hold a piece that is in the air, and passes it over.
 *
 * See `attackersOn` for the same rule where the counting is chess.js's.
 */
export function boardDuring(before: string): Chess | null {
  try {
    /*
      The board itself, not its FEN.

      Castling puts two pieces in the air, one of them the king, and a position
      with no king is one chess.js will write out but refuse to read back —
      "Invalid FEN: missing white king". Going out through a FEN and in again
      therefore threw on every castle. Nothing needs the round trip: what the
      layers want is a board to look at, and this is one.
    */
    return new Chess(before);
  } catch {
    return null;
  }
}

/**
 * Who attacks `square` for `color`, less anyone in the air.
 *
 * chess.js counts attackers from the board, and the board still holds the
 * travelling piece — which is right for what it blocks and wrong for what it
 * covers. The difference is one filter, and it is written here rather than in
 * the layer so that the rule is stated once and can be checked.
 */
export function attackersOn(
  board: Chess,
  square: Square,
  color: Color,
  flying: readonly Square[] = []
): Square[] {
  const found = board.attackers(square, color);
  return flying.length === 0
    ? found
    : found.filter((from) => !flying.includes(from));
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
