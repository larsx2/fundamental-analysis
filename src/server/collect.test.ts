import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
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
    Layer.provide(Layer.succeed(Sec, Sec.of({ getJson: () => Effect.succeed(answer) }))),
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
});
