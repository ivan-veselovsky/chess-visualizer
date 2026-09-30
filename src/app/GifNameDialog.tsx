import { useEffect, useRef, useState } from "react";
import { asFileName } from "./gif/fileName";

interface GifNameDialogProps {
  open: boolean;
  /** The name offered: the players, where the board names them. */
  suggested: string;
  /** What the file is, said in the question — "animated GIF", "video" — and what it ends in. */
  what: string;
  extension: string;
  /** Where it will go: the chosen folder's name, or null for the downloads. */
  folder: string | null;
  /** Whether the folder already has a file of this name; null where that cannot be asked. */
  exists: ((name: string) => Promise<boolean>) | null;
  onExport: (name: string) => void;
  onClose: () => void;
}

/**
 * What to call the file about to be made, asked before it is made rather than
 * after: an export takes a while, and a question waiting at the end of it is a
 * question nobody is there to answer.
 *
 * It says where the file will go, and — where it can tell — that one of the
 * same name is there already and will be replaced. A warning rather than a
 * refusal: exporting the same game again, better, under the same name is the
 * usual reason for the clash.
 */
export default function GifNameDialog({
  open,
  suggested,
  what,
  extension,
  folder,
  exists,
  onExport,
  onClose,
}: GifNameDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(suggested);
  const [clash, setClash] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      setName(suggested);
      element.showModal();
      /* The name is what is being asked, so it starts selected, ready to be
         typed over or kept with Enter. The part before the ending only: that is
         the part anybody would want to change. */
      window.setTimeout(() => {
        const input = field.current;
        input?.focus();
        input?.setSelectionRange(0, suggested.replace(/\.(gif|mp4)$/i, "").length);
      }, 0);
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, suggested]);

  const fileName = asFileName(name, extension);
  const ready = fileName !== "";

  /* Asked as it is typed, and the answer only kept if it is still the name. */
  useEffect(() => {
    if (!open || exists === null || !ready) {
      setClash(false);
      return;
    }
    let current = true;
    void exists(fileName).then((there) => {
      if (current) {
        setClash(there);
      }
    });
    return () => {
      current = false;
    };
  }, [open, exists, fileName, ready]);

  return (
    <dialog ref={dialog} className="pgn-dialog save-as-dialog" onClose={onClose}>
      <p className="confirm-question">Save the {what} as</p>
      <div className="board-controls">
        <input
          id="gif-name"
          ref={field}
          type="text"
          className="fen-input"
          aria-label={`A name for the ${what}`}
          value={name}
          maxLength={128}
          spellCheck={false}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && ready) {
              onExport(fileName);
            }
          }}
        />
      </div>
      <p className="invite-note">
        {folder === null
          ? "It goes wherever your browser puts downloads."
          : `It goes into the folder “${folder}”.`}
      </p>
      {clash && (
        <p className="invite-note preset-trouble">
          There is a “{fileName}” there already. Exporting replaces it.
        </p>
      )}
      <div className="board-controls save-as-choice">
        <span />
        <div className="button-pair save-as-pair">
          <button type="button" className="reset-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="reset-button"
            disabled={!ready}
            onClick={() => onExport(fileName)}
          >
            Export
          </button>
        </div>
      </div>
    </dialog>
  );
}
