/**
 * What the board actually looks like, at named moments of a named move.
 *
 *   npm run test:e2e-rendering              check against the recorded picture
 *   npm run test:e2e-rendering -- --update  record it afresh
 *
 * Every other test here asks the page what it means to draw — opacities, class
 * names, animation clocks — and a whole class of bug lives underneath that.
 * Marks of one piece once shared the ids of their own clip paths, so a bishop's
 * newly opened diagonal was drawn at exactly the right opacity from the moment
 * it should have been, and clipped away to nothing until the mark it replaced
 * left the page half a second later. Every assertion passed while the screen
 * showed the ray springing out of nowhere. Only a photograph could catch it.
 *
 * So this is a photograph, taken by the compositor and timed by it:
 *
 *   given   the opening position, a fade of 1000ms, a move of 2.5s
 *   when    e2-e4 is played
 *   then    at 3.05s after the move begins, the stripe crossing c4 is <colour>,
 *           and the corner of c4 beside it is <colour>
 *           at 4.01s they are <colour> and <colour>, and so on
 *
 * Nothing here is written in pixels. A place to look is a square, a direction
 * along which that square's ray runs, and a patch measured in squares — the
 * stripe's own width, which is the reader's setting and is read from the
 * settings rather than copied. So the same test says the same thing on any
 * screen, and stays true when the board is resized or the stripes are made
 * thicker.
 *
 * The colours are recorded rather than written down, because they follow from
 * the reader's settings and no one should be maintaining them by hand. What is
 * maintained is the list of moments and places, and the rule that a change to
 * what they hold has to be looked at: `--update` rewrites the record, and the
 * diff it makes is the review.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { check, HELPERS, open, pause, summary } from "./browser.mjs";
import { readPng } from "./png.mjs";

const PORT = Number(process.env.PORT ?? 4179);
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9423);
const RECORD = new URL("./e2e-rendering-recorded.json", import.meta.url);
const SETTINGS = new URL("../src/app/presets/default-settings.json", import.meta.url);
const UPDATE = process.argv.includes("--update");

/* The move, and the two settings that decide how long everything takes. */
const FADE_MS = 1000;
const MOVE_SECONDS = 2.5;
const MOVE = ["e2", "e4"];

/**
 * When to look — and by which of the two clocks.
 *
 * Never from the click. A click has to be dispatched, handled and turned into
 * a move, which took a third of a second on the machine this was first
 * recorded on and would take something else on another; timed from the click,
 * the record would hold that machine's latency and every other machine would
 * read it as a rendering fault. So a moment in the flight is timed from the
 * take-off, which the flight's own animation is asked for.
 *
 * And a moment in the fade is timed from the fade, for the same reason one
 * step further in. The fade does not begin when the piece lands: the landing
 * hands the new position to the app, which rebuilds every mark on the board
 * before any of them can start fading in, and that rebuild is the machine's
 * work rather than the app's. Measured here, it is 50 to 117ms, wandering with
 * the load. A moment written as "1.05s after take-off + 2.5s of flight" is
 * therefore somewhere between 93% and 100% through a one-second fade depending
 * on whose machine is running it — which is exactly where two machines
 * disagree about a colour by more than a colour is allowed to drift. Written
 * as "1.05s into the fade" it is past the end of it everywhere.
 *
 * Placed around what happens rather than spread evenly: the piece is in the air
 * until 2.5s, the fade runs for a second after it lands, and the board is still
 * by 4s. The moments that matter are the ones inside the fade, where a mark
 * that jumps and a mark that fades look the same in every other test.
 */
const MOMENTS = [
  { clock: "move", at: 0.3 },
  { clock: "move", at: 1.5 },
  { clock: "move", at: 2.45 },
  { clock: "fade", at: 0.25 },
  { clock: "fade", at: 0.55 },
  { clock: "fade", at: 0.8 },
  { clock: "fade", at: 1.05 },
  { clock: "fade", at: 1.51 },
];

/** How a moment is named, in the record and in what this prints. */
const label = (moment) => `${moment.clock} ${moment.at.toFixed(2)}`;

/**
 * Where to look.
 *
 * `along` is the direction the ray crossing that square runs, in files and
 * ranks as they lie on the screen, and it is what makes two different questions
 * askable of one square:
 *
 *   - `stripe`, a patch the width of the ray at the square's middle, which the
 *     ray is drawn through. It answers for the ray alone.
 *   - `beside`, the same square just off the ray, which only the heatmap
 *     colours. It answers for the wash alone.
 *
 * Apart is the point. The bug that prompted all this showed itself as a
 * heatmap arriving in full while the ray over the same squares had not started,
 * and no measurement of the square as a whole can tell those two apart.
 */
const PLACES = [
  { square: "d5", along: [-1, -1], ray: "pawnRay", is: "the pawn's own new attack" },
  { square: "f5", along: [1, -1], ray: "pawnRay", is: "the pawn's other new attack" },
  { square: "c4", along: [-1, -1], ray: "bishopRay", is: "the bishop's newly opened diagonal" },
  { square: "b5", along: [-1, -1], ray: "bishopRay", is: "that diagonal, further out" },
  { square: "a6", along: [-1, -1], ray: "bishopRay", is: "the far end of it" },
  { square: "g4", along: [1, -1], ray: "queenRay", is: "the queen's newly opened diagonal" },
  { square: "h5", along: [1, -1], ray: "queenRay", is: "the far end of that one" },
  { square: "e2", along: null, ray: null, is: "the square the pawn left" },
  { square: "e4", along: null, ray: null, is: "the square it arrived on" },
];

/* Patches, in squares. The stripe's own width comes from the settings; the rest
   are sized to stay well inside one square. */
const WHOLE = 0.56;
const BESIDE = 0.2;
const BESIDE_FROM_MIDDLE = 0.34;

/*
   How far along a patch may drift before it is at the wrong point of its fade.

   Nothing here is a colour. What is recorded for each patch is where it stands
   between two ends measured in the same run — the board before the move, and
   the board once everything has settled — so a patch that is a quarter of the
   way in is 0.25 whatever the board is painted in. Change the squares from
   green to grey, or the rays from blue to red, and the record still holds: it
   never knew what colour anything was.

   That is worth having because the palette is the reader's and this test is not
   about it. It is about when things happen and what is clipped: a ray that
   arrives late, or is cut to nothing by a clip path meant for another mark,
   moves along its own segment and is caught here — the bug this test was
   written for sat at nought while the record said two thirds.

   The number is in fractions of that segment. A tenth is about what sixteen
   units of colour used to be on the spans these patches actually cover, and
   comfortably above what two runs of one build differ by.
*/
const TOLERANCE = 0.1;

/*
   How much a patch has to move across the whole business to be worth asking
   about. A patch that ends where it began says nothing about the fade, and
   dividing by its span would turn rounding into noise.
*/
const WORTH_ASKING = 12;

/*
   And how far a patch may drift when something crosses it rather than fades on
   it.

   A square the travelling piece passes over does not walk from one end to the
   other: it goes out past the far end and comes back, and how far past depends
   on what colour the piece is against what colour the square is — the one
   reading here that a change of palette does move. What these moments are for
   survives that easily, though: they say the piece is in the air rather than
   already down, which is most of a segment away from either, so they are asked
   the same question at a third of the precision instead of being dropped.
*/
const CROSSING = 0.35;

/**
 * Whether a reading is one of those: a square the piece is crossing while it
 * is in the air.
 *
 * Said outright rather than guessed from the number. The two squares the move
 * runs between are the ones a glyph passes over, and it passes over them while
 * the flight is on — which is exactly the moments timed from the take-off.
 * Everything else on the board, at any moment, is fading rather than being
 * crossed.
 */
const crossing = (moment, key) =>
  moment.clock === "move" && MOVE.some((square) => key.startsWith(`${square}.`));
/*
  How far from a moment the frame standing for it may be.

  Only a gap this wide with the board still moving across it is a fault — a
  machine dropping frames, which is worth saying out loud rather than measuring
  around. Once the board settles nothing is painted for a second at a time and
  the nearest frame is exactly what is on the screen, however far away it is.
*/
const NEAR_ENOUGH = 0.1;

/* The stripe widths the app will be drawing with: its own defaults, read from
   the same file it ships, so that a change to them changes where this looks. */
const settings = JSON.parse(readFileSync(SETTINGS, "utf8"));
const rayWidth = (ray) => settings.attacks.geometry.me[ray].rayWidth;

const lab = await open({ port: PORT, debugPort: DEBUG_PORT });
try {
  await lab.page.send("Page.enable");
  /* A fixed picture size, so the board is laid out the same on every machine. */
  await lab.page.send("Emulation.setDeviceMetricsOverride", {
    width: 1400,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  /*
    A slower machine on demand: `CPU_THROTTLE=4` runs everything at a quarter
    speed, which is how a build agent behaves and how the timing faults this
    test is prone to are reproduced without one.
  */
  const throttle = Number(process.env.CPU_THROTTLE ?? 1);
  if (throttle > 1) {
    await lab.page.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
  await lab.page.send("Page.navigate", { url: lab.app });
  await pause(2500);

  await lab.page.run(`
    ${HELPERS}
    window.__tab("Pieces");
    await sleep(400);
    window.__set("#fade-time", "${FADE_MS}");
    window.__set("#move-time", "${MOVE_SECONDS}");
    /* All the way to constant move time, so the flight really does take the
       time this test says it does. Left where the reader has it, the duration
       is a blend of a time and a speed and a two-square move takes rather less
       than the time asked for — which would put every moment below somewhere
       other than where it claims to be. */
    window.__set("#move-blend", "1");
    await sleep(200);
    window.__tab("Game");
    await sleep(400);
    const flip = document.querySelector("#flip-board");
    if (flip && flip.checked) { flip.click(); await sleep(300); }
    return "ready";`);

  const boxes = {};
  for (const { square } of PLACES) {
    boxes[square] = await lab.page.run(`return window.__sq("${square}");`);
  }
  const from = await lab.page.run(`return window.__sq("${MOVE[0]}");`);
  const to = await lab.page.run(`return window.__sq("${MOVE[1]}");`);

  /*
    Frames as the compositor made them, each stamped with when it made them.
    Screenshots taken to order would be no good for this: the asking, the
    painting and the answering are three different times, and the answer can
    arrive a sixth of a second after the moment it was meant to catch, which is
    most of a fade.
  */
  const frames = [];
  lab.page.on("Page.screencastFrame", async (params) => {
    frames.push({ at: params.metadata.timestamp, data: params.data });
    await lab.page.send("Page.screencastFrameAck", { sessionId: params.sessionId });
  });
  await lab.page.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  await pause(400);

  await lab.page.click(from.cx, from.cy);
  await pause(300);
  /* Watching for the take-off before asking for it, so the moment is caught by
     the page itself rather than guessed at from out here. */
  await lab.page.run(`
    window.__tookOff = null;
    window.__journey = null;
    const look = () => {
      /* The journey's own clock, not the moment its glyph appeared. An
         animation does not begin when it is created: it is pending until the
         browser commits it, and the commit waits on whatever the main thread is
         doing — at the start of a move, a rebuild of every mark on the board.
         Between the two is a third of a second on a loaded machine and almost
         nothing on an idle one, which is the whole reason to ask the animation
         rather than the page. */
      const flight = document
        .getAnimations()
        .find((a) => a.effect?.target?.classList?.contains("flying-piece"));
      if (flight !== undefined && flight.startTime !== null) {
        window.__tookOff = (performance.timeOrigin + Number(flight.startTime)) / 1000;
        window.__journey = Number(flight.effect.getTiming().duration);
        return;
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
    /*
      And when the marks of the new position begin to arrive, which is a
      different moment from the landing and belongs to the machine.

      The ones that leave started fading at take-off — the two halves of a
      crossing move together — so they are still running and must not be
      mistaken for the arrival. What is wanted is the first transition to start
      at the landing or after it, less a frame's grace for a commit that lands
      a shade early.
    */
    window.__faded = null;
    const arriving = () => {
      if (window.__tookOff !== null) {
        const landed = window.__tookOff * 1000 + window.__journey;
        const starts = document
          .getAnimations()
          .filter((a) => a.transitionProperty === "opacity" && a.startTime !== null)
          .map((a) => performance.timeOrigin + Number(a.startTime))
          .filter((at) => at >= landed - 16);
        if (starts.length > 0) {
          window.__faded = Math.min(...starts) / 1000;
          return;
        }
      }
      requestAnimationFrame(arriving);
    };
    requestAnimationFrame(arriving);
    return "watching";`);
  const clicked = Date.now() / 1000;
  await lab.page.click(to.cx, to.cy);
  /* Long enough for every moment on either clock, and a second over: a moment
     in the fade is that far past a landing which is itself a move away, plus
     whatever the machine spends getting the fade started. */
  const last = Math.max(
    ...MOMENTS.map((m) => (m.clock === "move" ? m.at : MOVE_SECONDS + m.at))
  );
  await pause((last + 1) * 1000);
  await lab.page.send("Page.stopScreencast");
  const began = await lab.page.run(`return window.__tookOff;`);
  const journey = await lab.page.run(`return window.__journey;`);
  const faded = await lab.page.run(`return window.__faded;`);
  if (began === null) {
    throw new Error("the piece never left its square");
  }
  if (faded === null) {
    throw new Error("the marks of the new position never began to arrive");
  }

  console.log(
    `\n  ${MOVE.join("-")} from the opening position, fade ${FADE_MS}ms, move ${MOVE_SECONDS}s` +
      `\n  ${frames.length} frames painted; the journey began ` +
      `${((began - clicked) * 1000).toFixed(0)}ms after the click and took ${journey}ms; ` +
      `the fade began ${((faded - began) * 1000 - journey).toFixed(0)}ms after the landing\n`
  );

  /** Every patch of one square, in pixels, given where the board put it. */
  const patchesOf = ({ square, along, ray }) => {
    const box = boxes[square];
    const squares = (fraction) => Math.max(1, Math.round(box.w * fraction));
    const middle = (size) => ({ x: box.cx - Math.round(size / 2), y: box.cy - Math.round(size / 2) });
    const whole = squares(WHOLE);
    const patches = { whole: { ...middle(whole), w: whole, h: whole } };
    if (along !== null) {
      /* The ray's own width, at the middle of the square, where the ray runs. */
      const width = squares(rayWidth(ray));
      patches.stripe = { ...middle(width), w: width, h: width };
      /* And the same square across from it: a step at right angles to the ray,
         which is [x, y] turned a quarter turn. */
      const step = box.w * BESIDE_FROM_MIDDLE * Math.SQRT1_2;
      const size = squares(BESIDE);
      patches.beside = {
        x: Math.round(box.cx + along[1] * step - size / 2),
        y: Math.round(box.cy - along[0] * step - size / 2),
        w: size,
        h: size,
      };
    }
    return patches;
  };

  /*
    The two ends every patch is measured between: the board as it stood before
    the piece left, and the board once it has finished settling.

    Taken from this run rather than worked out from the settings. The settings
    say what a ray is painted in, not what a ray drawn over a wash over a square
    comes to on the screen — that is the compositing this test exists to look
    at, and a test that computed it would be checking its own arithmetic.
  */
  const measure = (frame) => {
    const picture = readPng(Buffer.from(frame.data, "base64"));
    const out = {};
    for (const place of PLACES) {
      for (const [what, patch] of Object.entries(patchesOf(place))) {
        out[`${place.square}.${what}`] = picture.mean(patch.x, patch.y, patch.w, patch.h);
      }
    }
    return out;
  };
  const before = measure(frames.filter((frame) => frame.at <= began).at(-1) ?? frames[0]);
  const after = measure(frames.at(-1));

  /**
   * Where a colour stands between those two ends, as a fraction.
   *
   * Projected onto the line between them rather than taken channel by channel:
   * the three channels travel together and the projection is what they agree
   * on, which is one number to record and one number to read when it is wrong.
   */
  const along = (key, rgb) => {
    const span = after[key].map((end, at) => end - before[key][at]);
    const length = Math.hypot(...span);
    if (length < WORTH_ASKING) {
      return null;
    }
    const walked = rgb.map((value, at) => value - before[key][at]);
    return (
      span.reduce((sum, step, at) => sum + step * walked[at], 0) / (length * length)
    );
  };

  const recorded = UPDATE
    ? {
        move: MOVE.join("-"),
        fadeMs: FADE_MS,
        moveSeconds: MOVE_SECONDS,
        places: Object.fromEntries(PLACES.map((p) => [p.square, p.is])),
        /* For a reader of the file: what the two ends came to in the run that
           wrote it. Nothing is compared against them. */
        ends: Object.fromEntries(
          Object.keys(before).map((key) => [key, { before: before[key], after: after[key] }])
        ),
        at: {},
      }
    : JSON.parse(readFileSync(RECORD, "utf8"));
  const fresh = {};

  for (const moment of MOMENTS) {
    const wanted = (moment.clock === "move" ? began : faded) + moment.at;
    /*
      What is on the screen at a moment is the last frame painted by then — not
      the nearest frame, which after the board settles is one painted a second
      later. The screencast sends nothing while nothing changes, so a moment
      with no frame after it is a moment the picture had already stopped
      moving, and the last frame is exactly right rather than merely close.
    */
    /*
      The frame nearest the moment, before or after it.

      It used to be the last frame painted by then, which is what is on the
      screen at that instant — true, and the wrong thing to compare. A frame
      can be most of a fade's steepest tenth old before anything complains, and
      two machines that paint on different beats then read the same moment at
      two different points of the same curve: measured, a 26ms difference in
      how stale the frame was moved a stripe by seventeen units, against a
      tolerance of sixteen. Nearest is symmetric — the recording and the run
      that checks it both take it — so what is left is half a frame either way
      rather than a whole frame in one direction.
    */
    const shown = frames.reduce(
      (best, frame) =>
        best === undefined ||
        Math.abs(frame.at - wanted) < Math.abs(best.at - wanted)
          ? frame
          : best,
      undefined
    );
    const later = frames.find((frame) => frame.at > wanted);
    if (shown === undefined) {
      check(`${label(moment)}s was painted at all`, false, "no frame that early");
      continue;
    }
    const stale = shown.at - wanted;
    const seen = measure(shown);
    /* The same reading as a set of fractions: where each patch stands between
       its two ends. Patches that go nowhere across the whole business are left
       out — see `WORTH_ASKING`. */
    const walked = Object.fromEntries(
      Object.entries(seen)
        .map(([key, rgb]) => [key, along(key, rgb)])
        .filter(([, fraction]) => fraction !== null)
    );

    /*
      A gap in the frames is only a problem if the board changed across it. Once
      the board settles nothing is painted for a second at a time, and the last
      frame is then not merely the closest but exactly what is on the screen. It
      is when the next frame shows something else that a gap means the moment
      fell somewhere unmeasured.
    */
    if (later !== undefined && Math.abs(later.at - shown.at) > NEAR_ENOUGH) {
      const then = measure(later);
      const moved = Object.entries(walked).some(
        ([key, fraction]) => Math.abs(fraction - (along(key, then[key]) ?? fraction)) > TOLERANCE
      );
      if (moved) {
        check(
          `a frame within ${NEAR_ENOUGH}s of ${label(moment)}s`,
          false,
          `the board moved between frames ${Math.abs(stale).toFixed(3)}s and ` +
            `${Math.abs(later.at - wanted).toFixed(3)}s from it — this machine ` +
            `is dropping frames`
        );
        continue;
      }
    }
    fresh[label(moment)] = Object.fromEntries(
      Object.entries(walked).map(([key, fraction]) => [key, Number(fraction.toFixed(3))])
    );

    if (UPDATE) {
      const say = (key) =>
        `${key}=${walked[key] === undefined ? "—" : walked[key].toFixed(2)}`;
      console.log(
        `  ${label(moment)}s  ${say("c4.stripe")}  ${say("c4.beside")}  ${say("d5.stripe")}  ${say("e4.whole")}`
      );
      continue;
    }

    const expected = recorded.at[label(moment)];
    if (expected === undefined) {
      check(`${label(moment)}s is in the record`, false, "run with --update");
      continue;
    }
    const wrong = Object.entries(walked)
      .filter(([key]) => expected[key] !== undefined)
      .map(([key, fraction]) => ({
        key,
        fraction,
        was: expected[key],
        off: Math.abs(fraction - expected[key]),
      }))
      .filter(
        (one) => one.off > (crossing(moment, one.key) ? CROSSING : TOLERANCE)
      );
    const where = (key) => {
      const [square, what] = key.split(".");
      const place = PLACES.find((p) => p.square === square);
      return `${key} — ${what === "beside" ? "beside the ray on " : what === "stripe" ? "the ray crossing " : ""}${square}, ${place.is}`;
    };
    check(
      `${label(moment)}s in (frame ${(stale * 1000).toFixed(0)}ms away) the board is as recorded`,
      wrong.length === 0,
      wrong
        .map(
          (one) =>
            `${where(one.key)}: ${(one.fraction * 100).toFixed(0)}% along its fade, ` +
            `recorded ${(one.was * 100).toFixed(0)}% (out by ${(one.off * 100).toFixed(0)} points)`
        )
        .join("\n          ")
    );
  }

  if (UPDATE) {
    recorded.at = fresh;
    writeFileSync(RECORD, `${JSON.stringify(recorded, null, 1)}\n`);
    console.log(`\n  recorded ${Object.keys(fresh).length} moments\n`);
  }

  lab.page.close();
} catch (error) {
  check("the rendering tests could not run", false, error.message);
}

lab.stop();
/* Recording is not testing: it says what it wrote and leaves it at that. */
process.exit(UPDATE || summary() ? 0 : 1);
