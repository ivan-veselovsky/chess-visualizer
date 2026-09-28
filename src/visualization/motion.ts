/**
 * Whether the board should keep still, and the one thing that can overrule it.
 *
 * A reader whose system asks for reduced motion gets a board that jumps rather
 * than one whose pieces travel and whose marks fade. That is their choice for
 * their own screen. It is not a choice about a picture made for somebody else:
 * an animated GIF exported from here is watched on other people's screens, and
 * a game in it that jumped from position to position would be the thing the
 * export exists to avoid. So while one is being made, the movement is put
 * back — for the export and for nothing else.
 *
 * Asked in three places — whether a move flies, whether a mark fades, and
 * (through the class on the root) the stylesheet's own transitions — and
 * answered here, so the three cannot disagree.
 */
let forced = false;

/** The class the stylesheet keeps its transitions on for. */
export const MOTION_FORCED_CLASS = "motion-forced";

export function reducedMotion(): boolean {
  return (
    !forced &&
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Movement on whatever the reader's system says, for as long as it is held. */
export function forceMotion(on: boolean): void {
  forced = on;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle(MOTION_FORCED_CLASS, on);
  }
}
