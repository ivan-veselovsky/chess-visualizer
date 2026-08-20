import type { GameStash } from "../chess/stash";

interface StashedGamesProps {
  stash: GameStash;
  /** Which stashed game the board is on, or null when it is on anything else. */
  value: string | null;
  onSelect: (name: string) => void;
}

/**
 * Brings a game back from the stash, exactly as it was put there.
 *
 * The list names the game being looked at for as long as the board stays with
 * it, which is also what makes "Stash it" able to write back over it.
 */
export default function StashedGames({
  stash,
  value,
  onSelect,
}: StashedGamesProps) {
  const empty = stash.length === 0;

  return (
    <div className="stashed-games">
      <label htmlFor="stashed-game">Stashed games</label>
      <select
        id="stashed-game"
        className="game-select"
        value={value ?? ""}
        disabled={empty}
        title={empty ? "Nothing stashed yet" : undefined}
        onChange={(event) => {
          if (event.target.value !== "") {
            onSelect(event.target.value);
          }
        }}
      >
        {/* Selected whenever the board is on something not from the stash. */}
        <option value=""></option>
        {stash.map((game) => (
          <option key={game.name} value={game.name}>
            {game.name}
          </option>
        ))}
      </select>
    </div>
  );
}
