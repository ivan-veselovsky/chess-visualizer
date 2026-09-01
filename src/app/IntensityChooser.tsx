import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SideIntensity } from "../visualization/settings";

const STEP = 0.05;
/**
 * How often the board is told, while a hand is moving.
 *
 * Repainting a board full of rays takes some sixty milliseconds — the browser
 * redrawing translucent shapes over each other, not React, so no amount of
 * caching removes it. A frame that repaints them cannot also move the handle
 * smoothly. So the board is told a few times a second and the handle follows
 * the hand at every frame between, which is the way round that reads as
 * responsive: an indicator that trails the pointer looks broken, while a heavy
 * picture catching up a moment later looks like a heavy picture.
 */
const BOARD_EVERY = 150;
/** How near a corner or an edge a value has to come before it is taken to be
 *  exactly there: nought and one are worth being able to hit. */
const SNAP = 0.04;
/** Cells across the painted field. Fine enough that no banding shows at the
 *  sizes this is drawn, coarse enough to cost nothing to repaint. */
const CELLS = 48;

interface IntensityChooserProps {
  id: string;
  label: string;
  value: SideIntensity;
  /** The colour of the field at a point, given each side's fraction. */
  colorAt: (mine: number, opponent: number) => [number, number, number];
  /**
   * What a whole one is worth on each axis: the settings this chooser takes its
   * fractions of, written out. The corners say nought and one, which is true of
   * the fraction but says nothing about what one comes to — and that is the
   * number the reader is actually setting.
   */
  full: { mine: number; opponent: number };
  /** Anything to stand under the field, such as a switch belonging to it. */
  extra?: ReactNode;
  onChange: (value: SideIntensity) => void;
}

const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
const snap = (v: number) =>
  v < SNAP ? 0 : v > 1 - SNAP ? 1 : Math.round(v * 100) / 100;

/**
 * A square turned on its corner, on which a point sets how much of each side's
 * marks is drawn: mine along one diagonal, the opponent's along the other.
 *
 * Turned rather than upright because of what the diagonals then mean. Left to
 * right runs from nothing to everything with the two sides equal, and top to
 * bottom swings between them — so "a little less of all this" and "more of
 * theirs, less of mine" are each one straight drag, and those are the two
 * things a reader actually wants. Upright, both would be diagonal drags.
 *
 * The field is painted with what the board would show at each point, so the
 * control is a picture of its own effect rather than a pair of numbers.
 */
export default function IntensityChooser({
  id,
  label,
  value,
  colorAt,
  full,
  extra,
  onChange,
}: IntensityChooserProps) {
  /*
    Where the handle is, kept here as well as in the settings.

    Moving it changes what the board draws, and redrawing a board full of rays
    takes several frames — long enough that a handle waiting for it visibly
    trails the hand. So the handle is moved at once from here, and the settings
    follow as a transition, which React may interrupt to keep this one moving.
    The board then catches up a frame or two behind, which nobody minds; a
    handle that lags the pointer is what gets noticed.
  */
  const [live, setLive] = useState(value);
  useEffect(() => setLive(value), [value]);

  const canvas = useRef<HTMLCanvasElement>(null);
  const square = useRef<HTMLDivElement>(null);
  /** The newest value not yet handed on, and the throttle that hands it on. */
  const waiting = useRef<SideIntensity | null>(null);
  const timer = useRef(0);
  const sent = useRef(0);
  const marker = useRef<HTMLSpanElement>(null);
  /*
    How far the marker's centre is from the pointer that took hold of it, so
    that a drag moves the marker by what the hand moves rather than snapping its
    centre under the fingertip. Taking hold anywhere in the circle therefore
    leaves the value where it was until the hand actually moves, and it is the
    centre that says what the value is, not the point that was grabbed.

    Null between drags. A press on the field away from the marker is a different
    gesture — it sends the marker there — and so starts with no offset at all.
  */
  const grip = useRef<{ x: number; y: number } | null>(null);

  // Repainted only when the colours it is made of change, not on every drag:
  // the marker moves over the field, the field itself stands still.
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) {
      return;
    }
    for (let row = 0; row < CELLS; row += 1) {
      for (let column = 0; column < CELLS; column += 1) {
        // Mine to the right, the opponent's upward, before the turn.
        const mine = (column + 0.5) / CELLS;
        const opponent = 1 - (row + 0.5) / CELLS;
        const [r, g, b] = colorAt(mine, opponent);
        context.fillStyle = `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
        context.fillRect(column, row, 1, 1);
      }
    }
  }, [colorAt]);

  /**
   * Moves the handle now and the settings when React has room: at most one
   * update a frame, since a pointer reports itself more often than a frame can
   * show.
   */
  function move(next: SideIntensity) {
    // Values are rounded to the nearest hundredth, so a hand crossing a single
    // point of the field reports the same one many times over. Redrawing the
    // board for those is the most expensive way of changing nothing.
    if (next.me === live.me && next.opponent === live.opponent) {
      return;
    }
    setLive(next);
    waiting.current = next;
    if (timer.current === 0) {
      const due = Math.max(0, BOARD_EVERY - (performance.now() - sent.current));
      timer.current = window.setTimeout(tell, due);
    }
  }

  /** Hands the newest value on and remembers when, for the throttle above. */
  function tell() {
    timer.current = 0;
    sent.current = performance.now();
    const sending = waiting.current;
    waiting.current = null;
    if (sending !== null) {
      startTransition(() => onChange(sending));
    }
  }

  /** On letting go, the board gets the last word at once. */
  function settle() {
    grip.current = null;
    if (timer.current !== 0) {
      window.clearTimeout(timer.current);
      timer.current = 0;
    }
    if (waiting.current !== null) {
      tell();
    }
  }

  /** Where a pointer is in the field, undoing the quarter turn. */
  function pointAt(clientX: number, clientY: number): SideIntensity {
    const box = square.current?.getBoundingClientRect();
    if (!box) {
      return live;
    }
    const dx = clientX - (box.left + box.width / 2);
    const dy = clientY - (box.top + box.height / 2);
    /*
      The box a turned square reports is the box around its corners, so it is
      the diagonal that measures `box.width`, and the side — which is what the
      field is measured in — is that over root two.
    */
    const side = box.width / Math.SQRT2;
    // Turning the pointer back the other way, into the field's own square.
    const cos = Math.SQRT1_2;
    const inX = (dx * cos + dy * cos) / side;
    const inY = (-dx * cos + dy * cos) / side;
    return {
      me: snap(clamp(0.5 + inX)),
      opponent: snap(clamp(0.5 - inY)),
    };
  }

  function takeHold(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const handle = marker.current;
    if (handle !== null && handle.contains(event.target as Node)) {
      const box = handle.getBoundingClientRect();
      grip.current = {
        x: box.left + box.width / 2 - event.clientX,
        y: box.top + box.height / 2 - event.clientY,
      };
      return;
    }
    grip.current = { x: 0, y: 0 };
    move(pointAt(event.clientX, event.clientY));
  }

  function moveWith(event: React.PointerEvent) {
    const held = grip.current;
    if (held === null || event.buttons !== 1) {
      return;
    }
    move(pointAt(event.clientX + held.x, event.clientY + held.y));
  }

  function byKey(event: React.KeyboardEvent) {
    // Along the two diagonals the reader sees, not along mine and theirs
    // separately: left and right are both sides together, up and down the
    // balance between them.
    const both = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const tilt = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
    if (both === 0 && tilt === 0) {
      return;
    }
    event.preventDefault();
    move({
      me: clamp(live.me + both * STEP - tilt * STEP),
      opponent: clamp(live.opponent + both * STEP + tilt * STEP),
    });
  }

  const percent = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div className="intensity-chooser">
      <div className="intensity-frame">
        {/* Inside the frame, above the square, and centred with it: the frame
            takes all the height the column has to spare, so a title at the top
            of the column would stand a long way from the thing it names. */}
        <span className="intensity-label" id={`${id}-label`}>
          {label}
        </span>
        {/* The square the turned square fits inside, which is what grows: the
            words hang off it, so they follow it however large it becomes. */}
        <div className="intensity-box">
          {/*
            Each corner names its axis and says what that side is actually being
            drawn at — the fraction the handle stands at, times what a whole one
            is worth. The same number as the edge beside it when the handle is
            at that corner, which is what makes the two readable together; the
            bare fraction would not match anything else on the panel.
          */}
          <span className="intensity-corner intensity-corner-top">
            {`Opponent: ${(live.opponent * full.opponent).toFixed(2)}`}
          </span>
          <span className="intensity-corner intensity-corner-bottom">
            {`Me: ${(live.me * full.mine).toFixed(2)}`}
          </span>
          <span className="intensity-corner intensity-corner-left">0</span>
          {/*
            Each written along the side its axis runs down, in the empty corner
            outside the square: mine up the lower-right edge, the opponent's
            down the upper-right one. Set flat they would stand side by side and
            take their width out of the square, which is the one thing this
            panel has none of to spare.
          */}
          <span className="intensity-corner intensity-full intensity-full-mine">
            {full.mine.toFixed(2)}
          </span>
          <span className="intensity-corner intensity-full intensity-full-opponent">
            {full.opponent.toFixed(2)}
          </span>
          <div
            ref={square}
            className="intensity-square"
            role="group"
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-value`}
            tabIndex={0}
            onKeyDown={byKey}
            onPointerDown={takeHold}
            onPointerMove={moveWith}
            onPointerUp={settle}
            onPointerCancel={settle}
          >
            <canvas
              ref={canvas}
              className="intensity-field"
              width={CELLS}
              height={CELLS}
              aria-hidden="true"
            />
            <span
              ref={marker}
              className="intensity-marker"
              style={{
                left: `${live.me * 100}%`,
                bottom: `${live.opponent * 100}%`,
              }}
            >
              {/* The centre, which is the value: the circle around it is only
                  somewhere to take hold of. */}
              <span className="intensity-marker-dot" />
            </span>
          </div>
        </div>
      </div>
      {extra}
      {/*
        Said rather than shown: the pair of numbers cost a line of height each
        and told a reader looking at the field nothing it was not already
        showing them — but they are what this control is, to anyone who cannot
        see it, and they name it to a screen reader through `aria-describedby`.
      */}
      <span className="visually-hidden" id={`${id}-value`}>
        {`me ${percent(live.me)}, opponent ${percent(live.opponent)}`}
      </span>
    </div>
  );
}
