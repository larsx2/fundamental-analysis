import { max, min } from "d3-array";
import { scaleBand, scaleLinear, scalePoint, scaleUtc } from "d3-scale";
import { curveMonotoneX, line as lineShape } from "d3-shape";
import { type ReactNode, useId, useRef } from "react";
import type { Drawing, Series, Shade, Unit } from "../../shared/lookups";
import { useChartTip } from "../chart-tip";
import { longDate, money, moneyShort, percent, perShare, signedPercent } from "../../shared/format";
import { CalculatedMark, DoubtfulMark, GapMark } from "../marks";
import { useWidth } from "../motion";
import { Term } from "../term";

const tones: Record<Series["tone"], string> = {
  white: "var(--color-text-1)",
  soft: "var(--color-text-2)",
  grey: "var(--color-bar-neutral)",
  kept: "var(--color-part-kept)",
};

const write = (unit: Unit, value: number) =>
  unit === "money"
    ? moneyShort(value)
    : unit === "perShare"
      ? perShare(value)
      : unit === "share"
        ? percent(value)
        : unit === "change"
          ? signedPercent(value)
          : `${value}¢`;

type Tip = ReturnType<typeof useChartTip>;

const yearLabels = (years: ReadonlyArray<number>, room: number) => {
  const every = Math.max(1, Math.ceil(years.length / Math.max(2, Math.floor(room / 46))));
  const last = years.length - 1;
  return (index: number) => (last - index) % every === 0;
};

function Caption({ series }: { readonly series: ReadonlyArray<Series> }) {
  return (
    <figcaption>
      {series.map((each) => (
        <span key={each.name} className="ask-key">
          <i
            className={each.dashed === true ? "dashed" : ""}
            style={{
              background: tones[each.tone],
              borderColor: tones[each.tone],
            }}
            aria-hidden="true"
          />
          {each.term === null ? each.name : <Term name={each.term}>{each.name}</Term>}
        </span>
      ))}
    </figcaption>
  );
}

function LineChart({
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

function BarChart({
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

function EconomyChart({
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

const partColors: Record<string, string> = {
  costOfRevenue: "var(--color-part-cost)",
  researchAndDevelopment: "var(--color-part-research)",
  sellingGeneralAndAdministrative: "var(--color-part-selling)",
  otherOperatingExpenses: "var(--color-part-other)",
  below: "var(--color-part-below)",
  netIncome: "var(--color-part-kept)",
};

const insideDollar = 8;

function Body({
  drawing,
  width,
  tip,
}: {
  readonly drawing: Drawing;
  readonly width: number;
  readonly tip: Tip;
}) {
  switch (drawing.kind) {
    case "lines": {
      const groups = drawing.apart ? drawing.series.map((each) => [each]) : [drawing.series];
      const side = drawing.apart && width >= 680;
      const chartWidth = side ? (width - 32) / groups.length : width;
      return (
        <div className={`multiples ${side ? "side" : ""}`}>
          {groups.map((group) => (
            <figure key={group.map((each) => each.name).join()} className="multiple">
              <Caption series={group} />
              <LineChart
                series={group}
                unit={drawing.unit}
                shade={drawing.shade}
                width={chartWidth}
                tip={tip}
              />
            </figure>
          ))}
        </div>
      );
    }
    case "bars":
      if (drawing.rows) {
        return (
          <div className="ask-rows">
            {drawing.series.map((each) => (
              <figure key={each.name} className="multiple">
                <figcaption>
                  {each.term === null ? each.name : <Term name={each.term}>{each.name}</Term>}
                </figcaption>
                <BarChart
                  series={[each]}
                  unit={drawing.unit}
                  width={width}
                  height={96}
                  highlightLast
                  tip={tip}
                />
              </figure>
            ))}
          </div>
        );
      }
      return (
        <figure className="multiple">
          {drawing.series.length > 1 && <Caption series={drawing.series} />}
          <BarChart
            series={drawing.series}
            unit={drawing.unit}
            width={width}
            height={200}
            highlightLast={drawing.series.length === 1}
            tip={tip}
          />
        </figure>
      );
    case "dollar":
      return (
        <>
          <div
            className="dollar-bar"
            role="img"
            aria-label={drawing.parts.map((part) => `${part.name} ${part.cents} cents`).join(", ")}
          >
            {drawing.parts.map((part) => (
              <span
                key={part.key}
                style={{
                  flexGrow: part.cents,
                  background: partColors[part.key],
                  color:
                    part.key === "netIncome"
                      ? "var(--color-text-on-kept)"
                      : "var(--color-text-on-part)",
                }}
              >
                {part.cents >= insideDollar ? `${part.cents}¢` : ""}
              </span>
            ))}
          </div>
          <ul className="dollar-legend">
            {drawing.parts.map((part) => (
              <li key={part.key}>
                <i style={{ background: partColors[part.key] }} aria-hidden="true" />
                <Term name={part.name} />
                {part.cents < insideDollar && <span className="numbers">{part.cents}¢</span>}
              </li>
            ))}
          </ul>
        </>
      );
    case "balance": {
      const block = (value: number, color: string, label: string, term: string) =>
        value > 0 && (
          <span style={{ flexGrow: value, background: color }}>
            {value / drawing.assets > 0.2 && (
              <>
                {label} {moneyShort(value)}
              </>
            )}
            <span className="visually-hidden">
              <Term name={term}>{label}</Term> {money(value)}
            </span>
          </span>
        );
      return (
        <div className="ask-balance">
          <div>
            <span className="ask-balance-label">What it owns</span>
            <div className="ask-balance-bar">
              {block(drawing.assets, "var(--color-text-2)", "Assets", "Asset")}
            </div>
          </div>
          <div>
            <span className="ask-balance-label">What it owes, and what is left for its owners</span>
            <div className="ask-balance-bar">
              {block(drawing.liabilities, "var(--color-bar-neutral)", "Liabilities", "Liability")}
              {drawing.equity !== null &&
                block(drawing.equity, "var(--color-part-kept)", "Equity", "Equity")}
            </div>
          </div>
        </div>
      );
    }
    case "economy":
      return (
        <>
          <figure className="multiple">
            <figcaption>
              <span className="ask-key">
                <i style={{ background: "var(--color-line-rate)" }} aria-hidden="true" />
                <Term name="Interest rate" />
              </span>
              <span className="ask-key">
                <i
                  className="dashed"
                  style={{ borderColor: "var(--color-line-inflation)" }}
                  aria-hidden="true"
                />
                <Term name="Inflation" />
              </span>
              <span className="ask-key">
                <i className="dot" aria-hidden="true" />
                <Term name="Corporate event">Corporate events</Term>
              </span>
            </figcaption>
            <EconomyChart drawing={drawing} width={width} tip={tip} />
          </figure>
          {drawing.events.length > 0 && (
            <ul className="ask-events">
              {drawing.events
                .slice(-4)
                .reverse()
                .map((event) => (
                  <li key={`${event.date}-${event.url}`}>
                    <span>
                      {event.title}.{" "}
                      <a href={event.url} target="_blank" rel="noreferrer">
                        Open the filing
                      </a>
                    </span>
                    <time dateTime={event.date}>{longDate(event.date)}</time>
                  </li>
                ))}
            </ul>
          )}
        </>
      );
    case "marks":
      return (
        <div className="table-scroll">
          <table className="figures">
            <thead>
              <tr>
                <th scope="col">Figure</th>
                <th scope="col">Dollars</th>
                <th scope="col">Filed</th>
                <th scope="col">Mark</th>
              </tr>
            </thead>
            <tbody>
              {drawing.rows.map((row) => (
                <tr key={row.name}>
                  <th scope="row">
                    <Term name={row.name} />
                  </th>
                  <td className="numbers">{row.value}</td>
                  <td className="share">{row.filedOn === null ? "" : longDate(row.filedOn)}</td>
                  <td>
                    {row.mark === "gap" ? (
                      <GapMark />
                    ) : row.mark === "doubtful" ? (
                      <DoubtfulMark />
                    ) : row.mark === "calculated" ? (
                      <CalculatedMark />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quote":
      return (
        <div className="quote">
          <blockquote cite={drawing.url}>
            <p>{drawing.text}</p>
          </blockquote>
          <p className="source">
            {drawing.source}{" "}
            <a href={drawing.url} target="_blank" rel="noreferrer">
              Read it in the filing ↗
            </a>
          </p>
        </div>
      );
  }
}

export function DrawingPanel({
  drawing,
  link,
}: {
  readonly drawing: Drawing;
  readonly link: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const width = Math.max(260, useWidth(box, 720));
  const tip = useChartTip();
  return (
    <section className="panel panel-pad ask-drawing" aria-label={drawing.title}>
      <div className="panel-title">
        <h2>{drawing.title}</h2>
        {link}
      </div>
      <div ref={box} onMouseLeave={tip.hide}>
        <Body drawing={drawing} width={width} tip={tip} />
      </div>
      {tip.element}
    </section>
  );
}
