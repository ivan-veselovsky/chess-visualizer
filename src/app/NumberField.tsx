import { useEffect, useState } from "react";
import { parseNumber } from "./options";

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  /** Shown after the input, e.g. a unit. */
  suffix?: string;
  step?: number;
  /** Whether 0 is a meaningful value for this option. */
  allowZero?: boolean;
  /** Upper bound, when the option has one. */
  max?: number;
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
  allowZero = false,
  max,
  onChange,
}: NumberFieldProps) {
  const [text, setText] = useState(() => format(value));

  // Follow the value when it changes elsewhere (reset button).
  useEffect(() => setText(format(value)), [value]);

  function accept(input: string): number | null {
    const parsed = parseNumber(input, allowZero);
    if (parsed === null || (max !== undefined && parsed > max)) {
      return null;
    }
    return parsed;
  }

  const isValid = accept(text) !== null;

  function handleChange(next: string) {
    setText(next);
    const parsed = accept(next);
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
          max={max}
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
