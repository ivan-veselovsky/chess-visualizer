/**
 * A game from the bundled collection, as the dropdown offers it.
 *
 * Each game is its own PGN file under `game-library/`, left as PGN so that any
 * chess program can open one and so that adding a game to the list is a matter
 * of dropping a file in beside the others. Only the tags are read here; the
 * moves are chess.js's business, and are not touched until a game is chosen.
 */
export interface LibraryGame {
  /** The file it came from. Stable, and unique by construction. */
  id: string;
  /** What the dropdown shows: "Adolf Anderssen - Lionel Kieseritzky - 1851". */
  label: string;
  /** The game's own text, ready to be read back by `parsePgn`. */
  pgn: string;
}

/**
 * Every PGN in the directory, as text, resolved when the bundle is built.
 *
 * The files are numbered, and the paths come back sorted, so the list is in the
 * order the directory reads — chronological, as the numbering has it.
 */
const files = import.meta.glob<string>("./game-library/*.pgn", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** One tag's value, or "" where the game does not carry it. */
function tagValue(game: string, name: string): string {
  const match = new RegExp(`^\\[${name}\\s+"([^"]*)"\\]`, "m").exec(game);
  return match === null ? "" : match[1].trim();
}

/** The year out of a PGN date, whose day and month are often "??". */
function year(date: string): string {
  const match = /^(\d{4})/.exec(date);
  return match === null ? "?" : match[1];
}

export const GAME_LIBRARY: LibraryGame[] = Object.keys(files)
  .sort()
  .map((path) => {
    const pgn = files[path];
    return {
      id: path,
      // The players as the file names them, in full: shortening a name is
      // guesswork, and "Duke Karl / Count Isouard" has no surname to find.
      label: [
        tagValue(pgn, "White"),
        tagValue(pgn, "Black"),
        year(tagValue(pgn, "Date")),
      ].join(" - "),
      pgn,
    };
  });
