import { useEffect, useState } from "react";
import { parsePositiveNumber } from "./options";

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  /** Shown after the input, e.g. a unit. */
  suffix?: string;
  step?: number;
  onChange: (value: number) => void;
}

/** Trims the stored precision down to something readable in an input. */
function format(value: number): string {
  return String(Number(value.toFixed(4)));
}

/**
 * A positive-number option. Like ColorField it keeps the raw text while the
 * user types and only reports usable values up.
 */
export default function NumberField({
  id,
  label,
  value,
  suffix,
  step = 0.05,
  onChange,
}: NumberFieldProps) {
  const [text, setText] = useState(() => format(value));

  // Follow the value when it changes elsewhere (reset button).
  useEffect(() => setText(format(value)), [value]);

  const isValid = parsePositiveNumber(text) !== null;

  function handleChange(next: string) {
    setText(next);
    const parsed = parsePositiveNumber(next);
    if (parsed !== null) {
      onChange(parsed);
    }
  }

  return (
    <div className="number-field">
      <label htmlFor={id}>{label}</label>
      <div className="number-field-inputs">
        <input
          id={id}
          type="number"
          min={0}
          step={step}
          className={isValid ? "number-input" : "number-input number-input-invalid"}
          value={text}
          aria-invalid={!isValid}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => setText(format(value))}
        />
        {suffix !== undefined && <span className="field-suffix">{suffix}</span>}
      </div>
    </div>
  );
}
