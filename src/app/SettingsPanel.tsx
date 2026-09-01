import { useRef, useState } from "react";
import AboutBuild from "./AboutBuild";
import AttackTable from "./AttackTable";
import ColorField from "./ColorField";
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
  LastMoveMark,
  HedgeLines,
  PinMarks,
  CheckMarks,
  Heatmap,
} from "./settings";
import { downloadSettings, parseSettings } from "./settingsFile";

/**
 * Which group of settings is on show. One at a time: the panel used to be a
 * single scroll of every setting there is, which made the one being looked for
 * a matter of remembering how far down it was.
 */
export type SettingsGroup =
  | "board"
  | "pieces"
  | "rays"
  | "pins"
  | "heatmap"
  | "check"
  | "manage";

interface SettingsPanelProps {
  group: SettingsGroup;
  settings: Settings;
  /**
   * What Reset restores to. Passed in rather than imported so the panel resets
   * to whichever preset is in force, not to one hard-coded set.
   */
  defaults: Settings;
  onChange: (settings: Settings) => void;
}

export default function SettingsPanel({
  group,
  settings,
  defaults,
  onChange,
}: SettingsPanelProps) {
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

  function updatePins(patch: Partial<PinMarks>) {
    updateAttacks({ pins: { ...settings.attacks.pins, ...patch } });
  }

  function updateCheckMarks(patch: Partial<CheckMarks>) {
    updateAttacks({
      checkAndCheckmate: { ...settings.attacks.checkAndCheckmate, ...patch },
    });
  }

  function updateLastMove(patch: Partial<LastMoveMark>) {
    onChange({ ...settings, lastMove: { ...settings.lastMove, ...patch } });
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

  function updateHedge(patch: Partial<HedgeLines>) {
    onChange({ ...settings, hedge: { ...settings.hedge, ...patch } });
  }

  function updateHeatmap(patch: Partial<Heatmap>) {
    updateAttacks({
      heatmap: { ...settings.attacks.heatmap, ...patch },
    });
  }

  return (
    <div className="settings-panel">
      {group === "board" && (
        <>
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

        <hr className="panel-divider" />

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
          {/*
          {/*
            Kept with the two colours it stands between, because that is what it
            does: it draws the board in the light one throughout, leaving the
            dark colour set but unused.
          */}
          <ToggleField
            id="use-light-for-dark"
            label="Use light square color for dark squares"
            hint="Draw the whole board in the light squares' colour, so a shade means the same thing on every square. The dark colour is kept and comes back when this is turned off."
            checked={settings.boardColors.useLightForDark}
            onChange={(useLightForDark) => updateBoardColors({ useLightForDark })}
          />

          <hr className="panel-divider" />

          {/*
            Hatching over the dark squares: a way of telling the two colours
            apart without a second colour. It earns its place when the board is
            drawn in one — a heatmap wash over a checkerboard reads as two
            different washes, while hatching under the wash leaves it alone and
            still says which squares are which.
          */}
          <div className="field-row field-row-apart">
            <ToggleField
              id="hedge-dark"
              label="Hedge dark squares"
              hint="Rule the dark squares with fine parallel lines, so they can be told from the light ones without being a different colour."
              checked={settings.hedge.show}
              onChange={(show) => updateHedge({ show })}
            />
            <ColorField
              id="hedge-color"
              label="Hedging color"
              value={settings.hedge.color}
              onChange={(color) => updateHedge({ color })}
            />
          </div>
          <div className="field-row">
            <NumberField
              id="hedge-angle"
              inline
              label="Hedging angle"
              suffix="degrees"
              hint="Which way the lines run: nought and a hundred and eighty both lie flat, ninety stands upright, and the half turn between them covers every slope there is."
              value={settings.hedge.angle}
              step={5}
              max={180}
              allowZero
              onChange={(angle) => updateHedge({ angle })}
            />
            <NumberField
              id="hedge-step"
              inline
              label="Hedging step"
              suffix="squares"
              hint="The gap from one line to the next, as a fraction of a square. Nought draws none."
              value={settings.hedge.step}
              step={0.02}
              max={1}
              allowZero
              onChange={(step) => updateHedge({ step })}
            />
          </div>
          <ToggleField
            id="hedge-orthogonal"
            label="Orthogonal"
            hint="Rule a second set of lines across the first, square to it and at the same spacing, so the squares are cross-hatched rather than hatched."
            checked={settings.hedge.orthogonal}
            onChange={(orthogonal) => updateHedge({ orthogonal })}
          />
          <div className="field-row field-row-apart">
            <ToggleField
              id="show-grid"
              label="Show grid"
              checked={settings.grid.show}
              onChange={(show) =>
                onChange({ ...settings, grid: { ...settings.grid, show } })
              }
            />
            <ColorField
              id="grid-color"
              label="Grid color"
              value={settings.grid.color}
              onChange={(color) =>
                onChange({ ...settings, grid: { ...settings.grid, color } })
              }
            />
          </div>
          <hr className="panel-divider" />

          {/*
            The negative mark takes the place of the colour and the wash rather
            than sitting beside them, so both are shown greyed while it is on and
            say why on hover. Greyed rather than gone: a setting that vanishes
            leaves the reader wondering whether they imagined it.
          */}
          <div className="field-row">
            <ColorField
              id="last-move-color"
              label="Last move highlight color"
              value={settings.lastMove.color}
              disabled={settings.lastMove.negative}
              hint={
                settings.lastMove.negative
                  ? "Not used: the negative circle takes its colour from the squares themselves."
                  : undefined
              }
              onChange={(color) => updateLastMove({ color })}
            />
            <NumberField
              id="last-move-opacity"
              inline
              label="Last move highlight opacity"
              value={settings.lastMove.opacity}
              step={0.05}
              max={1}
              allowZero
              disabled={settings.lastMove.negative}
              hint={
                settings.lastMove.negative
                  ? "Not used: a circle half the other square's colour is not the other square's colour."
                  : undefined
              }
              onChange={(opacity) => updateLastMove({ opacity })}
            />
          </div>
          <div className="field-row field-row-halves">
            <ToggleField
              id="last-move-negative"
              label="Negative square color circle"
              hint="Mark the last move’s two squares with the other square colour — dark on a light square, light on a dark one. A bishop’s two squares then match; a pawn’s are opposites. With “Use light square color for dark squares” on, every circle is the dark square colour, there being only one colour left for it to be the opposite of."
              checked={settings.lastMove.negative}
              onChange={(negative) => updateLastMove({ negative })}
            />
            <NumberField
              id="last-move-circle-diameter"
              inline
              label="Last move circle diameter"
              suffix="squares"
              value={settings.lastMove.diameter}
              step={0.02}
              allowZero
              hint="How much of the square the mark covers, coloured either way."
              onChange={(diameter) => updateLastMove({ diameter })}
            />
          </div>
        </section>
        </>
      )}

      {group === "pieces" && (
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
          <ToggleField
            id="show-taken-pieces"
            label="Show taken pieces"
            checked={settings.showCapturedPiecesBar}
            onChange={(showCapturedPiecesBar) =>
              onChange({ ...settings, showCapturedPiecesBar })
            }
          />
        </section>
      )}

      {group === "rays" && (
        <>
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
        </section>
        </>
      )}

      {group === "pins" && (
        <section className="settings-group">
          <div className="field-row field-row-halves">
            <ToggleField
              id="show-pins"
              hint="Ring any piece that cannot leave the line it stands on without exposing its own king."
              label="Show pins"
              checked={settings.attacks.pins.show}
              onChange={(show) => updatePins({ show })}
            />
            <ColorField
              id="pin-ring-color"
              label="Pin ring color"
              value={settings.attacks.pins.ringColor}
              onChange={(ringColor) => updatePins({ ringColor })}
            />
          </div>
          <NumberField
            id="pin-ring-diameter"
            inline
            label="Pin ring diameter"
            suffix="squares"
            value={settings.attacks.pins.ringDiameter}
            allowZero
            onChange={(ringDiameter) => updatePins({ ringDiameter })}
          />
        </section>
      )}

      {group === "heatmap" && (
        <section className="settings-group">
          {/* The heatmap's own pair sits on the balance tab, where it is read
              with a position. What is left here is how it looks — chosen once
              and then left alone.

              Drawing the board in one colour used to stand here too, since it
              is the heatmap that most wants it. It has gone to the board's own
              tab, beside the two colours it chooses between, and the balance
              tab can turn it on and off by itself.

              The two colours are laid out in two columns, mine and the
              opponent's, matching the order of the choosers out there. */}
          <div className="field-row field-row-heatmap-colors">
            <ColorField
              id="heatmap-me"
              label="My heatmap color"
              value={settings.attacks.heatmap.myColor}
              onChange={(myColor) => updateHeatmap({ myColor })}
            />
            <ColorField
              id="heatmap-opponent"
              label="Opponent's heatmap color"
              value={settings.attacks.heatmap.opponentColor}
              onChange={(opponentColor) => updateHeatmap({ opponentColor })}
            />
          </div>
          {/* One apiece, laid out as the rays' opacities are: the two ends of
              the board are not always worth reading at the same weight. */}
          <div className="field-row">
            <NumberField
              id="my-heatmap-strength"
              inline
              hint="How much colour one of my attackers lays down. Each further attacker takes the same share of whatever is left, so a square is never painted solid."
              label="My heatmap strength"
              value={settings.attacks.heatmap.strength.me}
              step={0.02}
              max={1}
              allowZero
              onChange={(me) =>
                updateHeatmap({
                  strength: { ...settings.attacks.heatmap.strength, me },
                })
              }
            />
            <NumberField
              id="opponent-heatmap-strength"
              inline
              hint="The same for the other end of the board."
              label="Opponent's heatmap strength"
              value={settings.attacks.heatmap.strength.opponent}
              step={0.02}
              max={1}
              allowZero
              onChange={(opponent) =>
                updateHeatmap({
                  strength: { ...settings.attacks.heatmap.strength, opponent },
                })
              }
            />
          </div>
        </section>
      )}

      {group === "check" && (
        <section className="settings-group">
          <div className="field-row field-row-halves">
            <ToggleField
              id="show-check"
              hint="Tint the king's own glyph when it stands in check."
              label="Show check"
              checked={settings.attacks.checkAndCheckmate.showCheck}
              onChange={(showCheck) => updateCheckMarks({ showCheck })}
            />
            <ColorField
              id="check-color"
              label="Check color"
              value={settings.attacks.checkAndCheckmate.checkColor}
              onChange={(checkColor) => updateCheckMarks({ checkColor })}
            />
          </div>
          <div className="field-row field-row-halves">
            <ToggleField
              id="show-checkmate"
              hint="Tint the king's own glyph when it is mated. Takes precedence over check, mate being one as well."
              label="Show checkmate"
              checked={settings.attacks.checkAndCheckmate.showCheckmate}
              onChange={(showCheckmate) => updateCheckMarks({ showCheckmate })}
            />
            <ColorField
              id="checkmate-color"
              label="Checkmate color"
              value={settings.attacks.checkAndCheckmate.checkmateColor}
              onChange={(checkmateColor) => updateCheckMarks({ checkmateColor })}
            />
          </div>
        </section>
      )}

      {/* One reset for the lot. Per-section buttons meant the panel could sit in
          a state no preset describes, half restored and half not. */}
      {group === "manage" && (
        <>
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
        </>
      )}
    </div>
  );
}
