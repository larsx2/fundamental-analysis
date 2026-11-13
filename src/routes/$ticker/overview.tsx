import { Link, createFileRoute } from "@tanstack/react-router";
import { max, min } from "d3-array";
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
  centsOfDollar,
  filingUrl,
  longDate,
  money,
  moneyParts,
  moneyShort,
  percent,
  perShare,
  signedPercent,
  signedPoints,
  yearOverYear,
} from "../../shared/format";
import { shortName } from "../../ui/logo-tile";
import { GapMark, Marks } from "../../ui/marks";
import { yearParts } from "../../shared/money-flow-parts";
import { glide, useMounted, useStill, useWidth } from "../../ui/motion";
import { type FigureKey, figureOf } from "../../shared/figure-keys";
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
  // Growth is measured over the ten fiscal years that end with the one shown.
  const decade = years.filter((each) => each.fiscalYear <= year.fiscalYear).slice(-11);
  const growth = growthLine(decade);

  return (
    <CompanyFrame view={view} year={year} active="overview" title="overview">
      <div className="intro">
        <Lead name={name} years={years} year={year} />
        <Quote view={view} latest={year === years.at(-1)} />
      </div>
      <DollarBar ticker={view.ticker} year={year} />
      <KeyFigures years={years} year={year} />
      <section className="panel panel-pad mt-10" aria-labelledby="chart-title">
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
        {growth !== null && <p className="verdict mt-0">{growth}</p>}
        {show === "chart" ? (
          <Lines name={name} years={years} year={year} onChoose={(fy) => void chooseYear(fy)} />
        ) : (
          <YearsTable years={years} year={year} onChoose={(fy) => void chooseYear(fy)} />
        )}
      </section>
      <CashUse ticker={view.ticker} name={name} year={year} />
    </CompanyFrame>
  );
}

const grewText = (now: number | null, then: number | null) => {
  const delta = yearOverYear(now, then);
  if (delta === null) return null;
  if (Math.abs(delta) < 0.0005) return "stayed the same";
  return `${delta > 0 ? "grew" : "fell"} ${percent(Math.abs(delta))}`;
};

// A loss on either side makes a growth rate meaningless, so the sentence
// says what happened instead.
const netIncomeMove = (now: number | null, then: number | null) => {
  if (now === null || then === null) return null;
  if (now > 0 && then > 0) return grewText(now, then);
  if (now > 0) return "turned positive after a loss";
  if (then > 0) return "turned to a loss";
  return "was a loss again";
};

const growthLine = (range: ReadonlyArray<StatementYear>): ReactNode => {
  const first = range[0];
  const last = range.at(-1);
  if (first === undefined || last === undefined || first === last) return null;
  const span = last.fiscalYear - first.fiscalYear;
  const rateOf = (a: number | null, b: number | null) =>
    a !== null && b !== null && a > 0 && b > 0 ? percent((b / a) ** (1 / span) - 1) : null;
  const revenueRate = rateOf(valueOf(first.terms.revenue), valueOf(last.terms.revenue));
  const netThen = valueOf(first.terms.netIncome);
  const netNow = valueOf(last.terms.netIncome);
  const netRate = rateOf(netThen, netNow);
  const net =
    netRate !== null
      ? `net income at ${netRate}`
      : netThen !== null && netNow !== null && netThen <= 0 && netNow > 0
        ? `net income went from a loss of ${money(-netThen)} to ${money(netNow)}`
        : netNow !== null && netNow <= 0
          ? `net income was a loss of ${money(-netNow)} in fiscal ${last.fiscalYear}`
          : null;
  if (revenueRate === null && net === null) return null;
  return (
    <>
      From fiscal {first.fiscalYear} to fiscal {last.fiscalYear},{" "}
      {revenueRate === null ? (
        `${net}.`
      ) : (
        <>
          revenue grew at a{" "}
          <Term name="Compound annual growth rate">compound annual growth rate</Term> of{" "}
          {revenueRate}
          {net === null ? "." : `, and ${net}.`}
        </>
      )}
    </>
  );
};

// What the company is and whether it is growing, worked out from its numbers.
// Net income is what is left of each dollar, not money the company keeps:
// most of it goes back out as dividends, buybacks and investment.
function Lead({
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
  const left =
    revenue !== null && net !== null && revenue > 0 && net > 0
      ? Math.round((net / revenue) * 100)
      : null;
  const revenueMove =
    before === undefined ? null : grewText(revenue, valueOf(before.terms.revenue));
  const netMove = before === undefined ? null : netIncomeMove(net, valueOf(before.terms.netIncome));

  const whole = (value: number) => money(value).replace(" ", "\u00a0");
  return (
    <section aria-label="In plain words">
      <p className="overview-lead">
        {revenue === null
          ? `${name}'s revenue for fiscal ${year.fiscalYear} is a gap.`
          : net !== null && net < 0
            ? `${name} brought in ${whole(revenue)} in fiscal ${year.fiscalYear} and lost ${whole(-net)}.`
            : left !== null
              ? `${name} brought in ${whole(revenue)} in fiscal ${year.fiscalYear} and had ${left}¢ of each dollar left as net income.`
              : `${name} brought in ${whole(revenue)} in fiscal ${year.fiscalYear}.`}
      </p>
      {before !== undefined && revenueMove !== null && (
        <p className="sentence">
          Since fiscal {before.fiscalYear}, its <Term name="Revenue">revenue</Term> {revenueMove}
          {netMove === null ? (
            "."
          ) : (
            <>
              {" "}
              and its <Term name="Net income">net income</Term> {netMove}.
            </>
          )}
        </p>
      )}
    </section>
  );
}

// In its own words: the opening of the business description in its latest
// annual report, kept short so it never outweighs the numbers.
function Quote({ view, latest }: { readonly view: ReadyCompany; readonly latest: boolean }) {
  const description = view.details.description;
  const name = shortName(view.name);
  if (description === null) {
    return (
      <section className="quote" aria-labelledby="quote-title">
        <h2 className="eyebrow m-0 font-normal" id="quote-title">
          In its own words
        </h2>
        <p className="mt-2 mb-0 text-s text-text-3">
          The business description in {name}'s{" "}
          <Term name="Annual report (10-K)">annual report (10-K)</Term> is a <GapMark />: the tool
          could not find its opening yet.
        </p>
      </section>
    );
  }
  const url = filingUrl(view.cik, description.accession, description.document);
  return (
    <section className="quote" aria-labelledby="quote-title">
      <h2 className="eyebrow m-0 font-normal" id="quote-title">
        In its own words
      </h2>
      <blockquote cite={url}>
        <p>{description.text}</p>
      </blockquote>
      <p className="source">
        From its {latest ? "" : "latest "}
        <Term name="Annual report (10-K)">annual report (10-K)</Term>, filed on{" "}
        {longDate(description.filedOn)}.{" "}
        <a href={url} target="_blank" rel="noreferrer">
          Read it in the filing {"↗"}
        </a>
      </p>
    </section>
  );
}

// One dollar of revenue split into the parts it went to, the picture of the
// sentence above it. The whole bar opens Where the money goes.
const labelInside = 8;

function DollarBar({ ticker, year }: { readonly ticker: string; readonly year: StatementYear }) {
  const revenue = valueOf(year.terms.revenue);
  const net = valueOf(year.terms.netIncome);
  if (revenue === null || revenue <= 0 || net === null || net <= 0) return null;
  const all = yearParts(year);
  const cents = centsOfDollar(
    all.map((part) => part.value),
    revenue,
  );
  const blocks = all
    .map((part, index) => ({ part, cents: cents[index] ?? 0 }))
    .filter(({ part, cents: share }) => part.value !== null && part.value > 0 && share > 0);
  const destination = {
    to: "/$ticker/where-the-money-goes",
    params: { ticker },
    search: { year: year.fiscalYear },
  } as const;

  return (
    <section className="dollar" aria-labelledby="dollar-title">
      <div className="dollar-head">
        <h2 id="dollar-title">
          Each dollar of <Term name="Revenue">revenue</Term> in fiscal {year.fiscalYear}
        </h2>
        <Link {...destination} className="more-link">
          Where the money goes {"→"}
        </Link>
      </div>
      <Link
        {...destination}
        className="dollar-bar"
        aria-label={`${blocks.map(({ part, cents: share }) => `${part.name} ${share}¢`).join(", ")}. Opens where the money goes.`}
      >
        {blocks.map(({ part, cents: share }) => (
          <span
            key={part.key}
            style={{
              flexGrow: share,
              background: part.color,
              color:
                part.key === "netIncome"
                  ? "var(--color-text-on-kept)"
                  : "var(--color-text-on-part)",
            }}
          >
            {share >= labelInside ? `${share}¢` : ""}
          </span>
        ))}
      </Link>
      <ul className="dollar-legend">
        {blocks.map(({ part, cents: share }) => (
          <li key={part.key}>
            <i style={{ background: part.color }} aria-hidden="true" />
            <Term name={part.name} />
            {share < labelInside && <span className="numbers">{share}¢</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Profit on paper and cash in hand can come apart, and what a company does
// with its cash says as much as what it earns. Then where to look next.
function CashUse({
  ticker,
  name,
  year,
}: {
  readonly ticker: string;
  readonly name: string;
  readonly year: StatementYear;
}) {
  const net = valueOf(year.terms.netIncome);
  const free = valueOf(year.terms.freeCashFlow);
  const revenue = valueOf(year.terms.revenue);
  const per =
    net !== null && free !== null && net > 0 && free > 0
      ? free / net >= 1
        ? `$${(free / net).toFixed(2)}`
        : `${Math.round((free / net) * 100)}¢`
      : null;
  const used = (
    [
      ["capitalExpenditure", "Capital expenditure", "capital expenditure"],
      ["dividends", "Dividend", "dividends"],
      ["shareBuybacks", "Share buyback", "share buybacks"],
      ["acquisitions", "Acquisition", "acquisitions"],
    ] as const
  )
    .map(([key, term, words]) => ({ key, term, words, value: valueOf(year.terms[key]) }))
    .filter(
      (each): each is typeof each & { value: number } => each.value !== null && each.value > 0,
    );
  const repaid = valueOf(year.terms.debtRepaid);
  const left =
    revenue !== null && net !== null && revenue > 0 && net > 0
      ? 100 - Math.round((net / revenue) * 100)
      : null;
  const fiscal = { year: year.fiscalYear };

  return (
    <section className="cash-use" aria-labelledby="cash-title">
      <h2 id="cash-title">
        What {name} did with its cash in fiscal {year.fiscalYear}
      </h2>
      <p className="sentence">
        {per !== null ? (
          <>
            Each dollar of <Term name="Net income">net income</Term> became <strong>{per}</strong>{" "}
            of <Term name="Free cash flow">free cash flow</Term>.{" "}
          </>
        ) : free !== null ? (
          <>
            Its <Term name="Free cash flow">free cash flow</Term> was <strong>{money(free)}</strong>
            .{" "}
          </>
        ) : null}
        {used.length > 0 && (
          <>
            It spent{" "}
            {used.map((each, index) => (
              <span key={each.key}>
                {index > 0 && (index === used.length - 1 ? " and " : ", ")}
                <strong>{money(each.value)}</strong> on <Term name={each.term}>{each.words}</Term>
              </span>
            ))}
            {repaid !== null && repaid > 0 ? (
              <>
                , and repaid <strong>{money(repaid)}</strong> of <Term name="Debt">debt</Term>.
              </>
            ) : (
              "."
            )}
          </>
        )}
      </p>
      <nav className="next" aria-label="Where to look next">
        <Link to="/$ticker/where-the-money-goes" params={{ ticker }} search={fiscal}>
          {left === null
            ? "Where did each dollar go?"
            : `Where did the other ${left}¢ of each dollar go?`}
          <span aria-hidden="true">{"→"}</span>
        </Link>
        <Link to="/$ticker/timeline" params={{ ticker }} search={fiscal}>
          What did it do with its cash over the years?
          <span aria-hidden="true">{"→"}</span>
        </Link>
        <Link to="/$ticker/statements" params={{ ticker }} search={fiscal}>
          Where does each figure come from?
          <span aria-hidden="true">{"→"}</span>
        </Link>
      </nav>
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
  },
  {
    key: "netIncome",
    name: "Net income",
    color: "var(--color-part-kept)",
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
    .nice(6);
  const transition = still ? { duration: 0 } : glide;
  const at = (point: StatementYear) => x(point.fiscalYear) ?? 0;
  const valueAt = (point: StatementYear) => valueOf(point.terms[each.key]);
  const line = lineShape<StatementYear>()
    .defined((point) => valueAt(point) !== null)
    .x(at)
    .y((point) => y(valueAt(point) ?? 0))
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
            ? "unchanged"
            : signedPercent(delta),
      figure,
      key,
    };
  };
  const perShareTile = (key: FigureKey) => {
    const figure = figureOf(year, key);
    const value = valueOf(figure);
    const delta = before === undefined ? null : yearOverYear(value, valueOf(figureOf(before, key)));
    return {
      value: value === null ? <GapMark /> : <>{perShare(value)}</>,
      change:
        before === undefined || delta === null
          ? null
          : Math.abs(delta) < 0.0005
            ? "unchanged"
            : signedPercent(delta),
      figure,
      key,
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
          : Math.abs(value - then) < 0.0005
            ? "unchanged"
            : signedPoints((value - then) * 100),
      figure,
      key,
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
    {
      term: "Earnings per share",
      tile: perShareTile("earningsPerShare"),
      marksFrom: "earningsPerShare",
    },
  ];
  // Each tile draws its last ten fiscal years, up to the one shown.
  const recent = years.filter((each) => each.fiscalYear <= year.fiscalYear).slice(-10);
  const trendOf = (key: FigureKey) => recent.map((each) => valueOf(figureOf(each, key)));
  const tile = ({ term, tile, marksFrom }: (typeof tiles)[number]) => (
    <Tile
      key={term}
      term={term}
      value={tile.value}
      change={tile.change}
      trend={trendOf(tile.key)}
      ratio={tile.key === "grossMargin" || tile.key === "operatingMargin"}
      trendLabel={`${term}, fiscal ${recent[0]?.fiscalYear} to fiscal ${year.fiscalYear}`}
      marks={<Marks figure={figureOf(year, marksFrom)} />}
    />
  );

  return (
    <section aria-labelledby="strip-title">
      <h2 id="strip-title" className="mt-10 mb-3 text-m font-semibold">
        Key figures for fiscal {year.fiscalYear}
        {before !== undefined && (
          <span className="font-normal text-text-3">
            , with the <Term name="Year-over-year change">year-over-year change</Term> against
            fiscal {before.fiscalYear}
          </span>
        )}
      </h2>
      <div className="strip">
        <div className="strip-row">{tiles.map(tile)}</div>
      </div>
    </section>
  );
}

function Tile({
  term,
  value,
  change,
  trend,
  ratio,
  trendLabel,
  marks,
}: {
  readonly term: string;
  readonly value: ReactNode;
  readonly change: string | null;
  readonly trend: ReadonlyArray<number | null>;
  readonly ratio: boolean;
  readonly trendLabel: string;
  readonly marks: ReactNode;
}) {
  return (
    <div className="tile">
      <div className="tile-label">
        <Term name={term} />
      </div>
      <div className="tile-value numbers">{value}</div>
      <div className="change">{change ?? " "}</div>
      <Sparkline values={trend} ratio={ratio} label={trendLabel} />
      <div>{marks}</div>
    </div>
  );
}

// A small line of the last fiscal years in a quiet grey, with the year shown
// marked at its end. It has no scale, so it must not exaggerate: dollars are
// drawn from zero, and a margin's line spans at least four points, so a move
// of a few tenths of a point stays nearly flat.
const marginSpan = 0.04;

function Sparkline({
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
