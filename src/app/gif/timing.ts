/**
 * The frame rates a GIF can keep exactly, as the hundredths of a second each
 * frame of a move lasts.
 *
 * A GIF times its frames in hundredths, so the rates it can hold to are a
 * hundred divided by a whole number — 50, 33⅓, 25, 20 and down. Anything in
 * between comes out as the nearest of these, and plays that much fast or slow.
 * Two hundredths is the floor: browsers play anything shorter as ten, which is
 * slower rather than faster.
 */
export const FRAME_STEPS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type FrameStep = (typeof FRAME_STEPS)[number];

/** "25 fps (40 ms a frame)", and the like. */
export function frameStepLabel(step: FrameStep): string {
  const fps = 100 / step;
  const shown = Number.isInteger(fps) ? String(fps) : fps.toFixed(1);
  return `${shown} fps (${step * 10} ms a frame)`;
}

/**
 * The sizes a GIF can be made at, as multiples of a board's own drawing — 536
 * units across, coordinates included — so that the size does not depend on
 * how big the window happened to be.
 */
export const SCALES = [1, 1.5, 2, 3] as const;
export type Scale = (typeof SCALES)[number];
export const BOARD_UNITS = 536;

export function scaleLabel(scale: Scale): string {
  return `${scale}× — ${Math.round(BOARD_UNITS * scale)} px a board`;
}

/**
 * How long a position rests after its move, in milliseconds: what is left of
 * the period once the fade inside it has been shown.
 *
 * The period is counted as the board counts it, from the moment the piece
 * lands, and the fade runs inside it rather than after it — so a GIF of a game
 * keeps the pace the game plays at on the board. A fade longer than the period
 * is shown whole, since a move started halfway through the last one's fade is
 * something the board can do and a sequence of frames cannot.
 */
export function restAfterFade(periodMs: number, fadeShownMs: number, stepMs: number): number {
  return Math.max(periodMs - fadeShownMs, stepMs);
}

/** How many frames it takes to show `ms` of movement, a frame every `stepMs`. */
export function framesFor(ms: number, stepMs: number): number {
  return ms <= 0 ? 0 : Math.ceil(ms / stepMs);
}
