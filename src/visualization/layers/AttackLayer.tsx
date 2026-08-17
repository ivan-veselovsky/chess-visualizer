import { useId, type ComponentType } from "react";
import type { Chess, PieceSymbol } from "chess.js";
import type { PlacedPiece } from "../../chess/model";
import type { Orientation } from "../geometry";
import type { AttackOptions } from "../options";
import KingAttacks from "./attacks/KingAttacks";
import KnightAttacks from "./attacks/KnightAttacks";
import QueenAttacks from "./attacks/QueenAttacks";
import type { PieceAttackProps } from "./attacks/types";

/**
 * Which renderer draws which piece's attacks. Pieces with no entry are simply
 * not visualized yet; adding one is an import plus a line here.
 */
const ATTACK_RENDERERS: Partial<
  Record<PieceSymbol, ComponentType<PieceAttackProps>>
> = {
  k: KingAttacks,
  q: QueenAttacks,
  n: KnightAttacks,
};

interface AttackLayerProps {
  position: Chess;
  pieces: PlacedPiece[];
  attackOptions: AttackOptions;
  orientation?: Orientation;
}

/** Draws the squares each piece attacks, one renderer per piece kind. */
export default function AttackLayer({
  position,
  pieces,
  attackOptions,
  orientation = "white",
}: AttackLayerProps) {
  // useId() yields ids like ":r0:"; the colons are awkward inside url(#...).
  const idPrefix = `attack-${useId().replace(/:/g, "")}`;

  return (
    <g className="attack-layer">
      {pieces.map((piece) => {
        const Renderer = ATTACK_RENDERERS[piece.type];
        if (Renderer === undefined) {
          return null;
        }
        return (
          <Renderer
            key={piece.square}
            position={position}
            piece={piece}
            idPrefix={`${idPrefix}-${piece.square}`}
            orientation={orientation}
            attackOptions={attackOptions}
          />
        );
      })}
    </g>
  );
}
