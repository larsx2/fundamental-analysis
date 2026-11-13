import { useRef } from "react";
import { figureOf } from "../../shared/figure-keys";
import { valueOf } from "../../shared/figures";
import { filingUrl, longDate, money, monthName, rate } from "../../shared/format";
import type { ReadyCompany } from "../company-frame";
import { GapMark } from "../marks";
import { useStickyTop } from "../sticky";
import { Term } from "../term";
import { businessIcon, officerIcon } from "./chart-parts";
import { kinds } from "./kinds";
import { day, type EconomyMonth, fiscalOf, inflationText, middle, type Span } from "./time";

export function Side({
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
            `A gap means ${name} did not report that line on its own this fiscal year. `}
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
