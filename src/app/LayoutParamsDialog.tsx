import { useEffect, useRef } from "react";
import NumberField from "./NumberField";
import { DEFAULT_LAYOUT_PARAMS, MIN_SQUARE_PX, MIN_TEXT_PX, type LayoutParams } from "./layout";

interface LayoutParamsDialogProps {
  open: boolean;
  params: LayoutParams;
  onChange: (params: LayoutParams) => void;
  onClose: () => void;
}

/** The parameters one by one: which it is, its label, and what it does. */
interface Field {
  name: keyof LayoutParams;
  label: string;
  hint: string;
  step: number;
}

/** The costs: each how much larger the boards have to be to pay for what it counts. */
const COSTS: Field[] = [
  {
    name: "scroll",
    label: "Scrolling at all (k_s)",
    hint: "How much larger the boards have to be, as an area, for a page that scrolls at all to be taken over one that fits: 0.35 is 35% larger. Tabs scrolling inside the panel count as scrolling too.",
    step: 0.05,
  },
  {
    name: "down",
    label: "Scrolling down (k_v)",
    hint: "The cost of scrolling down a whole window's height. With 1, scrolling half a window down needs boards 1.5 times the area, on top of the cost of scrolling at all.",
    step: 0.05,
  },
  {
    name: "across",
    label: "Scrolling across (k_h)",
    hint: "The cost of scrolling across a whole window's width. Higher than scrolling down by default: a mouse's wheel scrolls across only with Shift held.",
    step: 0.05,
  },
  {
    name: "panelDown",
    label: "Tabs scrolling down inside the panel (k_pv)",
    hint: "With scrolling off: the cost of the tabs scrolling down a whole panel's height inside it. With 2, tabs half a panel taller than it needs boards twice the area, on top of the cost of scrolling at all. It grows without end as the panel shrinks to nothing, so the boards never take the whole window.",
    step: 0.05,
  },
  {
    name: "panelAcross",
    label: "Tabs scrolling across inside the panel (k_ph)",
    hint: "With scrolling off: the cost of the tabs scrolling across a whole panel's width inside it, where the panel is narrower than its tabs can be without cutting anything.",
    step: 0.05,
  },
  {
    name: "stack",
    label: "Two boards one over the other (k_stack)",
    hint: "How much larger, as an area, two boards one over the other have to be than side by side. The two are read against each other most easily side by side.",
    step: 0.05,
  },
  {
    name: "text",
    label: "Panel text set smaller (k_q)",
    hint: "The cost of the panel's text set smaller than its own size, as the text's area goes. With 2, text at nine tenths of its size needs boards 1.47 times the area; from 12 px down to 10, 1.88 times. Against the costs of the tabs scrolling: where the panel is short of room, the text is set smaller or the tabs scroll, whichever costs less, and lowering this one shrinks the text sooner.",
    step: 0.1,
  },
];

/** And how hard E's floor is: a steepness, not a cost. */
const STEEPNESS: Field = {
  name: "steepness",
  label: "Steepness under E's floor (k_E)",
  hint: "Not a cost: a layout that keeps E pays nothing for it. This says how fast a layout loses its worth as its boards fall short of E's floor: at 5, a layout 10% short counts about half, 20% short a quarter. Higher holds E more strictly; lower lets the page trade a little of the boards' floor for something else, such as panel text that stays readable. The page still prefers whichever layout comes nearest to E.",
  step: 0.5,
};

/**
 * What the layout is weighed by — see `LayoutParams` — each to be set, with
 * the rule they go into written out above them, the layouts it is weighed
 * over, and what every layout keeps whatever they are under them: a number
 * on its own says nothing about what it does.
 *
 * The costs apart from E's steepness, which is not one: the costs say how
 * much a thing is worth avoiding, and the steepness how hard a floor is.
 *
 * Changed as they are typed, the page laid out again behind the dialog, so
 * what each does is seen as it is set. Kept in this browser: see
 * `layoutParams`.
 */
export default function LayoutParamsDialog({ open, params, onChange, onClose }: LayoutParamsDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const asDefault = [...COSTS, STEEPNESS].every(({ name }) => params[name] === DEFAULT_LAYOUT_PARAMS[name]);
  const field = ({ name, label, hint, step }: Field) => (
    <NumberField
      key={name}
      id={`layout-param-${name}`}
      label={label}
      hint={hint}
      inline
      narrow
      allowZero
      step={step}
      value={params[name]}
      onChange={(value) => onChange({ ...params, [name]: value })}
    />
  );

  return (
    <dialog ref={dialog} className="pgn-dialog layout-params-dialog" aria-labelledby="layout-params-title" onClose={onClose}>
      <div className="pgn-dialog-header">
        <h2 id="layout-params-title" className="layout-params-title">
          Advanced layout parameters
        </h2>
        <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>

      <p className="invite-note">The page tries every way of laying itself out:</p>
      <ul className="layout-terms">
        <li>two boards side by side, or one over the other;</li>
        <li>the panel of tabs beside the boards, or under them;</li>
        <li>where scrolling is allowed, the panel running on past the bottom or the right edge of the window;</li>
        <li>at every size of the boards, the panel given the room its tabs need at its text&rsquo;s size;</li>
        <li>
          and where scrolling is not allowed, the boards at every size, and held at E&rsquo;s floor, the panel given
          the rest;
        </li>
        <li>
          and in each, the panel&rsquo;s text at every size from {MIN_TEXT_PX}&nbsp;px up to its own: the largest its
          tabs fit at, or, where scrolling is not allowed, a larger one and the tabs scrolling inside it, whichever is
          worth more.
        </li>
      </ul>
      <p className="invite-note">It takes the one with the largest</p>
      {/* A factor to a piece, whole: a narrow dialog breaks the line between them, never inside one. */}
      <p className="layout-formula">
        <span>m = B · e(G) / (</span>
        <span>
          (1 + k<sub>s</sub>·σ(s)) ·
        </span>{" "}
        <span>
          (1 + k<sub>v</sub>·s<sub>v</sub>/s<sub>0</sub>) ·
        </span>{" "}
        <span>
          (1 + k<sub>h</sub>·s<sub>h</sub>/s<sub>0</sub>) ·
        </span>{" "}
        <span>
          (1 + k<sub>pv</sub>·p<sub>v</sub>/p<sub>0</sub>) ·
        </span>{" "}
        <span>
          (1 + k<sub>ph</sub>·p<sub>h</sub>/p<sub>0</sub>) ·
        </span>{" "}
        <span>
          (1 + k<sub>stack</sub>·σ(stack)) ·
        </span>{" "}
        <span>
          (1 + k<sub>q</sub>·((f<sub>0</sub>/f)² − 1)))
        </span>
      </p>
      <ul className="layout-terms">
        <li>
          <b>B</b>: the area of the boards.
        </li>
        <li>
          <b>
            s<sub>0</sub>
          </b>
          : the area of the window.
        </li>
        <li>
          <b>
            s<sub>v</sub>
          </b>
          ,{" "}
          <b>
            s<sub>h</sub>
          </b>
          : the area of the page past the bottom of the window, and past its right edge. So s<sub>v</sub>/s<sub>0</sub>{" "}
          is how far the page scrolls down, in window heights, and s<sub>h</sub>/s<sub>0</sub> how far it scrolls across,
          in window widths.
        </li>
        <li>
          <b>σ(s)</b>: 1 when anything scrolls, the page or the tabs inside the panel; 0 when nothing does.{" "}
          <b>σ(stack)</b>: 1 when two boards stand one over the other.
        </li>
        <li>
          <b>
            p<sub>v</sub>
          </b>
          ,{" "}
          <b>
            p<sub>h</sub>
          </b>
          ,{" "}
          <b>
            p<sub>0</sub>
          </b>
          : the same for the panel, where its tabs scroll inside it: the part of them past its bottom and past its
          right edge, and the panel&rsquo;s own area. So p<sub>v</sub>/p<sub>0</sub> is how far the tabs scroll down, in
          panel heights.
        </li>
        <li>
          <b>f</b>, <b>
            f<sub>0</sub>
          </b>
          : the size the panel&rsquo;s text is set at, and its own size; never under {MIN_TEXT_PX}&nbsp;px.
        </li>
        <li>
          <b>e(G)</b>: E&rsquo;s floor, below.
        </li>
      </ul>

      <h3 className="layout-params-subtitle">Costs</h3>
      <p className="invite-note">
        Each is how much larger the boards have to be to pay for what it counts. At 0 the thing costs nothing.
      </p>
      <div className="layout-params-fields">{COSTS.map(field)}</div>

      <h3 className="layout-params-subtitle">How strictly E is held</h3>
      <p className="layout-formula">
        <span>e(G) = 1 where G ≥ F,</span>{" "}
        <span>
          1 + th(k<sub>E</sub>·(G − F)/F) under it
        </span>
      </p>
      <ul className="layout-terms">
        <li>
          <b>G</b>: the area of the boards with their bars of men and the names or moves over and under them, as the eye
          takes them in.
        </li>
        <li>
          <b>F</b>: E&rsquo;s floor, half of a², where a is the shorter side of the window under the header.
        </li>
      </ul>
      <div className="layout-params-fields">{field(STEEPNESS)}</div>

      <h3 className="layout-params-subtitle">What every layout keeps</h3>
      <ul className="layout-terms">
        <li>
          <b>A.</b> With scrolling off, the page never scrolls. Where the panel has too little room, its text is set
          smaller, down to {MIN_TEXT_PX}&nbsp;px, or its tabs scroll inside it, or both: whichever costs less above.
        </li>
        <li>
          <b>B.</b> With scrolling on, no tab scrolls inside the panel, other than the lists that always do: the panel
          has the room its tabs need at the size their text is set at.
        </li>
        <li>
          <b>C.</b> Nothing runs out of its box: a tab either fits or scrolls.
        </li>
        <li>
          <b>D.</b> No tab runs out sideways at the width it is given.
        </li>
        <li>
          <b>E.</b> Squares of at least {MIN_SQUARE_PX}&nbsp;px. E&rsquo;s floor itself is weighed rather than kept: see above.
        </li>
        <li>
          <b>F.</b> The page scrolls one way at most: down, or across.
        </li>
      </ul>

      <p className="invite-note">Kept in this browser rather than in the settings.</p>
      <div className="pgn-dialog-actions">
        <button type="button" className="reset-button" disabled={asDefault} onClick={() => onChange({ ...DEFAULT_LAYOUT_PARAMS })}>
          Reset to defaults
        </button>
        <button type="button" className="reset-button" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
