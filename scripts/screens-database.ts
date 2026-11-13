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
  // Made-up current reports, so the timeline shows single events, a fiscal
  // year with several, an amendment, and a gap before Apple's are held.
  yield* sql`UPDATE company SET filings_from = '2012-06-01' WHERE cik = 320193`;
  const reports = [
    {
      cik: 320193,
      form: "8-K",
      filedOn: "2013-03-01",
      reportDate: "2013-02-27",
      items: "5.02",
    },
    {
      cik: 320193,
      form: "8-K",
      filedOn: "2016-08-10",
      reportDate: "2016-08-08",
      items: "2.01",
    },
    {
      cik: 320193,
      form: "8-K",
      filedOn: "2019-02-05",
      reportDate: "2019-02-01",
      items: "5.02",
    },
    {
      cik: 320193,
      form: "8-K",
      filedOn: "2019-06-20",
      reportDate: "2019-06-18",
      items: "5.02,9.01",
    },
    {
      cik: 320193,
      form: "8-K",
      filedOn: "2019-09-03",
      reportDate: "2019-08-30",
      items: "2.01",
    },
    {
      cik: 320193,
      form: "8-K",
      filedOn: "2023-05-15",
      reportDate: "2023-05-12",
      items: "5.02",
    },
    {
      cik: 320193,
      form: "8-K/A",
      filedOn: "2023-06-01",
      reportDate: "2023-05-12",
      items: "5.02",
    },
    {
      cik: 909832,
      form: "8-K",
      filedOn: "2023-01-20",
      reportDate: "2023-01-18",
      items: "5.02",
    },
  ];
  for (const [index, report] of reports.entries()) {
    yield* sql`
      INSERT INTO company_filing
        (accession, cik, form, filed_on, report_date, items, primary_document)
      VALUES (
        ${`0000000000-00-${String(index).padStart(6, "0")}`}, ${report.cik}, ${report.form},
        ${report.filedOn}, ${report.reportDate}, ${report.items}, 'report.htm'
      )
    `;
  }
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
