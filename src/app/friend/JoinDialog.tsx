import { useEffect, useRef, useState } from "react";
import { readGameId, spellGameId } from "./storage";

interface JoinDialogProps {
  open: boolean;
  onJoin: (gameId: string) => void;
  onClose: () => void;
}

/**
 * The number somebody read out, typed in.
 *
 * Asked for only when it is wanted. A field standing on the page all the time
 * would be one more thing to look past for everyone who is not, at this moment,
 * joining a game — which is nearly always.
 *
 * However it was written down — spaces, dashes, or neither — only the digits
 * matter, because it was probably taken down by hand.
 */
export default function JoinDialog({ open, onJoin, onClose }: JoinDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const gameId = readGameId(typed);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      setTyped("");
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  function join() {
    if (gameId !== null) {
      onJoin(gameId);
    }
  }

  return (
    <dialog ref={dialog} className="pgn-dialog join-dialog" onClose={onClose}>
      <h2 className="challenge-title">Accept a challenge</h2>

      <div className="board-controls">
        <label htmlFor="join-game">Game id</label>
        <input
          id="join-game"
          type="text"
          className="fen-input join-number"
          placeholder="482 913 657"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              join();
            }
          }}
        />
      </div>
      <p className="invite-note">
        {typed.trim() === ""
          ? "Nine digits, as they were read to you."
          : gameId === null
            ? "That is not a game id — nine digits, starting with anything but zero."
            : `Looking for game ${spellGameId(gameId)}.`}
      </p>

      <div className="pgn-dialog-actions">
        {/* The two ways out, at one width: see `.button-pair`. */}
        <div className="button-pair">
          {/* There is nothing to decline until a game has been named: until
              then this dialog is a question being asked, and backing out of it
              is cancelling rather than turning anybody down. */}
          <button type="button" className="reset-button" onClick={onClose}>
            {gameId === null ? "Cancel" : "Decline"}
          </button>
          <button
            type="button"
            className="reset-button"
            disabled={gameId === null}
            onClick={join}
          >
            Accept
          </button>
        </div>
      </div>
    </dialog>
  );
}
