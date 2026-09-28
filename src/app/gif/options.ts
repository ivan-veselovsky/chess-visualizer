/*
  Written with their extensions, like the other modules `tests/unit.mjs` runs
  straight from the TypeScript.
*/
import type { FrameStore } from "./encoder.ts";
import { FRAME_STEPS, SCALES, type FrameStep, type Scale } from "./timing.ts";

/**
 * How an animated GIF is made, as opposed to what goes in it.
 *
 * Kept beside the settings rather than in them, as two board mode is: what goes
 * into the GIF is the board exactly as it is set up — its colours, its marks,
 * its pace — and all of that is already a setting. These say only how the
 * frames are written down, which is nothing to do with how a board is drawn and
 * should not change with the preset in use.
 */
export interface GifOptions {
  /** Hundredths of a second a frame of a move lasts; see `FRAME_STEPS`. */
  step: FrameStep;
  scale: Scale;
  store: FrameStore;
  /**
   * How long the last position stays up before the GIF starts again, in
   * seconds. The board never has to say — a game that has played to its end
   * simply stops — so it is asked here.
   */
  lastHoldSec: number;
}

export const DEFAULT_GIF_OPTIONS: GifOptions = {
  /* The smoothest a GIF plays: fifty frames a second, each two hundredths. */
  step: 2,
  scale: 2,
  store: "changed",
  lastHoldSec: 3,
};

const KEY = "cv.gif-export";

/** What this browser last used, with anything unreadable put back to the default. */
export function loadGifOptions(): GifOptions {
  let stored: Partial<GifOptions> = {};
  try {
    stored = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    stored = {};
  }
  return {
    step: (FRAME_STEPS as readonly number[]).includes(stored.step as number)
      ? (stored.step as FrameStep)
      : DEFAULT_GIF_OPTIONS.step,
    scale: (SCALES as readonly number[]).includes(stored.scale as number)
      ? (stored.scale as Scale)
      : DEFAULT_GIF_OPTIONS.scale,
    store: stored.store === "full" || stored.store === "changed" ? stored.store : DEFAULT_GIF_OPTIONS.store,
    lastHoldSec:
      typeof stored.lastHoldSec === "number" && stored.lastHoldSec >= 0
        ? stored.lastHoldSec
        : DEFAULT_GIF_OPTIONS.lastHoldSec,
  };
}

export function saveGifOptions(options: GifOptions): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(options));
  } catch {
    /* A browser refusing storage still exports; it just starts from the
       defaults next time. */
  }
}
