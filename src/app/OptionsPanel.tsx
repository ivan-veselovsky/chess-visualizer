import ColorField from "./ColorField";
import NumberField from "./NumberField";
import StripeFields from "./StripeFields";
import ToggleField from "./ToggleField";
import {
  DEFAULT_BISHOP_STRIPE,
  DEFAULT_DECAY_PER_BLOCKER,
  DEFAULT_KING_STRIPE_WIDTH,
  DEFAULT_KNIGHT_RING,
  DEFAULT_OPTIONS,
  DEFAULT_QUEEN_STRIPE,
  DEFAULT_ROOK_STRIPE,
  type AttackOptions,
  type BoardColors,
  type KnightRingOptions,
  type Options,
  type StripeStyle,
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

  function updateKnightRing(patch: Partial<KnightRingOptions>) {
    updateAttacks({
      knightRing: { ...options.attacks.knightRing, ...patch },
    });
  }

  function updateStripe(
    key: "queenStripe" | "bishopStripe" | "rookStripe",
    patch: Partial<StripeStyle>
  ) {
    updateAttacks({ [key]: { ...options.attacks[key], ...patch } });
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
        <h3>Ray decay</h3>
        <NumberField
          id="decay-per-blocker"
          label="Intensity per blocker"
          suffix="× (0 = no x-ray)"
          value={options.attacks.decayPerBlocker}
          allowZero
          max={1}
          onChange={(decayPerBlocker) => updateAttacks({ decayPerBlocker })}
        />
        <button
          type="button"
          className="reset-button"
          onClick={() =>
            updateAttacks({ decayPerBlocker: DEFAULT_DECAY_PER_BLOCKER })
          }
        >
          Reset decay
        </button>
      </section>

      <section className="options-group">
        <h3>King ring</h3>
        <NumberField
          id="king-stripe-width"
          label="Stripe width"
          suffix="squares"
          value={options.attacks.kingStripeWidth}
          onChange={(kingStripeWidth) => updateAttacks({ kingStripeWidth })}
        />
        <button
          type="button"
          className="reset-button"
          onClick={() =>
            updateAttacks({ kingStripeWidth: DEFAULT_KING_STRIPE_WIDTH })
          }
        >
          Reset width
        </button>
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

      <StripeFields
        id="queen"
        title="Queen stripes"
        value={options.attacks.queenStripe}
        defaults={DEFAULT_QUEEN_STRIPE}
        onChange={(patch) => updateStripe("queenStripe", patch)}
      />

      <StripeFields
        id="bishop"
        title="Bishop stripes"
        value={options.attacks.bishopStripe}
        defaults={DEFAULT_BISHOP_STRIPE}
        onChange={(patch) => updateStripe("bishopStripe", patch)}
      />

      <StripeFields
        id="rook"
        title="Rook stripes"
        value={options.attacks.rookStripe}
        defaults={DEFAULT_ROOK_STRIPE}
        onChange={(patch) => updateStripe("rookStripe", patch)}
      />
    </aside>
  );
}
