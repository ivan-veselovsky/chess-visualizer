import { GAME_LIBRARY, type LibraryGame } from "../chess/gameLibrary";

interface GameLibraryProps {
  /** Which game the board is on, or null when it is on anything else. */
  value: string | null;
  /** Why the last choice would not load, when it would not. */
  error?: string | null;
  onSelect: (game: LibraryGame) => void;
}

/**
 * Loads a well-known game into the history, at its first position.
 *
 * The list names the game being looked at for as long as the board stays with
 * it — stepping through it, or branching off to try something, keeps the name.
 * Typing a position in or importing another game is what clears it.
 */
export default function GameLibrary({
  value,
  error = null,
  onSelect,
}: GameLibraryProps) {
  return (
    <div className="game-library">
      <label htmlFor="library-game">Game library</label>
      <select
        id="library-game"
        className="game-select"
        value={value ?? ""}
        onChange={(event) => {
          const game = GAME_LIBRARY.find(
            (candidate) => candidate.id === event.target.value
          );
          if (game !== undefined) {
            onSelect(game);
          }
        }}
      >
        {/* Selected whenever the board is on something not from this list. */}
        <option value=""></option>
        {GAME_LIBRARY.map((game) => (
          <option key={game.id} value={game.id}>
            {game.label}
          </option>
        ))}
      </select>
      {error !== null && <p className="fen-error">{error}</p>}
    </div>
  );
}
