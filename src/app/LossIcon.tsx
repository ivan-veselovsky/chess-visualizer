/**
 * A nought, for a game lost — the score a loss is written as.
 *
 * A ring rather than the digit, for the same reason the one beside it is three
 * strokes: it is drawn, so it is the same figure in every font the page might
 * fall back to. Narrower than it is tall, which is what tells a nought from the
 * dot that marks a game still being played.
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
      strokeWidth="2.2"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="12" cy="12" rx="4.6" ry="6.8" />
    </svg>
  );
}
