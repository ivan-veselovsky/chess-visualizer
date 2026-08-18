import type { Chess } from "chess.js";
import type { PlacedPiece } from "../../../chess/model";
import type { Orientation } from "../../geometry";
import type { AttackOptions, PieceGeometry } from "../../options";

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
  /** User-tunable shape parameters shared by both sides. */
  attackOptions: AttackOptions;
  /** The shapes for this piece's side, already picked out of the options. */
  geometry: PieceGeometry;
}
