import { describeEntry, type HistoryEntry } from "../chess/history";
import { figurine } from "../chess/figurine";
import { useFiguresLoaded } from "./useFiguresLoaded";

interface MovesSelectProps {
  /** Every position reached so far, newest first. */
  entries: HistoryEntry[];
  /** Which of them is on the board. */
  current: number;
  onSelect: (index: number) => void;
  /** Not answering, while the board is being set up rather than played through. */
  disabled?: boolean;
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
  disabled = false,
  onSelect,
}: MovesSelectProps) {
  /* The pieces in the moves a size up: see `FIGURE_SCALE`. */
  useFiguresLoaded();
  return (
    <div className={`moves-field${disabled ? " label-off" : ""}`}>
      <label htmlFor="moves">Moves</label>
      <select
        id="moves"
        className="moves-select"
        title="History of moves"
        value={current}
        disabled={disabled}
        onChange={(event) => onSelect(Number(event.target.value))}
      >
        {entries.map((entry, index) => (
          <option key={index} value={index}>
            {/* With the piece drawn rather than lettered: see `figurine`. */}
            {figurine(describeEntry(entry))}
          </option>
        ))}
      </select>
    </div>
  );
}
