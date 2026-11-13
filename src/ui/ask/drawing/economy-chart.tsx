import { max, min } from "d3-array";
import { scaleLinear, scaleUtc } from "d3-scale";
import { line as lineShape } from "d3-shape";
import type { Drawing } from "../../../shared/lookups";
import { longDate } from "../../../shared/format";
import { type Tip } from "./chart-parts";

export function EconomyChart({
  drawing,
  width,
  tip,
}: {
  readonly drawing: Extract<Drawing, { kind: "economy" }>;
  readonly width: number;
  readonly tip: Tip;
}) {
  const height = 220;
  const margin = { top: 14, right: 124, bottom: 46, left: 6 };
  const inner = {
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  const date = (month: string) => new Date(`${month}-15T12:00:00Z`);
  const months = drawing.months;
  const first = months[0];
  const last = months.at(-1);
  if (first === undefined || last === undefined) return null;
  const x = scaleUtc()
    .domain([date(first.month), date(last.month)])
    .range([0, inner.width]);
  const values = months.flatMap((month) =>
    [month.interestRate, month.inflation].filter((value): value is number => value !== null),
  );
  const y = scaleLinear()
    .domain([Math.min(0, min(values) ?? 0), max(values) ?? 1])
    .range([inner.height, 0])
    .nice(4);
  const lines = [
    {
      key: "interestRate",
      name: "Interest rate",
      color: "var(--color-line-rate)",
      dashed: false,
      digits: 2,
    },
    {
      key: "inflation",
      name: "Inflation",
      color: "var(--color-line-inflation)",
      dashed: true,
      digits: 1,
    },
  ] as const;
  const ends = lines
    .flatMap((each) => {
      const point = [...months].reverse().find((month) => month[each.key] !== null);
      const value = point?.[each.key];
      return value === undefined || value === null ? [] : [{ each, y: y(value), value }];
    })
    .sort((a, b) => a.y - b.y);
  ends.forEach((end, index) => {
    const above = ends[index - 1];
    if (above !== undefined) end.y = Math.max(end.y, above.y + 15);
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`The interest rate and inflation by month, with ${drawing.events.length} corporate events.`}
      className="block overflow-visible"
    >
      <g transform={`translate(${margin.left},${margin.top})`}>
        {months
          .filter((month) => month.recession)
          .map((month) => (
            <rect
              key={month.month}
              x={x(date(month.month)) - 3}
              width={6}
              y={0}
              height={inner.height}
              fill="var(--color-chart-hover)"
            />
          ))}
        <line className="baseline" x1={0} x2={inner.width} y1={y(0)} y2={y(0)} />
        {lines.map((each) => (
          <path
            key={each.key}
            d={
              lineShape<(typeof months)[number]>()
                .defined((month) => month[each.key] !== null)
                .x((month) => x(date(month.month)))
                .y((month) => y(month[each.key] ?? 0))(months) ?? ""
            }
            fill="none"
            strokeWidth={2}
            strokeDasharray={each.dashed ? "5 4" : undefined}
            style={{ stroke: each.color }}
          />
        ))}
        {ends.map((end) => (
          <text
            key={end.each.key}
            className="value-text"
            x={inner.width + 8}
            y={end.y + 4}
            style={{ fill: end.each.color }}
          >
            {end.each.name} {end.value.toFixed(end.each.digits)}%
          </text>
        ))}
        {drawing.events.map((event) => (
          <circle
            key={`${event.date}-${event.url}`}
            cx={x(new Date(`${event.date}T12:00:00Z`))}
            cy={inner.height + 12}
            r={4.5}
            fill="var(--color-text-2)"
            stroke="var(--color-surface-1)"
            strokeWidth={2}
            onMouseMove={(mouse) =>
              tip.show(
                mouse,
                <>
                  <strong className="tip-title">{longDate(event.date)}</strong>
                  <span>{event.title}</span>
                </>,
              )
            }
            onMouseLeave={tip.hide}
          />
        ))}
        {x.ticks(6).map((tick) => (
          <text
            key={tick.toISOString()}
            className="year-text"
            textAnchor="middle"
            x={x(tick)}
            y={inner.height + 36}
          >
            {tick.getUTCFullYear()}
          </text>
        ))}
      </g>
    </svg>
  );
}
