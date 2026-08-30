import { useState } from "react";
import ColorDialog from "./ColorDialog";

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  /** Present but not answering; `hint` should then say why. */
  disabled?: boolean;
  /** Explanation shown on hover, rather than as standing text. */
  hint?: string;
  onChange: (color: string) => void;
}

/**
 * A colour option: a labelled well that opens a dialog to change it in.
 *
 * The well alone would do for choosing one by eye, and for a while that is all
 * this was. The dialog carries the colour written out as well, to be typed into
 * or pasted over — which the browser's own picker cannot be relied on for, its
 * innards belonging to the browser rather than to the page.
 *
 * The same dialog serves the swatches in the attack table, so a colour is
 * changed the same way wherever it is met.
 */
export default function ColorField({
  id,
  label,
  value,
  disabled = false,
  hint,
  onChange,
}: ColorFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={disabled ? "color-field field-disabled" : "color-field"}>
      <label htmlFor={id}>{label}</label>
      <button
        id={id}
        type="button"
        className="color-well"
        disabled={disabled}
        style={{ background: value }}
        title={hint ?? value}
        aria-label={`${label} (${value})`}
        onClick={() => setOpen(true)}
      />
      <ColorDialog
        open={open}
        label={label}
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
