import { useEffect, useState } from "react";
import { parseNumber } from "./settings";

interface NumberInputProps {
  id: string;
  value: number;
  /** Whether 0 is a meaningful value for this option. */
  allowZero?: boolean;
  /** Upper bound, when the option has one. */
  max?: number;
  step?: number;
  /** Needed when the input has no visible <label> of its own, as in a table. */
  ariaLabel?: string;
  onChange: (value: number) => void;
}

/** Trims the stored precision down to something readable in an input. */
function format(value: number): string {
  return String(Number(value.toFixed(4)));
}

/**
 * A bare numeric input. It keeps the raw text while the user types and only
 * reports usable values up, so a half-typed number never reaches the board.
 */
export default function NumberInput({
  id,
  value,
  allowZero = false,
  max,
  step = 0.05,
  ariaLabel,
  onChange,
}: NumberInputProps) {
  const [text, setText] = useState(() => format(value));

  // Follow the value when it changes elsewhere (reset buttons).
  useEffect(() => setText(format(value)), [value]);

  function accept(input: string): number | null {
    const parsed = parseNumber(input, allowZero);
    if (parsed === null || (max !== undefined && parsed > max)) {
      return null;
    }
    return parsed;
  }

  const isValid = accept(text) !== null;

  return (
    <input
      id={id}
      type="number"
      min={0}
      max={max}
      step={step}
      className={isValid ? "number-input" : "number-input number-input-invalid"}
      value={text}
      aria-label={ariaLabel}
      aria-invalid={!isValid}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = accept(event.target.value);
        if (parsed !== null) {
          onChange(parsed);
        }
      }}
      onBlur={() => setText(format(value))}
    />
  );
}
