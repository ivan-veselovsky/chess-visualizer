interface StepIconProps {
  direction: "previous" | "next";
}

/**
 * A step arrow: a triangle with a bar at the end it steps toward, the shape
 * used for "one back" and "one forward" wherever a sequence is stepped through.
 *
 * Drawn rather than typed so it takes the button's colour and scales with it;
 * the corresponding glyphs render inconsistently across fonts.
 */
export default function StepIcon({ direction }: StepIconProps) {
  const previous = direction === "previous";
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x={previous ? 5 : 16.5} y="5.5" width="2.5" height="13" rx="0.6" />
      <path
        d={previous ? "M19 5.5 V18.5 L9.5 12 Z" : "M5 5.5 V18.5 L14.5 12 Z"}
      />
    </svg>
  );
}
