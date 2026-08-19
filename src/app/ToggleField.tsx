interface ToggleFieldProps {
  id: string;
  label: string;
  checked: boolean;
  /** Explanation shown on hover, rather than as standing text. */
  hint?: string;
  onChange: (checked: boolean) => void;
}

/** A boolean option rendered as a labelled checkbox. */
export default function ToggleField({
  id,
  label,
  checked,
  hint,
  onChange,
}: ToggleFieldProps) {
  return (
    <div className="toggle-field" title={hint}>
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
