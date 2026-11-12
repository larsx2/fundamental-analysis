import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`
    CREATE TABLE company (
      cik INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      list_position INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'not_collected'
        CHECK (state IN ('not_collected', 'waiting', 'collecting', 'ready', 'failed'))
    ) STRICT
  `;
  yield* sql`
    CREATE TABLE company_ticker (
      ticker TEXT PRIMARY KEY NOT NULL,
      cik INTEGER NOT NULL REFERENCES company (cik),
      list_position INTEGER NOT NULL
    ) STRICT
  `;
  yield* sql`CREATE INDEX company_ticker_by_company ON company_ticker (cik)`;
});
