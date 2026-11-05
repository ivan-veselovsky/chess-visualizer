/*
  A game between two friends, played in two browsers against a running
  worker: the challenge sent from one, taken up in the other, and the
  takebacks of it — pressed several at a time, undone, and pressed by both
  players at once.

    npx wrangler dev --port 8787 &
    BASE=http://127.0.0.1:8787 npm run test:live

  or as part of `./test-local.sh`, which starts the worker itself. Not part
  of `test:all-local`, for the reason the worker's own suites are not: it
  needs a service to talk to, which is something to start rather than a file
  to run. The worker serves the app as well as the game — `dist`, as built —
  so what is driven here is what would be shipped, at the address it would
  be shipped from.

  The worker's suites say what the object decides. This says what two pages
  make of it, which is a question about timing as much as about rules: an
  answer can arrive while the board is still playing the last one out, three
  presses can be on their way before the first is answered, and a click on
  each side can reach the object in either order. Whatever order things
  happen in, the two boards have to end up showing the same game, with the
  buttons right for it and nothing in the way.
*/
import { chromium } from "playwright";
import { check, summary, extraChromeFlags, pause } from "./browser.mjs";

const BASE = (process.env.BASE ?? process.env.WS_BASE?.replace(/^ws/, "http") ?? "http://127.0.0.1:8787").replace(/\/$/, "");

const browser = await chromium.launch({ args: extraChromeFlags() });
/* Each player a browser of their own, as two people at two machines are:
   one profile would be one person holding both seats. */
const player = async (name) => {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (error) => page.errors.push(`${name}: ${error}`));
  /* What the app says about why it asked to stash, passed through: a
     dialog asking to is the one thing here a reader would see go wrong, and
     what it was asked for is said only in the console. Said with the log
     off, as here, where the timing is the reader's own. */
  page.on("console", async (message) => {
    const text = message.text();
    if (/asking to stash|not the game on the Live tab/.test(text)) {
      const detail = await Promise.all(message.args().slice(1).map((arg) => arg.jsonValue().catch(() => "?")));
      console.log(`          ${name}: ${text.replace(/\s+/g, " ")} ${JSON.stringify(detail)}`);
    }
  });
  page.name = name;
  return page;
};
const bob = await player("Bob");
const alice = await player("Alice");

/* What a page shows, read off it. */
const fen = (page) => page.evaluate(() => document.querySelector("#fen")?.value ?? "");
const counter = (page) => page.evaluate(() => document.querySelector(".player-position")?.textContent ?? "");
const tally = (page) => page.evaluate(() => document.querySelector(".invite-tally")?.textContent ?? "");
const notice = (page) => page.evaluate(() => document.querySelector(".invite-notice")?.textContent ?? null);
/* The colour a line is drawn in, and the title's: what the other player says
   is shown in the latter. */
const colourOf = (page, selector) =>
  page.evaluate((selector) => {
    const found = document.querySelector(selector);
    return found === null ? null : getComputedStyle(found).color;
  }, selector);
const livery = (page) =>
  page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--livery)";
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
const dialog = (page) => page.evaluate(() => document.querySelector("dialog[open]")?.textContent?.slice(0, 120) ?? null);
const buttons = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll(".invite-actions button")].map((b) => [b.textContent.trim(), { disabled: b.disabled, title: b.title }])
    )
  );
/* Not long to wait for a button: one that does not come is a failure to
   report, and the dialog in front of it, where there is one, is in it. */
const press = (page, label) =>
  page.locator(".invite-actions button", { hasText: new RegExp(`^${label}$`) }).first().click({ timeout: 5000 });

/* Until something holds, or a few seconds have gone; what it last was either way. */
const until = async (what, seconds = 8) => {
  let last;
  for (let tries = 0; tries < seconds * 10; tries += 1) {
    last = await what();
    if (last.ok) {
      return last;
    }
    await pause(100);
  }
  return last;
};
/* Both boards at the same position, and done moving: the same answer twice
   over, a little apart, so that a board still stepping through a takeback
   is not caught halfway and taken for settled. */
const agreed = async (expected) => {
  const read = async () => {
    const [a, b] = [await fen(alice), await fen(bob)];
    /* And nothing in front of either board: a dialog is never part of it. */
    const asked = { alice: await dialog(alice), bob: await dialog(bob) };
    const clear = asked.alice === null && asked.bob === null;
    return { a, b, ...(clear ? {} : { asked }), ok: clear && a !== "" && a === b && (expected === undefined || a.startsWith(expected)) };
  };
  return until(async () => {
    const first = await read();
    if (!first.ok) {
      return first;
    }
    await pause(700);
    const second = await read();
    return { ...second, ok: second.ok && second.a === first.a };
  });
};

/* A move by clicking its two squares, the way a player makes one. Found by
   name rather than by place: Black's board is turned round. */
const move = async (page, from, to) => {
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  for (const square of [from, to]) {
    const at = await page.evaluate((name) => {
      const box = document.querySelector(`.board-holder > svg .square-layer [data-square="${name}"]`).getBoundingClientRect();
      return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
    }, square);
    await page.mouse.click(at.cx, at.cy);
    await pause(120);
  }
};
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w";

/* ---- The challenge, sent and taken up ---- */

/** Bob challenges, playing Black, and Alice takes it up from the link. */
const challenge = async (takebacks) => {
  await bob.locator("#tab-match").click();
  await bob.locator("button", { hasText: "Send a challenge" }).click();
  await bob.fill("#challenge-name", "Bob");
  await bob.locator("dialog[open] .color-choices button", { hasText: /^Black$/ }).click();
  await bob.fill("#challenge-takebacks", String(takebacks));
  await bob.locator("dialog[open] button", { hasText: /^Challenge$/ }).click();
  await bob.waitForSelector("#invite-link");
  const link = await bob.inputValue("#invite-link");
  check("a challenge sent hands out a link", /[?&]play=\d+/.test(link), link);

  await alice.goto(BASE + "/" + new URL(link).search);
  await alice.waitForSelector("#invite-name");
  await alice.fill("#invite-name", "Alice");
  await alice.locator("dialog[open] button", { hasText: /^Accept|^Play/ }).first().click();
  for (const page of [alice, bob]) {
    await page.locator("#tab-match").click();
  }
  const started = await until(async () => {
    const a = await counter(alice);
    const b = await counter(bob);
    /* The game's own buttons on both sides, and nothing in front of them. */
    const playing = (page) =>
      page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Suggest draw")));
    return { a, b, ok: (await dialog(alice)) === null && (await dialog(bob)) === null && (await playing(alice)) && (await playing(bob)) };
  });
  check("both sides are at the game", started.ok, JSON.stringify(started));
};

await bob.goto(BASE + "/");
await challenge(4);

const opening = [["e2", "e4", alice], ["e7", "e5", bob], ["g1", "f3", alice], ["b8", "c6", bob], ["f1", "c4", alice], ["f8", "c5", bob]];
for (const [from, to, page] of opening) {
  await move(page, from, to);
  await pause(400);
}
const AFTER_SIX = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w";
let seen = await agreed(AFTER_SIX);
check("six moves played, and both boards have them", seen.ok, JSON.stringify(seen));
check("the counters agree", (await counter(alice)) === (await counter(bob)) && /6 of 6/.test(await counter(alice)),
  `${await counter(alice)} / ${await counter(bob)}`);

/* ---- Takebacks pressed one after another, faster than they are answered ---- */

await press(alice, "Takeback");
await pause(50);
await press(alice, "Takeback");
await pause(50);
await press(alice, "Takeback");
seen = await agreed(START);
check("three presses, three takebacks: both boards back at the start", seen.ok, JSON.stringify(seen));
check("and nobody was told off for pressing", (await notice(alice)) === null, await notice(alice));
check("Bob is told what went", /took back their move/.test((await notice(bob)) ?? ""), await notice(bob));
check("three spent", /me 1/.test(await tally(alice)) && /Alice 1/.test(await tally(bob)), `${await tally(alice)} / ${await tally(bob)}`);
let b = await buttons(bob);
check("Bob's Takeback waits while Alice is taking back", b.Takeback?.disabled === true && /Alice is taking moves back/.test(b.Takeback.title),
  JSON.stringify(b));
check("and Bob has no Undo", !("Undo takeback" in b), JSON.stringify(b));
const blue = await livery(bob);
check("what Alice did is said to Bob in the title's colour",
  (await colourOf(bob, ".invite-notice")) === blue && (await colourOf(bob, ".invite-taking-back")) === blue,
  `${await colourOf(bob, ".invite-notice")} / ${await colourOf(bob, ".invite-taking-back")} / ${blue}`);
check("while Alice's own line about it is not", (await colourOf(alice, ".invite-taking-back")) !== blue,
  String(await colourOf(alice, ".invite-taking-back")));
b = await buttons(alice);
check("Alice can undo", b["Undo takeback"]?.disabled === false, JSON.stringify(b));

/* ---- A reload in the middle of it: the takeback under way is the game's, not the page's ---- */

await alice.reload();
await alice.locator("#tab-match").click();
const back = await until(async () => {
  const now = await buttons(alice);
  return { now, ok: now["Undo takeback"]?.disabled === false };
});
check("after a reload, Alice can still undo", back.ok, JSON.stringify(back.now));
seen = await agreed(START);
check("and the board came back where it was", seen.ok, JSON.stringify(seen));
check("with nothing asked of her on the way", (await dialog(alice)) === null, await dialog(alice));

/* ---- Undo pressed once more than there is to undo ---- */

await press(alice, "Undo takeback");
await pause(50);
await press(alice, "Undo takeback");
await pause(50);
await press(alice, "Undo takeback").catch(() => {});
const AFTER_FOUR = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w";
seen = await agreed(AFTER_FOUR);
check("two undone, and both boards are after 2... Nc6", seen.ok, JSON.stringify(seen));
check("the press too many was let go without a word", (await notice(alice)) === null, await notice(alice));
check("Bob is told what came back", /undid their takeback/.test((await notice(bob)) ?? ""), await notice(bob));
check("two given back", /me 3/.test(await tally(alice)) && /Alice 3/.test(await tally(bob)), `${await tally(alice)} / ${await tally(bob)}`);
check("the counters agree", (await counter(alice)) === (await counter(bob)) && /4 of 4/.test(await counter(alice)),
  `${await counter(alice)} / ${await counter(bob)}`);
b = await buttons(alice);
check("the first takeback stays: Undo greyed, saying why", b["Undo takeback"]?.disabled === true && /first/.test(b["Undo takeback"].title),
  JSON.stringify(b));
check("and Bob is still waiting", (await buttons(bob)).Takeback?.disabled === true, JSON.stringify(await buttons(bob)));

/* ---- Her move ends it ---- */

await move(alice, "d2", "d3");
seen = await agreed("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R b");
check("Alice's move reaches both boards", seen.ok, JSON.stringify(seen));
b = await buttons(alice);
check("and her Undo is gone with it", !("Undo takeback" in b), JSON.stringify(b));
b = await buttons(bob);
check("and Bob may take back again", b.Takeback?.disabled === false, JSON.stringify(b));

/* ---- The other way round, answered while the board is still stepping ---- */

await move(bob, "g8", "f6");
await agreed();
await press(bob, "Takeback");
await pause(50);
await press(bob, "Takeback");
seen = await agreed("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b");
check("Bob's two takebacks reach Alice's board, one on the heels of the other", seen.ok, JSON.stringify(seen));
await press(bob, "Undo takeback");
seen = await agreed("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R b");
check("and his undo puts Nc6 and d3 back on hers", seen.ok, JSON.stringify(seen));
check("Alice is told", /undid their takeback: their move 2… Nc6 and your reply 3\. d3 are back/.test((await notice(alice)) ?? ""), await notice(alice));
check("the counters agree", (await counter(alice)) === (await counter(bob)) && /5 of 5/.test(await counter(alice)),
  `${await counter(alice)} / ${await counter(bob)}`);
await move(bob, "g8", "f6");
seen = await agreed("r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R w");
check("Bob's move ends his takeback", seen.ok && (await buttons(alice)).Takeback?.disabled === false, JSON.stringify(seen));

/* ---- Both at once ---- */

/*
  Alice moves, and both of them press Takeback at the same moment: hers
  would unmake her move, his would unmake his last and her move with it.
  Whichever reaches the object first is the one that happens, and the other
  is refused — as waiting for the other's takeback, which is what it is,
  rather than as a game that moved on. Which that is depends on the
  network, so it is not asserted — only that the two boards agree on it,
  and that the refused side is told why and left waiting.
*/
await move(alice, "c1", "g5");
seen = await agreed("r1bqkb1r/pppp1ppp/2n2n2/4p1B1/4P3/3P1N2/PPP2PPP/RN1QKB1R b");
check("Alice's Bg5 is on both boards", seen.ok, JSON.stringify(seen));
/* Either press may find its button already greyed — the other's takeback
   having arrived first — and that is one of the outcomes, not a failure. */
await Promise.all([press(alice, "Takeback").catch(() => {}), press(bob, "Takeback").catch(() => {})]);
seen = await agreed();
const winner = seen.a.startsWith("r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R w")
  ? alice
  : seen.a.startsWith("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R b")
    ? bob
    : null;
check("one takeback of the two happened, and both boards show it", seen.ok && winner !== null, JSON.stringify(seen));
if (winner !== null) {
  const loser = winner === alice ? bob : alice;
  console.log(`          (${winner.name}'s reached the object first)`);
  b = await buttons(loser);
  check("the other side waits", b.Takeback?.disabled === true, JSON.stringify(b));
  /* Told either way: refused, where their press went and arrived second,
     or shown the other's takeback, where it arrived before the press could
     be made and the button was greyed under the click — and in both, told
     under the buttons that the other is taking back and to wait. Never
     anything that reads as something having gone wrong. */
  const told = (await notice(loser)) ?? "";
  check("and has been told what happened",
    /taking moves back — wait|took back their move/.test(told), told);
  /* And in the colour of who said it: a refusal of the loser's own press in
     red, the winner's takeback in the title's. */
  const red = await loser.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--invalid)";
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  const colour = await colourOf(loser, ".invite-notice");
  check(/wait/.test(told) ? "the refusal in red" : "the other's takeback in the title's colour",
    colour === (/wait/.test(told) ? red : blue), `${colour} (${told})`);
  const status = await loser.evaluate(() => document.querySelector(".invite-taking-back")?.textContent ?? "");
  check("and that the other is taking back, and to wait for their move",
    new RegExp(`^${winner.name} is taking moves back .* waits until they have made their move`).test(status), status);
}
for (const page of [alice, bob]) {
  check(`no dialog in ${page.name}'s way`, (await dialog(page)) === null, await dialog(page));
}

/* ---- A message lost on the way ---- */

/*
  Never something the object does: it tells every change to both players, in
  order. But a line can be cut between two of them, and code on either side
  can be wrong, and the page has to come right either way — by seeing that a
  revision was skipped and asking for the whole game again. So the line to
  Bob's page is put through a hand that drops one message: the news of
  Alice's first move. Nothing shows until the next change reaches him, her
  draw offer, one revision too far on; then his board has to catch up with
  both.
*/
let dropping = false;
let dropped = null;
await bob.routeWebSocket(/\/ws\?game=/, (socket) => {
  const server = socket.connectToServer();
  socket.onMessage((message) => server.send(message));
  server.onMessage((message) => {
    let said = null;
    try {
      said = JSON.parse(String(message));
    } catch {
      /* the heartbeat */
    }
    if (dropping && said?.type === "moved") {
      dropping = false;
      dropped = said;
      return;
    }
    socket.send(message);
  });
});
/* Through the hand from here: the page opened again, and a new game. */
await bob.reload();
await challenge(0);
dropping = true;
await move(alice, "e2", "e4");
const lost = await until(async () => ({ ok: dropped !== null }));
check("the news of Alice's move did not reach Bob", lost.ok && (await fen(bob)).startsWith(START), String(await fen(bob)));
await bob.evaluate(() => {
  window.__heard = [];
  const log = console.info;
  console.info = (...args) => {
    window.__heard.push(String(args[0]));
    log(...args);
  };
});
/* By its words alone: the icon beside them is a "1" and a "2" drawn as text. */
await alice.locator("button", { hasText: "Suggest draw" }).click({ timeout: 5000 });
seen = await agreed("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b");
check("the next change shows him one was missed, and his board catches up", seen.ok, JSON.stringify(seen));
const said = await bob.evaluate(() => window.__heard.join("\n"));
check("and says so in the console", /1 change missed; asking for the whole game again/.test(said), said);
check("the offer that came after it reaches him too",
  await bob.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Accept draw"))));
check("asked in the title's colour", (await colourOf(bob, ".invite-question .from-opponent")) === blue,
  String(await colourOf(bob, ".invite-question .from-opponent")));
check("the counters agree", (await counter(alice)) === (await counter(bob)) && /1 of 1/.test(await counter(bob)),
  `${await counter(alice)} / ${await counter(bob)}`);
await move(bob, "e7", "e5");
seen = await agreed("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w");
check("and the game goes on from there", seen.ok, JSON.stringify(seen));
check("Alice is told her offer was played past, in the title's colour",
  /Bob played on rather than take your draw offer/.test((await notice(alice)) ?? "") && (await colourOf(alice, ".invite-notice")) === blue,
  `${await notice(alice)} / ${await colourOf(alice, ".invite-notice")}`);

/* Offered again, and declined: said to her as well. */
await alice.locator("button", { hasText: "Suggest draw" }).click({ timeout: 5000 });
await until(async () => ({ ok: await bob.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Decline"))) }));
await bob.locator(".invite-question button", { hasText: "Decline" }).click({ timeout: 5000 });
const declined = await until(async () => ({ said: await notice(alice), ok: /Bob declined your draw offer/.test((await notice(alice)) ?? "") }));
check("and when it is declined, she is told", declined.ok, String(declined.said));


/* ---- Looking back through the game while it is played ---- */

/* Whose move the flowers by the names say it is, and the line over the board. */
const flowerOpen = (page) =>
  page.evaluate(() => [...document.querySelectorAll(".player-name .player-color-turn")].map((f) => (f.matches(".player-color-w") ? "w" : "b")).join(""));
/* The locks: before each name, and none by the counter, where there was one. */
const locks = (page) =>
  page.evaluate(() => ({
    names: document.querySelectorAll(".player-name .player-who .player-turn-lock").length,
    counter: document.querySelectorAll(".player-name .player-position svg").length,
  }));
const topLine = (page) => page.evaluate(() => [...document.querySelectorAll(".player-name")].map((p) => p.textContent).join(" "));
const key = async (page, name) => {
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press(name);
};
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b";

/* On the other tab, a move arriving while Bob looks back: the game's moves
   stay on his board, and coming back here asks nothing. */
await bob.locator("#tab-game").click();
await key(bob, "ArrowLeft");
await pause(300);
await move(alice, "g1", "f3");
await until(async () => ({ ok: /3 of 3/.test(await counter(bob)) }));
check("a move arriving while Bob looks back on the other tab is added to his game",
  /half-move 1 of 3/.test(await counter(bob)) && (await fen(bob)).startsWith(AFTER_E4), `${await counter(bob)} / ${await fen(bob)}`);
await bob.locator("#tab-match").click();
seen = await agreed("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b");
check("and back on this tab he is caught up to it, with nothing asked", seen.ok, JSON.stringify(seen));

/* On this tab: a step back stays a step back. */
await move(bob, "b8", "c6");
await agreed("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w");
await key(bob, "ArrowLeft");
await key(bob, "ArrowLeft");
await pause(800);
check("Bob steps back on the Live tab, and stays there",
  /half-move 2 of 4/.test(await counter(bob)) && (await fen(bob)).startsWith("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w"),
  `${await counter(bob)} / ${await fen(bob)}`);
check("the flowers say it is still Alice's move", (await flowerOpen(bob)) === "w", await flowerOpen(bob));
let locked = await locks(bob);
check("a lock before each name, and none by the counter", locked.names === 2 && locked.counter === 0, JSON.stringify(locked));

/* And a move arriving meanwhile: on the line, and the turn passed, with the
   board where he left it. */
await move(alice, "f1", "c4");
const passed = await until(async () => ({ open: await flowerOpen(bob), ok: (await flowerOpen(bob)) === "b" }));
check("Alice's move passes the turn to Bob's flower", passed.ok, String(passed.open));
check("and is on the line over his board", /3\. \S?c4/.test(await topLine(bob)), await topLine(bob));
check("while his board stays where he is looking",
  /half-move 2 of 5/.test(await counter(bob)) && (await fen(bob)).startsWith("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w"),
  `${await counter(bob)} / ${await fen(bob)}`);
await key(bob, "Control+ArrowRight");
seen = await agreed("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b");
check("and stepping on brings him to it", seen.ok, JSON.stringify(seen));
locked = await locks(bob);
check("where both locks go, together", locked.names === 0 && locked.counter === 0, JSON.stringify(locked));


/* ---- The list of games counts what the game has ---- */

for (const page of [alice, bob]) {
  const row = await page.evaluate(() => document.querySelector(".saved-game-row.here .saved-game-who")?.textContent ?? "");
  const shown = (await counter(page)).match(/of (\d+)/)?.[1];
  check(`${page.name}'s list counts what the board has`, shown !== undefined && row.includes(`${shown} half-moves`), `${row} / ${shown}`);
}
check("no errors on either page", alice.errors.length + bob.errors.length === 0, [...alice.errors, ...bob.errors].join("\n"));

await browser.close();
process.exit(summary() ? 0 : 1);
