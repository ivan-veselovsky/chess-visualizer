/**
 * How long a game is kept, and what is left when it is not.
 *
 * The keep goes by how many games there are (see `worker/keeping.ts`), and
 * is days long, so nothing here waits it out. A worker started for tests —
 * `KEEPING_TEST=on`, which `.dev.vars` says for `wrangler dev` — lets each
 * test have a registry of its own, set its own N1, N2, T0 and T1, ask how
 * the registry stands, and have it sweep as though the clock read a time the
 * test names. The games compare their own last touch with the cuts the sweep
 * sends them, so moving the registry's clock is all it takes.
 *
 * Run against a worker that is not a test one, it says so and stops, rather
 * than passing quietly without having tested anything.
 */
import { connect, until, untilClosed, answered, token, gameId, check, summary, base } from "./lib.mjs";

console.log("Games are kept by how many there are, and then swept away\n");

const http = base.replace(/^ws/, "http");

/** The registry named, asked over HTTP. */
const registry = (name) => ({
  stats: async (rows = 50, now) => (await fetch(`${http}/keeping/${name}?rows=${rows}${now === undefined ? "" : `&now=${now}`}`)).json(),
  policy: async (vars) =>
    (await fetch(`${http}/keeping/${name}/policy`, { method: "POST", body: JSON.stringify(vars) })).json(),
  sweep: async (now) => (await fetch(`${http}/keeping/${name}/sweep?now=${now}`, { method: "POST" })).json(),
  /** The health report and its HTTP status, at a time the test names, and the tally checked. */
  health: async (now) => {
    const response = await fetch(`${http}/keeping/${name}/health?deep=1${now === undefined ? "" : `&now=${now}`}`);
    return { http: response.status, ...(await response.json()) };
  },
  unschedule: async () => (await fetch(`${http}/keeping/${name}/unschedule`, { method: "POST" })).json(),
  fail: async (sweeps) => (await fetch(`${http}/keeping/${name}/fail?sweeps=${sweeps}`, { method: "POST" })).json(),
});

/** A fresh registry with a policy of the test's own. */
async function fresh(vars) {
  const name = `t-${crypto.randomUUID()}`;
  const asked = registry(name);
  await asked.policy(vars);
  return { name, ...asked };
}

/** Waits for the registry to say something — a game's word, sent on without waiting, takes a moment to land. */
async function registryUntil(asked, ok, timeout = 4000) {
  const stop = Date.now() + timeout;
  let stats = await asked.stats();
  while (!ok(stats) && Date.now() < stop) {
    await new Promise((r) => setTimeout(r, 50));
    stats = await asked.stats();
  }
  return stats;
}

/**
 * The registry's tally — the number it keeps of how many games there are,
 * rather than counting them each time — against the rows counted one by one.
 * Asked after every way a game comes or goes: let in, refused, begun again,
 * finished, swept, kept by its own last word.
 */
async function tallied(asked, after, expected) {
  const stats = await asked.stats();
  check(`after ${after}, the tally is the games there are (${expected})`,
    stats.n === expected && stats.counted === expected, JSON.stringify({ tally: stats.n, counted: stats.counted }));
}

/** A game begun in the registry: the challenge made, and nobody yet answering it. */
async function begun(name) {
  const game = gameId();
  const host = token();
  const ws = await connect(game, "host", name);
  ws.say({ type: "create", token: host, name: "Bob", color: "w" });
  const said = await answered(ws);
  return { game, host, ws, said };
}

/** What a game says to a stranger peeking at it: a challenge, or no such game. */
async function peek(game) {
  const ws = await connect(game, "stranger");
  ws.say({ type: "peek" });
  const said = await answered(ws);
  ws.close();
  return said;
}

/* A worker that answers these at all is a test one. */
const probe = await fetch(`${http}/keeping/t-probe`).catch(() => null);
const isJson = probe !== null && probe.ok && (probe.headers.get("content-type") ?? "").includes("json");
if (!isJson) {
  console.log("  SKIP  needs a worker started for tests: KEEPING_TEST=on, as .dev.vars has it for `wrangler dev`\n");
  process.exit(0);
}

const sockets = [];

/* --- At N2, no new game; a game already begun is never refused. --- */
{
  const asked = await fresh({ KEEP_N1: 1, KEEP_N2: 3 });
  const three = [];
  for (let index = 0; index < 3; index += 1) {
    three.push(await begun(asked.name));
  }
  check("games are let in up to N2",
    three.every(({ said }) => said?.type === "created"), JSON.stringify(three.map(({ said }) => said)));
  const fourth = await begun(asked.name);
  check("and the next is refused, as the server being full",
    fourth.said?.type === "error" && fourth.said.code === "serverFull", JSON.stringify(fourth.said));
  check("with the line closed, as for any refusal", (await untilClosed(fourth.ws)) !== null);
  check("and nothing of it kept", (await peek(fourth.game))?.code === "noSuchGame");
  /* The first one's create sent again, as a client does after a dropped line. */
  const again = await connect(three[0].game, "host again", asked.name);
  again.say({ type: "create", token: three[0].host, name: "Bob", color: "w" });
  check("a game already begun, asked to begin again, is answered as it was — not refused",
    (await answered(again))?.type === "created");
  const stats = await asked.stats();
  check("the registry counts each game once", stats.n === 3 && !stats.admits, JSON.stringify({ n: stats.n, admits: stats.admits }));
  await tallied(asked, "games let in, one refused and one begun twice", 3);
  sockets.push(again, fourth.ws, ...three.map(({ ws }) => ws));
}

/* --- At N1 or fewer, kept for ever. --- */
{
  const asked = await fresh({ KEEP_N1: 5, KEEP_N2: 10, KEEP_T0_MS: 1000, KEEP_T1_MS: 1000 });
  const games = [];
  for (let index = 0; index < 3; index += 1) {
    games.push(await begun(asked.name));
  }
  const swept = await asked.sweep(Date.now() + 100 * 365 * 86_400_000);
  check("at N1 games or fewer none is swept, though a century has passed",
    swept.evicted.length === 0 && swept.keep === null, JSON.stringify(swept));
  check("and each is still there", (await Promise.all(games.map(({ game }) => peek(game)))).every((said) => said?.type === "challenge"));
  sockets.push(...games.map(({ ws }) => ws));
}

/* --- The keep by the count, a finished game's half an unfinished one's; and the count coming down. --- */
{
  /* N1 2, N2 6: at four games, half-way — a keep of T0 + T1, twenty seconds; a finished game's ten. */
  const asked = await fresh({ KEEP_N1: 2, KEEP_N2: 6, KEEP_T0_MS: 10_000, KEEP_T1_MS: 10_000, KEEP_FINISHED_SHARE: 0.5 });
  const playing = [await begun(asked.name), await begun(asked.name)];
  const over = [await begun(asked.name), await begun(asked.name)];
  for (const { ws, host } of over) {
    ws.say({ type: "cancel", token: host });
    await until(ws, "ended");
  }
  const told = await registryUntil(asked, (stats) => stats.finished === 2);
  check("a game finishing is told to the registry at once", told.n === 4 && told.finished === 2 && told.keep === 20_000,
    JSON.stringify({ n: told.n, finished: told.finished, keep: told.keep }));
  /* Just past the finished games' keep, by when the registry has them touched: well inside the others'. */
  const now = Math.max(...told.games.filter((each) => each.finished).map((each) => each.touched)) + 10_001;
  const swept = await asked.sweep(now);
  check("a sweep just past ten seconds takes the finished games, kept ten, and leaves the others, kept twenty",
    swept.evicted.length === 2 && swept.kept.length === 0, JSON.stringify(swept));
  const after = await Promise.all([...playing, ...over].map(({ game }) => peek(game)));
  check("the games swept are gone for anyone who asks, the others still there",
    after.slice(0, 2).every((said) => said?.type === "challenge") && after.slice(2).every((said) => said?.code === "noSuchGame"),
    JSON.stringify(after.map((said) => said?.type === "error" ? said.code : said?.type)));
  const later = await asked.sweep(now + 365 * 86_400_000);
  check("and with the count down to N1, the rest are kept for ever: the keep went up as the count came down",
    later.n === 2 && later.keep === null && later.evicted.length === 0, JSON.stringify(later));
  await tallied(asked, "two games finished and swept", 2);
  sockets.push(...playing.map(({ ws }) => ws), ...over.map(({ ws }) => ws));
}

/* --- The game has the last word: touched since the registry last heard, it stays. --- */
{
  /* A keep of one second whatever the count: T1 nothing, N1 none. */
  const asked = await fresh({ KEEP_N1: 0, KEEP_N2: 10, KEEP_T0_MS: 1000, KEEP_T1_MS: 0 });
  const { game, host, ws } = await begun(asked.name);
  const guest = await connect(game, "guest", asked.name);
  guest.say({ type: "answer", token: token(), name: "Alice", accept: true });
  await until(guest, "joined");
  await new Promise((r) => setTimeout(r, 400));
  ws.heard = [];
  ws.say({ type: "move", token: host, ply: 0, san: "e4" });
  await until(ws, "moved");
  /* What the registry heard — when the game began — and when the game was really last touched. */
  const known = (await asked.stats()).games[0];
  const looking = await connect(game, "looking", asked.name);
  looking.say({ type: "standing", token: host });
  const state = await until(looking, "state");
  check("a move is not told to the registry: it is not what a move waits on",
    known !== undefined && state?.touchedAt > known.touched + 300, JSON.stringify({ known, touchedAt: state?.touchedAt }));
  /* A sweep whose cut falls between the two: past its keep by what the registry heard, not by what happened. */
  const between = Math.round((known.touched + state.touchedAt) / 2) + 1000;
  const swept = await asked.sweep(between);
  check("swept by what the registry heard, the game says it was touched since, and stays",
    swept.kept.length === 1 && swept.evicted.length === 0, JSON.stringify(swept));
  const now = (await asked.stats()).games[0];
  check("and the registry is told when", now?.touched === state.touchedAt, JSON.stringify({ now, touchedAt: state.touchedAt }));
  check("so the game is still there", (await peek(game))?.code === "alreadyAnswered");
  const past = await asked.sweep(state.touchedAt + 1001);
  check("past its keep by what happened, it goes", past.evicted.length === 1, JSON.stringify(past));
  looking.heard = [];
  looking.say({ type: "standing", token: host });
  check("and is gone for its own players", (await answered(looking))?.code === "noSuchGame");
  await tallied(asked, "a game kept by its own word, then swept", 0);
  sockets.push(ws, guest, looking);
}

/* --- A batch at a time. --- */
{
  const asked = await fresh({ KEEP_N1: 0, KEEP_N2: 100, KEEP_T0_MS: 1000, KEEP_T1_MS: 0, KEEP_BATCH: 2 });
  const games = [];
  for (let index = 0; index < 5; index += 1) {
    games.push(await begun(asked.name));
  }
  const far = Date.now() + 86_400_000;
  const sweeps = [];
  for (let index = 0; index < 4; index += 1) {
    sweeps.push(await asked.sweep(far));
  }
  check("a sweep asks a batch of games at most, and says there is more to do",
    sweeps[0].evicted.length === 2 && sweeps[0].more && sweeps[1].evicted.length === 2 && sweeps[2].evicted.length === 1 && !sweeps[2].more,
    JSON.stringify(sweeps.map((each) => [each.evicted.length, each.more])));
  check("until every game past its keep is gone", sweeps[3].n === 0 && (await asked.stats()).n === 0);
  await tallied(asked, "sweeping a batch at a time", 0);
  sockets.push(...games.map(({ ws }) => ws));
}

/* --- And the registry's own clock: its alarm sweeps without being asked. --- */
{
  const asked = await fresh({ KEEP_N1: 0, KEEP_N2: 10, KEEP_T0_MS: 300, KEEP_T1_MS: 0, KEEP_SWEEP_MS: 500 });
  const { game, ws } = await begun(asked.name);
  const stats = await asked.stats();
  check("the first game sets the registry's sweep going", stats.sweepAt !== null, JSON.stringify(stats));
  const gone = await registryUntil(asked, (each) => each.n === 0, 6000);
  check("which, on its own, sweeps a game past its keep away", gone.n === 0 && (await peek(game))?.code === "noSuchGame",
    JSON.stringify({ n: gone.n }));
  sockets.push(ws);
}

/* --- A sweep lost: the next game's word sets it going again. --- */
{
  /* An interval of an hour, so that no sweep runs while this looks. */
  const asked = await fresh({ KEEP_N1: 0, KEEP_N2: 10, KEEP_SWEEP_MS: 3_600_000 });
  const first = await begun(asked.name);
  const dropped = await asked.unschedule();
  check("a registry's sweep can be dropped, as an alarm lost would be", dropped.sweepAt === null, JSON.stringify(dropped));
  await begun(asked.name).then(({ ws }) => sockets.push(ws));
  check("a new game sets it going again", (await asked.stats()).sweepAt !== null);
  await asked.unschedule();
  first.ws.say({ type: "cancel", token: first.host });
  await until(first.ws, "ended");
  const told = await registryUntil(asked, (stats) => stats.sweepAt !== null);
  check("and so does a game's report — here its finishing", told.sweepAt !== null && told.finished === 1,
    JSON.stringify({ sweepAt: told.sweepAt, finished: told.finished }));
  sockets.push(first.ws);
}

/* --- A sweep that fails: the schedule goes on, and the next sweep does the work. --- */
{
  const asked = await fresh({ KEEP_N1: 0, KEEP_N2: 10, KEEP_T0_MS: 300, KEEP_T1_MS: 0, KEEP_SWEEP_MS: 500 });
  await asked.fail(2);
  const { game, ws } = await begun(asked.name);
  /*
    Two sweeps failing, half a second apart, then one that works: a second and
    a half. Cloudflare's own retries of an alarm that throws come seconds
    apart and lengthen, so the game gone in well under the third of them is
    the schedule going on, not a retry.
  */
  const gone = await registryUntil(asked, (each) => each.n === 0, 6000);
  check("sweeps that fail are followed by the next, on the usual schedule, which sweeps the game away",
    gone.failing === 0 && gone.n === 0 && (await peek(game))?.code === "noSuchGame",
    JSON.stringify({ failing: gone.failing, n: gone.n }));
  sockets.push(ws);
}

/* --- Health: each thing that should hold, checked, and a failure said by HTTP as well. --- */
{
  const asked = await fresh({ KEEP_N1: 0, KEEP_N2: 10, KEEP_T0_MS: 1000, KEEP_T1_MS: 0, KEEP_SWEEP_MS: 3_600_000 });
  const of = (health, name) => health.checks?.find((each) => each.name === name);
  const { ws } = await begun(asked.name);
  sockets.push(ws);
  const well = await asked.health();
  check("a registry as it should be is healthy, the tally checked against its rows",
    well.http === 200 && well.status === "ok" && of(well, "tally")?.status === "ok", JSON.stringify(well.checks));
  const touched = (await asked.stats(1)).games[0].touched;
  const late = await asked.health(touched + 2 * 3_600_000);
  check("two hours on, its sweep is overdue and its game past its keep: warnings, still a 200",
    late.http === 200 && late.status === "warn" && of(late, "schedule")?.status === "warn" && of(late, "backlog")?.status === "warn",
    JSON.stringify(late.checks));
  await asked.unschedule();
  const lost = await asked.health();
  check("its sweep lost, a failure, and a 503 for a monitor to see",
    lost.http === 503 && lost.status === "fail" && of(lost, "schedule")?.status === "fail", JSON.stringify(lost.checks));
  await asked.fail(1);
  const threw = await fetch(`${http}/keeping/${asked.name}/sweep?now=${Date.now()}`, { method: "POST" });
  const after = await asked.health();
  check("a sweep that throws is kept as the last, a failure with its reason",
    !threw.ok && of(after, "last sweep")?.status === "fail" && of(after, "last sweep")?.says.includes("made to fail"),
    JSON.stringify(of(after, "last sweep")));
  await asked.sweep(Date.now());
  check("and the next that works puts it right", of(await asked.health(), "last sweep")?.status === "ok");
}

/* --- The admin's health: the deployment's own registry, for whoever holds the token and nobody else. --- */
{
  const { readFile } = await import("node:fs/promises");
  const vars = await readFile(new URL("../../.dev.vars", import.meta.url), "utf8").catch(() => "");
  const token = vars.match(/^ADMIN_TOKEN=(.*)$/m)?.[1]?.trim();
  if (token === undefined) {
    console.log("  SKIP  the admin's health: no ADMIN_TOKEN in .dev.vars");
  } else {
    const asking = (auth) => fetch(`${http}/admin/api/health`, auth === undefined ? {} : { headers: { Authorization: auth } });
    const nobody = await asking();
    const wrong = await asking(`Bearer ${token}x`);
    check("the admin's health is not for anyone without the token, nor with a wrong one",
      nobody.status === 401 && wrong.status === 401, `${nobody.status} ${wrong.status}`);
    const right = await asking(`Bearer ${token}`);
    const said = await right.json().catch(() => null);
    /* The shared registry's state is whatever the machine has been doing: only that it answers in full. */
    check("with it, the deployment's registry answers, every check there",
      (right.status === 200 || right.status === 503) &&
        ["count", "tally", "schedule", "backlog", "last sweep"].every((name) => said?.checks?.some((each) => each.name === name)),
      JSON.stringify(said));
  }
}

for (const ws of sockets) ws.close();
process.exit(summary() ? 0 : 1);
