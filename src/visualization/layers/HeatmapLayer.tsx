import { useMemo } from "react";
import type { Chess, Color, Square } from "chess.js";
import { attackersOn } from "../../chess/flight";
import { mix, readRgb, toHex } from "../color";
import { FILES, RANKS, squareBox, type Orientation } from "../geometry";
import type { Heatmap } from "../settings";

interface HeatmapLayerProps {
  position: Chess;
  heatmap: Heatmap;
  /** A piece picked up and not yet put down, which is not on the board. */
  lifted?: Square | null;
  /**
   * Squares whose piece is in the air. Unlike a lifted piece it is still on the
   * board — it goes on shutting the lines it stands in, and only stops counting
   * as an attacker of anything. A piece between two squares covers neither.
   */
  flying?: Square[];
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
 * which is the point of heatmap it rather than painting it.
 *
 * Every attacker counts the same, pawn and queen alike. Weighing them by value
 * is a truer picture of a position and a worse picture of *this* — the thing
 * being shown here is how many eyes are on a square.
 */
export default function HeatmapLayer({
  position,
  heatmap,
  lifted = null,
  flying = [],
  orientation = "white",
}: HeatmapLayerProps) {
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
      has left is the wrong answer to that question.

      Counted out, though, and not taken off. It was taken off here once, so
      that picking a piece up also opened the lines it stood in — which showed a
      board that no move produces: a queen's file swept clear behind a pawn that
      is still in front of it, and will still be in front of it wherever it goes
      down that file. A piece not yet put down is exactly a piece in the air:
      it attacks nothing, and shadows everything it shadowed before.
    */
    const silent = lifted === null ? flying : [...flying, lifted];
    const board = position;
    const found: { square: Square; mine: number; theirs: number }[] = [];
    for (const file of FILES) {
      for (const rank of RANKS) {
        const square = `${file}${rank}` as Square;
        const ours = attackersOn(board, square, mine, silent).length;
        const others = attackersOn(board, square, theirs, silent).length;
        if (ours > 0 || others > 0) {
          found.push({ square, mine: ours, theirs: others });
        }
      }
    }
    return found;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `flying` is
    // compared by its contents; a fresh array of the same squares is the same
    // board to count.
  }, [position, lifted, flying.join(), mine, theirs]);

  const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
  // What one attacker of each side lays down: that side's configured strength,
  // scaled by the share of it the reader has asked for.
  const ourStrength =
    clamp(heatmap.strength.me) * clamp(heatmap.intensity.me);
  const theirStrength =
    clamp(heatmap.strength.opponent) * clamp(heatmap.intensity.opponent);
  if (ourStrength === 0 && theirStrength === 0) {
    return null;
  }
  const ours = readRgb(heatmap.myColor);
  const others = readRgb(heatmap.opponentColor);

  /*
    How much colour a side lays on a square: each attacker takes the same share
    of whatever transparency the ones before it left, so the wash deepens
    towards opaque without ever reaching it.
  */
  const inkOf = (sideStrength: number, count: number) =>
    1 - (1 - sideStrength) ** count;

  const shown = squares
    .map(({ square, mine: ourCount, theirs: theirCount }) => ({
      square,
      ourInk: inkOf(ourStrength, ourCount),
      theirInk: inkOf(theirStrength, theirCount),
    }))
    .filter(({ ourInk, theirInk }) => ourInk + theirInk > 0);

  return (
    <g className="heatmap-layer">
      {shown.map(({ square, ourInk, theirInk }) => {
        /*
          The hue goes by how much colour each side actually lays down, not by
          how many attackers it has.

          By attacker count, a side's hue arrives at full weight the moment its
          strength leaves nought: a side laying down a hundredth of a wash would
          still claim half the colour of a square the two share. That is a step,
          not a slope — the square is one colour at nought and a blend at the
          least touch above it, so a chooser moved a hair off its corner throws
          the whole board into a mixture it never comes out of.

          By ink the two agree at the ends and pass smoothly between: a side
          laying down nothing takes none of the hue, and a side laying down
          twice as much as the other takes twice the share. Where the two are at
          the same strength this is what counting them gave, near enough.
        */
        const color = toHex(mix(ours, others, ourInk / (ourInk + theirInk)));
        /*
          The two washes laid over one another: what is left of the square after
          each has taken its share.
        */
        const opacity = 1 - (1 - ourInk) * (1 - theirInk);
        return (
          <rect
            key={square}
            {...squareBox(square, orientation)}
            fill={color}
            fillOpacity={opacity}
            className="heatmap-square"
          />
        );
      })}
    </g>
  );
}
