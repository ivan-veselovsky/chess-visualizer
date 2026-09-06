/**
 * What a game is doing, said where a tail can hear it.
 *
 *   npx wrangler tail                 # a deployed worker
 *   (and straight to the console of `wrangler dev` when run locally)
 *
 * The runtime's own log says only that a socket was upgraded — "GET /ws 101" —
 * which is true of every request and tells nobody anything. What is worth
 * knowing is what the game did: who arrived, what they asked, what it decided,
 * and what it refused. A game is a handful of lines from beginning to end, so
 * these are cheap to keep and worth having when two people disagree about what
 * happened.
 *
 * Every line names the game, so one game's story can be picked out of a tail
 * carrying several. Tokens are never written: they are the whole of a player's
 * identity, and a log is a thing that gets copied into bug reports.
 *
 * Whether anything is written is the deployment's business, not this file's:
 * a `GAME_LOG` variable says, and the object reads it. It is off in
 * `wrangler.jsonc`, which is what a deployment gets, and on in `.dev.vars`,
 * which is what a machine running it locally gets — so a log is kept where
 * somebody is watching and not where nobody is.
 */
const MARK = "♟";

export function note(game: string, what: string, detail?: unknown): void {
  if (detail === undefined) {
    console.log(`${MARK} ${game} ${what}`);
  } else {
    console.log(`${MARK} ${game} ${what}`, detail);
  }
}

/** Which side somebody is, said without saying who they are. */
export function whoIs(
  record: { host: { token: string }; guest: { token: string } | null },
  token: string
): string {
  if (record.host.token === token) {
    return "the challenger";
  }
  if (record.guest !== null && record.guest.token === token) {
    return "the opponent";
  }
  return "a stranger";
}
