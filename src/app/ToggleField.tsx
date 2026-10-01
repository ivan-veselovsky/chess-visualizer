import InfoButton from "./InfoButton";

interface ToggleFieldProps {
  id: string;
  label: string;
  checked: boolean;
  /** Explanation behind an (i) after the label, rather than standing text. */
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
    <div className="toggle-field">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
      {hint !== undefined && hint !== "" && <InfoButton label={label}>{hint}</InfoButton>}
    </div>
  );
}
