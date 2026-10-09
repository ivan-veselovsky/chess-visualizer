import { useEffect, useState } from "react";
import {
  bind,
  comboOf,
  defaultBindings,
  describeCombo,
  KEY_ACTIONS,
  sameCombo,
  type KeyAction,
  type KeyBindings,
} from "./keyBindings";
import { LabelWithInfo } from "./InfoButton";

const NAMES: Record<KeyAction, string> = {
  previous: "Previous position",
  next: "Next position",
  first: "First position",
  last: "Last position",
  tourBack: "Every line, a move back",
  tourForward: "Every line, a move on",
  play: "Play / stop",
};

interface KeyBindingsFieldProps {
  bindings: KeyBindings;
  onChange: (bindings: KeyBindings) => void;
}

/**
 * The keys that walk a game, each to be set by pressing it: a button showing
 * what the action is on now, which, pressed, listens for the next key and the
 * modifiers held with it. Escape, or the button pressed again, leaves it as it
 * was. A combination another action has changes places with it: see `bind`.
 */
export default function KeyBindingsField({ bindings, onChange }: KeyBindingsFieldProps) {
  const [listening, setListening] = useState<KeyAction | null>(null);

  useEffect(() => {
    if (listening === null) {
      return;
    }
    /* Ahead of everything else on the page, so the key being set is not also
       the key it used to be — nor the game's at all. */
    const hear = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setListening(null);
        return;
      }
      const pressed = comboOf(event);
      if (pressed === null) {
        return;
      }
      onChange(bind(bindings, listening, pressed));
      setListening(null);
    };
    window.addEventListener("keydown", hear, true);
    return () => window.removeEventListener("keydown", hear, true);
  }, [listening, bindings, onChange]);

  const defaults = defaultBindings();
  const asDefault = KEY_ACTIONS.every((action) => sameCombo(bindings[action], defaults[action]));

  return (
    <div className="key-bindings">
      <LabelWithInfo
        label={<span className="key-bindings-title">Keys</span>}
        hint="The keys that step through a game and play it, on whichever tab is open. To change one, press its button and then the key, with whatever is held with it — Ctrl, Alt (⌥), Shift, ⌘. Escape leaves it as it was. A key another action has changes places with it. Kept in this browser."
      />
      <div className="key-bindings-grid">
        {KEY_ACTIONS.map((action) => (
          <div className="key-binding" key={action}>
            <span className="key-binding-name">{NAMES[action]}</span>
            <button
              type="button"
              className={`reset-button key-capture${listening === action ? " key-capture-listening" : ""}`}
              aria-pressed={listening === action}
              aria-label={`${NAMES[action]}: ${describeCombo(bindings[action])}. Press to change.`}
              onClick={() => setListening(listening === action ? null : action)}
              onBlur={() => setListening((now) => (now === action ? null : now))}
            >
              {listening === action ? "Press a key…" : describeCombo(bindings[action])}
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="reset-button key-bindings-reset" disabled={asDefault} onClick={() => onChange(defaults)}>
        Reset keys
      </button>
    </div>
  );
}
