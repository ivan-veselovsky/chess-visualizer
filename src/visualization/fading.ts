import { useLayoutEffect, useReducer, useRef, type TransitionEvent } from "react";

/** A thing to draw, and whether it is on its way out. */
export interface Fading<T> {
  key: string;
  item: T;
  /** True while it is being drawn only so that it can be seen to go. */
  leaving: boolean;
  /**
   * To be spread onto the element that fades. It is how the mark reports its
   * own fade finished, which is when it stops being drawn.
   */
  props: {
    ref: (element: Element | null) => void;
    onTransitionEnd: (event: TransitionEvent<Element>) => void;
  };
}

interface Held<T> {
  item: T;
  /** Set once the mark is being seen off, which is what draws it as leaving. */
  fading: boolean;
}

/** Whether the reader has asked for no movement, which means no fades to wait on. */
function stillness() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Holds on to marks that have just gone, so that they can fade rather than
 * vanish.
 *
 * Half of a fade is free and half of it is not. A mark that arrives can be
 * faded in by the stylesheet alone — it is a new element, and `@starting-style`
 * gives it something to arrive from. A mark that goes cannot: by the time
 * anything could animate it, React has taken it out of the page. So the two
 * halves are handled in different places, and this is the half that needs a
 * memory.
 *
 * What is kept is kept *during the render that drops it*, not afterwards from
 * an effect. That distinction is the whole of it: an effect runs after the
 * commit, so the mark is removed from the page and put back a moment later as a
 * new element — which fades in from nothing before being told to leave, and
 * reads as a blink, gone and back and gone. Held here, it is the same element
 * throughout and simply stops being drawn when its fade is done.
 *
 * Nothing here is timed. A mark starts to go in the render that drops it and
 * stops being drawn when its own fade says it is finished; if no fade is
 * running at all — a reader who has asked for stillness, a mark that was never
 * painted — it goes at once, because there is nothing to wait for. There were
 * three waiting periods here once, and every one of them was covering for a
 * render that showed a move already made before the flight that holds it back
 * was set. The board reaches its positions in one commit now, so a mark that
 * has gone has really gone, and the only question left is when its fade ends —
 * which the fade itself is the authority on.
 *
 * `ms` at nought turns the whole thing off: nothing is held, and every mark
 * comes and goes in the frame it changed.
 */
export function useFading<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  ms: number
): Fading<T>[] {
  /** Everything being drawn: what the position says, plus what is on its way out. */
  const held = useRef(new Map<string, Held<T>>());
  /** The element each mark is drawn as, so that a fade can be asked after. */
  const nodes = useRef(new Map<string, Element>());
  /** Marks that began to go in the render just gone; see the effect below. */
  const justLeft = useRef<string[]>([]);
  const [, redraw] = useReducer((count: number) => count + 1, 0);

  const here = new Map(items.map((item) => [keyOf(item), item]));
  const fades = ms > 0 && !stillness();

  /*
    Read as the position is read, not later. Anything in the position is in it
    and is not going anywhere; anything no longer in it starts to go in this
    same render, so that the two halves of a crossing move together.
  */
  for (const [key, item] of here) {
    held.current.set(key, { item, fading: false });
  }
  for (const [key, entry] of [...held.current]) {
    if (here.has(key) || entry.fading) {
      continue;
    }
    if (!fades) {
      held.current.delete(key);
      continue;
    }
    held.current.set(key, { ...entry, fading: true });
    justLeft.current.push(key);
  }

  /*
    A mark that is not fading is not being waited for.

    Everything above assumes the stylesheet will run a fade on whatever has just
    been told to leave, and then waits to be told it finished. Usually it does.
    But a mark that was never painted at its full strength has nothing to fade
    from, and a fade that never starts never ends: waited on, the mark would be
    drawn invisibly for good. So the moment after it is told to go, it is asked
    whether anything is actually happening to it, and if nothing is it goes now.
  */
  useLayoutEffect(() => {
    const leaving = justLeft.current;
    justLeft.current = [];
    let changed = false;
    for (const key of leaving) {
      const node = nodes.current.get(key);
      if (node === undefined || node.getAnimations().length === 0) {
        held.current.delete(key);
        nodes.current.delete(key);
        changed = true;
      }
    }
    if (changed) {
      redraw();
    }
  });

  const done = (key: string) => {
    if (held.current.get(key)?.fading !== true) {
      return;
    }
    held.current.delete(key);
    nodes.current.delete(key);
    redraw();
  };

  return [...held.current].map(([key, { item, fading }]) => ({
    key,
    item,
    leaving: fading,
    props: {
      ref: (element: Element | null) => {
        if (element === null) {
          nodes.current.delete(key);
        } else {
          nodes.current.set(key, element);
        }
      },
      onTransitionEnd: (event: TransitionEvent<Element>) => {
        /* Its own fade, and not one of its children's: transition events
           bubble, and a mark drawn of several parts would otherwise be taken
           away by whichever of them finished first. */
        if (event.propertyName === "opacity" && event.target === event.currentTarget) {
          done(key);
        }
      },
    },
  }));
}
