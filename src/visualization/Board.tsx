import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import type { Chess, Color, Square } from "chess.js";
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
import type {
  AttackSettings,
  BoardColors,
  GridLines,
  HedgeLines,
  LastMoveMark,
  PieceTint,
} from "./settings";
import { pieceVars } from "./pieceVars";
import AttackLayer from "./layers/AttackLayer";
import BorderLayer from "./layers/BorderLayer";
import GridLayer from "./layers/GridLayer";
import HedgeLayer from "./layers/HedgeLayer";
import HighlightLayer, { type LastMove } from "./layers/HighlightLayer";
import CheckLayer, { type KingAlert } from "./layers/CheckLayer";
import MovingPieceLayer, {
  type Flight,
} from "./layers/MovingPieceLayer";
import PieceLayer from "./layers/PieceLayer";
import PinLayer from "./layers/PinLayer";
import SquareLayer from "./layers/SquareLayer";
import HeatmapLayer from "./layers/HeatmapLayer";

interface BoardProps {
  /** Hatching over the dark squares. */
  hedge: HedgeLines;
  /** A move on its way across the board, if one is being played out. */
  flight?: Flight | null;
  /**
   * The position to draw, when it differs from the one being played on.
   *
   * While a move is in the air the board shows everything as it was, less what
   * is travelling — so the piece's rays leave with it and come back where it
   * lands. What may legally be played still comes from `position`: the move has
   * already happened, and only the picture is behind.
   */
  showing?: Chess | null;
  position: Chess;
  colors: BoardColors;
  pieceTint: PieceTint;
  attacks: AttackSettings;
  /** Omit to make the board read-only. */
  /**
   * A move the reader has made. `dragged` says whether the piece was carried
   * there by hand, which is the one case not worth animating: it has already
   * travelled, under the pointer.
   */
  onMove?: (from: Square, to: Square, dragged: boolean) => void;
  /**
   * The one army this board may move, when it may only move one — a game
   * against somebody else, where the other side is theirs to play. Omitted for
   * a board being studied, where both sides are the reader's to try.
   */
  playable?: Color | null;
  /**
   * Nothing may be moved at all — an earlier position in a game being played,
   * which is there to be looked at and not to be played from. Different from
   * `playable`, which says *whose* men may move: a board being studied has no
   * side and is still free to be pushed around, and this is the one case where
   * a board with no side is not.
   */
  frozen?: boolean;
  /** Thin lines on the square edges, and what they are drawn in. */
  grid: GridLines;
  /** The move that reached this position, to shade the squares it used. */
  lastMove?: LastMove | null;
  /** The wash laid over those two squares, and how much of it. */
  /** How the last move's squares are marked; omitted, they are not marked. */
  lastMoveMark?: LastMoveMark;
  orientation?: Orientation;
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
  hedge,
  flight = null,
  showing = null,
  position,
  colors,
  pieceTint,
  attacks,
  onMove,
  grid,
  playable = null,
  frozen = false,
  lastMove = null,
  lastMoveMark = {
    color: "#000000",
    opacity: 0,
    negative: false,
    diameter: 0,
  },
  orientation = "white",
}: BoardProps) {
  /* Held from render to render, so that everything derived from it can be too:
     a fresh array each time would tell every memo below that the men had moved. */
  /* What the layers draw, which is the position on the board except while a
     move is crossing it. */
  const drawn = showing ?? position;
  const pieces = useMemo(() => readPieces(drawn), [drawn]);
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
    /*
      Nothing while a move is crossing the board. Asking the position on the
      board would mark the check before the piece delivering it had arrived;
      asking the one being drawn would be worse, since a board with a piece
      lifted off it can show its own king in check from a line that piece was
      standing in. It waits, and arrives with the piece.
    */
    if (showing !== null || !position.isCheck()) {
      return null;
    }
    const mate = position.isCheckmate();
    if (mate ? !attacks.checkAndCheckmate.showCheckmate : !attacks.checkAndCheckmate.showCheck) {
      return null;
    }
    const [square] = position.findPiece({ type: "k", color: position.turn() });
    return square === undefined
      ? null
      : { square, kind: mate ? "checkmate" : "check" };
  }, [
    position,
    showing,
    attacks.checkAndCheckmate.showCheck,
    attacks.checkAndCheckmate.showCheckmate,
  ]);

  const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
  const themeVars = {
    "--square-light": colors.lightSquare,
    "--square-dark": colors.useLightForDark
      ? colors.lightSquare
      : colors.darkSquare,
    /*
      What the negative last-move mark is filled with, by the kind of square it
      sits on. The other square's colour, from the two that were chosen rather
      than the two being drawn — on a board drawn in one colour those are not
      the same thing, and a mark taking the drawn colour would be a circle of
      the board's own colour on the board, which is no mark at all.

      So on a flat board every mark is the dark colour: still visible, though
      it can no longer say whether the move stayed on one colour, there being
      only one to stay on.
    */
    "--mark-on-light": colors.darkSquare,
    "--mark-on-dark": colors.useLightForDark
      ? colors.darkSquare
      : colors.lightSquare,
    /*
      What each side's rays are drawn at: the opacity chosen for that side,
      times the fraction the reader is holding. Published here rather than set
      on the marks so that moving that fraction restyles them instead of
      rebuilding them — the geometry is the expensive part, and it does not
      depend on either number.
    */
    "--ray-opacity-me": String(
      clamp01(attacks.rayOpacity.me) * clamp01(attacks.rayIntensity.me)
    ),
    "--ray-opacity-opponent": String(
      clamp01(attacks.rayOpacity.opponent) *
        clamp01(attacks.rayIntensity.opponent)
    ),
    "--grid-line": grid.color,
    "--pin-ring": attacks.pins.ringColor,
    "--check-color": attacks.checkAndCheckmate.checkColor,
    "--checkmate-color": attacks.checkAndCheckmate.checkmateColor,
    "--attack-outline-me": attacks.outlineColors.me,
    "--attack-outline-opponent": attacks.outlineColors.opponent,
    // The piece palette and the tints, shared with the bar of taken men.
    ...pieceVars(pieceTint, attacks),
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
    if (onMove === undefined || frozen) {
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
        onMove(selected.from, from, false);
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
    /*
      In a game with somebody else, only your own men, and only when it is your
      move. Stopping it here rather than at the drop means the opponent's pieces
      never lift and never show where they could go — the board says what may be
      done by what it lets you take hold of.
    */
    if (playable !== null) {
      const piece = position.get(from);
      if (piece === undefined || piece.color !== playable) {
        return;
      }
      if (position.turn() !== playable) {
        return;
      }
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
      onMove?.(drag.from, to, true);
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

  const lifted = inHand?.from ?? null;
  /*
    The rays, kept from one render to the next.

    Everything in them is worked out from the position — which squares each
    piece reaches, where each ray starts and stops — and for a full board that
    is several frames' work. It is redone only when something it actually
    depends on changes, which the key below states: the position, the men on it,
    the piece being lifted, which way round the board is, and how the marks are
    shaped and coloured.

    The two things deliberately left out are the reader's own fractions, which
    reach the marks as CSS variables instead. Without that, dragging a chooser
    would rebuild every ray on the board for each pointer move — which it did,
    at about seventy milliseconds a move against a sixteen millisecond frame.

    The key is stringified rather than listed field by field: it is a small
    object, and comparing it costs a fraction of what redrawing costs. Held as
    text, adding a setting cannot quietly leave a stale board behind either.
  */
  const rayLook = JSON.stringify({
    ...attacks,
    rayIntensity: null,
    heatmap: null,
    linkedIntensity: null,
  });
  const attackLayer = useMemo(
    () => (
      <AttackLayer
        position={drawn}
        pieces={pieces}
        attackSettings={attacks}
        // Whichever way the piece was taken up: a move is being weighed, and
        // its own reach is the one thing not being weighed against.
        lifted={lifted}
        orientation={orientation}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `rayLook` stands
    // for the parts of `attacks` these marks are made of; the rest cannot change
    // them.
    [position, pieces, lifted, orientation, rayLook]
  );


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
        {/* Part of the board rather than a mark on it, so it goes on directly
            after the squares and everything else is laid over it. */}
        <HedgeLayer hedge={hedge} orientation={orientation} />
        {/* First of all the layers, so that it belongs to the board rather than
            sitting on it: every wash laid down later goes over it, and the mark
            takes their colour along with the square it is on.

            It matters because the two ways of drawing it have different alpha.
            The coloured disc is semi-transparent and a heatmap above or below
            it would tint it either way; the negative disc is fully opaque, and
            drawn last it would punch a hole in the heatmap — the one square the
            heatmap had nothing to say about being the one the move landed on. */}
        <HighlightLayer
          squares={[
            ...(lastMove === null ? [] : [lastMove.from, lastMove.to]),
            ...(inHand === null ? [] : [inHand.from]),
          ]}
          mark={lastMoveMark}
          orientation={orientation}
        />
        {/* Over the squares and the last-move mark, and under everything else:
            it colours the board rather than marking anything on it. */}
        {(attacks.heatmap.intensity.me > 0 ||
          attacks.heatmap.intensity.opponent > 0) && (
          <HeatmapLayer
            position={drawn}
            heatmap={attacks.heatmap}
            lifted={inHand?.from ?? null}
            orientation={orientation}
          />
        )}
        {grid.show && <GridLayer />}
        {attackLayer}
        <BorderLayer orientation={orientation} />
        {/* Under the glyphs: the ring frames a piece rather than covering it. */}
        {attacks.pins.show && (
          <PinLayer
            position={drawn}
            attackSettings={attacks}
            lifted={drag?.from ?? null}
            orientation={orientation}
          />
        )}
        <CheckLayer
          alert={alert}
          diameter={attacks.pins.ringDiameter}
          lifted={drag?.from ?? null}
          orientation={orientation}
        />
        {/* Above the board and below the hand: a piece being carried is still
            the one the reader is holding. */}
        {flight !== null && (
          <MovingPieceLayer flight={flight} orientation={orientation} />
        )}
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
