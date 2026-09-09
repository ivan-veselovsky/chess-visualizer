/**
 * A one, for a game won — the score a win is written as.
 *
 * Drawn in strokes rather than set as the digit: a glyph would come out in
 * whatever font the page fell back to, at whatever weight and on whatever
 * baseline that font keeps, beside two marks that are drawn. Three strokes are
 * the same figure everywhere, and the same weight as the nought beside it.
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
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* The flag, the stem, and the foot it stands on. */}
      <path d="M9.4 8.4 12.4 5.4V18.6" />
      <path d="M8.8 18.6H16" />
    </svg>
  );
}
