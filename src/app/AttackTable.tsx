import NumberField from "./NumberField";
import NumberInput from "./NumberInput";
import {
  DEFAULT_ATTACK_COLORS,
  DEFAULT_PIECE_GEOMETRY,
  type AttackColors,
  type AttackOptions,
  type PieceGeometry,
  type StripeStyle,
} from "./options";

/** Which side's shapes the table is editing. */
export type Side = "white" | "black";

interface AttackTableProps {
  attacks: AttackOptions;
  side: Side;
  onSideChange: (side: Side) => void;
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

const SIDES: { side: Side; label: string }[] = [
  { side: "white", label: "White" },
  { side: "black", label: "Black" },
];

/**
 * Every attack dimension in one table, a row per piece. Lining the pieces up
 * makes it easy to see which shape nests inside which, which is the whole point
 * of tuning them against each other.
 *
 * The columns mean the same thing throughout — an inner and an outer boundary —
 * even though that is a pair of stripe widths for the sliding pieces and a pair
 * of radii for the knight. The king's ring and the pawn's mark are single
 * strokes, so they have an outer value only.
 *
 * Sizes are held separately for each side, so the two can be told apart by
 * stripe width as well as by outline. Rather than double the columns, the table
 * edits one side at a time and the selector above says which. Colours are
 * shared: they identify the piece, not the side.
 */
export default function AttackTable({
  attacks,
  side,
  onSideChange,
  onChange,
}: AttackTableProps) {
  const geometry = attacks.geometry[side];

  function updateGeometry(patch: Partial<PieceGeometry>) {
    onChange({
      geometry: { ...attacks.geometry, [side]: { ...geometry, ...patch } },
    });
  }

  function setColor(key: keyof AttackColors, value: string) {
    onChange({ colors: { ...attacks.colors, [key]: value } });
  }

  function stripeRow(
    key:
      | "kingStripe"
      | "queenStripe"
      | "bishopStripe"
      | "rookStripe"
      | "pawnStripe",
    piece: string,
    color: keyof AttackColors
  ): Row {
    function update(patch: Partial<StripeStyle>) {
      updateGeometry({ [key]: { ...geometry[key], ...patch } });
    }
    return {
      key,
      piece,
      color,
      inner: {
        value: geometry[key].innerWidth,
        label: `${piece} inner width`,
        allowZero: true,
        onChange: (innerWidth) => update({ innerWidth }),
      },
      outer: {
        value: geometry[key].outerWidth,
        label: `${piece} outer width`,
        onChange: (outerWidth) => update({ outerWidth }),
      },
    };
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
        value: geometry.knightRing.innerRadius,
        label: "Knight inner radius",
        allowZero: true,
        onChange: (innerRadius) =>
          updateGeometry({
            knightRing: { ...geometry.knightRing, innerRadius },
          }),
      },
      outer: {
        value: geometry.knightRing.outerRadius,
        label: "Knight outer radius",
        onChange: (outerRadius) =>
          updateGeometry({
            knightRing: { ...geometry.knightRing, outerRadius },
          }),
      },
    },
    stripeRow("pawnStripe", "Pawn", "pawn"),
  ];

  return (
    <section className="options-group">
      <h3>Attack geometry</h3>
      <p className="options-hint">
        Colors, plus stripe widths and knight radii in square sides. Sizes are
        per side; colors are shared.
      </p>

      <div className="side-picker" role="group" aria-label="Side to edit">
        {SIDES.map((entry) => (
          <button
            key={entry.side}
            type="button"
            className={
              entry.side === side ? "side-button side-button-on" : "side-button"
            }
            aria-pressed={entry.side === side}
            onClick={() => onSideChange(entry.side)}
          >
            {entry.label}
          </button>
        ))}
        <button
          type="button"
          className="side-button side-button-match"
          title="Give the other side these same sizes"
          onClick={() =>
            onChange({ geometry: { white: geometry, black: geometry } })
          }
        >
          Match
        </button>
      </div>

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
                    id={`${side}-${row.key}-inner`}
                    ariaLabel={`${side} ${row.inner.label}`}
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
                  id={`${side}-${row.key}-outer`}
                  ariaLabel={`${side} ${row.outer.label}`}
                  value={row.outer.value}
                  allowZero={row.outer.allowZero}
                  onChange={row.outer.onChange}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/*
        The knight needs a third number the stripe pieces do not: its two radii
        say where the ring sits, leaving nowhere in the Inner/Outer columns to
        put the gap. A fifth column for one piece would squeeze the rest, so it
        sits below the table instead.
      */}
      <NumberField
        id={`${side}-knight-gap`}
        label="Knight ring gap"
        suffix="squares"
        value={geometry.knightRing.gap}
        allowZero
        onChange={(gap) =>
          updateGeometry({ knightRing: { ...geometry.knightRing, gap } })
        }
      />

      <button
        type="button"
        className="reset-button"
        onClick={() =>
          onChange({
            colors: DEFAULT_ATTACK_COLORS,
            geometry: { ...attacks.geometry, [side]: DEFAULT_PIECE_GEOMETRY },
          })
        }
      >
        Reset geometry
      </button>
    </section>
  );
}
