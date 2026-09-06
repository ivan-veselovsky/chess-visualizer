import { halfMoves } from "./counting";
import { endingOf } from "./ending";
import { playersOf, seatOf, spellGameId } from "./storage";
import type { SavedGame } from "./storage";
import type { Standing } from "./useFriendGame";
import { OPPONENT_CHOOSES } from "../../../worker/protocol";

interface SavedGamesProps {
  games: SavedGame[];
  /** What the object last said about each of them, by seat. Null where it
      answered that there is no such game: kept for a week after the last thing
      that happened to it, and then swept away. */
  standings: Map<string, Standing | null>;
  /** The seat the panel above is showing, which the list marks as this one. */
  showingSeat: string | null;
  /** Seats ticked for forgetting. */
  chosen: ReadonlySet<string>;
  /**
   * Whether the games have been asked how they stand since the list was opened.
   * Until they have, a row says what this browser last knew and does not claim
   * it is now.
   */
  asked: boolean;
  /** Takes a seat, since a browser may hold two at one game. */
  onOpen: (seat: string) => void;
  onChoose: (seat: string, ticked: boolean) => void;
}

/** How a game stands, in the fewest words that are true. */
function standingOf(
  game: SavedGame,
  live: Standing | undefined | null
): string {
  const you = game.you === OPPONENT_CHOOSES ? "w" : game.you;
  if (live === null) {
    /* Asked, and told there is no such game. What is left here is a seat at
       nothing, which is a row to be rid of rather than a game to go to. */
    return "No longer on the server";
  }
  if (live !== undefined) {
    if (live.status === "planning") {
      return "Waiting for an answer";
    }
    if (live.status === "inProgress") {
      return live.moves === 0 ? "In play" : `In play, ${halfMoves(live.moves)}`;
    }
    return live.reason === null
      ? "Over"
      : endingOf({ result: live.result, reason: live.reason }, you);
  }
  /* Nothing from the object: what this browser last knew, and no more. */
  if (game.ending !== undefined) {
    return endingOf(game.ending, you);
  }
  return game.opponentName === null ? "Waiting for an answer" : "In play";
}

/**
 * A mark for the same thing the words say, so a list of thirty can be read
 * down its edge. Never the only carrier of it — the words are beside it, and
 * the mark says its own name to anything reading the page aloud.
 */
function markOf(
  game: SavedGame,
  live: Standing | undefined | null
): { sign: string; says: string } {
  const you = game.you === OPPONENT_CHOOSES ? "w" : game.you;
  if (live === null) {
    return { sign: "·", says: "No longer on the server" };
  }
  const over =
    live !== undefined
      ? live.status === "finished" && live.reason !== null
        ? { result: live.result, reason: live.reason }
        : null
      : (game.ending ?? null);
  if (over === null) {
    const waiting =
      live !== undefined
        ? live.status === "planning"
        : game.opponentName === null;
    return waiting
      ? { sign: "○", says: "Waiting for an answer" }
      : { sign: "●", says: "Being played" };
  }
  if (over.result === "1/2-1/2" || over.result === "*") {
    return { sign: "½", says: "Drawn or never played" };
  }
  const won = (over.result === "1-0" ? "w" : "b") === you;
  return won
    ? { sign: "+", says: "Won" }
    : { sign: "−", says: "Lost" };
}

/**
 * The games this browser holds a seat at: which one is being shown, who is
 * playing whom in each of the others, and how each stands.
 *
 * The number is on the row after the names, quietly. It was left off for a
 * while — nine digits that say nothing about the game, taking the width of two
 * names — and it is true that a reader picks a game out of thirty by who is in
 * it. But two games against the same person are told apart by nothing else, and
 * nothing stops a browser holding three of them.
 */
export default function SavedGames({
  games,
  standings,
  showingSeat,
  chosen,
  asked,
  onOpen,
  onChoose,
}: SavedGamesProps) {
  if (games.length === 0) {
    return (
      <p className="invite-note">
        None yet. A game challenged or taken up from this browser is kept here
        until it is forgotten, so that a tab shut mid-game can be walked back
        into.
      </p>
    );
  }

  return (
    <ul className="saved-games">
      {games.map((game) => {
        const seat = seatOf(game.gameId, game.role);
        const live = standings.get(seat);
        const players = playersOf(game);
        const mark = markOf(game, live);
        const here = seat === showingSeat;
        /*
          Asked, and it did not answer. A game that was over stays over whatever
          the line is doing, so nothing is in doubt there; one that was being
          played may have been resigned, drawn or won since, and the mark says
          so in the one way that cannot be mistaken for a state of the game.
        */
        const unconfirmed =
          asked && live === undefined && game.ending === undefined;
        /* Asked, and told there is no game there any more. */
        const gone = live === null;
        /* A game still being played is a game something could happen in, so its
           mark says whether anyone could be asked: green while the object
           answers for it, red while it cannot be reached. A game that is over
           needs no such light — nothing can happen in it either way. */
        const playing =
          live != null
            ? live.status === "inProgress"
            : live === null
              ? false
              : game.ending === undefined && game.opponentName !== null;
        /* Only a game nobody can play on any more may be given up here. One
           still waiting for an answer can be, too — forgetting that is taking
           the challenge back, which the button below does at the object. */
        /* A seat at a game that is no longer there is always worth being rid
           of; otherwise, anything that cannot be played on any more. */
        const canForget =
          live === null
            ? true
            : live !== undefined
              ? live.status !== "inProgress"
              : game.ending !== undefined || game.opponentName === null;
        return (
          <li key={seat} className={here ? "saved-game-row here" : "saved-game-row"}>
            <button
              type="button"
              className="reset-button saved-game"
              title={here ? "The game being shown" : "Go to this game"}
              /* Which row is the one on the board, said rather than shown:
                 it is marked by its ground, and a reader who cannot see the
                 colour is otherwise told nothing. */
              aria-current={here ? "true" : undefined}
              onClick={() => onOpen(seat)}
            >
              <span className="saved-game-pair">
                {players === null
                  ? game.myName
                  : `${players.white}${players.yours === "w" ? " (you)" : ""} – ${
                      players.black
                    }${players.yours === "b" ? " (you)" : ""}`}
              </span>
              <span className="saved-game-id">
                ({spellGameId(game.gameId)})
              </span>
              <span className="saved-game-who">{standingOf(game, live)}</span>
              <span
                className={[
                  "saved-game-mark",
                  unconfirmed ? "unconfirmed" : "",
                  gone ? "gone" : "",
                  playing && !unconfirmed ? "playing" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={
                  unconfirmed
                    ? `${mark.says} when last seen — the server could not be reached to ask`
                    : mark.says
                }
                aria-label={
                  unconfirmed
                    ? `${mark.says} when last seen; the server could not be reached`
                    : mark.says
                }
              >
                {mark.sign}
              </span>
            </button>
            <input
              type="checkbox"
              className="saved-game-tick"
              checked={chosen.has(seat)}
              disabled={!canForget}
              aria-label={`Forget this game${canForget ? "" : " — it is still being played"}`}
              title={
                canForget
                  ? "Tick to forget this game in this browser"
                  : "A game still being played cannot be forgotten"
              }
              onChange={(event) => onChoose(seat, event.target.checked)}
            />
          </li>
        );
      })}
    </ul>
  );
}
