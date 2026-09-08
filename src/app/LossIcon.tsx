/**
 * A cross, for a game lost.
 *
 * The same two strokes as the one on the button that forgets a game, at the
 * weight the other marks in the list are drawn at: in a column of marks it is
 * read as the opposite of the tick beside it rather than as a control.
 */
export default function LossIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </svg>
  );
}
