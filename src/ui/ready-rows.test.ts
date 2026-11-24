import { describe, expect, it } from "vitest";
import type { CompanySummary, ListedCompany } from "../functions/companies";
import { type Row, type TableView, noGrowthReason, sortRows } from "./ready-rows";

const row = (name: string, figures: Partial<CompanySummary> | null): Row => ({
  company: {
    cik: name.length,
    name,
    ticker: name.slice(0, 4).toUpperCase(),
    state: "ready",
    asOf: null,
    lastCheckedOn: null,
    failureReason: null,
    collectStep: null,
    latestFiscalYear: 2026,
  } satisfies ListedCompany,
  summary:
    figures === null
      ? null
      : {
          fiscalYear: 2026,
          endOn: "2026-09-30",
          years: [2026],
          revenue: [null],
          operatingMargin: [null],
          growth: null,
          netIncome: null,
          freeCashFlow: null,
          ...figures,
        },
});

const names = (rows: ReadonlyArray<Row>, view: TableView) =>
  sortRows(rows, view).map((each) => each.company.name);

const small = row("Small Shop", { revenue: [100], netIncome: 30 });
const middle = row("Middle Maker", { revenue: [2_000], netIncome: 100 });
const large = row("Large Stores", { revenue: [30_000], netIncome: 600 });
const unknown = row("No Figures", null);
const rows = [middle, unknown, large, small];

describe("the order of the ready companies", () => {
  it("puts the largest revenue first, and the smallest first when turned round", () => {
    expect(names(rows, { sort: "revenue", order: "desc", units: "dollars" })).toEqual([
      "Large Stores",
      "Middle Maker",
      "Small Shop",
      "No Figures",
    ]);
    expect(names(rows, { sort: "revenue", order: "asc", units: "dollars" })).toEqual([
      "Small Shop",
      "Middle Maker",
      "Large Stores",
      "No Figures",
    ]);
  });

  it("reads names from A to Z", () => {
    expect(names(rows, { sort: "name", order: "asc", units: "dollars" })).toEqual([
      "Large Stores",
      "Middle Maker",
      "No Figures",
      "Small Shop",
    ]);
  });

  it("ranks net income by its share of revenue when figures are shown per $100 of revenue", () => {
    expect(names(rows, { sort: "net", order: "desc", units: "dollars" })).toEqual([
      "Large Stores",
      "Middle Maker",
      "Small Shop",
      "No Figures",
    ]);
    expect(names(rows, { sort: "net", order: "desc", units: "per100" })).toEqual([
      "Small Shop",
      "Middle Maker",
      "Large Stores",
      "No Figures",
    ]);
  });
});

describe("why a company has no growth", () => {
  const tenYears = (first: number | null, newest: number | null) =>
    row("Ten Years", {
      years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
      revenue: [first, 10, 10, 10, 10, 10, 10, 10, 10, newest],
    }).summary;

  it.each([
    { case: "no summary", summary: null, reason: "not reported" },
    {
      case: "a missing first fiscal year",
      summary: tenYears(null, 20),
      reason: "no revenue reported for fiscal 2017",
    },
    {
      case: "a first fiscal year of $0 or less",
      summary: tenYears(0, 20),
      reason: "revenue in fiscal 2017 was $0 or less",
    },
    {
      case: "no revenue in the newest fiscal year",
      summary: tenYears(10, null),
      reason: "no revenue reported for fiscal 2026",
    },
    {
      case: "a newest fiscal year of $0",
      summary: tenYears(10, 0),
      reason: "revenue in fiscal 2026 was $0 or less",
    },
    {
      case: "a newest fiscal year below $0",
      summary: tenYears(10, -3),
      reason: "revenue in fiscal 2026 was $0 or less",
    },
  ])("says why for $case", ({ summary, reason }) => {
    expect(noGrowthReason(summary)).toBe(reason);
  });

  it("gives no reason when there is a rate", () => {
    expect(noGrowthReason(tenYears(10, 20))).toBeNull();
  });
});
