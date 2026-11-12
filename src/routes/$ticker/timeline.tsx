import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { max, min, sum } from "d3-array";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveMonotoneX, line as lineShape } from "d3-shape";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type CorporateEvent, economyQuery, type StatementYear } from "../../functions/company";
import { type CheckedFigure, valueOf } from "../../shared/figures";
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
  monthName,
  monthShort,
  rate,
} from "../../ui/format";
import { shortName } from "../../ui/logo-tile";
import { GapMark } from "../../ui/marks";
import { useMounted, useWidth } from "../../ui/motion";
import { type FigureKey, figureOf } from "../../ui/own-figure";
import { useStickyTop } from "../../ui/sticky";
import { Term } from "../../ui/term";

export const Route = createFileRoute("/$ticker/timeline")({
  validateSearch: (search: Record<string, unknown>): { year?: number | undefined } => {
    const year = searchYear(search);
    return year === undefined ? {} : { year };
  },
  component: Timeline,
});

type EconomyMonth = {
  readonly month: string;
  readonly interestRate: number | null;
  readonly inflation: number | null;
  readonly recession: boolean;
};

const kinds: ReadonlyArray<{
  readonly key: FigureKey;
  readonly term: string;
  readonly label: ReactNode;
  readonly plain: string;
  readonly inline: ReactNode;
}> = [
  {
    key: "capitalExpenditure",
    term: "Capital expenditure",
    label: <Term name="Capital expenditure" />,
    plain: "capital expenditure",
    inline: <Term name="Capital expenditure">capital expenditure</Term>,
  },
  {
    key: "acquisitions",
    term: "Acquisition",
    label: <Term name="Acquisition" />,
    plain: "acquisitions",
    inline: <Term name="Acquisition">acquisitions</Term>,
  },
  {
    key: "shareBuybacks",
    term: "Share buyback",
    label: <Term name="Share buyback" />,
    plain: "share buybacks",
    inline: <Term name="Share buyback">share buybacks</Term>,
  },
  {
    key: "dividends",
    term: "Dividend",
    label: <Term name="Dividend" />,
    plain: "dividends",
    inline: <Term name="Dividend">dividends</Term>,
  },
  {
    key: "debtRaised",
    term: "Debt",
    label: (
      <>
        <Term name="Debt" /> raised
      </>
    ),
    plain: "debt raised",
    inline: (
      <>
        raising <Term name="Debt">debt</Term>
      </>
    ),
  },
  {
    key: "debtRepaid",
    term: "Debt",
    label: (
      <>
        <Term name="Debt" /> repaid
      </>
    ),
    plain: "debt repaid",
    inline: (
      <>
        repaying <Term name="Debt">debt</Term>
      </>
    ),
  },
];

// Every colour here holds at least 3 to 1 against the panel, chosen or not.
const colors = {
  bar: "#6a6a70",
  barChosen: "#c9c8c1",
  kept: "#3f8f3f",
  keptChosen: "var(--color-part-kept)",
  hatch: "#6f6f75",
};

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const middle = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15));
const monthStart = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
const nextMonth = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
const inflationText = (value: number | null) => (value === null ? "gap" : rate(value, 1));
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Span = StatementYear & { readonly start: Date; readonly end: Date };

const fiscalOf = (spans: ReadonlyArray<Span>, date: Date) =>
  spans.find((span) => date >= span.start && date.getTime() <= span.end.getTime() + 864e5);

function Timeline() {
  const { ticker } = Route.useParams();
  const search = Route.useSearch();
  const { view, years, year } = useReadyCompany(ticker, search.year);
  const economy = useQuery(economyQuery);
  const spans: ReadonlyArray<Span> = years.map((each) => ({
    ...each,
    start: day(each.startOn),
    end: day(each.endOn),
  }));
  const from = spans[0]!.start;
  const to = spans.at(-1)!.end;
  const months = (economy.data?.months ?? []).filter(
    (each) => middle(each.month) >= from && middle(each.month) <= to,
  );
  const span = spans.find((each) => each.fiscalYear === year.fiscalYear)!;
  const inYear = months.filter((each) => fiscalOf(spans, middle(each.month)) === span);
  const lastMonthOf = (each: Span) => each.endOn.slice(0, 7);

  const [chosen, setChosen] = useState<{
    ticker: string;
    month: string;
  } | null>(null);
  const chooseYear = useChooseYear();
  const month =
    chosen !== null &&
    chosen.ticker === view.ticker &&
    fiscalOf(spans, middle(chosen.month)) === span
      ? chosen.month
      : (inYear.at(-1)?.month ?? lastMonthOf(span));
  const choose = (next: string) => {
    const owner = fiscalOf(spans, middle(next));
    if (owner === undefined) return;
    setChosen({ ticker: view.ticker, month: next });
    if (owner.fiscalYear !== year.fiscalYear) void chooseYear(owner.fiscalYear);
  };
  const monthData = months.find((each) => each.month === month) ?? null;

  const allocation = (each: StatementYear, key: FigureKey) => figureOf(each, key);
  const name = shortName(view.name);
  const reported = kinds.filter(
    (kind) => kind.key !== "debtRaised" && allocation(year, kind.key).kind !== "gap",
  );
  const largest = reported.reduce<(typeof kinds)[number] | null>((best, kind) => {
    const value = valueOf(allocation(year, kind.key)) ?? 0;
    return best === null || value > (valueOf(allocation(year, best.key)) ?? 0) ? kind : best;
  }, null);
  const total = (key: FigureKey) => sum(years, (each) => valueOf(allocation(each, key)) ?? 0);

  return (
    <CompanyFrame
      view={view}
      year={year}
      active="timeline"
      title="timeline"
      extraOwnFigure={(termName) =>
        timelineFigure(termName, {
          name,
          year,
          month,
          monthData,
          view,
          spans,
          span,
          months,
        })
      }
    >
      <div className="grid gap-3">
        <div className="eyebrow">Timeline, fiscal {year.fiscalYear}</div>
        <p className="sentence">
          In fiscal {year.fiscalYear} {name} brought in{" "}
          <strong>{money(valueOf(year.terms.revenue) ?? 0)}</strong> of{" "}
          <Term name="Revenue">revenue</Term>, and its <Term name="Net income">net income</Term> was{" "}
          <strong>{money(valueOf(year.terms.netIncome) ?? 0)}</strong>.
          {largest !== null && (
            <>
              {" "}
              The largest part of its <Term name="Capital allocation">
                capital allocation
              </Term> was{" "}
              <strong>{money(valueOf(allocation(year, largest.key)) ?? 0)}</strong> on{" "}
              {largest.inline}.
            </>
          )}
          {monthData !== null && monthData.interestRate !== null && (
            <>
              {" "}
              In {monthName(month)} the <Term name="Interest rate">interest rate</Term> was{" "}
              <strong>{rate(monthData.interestRate)}</strong>
              {monthData.inflation === null ? (
                <>
                  . <Term name="Inflation" /> for that month is a <GapMark />, because no prices
                  were published for it
                </>
              ) : (
                <>
                  {" "}
                  and <Term name="Inflation">inflation</Term>{" "}
                  <strong>{inflationText(monthData.inflation)}</strong>
                </>
              )}
              .
            </>
          )}
        </p>
      </div>
      <div className="tl-layout">
        <section className="panel panel-pad min-w-0" aria-labelledby="chart-title">
          <div className="panel-title">
            <h2 id="chart-title">
              Fiscal {years[0]!.fiscalYear} to fiscal {years.at(-1)!.fiscalYear}
            </h2>
          </div>
          <p className="verdict">
            Across these {years.length} fiscal years {name} spent {money(total("shareBuybacks"))} on
            share buybacks, {money(total("dividends"))} on dividends and{" "}
            {money(total("capitalExpenditure"))} on capital expenditure.
          </p>
          <Rows
            view={view}
            spans={spans}
            span={span}
            months={months}
            month={month}
            choose={choose}
            economyState={economy.isPending ? "loading" : economy.isError ? "failed" : "ready"}
          />
          <p className="tl-hint">
            Click or tap anywhere on the timeline to choose a month. With the line of years under
            the chart selected, <kbd>{"←"}</kbd> <kbd>{"→"}</kbd> move one month and{" "}
            <kbd>Page Up</kbd> <kbd>Page Down</kbd> one year.
          </p>
          {/* Under the chart on a narrow screen, the side panel is far below. */}
          <p className="tl-summary">
            {monthName(month)}
            {monthData !== null &&
              monthData.interestRate !== null &&
              `: interest rate ${rate(monthData.interestRate)}`}
            {monthData !== null &&
              monthData.inflation !== null &&
              `, inflation ${inflationText(monthData.inflation)}`}
            . <a href="#what-was-true">What was true in {monthName(month)}</a>
          </p>
        </section>
        <Side
          view={view}
          name={name}
          span={span}
          months={months}
          month={month}
          monthData={monthData}
          sources={economy.data?.sources ?? null}
          spans={spans}
        />
      </div>
    </CompanyFrame>
  );
}

const timelineFigure = (
  termName: string,
  context: {
    readonly name: string;
    readonly year: StatementYear;
    readonly month: string;
    readonly monthData: EconomyMonth | null;
    readonly view: ReadyCompany;
    readonly spans: ReadonlyArray<Span>;
    readonly span: Span;
    readonly months: ReadonlyArray<EconomyMonth>;
  },
): ReactNode => {
  const { name, year, month, monthData, view, spans, span } = context;
  const line = (content: ReactNode) => <div className="figure-line">{content}</div>;
  const amount = (figure: CheckedFigure) =>
    figure.kind === "gap" ? <GapMark /> : <span className="numbers">{money(figure.value)}</span>;
  if (termName === "Debt") {
    return line(
      <>
        {name} in fiscal {year.fiscalYear}: {amount(figureOf(year, "debtRaised"))} raised and{" "}
        {amount(figureOf(year, "debtRepaid"))} repaid.
      </>,
    );
  }
  if (termName === "Capital allocation") {
    return line(
      <>
        {name} in fiscal {year.fiscalYear}:{" "}
        {kinds
          .filter((kind) => kind.key !== "debtRaised" && figureOf(year, kind.key).kind !== "gap")
          .map((kind) => `${money(valueOf(figureOf(year, kind.key)) ?? 0)} on ${kind.plain}`)
          .join(", ")}
        .
      </>,
    );
  }
  if (monthData !== null && termName === "Interest rate" && monthData.interestRate !== null) {
    return line(
      <>
        In {monthName(month)}: <span className="numbers">{rate(monthData.interestRate)}</span>
      </>,
    );
  }
  if (monthData !== null && termName === "Inflation") {
    return line(
      <>
        In {monthName(month)}: <span className="numbers">{inflationText(monthData.inflation)}</span>
      </>,
    );
  }
  if (monthData !== null && termName === "Recession") {
    return line(
      <>
        {monthName(month)}: {monthData.recession ? "in a recession" : "no recession"}.
      </>,
    );
  }
  if (monthData !== null && termName === "Economic context") {
    return line(
      <>
        In {monthName(month)}: interest rate{" "}
        {monthData.interestRate === null ? "gap" : rate(monthData.interestRate)}, inflation{" "}
        {inflationText(monthData.inflation)},{" "}
        {monthData.recession ? "in a recession" : "no recession"}.
      </>,
    );
  }
  if (termName === "Corporate event" || termName === "Current report (8-K)") {
    const count = view.details.events.filter(
      (event) => fiscalOf(spans, day(event.filedOn)) === span,
    ).length;
    return line(
      <>
        {name} in fiscal {year.fiscalYear}: {count} current report
        {count === 1 ? "" : "s"} (8-K) with item 5.02 or 2.01.
      </>,
    );
  }
  return undefined;
};

const officerIcon = (fill: string) => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <circle cx="6" cy="6" r="4.5" fill={fill} />
  </svg>
);
const businessIcon = (fill: string) => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path d="M6 0.8 11.2 6 6 11.2 0.8 6Z" fill={fill} />
  </svg>
);
const eventPlain = (event: CorporateEvent) =>
  event.kind === "business"
    ? "Acquisition or sale of a business completed"
    : "Change among directors or officers";

const pad = { left: 52, right: 132 };
const axisHeight = 52;

function Rows({
  view,
  spans,
  span,
  months,
  month,
  choose,
  economyState,
}: {
  readonly view: ReadyCompany;
  readonly spans: ReadonlyArray<Span>;
  readonly span: Span;
  readonly months: ReadonlyArray<EconomyMonth>;
  readonly month: string;
  readonly choose: (month: string) => void;
  readonly economyState: "loading" | "failed" | "ready";
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const tip = useChartTip();
  const available = useWidth(scroller, 900);
  const W = Math.max(available, 620, spans.length * 28 + pad.left + pad.right);
  const [height, setHeight] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const x = scaleUtc()
    .domain([spans[0]!.start, spans.at(-1)!.end])
    .range([pad.left, W - pad.right]);
  const isChosen = (each: Span) => each === span;
  const cursorX = x(middle(month));

  useLayoutEffect(() => {
    if (rows.current !== null && rows.current.offsetHeight !== height)
      setHeight(rows.current.offsetHeight);
  });

  const updateEdges = () => {
    const element = scroller.current;
    if (element === null) return;
    const maxScroll = element.scrollWidth - element.clientWidth;
    const left = element.scrollLeft > 2;
    const right = element.scrollLeft < maxScroll - 2;
    setEdges((was) => (was.left === left && was.right === right ? was : { left, right }));
  };

  // The box opens at the chosen month, and follows it when it moves out of view.
  useEffect(() => {
    const element = scroller.current;
    if (element === null) return;
    const visible = cursorX - element.scrollLeft;
    if (visible < 60 || visible > element.clientWidth - 60)
      element.scrollLeft = cursorX - element.clientWidth / 2;
    updateEdges();
  }, [cursorX, mounted]);

  if (!mounted) return <div ref={scroller} className="tl-scroll" style={{ height: 900 }} />;

  const monthAt = (px: number) => {
    const date = x.invert(px);
    let best = months[0];
    for (const each of months)
      if (
        best === undefined ||
        Math.abs(+middle(each.month) - +date) < Math.abs(+middle(best.month) - +date)
      )
        best = each;
    return best?.month ?? null;
  };
  const barBox = (each: Span, share = 0.56) => {
    const left = x(each.start);
    const right = x(each.end);
    const width = Math.min(34, (right - left) * share);
    return { left: (left + right) / 2 - width / 2, width };
  };
  const pointX = (event: React.PointerEvent | React.MouseEvent) =>
    event.clientX - (rows.current?.getBoundingClientRect().left ?? 0);

  // Revenue and net income
  const incomeHeight = 150;
  const yIncome = scaleLinear()
    .domain([0, max(spans, (each) => valueOf(each.terms.revenue)) ?? 1])
    .nice()
    .range([incomeHeight - 2, 14]);

  // Capital allocation, all on one dollar scale
  const stripHeight = 64;
  const most =
    max(spans.flatMap((each) => kinds.map((kind) => valueOf(figureOf(each, kind.key)) ?? 0))) ?? 1;
  const yStrip = scaleLinear()
    .domain([0, most])
    .range([0, stripHeight - 4]);

  // Economic context: interest rate and inflation share one percent scale
  const economyHeight = 150;
  const values = months
    .flatMap((each) => [each.interestRate, each.inflation])
    .filter((value): value is number => value !== null);
  const yEconomy = scaleLinear()
    .domain([Math.min(0, min(values) ?? 0), max(values) ?? 5])
    .nice()
    .range([economyHeight - 4, 12]);
  const recessions: Array<Array<string>> = [];
  months.forEach((each, index) => {
    if (!each.recession) return;
    const last = recessions.at(-1);
    if (last !== undefined && last.at(-1) === months[index - 1]?.month) last.push(each.month);
    else recessions.push([each.month]);
  });
  const lastMonth = months.at(-1);
  const endLabels =
    lastMonth === undefined
      ? []
      : (
          [
            ["interestRate", "Interest rate", "var(--color-line-rate)"],
            ["inflation", "Inflation", "var(--color-line-inflation)"],
          ] as const
        )
          .filter(([key]) => lastMonth[key] !== null)
          .map(([key, label, color]) => ({
            key,
            y: yEconomy(lastMonth[key]!),
            text: `${label} ${key === "interestRate" ? rate(lastMonth[key]!) : inflationText(lastMonth[key])}`,
            color,
          }))
          .sort((a, b) => a.y - b.y);
  if (endLabels.length === 2 && endLabels[1]!.y - endLabels[0]!.y < 16) {
    const centre = (endLabels[0]!.y + endLabels[1]!.y) / 2;
    endLabels[0]!.y = centre - 8;
    endLabels[1]!.y = centre + 8;
  }

  const events = view.details.events;
  const eventsFrom = view.details.eventsFrom;
  const covered = eventsFrom === null ? null : day(eventsFrom);
  // Events filed close together stack upwards, each on the lowest level
  // with room, so every one can be seen and pointed at.
  const levels: Array<number> = [];
  const stacked = events
    .filter(
      (event) => day(event.filedOn) >= spans[0]!.start && day(event.filedOn) <= spans.at(-1)!.end,
    )
    .map((event) => {
      const px = x(day(event.filedOn));
      let level = levels.findIndex((lastX) => px - lastX >= 12);
      if (level === -1) {
        level = levels.length;
        levels.push(px);
      } else levels[level] = px;
      return { event, px, level };
    });
  const eventsHeight = 44 + 12 * Math.max(0, levels.length - 1);
  const eventsLine = eventsHeight - 22;
  const placedEvents = stacked.map((each) => ({ ...each, cy: eventsLine - 12 * each.level }));

  // Where years are too narrow for every label, every other one is named,
  // and always the chosen one.
  const thin = x(spans[0]!.end) - x(spans[0]!.start) < 40;
  const chosenIndex = spans.indexOf(span);
  const lastIndex = spans.length - 1;
  const yearLabelShown = (index: number) =>
    !thin ||
    index === chosenIndex ||
    (Math.abs(index - chosenIndex) > 1 && index % 2 === lastIndex % 2);

  const monthIndex = months.findIndex((each) => each.month === month);
  const onAxisKey = (event: KeyboardEvent) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageUp: 12,
      PageDown: -12,
    };
    let next: number | null = null;
    if (event.key in steps) next = monthIndex + steps[event.key]!;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = months.length - 1;
    if (next === null || months.length === 0) return;
    event.preventDefault();
    const target = months[Math.max(0, Math.min(months.length - 1, next))];
    if (target !== undefined) choose(target.month);
  };

  return (
    <div className={`tl-wrap ${edges.left ? "can-left" : ""} ${edges.right ? "can-right" : ""}`}>
      <div className="tl-scroll" ref={scroller} onScroll={updateEdges}>
        <div
          className="tl-rows"
          ref={rows}
          style={{ width: W }}
          onPointerMove={(event) => {
            const px = pointX(event);
            if (px < x.range()[0]! || px > x.range()[1]!) {
              setHover(null);
              tip.hide();
              return;
            }
            const found = monthAt(px);
            setHover(found === null ? null : x(middle(found)));
            const mark = (event.target as Element).closest("[data-tip]");
            const data = months.find((each) => each.month === found);
            if (mark !== null) tip.show(event, <span>{mark.getAttribute("data-tip")}</span>);
            else if (data !== undefined) {
              tip.show(
                event,
                <>
                  <strong>{monthName(data.month)}</strong>
                  <br />
                  Fiscal {fiscalOf(spans, middle(data.month))?.fiscalYear}
                  <br />
                  Interest rate {data.interestRate === null ? "gap" : rate(data.interestRate)}
                  <br />
                  Inflation {inflationText(data.inflation)}
                  {data.recession && (
                    <>
                      <br />
                      Recession
                    </>
                  )}
                </>,
              );
            } else tip.hide();
          }}
          onPointerLeave={() => {
            setHover(null);
            tip.hide();
          }}
          onClick={(event) => {
            if ((event.target as Element).closest("button, a")) return;
            const marked = (event.target as Element).closest("[data-month]");
            if (marked !== null) return choose(marked.getAttribute("data-month")!);
            const px = pointX(event);
            if (px < x.range()[0]! - 8 || px > x.range()[1]! + 8) return;
            const found = monthAt(px);
            if (found !== null) choose(found);
            else {
              const owner = fiscalOf(spans, x.invert(px));
              if (owner !== undefined) choose(owner.endOn.slice(0, 7));
            }
          }}
        >
          <svg className="tl-under" width={W} height={height} aria-hidden="true">
            <defs>
              <pattern
                id="hatch"
                width={6}
                height={6}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width={6} height={6} fill="rgb(255 255 255 / 0.04)" />
                <line x1={0} y1={0} x2={0} y2={6} stroke={colors.hatch} strokeWidth={1.5} />
              </pattern>
            </defs>
            {spans.map((each) => (
              <line
                key={each.fiscalYear}
                x1={x(each.start)}
                x2={x(each.start)}
                y1={0}
                y2={height}
                stroke="rgb(255 255 255 / 0.05)"
              />
            ))}
            <rect
              x={x(span.start)}
              width={x(span.end) - x(span.start)}
              y={0}
              height={height}
              rx={6}
              fill="rgb(255 255 255 / 0.045)"
            />
            {recessions.map((run) => {
              const left = x(monthStart(run[0]!));
              const right = x(nextMonth(run.at(-1)!));
              return (
                <rect
                  key={run[0]}
                  x={left}
                  width={Math.max(3, right - left)}
                  y={0}
                  height={height}
                  fill="url(#hatch)"
                />
              );
            })}
          </svg>

          <div className="tl-row">
            <TimelineHead>
              <span>
                <Term name="Revenue" /> and <Term name="Net income">net income</Term>
              </span>
              <span className="tl-legend">
                <span>
                  <svg viewBox="0 0 14 14">
                    <rect x="1" y="1" width="12" height="12" rx="3" fill={colors.barChosen} />
                  </svg>
                  <span>Revenue</span>
                </span>
                <span>
                  <svg viewBox="0 0 14 14">
                    <rect
                      x="1"
                      y="1"
                      width="12"
                      height="12"
                      rx="3"
                      fill={colors.keptChosen}
                      stroke="var(--color-surface-1)"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>Net income, inside revenue</span>
                </span>
              </span>
            </TimelineHead>
            <div className="tl-plot">
              <Ticks
                height={incomeHeight}
                ticks={yIncome
                  .ticks(3)
                  .map((tick) => ({ y: yIncome(tick), text: axisMoney(tick) }))}
              />
              <svg
                width={W}
                height={incomeHeight}
                role="img"
                aria-label={`Revenue and net income for each fiscal year from ${spans[0]!.fiscalYear} to ${spans.at(-1)!.fiscalYear}`}
              >
                {yIncome
                  .ticks(3)
                  .map((tick) =>
                    tick === 0 ? null : (
                      <line
                        key={tick}
                        className="grid-line"
                        x1={pad.left}
                        x2={W - pad.right}
                        y1={yIncome(tick)}
                        y2={yIncome(tick)}
                      />
                    ),
                  )}
                {spans.map((each) => {
                  const { left, width } = barBox(each);
                  const revenue = valueOf(each.terms.revenue) ?? 0;
                  const net = Math.max(0, valueOf(each.terms.netIncome) ?? 0);
                  const tipText = `Fiscal ${each.fiscalYear}: revenue ${money(revenue)}, net income ${money(valueOf(each.terms.netIncome) ?? 0)}`;
                  return (
                    <g key={each.fiscalYear} data-tip={tipText} data-month={each.endOn.slice(0, 7)}>
                      <rect
                        x={left}
                        width={width}
                        y={yIncome(revenue)}
                        height={yIncome(0) - yIncome(revenue)}
                        rx={3}
                        fill={isChosen(each) ? colors.barChosen : colors.bar}
                      />
                      <rect
                        x={left + 3}
                        width={Math.max(0, width - 6)}
                        y={yIncome(net)}
                        height={yIncome(0) - yIncome(net)}
                        rx={2}
                        fill={isChosen(each) ? colors.keptChosen : colors.kept}
                        stroke="var(--color-surface-1)"
                        strokeWidth={2}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="tl-row">
            <TimelineHead>
              <span>
                <Term name="Capital allocation" /> per <Term name="Fiscal year">fiscal year</Term>
              </span>
            </TimelineHead>
            {kinds.map((kind) => {
              const figure = figureOf(span, kind.key);
              return (
                <div className="tl-sub" key={kind.key}>
                  <div className="tl-sub-head">
                    <span>
                      {kind.label}, fiscal {span.fiscalYear}:
                    </span>
                    {figure.kind === "gap" ? (
                      <GapMark />
                    ) : (
                      <span className="numbers">{money(figure.value)}</span>
                    )}
                  </div>
                  <svg
                    width={W}
                    height={stripHeight}
                    role="img"
                    aria-label={`${capital(kind.plain)} for each fiscal year`}
                  >
                    <line
                      x1={pad.left}
                      x2={W - pad.right}
                      y1={stripHeight - 0.5}
                      y2={stripHeight - 0.5}
                      stroke="var(--color-hairline)"
                    />
                    {spans.map((each) => {
                      const value = figureOf(each, kind.key);
                      const { left, width } = barBox(each);
                      const label = `${capital(kind.plain)}, fiscal ${each.fiscalYear}: ${value.kind === "gap" ? "gap, not reported as its own line" : money(value.value)}`;
                      if (value.kind === "gap") {
                        return (
                          <rect
                            key={each.fiscalYear}
                            data-tip={label}
                            data-month={each.endOn.slice(0, 7)}
                            x={left + 0.5}
                            y={stripHeight - 9.5}
                            width={width - 1}
                            height={8}
                            rx={3}
                            fill="transparent"
                            stroke="var(--color-text-3)"
                            strokeDasharray="3 3"
                            opacity={isChosen(each) ? 1 : 0.7}
                          />
                        );
                      }
                      const h = Math.max(value.value > 0 ? 2 : 0, yStrip(value.value));
                      return (
                        <g
                          key={each.fiscalYear}
                          data-tip={label}
                          data-month={each.endOn.slice(0, 7)}
                        >
                          <rect
                            x={left}
                            width={width}
                            y={stripHeight - 1 - h}
                            height={h + 1}
                            rx={2}
                            fill={isChosen(each) ? colors.barChosen : colors.bar}
                          />
                          <rect
                            x={left - 4}
                            width={width + 8}
                            y={0}
                            height={stripHeight}
                            fill="transparent"
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })}
          </div>

          <div className="tl-row">
            <TimelineHead>
              <span>
                <Term name="Corporate event">Corporate events</Term> from{" "}
                <Term name="Current report (8-K)">current reports (8-K)</Term>
              </span>
              <span className="tl-legend">
                <span>
                  {officerIcon("var(--color-text-1)")}
                  <span>Change among directors or officers</span>
                </span>
                <span>
                  {businessIcon("var(--color-text-1)")}
                  <span>
                    <Term name="Acquisition" /> or sale of a business
                  </span>
                </span>
              </span>
            </TimelineHead>
            <svg
              width={W}
              height={eventsHeight}
              role="img"
              aria-label={`${placedEvents.length} current reports (8-K) with item 5.02 or 2.01`}
            >
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={eventsLine}
                y2={eventsLine}
                stroke="var(--color-hairline)"
              />
              {covered !== null && covered > spans[0]!.start && (
                <g
                  data-tip={`Gap: current reports (8-K) filed before ${longDate(eventsFrom!)} are not in this timeline`}
                >
                  <rect
                    x={x(spans[0]!.start) + 0.5}
                    y={6.5}
                    width={Math.max(0, x(covered) - x(spans[0]!.start) - 4)}
                    height={eventsHeight - 13}
                    rx={4}
                    fill="var(--color-surface-1)"
                    stroke="var(--color-text-3)"
                    strokeDasharray="3 3"
                  />
                  {x(covered) - x(spans[0]!.start) > 40 && (
                    <text
                      className="tl-text"
                      x={(x(spans[0]!.start) + x(covered)) / 2}
                      y={eventsHeight / 2 + 4}
                      textAnchor="middle"
                    >
                      gap
                    </text>
                  )}
                </g>
              )}
              {placedEvents.map(({ event, px, cy }) => {
                const inYear = fiscalOf(spans, day(event.filedOn)) === span;
                const fill = inYear ? "var(--color-text-1)" : "var(--color-text-3)";
                return (
                  <g
                    key={`${event.accession}-${event.kind}`}
                    data-tip={`${eventPlain(event)}, filed on ${longDate(event.filedOn)}${event.amendedOn === null ? "" : `, amended on ${longDate(event.amendedOn)}`}`}
                    data-month={event.filedOn.slice(0, 7)}
                    className="cursor-pointer"
                  >
                    <circle cx={px} cy={cy} r={8} fill="transparent" />
                    {event.kind === "business" ? (
                      <path
                        d={`M${px},${cy - 6.5}L${px + 6.5},${cy}L${px},${cy + 6.5}L${px - 6.5},${cy}Z`}
                        fill={fill}
                        stroke="var(--color-surface-1)"
                        strokeWidth={2}
                      />
                    ) : (
                      <circle
                        cx={px}
                        cy={cy}
                        r={4.5}
                        fill={fill}
                        stroke="var(--color-surface-1)"
                        strokeWidth={2}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="tl-row">
            <TimelineHead>
              <span>
                <Term name="Economic context" />
              </span>
              <span className="tl-legend">
                <span>
                  <svg viewBox="0 0 14 14">
                    <path
                      d="M1 7h12"
                      stroke="var(--color-line-rate)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>
                    <Term name="Interest rate" />
                  </span>
                </span>
                <span>
                  <svg viewBox="0 0 14 14">
                    <path
                      d="M1 7h12"
                      stroke="var(--color-line-inflation)"
                      strokeWidth="2.5"
                      strokeDasharray="3 2.5"
                    />
                  </svg>
                  <span>
                    <Term name="Inflation" />, dashed
                  </span>
                </span>
                <span>
                  <svg viewBox="0 0 14 14">
                    <rect
                      x="1"
                      y="1"
                      width="12"
                      height="12"
                      rx="2"
                      fill="url(#hatch)"
                      stroke="var(--color-hairline-strong)"
                    />
                  </svg>
                  <span>
                    <Term name="Recession" />, across every row
                  </span>
                </span>
              </span>
            </TimelineHead>
            {economyState !== "ready" || months.length === 0 ? (
              <p
                className="m-0 flex h-[150px] items-center text-xs text-text-3"
                style={{ paddingLeft: pad.left }}
              >
                {economyState === "loading"
                  ? "Fetching interest rate, inflation and recessions from FRED."
                  : "Interest rate, inflation and recessions could not be fetched from FRED. They are a gap here until they can be."}
              </p>
            ) : (
              <div className="tl-plot">
                <Ticks
                  height={economyHeight}
                  ticks={yEconomy.ticks(3).map((tick) => ({ y: yEconomy(tick), text: `${tick}%` }))}
                />
                <svg
                  width={W}
                  height={economyHeight}
                  role="img"
                  aria-label="Interest rate and inflation for each month, with recessions shaded"
                >
                  {yEconomy.ticks(3).map((tick) => (
                    <line
                      key={tick}
                      className={tick === 0 ? "baseline" : "grid-line"}
                      x1={pad.left}
                      x2={W - pad.right}
                      y1={yEconomy(tick)}
                      y2={yEconomy(tick)}
                    />
                  ))}
                  {(["interestRate", "inflation"] as const).map((key) => {
                    const path = lineShape<EconomyMonth>()
                      .defined((each) => each[key] !== null)
                      .x((each) => x(middle(each.month)))
                      .y((each) => yEconomy(each[key] ?? 0))
                      .curve(curveMonotoneX)(months);
                    return (
                      <path
                        key={key}
                        d={path ?? ""}
                        fill="none"
                        stroke={
                          key === "interestRate"
                            ? "var(--color-line-rate)"
                            : "var(--color-line-inflation)"
                        }
                        strokeWidth={2}
                        strokeDasharray={key === "inflation" ? "5 3" : undefined}
                        strokeLinejoin="round"
                      />
                    );
                  })}
                  {lastMonth !== undefined &&
                    endLabels.map((label) => (
                      <g key={label.key}>
                        <circle
                          cx={x(middle(lastMonth.month))}
                          cy={yEconomy(lastMonth[label.key]!)}
                          r={3}
                          fill={label.color}
                        />
                        <text
                          className="tl-text tl-end"
                          x={x(middle(lastMonth.month)) + 8}
                          y={label.y + 4.5}
                        >
                          {label.text}
                        </text>
                      </g>
                    ))}
                </svg>
              </div>
            )}
          </div>

          <div
            className="tl-axis"
            role="slider"
            tabIndex={0}
            aria-label="Month on the timeline"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, months.length - 1)}
            aria-valuenow={Math.max(0, monthIndex)}
            aria-valuetext={`${monthName(month)}, fiscal ${span.fiscalYear}`}
            onKeyDown={onAxisKey}
          >
            <svg width={W} height={axisHeight} aria-hidden="true">
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={0.5}
                y2={0.5}
                stroke="var(--color-hairline-strong)"
              />
              {spans.map((each, index) => (
                <g key={each.fiscalYear}>
                  <line
                    x1={x(each.start)}
                    x2={x(each.start)}
                    y1={0}
                    y2={8}
                    stroke="var(--color-text-3)"
                    opacity={0.6}
                  />
                  <text
                    className={`tl-year ${isChosen(each) ? "current" : ""}`}
                    x={(x(each.start) + x(each.end)) / 2}
                    y={22}
                    textAnchor="middle"
                    opacity={yearLabelShown(index) ? 1 : 0}
                  >
                    {each.fiscalYear}
                  </text>
                </g>
              ))}
              <Pill x={cursorX} width={W} text={monthShort(month)} />
            </svg>
          </div>

          <svg className="tl-over" width={W} height={height} aria-hidden="true">
            {hover !== null && (
              <line
                x1={hover}
                x2={hover}
                y1={0}
                y2={height - axisHeight}
                stroke="var(--color-text-3)"
                strokeDasharray="2 3"
              />
            )}
            <line
              x1={cursorX}
              x2={cursorX}
              y1={0}
              y2={height - axisHeight + 28}
              stroke="var(--color-text-1)"
              strokeWidth={1.5}
            />
          </svg>
        </div>
      </div>
      {tip.element}
    </div>
  );
}

// The scale of a chart stays in view while the timeline scrolls sideways,
// in a margin the bars never enter.
function Ticks({
  height,
  ticks,
}: {
  readonly height: number;
  readonly ticks: ReadonlyArray<{ readonly y: number; readonly text: string }>;
}) {
  return (
    <div className="tl-ticks" style={{ width: pad.left, height }} aria-hidden="true">
      {ticks.map((tick) => (
        <span key={tick.text} style={{ top: tick.y }}>
          {tick.text}
        </span>
      ))}
    </div>
  );
}

function TimelineHead({ children }: { readonly children: ReactNode }) {
  return <div className="tl-head">{children}</div>;
}

function Pill({
  x,
  width,
  text,
}: {
  readonly x: number;
  readonly width: number;
  readonly text: string;
}) {
  const pillWidth = text.length * 7.2 + 16;
  const at = Math.min(Math.max(x, pillWidth / 2), width - pillWidth / 2);
  return (
    <g className="tl-pill">
      <rect x={at - pillWidth / 2} y={29} width={pillWidth} height={20} rx={10} />
      <text x={at} y={43} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function Side({
  view,
  name,
  span,
  spans,
  months,
  month,
  monthData,
  sources,
}: {
  readonly view: ReadyCompany;
  readonly name: string;
  readonly span: Span;
  readonly spans: ReadonlyArray<Span>;
  readonly months: ReadonlyArray<EconomyMonth>;
  readonly month: string;
  readonly monthData: EconomyMonth | null;
  readonly sources: {
    readonly interestRate: string;
    readonly inflation: string;
    readonly recession: string;
  } | null;
}) {
  const side = useRef<HTMLElement>(null);
  useStickyTop(side, 16);
  const revenue = valueOf(span.terms.revenue);
  const net = valueOf(span.terms.netIncome);
  const revenueSource = span.terms.revenue.kind === "reported" ? span.terms.revenue.latest : null;
  const yearMonths = months.filter((each) => fiscalOf(spans, middle(each.month)) === span);
  const rates = yearMonths
    .map((each) => each.interestRate)
    .filter((value): value is number => value !== null);
  const recessionMonths = yearMonths.filter((each) => each.recession);
  const inYear = view.details.events.filter(
    (event) => fiscalOf(spans, day(event.filedOn)) === span,
  );
  const covered = view.details.eventsFrom;
  const cashSource = (["shareBuybacks", "capitalExpenditure", "dividends"] as const)
    .map((key) => span.terms[key])
    .find((figure) => figure.kind === "reported");

  return (
    <aside
      className="panel panel-pad tl-side"
      id="what-was-true"
      aria-label="What was true then"
      ref={side}
    >
      <div>
        <div className="eyebrow">What was true in</div>
        <h2>{monthName(month)}</h2>
        <div className="eyebrow mt-1">
          In <Term name="Fiscal year">fiscal {span.fiscalYear}</Term>, {longDate(span.startOn)} to{" "}
          {longDate(span.endOn)}
        </div>
      </div>
      <div className="side-section">
        <h3>
          <Term name="Revenue" /> and <Term name="Net income">net income</Term>, fiscal{" "}
          {span.fiscalYear}
        </h3>
        <dl className="side-list">
          <dt>Revenue</dt>
          <dd className="numbers">{revenue === null ? <GapMark /> : money(revenue)}</dd>
          <dt>Net income</dt>
          <dd className="numbers">{net === null ? <GapMark /> : money(net)}</dd>
        </dl>
        <p className="side-note">
          {revenue !== null &&
            net !== null &&
            revenue > 0 &&
            `Net income was ${Math.round((net / revenue) * 100)}¢ of each dollar of revenue. `}
          {revenueSource !== null && (
            <>
              From the <Term name="Annual report (10-K)">annual report (10-K)</Term> filed on{" "}
              {longDate(revenueSource.filedOn)}.{" "}
              <a
                href={filingUrl(view.cik, revenueSource.accession)}
                target="_blank"
                rel="noreferrer"
              >
                Open the annual report (10-K)
              </a>
            </>
          )}
        </p>
      </div>
      <div className="side-section">
        <h3>
          <Term name="Capital allocation" />, fiscal {span.fiscalYear}
        </h3>
        <dl className="side-list">
          {kinds.map((kind) => {
            const figure = figureOf(span, kind.key);
            return (
              <div key={kind.key} className="contents">
                <dt>{kind.label}</dt>
                <dd className="numbers">
                  {figure.kind === "gap" ? <GapMark /> : money(figure.value)}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="side-note">
          {kinds.some((kind) => figureOf(span, kind.key).kind === "gap") &&
            `A gap means ${name} did not report that line on its own this year. `}
          {cashSource !== undefined && cashSource.kind === "reported" && (
            <>
              From the <Term name="Cash flow statement">cash flow statement</Term> in the annual
              report (10-K) filed on {longDate(cashSource.latest.filedOn)}.{" "}
              <a
                href={filingUrl(view.cik, cashSource.latest.accession)}
                target="_blank"
                rel="noreferrer"
              >
                Open the annual report (10-K)
              </a>
            </>
          )}
        </p>
      </div>
      <div className="side-section">
        <h3>
          <Term name="Corporate event">Corporate events</Term>, fiscal {span.fiscalYear}
        </h3>
        {inYear.length > 0 ? (
          <ul className="events">
            {inYear.map((event) => (
              <li
                key={`${event.accession}-${event.kind}`}
                className={event.filedOn.slice(0, 7) === month ? "near" : undefined}
              >
                <span className="when">{longDate(event.filedOn)}</span>
                <span className="what">
                  {event.kind === "business"
                    ? businessIcon("currentColor")
                    : officerIcon("currentColor")}
                  <span>
                    {event.kind === "business" ? (
                      <>
                        <Term name="Acquisition" /> or sale of a business completed
                      </>
                    ) : (
                      "Change among directors or officers"
                    )}
                  </span>
                </span>
                <p>
                  {event.amendedOn !== null && `Amended on ${longDate(event.amendedOn)}. `}
                  <a
                    href={filingUrl(view.cik, event.accession, event.document)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open the {event.form} filed on {longDate(event.filedOn)}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="side-note mt-0">
            No <Term name="Current report (8-K)">current report (8-K)</Term> with item 5.02 or 2.01
            in fiscal {span.fiscalYear}.
          </p>
        )}
        {inYear.some((event) => event.kind === "officers") && (
          <p className="side-note">
            A change among directors or officers is filed under item 5.02, which covers a director
            or senior officer arriving or leaving, and changes to their pay. The item does not say
            who, so it cannot tell whether the chief executive or the finance chief changed.
          </p>
        )}
        {inYear.some((event) => event.kind === "business") && (
          <p className="side-note">
            An acquisition or sale is filed under item 2.01: the company completed buying or selling
            a business or large assets. The item does not say which, or what changed hands.
          </p>
        )}
        {covered !== null && covered > span.startOn && (
          <p className="side-note">
            <GapMark /> Current reports filed before {longDate(covered)} are not in this timeline.
          </p>
        )}
      </div>
      <div className="side-section">
        <h3>
          <Term name="Economic context" />, {monthName(month)}
        </h3>
        {monthData === null ? (
          <p className="side-note mt-0">
            <GapMark /> FRED has no figures for this month yet.
          </p>
        ) : (
          <>
            <dl className="side-list">
              <dt>
                <Term name="Interest rate" />
              </dt>
              <dd className="numbers">
                {monthData.interestRate === null ? <GapMark /> : rate(monthData.interestRate)}
              </dd>
              <dt>
                <Term name="Inflation" />
              </dt>
              <dd className="numbers">
                {monthData.inflation === null ? <GapMark /> : inflationText(monthData.inflation)}
              </dd>
              <dt>
                <Term name="Recession" />
              </dt>
              <dd>{monthData.recession ? "Yes" : "No"}</dd>
            </dl>
            <p className="side-note">
              {rates.length > 1 &&
                `During fiscal ${span.fiscalYear} the interest rate went from ${rate(rates[0]!)} to ${rate(rates.at(-1)!)}. `}
              {recessionMonths.length > 0
                ? `The US was in recession from ${monthName(recessionMonths[0]!.month)} to ${monthName(recessionMonths.at(-1)!.month)}. `
                : "There was no recession in the US. "}
              Inflation is how much higher prices were than twelve months before.
            </p>
          </>
        )}
        {sources !== null && (
          <p className="side-note">
            From FRED, the Federal Reserve's public database:{" "}
            <a href={sources.interestRate} target="_blank" rel="noreferrer">
              interest rate
            </a>
            ,{" "}
            <a href={sources.inflation} target="_blank" rel="noreferrer">
              inflation
            </a>
            ,{" "}
            <a href={sources.recession} target="_blank" rel="noreferrer">
              recessions
            </a>
            .
          </p>
        )}
      </div>
    </aside>
  );
}
