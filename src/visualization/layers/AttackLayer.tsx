import { useId, type ComponentType } from "react";
import type { Chess, PieceSymbol, Square } from "chess.js";
import type { PlacedPiece } from "../../chess/model";
import { MILLI_SQUARE, type Orientation } from "../geometry";
import type { AttackOptions } from "../options";
import BishopAttacks from "./attacks/BishopAttacks";
import KingAttacks from "./attacks/KingAttacks";
import KnightAttacks from "./attacks/KnightAttacks";
import PawnAttacks from "./attacks/PawnAttacks";
import QueenAttacks from "./attacks/QueenAttacks";
import RookAttacks from "./attacks/RookAttacks";
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
  b: BishopAttacks,
  r: RookAttacks,
  p: PawnAttacks,
};

interface AttackLayerProps {
  position: Chess;
  pieces: PlacedPiece[];
  attackOptions: AttackOptions;
  /**
   * Square whose piece is being dragged. Its marks are left out: the board is
   * being read to choose a move, and the moving piece's own reach only clutters
   * what it is about to be judged against.
   */
  lifted?: Square | null;
  orientation?: Orientation;
}

/** Draws the squares each piece attacks, one renderer per piece kind. */
export default function AttackLayer({
  position,
  pieces,
  attackOptions,
  lifted = null,
  orientation = "white",
}: AttackLayerProps) {
  // useId() yields ids like ":r0:"; the colons are awkward inside url(#...).
  const idPrefix = `attack-${useId().replace(/:/g, "")}`;
  const opacityFor = (color: "w" | "b") =>
    Math.min(
      Math.max(attackOptions.rayOpacity[color === "w" ? "white" : "black"], 0),
      1
    );

  // One filter per side, each emitted only if that side's outline is wanted.
  const sides = (["white", "black"] as const).map((side) => ({
    side,
    color: side === "white" ? ("w" as const) : ("b" as const),
    id: `${idPrefix}-outline-${side}`,
    width: Math.max(attackOptions.outlineWidths[side], 0) * MILLI_SQUARE,
  }));
  const outlineFor = (color: "w" | "b") =>
    sides.find((entry) => entry.color === color && entry.width > 0);

  return (
    <g className="attack-layer">
      {/*
        Outlines each side's marks. It has to be a filter rather than a second,
        wider stroke underneath: the marks are strokes themselves, and their
        ends are cut by clip paths, so an underlay would be cut in the same
        place and leave every point and notch unoutlined. A filter runs on the
        result of rendering its content — clipping included — so it can trace
        the silhouette the clips actually produced.

        Dilating the alpha and subtracting the original leaves just the ring.
        That subtraction only comes out clean while the content is still
        opaque, which is why the transparency is applied outside the filter
        rather than inside each renderer.
      */}
      {sides
        .filter((entry) => entry.width > 0)
        .map((entry) => (
          <filter
            key={entry.side}
            id={entry.id}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius={entry.width}
              result="dilated"
            />
            <feComposite
              in="dilated"
              in2="SourceAlpha"
              operator="out"
              result="ring"
            />
            <feFlood
              className={`attack-outline-ink-${entry.side}`}
              result="ink"
            />
            <feComposite in="ink" in2="ring" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}

      {pieces.map((piece) => {
        const Renderer = ATTACK_RENDERERS[piece.type];
        if (Renderer === undefined || piece.square === lifted) {
          return null;
        }
        const outline = outlineFor(piece.color);
        return (
          <g key={piece.square} opacity={opacityFor(piece.color)}>
            <g filter={outline ? `url(#${outline.id})` : undefined}>
              <Renderer
                position={position}
                piece={piece}
                idPrefix={`${idPrefix}-${piece.square}`}
                orientation={orientation}
                attackOptions={attackOptions}
                geometry={
                  attackOptions.geometry[
                    piece.color === "w" ? "white" : "black"
                  ]
                }
              />
            </g>
          </g>
        );
      })}
    </g>
  );
}
