import { DurableObject } from "cloudflare:workers";
import {
  admits,
  cutoffsAt,
  healthOf,
  keptFor,
  lastSweepOf,
  nextSweep,
  policyFrom,
  spoken,
  sweep,
  type Asked,
  type Cutoffs,
  type Health,
  type KeepingPolicy,
  type KeepingStore,
  type Known,
  type LastSweep,
  type Swept,
} from "./keeping";
import { note } from "./log";

/**
 * The name of the one registry a deployment keeps its games in. Tests name
 * others, one each, so that the games one test makes are not counted against
 * another's — see `registryFor` in `./index.ts`.
 */
export const REGISTRY = "games";

/** What the registry says about itself, for the tests and for anyone looking. */
export interface RegistryStats {
  /** The tally: what the keep and admission go by. */
  n: number;
  /** The rows, counted one by one: what the tally should always be. */
  counted: number;
  unfinished: number;
  finished: number;
  policy: KeepingPolicy;
  /** The keep for an unfinished game as things stand, null for for ever. */
  keep: number | null;
  cutoffs: Cutoffs;
  admits: boolean;
  /** When the next sweep is, if one is set. */
  sweepAt: number | null;
  /** How many sweeps a test has still to fail: see `failSweeps`. */
  failing: number;
  /** The games, oldest first: only as many as `rows` asked for. */
  games: Known[];
}

/**
 * Every game the server keeps, by when it was last touched: what the keep
 * is reckoned from, and where a game too old is found.
 *
 * One object for all of them, as a count is one number and the sweep one
 * pass. It hears from a game when the game begins (`admit`), when it finishes,
 * and at most once an hour while it is played (`touched`) — never on every
 * move: an hour late is nothing against a keep of days. And when the game is
 * swept away, from the sweep itself.
 *
 * The table is sorted by kind and then by age (the index `games_by_age`), so
 * the games past their keep are a prefix of each kind's — found without
 * looking at the rest. See `sweep` in `./keeping.ts`, which is the logic of
 * it, written against a store so that it can be tested without a worker.
 *
 * Its own sweeps run on its alarm, every `sweepEvery`. Nothing here is on the
 * way of a move: a game asks to be admitted when it is created and otherwise
 * only tells, without waiting for an answer.
 */
export class Registry extends DurableObject {
  /** The policy as the deployment's variables have it; a test's own, stored here, comes over it. */
  private readonly deployed: KeepingPolicy;
  private readonly logging: boolean;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    this.deployed = policyFrom(env as Record<string, unknown>);
    this.logging = ((env as { GAME_LOG?: string })?.GAME_LOG ?? "on").toLowerCase() !== "off";
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        touched INTEGER NOT NULL,
        finished INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS games_by_age ON games (finished, touched);
    `);
    /*
      How many games there are, kept as a number of its own rather than
      counted. COUNT(*) reads every row, and rows read are what a SQLite-backed
      Durable Object is billed by: near N2, a count on every new game and every
      sweep is fifty thousand rows each time, and the free plan's daily
      allowance gone in a few dozen games.

      Kept by triggers, not by the code that writes the games, so that no way
      of adding or removing a game can forget it: a row inserted counts one
      more, a row deleted one fewer. A game already counted, touched again,
      is an upsert that updates, which fires no insert trigger; and a removal
      the guard turns away (`touched < before`) deletes nothing, which fires
      no delete trigger — so neither moves the count, as neither should.
    */
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS tally (
        one INTEGER PRIMARY KEY CHECK (one = 1),
        n INTEGER NOT NULL
      );
      CREATE TRIGGER IF NOT EXISTS games_in AFTER INSERT ON games BEGIN
        UPDATE tally SET n = n + 1;
      END;
      CREATE TRIGGER IF NOT EXISTS games_out AFTER DELETE ON games BEGIN
        UPDATE tally SET n = n - 1;
      END;
    `);
    /*
      Counted once, the first time: for a registry new now, nothing; for one
      from before the tally, what it already holds. Nothing else runs while
      the constructor does, so no game comes or goes between the count and
      the triggers taking over.
    */
    if (ctx.storage.sql.exec("SELECT n FROM tally").toArray().length === 0) {
      ctx.storage.sql.exec("INSERT INTO tally (one, n) SELECT 1, COUNT(*) FROM games");
    }
  }

  private say(what: string, detail?: unknown): void {
    if (this.logging) {
      note(`registry ${this.name}`, what, detail);
    }
  }

  /** The policy in force: the deployment's, or one a test set (see `setPolicy`). */
  private async policy(): Promise<KeepingPolicy> {
    const asked = await this.ctx.storage.get<Record<string, unknown>>("policy");
    return asked === undefined ? this.deployed : policyFrom(asked, this.deployed);
  }

  /** The table, as the sweep and the rest of this see it. */
  private get store(): KeepingStore {
    const sql = this.ctx.storage.sql;
    return {
      /* The tally, one row read: see the constructor. */
      count: () => Number(sql.exec("SELECT n FROM tally").one().n),
      oldest: (finished, before, limit) =>
        sql
          .exec(
            "SELECT id, touched, finished FROM games WHERE finished = ? AND touched < ? ORDER BY touched LIMIT ?",
            finished ? 1 : 0,
            /* SQLite has no infinity; a cut of minus infinity is before everything. */
            Number.isFinite(before) ? before : before > 0 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER,
            limit
          )
          .toArray()
          .map((row) => ({ id: String(row.id), touched: Number(row.touched), finished: Number(row.finished) === 1 })),
      put: (game) => {
        sql.exec(
          "INSERT INTO games (id, touched, finished) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET touched = excluded.touched, finished = excluded.finished",
          game.id,
          game.touched,
          game.finished ? 1 : 0
        );
      },
      remove: (id, before) => {
        sql.exec("DELETE FROM games WHERE id = ? AND touched < ?", id, Number.isFinite(before) ? before : Number.MAX_SAFE_INTEGER);
      },
    };
  }

  /** The sweep on its way, from whenever the first game arrives. */
  private async sweepSoon(policy: KeepingPolicy): Promise<void> {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + policy.sweepEvery);
    }
  }

  /**
   * A new game asking to be kept: let in, and counted, unless the server is
   * full. The same game asking again — a create sent twice — is let in again,
   * as it is already counted.
   */
  async admit(id: string, touched: number): Promise<{ admitted: boolean; n: number }> {
    const policy = await this.policy();
    const store = this.store;
    const n = store.count();
    const known = this.ctx.storage.sql.exec("SELECT 1 FROM games WHERE id = ?", id).toArray().length > 0;
    if (!known && !admits(n, policy)) {
      /* Said whether or not the deployment keeps a log: someone was turned away. */
      console.warn(`registry ${this.name}: refused a new game, full at ${n} games (N2 ${policy.n2})`);
      return { admitted: false, n };
    }
    store.put({ id, touched, finished: false });
    await this.sweepSoon(policy);
    return { admitted: true, n: known ? n : n + 1 };
  }

  /**
   * A game saying how it stands. Counted whether or not it was before: a
   * game from before there was a registry says so the first time it wakes,
   * and is no less a game for having been begun under the old keep.
   */
  async touched(id: string, touched: number, finished: boolean): Promise<void> {
    this.store.put({ id, touched, finished });
    await this.sweepSoon(await this.policy());
  }

  /** Which registry this is, for the log: the deployment's, or a test's. */
  private get name(): string {
    return this.ctx.id.name ?? REGISTRY;
  }

  /**
   * The games past their keep at `now`, asked to go: see `sweep`. Kept as
   * the last sweep, whatever came of it, for anyone asking how the registry
   * is (see `health`).
   */
  private async sweepAt(now: number): Promise<Swept> {
    let swept: Swept;
    try {
      swept = await this.sweepOnce(now);
    } catch (thrown) {
      await this.ctx.storage
        .put("lastSweep", lastSweepOf(now, null, thrown instanceof Error ? thrown.message : String(thrown)))
        .catch(() => undefined);
      throw thrown;
    }
    await this.ctx.storage.put("lastSweep", lastSweepOf(now, swept, null));
    return swept;
  }

  private async sweepOnce(now: number): Promise<Swept> {
    /* A failure a test asked for (see `failSweeps`): nothing else sets this. */
    const failing = (await this.ctx.storage.get<number>("failing")) ?? 0;
    if (failing > 0) {
      await this.ctx.storage.put("failing", failing - 1);
      throw new Error(`a sweep made to fail by a test, ${failing - 1} more to fail`);
    }
    const policy = await this.policy();
    const games = (this.env as { GAME: DurableObjectNamespace<import("./game").Game> }).GAME;
    const swept = await sweep(
      this.store,
      async (id: string, cutoffs: Cutoffs): Promise<Asked> => games.get(games.idFromString(id)).evict(cutoffs),
      now,
      policy
    );
    /*
      Games that did not answer are said whether or not the deployment keeps
      a log, and with why the first did not: a count alone tells nobody what
      to look at.
    */
    if (swept.failed.length > 0) {
      console.warn(`registry ${this.name}: ${swept.failed.length} games did not answer the sweep, left for the next; the first, ${swept.problem}`);
    }
    if (swept.evicted.length > 0 || swept.kept.length > 0 || swept.failed.length > 0) {
      this.say(
        `swept at ${swept.n} games, keep ${spoken(swept.keep)}: ` +
          `${swept.evicted.length} gone, ${swept.kept.length} touched since, ${swept.failed.length} not answering${swept.more ? ", more to do" : ""}`
      );
    }
    return swept;
  }

  /**
   * The sweep on its schedule, which goes on whatever the sweep did: see
   * `nextSweep` for when the next one is.
   *
   * A sweep that throws is logged and not thrown on. Thrown, Cloudflare
   * would retry the alarm a few times and then drop it, and the schedule
   * would end there until a game next arrived or reported. Caught, the next
   * sweep is set as any other is, and tries again an interval on.
   *
   * Only where the next sweep cannot be set either — the registry's own
   * storage failing — does this throw, as then a retry is the only way left;
   * and past the retries, `sweepSoon` on the next game's word.
   */
  async alarm(): Promise<void> {
    let swept: Swept | null = null;
    try {
      swept = await this.sweepAt(Date.now());
    } catch (thrown) {
      console.error(
        `registry ${this.name}: a sweep failed, the next set as usual:`,
        thrown instanceof Error ? thrown.message : thrown
      );
    }
    /* The deployment's policy, where even the test's own cannot be read. */
    const policy = await this.policy().catch(() => this.deployed);
    const next = nextSweep(Date.now(), this.store.count(), policy, swept);
    if (next !== null) {
      await this.ctx.storage.setAlarm(next);
    }
  }

  /**
   * How the keeping of games is, at `now`: see `healthOf` for what is
   * checked. A few rows read — the tally, the oldest game of each kind — and
   * every row only where `deep` asks for the tally to be checked against them.
   *
   * Asked by the admin's `/admin/api/health` at the real time, and by the tests
   * at a time they name, to see what an overdue sweep or a backlog looks like.
   */
  async health(now = Date.now(), deep = false): Promise<Health> {
    const sql = this.ctx.storage.sql;
    const oldest = (finished: boolean): number | null => {
      const row = sql.exec("SELECT MIN(touched) AS t FROM games WHERE finished = ?", finished ? 1 : 0).one();
      return row.t === null ? null : Number(row.t);
    };
    return healthOf(
      {
        n: this.store.count(),
        counted: deep ? Number(sql.exec("SELECT COUNT(*) AS n FROM games").one().n) : null,
        sweepAt: await this.ctx.storage.getAlarm(),
        oldestUnfinished: oldest(false),
        oldestFinished: oldest(true),
        last: (await this.ctx.storage.get<LastSweep>("lastSweep")) ?? null,
      },
      await this.policy(),
      now
    );
  }

  /**
   * A sweep the admin asked for, at the real time: what it did, and how the
   * registry is after it.
   *
   * And the schedule put right on the way: where no sweep is set, or the
   * next is later than it should be (see `nextSweep`), it is set as the
   * alarm's own sweep would have set it — so that "sweep now" is also how a
   * lost schedule is mended without waiting for a game to arrive.
   *
   * Never at a time the asker names, as the tests' sweep is: a time ahead
   * would take games before their keep is out.
   *
   * A sweep of one batch, as any sweep is; where there is more, the next is
   * set a second on and goes on with it. It may meet the alarm's own sweep
   * half-way, each waiting on games it asked: harmless, as a game asked twice
   * answers twice the same, and a removal of a row already gone removes
   * nothing.
   */
  async sweepByHand(): Promise<{ swept: Swept | null; error: string | null; health: Health }> {
    const now = Date.now();
    let swept: Swept | null = null;
    let error: string | null = null;
    try {
      swept = await this.sweepAt(now);
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown);
      console.error(`registry ${this.name}: a sweep asked for by the admin failed:`, error);
    }
    const policy = await this.policy().catch(() => this.deployed);
    const next = nextSweep(Date.now(), this.store.count(), policy, swept);
    const set = await this.ctx.storage.getAlarm();
    if (next !== null && (set === null || set > next)) {
      await this.ctx.storage.setAlarm(next);
    }
    return {
      /* JSON has no infinity: a keep for ever, said as null. */
      swept: swept === null ? null : { ...swept, keep: swept.keep === Infinity ? (null as unknown as number) : swept.keep },
      error,
      health: await this.health(),
    };
  }

  /**
   * A game's row taken out, whatever its age: the game deleted by the admin
   * (see `Game.erase`). Whether there was a row to take.
   */
  async drop(id: string): Promise<boolean> {
    const there = this.ctx.storage.sql.exec("SELECT 1 FROM games WHERE id = ?", id).toArray().length > 0;
    if (there) {
      this.ctx.storage.sql.exec("DELETE FROM games WHERE id = ?", id);
    }
    return there;
  }

  /* What follows is for tests, and reached only through `./index.ts` where the
     deployment says it is a test one (`KEEPING_TEST`). */

  /** How things stand: the count, the keep, the cuts, and the oldest `rows` games. */
  async stats(rows = 0, now = Date.now()): Promise<RegistryStats> {
    const policy = await this.policy();
    const sql = this.ctx.storage.sql;
    const n = this.store.count();
    /* Counted for real, as the tally is checked against it; a test's registry is small, so these cost nothing. */
    const counted = Number(sql.exec("SELECT COUNT(*) AS n FROM games").one().n);
    const finished = Number(sql.exec("SELECT COUNT(*) AS n FROM games WHERE finished = 1").one().n);
    const keep = keptFor(n, policy);
    return {
      n,
      counted,
      unfinished: counted - finished,
      finished,
      policy,
      keep: keep === Infinity ? null : keep,
      cutoffs: cutoffsAt(now, n, policy),
      admits: admits(n, policy),
      sweepAt: await this.ctx.storage.getAlarm(),
      failing: (await this.ctx.storage.get<number>("failing")) ?? 0,
      games: sql
        .exec("SELECT id, touched, finished FROM games ORDER BY touched LIMIT ?", rows)
        .toArray()
        .map((row) => ({ id: String(row.id), touched: Number(row.touched), finished: Number(row.finished) === 1 })),
    };
  }

  /**
   * The next sweep taken off the schedule, as an alarm lost would be: for a
   * test of what sets it going again.
   */
  async unschedule(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
  }

  /** The next `sweeps` sweeps made to throw, before they do anything: for a test of what follows. */
  async failSweeps(sweeps: number): Promise<void> {
    await this.ctx.storage.put("failing", sweeps);
  }

  /** A policy of the test's own, over the deployment's: any of `policyFrom`'s variables. */
  async setPolicy(vars: Record<string, unknown>): Promise<KeepingPolicy> {
    await this.ctx.storage.put("policy", vars);
    return this.policy();
  }

  /**
   * A sweep now, as though the clock read `now`: days of keeping tried in a
   * moment. The cuts are times, and a game compares its own last touch with
   * them, so nothing else needs the clock moved.
   */
  async sweepNow(now = Date.now()): Promise<Swept> {
    const swept = await this.sweepAt(now);
    /* JSON has no infinity: a keep for ever, said as null. */
    return { ...swept, keep: swept.keep === Infinity ? (null as unknown as number) : swept.keep };
  }
}
