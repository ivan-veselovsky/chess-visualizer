import { useMemo } from "react";
import { Chess, type Color, type Square } from "chess.js";
import { mix, readRgb, toHex } from "../color";
import { FILES, RANKS, squareBox, type Orientation } from "../geometry";
import type { SquareShading } from "../settings";

interface SquareShadingLayerProps {
  position: Chess;
  shading: SquareShading;
  /** A piece picked up and not yet put down, which is not on the board. */
  lifted?: Square | null;
  orientation?: Orientation;
}

/**
 * Every square, coloured by who attacks it and how often.
 *
 * A square nobody attacks keeps the board's own colour. One that both sides
 * attack takes a blend of the two, weighted by how many attackers each has —
 * three of mine against two of theirs leans my way without hiding theirs. The
 * two are mixed as two lights falling on one square would mix rather than as
 * two paints stirred together; `mix` has the reason.
 *
 * Either side can be shown without the other, which is what the two settings
 * are for. A side that is not shown is not counted either: with mine alone on,
 * a square reads as how many of my men cover it, and whether the other end of
 * the board is looking at it too makes no difference to what is drawn.
 *
 * How strongly it shows follows the total. Each further attacker adds a share
 * of what is left rather than a fixed step, so the difference between one
 * attacker and two is plain while five and six still differ a little and
 * nothing ever reaches full opacity. That keeps the board readable underneath,
 * which is the point of shading it rather than painting it.
 *
 * Every attacker counts the same, pawn and queen alike. Weighing them by value
 * is a truer picture of a position and a worse picture of *this* — the thing
 * being shown here is how many eyes are on a square.
 */
export default function SquareShadingLayer({
  position,
  shading,
  lifted = null,
  orientation = "white",
}: SquareShadingLayerProps) {
  const mine: Color = orientation === "black" ? "b" : "w";
  const theirs: Color = mine === "w" ? "b" : "w";

  /*
    Counted once per position rather than per render: this asks chess.js about
    every square twice over, and the board is redrawn for reasons that have
    nothing to do with what attacks what. Both sides are counted whichever are
    shown, so that turning one on does not recount the other.
  */
  const squares = useMemo(() => {
    /*
      A piece being carried is counted out, as its rays are: the board is being
      read to decide where to put it down, and what it covers from the square it
      has left is the wrong answer to that question. Lifting it also opens the
      lines it was standing in, which is the other half of what the reader wants
      to see.
    */
    const board =
      lifted === null || position.get(lifted) === undefined
        ? position
        : (() => {
            const without = new Chess(position.fen());
            without.remove(lifted);
            return without;
          })();
    const found: { square: Square; mine: number; theirs: number }[] = [];
    for (const file of FILES) {
      for (const rank of RANKS) {
        const square = `${file}${rank}` as Square;
        const ours = board.attackers(square, mine).length;
        const others = board.attackers(square, theirs).length;
        if (ours > 0 || others > 0) {
          found.push({ square, mine: ours, theirs: others });
        }
      }
    }
    return found;
  }, [position, lifted, mine, theirs]);

  const strength = Math.min(Math.max(shading.strength, 0), 1);
  if (strength === 0 || (!shading.showMine && !shading.showOpponent)) {
    return null;
  }
  const ours = readRgb(shading.me);
  const others = readRgb(shading.opponent);

  const shown = squares
    .map(({ square, mine: ourCount, theirs: theirCount }) => ({
      square,
      mine: shading.showMine ? ourCount : 0,
      theirs: shading.showOpponent ? theirCount : 0,
    }))
    .filter(({ mine: ourCount, theirs: theirCount }) => ourCount + theirCount > 0);

  return (
    <g className="square-shading-layer">
      {shown.map(({ square, mine: ourCount, theirs: theirCount }) => {
        const total = ourCount + theirCount;
        const color = toHex(mix(ours, others, ourCount / total));
        // Each attacker takes a share of what transparency is left, so the
        // shading deepens without ever closing over the square underneath.
        const opacity = 1 - (1 - strength) ** total;
        return (
          <rect
            key={square}
            {...squareBox(square, orientation)}
            fill={color}
            fillOpacity={opacity}
            className="square-shading"
          />
        );
      })}
    </g>
  );
}
