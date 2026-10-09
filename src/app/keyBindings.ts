/**
 * The keys that walk a game: which key, with which modifiers, does what.
 *
 * Kept in this browser rather than in the settings, as which way round the
 * board faces is: they are about the keyboard in front of the reader and the
 * system around it — macOS takes Ctrl+← and Ctrl+→ for itself — not about how
 * a board is drawn, and a preset carried to another machine should not carry
 * them along.
 */

/** What a key can be asked to do. */
export type KeyAction = "previous" | "next" | "first" | "last" | "tourBack" | "tourForward" | "play";

export const KEY_ACTIONS: readonly KeyAction[] = ["previous", "next", "first", "last", "tourBack", "tourForward", "play"];

/** A key and the modifiers held with it. `key` as the browser names it, a letter in lower case. */
export interface KeyCombo {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export type KeyBindings = Record<KeyAction, KeyCombo>;

const combo = (key: string, held: Partial<Omit<KeyCombo, "key">> = {}): KeyCombo => ({
  key,
  ctrl: false,
  alt: false,
  shift: false,
  meta: false,
  ...held,
});

/** Whether this is a Mac, by what the browser says it runs on. */
export function onMac(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const said = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "";
  return /mac/i.test(said);
}

/**
 * The keys a reader starts with. The arrows step, Shift and an arrow walk
 * every line, Space plays. The first and last positions are Ctrl and an arrow
 * — except on a Mac, which takes those for moving between desktops, where
 * they are Home and End: Fn and an arrow on a Mac's own keyboard.
 */
export function defaultBindings(mac = onMac()): KeyBindings {
  return {
    previous: combo("ArrowLeft"),
    next: combo("ArrowRight"),
    first: mac ? combo("Home") : combo("ArrowLeft", { ctrl: true }),
    last: mac ? combo("End") : combo("ArrowRight", { ctrl: true }),
    tourBack: combo("ArrowLeft", { shift: true }),
    tourForward: combo("ArrowRight", { shift: true }),
    play: combo(" "),
  };
}

/** The keys that are never anything's here: they move the keyboard round the page, or put a question away. */
const RESERVED = new Set(["Tab", "Escape", "Enter"]);
/** Keys that are only ever held with another. */
const MODIFIERS = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph", "CapsLock", "OS", "Fn", "Hyper", "Super"]);

/** What a pressed key is, as a combination — null for a modifier on its own, or a key kept for the page. */
export function comboOf(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): KeyCombo | null {
  if (MODIFIERS.has(event.key) || RESERVED.has(event.key) || event.key === "Dead" || event.key === "Unidentified") {
    return null;
  }
  return {
    key: event.key.length === 1 ? event.key.toLowerCase() : event.key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

export function sameCombo(one: KeyCombo, other: KeyCombo): boolean {
  return (
    one.key === other.key &&
    one.ctrl === other.ctrl &&
    one.alt === other.alt &&
    one.shift === other.shift &&
    one.meta === other.meta
  );
}

/** Which action a pressed key asks for, or null for one that asks for none. */
export function actionFor(bindings: KeyBindings, event: Parameters<typeof comboOf>[0]): KeyAction | null {
  const pressed = comboOf(event);
  return pressed === null ? null : (KEY_ACTIONS.find((action) => sameCombo(bindings[action], pressed)) ?? null);
}

const NAMES: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  " ": "Space",
  PageUp: "Page Up",
  PageDown: "Page Down",
};

/** How a combination is written for a reader: "Ctrl+←", "Shift+→", "Space", "Home" — and on a Mac, "⌥←" and "⌘→". */
export function describeCombo(keys: KeyCombo, mac = onMac()): string {
  const name = NAMES[keys.key] ?? (keys.key.length === 1 ? keys.key.toUpperCase() : keys.key);
  const held = mac
    ? [keys.ctrl && "⌃", keys.alt && "⌥", keys.shift && "⇧", keys.meta && "⌘"].filter(Boolean).join("")
    : [keys.ctrl && "Ctrl+", keys.alt && "Alt+", keys.shift && "Shift+", keys.meta && "Meta+"].filter(Boolean).join("");
  return `${held}${name}`;
}

/** As `aria-keyshortcuts` wants it: "Control+ArrowLeft", "Space". */
export function ariaCombo(keys: KeyCombo): string {
  const name = keys.key === " " ? "Space" : keys.key;
  return [keys.ctrl && "Control", keys.alt && "Alt", keys.shift && "Shift", keys.meta && "Meta", name].filter(Boolean).join("+");
}

/**
 * The bindings with `action` given `keys`. A combination already doing
 * something else changes places with it: the other action takes the keys this
 * one had, so no two actions ever share a key and none is ever left without.
 */
export function bind(bindings: KeyBindings, action: KeyAction, keys: KeyCombo): KeyBindings {
  const taken = KEY_ACTIONS.find((other) => other !== action && sameCombo(bindings[other], keys));
  return {
    ...bindings,
    ...(taken === undefined ? {} : { [taken]: bindings[action] }),
    [action]: keys,
  };
}

const KEY = "cv.keys";

/** A combination as it was written down, or null for anything that is not one. */
function readCombo(written: unknown): KeyCombo | null {
  if (written === null || typeof written !== "object") {
    return null;
  }
  const { key, ctrl, alt, shift, meta } = written as Record<string, unknown>;
  if (typeof key !== "string" || key === "" || [ctrl, alt, shift, meta].some((held) => typeof held !== "boolean")) {
    return null;
  }
  return { key, ctrl: ctrl as boolean, alt: alt as boolean, shift: shift as boolean, meta: meta as boolean };
}

/**
 * The bindings as written down, each action that is missing or unreadable at
 * its default — and the defaults again if two of them came back sharing a key.
 */
export function readBindings(text: string | null, defaults = defaultBindings()): KeyBindings {
  let written: Record<string, unknown> = {};
  try {
    written = text === null ? {} : (JSON.parse(text) as Record<string, unknown>) ?? {};
  } catch {
    written = {};
  }
  const bindings = Object.fromEntries(
    KEY_ACTIONS.map((action) => [action, readCombo(written?.[action]) ?? defaults[action]])
  ) as KeyBindings;
  const clash = KEY_ACTIONS.some((action, index) =>
    KEY_ACTIONS.slice(index + 1).some((other) => sameCombo(bindings[action], bindings[other]))
  );
  return clash ? defaults : bindings;
}

export function loadBindings(): KeyBindings {
  try {
    return readBindings(window.localStorage.getItem(KEY));
  } catch {
    return defaultBindings();
  }
}

export function saveBindings(bindings: KeyBindings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(bindings));
  } catch {
    /* A browser refusing storage keeps them for this visit only. */
  }
}
