import { useEffect, useRef, useState } from "react";
import ToggleField from "./ToggleField";

interface SaveAsDialogProps {
  open: boolean;
  /**
   * Whether this is the question or the request.
   *
   * The request is somebody pressing Save as: they want a name, and the way
   * out is to change their mind. The question is settings about to be replaced
   * that are saved nowhere: the way out is to let them go, and it can be
   * turned off by a reader who would rather it stopped asking.
   */
  confirming: boolean;
  /** Names already taken, so a clash is said before the button is pressed. */
  trouble: (name: string) => string | null;
  /** Whether to go on asking, which the tick turns off. Only asked here. */
  askAgain: boolean;
  onAskAgain: (on: boolean) => void;
  onSave: (name: string) => void;
  /** Go on without saving. */
  onDiscard: () => void;
  /** Leave everything where it is. */
  onClose: () => void;
}

/**
 * Settings that have nowhere to be saved, and what to do about them.
 *
 * One dialog rather than two: the answer that keeps the settings needs a name,
 * so the name is asked for here rather than in a second box behind this one.
 *
 * The tick is the reader saying they know what they are doing. It turns the
 * question off everywhere, and the Gear tab holds the same switch — a question
 * that can only be silenced from a box that no longer appears would be a
 * question nobody could get back.
 */
export default function SaveAsDialog({
  open,
  confirming,
  trouble,
  askAgain,
  onAskAgain,
  onSave,
  onDiscard,
  onClose,
}: SaveAsDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      setName("");
      element.showModal();
      /* The name is the only thing to do here, so the caret starts in it. */
      window.setTimeout(() => field.current?.focus(), 0);
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const wrong = trouble(name);
  const ready = name.trim() !== "" && wrong === null;

  return (
    <dialog ref={dialog} className="pgn-dialog save-as-dialog" onClose={onClose}>
      <p className="confirm-question">
        {confirming
          ? "You have unsaved settings. Would you like to save them?"
          : "Save these settings under a name of your own."}
      </p>
      {/* No label beside the field: the sentence above says what is being
          asked and the button below says what pressing it does, so a word
          between them read as a heading for the box rather than as a name for
          the field. What it says is on the field itself, for anything that
          cannot see the sentence. */}
      <div className="board-controls">
        <input
          id="preset-name"
          ref={field}
          type="text"
          className="fen-input"
          aria-label="A name for these settings"
          value={name}
          maxLength={64}
          placeholder="A name for these settings"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && ready) {
              onSave(name);
            }
          }}
        />
      </div>
      {/* Said as it is typed, not after the button is pressed. */}
      {name.trim() !== "" && wrong !== null && (
        <p className="invite-note preset-trouble">{wrong}</p>
      )}

      <div className="board-controls save-as-choice">
        {/* Only where there is something to stop asking about. Pressing Save as
            is not a question, so there is nothing to silence. */}
        {confirming ? (
          <ToggleField
            id="ask-before-discard-here"
            label="Don&rsquo;t ask again on discard"
            hint="Settings with nowhere to save are discarded from now on. The Gear tab has the same switch."
            checked={!askAgain}
            onChange={(hushed) => onAskAgain(!hushed)}
          />
        ) : (
          <span />
        )}
        <div className="button-pair save-as-pair">
          {/* What the way out is called, which is not the same in the two
              cases: one lets settings go, the other calls the whole thing off
              and changes nothing. */}
          <button
            type="button"
            className="reset-button"
            onClick={confirming ? onDiscard : onClose}
          >
            {confirming ? "Discard" : "Cancel"}
          </button>
          <button
            type="button"
            className="reset-button"
            disabled={!ready}
            onClick={() => onSave(name)}
          >
            Save
          </button>
        </div>
      </div>
    </dialog>
  );
}
