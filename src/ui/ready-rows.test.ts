import { describe, expect, it } from "vitest";
import type { CompanySummary, ListedCompany } from "../functions/companies";
import { type Row, type TableView, sortRows } from "./ready-rows";

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
