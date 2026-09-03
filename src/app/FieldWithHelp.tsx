import { useRef, type ReactNode } from "react";

/** How far the bubble stands off its control, and off the window's edges. */
const CLEARANCE = 8;

/** The width it opens to, when the control it explains is narrower than that. */
const COMFORTABLE = 25 * 16;

interface FieldWithHelpProps {
  /** The control, and the `.field-help` bubble that explains it. */
  children: ReactNode;
}

/**
 * A control with a paragraph of explanation, shown when it is hovered or
 * focused.
 *
 * Where the bubble goes is worked out here rather than left to the stylesheet,
 * and it is `position: fixed` rather than absolute. Both for the same reason,
 * twice over: an absolutely positioned bubble belongs to the panel it sits in,
 * so it counts towards what that panel has to scroll — a settings panel with
 * room to spare grew a scrollbar the moment a pointer passed over a button,
 * for a bubble nobody had asked to see. Fixed, it is outside every scroll box
 * on the page and asks none of them for room.
 *
 * Being fixed, it has to be told where to stand, which is the other half of the
 * fix: below its control by preference, above it when the window has no room
 * below, and held inside the window either way. A bubble taller than the window
 * scrolls within itself rather than hanging off the bottom of it.
 */
export default function FieldWithHelp({ children }: FieldWithHelpProps) {
  const holder = useRef<HTMLSpanElement>(null);

  /*
    Measured when the pointer arrives rather than when the bubble appears. The
    two are 900ms apart — the bubble is held back, so that passing over a
    control on the way somewhere else does not throw a paragraph across the
    page — and nothing about the control moves in between.
  */
  function place() {
    const box = holder.current;
    const help = box?.querySelector<HTMLElement>(".field-help");
    if (!box || !help) {
      return;
    }
    const anchor = box.getBoundingClientRect();
    const room = { width: window.innerWidth, height: window.innerHeight };

    // Wide enough to read, no wider than the window, and never narrower than
    // the control it belongs to.
    const width = Math.min(
      Math.max(anchor.width, COMFORTABLE),
      room.width - 2 * CLEARANCE
    );
    help.style.width = `${width}px`;
    /*
      Capped at the window's height before it is measured: a bubble longer than
      the window would otherwise be placed by a height it can never be given,
      and would stand off the top or the bottom whichever way it was turned.
      What does not fit scrolls inside it.
    */
    help.style.maxHeight = `${room.height - 2 * CLEARANCE}px`;
    const height = help.offsetHeight;

    const fitsBelow = anchor.bottom + CLEARANCE + height <= room.height;
    const fitsAbove = anchor.top - CLEARANCE - height >= 0;
    const top = fitsBelow
      ? anchor.bottom + CLEARANCE
      : fitsAbove
        ? anchor.top - CLEARANCE - height
        : // Neither: as low as it can be drawn whole.
          Math.max(CLEARANCE, room.height - CLEARANCE - height);
    // From the control's own left edge, pulled back where that would run it off
    // the right of the window.
    const left = Math.min(
      Math.max(CLEARANCE, anchor.left),
      room.width - CLEARANCE - width
    );
    help.style.top = `${Math.round(top)}px`;
    help.style.left = `${Math.round(left)}px`;
  }

  return (
    <span
      className="field-with-help"
      ref={holder}
      onPointerEnter={place}
      onFocus={place}
    >
      {children}
    </span>
  );
}
