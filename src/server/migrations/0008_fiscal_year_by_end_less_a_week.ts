import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`
    UPDATE reported_number
    SET fiscal_year = CAST(strftime('%Y', end_on, '-7 days') AS INTEGER)
  `;
});
