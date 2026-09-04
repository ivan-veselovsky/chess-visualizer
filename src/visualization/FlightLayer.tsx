import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { PIECE_GLYPHS } from "../chess/model";
import {
  BOARD_ORIGIN,
  CANVAS_SIZE,
  SQUARE_SIZE,
  settingsSide,
  squareCenter,
  type Orientation,
} from "./geometry";
import { STEPS, travelled, type Flight } from "./flightPath";

interface FlightLayerProps {
  flight: Flight;
  orientation?: Orientation;
  /**
   * Said when every travelling piece has arrived.
   *
   * The journey is what decides this, not a clock beside it. An animation does
   * not begin the moment it is created — it waits for the browser to commit it,
   * and the commit waits on whatever the main thread is doing, which at the
   * start of a move is a rebuild of every mark on the board. Timed separately,
   * the board went back to drawing the piece on its square while the piece was
   * still four fifths of the way there, and the last of the journey was thrown
   * away as a jump.
   */
  onLanded?: () => void;
  /**
   * The board's own colour variables. The layer stands outside the board's
   * `<svg>`, so it does not inherit them and is handed the same set.
   */
  vars?: CSSProperties;
}

/**
 * The travelling glyphs, drawn over the board while a move plays out.
 *
 * Ordinary elements over the board rather than glyphs inside it, and that is
 * the whole point of them. A transform animation runs on the compositor —
 * rasterised once, then moved by the GPU each frame — but only for an element
 * the browser can give a layer of its own, and it never gives one to anything
 * inside an `<svg>`. Drawn in there, the piece was moved by the main thread,
 * which is the same thread that rebuilds every ray and wash on the board at the
 * start of each move: measured, that rebuild is a 55ms task, and the piece
 * stopped dead for three frames of every journey while it ran. Out here the
 * piece keeps moving through it.
 *
 * Two rules follow from that and are worth keeping:
 *
 *   - only `transform` is animated. Animating `left`/`top` would put the
 *     journey back on the main thread by way of layout, which is worse than
 *     where it started.
 *   - the keyframes are plain pixel translations, worked out here rather than
 *     handed over as an easing function, because the compositor can only run
 *     what it can interpolate itself.
 *
 * Everything not animated is sized in container units against the board's own
 * width, so the layer needs no measuring to line up with the squares and stays
 * lined up when the board is resized.
 */
export default function FlightLayer({
  flight,
  orientation = "white",
  onLanded,
  vars,
}: FlightLayerProps) {
  const layer = useRef<HTMLDivElement>(null);
  const glyphs = useRef<(HTMLSpanElement | null)[]>([]);
  /* Held in a box rather than taken as a dependency: it is a fresh function on
     every render of the board, and the journey must not start again for that. */
  const land = useRef(onLanded);
  land.current = onLanded;

  /*
    Before the browser paints, not after: the piece is put in the air by the
    same frame that takes it off its square, and an ordinary effect would let
    the board show once with the piece missing from both.

    The distance is in pixels, so it is measured — the one measurement here.
    A board resized mid-flight would carry a piece to where the square used to
    be, which lasts as long as the move does and is not worth a resize
    observer.
  */
  useLayoutEffect(() => {
    const box = layer.current?.getBoundingClientRect();
    if (box === undefined || box.width === 0) {
      return;
    }
    const scale = box.width / CANVAS_SIZE;
    const running = glyphs.current.map((glyph, index) => {
      const piece = flight.travellers[index];
      if (glyph === null || piece === undefined) {
        return null;
      }
      const from = squareCenter(piece.from, orientation);
      const to = squareCenter(piece.to, orientation);
      const dx = (to.x - from.x) * scale;
      const dy = (to.y - from.y) * scale;
      const frames = Array.from({ length: STEPS + 1 }, (_, step) => {
        const at = travelled(step / STEPS);
        return {
          offset: step / STEPS,
          // `translate3d` rather than `translate`: both composite, but this one
          // says so outright and cannot be read as anything else.
          transform: `translate3d(${dx * at}px, ${dy * at}px, 0)`,
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
    /* When the last of them arrives. A cancelled journey rejects instead — the
       move was interrupted, and whoever interrupted it says what to draw. */
    Promise.all(running.flatMap((animation) => (animation ? [animation.finished] : [])))
      .then(() => land.current?.())
      .catch(() => undefined);
    return () => running.forEach((animation) => animation?.cancel());
  }, [flight, orientation]);

  return (
    <div className="flight-layer" ref={layer} style={vars} aria-hidden="true">
      {flight.travellers.map((piece, index) => {
        const start = squareCenter(piece.from, orientation);
        /* Board coordinates leave out the margin the coordinates are written
           in; inside the `<svg>` a translated group puts it back, and out here
           nothing does, so it is added by hand. */
        const place = (middle: number, origin: number) =>
          `${((origin + middle - SQUARE_SIZE / 2) / CANVAS_SIZE) * 100}%`;
        return (
          <span
            key={`${piece.from}-${piece.to}`}
            ref={(glyph) => {
              glyphs.current[index] = glyph;
            }}
            className={[
              "flying-piece",
              // Kept from the days when this was drawn inside the board: the
              // stylesheet tints a piece from these two, and both work on an
              // ordinary element as well as on a glyph in the board.
              "piece-moving",
              `piece-${piece.type}`,
              piece.color === "w" ? "piece-white" : "piece-black",
              `piece-${settingsSide(piece.color, orientation)}`,
            ].join(" ")}
            style={{
              left: place(start.x, BOARD_ORIGIN.x),
              top: place(start.y, BOARD_ORIGIN.y),
            }}
          >
            {PIECE_GLYPHS[piece.type]}
          </span>
        );
      })}
    </div>
  );
}
