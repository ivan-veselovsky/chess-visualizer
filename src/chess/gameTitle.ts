/**
 * What a game is called, over the board and in the list of games: who played
 * it, and when — "Adolf Anderssen – Lionel Kieseritzky (1851)" — read off the
 * tags of its PGN.
 *
 * Only what the file says: a player it does not name is not guessed at, and a
 * date with no year in it is left off rather than shown as "????". A file that
 * names neither player has no title to give, and the caller decides what the
 * game goes by instead.
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
 * "White – Black (year)", from the game's tags: each player as the file names
 * them, the one it does not name as the colour they played, and the year only
 * where the date has one. Null where neither player is named.
 */
export function titleOfPgn(pgn: string): string | null {
  const white = named(tagValue(pgn, "White"));
  const black = named(tagValue(pgn, "Black"));
  if (white === null && black === null) {
    return null;
  }
  const year = yearOf(tagValue(pgn, "Date"));
  return `${white ?? "White"} – ${black ?? "Black"}${year === null ? "" : ` (${year})`}`;
}
