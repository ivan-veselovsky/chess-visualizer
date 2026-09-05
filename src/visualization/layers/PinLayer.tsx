import { useMemo } from "react";
import type { Chess, Square } from "chess.js";
import { pinnedSquares } from "../../chess/pins";
import { useFading } from "../fading";
import { readPieces } from "../../chess/model";
import { SQUARE_SIZE, squareCenter, type Orientation } from "../geometry";
import type { AttackSettings } from "../settings";

interface PinLayerProps {
  position: Chess;
  attackSettings: AttackSettings;
  /** Square whose piece is being dragged; its ring would hang in mid-air. */
  lifted?: Square | null;
  /** How long a ring takes to come and go, in milliseconds. */
  fadeTimeMs?: number;
  /** Squares whose piece is in the air. No ring is drawn on such a piece, where
      it would hang over nothing — and none is drawn for one either: a piece in
      the air attacks nothing, so whatever it was pinning is let go for as long
      as the journey lasts. It goes on blocking the line all the same, which is
      a different thing and is why it is still on the board. */
  flying?: Square[];
  orientation?: Orientation;
}

/**
 * A ring around each piece that cannot move off the line it stands on without
 * exposing its own king.
 *
 * Its size is its own setting rather than one borrowed from the ray geometry:
 * the ring has to stand clear of the piece it marks, which is a different job
 * from bounding where a ray starts, and the two sit badly at one size.
 */
export default function PinLayer({
  position,
  attackSettings,
  lifted = null,
  flying = [],
  fadeTimeMs = 0,
  orientation = "white",
}: PinLayerProps) {
  /* The pieces that are not attacking just now, as one string, because that is
     what a list of squares can be remembered by from one render to the next. */
  const idle = [lifted, ...flying].filter((square) => square !== null).join(" ");
  const pinned = useMemo(
    () =>
      new Set(
        pinnedSquares(position, idle === "" ? [] : (idle.split(" ") as Square[]))
      ),
    [position, idle]
  );
  const radius = (Math.max(attackSettings.pins.ringDiameter, 0) * SQUARE_SIZE) / 2;
  const rings = useFading(
    radius === 0
      ? []
      : readPieces(position)
          .filter(
            (piece) =>
              pinned.has(piece.square) &&
              piece.square !== lifted &&
              !flying.includes(piece.square)
          )
          .map((piece) => piece.square),
    (square) => square,
    fadeTimeMs
  );
  if (rings.length === 0) {
    return null;
  }

  return (
    <g className="pin-layer">
      {rings.map(({ key, item: square, leaving, props }) => {
        const { x, y } = squareCenter(square, orientation);
        return (
          <circle
            key={key}
            cx={x}
            cy={y}
            r={radius}
            className={`pin-marker ${leaving ? "mark-going" : "mark-coming"}`}
            {...props}
          />
        );
      })}
    </g>
  );
}
