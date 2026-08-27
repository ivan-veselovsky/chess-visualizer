import type { CSSProperties } from "react";
import type { AttackOptions, PieceTint } from "./options";

/** A 0..1 fraction as a CSS percentage. */
function percent(fraction: number): string {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return `${Math.round(clamped * 1000) / 10}%`;
}

/**
 * What a piece glyph is tinted from, wherever one is drawn.
 *
 * The board publishes these on its own <svg> along with everything else it
 * colours; the bar of taken men publishes the same set on itself, so a man
 * lying beside the board is the colour it was standing on it. Keeping the pair
 * in one place is what makes that true by construction rather than by two lists
 * being kept in step.
 */
export function pieceVars(
  pieceTint: PieceTint,
  attacks: AttackOptions,
): CSSProperties {
  return {
    // One per piece per side. Which of each pair applies is decided by a class
    // on the glyph, so the rules that use them go on saying `var(--attack-king)`.
    "--attack-king-me": attacks.colors.me.king,
    "--attack-queen-me": attacks.colors.me.queen,
    "--attack-rook-me": attacks.colors.me.rook,
    "--attack-bishop-me": attacks.colors.me.bishop,
    "--attack-knight-me": attacks.colors.me.knight,
    "--attack-pawn-me": attacks.colors.me.pawn,
    "--attack-king-opponent": attacks.colors.opponent.king,
    "--attack-queen-opponent": attacks.colors.opponent.queen,
    "--attack-rook-opponent": attacks.colors.opponent.rook,
    "--attack-bishop-opponent": attacks.colors.opponent.bishop,
    "--attack-knight-opponent": attacks.colors.opponent.knight,
    "--attack-pawn-opponent": attacks.colors.opponent.pawn,
    // As percentages, which is what color-mix wants. Rounded, since a
    // fraction times 100 lands on things like 55.00000000000001.
    "--piece-lighten": percent(pieceTint.lightenWhite),
    "--piece-darken": percent(pieceTint.darkenBlack),
  } as CSSProperties;
}
