interface FenFieldProps {
  value: string;
  /** Why the current text was rejected, or null while it parses. */
  error: string | null;
  onChange: (fen: string) => void;
}

/**
 * The position, as an editable FEN. The board follows every keystroke that
 * parses; one that does not is reported here and leaves the board alone.
 */
export default function FenField({
  value,
  error,
  onChange,
}: FenFieldProps) {
  return (
    <div className="fen-field">
      <label htmlFor="fen">Position (FEN)</label>
      <div className="fen-field-inputs">
        <input
          id="fen"
          type="text"
          className={error === null ? "fen-input" : "fen-input fen-input-invalid"}
          value={value}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={error !== null}
          aria-describedby={error === null ? undefined : "fen-error"}
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
