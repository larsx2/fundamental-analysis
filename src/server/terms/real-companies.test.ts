import { readFileSync } from "node:fs";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Collect } from "../collect";
import { databaseLayer } from "../database";
import { ReportedNumbers } from "../reported-numbers";
import { Sec } from "../sec";
import type { TermKey } from "./term-tags";
import { termTableFor } from "./terms";

const companies = { apple: 320193, microsoft: 789019, costco: 909832 } as const;
type Company = keyof typeof companies;

const extract = (company: Company): unknown =>
  JSON.parse(readFileSync(new URL(`../testdata/${company}.json`, import.meta.url), "utf8"));

const fiscalYear = (company: Company, year: number) =>
  Effect.gen(function* () {
    yield* (yield* Collect).reportedNumbers(companies[company]);
    const table = yield* termTableFor(companies[company]);
    return {
      table,
      year: table.fiscalYears.find((each) => each.fiscalYear === year)!.terms,
    };
  }).pipe(
    Effect.provide(
      Collect.layer.pipe(
        Layer.provideMerge(ReportedNumbers.layer),
        Layer.provideMerge(databaseLayer(":memory:")),
        Layer.provide(
          Layer.succeed(
            Sec,
            Sec.of({
              getJson: () => Effect.succeed(extract(company)),
              getText: () => Effect.die("unused"),
            }),
          ),
        ),
      ),
    ),
  );

const inMillions = (terms: Record<TermKey, { kind: string; value?: number }>) =>
  Object.fromEntries(
    Object.entries(terms).map(([term, figure]) => [
      term,
      figure.value === undefined ? figure.kind : figure.value / 1_000_000,
    ]),
  );

describe("the three slice companies, from trimmed SEC data", () => {
  it.effect("Apple's fiscal 2023 matches its annual report", () =>
    Effect.gen(function* () {
      const { year } = yield* fiscalYear("apple", 2023);
      expect(inMillions(year)).toEqual({
        revenue: 383_285,
        costOfRevenue: 214_137,
        grossProfit: 169_148,
        researchAndDevelopment: 29_915,
        sellingGeneralAndAdministrative: 24_932,
        otherOperatingExpenses: 0,
        operatingIncome: 114_301,
        netIncome: 96_995,
      });
    }),
  );

  it.effect(
    "Costco's fiscal 2023 has a calculated gross profit and a gap for research and development",
    () =>
      Effect.gen(function* () {
        const { year } = yield* fiscalYear("costco", 2023);
        expect(inMillions(year)).toMatchObject({
          revenue: 242_290,
          costOfRevenue: 212_586,
          grossProfit: 29_704,
          researchAndDevelopment: "gap",
        });
        expect(year.grossProfit.kind).toBe("calculated");
      }),
  );

  it.effect("Microsoft's fiscal 2023 adds up selling, general and administrative", () =>
    Effect.gen(function* () {
      const { year } = yield* fiscalYear("microsoft", 2023);
      expect(year.sellingGeneralAndAdministrative).toMatchObject({
        kind: "calculated",
        value: 30_334_000_000,
      });
    }),
  );

  it.effect("revenue is reported once for every fiscal year from 2008 to 2026", () =>
    Effect.forEach(Object.keys(companies) as Array<Company>, (company) =>
      Effect.gen(function* () {
        const { table } = yield* fiscalYear(company, 2023);
        const years = table.fiscalYears
          .filter((each) => each.terms.revenue.kind === "reported")
          .map((each) => each.fiscalYear)
          .filter((each) => each >= 2008);
        expect(years, company).toEqual(Array.from({ length: 19 }, (_, n) => 2008 + n));
      }),
    ),
  );
});

describe("what an investment adviser would expect of the three", () => {
  it.effect("no operating income is doubtful once other operating expenses are shown", () =>
    Effect.forEach(Object.keys(companies) as Array<Company>, (company) =>
      Effect.gen(function* () {
        const { table } = yield* fiscalYear(company, 2023);
        const doubtful = table.fiscalYears
          .filter((each) => each.terms.operatingIncome.doubtful !== null)
          .map((each) => each.fiscalYear);
        expect(doubtful, company).toEqual([]);
      }),
    ),
  );

  it.effect(
    "Microsoft's fiscal 2015 impairment and restructuring appear as other operating expenses",
    () =>
      Effect.gen(function* () {
        const { year } = yield* fiscalYear("microsoft", 2015);
        expect(year.otherOperatingExpenses).toMatchObject({
          kind: "calculated",
          value: 10_011_000_000,
        });
      }),
  );

  it.effect(
    "Costco's fiscal 2019 gross profit follows its definition and keeps the filed figure",
    () =>
      Effect.gen(function* () {
        const { year } = yield* fiscalYear("costco", 2019);
        expect(year.grossProfit).toMatchObject({
          kind: "calculated",
          value: 19_817_000_000,
          setAside: { value: 16_465_000_000 },
        });
      }),
  );
});
