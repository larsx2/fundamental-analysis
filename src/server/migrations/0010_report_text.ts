import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`
    CREATE VIRTUAL TABLE report_paragraph USING fts5(
      cik UNINDEXED,
      accession UNINDEXED,
      line UNINDEXED,
      heading UNINDEXED,
      text,
      tokenize = 'porter unicode61'
    )
  `;
});
