import { LabelWithInfo } from "./InfoButton";

interface Choice<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  /** Explanation behind an (i) beside the label, rather than standing text. */
  hint?: string;
  /**
   * A little more room above, on top of the gap every field leaves below it.
   *
   * For a field that follows a switch: a switch is a line of text where a field
   * is a bordered box, and the same margin between them reads as less room than
   * the same margin between two boxes.
   */
  apart?: boolean;
  /**
   * Present but not in force, because the switch above it is off. Faded and
   * unclickable rather than gone: a field that disappears leaves the reader
   * wondering whether they imagined it.
   */
  disabled?: boolean;
  /**
   * Held to a width rather than as wide as its longest choice, for choices
   * that can run long: the names of a game's lines carry what the file says
   * about them, and one sentence of it would push the row off the panel.
   */
  capped?: boolean;
  onChange: (value: T) => void;
}

/** A labelled choice from a fixed set, laid out like the inline number fields. */
export default function SelectField<T extends string>({
  id,
  label,
  value,
  choices,
  hint,
  apart = false,
  disabled = false,
  capped = false,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <div
      className={`number-field field-inline${apart ? " field-apart" : ""}${
        disabled ? " field-disabled" : ""
      }`}
    >
      <LabelWithInfo label={<label htmlFor={id}>{label}</label>} hint={hint} />
      <select
        id={id}
        className={`game-select choice-select${capped ? " choice-select-capped" : ""}`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  );
}
