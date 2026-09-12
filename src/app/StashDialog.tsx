import { useEffect, useId, useRef, useState } from "react";

interface StashDialogProps {
  open: boolean;
  /** Names already in the stash, so a clash is caught before it overwrites. */
  taken: string[];
  /** What the game already goes by, offered as the starting point. */
  initialName?: string | null;
  /** Why the question is being asked, when it is not simply "stash this". */
  prompt?: string;
  /** What the way out is called, when it is not simply cancelling. */
  dismissLabel?: string;
  /** What the way in is called, when it is not simply stashing. */
  submitLabel?: string;
  /**
   * Takes the name, or gives back why it cannot be taken — which is shown, and
   * the question stays open for another answer. Another tab of the same app
   * having stashed under that name is the reason there is one.
   */
  onSubmit: (name: string) => string | void;
  onClose: () => void;
}

/**
 * Asks what to call the game being put aside.
 *
 * A name already in the stash is not refused — replacing is the point of
 * stashing again — but it is not silent either: the first press turns into a
 * question, and the second answers it. Editing the name takes the question
 * back, so a name typed after the warning is checked on its own terms.
 */
export default function StashDialog({
  open,
  taken,
  initialName = null,
  prompt,
  dismissLabel = "Cancel",
  submitLabel,
  onSubmit,
  onClose,
}: StashDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  /*
    One of these is asked before a game goes up and another when the reader asks
    to stash; both are in the document at once, open or not. An id written out
    would be the same id twice, and a label would then name the field of
    whichever came first — the closed one.
  */
  const field = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      setName(initialName ?? "");
      setError(null);
      setReplacing(false);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, initialName]);

  const trimmed = name.trim();

  function stash() {
    if (trimmed === "") {
      setError("Give the game a name.");
      return;
    }
    if (!replacing && taken.includes(trimmed)) {
      setReplacing(true);
      return;
    }
    const refused = onSubmit(trimmed);
    if (typeof refused === "string") {
      setError(refused);
      setReplacing(false);
      return;
    }
    onClose();
  }

  return (
    // onClose also fires for Escape and the backdrop, keeping the flag in step.
    <dialog ref={dialog} className="pgn-dialog stash-dialog" onClose={onClose}>
      {prompt !== undefined && <p className="stash-prompt">{prompt}</p>}
      <label htmlFor={field}>
        {prompt === undefined ? "Stash the game as" : "Keep it as"}
      </label>
      <input
        id={field}
        type="text"
        className="fen-input"
        value={name}
        spellCheck={false}
        autoComplete="off"
        autoFocus
        placeholder="A name to find it by"
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
          setReplacing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            stash();
          }
        }}
      />
      {error !== null && (
        <p className="pgn-error" role="alert">
          {error}
        </p>
      )}
      {replacing && (
        <p className="pgn-error" role="alert">
          “{trimmed}” is already stashed. Replace it?
        </p>
      )}
      <div className="pgn-dialog-actions">
        {/* The two ways out, at one width and held apart: see `.button-pair`.
            Either answer is a whole decision — put the game aside, or let it
            go — and a pair says that where two buttons of different widths
            crowded into a corner do not. */}
        <div className="button-pair">
          <button type="button" className="reset-button" onClick={onClose}>
            {dismissLabel}
          </button>
          <button type="button" className="reset-button" onClick={stash}>
            {replacing ? "Replace" : (submitLabel ?? "Stash")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
