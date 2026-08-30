/**
 * A white flag: the mark for giving a game up.
 *
 * Drawn in outline rather than filled, which is what makes it the *white* flag
 * — a filled one is a flag of some colour, and the colour is the whole meaning
 * here. The cloth waves, so that it reads as raised rather than as a marker
 * pinned to something.
 */
export default function FlagIcon() {
  return (
    <svg
      className="flag-icon"
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
      {/* The pole runs the whole height; the cloth hangs from its top half. */}
      <path d="M6.2 3.2V21" />
      <path d="M6.2 4.6C9.4 2.4 13.2 6.6 17.8 4.6V11.9C13.2 13.9 9.4 9.7 6.2 11.9Z" />
    </svg>
  );
}
