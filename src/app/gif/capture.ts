import { forceMotion } from "../../visualization/motion";
import { createGifWriter, hundredths, type FrameStore } from "./encoder";
import {
  createPainter,
  drawFrame,
  measureStage,
  paintFrame,
  stageRoots,
  type Painter,
  type Stage,
  type StageRoots,
} from "./render";
import { restAfterFade } from "./timing";
import type { Step } from "../../chess/variations";

/**
 * What the export needs of the app: the walk through the game, and the board
 * moved along it the way the board moves itself — a move played or taken back
 * with its flight and fades, and another of the game's lines taken up at a fork,
 * which moves nothing.
 *
 * `begin` puts the first line on the board at its first position, and hands
 * back what puts the board back where the reader had it.
 *
 * A move is told how long the board will stand once it is down, `restMs`: its
 * fades are fitted into that, as they are when the game plays itself in the
 * Lab, so each finishes before the next move sets off.
 */
export interface GifDriver {
  begin(): () => void;
  /** Every step, from the first position of the first line to the end of the last. */
  steps(): Step[];
  forward(restMs: number): void;
  back(restMs: number): void;
  switchTo(line: number): void;
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
  /** The same, on the way back to a fork: the Lab's back step period. */
  backStepMs: number;
  /**
   * How long the end of each line stands — and the end of the last one, before
   * the GIF starts again: the Lab's hold at the end of a branch.
   */
  lineEndHoldMs: number;
}

export interface GifProgress {
  /** From nought to one, for the bar. */
  done: number;
  /** Moves made so far, played and taken back, and how many there are. */
  move: number;
  of: number;
  frames: number;
  bytes: number;
  /**
   * What the first frame came to: the whole picture, where every frame after
   * it is only what changed. Left out of a reckoning of the size from how far
   * the export has got, which it would otherwise inflate.
   */
  firstBytes: number;
}

/**
 * What a GIF of the game will come to, worked out without making it: see
 * `estimateGif`.
 */
export interface GifEstimate {
  /** The file's size, near enough. */
  bytes: number;
  /** How many frames it will have — exactly. */
  frames: number;
  /** How long it plays for, once through — exactly. */
  durationMs: number;
}

/**
 * Where the frames of an export go — a GIF being written, or a video being
 * encoded. Each is given the frame just drawn on the painter's canvas, and how
 * long it is to stand; `still` marks a position at rest rather than a frame in
 * the middle of a move.
 */
export interface FrameSink {
  add(ms: number, still: boolean): Promise<void>;
  /** How many frames have gone in. */
  readonly frames: number;
  /** How many bytes the file has come to so far, as near as can be told. */
  readonly bytes: number;
  /** The file, ended. */
  finish(): Promise<Uint8Array<ArrayBuffer>>;
  /** Given up on, and whatever it was holding let go. */
  cancel(): Promise<void>;
}

/** A GIF being written, from the painter's canvas a frame at a time. */
export function gifSink(painter: Painter, store: FrameStore): FrameSink {
  const { context, stage } = painter;
  const writer = createGifWriter(stage.pixelWidth, stage.pixelHeight, store);
  return {
    async add(ms, still) {
      writer.add(context.getImageData(0, 0, stage.pixelWidth, stage.pixelHeight).data, ms, still);
    },
    get frames() {
      return writer.frames;
    },
    get bytes() {
      return writer.bytes;
    },
    async finish() {
      return writer.finish();
    },
    async cancel() {
      /* Nothing held but memory, which goes with it. */
    },
  };
}

/**
 * A stage a pixel wider or taller where it came out odd. A video encoder
 * stores the colour of each two by two block of pixels once, and will not take
 * a picture that does not divide into them; the pixel added is ground.
 */
function evened(stage: Stage): Stage {
  const even = (pixels: number) => pixels + (pixels % 2);
  return { ...stage, pixelWidth: even(stage.pixelWidth), pixelHeight: even(stage.pixelHeight) };
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

/**
 * Animations brought to their end, and the page made to take that end as its
 * own before anything else changes it.
 *
 * Firefox, finishing a paused transition, puts off applying the end until it
 * next works out the page's styles; the landing that follows the take-off
 * fades is a new render, and one that came first found the fades still half
 * alive. It started the landing's fades from where the take-off's had begun
 * rather than where they ended, and at the flight's length rather than the
 * fade's — a square that had faded out snapped back and faded out again, in
 * every export Firefox made, while Chrome's were smooth. Asking for the page's
 * animations brings its styles up to date first, which is what browsers are
 * bound to do for that question.
 */
function ended(animations: Animation[]): void {
  animations.forEach(finish);
  document.getAnimations();
}

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

/**
 * How long the board stands once the move at `index` is down, counted from the
 * landing as the board counts it: the period before a move on, the hold at the
 * end of a line before turning back — and at the end of the last line, before
 * the GIF starts again — and the back step period on the way to a fork. A line
 * taken up at the fork in between moves nothing, and takes none of it.
 */
function paceAfter(steps: Step[], index: number, plan: GifPlan): number {
  const step = steps[index];
  const after = steps[index + 1]?.kind === "switch" ? steps[index + 2] : steps[index + 1];
  return after === undefined
    ? plan.lineEndHoldMs
    : after.kind === "back"
      ? step.kind === "forward"
        ? plan.lineEndHoldMs
        : plan.backStepMs
      : plan.periodMs;
}

/** How many frames a stretch of movement is shown in, a frame a step, up to — not at — its end. */
const framesWithin = (ms: number, stepMs: number) => Math.max(Math.ceil(ms / stepMs) - 1, 0);

/** Until the board has taken the piece down, which it says by dropping the layer it flew on. */
async function landed(): Promise<void> {
  for (let turn = 0; turn < 200 && document.querySelector(".flight-layer") !== null; turn += 1) {
    await aTurn();
  }
}

/**
 * The game on the board, from its first position to the end of its last line,
 * as an animated GIF; see `exportFrames`, which makes it.
 */
export function exportGif(
  driver: GifDriver,
  plan: GifPlan,
  onProgress: (progress: GifProgress) => void,
  signal: AbortSignal
): Promise<GifResult> {
  return exportFrames(driver, plan, async (painter) => gifSink(painter, plan.store), onProgress, signal);
}

/**
 * The game on the board, from its first position to the end of its last line,
 * as the frames of an animation, handed to `sinkFor`'s sink as they are made —
 * which writes them into a GIF, or encodes them into a video.
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
 * A game with variations is walked as the board walks it: each line played to
 * its end and held there, taken back at the back step period to the fork the
 * next line leaves from, and the next line played on from there.
 *
 * The board is moved to do it, so the reader sees it play through as the
 * frames are made, and is put back where it was at the end, however the export
 * ends. While it runs, the reader's own wish for less movement is set aside:
 * see `forceMotion`.
 */
export async function exportFrames(
  driver: GifDriver,
  plan: GifPlan,
  sinkFor: (painter: Painter) => Promise<FrameSink>,
  onProgress: (progress: GifProgress) => void,
  signal: AbortSignal,
  { even = false }: { even?: boolean } = {}
): Promise<GifResult> {
  const roots = stageRoots();
  if (roots === null) {
    throw new Error("There is no board on the page to make a GIF of.");
  }
  const steps = driver.steps();
  const moves = steps.filter((step) => step.kind !== "switch").length;
  const stop = () => {
    if (signal.aborted) {
      throw new DOMException("The export was cancelled.", "AbortError");
    }
  };

  forceMotion(true);
  let putBack: (() => void) | null = null;
  let sink: FrameSink | null = null;
  let finished = false;
  try {
    putBack = driver.begin();
    await settle(roots);
    const measured = measureStage(roots, plan.boardPx);
    if (measured === null) {
      throw new Error("The board is not on the page, so there is nothing to draw.");
    }
    const stage = even ? evened(measured) : measured;
    const painter = createPainter(roots, stage);
    const writer = await sinkFor(painter);
    sink = writer;
    const frame = async (ms: number, still: boolean) => {
      await drawFrame(painter);
      await writer.add(ms, still);
    };
    let firstBytes = 0;
    const report = (move: number, within: number) =>
      onProgress({
        done: moves === 0 ? 1 : Math.min(1, (move - 1 + within) / moves),
        move,
        of: moves,
        frames: writer.frames,
        bytes: writer.bytes,
        firstBytes,
      });

    await frame(moves === 0 ? plan.lineEndHoldMs : plan.initialDelayMs, true);
    firstBytes = writer.bytes;
    report(1, 0);

    let move = 0;
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      if (step.kind === "switch") {
        /* Only ever met here at the very start, before any move to fold it
           into; everywhere else it is taken up at the fork, below. */
        driver.switchTo(step.line);
        await settle(roots);
        continue;
      }
      stop();
      move += 1;
      const pace = paceAfter(steps, index, plan);
      if (step.kind === "forward") {
        driver.forward(pace);
      } else {
        driver.back(pace);
      }

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
        await frame(plan.stepMs, false);
        report(move, 0.6 * (t / flightMs));
        stop();
        await aTurn();
      }
      ended(lifting);
      await landed();

      /* The fade the landing set off, fitted by the board into the rest. */
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
        await frame(plan.stepMs, false);
        fadeShown += plan.stepMs;
        report(move, 0.6 + 0.4 * (t / fadeMs));
        stop();
        await aTurn();
      }
      fading.forEach(finish);
      await settle(roots);

      /*
        At a fork, having come back to it, the next line is taken up now: it
        moves nothing, and its name goes up while the fork is on the board, so
        the rest that follows is the time there is to read it.
      */
      const upcoming = steps[index + 1];
      if (upcoming?.kind === "switch") {
        driver.switchTo(upcoming.line);
        await settle(roots);
        index += 1;
      }

      /* At rest, for what is left of the pace once the fade has been shown. */
      await frame(restAfterFade(pace, fadeShown, plan.stepMs), true);
      report(move, 1);
      await aTurn();
    }

    const bytes = await writer.finish();
    finished = true;
    return { bytes, frames: writer.frames, width: stage.pixelWidth, height: stage.pixelHeight };
  } finally {
    /* A file half made is let go of, whatever it was holding. */
    if (sink !== null && !finished) {
      await sink.cancel().catch(() => undefined);
    }
    /* Back where the reader left it, however the export ended. */
    putBack?.();
    await settle(roots);
    forceMotion(false);
  }
}

/**
 * The straight line through some weighted points that comes nearest them —
 * what a frame of a kind came to, against how many marks were fading in it —
 * as a function giving the line's height anywhere.
 *
 * Flat, at their weighted mean, where the points cannot say which way a line
 * would run: fewer than three of them, or all at much the same place along.
 * And never below a quarter of that mean, which a steep line drawn from a few
 * points could otherwise reach at the far end of a long game.
 */
function fitted(points: { x: number; y: number; weight: number }[]): (x: number) => number {
  const weight = points.reduce((sum, point) => sum + point.weight, 0);
  if (weight === 0) {
    return () => 0;
  }
  const meanX = points.reduce((sum, point) => sum + point.weight * point.x, 0) / weight;
  const meanY = points.reduce((sum, point) => sum + point.weight * point.y, 0) / weight;
  const spread = points.reduce((sum, point) => sum + point.weight * (point.x - meanX) ** 2, 0) / weight;
  if (points.length < 3 || spread < 0.25) {
    return () => meanY;
  }
  const slope = points.reduce((sum, point) => sum + point.weight * (point.x - meanX) * (point.y - meanY), 0) / weight / spread;
  return (x) => Math.max(meanY + slope * (x - meanX), meanY / 4);
}

/** How many of the game's moves are drawn to be measured: one in four, within these. */
const SAMPLED_MOVES = { least: 4, most: 10 };

/**
 * What a GIF of the game would come to — its size, its frames and how long it
 * plays — without making it.
 *
 * The frames and the time are exact. The board is walked through the whole
 * game as the export walks it, every move played with the same pace and every
 * flight and fade let run, but finished at once instead of being drawn: how
 * long each lasts is read off the board, and that says how many frames it will
 * take and how long each will stand.
 *
 * The size cannot be had without drawing and encoding every frame, which is
 * the export itself, so it is measured on some moves and the rest reckoned
 * from them. At one move in four — four at the least, ten at the most, the
 * moves played and the moves taken back each in proportion, spread through
 * the game — every frame is drawn and encoded exactly as the export does it,
 * from the position at rest before the move to the one after it. The export
 * sends each position at rest exactly, so a move starts from the same place
 * there as here, and what those moves come to is what they will come to in
 * the file.
 *
 * The other moves are reckoned from them a frame at a time, by what kind of
 * frame it is, since the kinds come to very different sizes: a frame of a
 * piece lifting, while the marks it held fade from the board; one of it merely
 * travelling, which is a third of that or less; a frame of the fade the
 * landing sets off; and the position at rest, which sends again everything the
 * fade left a level or two out. How many of each kind a move has is exact.
 * What each comes to follows, far more closely than anything else that can be
 * had without drawing it, how many of the board's marks are fading at the
 * time — the rays of a rook or a queen against the ring of a knight — and the
 * walk counts those for every move for nothing. So each kind is reckoned by
 * the line the measured moves draw between the two.
 *
 * Two ways of doing it without the marks came out a fifth out: frames at a
 * fixed share of the way through each flight, which missed the lifting at low
 * frame rates; and every kind at its plain mean, which in a real game — a
 * quiet pawn move beside a queen's — rested on which moves happened to be
 * measured.
 *
 * The first frame, which is the whole picture, is measured exactly.
 *
 * The board moves while it runs, as it does for the export, and is put back
 * where it was.
 */
export async function estimateGif(
  driver: GifDriver,
  plan: GifPlan,
  onProgress: (done: number) => void,
  signal: AbortSignal
): Promise<GifEstimate> {
  const roots = stageRoots();
  if (roots === null) {
    throw new Error("There is no board on the page to make a GIF of.");
  }
  const steps = driver.steps();
  const moves = steps.flatMap((step, index) => (step.kind === "switch" ? [] : [index]));
  /*
    Which moves are measured: the moves played and the moves taken back
    apart, each in proportion to how many there are and spread evenly through
    the game, since the two come to different sizes — a line is taken back at
    a quicker pace, with its fades fitted into it.
  */
  const sampling = Math.min(SAMPLED_MOVES.most, Math.max(SAMPLED_MOVES.least, Math.ceil(moves.length / 4)));
  const spread = (of: number[], take: number) =>
    of.length <= take
      ? of
      : take <= 1
        ? of.slice(Math.floor(of.length / 2), Math.floor(of.length / 2) + 1)
        : Array.from({ length: take }, (_, k) => of[Math.round((k * (of.length - 1)) / (take - 1))]);
  const played = moves.filter((index) => steps[index].kind === "forward");
  const takenBack = moves.filter((index) => steps[index].kind === "back");
  const backShare =
    takenBack.length === 0 ? 0 : Math.max(1, Math.round((sampling * takenBack.length) / moves.length));
  const sampled = new Set([...spread(played, sampling - backShare), ...spread(takenBack, backShare)]);
  const stop = () => {
    if (signal.aborted) {
      throw new DOMException("The estimate was cancelled.", "AbortError");
    }
  };

  forceMotion(true);
  let putBack: (() => void) | null = null;
  try {
    putBack = driver.begin();
    await settle(roots);
    const stage = measureStage(roots, plan.boardPx);
    if (stage === null) {
      throw new Error("The board is not on the page, so there is nothing to draw.");
    }
    const painter = createPainter(roots, stage);
    const writer = createGifWriter(stage.pixelWidth, stage.pixelHeight, plan.store);

    const firstMs = moves.length === 0 ? plan.lineEndHoldMs : plan.initialDelayMs;
    writer.add(await paintFrame(painter), firstMs, true);
    const firstBytes = writer.bytes;
    let frames = 1;
    let durationMs = hundredths(firstMs);

    /*
      Every move as the walk found it: how many frames of each kind it takes,
      and how many of the board's marks fade as its piece lifts and as it lands
      — which is most of what the move comes to, and costs nothing to count.
      A measured move also says what its frames of each kind came to.
    */
    interface Move {
      lifting: number;
      travelling: number;
      fading: number;
      liftingMarks: number;
      fadingMarks: number;
      bytes: Record<Kind, number> | null;
    }
    type Kind = "lifting" | "travelling" | "fading" | "resting";
    const walked: Move[] = [];
    let bytes: Record<Kind, number> | null = null;
    /* The position at rest before a measured move, sent exactly — as the
       export sent it — and not counted: the move is measured from it. */
    const before = async () => {
      writer.add(await paintFrame(painter), plan.stepMs, true);
    };
    const measure = async (kind: Kind, still: boolean) => {
      const from = writer.bytes;
      writer.add(await paintFrame(painter), plan.stepMs, still);
      bytes![kind] += writer.bytes - from;
    };
    /* The board's own marks among what is moving: the flower by a name opens
       and closes with every move too, and it is a speck beside the marks of a
       whole board. */
    const onBoard = (list: Animation[]) =>
      list.filter(
        (animation) =>
          !flying(animation) &&
          ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.closest(".board-holder") != null
      );

    let done = 0;
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      if (step.kind === "switch") {
        driver.switchTo(step.line);
        await settle(roots);
        continue;
      }
      stop();
      const measuring = sampled.has(index);
      bytes = measuring ? { lifting: 0, travelling: 0, fading: 0, resting: 0 } : null;
      if (measuring) {
        await before();
      }
      const pace = paceAfter(steps, index, plan);
      if (step.kind === "forward") {
        driver.forward(pace);
      } else {
        driver.back(pace);
      }

      /* The flight, and the marks the piece held fading as it lifts. */
      const lifting = animating(roots);
      lifting.forEach((animation) => animation.pause());
      const flights = lifting.filter(flying);
      const flightMs = flights.length === 0 ? 0 : Math.max(...flights.map(endOf));
      const liftingMarks = onBoard(lifting);
      const liftMs = liftingMarks.length === 0 ? 0 : Math.max(...liftingMarks.map(endOf));
      const from = new Map(lifting.map((animation) => [animation, Number(animation.currentTime ?? 0)]));
      const inFlight = framesWithin(flightMs, plan.stepMs);
      /* Up to and including the first frame the marks have finished fading at. */
      const inLift = Math.min(inFlight, Math.ceil(liftMs / plan.stepMs));
      if (measuring) {
        for (let frame = 1; frame <= inFlight; frame += 1) {
          lifting.forEach((animation) => {
            animation.currentTime = from.get(animation)! + frame * plan.stepMs;
          });
          await measure(frame <= inLift ? "lifting" : "travelling", false);
        }
      }
      ended(lifting);
      await landed();

      /* The fade the landing set off. */
      const fading = animating(roots);
      fading.forEach((animation) => {
        animation.pause();
        animation.currentTime = 0;
      });
      const fadeMs = fading.length === 0 ? 0 : Math.max(...fading.map(endOf));
      const inFade = framesWithin(fadeMs, plan.stepMs);
      const fadingMarks = onBoard(fading).length;
      if (measuring) {
        for (let frame = 1; frame <= inFade; frame += 1) {
          fading.forEach((animation) => {
            animation.currentTime = frame * plan.stepMs;
          });
          await measure("fading", false);
        }
      }
      fading.forEach(finish);
      await settle(roots);
      const upcoming = steps[index + 1];
      if (upcoming?.kind === "switch") {
        driver.switchTo(upcoming.line);
        await settle(roots);
        index += 1;
      }
      /* And the position at rest, which is sent exactly. */
      if (measuring) {
        await measure("resting", true);
      }

      walked.push({
        lifting: inLift,
        travelling: inFlight - inLift,
        fading: inFade,
        liftingMarks: liftingMarks.length,
        fadingMarks,
        bytes,
      });
      frames += inFlight + inFade + 1;
      durationMs +=
        (inFlight + inFade) * hundredths(plan.stepMs) +
        hundredths(restAfterFade(pace, inFade * plan.stepMs, plan.stepMs));
      done += 1;
      onProgress(done / moves.length);
      await aTurn();
    }

    /*
      The moves measured come to what they came to. Each of the others is
      reckoned a kind of frame at a time, by the line the measured moves draw
      between how many marks were fading and what a frame of that kind came
      to — the more marks, the more of the board a frame sends again. Frames
      of a piece travelling hold no fading marks and are all much alike, and
      are reckoned at what they came to on average.
    */
    const measuredMoves = walked.filter((move) => move.bytes !== null);
    const lineOf = (kind: Kind, marksOf: (move: Move) => number, framesOf: (move: Move) => number) =>
      fitted(
        measuredMoves
          .filter((move) => framesOf(move) > 0)
          .map((move) => ({ x: marksOf(move), y: move.bytes![kind] / framesOf(move), weight: framesOf(move) }))
      );
    const liftingLine = lineOf("lifting", (move) => move.liftingMarks, (move) => move.lifting);
    const travellingLine = fitted(
      measuredMoves
        .filter((move) => move.travelling > 0)
        .map((move) => ({ x: 0, y: move.bytes!.travelling / move.travelling, weight: move.travelling }))
    );
    const fadingLine = lineOf("fading", (move) => move.fadingMarks, (move) => move.fading);
    const restingLine = lineOf("resting", (move) => move.liftingMarks + move.fadingMarks, () => 1);
    const total = walked.reduce(
      (sum, move) =>
        sum +
        (move.bytes !== null
          ? move.bytes.lifting + move.bytes.travelling + move.bytes.fading + move.bytes.resting
          : move.lifting * liftingLine(move.liftingMarks) +
            move.travelling * travellingLine(0) +
            move.fading * fadingLine(move.fadingMarks) +
            restingLine(move.liftingMarks + move.fadingMarks)),
      0
    );
    return {
      /* And the byte that ends the file. */
      bytes: Math.round(firstBytes + total + 1),
      frames,
      durationMs,
    };
  } finally {
    /* Back where the reader left it, however the estimate ended. */
    putBack?.();
    await settle(roots);
    forceMotion(false);
  }
}
