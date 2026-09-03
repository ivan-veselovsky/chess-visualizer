interface PlayIconProps {
  /** Whether the game is running: the button offers the other of the two. */
  playing: boolean;
}

/**
 * A triangle to set a game going, a square to stop it.
 *
 * Drawn rather than typed, as the step arrows are: it takes the button's colour
 * and scales with its text, which the ▶ and ■ glyphs do neither of reliably.
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
        <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" />
      ) : (
        <path d="M6 4.5 L19.5 12 L6 19.5 Z" />
      )}
    </svg>
  );
}
