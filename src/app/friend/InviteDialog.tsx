import { useEffect, useRef, useState } from "react";
import type { Color } from "chess.js";
import { describeHandicap } from "../../chess/handicap";
import { OPPONENT_CHOOSES } from "../../../worker/protocol";
import type { Phase } from "./useFriendGame";

interface InviteDialogProps {
  /** The challenge being looked at; anything else closes the dialog. */
  phase: Phase;
  name: string;
  onAnswer: (accept: boolean, name: string, color?: Color) => void;
  onClose: () => void;
}

/**
 * Somebody else's challenge, and the two things that can be done with it.
 *
 * Everything but the name is fixed: these are the terms as they were offered,
 * and the only answer is yes or no. The odds read from this side — the same
 * value the challenger set, said the other way round.
 *
 * Declining spends the invite as surely as accepting does, so the two are set
 * apart: the one that ends it sits away from the one that takes it up.
 */
export default function InviteDialog({
  phase,
  name,
  onAnswer,
  onClose,
}: InviteDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [myName, setMyName] = useState(name);
  /** Asked for only when the challenge left the side open. */
  const [pick, setPick] = useState<Color | null>(null);
  const open = phase.kind === "invited";
  const mine = phase.kind === "invited" ? phase.you : null;
  const choosing = mine === OPPONENT_CHOOSES;

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      setMyName(name);
      setPick(null);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, name]);

  return (
    <dialog
      ref={dialog}
      className="pgn-dialog challenge-dialog invite-dialog"
      onClose={onClose}
    >
      {phase.kind === "invited" && (
        <>
          <h2 className="challenge-title">Challenged by {phase.challenger}</h2>

          <div className="board-controls">
            <label htmlFor="invite-name">My name</label>
            <input
              id="invite-name"
              type="text"
              className="fen-input challenge-name"
              value={myName}
              maxLength={32}
              autoFocus
              onChange={(event) => setMyName(event.target.value)}
            />
          </div>

          <dl className="invite-terms">
            <dt>My color</dt>
            <dd className="color-row">
              {choosing ? (
                /* The challenger fixed every term but this one, and fixing it
                   is what answering does. */
                <>
                  <span
                    className={
                      pick === null
                        ? "color-shown"
                        : `color-shown color-shown-${pick}`
                    }
                  >
                    {pick === null ? "" : pick === "w" ? "White" : "Black"}
                  </span>
                  <button
                    type="button"
                    className="reset-button"
                    onClick={() => setPick("w")}
                  >
                    White
                  </button>
                  <button
                    type="button"
                    className="reset-button"
                    onClick={() => setPick("b")}
                  >
                    Black
                  </button>
                </>
              ) : (
                <>
                  <span className={`color-shown color-shown-${mine}`}>
                    {mine === "w" ? "White" : "Black"}
                  </span>
                  <span className="invite-note">
                    {phase.terms.initialFEN !== null &&
                    phase.terms.initialFEN.split(" ")[1] === mine
                      ? "I move first"
                      : "My opponent moves first"}
                  </span>
                </>
              )}
            </dd>
            {/* One row for where the game starts, as the challenge dialog
                asks it: odds and a game to be continued are two answers to the
                same question, and "Handicap: None" answers neither. */}
            <dt>Start from</dt>
            <dd>
              {phase.terms.priorMoves > 0
                ? `A game already ${phase.terms.priorMoves} moves in`
                : phase.terms.handicap !== null
                  ? describeHandicap(phase.terms.handicap, "opponent")
                  : "The initial position"}
            </dd>
            <dt>Takebacks</dt>
            <dd>{phase.terms.takebacks} each</dd>
          </dl>

          <div className="pgn-dialog-actions">
            <button
              type="button"
              className="reset-button controls-end"
              title="Turn this challenge down — the invite cannot be used again"
              onClick={() => onAnswer(false, myName.trim())}
            >
              Decline
            </button>
            <button
              type="button"
              className="reset-button"
              disabled={myName.trim() === "" || (choosing && pick === null)}
              title={
                choosing && pick === null ? "Choose a side first" : undefined
              }
              onClick={() =>
                onAnswer(
                  true,
                  myName.trim(),
                  choosing ? (pick ?? "w") : undefined
                )
              }
            >
              Accept
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
