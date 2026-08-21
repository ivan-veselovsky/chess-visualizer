import { useId } from "react";

/**
 * A heart with a dollar sign cut out of it.
 *
 * Cut rather than drawn on top: the hole shows the page through, so the mark
 * needs no second colour and reads the same under either theme.
 *
 * The dollar is taken as large as the heart will hold, and the whole mark sits
 * a shade over 1em, unlike the GitHub mark beside it. Both because a dollar cut
 * out of something else has only the counters of its own strokes to be read by,
 * and at this size a smaller one closes up into a blob.
 */
export default function SponsorIcon() {
  // useId() yields ids like ":r0:"; the colons are awkward inside url(#...).
  const maskId = `sponsor-heart-${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 16 16"
      width="1.15em"
      height="1.15em"
      aria-hidden="true"
      focusable="false"
    >
      {/* White keeps, black cuts. */}
      <mask id={maskId}>
        <path
          fill="#fff"
          d="M8 14.35C8 14.35 1.15 9.7 1.15 5.4 1.15 3.2 2.86 1.6 4.95 1.6 6.28 1.6 7.42 2.32 8 3.35 8.58 2.32 9.72 1.6 11.05 1.6 13.14 1.6 14.85 3.2 14.85 5.4 14.85 9.7 8 14.35 8 14.35Z"
        />
        <text
          x="8"
          y="10.1"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="9.6"
          fontWeight="700"
          fill="#000"
        >
          $
        </text>
      </mask>
      <rect width="16" height="16" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}
