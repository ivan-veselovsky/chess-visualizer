/**
 * One frame of an animated GIF, drawn from the page as it stands: the title, and
 * the board's column — the names over and under it, the board or boards, the
 * bars of men — laid out where they are on the screen, scaled, with a margin
 * round the lot. What comes out is what a screen capture of the visualizer
 * would be, drawn from the page's own vector drawing rather than from pixels.
 *
 * Nothing is laid out again. Every piece is measured where the browser put it
 * and drawn there:
 *
 *   - an `<svg>` — a board, a man on a bar, an icon, the flower by a name — is
 *     copied with the styles the stylesheet gave it written onto it (an `<svg>`
 *     drawn as an image sees none of the page's CSS), and drawn as an image;
 *   - text is drawn as text, in the font and colour it has on the page, on the
 *     baseline it has there;
 *   - a box with a colour of its own — the dot that says a game is live — is
 *     painted as the box it is.
 *
 * The piece in the air is the one exception: it travels on a layer over the
 * board rather than in it, and is put back into the board's drawing where it is
 * at that moment, drawn exactly as the board draws its men.
 */

/** The page's parts that make up a frame. */
export interface StageRoots {
  app: Element;
  title: Element;
  column: Element;
}

export function stageRoots(): StageRoots | null {
  const app = document.querySelector(".app");
  const title = document.querySelector(".app-header h1");
  const column = document.querySelector(".board-and-players");
  return app === null || title === null || column === null ? null : { app, title, column };
}

/**
 * The part of the page a frame is, and how big a GIF of it is.
 *
 * Held relative to the app's own box rather than to the window, so that the
 * page scrolling while frames are made moves nothing in them.
 */
export interface Stage {
  left: number;
  top: number;
  width: number;
  height: number;
  /** GIF pixels to a pixel of the page. */
  scale: number;
  pixelWidth: number;
  pixelHeight: number;
  /** The page's ground, which is the GIF's. */
  ground: string;
}

/**
 * The frame's extent, for a GIF whose boards come out `boardPx` across.
 *
 * Sized by the board rather than by the window: a GIF made at 2x has boards
 * 1072 pixels across whatever the window was, and everything else — the title,
 * the names, the bars — is scaled with them, as they stand beside them on the
 * page.
 *
 * The frame is what is drawn and an em round it: an em above the title, an em
 * beyond the coordinates at the left and the names at the foot, an em past the
 * bars at the right. Measured off the ink rather than off the boxes things sit
 * in — a board's box has a margin round its coordinates, a title's a line's
 * worth of air — so the em is an em from what the eye sees. A GIF has no shape
 * it must keep, so it is cut to exactly that.
 *
 * The bars are counted whole, men or no men: one that is empty at the start of
 * a game fills as it goes, and a frame cut round the first position would cut
 * off what the bar holds by the end.
 */
export function measureStage(roots: StageRoots, boardPx: number): Stage | null {
  const board = roots.column.querySelector(".board-holder > svg");
  if (board === null) {
    return null;
  }
  const boardWidth = board.getBoundingClientRect().width;
  if (boardWidth === 0) {
    return null;
  }
  const ink: Box[] = [];
  inkOf(roots.title, ink);
  inkOf(roots.column, ink);
  for (const bar of roots.column.querySelectorAll(".men-bar")) {
    const rect = bar.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      ink.push(rect);
    }
  }
  if (ink.length === 0) {
    return null;
  }
  const left = Math.min(...ink.map((box) => box.left));
  const top = Math.min(...ink.map((box) => box.top));
  const right = Math.max(...ink.map((box) => box.right));
  const bottom = Math.max(...ink.map((box) => box.bottom));
  const em = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const origin = roots.app.getBoundingClientRect();
  const scale = boardPx / boardWidth;
  const width = right - left + 2 * em;
  const height = bottom - top + 2 * em;
  return {
    left: left - origin.left - em,
    top: top - origin.top - em,
    width,
    height,
    scale,
    pixelWidth: Math.round(width * scale),
    pixelHeight: Math.round(height * scale),
    ground: getComputedStyle(document.body).backgroundColor,
  };
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** What the painter leaves out, and so what nothing is measured from either. */
function unseen(element: Element, seen: CSSStyleDeclaration): boolean {
  return (
    seen.display === "none" ||
    Number(seen.opacity) === 0 ||
    element.classList.contains("visually-hidden") ||
    /* Drawn into the board it flies over; see `paintSvg`. */
    element.classList.contains("flight-layer")
  );
}

/** Where ink is under `element`, on the screen: what `paintTree` would draw, box by box. */
function inkOf(element: Element, into: Box[]): void {
  const seen = getComputedStyle(element);
  if (unseen(element, seen)) {
    return;
  }
  if (element instanceof SVGSVGElement) {
    const drawn = svgInk(element);
    if (drawn !== null) {
      into.push(drawn);
    }
    return;
  }
  if (seen.visibility === "visible" && hasColour(seen.backgroundColor)) {
    into.push(element.getBoundingClientRect());
  }
  for (const child of element.childNodes) {
    if (child instanceof Text) {
      const box = textBox(child);
      if (box !== null) {
        into.push(box);
      }
    } else if (child instanceof Element) {
      inkOf(child, into);
    }
  }
}

const hasColour = (colour: string) =>
  colour !== "" && colour !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(colour);

/** The ancestor, if any, that cuts this text short with an ellipsis. */
function ellipsisBox(text: Text): Element | null {
  for (let box = text.parentElement; box !== null; box = box.parentElement) {
    if (getComputedStyle(box).textOverflow === "ellipsis") {
      return box;
    }
    if (box.matches(".app-header h1, .board-and-players")) {
      return null;
    }
  }
  return null;
}

/** A canvas to measure text with, made once. */
let measurer: CanvasRenderingContext2D | null = null;

/**
 * Where a run of text puts ink — as far as whatever cuts it short lets it go.
 *
 * Its box runs from the font's ascent to its descent, a good way above the tops
 * of the capitals and below the feet of most letters; an em above a title's box
 * came out nearer an em and a half above the title. So the height is the ink's,
 * as the canvas measures it in the same font on the same baseline, and the
 * width is the box's, which is where the letters are.
 */
function textBox(text: Text): Box | null {
  const parent = text.parentElement;
  if (parent === null || text.data.trim() === "") {
    return null;
  }
  const seen = getComputedStyle(parent);
  if (seen.visibility !== "visible") {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(text);
  const rect = [...range.getClientRects()].find((box) => box.width > 0);
  if (rect === undefined) {
    return null;
  }
  const clip = ellipsisBox(text);
  const right = clip === null ? rect.right : Math.min(rect.right, clip.getBoundingClientRect().right);
  if (measurer === null) {
    measurer = document.createElement("canvas").getContext("2d");
  }
  if (measurer === null) {
    return { left: rect.left, top: rect.top, right, bottom: rect.bottom };
  }
  measurer.font = `${seen.fontStyle} ${seen.fontWeight} ${seen.fontSize} ${seen.fontFamily}`;
  const metrics = measurer.measureText(text.data.replace(/\s+/g, " ").trim());
  const baseline = rect.top + metrics.fontBoundingBoxAscent;
  return {
    left: rect.left,
    top: baseline - metrics.actualBoundingBoxAscent,
    right,
    bottom: baseline + metrics.actualBoundingBoxDescent,
  };
}

/**
 * What of an `<svg>` shows, in its own units and on the screen: its view, and —
 * where the page lets it spill over its edges, as the petals round a name and
 * the men on a bar do — whatever it draws beyond that, and a hair more for the
 * width of a stroke, which the browser's measure leaves out.
 *
 * The browser's measure of what is drawn is only asked of the drawings that
 * spill. It counts shapes whole, clipping or none, and a board's hatching is
 * drawn as lines far longer than the board and clipped to the dark squares — so
 * asked of a board, it answers with something several boards wide.
 */
function svgShown(svg: SVGSVGElement): {
  view: { x: number; y: number; width: number; height: number };
  shown: { x: number; y: number; width: number; height: number };
  onScreen: Box;
} | null {
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  const base = svg.viewBox.baseVal;
  const view =
    base !== null && base.width > 0 && base.height > 0
      ? { x: base.x, y: base.y, width: base.width, height: base.height }
      : { x: 0, y: 0, width: rect.width, height: rect.height };
  let shown = view;
  if (getComputedStyle(svg).overflow === "visible") {
    try {
      const drawn = svg.getBBox();
      const slack = 2;
      const x0 = Math.min(view.x, drawn.x - slack);
      const y0 = Math.min(view.y, drawn.y - slack);
      shown = {
        x: x0,
        y: y0,
        width: Math.max(view.x + view.width, drawn.x + drawn.width + slack) - x0,
        height: Math.max(view.y + view.height, drawn.y + drawn.height + slack) - y0,
      };
    } catch {
      /* Nothing drawn, or nothing the browser will measure: the view it is. */
    }
  }
  const perUnit = rect.width / view.width;
  return {
    view,
    shown,
    onScreen: {
      left: rect.left + (shown.x - view.x) * perUnit,
      top: rect.top + (shown.y - view.y) * perUnit,
      right: rect.left + (shown.x + shown.width - view.x) * perUnit,
      bottom: rect.top + (shown.y + shown.height - view.y) * perUnit,
    },
  };
}

/**
 * Where an `<svg>` puts ink on the screen, for the frame's extent.
 *
 * Two are measured by what they are rather than by their box:
 *
 *   - a board, by its frame and its coordinates. Its box has a margin round the
 *     coordinates, which is air, and an em from the coordinates is what the
 *     frame's edge is meant to be;
 *   - the flower by a name, as if open. Its petals open on its side's move and
 *     close on the other's, and a frame measured with them open or shut would
 *     come out a few pixels different depending on whose turn it was when it
 *     was measured.
 *
 * Anything else, by what shows of it (see `svgShown`).
 */
function svgInk(svg: SVGSVGElement): Box | null {
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  if (svg.parentElement?.classList.contains("board-holder")) {
    const view = svg.viewBox.baseVal;
    const perUnit = view !== null && view.width > 0 ? rect.width / view.width : 1;
    const parts: Box[] = [];
    for (const frame of svg.querySelectorAll(".board-frame")) {
      const box = frame.getBoundingClientRect();
      /* Half the frame's stroke lies outside the shape the browser measures. */
      const half = (parseFloat(getComputedStyle(frame).strokeWidth) || 0) * perUnit * 0.5;
      parts.push({ left: box.left - half, top: box.top - half, right: box.right + half, bottom: box.bottom + half });
    }
    for (const label of svg.querySelectorAll(".coordinate-label")) {
      parts.push(label.getBoundingClientRect());
    }
    if (parts.length > 0) {
      return {
        left: Math.min(...parts.map((box) => box.left)),
        top: Math.min(...parts.map((box) => box.top)),
        right: Math.max(...parts.map((box) => box.right)),
        bottom: Math.max(...parts.map((box) => box.bottom)),
      };
    }
  }
  if (svg.classList.contains("player-color")) {
    /* Open, the petals reach out by half the disc's width all round. */
    const reach = rect.width / 2;
    return { left: rect.left - reach, top: rect.top - reach, right: rect.right + reach, bottom: rect.bottom + reach };
  }
  return svgShown(svg)?.onScreen ?? null;
}

/**
 * What an `<svg>` needs written onto it to look the same drawn as an image.
 *
 * The paint and the type, and what is visible; and the transform, where the
 * stylesheet is what gives one — the petals round a name grow by a transform
 * the stylesheet animates. Where the markup gives an element its transform, the
 * attribute is left to say it.
 */
const PAINT = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "opacity",
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "visibility",
  "display",
  "paint-order",
  "mix-blend-mode",
];

function styleFor(element: Element): string {
  const seen = getComputedStyle(element);
  const written = PAINT.map((property) => `${property}:${seen.getPropertyValue(property)}`);
  if (!element.hasAttribute("transform") && seen.transform !== "none" && element.tagName !== "svg") {
    written.push(
      `transform:${seen.transform}`,
      `transform-origin:${seen.transformOrigin}`,
      `transform-box:${seen.getPropertyValue("transform-box")}`
    );
  }
  return written.join(";");
}

/** A frame's worth of pixels, and what is needed to make the next one. */
export interface Painter {
  roots: StageRoots;
  stage: Stage;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  /** Small drawings that come round again — a man on a bar, an icon — decoded once. */
  images: Map<string, Promise<HTMLImageElement>>;
}

export function createPainter(roots: StageRoots, stage: Stage): Painter {
  const canvas = document.createElement("canvas");
  canvas.width = stage.pixelWidth;
  canvas.height = stage.pixelHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("This browser would not give a canvas to draw the frames on.");
  }
  return { roots, stage, canvas, context, images: new Map() };
}

/** One thing to draw, with where and how already settled. */
type Stroke =
  | {
      kind: "box";
      x: number;
      y: number;
      width: number;
      height: number;
      radius: number;
      colour: string;
      opacity: number;
    }
  | { kind: "text"; text: string; font: string; colour: string; x: number; y: number; opacity: number }
  | { kind: "svg"; markup: string; left: number; top: number; width: number; height: number; opacity: number };

type Corner = { x: number; y: number };

/**
 * The frame as it stands now, as pixels.
 *
 * Everything is measured first, in one go, and only then is anything waited
 * for. Drawing a board means waiting for the browser to decode it as an image,
 * and the page does not hold still while it waits: a reader who scrolled while
 * a GIF was being made — up from the Export button to watch the boards — had
 * the right board, the bars and the names below measured after the scroll and
 * the title and the left board before it, and those frames came out with the
 * right-hand half dropped a hundred pixels, for a frame at a time. Measured in
 * one uninterrupted pass, a frame is the page as it was at one moment, however
 * long it then takes to draw.
 */
export async function paintFrame(painter: Painter): Promise<Uint8ClampedArray> {
  await drawFrame(painter);
  const { stage, context } = painter;
  return context.getImageData(0, 0, stage.pixelWidth, stage.pixelHeight).data;
}

/**
 * The frame as it stands now, drawn on the painter's canvas and left there —
 * for whatever takes a canvas as it is, as a video encoder does, rather than
 * its pixels. See `paintFrame`.
 */
export async function drawFrame(painter: Painter): Promise<void> {
  const { roots, stage, context } = painter;
  const origin = roots.app.getBoundingClientRect();
  /* Where the frame's corner is on the screen now. */
  const at = { x: origin.left + stage.left, y: origin.top + stage.top };
  const strokes: Stroke[] = [];
  plan(painter, roots.title, at, 1, strokes);
  plan(painter, roots.column, at, 1, strokes);

  const images = await Promise.all(
    strokes.map((stroke) => (stroke.kind === "svg" ? imageOf(painter, stroke.markup) : null))
  );
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.fillStyle = stage.ground;
  context.fillRect(0, 0, stage.pixelWidth, stage.pixelHeight);
  strokes.forEach((stroke, index) => draw(context, stroke, images[index]));
}

function draw(context: CanvasRenderingContext2D, stroke: Stroke, image: HTMLImageElement | null): void {
  context.globalAlpha = stroke.opacity;
  if (stroke.kind === "box") {
    context.fillStyle = stroke.colour;
    context.beginPath();
    context.roundRect(stroke.x, stroke.y, stroke.width, stroke.height, stroke.radius);
    context.fill();
  } else if (stroke.kind === "text") {
    context.fillStyle = stroke.colour;
    context.font = stroke.font;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText(stroke.text, stroke.x, stroke.y);
  } else if (image !== null) {
    context.drawImage(image, stroke.left, stroke.top, stroke.width, stroke.height);
  }
}

/** What `element` draws, stroke by stroke, in the order it is drawn. */
function plan(painter: Painter, element: Element, at: Corner, opacity: number, into: Stroke[]): void {
  const seen = getComputedStyle(element);
  if (unseen(element, seen)) {
    return;
  }
  const here = opacity * Number(seen.opacity);
  if (element instanceof SVGSVGElement) {
    const stroke = planSvg(painter, element, at, here);
    if (stroke !== null) {
      into.push(stroke);
    }
    return;
  }
  if (seen.visibility === "visible") {
    const stroke = planBox(painter, element, seen, at, here);
    if (stroke !== null) {
      into.push(stroke);
    }
  }
  for (const child of element.childNodes) {
    if (child instanceof Text) {
      const stroke = planText(painter, child, at, here);
      if (stroke !== null) {
        into.push(stroke);
      }
    } else if (child instanceof Element) {
      plan(painter, child, at, here, into);
    }
  }
}

/** A box with a colour of its own, as a rounded rectangle. */
function planBox(
  painter: Painter,
  element: Element,
  seen: CSSStyleDeclaration,
  at: Corner,
  opacity: number
): Stroke | null {
  const colour = seen.backgroundColor;
  if (!hasColour(colour)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  const { scale } = painter.stage;
  const radius = seen.borderTopLeftRadius.endsWith("%")
    ? (parseFloat(seen.borderTopLeftRadius) / 100) * Math.min(rect.width, rect.height)
    : parseFloat(seen.borderTopLeftRadius) || 0;
  return {
    kind: "box",
    x: (rect.left - at.x) * scale,
    y: (rect.top - at.y) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
    radius: radius * scale,
    colour,
    opacity,
  };
}

/**
 * A run of text, where it is on the page.
 *
 * On the page's own baseline: a range round the text reports the box its font
 * takes on the line, whose top is one ascent above the baseline, and the canvas
 * knows the same font's ascent. A name cut short with an ellipsis on the page is
 * cut short with one here, at the same width.
 */
function planText(painter: Painter, node: Text, at: Corner, opacity: number): Stroke | null {
  const parent = node.parentElement;
  if (parent === null || node.data.trim() === "") {
    return null;
  }
  const seen = getComputedStyle(parent);
  if (seen.visibility !== "visible") {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(node);
  const rect = [...range.getClientRects()].find((box) => box.width > 0);
  if (rect === undefined) {
    return null;
  }
  let text = node.data.replace(/\s+/g, " ");
  if (seen.textTransform === "uppercase") {
    text = text.toUpperCase();
  } else if (seen.textTransform === "lowercase") {
    text = text.toLowerCase();
  }
  const { context, stage } = painter;
  const font = `${seen.fontStyle} ${seen.fontWeight} ${parseFloat(seen.fontSize) * stage.scale}px ${seen.fontFamily}`;
  context.font = font;

  /* Cut short where the page cuts it short: at the inner edge of whichever box
     round it ends its text with an ellipsis, which need not be its own. */
  let clipping: Element | null = null;
  for (
    let box: Element | null = parent;
    box !== null && box !== painter.roots.column && box !== painter.roots.title;
    box = box.parentElement
  ) {
    if (getComputedStyle(box).textOverflow === "ellipsis") {
      clipping = box;
      break;
    }
  }
  if (clipping !== null) {
    const box = clipping.getBoundingClientRect();
    const inside = box.right - parseFloat(getComputedStyle(clipping).paddingRight);
    const room = (inside - rect.left) * stage.scale;
    if (context.measureText(text).width > room + 0.5) {
      let kept = text.length;
      while (kept > 0 && context.measureText(`${text.slice(0, kept).trimEnd()}…`).width > room) {
        kept -= 1;
      }
      text = `${text.slice(0, kept).trimEnd()}…`;
    }
  }
  const ascent = context.measureText(text).fontBoundingBoxAscent;
  return {
    kind: "text",
    text,
    font,
    colour: seen.color,
    x: (rect.left - at.x) * stage.scale,
    y: (rect.top - at.y) * stage.scale + ascent,
    opacity,
  };
}

/**
 * An `<svg>`, to be drawn as the browser draws it, at the size the GIF wants.
 *
 * Copied with its styles written in (see `PAINT`), and with its view set to
 * what shows of it (see `svgShown`): widened where it spills over its own box,
 * as the petals round a name do, since an image cannot spill over its edges the
 * way an element on the page can.
 *
 * Placed on whole pixels, to be drawn at exactly the size it is rasterised at,
 * so nothing is resampled and nothing goes soft.
 */
function planSvg(painter: Painter, svg: SVGSVGElement, at: Corner, opacity: number): Stroke | null {
  const drawn = svgShown(svg);
  if (drawn === null) {
    return null;
  }
  const { stage } = painter;
  const { view: box, shown, onScreen } = drawn;
  const perUnit = svg.getBoundingClientRect().width / box.width;
  const left = Math.round((onScreen.left - at.x) * stage.scale);
  const top = Math.round((onScreen.top - at.y) * stage.scale);
  const right = Math.round((onScreen.right - at.x) * stage.scale);
  const bottom = Math.round((onScreen.bottom - at.y) * stage.scale);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) {
    return null;
  }

  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll("*")];
  const to = [copy, ...copy.querySelectorAll("*")];
  from.forEach((element, index) => to[index].setAttribute("style", styleFor(element)));
  /* Its own opacity is in `opacity` already, laid on as the canvas draws it. */
  copy.style.opacity = "1";
  flyersInto(svg, copy, box, perUnit);
  copy.setAttribute("viewBox", `${shown.x} ${shown.y} ${shown.width} ${shown.height}`);
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  copy.setAttribute("preserveAspectRatio", "none");
  copy.removeAttribute("class");
  return {
    kind: "svg",
    markup: new XMLSerializer().serializeToString(copy),
    left,
    top,
    width,
    height,
    opacity,
  };
}

/**
 * The piece in the air, put into the board's drawing where it is now.
 *
 * It travels on a layer over the board, as an ordinary element, so that the
 * browser can move it without redrawing the board; in the GIF it goes back in
 * as the board draws its men — the same picture, with the fill and outline it
 * has on the layer written in — a square of the board across, where the layer
 * has it at this moment.
 *
 * Where that is, is worked out from the layer's own numbers — the square it
 * set off from, and how far the journey has carried it — rather than from
 * where the browser says the piece is on the screen. That answer counts in
 * how far the page is scrolled, and a box moved by a transform sits at no
 * whole number of anything: taking one scrolled position from another left a
 * few millionths of a unit behind, a different few with the page scrolled
 * than without. A font's glyph is snapped to the pixel and never showed it; a
 * picture's edge is drawn where it falls, and did, so a GIF made while the
 * reader scrolled came out a few pixels different from one made without.
 */
function flyersInto(
  svg: SVGSVGElement,
  copy: SVGSVGElement,
  box: { x: number; y: number; width: number; height: number },
  perUnit: number
): void {
  const holder = svg.closest(".board-holder");
  if (holder === null || svg.parentElement !== holder) {
    return;
  }
  const area = svg.getBoundingClientRect();
  for (const flying of holder.querySelectorAll<SVGSVGElement>(".flying-piece > svg")) {
    const carrier = flying.parentElement;
    const layer = carrier?.parentElement;
    if (carrier == null || layer == null) {
      continue;
    }
    /* Both laid out rather than moved, so on the same grid of units, and the
       one taken from the other exactly. */
    const sheet = layer.getBoundingClientRect();
    const seen = getComputedStyle(carrier);
    const journey = seen.transform === "none" ? null : new DOMMatrixReadOnly(seen.transform);
    const left = sheet.left - area.left + parseFloat(seen.left) + (journey?.m41 ?? 0);
    const top = sheet.top - area.top + parseFloat(seen.top) + (journey?.m42 ?? 0);
    const glyph = flying.cloneNode(true) as SVGSVGElement;
    const from = [flying, ...flying.querySelectorAll("*")];
    const to = [glyph, ...glyph.querySelectorAll("*")];
    from.forEach((element, index) => to[index].setAttribute("style", styleFor(element)));
    glyph.setAttribute("x", String(box.x + left / perUnit));
    glyph.setAttribute("y", String(box.y + top / perUnit));
    glyph.setAttribute("width", String(parseFloat(seen.width) / perUnit));
    glyph.setAttribute("height", String(parseFloat(seen.height) / perUnit));
    glyph.removeAttribute("class");
    copy.append(glyph);
  }
}

/** An `<svg>`'s markup as a decoded image; small ones are kept, since they come round again. */
function imageOf(painter: Painter, markup: string): Promise<HTMLImageElement> {
  const keep = markup.length < 40_000;
  const kept = keep ? painter.images.get(markup) : undefined;
  if (kept !== undefined) {
    return kept;
  }
  const decoded = (async () => {
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  })();
  if (keep) {
    painter.images.set(markup, decoded);
  }
  return decoded;
}
