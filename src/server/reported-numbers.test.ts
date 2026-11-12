import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { databaseLayer } from "./database";
import { ReportedNumbers } from "./reported-numbers";

const revenue = {
  taxonomy: "us-gaap",
  tag: "Revenues",
  unit: "USD",
  startOn: "2022-07-01",
  endOn: "2023-06-30",
  fiscalYear: 2023,
};

describe("ReportedNumbers", () => {
  it.effect("an original and a restated number for one fiscal year are both kept", () =>
    Effect.gen(function* () {
      const reported = yield* ReportedNumbers;
      yield* reported.save(
        1,
        [
          {
            accession: "0000000001-23-000001",
            form: "10-K",
            filedOn: "2023-07-27",
          },
        ],
        [
          {
            ...revenue,
            accession: "0000000001-23-000001",
            value: 211_915_000_000,
          },
        ],
      );
      yield* reported.save(
        1,
        [
          {
            accession: "0000000001-24-000001",
            form: "10-K",
            filedOn: "2024-07-30",
          },
        ],
        [
          {
            ...revenue,
            accession: "0000000001-24-000001",
            value: 211_900_000_000,
          },
        ],
      );

      const stored = yield* reported.forTag(1, "Revenues");
      expect(stored.map((number) => [number.filedOn, number.value])).toEqual([
        ["2023-07-27", 211_915_000_000],
        ["2024-07-30", 211_900_000_000],
      ]);
    }).pipe(
      Effect.provide(ReportedNumbers.layer.pipe(Layer.provideMerge(databaseLayer(":memory:")))),
    ),
  );
});
