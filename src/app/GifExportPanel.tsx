import { useCallback, useEffect, useRef, useState } from "react";
import GifNameDialog from "./GifNameDialog";
import SectionRule from "./SectionRule";
import SelectField from "./SelectField";
import {
  estimateGif,
  exportFrames,
  gifSink,
  type GifDriver,
  type GifEstimate,
  type GifPlan,
  type GifProgress,
} from "./gif/capture";
import { suggestedFileName } from "./gif/fileName";
import {
  codecLabel,
  loadGifOptions,
  saveGifOptions,
  VIDEO_QUALITIES,
  VIDEO_RATES,
  type ExportFormat,
  type GifOptions,
  type VideoQualityOption,
  type VideoRate,
} from "./gif/options";
import { measureStage, stageRoots } from "./gif/render";
import {
  canChooseFolder,
  chooseFolder,
  downloadFile,
  fileExists,
  forgetFolder,
  readyToWrite,
  savedFolder,
  writeFile,
  type FolderHandle,
} from "./gif/saving";
import {
  BOARD_UNITS,
  FRAME_STEPS,
  SCALES,
  frameStepLabel,
  scaleLabel,
  type FrameStep,
  type Scale,
} from "./gif/timing";

interface GifExportPanelProps {
  driver: GifDriver;
  /**
   * The Lab's pace: how long the first position stands, each one after it, each
   * one on the way back to a fork, and the end of every line.
   */
  initialDelayMs: number;
  periodMs: number;
  backStepMs: number;
  lineEndHoldMs: number;
  /** Who is playing, where the board names them, for the name offered. */
  players: { white: string; black: string } | null;
  /** The name the game is kept under, if it is kept under one. */
  keptAs: string | null;
  twoBoards: boolean;
  /** How many positions the line on the board has. */
  positions: number;
  /** How many lines the game has: one, or one for each way through its variations. */
  branches: number;
  /**
   * How the board is drawn, as the settings object itself: a new one is a
   * change to what the GIF would look like, and so to what it would come to.
   */
  look: unknown;
  /** Which game is on the board, as a string that changes when the game does. */
  game: string;
  /** Said when an export starts and ends, so the app can keep hands off the board. */
  onExporting: (on: boolean) => void;
}

interface Done {
  name: string;
  where: string;
  bytes: number;
  frames: number;
  width: number;
  height: number;
}

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`;
const seconds = (ms: number) => `${Number((ms / 1000).toFixed(2))} s`;
/** A size known only roughly, to the two figures it is good for. */
const aboutMegabytes = (bytes: number) => `~ ${Number((bytes / (1024 * 1024)).toPrecision(2))} MB`;

/** What each kind of file is called, what it ends in, and what it is to the browser. */
const FORMATS: Record<ExportFormat, { what: string; title: string; extension: string; type: string; button: string }> = {
  gif: {
    what: "animated GIF",
    title: "Animated GIF export",
    extension: "gif",
    type: "image/gif",
    button: "Export animated GIF…",
  },
  mp4: {
    what: "video",
    title: "Video export",
    extension: "mp4",
    type: "video/mp4",
    button: "Export MP4 video…",
  },
};

const QUALITY_LABELS: Record<VideoQualityOption, string> = {
  medium: "Medium (smaller)",
  high: "High",
  "very-high": "Very high (larger)",
};

/** A size a video can be encoded at: its sides made even, as `exportFrames` makes them. */
const evenSize = (size: { width: number; height: number }) => ({
  width: size.width + (size.width % 2),
  height: size.height + (size.height % 2),
});

/** "~ 7 MB / 1,372 frames / 55 seconds". */
function estimateText(estimate: GifEstimate): string {
  const secs = estimate.durationMs / 1000;
  const time = secs >= 10 ? String(Math.round(secs)) : String(Number(secs.toFixed(1)));
  return `${aboutMegabytes(estimate.bytes)} / ${estimate.frames.toLocaleString("en-US")} frames / ${time} second${time === "1" ? "" : "s"}`;
}

/**
 * The animated GIF export: how the frames are made, where the file goes, and
 * the button that makes it.
 *
 * What goes into the GIF is not asked here at all. It is the board as it is set
 * up now — one board or two, its colours and marks, how fast a piece travels
 * and a mark fades, the Lab's initial delay and period — since all of that is
 * already set, and a second set of the same answers kept here could only come to
 * disagree with the first. What is asked is only what a GIF has and a board does
 * not: a frame rate, a size, how frames are stored, and where the file is put.
 *
 * What the file will come to can be asked beforehand: see `estimateGif`.
 */
export default function GifExportPanel({
  driver,
  initialDelayMs,
  periodMs,
  backStepMs,
  lineEndHoldMs,
  players,
  keptAs,
  twoBoards,
  positions,
  branches,
  look,
  game,
  onExporting,
}: GifExportPanelProps) {
  const [options, setOptions] = useState<GifOptions>(loadGifOptions);
  const [folder, setFolder] = useState<FolderHandle | null>(null);
  const [naming, setNaming] = useState(false);
  const [progress, setProgress] = useState<GifProgress | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const stopping = useRef<AbortController | null>(null);
  const running = progress !== null;
  /* What a GIF would come to, as last estimated, and what it was estimated
     for; and how far an estimate being made has got. */
  const [estimate, setEstimate] = useState<{ key: string; look: unknown; value: GifEstimate } | null>(null);
  const [estimating, setEstimating] = useState<number | null>(null);
  const estimateStop = useRef<AbortController | null>(null);
  /* Anything running: an export, or an estimate. Either is using the board. */
  const busy = running || estimating !== null;
  const video = options.format === "mp4";
  const format = FORMATS[options.format];
  /* Each kind of file keeps its own size; see `GifOptions.videoScale`. */
  const scale = video ? options.videoScale : options.scale;
  /* The video codecs this browser can encode at this size: null while that is
     being asked, or where no video is wanted. */
  const [codecs, setCodecs] = useState<string[] | null>(null);
  const codec =
    codecs === null
      ? null
      : options.videoCodec !== null && codecs.includes(options.videoCodec)
        ? options.videoCodec
        : (codecs[0] ?? null);

  /* The GIF or the video as it would be made now, which an export makes and an
     estimate reckons. A video's moves are drawn at its own frame rate. */
  const plan: GifPlan = {
    store: options.store,
    boardPx: BOARD_UNITS * scale,
    stepMs: video ? 1000 / options.videoRate : options.step * 10,
    initialDelayMs,
    periodMs,
    backStepMs,
    lineEndHoldMs,
  };
  /* An estimate stands for as long as nothing it was made from has changed —
     the options here, the Lab's pace, the boards, the game, and the look of
     the board — and is not shown once anything has. */
  const estimateKey = JSON.stringify({ ...plan, format: options.format, twoBoards, game });
  const estimated =
    estimate !== null && estimate.key === estimateKey && estimate.look === look ? estimate.value : null;

  useEffect(() => {
    void savedFolder().then(setFolder);
  }, []);

  const change = (next: Partial<GifOptions>) => {
    const merged = { ...options, ...next };
    setOptions(merged);
    saveGifOptions(merged);
  };

  /* How big the GIF will be, measured off the page as it is laid out now —
     again whenever the window or the layout changes. The names are watched by
     value: they arrive as a fresh object every time the app draws, and the size
     only changes when a row of them comes or goes. */
  useEffect(() => {
    if (running) {
      return;
    }
    const measure = () => {
      const roots = stageRoots();
      const stage = roots === null ? null : measureStage(roots, BOARD_UNITS * scale);
      setSize(stage === null ? null : { width: stage.pixelWidth, height: stage.pixelHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [scale, twoBoards, positions, branches, players?.white, players?.black, running]);

  /* What this browser can encode, asked once a video is wanted and again when
     its size changes: an encoder can have a largest size it will take. The
     encoder's code is only fetched then. */
  useEffect(() => {
    if (!video || size === null) {
      setCodecs(null);
      return;
    }
    let current = true;
    setCodecs(null);
    const { width, height } = evenSize(size);
    void import("./gif/video")
      .then(({ encodableCodecs }) => encodableCodecs(width, height))
      .catch(() => [] as string[])
      .then((found) => {
        if (current) {
          setCodecs(found);
        }
      });
    return () => {
      current = false;
    };
  }, [video, size?.width, size?.height]);

  const exists = useCallback(
    (name: string) => (folder === null ? Promise.resolve(false) : fileExists(folder, name)),
    [folder]
  );

  async function start(name: string) {
    setNaming(false);
    setDone(null);
    setTrouble(null);
    /* Asked for inside the click, which is the only place the browser lets a
       page ask; the export after it takes too long to ask at the end. */
    const target = folder !== null && (await readyToWrite(folder)) ? folder : null;
    const stop = new AbortController();
    stopping.current = stop;
    setProgress({
      done: 0,
      move: 0,
      of: driver.steps().filter((step) => step.kind !== "switch").length,
      frames: 0,
      bytes: 0,
      firstBytes: 0,
    });
    onExporting(true);
    try {
      const result =
        video && codec !== null
          ? await import("./gif/video").then(({ videoSink }) =>
              exportFrames(
                driver,
                plan,
                (painter) =>
                  videoSink(painter, { codec, quality: options.videoQuality, frameRate: options.videoRate }),
                setProgress,
                stop.signal,
                { even: true }
              )
            )
          : await exportFrames(driver, plan, async (painter) => gifSink(painter, plan.store), setProgress, stop.signal);
      if (target !== null) {
        await writeFile(target, name, result.bytes, format.type);
      } else {
        downloadFile(name, result.bytes, format.type);
      }
      setDone({
        name,
        where:
          target !== null
            ? `into “${target.name}”`
            : folder !== null
              ? "to your downloads, since the folder could not be written to"
              : "to your downloads",
        bytes: result.bytes.length,
        frames: result.frames,
        width: result.width,
        height: result.height,
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setTrouble(`The ${format.what} could not be made: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      stopping.current = null;
      setProgress(null);
      onExporting(false);
    }
  }

  /**
   * What the GIF would come to, reckoned by walking the board through the game
   * without making the frames: see `estimateGif`. Held on the page, like an
   * export, while the board is walked.
   */
  async function estimateSize() {
    setTrouble(null);
    const stop = new AbortController();
    estimateStop.current = stop;
    const made = { key: estimateKey, look };
    setEstimating(0);
    onExporting(true);
    try {
      const value = await estimateGif(driver, plan, setEstimating, stop.signal);
      setEstimate({ ...made, value });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setTrouble(`The size could not be estimated: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      estimateStop.current = null;
      setEstimating(null);
      onExporting(false);
    }
  }

  const moves = Math.max(positions - 1, 0);

  return (
    <div className="settings-panel gif-panel">
      <SectionRule name={format.title} />
      <p className="gif-about">
        Made from the board as it is set up now: {twoBoards ? "both boards" : "the board"}, in the
        colours and with the marks of the current settings, with pieces travelling and marks fading
        at the pace set on the Pieces tab. The first position stands for the Lab’s initial delay (
        {seconds(initialDelayMs)}), each one after its move for the period ({seconds(periodMs)}),
        and the end of {branches > 1 ? "each line" : "the game"} for the Lab’s hold at the end of a
        line ({seconds(lineEndHoldMs)}).
        {branches > 1 &&
          ` All ${branches} lines are played, one after another, going back to where each one leaves the last at the back step period (${seconds(backStepMs)}).`}
        {video
          ? " A video can be paused, stepped and scrubbed in any player — which a GIF, playing round and round, cannot — and a long game comes out much smaller."
          : " A GIF goes straight into a page, a post or a message — anywhere a picture can — and plays there by itself."}
      </p>

      <SelectField
        id="export-format"
        label="Format"
        value={options.format}
        choices={[
          { value: "gif", label: "Animated GIF" },
          { value: "mp4", label: "MP4 video" },
        ]}
        hint="An animated GIF goes straight into a page, a post or a message, anywhere a picture can, and plays there by itself, round and round: right for a task. A video waits to be played, and can be paused, stepped and scrubbed in any player: right for a game."
        disabled={busy}
        onChange={(value) => change({ format: value as ExportFormat })}
      />
      {video ? (
        <SelectField
          id="video-rate"
          label="Frame rate"
          value={String(options.videoRate)}
          choices={VIDEO_RATES.map((rate) => ({ value: String(rate), label: `${rate} fps` }))}
          hint="How often the picture changes while a move is being played. Positions at rest are one frame each, however long they stand."
          disabled={busy}
          onChange={(value) => change({ videoRate: Number(value) as VideoRate })}
        />
      ) : (
        <SelectField
          id="gif-rate"
          label="Frame rate"
          value={String(options.step)}
          choices={FRAME_STEPS.map((step) => ({ value: String(step), label: frameStepLabel(step) }))}
          hint="How often the picture changes while a move is being played. A GIF times its frames in hundredths of a second, so these are the rates it keeps exactly. Positions at rest cost one frame however long they stand."
          disabled={busy}
          onChange={(value) => change({ step: Number(value) as FrameStep })}
        />
      )}
      <SelectField
        id="gif-scale"
        label="Resolution"
        value={String(scale)}
        choices={SCALES.map((scale) => ({ value: String(scale), label: scaleLabel(scale) }))}
        hint="How big each board comes out, whatever size the window is. Everything else in the picture is scaled with it."
        disabled={busy}
        onChange={(value) => change(video ? { videoScale: Number(value) as Scale } : { scale: Number(value) as Scale })}
      />
      {video ? (
        <>
          <SelectField
            id="video-quality"
            label="Quality"
            value={options.videoQuality}
            choices={VIDEO_QUALITIES.map((quality) => ({ value: quality, label: QUALITY_LABELS[quality] }))}
            hint="How much the encoder may spend on each second of the video. More keeps the edges of the pieces and the marks crisper; less makes a smaller file."
            disabled={busy}
            onChange={(value) => change({ videoQuality: value as VideoQualityOption })}
          />
          <SelectField
            id="video-codec"
            label="Codec"
            value={codec ?? ""}
            choices={
              codec === null
                ? [
                    {
                      value: "",
                      label: codecs === null ? "Checking what this browser can encode…" : "None — this browser cannot encode video",
                    },
                  ]
                : (codecs ?? []).map((name) => ({ value: name, label: codecLabel(name) }))
            }
            hint="How the video is compressed. H.264 plays on every device and in every app; the others make smaller files that fewer players take. Only those this browser can encode are offered."
            disabled={busy || codec === null}
            onChange={(value) => change({ videoCodec: value })}
          />
        </>
      ) : (
        <SelectField
          id="gif-store"
          label="Frames"
          value={options.store}
          choices={[
            { value: "changed", label: "Only what changes (smaller)" },
            { value: "full", label: "Every frame whole (larger)" },
          ]}
          hint="Only what changes stores each frame as the pixels that differ from the one before, and is four to six times smaller for the same picture. Every frame whole stores each as a picture of its own."
          disabled={busy}
          onChange={(value) => change({ store: value })}
        />
      )}

      <div className="gif-folder">
        <span className="gif-folder-label">Save to:</span>
        <span className="gif-folder-name">
          {folder === null ? "your browser’s downloads" : `the folder “${folder.name}”`}
        </span>
        {canChooseFolder() ? (
          <span className="gif-folder-actions">
            <button
              type="button"
              className="reset-button"
              disabled={busy}
              onClick={() => void chooseFolder().then((chosen) => chosen !== null && setFolder(chosen))}
            >
              Choose folder…
            </button>
            {folder !== null && (
              <button
                type="button"
                className="reset-button"
                disabled={busy}
                onClick={() => void forgetFolder().then(() => setFolder(null))}
              >
                Use downloads
              </button>
            )}
          </span>
        ) : (
          <span className="gif-folder-note">
            This browser can only save to its downloads; Chrome and Edge can be given a folder.
          </span>
        )}
      </div>

      {/*
        What the file would come to, asked for rather than worked out on every
        change: it takes the board through the whole game to find out.
      */}
      {/* The GIF's only, for now: what a video comes to is the encoder's to decide. */}
      {!video && (
      <div className="gif-estimate">
        <button
          type="button"
          className="reset-button"
          disabled={running}
          onClick={() => (estimating === null ? void estimateSize() : estimateStop.current?.abort())}
        >
          {estimating === null ? "Estimate size" : "Cancel"}
        </button>
        <span className="gif-estimate-value" role="status">
          {estimating !== null
            ? `Estimating… ${Math.round(estimating * 100)}%`
            : estimated !== null
              ? estimateText(estimated)
              : ""}
        </span>
      </div>
      )}

      <div className="gif-go">
        <button
          type="button"
          className="reset-button gif-export-button"
          disabled={busy || (video && codec === null)}
          onClick={() => setNaming(true)}
        >
          {format.button}
        </button>
        <span className="gif-size">
          {size === null
            ? ""
            : `${(video ? evenSize(size) : size).width} × ${(video ? evenSize(size) : size).height} px, ${
                branches > 1
                  ? `${branches} lines`
                  : moves === 0
                    ? "one position"
                    : `${moves} move${moves === 1 ? "" : "s"}`
              }`}
        </span>
      </div>

      {progress !== null && (
        <div className="gif-progress" role="status">
          <div
            className="gif-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.done * 100)}
          >
            <div className="gif-progress-fill" style={{ width: `${progress.done * 100}%` }} />
          </div>
          <div className="gif-progress-line">
            <span>
              {progress.of === 0
                ? "Drawing the position"
                : /* Taking a move back to a fork is a step as much as playing one. */
                  `${branches > 1 ? "Step" : "Move"} ${Math.max(progress.move, 1)} of ${progress.of}`}{" "}
              · {progress.frames} frame{progress.frames === 1 ? "" : "s"} · {megabytes(progress.bytes)}
              {/* And where that is heading, once enough of the game is done
                  to say: the first frame is the whole picture and every one
                  after it only what changed, so it is left out of the sum. */}
              {progress.done >= 0.1 &&
                progress.done < 1 &&
                ` · ${aboutMegabytes(
                  progress.firstBytes + (progress.bytes - progress.firstBytes) / progress.done
                )} in all`}
            </span>
            <button type="button" className="reset-button" onClick={() => stopping.current?.abort()}>
              Cancel
            </button>
          </div>
          <p className="invite-note">
            The board plays the game through while the frames are made
            {branches > 1 ? ", every line of it," : ""} and goes back to where it was when they are
            done.
          </p>
        </div>
      )}

      {done !== null && (
        <p className="invite-note gif-done" role="status">
          Saved “{done.name}” {done.where}: {megabytes(done.bytes)}, {done.frames} frames,{" "}
          {done.width} × {done.height} px.
        </p>
      )}
      {trouble !== null && (
        <p className="invite-note preset-trouble" role="alert">
          {trouble}
        </p>
      )}

      <GifNameDialog
        open={naming}
        suggested={suggestedFileName(players, keptAs, format.extension)}
        what={format.what}
        extension={format.extension}
        folder={folder?.name ?? null}
        exists={folder === null ? null : exists}
        onExport={(name) => void start(name)}
        onClose={() => setNaming(false)}
      />
    </div>
  );
}
