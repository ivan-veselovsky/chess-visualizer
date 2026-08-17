import AttackTable from "./AttackTable";
import ColorField from "./ColorField";
import NumberField from "./NumberField";
import ToggleField from "./ToggleField";
import {
  DEFAULT_DECAY_PER_BLOCKER,
  DEFAULT_OPTIONS,
  DEFAULT_RAY_INNER_RADIUS,
  DEFAULT_RAY_INNER_SQUARE,
  type AttackOptions,
  type BoardColors,
  type Options,
} from "./options";

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

  function updateAttacks(patch: Partial<AttackOptions>) {
    onChange({ ...options, attacks: { ...options.attacks, ...patch } });
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

      <section className="options-group">
        <h3>Rays</h3>
        <NumberField
          id="decay-per-blocker"
          label="Intensity per blocker"
          suffix="× (0 = no x-ray)"
          value={options.attacks.decayPerBlocker}
          allowZero
          max={1}
          onChange={(decayPerBlocker) => updateAttacks({ decayPerBlocker })}
        />
        <NumberField
          id="ray-inner-radius"
          label="Inner circle radius"
          suffix="squares"
          value={options.attacks.rayInnerRadius}
          allowZero
          onChange={(rayInnerRadius) => updateAttacks({ rayInnerRadius })}
        />
        <NumberField
          id="ray-inner-square"
          label="Inner square side"
          suffix="squares"
          value={options.attacks.rayInnerSquare}
          allowZero
          onChange={(rayInnerSquare) => updateAttacks({ rayInnerSquare })}
        />
        <button
          type="button"
          className="reset-button"
          onClick={() =>
            updateAttacks({
              decayPerBlocker: DEFAULT_DECAY_PER_BLOCKER,
              rayInnerRadius: DEFAULT_RAY_INNER_RADIUS,
              rayInnerSquare: DEFAULT_RAY_INNER_SQUARE,
            })
          }
        >
          Reset rays
        </button>
      </section>

      <AttackTable attacks={options.attacks} onChange={updateAttacks} />
    </aside>
  );
}
