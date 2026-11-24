import { type CheckedFigure, valueOf } from "./figures";

// The figures that set ready companies side by side: each company's newest
// fiscal year, with ten years of revenue and operating margin behind it.

export const yearsShown = 10;

type SummaryInput = {
  readonly fiscalYear: number;
  readonly endOn: string;
  readonly terms: {
    readonly revenue: CheckedFigure;
    readonly operatingMargin: CheckedFigure;
    readonly netIncome: CheckedFigure;
    readonly freeCashFlow: CheckedFigure;
  };
};

export type CompanySummary = {
  readonly fiscalYear: number;
  readonly endOn: string;
  // One entry per fiscal year, oldest first; a year with no figure is null.
  readonly years: ReadonlyArray<number>;
  readonly revenue: ReadonlyArray<number | null>;
  readonly operatingMargin: ReadonlyArray<number | null>;
  readonly growth: number | null;
  readonly netIncome: number | null;
  readonly freeCashFlow: number | null;
};

export type NoGrowth = "no-start" | "no-end" | "start-not-positive" | "end-not-positive";

export const noGrowth = (start: number | null, end: number | null): NoGrowth | null =>
  start === null
    ? "no-start"
    : end === null
      ? "no-end"
      : start <= 0
        ? "start-not-positive"
        : end <= 0
          ? "end-not-positive"
          : null;

// The steady yearly rate that takes a number from its starting value to its
// ending value. Without both ends, or across a loss, there is no such rate.
export const compoundAnnualGrowthRate = (start: number | null, end: number | null, years: number) =>
  start === null || end === null || noGrowth(start, end) !== null
    ? null
    : (end / start) ** (1 / years) - 1;

export const summarise = (statements: ReadonlyArray<SummaryInput>): CompanySummary | null => {
  const byYear = new Map(statements.map((year) => [year.fiscalYear, year]));
  const newest = [...statements]
    .filter((year) => valueOf(year.terms.revenue) !== null)
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .at(-1);
  if (newest === undefined) return null;
  const years = Array.from(
    { length: yearsShown },
    (_, index) => newest.fiscalYear - yearsShown + 1 + index,
  );
  const figure = (year: number, key: keyof SummaryInput["terms"]) => {
    const statement = byYear.get(year);
    return statement === undefined ? null : valueOf(statement.terms[key]);
  };
  return {
    fiscalYear: newest.fiscalYear,
    endOn: newest.endOn,
    years,
    revenue: years.map((year) => figure(year, "revenue")),
    operatingMargin: years.map((year) => figure(year, "operatingMargin")),
    growth: compoundAnnualGrowthRate(
      figure(years[0] ?? newest.fiscalYear, "revenue"),
      figure(newest.fiscalYear, "revenue"),
      yearsShown - 1,
    ),
    netIncome: figure(newest.fiscalYear, "netIncome"),
    freeCashFlow: figure(newest.fiscalYear, "freeCashFlow"),
  };
};
