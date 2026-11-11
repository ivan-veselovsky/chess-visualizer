/**
 * How long a game is kept, by how many games there are.
 *
 * Every game is kept for a while after the last thing that happened to it,
 * and how long that while is depends on how full the server is: the more
 * games there are, the sooner an idle one goes. With `n` games kept,
 *
 *     TTL(n) = ∞                                  n ≤ N1
 *     TTL(n) = T0 + T1 · (N2 − n) / (n − N1)      N1 < n < N2
 *     TTL(n) = T0                                 n ≥ N2
 *
 * One curve, with no step in it: just over N1 it is very long, and it runs
 * down to "never" as n comes down to N1 — so N1 is where eviction fades out
 * rather than a line it switches off at. Half-way, at n = (N1 + N2) / 2, it is
 * T0 + T1: T1 is what a game gets beyond the least when the server is half
 * full. At N2 it is T0, the least any game is kept, and no new game is let in
 * (see `admits`).
 *
 * It settles of itself. With r games begun a day, the number kept comes to
 * where n = r · TTL(n): with the defaults below, some 44,000 games kept 44
 * days at a thousand a day, 83,000 kept 8 days at ten thousand. New games are
 * refused only past r = N2 / T0, fifty thousand a day — real overload.
 *
 * A finished game is kept `finishedShare` of that: it is the cheaper one to
 * lose. Its players have seen how it ended; a game in progress dropped is a
 * game nobody can finish.
 *
 * All here is plain functions of numbers, and the sweep is written against a
 * store it is handed, so that node can test the whole of it without a worker:
 * see `tests/unit.mjs`. The registry (`./registry.ts`) is the store kept in
 * SQLite, and the games themselves are what it asks.
 */

/** The four numbers of the curve, and how the finished games and the sweeping go. */
export interface KeepingPolicy {
  /** N1: at this many games or fewer, none is ever evicted. */
  n1: number;
  /** N2: at this many, no new game is let in. */
  n2: number;
  /** T0, in milliseconds: the least a game is kept, which it is at N2. */
  t0: number;
  /** T1, in milliseconds: what a game gets beyond T0 at half-way between N1 and N2. */
  t1: number;
  /** A finished game is kept this share of an unfinished one's keep. */
  finishedShare: number;
  /** How often the registry looks for games past their keep. */
  sweepEvery: number;
  /**
   * How many games of each kind one sweep asks at most. Not a limit on how
   * many go: a sweep that fills its batch has the next one a second later,
   * until every game past its keep is gone (see `alarm` in `./registry.ts`).
   *
   * Each game asked is a call to its own object — its storage is its own, and
   * only it can delete it — and one alarm has a ceiling on how many calls it
   * makes and how long it runs. A sweep of everything at once, after a
   * backlog (a deploy that lowers N2, a registry down a day), could pass that
   * ceiling half-way; the alarm would fail, be retried from the start, and
   * fail the same way each time. A sweep of a batch always fits.
   */
  batch: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * The deployment's own unless a variable says otherwise: see `policyFrom`.
 *
 * N1 and N2 the user's: a few thousand games kept for ever, fifty thousand
 * at most, some hundred and fifty megabytes at a few KB a game. T0 two days,
 * so a game in progress left for a weekend survives even a full server; T1 a
 * month. A sweep an hour: 24 wakes of one object a day, where a timer on each
 * game would wake every game.
 */
export const DEFAULT_KEEPING: KeepingPolicy = {
  n1: 5_000,
  n2: 50_000,
  t0: 2 * DAY,
  t1: 30 * DAY,
  finishedShare: 0.5,
  sweepEvery: HOUR,
  batch: 100,
};

/**
 * How long a game nothing happens to is kept, with `n` games kept in all.
 * Infinity at N1 or fewer.
 */
export function keptFor(n: number, policy: KeepingPolicy): number {
  if (n <= policy.n1) {
    return Infinity;
  }
  if (n >= policy.n2) {
    return policy.t0;
  }
  return policy.t0 + (policy.t1 * (policy.n2 - n)) / (n - policy.n1);
}

/**
 * The times a game must have been touched after to be kept, at `now` with
 * `n` games: one for the games in progress or waiting for an answer, one for
 * the finished. A game touched before its kind's cut is past its keep. Minus
 * infinity, which nothing is before, where nothing is evicted.
 */
export interface Cutoffs {
  unfinished: number;
  finished: number;
}

export function cutoffsAt(now: number, n: number, policy: KeepingPolicy): Cutoffs {
  const keep = keptFor(n, policy);
  return {
    unfinished: now - keep,
    finished: now - keep * policy.finishedShare,
  };
}

/** Whether a new game may begin, with `n` kept already. */
export function admits(n: number, policy: KeepingPolicy): boolean {
  return n < policy.n2;
}

/** Whether a game touched at `touched` is past its keep, by the cut for its kind. */
export function pastKeeping(touched: number, finished: boolean, cutoffs: Cutoffs): boolean {
  return touched < (finished ? cutoffs.finished : cutoffs.unfinished);
}

/**
 * The policy a deployment asks for, from its variables, each falling back to
 * the default where it is missing or makes no sense:
 *
 *     KEEP_N1  KEEP_N2  KEEP_T0_MS  KEEP_T1_MS  KEEP_FINISHED_SHARE
 *     KEEP_SWEEP_MS  KEEP_BATCH
 *
 * N2 must be past N1 for the curve to mean anything; asked otherwise, both
 * stay the defaults rather than one being taken without the other.
 */
export function policyFrom(vars: Record<string, unknown> | undefined, base: KeepingPolicy = DEFAULT_KEEPING): KeepingPolicy {
  const read = (name: string, least: number, fallback: number, whole = true): number => {
    const raw = vars?.[name];
    const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    if (!Number.isFinite(value) || value < least || (whole && !Number.isInteger(value))) {
      return fallback;
    }
    return value;
  };
  const n1 = read("KEEP_N1", 0, base.n1);
  const n2 = read("KEEP_N2", 1, base.n2);
  const counts = n2 > n1 ? { n1, n2 } : { n1: base.n1, n2: base.n2 };
  return {
    ...counts,
    t0: read("KEEP_T0_MS", 0, base.t0),
    t1: read("KEEP_T1_MS", 0, base.t1),
    finishedShare: Math.min(1, read("KEEP_FINISHED_SHARE", 0, base.finishedShare, false)),
    sweepEvery: read("KEEP_SWEEP_MS", 1, base.sweepEvery),
    batch: read("KEEP_BATCH", 1, base.batch),
  };
}

/** What the registry knows of a game: when it last heard it was touched, and whether it was finished. */
export interface Known {
  id: string;
  touched: number;
  finished: boolean;
}

/**
 * The registry's table, as the sweep sees it. Kept to what the sweep needs,
 * so that a map in node can stand for SQLite in a test.
 */
export interface KeepingStore {
  /**
   * How many games there are. Asked on every new game and every sweep, so
   * it is to be cheap: the registry keeps it as a number of its own rather
   * than counting rows (see its constructor).
   */
  count(): number;
  /**
   * Of one kind, the games touched before `before`, oldest first, `limit` at
   * most: a prefix of that kind's games sorted by when they were touched.
   */
  oldest(finished: boolean, before: number, limit: number): Known[];
  /** What the game itself said: how it stands now. */
  put(game: Known): void;
  /**
   * The game gone — unless it has been touched after `before` since the sweep
   * read it: a new game under the same id, let in while the sweep waited on
   * the old one's answer.
   */
  remove(id: string, before: number): void;
}

/**
 * What a game says when asked to go: gone, or kept, with how it actually
 * stands — touched later than the registry had heard, which is what kept it.
 */
export type Asked = { gone: true } | { gone: false; touched: number; finished: boolean };

/** What one sweep did, for the log and for the tests. */
export interface Swept {
  /** The games there were, and the keep for an unfinished one, before anything went. */
  n: number;
  keep: number;
  cutoffs: Cutoffs;
  /** Gone, by id. */
  evicted: string[];
  /** Asked to go, and touched later than the registry knew. */
  kept: string[];
  /** Asked, and no answer: left for the next sweep. */
  failed: string[];
  /** Why the first of those did not answer, as it said: for the log, which otherwise has only a count. */
  problem: string | null;
  /** A kind's prefix was longer than a batch: another sweep soon. */
  more: boolean;
}

/**
 * One sweep: every game past its keep at `now`, asked to go.
 *
 * The cuts are worked out once, from the count before anything goes, and
 * each kind's games past its cut are a prefix of that kind's games by age —
 * found by the index rather than by looking at every game. Each is asked
 * rather than deleted outright: the game has the last word, as only it knows
 * whether something happened to it since it last said (see `Game.evict`).
 *
 * Asked a few at a time, as each is a request to an object of its own.
 */
export async function sweep(
  store: KeepingStore,
  ask: (id: string, cutoffs: Cutoffs) => Promise<Asked>,
  now: number,
  policy: KeepingPolicy,
  atOnce = 10
): Promise<Swept> {
  const n = store.count();
  const keep = keptFor(n, policy);
  const cutoffs = cutoffsAt(now, n, policy);
  const swept: Swept = { n, keep, cutoffs, evicted: [], kept: [], failed: [], problem: null, more: false };
  if (keep === Infinity) {
    return swept;
  }
  for (const finished of [false, true]) {
    const before = finished ? cutoffs.finished : cutoffs.unfinished;
    const due = store.oldest(finished, before, policy.batch);
    if (due.length >= policy.batch) {
      swept.more = true;
    }
    for (let from = 0; from < due.length; from += atOnce) {
      await Promise.all(
        due.slice(from, from + atOnce).map(async (game) => {
          let said: Asked;
          try {
            said = await ask(game.id, cutoffs);
          } catch (thrown) {
            swept.failed.push(game.id);
            if (swept.problem === null) {
              swept.problem = `${game.id}: ${thrown instanceof Error ? thrown.message : String(thrown)}`;
            }
            return;
          }
          if (said.gone) {
            store.remove(game.id, before);
            swept.evicted.push(game.id);
          } else {
            store.put({ id: game.id, touched: said.touched, finished: said.finished });
            swept.kept.push(game.id);
          }
        })
      );
    }
  }
  return swept;
}

/**
 * When the registry sweeps next, after the sweep that ran at `now` — `swept`
 * what it did, or null where it failed — with `n` games now kept. Null for
 * no sweep at all.
 *
 * A sweep that failed has the next one as usual, an interval on: whatever
 * went wrong, the schedule must not end with it. Left to throw, the alarm
 * would be retried a few times and then dropped, and sweeping would wait for
 * the next new game or report to set it going again (see `sweepSoon` in
 * `./registry.ts`, which stays as the backstop for an alarm lost some other
 * way).
 *
 * A sweep that filled its batch has the next a second on, to clear what is
 * left; none where there is no game left to sweep, as the next to arrive
 * sets it going again.
 */
export function nextSweep(now: number, n: number, policy: KeepingPolicy, swept: Swept | null): number | null {
  if (n === 0) {
    return null;
  }
  if (swept !== null && swept.more) {
    return now + Math.min(1_000, policy.sweepEvery);
  }
  return now + policy.sweepEvery;
}

/**
 * The last sweep, as the registry keeps it for anyone asking how it is: when,
 * and what it did — or, where it threw, why.
 */
export interface LastSweep {
  at: number;
  /** What the sweep threw, where it did: then nothing else here is of it. */
  error: string | null;
  evicted: number;
  kept: number;
  /** Games asked that did not answer, and why the first of them did not. */
  failed: number;
  problem: string | null;
}

/** A sweep's outcome, as it is kept: counts rather than ids, which grow with a batch. */
export function lastSweepOf(at: number, swept: Swept | null, error: string | null): LastSweep {
  return {
    at,
    error,
    evicted: swept?.evicted.length ?? 0,
    kept: swept?.kept.length ?? 0,
    failed: swept?.failed.length ?? 0,
    problem: swept?.problem ?? null,
  };
}

/**
 * What the registry knows of itself, read in a handful of rows: what the
 * health of it is worked out from (see `healthOf`).
 */
export interface KeepingFacts {
  /** The tally. */
  n: number;
  /** The rows counted one by one — every row read — or null where not asked for. */
  counted: number | null;
  /** When the next sweep is set for, if it is. */
  sweepAt: number | null;
  /** When the longest-untouched game of each kind was touched; null where there is none. */
  oldestUnfinished: number | null;
  oldestFinished: number | null;
  last: LastSweep | null;
}

export type HealthStatus = "ok" | "warn" | "fail";

export interface HealthCheck {
  name: string;
  /** "skipped" for a check not asked for: see `counted`. */
  status: HealthStatus | "skipped";
  says: string;
}

export interface Health {
  /** The worst of the checks. */
  status: HealthStatus;
  at: number;
  n: number;
  /** The keep for an unfinished game now, null for for ever. */
  keep: number | null;
  admits: boolean;
  policy: KeepingPolicy;
  last: LastSweep | null;
  checks: HealthCheck[];
}

/**
 * How late a sweep may be before it is said to be: alarms run on time to
 * within seconds, and a sweep takes a little while.
 */
export const HEALTH_GRACE = 5 * 60_000;

/** A count at this share of N2 or more is near enough to full to say so. */
export const NEARLY_FULL = 0.9;

/** A time span, said as a person would: seconds in a test, days in a deployment. */
export function spoken(ms: number): string {
  if (ms === Infinity) {
    return "for ever";
  }
  const [unit, size] =
    ms < 60_000 ? ["s", 1_000] : ms < 3_600_000 ? ["min", 60_000] : ms < 86_400_000 ? ["h", 3_600_000] : ["days", 86_400_000];
  return `${(ms / size).toFixed(ms < 10 * size ? 1 : 0)} ${unit}`;
}

/**
 * Whether the keeping of games is as it should be at `now`: each thing that
 * should hold, checked, and said in words.
 *
 * Written against plain facts rather than the registry, so that every state
 * worth a warning — a lost sweep, a backlog, a count gone wrong, a server
 * nearly full — can be tried in a unit test without bringing any of it about.
 *
 *   count      how near the server is to full: a warning at 90% of N2, a
 *              failure at N2, where new games are refused
 *   tally      the kept count against the rows counted one by one — only
 *              where asked, as counting reads every row
 *   schedule   a sweep set wherever there are games, and not overdue. A
 *              failure where none is set: the next new game or report sets
 *              one, but until then nothing past its keep goes
 *   backlog    no game past its keep by more than a sweep's interval: sweeps
 *              that run, but do not keep up
 *   last sweep a failure where it threw, a warning where games it asked did
 *              not answer
 */
export function healthOf(facts: KeepingFacts, policy: KeepingPolicy, now: number): Health {
  const keep = keptFor(facts.n, policy);
  const cutoffs = cutoffsAt(now, facts.n, policy);
  const checks: HealthCheck[] = [];

  checks.push(
    facts.n >= policy.n2
      ? { name: "count", status: "fail", says: `${facts.n} games: full, new games are refused (N2 ${policy.n2})` }
      : facts.n >= NEARLY_FULL * policy.n2
        ? { name: "count", status: "warn", says: `${facts.n} games: nearly full (N2 ${policy.n2}), kept ${spoken(keep)}` }
        : { name: "count", status: "ok", says: `${facts.n} games, kept ${spoken(keep)} (N1 ${policy.n1}, N2 ${policy.n2})` }
  );

  checks.push(
    facts.counted === null
      ? { name: "tally", status: "skipped", says: "not counted: ask with deep=1, which reads every row" }
      : facts.counted === facts.n
        ? { name: "tally", status: "ok", says: `the tally is the ${facts.n} games there are` }
        : { name: "tally", status: "fail", says: `the tally says ${facts.n}, the rows ${facts.counted}` }
  );

  if (facts.n === 0) {
    checks.push({ name: "schedule", status: "ok", says: "no games, so no sweep needed" });
  } else if (facts.sweepAt === null) {
    checks.push({
      name: "schedule",
      status: "fail",
      says: "no sweep set: none runs until a game is begun or reports",
    });
  } else if (facts.sweepAt < now - HEALTH_GRACE) {
    checks.push({ name: "schedule", status: "warn", says: `the sweep is overdue by ${spoken(now - facts.sweepAt)}` });
  } else {
    checks.push({ name: "schedule", status: "ok", says: `next sweep in ${spoken(Math.max(0, facts.sweepAt - now))}` });
  }

  /* Past its keep by more than a sweep's interval: one sweep, at least, has come and gone without it. */
  const lag = policy.sweepEvery + HEALTH_GRACE;
  const behind = [
    ["unfinished", facts.oldestUnfinished, cutoffs.unfinished] as const,
    ["finished", facts.oldestFinished, cutoffs.finished] as const,
  ].filter(([, oldest, cut]) => oldest !== null && oldest < cut - lag);
  checks.push(
    behind.length === 0
      ? { name: "backlog", status: "ok", says: keep === Infinity ? "nothing is swept below N1" : "no game is overdue" }
      : {
          name: "backlog",
          status: "warn",
          says: behind.map(([kind, oldest, cut]) => `the oldest ${kind} game is ${spoken(cut - (oldest as number))} past its keep`).join("; "),
        }
  );

  const last = facts.last;
  checks.push(
    last === null
      ? { name: "last sweep", status: "ok", says: "none yet" }
      : last.error !== null
        ? { name: "last sweep", status: "fail", says: `failed ${spoken(Math.max(0, now - last.at))} ago: ${last.error}` }
        : last.failed > 0
          ? {
              name: "last sweep",
              status: "warn",
              says: `${spoken(Math.max(0, now - last.at))} ago, ${last.failed} games did not answer — ${last.problem}`,
            }
          : {
              name: "last sweep",
              status: "ok",
              says: `${spoken(Math.max(0, now - last.at))} ago: ${last.evicted} gone, ${last.kept} touched since`,
            }
  );

  const rank = { ok: 0, warn: 1, fail: 2 } as const;
  const status = checks.reduce<HealthStatus>(
    (worst, check) => (check.status !== "skipped" && rank[check.status] > rank[worst] ? check.status : worst),
    "ok"
  );
  return {
    status,
    at: now,
    n: facts.n,
    keep: keep === Infinity ? null : keep,
    admits: admits(facts.n, policy),
    policy,
    last,
    checks,
  };
}
