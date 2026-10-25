/**
 * What a PGN calls a player, cut down to what a file name wants: the surname.
 *
 * PGN writes names surname first — "Krylov, Mikhail" — and often a rating in
 * brackets after them; both the first name and the rating are noise in a file
 * name, and the surname is what the game is known by. A name with no comma in
 * it is taken whole, since there is no telling which word of it is which.
 */
export function surnameOf(name: string): string {
  const bare = name.replace(/\([^)]*\)/g, " ").trim();
  const comma = bare.indexOf(",");
  return (comma < 0 ? bare : bare.slice(0, comma)).replace(/\s+/g, " ").trim();
}

/** Nothing a file system would refuse, and nothing that would read as a path. */
export function fileSafe(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * A name as typed, made into a file name: safe, and ending in `.extension`
 * once. Either of the endings this app writes is taken off first, so a name
 * kept from a GIF of the same game does not become "Game.gif.mp4".
 */
export function asFileName(typed: string, extension: string): string {
  const safe = fileSafe(typed.replace(/\.(gif|mp4)$/i, ""));
  return safe === "" ? "" : `${safe}.${extension}`;
}

/**
 * A game's name made into a file name the way a page's address is made from
 * its title: "Mate in 2, task #52" is `mate-in-2-task-52`. Lower case, accents
 * taken off their letters, an apostrophe dropped rather than made a break —
 * "Kasparov's Immortal" is `kasparovs-immortal` — and every other run of what
 * is neither a letter nor a figure, in any script, one dash. Nothing, where
 * that leaves nothing.
 */
export function slugFileName(name: string, extension: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/['\u2019]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/, "");
  return slug === "" ? "" : `${slug}.${extension}`;
}

/** A name as typed, made into a file name: safe, and ending in `.gif` once. */
export const asGifName = (typed: string): string => asFileName(typed, "gif");

/**
 * Names that name nobody: what a PGN writes for a player it does not know,
 * what this app writes in their place — the colour they played — and the
 * stand-in for somebody not yet sat down to a game.
 */
const PLACEHOLDERS = new Set(["", "?", "Unknown", "An opponent"]);
const unnamed = (name: string, colour: string) =>
  PLACEHOLDERS.has(name.trim()) || name.trim() === colour;

/**
 * The name offered for a file made of what is on the board — a GIF or a video,
 * which `extension` says.
 *
 * The game's own name, where it has one — the name its file gives it, or the
 * one it is stashed under, as the page's title says it — made a file name as
 * a page's address is: "Mate in 2, task #52" is `mate-in-2-task-52.gif`. See
 * `slugFileName`. Otherwise who played it, where the board says so —
 * "Krylov - Arslanov.gif" — which is what somebody would look for it by. A
 * board that names nobody — its rows say White and Black — is a position
 * rather than a game: "White - Black.gif" says nothing a reader could find it
 * by, so it goes by the name it is kept under, if it has one, and otherwise by
 * the app and the day.
 */
export function suggestedFileName(
  players: { white: string; black: string } | null,
  keptAs: string | null,
  extension: string,
  today: Date = new Date(),
  gameName: string | null = null
): string {
  if (gameName !== null) {
    const slug = slugFileName(gameName, extension);
    if (slug !== "") {
      return slug;
    }
  }
  /* Asked of the whole name, not the surname: "White, John" is somebody. */
  if (players !== null && !unnamed(players.white, "White") && !unnamed(players.black, "Black")) {
    const named = asFileName(`${surnameOf(players.white)} - ${surnameOf(players.black)}`, extension);
    if (named !== "") {
      return named;
    }
  }
  if (keptAs !== null) {
    const kept = asFileName(keptAs, extension);
    if (kept !== "") {
      return kept;
    }
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `chess-visualizer-${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.${extension}`;
}

/** The name offered for a GIF of what is on the board; see `suggestedFileName`. */
export const suggestedGifName = (
  players: { white: string; black: string } | null,
  keptAs: string | null,
  today: Date = new Date()
): string => suggestedFileName(players, keptAs, "gif", today);
