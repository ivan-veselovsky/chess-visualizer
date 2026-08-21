import { useMemo } from "react";
import type { Chess, Square } from "chess.js";
import { pinnedSquares } from "../../chess/pins";
import { readPieces } from "../../chess/model";
import { SQUARE_SIZE, squareCenter, type Orientation } from "../geometry";
import type { AttackOptions } from "../options";

interface PinLayerProps {
  position: Chess;
  attackOptions: AttackOptions;
  /** Square whose piece is being dragged; its ring would hang in mid-air. */
  lifted?: Square | null;
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
  attackOptions,
  lifted = null,
  orientation = "white",
}: PinLayerProps) {
  const pinned = useMemo(() => new Set(pinnedSquares(position)), [position]);
  const radius = (Math.max(attackOptions.pinRingDiameter, 0) * SQUARE_SIZE) / 2;
  if (pinned.size === 0 || radius === 0) {
    return null;
  }

  return (
    <g className="pin-layer">
      {readPieces(position)
        .filter((piece) => pinned.has(piece.square) && piece.square !== lifted)
        .map((piece) => {
          const { x, y } = squareCenter(piece.square, orientation);
          return (
            <circle
              key={piece.square}
              cx={x}
              cy={y}
              r={radius}
              className="pin-marker"
            />
          );
        })}
    </g>
  );
}
