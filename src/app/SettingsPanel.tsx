import { useRef, useState } from "react";
import AboutBuild from "./AboutBuild";
import AttackTable from "./AttackTable";
import ColorField from "./ColorField";
import ConfirmDialog from "./ConfirmDialog";
import NumberField from "./NumberField";
import SelectField from "./SelectField";
import ToggleField from "./ToggleField";
import type {
  AttackSettings,
  BoardColors,
  KnightGeometry,
  Settings,
  OutlineOpacity,
  RayOpacity,
  PieceTint,
  SquareShading,
} from "./settings";
import { downloadSettings, parseSettings } from "./settingsFile";

interface SettingsPanelProps {
  settings: Settings;
  /**
   * What Reset restores to. Passed in rather than imported so the panel resets
   * to whichever preset is in force, not to one hard-coded set.
   */
  defaults: Settings;
  onChange: (settings: Settings) => void;
}

export default function SettingsPanel({
  settings,
  defaults,
  onChange,
}: SettingsPanelProps) {
  /** Asked when shading goes on and the board is still a checkerboard. */
  const [askPlainBoard, setAskPlainBoard] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function readSettingsFile(file: File) {
    const { settings: loaded, error } = parseSettings(await file.text());
    setImportError(error);
    if (loaded !== null) {
      onChange(loaded);
    }
  }

  function updateBoardColors(patch: Partial<BoardColors>) {
    onChange({
      ...settings,
      boardColors: { ...settings.boardColors, ...patch },
    });
  }

  function updatePieceTint(patch: Partial<PieceTint>) {
    onChange({ ...settings, pieceTint: { ...settings.pieceTint, ...patch } });
  }

  function updateAttacks(patch: Partial<AttackSettings>) {
    onChange({ ...settings, attacks: { ...settings.attacks, ...patch } });
  }

  function updateRayOpacity(patch: Partial<RayOpacity>) {
    updateAttacks({
      rayOpacity: { ...settings.attacks.rayOpacity, ...patch },
    });
  }

  function updateOutlineOpacity(patch: Partial<OutlineOpacity>) {
    updateAttacks({
      outlineOpacity: { ...settings.attacks.outlineOpacity, ...patch },
    });
  }

  function updateShading(patch: Partial<SquareShading>) {
    updateAttacks({
      squareShading: { ...settings.attacks.squareShading, ...patch },
    });
    /*
      Shading colours whole squares, and a checkerboard underneath gives every
      colour two readings. Worth offering to flatten — and worth asking rather
      than doing, since the board's colours are the reader's own setting. Either
      side going on raises the question; both being off again does not put the
      board back, the reader having answered it once.
    */
    if (
      (patch.showMine === true || patch.showOpponent === true) &&
      settings.boardColors.darkSquare !== settings.boardColors.lightSquare
    ) {
      setAskPlainBoard(true);
    }
  }

  return (
    <aside className="settings-panel" aria-label="Settings">
      <ConfirmDialog
        open={askPlainBoard}
        question="Make both board squares the same colour?"
        detail={`Shading colours the squares themselves, and a checkerboard under it gives each colour two readings. This sets the dark squares to ${settings.boardColors.lightSquare}, the colour the light ones already are.`}
        confirmLabel="Make them plain"
        dismissLabel="Keep the checkerboard"
        onConfirm={() =>
          updateBoardColors({ darkSquare: settings.boardColors.lightSquare })
        }
        onClose={() => setAskPlainBoard(false)}
      />

      <section className="settings-group">
        <div className="field-row field-row-apart">
          <ToggleField
            id="dark-theme"
            label="Dark theme"
            checked={settings.theme === "dark"}
            onChange={(dark) =>
              onChange({ ...settings, theme: dark ? "dark" : "light" })
            }
          />
          <ColorField
            id="dark-theme-text"
            label="Dark theme text color"
            value={settings.darkThemeTextColor}
            onChange={(color) =>
              onChange({ ...settings, darkThemeTextColor: color })
            }
          />
        </div>
      </section>

      <section className="settings-group">
        <div className="field-row">
          <ColorField
            id="light-square"
            label="Light board squares"
            value={settings.boardColors.lightSquare}
            onChange={(lightSquare) => updateBoardColors({ lightSquare })}
          />
          <ColorField
            id="dark-square"
            label="Dark board squares"
            value={settings.boardColors.darkSquare}
            onChange={(darkSquare) => updateBoardColors({ darkSquare })}
          />
        </div>
        <div className="field-row">
          <ColorField
            id="last-move-color"
            label="Last move highlight color"
            value={settings.lastMoveColor}
            onChange={(lastMoveColor) => onChange({ ...settings, lastMoveColor })}
          />
          <NumberField
            id="last-move-opacity"
            inline
            label="Last move highlight opacity"
            value={settings.lastMoveOpacity}
            step={0.05}
            max={1}
            allowZero
            onChange={(lastMoveOpacity) =>
              onChange({ ...settings, lastMoveOpacity })
            }
          />
        </div>
        <div className="field-row field-row-apart">
          <ToggleField
            id="show-grid"
            label="Show grid"
            checked={settings.showGrid}
            onChange={(showGrid) => onChange({ ...settings, showGrid })}
          />
          <ColorField
            id="grid-color"
            label="Grid color"
            value={settings.gridColor}
            onChange={(gridColor) => onChange({ ...settings, gridColor })}
          />
        </div>
        <ToggleField
          id="show-taken-pieces"
          label="Show taken pieces"
          checked={settings.showTakenPieces}
          onChange={(showTakenPieces) =>
            onChange({ ...settings, showTakenPieces })
          }
        />
      </section>

      <section className="settings-group">
        <div className="field-row">
          <NumberField
            id="piece-lighten"
            inline
            hint="How far each side is pulled from its attack colour: 0 keeps the colour exactly, 1 bleaches it to white or black."
            label="Lighten white pieces"
            value={settings.pieceTint.lightenWhite}
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
            value={settings.pieceTint.darkenBlack}
            step={0.05}
            max={1}
            allowZero
            onChange={(darkenBlack) => updatePieceTint({ darkenBlack })}
          />
        </div>
      </section>

      <AttackTable attacks={settings.attacks} onChange={updateAttacks} />

      <section className="settings-group">
        <div className="field-row">
          <NumberField
            id="my-ray-opacity"
            inline
            label="My attack ray opacity"
            value={settings.attacks.rayOpacity.me}
            step={0.05}
            max={1}
            allowZero
            onChange={(me) => updateRayOpacity({ me })}
          />
          <NumberField
            id="opponent-ray-opacity"
            inline
            label="Opponent attack ray opacity"
            value={settings.attacks.rayOpacity.opponent}
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
            value={settings.attacks.outlineOpacity.me}
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
            value={settings.attacks.outlineOpacity.opponent}
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
          value={settings.attacks.xRayDecayFactor}
          allowZero
          max={1}
          onChange={(xRayDecayFactor) => updateAttacks({ xRayDecayFactor })}
        />
        <SelectField<KnightGeometry>
          id="knight-geometry"
          label="Knight attack geometry"
          hint="How the knight's ring is finished off on each square: cut between two radii, or cut by the square with a tail pointing back at the knight — along the board's lines, or along the radius."
          value={settings.attacks.knightGeometry}
          choices={[
            { value: "arc", label: "Arc" },
            { value: "gamma-1", label: "Gamma 1" },
            { value: "gamma-2", label: "Gamma 2" },
            { value: "straight-ray", label: "Straight ray" },
          ]}
          onChange={(knightGeometry) => updateAttacks({ knightGeometry })}
        />
        <NumberField
          id="straight-ray-opacity-decay"
          inline
          hint="What the straight-ray geometry's marks are drawn at where they only pass through, on the way to the square they reach — as a factor on that side's attack ray opacity, not an opacity of its own."
          label="Knight straight ray opacity decay"
          suffix="× ray opacity"
          value={settings.attacks.straightRayOpacityDecay}
          step={0.05}
          max={1}
          allowZero
          onChange={(straightRayOpacityDecay) =>
            updateAttacks({ straightRayOpacityDecay })
          }
        />
        <ToggleField
          id="full-rays"
            hint="Keep diagonal rays at full width through the corners where their squares meet, spilling onto the squares to either side."
          label="Full-width diagonal rays"
          checked={settings.attacks.fullWidthDiagonalRays}
          onChange={(fullWidthDiagonalRays) => updateAttacks({ fullWidthDiagonalRays })}
        />
        <div className="field-row field-row-halves">
          <ToggleField
            id="show-pins"
            hint="Ring any piece that cannot leave the line it stands on without exposing its own king."
            label="Show pins"
            checked={settings.attacks.showPins}
            onChange={(showPins) => updateAttacks({ showPins })}
          />
          <ColorField
            id="pin-ring-color"
            label="Pin ring color"
            value={settings.attacks.pinRingColor}
            onChange={(pinRingColor) => updateAttacks({ pinRingColor })}
          />
        </div>
        <NumberField
          id="pin-ring-diameter"
          inline
          label="Pin ring diameter"
          suffix="squares"
          value={settings.attacks.pinRingDiameter}
          allowZero
          onChange={(pinRingDiameter) => updateAttacks({ pinRingDiameter })}
        />
        <div className="field-row field-row-halves">
          <ToggleField
            id="show-check"
            hint="Tint the king's own glyph when it stands in check."
            label="Show check"
            checked={settings.attacks.showCheck}
            onChange={(showCheck) => updateAttacks({ showCheck })}
          />
          <ColorField
            id="check-color"
            label="Check color"
            value={settings.attacks.checkColor}
            onChange={(checkColor) => updateAttacks({ checkColor })}
          />
        </div>
        <div className="field-row field-row-halves">
          <ToggleField
            id="show-checkmate"
            hint="Tint the king's own glyph when it is mated. Takes precedence over check, mate being one as well."
            label="Show checkmate"
            checked={settings.attacks.showCheckmate}
            onChange={(showCheckmate) => updateAttacks({ showCheckmate })}
          />
          <ColorField
            id="checkmate-color"
            label="Checkmate color"
            value={settings.attacks.checkmateColor}
            onChange={(checkmateColor) => updateAttacks({ checkmateColor })}
          />
        </div>
      </section>



      {/*
        Kept apart, and last: this is a way of reading the whole board rather
        than a setting for the marks on it, and grouping it with them would
        suggest it were one more of them.
      */}
      <hr className="settings-divider" />

      <section className="settings-group">
        {/* A different question from the rays, and shown independently: the
            rays say where a piece can go, this says how contested a square is.
            Each side has a switch of its own: both together say who holds a
            square, one alone says how far that side reaches.

            Laid out in two columns, mine and the opponent's, so that each
            side's switch and the colour it lays down read as one thing. */}
        <div className="field-row field-row-halves">
          <ToggleField
            id="shade-mine"
            hint="Colour every square my men cover, more strongly where more of them cover it."
            label="Shade squares attacked by my pieces"
            checked={settings.attacks.squareShading.showMine}
            onChange={(showMine) => updateShading({ showMine })}
          />
          <ToggleField
            id="shade-theirs"
            hint="The same for the other end of the board. With both on, a square takes a blend of the two, weighted by how many attackers each side has."
            label="Shade squares attacked by opponent"
            checked={settings.attacks.squareShading.showOpponent}
            onChange={(showOpponent) => updateShading({ showOpponent })}
          />
        </div>
        <div className="field-row field-row-shade-colors">
          <ColorField
            id="shade-me"
            label="My shading color"
            value={settings.attacks.squareShading.me}
            onChange={(me) => updateShading({ me })}
          />
          <ColorField
            id="shade-opponent"
            label="Opponent's shading color"
            value={settings.attacks.squareShading.opponent}
            onChange={(opponent) => updateShading({ opponent })}
          />
        </div>
        <NumberField
          id="shade-strength"
          inline
          hint="How much colour one attacker lays down. Each further attacker takes the same share of whatever is left, so a square is never painted solid."
          label="Shading strength"
          value={settings.attacks.squareShading.strength}
          step={0.02}
          max={1}
          allowZero
          onChange={(strength) => updateShading({ strength })}
        />
      </section>

      {/* One reset for the lot. Per-section buttons meant the panel could sit in
          a state no preset describes, half restored and half not. */}
      <div className="settings-footer">
        <button
          type="button"
          className="reset-button"
          onClick={() => {
            setImportError(null);
            downloadSettings(settings);
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
          className="reset-button settings-footer-end"
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
