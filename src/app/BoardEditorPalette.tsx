import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Color, Square } from "chess.js";
import { PIECE_GLYPHS } from "../chess/model";
import type { BoardEditorPiece } from "../chess/boardEditor";
import { Flower } from "./friend/PlayerName";

/** What is chosen in the palette: a piece to put down, or the eraser that takes one away. */
export type BoardEditorTool = BoardEditorPiece | "erase";

const KINDS: BoardEditorPiece["type"][] = ["q", "n", "b", "r", "p"];
const NAMES: Record<BoardEditorPiece["type"], string> = { q: "queen", n: "knight", b: "bishop", r: "rook", p: "pawn" };

/** How far a press may wander before it is a drag rather than a click. */
const SLOP = 4;

interface BoardEditorPaletteProps {
  /** Which way the board is turned: the side at the top has its men at the top. */
  orientation: "white" | "black";
  /** Whose move the position being set up is. */
  turn: Color;
  /** What the position has wrong with it as one a game could reach; nothing, for one it could. */
  problems: string[];
  tool: BoardEditorTool | null;
  onTool: (tool: BoardEditorTool | null) => void;
  /** The tool let go over a square of a board. */
  onDrop: (tool: BoardEditorTool, square: Square) => void;
  onTurn: () => void;
  /** The board cleared to the two kings. */
  onClear: () => void;
  /** The tint the men are drawn in, as the bars it stands in for are given it. */
  style: CSSProperties;
}

/**
 * The square of a board under a point of the window, if there is one: found by
 * where each board's squares are on the screen, whatever is drawn over them.
 */
function squareUnder(x: number, y: number): Square | null {
  for (const square of document.querySelectorAll(".board-holder svg .square-layer [data-square]")) {
    const box = square.getBoundingClientRect();
    if (x >= box.left && x < box.right && y >= box.top && y < box.bottom) {
      return square.getAttribute("data-square") as Square;
    }
  }
  return null;
}

/**
 * The board editor's palette, standing where the bars of men stand: five men
 * of each side to put on the board, as many times as anybody likes, the side
 * at the top of the board at the top; and between them the eraser, the side to
 * move, whether the position could be reached in a game, and Clear, which
 * takes the board back to the two kings.
 *
 * A man is put down either way a move is made: chosen with a click and put on
 * a square with another — and on another, and another, the choice held until
 * it is clicked again, another is chosen, or Escape is pressed — or dragged
 * from here and let go over the square. The eraser is chosen and used the same
 * way, on the men already there.
 */
export default function BoardEditorPalette({ orientation, turn, problems, tool, onTool, onDrop, onTurn, onClear, style }: BoardEditorPaletteProps) {
  const top: Color = orientation === "white" ? "b" : "w";
  const bottom: Color = top === "w" ? "b" : "w";
  /* The man being dragged from here, and where the pointer is: drawn under it
     until it is let go. */
  const [carried, setCarried] = useState<{ tool: BoardEditorTool; x: number; y: number } | null>(null);
  const press = useRef<{ tool: BoardEditorTool; x: number; y: number; moved: boolean } | null>(null);

  /* Escape lets go of what is chosen. */
  useEffect(() => {
    if (tool === null) {
      return;
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onTool(null);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [tool, onTool]);

  const same = (one: BoardEditorTool | null, other: BoardEditorTool) =>
    one === other || (one !== null && one !== "erase" && other !== "erase" && one.type === other.type && one.color === other.color);

  function down(event: ReactPointerEvent<HTMLButtonElement>, chosen: BoardEditorTool) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { tool: chosen, x: event.clientX, y: event.clientY, moved: false };
  }

  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const held = press.current;
    if (held === null) {
      return;
    }
    if (!held.moved && Math.hypot(event.clientX - held.x, event.clientY - held.y) > SLOP) {
      held.moved = true;
      onTool(held.tool);
    }
    if (held.moved) {
      setCarried({ tool: held.tool, x: event.clientX, y: event.clientY });
    }
  }

  function up(event: ReactPointerEvent<HTMLButtonElement>) {
    const held = press.current;
    press.current = null;
    setCarried(null);
    if (held === null) {
      return;
    }
    if (!held.moved) {
      /* A click: chosen, or let go of if it already was. */
      onTool(same(tool, held.tool) ? null : held.tool);
      return;
    }
    /* Let go over a board: on the square under the pointer. */
    const square = squareUnder(event.clientX, event.clientY);
    if (square !== null) {
      onDrop(held.tool, square);
    }
  }

  const men = (color: Color) => (
    <div className="board-editor-men">
      {KINDS.map((type) => {
        const piece: BoardEditorPiece = { type, color };
        const name = `${color === "w" ? "White" : "Black"} ${NAMES[type]}`;
        return (
          <button
            key={type}
            type="button"
            className={`board-editor-tool board-editor-man${same(tool, piece) ? " board-editor-tool-chosen" : ""}`}
            aria-label={name}
            aria-pressed={same(tool, piece)}
            title={name}
            onPointerDown={(event) => down(event, piece)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => {
              press.current = null;
              setCarried(null);
            }}
          >
            <svg viewBox="0 0 64 64" aria-hidden="true">
              {color === "b" && <circle cx={32} cy={32} r={29} className="men-bar-ground" />}
              <text
                x={32}
                y={32}
                className={`piece piece-${type} ${color === "w" ? "piece-white" : "piece-black"} piece-${color === top ? "opponent" : "me"}`}
              >
                {PIECE_GLYPHS[type]}
              </text>
            </svg>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="men-bar board-editor-palette" aria-label="Pieces to put on the board" style={style}>
      <div className="men-bar-column board-editor-column">
        {men(top)}
        <div className="board-editor-middle">
          <button
            type="button"
            className={`board-editor-tool board-editor-erase${tool === "erase" ? " board-editor-tool-chosen" : ""}`}
            aria-label="Take a piece off the board"
            aria-pressed={tool === "erase"}
            title="Take a piece off the board: choose this, then press on the piece — or drag the piece off the board."
            onPointerDown={(event) => down(event, "erase")}
            onPointerMove={move}
            onPointerUp={up}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
          <button
            type="button"
            className="board-editor-turn"
            aria-label={`${turn === "w" ? "White" : "Black"} to move — press to give the move to the other side`}
            title={`${turn === "w" ? "White" : "Black"} to move. Press to give the move to ${turn === "w" ? "Black" : "White"}.`}
            onClick={onTurn}
          >
            <Flower color={turn} open />
          </button>
          <span
            className={`board-editor-signal ${problems.length === 0 ? "board-editor-signal-legal" : "board-editor-signal-illegal"}`}
            role="img"
            aria-label={problems.length === 0 ? "A legal position" : `Not a legal position: ${problems.join(" ")}`}
            title={problems.length === 0 ? "A position a game could reach." : problems.join("\n")}
          />
          {/* A heavier cross than the eraser's, and pressed rather than chosen:
              it does the one thing at once. Last, after the signal, and well
              away from the eraser, so it is not pressed for it by mistake. */}
          <button
            type="button"
            className="board-editor-clear"
            aria-label="Clear the board"
            title="Clear the board: back to the two kings."
            onClick={onClear}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
        </div>
        {men(bottom)}
      </div>
      {carried !== null && (
        <div className="board-editor-carried" style={{ left: carried.x, top: carried.y }} aria-hidden="true">
          {carried.tool === "erase" ? (
            <svg viewBox="0 0 16 16">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          ) : (
            <svg viewBox="0 0 64 64">
              <text
                x={32}
                y={32}
                className={`piece piece-${carried.tool.type} ${carried.tool.color === "w" ? "piece-white" : "piece-black"} piece-${carried.tool.color === top ? "opponent" : "me"}`}
              >
                {PIECE_GLYPHS[carried.tool.type]}
              </text>
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
