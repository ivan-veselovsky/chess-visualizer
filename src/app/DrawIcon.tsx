/**
 * A half, written the way a drawn game is scored: 1 over 2, split by a slash.
 *
 * Set as two digits and a rule rather than as the "½" character, which is not
 * in every font the page might fall back to and sits on a different baseline in
 * those that have it. Drawn here, it is the same mark everywhere.
 */
export default function DrawIcon() {
  return (
    <svg
      className="draw-icon"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="currentColor"
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize="12"
        fontWeight="700"
        textAnchor="middle"
      >
        <text x="6.4" y="11.6">
          1
        </text>
        <text x="17.6" y="21.4">
          2
        </text>
      </g>
      <path
        d="M17.4 4.1 6.6 20.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
