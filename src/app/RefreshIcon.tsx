/**
 * Two arrows chasing each other round a circle: ask again.
 *
 * The shape every application draws for this, and drawn as two arcs rather than
 * one ring with a gap: the pair says "round and round" where a single broken
 * circle says only "not quite closed". Each arc ends in a head, so which way it
 * goes is visible at the size a button uses it.
 */
export default function RefreshIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* The upper half, running clockwise to the right, and its head. */}
      <path d="M20 12a8 8 0 0 0-13.7-5.6L4 8.7" />
      <path d="M4 4v4.7h4.7" />
      {/* The lower half, running back, and its own. */}
      <path d="M4 12a8 8 0 0 0 13.7 5.6L20 15.3" />
      <path d="M20 20v-4.7h-4.7" />
    </svg>
  );
}
