import { readFileSync, rmSync } from "node:fs";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import { Collect } from "../src/server/collect";
import { databaseLayer } from "../src/server/database";
import { ReportedNumbers } from "../src/server/reported-numbers";
import { Sec } from "../src/server/sec";

// Builds the database the screenshot tests run against, from the trimmed SEC
// extracts committed beside the tests. Nothing here reaches the SEC.
const file = "data/screens.db";

const companies = [
  {
    cik: 320193,
    name: "Apple Inc.",
    ticker: "AAPL",
    extract: "apple",
    asOf: "2026-11-03",
  },
  {
    cik: 909832,
    name: "COSTCO WHOLESALE CORP /NEW",
    ticker: "COST",
    extract: "costco",
    asOf: "2026-10-07",
  },
  {
    cik: 789019,
    name: "MICROSOFT CORP",
    ticker: "MSFT",
    extract: "microsoft",
    asOf: "2026-07-29",
  },
];

const extracts = new Map(
  companies.map((company) => [
    company.cik,
    JSON.parse(readFileSync(`src/server/testdata/${company.extract}.json`, "utf8")) as unknown,
  ]),
);

for (const suffix of ["", "-shm", "-wal"]) rmSync(`${file}${suffix}`, { force: true });

const program = Effect.gen(function* () {
  const sql = yield* SqlClient;
  const collect = yield* Collect;
  for (const [position, company] of companies.entries()) {
    yield* sql`
      INSERT INTO company (cik, name, list_position, state, as_of, last_checked_on, filings_from)
      VALUES (
        ${company.cik}, ${company.name}, ${position}, 'ready', ${company.asOf}, '2026-11-11',
        '1994-01-01'
      )
    `;
    yield* sql`
      INSERT INTO company_ticker (ticker, cik, list_position)
      VALUES (${company.ticker}, ${company.cik}, ${position})
    `;
    // No logo, so the pictures never depend on Wikidata.
    yield* sql`
      INSERT INTO company_logo (cik, fetched_on) VALUES (${company.cik}, '2026-11-11')
    `;
    yield* collect.reportedNumbers(company.cik);
  }
  // Made-up economy months, so the timeline's pictures never depend on FRED.
  // Marked as fetched today, so the tool does not ask FRED for newer ones.
  for (let index = 0; index < 21 * 12 + 10; index++) {
    const year = 2005 + Math.floor(index / 12);
    const month = `${year}-${String((index % 12) + 1).padStart(2, "0")}`;
    const interestRate = Math.round((2.5 + 2.5 * Math.sin(index / 20)) * 100) / 100;
    const inflation = Math.round((2.5 + 1.5 * Math.cos(index / 15)) * 10) / 10;
    const recession = (index >= 35 && index < 54) || (index >= 182 && index < 185) ? 1 : 0;
    yield* sql`
      INSERT INTO economy_month (month, interest_rate, inflation, recession)
      VALUES (${month}, ${interestRate}, ${inflation}, ${recession})
    `;
  }
  yield* sql`
    INSERT INTO setting (key, value)
    VALUES ('economy-fetched-on', ${new Date().toLocaleDateString("en-CA")})
  `;
});

const sec = Layer.succeed(
  Sec,
  Sec.of({
    getJson: (url) => Effect.succeed(extracts.get(Number(/CIK(\d+)/.exec(url)?.[1] ?? "0")) ?? {}),
    getText: () => Effect.die("The screenshot database reads no documents."),
  }),
);

await Effect.runPromise(
  program.pipe(
    Effect.provide(
      Collect.layer.pipe(
        Layer.provideMerge(ReportedNumbers.layer),
        Layer.provideMerge(databaseLayer(file)),
        Layer.provide(sec),
      ),
    ),
  ),
);
console.log(`${file}: ${companies.length} companies ready`);
