import { useState } from "react";
import ColorDialog from "./ColorDialog";
import NumberInput from "./NumberInput";
import {
  type AttackColors,
  type AttackSettings,
  type AttackGeometry,
  type RayStyle,
} from "./settings";

type Side = "me" | "opponent";

const SIDES: Side[] = ["me", "opponent"];

/* Shown on hover, so the table stays as short as its rows. */
const GAP_HINT =
  "Width of the gap down the middle of the stripe, in square sides. Zero leaves it solid.";
const STRIPE_HINT = "Full width of the stripe, in square sides.";
const RADII_HINT =
  "Where the knight's ring sits: its inner and outer radius, in square sides from the knight.";
const INNER_SQUARES_HINT =
  "The two squares every ray is measured against, in square sides: a ray sets off from the large one and stops in a point on the small one. Keep the small inside the large to leave a gap around each piece.";
const OUTLINE_HINT =
  "The outline traced around this side's marks, to tell them from the other side's: its colour, and its width in square sides. A hairline is a hundredth or so; zero draws none.";

interface AttackTableProps {
  attacks: AttackSettings;
  onChange: (patch: Partial<AttackSettings>) => void;
}

/** One editable number in the table. */
interface Cell {
  value: number;
  label: string;
  allowZero?: boolean;
  /** How much the spinner moves it, where the row's scale calls for less. */
  step?: number;
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
  /**
   * What this row's colour is called, after whose it is: "My **King attack**".
   * A piece's colour is the colour of its attacks, so that is what it is named
   * after; the outline is not an attack and says so for itself.
   */
  swatchNoun?: string;
  cells: Record<Side, SideCells>;
}

/** How a colour reads in full — the dialog's heading, and the swatch's title. */
function swatchName(row: Row, side: Side): string {
  return `${side === "me" ? "My" : "Opponent"} ${
    row.swatchNoun ?? `${row.piece} attack`
  }`;
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
  /*
    Which swatch has its dialog open, named rather than captured. The cell's own
    handler is rebuilt on every render out of the settings as they stand, so
    holding on to one would mean changing a colour through a handler that
    remembers the settings from before the last change.
  */
  const [editing, setEditing] = useState<{ rowKey: string; side: Side } | null>(
    null
  );

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
        {/*
          A button rather than a colour input: it opens a dialog carrying a
          written field as well as the browser's well, which a cell this size
          has no room for and the browser's own picker will not supply.
        */}
        <button
          type="button"
          className="attack-swatch"
          style={{ background: value }}
          title={`${swatchName(row, side)} (${value})`}
          aria-label={`${swatchName(row, side)} (${value})`}
          onClick={() => setEditing({ rowKey: row.key, side })}
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

  /** The frame the rays are measured in, rather than any one piece's mark. */
  function innerSquaresRow(): Row {
    const cellsFor = (side: Side): SideCells => {
      const geometry = attacks.geometry[side];
      return {
        gap: {
          value: geometry.smallInnerSquare,
          label: `${side} small inner square`,
          allowZero: true,
          // The board draws the pair in order whatever is stored. Storing it in
          // order too keeps these two inputs telling the truth about it: one
          // pushes the other along rather than being quietly overruled.
          onChange: (smallInnerSquare) =>
            updateGeometry(side, {
              smallInnerSquare,
              ...(smallInnerSquare > geometry.largeInnerSquare
                ? { largeInnerSquare: smallInnerSquare }
                : {}),
            }),
        },
        width: {
          value: geometry.largeInnerSquare,
          label: `${side} large inner square`,
          allowZero: true,
          onChange: (largeInnerSquare) =>
            updateGeometry(side, {
              largeInnerSquare,
              ...(largeInnerSquare < geometry.smallInnerSquare
                ? { smallInnerSquare: largeInnerSquare }
                : {}),
            }),
        },
      };
    };
    return {
      key: "inner-squares",
      piece: "Inner sq.",
      hint: INNER_SQUARES_HINT,
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
      width: {
        value: attacks.outlineWidths[side],
        label: `${side} outline width`,
        allowZero: true,
        step: 0.005,
        onChange: (value) =>
          onChange({
            outlineWidths: { ...attacks.outlineWidths, [side]: value },
          }),
      },
    });
    return {
      key: "outline",
      swatchNoun: "outline colour",
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
    innerSquaresRow(),
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
          step={cell.step}
          onChange={cell.onChange}
        />
      </td>
    );
  }

  // Resolved from this render's rows, so the handler is always the current one.
  const open =
    editing === null
      ? undefined
      : (() => {
          const row = rows.find((candidate) => candidate.key === editing.rowKey);
          const swatch = row?.cells[editing.side].swatch;
          return swatch === undefined || row === undefined
            ? undefined
            : { name: swatchName(row, editing.side), swatch };
        })();

  return (
    <section className="settings-group">
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

      {open !== undefined && (
        <ColorDialog
          open
          label={open.name}
          value={open.swatch.value}
          onChange={open.swatch.onChange}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
