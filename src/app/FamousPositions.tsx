import { FAMOUS_POSITIONS } from "../chess/famousPositions";

interface FamousPositionsProps {
  /** The FEN currently on the board, so the list can show which one it is. */
  value: string;
  onSelect: (fen: string) => void;
}

/**
 * Loads a well-known position into the board.
 *
 * The select follows the FEN rather than holding a choice of its own: type or
 * play your way to one of these and it names it, edit away from it and it falls
 * back to reporting the position as the board's own.
 */
export default function FamousPositions({
  value,
  onSelect,
}: FamousPositionsProps) {
  const selected = FAMOUS_POSITIONS.find(
    (position) => position.fen === value.trim()
  );

  return (
    <div className="famous-positions">
      <label htmlFor="famous-position">Saved positions</label>
      <select
        id="famous-position"
        className="famous-select"
        value={selected?.fen ?? ""}
        onChange={(event) => {
          if (event.target.value !== "") {
            onSelect(event.target.value);
          }
        }}
      >
        {/* Selected whenever the board is on something not in the list. */}
        <option value=""></option>
        {FAMOUS_POSITIONS.map((position) => (
          <option key={position.fen} value={position.fen}>
            {position.title}
          </option>
        ))}
      </select>
    </div>
  );
}
