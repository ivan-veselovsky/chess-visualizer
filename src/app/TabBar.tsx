import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { focusFromKeyboard } from "./keyboardOn";

export interface Tab<Id extends string> {
  id: Id;
  label: ReactNode;
  /**
   * What the tab is called, where the label alone does not say it — a tab
   * marked with a symbol reads as nothing at all to a screen reader, and as
   * nothing in particular on a first look.
   */
  name?: string;
}

/** How far past its side a selected tab's fillet reaches: see `.tab-active::after`. */
const FILLET_PX = 6;

interface TabBarProps<Id extends string> {
  tabs: readonly Tab<Id>[];
  active: Id;
  /** Named for the reader of a screen reader, who cannot see what these switch. */
  label: string;
  onSelect: (id: Id) => void;
  /** Closed to the reader for now: something is using the page. */
  inert?: boolean;
}

/**
 * A row of tabs over a single panel.
 *
 * Only one tab is in the tab order, the selected one, and the arrow keys move
 * between them from there. That is how a tab strip is expected to behave, and
 * it also keeps Tab itself meaning "leave this row and go to what it controls"
 * rather than "walk through six buttons first" — which is the whole reason for
 * grouping the settings this way.
 */
export default function TabBar<Id extends string>({
  tabs,
  active,
  label,
  onSelect,
  inert = false,
}: TabBarProps<Id>) {
  const row = useRef<HTMLDivElement>(null);

  /*
    Whether the row is full: less room left after its last tab than the
    fillet a selected tab draws at its side, which would reach past the
    panel's. The last tab then stands at the end, flush with the panel's side,
    and goes without that fillet when selected (see `.tab-bar-full`).

    What is left is measured as the tab would stand of itself: where it has
    been pushed to the end, the margin that pushed it is counted back in.
  */
  const [full, setFull] = useState(false);
  useLayoutEffect(() => {
    const strip = row.current;
    if (strip === null) {
      return;
    }
    const measure = () => {
      const last = strip.lastElementChild;
      if (last === null) {
        return;
      }
      const left =
        strip.getBoundingClientRect().right - last.getBoundingClientRect().right + parseFloat(getComputedStyle(last).marginLeft);
      setFull(left < FILLET_PX);
    };
    measure();
    const watching = new ResizeObserver(measure);
    watching.observe(strip);
    for (const tab of strip.children) {
      watching.observe(tab);
    }
    return () => watching.disconnect();
  }, [tabs]);

  /** Moves selection and the focus together, so the keyboard shows its work. */
  function step(by: number, from: number) {
    const next = (from + by + tabs.length) % tabs.length;
    onSelect(tabs[next].id);
    row.current?.querySelectorAll("button")[next]?.focus();
  }

  return (
    <div className={`tab-bar${full ? " tab-bar-full" : ""}`} role="tablist" aria-label={label} ref={row} inert={inert}>
      {tabs.map(({ id, label: text, name }, index) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          className={`tab${id === active ? " tab-active" : ""}`}
          aria-label={name}
          title={name}
          aria-selected={id === active}
          aria-controls={`panel-${id}`}
          tabIndex={id === active ? 0 : -1}
          onClick={() => onSelect(id)}
          onKeyDown={(event) => {
            /*
              Only while the strip is being worked from the keyboard: reached
              by Tab, and moved along by the arrows from there. A tab that has
              the focus because it was clicked leaves the keys to the page —
              the Lab steps through a game with the arrows, and a reader who
              clicked the tab and then pressed → meant the game, not the tab
              beside it.
            */
            if (!focusFromKeyboard()) {
              return;
            }
            const by =
              event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            if (by !== 0) {
              event.preventDefault();
              step(by, index);
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              step(event.key === "Home" ? -index : tabs.length - 1 - index, index);
            }
          }}
        >
          {/* A word's tab as wide chosen as not: see `.tab-label`. */}
          {typeof text === "string" ? (
            <span className="tab-label" data-label={text}>
              {text}
            </span>
          ) : (
            text
          )}
        </button>
      ))}
    </div>
  );
}
