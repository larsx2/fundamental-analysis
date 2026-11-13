import { max, min } from "d3-array";
import { scaleBand, scaleLinear } from "d3-scale";
import type { Series, Unit } from "../../../shared/lookups";
import { tones, write, type Tip, yearLabels } from "./chart-parts";

export function BarChart({
  series,
  unit,
  width,
  height,
  highlightLast,
  tip,
}: {
  readonly series: ReadonlyArray<Series>;
  readonly unit: Unit;
  readonly width: number;
  readonly height: number;
  readonly highlightLast: boolean;
  readonly tip: Tip;
}) {
  const margin = { top: 18, right: 4, bottom: 26, left: 4 };
  const inner = {
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  const years = series[0]?.points.map((point) => point.fiscalYear) ?? [];
  const values = series.flatMap((each) =>
    each.points.flatMap((point) => (point.value === null ? [] : [point.value])),
  );
  const x = scaleBand<number>().domain(years).range([0, inner.width]).padding(0.28);
  const group = scaleBand<number>()
    .domain(series.map((_, index) => index))
    .range([0, x.bandwidth()])
    .padding(series.length > 1 ? 0.1 : 0);
  const y = scaleLinear()
    .domain([Math.min(0, min(values) ?? 0), Math.max(0, max(values) ?? 1) || 1])
    .range([inner.height, 0])
    .nice(4);
  const showYear = yearLabels(years, inner.width);
  const lastYear = years.at(-1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`${series.map((each) => each.name).join(" and ")}, fiscal ${years[0]} to fiscal ${lastYear}.`}
      className="block overflow-visible"
    >
      <g transform={`translate(${margin.left},${margin.top})`}>
        <line className="baseline" x1={0} x2={inner.width} y1={y(0)} y2={y(0)} />
        {series.map((each, index) =>
          each.points.map((point) => {
            const left = (x(point.fiscalYear) ?? 0) + (group(index) ?? 0);
            if (point.value === null) {
              return (
                <rect
                  key={`${each.name}-${point.fiscalYear}`}
                  x={left + 1}
                  y={y(0) - 8}
                  width={Math.max(1, group.bandwidth() - 2)}
                  height={8}
                  rx={2}
                  fill="none"
                  stroke="var(--color-text-3)"
                  strokeDasharray="2 2"
                />
              );
            }
            const latest = highlightLast && point.fiscalYear === lastYear;
            return (
              <rect
                key={`${each.name}-${point.fiscalYear}`}
                x={left}
                y={Math.min(y(point.value), y(0))}
                width={group.bandwidth()}
                height={Math.max(1, Math.abs(y(point.value) - y(0)))}
                rx={2}
                style={{
                  fill: latest ? "var(--color-text-2)" : tones[each.tone],
                }}
              />
            );
          }),
        )}
        {series.length === 1 &&
          series.map((each) => {
            const last = each.points.at(-1);
            if (last === undefined || last.value === null) return null;
            return (
              <text
                key={each.name}
                className="value-text"
                textAnchor="end"
                x={(x(last.fiscalYear) ?? 0) + x.bandwidth()}
                y={last.value >= 0 ? y(last.value) - 6 : y(last.value) + 14}
              >
                {write(unit, last.value)}
              </text>
            );
          })}
        {years.map((year, index) => (
          <text
            key={year}
            className={`year-text ${year === lastYear ? "current" : ""}`}
            textAnchor="middle"
            x={(x(year) ?? 0) + x.bandwidth() / 2}
            y={inner.height + 19}
            opacity={showYear(index) ? 1 : 0}
          >
            {year}
          </text>
        ))}
        {years.map((year) => (
          <rect
            key={year}
            x={(x(year) ?? 0) - (x.step() - x.bandwidth()) / 2}
            width={x.step()}
            y={-margin.top}
            height={inner.height + margin.top + 26}
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
