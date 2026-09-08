import LockIcon from "./LockIcon";
import type { PresetRow } from "./usePresets";

interface PresetListProps {
  rows: PresetRow[];
  /** The one being saved to, or worked on top of. */
  target: string;
  /** Whether the settings on the board have left the preset they came from. */
  dirty: boolean;
  /** Which rows are ticked for removal. */
  chosen: Set<string>;
  onOpen: (name: string) => void;
  onChoose: (name: string, on: boolean) => void;
}

/**
 * The presets, in the order a list of names is read in: the built-in ones
 * first, then the reader's own, alphabetically within each.
 *
 * By name and not by when they were last used, unlike the games list next door.
 * A game is looked for by what happened in it lately; a preset is looked for by
 * its name, and a list that reshuffled itself would move the row out from under
 * the pointer that is going for it.
 */
export default function PresetList({
  rows,
  target,
  dirty,
  chosen,
  onOpen,
  onChoose,
}: PresetListProps) {
  return (
    <ul className="saved-games preset-list">
      {rows.map((row) => {
        const here = row.name === target;
        const unreadable = row.fromVersion !== undefined;
        return (
          <li
            key={row.name}
            className={here ? "saved-game-row here" : "saved-game-row"}
          >
            <button
              type="button"
              className="reset-button saved-game"
              disabled={unreadable}
              title={
                unreadable
                  ? "Written by another version of this app"
                  : here
                    ? "The preset in use"
                    : `Use ${row.name}`
              }
              aria-current={here ? "true" : undefined}
              onClick={() => onOpen(row.name)}
            >
              <span className="preset-lock">{row.locked && <LockIcon />}</span>
              <span className="saved-game-pair">{row.name}</span>
              {/* What is true of this row and not of the others: settings on
                  top of a built-in that have nowhere to be saved, or a preset
                  from a version this build does not read. */}
              <span className="preset-note">
                {unreadable
                  ? `from version ${row.fromVersion ?? "?"}`
                  : here && dirty
                    ? "edited"
                    : ""}
              </span>
            </button>
            {/*
              No tick against a built-in, which cannot be removed, nor against
              the one in use — a reader who wants rid of that one saves it under
              another name first, which leaves the settings somewhere rather
              than nowhere.
            */}
            {!row.locked && !here && (
              <input
                type="checkbox"
                className="saved-game-tick"
                checked={chosen.has(row.name)}
                aria-label={`Remove ${row.name}`}
                onChange={(event) => onChoose(row.name, event.target.checked)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
