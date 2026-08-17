import { useMemo, useRef, useState } from "react";
import { SAMPLE_FEN, parseFen } from "../chess/position";
import Board from "../visualization/Board";
import FenField from "./FenField";
import GearIcon from "./GearIcon";
import OptionsPanel from "./OptionsPanel";
import { DEFAULT_OPTIONS, type Options } from "./options";

export default function App() {
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [fen, setFen] = useState(SAMPLE_FEN);

  const { position, error } = useMemo(() => parseFen(fen), [fen]);

  // A FEN is unparseable for most of the time it takes to type one, so the
  // board keeps showing the last position that did parse rather than blanking.
  const lastValid = useRef(position);
  if (position !== null) {
    lastValid.current = position;
  }
  const shown = position ?? lastValid.current;

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
              attacks={options.attacks}
              showGrid={options.showGrid}
            />
          )}
          <FenField
            value={fen}
            error={error}
            onChange={setFen}
            onReset={() => setFen(SAMPLE_FEN)}
          />
        </section>

        {optionsOpen && (
          <OptionsPanel
            options={options}
            onChange={setOptions}
            onClose={() => setOptionsOpen(false)}
          />
        )}
      </div>
    </main>
  );
}
