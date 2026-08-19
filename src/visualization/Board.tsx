import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Chess, Square } from "chess.js";
import { PIECE_GLYPHS, readPieces } from "../chess/model";
import { legalTargets } from "../chess/moves";
import {
  BOARD_ORIGIN,
  CANVAS_SIZE,
  SQUARE_SIZE,
  squareAtPoint,
  squareBox,
  squareCenter,
  type Orientation,
  type Point,
} from "./geometry";
import type { AttackOptions, BoardColors, PieceTint } from "./options";
import AttackLayer from "./layers/AttackLayer";
import BorderLayer from "./layers/BorderLayer";
import GridLayer from "./layers/GridLayer";
import PieceLayer from "./layers/PieceLayer";
import SquareLayer from "./layers/SquareLayer";

interface BoardProps {
  position: Chess;
  colors: BoardColors;
  pieceTint: PieceTint;
  attacks: AttackOptions;
  /** Omit to make the board read-only. */
  onMove?: (from: Square, to: Square) => void;
  showGrid?: boolean;
  orientation?: Orientation;
}

/** A 0..1 fraction as a CSS percentage. */
function percent(fraction: number): string {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return `${Math.round(clamped * 1000) / 10}%`;
}

/** A piece under the pointer, with the squares it may legally be let go on. */
interface Drag {
  from: Square;
  targets: Square[];
  at: Point;
}

/**
 * Composes the board layers into a single SVG. Every layer works in board
 * coordinates (0..BOARD_SIZE); the outer <g> shifts them inside the border.
 *
 * Colours are published as CSS custom properties on the root <svg> so the
 * layers stay styled from the stylesheet rather than through inline attributes.
 *
 * Pieces can be dragged when `onMove` is given. Which moves are legal comes
 * entirely from chess.js — a drag that ends anywhere else is simply dropped,
 * and the board never changes on its own: it reports the move and waits to be
 * handed the position that follows.
 */
export default function Board({
  position,
  colors,
  pieceTint,
  attacks,
  onMove,
  showGrid = true,
  orientation = "white",
}: BoardProps) {
  const pieces = readPieces(position);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const themeVars = {
    "--square-light": colors.lightSquare,
    "--square-dark": colors.darkSquare,
    // One per piece per side. Which of each pair applies is decided further
    // down, by a class on the mark's group and on the piece glyph, so the rules
    // that use them go on saying `var(--attack-king)`.
    "--attack-king-white": attacks.colors.white.king,
    "--attack-queen-white": attacks.colors.white.queen,
    "--attack-rook-white": attacks.colors.white.rook,
    "--attack-bishop-white": attacks.colors.white.bishop,
    "--attack-knight-white": attacks.colors.white.knight,
    "--attack-pawn-white": attacks.colors.white.pawn,
    "--attack-king-black": attacks.colors.black.king,
    "--attack-queen-black": attacks.colors.black.queen,
    "--attack-rook-black": attacks.colors.black.rook,
    "--attack-bishop-black": attacks.colors.black.bishop,
    "--attack-knight-black": attacks.colors.black.knight,
    "--attack-pawn-black": attacks.colors.black.pawn,
    // As percentages, which is what color-mix wants. Rounded, since a
    // fraction times 100 lands on things like 55.00000000000001.
    "--piece-lighten": percent(pieceTint.lightenWhite),
    "--piece-darken": percent(pieceTint.darkenBlack),
  } as CSSProperties;

  /**
   * Pointer position in board coordinates. The viewBox is square and so is the
   * rendered element, so the two differ by a single scale factor and the
   * margins the layers are shifted by.
   */
  function boardPoint(event: PointerEvent): Point | null {
    const svg = svgRef.current;
    if (svg === null) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) {
      return null;
    }
    const scale = CANVAS_SIZE / rect.width;
    return {
      x: (event.clientX - rect.left) * scale - BOARD_ORIGIN.x,
      y: (event.clientY - rect.top) * scale - BOARD_ORIGIN.y,
    };
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (onMove === undefined) {
      return;
    }
    const at = boardPoint(event);
    const from = at === null ? null : squareAtPoint(at, orientation);
    if (at === null || from === null || position.get(from) === undefined) {
      return;
    }
    const targets = legalTargets(position, from);
    if (targets.length === 0) {
      // Nothing this piece can do: leave it be rather than lift a stuck piece.
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ from, targets, at });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (drag === null) {
      return;
    }
    const at = boardPoint(event);
    if (at !== null) {
      setDrag({ ...drag, at });
    }
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (drag === null) {
      return;
    }
    const at = boardPoint(event);
    const to = at === null ? null : squareAtPoint(at, orientation);
    setDrag(null);
    if (to !== null && drag.targets.includes(to)) {
      onMove?.(drag.from, to);
    }
  }

  const dragged =
    drag === null
      ? undefined
      : pieces.find((piece) => piece.square === drag.from);

  return (
    <svg
      ref={svgRef}
      className={drag === null ? "board" : "board board-dragging"}
      style={themeVars}
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      role="img"
      aria-label="Chess board"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      <g transform={`translate(${BOARD_ORIGIN.x}, ${BOARD_ORIGIN.y})`}>
        <SquareLayer orientation={orientation} />
        {showGrid && <GridLayer />}
        <AttackLayer
          position={position}
          pieces={pieces}
          attackOptions={attacks}
          lifted={drag?.from ?? null}
          orientation={orientation}
        />
        <BorderLayer orientation={orientation} />
        <PieceLayer
          pieces={pieces}
          lifted={drag?.from ?? null}
          orientation={orientation}
        />

        {drag !== null && (
          <g className="drag-layer">
            <rect
              {...squareBox(drag.from, orientation)}
              className="drag-origin"
            />
            {drag.targets.map((target) => {
              const { x, y } = squareCenter(target, orientation);
              return (
                <circle
                  key={target}
                  cx={x}
                  cy={y}
                  r={SQUARE_SIZE / 8}
                  className="drag-target"
                />
              );
            })}
            {dragged !== undefined && (
              <text
                x={drag.at.x}
                y={drag.at.y}
                className={[
                  "piece",
                  `piece-${dragged.type}`,
                  dragged.color === "w" ? "piece-white" : "piece-black",
                ].join(" ")}
              >
                {PIECE_GLYPHS[dragged.type]}
              </text>
            )}
          </g>
        )}
      </g>
    </svg>
  );
}
