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
import { check, HELPERS, open, openAsBefore, pause, summary } from "./browser.mjs";

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

  console.log("\nHow a new browser opens\n");
  /* Two boards: the main one on the right in the blue and orange preset, with
     the attacks — which no longer calls itself the default — and the classic
     board on the left in Classic green. */
  const fresh = JSON.parse(await page.run(`${HELPERS}
    document.querySelector("#tab-manage").click(); await sleep(500);
    const classic = document.querySelector("#two-board-preset");
    const [main, other] = [...document.querySelectorAll(".board-holder svg")];
    return JSON.stringify({
      current: document.querySelector('[aria-current="true"]')?.textContent ?? null,
      two: document.querySelector("#two-board-mode").checked,
      classic: classic?.value ?? null,
      label: document.querySelector('label[for="two-board-preset"]')?.textContent ?? null,
      names: [...(classic?.options ?? [])].map((o) => o.textContent),
      mainOnTheRight: main !== undefined && other !== undefined && main.getBoundingClientRect().x > other.getBoundingClientRect().x,
      marks: [main?.querySelectorAll(".attack-layer *").length ?? 0, other?.querySelectorAll(".attack-layer *").length ?? 0],
    });`));
  check("a new browser opens on two boards, the main one in the blue and orange preset, no longer called the default",
    fresh.two === true && fresh.current === "Blue - orange - with attacks" && !fresh.names.some((name) => /default/i.test(name)),
    JSON.stringify(fresh));
  check("and the classic board, Classic green, on the left of it, with nothing drawn over its squares",
    fresh.classic === "Classic green" && fresh.label === "Settings for the classic board" && fresh.mainOnTheRight &&
      fresh.marks[0] > 0 && fresh.marks[1] === 0,
    JSON.stringify(fresh));
  await openAsBefore(page);

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

  console.log("\nWhat a pawn becomes\n");

  /*
    A pawn reaching the last rank asks what it becomes — four pieces, centred
    on the square it is reaching and just off the board there — and the move
    waits for the answer. A press anywhere else takes it back and does nothing
    more; Escape takes it back too; and a knight chosen is a knight played.
  */
  const promotionState = (board = 0, square = "e8") => page.run(`const box = document.querySelector(".promotion-chooser:popover-open");
    const s = document.querySelectorAll(".board-holder svg")[${board}].querySelector('.square-layer [data-square="${square}"]').getBoundingClientRect();
    const r = box?.getBoundingClientRect();
    return JSON.stringify({
      open: box !== null,
      pieces: box ? [...box.querySelectorAll(".promotion-choice")].map((c) => c.getAttribute("aria-label")) : [],
      centre: r === undefined ? null : Math.round(r.left + r.width / 2 - (s.left + s.width / 2)),
      over: r === undefined ? null : Math.round(s.top - r.bottom),
      closeButton: box?.querySelector(".info-close, .promotion-close") != null,
      /* The list sets its numbers off with no-break spaces. */
      played: document.querySelector(".moves-select").options[0].textContent.replace(/\\s+/g, " ").trim(),
      marked: window.__marked ? window.__marked() : null,
    });`);
  const promotionAt = (two) => page.run(`${HELPERS}
    document.querySelector("#tab-manage").click(); await sleep(400);
    const toggle = document.querySelector("#two-board-mode"); if (toggle.checked !== ${two}) toggle.click(); await sleep(700);
    window.__tab("Lab"); await sleep(300);
    __set("#fen", "8/4P3/8/8/8/8/k7/4K3 w - - 0 1"); await sleep(800); window.scrollTo(0, 0); await sleep(200);
    return "ok";`);
  const escapeKey = async () => {
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await pause(400);
  };
  await promotionAt(false);
  const pawn = await at(0, "e7");
  const queening = await at(0, "e8");
  const king = await at(0, "e1");
  await page.click(pawn.cx, pawn.cy);
  await pause(200);
  await page.click(queening.cx, queening.cy);
  await pause(400);
  const asked = JSON.parse(await promotionState());
  check("a pawn played to the last rank asks what it becomes, and waits",
    asked.open && JSON.stringify(asked.pieces) === JSON.stringify(["Queen", "Rook", "Bishop", "Knight"]) && asked.played === "start",
    JSON.stringify(asked));
  check("centred on the square it is reaching, just off the board there",
    asked.centre !== null && Math.abs(asked.centre) <= 1 && asked.over >= 0 && asked.over <= 8,
    `${asked.centre} px off centre, ${asked.over} px above the square`);
  check("with nothing to close it by but a choice, or a press elsewhere", asked.closeButton === false);
  await page.click(king.cx, king.cy);
  await pause(500);
  const pressedAway = JSON.parse(await promotionState());
  check("a press elsewhere takes the move back, and picks nothing up",
    !pressedAway.open && pressedAway.played === "start" && pressedAway.marked.every((count) => count === 0),
    JSON.stringify(pressedAway));
  await page.click(pawn.cx, pawn.cy);
  await pause(200);
  await page.click(queening.cx, queening.cy);
  await pause(400);
  await escapeKey();
  const withdrawn = JSON.parse(await promotionState());
  check("so does Escape", !withdrawn.open && withdrawn.played === "start", JSON.stringify(withdrawn));
  await drag(pawn, queening);
  const draggedThere = JSON.parse(await promotionState());
  check("dragged there, it asks too", draggedThere.open && draggedThere.played === "start", JSON.stringify(draggedThere));
  await page.run(`document.querySelector('.promotion-chooser:popover-open .promotion-choice[aria-label="Knight"]').click(); await sleep(1500); return "ok";`);
  const knighted = JSON.parse(await promotionState());
  check("and a knight chosen is a knight played", !knighted.open && knighted.played === "1. e8=N", JSON.stringify(knighted));

  /* Played on the right-hand board, it stands at that board's square. */
  await promotionAt(true);
  const rightPawn = await at(1, "e7");
  const rightQueening = await at(1, "e8");
  await page.click(rightPawn.cx, rightPawn.cy);
  await pause(200);
  await page.click(rightQueening.cx, rightQueening.cy);
  await pause(400);
  const onRight = JSON.parse(await promotionState(1));
  check("played on the right-hand board, it stands at that board's square",
    onRight.open && onRight.centre !== null && Math.abs(onRight.centre) <= 1 && onRight.over >= 0 && onRight.over <= 8,
    JSON.stringify(onRight));
  await escapeKey();
  await promotionAt(false);

  console.log("\nThe keyboard after a dialog\n");

  /*
    A dialog opened and closed from the keyboard leaves the arrows the game's:
    the browser puts the focus back on the button that opened it, and a button
    the keyboard is on would otherwise have them, so that the reader had to
    click somewhere before → and ← stepped through the game again.
  */
  const press = async (key, code, keyCode) => {
    /* Enter presses a button only with its character sent along. */
    const text = key === "Enter" ? { text: "\r" } : {};
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, ...text });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
    await pause(400);
  };
  await page.run(`${HELPERS}
    window.__tab("Lab"); await sleep(300);
    [...document.querySelectorAll("button")].find((b) => /import game/i.test(b.textContent)).click(); await sleep(400);
    const box = document.querySelector("#pgn-text");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, "1. e4 e5 2. Nf3 *");
    box.dispatchEvent(new Event("input", { bubbles: true })); await sleep(200);
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load").click(); await sleep(900);
    return "ok";`);
  /* Onto the import button by the keyboard, as a reader working by keys would be. */
  await press("Tab", "Tab", 9);
  await page.run(`[...document.querySelectorAll("button")].find((b) => /import game/i.test(b.textContent)).focus(); return "ok";`);
  await press("Enter", "Enter", 13);
  const opened = await page.run(`return String(document.querySelector("dialog[open]") !== null);`);
  await press("Escape", "Escape", 27);
  const listBefore = await page.run(`return String(document.querySelector(".moves-select").selectedIndex);`);
  await press("ArrowLeft", "ArrowLeft", 37);
  const listAfter = await page.run(`return String(document.querySelector(".moves-select").selectedIndex);`);
  check("a dialog opened and closed by the keyboard leaves the arrows stepping through the game",
    opened === "true" && Number(listAfter) === Number(listBefore) + 1,
    `dialog opened: ${opened}; moves list at ${listBefore}, then ${listAfter}`);

  console.log("\nThe board editor\n");

  /*
    Opened beside the FEN, on the position on the board, and cleared to the
    two kings by the palette's Clear: men from the palette put down by a
    click and a click, or dragged on; a pawn refused on the last rank; the move
    given to the other side by the flower, and the signal turning red with the
    reason when that leaves a king in check; the eraser and a drag off the
    board taking men away; and Done on a position no game reaches giving back
    the ordinary start.
  */
  const fenNow = () => page.run(`return document.querySelector("#fen").value;`);
  const paletteTool = (label) => page.run(`const b = document.querySelector('.board-editor-palette [aria-label="${label}"]').getBoundingClientRect();
    return { cx: Math.round(b.x + b.width / 2), cy: Math.round(b.y + b.height / 2) };`);
  const tap = async (point) => {
    await page.click(point.cx, point.cy);
    await pause(400);
  };
  const openEditorButton = `document.querySelector(".editor-button").click(); await sleep(700);`;
  await page.run(`${HELPERS}
    window.__tab("Lab"); await sleep(300); window.scrollTo(0, 0);
    __set("#fen", "8/8/8/8/8/2k5/8/4K3 b - - 0 1"); await sleep(800);
    ${openEditorButton}
    return "ok";`);
  const editorOpened = JSON.parse(await page.run(`return JSON.stringify({ fen: document.querySelector("#fen").value, asked: document.querySelector("dialog[open]") !== null,
    palette: document.querySelector(".board-editor-palette") !== null && document.querySelectorAll(".board-editor-palette .board-editor-man").length === 10 });`));
  check("on a board with one position, the editor opens on it without asking, a palette of five men a side in the bars' place",
    editorOpened.fen === "8/8/8/8/8/2k5/8/4K3 b - - 0 1" && !editorOpened.asked && editorOpened.palette, JSON.stringify(editorOpened));
  await page.run(`document.querySelector(".board-editor-clear").click(); await sleep(500); return "ok";`);
  check("and Clear takes it back to the two kings, White to move", (await fenNow()) === "4k3/8/8/8/8/8/8/4K3 w - - 0 1", await fenNow());
  await tap(await paletteTool("White knight"));
  await tap(await at(0, "d4"));
  await tap(await at(0, "f5"));
  check("a man chosen is put down with a click, as many times as clicked",
    (await fenNow()) === "4k3/8/8/5N2/3N4/8/8/4K3 w - - 0 1", await fenNow());
  await tap(await paletteTool("White knight"));
  await drag(await paletteTool("Black queen"), await at(0, "e2"));
  const queened = await fenNow();
  check("or dragged from the palette onto a square", queened === "4k3/8/8/5N2/3N4/8/4q3/4K3 w - - 0 1", queened);
  await tap(await paletteTool("White pawn"));
  await tap(await at(0, "a8"));
  check("a pawn is not put on the last rank", (await fenNow()) === queened, await fenNow());
  await tap(await paletteTool("White pawn"));
  const signalBefore = await page.run(`return document.querySelector(".board-editor-signal").className;`);
  await page.run(`document.querySelector(".board-editor-turn").click(); await sleep(400); return "ok";`);
  const turned = await fenNow();
  const signal = JSON.parse(await page.run(`const s = document.querySelector(".board-editor-signal"); return JSON.stringify({ cls: s.className, why: s.title });`));
  check("the flower gives the move to the other side",
    turned === "4k3/8/8/5N2/3N4/8/4q3/4K3 b - - 0 1", turned);
  check("and the signal goes red, saying why, when that leaves a king in check",
    /legal/.test(signalBefore) && !/illegal/.test(signalBefore) && /illegal/.test(signal.cls) && signal.why === "White is in check, with Black to move.",
    `${signalBefore} -> ${signal.cls}: ${signal.why}`);
  await tap(await paletteTool("Take a piece off the board"));
  await tap(await at(0, "e2"));
  await tap(await at(0, "e1"));
  check("the eraser takes a man off, and never a king",
    (await fenNow()) === "4k3/8/8/5N2/3N4/8/8/4K3 b - - 0 1", await fenNow());
  await tap(await paletteTool("Take a piece off the board"));
  await drag(await at(0, "d4"), { cx: 700, cy: 20 });
  check("a man dragged off the board is taken off too", (await fenNow()) === "4k3/8/8/5N2/8/8/8/4K3 b - - 0 1", await fenNow());
  /* A king taken up with something chosen in the palette: the choice is let
     go of, and the king moved. */
  await tap(await paletteTool("White rook"));
  await drag(await at(0, "e1"), await at(0, "e7"));
  const kingMoved = JSON.parse(await page.run(`return JSON.stringify({ fen: document.querySelector("#fen").value,
    chosen: [...document.querySelectorAll(".board-editor-tool-chosen")].map((b) => b.getAttribute("aria-label")).join(",") });`));
  /* The pointer lets go of a choice; Undo and Redo take a change back and
     make it again, from the palette or by the keys every editor uses. */
  await tap(await paletteTool("White rook"));
  await tap(await paletteTool("Move pieces"));
  const chosenAfterArrow = await page.run(`return [...document.querySelectorAll(".board-editor-tool-chosen")].map((b) => b.getAttribute("aria-label")).join(",");`);
  check("the pointer in the palette lets go of what was chosen", chosenAfterArrow === "Move pieces", chosenAfterArrow);
  const beforeUndo = await fenNow();
  await tap(await paletteTool("Undo"));
  const undone = await fenNow();
  await tap(await paletteTool("Redo"));
  const redone = await fenNow();
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, modifiers: 2 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, modifiers: 2 });
  await pause(400);
  const undoneByKey = await fenNow();
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "y", code: "KeyY", windowsVirtualKeyCode: 89, modifiers: 2 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "y", code: "KeyY", windowsVirtualKeyCode: 89, modifiers: 2 });
  await pause(400);
  check("Undo takes the last change back, and Redo makes it again — by the palette, and by Ctrl+Z and Ctrl+Y",
    undone !== beforeUndo && redone === beforeUndo && undoneByKey === undone && (await fenNow()) === beforeUndo,
    `${beforeUndo} / ${undone} / ${redone} / ${undoneByKey}`);
  check("a king pressed on with a man chosen lets the choice go, and is dragged",
    kingMoved.fen === "4k3/4K3/8/5N2/8/8/8/8 b - - 0 1" && kingMoved.chosen === "Move pieces", JSON.stringify(kingMoved));
  await page.run(`document.querySelector(".editor-button").click(); await sleep(700); return "ok";`);
  const finished = JSON.parse(await page.run(`return JSON.stringify({ fen: document.querySelector("#fen").value, palette: document.querySelector(".board-editor-palette") !== null });`));
  check("Done on a position no game reaches gives back the ordinary start, and the bars",
    finished.fen === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" && finished.palette === false, JSON.stringify(finished));

  /*
    While it is open, only the position, Done, and the two ways of taking the
    position away — exported, or shared — answer; the rest of the Lab is
    greyed out. What is exported is the position alone: a game of no moves
    from its FEN, which reads back in as that position.
  */
  const editingState = JSON.parse(await page.run(`${HELPERS}
    ${openEditorButton}
    const button = (pattern) => [...document.querySelectorAll("#panel-game button")].find((b) => pattern.test(b.textContent.trim()));
    const disabled = {
      flip: document.querySelector("#flip-board").disabled,
      reset: button(/^Reset to initial position$/).disabled,
      play: [...document.querySelectorAll("#panel-game button")].find((b) => b.textContent.includes("Play")).disabled,
      period: document.querySelector("#play-period").disabled,
      moves: document.querySelector(".moves-select").disabled,
      keep: document.querySelector("#keep-variations").disabled,
      importing: button(/^Import game/).disabled,
      stashAs: button(/^Stash game as/).disabled,
      stashed: document.querySelector("#stashed-game").disabled,
    };
    const open = {
      fen: !document.querySelector("#fen").disabled && !document.querySelector("#fen").readOnly,
      done: !document.querySelector(".editor-button").disabled,
      exporting: !button(/^Export game/).disabled,
      share: !button(/Share game/).disabled,
    };
    button(/^Export game/).click(); await sleep(500);
    const text = document.querySelector("dialog[open] .pgn-text").value;
    document.querySelector("dialog[open] .dialog-close").click(); await sleep(300);
    document.querySelector(".editor-button").click(); await sleep(600);
    return JSON.stringify({ disabled, open, text });`));
  check("while the board is set up, the rest of the Lab is greyed out",
    Object.values(editingState.disabled).every((value) => value === true), JSON.stringify(editingState.disabled));
  check("but the position, Done, Export and Share still answer",
    Object.values(editingState.open).every((value) => value === true), JSON.stringify(editingState.open));
  check("and the position is exported as a game of no moves from its FEN",
    /\[SetUp "1"\]/.test(editingState.text) && /\[FEN "rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR w KQkq - 0 1"\]/.test(editingState.text) === false &&
      !/\d\./.test(editingState.text.split("\n\n").pop()),
    editingState.text.replace(/\n/g, " | "));
  const POSITION_PGN = '[SetUp "1"]\n[FEN "8/8/8/8/8/2k5/8/4K3 b - - 0 1"]\n\n*\n';
  const importedBack = JSON.parse(await page.run(`${HELPERS}
    [...document.querySelectorAll("button")].find((b) => /import game/i.test(b.textContent)).click(); await sleep(400);
    const box = document.querySelector("#pgn-text");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, ${JSON.stringify(POSITION_PGN)});
    box.dispatchEvent(new Event("input", { bubbles: true })); await sleep(200);
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load").click(); await sleep(900);
    return JSON.stringify({ fen: document.querySelector("#fen").value, open: document.querySelector("dialog[open]") !== null });`));
  check("which reads back in as that position",
    importedBack.fen === "8/8/8/8/8/2k5/8/4K3 b - - 0 1" && !importedBack.open, JSON.stringify(importedBack));

  /* A game on the board as it came: opened on its position without a word. */
  const loadGame = `
    [...document.querySelectorAll("button")].find((b) => /import game/i.test(b.textContent)).click(); await sleep(400);
    const box = document.querySelector("#pgn-text");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, "1. e4 e5 *");
    box.dispatchEvent(new Event("input", { bubbles: true })); await sleep(200);
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load").click(); await sleep(900);`;
  const untouched = JSON.parse(await page.run(`${HELPERS}
    ${loadGame}
    ${openEditorButton}
    const result = { asked: document.querySelector("dialog[open]") !== null, fen: document.querySelector("#fen").value, palette: document.querySelector(".board-editor-palette") !== null };
    document.querySelector(".editor-button").click(); await sleep(600);
    return JSON.stringify(result);`));
  check("a game on the board as it came opens the editor on its position without asking",
    !untouched.asked && untouched.palette && untouched.fen === "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w - - 0 1",
    JSON.stringify(untouched));

  /* One with a move of the reader's own in it: asked first, and opened either way. */
  await page.run(`${HELPERS} ${loadGame} return "ok";`);
  await tap(await at(0, "g1"));
  await tap(await at(0, "f3"));
  await pause(800);
  const dirty = JSON.parse(await page.run(`${HELPERS}
    ${openEditorButton}
    const asked = document.querySelector("dialog[open] .stash-prompt")?.textContent ?? null;
    [...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Don't stash").click(); await sleep(700);
    const result = { asked, fen: document.querySelector("#fen").value, palette: document.querySelector(".board-editor-palette") !== null };
    document.querySelector(".editor-button").click(); await sleep(600);
    return JSON.stringify(result);`));
  check("one with a move of the reader's own asks whether to stash it, and opens on its position",
    dirty.asked === "Stash current game?" && dirty.palette &&
      dirty.fen === "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b - - 0 1",
    JSON.stringify(dirty));

  console.log("\nExplanations behind an (i)\n");

  /*
    Nothing shown until the (i) is clicked, and nothing put away but by the
    box's own close button: not a click elsewhere, not a key. Beside its (i)
    rather than in the middle of the window, and one at a time.
  */
  const visibleInfo = `[...document.querySelectorAll(".info-button")].filter((b) => b.getBoundingClientRect().width > 0)`;
  const openBoxes = () => page.run(`return String(document.querySelectorAll(".info-box:popover-open").length);`);
  const centre = async (index) => JSON.parse(await page.run(`${HELPERS}
    window.__tab("Pieces"); await sleep(400);
    ${visibleInfo}[${index}].scrollIntoView({ block: "center" }); await sleep(300);
    const r = ${visibleInfo}[${index}].getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), bottom: r.bottom, left: r.left });`));
  const first = await centre(0);
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: first.x, y: first.y });
  await pause(1200);
  check("hovering an (i) shows nothing", (await openBoxes()) === "0", await openBoxes());
  await page.click(first.x, first.y);
  await pause(300);
  const shown = JSON.parse(await page.run(`const box = document.querySelector(".info-box:popover-open");
    if (!box) return JSON.stringify(null);
    const r = box.getBoundingClientRect(), c = box.querySelector(".info-close").getBoundingClientRect();
    return JSON.stringify({ top: r.top, bottom: r.bottom, left: r.left, width: r.width, close: [c.width, c.height], text: box.textContent.trim().slice(0, 40) });`));
  check("clicking it opens its explanation", shown !== null && shown.text.length > 10, JSON.stringify(shown));
  check("beside the (i), not in the middle of the window",
    shown !== null && Math.abs(shown.top - (first.bottom + 8)) < 2 && Math.abs(shown.left - (first.left - 8)) < 2,
    shown === null ? "none" : `box at ${shown.left},${shown.top}; (i) ends at ${first.left},${first.bottom}`);
  check("with a close button big enough to hit without aiming",
    shown !== null && shown.close[0] >= 32 && shown.close[1] >= 32, JSON.stringify(shown?.close));
  await page.click(300, 500);
  await pause(300);
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await pause(300);
  check("a click elsewhere and Escape leave it open", (await openBoxes()) === "1", await openBoxes());
  const second = await centre(3);
  await page.click(second.x, second.y);
  await pause(300);
  const which = await page.run(`const open = [...document.querySelectorAll(".info-box:popover-open")];
    return JSON.stringify(open.map((box) => document.querySelector('[aria-controls="' + box.id + '"]') === ${visibleInfo}[3]));`);
  check("opening another closes the first", which === "[true]", which);
  const close = JSON.parse(await page.run(`const r = document.querySelector(".info-box:popover-open .info-close").getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });`));
  await page.click(close.x, close.y);
  await pause(300);
  check("and its close button puts it away", (await openBoxes()) === "0", await openBoxes());

  page.close();
} catch (error) {
  check("the browser tests could not run", false, error.message);
}

lab.stop();
process.exit(summary() ? 0 : 1);
