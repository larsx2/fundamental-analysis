import type { CompanySummary, ListedCompany } from "../functions/companies";
import { noGrowth } from "../shared/company-summary";
import { plainName } from "./logo-tile";

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

export type Row = {
  readonly company: ListedCompany;
  readonly summary: CompanySummary | null;
};

export const newestRevenue = (summary: CompanySummary | null) => summary?.revenue.at(-1) ?? null;

export const noGrowthReason = (summary: CompanySummary | null) => {
  if (summary === null) return "not reported";
  const first = summary.years[0];
  switch (noGrowth(summary.revenue[0] ?? null, newestRevenue(summary))) {
    case "no-start":
      return `no revenue reported for fiscal ${first}`;
    case "no-end":
      return `no revenue reported for fiscal ${summary.fiscalYear}`;
    case "start-not-positive":
      return `revenue in fiscal ${first} was $0 or less`;
    case "end-not-positive":
      return `revenue in fiscal ${summary.fiscalYear} was $0 or less`;
    case null:
      return null;
  }
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
export const sortRows = (rows: ReadonlyArray<Row>, view: TableView) =>
  [...rows].sort((a, b) => {
    const x = sortValue(a, view.sort, view.units);
    const y = sortValue(b, view.sort, view.units);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    const order = typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y);
    return view.order === "asc" ? order : -order;
  });
