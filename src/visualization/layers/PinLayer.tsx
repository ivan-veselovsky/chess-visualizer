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
  /** Squares whose piece is in the air, where a ring would hang over nothing.
      What such a piece pins is another matter: it is still standing in the
      line, so the ring on the piece it holds is still true. */
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
  const pinned = useMemo(() => new Set(pinnedSquares(position)), [position]);
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
      {rings.map(({ key, item: square, leaving }) => {
        const { x, y } = squareCenter(square, orientation);
        return (
          <circle
            key={key}
            cx={x}
            cy={y}
            r={radius}
            className={`pin-marker ${leaving ? "mark-going" : "mark-coming"}`}
          />
        );
      })}
    </g>
  );
}
