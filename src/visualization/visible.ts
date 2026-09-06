/**
 * What is worth drawing at all.
 *
 * A side turned down to nothing is not a faint picture, it is no picture, and
 * the two are not the same to draw: one is every ray of sixteen pieces worked
 * out and painted at an opacity of zero, the other is nothing at all. These say
 * which case a setting is in, in one place, because the board asks in order to
 * skip the work and the layers ask in order not to do it.
 */
import type { SettingsSide } from "./geometry";
import type { AttackSettings, Heatmap } from "./settings";

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Whether a side's rays are worth drawing at all.
 *
 * Nought is not a faint mark, it is no mark — and a mark nobody can see is
 * still every ray of sixteen pieces worked out, built and painted. The reader's
 * fraction reaches the marks as a CSS variable precisely so that moving it does
 * not rebuild them, and that stays true across every value but this one: at the
 * end of the slider there is nothing left to restyle, so the cheaper thing is
 * to draw none of it. Coming back off nought rebuilds once, which is what
 * turning something back on costs.
 */
export function raysShown(attacks: AttackSettings, side: SettingsSide): boolean {
  return (
    clamp01(attacks.rayOpacity[side]) * clamp01(attacks.rayIntensity[side]) > 0
  );
}

/**
 * The same question of a side's wash: what one of its attackers lays down.
 *
 * Both numbers, because either of them at nought is the same picture — no
 * colour from that side — and the work saved is the same either way: counting
 * who attacks each of sixty-four squares, which is the expensive half of the
 * heatmap.
 */
export function heatmapShown(heatmap: Heatmap, side: SettingsSide): boolean {
  return clamp01(heatmap.strength[side]) * clamp01(heatmap.intensity[side]) > 0;
}
