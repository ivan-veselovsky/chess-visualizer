interface PlayIconProps {
  /** Whether the game is running: the button offers the other of the two. */
  playing: boolean;
}

/**
 * A triangle to set a game going, a pair of bars to hold it where it is.
 *
 * Drawn rather than typed, as the step arrows are: it takes the button's colour
 * and scales with its text, which the ▶ and ❙❙ glyphs do neither of reliably.
 */
export default function PlayIcon({ playing }: PlayIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {playing ? (
        <>
          <rect x="6" y="4.5" width="4" height="15" rx="1" />
          <rect x="14" y="4.5" width="4" height="15" rx="1" />
        </>
      ) : (
        <path d="M6 4.5 L19.5 12 L6 19.5 Z" />
      )}
    </svg>
  );
}
