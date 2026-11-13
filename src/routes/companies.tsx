import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { companiesQuery, type ListedCompany, summariesQuery } from "../functions/companies";
import { CollectProgress } from "../ui/collect-progress";
import { LogoTile, plainName } from "../ui/logo-tile";
import {
  type Order,
  type SortKey,
  type TableView,
  defaultView,
  firstOrder,
  sortKeys,
} from "../ui/ready-rows";
import { ReadyTable } from "../ui/ready-table";
import { Screen } from "../ui/screen";
import { OwnFigures, Term } from "../ui/term";
import { Welcome } from "../ui/companies/welcome";
import { FirstList } from "../ui/companies/first-list";
import { Finder } from "../ui/companies/finder";
import { Failed } from "../ui/companies/failed";

type CompaniesSearch = {
  readonly find?: string;
  readonly sort?: SortKey;
  readonly order?: Order;
  readonly per?: 100;
};

const isSortKey = (value: unknown): value is SortKey =>
  typeof value === "string" && (sortKeys as ReadonlyArray<string>).includes(value);

const readyCiks = (companies: ReadonlyArray<ListedCompany>) =>
  companies.filter((company) => company.state === "ready").map((company) => company.cik);

// How the ready companies are sorted and shown lives in the address bar, and
// is left out of it while it is the default.
const viewOf = (search: CompaniesSearch): TableView => {
  const sort = search.sort ?? defaultView.sort;
  return {
    sort,
    order: search.order ?? firstOrder(sort),
    units: search.per === 100 ? "per100" : "dollars",
  };
};

const searchOf = (find: string | undefined, view: TableView): CompaniesSearch => ({
  ...(find === undefined ? {} : { find }),
  ...(view.sort === defaultView.sort ? {} : { sort: view.sort }),
  ...(view.order === firstOrder(view.sort) ? {} : { order: view.order }),
  ...(view.units === "per100" ? { per: 100 as const } : {}),
});

export const Route = createFileRoute("/companies")({
  validateSearch: (search: Record<string, unknown>): CompaniesSearch => ({
    ...(typeof search.find === "string" && search.find !== "" ? { find: search.find } : {}),
    ...(isSortKey(search.sort) ? { sort: search.sort } : {}),
    ...(search.order === "asc" || search.order === "desc" ? { order: search.order } : {}),
    ...(Number(search.per) === 100 ? { per: 100 as const } : {}),
  }),
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(companiesQuery);
    await context.queryClient.ensureQueryData(summariesQuery(readyCiks(data.companies)));
  },
  component: CompaniesPage,
});

const noFigures = () => null;

function CompaniesPage() {
  const { data } = useSuspenseQuery(companiesQuery);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/companies" });
  const ready = data.companies
    .filter((company) => company.state === "ready")
    .sort((a, b) => a.name.localeCompare(b.name));
  const line = data.companies.filter(
    (company) => company.state === "waiting" || company.state === "collecting",
  );
  const failed = data.companies.filter((company) => company.state === "failed");
  const nothingYet = ready.length === 0 && line.length === 0 && failed.length === 0;

  useEffect(() => {
    document.title = "Companies";
  }, []);

  return (
    <OwnFigures figure={noFigures}>
      <Screen active="companies">
        <div>
          <h1 className="m-0 mb-2 text-xl font-semibold tracking-[-0.01em]">Companies</h1>
          <p className="m-0 mb-6 max-w-[62ch] text-text-2">
            {data.known > 0
              ? `Search covers all ${data.known.toLocaleString("en-US")} public companies on the SEC's list. A company is collected only when you ask for it.`
              : "Search covers every public company on the SEC's list. A company is collected only when you ask for it."}
          </p>
          {data.known > 0 ? (
            <Finder line={line} />
          ) : (
            <FirstList contactGiven={data.contact !== null} />
          )}
        </div>
        {nothingYet && data.known > 0 && <Welcome />}
        {line.length > 0 && (
          <section className="mt-12" aria-labelledby="working-title">
            <h2 id="working-title" className="m-0 mb-3 text-m font-semibold">
              <Term name="Collecting" />
              <span className="ml-1.5 font-normal text-text-3">{line.length}</span>
            </h2>
            <ul className="rows">
              {line.map((company, index) => (
                <li key={company.cik} className="progress-row" data-cik={company.cik} tabIndex={-1}>
                  <LogoTile name={plainName(company.name)} cik={company.cik} size={44} />
                  <div className="row-main">
                    <div className="row-title">
                      <strong>{plainName(company.name)}</strong>
                      <span className="ticker">{company.ticker}</span>
                    </div>
                    <CollectProgress
                      name={plainName(company.name)}
                      state={
                        index === 0 && company.state === "collecting" ? "collecting" : "waiting"
                      }
                      step={company.collectStep}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {failed.length > 0 && <Failed companies={failed} />}
        {ready.length > 0 && (
          <ReadyTable
            companies={ready}
            view={viewOf(search)}
            onView={(view) =>
              void navigate({
                search: (previous) => searchOf(previous.find, view),
                replace: true,
                resetScroll: false,
              })
            }
          />
        )}
      </Screen>
    </OwnFigures>
  );
}
