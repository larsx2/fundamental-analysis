import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { sum } from "d3-array";
import { type ReactNode, useState } from "react";
import { economyQuery, type StatementYear } from "../../functions/company";
import { type FigureKey, figureOf } from "../../shared/figure-keys";
import { type CheckedFigure, valueOf } from "../../shared/figures";
import { money, monthName, rate } from "../../shared/format";
import {
  CompanyFrame,
  type ReadyCompany,
  searchYear,
  useReadyCompany,
} from "../../ui/company-frame";
import { useChooseYear } from "../../ui/company-header";
import { shortName } from "../../ui/logo-tile";
import { GapMark } from "../../ui/marks";
import { Term } from "../../ui/term";
import { kinds } from "../../ui/timeline/kinds";
import { Rows } from "../../ui/timeline/rows";
import { Side } from "../../ui/timeline/side";
import {
  day,
  type EconomyMonth,
  fiscalOf,
  inflationText,
  middle,
  type Span,
  spansOf,
} from "../../ui/timeline/time";

export const Route = createFileRoute("/$ticker/timeline")({
  validateSearch: (search: Record<string, unknown>): { year?: number | undefined } => {
    const year = searchYear(search);
    return year === undefined ? {} : { year };
  },
  component: Timeline,
});

function Timeline() {
  const { ticker } = Route.useParams();
  const search = Route.useSearch();
  const { view, years, year } = useReadyCompany(ticker, search.year);
  const economy = useQuery(economyQuery);
  const spans = spansOf(years);
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
          <p className="tl-lead">Click or tap any year or month to see what was true then.</p>
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
            With the line of years under the chart selected, <kbd>{"←"}</kbd> <kbd>{"→"}</kbd> move
            one month and <kbd>Page Up</kbd> <kbd>Page Down</kbd> one year.
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
