/**
 * An arrow pulling away from a bar: the last move coming back off the end of
 * the line.
 *
 * Deliberately not one of the step arrows. Those have their bar at the end
 * they move toward, because that is where they are going; this one points away
 * from the bar, because it is taking something off it. The two live side by
 * side on the same screen and must not be mistaken for each other — stepping
 * back through a game changes nothing, and this changes the game.
 */
export default function TakebackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14.5 5.5 V18.5 L5 12 Z" />
      <path d="M16.5 5.5 h2.5 v13 h-2.5 Z" />
    </svg>
  );
}
