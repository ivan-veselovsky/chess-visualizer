import type { GameStash } from "../chess/stash";
import type { LibraryGame } from "../chess/gameLibrary";

/** How a library game is told apart from a stashed one in the list's values: a stash name cannot start with it by accident, as no reader types it. */
const LIBRARY = "library:";

interface StashedGamesProps {
  stash: GameStash;
  /** The games that come with the app: in the list too, to be read and never written over. */
  library: LibraryGame[];
  /** Which stashed game the board is on, or null when it is on anything else. */
  value: string | null;
  /** Which library game the board is on, untouched, or null. */
  libraryValue: string | null;
  /** Why the list is closed, when it is. */
  locked?: string | null;
  /**
   * Called as the list is about to be read, so that what another tab has put
   * aside since is in it. A browser store is read in a fraction of a
   * millisecond; a list that is out of date is a game the reader cannot reach.
   */
  onOpen?: () => void;
  onSelect: (name: string) => void;
  onSelectLibrary: (game: LibraryGame) => void;
}

/**
 * Brings a game back from the stash, exactly as it was put there — or one of
 * the games that come with the app.
 *
 * The two in one list, since to the reader they are one thing: games kept
 * somewhere, to be had back by name. The library's after the reader's own, in
 * a group of their own, each with a lock: read-only records, which nothing
 * stashed can write over. A library game played on is the reader's own from
 * the first move of their own — no longer the library's, and kept, if it is
 * to be kept, under a name of their own.
 *
 * The list names the game being looked at for as long as the board stays with
 * it, which is also what makes "Stash game" able to write back over it.
 */
export default function StashedGames({
  stash,
  library,
  value,
  libraryValue,
  locked = null,
  onOpen,
  onSelect,
  onSelectLibrary,
}: StashedGamesProps) {
  const selected = value ?? (libraryValue === null ? "" : `${LIBRARY}${libraryValue}`);

  return (
    <div className={`stashed-games${locked !== null ? " label-off" : ""}`}>
      <label htmlFor="stashed-game">Stashed games</label>
      <select
        id="stashed-game"
        className="game-select"
        value={selected}
        disabled={locked !== null}
        title={locked ?? undefined}
        /* Both, because either can open a list: a pointer on the way down, and
           a keyboard arriving at it. */
        onMouseDown={onOpen}
        onFocus={onOpen}
        onChange={(event) => {
          const chosen = event.target.value;
          if (chosen.startsWith(LIBRARY)) {
            const game = library.find((candidate) => candidate.id === chosen.slice(LIBRARY.length));
            if (game !== undefined) {
              onSelectLibrary(game);
            }
          } else if (chosen !== "") {
            onSelect(chosen);
          }
        }}
      >
        {/* Selected whenever the board is on something not from the list. */}
        <option value=""></option>
        {stash.length > 0 && (
          <optgroup label="Stashed">
            {stash.map((game) => (
              <option key={game.name} value={game.name}>
                {game.name}
              </option>
            ))}
          </optgroup>
        )}
        {/* A lock, as text: an option holds nothing but its words. Asked for
            in text presentation, so it is drawn in the list's own colour
            where a font can, rather than as a picture. */}
        <optgroup label="Library">
          {library.map((game) => (
            <option key={game.id} value={`${LIBRARY}${game.id}`} title="From the library: read-only">
              {"\u{1F512}︎ "}
              {game.label}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
