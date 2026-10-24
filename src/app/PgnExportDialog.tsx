import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface PgnExportDialogProps {
  open: boolean;
  /** The game, or null when the line cannot be written as one. */
  pgn: string | null;
  onClose: () => void;
  /** What the text is: "Game as PGN" unless said otherwise. */
  heading?: string;
  /** What stands in the box where there is nothing to write. */
  emptyText?: string;
  /** A choice about what is written, under the text: see "Export all stashed". */
  children?: ReactNode;
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
  heading = "Game as PGN",
  emptyText = "This position was set by hand, so there is no game to write.",
  children = null,
}: PgnExportDialogProps) {
  /* Two of these are in the document at once, open or not, so the label's
     field is named by an id of its own rather than one written out. */
  const field = useId();
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

  /* What was copied is not what is there once the text changes under it. */
  useEffect(() => {
    setCopied(false);
  }, [pgn]);

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
        <label htmlFor={field}>{heading}</label>
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
        id={field}
        ref={text}
        className="pgn-text"
        rows={12}
        readOnly
        value={pgn ?? emptyText}
      />
      {children}
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
