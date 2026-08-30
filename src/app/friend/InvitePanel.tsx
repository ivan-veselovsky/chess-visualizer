import CopyButton from "../CopyButton";
import DrawIcon from "../DrawIcon";
import FlagIcon from "../FlagIcon";
import ShareIcon from "../ShareIcon";
import TakebackIcon from "../TakebackIcon";
import { describeHandicap } from "../../chess/handicap";
import { endingOf } from "./ending";
import { OPPONENT_CHOOSES } from "../../../worker/protocol";
import { spellGameId } from "./storage";
import type { Link, Phase } from "./useFriendGame";

interface InvitePanelProps {
  phase: Phase;
  /** How the line stands, at both ends of it. */
  link: Link;
  /** This player's own name, for the end of the line they are at. */
  myName: string;
  /** Whether a move can be taken back at this moment. */
  canTakeBack: boolean;
  /** Why it can or cannot, for the button to say without being pressed. */
  takebackReason: string;
  onTakeBack: () => void;
  onLeave: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onAnswerDraw: (accept: boolean) => void;
  /** Something the object said no to, while the game goes on. */
  notice: string | null;
  onDismissNotice: () => void;
}

/**
 * One light on the line: green for up, red for down, grey for not knowable
 * from here.
 *
 * The colour is not the whole of it — it carries the same three states in
 * words, for anyone who cannot tell the first two apart or is not looking at
 * it with their eyes.
 */
function LinkDot({ up, what }: { up: boolean | null; what: string }) {
  const state = up === null ? "unknown" : up ? "up" : "down";
  const said =
    up === null ? "unknown" : up ? "connected" : "not connected";
  return (
    <span
      className={`link-dot link-dot-${state}`}
      role="img"
      aria-label={`${what}: ${said}`}
      title={`${what}: ${said}`}
    />
  );
}

/** The terms worth saying, run together; the ones that say nothing are left out. */
function terms(parts: (string | null)[]): string {
  return parts.filter((part) => part !== null).join(" \u00b7 ");
}

/** How a finished game reads to the player looking at it. */

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
  link,
  myName,
  canTakeBack,
  takebackReason,
  onTakeBack,
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
      {/* The address named a game and the object has not said what it is yet.
          Said plainly, because the wait is a round trip and the id is the one
          thing already known to be true. */}
      {phase.kind === "opening" && (
        <p className="invite-heading">
          Opening game {spellGameId(phase.gameId)}
          {"\u2026"}
        </p>
      )}

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
          {/* What game this is, first: everything under it is about this game,
              and the reader who has two of them open needs to know which one
              they are looking at before they read a control. */}
          <p className="invite-heading">
            {phase.over === null
              ? `Playing ${phase.opponent} — you are ${phase.you === "w" ? "White" : "Black"}`
              : endingOf(phase.over, phase.you)}
          </p>

          {/*
            The line, drawn as it is: two hops, each with a light on it. The
            middle one is the object, which is the only thing either player is
            actually connected to — they are never connected to each other, and
            a picture that suggested otherwise would make the wrong half look
            broken when one of them walks away.
          */}
          <p
            className="link-row"
            aria-label={`Connection: ${
              link.mine ? "connected" : "not connected"
            } to the server, opponent ${
              link.theirs === null
                ? "unknown"
                : link.theirs
                  ? "connected"
                  : "not connected"
            }`}
          >
            <span className="link-name">{myName} (me)</span>
            <span className="link-wire" />
            <LinkDot up={link.mine} what="Your connection to the server" />
            <span className="link-name">Server</span>
            <span className="link-wire" />
            <LinkDot
              /*
                Unknown once the game is over, whatever was last heard: the
                probes have stopped, and a light nothing is checking should not
                be reporting. Also unknown when this end's own line is down,
                since the far end is only ever knowable through it.
              */
              up={link.mine && phase.over === null ? link.theirs : null}
              what={`${phase.opponent}'s connection to the server`}
            />
            <span className="link-name">{phase.opponent}</span>
          </p>

          {/*
            A row of its own, above the two that end the game. Taking a move
            back is part of playing — an agreed courtesy, spent from a counted
            allowance — and putting it beside Resign would make a slip of the
            mouse expensive.

            Shown only where the game allows any: a control that can never be
            enabled is a question the reader has to answer every time they look
            at the panel.
          */}
          {/*
            The two that end the game at one end of the row, and the one that
            is part of playing it held right away at the other. They share a
            row because they are all things to do about the game in front of
            you; they are put at opposite ends because a slip of the mouse
            between them should not be able to end it.

            Takeback is there only where the game allows any: a control that
            can never be enabled is a question the reader has to answer every
            time they look at the panel.
          */}
          {phase.over === null && (
            <div className="board-controls invite-actions">
              <button
                type="button"
                className="reset-button"
                title="Give the game up"
                onClick={onResign}
              >
                <FlagIcon />
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
                <DrawIcon />
                Suggest draw
              </button>
              {phase.terms.takebacks > 0 && (
                <button
                  type="button"
                  className="reset-button controls-end"
                  disabled={!canTakeBack}
                  title={takebackReason}
                  onClick={onTakeBack}
                >
                  <TakebackIcon />
                  Takeback
                </button>
              )}
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

          {/* The odds are not repeated here. They were a thing to agree to,
              and once the game is on they are in the position itself — where
              the reader can see them. What is left to spend cannot be seen on
              the board, so that is what this line is for. */}
          {phase.terms.takebacks > 0 && (
            <p className="invite-note">
              {`Takebacks: me ${
                phase.takebacksLeft?.[phase.you] ?? 0
              }, ${phase.opponent} ${
                phase.takebacksLeft?.[phase.you === "w" ? "b" : "w"] ?? 0
              }`}
            </p>
          )}

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
