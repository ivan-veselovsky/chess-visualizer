/**
 * A clapperboard, for the tab that makes animated GIFs: the board, and its
 * clapper raised on the hinge at the top left, striped. Drawn to sit beside the
 * gear — the same box, the same stroke — and sized by the text around it.
 */
export default function ClapperboardIcon() {
  return (
    <svg
      className="gear-icon"
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* The board. */}
      <path d="M3 11h18v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      {/* The clapper, hinged where it meets the board. */}
      <path d="M3 11 2.2 8.3 18.6 3.6 19.4 6.3Z" />
      {/* Its stripes, each from one edge of it to the other. */}
      <path d="M7.1 6.9 9.9 9M12.4 5.4 15.1 7.5" />
    </svg>
  );
}
