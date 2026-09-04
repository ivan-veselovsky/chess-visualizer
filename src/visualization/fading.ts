import { useEffect, useLayoutEffect, useReducer, useRef } from "react";

/** A thing to draw, and whether it is on its way out. */
export interface Fading<T> {
  key: string;
  item: T;
  /** True while it is being drawn only so that it can be seen to go. */
  leaving: boolean;
}

/**
 * How long a mark has to have been on the board to be worth fading out, and how
 * long it has to have stayed gone before the fade begins.
 *
 * A move reaches the board in two commits. The position changes first, and the
 * flight that holds it back is set an instant later, before anything is
 * painted; in between, React draws the position as it will be. None of that is
 * painted and none of it was ever seen — until marks began to fade, and the
 * ghosts came out:
 *
 *   - the pin a move creates appeared as the move began, faded out, and then
 *     arrived again when the piece landed. `TOO_BRIEF` drops it: a mark gone
 *     again this soon after arriving was never really there.
 *   - the marks of a piece about to be taken vanished as the move began and
 *     came back a moment later — what is taken stands on the board for the
 *     whole journey — so `SETTLE` waits before seeing anything off, and a mark
 *     that comes straight back is never seen to leave at all.
 *
 * Both are far below what an eye can follow, and far above the microseconds
 * between two commits of one update.
 */
const TOO_BRIEF = 50;
const SETTLE = 48;

/**
 * How long past the end of its fade a mark is kept.
 *
 * The clock that removes it starts when the fade is asked for; the fade itself
 * starts a render later, and later still when the main thread is busy — which
 * it always is at the start of a move. Timed to the nose, the mark was taken
 * away partway down and the last of the fade became a jump. The slack is spent
 * on a mark that is already invisible.
 */
const AFTERWARDS = 150;

interface Held<T> {
  item: T;
  /** Set once the mark is being seen off, which is what draws it as leaving. */
  fading: boolean;
  /** When it first appeared; see `TOO_BRIEF`. */
  since: number;
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
 * `ms` at nought turns the whole thing off: nothing is held, and every mark
 * comes and goes in the frame it changed.
 */
export function useFading<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  ms: number,
  /**
   * What a mark belongs to, where that outlives the mark itself — a piece,
   * whose marks change shape as lines open and shut around it.
   *
   * Given, a mark whose owner is still drawing something is treated as
   * replaced rather than departed: it begins to go the moment its replacement
   * begins to arrive, with no wait. The wait below is there to absorb a mark
   * that vanishes and comes straight back, and a replacement is not that — it
   * is one half of a crossing, and a crossing whose halves do not start
   * together is not a crossing at all. Held at full strength for a quarter of a
   * second while its replacement faded up beneath it, the old mark left the new
   * one looking late.
   */
  ownerOf?: (item: T) => string
): Fading<T>[] {
  /** Everything being drawn: what the position says, plus what is on its way out. */
  const held = useRef(new Map<string, Held<T>>());
  /**
   * The two timers each departing mark waits on, so that one mark's fade cannot
   * be cancelled by another's. An effect's own cleanup is no use for this: React
   * runs it on the very next render, which during a move is milliseconds later.
   */
  const timers = useRef(new Map<string, number[]>());
  const [, redraw] = useReducer((count: number) => count + 1, 0);

  const here = new Map(items.map((item) => [keyOf(item), item]));
  const now = typeof performance === "undefined" ? 0 : performance.now();
  /*
    Taken into what is drawn as the position is read, not later. Anything in the
    position is in it and is not going anywhere; anything already held keeps the
    time it arrived.
  */
  for (const [key, item] of here) {
    const before = held.current.get(key);
    held.current.set(key, {
      item,
      fading: false,
      since: before?.since ?? now,
    });
  }

  const signature = [...here.keys()].join(" ");

  useLayoutEffect(() => {
    const stop = (key: string) => {
      for (const id of timers.current.get(key) ?? []) {
        window.clearTimeout(id);
      }
      timers.current.delete(key);
    };
    let changed = false;

    // Back in the position: whatever was being arranged for it is called off.
    for (const key of here.keys()) {
      if (timers.current.has(key)) {
        stop(key);
        changed = true;
      }
    }

    const owners =
      ownerOf === undefined
        ? new Set<string>()
        : new Set([...here.values()].map(ownerOf));
    const drop = (key: string) =>
      window.setTimeout(() => {
        held.current.delete(key);
        timers.current.delete(key);
        redraw();
      }, ms + AFTERWARDS);

    for (const [key, entry] of [...held.current]) {
      if (here.has(key) || timers.current.has(key)) {
        continue;
      }
      // Gone, and either not worth seeing off or not to be seen off at all.
      if (ms <= 0 || now - entry.since < TOO_BRIEF) {
        held.current.delete(key);
        changed = true;
        continue;
      }
      /* Replaced rather than departed: its owner is drawing something else
         now, and the two must cross rather than follow one another. */
      if (ownerOf !== undefined && owners.has(ownerOf(entry.item))) {
        held.current.set(key, { ...entry, fading: true });
        timers.current.set(key, [drop(key)]);
        changed = true;
        continue;
      }
      timers.current.set(key, [
        window.setTimeout(() => {
          // Still gone: now it may be seen to go.
          const going = held.current.get(key);
          if (going !== undefined) {
            held.current.set(key, { ...going, fading: true });
          }
          timers.current.set(key, [
            ...(timers.current.get(key) ?? []),
            window.setTimeout(() => {
              held.current.delete(key);
              timers.current.delete(key);
              redraw();
            }, ms + AFTERWARDS),
          ]);
          redraw();
        }, SETTLE),
      ]);
    }

    if (changed) {
      redraw();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature
    // stands for the set of marks; the marks themselves are new objects on
    // every render and would run this on every one of them.
  }, [signature, ms]);

  /* On the way out of the page, nothing is left ticking. */
  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const ids of running.values()) {
        for (const id of ids) {
          window.clearTimeout(id);
        }
      }
      running.clear();
    };
  }, []);

  return [...held.current].map(([key, { item, fading }]) => ({
    key,
    item,
    leaving: fading,
  }));
}
