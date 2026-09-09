import type { CSSProperties, ReactNode } from "react";
import type { Color } from "chess.js";

interface PlayerNameProps {
  name: string;
  color: Color;
  /** Whether this is the person at this screen. */
  mine: boolean;
  /** Whether the position on the board is waiting on this side. */
  toMove?: boolean;
  /**
   * What the board is showing, said across the top of it: how the game came
   * out, in the middle, and where in the game the board is standing, at the
   * end.
   *
   * Here rather than beside the app's name, where they were for a while. This
   * row is the game's own line — it already carries a player and which side
   * they are — and a fact about the game reads as part of the board rather than
   * as part of the page.
   */
  result?: ReactNode;
  position?: ReactNode;
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
/** Where each petal sits, in degrees round the middle. */
const PETALS = Array.from({ length: 7 }, (_, at) => (at * 360) / 7);

export default function PlayerName({
  name,
  color,
  mine,
  toMove = false,
  result = null,
  position = null,
}: PlayerNameProps) {
  return (
    <p className="player-name">
      <span className="player-who">
      {/*
        Which side this is, and whether the game is waiting on it.

        A disc for the colour, as before; petals round it while it is this
        side's move. They are the page's own ground with a line round them, so
        the flower is the same shape and the same weight whichever side it
        opens on — what the reader is told by its colour is whose turn it is,
        and that is already in the disc at the middle.

        The petals are drawn outside the box the disc takes up, which is what
        keeps them from moving anything: the row is the same height and the
        name starts in the same place whether or not the flower is open, so a
        move played does not shift the board under the reader.
      */}
      <svg
        className={`player-color player-color-${color}${toMove ? " player-color-turn" : ""}`}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        {/* Always here, opened and closed by the stylesheet: a petal that came
            and went with the render would appear at its full size and vanish
            the same way, and what is wanted is a flower growing out from behind
            the disc as the move arrives. The angle travels as a variable
            because the growing is a transform too, and the two have to be
            written together. */}
        {PETALS.map((turn) => (
          <ellipse
            key={turn}
            className="player-petal"
            cx="12"
            cy="-5"
            rx="3.8"
            ry="6.6"
            style={{ "--petal-turn": `${turn}deg` } as CSSProperties}
          />
        ))}
        {/*
          Last, and larger than the box it is drawn in: the core is opaque and
          covers where the petals start, so they read as growing out from behind
          it rather than as spokes meeting at the middle.

          The white one is drawn a shade smaller than the black. Set in the
          markup rather than the stylesheet because a radius is geometry: some
          browsers take it from CSS and others only from the attribute, and a
          disc that is one size in one browser and another size elsewhere is not
          worth the tidiness.
        */}
        <circle
          className="player-disc"
          cx="12"
          cy="12"
          r={color === "w" ? 11.55 : 12.1}
        />
      </svg>
      {/* The name in a box of its own, so that a long one is cut short rather
          than wrapped: the row is one line high whatever it holds, and the
          board below it does not move because somebody is called something
          long. */}
      <span className="player-name-text">{name}</span>
      {mine && <span className="player-mine"> (me)</span>}
      </span>
      {/* The middle of the row and the end of it, both empty on the near side
          and on a board that is nobody's game. */}
      <span className="player-result">{result}</span>
      <span className="player-position">{position}</span>
    </p>
  );
}
