/**
 * Input types that are pressed rather than typed into or walked through: Space
 * works them, and the arrows mean nothing to them.
 */
const PRESSED = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "reset",
  "submit",
]);

/**
 * Whether the focus was last put somewhere by a pointer — a click or a tap —
 * rather than by the keyboard.
 *
 * Tracked here because the browser will not say. `:focus-visible` looked like
 * the answer and is not: the browser starts showing the focus ring the moment
 * any key is pressed, and it does so before the page hears about the key — so
 * by the time a key handler asks, a button that was merely clicked already
 * looks like one the keyboard is on.
 *
 * So the two events that actually move the focus are watched instead. A press
 * of a pointer is what puts the focus on whatever was clicked; Tab is what
 * moves it by keyboard. The arrows and Space are not counted: they are what
 * the question is being asked about, and a reader who clicked a button and
 * then pressed → has not stopped using the mouse to put the focus there.
 *
 * Watched in the capture phase, on the window, so that nothing further in can
 * stop either from being seen. Once, when this module is first loaded.
 */
let pointed = false;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => (pointed = true), true);
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Tab") {
        pointed = false;
      }
    },
    true
  );
}

/** Whether the element with the focus was given it by the keyboard. */
export function focusFromKeyboard(): boolean {
  return !pointed;
}

/**
 * Whether a key pressed now is meant for the element that has the focus,
 * rather than for the page's own shortcuts.
 *
 * Two ways it can be:
 *
 *   - It takes typing, or walks through values with the arrows: a text or
 *     number field, a text area, a slider, a radio group, anything editable.
 *     However the focus got there, a key pressed in one is meant for it — a
 *     click into a field is a reader about to type, and a click on a slider is
 *     one about to nudge it.
 *
 *   - The keyboard put the focus on it. A button reached with Tab is being
 *     worked from the keyboard, and Space presses it.
 *
 * What is left is a control that has the focus only because it was clicked —
 * a button, a checkbox, a tab, a list to choose from — and nobody pressing a
 * key after clicking one of those means it for that. Clicking Next and then
 * pressing Space is asking for Play, not for Next again.
 */
export function keyboardIsOn(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement) || target === document.body) {
    return false;
  }
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) {
    return true;
  }
  if (target instanceof HTMLInputElement && !PRESSED.has(target.type)) {
    return true;
  }
  return focusFromKeyboard();
}
