interface PgnHelpProps {
  /** Referenced by the button it describes, so the text reaches a reader too. */
  id: string;
  /** Open leftwards, for a button too far along the row to open rightwards. */
  fromEnd?: boolean;
}

/**
 * What a PGN is, for the two buttons that read and write one.
 *
 * Markup rather than a title attribute, for the same reason the FEN field's is:
 * a title is one plain string, and the notation being described would be
 * indistinguishable from the prose describing it.
 */
export default function PgnHelp({ id, fromEnd = false }: PgnHelpProps) {
  return (
    <span
      id={id}
      role="tooltip"
      className={fromEnd ? "field-help field-help-end" : "field-help"}
    >
      A <strong>PGN (Portable Game Notation)</strong> document describes one or
      more complete chess games using two main sections:{" "}
      <strong>tag pairs</strong>, written as <code>{'[Name "Value"]'}</code>,
      which provide metadata such as <code>Event</code>, <code>Site</code>,{" "}
      <code>Date</code>, <code>Round</code>, <code>White</code>,{" "}
      <code>Black</code>, and <code>Result</code>; and{" "}
      <strong>movetext</strong>, which records the game’s moves in Standard
      Algebraic Notation (SAN), including move numbers, captures (<code>x</code>
      ), castling (<code>O-O</code> or <code>O-O-O</code>), promotion (
      <code>e8=Q</code>), check (<code>+</code>), and checkmate (<code>#</code>
      ). Comments may be enclosed in <code>{"{braces}"}</code>, alternative
      variations in <code>(parentheses)</code>, and the movetext ends with the
      game result: <code>1-0</code>, <code>0-1</code>, <code>1/2-1/2</code>, or{" "}
      <code>*</code> when the result is unknown—for example:{" "}
      <code>
        {'[White "Alice"] [Black "Bob"] [Result "1-0"] 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0'}
      </code>
      .
    </span>
  );
}
