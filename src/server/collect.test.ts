import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import { Collect } from "./collect";
import { databaseLayer } from "./database";
import { ReportedNumbers } from "./reported-numbers";
import { Sec } from "./sec";

const fact = (overrides: Record<string, unknown>) => ({
  start: "2022-09-25",
  end: "2023-09-30",
  val: 383_285_000_000,
  accn: "0000320193-23-000106",
  fy: 2023,
  fp: "FY",
  form: "10-K",
  filed: "2023-11-03",
  ...overrides,
});

const companyFacts = (revenue: Array<unknown>, assets: Array<unknown> = []) => ({
  cik: 320193,
  entityName: "Apple Inc.",
  facts: {
    "us-gaap": {
      Revenues: { label: "Revenues", units: { USD: revenue } },
      Assets: { label: "Assets", units: { USD: assets } },
    },
  },
});

const collectWith = (answer: unknown) =>
  Collect.layer.pipe(
    Layer.provideMerge(ReportedNumbers.layer),
    Layer.provideMerge(databaseLayer(":memory:")),
    Layer.provide(
      Layer.succeed(
        Sec,
        Sec.of({ getJson: () => Effect.succeed(answer), getText: () => Effect.die("unused") }),
      ),
    ),
  );

describe("Collect", () => {
  it.effect("keeps full fiscal years and year-end balances from annual reports only", () =>
    Effect.gen(function* () {
      const collect = yield* Collect;
      const reported = yield* ReportedNumbers;
      yield* collect.reportedNumbers(320193);

      const revenue = yield* reported.forTag(320193, "Revenues");
      expect(revenue.map((number) => [number.fiscalYear, number.value])).toEqual([
        [2023, 383_285_000_000],
      ]);
      const assets = yield* reported.forTag(320193, "Assets");
      expect(assets.map((number) => [number.fiscalYear, number.startOn])).toEqual([[2023, null]]);
    }).pipe(
      Effect.provide(
        collectWith(
          companyFacts(
            [
              fact({}),
              fact({ start: "2023-07-02", val: 89_498_000_000 }),
              fact({
                start: "2022-07-03",
                end: "2023-07-01",
                val: 271_000_000_000,
                form: "10-Q",
                accn: "0000320193-23-000077",
              }),
            ],
            [fact({ start: undefined, val: 352_583_000_000 })],
          ),
        ),
      ),
    ),
  );

  it.effect("a number in an unexpected shape is reported and the rest are stored", () =>
    Effect.gen(function* () {
      const collect = yield* Collect;
      const reported = yield* ReportedNumbers;
      const report = yield* collect.reportedNumbers(320193);

      expect(report.unexpected.map((number) => [number.tag, number.unit])).toEqual([
        ["Revenues", "USD"],
      ]);
      expect(yield* reported.forTag(320193, "Revenues")).toHaveLength(1);
    }).pipe(
      Effect.provide(
        collectWith(companyFacts([fact({}), fact({ val: "lots", accn: "0000320193-24-000001" })])),
      ),
    ),
  );

  it.effect("keeps numbers from a corrected annual report, next to the original", () =>
    Effect.gen(function* () {
      const collect = yield* Collect;
      const reported = yield* ReportedNumbers;
      yield* collect.reportedNumbers(320193);

      const revenue = yield* reported.forTag(320193, "Revenues");
      expect(revenue.map((number) => [number.form, number.value])).toEqual([
        ["10-K", 383_285_000_000],
        ["10-K/A", 383_300_000_000],
      ]);
    }).pipe(
      Effect.provide(
        collectWith(
          companyFacts([
            fact({}),
            fact({
              val: 383_300_000_000,
              accn: "0000320193-24-000002",
              form: "10-K/A",
              filed: "2024-01-15",
            }),
          ]),
        ),
      ),
    ),
  );

  it.effect("finds the kept filings that are not stored yet, and stores only when asked", () =>
    Effect.gen(function* () {
      const collect = yield* Collect;
      const sql = yield* SqlClient;
      yield* collect.addFilings(320193, [
        {
          accession: "old",
          form: "10-K",
          filedOn: "2024-11-01",
          reportDate: "2024-09-28",
          items: "",
          primaryDocument: "aapl-2024.htm",
        },
      ]);

      const added = yield* collect.newFilings(320193);
      expect(added.map((filing) => [filing.accession, filing.form])).toEqual([
        ["new", "10-K"],
        ["fix", "8-K/A"],
      ]);
      const stored = yield* sql<{ n: number }>`SELECT count(*) AS n FROM company_filing`;
      expect(stored[0]?.n).toBe(1);

      yield* collect.addFilings(320193, added);
      expect(yield* collect.newFilings(320193)).toEqual([]);
    }).pipe(
      Effect.provide(
        collectWith({
          filings: {
            recent: {
              accessionNumber: ["new", "trade", "fix", "old"],
              filingDate: ["2025-10-31", "2025-10-15", "2025-08-01", "2024-11-01"],
              reportDate: ["2025-09-27", "", "2025-07-30", "2024-09-28"],
              form: ["10-K", "4", "8-K/A", "10-K"],
              items: ["", "", "5.02", ""],
              primaryDocument: ["aapl-2025.htm", "form4.xml", "fix.htm", "aapl-2024.htm"],
            },
            files: [],
          },
        }),
      ),
    ),
  );
});
