import { useEffect, useRef, useState } from "react";
import { DEFAULT_POSITION, type Color } from "chess.js";
import {
  HANDICAP_PIECES,
  type Handicap,
  type HandicapPiece,
} from "../../chess/handicap";
import { OPPONENT_CHOOSES, type ColorChoice } from "../../../worker/protocol";
import { halfMoves } from "./counting";
import type { ChallengeTerms } from "./useFriendGame";

interface ChallengeDialogProps {
  open: boolean;
  /** The name last played under, so it need not be typed again. */
  name: string;
  /** What is on the board here, in case the game is to be taken up from it. */
  board: { initialFEN: string; moves: string[] };
  onSubmit: (terms: ChallengeTerms) => void;
  onClose: () => void;
  /** Said as the dialog goes, so a name typed here outlives it. */
  onName: (name: string) => void;
}

/** Where a game is to start: from scratch, from odds, or from a game already
    under way on the challenger's own board. */
type StartFrom = "fresh" | "odds" | "board";

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
  onName,
  open,
  name,
  board,
  onSubmit,
  onClose,
}: ChallengeDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [myName, setMyName] = useState(name);
  const [color, setColor] = useState<ColorChoice | null>(null);
  const [start, setStart] = useState<StartFrom>("fresh");
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
      setStart("fresh");
      setGiver("");
      setPiece("");
      setReMoves(0);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, name]);

  /*
    There is something to take up when the board is not simply waiting to be
    started on: a game part-played, or a position set up by hand. Offered only
    then, since otherwise it is the initial position under a second name.
  */
  const continuable =
    board.moves.length > 0 || board.initialFEN !== DEFAULT_POSITION;

  const handicap: Handicap | null =
    start !== "odds" || giver === "" || piece === ""
      ? null
      : { giver, piece };
  const continueFrom = start === "board" ? board : null;
  // Odds chosen but not named would quietly become an even game.
  const oddsNamed = start !== "odds" || (giver !== "" && piece !== "");
  const ready = myName.trim() !== "" && color !== null && oddsNamed;

  return (
    <dialog
      ref={dialog}
      className="pgn-dialog challenge-dialog"
      /* No dismissal by clicking past it: half-filled terms are worth more than
         a tidy way out, and there is a Cancel for people who mean it. */
      onClose={() => {
        /* A name typed here is kept whichever way this closes: somebody who
           names themselves and then backs out has still said what they are
           called. */
        onName(myName);
        onClose();
      }}
    >
      <h2 className="challenge-title">Send a challenge</h2>

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

      {/*
        One question — where does this game start — and one control for it.
        Odds and a game taken up are alternatives, not two choices that happen
        to conflict: both answer it, and the object refuses to be told twice.
      */}
      <div className="board-controls">
        <label htmlFor="challenge-start">Start from</label>
        <select
          id="challenge-start"
          className="game-select choice-select"
          value={start}
          onChange={(event) => setStart(event.target.value as StartFrom)}
        >
          <option value="fresh">The initial position</option>
          <option value="odds">Odds</option>
          {continuable && (
            <option value="board">
              {board.moves.length > 0
                ? `The game on my board (${halfMoves(board.moves.length)})`
                : "The position on my board"}
            </option>
          )}
        </select>
        {start === "odds" && (
          <>
            <select
              className="game-select choice-select"
              value={giver}
              aria-label="Who gives odds"
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
          </>
        )}
      </div>
      {/* Said here rather than found out later: moves that came with a game
          are not this game's to unmake. */}
      {start === "board" && board.moves.length > 0 && (
        <p className="invite-note challenge-note">
          Both of you take it up from here. The {halfMoves(board.moves.length)}{" "}
          already played stay in the game and in its PGN, and neither side can
          take them back.
        </p>
      )}

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
        {/* The two ways out, at one width: see `.button-pair`. */}
        <div className="button-pair">
          <button type="button" className="reset-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="reset-button"
            disabled={!ready}
            title={
              ready
                ? undefined
                : oddsNamed
                  ? "A name and a color first"
                  : "Say what the odds are, or start from the initial position"
            }
            onClick={() =>
              color !== null &&
              onSubmit({
                name: myName.trim(),
                color,
                handicap,
                takebacks,
                continueFrom,
              })
            }
          >
            Challenge
          </button>
        </div>
      </div>
    </dialog>
  );
}
