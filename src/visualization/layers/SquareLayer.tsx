import {
  FILES,
  RANKS,
  SQUARE_SIZE,
  isLightSquare,
  squareTopLeft,
  type Orientation,
} from "../geometry";

interface SquareLayerProps {
  orientation?: Orientation;
}

/** The checkered background of the board. */
export default function SquareLayer({
  orientation = "white",
}: SquareLayerProps) {
  return (
    <g className="square-layer">
      {FILES.map((_, file) =>
        RANKS.map((_, rank) => {
          const { x, y } = squareTopLeft(file, rank, orientation);
          return (
            <rect
              key={`${file}-${rank}`}
              x={x}
              y={y}
              width={SQUARE_SIZE}
              height={SQUARE_SIZE}
              /* Which square it is, for whatever on the page has to find one:
                 the promotion chooser stands at the square it is asked about. */
              data-square={`${FILES[file]}${RANKS[rank]}`}
              className={isLightSquare(file, rank) ? "square-light" : "square-dark"}
            />
          );
        })
      )}
    </g>
  );
}
