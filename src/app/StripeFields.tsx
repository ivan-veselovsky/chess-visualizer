import NumberField from "./NumberField";
import type { StripeStyle } from "./options";

interface StripeFieldsProps {
  /** Distinguishes the input ids and labels of one piece from another. */
  id: string;
  title: string;
  value: StripeStyle;
  defaults: StripeStyle;
  onChange: (patch: Partial<StripeStyle>) => void;
}

/**
 * Outer and inner width for one piece's ray stripe. Inner width accepts zero,
 * which collapses the double stripe into a single one.
 */
export default function StripeFields({
  id,
  title,
  value,
  defaults,
  onChange,
}: StripeFieldsProps) {
  return (
    <section className="options-group">
      <h3>{title}</h3>
      <NumberField
        id={`${id}-outer-width`}
        label="Outer width"
        suffix="squares"
        value={value.outerWidth}
        onChange={(outerWidth) => onChange({ outerWidth })}
      />
      <NumberField
        id={`${id}-inner-width`}
        label="Inner width"
        suffix="squares"
        value={value.innerWidth}
        allowZero
        onChange={(innerWidth) => onChange({ innerWidth })}
      />
      <button
        type="button"
        className="reset-button"
        onClick={() => onChange(defaults)}
      >
        Reset widths
      </button>
    </section>
  );
}
