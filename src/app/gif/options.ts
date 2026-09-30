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
 * its pace, down to how long the end of each line is held — and all of that is
 * already a setting. These say only how the frames are written down, which is
 * nothing to do with how a board is drawn and should not change with the preset
 * in use.
 */
/** What the frames go into: an animated GIF, or an MP4 video. */
export type ExportFormat = "gif" | "mp4";

/** The frame rates a video is offered at: the usual ones, from film's to a monitor's. */
export const VIDEO_RATES = [25, 30, 50, 60] as const;
export type VideoRate = (typeof VIDEO_RATES)[number];

export const VIDEO_QUALITIES = ["medium", "high", "very-high"] as const;
export type VideoQualityOption = (typeof VIDEO_QUALITIES)[number];

/** A video codec, as the export tab names it: what it is, and where it plays. */
export function codecLabel(codec: string): string {
  switch (codec) {
    case "avc":
      return "H.264 — plays everywhere";
    case "hevc":
      return "H.265 — smaller; newer devices";
    case "vp9":
      return "VP9 — browsers and VLC";
    case "av1":
      return "AV1 — smallest; newer players";
    default:
      return codec;
  }
}

export interface GifOptions {
  format: ExportFormat;
  /** Hundredths of a second a frame of a move lasts in a GIF; see `FRAME_STEPS`. */
  step: FrameStep;
  /** How big the boards come out in a GIF. */
  scale: Scale;
  store: FrameStore;
  /** Frames a second in a video. */
  videoRate: VideoRate;
  /**
   * How big the boards come out in a video: kept apart from the GIF's, since
   * the two are for different places — a GIF put into a page or a message,
   * where it has a width to fit, and a video watched full screen.
   */
  videoScale: Scale;
  videoQuality: VideoQualityOption;
  /**
   * The codec a video is encoded in, by the name Mediabunny gives it — "avc"
   * for H.264 — or null for the first this browser can encode.
   */
  videoCodec: string | null;
}

export const DEFAULT_GIF_OPTIONS: GifOptions = {
  format: "gif",
  /* The smoothest a GIF plays: fifty frames a second, each two hundredths. */
  step: 2,
  scale: 2,
  store: "changed",
  /* Fifty for a video too: the same pace as the GIF, and a piece travelling
     as smoothly. */
  videoRate: 50,
  videoScale: 2,
  videoQuality: "high",
  videoCodec: null,
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
    format: stored.format === "mp4" || stored.format === "gif" ? stored.format : DEFAULT_GIF_OPTIONS.format,
    videoRate: (VIDEO_RATES as readonly number[]).includes(stored.videoRate as number)
      ? (stored.videoRate as VideoRate)
      : DEFAULT_GIF_OPTIONS.videoRate,
    videoScale: (SCALES as readonly number[]).includes(stored.videoScale as number)
      ? (stored.videoScale as Scale)
      : DEFAULT_GIF_OPTIONS.videoScale,
    videoQuality: (VIDEO_QUALITIES as readonly string[]).includes(stored.videoQuality as string)
      ? (stored.videoQuality as VideoQualityOption)
      : DEFAULT_GIF_OPTIONS.videoQuality,
    videoCodec: typeof stored.videoCodec === "string" ? stored.videoCodec : DEFAULT_GIF_OPTIONS.videoCodec,
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
