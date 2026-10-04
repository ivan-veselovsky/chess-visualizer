import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Color, Square } from "chess.js";
import type { BoardEditorPiece } from "../chess/boardEditor";
import { Flower } from "./friend/PlayerName";
import type { GlyphSet } from "../visualization/glyphs";
import PieceGlyph from "../visualization/PieceGlyph";

/** What is chosen in the palette: a piece to put down, or the eraser that takes one away. */
export type BoardEditorTool = BoardEditorPiece | "erase";

const KINDS: BoardEditorPiece["type"][] = ["q", "n", "b", "r", "p"];
const NAMES: Record<BoardEditorPiece["type"], string> = { q: "queen", n: "knight", b: "bishop", r: "rook", p: "pawn" };

/** How far a press may wander before it is a drag rather than a click. */
const SLOP = 4;

interface BoardEditorPaletteProps {
  /** Which way the board is turned: the side at the top has its men at the top. */
  orientation: "white" | "black";
  tool: BoardEditorTool | null;
  onTool: (tool: BoardEditorTool | null) => void;
  /** The tool let go over a square of a board. */
  onDrop: (tool: BoardEditorTool, square: Square) => void;
  /** The board cleared to the two kings. */
  onClear: () => void;
  /** The last change taken back, and made again; null where there is none. */
  onUndo: (() => void) | null;
  onRedo: (() => void) | null;
  /** The tint the men are drawn in, as the bars it stands in for are given it. */
  style: CSSProperties;
  /** And the pictures they are drawn with. */
  glyphs: GlyphSet;
}

/**
 * The square of a board under a point of the window, if there is one: found by
 * where each board's squares are on the screen, whatever is drawn over them.
 */
function squareUnder(x: number, y: number): Square | null {
  for (const square of document.querySelectorAll(".board-holder > svg .square-layer [data-square]")) {
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
 * at the top of the board at the top; and between them the pointer, the
 * eraser, Undo and Redo, and Clear, which takes the board back to the two
 * kings. Whose move it is, and whether a game could reach the position, are
 * said over the board, with how it stands; see `EditorTurn` and `EditorSignal`.
 *
 * A man is put down either way a move is made: chosen with a click and put on
 * a square with another — and on another, and another, the choice held until
 * it is clicked again, another is chosen, or Escape is pressed — or dragged
 * from here and let go over the square. The eraser is chosen and used the same
 * way, on the men already there.
 */
export default function BoardEditorPalette({ orientation, tool, onTool, onDrop, onClear, onUndo, onRedo, style, glyphs }: BoardEditorPaletteProps) {
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
              <PieceGlyph
                set={glyphs}
                type={type}
                color={color}
                side={color === top ? "opponent" : "me"}
                at={{ x: 32, y: 32 }}
              />
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
          {/* The pointer: nothing chosen, so a press on the board takes a man
              up to move him — what it does with nothing chosen anyway, here
              to be chosen as the way of letting go of a choice. */}
          <button
            type="button"
            className={`board-editor-tool board-editor-arrow${tool === null ? " board-editor-tool-chosen" : ""}`}
            aria-label="Move pieces"
            aria-pressed={tool === null}
            title="Move pieces: nothing chosen, so a piece on the board is dragged where it goes."
            onClick={() => onTool(null)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 2.5v10.2l2.7-2.6 1.9 4.2 1.8-.8-1.9-4.1h3.8z" />
            </svg>
          </button>
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
            className="board-editor-step"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={onUndo === null}
            onClick={() => onUndo?.()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
            </svg>
          </button>
          <button
            type="button"
            className="board-editor-step"
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            disabled={onRedo === null}
            onClick={() => onRedo?.()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
            </svg>
          </button>
          {/* A heavier cross than the eraser's, and pressed rather than chosen:
              it does the one thing at once. Last, and set off from the rest,
              so it is not pressed for one of them by mistake. */}
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
              <PieceGlyph
                set={glyphs}
                type={carried.tool.type}
                color={carried.tool.color}
                side={carried.tool.color === top ? "opponent" : "me"}
                at={{ x: 32, y: 32 }}
              />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Whose move the position being set up is: the flower the names use, pressed
 * to give the move to the other side.
 */
export function EditorTurn({ turn, onTurn }: { turn: Color; onTurn: () => void }) {
  const side = turn === "w" ? "White" : "Black";
  const other = turn === "w" ? "Black" : "White";
  return (
    <button
      type="button"
      className="board-editor-turn"
      aria-label={`${side} to move — press to give the move to ${other}`}
      title={`${side} to move. Press to give the move to ${other}.`}
      onClick={onTurn}
    >
      <Flower color={turn} open />
    </button>
  );
}

/**
 * Whether the position being set up can be played from: a green tick where a
 * game could reach it, a red cross where it cannot be played from at all, and
 * between the two an amber warning triangle, for one a game could not have
 * come to — more men than a side has — that can be played from all the same.
 * What is wrong, or only unusual, is in its tooltip.
 */
export function EditorSignal({ problems, warnings }: { problems: string[]; warnings: string[] }) {
  const state = problems.length > 0 ? "illegal" : warnings.length > 0 ? "warning" : "legal";
  return (
    <span
      className={`board-editor-signal board-editor-signal-${state}`}
      role="img"
      aria-label={
        state === "illegal"
          ? `Not a legal position: ${problems.join(" ")}`
          : state === "warning"
            ? `Unusual, but playable: ${warnings.join(" ")}`
            : "A legal position"
      }
      title={
        state === "illegal"
          ? problems.join("\n")
          : state === "warning"
            ? `Unusual, but it can be played from:\n${warnings.join("\n")}`
            : "A position a game could reach."
      }
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {state === "warning" ? (
          <>
            <path className="board-editor-signal-triangle" d="M8 1.8L14.8 13.6H1.2Z" />
            <path className="board-editor-signal-mark" d="M8 6v3.6" />
            <circle className="board-editor-signal-dot" cx="8" cy="11.6" r="0.95" />
          </>
        ) : (
          <path d={state === "legal" ? "M3 8.5l3.3 3.3L13 4.8" : "M4 4l8 8M12 4l-8 8"} />
        )}
      </svg>
    </span>
  );
}
