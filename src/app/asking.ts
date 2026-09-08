/**
 * Whether to ask before throwing away settings that have not been saved.
 *
 * A reader who knows what they are doing turns it off from the dialog itself,
 * with the tick beside the buttons; the Gear tab holds the same switch, because
 * a setting that can only be turned off from a box that no longer appears is a
 * setting that cannot be turned back on.
 *
 * Kept beside the settings rather than in them: it is about how the app behaves
 * towards this reader, not about how the board is drawn, and it should not
 * travel in an exported settings file or change with the preset in use.
 */
const KEY = "cv.ask-before-discard";

export function asking(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setAsking(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* A browser refusing storage still runs the app; it just asks again next
       time, which is the safe way round. */
  }
}
