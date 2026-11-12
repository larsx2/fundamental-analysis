import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;
  // Every filing in the SEC's recent list for a collected company, of any
  // form, so current reports (8-K) and the annual report documents are known.
  yield* sql`
    CREATE TABLE company_filing (
      accession TEXT PRIMARY KEY NOT NULL,
      cik INTEGER NOT NULL REFERENCES company (cik),
      form TEXT NOT NULL,
      filed_on TEXT NOT NULL,
      report_date TEXT,
      items TEXT NOT NULL,
      primary_document TEXT
    ) STRICT
  `;
  yield* sql`CREATE INDEX company_filing_by_company ON company_filing (cik, form, filed_on)`;
  yield* sql`ALTER TABLE company ADD COLUMN filings_from TEXT`;
  yield* sql`ALTER TABLE company ADD COLUMN collect_step INTEGER`;
  yield* sql`ALTER TABLE company ADD COLUMN description TEXT`;
  yield* sql`ALTER TABLE company ADD COLUMN description_accession TEXT`;
  yield* sql`
    CREATE TABLE economy_month (
      month TEXT PRIMARY KEY NOT NULL,
      interest_rate REAL,
      inflation REAL,
      recession INTEGER
    ) STRICT
  `;
});
