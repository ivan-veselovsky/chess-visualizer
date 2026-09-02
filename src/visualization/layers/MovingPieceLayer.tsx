import { useEffect, useRef } from "react";
import type { Color, PieceSymbol, Square } from "chess.js";
import { PIECE_GLYPHS } from "../../chess/model";
import {
  SQUARE_SIZE,
  settingsSide,
  squareCenter,
  type Orientation,
} from "../geometry";

/** One glyph on its way from one square to another. */
export interface Traveller {
  type: PieceSymbol;
  color: Color;
  from: Square;
  to: Square;
}

/** A move in flight: what is travelling, and how long it has. */
export interface Flight {
  travellers: Traveller[];
  ms: number;
}

/**
 * How far along the journey the piece is, as a fraction, after a fraction of
 * the time.
 *
 * The speed follows a half sine — nothing at the start, most in the middle,
 * nothing at the end:
 *
 *   v(t) = v0 · sin(pi · t / T)
 *
 * which integrates to this. `v0` is then exactly the speed at the middle of the
 * journey, and the distance covered comes to `L` at `t = T` when `T` is chosen
 * as `flightTime` chooses it.
 */
export function travelled(fraction: number): number {
  return (1 - Math.cos(Math.PI * fraction)) / 2;
}

/**
 * How long a move takes at a given speed.
 *
 * From the same profile: the average speed of a half sine is `2/pi` of its
 * peak, so covering `L` squares at a peak of `v0` takes `pi·L / (2·v0)`. A move
 * therefore takes about half as long again as it would at a constant `v0`,
 * which is the price of starting and stopping gently.
 *
 * Unclamped on purpose. A speed of a tenth of a square a second is a legitimate
 * thing to ask for — it is how the order of everything else is watched — and a
 * ceiling would quietly refuse it.
 */
export function flightTime(squares: number, speed: number): number {
  if (speed <= 0 || squares <= 0) {
    return 0;
  }
  return (Math.PI * squares) / (2 * speed) * 1000;
}

/** The distance between two squares, in squares. */
export function squaresApart(
  from: Square,
  to: Square,
  orientation: Orientation
): number {
  const a = squareCenter(from, orientation);
  const b = squareCenter(to, orientation);
  return Math.hypot(b.x - a.x, b.y - a.y) / SQUARE_SIZE;
}

/** How finely the sine is sampled for the browser to move between. */
const STEPS = 32;

interface MovingPieceLayerProps {
  flight: Flight;
  orientation?: Orientation;
}

/**
 * The travelling glyphs, drawn above the board while a move plays out.
 *
 * The path is handed over as a list of places along it rather than as an
 * easing: the profile is a sine, and no cubic curve is one. Sampled finely and
 * walked between in straight lines, the difference is far below what an eye
 * following a chess piece can see.
 */
export default function MovingPieceLayer({
  flight,
  orientation = "white",
}: MovingPieceLayerProps) {
  const glyphs = useRef<(SVGTextElement | null)[]>([]);

  useEffect(() => {
    const running = glyphs.current.map((glyph, index) => {
      const piece = flight.travellers[index];
      if (glyph === null || piece === undefined) {
        return null;
      }
      const start = squareCenter(piece.from, orientation);
      const end = squareCenter(piece.to, orientation);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const frames = Array.from({ length: STEPS + 1 }, (_, step) => {
        const at = travelled(step / STEPS);
        return {
          offset: step / STEPS,
          transform: `translate(${dx * at}px, ${dy * at}px)`,
        };
      });
      return glyph.animate(frames, {
        duration: flight.ms,
        easing: "linear",
        // Held at the end: the layer goes away when the piece lands, and one
        // frame of it back at its old square would be worse than no move.
        fill: "forwards",
      });
    });
    return () => running.forEach((animation) => animation?.cancel());
  }, [flight, orientation]);

  return (
    <g className="moving-piece-layer">
      {flight.travellers.map((piece, index) => {
        const start = squareCenter(piece.from, orientation);
        return (
          <text
            key={`${piece.from}-${piece.to}`}
            ref={(glyph) => {
              glyphs.current[index] = glyph;
            }}
            x={start.x}
            y={start.y}
            className={[
              "piece",
              "piece-moving",
              `piece-${piece.type}`,
              piece.color === "w" ? "piece-white" : "piece-black",
              `piece-${settingsSide(piece.color, orientation)}`,
            ].join(" ")}
          >
            {PIECE_GLYPHS[piece.type]}
          </text>
        );
      })}
    </g>
  );
}
