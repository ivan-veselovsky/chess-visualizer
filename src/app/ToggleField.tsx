interface ToggleFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A boolean option rendered as a labelled checkbox. */
export default function ToggleField({
  id,
  label,
  checked,
  onChange,
}: ToggleFieldProps) {
  return (
    <div className="toggle-field">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
