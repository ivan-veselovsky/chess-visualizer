import type { Chess } from "chess.js";
import type { PlacedPiece } from "../../../chess/model";
import type { Orientation } from "../../geometry";
import type { AttackGeometry, RaySettings } from "../../settings";

/**
 * What every per-piece attack renderer receives. Keeping one shared shape lets
 * AttackLayer dispatch on piece type through a plain lookup table.
 */
export interface PieceAttackProps {
  /** Needed by pieces whose attacks depend on what else is on the board. */
  position: Chess;
  piece: PlacedPiece;
  /** Unique within the document; prefix for any clip-path ids the renderer makes. */
  idPrefix: string;
  orientation: Orientation;
  /** How the rays are drawn: the settings shared by both sides. */
  rays: RaySettings;
  /** The shapes for this piece's side, already picked out of the settings. */
  geometry: AttackGeometry;
}
