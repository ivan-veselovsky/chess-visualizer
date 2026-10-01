import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** How far the box stands off its button, and off the window's edges. */
const CLEARANCE = 8;

/** The width it opens to, where the window has room for it. */
const COMFORTABLE = 25 * 16;

/*
  The box that is open, if any: opening another closes it, so explanations are
  read one at a time and never pile up over the panel they explain.
*/
let openOne: { token: object; close: () => void } | null = null;

interface InfoButtonProps {
  /** What is being explained, for a screen reader: "About Frame rate". */
  label: string;
  /** The explanation. */
  children: ReactNode;
}

/**
 * An explanation behind a small (i), shown when the (i) is clicked and put
 * away only by the box's own close button.
 *
 * What it replaced were tooltips shown on hover, which a reader stumbled into:
 * they came after a delay, stood over the control being used, and in Firefox
 * outlived the scroll that should have taken them away. Here nothing shows
 * until it is asked for, and it stays until it is closed — a click anywhere
 * else, or a key, leaves it where it is, so a setting can be changed with its
 * explanation still in view.
 *
 * The box is a popover, in the page's top layer: over everything, and outside
 * every scroll box, so no panel is made to scroll for it and none clips it.
 * Being there, it is placed by hand beside its (i) — below by preference, above
 * where the window has no room below, and held inside the window — and placed
 * again as the page scrolls, so it goes with the button it belongs to.
 */
export default function InfoButton({ label, children }: InfoButtonProps) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  /* Which instance this is, to the one note of which box is open: the same
     object for as long as this (i) is on the page. */
  const token = useRef({}).current;

  function place() {
    const anchor = button.current?.getBoundingClientRect();
    const help = box.current;
    if (anchor === undefined || help === null) {
      return;
    }
    const room = { width: window.innerWidth, height: window.innerHeight };
    const width = Math.min(COMFORTABLE, room.width - 2 * CLEARANCE);
    help.style.width = `${width}px`;
    /* Capped before it is measured, so a long explanation is placed by the
       height it will have, and scrolls within itself for the rest. */
    help.style.maxHeight = `${Math.min(room.height * 0.6, room.height - 2 * CLEARANCE)}px`;
    const height = help.offsetHeight;
    const fitsBelow = anchor.bottom + CLEARANCE + height <= room.height;
    const fitsAbove = anchor.top - CLEARANCE - height >= 0;
    const top = fitsBelow
      ? anchor.bottom + CLEARANCE
      : fitsAbove
        ? anchor.top - CLEARANCE - height
        : Math.max(CLEARANCE, room.height - CLEARANCE - height);
    /* From the button's own left edge, pulled back where that would run it off
       the right of the window. */
    const left = Math.min(Math.max(CLEARANCE, anchor.left - CLEARANCE), room.width - CLEARANCE - width);
    help.style.top = `${Math.round(top)}px`;
    help.style.left = `${Math.round(left)}px`;
  }

  /* Only refs and the state setter, so a copy of it kept from an earlier
     render closes this box as well as the latest would. */
  function takeDown() {
    if (openOne?.token === token) {
      openOne = null;
    }
    if (box.current?.matches(":popover-open")) {
      box.current.hidePopover();
    }
    setOpen(false);
  }

  function close() {
    takeDown();
    button.current?.focus();
  }

  function show() {
    if (open) {
      closer.current?.focus();
      return;
    }
    openOne?.close();
    openOne = { token, close: takeDown };
    box.current?.showPopover();
    place();
    setOpen(true);
    closer.current?.focus();
  }

  /* Following the button while it is open: the page or a panel scrolling, or
     the window changing size, moves it, and the box goes with it. */
  useEffect(() => {
    if (!open) {
      return;
    }
    const follow = () => place();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  /* A box left open when its field goes — a tab changed, a panel closed — is
     taken down with it, and is no longer the one open. */
  useEffect(
    () => () => {
      if (openOne?.token === token) {
        openOne = null;
      }
    },
    [token]
  );

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`info-button${open ? " info-button-open" : ""}`}
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={show}
      >
        i
      </button>
      <div ref={box} id={id} popover="manual" role="dialog" aria-label={label} className="info-box">
        <button ref={closer} type="button" className="info-close" aria-label="Close" onClick={close}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
        <div className="info-text">{children}</div>
      </div>
    </>
  );
}

/**
 * A field's label with its (i) beside it, when it has something to explain; the
 * label alone when it has not.
 *
 * The (i) stands beside the label rather than inside it: a button inside a
 * label is part of what clicking the label means, and a click meant for the
 * explanation would tick the box the label names.
 */
export function LabelWithInfo({ label, hint }: { label: ReactNode; hint?: ReactNode }) {
  if (hint === undefined || hint === null || hint === "") {
    return <>{label}</>;
  }
  return (
    <span className="field-label">
      {label}
      <InfoButton label={labelText(label)}>{hint}</InfoButton>
    </span>
  );
}

/** A label's words, for the (i)'s spoken name. */
function labelText(label: ReactNode): string {
  if (typeof label === "string") {
    return label;
  }
  if (label !== null && typeof label === "object" && "props" in label) {
    const inner = (label.props as { children?: ReactNode }).children;
    return typeof inner === "string" ? inner : "this setting";
  }
  return "this setting";
}
