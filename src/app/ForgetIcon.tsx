/**
 * A cross, for giving something up.
 *
 * Two strokes at right angles to each other, standing on their corners: the
 * mark somebody makes through a line in a list, and the one every application
 * uses for "get rid of this". Upright, the same two strokes are a plus sign,
 * which says the opposite — the first drawing of this said "add" on a button
 * that forgets.
 */
export default function ForgetIcon() {
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
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 7l10 10" />
      <path d="M17 7 7 17" />
    </svg>
  );
}
