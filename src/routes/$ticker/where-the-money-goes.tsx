import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import type { StatementYear } from "../../functions/company";
import { valueOf } from "../../shared/figures";
import { CompanyFrame, searchYear, useReadyCompany } from "../../ui/company-frame";
import { centsOfDollar, lowerFirst, money, percent } from "../../ui/format";
import { Icon } from "../../ui/icons";
import { shortName } from "../../ui/logo-tile";
import { GapMark } from "../../ui/marks";
import { Bands } from "../../ui/money-flow/bands";
import { FiguresTable } from "../../ui/money-flow/figures-table";
import { yearParts } from "../../ui/money-flow/parts";
import { RollingNumber, useWidth } from "../../ui/motion";
import { Segmented } from "../../ui/segmented";
import { Term } from "../../ui/term";

type Drawing = "flow" | "table";

export const Route = createFileRoute("/$ticker/where-the-money-goes")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { year?: number | undefined; drawing?: Drawing | undefined } => {
    const year = searchYear(search);
    const drawing = search.drawing === "table" ? search.drawing : undefined;
    return {
      ...(year === undefined ? {} : { year }),
      ...(drawing === undefined ? {} : { drawing }),
    };
  },
  component: MoneyFlow,
});

// The flow needs room for four columns of labels. On a narrower screen the
// table remains.
const flowNeeds = 680;

function MoneyFlow() {
  const { ticker } = Route.useParams();
  const search = Route.useSearch();
  const { view, years, year } = useReadyCompany(ticker, search.year);
  const navigate = useNavigate({ from: Route.fullPath });
  const panel = useRef<HTMLElement>(null);
  const panelWidth = useWidth(panel, 1200);
  const flowFits = panelWidth >= flowNeeds;
  const drawing: Drawing = search.drawing === "table" || !flowFits ? "table" : "flow";
  const name = shortName(view.name);
  const previous = years.find((each) => each.fiscalYear === year.fiscalYear - 1);

  return (
    <CompanyFrame
      view={view}
      year={year}
      active="where-the-money-goes"
      title="where the money goes"
    >
      <Hero name={name} year={year} />
      <section ref={panel} className="panel panel-pad" aria-labelledby="chart-title">
        <div className="panel-title">
          <h2 id="chart-title">Where each dollar went in fiscal {year.fiscalYear}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Drawing"
              className="chart-switch"
              value={drawing}
              onChange={(next) =>
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    drawing: next === "flow" ? undefined : next,
                  }),
                  resetScroll: false,
                })
              }
              options={[
                {
                  value: "flow",
                  label: "Flow: follow this year's dollar",
                  content: <Icon name="bands" />,
                  hidden: !flowFits,
                },
                {
                  value: "table",
                  label: "Table: every figure for this year",
                  content: <Icon name="table" />,
                },
              ]}
            />
          </div>
        </div>
        <p className="verdict">{verdict(year)}</p>
        {drawing === "flow" && <Bands year={year} company={view.ticker} />}
        {drawing === "table" && <FiguresTable year={year} previous={previous} />}
      </section>
    </CompanyFrame>
  );
}

const verdict = (year: StatementYear) => {
  const revenue = valueOf(year.terms.revenue);
  const largest = yearParts(year)
    .filter((part) => part.value !== null && part.value > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  if (largest === undefined || revenue === null || largest.value === null) return "";
  return `${largest.name} is the largest part this year, at ${percent(largest.value / revenue)} of revenue.`;
};

function Hero({ name, year }: { readonly name: string; readonly year: StatementYear }) {
  const revenue = valueOf(year.terms.revenue);
  const all = yearParts(year);
  const cents = centsOfDollar(
    all.map((part) => part.value),
    revenue ?? 1,
  );
  const spent = all
    .map((part, index) => ({ part, cents: cents[index] ?? 0 }))
    .filter(
      ({ part, cents: share }) =>
        part.key !== "netIncome" && part.value !== null && part.value > 0 && share > 0,
    );
  const kept = all.find((part) => part.key === "netIncome")!;
  const keptCents = cents[all.indexOf(kept)] ?? 0;
  const gaps = all.filter((part) => part.figure.kind === "gap" && part.key !== "below");

  return (
    <div className="mb-8 grid gap-3">
      <div className="eyebrow">
        <Term name="Revenue" /> in fiscal {year.fiscalYear}
      </div>
      <div className="hero-figure numbers">
        {revenue === null ? <GapMark /> : <RollingNumber value={revenue} format={money} />}
      </div>
      {revenue !== null && revenue > 0 && (
        <p className="sentence">
          Of each dollar {name} brought in, it spent{" "}
          {spent.map(({ part, cents: share }, index) => (
            <span key={part.key}>
              {index > 0 && (index === spent.length - 1 ? " and " : ", ")}
              <strong>{share}&cent;</strong> on{" "}
              <Term name={part.name}>{lowerFirst(part.name)}</Term>
            </span>
          ))}
          .{" "}
          {kept.value !== null && kept.value > 0 ? (
            <>
              It kept <strong>{keptCents}&cent;</strong> as{" "}
              <Term name="Net income">net income</Term>.
            </>
          ) : kept.value !== null ? (
            <>
              Its <Term name="Net income">net income</Term> was a loss of{" "}
              <strong>{money(-kept.value)}</strong>.
            </>
          ) : null}
          {gaps.length > 0 &&
            ` ${name} reports no ${gaps.map((part) => part.name.toLowerCase()).join(" or ")}.`}
        </p>
      )}
    </div>
  );
}
