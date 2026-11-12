import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;
  // A company's official logo, as a small picture. A row without an image
  // records that none was found, so the tool does not ask again each start.
  yield* sql`
    CREATE TABLE company_logo (
      cik INTEGER PRIMARY KEY NOT NULL REFERENCES company (cik),
      image BLOB,
      type TEXT,
      source TEXT,
      fetched_on TEXT NOT NULL
    ) STRICT
  `;
});
