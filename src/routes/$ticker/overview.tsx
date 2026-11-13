import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CompanyFrame, searchYear, useReadyCompany } from "../../ui/company-frame";
import { useChooseYear } from "../../ui/company-header";
import { shortName } from "../../ui/logo-tile";
import { CashUse } from "../../ui/overview/cash-use";
import { DollarBar } from "../../ui/overview/dollar-bar";
import { growthLine } from "../../ui/overview/growth-line";
import { KeyFigures } from "../../ui/overview/key-figures";
import { Lead } from "../../ui/overview/lead";
import { Lines } from "../../ui/overview/lines";
import { Quote } from "../../ui/overview/quote";
import { YearsTable } from "../../ui/overview/years-table";
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
