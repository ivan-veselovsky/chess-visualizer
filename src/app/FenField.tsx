import { describeEntry, type HistoryEntry } from "../chess/history";

interface FenFieldProps {
  value: string;
  /** Why the current text was rejected, or null while it parses. */
  error: string | null;
  onChange: (fen: string) => void;
  /** Every position reached so far, newest first. */
  entries: HistoryEntry[];
  /** Which of them is on the board. */
  current: number;
  onSelectPosition: (index: number) => void;
}

/**
 * The list of positions reached so far, beside the current one as an editable
 * FEN. The board follows every keystroke that parses; one that does not is
 * reported here and leaves the board alone.
 */
export default function FenField({
  value,
  error,
  onChange,
  entries,
  current,
  onSelectPosition,
}: FenFieldProps) {
  return (
    <div className="fen-field">
      {/* Two labelled columns, each control starting under its own label. */}
      <div className="fen-field-inputs">
        <div className="history-column">
          <label htmlFor="game-history">Game history</label>
          {/*
            A real list rather than a datalist against the input: a datalist
            filters its options by what the field already holds, and the field
            holds a whole FEN, so the only one ever offered was the current
            position. Options carry their index because that is what moving the
            pointer takes; the FEN would serve as well, its move counter making
            it unique to the ply even when the pieces stand as they did before.
          */}
          <select
            id="game-history"
            className="history-select"
            title="Game history"
            value={current}
            onChange={(event) => onSelectPosition(Number(event.target.value))}
          >
            {entries.map((entry, index) => (
              <option key={index} value={index}>
                {describeEntry(entry)}
              </option>
            ))}
          </select>
        </div>

        <div className="fen-column">
          <label htmlFor="fen">Position (FEN)</label>
          <input
            id="fen"
            type="text"
            className={
              error === null ? "fen-input" : "fen-input fen-input-invalid"
            }
            value={value}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-invalid={error !== null}
            aria-describedby={error === null ? undefined : "fen-error"}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>

      {error !== null && (
        <p id="fen-error" className="fen-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
