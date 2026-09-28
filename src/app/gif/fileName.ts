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

/** A name as typed, made into a file name: safe, and ending in `.gif` once. */
export function asGifName(typed: string): string {
  const safe = fileSafe(typed.replace(/\.gif$/i, ""));
  return safe === "" ? "" : `${safe}.gif`;
}

/**
 * Names that name nobody: what a PGN writes for a player it does not know,
 * what this app writes in their place — the colour they played — and the
 * stand-in for somebody not yet sat down to a game.
 */
const PLACEHOLDERS = new Set(["", "?", "Unknown", "An opponent"]);
const unnamed = (name: string, colour: string) =>
  PLACEHOLDERS.has(name.trim()) || name.trim() === colour;

/**
 * The name offered for a GIF of what is on the board.
 *
 * Who played it, where the board says so — "Krylov - Arslanov.gif" — which is
 * what somebody would look for it by. A board that names nobody — its rows say
 * White and Black — is a position rather than a game: "White - Black.gif" says
 * nothing a reader could find it by, so it goes by the name it is kept under,
 * if it has one, and otherwise by the app and the day.
 */
export function suggestedGifName(
  players: { white: string; black: string } | null,
  keptAs: string | null,
  today: Date = new Date()
): string {
  /* Asked of the whole name, not the surname: "White, John" is somebody. */
  if (players !== null && !unnamed(players.white, "White") && !unnamed(players.black, "Black")) {
    const named = asGifName(`${surnameOf(players.white)} - ${surnameOf(players.black)}`);
    if (named !== "") {
      return named;
    }
  }
  if (keptAs !== null) {
    const kept = asGifName(keptAs);
    if (kept !== "") {
      return kept;
    }
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `chess-visualizer-${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.gif`;
}
