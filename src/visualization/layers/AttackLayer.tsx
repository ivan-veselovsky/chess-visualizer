import { useId, type ComponentType } from "react";
import { reachSignature } from "../../chess/attacks";
import { useFading } from "../fading";
import type { Chess, PieceSymbol, Square } from "chess.js";
import type { PlacedPiece } from "../../chess/model";
import {
  SQUARE_SIZE,
  settingsSide,
  type Orientation,
  type SettingsSide,
} from "../geometry";
import type { AttackSettings } from "../settings";
import { raysShown } from "../visible";
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
  /** How long a piece's marks take to come and go, in milliseconds. */
  fadeTimeMs?: number;
  orientation?: Orientation;
}

/** Draws the squares each piece attacks, one renderer per piece kind. */
export default function AttackLayer({
  position,
  pieces,
  attackSettings,
  lifted = null,
  flying = [],
  fadeTimeMs = 0,
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

  /*
    The pieces whose marks are drawn, and the ones whose marks are on their way
    out — a piece that has moved, been taken, or been picked up. A departing
    piece's marks are drawn from the position as it stands now rather than as it
    stood then, which is not quite what it had; over a tenth of a second, on
    marks that are fading, the difference is not there to be seen.
  */
  /*
    Each piece together with the board it is drawn from — not the piece alone.

    A mark on its way out has to keep drawing what it drew: handed only the
    piece, a departing group read the position as it now stands and redrew
    itself in the new shape, so the old shape was never seen and the change was
    a jump after all. The board is held with it, and the old marks stay the old
    marks until they have faded.
  */
  const drawn = useFading(
    pieces
      .filter(
        (piece) => piece.square !== lifted && !flying.includes(piece.square)
      )
      /*
        And only the sides that are being drawn at all. A side at nought is
        left out here rather than painted invisibly: what follows is where the
        cost is — every square a piece reaches, and where each of its rays
        starts and stops — and none of it is worth doing for marks that will
        not be seen. Marks already up when a side is turned off are dropped
        from this list, which is how they come to fade rather than vanish.
      */
      .filter((piece) =>
        raysShown(attackSettings, settingsSide(piece.color, orientation))
      )
      .map((piece) => ({ piece, board: position })),
    /* What it draws, not merely which piece draws it: a rook whose line a move
       has just opened is drawing something else, and a mark that changes shape
       must count as a different mark or it will jump rather than cross. */
    ({ piece }) =>
      `${piece.square}-${piece.color}${piece.type}-${reachSignature(
        position,
        piece.square,
        piece.type
      )}`,
    fadeTimeMs
  );

  // One filter per side, each emitted only if that side's outline is wanted.
  const sides = (["me", "opponent"] as const).map((side) => ({
    side,
    id: `${idPrefix}-outline-${side}`,
    width: raysShown(attackSettings, side)
      ? Math.max(attackSettings.outlineWidths[side], 0) * SQUARE_SIZE
      : 0,
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

      {drawn.map(({ key, item: { piece, board }, leaving, props }) => {
        const Renderer = ATTACK_RENDERERS[piece.type];
        if (Renderer === undefined) {
          return null;
        }
        // Which settings this piece draws with: its end of the board, not its
        // colour, so flipping hands the near-side look to the other army.
        const side = settingsSide(piece.color, orientation);
        const outline = outlineFor(side);
        return (
          /*
            The fade is given a wrapper of its own rather than being put on the
            group below, whose opacity is already spoken for: that group is held
            at the reader's chosen strength by a rule of higher specificity, so a
            fade written there never applied at all and the marks simply vanished
            when their time was up. Wrapped, the two multiply — the fade takes
            the marks from whatever strength they are drawn at down to nothing.
          */
          <g key={key} className={leaving ? "mark-going" : "mark-coming"} {...props}>
          <g
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
                position={board}
                piece={piece}
                /*
                  Named after this mark, not after the piece drawing it.

                  A renderer defines clip paths of its own and refers to them by
                  id, and where two marks of one piece are on the board at once —
                  which is the whole of a crossing, the old shape going as the new
                  one comes — naming them after the piece gave both sets the same
                  ids. A duplicate id is not an error in SVG: every reference
                  simply resolves to whichever came first in the document, and the
                  one that came first was the mark on its way out. So the arriving
                  ray was clipped to the departing stub's extent — a bishop's newly
                  opened diagonal cut back to the one square it used to reach — and
                  sprang to its full length only when the old mark was finally
                  removed, a fade and a half after it should have been growing.
                  Nothing about it was visible in the opacities, which were exact
                  throughout; the ray was drawn faithfully and clipped away.

                  The key is what distinguishes marks that differ in shape, so it
                  is what the ids are built from.
                */
                idPrefix={`${idPrefix}-${key.replace(/[^A-Za-z0-9_-]/g, "_")}`}
                orientation={orientation}
                attackSettings={attackSettings}
                geometry={attackSettings.geometry[side]}
              />
            </g>
          </g>
          </g>
        );
      })}
    </g>
  );
}
