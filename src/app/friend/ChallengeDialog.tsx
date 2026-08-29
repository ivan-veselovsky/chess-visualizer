import { useEffect, useRef, useState } from "react";
import type { Color } from "chess.js";
import {
  HANDICAP_PIECES,
  type Handicap,
  type HandicapPiece,
} from "../../chess/handicap";
import { OPPONENT_CHOOSES, type ColorChoice } from "../../../worker/protocol";
import type { ChallengeTerms } from "./useFriendGame";

interface ChallengeDialogProps {
  open: boolean;
  /** The name last played under, so it need not be typed again. */
  name: string;
  onSubmit: (terms: ChallengeTerms) => void;
  onClose: () => void;
}

const PIECE_NAMES: Record<HandicapPiece, string> = {
  pawn: "One pawn",
  knight: "One knight",
  rook: "One rook",
  queen: "One queen",
};

/**
 * The terms of a game offered to a friend.
 *
 * The side is settled here rather than by the server, so the challenger sees
 * what they are offering before the invite exists. There is no die: a roll made
 * on this machine is a roll only one of the two players can check, and the one
 * who cannot check it is the one it matters to. Leaving the choice to the
 * opponent needs no trust at all — one cuts, the other chooses.
 *
 * The odds are recorded against a person rather than a color, so they land on
 * whoever agreed to give them however the sides fall.
 */
export default function ChallengeDialog({
  open,
  name,
  onSubmit,
  onClose,
}: ChallengeDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [myName, setMyName] = useState(name);
  const [color, setColor] = useState<ColorChoice | null>(null);
  const [giver, setGiver] = useState<Handicap["giver"] | "">("");
  const [piece, setPiece] = useState<HandicapPiece | "">("");
  const [takebacks, setReMoves] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      setMyName(name);
      setColor(null);
      setGiver("");
      setPiece("");
      setReMoves(0);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, name]);

  const handicap: Handicap | null =
    giver === "" || piece === "" ? null : { giver, piece };
  const ready = myName.trim() !== "" && color !== null;

  return (
    <dialog
      ref={dialog}
      className="pgn-dialog challenge-dialog"
      /* No dismissal by clicking past it: half-filled terms are worth more than
         a tidy way out, and there is a Cancel for people who mean it. */
      onClose={onClose}
    >
      <h2 className="challenge-title">Challenge a friend</h2>

      <div className="board-controls">
        <label htmlFor="challenge-name">My name</label>
        <input
          id="challenge-name"
          type="text"
          className="fen-input challenge-name"
          value={myName}
          maxLength={32}
          autoFocus
          onChange={(event) => setMyName(event.target.value)}
        />
      </div>

      <div className="board-controls color-row">
        <label htmlFor="challenge-color">My color</label>
        {/* Empty and unmarked until chosen: an unfilled choice should not look
            like a made one. */}
        <output
          id="challenge-color"
          className={
            color === "w" || color === "b"
              ? `color-shown color-shown-${color}`
              : "color-shown"
          }
        >
          {color === "w"
            ? "White"
            : color === "b"
              ? "Black"
              : color === OPPONENT_CHOOSES
                ? "Opponent chooses"
                : ""}
        </output>
        <div className="color-choices">
          <button
            type="button"
            className="reset-button"
            onClick={() => setColor("w")}
          >
            White
          </button>
          <button
            type="button"
            className="reset-button"
            onClick={() => setColor("b")}
          >
            Black
          </button>
          <button
            type="button"
            className="reset-button"
            title="They pick a side when they accept, and you take the other"
            onClick={() => setColor(OPPONENT_CHOOSES)}
          >
            Opponent chooses
          </button>
        </div>
      </div>

      <div className="board-controls">
        <label htmlFor="challenge-giver">Handicap</label>
        <select
          id="challenge-giver"
          className="game-select choice-select"
          value={giver}
          onChange={(event) =>
            setGiver(event.target.value as Handicap["giver"] | "")
          }
        >
          <option value=""></option>
          <option value="challenger">I give</option>
          <option value="opponent">Opponent gives</option>
        </select>
        <select
          className="game-select choice-select"
          value={piece}
          aria-label="What is given"
          onChange={(event) =>
            setPiece(event.target.value as HandicapPiece | "")
          }
        >
          <option value=""></option>
          {HANDICAP_PIECES.map((kind) => (
            <option key={kind} value={kind}>
              {PIECE_NAMES[kind]}
            </option>
          ))}
        </select>
      </div>

      <div className="board-controls">
        <label
          htmlFor="challenge-takebacks"
          title="Take back a move already made, while it is still the last one"
        >
          Takebacks
        </label>
        <input
          id="challenge-takebacks"
          type="number"
          className="fen-input challenge-number"
          min={0}
          max={99}
          value={takebacks}
          onChange={(event) =>
            setReMoves(Math.max(0, Math.trunc(Number(event.target.value) || 0)))
          }
        />
        <span className="field-suffix">each</span>
      </div>

      <div className="pgn-dialog-actions">
        <button type="button" className="reset-button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="reset-button"
          disabled={!ready}
          title={ready ? undefined : "A name and a color first"}
          onClick={() =>
            color !== null &&
            onSubmit({ name: myName.trim(), color, handicap, takebacks })
          }
        >
          Create invite
        </button>
      </div>
    </dialog>
  );
}
