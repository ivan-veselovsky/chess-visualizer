import { useEffect, useRef, useState, type ReactNode } from "react";
import AboutBuild from "./AboutBuild";
import AttackTable from "./AttackTable";
import ColorField from "./ColorField";
import NumberField from "./NumberField";
import NumberInput from "./NumberInput";
import SectionRule from "./SectionRule";
import SelectField from "./SelectField";
import SliderField from "./SliderField";
import ToggleField from "./ToggleField";
import type {
  AttackSettings,
  BoardColors,
  BoardSettings,
  PieceSettings,
  KnightGeometry,
  RayShape,
  Settings,
  RaySettings,
  PieceTint,
  LastMoveMark,
  HedgeLines,
  PinMarks,
  CheckMarks,
  Heatmap,
} from "./settings";
import { logging, setLogging } from "./friend/log";
import { downloadSettings, parseSettings } from "./settingsFile";

/** The two ends of the board, in the order every table here puts them. */
const SIDES = ["me", "opponent"] as const;

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
  onChange: (settings: Settings) => void;
  /**
   * The presets, and everything that can be done with them.
   *
   * The panel draws them and says what was clicked; which preset is in hand,
   * what is saved and what is not are the app's to know. Settings arriving
   * from a file go through `onBring` rather than `onChange`, because they
   * replace what is on the board and may have to be asked about first.
   */
  presets: ReactNode;
  /** What the settings in use are called, which is what an export is named. */
  presetName: string;
  onBring: (settings: Settings) => void;
  /** Whether unsaved settings are asked about before they are thrown away. */
  askBeforeDiscard: boolean;
  onAskBeforeDiscard: (on: boolean) => void;
  /** How many games are put aside, which is what there is to throw away. */
  stashed: number;
  /** Throws all of them away, in this browser rather than in this tab. */
  onForgetStashes: () => void;
}

export default function SettingsPanel({
  group,
  settings,
  onChange,
  presets,
  presetName,
  onBring,
  askBeforeDiscard,
  onAskBeforeDiscard,
  stashed,
  onForgetStashes,
}: SettingsPanelProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  /*
    Whether the button that throws away every stashed game has been pressed
    once.

    Asked in place rather than in a dialog, the way a name already stashed is
    asked about: there is nothing to read and nothing to type, only a second
    press or a step away. Cleared when the pointer leaves it and when the
    keyboard does, so a press left half-made does not sit there waiting to be
    finished by accident.
  */
  const [forgetting, setForgetting] = useState(false);
  /*
    Whether the app is writing down what it does, which is not a setting.

    It is nobody's preference about how a board looks and it does not belong in
    a settings file — exported, mailed to somebody, imported by them, and now
    their console is full of somebody else's debugging. It lives where it acts,
    in this browser, and is read again every time this tab is opened: two tabs
    of the app share the one flag, and the switch should say what is true rather
    than what was true when the page loaded.
  */
  const [writingLog, setWritingLog] = useState(logging);
  useEffect(() => {
    if (group === "manage") {
      setWritingLog(logging());
    }
  }, [group]);
  const [importError, setImportError] = useState<string | null>(null);

  async function readSettingsFile(file: File) {
    const { settings: loaded, error } = parseSettings(await file.text());
    setImportError(error);
    if (loaded !== null) {
      onBring(loaded);
    }
  }

  function updateBoard(patch: Partial<BoardSettings>) {
    onChange({ ...settings, board: { ...settings.board, ...patch } });
  }

  function updatePieces(patch: Partial<PieceSettings>) {
    onChange({ ...settings, pieces: { ...settings.pieces, ...patch } });
  }

  function updateSquares(patch: Partial<BoardColors>) {
    updateBoard({ squares: { ...settings.board.squares, ...patch } });
  }

  function updatePieceTint(patch: Partial<PieceTint>) {
    updatePieces({ tint: { ...settings.pieces.tint, ...patch } });
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
    updateBoard({ lastMove: { ...settings.board.lastMove, ...patch } });
  }

  function updateAttacks(patch: Partial<AttackSettings>) {
    onChange({ ...settings, attacks: { ...settings.attacks, ...patch } });
  }

  function updateRays(patch: Partial<RaySettings>) {
    updateAttacks({ rays: { ...settings.attacks.rays, ...patch } });
  }

  function updateHedging(patch: Partial<HedgeLines>) {
    updateBoard({ hedging: { ...settings.board.hedging, ...patch } });
  }

  function updateHeatmap(patch: Partial<Heatmap>) {
    updateAttacks({
      heatmap: { ...settings.attacks.heatmap, ...patch },
    });
  }

  return (
    <div className={`settings-panel${group === "manage" ? " settings-manage" : ""}`}>
      {group === "board" && (
        <>
          <SectionRule name="Theme" />

          <section className="settings-group">
            <div className="field-row field-row-apart">
              <ToggleField
                id="dark-theme"
                label="Dark theme"
                checked={settings.board.theme === "dark"}
                onChange={(dark) =>
                  updateBoard({ theme: dark ? "dark" : "light" })
                }
              />
              <ColorField
                id="dark-theme-text"
                label="Dark theme text color"
                value={settings.board.darkThemeTextColor}
                onChange={(color) => updateBoard({ darkThemeTextColor: color })}
              />
            </div>
          </section>

          <SectionRule name="Squares" />

          <section className="settings-group">
            <div className="field-row">
              <ColorField
                id="light-square"
                label="Light board squares"
                value={settings.board.squares.lightSquare}
                onChange={(lightSquare) => updateSquares({ lightSquare })}
              />
              <ColorField
                id="dark-square"
                label="Dark board squares"
                value={settings.board.squares.darkSquare}
                onChange={(darkSquare) => updateSquares({ darkSquare })}
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
              checked={settings.board.squares.useLightForDark}
              onChange={(useLightForDark) =>
                updateSquares({ useLightForDark })
              }
            />

            <SectionRule name="Last move" />

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
                value={settings.board.lastMove.color}
                disabled={settings.board.lastMove.negative}
                hint={
                  settings.board.lastMove.negative
                    ? "Not used: the negative circle takes its colour from the squares themselves."
                    : undefined
                }
                onChange={(color) => updateLastMove({ color })}
              />
            </div>
            <div className="field-row field-row-halves">
              <ToggleField
                id="last-move-negative"
                label="Negative square color circle"
                hint="Mark the last move’s two squares with the other square colour — dark on a light square, light on a dark one. A bishop’s two squares then match; a pawn’s are opposites. With “Use light square color for dark squares” on, every circle is the dark square colour, there being only one colour left for it to be the opposite of."
                checked={settings.board.lastMove.negative}
                onChange={(negative) => updateLastMove({ negative })}
              />
              <NumberField
                id="last-move-circle-diameter"
                inline
                label="Last move circle diameter"
                suffix="squares"
                value={settings.board.lastMove.diameter}
                step={0.02}
                allowZero
                hint="How much of the square the mark covers, coloured either way."
                onChange={(diameter) => updateLastMove({ diameter })}
              />
            </div>
          </section>
          <SectionRule name="Hedging" />

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
              checked={settings.board.hedging.show}
              onChange={(show) => updateHedging({ show })}
            />
            <ColorField
              id="hedge-color"
              label="Hedging color"
              value={settings.board.hedging.color}
              onChange={(color) => updateHedging({ color })}
            />
          </div>
          <div className="field-row">
            <NumberField
              id="hedge-angle"
              inline
              label="Hedging angle"
              suffix="degrees"
              hint="Which way the lines run: nought and a hundred and eighty both lie flat, ninety stands upright, and the half turn between them covers every slope there is."
              value={settings.board.hedging.angle}
              step={5}
              max={180}
              allowZero
              onChange={(angle) => updateHedging({ angle })}
            />
            <NumberField
              id="hedge-step"
              inline
              label="Hedging step"
              suffix="squares"
              hint="The gap from one line to the next, as a fraction of a square. Nought draws none."
              value={settings.board.hedging.step}
              step={0.02}
              max={1}
              allowZero
              onChange={(step) => updateHedging({ step })}
            />
          </div>
          <ToggleField
            id="hedge-orthogonal"
            label="Orthogonal"
            hint="Rule a second set of lines across the first, square to it and at the same spacing, so the squares are cross-hatched rather than hatched."
            checked={settings.board.hedging.orthogonal}
            onChange={(orthogonal) => updateHedging({ orthogonal })}
          />
          <SectionRule name="Checkerboard grid" />

          <div className="field-row field-row-apart">
            <ToggleField
              id="show-grid"
              label="Show checkerboard grid"
              checked={settings.board.grid.show}
              onChange={(show) =>
                updateBoard({ grid: { ...settings.board.grid, show } })
              }
            />
            <ColorField
              id="grid-color"
              label="Checkerboard grid color"
              value={settings.board.grid.color}
              onChange={(color) =>
                updateBoard({ grid: { ...settings.board.grid, color } })
              }
            />
          </div>
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
              value={settings.pieces.tint.lightenWhite}
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
              value={settings.pieces.tint.darkenBlack}
              step={0.05}
              max={1}
              allowZero
              onChange={(darkenBlack) => updatePieceTint({ darkenBlack })}
            />
          </div>
          <SectionRule name="Captured pieces" />

          <ToggleField
            id="show-taken-pieces"
            label="Show captured pieces"
            checked={settings.pieces.showCaptured}
            onChange={(showCaptured) => updatePieces({ showCaptured })}
          />

          <SectionRule name="Moves" />

          {/*
            How a piece crosses the board when a move is played.

            Two rates and a slider between them, because neither alone reads
            well: at one speed a one-square move is over before it registers
            while a rook's run is a wait, and at one time a short move crawls.
            The slider says how much of each, and a little of the second pulls
            both ends towards the middle.
          */}
          {/* The two rates at opposite ends of one row, with the slider that
              weighs them against each other running the width of both. */}
          <div className="field-row field-row-ends">
            <NumberField
              id="move-speed"
              inline
              narrow
              label="Move speed"
              suffix="squares/sec"
              hint="How fast a piece travels when speed is what is held. Nought puts it down without moving it, which is why there is no switch beside this."
              value={settings.pieces.moveMotion.speed}
              step={0.5}
              allowZero
              onChange={(speed) =>
                updatePieces({ moveMotion: { ...settings.pieces.moveMotion, speed } })
              }
            />
            <NumberField
              id="move-time"
              inline
              narrow
              label="Move time"
              suffix="seconds"
              hint="How long a move takes when time is what is held, whatever distance it covers."
              value={settings.pieces.moveMotion.time}
              step={0.1}
              allowZero
              onChange={(time) =>
                updatePieces({ moveMotion: { ...settings.pieces.moveMotion, time } })
              }
            />
          </div>
          <SliderField
            id="move-blend"
            from="Constant move speed"
            to="Constant move time"
            value={settings.pieces.moveMotion.blend}
            ticks={[0, 0.5, 1]}
            hint="Which of the two above is held. At the left every move goes at the same rate, so a long one takes longer; at the right every move takes the same time, however far it goes."
            onChange={(blend) =>
              updatePieces({ moveMotion: { ...settings.pieces.moveMotion, blend } })
            }
          />
          {/* Under the two rates and the slider that weighs them: it is not
              about how a piece travels but about how the board catches up with
              it, and it is the last thing on the tab for that reason. */}
          <NumberField
            id="fade-time"
            inline
            narrow
            label="Fade time"
            suffix="ms"
            step={10}
            allowZero
            hint="How long a change to the board's colouring takes to cross: the wash on the squares, the rays, the check disc, the last move's spots, the pin rings. Nought draws every change in the frame it happens, which reads as a flash."
            value={settings.pieces.fadeTimeMs}
            onChange={(fadeTimeMs) => updatePieces({ fadeTimeMs })}
          />
        </section>
      )}

      {group === "rays" && (
        <>
          <AttackTable rays={settings.attacks.rays} onChange={updateRays} />

          <section className="settings-group">
            <NumberField
              id="decay-per-blocker"
              inline
              label="X-ray decay factor"
              suffix="× (0 = no x-ray)"
              value={settings.attacks.rays.xRayDecayFactor}
              allowZero
              max={1}
              onChange={(xRayDecayFactor) => updateRays({ xRayDecayFactor })}
            />
            <SelectField<KnightGeometry>
              id="knight-geometry"
              label="Knight attack geometry"
              hint="How the knight's ring is finished off on each square: cut between two radii, rounded off with a half-disc of the ring's own thickness laid against the square's side, or cut by the square with a tail pointing back at the knight — along the board's lines, or along the radius."
              value={settings.attacks.rays.knightGeometry}
              choices={[
                { value: "arc", label: "Arc" },
                { value: "rounded-arc", label: "Rounded arc" },
                { value: "gamma-1", label: "Gamma 1" },
                { value: "gamma-2", label: "Gamma 2" },
                { value: "straight-ray", label: "Straight ray" },
              ]}
              onChange={(knightGeometry) => updateRays({ knightGeometry })}
            />
            <NumberField
              id="straight-ray-opacity-decay"
              inline
              hint="What the straight-ray geometry's marks are drawn at where they only pass through, on the way to the square they reach — as a factor on that side's attack ray opacity, not an opacity of its own."
              label="Knight straight ray opacity decay"
              suffix="× ray opacity"
              value={settings.attacks.rays.straightRayOpacityDecay}
              step={0.05}
              max={1}
              allowZero
              onChange={(straightRayOpacityDecay) =>
                updateRays({ straightRayOpacityDecay })
              }
            />
            <ToggleField
              id="full-rays"
              hint="Keep diagonal rays at full width through the corners where their squares meet, spilling onto the squares to either side."
              label="Full-width diagonal rays"
              checked={settings.attacks.rays.fullWidthDiagonals}
              onChange={(fullWidthDiagonals) =>
                updateRays({ fullWidthDiagonals })
              }
            />
            <SelectField<RayShape>
              id="ray-shape"
              apart
              label="Ray shape"
              hint="What shape each ray is drawn in: a stripe of one width from end to end, or a needle as wide as that stripe where it leaves the piece and narrowing to a point on the square it attacks — either straight-sided or curved as half an ellipse. A needle is one shape, so a stripe's gap down the middle is ignored while one is chosen."
              value={settings.attacks.rays.shape}
              choices={[
                { value: "stripe", label: "Stripe" },
                { value: "triangle", label: "Triangle needle" },
                { value: "ellipse", label: "Elliptic needle" },
              ]}
              onChange={(shape) => updateRays({ shape })}
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

              Laid out as the rays are: a column a side, so the two ends of the
              board are read against each other rather than one after the
              other. */}
          <table className="stripe-table stripe-table-sides">
            <colgroup>
              <col className="col-setting" />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">Me</th>
                <th scope="col" className="stripe-group-start">
                  Opponent
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Heatmap color</th>
                {SIDES.map((side) => (
                  <td
                    key={side}
                    className={
                      side === "opponent"
                        ? "stripe-table-swatch stripe-group-start"
                        : "stripe-table-swatch"
                    }
                  >
                    <ColorField
                      wellOnly
                      id={`heatmap-${side}`}
                      label={
                        side === "me"
                          ? "My heatmap color"
                          : "Opponent's heatmap color"
                      }
                      value={settings.attacks.heatmap.color[side]}
                      onChange={(color) =>
                        updateHeatmap({
                          color: { ...settings.attacks.heatmap.color, [side]: color },
                        })
                      }
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <th
                  scope="row"
                  title="The most colour one attacker of that side lays down. Each further attacker takes the same share of whatever is left, so a square is never painted solid, and the balance panel takes its own fraction of this."
                >
                  Heatmap max strength
                </th>
                {SIDES.map((side) => (
                  <td
                    key={side}
                    className={side === "opponent" ? "stripe-group-start" : undefined}
                  >
                    <NumberInput
                      id={`${side}-heatmap-strength`}
                      ariaLabel={
                        side === "me"
                          ? "My heatmap max strength"
                          : "Opponent's heatmap max strength"
                      }
                      value={settings.attacks.heatmap.maxStrength[side]}
                      step={0.02}
                      allowZero
                      onChange={(value) =>
                        updateHeatmap({
                          maxStrength: {
                            ...settings.attacks.heatmap.maxStrength,
                            [side]: value,
                          },
                        })
                      }
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
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
              onChange={(checkmateColor) =>
                updateCheckMarks({ checkmateColor })
              }
            />
          </div>
        </section>
      )}

      {group === "manage" && (
        <>
          {/*
            The presets first, because they are what the rest of this tab acts
            on: the settings in use have a name, and everything below — export,
            import, the switch about asking — is about the set that name holds.

            There is no Reset to defaults any more. It restored one hard-coded
            set, which is now a row in this list with a lock on it, and picking
            it is the same act said in the same place as picking any other.
          */}
          {presets}

          {/* Above the two file buttons rather than below them: it is about
              the presets over it — what happens to settings that have nowhere
              to be saved — and not about the files under it. */}
          <div className="board-controls settings-logging settings-ask">
            <ToggleField
              id="ask-before-discard"
              label="Ask before discarding unsaved settings"
              hint="Settings changed on top of a built-in preset have nowhere to be saved. This asks what to do with them before they are replaced. Kept in this browser rather than in the settings."
              checked={askBeforeDiscard}
              onChange={onAskBeforeDiscard}
            />
          </div>

          <div className="settings-footer">
            {/* The two ways settings travel, side by side at one width: see
                `.button-pair`, which the preset buttons above use as well. */}
            <div className="button-pair settings-pair">
              <button
                type="button"
                className="reset-button"
                onClick={() => {
                  setImportError(null);
                  downloadSettings(settings, presetName);
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
            </div>
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

          {/*
            The floor of the panel: what this browser does, and what it was
            built from.

            Held down there rather than following the settings: neither is a
            setting, and a note about the build sitting halfway up a tab reads
            as part of what is above it. The rule over the build note is where
            the settings stop.
          */}
          <div className="settings-tail">
          <div className="board-controls settings-logging">
            {/* At the other end of the line from the switch: one throws
                something away and the other turns something on, and they have
                nothing to do with each other beyond both being about this
                browser rather than about the settings. */}
            <button
              type="button"
              className="reset-button"
              disabled={stashed === 0}
              title={
                stashed === 0
                  ? "Nothing is put aside"
                  : forgetting
                    ? "Press again to throw them all away"
                    : `Throw away all ${stashed} stashed game${stashed === 1 ? "" : "s"}, in this browser`
              }
              onClick={() => {
                if (!forgetting) {
                  setForgetting(true);
                  return;
                }
                setForgetting(false);
                onForgetStashes();
              }}
              onMouseLeave={() => setForgetting(false)}
              onBlur={() => setForgetting(false)}
            >
              {forgetting ? "Remove all stashes?" : "Remove all stashes"}
            </button>
            <ToggleField
              id="client-logging"
              label="Enable client logging"
              hint="Writes what the app is doing to the browser console: lines opened, messages sent and heard, phases changed. Kept in this browser rather than in the settings."
              checked={writingLog}
              onChange={(wanted) => {
                setWritingLog(wanted);
                setLogging(wanted);
              }}
            />
          </div>

          <AboutBuild />
          </div>
        </>
      )}
    </div>
  );
}
