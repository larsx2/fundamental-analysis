import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, useRef, useState } from "react";
import type { FigureKey } from "../../shared/figure-keys";
import { CompanyFrame, searchYear, useReadyCompany } from "../../ui/company-frame";
import { FigureCard } from "../../ui/statements/figure-card";
import { Lead } from "../../ui/statements/lead";
import { statements, type Tab, tabOrder } from "../../ui/statements/rows";
import { Sheet } from "../../ui/statements/sheet";
import { Term } from "../../ui/term";

export const Route = createFileRoute("/$ticker/statements")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { year?: number | undefined; tab?: Tab | undefined } => {
    const year = searchYear(search);
    const tab = search.tab === "balance" || search.tab === "cash" ? search.tab : undefined;
    return {
      ...(year === undefined ? {} : { year }),
      ...(tab === undefined ? {} : { tab }),
    };
  },
  component: Statements,
});

function Statements() {
  const { ticker } = Route.useParams();
  const search = Route.useSearch();
  const { view, years, year } = useReadyCompany(ticker, search.year);
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: Tab = search.tab ?? "income";
  const [selected, setSelected] = useState<Record<Tab, ReadonlyArray<FigureKey>>>({
    income: statements.income.start,
    balance: statements.balance.start,
    cash: statements.cash.start,
  });
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const chooseTab = (next: Tab, focus: boolean) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        tab: next === "income" ? undefined : next,
      }),
      resetScroll: false,
    });
    if (focus) requestAnimationFrame(() => tabs.current[tabOrder.indexOf(next)]?.focus());
  };

  const onTabKey = (event: KeyboardEvent) => {
    const at = tabOrder.indexOf(tab);
    const next = {
      ArrowRight: tabOrder[(at + 1) % tabOrder.length],
      ArrowLeft: tabOrder[(at + tabOrder.length - 1) % tabOrder.length],
      Home: tabOrder[0],
      End: tabOrder[tabOrder.length - 1],
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    chooseTab(next, true);
  };

  return (
    <CompanyFrame view={view} year={year} active="statements" title="statements">
      <section className="panel panel-pad statements" aria-labelledby="statements-title">
        <h2 className="visually-hidden" id="statements-title">
          Statements
        </h2>
        <div className="mb-4 flex flex-wrap">
          <div
            className="segmented tabs"
            role="tablist"
            aria-label="Statements"
            onKeyDown={onTabKey}
          >
            {tabOrder.map((key, index) => (
              <button
                key={key}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={key === tab}
                aria-controls="sheet"
                tabIndex={key === tab ? 0 : -1}
                onClick={() => chooseTab(key, false)}
              >
                {statements[key].title}
              </button>
            ))}
          </div>
        </div>
        <Lead view={view} year={year} tab={tab} />
        <Sheet
          key={`${view.ticker}-${tab}`}
          view={view}
          years={years}
          year={year}
          tab={tab}
          selected={selected[tab]}
          setSelected={(keys) => setSelected((all) => ({ ...all, [tab]: keys }))}
        />
        <p className="mt-4 mb-0 text-xs text-text-3">
          B means billions of dollars and M millions. Tick a line to draw it across the fiscal years
          with its <Term name="Year-over-year change">year-over-year change</Term>. Choose any
          number to see the filing it came from.
        </p>
      </section>
      <FigureCard view={view} tab={tab} />
    </CompanyFrame>
  );
}
