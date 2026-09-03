import { useId, type ComponentType } from "react";
import type { Chess, PieceSymbol, Square } from "chess.js";
import type { PlacedPiece } from "../../chess/model";
import {
  SQUARE_SIZE,
  settingsSide,
  type Orientation,
  type SettingsSide,
} from "../geometry";
import type { AttackSettings } from "../settings";
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
  attackSettings: AttackSettings;
  /**
   * Square whose piece is in hand — dragged, or picked out by a click. Its
   * marks are left out either way: the board is being read to choose a move,
   * and the moving piece's own reach only clutters what it is about to be
   * judged against.
   */
  lifted?: Square | null;
  /**
   * Squares whose piece is in the air. Its marks are left out as a lifted
   * piece's are — but it is still on the board given above, so every ray that
   * ran into it still stops there. That is the whole difference between a piece
   * being carried and a piece in mid-move: one has left the board, the other
   * has only left its square.
   */
  flying?: Square[];
  orientation?: Orientation;
}

/** Draws the squares each piece attacks, one renderer per piece kind. */
export default function AttackLayer({
  position,
  pieces,
  attackSettings,
  lifted = null,
  flying = [],
  orientation = "white",
}: AttackLayerProps) {
  // useId() yields ids like ":r0:"; the colons are awkward inside url(#...).
  const idPrefix = `attack-${useId().replace(/:/g, "")}`;
  const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
  /*
    The configured opacity alone. The fraction the reader has asked for is not
    applied here at all: it reaches the marks as a CSS variable published by the
    board, so that turning it up and down never invalidates any of this.

    That matters because everything below is derived from the position — which
    squares each piece reaches, where every ray starts and stops — and working
    that out for thirty-two pieces takes several frames. Kept out of the render,
    the fraction costs a style recalculation instead, and the geometry is
    computed once per position rather than once per pointer move.
  */
  const opacityFor = (side: SettingsSide) =>
    clamp(attackSettings.rayOpacity[side]);

  // One filter per side, each emitted only if that side's outline is wanted.
  const sides = (["me", "opponent"] as const).map((side) => ({
    side,
    id: `${idPrefix}-outline-${side}`,
    width: Math.max(attackSettings.outlineWidths[side], 0) * SQUARE_SIZE,
  }));
  const outlineFor = (side: SettingsSide) =>
    sides.find((entry) => entry.side === side && entry.width > 0);

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
        opaque, which is why the transparency is applied here and not inside
        each renderer.

        Both transparencies are applied here, and separately: the outline's by
        fading the ink it is flooded with, the marks' by scaling the alpha of
        the rendered result. A single opacity on the group outside would scale
        whatever the filter produced, outline and marks together, which is
        exactly what they are meant to be free of. Each is still applied once,
        to the whole composited thing, so marks of one piece that overlap stay
        the one flat shade.
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
              floodOpacity={clamp(attackSettings.outlineOpacity[entry.side])}
              result="ink"
            />
            <feComposite in="ink" in2="ring" operator="in" result="outline" />
            <feComponentTransfer in="SourceGraphic" result="marks">
              <feFuncA type="linear" slope={opacityFor(entry.side)} />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="marks" />
            </feMerge>
          </filter>
        ))}

      {pieces.map((piece) => {
        const Renderer = ATTACK_RENDERERS[piece.type];
        if (
          Renderer === undefined ||
          piece.square === lifted ||
          flying.includes(piece.square)
        ) {
          return null;
        }
        // Which settings this piece draws with: its end of the board, not its
        // colour, so flipping hands the near-side look to the other army.
        const side = settingsSide(piece.color, orientation);
        const outline = outlineFor(side);
        return (
          <g
            key={piece.square}
            /*
              Marked as outlined where a filter runs, because the filter has
              already applied both transparencies and the stylesheet must not
              scale them again. That path keeps its opacity as an attribute, and
              so is still redrawn when the reader's fraction changes; the plain
              path, which is what every preset uses, is not.
            */
            className={`attack-side-${side}${outline ? " attack-outlined" : ""}`}
          >
            <g filter={outline ? `url(#${outline.id})` : undefined}>
              <Renderer
                position={position}
                piece={piece}
                idPrefix={`${idPrefix}-${piece.square}`}
                orientation={orientation}
                attackSettings={attackSettings}
                geometry={attackSettings.geometry[side]}
              />
            </g>
          </g>
        );
      })}
    </g>
  );
}
