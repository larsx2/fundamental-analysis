import { max, min } from "d3-array";
import { scaleLinear } from "d3-scale";
import { curveMonotoneX, line as lineShape } from "d3-shape";

// A small line of the last fiscal years in a quiet grey, with the year shown
// marked at its end. It has no scale, so it must not exaggerate: dollars are
// drawn from zero, and a margin's line spans at least four points, so a move
// of a few tenths of a point stays nearly flat.
const marginSpan = 0.04;

export function Sparkline({
  values,
  ratio,
  label,
}: {
  readonly values: ReadonlyArray<number | null>;
  readonly ratio: boolean;
  readonly label: string;
}) {
  const width = 120;
  const height = 28;
  const known = values.filter((value): value is number => value !== null);
  if (known.length < 2) return null;
  const x = scaleLinear()
    .domain([0, values.length - 1])
    .range([4, width - 4]);
  const low = min(known) ?? 0;
  const high = max(known) ?? 1;
  const middle = (low + high) / 2;
  const span = Math.max(high - low, marginSpan) / 2;
  const y = scaleLinear()
    .domain(ratio ? [middle - span, middle + span] : [Math.min(0, low), Math.max(0, high) || 1])
    .range([height - 4, 4]);
  const path = lineShape<number | null>()
    .defined((value) => value !== null)
    .x((_, index) => x(index))
    .y((value) => y(value ?? 0))
    .curve(curveMonotoneX)(values);
  const last = values.at(-1);
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
    >
      <path d={path ?? ""} fill="none" strokeWidth={1.5} strokeLinejoin="round" />
      {last !== null && last !== undefined && (
        <circle cx={x(values.length - 1)} cy={y(last)} r={3.5} />
      )}
    </svg>
  );
}
