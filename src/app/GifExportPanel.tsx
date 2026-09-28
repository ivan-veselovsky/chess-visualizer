import { useCallback, useEffect, useRef, useState } from "react";
import GifNameDialog from "./GifNameDialog";
import NumberField from "./NumberField";
import SectionRule from "./SectionRule";
import SelectField from "./SelectField";
import { exportGif, type GifDriver, type GifProgress } from "./gif/capture";
import { suggestedGifName } from "./gif/fileName";
import { loadGifOptions, saveGifOptions, type GifOptions } from "./gif/options";
import { measureStage, stageRoots } from "./gif/render";
import {
  canChooseFolder,
  chooseFolder,
  downloadGif,
  fileExists,
  forgetFolder,
  readyToWrite,
  savedFolder,
  writeGif,
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
  /** The Lab's pace: how long the first position stands, and each one after. */
  initialDelayMs: number;
  periodMs: number;
  /** Who is playing, where the board names them, for the name offered. */
  players: { white: string; black: string } | null;
  /** The name the game is kept under, if it is kept under one. */
  keptAs: string | null;
  twoBoards: boolean;
  /** How many positions the line on the board has. */
  positions: number;
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

/**
 * The animated GIF export: how the frames are made, where the file goes, and
 * the button that makes it.
 *
 * What goes into the GIF is not asked here at all. It is the board as it is set
 * up now — one board or two, its colours and marks, how fast a piece travels
 * and a mark fades, the Lab's initial delay and period — since all of that is
 * already set, and a second set of the same answers kept here could only come to
 * disagree with the first. What is asked is only what a GIF has and a board does
 * not: a frame rate, a size, how frames are stored, how long the last position
 * stands before it all starts again, and where the file is put.
 */
export default function GifExportPanel({
  driver,
  initialDelayMs,
  periodMs,
  players,
  keptAs,
  twoBoards,
  positions,
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
      const stage = roots === null ? null : measureStage(roots, BOARD_UNITS * options.scale);
      setSize(stage === null ? null : { width: stage.pixelWidth, height: stage.pixelHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [options.scale, twoBoards, positions, players?.white, players?.black, running]);

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
    setProgress({ done: 0, move: 0, of: Math.max(positions - 1, 0), frames: 0, bytes: 0 });
    onExporting(true);
    try {
      const result = await exportGif(
        driver,
        {
          store: options.store,
          boardPx: BOARD_UNITS * options.scale,
          stepMs: options.step * 10,
          initialDelayMs,
          periodMs,
          lastHoldMs: options.lastHoldSec * 1000,
        },
        setProgress,
        stop.signal
      );
      if (target !== null) {
        await writeGif(target, name, result.bytes);
      } else {
        downloadGif(name, result.bytes);
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
        setTrouble(error instanceof Error ? error.message : String(error));
      }
    } finally {
      stopping.current = null;
      setProgress(null);
      onExporting(false);
    }
  }

  const moves = Math.max(positions - 1, 0);

  return (
    <div className="settings-panel gif-panel">
      <SectionRule name="Animated GIF export" />
      <p className="gif-about">
        Made from the board as it is set up now: {twoBoards ? "both boards" : "the board"}, in the
        colours and with the marks of the current settings, with pieces travelling and marks fading
        at the pace set on the Pieces tab. The first position stands for the Lab’s initial delay (
        {seconds(initialDelayMs)}), and each one after its move for the period ({seconds(periodMs)}).
      </p>

      <SelectField
        id="gif-rate"
        label="Frame rate"
        value={String(options.step)}
        choices={FRAME_STEPS.map((step) => ({ value: String(step), label: frameStepLabel(step) }))}
        hint="How often the picture changes while a move is being played. A GIF times its frames in hundredths of a second, so these are the rates it keeps exactly. Positions at rest cost one frame however long they stand."
        disabled={running}
        onChange={(value) => change({ step: Number(value) as FrameStep })}
      />
      <SelectField
        id="gif-scale"
        label="Resolution"
        value={String(options.scale)}
        choices={SCALES.map((scale) => ({ value: String(scale), label: scaleLabel(scale) }))}
        hint="How big each board comes out, whatever size the window is. Everything else in the picture is scaled with it."
        disabled={running}
        onChange={(value) => change({ scale: Number(value) as Scale })}
      />
      <SelectField
        id="gif-store"
        label="Frames"
        value={options.store}
        choices={[
          { value: "changed", label: "Only what changes (smaller)" },
          { value: "full", label: "Every frame whole (larger)" },
        ]}
        hint="Only what changes stores each frame as the pixels that differ from the one before, and is four to six times smaller for the same picture. Every frame whole stores each as a picture of its own."
        disabled={running}
        onChange={(value) => change({ store: value })}
      />
      <NumberField
        id="gif-last-hold"
        inline
        narrow
        allowZero
        label="Hold the last position"
        suffix="seconds"
        step={0.5}
        value={options.lastHoldSec}
        hint="How long the final position stays up before the GIF starts again from the first. The board itself never has to say: a game that has played to its end simply stops."
        disabled={running}
        onChange={(lastHoldSec) => change({ lastHoldSec })}
      />

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
              disabled={running}
              onClick={() => void chooseFolder().then((chosen) => chosen !== null && setFolder(chosen))}
            >
              Choose folder…
            </button>
            {folder !== null && (
              <button
                type="button"
                className="reset-button"
                disabled={running}
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

      <div className="gif-go">
        <button
          type="button"
          className="reset-button gif-export-button"
          disabled={running}
          onClick={() => setNaming(true)}
        >
          Export animated GIF…
        </button>
        <span className="gif-size">
          {size === null
            ? ""
            : `${size.width} × ${size.height} px, ${moves === 0 ? "one position" : `${moves} move${moves === 1 ? "" : "s"}`}`}
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
                : `Move ${Math.max(progress.move, 1)} of ${progress.of}`}{" "}
              · {progress.frames} frame{progress.frames === 1 ? "" : "s"} · {megabytes(progress.bytes)}
            </span>
            <button type="button" className="reset-button" onClick={() => stopping.current?.abort()}>
              Cancel
            </button>
          </div>
          <p className="invite-note">
            The board plays the game through while the frames are made, and goes back to where it was
            when they are done.
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
          The GIF could not be made: {trouble}
        </p>
      )}

      <GifNameDialog
        open={naming}
        suggested={suggestedGifName(players, keptAs)}
        folder={folder?.name ?? null}
        exists={folder === null ? null : exists}
        onExport={(name) => void start(name)}
        onClose={() => setNaming(false)}
      />
    </div>
  );
}
