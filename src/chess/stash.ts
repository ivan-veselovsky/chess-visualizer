import type { PositionHistory } from "./history";

/**
 * A game put aside under a name.
 *
 * The history is kept whole rather than as its PGN: a stash is somewhere to
 * come back to, and coming back should return the line exactly as it stood,
 * pointer included — which a trip through notation does not preserve.
 */
export interface StashedGame {
  name: string;
  history: PositionHistory;
}

/** Everything put aside so far, in the order each name was first used. */
export type GameStash = StashedGame[];

/** Whether a name is taken, which is what makes stashing under it a replacement. */
export function isStashed(stash: GameStash, name: string): boolean {
  return stash.some((game) => game.name === name);
}

export function stashedGame(
  stash: GameStash,
  name: string
): StashedGame | undefined {
  return stash.find((game) => game.name === name);
}

/**
 * Puts a game aside under a name, replacing whatever was there.
 *
 * A replacement keeps its place in the list rather than moving to the end: the
 * order is where things were left, and re-stashing the game being worked on is
 * no reason to shuffle it past the others.
 */
export function stashGame(
  stash: GameStash,
  name: string,
  history: PositionHistory
): GameStash {
  const game: StashedGame = { name, history };
  const at = stash.findIndex((stashed) => stashed.name === name);
  return at < 0
    ? [...stash, game]
    : stash.map((stashed, index) => (index === at ? game : stashed));
}

/**
 * A name to offer for something being put aside, that nothing is called yet.
 *
 * The day it was set aside on, which is what somebody looking for it later
 * remembers about it — and a number after that when the day already has one.
 * Offered names that collide are worse than useless: the dialog takes the name
 * as given, so accepting the suggestion twice in a day would have written the
 * second game over the first without saying so.
 *
 * The first of a day carries no number. A list of "Set aside 6/9/2026", "(2)",
 * "(3)" reads as one thing and the ones after it, which is what they are.
 */
export function nextStashName(taken: readonly string[], on = new Date()): string {
  const day = `Set aside ${on.toLocaleDateString()}`;
  if (!taken.includes(day)) {
    return day;
  }
  for (let n = 2; ; n += 1) {
    const tried = `${day} (${n})`;
    if (!taken.includes(tried)) {
      return tried;
    }
  }
}
