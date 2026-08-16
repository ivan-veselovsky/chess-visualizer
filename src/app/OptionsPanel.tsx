import ColorField from "./ColorField";
import ToggleField from "./ToggleField";
import { DEFAULT_OPTIONS, type BoardColors, type Options } from "./options";

interface OptionsPanelProps {
  options: Options;
  onChange: (options: Options) => void;
  onClose: () => void;
}

export default function OptionsPanel({
  options,
  onChange,
  onClose,
}: OptionsPanelProps) {
  function updateBoardColors(patch: Partial<BoardColors>) {
    onChange({
      ...options,
      boardColors: { ...options.boardColors, ...patch },
    });
  }

  return (
    <aside className="options-panel" aria-label="Options">
      <div className="options-panel-header">
        <h2>Options</h2>
        <button type="button" aria-label="Close options" onClick={onClose}>
          ×
        </button>
      </div>

      <section className="options-group">
        <h3>Board colors</h3>
        <ColorField
          id="light-square"
          label="Light squares"
          value={options.boardColors.lightSquare}
          onChange={(lightSquare) => updateBoardColors({ lightSquare })}
        />
        <ColorField
          id="dark-square"
          label="Dark squares"
          value={options.boardColors.darkSquare}
          onChange={(darkSquare) => updateBoardColors({ darkSquare })}
        />
        <button
          type="button"
          className="reset-button"
          onClick={() => updateBoardColors(DEFAULT_OPTIONS.boardColors)}
        >
          Reset colors
        </button>
      </section>

      <section className="options-group">
        <h3>Grid</h3>
        <ToggleField
          id="show-grid"
          label="Show grid"
          checked={options.showGrid}
          onChange={(showGrid) => onChange({ ...options, showGrid })}
        />
      </section>
    </aside>
  );
}
