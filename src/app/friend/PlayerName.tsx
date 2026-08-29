import type { Color } from "chess.js";

interface PlayerNameProps {
  name: string;
  color: Color;
  /** Whether this is the person at this screen. */
  mine: boolean;
}

/**
 * A player's name, on their side of the board.
 *
 * Above and below rather than beside: the two names then sit where the two
 * players would, and turning the board round moves them with it. The near one
 * says so — with two friends who have both called themselves after a cat, the
 * board is otherwise the only thing that says which end is yours.
 *
 * Room here for a clock, when there is one.
 */
export default function PlayerName({ name, color, mine }: PlayerNameProps) {
  return (
    <p className="player-name">
      <span
        className={`player-color player-color-${color}`}
        aria-hidden="true"
      />
      {name}
      {mine && <span className="player-mine"> (me)</span>}
    </p>
  );
}
