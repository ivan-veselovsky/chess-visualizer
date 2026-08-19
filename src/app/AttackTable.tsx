import NumberInput from "./NumberInput";
import {
  type AttackColors,
  type AttackOptions,
  type AttackGeometry,
  type StripeStyle,
} from "./options";

type Side = "white" | "black";

const SIDES: Side[] = ["white", "black"];

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

/** What one side contributes to a row. Most rows fill all three. */
interface SideCells {
  /** The colour well, and what setting it changes. */
  swatch?: { value: string; onChange: (value: string) => void };
  gap?: Cell;
  width?: Cell;
}

interface Row {
  key: string;
  piece: string;
  cells: Record<Side, SideCells>;
}

/**
 * Every attack dimension in one table: a row per piece, and the two sides side
 * by side so a change to one can be judged against the other.
 *
 * The columns are a stripe's total width and the width of the gap down its
 * middle, which is what every mark here is made of — a ray's stripe, the king's,
 * the pawn's, and the knight's ring, a stripe bent into a circle.
 *
 * The knight alone needs something more, since a ring has to be placed as well
 * as sized. Its radii get a continuation row of their own rather than being
 * forced into columns that would then describe neither them nor anything else.
 *
 * Colours span both sides: they identify the piece, not the side. Only the
 * sizes and the outlines distinguish White's marks from Black's.
 */
export default function AttackTable({ attacks, onChange }: AttackTableProps) {
  function updateGeometry(side: Side, patch: Partial<AttackGeometry>) {
    onChange({
      geometry: {
        ...attacks.geometry,
        [side]: { ...attacks.geometry[side], ...patch },
      },
    });
  }

  function setColor(side: Side, key: keyof AttackColors, value: string) {
    onChange({
      colors: {
        ...attacks.colors,
        [side]: { ...attacks.colors[side], [key]: value },
      },
    });
  }

  /** The attack colour for one piece on one side, as a cell's worth of state. */
  function pieceSwatch(side: Side, key: keyof AttackColors) {
    return {
      value: attacks.colors[side][key],
      onChange: (value: string) => setColor(side, key, value),
    };
  }

  /** A colour well, where the row has one. */
  function swatch(side: Side, row: Row) {
    const cell = row.cells[side].swatch;
    if (cell === undefined) {
      return <td key={side} className={side === "black" ? "stripe-group-start" : undefined} />;
    }
    const value = cell.value;
    return (
      <td
        key={side}
        className={
          side === "black"
            ? "stripe-table-swatch stripe-group-start"
            : "stripe-table-swatch"
        }
      >
        <input
          type="color"
          className="attack-swatch"
          value={value}
          title={`${side} ${row.piece} color (${value})`}
          aria-label={`${side} ${row.piece} color`}
          onChange={(event) => cell.onChange(event.target.value.toLowerCase())}
        />
      </td>
    );
  }

  function stripeRow(
    key: "kingStripe" | "queenStripe" | "bishopStripe" | "rookStripe" | "pawnStripe",
    piece: string,
    color: keyof AttackColors
  ): Row {
    const cellsFor = (side: Side): SideCells => {
      const stripe = attacks.geometry[side][key];
      const update = (patch: Partial<StripeStyle>) =>
        updateGeometry(side, { [key]: { ...stripe, ...patch } });
      return {
        swatch: pieceSwatch(side, color),
        gap: {
          value: stripe.gapWidth,
          label: `${side} ${piece} gap width`,
          allowZero: true,
          onChange: (gapWidth) => update({ gapWidth }),
        },
        width: {
          value: stripe.rayWidth,
          label: `${side} ${piece} stripe width`,
          onChange: (rayWidth) => update({ rayWidth }),
        },
      };
    };
    return {
      key,
      piece,
      cells: { white: cellsFor("white"), black: cellsFor("black") },
    };
  }

  /** The knight's ring, sized like any other stripe: a gap, no total width. */
  function knightRow(): Row {
    const cellsFor = (side: Side): SideCells => {
      const ring = attacks.geometry[side].knightRing;
      return {
        swatch: pieceSwatch(side, "knight"),
        gap: {
          value: ring.gapWidth,
          label: `${side} knight ring gap width`,
          allowZero: true,
          onChange: (gapWidth) =>
            updateGeometry(side, { knightRing: { ...ring, gapWidth } }),
        },
      };
    };
    return {
      key: "knight",
      piece: "Knight",
      cells: { white: cellsFor("white"), black: cellsFor("black") },
    };
  }

  /** Where that ring sits — the one dimension the width columns cannot carry. */
  function knightRadiiRow(): Row {
    const cellsFor = (side: Side): SideCells => {
      const ring = attacks.geometry[side].knightRing;
      return {
        gap: {
          value: ring.innerRadius,
          label: `${side} knight inner radius`,
          allowZero: true,
          onChange: (innerRadius) =>
            updateGeometry(side, { knightRing: { ...ring, innerRadius } }),
        },
        width: {
          value: ring.outerRadius,
          label: `${side} knight outer radius`,
          onChange: (outerRadius) =>
            updateGeometry(side, { knightRing: { ...ring, outerRadius } }),
        },
      };
    };
    return {
      key: "knight-radii",
      piece: "…radii",
      cells: { white: cellsFor("white"), black: cellsFor("black") },
    };
  }

  /** Applies wherever that side's outline has any width. */
  function outlineRow(): Row {
    const cellsFor = (side: Side): SideCells => ({
      swatch: {
        value: attacks.outlineColors[side],
        onChange: (value) =>
          onChange({
            outlineColors: { ...attacks.outlineColors, [side]: value },
          }),
      },
    });
    return {
      key: "outline",
      piece: "Outline",
      cells: { white: cellsFor("white"), black: cellsFor("black") },
    };
  }

  const rows: Row[] = [
    stripeRow("kingStripe", "King", "king"),
    stripeRow("queenStripe", "Queen", "queen"),
    stripeRow("rookStripe", "Rook", "rook"),
    stripeRow("bishopStripe", "Bishop", "bishop"),
    knightRow(),
    knightRadiiRow(),
    stripeRow("pawnStripe", "Pawn", "pawn"),
    outlineRow(),
  ];

  function numberCell(cell: Cell | undefined, id: string, groupStart: boolean) {
    const className = groupStart ? "stripe-group-start" : undefined;
    if (cell === undefined) {
      return (
        <td key={id} className={`stripe-table-blank ${className ?? ""}`}>
          —
        </td>
      );
    }
    return (
      <td key={id} className={className}>
        <NumberInput
          id={id}
          ariaLabel={cell.label}
          value={cell.value}
          allowZero={cell.allowZero}
          onChange={cell.onChange}
        />
      </td>
    );
  }

  return (
    <section className="options-group">
      <p className="options-hint">
        Widths in square sides: a stripe, and the gap down its middle. The
        knight's radii say where its ring sits.
      </p>

      <table className="stripe-table stripe-table-wide">
        {/*
          Widths have to be declared here. Under `table-layout: fixed` the
          browser takes them from the first row, and this table's first row is
          three grouped headers spanning seven columns — so a width set on the
          second row's cells is never read, and each side's three columns were
          simply splitting its third of the table equally.
        */}
        <colgroup>
          <col className="col-piece" />
          <col className="col-swatch" />
          <col />
          <col />
          <col className="col-swatch" />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" rowSpan={2}>
              Piece
            </th>
            <th scope="colgroup" colSpan={3}>
              White
            </th>
            <th scope="colgroup" colSpan={3} className="stripe-group-start">
              Black
            </th>
          </tr>
          <tr>
            <th scope="col" className="stripe-table-color">
              Color
            </th>
            <th scope="col">Gap</th>
            <th scope="col">Stripe</th>
            <th scope="col" className="stripe-table-color stripe-group-start">
              Color
            </th>
            <th scope="col">Gap</th>
            <th scope="col">Stripe</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.piece}</th>
              {SIDES.flatMap((side) => [
                swatch(side, row),
                numberCell(
                  row.cells[side].gap,
                  `${side}-${row.key}-gap`,
                  false
                ),
                numberCell(
                  row.cells[side].width,
                  `${side}-${row.key}-width`,
                  false
                ),
              ])}
            </tr>
          ))}

        </tbody>
      </table>

    </section>
  );
}
