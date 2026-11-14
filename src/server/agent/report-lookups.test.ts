import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import { Collect } from "../collect";
import { databaseLayer } from "../database";
import { reportLookup } from "./report-lookups";

const costco = { cik: 909832, name: "Costco" };

const paragraphs = [
  {
    line: 226,
    heading: 0,
    text: "Our industry is highly competitive. Walmart, Target, Kroger, and Amazon are among our significant general merchandise retail competitors in the U.S.",
  },
  {
    line: 345,
    heading: 1,
    text: "We face strong competition from other retailers and warehouse club operators.",
  },
  {
    line: 353,
    heading: 1,
    text: "Suppliers may be unable to timely provide us with quality merchandise at competitive prices.",
  },
];

const storeReport = Effect.gen(function* () {
  const sql = yield* SqlClient;
  for (const each of paragraphs) {
    yield* sql`INSERT INTO report_paragraph ${sql.insert({ cik: costco.cik, accession: "0000909832-26-000093", ...each })}`;
  }
});

// Collecting the report stores its paragraphs, as the real collect step does.
const layer = (collected: { count: number }) =>
  Layer.effect(
    Collect,
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      return Collect.of({
        filings: () => Effect.succeed(0),
        newFilings: () => Effect.succeed([]),
        addFilings: () => Effect.void,
        reportedNumbers: () => Effect.die(new Error("Not used here.")),
        annualReport: () =>
          Effect.sync(() => {
            collected.count += 1;
          }).pipe(Effect.andThen(storeReport), Effect.provideService(SqlClient, sql), Effect.orDie),
      });
    }),
  ).pipe(Layer.provideMerge(databaseLayer(":memory:")));

const withFiling = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`INSERT INTO company (cik, name, list_position, state, requested_at) VALUES (${costco.cik}, 'Costco', 1, 'ready', 0)`;
  yield* sql`
    INSERT INTO company_filing (accession, cik, form, filed_on, report_date, items, primary_document)
    VALUES ('0000909832-26-000093', ${costco.cik}, '10-K', '2026-10-07', '2026-08-30', '', 'cost-20260830.htm')
  `;
});

describe("the annual report lookups", () => {
  it.effect("read the report on first use, then search it by word stem", () => {
    const collected = { count: 0 };
    return Effect.gen(function* () {
      yield* withFiling;
      const first = yield* reportLookup(costco, "search_report", {
        query: "competitors",
      });
      const again = yield* reportLookup(costco, "search_report", {
        query: "compet*",
      });
      expect(collected.count).toBe(1);
      expect(Object.keys(first.figures)).toEqual(["line 226"]);
      expect(Object.keys(again.figures).sort()).toEqual(["line 226", "line 345", "line 353"]);
      expect(first.filings[0]?.url).toBe(
        "https://www.sec.gov/Archives/edgar/data/909832/000090983226000093/cost-20260830.htm",
      );
    }).pipe(Effect.provide(layer(collected)));
  });

  it.effect("list the risk headings in the order of the report", () =>
    Effect.gen(function* () {
      yield* withFiling;
      const headings = yield* reportLookup(costco, "risk_headings", {});
      expect(Object.keys(headings.figures)).toEqual(["line 345", "line 353"]);
    }).pipe(Effect.provide(layer({ count: 0 }))),
  );

  it.effect("say what to fix when the search words cannot be read", () =>
    Effect.gen(function* () {
      yield* withFiling;
      const problem = yield* reportLookup(costco, "search_report", {
        query: 'compet* AND ("',
      }).pipe(Effect.flip);
      expect(problem.message).toContain("could not be read");
    }).pipe(Effect.provide(layer({ count: 0 }))),
  );
});
