interface StepIconProps {
  direction: "first" | "previous" | "next" | "last";
}

/** Triangles pointing the way the button goes, and where the bar sits. */
const SHAPES: Record<StepIconProps["direction"], string[]> = {
  first: ["M3 5.5 h2.5 v13 h-2.5 Z", "M13 5.5 V18.5 L7 12 Z", "M20.5 5.5 V18.5 L14.5 12 Z"],
  previous: ["M5 5.5 h2.5 v13 h-2.5 Z", "M19 5.5 V18.5 L9.5 12 Z"],
  next: ["M16.5 5.5 h2.5 v13 h-2.5 Z", "M5 5.5 V18.5 L14.5 12 Z"],
  last: ["M18.5 5.5 h2.5 v13 h-2.5 Z", "M11 5.5 V18.5 L17 12 Z", "M3.5 5.5 V18.5 L9.5 12 Z"],
};

/**
 * A step arrow: a triangle with a bar at the end it steps toward, doubled for
 * the two that run all the way to an end of the list.
 *
 * Drawn rather than typed so it takes the button's colour and scales with it;
 * the corresponding glyphs render inconsistently across fonts.
 */
export default function StepIcon({ direction }: StepIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[direction].map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}
