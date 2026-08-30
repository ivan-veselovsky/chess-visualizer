import { endingOf } from "./ending";
import { seatOf, spellGameId } from "./storage";
import type { SavedGame } from "./storage";
import { OPPONENT_CHOOSES } from "../../../worker/protocol";

interface SavedGamesProps {
  games: SavedGame[];
  /** Takes a seat, since a browser may hold two at one game. */
  onOpen: (seat: string) => void;
}

/**
 * What each game is, in the fewest words that are true.
 *
 * Three states and no others: nobody has answered the invite yet, a game is
 * being played, or a game is over and here is how it went. Every one of them
 * is a thing the reader can act on by opening it — which is why there is no
 * way to strike a row off this list without opening it. A game answered by
 * pressing a button here would be a game abandoned without its opponent being
 * told, and the honest way to leave one is from inside it.
 */
function standing(game: SavedGame): string {
  if (game.ending !== undefined) {
    return endingOf(
      game.ending,
      game.you === OPPONENT_CHOOSES ? "w" : game.you
    );
  }
  return game.opponentName === null
    ? "Waiting for an answer"
    : `Playing ${game.opponentName}`;
}

/**
 * The games this browser holds a seat at, offered rather than entered.
 *
 * A tab showing no game used to be pulled into whichever one this browser was
 * last in, which made a second tab a second view of the same game and no way
 * to be in two. Now the address says which game a tab is at, and a tab at none
 * gets this: the list, and a choice.
 *
 * Offered and not opened, because a page opened for anything else — a position
 * to look at, a game to read through — should stay where it was put. Nobody
 * arrives at a chess board meaning to be dropped back into a game.
 */
export default function SavedGames({ games, onOpen }: SavedGamesProps) {
  if (games.length === 0) {
    return null;
  }

  return (
    <aside className="invite-panel" aria-label="Games you are in">
      <p className="invite-heading">
        {games.length === 1 ? "A game of yours" : "Your games"}
      </p>
      <ul className="saved-games">
        {games.map((game) => {
          // What is stored and gone back to is the seat; what is shown is the
          // game, which is the number these two people say to each other.
          const seat = seatOf(game.gameId, game.role);
          const over = game.ending !== undefined;
          return (
            <li key={seat}>
              <button
                type="button"
                className="reset-button saved-game"
                title={
                  over
                    ? "Open it to see the game and put it away"
                    : "Go back to this game"
                }
                onClick={() => onOpen(seat)}
              >
                <span className="saved-game-id">
                  {spellGameId(game.gameId)}
                </span>
                <span className="saved-game-who">{standing(game)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
