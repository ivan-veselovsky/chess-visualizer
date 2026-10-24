import { titleOfPgn } from "./gameTitle";

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
  /** What the list shows, and the board's title: "Adolf Anderssen – Lionel Kieseritzky (1851)". */
  label: string;
  /** The game's own text, ready to be read back by `parsePgn`. */
  pgn: string;
}

/** Every PGN in the directory, as text, resolved when the bundle is built. */
const files = import.meta.glob<string>("./game-library/*.pgn", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * The collection, in alphabetical order of what the dropdown shows.
 *
 * By the label rather than by the file: the files are numbered by date, which
 * is an order you have to know the games to read, while a name is something to
 * look for. Compared as the reader's own locale compares them, so accented
 * names fall where that reader expects rather than after Z.
 */
export const GAME_LIBRARY: LibraryGame[] = Object.keys(files)
  .map((path) => {
    const pgn = files[path];
    return {
      id: path,
      // The players as the file names them, in full: shortening a name is
      // guesswork, and "Duke Karl / Count Isouard" has no surname to find.
      // The same title the game goes by over the board: see `titleOfPgn`.
      label: titleOfPgn(pgn) ?? path.replace(/^.*\//, "").replace(/\.pgn$/, ""),
      pgn,
    };
  })
  .sort((one, other) => one.label.localeCompare(other.label));
