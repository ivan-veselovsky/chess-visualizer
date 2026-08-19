import { useEffect, useMemo, useRef, useState } from "react";
import type { Square } from "chess.js";
import {
  canGoNext,
  canGoPrevious,
  currentPosition,
  goNext,
  goToPosition,
  historyFromLine,
  indexOfPosition,
  goPrevious,
  pushPosition,
  startHistory,
  type PositionHistory,
} from "../chess/history";
import { applyMove } from "../chess/moves";
import { parsePgn } from "../chess/pgn";
import { STARTUP_POSITION } from "../chess/famousPositions";
import { DEFAULT_FEN, parseFen } from "../chess/position";
import Board from "../visualization/Board";
import FamousPositions from "./FamousPositions";
import FenField from "./FenField";
import GearIcon from "./GearIcon";
import StepIcon from "./StepIcon";
import OptionsPanel from "./OptionsPanel";
import PgnDialog from "./PgnDialog";
import ToggleField from "./ToggleField";
import type { Options } from "./options";
import { DEFAULT_OPTIONS } from "./presets";

export default function App() {
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [fen, setFen] = useState(STARTUP_POSITION.fen);
  const [history, setHistory] = useState<PositionHistory>(() =>
    startHistory(STARTUP_POSITION.fen)
  );
  const [pgnOpen, setPgnOpen] = useState(false);

  /**
   * Replaces the history with a whole game, positioned at its start so it can
   * be stepped through from the beginning. Returns why the text was rejected,
   * for the dialog to show without closing.
   */
  function loadPgn(pgn: string): string | null {
    const { entries, error } = parsePgn(pgn);
    if (entries === null) {
      return error;
    }
    const loaded = historyFromLine(entries);
    setHistory(loaded);
    setFen(currentPosition(loaded));
    return null;
  }

  /**
   * A position arrived at by playing: recorded after the current one, with
   * anything that had followed dropped.
   */
  function playPosition(fen: string, move: string) {
    setFen(fen);
    setHistory(pushPosition(history, fen, move));
  }

  /**
   * A position set outright — typed in, chosen from the examples, or reset.
   * That starts a fresh line rather than continuing one: there is no move
   * connecting it to what came before, so nothing to step back through.
   */
  function setPosition(next: string) {
    setFen(next);
    setHistory(startHistory(next));
  }

  /**
   * What the FEN field reports, which is either of two things.
   *
   * A position already in the list is one of its own suggestions being picked,
   * so the pointer moves to it and the list survives. Anything else is a
   * position typed or pasted in, which starts a fresh line. Deciding by value
   * rather than by how the field was operated also means pasting a FEN you had
   * reached earlier returns you to it rather than discarding what followed.
   */
  function enterPosition(next: string) {
    const at = indexOfPosition(history, next);
    if (at < 0) {
      setPosition(next);
      return;
    }
    setHistory(goToPosition(history, at));
    setFen(next);
  }

  /**
   * Walks the list without changing it — what Previous and Next will call.
   * Whether either is available is `canGoPrevious` / `canGoNext`.
   */
  function stepHistory(direction: "previous" | "next") {
    const moved =
      direction === "previous" ? goPrevious(history) : goNext(history);
    setHistory(moved);
    setFen(currentPosition(moved));
  }

  const { position, error } = useMemo(() => parseFen(fen), [fen]);

  // On the document root rather than a wrapper: the frame colour has to reach
  // the whole viewport, and this component only owns part of it.
  useEffect(() => {
    document.documentElement.dataset.theme = options.theme;
  }, [options.theme]);

  // A FEN is unparseable for most of the time it takes to type one, so the
  // board keeps showing the last position that did parse rather than blanking.
  const lastValid = useRef(position);
  if (position !== null) {
    lastValid.current = position;
  }
  const shown = position ?? lastValid.current;

  /** Moves come back from the board as squares; the position that follows is
   *  a new FEN, so editing by hand and playing by hand feed the same state. */
  function handleMove(from: Square, to: Square) {
    if (shown === null) {
      return;
    }
    const next = applyMove(shown, from, to);
    if (next !== null) {
      playPosition(next.fen, next.san);
    }
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Chess Visualizer</h1>
        <button
          type="button"
          className="gear-button"
          aria-label="Options"
          aria-expanded={optionsOpen}
          title="Options"
          onClick={() => setOptionsOpen((open) => !open)}
        >
          <GearIcon />
        </button>
      </header>

      <div className="app-body">
        {/* Left: the board alone, as tall as the window allows. */}
        <section className="board-pane">
          {shown !== null && (
            <Board
              position={shown}
              colors={options.boardColors}
              pieceTint={options.pieceTint}
              attacks={options.attacks}
              onMove={handleMove}
              showGrid={options.showGrid}
              orientation={options.orientation}
            />
          )}
        </section>

        {/* Right: everything else, stacked, in the order it is reached for. */}
        <div className="side-column">
          <div className="board-controls">
            <button
              type="button"
              className="reset-button"
              onClick={() => setPosition(DEFAULT_FEN)}
            >
              Reset to initial position
            </button>
            <button
              type="button"
              className="reset-button step-button"
              title="Previous position"
              aria-label="Previous position"
              disabled={!canGoPrevious(history)}
              onClick={() => stepHistory("previous")}
            >
              <StepIcon direction="previous" />
            </button>
            <button
              type="button"
              className="reset-button step-button"
              title="Next position"
              aria-label="Next position"
              disabled={!canGoNext(history)}
              onClick={() => stepHistory("next")}
            >
              <StepIcon direction="next" />
            </button>
            <button
              type="button"
              className="reset-button"
              title="Paste a game in PGN"
              onClick={() => setPgnOpen(true)}
            >
              Import PGN
            </button>
            <ToggleField
              id="flip-board"
              label="Black at bottom"
              checked={options.orientation === "black"}
              onChange={(flipped) =>
                setOptions({
                  ...options,
                  orientation: flipped ? "black" : "white",
                })
              }
            />
          </div>

          <FenField
            value={fen}
            error={error}
            onChange={enterPosition}
            entries={history.entries}
            current={history.current}
            onSelectPosition={(index) => {
              const moved = goToPosition(history, index);
              setHistory(moved);
              setFen(currentPosition(moved));
            }}
          />

          <FamousPositions value={fen} onSelect={setPosition} />

          {optionsOpen && (
            <OptionsPanel
              options={options}
              defaults={DEFAULT_OPTIONS}
              onChange={setOptions}
            />
          )}
        </div>
      </div>

      <PgnDialog
        open={pgnOpen}
        onSubmit={loadPgn}
        onClose={() => setPgnOpen(false)}
      />
    </main>
  );
}
