/**
 * A door with an arrow going out of it, for stepping away from a game.
 *
 * The frame is drawn open on the side the arrow leaves by, which is what makes
 * it read as a way out rather than as a box with a line through it. Nothing is
 * closed behind it: the game stays where it was, and the same door leads back.
 */
export default function ExitIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* The frame, missing the side the arrow goes through. */}
      <path d="M13.6 6.2V4.6A2.6 2.6 0 0 0 11 2H5.1a2.6 2.6 0 0 0-2.6 2.6v14.8A2.6 2.6 0 0 0 5.1 22H11a2.6 2.6 0 0 0 2.6-2.6v-1.6" />
      {/* And the way out. */}
      <path d="M9.6 12h11.9" />
      <path d="m17.8 8.3 3.7 3.7-3.7 3.7" />
    </svg>
  );
}
