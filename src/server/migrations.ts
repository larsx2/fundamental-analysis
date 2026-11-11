import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

const settings = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`
    CREATE TABLE setting (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    ) STRICT
  `;
});

const secRequestSlot = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`
    CREATE TABLE sec_request_slot (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      next_start_at INTEGER NOT NULL
    ) STRICT
  `;
});

const companies = Effect.gen(function* () {
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

// A migration that has been committed is never edited, because databases
// that already ran it would not run it again. Add a new one instead.
export const migrations = {
  "0001_settings": settings,
  "0002_sec_request_slot": secRequestSlot,
  "0003_companies": companies,
};
