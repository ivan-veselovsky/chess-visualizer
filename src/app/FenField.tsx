import FenHelp from "./FenHelp";
import FieldWithHelp from "./FieldWithHelp";

interface FenFieldProps {
  value: string;
  /** Why the current text was rejected, or null while it parses. */
  error: string | null;
  /** Why the position cannot be changed here, when it cannot. */
  readOnly?: string | null;
  onChange: (fen: string) => void;
}

/**
 * The position on the board as an editable FEN, its label beside it.
 *
 * The board follows every keystroke that parses; one that does not is reported
 * underneath and leaves the board alone.
 */
export default function FenField({
  value,
  error,
  readOnly = null,
  onChange,
}: FenFieldProps) {
  return (
    <div className="fen-field">
      <div className="board-controls fen-row">
        {/* The label carries the explanation: hovering the field itself would
            put a panel over what is being typed. */}
        <FieldWithHelp>
          <label htmlFor="fen">Position (FEN)</label>
          <FenHelp id="fen-help" />
        </FieldWithHelp>
        <input
          id="fen"
          type="text"
          className={
            error === null ? "fen-input" : "fen-input fen-input-invalid"
          }
          value={value}
          readOnly={readOnly !== null}
          title={readOnly ?? undefined}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={error !== null}
          aria-describedby={error === null ? "fen-help" : "fen-help fen-error"}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>

      {error !== null && (
        <p id="fen-error" className="fen-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
