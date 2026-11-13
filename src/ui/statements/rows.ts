import type { FigureKey } from "../../shared/figure-keys";

export type Tab = "income" | "balance" | "cash";
export type Unit = "money" | "percent" | "perShare";

export type Row = {
  readonly key: FigureKey;
  readonly term: string;
  readonly label?: string;
  // Debt raised and repaid are both the glossary's debt, with a word after it.
  readonly after?: string;
  readonly kind?: "total" | "calc";
  readonly unit?: Unit;
  readonly part?: string;
};

export type Group = {
  readonly head?: string;
  readonly rows: ReadonlyArray<Row>;
};

export const statements: Record<
  Tab,
  {
    readonly title: string;
    readonly instant: boolean;
    readonly groups: ReadonlyArray<Group>;
    readonly start: ReadonlyArray<FigureKey>;
  }
> = {
  income: {
    title: "Income statement",
    instant: false,
    groups: [
      {
        rows: [
          { key: "revenue", term: "Revenue", kind: "total" },
          {
            key: "costOfRevenue",
            term: "Cost of revenue",
            part: "var(--color-part-cost)",
          },
          { key: "grossProfit", term: "Gross profit", kind: "total" },
          {
            key: "grossMargin",
            term: "Gross margin",
            kind: "calc",
            unit: "percent",
          },
        ],
      },
      {
        rows: [
          {
            key: "researchAndDevelopment",
            term: "Research and development",
            part: "var(--color-part-research)",
          },
          {
            key: "sellingGeneralAndAdministrative",
            term: "Selling, general and administrative",
            part: "var(--color-part-selling)",
          },
          {
            key: "otherOperatingExpenses",
            term: "Other operating expenses",
            part: "var(--color-part-other)",
          },
          { key: "operatingIncome", term: "Operating income", kind: "total" },
          {
            key: "operatingMargin",
            term: "Operating margin",
            kind: "calc",
            unit: "percent",
          },
        ],
      },
      {
        rows: [
          {
            key: "below",
            term: "Interest, other income and tax",
            part: "var(--color-part-below)",
          },
          {
            key: "netIncome",
            term: "Net income",
            kind: "total",
            part: "var(--color-part-kept)",
          },
          { key: "netMargin", term: "Margin", kind: "calc", unit: "percent" },
          {
            key: "earningsPerShare",
            term: "Earnings per share",
            unit: "perShare",
          },
        ],
      },
    ],
    start: ["revenue", "netIncome"],
  },
  balance: {
    title: "Balance sheet",
    instant: true,
    groups: [
      {
        head: "What it owns",
        rows: [
          { key: "cash", term: "Cash" },
          { key: "receivables", term: "Receivables" },
          { key: "inventory", term: "Inventory" },
          {
            key: "propertyPlantAndEquipment",
            term: "Property, plant and equipment",
          },
          { key: "goodwill", term: "Goodwill" },
          { key: "assets", term: "Asset", label: "Assets", kind: "total" },
        ],
      },
      {
        head: "What it owes",
        rows: [
          { key: "debt", term: "Debt" },
          { key: "netDebt", term: "Net debt", kind: "calc" },
          {
            key: "liabilities",
            term: "Liability",
            label: "Liabilities",
            kind: "total",
          },
        ],
      },
      {
        head: "What is left for the owners",
        rows: [{ key: "equity", term: "Equity", kind: "total" }],
      },
    ],
    start: ["assets", "liabilities", "equity"],
  },
  cash: {
    title: "Cash flow statement",
    instant: false,
    groups: [
      {
        head: "Running the business",
        rows: [
          {
            key: "netIncome",
            term: "Net income",
            part: "var(--color-part-kept)",
          },
          {
            key: "depreciationAndAmortization",
            term: "Depreciation and amortization",
          },
          { key: "stockBasedCompensation", term: "Stock-based compensation" },
          {
            key: "operatingCashFlow",
            term: "Operating cash flow",
            kind: "total",
          },
        ],
      },
      {
        head: "Investing",
        rows: [
          { key: "capitalExpenditure", term: "Capital expenditure" },
          { key: "freeCashFlow", term: "Free cash flow", kind: "calc" },
          { key: "acquisitions", term: "Acquisition", label: "Acquisitions" },
        ],
      },
      {
        head: "Financing",
        rows: [
          { key: "dividends", term: "Dividend", label: "Dividends" },
          {
            key: "shareBuybacks",
            term: "Share buyback",
            label: "Share buybacks",
          },
          {
            key: "debtRaised",
            term: "Debt",
            label: "Debt raised",
            after: "raised",
          },
          {
            key: "debtRepaid",
            term: "Debt",
            label: "Debt repaid",
            after: "repaid",
          },
        ],
      },
    ],
    start: ["operatingCashFlow", "freeCashFlow"],
  },
};

export const tabOrder: ReadonlyArray<Tab> = ["income", "balance", "cash"];

export const labelOf = (row: Row) => row.label ?? row.term;

export const rowsOf = (tab: Tab) => statements[tab].groups.flatMap((group) => group.rows);
