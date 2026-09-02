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
  /**
   * Hold the box to the width of the figure it takes. An inline field otherwise
   * stretches to the whole row, which reads as an invitation to type something
   * long into a field that wants two digits.
   */
  narrow?: boolean;
  /** Present but not answering; `hint` should then say why. */
  disabled?: boolean;
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
  narrow = false,
  disabled = false,
  onChange,
}: NumberFieldProps) {
  const classes = [
    inline ? "number-field field-inline" : "number-field",
    narrow ? "field-narrow" : "",
    disabled ? "field-disabled" : "",
  ]
    .filter((name) => name !== "")
    .join(" ");
  return (
    <div className={classes} title={hint}>
      <label htmlFor={id}>{label}</label>
      <div className="number-field-inputs">
        <NumberInput
          id={id}
          value={value}
          step={step}
          allowZero={allowZero}
          max={max}
          disabled={disabled}
          onChange={onChange}
        />
        {suffix !== undefined && <span className="field-suffix">{suffix}</span>}
      </div>
    </div>
  );
}
