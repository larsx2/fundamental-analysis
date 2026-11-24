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

  // Ten fiscal years are nine steps apart. Revenue that grows 10% in each
  // of those nine steps grew at 10% a year.
  it("measures growth over the nine steps between the ten fiscal years shown", () => {
    const statements = Array.from({ length: 10 }, (_, index) =>
      year(2017 + index, amount(100 * 1.1 ** index)),
    );
    expect(summarise(statements)?.growth).toBeCloseTo(0.1, 6);
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

  it.each([
    { which: "the first has no statement", first: [], newest: 126 },
    { which: "the first has zero revenue", first: [year(2017, amount(0))], newest: 126 },
    { which: "the first has negative revenue", first: [year(2017, amount(-5))], newest: 126 },
    { which: "the newest has zero revenue", first: [year(2017, amount(117))], newest: 0 },
    { which: "the newest has negative revenue", first: [year(2017, amount(117))], newest: -5 },
  ])("gives no growth when $which", ({ first, newest }) => {
    const statements = [
      ...first,
      ...[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((fiscalYear) =>
        year(fiscalYear, amount(fiscalYear - 1900)),
      ),
      year(2026, amount(newest)),
    ];
    expect(summarise(statements)?.growth).toBeNull();
  });
});
