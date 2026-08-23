import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import type { Chess, Square } from "chess.js";
import { PIECE_GLYPHS, readPieces } from "../chess/model";
import { legalTargets } from "../chess/moves";
import {
  BOARD_ORIGIN,
  CANVAS_SIZE,
  SQUARE_SIZE,
  settingsSide,
  squareAtPoint,
  squareCenter,
  type Orientation,
  type Point,
} from "./geometry";
import type { AttackOptions, BoardColors, PieceTint } from "./options";
import AttackLayer from "./layers/AttackLayer";
import BorderLayer from "./layers/BorderLayer";
import GridLayer from "./layers/GridLayer";
import HighlightLayer, { type LastMove } from "./layers/HighlightLayer";
import CheckLayer, { type KingAlert } from "./layers/CheckLayer";
import PieceLayer from "./layers/PieceLayer";
import PinLayer from "./layers/PinLayer";
import SquareLayer from "./layers/SquareLayer";

interface BoardProps {
  position: Chess;
  colors: BoardColors;
  pieceTint: PieceTint;
  attacks: AttackOptions;
  /** Omit to make the board read-only. */
  onMove?: (from: Square, to: Square) => void;
  showGrid?: boolean;
  /** The move that reached this position, to shade the squares it used. */
  lastMove?: LastMove | null;
  /** The wash laid over those two squares, and how much of it. */
  lastMoveColor?: string;
  lastMoveOpacity?: number;
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
  lastMove = null,
  lastMoveColor = "#000000",
  lastMoveOpacity = 0,
  orientation = "white",
}: BoardProps) {
  const pieces = readPieces(position);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  /*
    A piece picked out by a click and waiting for somewhere to go — the other
    way of making a move, for anyone who does not care to drag one. It holds
    the same two things a drag does, since from here on it is the same
    question: which piece, and where may it legally land.
  */
  const [selected, setSelected] = useState<Drag | null>(null);

  // A different position is a different board: whatever was picked out on the
  // old one may not even be there any more.
  useEffect(() => setSelected(null), [position]);

  /*
    Only the side to move can be in check, so there is at most one king to
    point out. Mate is checked first: it is a check as well, and saying so
    twice would let the milder colour win on a position that is over.
  */
  const alert = useMemo<KingAlert | null>(() => {
    if (!position.isCheck()) {
      return null;
    }
    const mate = position.isCheckmate();
    if (mate ? !attacks.showCheckmate : !attacks.showCheck) {
      return null;
    }
    const [square] = position.findPiece({ type: "k", color: position.turn() });
    return square === undefined
      ? null
      : { square, kind: mate ? "checkmate" : "check" };
  }, [position, attacks.showCheck, attacks.showCheckmate]);

  const themeVars = {
    "--square-light": colors.lightSquare,
    "--square-dark": colors.darkSquare,
    // One per piece per side. Which of each pair applies is decided further
    // down, by a class on the mark's group and on the piece glyph, so the rules
    // that use them go on saying `var(--attack-king)`.
    "--pin-ring": attacks.pinRingColor,
    "--check-color": attacks.checkColor,
    "--checkmate-color": attacks.checkmateColor,
    "--attack-outline-me": attacks.outlineColors.me,
    "--attack-outline-opponent": attacks.outlineColors.opponent,
    "--attack-king-me": attacks.colors.me.king,
    "--attack-queen-me": attacks.colors.me.queen,
    "--attack-rook-me": attacks.colors.me.rook,
    "--attack-bishop-me": attacks.colors.me.bishop,
    "--attack-knight-me": attacks.colors.me.knight,
    "--attack-pawn-me": attacks.colors.me.pawn,
    "--attack-king-opponent": attacks.colors.opponent.king,
    "--attack-queen-opponent": attacks.colors.opponent.queen,
    "--attack-rook-opponent": attacks.colors.opponent.rook,
    "--attack-bishop-opponent": attacks.colors.opponent.bishop,
    "--attack-knight-opponent": attacks.colors.opponent.knight,
    "--attack-pawn-opponent": attacks.colors.opponent.pawn,
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

    /*
      A piece is already waiting: this press is the second half of a move made
      by two clicks. Somewhere it may go completes the move; the piece's own
      square puts it down again; anything else lets it go and falls through, so
      that clicking from one of your pieces straight to another picks up the
      second rather than doing nothing.
    */
    if (selected !== null) {
      if (from !== null && selected.targets.includes(from)) {
        event.preventDefault();
        setSelected(null);
        onMove(selected.from, from);
        return;
      }
      setSelected(null);
      if (from === selected.from) {
        return;
      }
    }

    if (at === null || from === null || position.get(from) === undefined) {
      return;
    }
    const targets = legalTargets(position, from);
    if (targets.length === 0) {
      // Nothing this piece can do: leave it be rather than lift a stuck piece.
      return;
    }
    /*
      The press is ours now. Left to itself the browser would also start its
      own gesture on it — a selection, and from there a native drag of the two
      text layers, glyphs and coordinates both. That drag cancels the pointer
      capture and fires pointercancel, which drops the move on the floor.
    */
    event.preventDefault();
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
      return;
    }
    /*
      Let go where it was picked up: a click rather than a drag, so the piece
      stays picked out and waits for a second one. Only a piece with somewhere
      to go is ever picked up at all, so a stuck one never lights up.
    */
    if (to === drag.from) {
      setSelected(drag);
    }
  }

  const dragged =
    drag === null
      ? undefined
      : pieces.find((piece) => piece.square === drag.from);

  /*
    The piece a move is being made with, however it was taken up: dragged under
    the pointer, or picked out by a click and waiting. What may be done with it
    is the same either way, so the squares open to it are shown the same way.
  */
  const inHand = drag ?? selected;

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
      // Nothing here is a thing to drag away; the move is the only gesture.
      onDragStart={(event) => event.preventDefault()}
    >
      <g transform={`translate(${BOARD_ORIGIN.x}, ${BOARD_ORIGIN.y})`}>
        <SquareLayer orientation={orientation} />
        <HighlightLayer
          squares={[
            ...(lastMove === null ? [] : [lastMove.from, lastMove.to]),
            ...(inHand === null ? [] : [inHand.from]),
          ]}
          color={lastMoveColor}
          opacity={lastMoveOpacity}
          orientation={orientation}
        />
        {showGrid && <GridLayer />}
        <AttackLayer
          position={position}
          pieces={pieces}
          attackOptions={attacks}
          // Whichever way the piece was taken up: a move is being weighed, and
          // its own reach is the one thing not being weighed against.
          lifted={inHand?.from ?? null}
          orientation={orientation}
        />
        <BorderLayer orientation={orientation} />
        {/* Under the glyphs: the ring frames a piece rather than covering it. */}
        {attacks.showPins && (
          <PinLayer
            position={position}
            attackOptions={attacks}
            lifted={drag?.from ?? null}
            orientation={orientation}
          />
        )}
        <CheckLayer
          alert={alert}
          diameter={attacks.pinRingDiameter}
          lifted={drag?.from ?? null}
          orientation={orientation}
        />
        <PieceLayer
          pieces={pieces}
          lifted={drag?.from ?? null}
          orientation={orientation}
        />

        {inHand !== null && (
          <g className="drag-layer">
            {inHand.targets.map((target) => {
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
            {drag !== null && dragged !== undefined && (
              <text
                x={drag.at.x}
                y={drag.at.y}
                className={[
                  "piece",
                  `piece-${dragged.type}`,
                  dragged.color === "w" ? "piece-white" : "piece-black",
                  `piece-${settingsSide(dragged.color, orientation)}`,
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
