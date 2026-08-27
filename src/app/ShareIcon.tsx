/**
 * The share glyph: one point joined to two others, sized by the surrounding
 * font-size the way the other icons here are.
 *
 * The one every platform draws — a node on the left with lines running to a
 * node above and a node below on the right, which is what makes it read as
 * "send this on" rather than as any particular way of sending it.
 */
export default function ShareIcon() {
  return (
    <svg
      className="share-icon"
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
      {/* The two lines first, so the three nodes are drawn over their ends. */}
      <path d="M8.6 10.7 15.4 7.3" />
      <path d="M8.6 13.3 15.4 16.7" />
      <circle cx="18" cy="6" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="18" r="2.6" />
    </svg>
  );
}
