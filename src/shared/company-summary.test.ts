import { describe, expect, it } from "vitest";
import { compoundAnnualGrowthRate, summarise } from "./company-summary";
import { type CheckedFigure, gapFigure } from "./figures";

const amount = (value: number): CheckedFigure => ({
  kind: "calculated",
  value,
  from: [],
  setAside: null,
  doubtful: null,
});

const year = (fiscalYear: number, revenue: CheckedFigure) => ({
  fiscalYear,
  endOn: `${fiscalYear}-09-30`,
  terms: {
    revenue,
    operatingMargin: gapFigure,
    netIncome: gapFigure,
    freeCashFlow: gapFigure,
  },
});

describe("growth of revenue across ready companies", () => {
  // The glossary's own example: revenue that doubles in five years grew at a
  // compound annual growth rate of about 15%. A plain average would say 20%.
  it("reads revenue that doubles in five years as about 15% a year", () => {
    expect(compoundAnnualGrowthRate(100, 200, 5)).toBeCloseTo(0.1487, 4);
  });

  // A gap is never zero, and the rate is over the same ten fiscal years for
  // every company, so a missing first year gives no rate at all rather than
  // one measured from a later year.
  it("gives no growth when the first of the ten fiscal years is a gap", () => {
    const statements = [
      year(2017, gapFigure),
      ...[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((fiscalYear) =>
        year(fiscalYear, amount(fiscalYear - 1900)),
      ),
    ];
    expect(summarise(statements)?.growth).toBeNull();
  });
});
