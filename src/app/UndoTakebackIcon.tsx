/**
 * An arrow curving round and forward again: a takeback undone, the moves it
 * took going back on.
 *
 * The board editor's Redo, which it is: an undo of an undo. Curved, not a
 * triangle with a bar, so that it is not taken for a step arrow — stepping
 * forward through a game changes nothing, and this changes the game.
 */
export default function UndoTakebackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
    </svg>
  );
}
