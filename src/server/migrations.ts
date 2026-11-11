import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

// An Effect is a description of work, not the work itself. Writing
// `Effect.gen(function* () { ... })` runs nothing. It describes steps, and
// `yield*` inside it means "do this step and give me its result". Nothing
// happens until the description is handed to a runtime, which is done by
// the migrator here.
//
// `yield* SqlClient` asks for the database client service. The function
// does not know or care which file it is; the layer decides that.

const settings = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`
    CREATE TABLE setting (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    ) STRICT
  `;
});

// One row holding the moment the next request to the SEC may start.
// Every request takes its slot from here, so all copies of the tool that
// share this database also share the SEC's limit.
const secRequestSlot = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`
    CREATE TABLE sec_request_slot (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      next_start_at INTEGER NOT NULL
    ) STRICT
  `;
});

/**
 * Every change to the database's structure, named `<number>_<what it does>`.
 * They run in number order, and a change that has run is never run again,
 * so a change is never edited once it has been committed. Add a new one.
 */
export const migrations = {
  "0001_settings": settings,
  "0002_sec_request_slot": secRequestSlot,
};
