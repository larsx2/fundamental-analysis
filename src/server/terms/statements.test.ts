import { readFileSync } from "node:fs";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Collect } from "../collect";
import { databaseLayer } from "../database";
import { ReportedNumbers } from "../reported-numbers";
import { Sec } from "../sec";
import type { NumberRow } from "./choose-terms";
import { balanceCheck, findSplits } from "./statements";
import { statementsFor } from "./terms";

const companies = { apple: 320193, microsoft: 789019 } as const;
type Company = keyof typeof companies;

const extract = (company: Company): unknown =>
  JSON.parse(readFileSync(new URL(`../testdata/${company}.json`, import.meta.url), "utf8"));

const statementsOf = (company: Company, fiscalYear: number) =>
  Effect.gen(function* () {
    yield* (yield* Collect).reportedNumbers(companies[company]);
    const years = yield* statementsFor(companies[company]);
    return years.find((year) => year.fiscalYear === fiscalYear)!.terms;
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

const millions = (figure: { kind: string; value?: number }) =>
  figure.value === undefined ? figure.kind : Math.round(figure.value / 1_000_000);

describe("the balance sheet and cash flow statement, from trimmed SEC data", () => {
  // Apple's fiscal 2013 earnings per share were filed as $39.75, before its
  // 7-for-1 split in 2014 and its 4-for-1 split in 2020: $1.42 in today's shares.
  it.effect("adjusts old earnings per share for every later share split", () =>
    Effect.gen(function* () {
      const terms = yield* statementsOf("apple", 2013);
      expect(terms.earningsPerShare.kind).toBe("calculated");
      expect(
        Number(terms.earningsPerShare.kind === "gap" ? 0 : terms.earningsPerShare.value.toFixed(2)),
      ).toBe(1.42);
    }),
  );

  it("does not take a restatement that is not a whole multiple for a share split", () => {
    const filed = (value: number, filedOn: string): NumberRow => ({
      tag: "EarningsPerShareDiluted",
      fiscalYear: 2013,
      value,
      accession: filedOn,
      filedOn,
    });
    expect(findSplits([filed(39.75, "2013-10-30"), filed(5.68, "2014-10-27")])).toEqual([
      { ratio: 7, seenOn: "2014-10-27" },
    ]);
    expect(findSplits([filed(39.75, "2013-10-30"), filed(19.3, "2014-10-27")])).toEqual([]);
  });

  // Microsoft restated its fiscal 2016 equity in a later report than its
  // assets and liabilities. Mixing the two filings breaks the sheet's rule.
  it.effect("takes a balance sheet whole from one filing, so it still adds up", () =>
    Effect.gen(function* () {
      const terms = yield* statementsOf("microsoft", 2016);
      expect([millions(terms.assets), millions(terms.liabilities), millions(terms.equity)]).toEqual(
        [193_468, 121_471, 71_997],
      );
      expect(terms.assets.doubtful).not.toBe(balanceCheck);
    }),
  );

  // Apple's annual report for fiscal 2023: commercial paper 5,985, term debt
  // due within a year 9,822 and after it 95,281; operating cash flow 110,543
  // and capital expenditure 10,959, in millions of dollars.
  it.effect("adds debt up from its parts and works out free cash flow", () =>
    Effect.gen(function* () {
      const terms = yield* statementsOf("apple", 2023);
      expect([millions(terms.debt), terms.debt.kind]).toEqual([111_088, "calculated"]);
      expect([millions(terms.freeCashFlow), terms.freeCashFlow.kind]).toEqual([
        99_584,
        "calculated",
      ]);
    }),
  );
});
