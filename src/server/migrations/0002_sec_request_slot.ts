import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`
    CREATE TABLE sec_request_slot (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      next_start_at INTEGER NOT NULL
    ) STRICT
  `;
});
