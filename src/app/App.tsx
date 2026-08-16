import { useState } from "react";
import { chess } from "../chess/position";
import Board from "../visualization/Board";
import GearIcon from "./GearIcon";
import OptionsPanel from "./OptionsPanel";
import { DEFAULT_OPTIONS, type Options } from "./options";

export default function App() {
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [optionsOpen, setOptionsOpen] = useState(false);

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
          <Board
            position={chess}
            colors={options.boardColors}
            showGrid={options.showGrid}
          />
          <p className="fen">{chess.fen()}</p>
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
