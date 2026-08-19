import { useEffect, useRef, useState } from "react";

interface PgnDialogProps {
  open: boolean;
  /** Loads the text; returns why it was rejected, or null on success. */
  onSubmit: (pgn: string) => string | null;
  onClose: () => void;
}

/**
 * A place to paste a game into.
 *
 * A native <dialog> rather than a hand-built overlay: it takes focus, closes on
 * Escape, and dims what is behind it without any of that needing writing. The
 * text is held here and thrown away on close, so what is on the board is the
 * only record of what was loaded.
 */
export default function PgnDialog({ open, onSubmit, onClose }: PgnDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      setText("");
      setError(null);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  function load() {
    const rejected = onSubmit(text);
    setError(rejected);
    if (rejected === null) {
      onClose();
    }
  }

  return (
    // onClose also fires for Escape and the backdrop, keeping the flag in step.
    <dialog ref={dialog} className="pgn-dialog" onClose={onClose}>
      <label htmlFor="pgn-text">Paste a game in PGN</label>
      <textarea
        id="pgn-text"
        className="pgn-text"
        rows={12}
        value={text}
        spellCheck={false}
        autoFocus
        placeholder={'[Event "..."]\n\n1. e4 e5 2. Nf3 Nc6 ...'}
        onChange={(event) => setText(event.target.value)}
      />
      {error !== null && (
        <p className="pgn-error" role="alert">
          {error}
        </p>
      )}
      <div className="pgn-dialog-actions">
        <button type="button" className="reset-button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="reset-button" onClick={load}>
          Load
        </button>
      </div>
    </dialog>
  );
}
