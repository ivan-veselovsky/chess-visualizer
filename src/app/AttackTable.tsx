import NumberInput from "./NumberInput";
import {
  DEFAULT_ATTACK_COLORS,
  DEFAULT_BISHOP_STRIPE,
  DEFAULT_KING_STRIPE,
  DEFAULT_KNIGHT_RING,
  DEFAULT_PAWN_MARK_WIDTH,
  DEFAULT_QUEEN_STRIPE,
  DEFAULT_ROOK_STRIPE,
  type AttackColors,
  type AttackOptions,
  type StripeStyle,
} from "./options";

interface AttackTableProps {
  attacks: AttackOptions;
  onChange: (patch: Partial<AttackOptions>) => void;
}

/** One editable number in the table. */
interface Cell {
  value: number;
  label: string;
  allowZero?: boolean;
  onChange: (value: number) => void;
}

interface Row {
  key: string;
  piece: string;
  /** Which entry of AttackColors this row tints. */
  color: keyof AttackColors;
  /** Absent for the shapes that have no inner boundary. */
  inner?: Cell;
  outer: Cell;
}

/**
 * Every attack dimension in one table, a row per piece. Lining the pieces up
 * makes it easy to see which shape nests inside which, which is the whole point
 * of tuning them against each other.
 *
 * The columns mean the same thing throughout — an inner and an outer boundary —
 * even though that is a pair of stripe widths for the sliding pieces and a pair
 * of radii for the knight. The king's ring and the pawn's mark are single
 * strokes, so they have an outer value only.
 */
export default function AttackTable({ attacks, onChange }: AttackTableProps) {
  function stripeRow(
    key: "kingStripe" | "queenStripe" | "bishopStripe" | "rookStripe",
    piece: string,
    color: keyof AttackColors
  ): Row {
    function update(patch: Partial<StripeStyle>) {
      onChange({ [key]: { ...attacks[key], ...patch } });
    }
    return {
      key,
      piece,
      color,
      inner: {
        value: attacks[key].innerWidth,
        label: `${piece} inner width`,
        allowZero: true,
        onChange: (innerWidth) => update({ innerWidth }),
      },
      outer: {
        value: attacks[key].outerWidth,
        label: `${piece} outer width`,
        onChange: (outerWidth) => update({ outerWidth }),
      },
    };
  }

  function setColor(key: keyof AttackColors, value: string) {
    onChange({ colors: { ...attacks.colors, [key]: value } });
  }

  function updateKnightRing(patch: Partial<typeof attacks.knightRing>) {
    onChange({ knightRing: { ...attacks.knightRing, ...patch } });
  }

  const rows: Row[] = [
    stripeRow("kingStripe", "King", "king"),
    stripeRow("queenStripe", "Queen", "queen"),
    stripeRow("rookStripe", "Rook", "rook"),
    stripeRow("bishopStripe", "Bishop", "bishop"),
    {
      key: "knight",
      piece: "Knight",
      color: "knight",
      inner: {
        value: attacks.knightRing.innerRadius,
        label: "Knight inner radius",
        allowZero: true,
        onChange: (innerRadius) => updateKnightRing({ innerRadius }),
      },
      outer: {
        value: attacks.knightRing.outerRadius,
        label: "Knight outer radius",
        onChange: (outerRadius) => updateKnightRing({ outerRadius }),
      },
    },
    {
      key: "pawn",
      piece: "Pawn",
      color: "pawn",
      outer: {
        value: attacks.pawnMarkWidth,
        label: "Pawn mark width",
        onChange: (pawnMarkWidth) => onChange({ pawnMarkWidth }),
      },
    },
  ];

  function resetAll() {
    onChange({
      colors: DEFAULT_ATTACK_COLORS,
      kingStripe: DEFAULT_KING_STRIPE,
      queenStripe: DEFAULT_QUEEN_STRIPE,
      rookStripe: DEFAULT_ROOK_STRIPE,
      bishopStripe: DEFAULT_BISHOP_STRIPE,
      knightRing: DEFAULT_KNIGHT_RING,
      pawnMarkWidth: DEFAULT_PAWN_MARK_WIDTH,
    });
  }

  return (
    <section className="options-group">
      <h3>Attack geometry</h3>
      <p className="options-hint">
        Colors, plus stripe widths and knight radii in square sides.
      </p>

      <table className="stripe-table">
        <thead>
          <tr>
            <th scope="col">Piece</th>
            <th scope="col" className="stripe-table-color-head">
              <span className="visually-hidden">Attack color</span>
            </th>
            <th scope="col">Inner</th>
            <th scope="col">Outer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.piece}</th>
              <td>
                <input
                  type="color"
                  className="attack-swatch"
                  value={attacks.colors[row.color]}
                  title={`${row.piece} attack color (${attacks.colors[row.color]})`}
                  aria-label={`${row.piece} attack color`}
                  onChange={(event) =>
                    setColor(row.color, event.target.value.toLowerCase())
                  }
                />
              </td>
              <td className={row.inner ? undefined : "stripe-table-blank"}>
                {row.inner ? (
                  <NumberInput
                    id={`${row.key}-inner`}
                    ariaLabel={row.inner.label}
                    value={row.inner.value}
                    allowZero={row.inner.allowZero}
                    onChange={row.inner.onChange}
                  />
                ) : (
                  "—"
                )}
              </td>
              <td>
                <NumberInput
                  id={`${row.key}-outer`}
                  ariaLabel={row.outer.label}
                  value={row.outer.value}
                  allowZero={row.outer.allowZero}
                  onChange={row.outer.onChange}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" className="reset-button" onClick={resetAll}>
        Reset geometry
      </button>
    </section>
  );
}
