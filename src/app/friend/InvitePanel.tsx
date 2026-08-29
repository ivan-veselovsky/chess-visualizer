import CopyButton from "../CopyButton";
import ShareIcon from "../ShareIcon";
import { describeHandicap } from "../../chess/handicap";
import type { Color } from "chess.js";
import type { EndReason, GameResult } from "../../../worker/protocol";
import { OPPONENT_CHOOSES } from "../../../worker/protocol";
import { spellGameId } from "./storage";
import type { Phase } from "./useFriendGame";

interface InvitePanelProps {
  phase: Phase;
  onLeave: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onAnswerDraw: (accept: boolean) => void;
  /** Something the object said no to, while the game goes on. */
  notice: string | null;
  onDismissNotice: () => void;
}

/** The terms worth saying, run together; the ones that say nothing are left out. */
function terms(parts: (string | null)[]): string {
  return parts.filter((part) => part !== null).join(" \u00b7 ");
}

/** How a finished game reads to the player looking at it. */
function endingOf(
  over: { result: GameResult; reason: EndReason },
  you: Color
): string {
  const mine = over.result === "1-0" ? "w" : over.result === "0-1" ? "b" : null;
  const how: Record<EndReason, string> = {
    checkmate: "checkmate",
    resignation: "resignation",
    stalemate: "stalemate",
    agreement: "agreement",
    repetition: "repetition",
    fiftyMove: "the fifty-move rule",
    insufficientMaterial: "too little material to mate",
    challengeDeclined: "the challenge being declined",
    challengeCancelled: "the invite being taken back",
  };
  if (mine === null) {
    return `Drawn by ${how[over.reason]}.`;
  }
  return mine === you
    ? `You won by ${how[over.reason]}.`
    : `You lost by ${how[over.reason]}.`;
}

/**
 * How the friendly game stands, beside the board rather than over it.
 *
 * There is no way to walk out of a game in progress, and that is deliberate:
 * leaving quietly would strand the opponent in front of a board waiting for a
 * move that is never coming. Resigning is how a game is given up, and it says
 * so to the other side.
 *
 * A panel and not a dialog: waiting for a friend to answer can take as long as
 * it takes to send them a message and for them to read it, and there is no
 * reason to hold the whole app still meanwhile. The board stays usable.
 *
 * The invite is offered two ways, because two ways are how people actually
 * pass one on: a link to send, and a number to read out. The number is nine
 * digits in three groups, which is a thing that can be said down a telephone.
 */
export default function InvitePanel({
  phase,
  onLeave,
  onResign,
  onOfferDraw,
  onAnswerDraw,
  notice,
  onDismissNotice,
}: InvitePanelProps) {
  if (
    phase.kind === "idle" ||
    phase.kind === "challenging" ||
    phase.kind === "invited"
  ) {
    return null;
  }

  return (
    <aside className="invite-panel" aria-label="Game with a friend">
      {phase.kind === "waiting" && (
        <>
          <p className="invite-heading">Waiting for your opponent…</p>

          <div className="board-controls">
            <label htmlFor="invite-link">Invite link</label>
            <input
              id="invite-link"
              type="text"
              className="fen-input"
              readOnly
              value={phase.link}
              onFocus={(event) => event.target.select()}
            />
            <CopyButton
              label="Copy"
              icon={<ShareIcon />}
              title="Copy the invite link"
              text={() => phase.link}
            />
          </div>

          <div className="board-controls">
            <label htmlFor="invite-number">Game id</label>
            {/* Said aloud as often as it is pasted, so it is shown the way it
                would be read: in threes. */}
            <output id="invite-number" className="invite-number">
              {spellGameId(phase.gameId)}
            </output>
            <CopyButton
              label="Copy"
              title="Copy the game id"
              text={() => phase.gameId}
            />
          </div>

          <p className="invite-note">
            {terms([
              phase.you === OPPONENT_CHOOSES
                ? "My opponent picks a side"
                : phase.you === "w"
                  ? "I play White"
                  : "I play Black",
              // Said only when there is one: "None" on its own reads as a
              // riddle rather than as the absence of odds.
              phase.terms.handicap === null
                ? null
                : describeHandicap(phase.terms.handicap, "challenger"),
              phase.terms.takebacks > 0
                ? `${phase.terms.takebacks} takebacks each`
                : null,
            ])}
          </p>

          <div className="pgn-dialog-actions">
            <button type="button" className="reset-button" onClick={onLeave}>
              Cancel invite
            </button>
          </div>
        </>
      )}

      {phase.kind === "playing" && (
        <>
          {/* What can still be done about the game, before what it is: the
              actions are why anyone looks at this panel mid-game. */}
          {phase.over === null && (
            <div className="board-controls invite-actions">
              <>
                <button
                  type="button"
                  className="reset-button"
                  title="Give the game up"
                  onClick={onResign}
                >
                  Resign
                </button>
                <button
                  type="button"
                  className="reset-button"
                  disabled={phase.drawOffered === phase.you}
                  title={
                    phase.drawOffered === phase.you
                      ? "Already offered — it is with your opponent"
                      : "Offer to end the game evenly"
                  }
                  onClick={onOfferDraw}
                >
                  Suggest draw
                </button>
              </>
            </div>
          )}

          {/* A draw offered to me is a question, and questions come with the
              two answers rather than a note saying one was asked. */}
          {phase.drawOffered !== null && phase.drawOffered !== phase.you && (
            <div className="board-controls invite-question">
              <span>{phase.opponent} offers a draw</span>
              <button
                type="button"
                className="reset-button controls-end"
                onClick={() => onAnswerDraw(false)}
              >
                No
              </button>
              <button
                type="button"
                className="reset-button"
                onClick={() => onAnswerDraw(true)}
              >
                Accept draw
              </button>
            </div>
          )}

          <p className="invite-heading">
            {phase.over === null
              ? `Playing ${phase.opponent} — you are ${phase.you === "w" ? "White" : "Black"}`
              : endingOf(phase.over, phase.you)}
          </p>
          {/* Said and then let go of: the game is what matters, not the last
              thing that could not be done. */}
          {notice !== null && (
            <p
              className="invite-notice"
              role="status"
              onClick={onDismissNotice}
            >
              {notice}
            </p>
          )}

          <p className="invite-note">
            {terms([
              phase.terms.handicap === null
                ? null
                : describeHandicap(phase.terms.handicap, "challenger"),
              phase.terms.takebacks > 0
                ? `takebacks: you ${phase.takebacksLeft?.[phase.you] ?? 0}, ${
                    phase.opponent
                  } ${
                    phase.takebacksLeft?.[phase.you === "w" ? "b" : "w"] ?? 0
                  }`
                : null,
            ])}
          </p>

          {/*
            A finished game is not left, it is put away — there is nothing to
            leave, it ended. At the far end of the last row, where every other
            way out in this app sits.
          */}
          {phase.over !== null && (
            <div className="pgn-dialog-actions">
              <button
                type="button"
                className="reset-button"
                title="Put this game away"
                onClick={onLeave}
              >
                Close
              </button>
            </div>
          )}
        </>
      )}

      {phase.kind === "declined" && (
        <>
          <p className="invite-heading">
            {phase.mine
              ? "You turned that challenge down."
              : "Your invite was declined."}
          </p>
          <div className="pgn-dialog-actions">
            <button type="button" className="reset-button" onClick={onLeave}>
              Close
            </button>
          </div>
        </>
      )}

      {phase.kind === "error" && (
        <>
          <p className="invite-heading">{phase.reason}</p>
          <div className="pgn-dialog-actions">
            <button type="button" className="reset-button" onClick={onLeave}>
              Close
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
