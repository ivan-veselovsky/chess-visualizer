import { useRef, type ReactNode } from "react";

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

interface TabBarProps<Id extends string> {
  tabs: readonly Tab<Id>[];
  active: Id;
  /** Named for the reader of a screen reader, who cannot see what these switch. */
  label: string;
  onSelect: (id: Id) => void;
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
}: TabBarProps<Id>) {
  const row = useRef<HTMLDivElement>(null);

  /** Moves selection and the focus together, so the keyboard shows its work. */
  function step(by: number, from: number) {
    const next = (from + by + tabs.length) % tabs.length;
    onSelect(tabs[next].id);
    row.current?.querySelectorAll("button")[next]?.focus();
  }

  return (
    <div className="tab-bar" role="tablist" aria-label={label} ref={row}>
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
          {text}
        </button>
      ))}
    </div>
  );
}
