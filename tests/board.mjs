/**
 * The parts that need a browser: how the board's marks come and go.
 *
 *   npm run test:board
 *
 * These are the regressions that kept coming back while the fades were built,
 * and none of them can be seen from node alone — each is a question about what
 * the page does over the next few hundred milliseconds:
 *
 *   - a mark whose shape changes must be seen to change, not to jump;
 *   - a mark that arrives must arrive from nothing;
 *   - a mark that belongs to the position the move creates — the pin it makes,
 *     for one — must not appear until the piece has landed;
 *   - and when it is all over, nothing may be left running or left behind.
 *
 * And one about the panel beside the board, once there are two boards and it
 * goes under them instead: that what it draws keeps its size there.
 *
 * It drives the built app rather than the sources: this is about what is
 * shipped, and the dev server's own machinery has no business in it.
 */
import { check, HELPERS, open, pause, summary } from "./browser.mjs";

/*
   One frame of slack, and no more. The two halves of a crossing are settled in
   the same render, so they are seen in the same frame; anything further apart is
   one of them waiting on a timer, which is the bug this asks about — and a wait
   reads as far longer than it is when the main thread is busy, as it is at the
   start of every move.
 */
const ONE_FRAME = 34;

const PORT = Number(process.env.PORT ?? 4178);
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9422);

/* The app served from `dist`, a browser pointed at it, and the plumbing to
   drive both: all of it in `browser.mjs`, which the rendering suite uses too. */
const lab = await open({ port: PORT, debugPort: DEBUG_PORT });
const page = lab.page;

try {
  await page.send("Page.enable");
  await page.send("Page.navigate", { url: lab.app });
  await pause(2500);

  /*
    A slow move and a long fade, so that everything below has room to be seen.
    Both are settings, and setting them is how a reader would.
  */
  await page.run(`
    ${HELPERS}
    window.__tab("Pieces");
    await sleep(400);
    window.__set("#fade-time", "400");
    window.__set("#move-time", "1.2");
    await sleep(200);
    window.__tab("Lab");
    await sleep(400);
    const flip = document.querySelector("#flip-board");
    if (flip && flip.checked) { flip.click(); await sleep(300); }
    /* Every piece's marks: what is drawn, how large the drawing is, and how
       opaque — enough to tell a fade from a jump. */
    /* Each drawing is stamped the first time it is seen, so that the same
       drawing can be followed from frame to frame. Its identity must not come
       from its shape: what is being asked is whether a shape ever changes
       under a mark that stays, and an identity made of the shape could never
       tell. */
    let stamp = 0;
    window.__marks = () => [...document.querySelectorAll("[class*=attack-side]")].map((g) => {
      if (!g.dataset.mark) g.dataset.mark = String((stamp += 1));
      const wrap = g.parentElement;
      const box = g.getBBox();
      return {
        id: g.dataset.mark,
        area: Math.round(box.width * box.height),
        opacity: +(+getComputedStyle(wrap).opacity).toFixed(2),
        leaving: wrap.classList.contains("mark-going"),
      };
    });
    window.__watch = (ms) => {
      window.__frames = [];
      const t0 = performance.now();
      const tick = (t) => {
        window.__frames.push({
          at: Math.round(t - t0),
          marks: window.__marks(),
          rings: document.querySelectorAll(".pin-marker").length,
          /* Rings still being drawn, as against ones being seen off: a fading
             ring is in the page for as long as its fade lasts. */
          held: document.querySelectorAll(".pin-marker:not(.mark-going)").length,
          flying: document.querySelectorAll(".flying-piece").length,
          /* Ids defined more than once. A renderer refers to its own clip paths
             by id, so a name shared by two marks is not a tidiness matter: SVG
             resolves every reference to whichever came first in the document. */
          shared: (() => {
            const ids = [...document.querySelectorAll("svg [id]")].map((e) => e.id);
            return ids.length - new Set(ids).size;
          })(),
        });
        if (t - t0 < ms) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    return "ready";`);

  const move = async (from, to, settle = 2600) => {
    const a = await page.run(`return window.__sq("${from}");`);
    const b = await page.run(`return window.__sq("${to}");`);
    await page.click(a.cx, a.cy);
    await new Promise((done) => setTimeout(done, 150));
    await page.click(b.cx, b.cy);
    await new Promise((done) => setTimeout(done, settle));
  };

  console.log("\nMarks coming and going\n");

  /*
    1.e4 opens two lines that no piece moved along: the bishop on f1 and the
    queen on d1 draw something new without going anywhere.
  */
  await page.run(`window.__watch(2600); return "watching";`);
  await move("e2", "e4");
  const frames = await page.run(`return window.__frames;`);

  /* A mark that changes shape must be a different mark, crossing with the one
     it replaces — never the same mark redrawn in a new shape. */
  const jumps = [];
  for (let i = 1; i < frames.length; i += 1) {
    for (const mark of frames[i].marks) {
      const before = frames[i - 1].marks.find((m) => m.id === mark.id);
      if (before !== undefined && before.area !== mark.area) {
        jumps.push({ at: frames[i].at, from: before.area, to: mark.area });
      }
    }
  }
  check(
    "no mark changes its shape where it stands",
    jumps.length === 0,
    JSON.stringify(jumps.slice(0, 3))
  );

  /*
    A mark that is replaced — one piece drawing a new shape as a line opens —
    must begin to go as its replacement begins to arrive. The two are halves of
    one crossing. Made to wait its turn, the old mark stood at full strength
    over the squares the new one shares with it, so only the far end of the new
    line was seen to fade in and the line as a whole read as arriving late.
  */
  const landed = frames.findIndex(
    (frame, i) => i > 0 && frames[i - 1].flying > 0 && frame.flying === 0
  );
  const known = new Set(
    frames.slice(0, landed).flatMap((frame) => frame.marks.map((m) => m.id))
  );
  const arrives = frames
    .slice(landed)
    .find((frame) => frame.marks.some((m) => !m.leaving && !known.has(m.id)));
  const departs = frames.slice(landed).find((frame) => frame.marks.some((m) => m.leaving));
  check(
    "a replaced mark starts to go as its replacement starts to arrive",
    landed > 0 &&
      arrives !== undefined &&
      departs !== undefined &&
      departs.at - arrives.at <= ONE_FRAME,
    `landed at ${frames[landed]?.at}, arriving ${arrives?.at}, leaving ${departs?.at}`
  );

  /*
    While one mark replaces another, both are on the board, and each must refer
    to its own clip paths. Sharing ids, the arriving ray was clipped to the
    departing one's extent — drawn at the right opacity the whole way down, and
    cut back to the square the line used to end at, so a bishop's newly opened
    diagonal stayed invisible until the old mark was removed and then appeared
    whole. Nothing in the opacities showed it.
  */
  const shared = frames.filter((frame) => frame.shared > 0);
  check(
    "marks that are crossing never share an id",
    shared.length === 0,
    shared.length === 0 ? "" : `${shared[0].shared} shared at ${shared[0].at}ms, ${shared.length} frames`
  );

  /* The lines the move opened have to arrive from nothing. The bishop's and the
     queen's new marks are the largest on the board; whatever else arrives, they
     must have been drawn part-way at some point. */
  const partway = frames.some((frame) =>
    frame.marks.some((mark) => mark.area > 60000 && mark.opacity > 0 && mark.opacity < 0.9)
  );
  check(
    "the lines a move opens fade in rather than appearing",
    partway,
    `largest mark seen: ${Math.max(...frames.flatMap((f) => f.marks.map((m) => m.area)))}`
  );

  /* Nothing is left over: no mark still on its way out, and no animation still
     running, once the board has settled. */
  const after = await page.run(`
    return { going: document.querySelectorAll(".mark-going").length,
             running: document.getAnimations().length,
             marks: document.querySelectorAll("[class*=attack-side]").length,
             men: document.querySelectorAll(".piece-layer text").length };`);
  check(
    "nothing is left fading when the move is over",
    after.going === 0 && after.running === 0,
    JSON.stringify(after)
  );
  check(
    "and every man on the board is drawing its marks",
    after.marks === after.men,
    JSON.stringify(after)
  );

  console.log("\nWhat a move creates waits for the piece to land\n");

  /*
    1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 — the bishop pins the knight as it lands. The
    ring belongs to the position the move makes, and must not be seen before the
    piece is there.
  */
  /* From the beginning again: the section above left a move on the board, and
     this opening only pins where the d-pawn has gone two squares. */
  await page.run(`
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent.includes("Reset to initial position"))
      .click();
    await sleep(1200);
    return "reset";`);
  for (const [from, to] of [
    ["d2", "d4"],
    ["g8", "f6"],
    ["c2", "c4"],
    ["e7", "e6"],
    ["b1", "c3"],
  ]) {
    await move(from, to);
  }
  const before = await page.run(`return document.querySelectorAll(".pin-marker").length;`);
  const standing = await page.run(`
    const moves = document.querySelector("#moves");
    return moves.options[moves.selectedIndex].textContent.trim() + " | " +
      document.querySelector("#fen").value.split(" ")[0];`);
  /* Asked of the position rather than of how the move is written: the pin
     depends on the d-pawn having gone two squares and on nothing standing
     between b4 and e1. */
  check(
    "the opening that sets up the pin was played",
    standing.includes("2PP4") && standing.includes("2N5"),
    standing
  );
  await page.run(`window.__watch(2600); return "watching";`);
  await move("f8", "b4");
  const pinFrames = await page.run(`return window.__frames;`);
  const flying = pinFrames.filter((frame) => frame.flying > 0);
  const ringWhileFlying = flying.some((frame) => frame.rings > before);
  check("no ring is drawn while the bishop is still travelling", !ringWhileFlying);
  check(
    "and one is drawn once it has landed",
    pinFrames.at(-1).rings > before,
    `${before} -> ${pinFrames.at(-1).rings}`
  );

  console.log("\nA piece in the air holds nothing\n");

  /*
    The bishop that pinned the knight now leaves the diagonal, from the position
    the section above left on the board. Its rays and its wash go as it takes
    off, because a piece in the air attacks nothing — and the ring it was
    holding has to go with them. It stood there for the whole journey once and
    was released on landing, a beat after everything else the bishop was doing
    had gone.
  */
  /* A quiet move first, since it is White to play there and the bishop is
     Black's. h3 touches nothing on the diagonal the pin runs along. */
  await move("h2", "h3");
  await page.run(`window.__watch(2600); return "watching";`);
  await move("b4", "e7");
  const released = await page.run(`return window.__frames;`);
  const airborne = released.filter((frame) => frame.flying > 0);
  check(
    "the ring is let go as the pinning piece takes off",
    airborne.length > 0 && airborne.every((frame) => frame.held === 0),
    `${airborne.filter((frame) => frame.held > 0).length} of ${airborne.length} frames in the air still hold it`
  );
  check(
    "and nothing is left of it once the move is over",
    released.at(-1).rings === 0,
    `${released.at(-1).rings} rings`
  );

  console.log("\nWhat is taken stands until it is reached\n");

  /*
    1.e4 d5 2.exd5. The pawn on d5 is on the board for the whole of the journey
    towards it — that is what makes the arrival read as a capture — and so are
    its marks. They vanished and came back at the start of every capture once:
    the position committed before the flight that holds it back, and for one
    render, painted or not, the board was the board after the move.
  */
  await page.run(`
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent.includes("Reset to initial position"))
      .click();
    await sleep(1200);
    return "reset";`);
  for (const [from, to] of [
    ["e2", "e4"],
    ["d7", "d5"],
  ]) {
    await move(from, to);
  }
  await page.run(`window.__watch(2600); return "watching";`);
  await move("e4", "d5");
  const capture = await page.run(`return window.__frames;`);

  const inTheAir = capture.filter((frame) => frame.flying > 0);
  /* Whatever was already on its way out when the piece took off may go on
     going: the mover's own marks left when it was picked up. What may not
     happen is a mark starting to leave while the piece is still in the air. */
  const goingAtFirst = new Set(
    (inTheAir[0]?.marks ?? []).filter((mark) => mark.leaving).map((mark) => mark.id)
  );
  const startedLeaving = inTheAir
    .flatMap((frame) => frame.marks.filter((mark) => mark.leaving).map((mark) => mark.id))
    .filter((id) => !goingAtFirst.has(id));
  check(
    "the marks of a piece being taken stay while the piece is still travelling",
    inTheAir.length > 0 && startedLeaving.length === 0,
    `${inTheAir.length} frames in the air, ${new Set(startedLeaving).size} marks left during them`
  );

  console.log("\nPlaying on either of two boards\n");

  /*
    After 1. Nf3 Nf6, White to move: a move clicked and a move dragged on the
    right board, a drag from one board let go over the other,
    and the left board still taking moves after it all.
  */
  await page.run(`${HELPERS}
    document.querySelector("#tab-manage").click(); await sleep(400);
    const two = document.querySelector("#two-board-mode"); if (!two.checked) two.click(); await sleep(700);
    window.__tab("Lab"); await sleep(300);
    [...document.querySelectorAll("button")].find((b) => /import game/i.test(b.textContent)).click(); await sleep(400);
    const box = document.querySelector("#pgn-text");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box,
      '1. Nf3 Nf6 *\\n');
    box.dispatchEvent(new Event("input", { bubbles: true })); await sleep(200);
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load").click(); await sleep(900);
    /* At the last position, where a move plays on rather than starting a line. */
    const moves = document.querySelector(".moves-select");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(moves, "0");
    moves.dispatchEvent(new Event("change", { bubbles: true })); await sleep(900);
    /* Where a square is on one board or the other: 0 the left, 1 the right. */
    window.__on = (board, name) => {
      const rects = [...document.querySelectorAll(".board-holder svg")[board].querySelectorAll(".square-layer rect")];
      const xs = rects.map((r) => +r.getAttribute("x"));
      const x0 = Math.min(...xs), step = (Math.max(...xs) - x0) / 7;
      const y0 = Math.min(...rects.map((r) => +r.getAttribute("y")));
      const hit = rects.find((r) =>
        Math.abs(+r.getAttribute("x") - (x0 + (name.charCodeAt(0) - 97) * step)) < 1 &&
        Math.abs(+r.getAttribute("y") - (y0 + (8 - +name[1]) * step)) < 1);
      const b = hit.getBoundingClientRect();
      return { cx: Math.round(b.x + b.width / 2), cy: Math.round(b.y + b.height / 2) };
    };
    window.__played = () => document.querySelector(".moves-select").options.length - 1;
    window.__marked = () => [...document.querySelectorAll(".board-holder svg")].map((svg) => svg.querySelectorAll(".drag-target").length);
    return "ok";`);
  const at = (board, square) => page.run(`return window.__on(${board}, "${square}");`);
  const played = async () => Number(await page.run(`return String(window.__played());`));
  const marked = async () => JSON.parse(await page.run(`return JSON.stringify(window.__marked());`));
  /* Pressed on one square and let go on another, the pointer moving between. */
  const drag = async (a, b) => {
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: a.cx, y: a.cy, button: "left", buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i += 1) {
      await page.send("Input.dispatchMouseEvent", {
        type: "mouseMoved", button: "left", buttons: 1,
        x: Math.round(a.cx + ((b.cx - a.cx) * i) / 10), y: Math.round(a.cy + ((b.cy - a.cy) * i) / 10),
      });
      await pause(20);
    }
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.cx, y: b.cy, button: "left", buttons: 0, clickCount: 1 });
    await pause(1500);
  };

  const atFirst = await played();
  const e2 = await at(1, "e2");
  await page.click(e2.cx, e2.cy);
  await pause(300);
  const picked = await marked();
  check("a piece clicked on the right board is picked up there, and only there",
    picked[0] === 0 && picked[1] === 2, JSON.stringify(picked));
  /* One piece in hand at a time: picked out on the other board, the first
     one is let go, whichever way round. */
  const d2 = await at(0, "d2");
  await page.click(d2.cx, d2.cy);
  await pause(300);
  const switched = await marked();
  await page.click(e2.cx, e2.cy);
  await pause(300);
  const back = await marked();
  check("a piece picked out on the other board lets go of the first one, whichever board it is",
    switched[0] === 2 && switched[1] === 0 && back[0] === 0 && back[1] === 2,
    `left then right: ${JSON.stringify(switched)} ${JSON.stringify(back)}`);
  const e4 = await at(1, "e4");
  await page.click(e4.cx, e4.cy);
  await pause(1500);
  check("and a second click there plays the move", (await played()) === atFirst + 1, `${await played()} played`);

  await drag(await at(1, "b8"), await at(1, "c6"));
  check("a piece dragged on the right board is played", (await played()) === atFirst + 2, `${await played()} played`);

  await drag(await at(0, "b1"), await at(1, "c3"));
  check("a piece dragged off the left board and let go over the right one is not played",
    (await played()) === atFirst + 2, `${await played()} played`);
  await drag(await at(1, "b1"), await at(0, "c3"));
  const across = await marked();
  check("nor the other way round, and neither board is left with a piece picked up",
    (await played()) === atFirst + 2 && across[0] === 0 && across[1] === 0,
    `${await played()} played, marks ${JSON.stringify(across)}`);

  await drag(await at(0, "b1"), await at(0, "c3"));
  check("while the left board takes a move as it always did", (await played()) === atFirst + 3, `${await played()} played`);

  console.log("\nThe panel under two boards\n");

  /*
    The colour balance choosers are squares sized from the height of the frame
    they stand in, and that height is given from outside. Beside the board the
    column runs to the board's foot and there is plenty; under two boards the
    column was only as tall as its contents, and the squares went to nothing,
    with their words piled on one another.
  */
  const balance = JSON.parse(await page.run(`
    document.querySelector("#tab-manage").click(); await sleep(400);
    const two = document.querySelector("#two-board-mode"); if (!two.checked) two.click(); await sleep(700);
    document.querySelector("#tab-balance").click(); await sleep(700);
    const squares = [...document.querySelectorAll(".intensity-box")].map((box) => {
      const r = box.getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height)];
    });
    document.querySelector("#tab-manage").click(); await sleep(400);
    if (two.checked) two.click(); await sleep(700);
    return JSON.stringify({ squares });`));
  check(
    "the colour balance choosers keep their size under two boards",
    balance.squares.length === 2 && balance.squares.every(([w, h]) => w >= 150 && w === h),
    JSON.stringify(balance.squares)
  );

  page.close();
} catch (error) {
  check("the browser tests could not run", false, error.message);
}

lab.stop();
process.exit(summary() ? 0 : 1);
