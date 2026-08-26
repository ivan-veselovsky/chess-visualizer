import { useEffect, useId, useRef, useState } from "react";
import CopyButton from "./CopyButton";
import { readHex } from "./hex";

interface ColorDialogProps {
  open: boolean;
  /** What is being changed, shown as the dialog's heading. */
  label: string;
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
}

/**
 * A colour picked in a dialog: the browser's own well, and the colour written
 * out beside it.
 *
 * The written field is the point of it. A colour input opens a picker that
 * belongs to the browser rather than to the page — its innards cannot be
 * reached, and its own hex box refuses a paste on some platforms. The table's
 * swatches have no room for a field of their own, so they borrow this one.
 *
 * Changes take effect as they are made, so the board behind can be judged while
 * choosing rather than after. What is chosen therefore has to be undoable:
 * `Cancel` puts back the colour the dialog opened on, and so does dismissing it
 * with Escape or by clicking away, those being the same act by another route.
 * `Done` is what keeps a change — the only way out that does.
 */
export default function ColorDialog({
  open,
  label,
  value,
  onChange,
  onClose,
}: ColorDialogProps) {
  // Every colour option keeps a dialog of its own, so the field inside needs a
  // name of its own for its label to point at.
  const hexId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(value);
  /** The colour the dialog opened on, to go back to if it is dismissed. */
  const opened = useRef(value);
  /** Set by whichever control closes it, and read once it has. */
  const keeping = useRef(false);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      opened.current = value;
      keeping.current = false;
      setText(value);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, value]);

  // Every way out goes through `close`, so what each one means is decided here.
  function finish(keep: boolean): void {
    keeping.current = keep;
    dialog.current?.close();
  }

  const valid = readHex(text) !== null;

  return (
    <dialog
      ref={dialog}
      className="pgn-dialog color-dialog"
      onClose={() => {
        if (!keeping.current) {
          onChange(opened.current);
        }
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          finish(false);
        }
      }}
    >
      <div className="pgn-dialog-header">
        <label htmlFor={hexId}>{label}</label>
      </div>

      <div className="color-field">
        <input
          type="color"
          value={value}
          title={value}
          aria-label={`${label} well`}
          onChange={(event) => {
            const colour = event.target.value.toLowerCase();
            setText(colour);
            onChange(colour);
          }}
        />
        <input
          id={hexId}
          type="text"
          size={7}
          maxLength={7}
          className={valid ? "color-hex" : "color-hex color-hex-invalid"}
          value={text}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoFocus
          aria-invalid={!valid}
          onChange={(event) => {
            setText(event.target.value);
            const colour = readHex(event.target.value);
            if (colour !== null) {
              onChange(colour);
            }
          }}
        />
        {/* Beside the colour it copies, rather than among the ways out. */}
        <CopyButton
          label="Copy"
          title="Copy this colour as hex"
          text={() => value}
        />
      </div>

      <div className="pgn-dialog-actions">
        <button
          type="button"
          className="reset-button"
          onClick={() => finish(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="reset-button"
          onClick={() => finish(true)}
        >
          Done
        </button>
      </div>
    </dialog>
  );
}
