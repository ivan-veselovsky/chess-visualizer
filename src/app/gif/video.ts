/*
  Written with its extensions, like the other modules `tests/unit.mjs` runs
  straight from the TypeScript.
*/
import {
  BufferTarget,
  canEncodeVideo,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
  type Quality,
  type VideoCodec,
  VideoSample,
  VideoSampleSource,
} from "mediabunny";
import type { FrameSink } from "./capture.ts";
import type { Painter } from "./render.ts";
import { i420Size, toI420, VIDEO_COLOUR_SPACE } from "./yuv.ts";

/**
 * The game as a video: the same frames the GIF is made of, drawn at the same
 * moments, encoded by the browser's own video encoder and written into an MP4
 * by Mediabunny.
 *
 * Kept apart from the GIF, and loaded only when a video is asked for: the
 * encoder and the file writer are a good deal of code that a reader who only
 * ever makes GIFs has no use for.
 *
 * Why a video at all: a GIF plays in a loop and nothing else — no player gives
 * it a way to stop, go back or skip on — which is fine for a mate in two and
 * no good for a game. A video can be paused and scrubbed in any player, and a
 * long game comes out much smaller.
 */

/** How much the encoder may spend: Mediabunny's own levels, which scale with the size and the rate. */
export type VideoQuality = "medium" | "high" | "very-high";

const QUALITIES: Record<VideoQuality, Quality> = {
  medium: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
  "very-high": QUALITY_VERY_HIGH,
};

/**
 * The codecs an MP4 of a game may be in, in the order they are offered: the
 * one every player plays first.
 */
export const VIDEO_CODECS: readonly VideoCodec[] = ["avc", "hevc", "vp9", "av1"];

/**
 * The codecs this browser can encode a video of this size in.
 *
 * Asked of the browser rather than assumed: which encoders a browser has
 * depends on the browser, and on the machine under it — Firefox, for one, can
 * make some on one system and not on another.
 */
export async function encodableCodecs(width: number, height: number): Promise<string[]> {
  const able = await Promise.all(
    VIDEO_CODECS.map((codec) =>
      canEncodeVideo(codec, { width, height, quality: QUALITY_HIGH }).catch(() => false)
    )
  );
  return VIDEO_CODECS.filter((_, index) => able[index]);
}

/**
 * How many copies of the last picture end a video, each a frame long, cut out
 * of the end of its hold rather than added to it.
 *
 * An MP4 says how long each frame stands by where the next one starts, and
 * for the last, which has no next, by how long the encoder said it was. That
 * is asked of the last frame in the order the encoder put them out, and an
 * encoder that sends some frames on ahead of others to predict from them —
 * Firefox's H.264 sends up to four — puts out last a frame that was never the
 * last shown: a frame of the last move, a fiftieth of a second long. The hold
 * at the end of the game was cut to that, and the video stopped the moment the
 * last piece landed. Ended with a run of short copies of the same picture,
 * whatever comes out last is one of them, and the video stops where the GIF
 * does. Eight is twice the most any encoder here has been seen to send ahead;
 * the same picture over again costs a few bytes a frame.
 */
export const VIDEO_TAIL = 8;

/**
 * An MP4 being encoded from the painter's canvas, a frame at a time.
 *
 * Each frame goes in with its own length, as it does into the GIF: a position
 * at rest is one frame lasting as long as it stands, rather than the same
 * picture over and over. Every player takes a video's frames at whatever
 * lengths they come; the times are only rounded to the frame rate, which the
 * frames of a move are already at.
 *
 * A key frame every two seconds, which is what lets a player jump to any point
 * without working through everything before it.
 *
 * Each frame is taken off the canvas and made into the video's own colours
 * here, rather than the canvas being handed to the encoder to make of what it
 * will; see `yuv.ts`. The last is kept, and its hold ends in `VIDEO_TAIL`
 * copies of it.
 */
export async function videoSink(
  painter: Painter,
  options: { codec: string; quality: VideoQuality; frameRate: number }
): Promise<FrameSink> {
  let bytes = 0;
  let frames = 0;
  let at = 0;
  let lastMs = 0;
  const step = 1000 / options.frameRate;
  const { context, stage } = painter;
  const { pixelWidth: width, pixelHeight: height } = stage;
  /* One buffer, filled again for each frame: a frame made from it takes a
     copy of it there and then. */
  const planes = new Uint8Array(i420Size(width, height));
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const source = new VideoSampleSource({
    codec: options.codec as VideoCodec,
    quality: QUALITIES[options.quality],
    keyFrameInterval: 2,
    onEncodedPacket: (packet) => {
      bytes += packet.byteLength;
    },
  });
  output.addVideoTrack(source, { frameRate: options.frameRate });
  await output.start();

  /** What is in `planes`, from `startMs` for `ms`. */
  const encode = async (startMs: number, ms: number) => {
    const frame = new VideoFrame(planes, {
      format: "I420",
      codedWidth: width,
      codedHeight: height,
      timestamp: Math.round(startMs * 1000),
      duration: Math.round(ms * 1000),
      colorSpace: VIDEO_COLOUR_SPACE,
    });
    const sample = new VideoSample(frame);
    try {
      await source.add(sample);
    } finally {
      sample.close();
    }
  };

  return {
    async add(ms) {
      toI420(context.getImageData(0, 0, width, height).data, width, height, planes);
      await encode(at, ms);
      at += ms;
      lastMs = ms;
      frames += 1;
    },
    get frames() {
      return frames;
    },
    get bytes() {
      return bytes;
    },
    async finish() {
      /* Leaving the last frame itself at least a frame long. */
      const copies = Math.min(VIDEO_TAIL, Math.floor(lastMs / step) - 1);
      for (let copy = copies; copy >= 1; copy -= 1) {
        await encode(at - copy * step, step);
      }
      await output.finalize();
      if (target.buffer === null) {
        throw new Error("The video encoder finished without a file.");
      }
      return new Uint8Array(target.buffer);
    },
    async cancel() {
      await output.cancel();
    },
  };
}
