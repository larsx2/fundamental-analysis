import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import { Companies } from "./companies";
import { databaseLayer } from "./database";
import { Sec } from "./sec";

const madeUpList = {
  "0": { cik_str: 1, ticker: "AAPL", title: "Apple Inc." },
  "1": { cik_str: 2, ticker: "MSFT", title: "MICROSOFT CORP" },
  "2": { cik_str: 3, ticker: "GOOGL", title: "Alphabet Inc." },
  "3": { cik_str: 4, ticker: "COST", title: "COSTCO WHOLESALE CORP /NEW" },
  "4": { cik_str: 5, ticker: "LOWC", title: "Lowcost Holdings" },
  "5": { cik_str: 6, ticker: "CSGP", title: "COSTAR GROUP, INC." },
  "6": { cik_str: 7, ticker: "CSTA", title: "COSTA COFFEE GROUP" },
  "7": { cik_str: 8, ticker: "BCST", title: "Big Cost Savers Inc." },
  "8": { cik_str: 3, ticker: "GOOG", title: "Alphabet Inc." },
  "9": { cik_str: 9, ticker: "MSFTX", title: "Microsoftware Partners" },
};

const secAnswering = (list: unknown) =>
  Layer.succeed(Sec, Sec.of({ getJson: () => Effect.succeed(list) }));

const companiesWith = (list: unknown) =>
  Companies.layer.pipe(
    Layer.provideMerge(databaseLayer(":memory:")),
    Layer.provide(secAnswering(list)),
  );

const searchNames = (query: string) =>
  Effect.gen(function* () {
    const companies = yield* Companies;
    return (yield* companies.search(query)).map((company) => company.name);
  });

describe("Companies", () => {
  it.effect("search puts an exact ticker first, then names, then the larger company", () =>
    Effect.gen(function* () {
      const companies = yield* Companies;
      yield* companies.refreshList;
      expect(yield* searchNames("cost")).toEqual([
        "COSTCO WHOLESALE CORP /NEW",
        "COSTAR GROUP, INC.",
        "COSTA COFFEE GROUP",
        "Big Cost Savers Inc.",
        "Lowcost Holdings",
      ]);
      expect((yield* searchNames("msft"))[0]).toBe("MICROSOFT CORP");
    }).pipe(Effect.provide(companiesWith(madeUpList))),
  );

  it.effect("a company with two tickers is one result listing both", () =>
    Effect.gen(function* () {
      const companies = yield* Companies;
      yield* companies.refreshList;
      const matches = yield* companies.search("alphabet");
      expect(matches.map((company) => company.tickers)).toEqual([["GOOGL", "GOOG"]]);
    }).pipe(Effect.provide(companiesWith(madeUpList))),
  );

  it.effect("fetching the list again keeps each company's state", () =>
    Effect.gen(function* () {
      const companies = yield* Companies;
      const sql = yield* SqlClient;
      yield* companies.refreshList;
      yield* sql`UPDATE company SET state = 'ready' WHERE cik = 4`;
      yield* companies.refreshList;
      const states = (yield* companies.search("co")).map((company) => [
        company.name,
        company.state,
      ]);
      expect(states).toContainEqual(["COSTCO WHOLESALE CORP /NEW", "ready"]);
      expect(states).toContainEqual(["COSTAR GROUP, INC.", "not_collected"]);
    }).pipe(Effect.provide(companiesWith(madeUpList))),
  );

  it.effect("a list in an unexpected shape is refused and nothing is stored", () =>
    Effect.gen(function* () {
      const companies = yield* Companies;
      const exit = yield* Effect.exit(companies.refreshList);
      expect(exit).toStrictEqual(
        Exit.fail(expect.objectContaining({ _tag: "UnexpectedCompanyList" })),
      );
      expect(yield* companies.search("apple")).toEqual([]);
    }).pipe(
      Effect.provide(
        companiesWith({
          "0": { cik_str: 1, ticker: "AAPL", title: "Apple Inc." },
          "1": { cik_str: "two", ticker: "MSFT", title: "MICROSOFT CORP" },
        }),
      ),
    ),
  );
});
