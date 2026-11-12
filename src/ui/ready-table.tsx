import { Menu } from "@base-ui/react/menu";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { line } from "d3-shape";
import { motion } from "motion/react";
import { type MouseEvent, useRef, useState } from "react";
import { type CompanySummary, type ListedCompany, summariesQuery } from "../functions/companies";
import { longDate, money, moneyShort, percent } from "./format";
import { Icon } from "./icons";
import { LogoTile, plainName } from "./logo-tile";
import { glide, useStill } from "./motion";
import { RemoveDialog } from "./remove-company";
import { Segmented } from "./segmented";
import { Term } from "./term";

export const sortKeys = ["name", "revenue", "growth", "margin", "net", "free", "asof"] as const;
export type SortKey = (typeof sortKeys)[number];
export type Order = "asc" | "desc";
export type Units = "dollars" | "per100";
export type TableView = {
  readonly sort: SortKey;
  readonly order: Order;
  readonly units: Units;
};

export const defaultView: TableView = {
  sort: "revenue",
  order: "desc",
  units: "dollars",
};

// Names read A to Z first; figures and dates largest or newest first.
export const firstOrder = (key: SortKey): Order => (key === "name" ? "asc" : "desc");

const columns: ReadonlyArray<{
  readonly key: SortKey;
  readonly label: string;
}> = [
  { key: "name", label: "Company" },
  { key: "revenue", label: "Revenue" },
  { key: "growth", label: "Growth" },
  { key: "margin", label: "Operating margin" },
  { key: "net", label: "Net income" },
  { key: "free", label: "Free cash flow" },
  { key: "asof", label: "As of" },
];

type Row = {
  readonly company: ListedCompany;
  readonly summary: CompanySummary | null;
};

const minus = "−";

const newestRevenue = (summary: CompanySummary | null) => summary?.revenue.at(-1) ?? null;

const perHundred = (value: number, revenue: number) => {
  const cents = (value / revenue) * 100;
  return `${cents < 0 ? minus : ""}$${Math.abs(cents).toFixed(1)}`;
};

// A fiscal year of 52 or 53 weeks can end in the first days of the next
// month, as Costco's does; it belongs to the month before.
const endMonth = (iso: string) => {
  const end = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (end.getUTCDate() <= 7) end.setUTCDate(0);
  return end.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
};

const sortValue = (row: Row, key: SortKey, units: Units): string | number | null => {
  const { company, summary } = row;
  const revenue = newestRevenue(summary);
  const share = (value: number | null) =>
    value === null || units === "dollars"
      ? value
      : revenue === null || revenue <= 0
        ? null
        : value / revenue;
  switch (key) {
    case "name":
      return plainName(company.name);
    case "revenue":
      return revenue;
    case "growth":
      return summary?.growth ?? null;
    case "margin":
      return summary?.operatingMargin.at(-1) ?? null;
    case "net":
      return share(summary?.netIncome ?? null);
    case "free":
      return share(summary?.freeCashFlow ?? null);
    case "asof":
      return company.asOf;
  }
};

// A company without the figure goes last whichever way the column is sorted.
const sortRows = (rows: ReadonlyArray<Row>, view: TableView) =>
  [...rows].sort((a, b) => {
    const x = sortValue(a, view.sort, view.units);
    const y = sortValue(b, view.sort, view.units);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    const order = typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y);
    return view.order === "asc" ? order : -order;
  });

const points = (summary: CompanySummary, values: ReadonlyArray<number | null>) =>
  summary.years.flatMap((year, index) => {
    const value = values[index];
    return value === null || value === undefined ? [] : [{ year, value }];
  });

const revenueSentence = (summary: CompanySummary) => {
  const known = points(summary, summary.revenue);
  const first = known[0];
  const last = known.at(-1);
  if (first === undefined || last === undefined) return "No revenue reported.";
  const peak = known.reduce((high, each) => (each.value > high.value ? each : high), first);
  const moved = last.value >= first.value ? "rose" : "fell";
  const high = peak === last ? "" : `, after a high of ${money(peak.value)} in fiscal ${peak.year}`;
  return `Revenue ${moved} from ${money(first.value)} in fiscal ${first.year} to ${money(last.value)} in fiscal ${last.year}${high}.`;
};

const marginSentence = (summary: CompanySummary) => {
  const known = points(summary, summary.operatingMargin);
  const first = known[0];
  const last = known.at(-1);
  if (first === undefined || last === undefined) return "No operating margin reported.";
  const losses = known.filter((each) => each.value < 0);
  const lossFirst = losses[0];
  const lossLast = losses.at(-1);
  const loss =
    lossFirst === undefined || lossLast === undefined
      ? ""
      : lossFirst === lossLast
        ? `, with an operating loss in fiscal ${lossFirst.year}`
        : `, with an operating loss from fiscal ${lossFirst.year} through fiscal ${lossLast.year}`;
  return `Operating margin went from ${percent(first.value)} in fiscal ${first.year} to ${percent(last.value)} in fiscal ${last.year}${loss}.`;
};

const chartHeight = 24;

// Ten fiscal years of revenue from zero, the newest in white. A year with no
// figure keeps its place and draws nothing.
function RevenueBars({ summary }: { readonly summary: CompanySummary }) {
  const high = Math.max(0, ...summary.revenue.map((value) => value ?? 0));
  return (
    <span className="ready-bars" role="img" aria-label={revenueSentence(summary)}>
      {summary.revenue.map((value, index) => (
        <i
          key={summary.years[index]}
          style={{
            height:
              value === null || high === 0
                ? 0
                : Math.max(2, Math.round((Math.max(0, value) / high) * chartHeight)),
          }}
        />
      ))}
    </span>
  );
}

// Ten fiscal years of operating margin on the company's own scale, with the
// zero line only where the margin crosses it.
function MarginLine({ summary }: { readonly summary: CompanySummary }) {
  const width = 64;
  const pad = 3;
  const values = summary.operatingMargin;
  const known = values.filter((value): value is number => value !== null);
  const low = Math.min(...known);
  const high = Math.max(...known);
  const x = (index: number) => pad + (index / (values.length - 1)) * (width - 2 * pad);
  const y = (value: number) =>
    pad + (1 - (value - low) / (high - low || 1)) * (chartHeight - 2 * pad);
  const path =
    line<number | null>()
      .defined((value) => value !== null)
      .x((_, index) => x(index))
      .y((value) => y(value ?? 0))(values) ?? "";
  const lastAt = values.findLastIndex((value) => value !== null);
  const last = values[lastAt];
  return (
    <svg
      className="ready-spark"
      role="img"
      aria-label={marginSentence(summary)}
      width={width}
      height={chartHeight}
      viewBox={`0 0 ${width} ${chartHeight}`}
    >
      {low < 0 && high > 0 && <line className="zero" x1={0} x2={width} y1={y(0)} y2={y(0)} />}
      {known.length > 1 && <path d={path} />}
      {last !== null && last !== undefined && <circle cx={x(lastAt)} cy={y(last)} r={2.5} />}
    </svg>
  );
}

function NoFigure({ why }: { readonly why: string }) {
  return (
    <span className="fig text-text-3">
      <span aria-hidden="true">–</span>
      <span className="visually-hidden">{why}</span>
    </span>
  );
}

function RowMenu({ company }: { readonly company: ListedCompany }) {
  const [removing, setRemoving] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const name = plainName(company.name);
  return (
    <>
      <Menu.Root>
        <Menu.Trigger ref={trigger} className="ready-more" aria-label={`More for ${name}`}>
          <Icon name="more" className="h-4 w-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4}>
            <Menu.Popup className="ready-menu">
              <Menu.LinkItem
                className="ready-menu-item"
                href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${company.cik}`}
                target="_blank"
                rel="noreferrer"
              >
                See its filings on the SEC
                <Icon name="external" className="h-4 w-4" />
              </Menu.LinkItem>
              <Menu.Item className="ready-menu-item" onClick={() => setRemoving(true)}>
                Remove {name} from this computer
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <RemoveDialog
        company={company}
        open={removing}
        onOpenChange={setRemoving}
        returnFocusTo={trigger}
      />
    </>
  );
}

function ReadyRow({
  row,
  units,
  checkedTogether,
}: {
  readonly row: Row;
  readonly units: Units;
  readonly checkedTogether: boolean;
}) {
  const navigate = useNavigate();
  const still = useStill();
  const { company, summary } = row;
  const name = plainName(company.name);
  const revenue = newestRevenue(summary);
  const margin = summary?.operatingMargin.at(-1) ?? null;
  const growth = summary?.growth ?? null;
  const per = units === "per100";
  const amount = (value: number | null) =>
    value === null ? (
      <NoFigure why="not reported" />
    ) : (
      <span className="fig">
        {per && revenue !== null && revenue > 0 ? perHundred(value, revenue) : moneyShort(value)}
      </span>
    );

  // Only the name is a link. A click anywhere else on the row opens the
  // company too, unless it lands on a control, in the menu or dialog drawn
  // outside the row, or ends a selection of text.
  const open = (event: MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as Element;
    if (!event.currentTarget.contains(target)) return;
    if (target.closest("a, button") !== null) return;
    if (String(window.getSelection()) !== "") return;
    const link = event.currentTarget.querySelector<HTMLAnchorElement>("a.ready-name");
    if (link !== null && (event.metaKey || event.ctrlKey)) {
      window.open(link.href, "_blank", "noopener");
      return;
    }
    void navigate({
      to: "/$ticker/where-the-money-goes",
      params: { ticker: company.ticker },
    });
  };

  return (
    <motion.tr layout={still ? false : "position"} transition={glide} onClick={open}>
      <th scope="row">
        <div className="ready-who">
          <LogoTile name={name} cik={company.cik} size={40} />
          <div className="ready-who-text">
            <div className="ready-line1">
              <Link
                className="ready-name"
                to="/$ticker/where-the-money-goes"
                params={{ ticker: company.ticker }}
              >
                {name}
              </Link>
              <span className="ticker">{company.ticker}</span>
            </div>
            {summary !== null && (
              <div className="ready-line2">
                Fiscal {summary.fiscalYear}, ended {endMonth(summary.endOn)}
              </div>
            )}
          </div>
        </div>
      </th>
      <td>
        <span className="cell-label">Revenue</span>
        {summary === null || revenue === null ? (
          <NoFigure why="not reported" />
        ) : (
          <span className="ready-chart-cell wide">
            <RevenueBars summary={summary} />
            <span className="fig">{moneyShort(revenue)}</span>
          </span>
        )}
      </td>
      <td>
        <span className="cell-label">Growth</span>
        {growth === null ? (
          <NoFigure why="fewer than ten fiscal years to compare" />
        ) : (
          <span className="fig">{percent(growth)}</span>
        )}
      </td>
      <td>
        <span className="cell-label">Operating margin</span>
        {summary === null || margin === null ? (
          <NoFigure why="not reported" />
        ) : (
          <span className="ready-chart-cell">
            <MarginLine summary={summary} />
            <span className="fig">{percent(margin)}</span>
          </span>
        )}
      </td>
      <td>
        <span className="cell-label">Net income</span>
        {amount(summary?.netIncome ?? null)}
        {per && <span className="fig-sub card-only">per $100 of revenue</span>}
      </td>
      <td>
        <span className="cell-label">Free cash flow</span>
        {amount(summary?.freeCashFlow ?? null)}
        <span className="fig-sub card-only">calculated{per ? ", per $100 of revenue" : ""}</span>
      </td>
      <td>
        <span className="cell-label">As of</span>
        <span className="date">{company.asOf === null ? "–" : longDate(company.asOf)}</span>
        {!checkedTogether && company.lastCheckedOn !== null && (
          <span className="fig-sub">Last checked {longDate(company.lastCheckedOn)}</span>
        )}
      </td>
      <td className="ready-actions">
        <RowMenu company={company} />
      </td>
    </motion.tr>
  );
}

export function ReadyTable({
  companies,
  view,
  onView,
}: {
  readonly companies: ReadonlyArray<ListedCompany>;
  readonly view: TableView;
  readonly onView: (view: TableView) => void;
}) {
  const { data = [] } = useQuery({
    ...summariesQuery(companies.map((company) => company.cik)),
    placeholderData: keepPreviousData,
  });
  const summaries = new Map(data.map((each) => [each.cik, each.summary]));
  const rows = sortRows(
    companies.map((company) => ({
      company,
      summary: summaries.get(company.cik) ?? null,
    })),
    view,
  );
  // "Last checked" shows on a row only when the companies were checked on different days.
  const checkedOn = new Set(companies.map((company) => company.lastCheckedOn));
  const sharedDay = checkedOn.size === 1 ? (companies[0]?.lastCheckedOn ?? null) : null;

  const sortBy = (key: SortKey) =>
    onView({
      ...view,
      sort: key,
      order: view.sort === key ? (view.order === "asc" ? "desc" : "asc") : firstOrder(key),
    });

  return (
    <section className="mt-12" aria-labelledby="ready-title">
      <div className="ready-head">
        <h2 id="ready-title" className="m-0 text-m font-semibold">
          <Term name="Ready" /> companies{" "}
          <span className="ml-0.5 font-normal text-text-3">{companies.length}</span>
        </h2>
        <div className="ready-units">
          <span aria-hidden="true">Net income and free cash flow in</span>
          <Segmented
            label="Net income and free cash flow in"
            value={view.units}
            options={[
              { value: "dollars", label: "Dollars" },
              { value: "per100", label: "Per $100 of revenue" },
            ]}
            onChange={(units) => onView({ ...view, units })}
          />
        </div>
      </div>

      <div className="ready-wrap">
        <table className="ready-table">
          <caption className="visually-hidden">Ready companies, newest fiscal year of each</caption>
          <thead>
            <tr>
              {columns.map((column) => {
                const on = view.sort === column.key;
                const order = on ? view.order : firstOrder(column.key);
                const arrow = (
                  <span className="arrow" aria-hidden="true">
                    {order === "asc" ? "↑" : "↓"}
                  </span>
                );
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={on ? (view.order === "asc" ? "ascending" : "descending") : undefined}
                  >
                    <button type="button" className="ready-sort" onClick={() => sortBy(column.key)}>
                      {column.key !== "name" && arrow}
                      {column.label}
                      {column.key === "name" && arrow}
                    </button>
                  </th>
                );
              })}
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ReadyRow
                key={row.company.cik}
                row={row}
                units={view.units}
                checkedTogether={sharedDay !== null}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
