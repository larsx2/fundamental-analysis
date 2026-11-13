import { max, min } from "d3-array";
import { scaleLinear, scalePoint } from "d3-scale";
import { curveMonotoneX, line as lineShape } from "d3-shape";
import { useId } from "react";
import type { Series, Shade, Unit } from "../../../shared/lookups";
import { tones, write, type Tip, yearLabels } from "./chart-parts";

export function LineChart({
  series,
  unit,
  shade,
  width,
  tip,
}: {
  readonly series: ReadonlyArray<Series>;
  readonly unit: Unit;
  readonly shade: ReadonlyArray<Shade>;
  readonly width: number;
  readonly tip: Tip;
}) {
  const hatch = useId();
  const height = series.length > 2 ? 230 : 190;
  const margin = { top: 14, right: 78, bottom: 30, left: 6 };
  const inner = {
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  const years = series[0]?.points.map((point) => point.fiscalYear) ?? [];
  const values = series.flatMap((each) =>
    each.points.flatMap((point) => (point.value === null ? [] : [point.value])),
  );
  const x = scalePoint<number>().domain(years).range([0, inner.width]).padding(0.2);
  const y = scaleLinear()
    .domain([Math.min(0, min(values) ?? 0), Math.max(0, max(values) ?? 1)])
    .range([inner.height, 0])
    .nice(4);
  const at = (year: number) => x(year) ?? 0;
  const ends = series
    .flatMap((each) => {
      const last = [...each.points].reverse().find((point) => point.value !== null);
      return last === undefined || last.value === null
        ? []
        : [
            {
              each,
              x: at(last.fiscalYear),
              y: y(last.value),
              value: last.value,
            },
          ];
    })
    .sort((a, b) => a.y - b.y);
  ends.forEach((end, index) => {
    const above = ends[index - 1];
    if (above !== undefined) end.y = Math.max(end.y, above.y + 15);
  });
  const showYear = yearLabels(years, inner.width);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`${series.map((each) => each.name).join(" and ")}, fiscal ${years[0]} to fiscal ${years.at(-1)}.`}
      className="block overflow-visible"
    >
      <defs>
        <pattern
          id={hatch}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="5" height="5" fill="rgb(255 255 255 / 0.05)" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="rgb(255 255 255 / 0.32)" strokeWidth="1.5" />
        </pattern>
      </defs>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {shade.map((each) => (
          <rect
            key={`${each.why}-${each.fiscalYear}`}
            x={at(each.fiscalYear) - x.step() / 2}
            width={x.step()}
            y={-margin.top + 2}
            height={inner.height + margin.top - 2}
            rx={4}
            fill={each.why === "recession" ? `url(#${hatch})` : "var(--color-chart-hover)"}
          />
        ))}
        <line className="baseline" x1={0} x2={inner.width} y1={y(0)} y2={y(0)} />
        {series.map((each) => (
          <path
            key={each.name}
            d={
              lineShape<{ fiscalYear: number; value: number | null }>()
                .defined((point) => point.value !== null)
                .x((point) => at(point.fiscalYear))
                .y((point) => y(point.value ?? 0))
                .curve(curveMonotoneX)(each.points) ?? ""
            }
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={each.dashed === true ? "5 4" : undefined}
            style={{ stroke: tones[each.tone] }}
          />
        ))}
        {ends.map((end) => (
          <g key={end.each.name}>
            <circle
              cx={end.x}
              cy={y(end.value)}
              r={4}
              style={{ fill: tones[end.each.tone] }}
              stroke="var(--color-surface-1)"
              strokeWidth={2}
            />
            <text
              className="value-text"
              x={end.x + 10}
              y={end.y + 4}
              style={{ fill: tones[end.each.tone] }}
            >
              {write(unit, end.value)}
            </text>
          </g>
        ))}
        {years.map((year, index) => (
          <text
            key={year}
            className={`year-text ${index === years.length - 1 ? "current" : ""}`}
            textAnchor="middle"
            x={at(year)}
            y={inner.height + 22}
            opacity={showYear(index) ? 1 : 0}
          >
            {year}
          </text>
        ))}
        {years.map((year) => (
          <rect
            key={year}
            x={at(year) - x.step() / 2}
            width={x.step()}
            y={-margin.top}
            height={inner.height + margin.top + 30}
            fill="transparent"
            onMouseMove={(event) =>
              tip.show(
                event,
                <>
                  <strong className="tip-title">Fiscal {year}</strong>
                  {series.map((each) => {
                    const value =
                      each.points.find((point) => point.fiscalYear === year)?.value ?? null;
                    return (
                      <span key={each.name} className="tip-row">
                        <i style={{ background: tones[each.tone] }} />
                        <strong>{value === null ? "gap" : write(unit, value)}</strong>
                        <span>{each.name}</span>
                      </span>
                    );
                  })}
                </>,
              )
            }
            onMouseLeave={tip.hide}
          />
        ))}
      </g>
    </svg>
  );
}
