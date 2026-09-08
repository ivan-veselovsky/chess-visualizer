import { useCallback, useEffect, useRef, useState } from "react";
import { asking } from "./asking";
import { PRESETS } from "./presets";
import type { Settings } from "./settings";
import {
  LONGEST_NAME,
  MOST_PRESETS,
  flushSettings,
  loadSettings,
  saveSettings,
} from "./settingsStore";

/** A row of the list: a built-in, one of the reader's own, or one unreadable. */
export interface PresetRow {
  name: string;
  /** Built-in presets are code. They can be read from and never written to. */
  locked: boolean;
  /** The version it was written against, for one this build cannot read. */
  fromVersion?: number | null;
}

/** What a chosen action is waiting on: the reader's answer about unsaved work. */
export type Pending =
  | { kind: "choose"; name: string }
  | { kind: "settings"; settings: Settings };

const sameSettings = (one: Settings, other: Settings) =>
  JSON.stringify(one) === JSON.stringify(other);

const builtIn = (name: string) => PRESETS.find((preset) => preset.name === name);

/** Names are compared as a reader would compare them, not as bytes. */
const takenBy = (name: string, names: string[]) =>
  names.some((held) => held.toLowerCase() === name.trim().toLowerCase());

/**
 * Why a name cannot be used, or null when it can.
 *
 * The same answers the dialog shows as somebody types, so a name is refused
 * before it is saved rather than after.
 */
export function nameTrouble(
  name: string,
  mine: string[],
  unreadable: string[]
): string | null {
  const wanted = name.trim();
  if (wanted === "") {
    return "A preset needs a name.";
  }
  if (wanted.length > LONGEST_NAME) {
    return `Names run to ${LONGEST_NAME} characters.`;
  }
  if (takenBy(wanted, PRESETS.map((preset) => preset.name))) {
    return `“${wanted}” is one of the built-in presets.`;
  }
  if (takenBy(wanted, [...mine, ...unreadable])) {
    return `There is already a preset called “${wanted}”.`;
  }
  if (mine.length >= MOST_PRESETS && !takenBy(wanted, mine)) {
    return `That would be more than ${MOST_PRESETS} presets.`;
  }
  return null;
}

interface UsePresetsProps {
  /** The settings on the board, which are what gets saved. */
  settings: Settings;
  /** Puts a preset's settings on the board. */
  apply: (settings: Settings) => void;
  /** What the first render read out of the store, so it is read only once. */
  opened: ReturnType<typeof loadSettings>;
}

/**
 * The presets, the one being saved to, and what is not saved yet.
 *
 * The rules, in one place:
 *
 *   - the settings on the board are saved on a clock, always, under whatever
 *     name is current. A preset of the reader's own is therefore never behind
 *     what is on screen — there is no Save button because there is nothing a
 *     Save button would do.
 *   - a built-in preset cannot be written to, so settings changed on top of one
 *     are held apart, under no name. That is the only state that can be lost,
 *     and it is the only state anybody is asked about.
 *   - leaving a preset writes it first. What the clock has not got round to
 *     yet is not a reason for a click to lose anything.
 */
export function usePresets({ settings, apply, opened }: UsePresetsProps) {
  /*
    The name in hand, or the first built-in when the stored one answers to
    nothing.

    A name can stop answering: a preset deleted in another tab, or a built-in
    renamed between two builds. Either way the settings themselves are still
    here and still on the board — what is lost is only where they were being
    saved — so the list opens on the first built-in and the panel says the
    settings are unsaved, which is exactly what they are.
  */
  const [target, setTarget] = useState<string>(() => {
    const wanted = opened.target;
    if (wanted !== null && (builtIn(wanted) !== undefined || wanted in opened.sets)) {
      return wanted;
    }
    return PRESETS[0]!.name;
  });
  const [sets, setSets] = useState<Record<string, Settings>>(opened.sets);
  const [unreadable, setUnreadable] = useState<Record<string, number | null>>(
    opened.unreadable
  );
  /** An action held while the reader answers for settings not yet saved. */
  const [pending, setPending] = useState<Pending | null>(null);

  const locked = builtIn(target) !== undefined;
  /*
    Unsaved work, and the only kind there is: settings changed while a built-in
    preset is the one in hand. A preset of the reader's own takes every change
    as it is made, so there is nothing of it left behind to lose.

    A name that no longer answers — a preset this browser deleted in another tab
    — counts as built-in for this purpose: there is nothing to write to, so what
    is on the board is unsaved.
  */
  const known = locked
    ? builtIn(target)!.settings
    : (sets[target] ?? null);
  const dirty = known === null || (locked && !sameSettings(settings, known));

  /*
    What the store is told: the settings in use, the name they are under, and
    every preset saved. A preset of the reader's own is the settings themselves
    while it is the one in hand, so it is written from them.

    Only a preset that already exists, though. A name can stop answering — one
    deleted in another tab, a built-in renamed between two builds — and writing
    the settings under it would quietly conjure a preset the reader never made,
    named after something that used to be there. Nothing is conjured: the
    settings stay unsaved, which is what they are, and the panel says so.
  */
  const savedUnder = (which: string, held: Record<string, Settings>) =>
    builtIn(which) === undefined && which in held;
  const record = useCallback(
    (which: string, live: Settings, held: Record<string, Settings>) => ({
      target: which,
      working: live,
      sets: savedUnder(which, held) ? { ...held, [which]: live } : held,
    }),
    []
  );

  useEffect(() => {
    saveSettings(record(target, settings, sets));
  }, [settings, target, sets, record]);

  useEffect(() => {
    const leaving = () => {
      if (document.visibilityState === "hidden") {
        flushSettings();
      }
    };
    document.addEventListener("visibilitychange", leaving);
    window.addEventListener("pagehide", flushSettings);
    return () => {
      document.removeEventListener("visibilitychange", leaving);
      window.removeEventListener("pagehide", flushSettings);
      flushSettings();
    };
  }, []);

  /*
    Another tab of this browser saved something.

    The list is brought up to date and the board is not: a preset saved next
    door is worth seeing in the list at once, while settings changing under a
    reader who is in the middle of tuning them is exactly what nothing here is
    allowed to do. Which preset this tab is on is its own business too.
  */
  useEffect(() => {
    const elsewhere = (event: StorageEvent) => {
      if (event.key !== null && !event.key.endsWith("cv.settings")) {
        return;
      }
      const found = loadSettings();
      setSets((was) => (JSON.stringify(was) === JSON.stringify(found.sets) ? was : found.sets));
      setUnreadable((was) =>
        JSON.stringify(was) === JSON.stringify(found.unreadable) ? was : found.unreadable
      );
    };
    window.addEventListener("storage", elsewhere);
    return () => window.removeEventListener("storage", elsewhere);
  }, []);

  /*
    Every row the list shows: the built-ins, then the reader's own, then any
    this build cannot read.

    The one the app opens with heads the built-ins whatever it is called —
    somewhere to start from and somewhere to come back to belongs at the top,
    not wherever its name happens to fall — and the rest go by name, as do the
    reader's own. By name and not by when they were last used: a preset is
    looked for by what it is called, and a list that reshuffled itself would
    move the row out from under the pointer going for it.
  */
  const rows: PresetRow[] = [
    ...[...PRESETS]
      .sort((one, other) =>
        one.id === "default"
          ? -1
          : other.id === "default"
            ? 1
            : one.name.localeCompare(other.name)
      )
      .map((preset) => ({ name: preset.name, locked: true })),
    ...Object.keys(sets)
      .map((name) => ({ name, locked: false }))
      .sort((one, other) => one.name.localeCompare(other.name)),
    ...Object.entries(unreadable)
      .map(([name, fromVersion]) => ({ name, locked: false, fromVersion }))
      .sort((one, other) => one.name.localeCompare(other.name)),
  ];

  /**
   * The one place anything changes hands: what is on the board, what it is
   * called, and what is saved, moved together and written before the state
   * catches up.
   *
   * Written from what is passed rather than from the state, because these are
   * called in ones and twos from a single click — save this, then go to that —
   * and a second call would otherwise be reading what the first had not yet
   * set. The store is told once, with the picture as it will be.
   */
  const handOver = useCallback(
    (
      name: string,
      live: Settings,
      kept: Record<string, Settings>
    ) => {
      saveSettings({ target: name, working: live, sets: kept });
      flushSettings();
      setSets(kept);
      setTarget(name);
      apply(live);
    },
    [apply]
  );

  /**
   * Goes to a preset, having written what the one being left had come to.
   *
   * The settings on the board are the preset in hand while they are in hand —
   * they are only copied into the list when they are written. So the copy is
   * made here, before the name changes. Left to the clock, or to a save made
   * after the switch, what got written would be the value this preset had when
   * it was opened, and the last edits to it would go when the reader clicked
   * away.
   */
  const load = useCallback(
    (name: string, from = target, live = settings, held = sets) => {
      const kept = savedUnder(from, held) ? { ...held, [from]: live } : held;
      const found = builtIn(name)?.settings ?? kept[name];
      if (found === undefined) {
        return;
      }
      handOver(name, found, kept);
    },
    [handOver, sets, settings, target]
  );

  /**
   * Asks for a preset. Answers with what is standing in the way, if anything.
   *
   * The dialog is not raised here — this says there is something to ask about,
   * and the app puts the question. See `discard` and `keep` for the answers.
   */
  const choose = useCallback(
    (name: string) => {
      if (name === target || name in unreadable) {
        return;
      }
      if (dirty && asking()) {
        setPending({ kind: "choose", name });
        return;
      }
      load(name);
    },
    [dirty, load, target, unreadable]
  );

  /** Puts settings on the board — an import — under the same question. */
  const bring = useCallback(
    (incoming: Settings) => {
      if (dirty && asking()) {
        setPending({ kind: "settings", settings: incoming });
        return;
      }
      /* Under the name in hand: a file read in is a change to the settings
         like any other, and a preset of the reader's own takes it. */
      handOver(target, incoming, sets);
    },
    [dirty, handOver, sets, target]
  );

  /** Saves what is on the board under a new name, which becomes the one in hand. */
  const saveAs = useCallback(
    (name: string, then: Pending | null = null) => {
      const wanted = name.trim();
      const kept = { ...sets, [wanted]: settings };
      setPending(null);
      /* Saved, and then whatever the reader was doing when they were asked —
         both from `kept`, so the preset just made is there to be gone to. */
      if (then?.kind === "choose") {
        load(then.name, wanted, settings, kept);
      } else if (then?.kind === "settings") {
        handOver(wanted, then.settings, kept);
      } else {
        handOver(wanted, settings, kept);
      }
    },
    [handOver, load, sets, settings]
  );

  /** The answer that throws the unsaved settings away and goes on. */
  const discard = useCallback(() => {
    const held = pending;
    setPending(null);
    if (held?.kind === "choose") {
      load(held.name);
    } else if (held?.kind === "settings") {
      /* Thrown away in favour of what was brought in, under the same name:
         the file replaces the board, and the name it is under does not move. */
      handOver(target, held.settings, sets);
    }
  }, [handOver, load, pending, sets, target]);

  /** The answer that leaves everything where it was. */
  const keep = useCallback(() => setPending(null), []);

  /**
   * Drops presets of the reader's own.
   *
   * Never the one in hand: its tick is not offered, so this cannot be asked. A
   * reader who wants rid of it saves the settings under another name first,
   * which leaves them somewhere rather than nowhere.
   */
  const remove = useCallback(
    (names: readonly string[]) => {
      const dropping = names.filter((name) => name !== target);
      if (dropping.length === 0) {
        return;
      }
      setSets((was) => {
        const next = { ...was };
        for (const name of dropping) {
          delete next[name];
        }
        return next;
      });
      setUnreadable((was) => {
        const next = { ...was };
        for (const name of dropping) {
          delete next[name];
        }
        return next;
      });
    },
    [target]
  );

  /* Written whole on the next turn of the clock; forced out here because a
     preset going away is worth keeping even if the tab does not last. */
  const wrote = useRef(sets);
  useEffect(() => {
    if (wrote.current !== sets) {
      wrote.current = sets;
      flushSettings();
    }
  }, [sets]);

  return {
    rows,
    target,
    dirty,
    pending,
    mine: Object.keys(sets),
    unreadable: Object.keys(unreadable),
    choose,
    bring,
    saveAs,
    discard,
    keep,
    remove,
  };
}
