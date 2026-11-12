import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`
    CREATE TABLE filing (
      accession TEXT PRIMARY KEY NOT NULL,
      cik INTEGER NOT NULL REFERENCES company (cik),
      form TEXT NOT NULL,
      filed_on TEXT NOT NULL
    ) STRICT
  `;
  yield* sql`
    CREATE TABLE reported_number (
      accession TEXT NOT NULL REFERENCES filing (accession),
      cik INTEGER NOT NULL REFERENCES company (cik),
      taxonomy TEXT NOT NULL,
      tag TEXT NOT NULL,
      unit TEXT NOT NULL,
      start_on TEXT,
      end_on TEXT NOT NULL,
      fiscal_year INTEGER NOT NULL,
      value REAL NOT NULL
    ) STRICT
  `;
  yield* sql`
    CREATE UNIQUE INDEX reported_number_once_per_filing
    ON reported_number (accession, taxonomy, tag, unit, coalesce(start_on, ''), end_on)
  `;
  yield* sql`CREATE INDEX reported_number_by_term ON reported_number (cik, tag, fiscal_year)`;
});
