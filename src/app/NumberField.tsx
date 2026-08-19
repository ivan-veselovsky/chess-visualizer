import NumberInput from "./NumberInput";

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
  /** Explanation shown on hover, rather than as standing text. */
  hint?: string;
  /** Put the label and the input on one line instead of stacking them. */
  inline?: boolean;
  onChange: (value: number) => void;
}

/** A labelled numeric option, for settings that stand on their own. */
export default function NumberField({
  id,
  label,
  value,
  suffix,
  step,
  allowZero,
  max,
  hint,
  inline = false,
  onChange,
}: NumberFieldProps) {
  return (
    <div
      className={inline ? "number-field field-inline" : "number-field"}
      title={hint}
    >
      <label htmlFor={id}>{label}</label>
      <div className="number-field-inputs">
        <NumberInput
          id={id}
          value={value}
          step={step}
          allowZero={allowZero}
          max={max}
          onChange={onChange}
        />
        {suffix !== undefined && <span className="field-suffix">{suffix}</span>}
      </div>
    </div>
  );
}
