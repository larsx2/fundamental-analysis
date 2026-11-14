import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";

// A full-text table cannot gain a column, so it is made again. Each report's
// text is read again from the SEC the first time the agent searches it.
export default Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`DROP TABLE report_paragraph`;
  yield* sql`
    CREATE VIRTUAL TABLE report_paragraph USING fts5(
      cik UNINDEXED,
      accession UNINDEXED,
      line UNINDEXED,
      heading UNINDEXED,
      section,
      text,
      tokenize = 'porter unicode61'
    )
  `;
});
