import NumberInput from "./NumberInput";
import {
  type AttackColors,
  type AttackOptions,
  type AttackGeometry,
  type RayStyle,
} from "./options";

type Side = "me" | "opponent";

const SIDES: Side[] = ["me", "opponent"];

/* Shown on hover, so the table stays as short as its rows. */
const GAP_HINT =
  "Width of the gap down the middle of the stripe, in square sides. Zero leaves it solid.";
const STRIPE_HINT = "Full width of the stripe, in square sides.";
const RADII_HINT =
  "Where the knight's ring sits: its inner and outer radius, in square sides from the knight.";
const OUTLINE_HINT =
  "Colour of the outline traced around this side's marks, where it has any width.";

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
  /** Shown on hover over the row's name. */
  hint?: string;
  cells: Record<Side, SideCells>;
}

/**
 * Every attack dimension in one table: a row per piece, and the two ends of the
 * board side by side so a change to one can be judged against the other.
 *
 * The columns are a stripe's total width and the width of the gap down its
 * middle, which is what every mark here is made of — a ray's stripe, the king's,
 * the pawn's, and the knight's ring, a stripe bent into a circle.
 *
 * The knight alone needs something more, since a ring has to be placed as well
 * as sized. Its radii get a continuation row of their own rather than being
 * forced into columns that would then describe neither them nor anything else.
 *
 * "Me" is whichever army is at the near end and "Opponent" the far one, so
 * flipping the board hands these settings to the other colour rather than
 * turning the whole display around.
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
      return <td key={side} className={side === "opponent" ? "stripe-group-start" : undefined} />;
    }
    const value = cell.value;
    return (
      <td
        key={side}
        className={
          side === "opponent"
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
    key: "kingRay" | "queenRay" | "bishopRay" | "rookRay" | "pawnRay",
    piece: string,
    color: keyof AttackColors
  ): Row {
    const cellsFor = (side: Side): SideCells => {
      const stripe = attacks.geometry[side][key];
      const update = (patch: Partial<RayStyle>) =>
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
      cells: { me: cellsFor("me"), opponent: cellsFor("opponent") },
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
      cells: { me: cellsFor("me"), opponent: cellsFor("opponent") },
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
      hint: RADII_HINT,
      cells: { me: cellsFor("me"), opponent: cellsFor("opponent") },
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
      hint: OUTLINE_HINT,
      cells: { me: cellsFor("me"), opponent: cellsFor("opponent") },
    };
  }

  const rows: Row[] = [
    stripeRow("kingRay", "King", "king"),
    stripeRow("queenRay", "Queen", "queen"),
    stripeRow("rookRay", "Rook", "rook"),
    stripeRow("bishopRay", "Bishop", "bishop"),
    knightRow(),
    knightRadiiRow(),
    stripeRow("pawnRay", "Pawn", "pawn"),
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
              Me
            </th>
            <th scope="colgroup" colSpan={3} className="stripe-group-start">
              Opponent
            </th>
          </tr>
          <tr>
            <th scope="col" className="stripe-table-color">
              Color
            </th>
            <th scope="col" title={GAP_HINT}>
              Gap
            </th>
            <th scope="col" title={STRIPE_HINT}>
              Stripe
            </th>
            <th scope="col" className="stripe-table-color stripe-group-start">
              Color
            </th>
            <th scope="col" title={GAP_HINT}>
              Gap
            </th>
            <th scope="col" title={STRIPE_HINT}>
              Stripe
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" title={row.hint}>
                {row.piece}
              </th>
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
