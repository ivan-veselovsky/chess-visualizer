/*
  Written with its extension, like the other modules `tests/unit.mjs` runs
  straight from the TypeScript.
*/
import { currentName } from "./presets/index.ts";

/**
 * Two boards side by side, and which preset the second one is drawn with.
 *
 * Kept beside the settings rather than in them, for the reason `boardSide` is:
 * a setting is a thing about how *a* board is drawn, and it travels in the
 * preset it was tuned in. This is about how many boards there are and which
 * two presets are being held up against each other — a fact about what the
 * reader is doing, not about either preset.
 *
 * Held in the settings it would also be circular. The right board is drawn
 * from a preset, that preset is a `Settings`, and a `Settings` would then
 * carry its own answer about which preset the board beside it uses. Nothing
 * good is at the end of that.
 *
 * One value per browser, last write wins, read once when the page opens.
 */
const ON_KEY = "cv.two-board";
const PRESET_KEY = "cv.two-board-preset";

/**
 * Whether the page opens on two boards: on, unless it has been switched off in
 * this browser — the second board, with the attacks drawn on it beside a
 * plain one, being the app's way of showing a position.
 */
export function twoBoardMode(): boolean {
  try {
    return window.localStorage.getItem(ON_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setTwoBoardMode(on: boolean): void {
  try {
    window.localStorage.setItem(ON_KEY, on ? "on" : "off");
  } catch {
    /* A browser refusing storage still runs the app; it just opens as a new
       browser does next time, on two boards. */
  }
}

/**
 * What the right board is drawn with, by name.
 *
 * A name rather than a copy of the settings: a preset the reader goes on
 * tuning should go on being what the right board shows, and a copy taken when
 * it was chosen would quietly stop being that preset. The name is resolved
 * afresh on every render, and answers to nothing once the preset it names is
 * deleted — which is a case the app has to handle anyway, the same name being
 * deletable from another tab while this one is looking at it.
 *
 * Null when nothing has been chosen, which is how it opens.
 */
export function twoBoardPreset(): string | null {
  try {
    const name = window.localStorage.getItem(PRESET_KEY);
    return name === null ? null : currentName(name);
  } catch {
    return null;
  }
}

export function setTwoBoardPreset(name: string): void {
  try {
    window.localStorage.setItem(PRESET_KEY, name);
  } catch {
    /* As above: the choice is lost, the mode is not. */
  }
}
