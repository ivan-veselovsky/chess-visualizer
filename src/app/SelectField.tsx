interface Choice<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  /** Explanation shown on hover, rather than as standing text. */
  hint?: string;
  onChange: (value: T) => void;
}

/** A labelled choice from a fixed set, laid out like the inline number fields. */
export default function SelectField<T extends string>({
  id,
  label,
  value,
  choices,
  hint,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <div className="number-field field-inline" title={hint}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="game-select choice-select"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  );
}
