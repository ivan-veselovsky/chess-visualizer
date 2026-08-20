import { useEffect, useRef, useState } from "react";

interface PgnExportDialogProps {
  open: boolean;
  /** The game, or null when the line cannot be written as one. */
  pgn: string | null;
  onClose: () => void;
}

/**
 * Shows the current game for copying.
 *
 * Read-only: this is the game as played, and editing it here would change
 * nothing. Escape and a click outside both close it, but neither is visible, so
 * a corner control says so plainly.
 */
export default function PgnExportDialog({
  open,
  pgn,
  onClose,
}: PgnExportDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      setCopied(false);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  async function copy() {
    if (pgn === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(pgn);
      setCopied(true);
    } catch {
      // Denied, or no clipboard outside a secure context: select it instead so
      // the usual keystroke still works.
      text.current?.select();
    }
  }

  return (
    <dialog
      ref={dialog}
      className="pgn-dialog"
      onClose={onClose}
      // A click landing on the dialog itself is a click on its backdrop.
      onClick={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
    >
      <div className="pgn-dialog-header">
        <label htmlFor="pgn-export">Game as PGN</label>
        <button
          type="button"
          className="dialog-close"
          aria-label="Close"
          title="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <textarea
        id="pgn-export"
        ref={text}
        className="pgn-text"
        rows={12}
        readOnly
        value={pgn ?? "This position was set by hand, so there is no game to write."}
      />
      <div className="pgn-dialog-actions">
        <button
          type="button"
          className="reset-button"
          disabled={pgn === null}
          onClick={() => void copy()}
        >
          {copied ? "Copied" : "Copy to clipboard"}
        </button>
      </div>
    </dialog>
  );
}
