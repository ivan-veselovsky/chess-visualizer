import {
  BOARD_SIZE,
  BORDER_SIZE,
  FILES,
  RANKS,
  SQUARE_SIZE,
  type Orientation,
} from "../geometry";

interface BorderLayerProps {
  orientation?: Orientation;
}

/**
 * Frame around the board plus the file/rank labels. Drawn in board coordinates,
 * so labels sit in the margin at negative / out-of-board offsets.
 */
export default function BorderLayer({
  orientation = "white",
}: BorderLayerProps) {
  const flipped = orientation === "black";
  const labelOffset = BORDER_SIZE / 2;

  return (
    <g className="border-layer">
      <rect
        x={0}
        y={0}
        width={BOARD_SIZE}
        height={BOARD_SIZE}
        className="board-frame"
      />

      {FILES.map((file, index) => {
        const column = flipped ? FILES.length - 1 - index : index;
        return (
          <text
            key={file}
            x={column * SQUARE_SIZE + SQUARE_SIZE / 2}
            y={BOARD_SIZE + labelOffset}
            className="coordinate-label"
          >
            {file}
          </text>
        );
      })}

      {RANKS.map((rank, index) => {
        const row = flipped ? index : RANKS.length - 1 - index;
        return (
          <text
            key={rank}
            x={-labelOffset}
            y={row * SQUARE_SIZE + SQUARE_SIZE / 2}
            className="coordinate-label"
          >
            {rank}
          </text>
        );
      })}
    </g>
  );
}
