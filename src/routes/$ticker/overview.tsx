import { createFileRoute } from "@tanstack/react-router";
import { max } from "d3-array";
import { scalePoint, scaleLinear } from "d3-scale";
import { curveMonotoneX, line as lineShape } from "d3-shape";
import { motion } from "motion/react";
import { type ReactNode, useRef, useState } from "react";
import type { StatementYear } from "../../functions/company";
import { valueOf } from "../../shared/figures";
import { useChartTip } from "../../ui/chart-tip";
import {
  CompanyFrame,
  type ReadyCompany,
  searchYear,
  useReadyCompany,
} from "../../ui/company-frame";
import { useChooseYear } from "../../ui/company-header";
import {
  axisMoney,
  filingUrl,
  longDate,
  money,
  moneyParts,
  moneyShort,
  percent,
  signedPercent,
  signedPoints,
  yearOverYear,
} from "../../ui/format";
import { shortName } from "../../ui/logo-tile";
import { GapMark, Marks } from "../../ui/marks";
import { glide, useMounted, useStill, useWidth } from "../../ui/motion";
import { type FigureKey, figureOf } from "../../ui/own-figure";
import { Segmented } from "../../ui/segmented";
import { Term } from "../../ui/term";

export const Route = createFileRoute("/$ticker/overview")({
  validateSearch: (search: Record<string, unknown>): { year?: number | undefined } => {
    const year = searchYear(search);
    return year === undefined ? {} : { year };
  },
  component: Overview,
});

function Overview() {
  const { ticker } = Route.useParams();
  const search = Route.useSearch();
  const { view, years, year } = useReadyCompany(ticker, search.year);
  const name = shortName(view.name);
  const [show, setShow] = useState<"chart" | "table">("chart");
  const chooseYear = useChooseYear();
  const first = years[0]!;
  const last = years.at(-1)!;
  const span = last.fiscalYear - first.fiscalYear;
  const rate = (key: FigureKey) => {
    const a = valueOf(figureOf(first, key));
    const b = valueOf(figureOf(last, key));
    return a !== null && b !== null && a > 0 && b > 0 && span > 0
      ? percent((b / a) ** (1 / span) - 1)
      : null;
  };
  const revenueRate = rate("revenue");
  const netRate = rate("netIncome");

  return (
    <CompanyFrame view={view} year={year} active="overview" title="overview">
      <div className="intro">
        <Plain name={name} years={years} year={year} />
        <Quote view={view} />
      </div>
      <section className="panel panel-pad" aria-labelledby="chart-title">
        <div className="panel-title">
          <h2 id="chart-title">
            <Term name="Revenue" /> and <Term name="Net income">net income</Term>
          </h2>
          <Segmented
            label="Show as"
            value={show}
            onChange={setShow}
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
        </div>
        {revenueRate !== null && netRate !== null && (
          <p className="verdict mt-0">
            From fiscal {first.fiscalYear} to fiscal {last.fiscalYear}, revenue grew at a{" "}
            <Term name="Compound annual growth rate">compound annual growth rate</Term> of{" "}
            {revenueRate} and net income at {netRate}.
          </p>
        )}
        {show === "chart" ? (
          <>
            <div className="legend legend-lines mb-3">
              <span>
                <i style={{ background: "var(--color-text-1)" }} />
                Revenue
              </span>
              <span>
                <i style={{ background: "var(--color-part-kept)" }} />
                Net income
              </span>
            </div>
            <Lines name={name} years={years} year={year} onChoose={(fy) => void chooseYear(fy)} />
          </>
        ) : (
          <YearsTable years={years} year={year} onChoose={(fy) => void chooseYear(fy)} />
        )}
      </section>
      <KeyFigures years={years} year={year} />
    </CompanyFrame>
  );
}

const grewText = (now: number | null, then: number | null) => {
  const delta = yearOverYear(now, then);
  if (delta === null) return null;
  if (Math.abs(delta) < 0.0005) return "stayed the same";
  return `${delta > 0 ? "grew" : "fell"} ${percent(Math.abs(delta))}`;
};

// What the company is and whether it is growing, worked out from its numbers.
function Plain({
  name,
  years,
  year,
}: {
  readonly name: string;
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
}) {
  const before = years.find((each) => each.fiscalYear === year.fiscalYear - 1);
  const revenue = valueOf(year.terms.revenue);
  const net = valueOf(year.terms.netIncome);
  const revenueMove =
    before === undefined ? null : grewText(revenue, valueOf(before.terms.revenue));
  const netMove = before === undefined ? null : grewText(net, valueOf(before.terms.netIncome));
  const upTo = years.filter((each) => each.fiscalYear <= year.fiscalYear);
  let rises = 0;
  for (let index = 1; index < upTo.length; index++) {
    const now = valueOf(upTo[index]!.terms.revenue);
    const then = valueOf(upTo[index - 1]!.terms.revenue);
    if (now !== null && then !== null && now > then) rises += 1;
  }
  const spanCount = upTo.length - 1;
  const kept =
    revenue !== null && net !== null && revenue > 0 ? Math.round((net / revenue) * 100) : null;

  return (
    <section aria-label="In plain words">
      <div className="eyebrow">{name} in plain words</div>
      <p className="overview-lead">
        {revenue === null
          ? `${name}'s revenue for fiscal ${year.fiscalYear} is a gap.`
          : kept !== null && kept > 0
            ? `${name} brought in ${money(revenue)} in fiscal ${year.fiscalYear} and kept ${kept}¢ of each dollar.`
            : `${name} brought in ${money(revenue)} in fiscal ${year.fiscalYear} and kept nothing: its net income was a loss.`}
      </p>
      <p className="sentence">
        {revenueMove !== null && netMove !== null && revenue !== null && net !== null ? (
          <>
            In fiscal {year.fiscalYear} its <Term name="Revenue">revenue</Term> {revenueMove} to{" "}
            <strong>{money(revenue)}</strong>, and its <Term name="Net income">net income</Term>{" "}
            {netMove} to <strong>{money(net)}</strong>.
          </>
        ) : (
          <>
            In fiscal {year.fiscalYear} its <Term name="Revenue">revenue</Term> was{" "}
            <strong>{revenue === null ? "a gap" : money(revenue)}</strong> and its{" "}
            <Term name="Net income">net income</Term>{" "}
            <strong>{net === null ? "a gap" : money(net)}</strong>.
          </>
        )}
        {spanCount >= 3 &&
          ` Since fiscal ${upTo[0]!.fiscalYear}, revenue has grown in ${rises === spanCount ? `all ${spanCount}` : `${rises} of ${spanCount}`} fiscal years.`}
      </p>
    </section>
  );
}

// In its own words: the opening of the business description in its latest annual report.
function Quote({ view }: { readonly view: ReadyCompany }) {
  const description = view.details.description;
  const name = shortName(view.name);
  if (description === null) {
    return (
      <section className="panel quote" aria-labelledby="quote-title">
        <h2 className="eyebrow m-0 font-normal" id="quote-title">
          In its own words
        </h2>
        <p className="mt-3 mb-0 text-text-2">
          The business description in {name}'s{" "}
          <Term name="Annual report (10-K)">annual report (10-K)</Term> is a <GapMark />: the tool
          could not find its opening yet.
        </p>
      </section>
    );
  }
  const url = filingUrl(view.cik, description.accession, description.document);
  return (
    <section className="panel quote" aria-labelledby="quote-title">
      <h2 className="eyebrow m-0 font-normal" id="quote-title">
        In its own words
      </h2>
      <blockquote cite={url}>
        <p>{description.text}</p>
      </blockquote>
      <p className="source">
        The opening of the business description in its{" "}
        <Term name="Annual report (10-K)">annual report (10-K)</Term> filed on{" "}
        {longDate(description.filedOn)}.{" "}
        <a href={url} target="_blank" rel="noreferrer">
          Read it in the filing {"↗"}
        </a>
      </p>
    </section>
  );
}

const series = [
  { key: "revenue", name: "Revenue", color: "var(--color-text-1)" },
  { key: "netIncome", name: "Net income", color: "var(--color-part-kept)" },
] as const;

function Lines({
  name,
  years,
  year,
  onChoose,
}: {
  readonly name: string;
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
  readonly onChoose: (fiscalYear: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const still = useStill();
  const tip = useChartTip();
  const width = Math.max(260, useWidth(box));
  const narrow = width < 560;
  const height = narrow ? 280 : 380;
  if (!mounted) return <div ref={box} style={{ height }} />;

  const margin = {
    top: 16,
    right: narrow ? 12 : 20,
    bottom: 36,
    left: narrow ? 46 : 56,
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const x = scalePoint<number>()
    .domain(years.map((each) => each.fiscalYear))
    .range([0, innerWidth])
    .padding(0.35);
  const y = scaleLinear()
    .domain([0, max(years, (each) => valueOf(each.terms.revenue)) ?? 1])
    .range([innerHeight, 0])
    .nice();
  const transition = still ? { duration: 0 } : glide;
  const cx = x(year.fiscalYear) ?? 0;
  const onLeft = cx > innerWidth - (narrow ? 70 : 90);
  const placed = series
    .map((each) => ({ each, value: valueOf(year.terms[each.key]) }))
    .filter(
      (point): point is { each: (typeof series)[number]; value: number } => point.value !== null,
    )
    .map((point) => {
      const dot = y(point.value);
      const below = dot + 20;
      return {
        ...point,
        at: point.each.key === "revenue" || below > innerHeight - 4 ? dot - 10 : below,
      };
    });
  if (placed.length === 2 && Math.abs(placed[0]!.at - placed[1]!.at) < 18)
    placed[0]!.at = placed[1]!.at - 18;
  const chosenIndex = years.indexOf(year);
  const every = narrow ? 3 : years.length > 14 ? 2 : 1;
  const lastIndex = years.length - 1;
  const showYear = (index: number) => {
    if (index === chosenIndex) return true;
    if (Math.abs(index - chosenIndex) < every) return false;
    return index % every === lastIndex % every;
  };

  return (
    <div ref={box}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`Lines of ${name}'s revenue and net income from fiscal ${years[0]?.fiscalYear} to fiscal ${years.at(-1)?.fiscalYear}. Fiscal ${year.fiscalYear} is marked.`}
        className="block overflow-visible"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {y.ticks(narrow ? 3 : 4).map((tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              {tick !== 0 && <line className="grid-line" x1={0} x2={innerWidth} />}
              <text className="axis-text" x={-10} textAnchor="end" dy="0.32em">
                {axisMoney(tick)}
              </text>
            </g>
          ))}
          <line className="baseline" x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} />
          <motion.line
            initial={false}
            animate={{ x1: cx, x2: cx }}
            y1={0}
            y2={innerHeight}
            transition={transition}
            stroke="rgb(255 255 255 / 0.22)"
            strokeDasharray="2 3"
          />
          {series.map((each) => {
            const path = lineShape<StatementYear>()
              .defined((point) => valueOf(point.terms[each.key]) !== null)
              .x((point) => x(point.fiscalYear) ?? 0)
              .y((point) => y(valueOf(point.terms[each.key]) ?? 0))
              .curve(curveMonotoneX)(years);
            return (
              <motion.path
                key={each.key}
                d={path ?? ""}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ stroke: each.color }}
                initial={still ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={still ? { duration: 0 } : { duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
              />
            );
          })}
          {series.flatMap((each) =>
            years.map((point) => {
              const value = valueOf(point.terms[each.key]);
              if (value === null) return null;
              return (
                <motion.circle
                  key={`${each.key}-${point.fiscalYear}`}
                  cx={x(point.fiscalYear) ?? 0}
                  cy={y(value)}
                  initial={false}
                  animate={{ r: point === year ? 5 : narrow ? 0 : 2.5 }}
                  transition={transition}
                  style={{ fill: each.color }}
                  stroke="var(--color-surface-1)"
                  strokeWidth={2}
                />
              );
            }),
          )}
          {placed.map((point) => (
            <motion.text
              key={point.each.key}
              className="value-text"
              style={{ fill: point.each.color }}
              textAnchor={onLeft ? "end" : "start"}
              initial={false}
              animate={{ x: cx + (onLeft ? -10 : 10), y: point.at }}
              transition={transition}
            >
              {moneyShort(point.value)}
            </motion.text>
          ))}
          {years.map((point, index) => (
            <text
              key={point.fiscalYear}
              className={`year-text ${point === year ? "current" : ""}`}
              textAnchor="middle"
              x={x(point.fiscalYear) ?? 0}
              y={innerHeight + 24}
              opacity={showYear(index) ? 1 : 0}
            >
              {point.fiscalYear}
            </text>
          ))}
          {years.map((point) => (
            <rect
              key={point.fiscalYear}
              x={(x(point.fiscalYear) ?? 0) - x.step() / 2}
              width={x.step()}
              y={0}
              height={innerHeight + 32}
              fill="transparent"
              className="cursor-pointer"
              onMouseMove={(event) =>
                tip.show(
                  event,
                  <>
                    <strong>Fiscal {point.fiscalYear}</strong>
                    <br />
                    Revenue {money(valueOf(point.terms.revenue) ?? 0)}
                    <br />
                    Net income {money(valueOf(point.terms.netIncome) ?? 0)}
                  </>,
                )
              }
              onMouseLeave={tip.hide}
              onClick={() => onChoose(point.fiscalYear)}
            />
          ))}
        </g>
      </svg>
      {tip.element}
    </div>
  );
}

function YearsTable({
  years,
  year,
  onChoose,
}: {
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
  readonly onChoose: (fiscalYear: number) => void;
}) {
  const change = (point: StatementYear, key: "revenue" | "netIncome") => {
    const before = years.find((each) => each.fiscalYear === point.fiscalYear - 1);
    const delta =
      before === undefined
        ? null
        : yearOverYear(valueOf(point.terms[key]), valueOf(before.terms[key]));
    return delta === null ? "" : signedPercent(delta);
  };
  return (
    <div className="table-scroll">
      <table className="figures years-table">
        <thead>
          <tr>
            <th scope="col">
              <Term name="Fiscal year" />
            </th>
            <th scope="col">
              <Term name="Revenue" />
            </th>
            <th scope="col">Change</th>
            <th scope="col">
              <Term name="Net income" />
            </th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {years.map((point) => {
            const revenue = valueOf(point.terms.revenue);
            const net = valueOf(point.terms.netIncome);
            return (
              <tr key={point.fiscalYear} aria-current={point === year ? "true" : undefined}>
                <th scope="row">
                  <button
                    type="button"
                    className="link-button no-underline"
                    onClick={() => onChoose(point.fiscalYear)}
                  >
                    Fiscal {point.fiscalYear}
                  </button>
                </th>
                <td className="text-text-1">{revenue === null ? <GapMark /> : money(revenue)}</td>
                <td>
                  <span className="change">{change(point, "revenue")}</span>
                </td>
                <td className="text-text-1">{net === null ? <GapMark /> : money(net)}</td>
                <td>
                  <span className="change">{change(point, "netIncome")}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KeyFigures({
  years,
  year,
}: {
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
}) {
  const before = years.find((each) => each.fiscalYear === year.fiscalYear - 1);
  const moneyTile = (key: FigureKey) => {
    const figure = figureOf(year, key);
    const value = valueOf(figure);
    const delta = before === undefined ? null : yearOverYear(value, valueOf(figureOf(before, key)));
    const { amount, unit } = value === null ? { amount: "", unit: "" } : moneyParts(value);
    return {
      value:
        value === null ? (
          <GapMark />
        ) : (
          <>
            {amount}
            {unit !== "" && <small> {unit}</small>}
          </>
        ),
      change:
        before === undefined || delta === null
          ? null
          : Math.abs(delta) < 0.0005
            ? `unchanged since fiscal ${before.fiscalYear}`
            : `${signedPercent(delta)} since fiscal ${before.fiscalYear}`,
      figure,
    };
  };
  const ratioTile = (key: FigureKey) => {
    const figure = figureOf(year, key);
    const value = valueOf(figure);
    const then = before === undefined ? null : valueOf(figureOf(before, key));
    return {
      value: value === null ? <GapMark /> : <>{percent(value)}</>,
      change:
        before === undefined || value === null || then === null
          ? null
          : `${signedPoints((value - then) * 100)} since fiscal ${before.fiscalYear}`,
      figure,
    };
  };
  const tiles: ReadonlyArray<{
    term: string;
    tile: ReturnType<typeof moneyTile>;
    marksFrom: FigureKey;
  }> = [
    { term: "Revenue", tile: moneyTile("revenue"), marksFrom: "revenue" },
    {
      term: "Gross margin",
      tile: ratioTile("grossMargin"),
      marksFrom: "grossProfit",
    },
    {
      term: "Operating margin",
      tile: ratioTile("operatingMargin"),
      marksFrom: "operatingIncome",
    },
    {
      term: "Net income",
      tile: moneyTile("netIncome"),
      marksFrom: "netIncome",
    },
    {
      term: "Free cash flow",
      tile: moneyTile("freeCashFlow"),
      marksFrom: "freeCashFlow",
    },
    { term: "Cash", tile: moneyTile("cash"), marksFrom: "cash" },
    { term: "Debt", tile: moneyTile("debt"), marksFrom: "debt" },
  ];
  const gross = valueOf(year.terms.grossMargin);
  const grossBefore = before === undefined ? null : valueOf(before.terms.grossMargin);

  return (
    <section aria-labelledby="strip-title">
      <h2 id="strip-title" className="mt-8 mb-3 text-m font-semibold">
        Key figures for fiscal {year.fiscalYear}
      </h2>
      <div className="strip">
        {tiles.map(({ term, tile, marksFrom }) => (
          <Tile
            key={term}
            term={term}
            value={tile.value}
            change={tile.change}
            marks={<Marks figure={figureOf(year, marksFrom)} />}
          />
        ))}
      </div>
      <p className="mt-3 mb-0 text-xs text-text-3">
        {before === undefined ? (
          `Fiscal ${year.fiscalYear} is the first fiscal year collected here, so there is no change to show. `
        ) : (
          <>
            Each change is the <Term name="Year-over-year change">year-over-year change</Term>{" "}
            against fiscal {before.fiscalYear}.{" "}
            {gross !== null && grossBefore !== null && Math.abs(gross - grossBefore) >= 0.0005
              ? `A margin moves in points: gross margin went from ${percent(grossBefore)} to ${percent(gross)}, ${signedPoints((gross - grossBefore) * 100)}. `
              : ""}
          </>
        )}
        Cash and debt are counted on the last day of the fiscal year.
      </p>
    </section>
  );
}

function Tile({
  term,
  value,
  change,
  marks,
}: {
  readonly term: string;
  readonly value: ReactNode;
  readonly change: string | null;
  readonly marks: ReactNode;
}) {
  return (
    <div className="tile">
      <div className="tile-label">
        <Term name={term} />
      </div>
      <div className="tile-value numbers">{value}</div>
      <div className="change">{change ?? " "}</div>
      <div>{marks}</div>
    </div>
  );
}
