import { forceMotion } from "../../visualization/motion";
import { createGifWriter, type FrameStore } from "./encoder";
import { createPainter, measureStage, paintFrame, stageRoots, type StageRoots } from "./render";
import { restAfterFade } from "./timing";

/**
 * What the export needs of the app: the line on the board, and the two ways of
 * moving along it — straight to a position, and a move played as the board
 * plays one, piece in the air and all.
 *
 * Positions are counted from the first, the way a reader counts them.
 */
export interface GifDriver {
  line(): { count: number; at: number };
  jump(at: number): void;
  step(): void;
}

/** What goes into the GIF besides the board: how it is stored, how big, how paced. */
export interface GifPlan {
  store: FrameStore;
  /** How many pixels across each board comes out. */
  boardPx: number;
  /** How long each frame of a move lasts. */
  stepMs: number;
  /** How long the first position stands before the first move: the Lab's initial delay. */
  initialDelayMs: number;
  /** How long each position stands, counted from the piece landing: the Lab's period. */
  periodMs: number;
  /** How long the last position stands before the GIF starts again. */
  lastHoldMs: number;
}

export interface GifProgress {
  /** From nought to one, for the bar. */
  done: number;
  move: number;
  of: number;
  frames: number;
  bytes: number;
}

export interface GifResult {
  bytes: Uint8Array<ArrayBuffer>;
  frames: number;
  width: number;
  height: number;
}

/**
 * A turn of the event loop, and nothing slower.
 *
 * Not a timer and not an animation frame. A tab in the background gets neither
 * at anything like its usual rate — its timers are held to about one a second
 * and its animation frames stop outright — and an export left running there
 * would crawl, or never finish. A message to itself is not held back either
 * way, and it is all that is needed: long enough for the page to draw the
 * progress bar, and for the board to take in what it was just told.
 */
function aTurn(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
}

/** Everything animating on what the frames are made of — the title and the board's column — and nothing else. */
function animating(roots: StageRoots): Animation[] {
  return document.getAnimations().filter((animation) => {
    const target = (animation.effect as KeyframeEffect | null)?.target;
    return target instanceof Element && (roots.column.contains(target) || roots.title.contains(target));
  });
}

const flying = (animation: Animation) =>
  ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.classList.contains("flying-piece") === true;

const endOf = (animation: Animation) => Number(animation.effect?.getComputedTiming().endTime ?? 0);

const finish = (animation: Animation) => {
  try {
    animation.finish();
  } catch {
    /* One with no end cannot be finished, and there are none on the board. */
  }
};

/** Until nothing is in the air and nothing is still fading. */
async function settle(roots: StageRoots): Promise<void> {
  for (let turn = 0; turn < 200; turn += 1) {
    animating(roots).forEach(finish);
    await aTurn();
    if (document.querySelector(".flight-layer") === null && animating(roots).length === 0) {
      return;
    }
  }
}

/** Until the board has taken the piece down, which it says by dropping the layer it flew on. */
async function landed(): Promise<void> {
  for (let turn = 0; turn < 200 && document.querySelector(".flight-layer") !== null; turn += 1) {
    await aTurn();
  }
}

/**
 * The line on the board, from its first position to its last, as an animated GIF.
 *
 * Made from the app itself, not from pictures of it: every animation on the
 * board — the flights, which are Web Animations, and the fades, which are CSS
 * transitions — is paused and set to the moment each frame is of, and the frame
 * is drawn from the page as it then stands. So the frames are exact to the
 * millisecond however long each takes to make, and the pace in the GIF is the
 * pace on the board: the initial delay before the first move, each move's
 * flight and fade, and the period after it, counted from the landing as the
 * board counts it.
 *
 * The board is moved to do it, so the reader sees it play through as the
 * frames are made, and is put back where it was at the end, however the export
 * ends. While it runs, the reader's own wish for less movement is set aside:
 * see `forceMotion`.
 */
export async function exportGif(
  driver: GifDriver,
  plan: GifPlan,
  onProgress: (progress: GifProgress) => void,
  signal: AbortSignal
): Promise<GifResult> {
  const roots = stageRoots();
  if (roots === null) {
    throw new Error("There is no board on the page to make a GIF of.");
  }
  const start = driver.line();
  const moves = start.count - 1;
  const stop = () => {
    if (signal.aborted) {
      throw new DOMException("The export was cancelled.", "AbortError");
    }
  };

  forceMotion(true);
  try {
    driver.jump(0);
    await settle(roots);
    const stage = measureStage(roots, plan.boardPx);
    if (stage === null) {
      throw new Error("The board is not on the page, so there is nothing to draw.");
    }
    const painter = createPainter(roots, stage);
    const writer = createGifWriter(stage.pixelWidth, stage.pixelHeight, plan.store);
    const report = (move: number, within: number) =>
      onProgress({
        done: moves === 0 ? 1 : Math.min(1, (move - 1 + within) / moves),
        move,
        of: moves,
        frames: writer.frames,
        bytes: writer.bytes,
      });

    writer.add(await paintFrame(painter), moves === 0 ? plan.lastHoldMs : plan.initialDelayMs, true);
    report(1, 0);

    for (let move = 1; move <= moves; move += 1) {
      stop();
      driver.step();

      /* The flight, and whatever fading set off with it: a piece in the air
         holds nothing, so its marks go as it lifts. */
      const lifting = animating(roots);
      lifting.forEach((animation) => animation.pause());
      const flights = lifting.filter(flying);
      const flightMs = flights.length === 0 ? 0 : Math.max(...flights.map(endOf));
      const from = new Map(lifting.map((animation) => [animation, Number(animation.currentTime ?? 0)]));
      for (let t = plan.stepMs; t < flightMs; t += plan.stepMs) {
        lifting.forEach((animation) => {
          animation.currentTime = from.get(animation)! + t;
        });
        writer.add(await paintFrame(painter), plan.stepMs, false);
        report(move, 0.6 * (t / flightMs));
        stop();
        await aTurn();
      }
      lifting.forEach(finish);
      await landed();

      /* The fade the landing set off. */
      const fading = animating(roots);
      fading.forEach((animation) => {
        animation.pause();
        animation.currentTime = 0;
      });
      const fadeMs = fading.length === 0 ? 0 : Math.max(...fading.map(endOf));
      let fadeShown = 0;
      for (let t = plan.stepMs; t < fadeMs; t += plan.stepMs) {
        fading.forEach((animation) => {
          animation.currentTime = t;
        });
        writer.add(await paintFrame(painter), plan.stepMs, false);
        fadeShown += plan.stepMs;
        report(move, 0.6 + 0.4 * (t / fadeMs));
        stop();
        await aTurn();
      }
      fading.forEach(finish);
      await settle(roots);

      /* At rest, for what is left of the period — or, at the end, for as long
         as the last position was asked to stand. */
      const rest = move === moves ? plan.lastHoldMs : restAfterFade(plan.periodMs, fadeShown, plan.stepMs);
      writer.add(await paintFrame(painter), rest, true);
      report(move, 1);
      await aTurn();
    }

    return { bytes: writer.finish(), frames: writer.frames, width: stage.pixelWidth, height: stage.pixelHeight };
  } finally {
    /* Back where the reader left it, however the export ended. */
    driver.jump(start.at);
    await settle(roots);
    forceMotion(false);
  }
}
