interface SliderFieldProps {
  id: string;
  /** What each end of the travel means, said at that end. */
  from: string;
  to: string;
  value: number;
  /** The values worth marking under the track, e.g. `[0, 0.5, 1]`. */
  ticks?: number[];
  step?: number;
  hint?: string;
  onChange: (value: number) => void;
}

/**
 * A setting that is a place between two ways of doing something, rather than a
 * quantity of anything.
 *
 * Named at its ends and not by a label above it: what the number means is
 * "nearer this than that", and the two names are the whole of the explanation.
 * The figure itself is on the handle's own scale, marked underneath.
 */
export default function SliderField({
  id,
  from,
  to,
  value,
  ticks = [],
  step = 0.01,
  hint,
  onChange,
}: SliderFieldProps) {
  return (
    <div className="slider-field" title={hint}>
      {/* First row, middle column: what the handle currently says. */}
      <output className="slider-value" htmlFor={id}>
        {String(Math.round(value * 100) / 100)}
      </output>
      <label className="slider-end slider-from" htmlFor={id}>
        {from}
      </label>
      <input
        id={id}
        type="range"
        className="slider-track"
        min={0}
        max={1}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="slider-end slider-to">{to}</span>
      {/* Second row, middle column: the figures line up with the travel they
          mark rather than with the row, which the names at the ends widen. */}
      {ticks.length > 0 && (
        <div className="slider-ticks" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ left: `${tick * 100}%` }}>
              {tick}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
