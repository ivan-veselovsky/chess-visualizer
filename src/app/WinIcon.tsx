/**
 * A tick, for a game won.
 *
 * Two strokes: a short one down into the corner and a long one up out of it,
 * which is the mark anybody makes against something that came out right. Drawn
 * rather than set as a character for the same reason the half is — a glyph that
 * is not in every fallback font, sitting on a baseline of its own.
 */
export default function WinIcon() {
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
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12.5 10 18 19 6.5" />
    </svg>
  );
}
