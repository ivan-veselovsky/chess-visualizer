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
 * When to look, in seconds from the moment the piece leaves its square.
 *
 * From the take-off rather than from the click, because the two are not the
 * same instant and only one of them belongs to the app: a click has to be
 * dispatched, handled, and turned into a move, which took a third of a second
 * on the machine this was first recorded on and would take something else on
 * another. Timed from the click, the record would hold that machine's latency
 * and every other machine would read it as a rendering fault.
 *
 * Placed around what happens rather than spread evenly: the piece is in the air
 * until 2.5s, the fade runs for a second after it lands, and the board is still
 * by 4s. The moments that matter are the ones inside the fade, where a mark
 * that jumps and a mark that fades look the same in every other test.
 */
const MOMENTS = [0.3, 1.5, 2.45, 2.75, 3.05, 3.3, 3.55, 4.01];

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
   How far a colour may drift before it is a different colour.

   Measured rather than guessed: across two runs of one build the same patch at
   the same moment differed by nothing at the median and by eight at the worst,
   which is the fade commiting a frame or two earlier or later under load. Twice
   that leaves room for a slower machine and is still nowhere near what a fault
   looks like — the clipped ray this test was written for sat a hundred units
   from where it belonged for half a second.
*/
const TOLERANCE = 16;
/* How stale the frame standing for a moment may be. */
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
    return "watching";`);
  const clicked = Date.now() / 1000;
  await lab.page.click(to.cx, to.cy);
  await pause((MOMENTS[MOMENTS.length - 1] + 1) * 1000);
  await lab.page.send("Page.stopScreencast");
  const began = await lab.page.run(`return window.__tookOff;`);
  const journey = await lab.page.run(`return window.__journey;`);
  if (began === null) {
    throw new Error("the piece never left its square");
  }

  console.log(
    `\n  ${MOVE.join("-")} from the opening position, fade ${FADE_MS}ms, move ${MOVE_SECONDS}s` +
      `\n  ${frames.length} frames painted; the journey began ` +
      `${((began - clicked) * 1000).toFixed(0)}ms after the click and took ${journey}ms\n`
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

  const recorded = UPDATE
    ? {
        move: MOVE.join("-"),
        fadeMs: FADE_MS,
        moveSeconds: MOVE_SECONDS,
        places: Object.fromEntries(PLACES.map((p) => [p.square, p.is])),
        at: {},
      }
    : JSON.parse(readFileSync(RECORD, "utf8"));
  const fresh = {};

  for (const moment of MOMENTS) {
    const wanted = began + moment;
    /*
      What is on the screen at a moment is the last frame painted by then — not
      the nearest frame, which after the board settles is one painted a second
      later. The screencast sends nothing while nothing changes, so a moment
      with no frame after it is a moment the picture had already stopped
      moving, and the last frame is exactly right rather than merely close.
    */
    const shown = frames.filter((frame) => frame.at <= wanted).at(-1);
    const later = frames.find((frame) => frame.at > wanted);
    if (shown === undefined) {
      check(`${moment.toFixed(2)}s was painted at all`, false, "no frame that early");
      continue;
    }
    const stale = wanted - shown.at;
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
    const seen = measure(shown);

    /*
      A gap in the frames is only a problem if the board changed across it. Once
      the board settles nothing is painted for a second at a time, and the last
      frame is then not merely the closest but exactly what is on the screen. It
      is when the next frame shows something else that a gap means the moment
      fell somewhere unmeasured.
    */
    if (later !== undefined && later.at - shown.at > NEAR_ENOUGH) {
      const then = measure(later);
      const moved = Object.entries(seen).some(([key, rgb]) =>
        rgb.some((v, i) => Math.abs(v - then[key][i]) > TOLERANCE)
      );
      if (moved) {
        check(
          `a frame within ${NEAR_ENOUGH}s of ${moment.toFixed(2)}s`,
          false,
          `the board moved between frames ${stale.toFixed(3)}s before and ` +
            `${(later.at - wanted).toFixed(3)}s after — this machine is dropping frames`
        );
        continue;
      }
    }
    fresh[moment.toFixed(2)] = seen;

    if (UPDATE) {
      const say = (key) => `${key}=${seen[key].join(",")}`;
      console.log(
        `  ${moment.toFixed(2)}s  ${say("c4.stripe")}  ${say("c4.beside")}  ${say("d5.stripe")}  ${say("e4.whole")}`
      );
      continue;
    }

    const expected = recorded.at[moment.toFixed(2)];
    if (expected === undefined) {
      check(`${moment.toFixed(2)}s is in the record`, false, "run with --update");
      continue;
    }
    const wrong = Object.entries(seen)
      .filter(([key]) => expected[key] !== undefined)
      .map(([key, rgb]) => ({
        key,
        rgb,
        was: expected[key],
        off: Math.max(...rgb.map((v, i) => Math.abs(v - expected[key][i]))),
      }))
      .filter((one) => one.off > TOLERANCE);
    const where = (key) => {
      const [square, what] = key.split(".");
      const place = PLACES.find((p) => p.square === square);
      return `${key} — ${what === "beside" ? "beside the ray on " : what === "stripe" ? "the ray crossing " : ""}${square}, ${place.is}`;
    };
    check(
      `at ${moment.toFixed(2)}s (frame ${stale.toFixed(3)}s old) the board is as recorded`,
      wrong.length === 0,
      wrong
        .map((one) => `${where(one.key)}: ${one.rgb.join(",")}, recorded ${one.was.join(",")} (out by ${one.off})`)
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
