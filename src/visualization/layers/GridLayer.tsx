import { BOARD_SIZE, FILES, RANKS, SQUARE_SIZE } from "../geometry";

/**
 * Thin lines along every square edge. They keep the grid readable when the
 * light and dark square colours are set to the same or similar values.
 *
 * Orientation-independent: the grid is symmetric, so flipping the board does
 * not change it.
 */
export default function GridLayer() {
  const columns = FILES.length + 1;
  const rows = RANKS.length + 1;

  return (
    <g className="grid-layer">
      {Array.from({ length: columns }, (_, index) => (
        <line
          key={`v${index}`}
          x1={index * SQUARE_SIZE}
          y1={0}
          x2={index * SQUARE_SIZE}
          y2={BOARD_SIZE}
          className="grid-line"
        />
      ))}
      {Array.from({ length: rows }, (_, index) => (
        <line
          key={`h${index}`}
          x1={0}
          y1={index * SQUARE_SIZE}
          x2={BOARD_SIZE}
          y2={index * SQUARE_SIZE}
          className="grid-line"
        />
      ))}
    </g>
  );
}
