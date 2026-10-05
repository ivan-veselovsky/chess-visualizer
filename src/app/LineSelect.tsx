import { useLayoutEffect, useRef, useState } from "react";
import type { TreeLine } from "../chess/variations";
import { lineLabel } from "../chess/linePath";
import { LabelWithInfo } from "./InfoButton";

interface LineSelectProps {
  lines: TreeLine[];
  /** The line on the board, by its place in `lines`. */
  value: number;
  /** Nothing to choose: one line, or the board being set up. */
  disabled?: boolean;
  hint: string;
  onChange: (line: number) => void;
}

/** Room the list keeps for its own arrow, inside its padding. */
const ARROW = 22;

/**
 * Which line of a game with variations is on the board: each line by its
 * number and the way it goes from the first position, in a list taking all
 * the room its row has.
 *
 * The labels are fitted to that room here, rather than cut off by the list.
 * A list cuts a label short at its end, and the end is the part worth seeing:
 * the lines of a game share their beginnings and part towards their ends. So
 * each is measured, in the list's own font, against the list's own width, and
 * what does not fit is left off its front — see `lineLabel`. The list the
 * platform opens is as wide as the control, so the same labels fit there too.
 * Measured again whenever the list is given a different width.
 */
export default function LineSelect({ lines, value, disabled = false, hint, onChange }: LineSelectProps) {
  const select = useRef<HTMLSelectElement>(null);
  const [room, setRoom] = useState<{ width: number; font: string } | null>(null);

  useLayoutEffect(() => {
    const list = select.current;
    if (list === null) {
      return;
    }
    const measure = () => {
      const seen = getComputedStyle(list);
      const width =
        list.clientWidth - parseFloat(seen.paddingLeft) - parseFloat(seen.paddingRight) - ARROW;
      setRoom((was) =>
        was !== null && was.width === width && was.font === seen.font ? was : { width, font: seen.font }
      );
    };
    measure();
    const watching = new ResizeObserver(measure);
    watching.observe(list);
    return () => watching.disconnect();
  }, []);

  const labels = (() => {
    const context = room === null ? null : document.createElement("canvas").getContext("2d");
    if (room === null || context === null) {
      return lines.map((line, index) => lineLabel(line, String(index + 1), () => true));
    }
    context.font = room.font;
    const fits = (label: string) => context.measureText(label).width <= room.width;
    return lines.map((line, index) => lineLabel(line, String(index + 1), fits));
  })();

  return (
    /* Only the list fades when there is nothing to choose — see
       `.game-select:disabled` — not its label or its (i), which still say
       what it is. */
    <div className="number-field field-inline line-field">
      <LabelWithInfo label={<label htmlFor="branch">Line</label>} hint={hint} />
      <select
        ref={select}
        id="branch"
        className="game-select choice-select line-select"
        value={String(value)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {labels.map((label, index) => (
          <option key={index} value={String(index)} title={lineLabel(lines[index], String(index + 1), () => true)}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
