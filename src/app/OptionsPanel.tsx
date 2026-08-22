import { useRef, useState } from "react";
import AboutBuild from "./AboutBuild";
import AttackTable from "./AttackTable";
import ColorField from "./ColorField";
import NumberField from "./NumberField";
import ToggleField from "./ToggleField";
import type {
  AttackOptions,
  BoardColors,
  Options,
  OutlineOpacity,
  RayOpacity,
  PieceTint,
} from "./options";
import { downloadSettings, parseSettings } from "./settingsFile";

interface OptionsPanelProps {
  options: Options;
  /**
   * What Reset restores to. Passed in rather than imported so the panel resets
   * to whichever preset is in force, not to one hard-coded set.
   */
  defaults: Options;
  onChange: (options: Options) => void;
}

export default function OptionsPanel({
  options,
  defaults,
  onChange,
}: OptionsPanelProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function readSettingsFile(file: File) {
    const { options: loaded, error } = parseSettings(await file.text());
    setImportError(error);
    if (loaded !== null) {
      onChange(loaded);
    }
  }

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

  function updateRayOpacity(patch: Partial<RayOpacity>) {
    updateAttacks({
      rayOpacity: { ...options.attacks.rayOpacity, ...patch },
    });
  }

  function updateOutlineOpacity(patch: Partial<OutlineOpacity>) {
    updateAttacks({
      outlineOpacity: { ...options.attacks.outlineOpacity, ...patch },
    });
  }

  return (
    <aside className="options-panel" aria-label="Options">
      <section className="options-group">
        <div className="field-row field-row-apart">
          <ToggleField
            id="dark-theme"
            label="Dark theme"
            checked={options.theme === "dark"}
            onChange={(dark) =>
              onChange({ ...options, theme: dark ? "dark" : "light" })
            }
          />
          <ColorField
            id="dark-theme-text"
            label="Dark theme text color"
            value={options.darkThemeTextColor}
            onChange={(color) =>
              onChange({ ...options, darkThemeTextColor: color })
            }
          />
        </div>
      </section>

      <section className="options-group">
        <div className="field-row">
          <ColorField
            id="light-square"
            label="Light board squares"
            value={options.boardColors.lightSquare}
            onChange={(lightSquare) => updateBoardColors({ lightSquare })}
          />
          <ColorField
            id="dark-square"
            label="Dark board squares"
            value={options.boardColors.darkSquare}
            onChange={(darkSquare) => updateBoardColors({ darkSquare })}
          />
        </div>
        <div className="field-row">
          <ColorField
            id="last-move-color"
            label="Last move highlight color"
            value={options.lastMoveColor}
            onChange={(lastMoveColor) => onChange({ ...options, lastMoveColor })}
          />
          <NumberField
            id="last-move-opacity"
            inline
            label="Last move highlight opacity"
            value={options.lastMoveOpacity}
            step={0.05}
            max={1}
            allowZero
            onChange={(lastMoveOpacity) =>
              onChange({ ...options, lastMoveOpacity })
            }
          />
        </div>
        <ToggleField
          id="show-grid"
          label="Show grid"
          checked={options.showGrid}
          onChange={(showGrid) => onChange({ ...options, showGrid })}
        />
      </section>

      <section className="options-group">
        <div className="field-row">
          <NumberField
            id="piece-lighten"
            inline
            hint="How far each side is pulled from its attack colour: 0 keeps the colour exactly, 1 bleaches it to white or black."
            label="Lighten white pieces"
            value={options.pieceTint.lightenWhite}
            step={0.05}
            max={1}
            allowZero
            onChange={(lightenWhite) => updatePieceTint({ lightenWhite })}
          />
          <NumberField
            id="piece-darken"
            inline
            hint="How far each side is pulled from its attack colour: 0 keeps the colour exactly, 1 bleaches it to white or black."
            label="Darken black pieces"
            value={options.pieceTint.darkenBlack}
            step={0.05}
            max={1}
            allowZero
            onChange={(darkenBlack) => updatePieceTint({ darkenBlack })}
          />
        </div>
      </section>

      <AttackTable attacks={options.attacks} onChange={updateAttacks} />

      <section className="options-group">
        <div className="field-row">
          <NumberField
            id="my-ray-opacity"
            inline
            label="My attack ray opacity"
            value={options.attacks.rayOpacity.me}
            step={0.05}
            max={1}
            allowZero
            onChange={(me) => updateRayOpacity({ me })}
          />
          <NumberField
            id="opponent-ray-opacity"
            inline
            label="Opponent attack ray opacity"
            value={options.attacks.rayOpacity.opponent}
            step={0.05}
            max={1}
            allowZero
            onChange={(opponent) => updateRayOpacity({ opponent })}
          />
        </div>
        <div className="field-row">
          <NumberField
            id="my-outline-opacity"
            inline
            hint="Set apart from the ray's own: rays at 0 with outlines at 1 shows a side as outlines alone."
            label="My outline opacity"
            value={options.attacks.outlineOpacity.me}
            step={0.05}
            max={1}
            allowZero
            onChange={(me) => updateOutlineOpacity({ me })}
          />
          <NumberField
            id="opponent-outline-opacity"
            inline
            hint="Set apart from the ray's own: rays at 0 with outlines at 1 shows a side as outlines alone."
            label="Opponent outline opacity"
            value={options.attacks.outlineOpacity.opponent}
            step={0.05}
            max={1}
            allowZero
            onChange={(opponent) => updateOutlineOpacity({ opponent })}
          />
        </div>
        <NumberField
          id="decay-per-blocker"
          inline
          label="X-ray decay factor"
          suffix="× (0 = no x-ray)"
          value={options.attacks.xRayDecayFactor}
          allowZero
          max={1}
          onChange={(xRayDecayFactor) => updateAttacks({ xRayDecayFactor })}
        />
        <ToggleField
          id="full-rays"
            hint="Keep diagonal rays at full width through the corners where their squares meet, spilling onto the squares to either side."
          label="Full-width diagonal rays"
          checked={options.attacks.fullWidthDiagonalRays}
          onChange={(fullWidthDiagonalRays) => updateAttacks({ fullWidthDiagonalRays })}
        />
        <div className="field-row field-row-halves">
          <ToggleField
            id="show-pins"
            hint="Ring any piece that cannot leave the line it stands on without exposing its own king."
            label="Show pins"
            checked={options.attacks.showPins}
            onChange={(showPins) => updateAttacks({ showPins })}
          />
          <ColorField
            id="pin-ring-color"
            label="Pin ring color"
            value={options.attacks.pinRingColor}
            onChange={(pinRingColor) => updateAttacks({ pinRingColor })}
          />
        </div>
        <NumberField
          id="pin-ring-diameter"
          inline
          label="Pin ring diameter"
          suffix="squares"
          value={options.attacks.pinRingDiameter}
          allowZero
          onChange={(pinRingDiameter) => updateAttacks({ pinRingDiameter })}
        />
        <div className="field-row field-row-halves">
          <ToggleField
            id="show-check"
            hint="Tint the king's own glyph when it stands in check."
            label="Show check"
            checked={options.attacks.showCheck}
            onChange={(showCheck) => updateAttacks({ showCheck })}
          />
          <ColorField
            id="check-color"
            label="Check color"
            value={options.attacks.checkColor}
            onChange={(checkColor) => updateAttacks({ checkColor })}
          />
        </div>
        <div className="field-row field-row-halves">
          <ToggleField
            id="show-checkmate"
            hint="Tint the king's own glyph when it is mated. Takes precedence over check, mate being one as well."
            label="Show checkmate"
            checked={options.attacks.showCheckmate}
            onChange={(showCheckmate) => updateAttacks({ showCheckmate })}
          />
          <ColorField
            id="checkmate-color"
            label="Checkmate color"
            value={options.attacks.checkmateColor}
            onChange={(checkmateColor) => updateAttacks({ checkmateColor })}
          />
        </div>
      </section>



      {/* One reset for the lot. Per-section buttons meant the panel could sit in
          a state no preset describes, half restored and half not. */}
      <div className="options-footer">
        <button
          type="button"
          className="reset-button"
          onClick={() => {
            setImportError(null);
            downloadSettings(options);
          }}
        >
          Export settings
        </button>
        <button
          type="button"
          className="reset-button"
          onClick={() => fileInput.current?.click()}
        >
          Import settings
        </button>
        <button
          type="button"
          className="reset-button options-footer-end"
          onClick={() => {
            setImportError(null);
            onChange(defaults);
          }}
        >
          Reset to defaults
        </button>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so picking the same file twice fires onChange again.
            event.target.value = "";
            if (file !== undefined) {
              void readSettingsFile(file);
            }
          }}
        />

        {importError !== null && (
          <p className="import-error" role="alert">
            {importError}
          </p>
        )}
      </div>

      <AboutBuild />
    </aside>
  );
}
