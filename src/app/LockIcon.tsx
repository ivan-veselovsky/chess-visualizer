/**
 * A padlock, for a preset that can be read and not written.
 *
 * Shut rather than open: the shape says "this one is fixed", which is the whole
 * of what a built-in preset is — somewhere to start from, and somewhere to come
 * back to when a board has been tuned into a corner.
 */
export default function LockIcon() {
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
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
    </svg>
  );
}
