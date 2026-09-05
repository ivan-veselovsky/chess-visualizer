import { useEffect, useRef, useState } from "react";
import CopyButton from "../CopyButton";
import DrawIcon from "../DrawIcon";
import FlagIcon from "../FlagIcon";
import ShareIcon from "../ShareIcon";
import TakebackIcon from "../TakebackIcon";
import { describeHandicap } from "../../chess/handicap";
import { halfMoves } from "./counting";
import { endingOf } from "./ending";
import { OPPONENT_CHOOSES } from "../../../worker/protocol";
import { gameLink } from "./connection";
import InviteDetails from "./InviteDetails";
import { spellGameId } from "./storage";
import type { Link, Phase } from "./useFriendGame";

interface InvitePanelProps {
  phase: Phase;
  /** How the line stands, at both ends of it. */
  link: Link;
  /** This player's own name, for the end of the line they are at. */
  myName: string;
  /** How many moves the line on the board holds, in plies. */
  movesPlayed: number;
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
/**
 * The line, drawn as it is: two hops, each with a light on it.
 *
 * The middle one is the object, which is the only thing either player is
 * actually connected to — they are never connected to each other, and a picture
 * that suggested otherwise would make the wrong half look broken when one of
 * them walks away.
 *
 * Shown while a game is being opened as well as while one is being played. A
 * game that will not open and a server that cannot be reached look the same
 * from the outside — "Opening game 230 998 632…" and then nothing — and this is
 * the difference, said in the same picture the reader already knows.
 */
function LinkLine({
  myName,
  opponent,
  link,
  known,
}: {
  myName: string;
  /** Null while it is not known who is at the other end yet. */
  opponent: string | null;
  link: Link;
  /** Whether the far end is worth reporting at all. */
  known: boolean;
}) {
  return (
    <p
      className="link-row"
      aria-label={`Connection: ${
        link.mine ? "connected" : "not connected"
      } to the server, opponent ${
        link.theirs === null ? "unknown" : link.theirs ? "connected" : "not connected"
      }`}
    >
      <span className="link-name">{myName} (me)</span>
      <span className="link-wire" />
      <LinkDot up={link.mine} what="Your connection to the server" />
      <span className="link-name">Server</span>
      <span className="link-wire" />
      <LinkDot
        /*
          Unknown once the game is over, whatever was last heard: the probes
          have stopped, and a light nothing is checking should not be reporting.
          Also unknown when this end's own line is down, since the far end is
          only ever knowable through it.
        */
        up={link.mine && known ? link.theirs : null}
        what={
          opponent === null
            ? "Your opponent's connection to the server"
            : `${opponent}'s connection to the server`
        }
      />
      <span className="link-name">{opponent ?? "…"}</span>
    </p>
  );
}

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
/**
 * A time as somebody in the room would say it: the clock alone for something
 * that happened today, the day as well for anything older. Whose clock is the
 * reader's own, so a game played in another timezone reads as the hour it was
 * here.
 */
function whenOf(at: number): string {
  const then = new Date(at);
  const clock = then.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  return sameDay
    ? clock
    : `${then.toLocaleDateString([], { day: "numeric", month: "short" })}, ${clock}`;
}

/**
 * What a game is, in the three facts that are not on the board: when it began,
 * how far it has got, and when it finished.
 *
 * The count is of half-moves; `halfMoves` says why. It gives the stage a game
 * is at without anyone reading the line, which is what tells a game left at the
 * third move from one left at the fortieth.
 */
function facts(
  startedAt: number | null,
  endedAt: number | null,
  movesPlayed: number
): string {
  const said: string[] = [];
  if (startedAt !== null) {
    said.push(`Started ${whenOf(startedAt)}`);
  }
  said.push(halfMoves(movesPlayed));
  if (endedAt !== null) {
    said.push(`ended ${whenOf(endedAt)}`);
  }
  return said.join(" \u00b7 ");
}

export default function InvitePanel({
  phase,
  link,
  myName,
  movesPlayed,
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
  /*
    Whether the game's link and number are being shown again. Held here rather
    than in the app: nothing outside this panel opens it, and the button that
    does is a few lines below.

    Both hooks stand ahead of the early return: a component may not call fewer
    of them on one render than on another, and this one draws nothing at all
    for half the phases there are.
  */
  const [showingLink, setShowingLink] = useState(false);
  const linkDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = linkDialog.current;
    if (element === null) {
      return;
    }
    if (showingLink && !element.open) {
      element.showModal();
    } else if (!showingLink && element.open) {
      element.close();
    }
  }, [showingLink]);

  if (
    phase.kind === "idle" ||
    phase.kind === "challenging" ||
    phase.kind === "invited"
  ) {
    return null;
  }

  /*
    A frame of its own around the game being played.
    
    It had none for a while, on the grounds that a tab showing one game does not
    need to be told which part of it is the game. With several games in a list
    underneath, it does: the frame is what says "this one is in front of you"
    and holds the eye to it. Nothing is drawn when there is no game — the panel
    returns above rather than framing an empty space.
  */
  return (
    <aside className="invite-panel invite-panel-framed" aria-label="Game with a friend">
      {/* The address named a game and the object has not said what it is yet.
          Said plainly, because the wait is a round trip and the id is the one
          thing already known to be true. */}
      {phase.kind === "opening" && (
        <>
          <p className="invite-heading">
            Opening game {spellGameId(phase.gameId)}
            {"\u2026"}
          </p>
          {/* Which of the two waits this is: a round trip, or a server that is
              not answering. The picture says it without a word, and it goes on
              saying it while the app keeps trying. */}
          <LinkLine myName={myName} opponent={null} link={link} known={false} />
          {link.mine === false && (
            <p className="invite-note">
              The server cannot be reached just now. This keeps trying, and the
              game comes up as soon as it answers.
            </p>
          )}
        </>
      )}

      {phase.kind === "waiting" && (
        <>
          <p className="invite-heading">Waiting for your opponent…</p>

          <InviteDetails gameId={phase.gameId} link={phase.link} />

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
              Cancel challenge
            </button>
          </div>
        </>
      )}

      {phase.kind === "playing" && (
        <>
          {/* What game this is, first: everything under it is about this game,
              and the reader who has two of them open needs to know which one
              they are looking at before they read a control. */}
          <div className="invite-heading-row">
            <p className="invite-heading">
              {phase.over === null
                ? `Playing ${phase.opponent} — you are ${phase.you === "w" ? "White" : "Black"}`
                : endingOf(phase.over, phase.you)}
            </p>
            {/* The link and the number, which the invite showed and then took
                away with it. Wanted again more often than one would think: an
                opponent whose browser has fallen over needs the link a second
                time, and the number is otherwise nowhere on the page — it is
                in the address bar, which is no place to read anything from. */}
            <button
              type="button"
              className="reset-button"
              title="Show this game's challenge link and id again"
              onClick={() => setShowingLink(true)}
            >
              <ShareIcon />
              Challenge link
            </button>
          </div>

          {/* When it began, how far it has got, and when it ended — the three
              things about a game that the board does not show. */}
          <p className="invite-facts">
            {facts(phase.startedAt, phase.endedAt, movesPlayed)}
          </p>

          <dialog
            ref={linkDialog}
            className="pgn-dialog"
            onClose={() => setShowingLink(false)}
          >
            <h2 className="challenge-title">This game</h2>
            <InviteDetails
              gameId={phase.gameId}
              link={gameLink(phase.gameId)}
              idPrefix="playing-invite"
            />
            <p className="invite-note">
              The same link the invite carried. Anyone opening it takes the seat
              this game is still holding — which is your opponent's, and nobody
              else's, so a browser that has fallen over comes back to the game
              it left.
            </p>
            <div className="pgn-dialog-actions">
              <button
                type="button"
                className="reset-button"
                onClick={() => setShowingLink(false)}
              >
                Close
              </button>
            </div>
          </dialog>

          {/*
            The line, drawn as it is: two hops, each with a light on it. The
            middle one is the object, which is the only thing either player is
            actually connected to — they are never connected to each other, and
            a picture that suggested otherwise would make the wrong half look
            broken when one of them walks away.
          */}
          <LinkLine
            myName={myName}
            opponent={phase.opponent}
            link={link}
            known={phase.over === null}
          />

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
                /* Not while a draw is on the table, whoever put it there.
                   Mine is with the opponent and offering it again says nothing;
                   theirs is a question, and the answer to a question is not to
                   ask it back. The two answers are on the row below. */
                disabled={phase.drawOffered !== null}
                title={
                  phase.drawOffered === null
                    ? "Offer to end the game evenly"
                    : phase.drawOffered === phase.you
                      ? "Already offered — it is with your opponent"
                      : `${phase.opponent} has offered one — answer it below`
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

          {/* The odds are not repeated here. They were a thing to agree to,
              and once the game is on they are in the position itself — where
              the reader can see them. What is left to spend cannot be seen on
              the board, so that is what this line is for.

              Directly under the button it counts for, and before anything else
              that may or may not be on the panel: a draw offered by the other
              player puts a row between the two, and a count that has drifted a
              line away from the button it belongs to reads as a count of
              something else. */}
          {phase.terms.takebacks > 0 && (
            <p className="invite-note invite-tally">
              {`Takebacks: me ${
                phase.takebacksLeft?.[phase.you] ?? 0
              }, ${phase.opponent} ${
                phase.takebacksLeft?.[phase.you === "w" ? "b" : "w"] ?? 0
              }`}
            </p>
          )}

          {/* A draw offered to me is a question, and questions come with the
              two answers rather than a note saying one was asked. */}
          {phase.drawOffered !== null && phase.drawOffered !== phase.you && (
            <div className="board-controls invite-question">
              <span>{phase.opponent} offers a draw</span>
              <div className="button-pair controls-end">
                <button
                  type="button"
                  className="reset-button"
                  onClick={() => onAnswerDraw(false)}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className="reset-button"
                  onClick={() => onAnswerDraw(true)}
                >
                  Accept draw
                </button>
              </div>
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

          {/*
            Nothing here for a game that has ended. Giving one up is done in the
            list below, where it is done to any of them and to several at once —
            a button here would be a second way to do one thing, and the two
            would have to be kept saying the same about what "giving up" means.
          */}
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
            <button
              type="button"
              className="reset-button"
              title="Forget this game"
              onClick={onLeave}
            >
              Dismiss
            </button>
          </div>
        </>
      )}

      {phase.kind === "error" && (
        <>
          <p className="invite-heading">{phase.reason}</p>
          <div className="pgn-dialog-actions">
            <button
              type="button"
              className="reset-button"
              title="Forget this game"
              onClick={onLeave}
            >
              Dismiss
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
