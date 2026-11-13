import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import { Companies } from "./companies";
import { databaseLayer } from "./database";
import { companyNamedIn } from "./named-company";
import { Sec } from "./sec";

const madeUpList = {
  "0": { cik_str: 1, ticker: "AAPL", title: "Apple Inc." },
  "1": { cik_str: 2, ticker: "COST", title: "COSTCO WHOLESALE CORP /NEW" },
  "2": { cik_str: 3, ticker: "HAS", title: "HASBRO, INC." },
  "3": { cik_str: 4, ticker: "WMB", title: "WILLIAMS COMPANIES, INC." },
  "4": { cik_str: 5, ticker: "AI", title: "C3.ai, Inc." },
  "5": { cik_str: 6, ticker: "A", title: "AGILENT TECHNOLOGIES, INC." },
  "6": { cik_str: 7, ticker: "F", title: "FORD MOTOR CO" },
  "7": { cik_str: 8, ticker: "GRSS", title: "Gross Holdings" },
  "8": { cik_str: 9, ticker: "HELO", title: "Hello Group Inc." },
};

const secAnswering = (list: unknown) =>
  Layer.succeed(
    Sec,
    Sec.of({
      getJson: () => Effect.succeed(list),
      getText: () => Effect.die("unused"),
    }),
  );

const companiesWith = (list: unknown) =>
  Companies.layer.pipe(
    Layer.provideMerge(databaseLayer(":memory:")),
    Layer.provide(secAnswering(list)),
  );

const withAppleAndCostcoCollected = Effect.gen(function* () {
  const companies = yield* Companies;
  const sql = yield* SqlClient;
  yield* companies.refreshList;
  yield* sql`UPDATE company SET state = 'ready' WHERE cik IN (1, 2)`;
});

const nameIn = (text: string, skip: ReadonlyArray<string> = []) =>
  companyNamedIn(text, skip).pipe(Effect.map((company) => company?.name ?? null));

describe("companyNamedIn", () => {
  it.effect("a question word at the start is not taken for a company", () =>
    Effect.gen(function* () {
      yield* withAppleAndCostcoCollected;
      expect(yield* nameIn("Has Apple grown?")).toBe("Apple Inc.");
      expect(yield* nameIn("Will Costco keep growing?")).toBe("COSTCO WHOLESALE CORP /NEW");
    }).pipe(Effect.provide(companiesWith(madeUpList))),
  );

  it.effect("a capitalised everyday word is not a ticker when a collected company is named", () =>
    Effect.gen(function* () {
      yield* withAppleAndCostcoCollected;
      expect(yield* nameIn("How does Apple use AI?")).toBe("Apple Inc.");
      expect(yield* nameIn("A look at Costco")).toBe("COSTCO WHOLESALE CORP /NEW");
    }).pipe(Effect.provide(companiesWith(madeUpList))),
  );

  it.effect("the word A alone is not the ticker of Agilent", () =>
    Effect.gen(function* () {
      yield* withAppleAndCostcoCollected;
      expect(yield* nameIn("A look at Ford")).toBe("FORD MOTOR CO");
    }).pipe(Effect.provide(companiesWith(madeUpList))),
  );

  it.effect("a ticker still names its company", () =>
    Effect.gen(function* () {
      yield* withAppleAndCostcoCollected;
      expect(yield* nameIn("Is HAS growing?")).toBe("HASBRO, INC.");
      expect(yield* nameIn("Is F growing?")).toBe("FORD MOTOR CO");
    }).pipe(Effect.provide(companiesWith(madeUpList))),
  );

  it.effect("a lower-case everyday word names only a company already collected", () =>
    Effect.gen(function* () {
      yield* withAppleAndCostcoCollected;
      expect(yield* nameIn("hello")).toBeNull();
      expect(yield* nameIn("Hello")).toBe("Hello Group Inc.");
      expect(yield* nameIn("how is costco doing")).toBe("COSTCO WHOLESALE CORP /NEW");
    }).pipe(Effect.provide(companiesWith(madeUpList))),
  );

  it.effect("a glossary word passed in skip is never a company", () =>
    Effect.gen(function* () {
      yield* withAppleAndCostcoCollected;
      expect(yield* nameIn("Gross margin")).toBe("Gross Holdings");
      expect(yield* nameIn("Gross margin", ["gross"])).toBeNull();
      expect(yield* nameIn("Gross margin at Costco", ["gross"])).toBe("COSTCO WHOLESALE CORP /NEW");
    }).pipe(Effect.provide(companiesWith(madeUpList))),
  );
});
