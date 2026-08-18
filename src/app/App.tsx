import { useEffect, useMemo, useRef, useState } from "react";
import type { Square } from "chess.js";
import { applyMove } from "../chess/moves";
import { DEFAULT_FEN, parseFen } from "../chess/position";
import Board from "../visualization/Board";
import FenField from "./FenField";
import GearIcon from "./GearIcon";
import OptionsPanel from "./OptionsPanel";
import ToggleField from "./ToggleField";
import type { Options } from "./options";
import { DEFAULT_OPTIONS } from "./presets";

export default function App() {
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [fen, setFen] = useState(DEFAULT_FEN);

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
      setFen(next);
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
          <div className="board-controls">
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
            <ToggleField
              id="dark-theme"
              label="Dark theme"
              checked={options.theme === "dark"}
              onChange={(dark) =>
                setOptions({ ...options, theme: dark ? "dark" : "light" })
              }
            />
          </div>
          <FenField
            value={fen}
            error={error}
            onChange={setFen}
            onReset={() => setFen(DEFAULT_FEN)}
          />
        </section>

        {optionsOpen && (
          <OptionsPanel
            options={options}
            defaults={DEFAULT_OPTIONS}
            onChange={setOptions}
          />
        )}
      </div>
    </main>
  );
}
