import { describeEntry, type HistoryEntry } from "../chess/history";

interface MovesSelectProps {
  /** Every position reached so far, newest first. */
  entries: HistoryEntry[];
  /** Which of them is on the board. */
  current: number;
  onSelect: (index: number) => void;
}

/**
 * The positions reached so far, to step to any of them at once.
 *
 * A real list rather than a datalist against a field: a datalist filters its
 * options by what the field already holds, and the field it used to sit beside
 * held a whole FEN, so the only option ever offered was the current position.
 *
 * Options carry their index because that is what moving the pointer takes; the
 * FEN would serve as well, its move counter making it unique to the ply even
 * when the pieces stand as they did before.
 */
export default function MovesSelect({
  entries,
  current,
  onSelect,
}: MovesSelectProps) {
  return (
    <div className="moves-field">
      <label htmlFor="moves">Moves</label>
      <select
        id="moves"
        className="moves-select"
        title="History of moves"
        value={current}
        onChange={(event) => onSelect(Number(event.target.value))}
      >
        {entries.map((entry, index) => (
          <option key={index} value={index}>
            {describeEntry(entry)}
          </option>
        ))}
      </select>
    </div>
  );
}
