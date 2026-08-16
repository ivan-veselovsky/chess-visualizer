import { useEffect, useState } from "react";
import { normalizeHexColor } from "./options";

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (color: string) => void;
}

/**
 * A colour option: a native swatch picker plus a HEX text field. The text field
 * keeps the raw input while the user types and only reports valid colours up.
 */
export default function ColorField({
  id,
  label,
  value,
  onChange,
}: ColorFieldProps) {
  const [text, setText] = useState(value);

  // Follow the value when it changes elsewhere (swatch picker, reset button).
  useEffect(() => setText(value), [value]);

  const isValid = normalizeHexColor(text) !== null;

  function handleTextChange(next: string) {
    setText(next);
    const normalized = normalizeHexColor(next);
    if (normalized !== null) {
      onChange(normalized);
    }
  }

  return (
    <div className="color-field">
      <label htmlFor={`${id}-hex`}>{label}</label>
      <div className="color-field-inputs">
        <input
          id={id}
          type="color"
          value={value}
          aria-label={`${label} swatch`}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
        />
        <input
          id={`${id}-hex`}
          type="text"
          className={isValid ? "hex-input" : "hex-input hex-input-invalid"}
          value={text}
          spellCheck={false}
          autoComplete="off"
          placeholder="#rrggbb"
          aria-invalid={!isValid}
          onChange={(event) => handleTextChange(event.target.value)}
          onBlur={() => setText(value)}
        />
      </div>
    </div>
  );
}
