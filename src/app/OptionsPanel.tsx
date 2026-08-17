import ColorField from "./ColorField";
import NumberField from "./NumberField";
import ToggleField from "./ToggleField";
import {
  DEFAULT_KNIGHT_RING,
  DEFAULT_OPTIONS,
  type BoardColors,
  type KnightRingOptions,
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

  function updateKnightRing(patch: Partial<KnightRingOptions>) {
    onChange({
      ...options,
      attacks: {
        ...options.attacks,
        knightRing: { ...options.attacks.knightRing, ...patch },
      },
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

      <section className="options-group">
        <h3>Knight ring</h3>
        <NumberField
          id="knight-inner-radius"
          label="Inner radius"
          suffix="squares"
          value={options.attacks.knightRing.innerRadius}
          onChange={(innerRadius) => updateKnightRing({ innerRadius })}
        />
        <NumberField
          id="knight-outer-radius"
          label="Outer radius"
          suffix="squares"
          value={options.attacks.knightRing.outerRadius}
          onChange={(outerRadius) => updateKnightRing({ outerRadius })}
        />
        <button
          type="button"
          className="reset-button"
          onClick={() => updateKnightRing(DEFAULT_KNIGHT_RING)}
        >
          Reset radii
        </button>
      </section>
    </aside>
  );
}
