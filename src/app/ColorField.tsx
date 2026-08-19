interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (color: string) => void;
}

/**
 * A colour option: a labelled well, and nothing else. The browser's own picker
 * shows and accepts a hex value, so a text field beside it only repeated what
 * the well already opens onto.
 */
export default function ColorField({
  id,
  label,
  value,
  onChange,
}: ColorFieldProps) {
  return (
    <div className="color-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value.toLowerCase())}
      />
    </div>
  );
}
