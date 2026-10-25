/**
 * What a game is called, over the board and in the list of games, read off
 * the tags of its PGN: the name the file gives the game, where it gives one —
 * "The Evergreen Game (1852)", "Mate in 2, task #54" — and otherwise who
 * played it, and when: "Adolf Anderssen – Jean Dufresne (1852)".
 *
 * Only what the file says: a player it does not name is not guessed at, and a
 * date with no year in it is left off rather than shown as "????". A file that
 * names neither the game nor either player has no title to give, and the
 * caller decides what the game goes by instead.
 */

/** One tag's value, or "" where the game does not carry it. */
export function tagValue(pgn: string, name: string): string {
  const match = new RegExp(`^\\[${name}\\s+"([^"]*)"\\]`, "m").exec(pgn);
  return match === null ? "" : match[1].trim();
}

/** A player as the file names them, or nothing for the "?" PGN writes for nobody. */
function named(said: string): string | null {
  return said === "" || said === "?" ? null : said;
}

/** The year out of a PGN date, whose day and month are often "??" — or nothing, where the year is too. */
function yearOf(date: string): string | null {
  return /^(\d{4})/.exec(date)?.[1] ?? null;
}

/**
 * The name the file gives the game itself — its `GameTitle`, or else its
 * `Event` — with "(year)" after it where the date has one and the name does not
 * say it already; null where it gives none. What a game is called when it is
 * called anything other than who played it: see `titleOfPgn`.
 */
export function gameNameOfPgn(pgn: string): string | null {
  const game = named(tagValue(pgn, "GameTitle")) ?? named(tagValue(pgn, "Event"));
  if (game === null) {
    return null;
  }
  const year = yearOf(tagValue(pgn, "Date"));
  return year === null || game.includes(year) ? game : `${game} (${year})`;
}

/**
 * The game's own name, "(year)" after it where the date has one and the name
 * does not say it already; or, where the file names no game, "White – Black
 * (year)": each player as the file names them, the one it does not name as the
 * colour they played. Null where it names neither the game nor a player.
 *
 * The name is `GameTitle` where there is one, which is no standard tag but says
 * nothing else; and otherwise `Event`, which is how a task is named, though in
 * a game from a tournament it is the tournament — "New York" for two games of
 * the library — which `GameTitle`, where a file has both, is there to correct.
 */
export function titleOfPgn(pgn: string): string | null {
  const game = gameNameOfPgn(pgn);
  if (game !== null) {
    return game;
  }
  const year = yearOf(tagValue(pgn, "Date"));
  const white = named(tagValue(pgn, "White"));
  const black = named(tagValue(pgn, "Black"));
  if (white === null && black === null) {
    return null;
  }
  return `${white ?? "White"} – ${black ?? "Black"}${year === null ? "" : ` (${year})`}`;
}
