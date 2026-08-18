import { useState } from "react";
import AttackTable, { type Side } from "./AttackTable";
import ColorField from "./ColorField";
import NumberField from "./NumberField";
import ToggleField from "./ToggleField";
import {
  DEFAULT_DECAY_PER_BLOCKER,
  DEFAULT_FULL_WIDTH_RAYS,
  DEFAULT_OPTIONS,
  DEFAULT_OUTLINE_WIDTHS,
  DEFAULT_PIECE_TINT,
  DEFAULT_RAY_INNER_SQUARE,
  DEFAULT_RAY_START_CORNER_RADIUS,
  type AttackOptions,
  type BoardColors,
  type Options,
  type OutlineWidths,
  type PieceTint,
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
  // Which side the geometry table edits. Panel state, not a setting.
  const [side, setSide] = useState<Side>("white");

  function updateBoardColors(patch: Partial<BoardColors>) {
    onChange({
      ...options,
      boardColors: { ...options.boardColors, ...patch },
    });
  }

  function updatePieceTint(patch: Partial<PieceTint>) {
    onChange({ ...options, pieceTint: { ...options.pieceTint, ...patch } });
  }

  function updateAttacks(patch: Partial<AttackOptions>) {
    onChange({ ...options, attacks: { ...options.attacks, ...patch } });
  }

  function updateOutlines(patch: Partial<OutlineWidths>) {
    updateAttacks({
      outlineWidths: { ...options.attacks.outlineWidths, ...patch },
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
        <h3>Pieces</h3>
        <p className="options-hint">
          How far each side is pulled from its attack colour: 0 keeps the colour
          exactly, 1 bleaches it to white or black.
        </p>
        <NumberField
          id="piece-lighten"
          label="Lighten White"
          value={options.pieceTint.lighten}
          step={0.05}
          max={1}
          allowZero
          onChange={(lighten) => updatePieceTint({ lighten })}
        />
        <NumberField
          id="piece-darken"
          label="Darken Black"
          value={options.pieceTint.darken}
          step={0.05}
          max={1}
          allowZero
          onChange={(darken) => updatePieceTint({ darken })}
        />
        <button
          type="button"
          className="reset-button"
          onClick={() => onChange({ ...options, pieceTint: DEFAULT_PIECE_TINT })}
        >
          Reset tint
        </button>
      </section>

      <section className="options-group">
        <h3>Board</h3>
        <ToggleField
          id="flip-board"
          label="Black at bottom"
          checked={options.orientation === "black"}
          onChange={(flipped) =>
            onChange({ ...options, orientation: flipped ? "black" : "white" })
          }
        />
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
          id="ray-inner-square"
          label="Inner square side"
          suffix="squares"
          value={options.attacks.rayInnerSquare}
          allowZero
          onChange={(rayInnerSquare) => updateAttacks({ rayInnerSquare })}
        />
        <NumberField
          id="ray-start-corner-radius"
          label="Start corner rounding"
          suffix="squares"
          value={options.attacks.rayStartCornerRadius}
          allowZero
          onChange={(rayStartCornerRadius) =>
            updateAttacks({ rayStartCornerRadius })
          }
        />
        <ToggleField
          id="full-rays"
          label="Full-width rays"
          checked={options.attacks.fullWidthRays}
          onChange={(fullWidthRays) => updateAttacks({ fullWidthRays })}
        />
        <p className="options-hint">
          Keep diagonal rays at full width through the corners where their
          squares meet, spilling onto the squares to either side.
        </p>
        <button
          type="button"
          className="reset-button"
          onClick={() =>
            updateAttacks({
              fullWidthRays: DEFAULT_FULL_WIDTH_RAYS,
              decayPerBlocker: DEFAULT_DECAY_PER_BLOCKER,
              rayInnerSquare: DEFAULT_RAY_INNER_SQUARE,
              rayStartCornerRadius: DEFAULT_RAY_START_CORNER_RADIUS,
            })
          }
        >
          Reset rays
        </button>
      </section>

      <section className="options-group">
        <h3>Sides</h3>
        <NumberField
          id="white-outline-width"
          label="White outline width"
          suffix="milli-squares"
          value={options.attacks.outlineWidths.white}
          step={1}
          allowZero
          onChange={(white) => updateOutlines({ white })}
        />
        <NumberField
          id="black-outline-width"
          label="Black outline width"
          suffix="milli-squares"
          value={options.attacks.outlineWidths.black}
          step={1}
          allowZero
          onChange={(black) => updateOutlines({ black })}
        />
        <p className="options-hint">
          Traced around each side's marks, which otherwise share a colour.
        </p>
        <button
          type="button"
          className="reset-button"
          onClick={() => updateAttacks({ outlineWidths: DEFAULT_OUTLINE_WIDTHS })}
        >
          Reset outlines
        </button>
      </section>

      <AttackTable
        attacks={options.attacks}
        side={side}
        onSideChange={setSide}
        onChange={updateAttacks}
      />
    </aside>
  );
}
