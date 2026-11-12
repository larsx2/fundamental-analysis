import { createFileRoute } from "@tanstack/react-router";
import { max, min } from "d3-array";
import { scalePoint, scaleLinear } from "d3-scale";
import { area as areaShape, curveMonotoneX, line as lineShape } from "d3-shape";
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
          <Lines name={name} years={years} year={year} onChoose={(fy) => void chooseYear(fy)} />
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

// Revenue and net income are drawn as two charts that share the fiscal
// years, each with its own dollar scale. On one scale, net income lies flat
// along the bottom for a company like Costco, which keeps about 3¢ of each
// dollar, and its growth cannot be seen.
const series = [
  {
    key: "revenue",
    name: "Revenue",
    color: "var(--color-text-1)",
    wash: "rgb(244 244 242 / 0.07)",
  },
  {
    key: "netIncome",
    name: "Net income",
    color: "var(--color-part-kept)",
    wash: "rgb(0 131 0 / 0.16)",
  },
] as const;

type Series = (typeof series)[number];

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
  const tip = useChartTip();
  const [hovered, setHovered] = useState<number | null>(null);
  const width = Math.max(260, useWidth(box));
  const side = width >= 760;
  const gap = 32;
  const chartWidth = side ? (width - gap) / 2 : width;
  const height = side ? 300 : 220;
  const reserved = side ? height + 36 : (height + 36) * 2 + gap;
  if (!mounted) return <div ref={box} style={{ height: reserved }} />;

  const hover = (event: { clientX: number; clientY: number }, point: StatementYear) => {
    setHovered(point.fiscalYear);
    tip.show(
      event,
      <>
        <strong className="tip-title">Fiscal {point.fiscalYear}</strong>
        {series.map((each) => {
          const value = valueOf(point.terms[each.key]);
          return (
            <span key={each.key} className="tip-row">
              <i style={{ background: each.color }} />
              <strong>{value === null ? "gap" : money(value)}</strong>
              <span>{each.name}</span>
            </span>
          );
        })}
      </>,
    );
  };
  const leave = () => {
    setHovered(null);
    tip.hide();
  };

  return (
    <div ref={box} className={`multiples ${side ? "side" : ""}`} onMouseLeave={leave}>
      {series.map((each) => (
        <Multiple
          key={each.key}
          name={name}
          each={each}
          years={years}
          year={year}
          hovered={hovered}
          width={chartWidth}
          height={height}
          onHover={hover}
          onChoose={onChoose}
        />
      ))}
      {tip.element}
    </div>
  );
}

function Multiple({
  name,
  each,
  years,
  year,
  hovered,
  width,
  height,
  onHover,
  onChoose,
}: {
  readonly name: string;
  readonly each: Series;
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
  readonly hovered: number | null;
  readonly width: number;
  readonly height: number;
  readonly onHover: (event: { clientX: number; clientY: number }, point: StatementYear) => void;
  readonly onChoose: (fiscalYear: number) => void;
}) {
  const still = useStill();
  const narrow = width < 420;
  const margin = { top: 24, right: 12, bottom: 32, left: narrow ? 46 : 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const values = years.map((point) => valueOf(point.terms[each.key]));
  const known = values.filter((value): value is number => value !== null);
  const x = scalePoint<number>()
    .domain(years.map((point) => point.fiscalYear))
    .range([0, innerWidth])
    .padding(0.3);
  const y = scaleLinear()
    .domain([Math.min(0, min(known) ?? 0), Math.max(0, max(known) ?? 1)])
    .range([innerHeight, 0])
    .nice(4);
  const transition = still ? { duration: 0 } : glide;
  const at = (point: StatementYear) => x(point.fiscalYear) ?? 0;
  const valueAt = (point: StatementYear) => valueOf(point.terms[each.key]);
  const line = lineShape<StatementYear>()
    .defined((point) => valueAt(point) !== null)
    .x(at)
    .y((point) => y(valueAt(point) ?? 0))
    .curve(curveMonotoneX)(years);
  const wash = areaShape<StatementYear>()
    .defined((point) => valueAt(point) !== null)
    .x(at)
    .y0(y(0))
    .y1((point) => y(valueAt(point) ?? 0))
    .curve(curveMonotoneX)(years);

  const chosen = valueAt(year);
  const cx = at(year);
  const cy = chosen === null ? null : y(chosen);
  const labelLeft = cx > innerWidth - 80;
  const labelBelow = cy !== null && cy < 22;
  const shown = years.find((point) => point.fiscalYear === hovered);
  const shownValue = shown === undefined ? null : valueAt(shown);

  const chosenIndex = years.indexOf(year);
  const every = Math.max(1, Math.ceil(years.length / Math.max(2, Math.floor(innerWidth / 64))));
  const lastIndex = years.length - 1;
  const showYear = (index: number) => {
    if (index === chosenIndex) return true;
    if (Math.abs(index - chosenIndex) < every) return false;
    return index % every === lastIndex % every;
  };

  return (
    <figure className="multiple">
      <figcaption>
        <i style={{ background: each.color }} aria-hidden="true" />
        <Term name={each.name} />
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`${name}'s ${each.name.toLowerCase()} from fiscal ${years[0]?.fiscalYear} to fiscal ${years.at(-1)?.fiscalYear}${chosen === null ? "" : `, ${money(chosen)} in fiscal ${year.fiscalYear}`}.`}
        className="block overflow-visible"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {y.ticks(3).map((tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              <line className={tick === 0 ? "baseline" : "grid-line"} x1={0} x2={innerWidth} />
              <text className="axis-text" x={-10} textAnchor="end" dy="0.32em">
                {axisMoney(tick)}
              </text>
            </g>
          ))}
          <path d={wash ?? ""} style={{ fill: each.wash }} />
          <motion.path
            d={line ?? ""}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ stroke: each.color }}
            initial={still ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={still ? { duration: 0 } : { duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.line
            initial={false}
            animate={{ x1: cx, x2: cx }}
            y1={0}
            y2={innerHeight}
            transition={transition}
            className="chosen-line"
          />
          {shown !== undefined && shown !== year && (
            <g>
              <line className="hover-line" x1={at(shown)} x2={at(shown)} y1={0} y2={innerHeight} />
              {shownValue !== null && (
                <circle
                  cx={at(shown)}
                  cy={y(shownValue)}
                  r={4}
                  style={{ fill: each.color }}
                  stroke="var(--color-surface-1)"
                  strokeWidth={2}
                />
              )}
            </g>
          )}
          {cy !== null && chosen !== null && (
            <>
              <motion.circle
                initial={false}
                animate={{ cx, cy }}
                transition={transition}
                r={4.5}
                style={{ fill: each.color }}
                stroke="var(--color-surface-1)"
                strokeWidth={2}
              />
              <motion.text
                className="value-text"
                textAnchor={labelLeft ? "end" : "start"}
                initial={false}
                animate={{
                  x: cx + (labelLeft ? -10 : 10),
                  y: labelBelow ? cy + 20 : cy - 10,
                }}
                transition={transition}
              >
                {moneyShort(chosen)}
              </motion.text>
            </>
          )}
          {years.map((point, index) => (
            <text
              key={point.fiscalYear}
              className={`year-text ${point === year ? "current" : ""}`}
              textAnchor="middle"
              x={at(point)}
              y={innerHeight + 22}
              opacity={showYear(index) ? 1 : 0}
            >
              {point.fiscalYear}
            </text>
          ))}
          {years.map((point) => (
            <rect
              key={point.fiscalYear}
              x={at(point) - x.step() / 2}
              width={x.step()}
              y={-margin.top}
              height={innerHeight + margin.top + 30}
              fill="transparent"
              className="cursor-pointer"
              onMouseMove={(event) => onHover(event, point)}
              onClick={() => onChoose(point.fiscalYear)}
            />
          ))}
        </g>
      </svg>
    </figure>
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
