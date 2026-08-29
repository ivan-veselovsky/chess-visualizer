import { useEffect, useRef, useState } from "react";

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
  onSubmit: (name: string) => void;
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
    onSubmit(trimmed);
    onClose();
  }

  return (
    // onClose also fires for Escape and the backdrop, keeping the flag in step.
    <dialog ref={dialog} className="pgn-dialog stash-dialog" onClose={onClose}>
      {prompt !== undefined && <p className="stash-prompt">{prompt}</p>}
      <label htmlFor="stash-name">
        {prompt === undefined ? "Stash the game as" : "Keep it as"}
      </label>
      <input
        id="stash-name"
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
        <button type="button" className="reset-button" onClick={onClose}>
          {dismissLabel}
        </button>
        <button type="button" className="reset-button" onClick={stash}>
          {replacing ? "Replace" : (submitLabel ?? "Stash")}
        </button>
      </div>
    </dialog>
  );
}
