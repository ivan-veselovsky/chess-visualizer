interface FenHelpProps {
  /** Referenced by the field it describes, so the text reaches a reader too. */
  id: string;
}

/**
 * What a FEN is, for the field that takes one.
 *
 * Written as markup rather than as a title attribute: a title is one plain
 * string, which for six fields' worth of explanation arrives as a wall of text
 * with the field names and the notation itself indistinguishable from the
 * prose around them.
 */
export default function FenHelp({ id }: FenHelpProps) {
  return (
    <span id={id} role="tooltip" className="field-help">
      A <strong>FEN (Forsyth–Edwards Notation)</strong> string describes a chess
      position using six space-separated fields: <strong>piece placement</strong>
      , listing ranks from 8 to 1 and files from a to h, where uppercase letters
      represent White pieces (<code>K</code>, <code>Q</code>, <code>R</code>,{" "}
      <code>B</code>, <code>N</code>, <code>P</code>), lowercase letters
      represent Black pieces, digits represent consecutive empty squares, and{" "}
      <code>/</code> separates ranks; <strong>active color</strong>, written as{" "}
      <code>w</code> or <code>b</code>; <strong>castling availability</strong>,
      using <code>K</code>, <code>Q</code>, <code>k</code>, and <code>q</code>,
      or <code>-</code> when castling is unavailable;{" "}
      <strong>en passant target square</strong>, such as <code>e3</code>, or{" "}
      <code>-</code> when none exists; the <strong>halfmove clock</strong>,
      counting moves since the last pawn move or capture for the fifty-move
      rule; and the <strong>fullmove number</strong>, which starts at 1 and
      increases after every Black move—for example:{" "}
      <code>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</code>.
    </span>
  );
}
