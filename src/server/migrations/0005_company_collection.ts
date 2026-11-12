import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`ALTER TABLE company ADD COLUMN requested_at INTEGER`;
  yield* sql`ALTER TABLE company ADD COLUMN failure_reason TEXT`;
  yield* sql`ALTER TABLE company ADD COLUMN as_of TEXT`;
  yield* sql`ALTER TABLE company ADD COLUMN last_checked_on TEXT`;
  yield* sql`ALTER TABLE company ADD COLUMN not_covered_reason TEXT`;
});
