import type { Square } from "chess.js";
import { SQUARE_SIZE, squareCenter, type Orientation } from "../geometry";

/** A king worth pointing out, and which of the two things has happened to it. */
export interface KingAlert {
  square: Square;
  kind: "check" | "checkmate";
}

interface CheckLayerProps {
  /** Set when the side to move is in check, and it is being shown. */
  alert: KingAlert | null;
  /** Across, in square sides — the pin ring's, so the two marks agree. */
  diameter: number;
  /** Square whose piece is being dragged; its disc would sit under nothing. */
  lifted?: Square | null;
  orientation?: Orientation;
}

/**
 * A disc under the king that stands in check, or is mated.
 *
 * Drawn beneath the glyph rather than into it, so the king keeps its own
 * colour exactly — black stays black and white stays white — and only what
 * surrounds it changes. Nothing needs cutting out of the disc for that: the
 * glyph is opaque and covers its own share of it.
 */
export default function CheckLayer({
  alert,
  diameter,
  lifted = null,
  orientation = "white",
}: CheckLayerProps) {
  const radius = (Math.max(diameter, 0) * SQUARE_SIZE) / 2;
  if (alert === null || alert.square === lifted || radius === 0) {
    return null;
  }

  const { x, y } = squareCenter(alert.square, orientation);
  return (
    <g className="check-layer">
      <circle cx={x} cy={y} r={radius} className={`check-disc-${alert.kind}`} />
    </g>
  );
}
