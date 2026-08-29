/**
 * What to call a game played with a friend.
 *
 * Both names, the day, and the id it was played under: enough to find it again
 * in a list of stashed games months later, and enough to say which of the two
 * evenings with the same opponent this one was. The id is the part that is
 * certainly unique; the rest is the part a person actually reads.
 */
export function friendlyGameName(
  white: string,
  black: string,
  gameId: string,
  on: Date = new Date(),
): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${on.getFullYear()}.${pad(on.getMonth() + 1)}.${pad(on.getDate())}`;
  return `${white} - ${black} - ${day} - ${gameId}`;
}
