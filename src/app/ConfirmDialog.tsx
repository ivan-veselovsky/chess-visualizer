import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  /** What is being asked, in a sentence. */
  question: string;
  /** More about it, when a sentence is not enough. */
  detail?: string;
  /** What agreeing is called. */
  confirmLabel: string;
  /** What declining is called. */
  dismissLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * A yes or no, asked before something is changed on the reader's behalf.
 *
 * Settings are the reader's, and a program that quietly adjusts one because it
 * thinks it knows better is a program whose settings cannot be trusted. So the
 * suggestion is made and the answer is theirs.
 */
export default function ConfirmDialog({
  open,
  question,
  detail,
  confirmLabel,
  dismissLabel,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog ref={dialog} className="pgn-dialog confirm-dialog" onClose={onClose}>
      <p className="confirm-question">{question}</p>
      {detail !== undefined && <p className="invite-note">{detail}</p>}
      <div className="pgn-dialog-actions">
        <button type="button" className="reset-button" onClick={onClose}>
          {dismissLabel}
        </button>
        <button
          type="button"
          className="reset-button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
