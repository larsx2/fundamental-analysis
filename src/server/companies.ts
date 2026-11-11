import { Context, Data, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";
import * as SqlSchema from "effect/sql/SqlSchema";
import { Sec, type SecError } from "./sec";

export const companyListUrl = "https://www.sec.gov/files/company_tickers.json";

const CompanyList = Schema.Record(
  Schema.String,
  Schema.Struct({
    cik_str: Schema.Int,
    ticker: Schema.String,
    title: Schema.String,
  }),
);

export const CompanyState = Schema.Literals([
  "not_collected",
  "waiting",
  "collecting",
  "ready",
  "failed",
]);
export type CompanyState = typeof CompanyState.Type;

const CompanyMatchRow = Schema.Struct({
  cik: Schema.Int,
  name: Schema.String,
  state: CompanyState,
  tickers: Schema.String,
});

export type CompanyMatch = {
  readonly cik: number;
  readonly name: string;
  readonly tickers: ReadonlyArray<string>;
  readonly state: CompanyState;
};

export class UnexpectedCompanyList extends Data.TaggedError("UnexpectedCompanyList")<{
  readonly cause: unknown;
}> {
  override get message() {
    return "The SEC's list of companies arrived in an unexpected shape, so it was not stored.";
  }
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (character) => `\\${character}`);

export class Companies extends Context.Service<
  Companies,
  {
    readonly refreshList: Effect.Effect<number, SecError | UnexpectedCompanyList | SqlError>;
    readonly search: (
      query: string,
      limit?: number,
    ) => Effect.Effect<ReadonlyArray<CompanyMatch>, SqlError | Schema.SchemaError>;
  }
>()("Companies") {
  static readonly layer = Layer.effect(
    Companies,
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const sec = yield* Sec;

      const refreshList = Effect.gen(function* () {
        const raw = yield* sec.getJson(companyListUrl);
        const list = yield* Schema.decodeUnknownEffect(CompanyList)(raw).pipe(
          Effect.mapError((cause) => new UnexpectedCompanyList({ cause })),
        );
        const entries = Object.entries(list).map(([position, entry]) => ({
          cik: entry.cik_str,
          ticker: entry.ticker.toUpperCase(),
          name: entry.title,
          position: Number(position),
        }));

        yield* sql.withTransaction(
          Effect.gen(function* () {
            for (const entry of entries) {
              yield* sql`
                INSERT INTO company (cik, name, list_position)
                VALUES (${entry.cik}, ${entry.name}, ${entry.position})
                ON CONFLICT (cik) DO UPDATE SET
                  name = excluded.name,
                  list_position = min(excluded.list_position, company.list_position)
              `;
            }
            // Tickers can move from one company to another between lists.
            yield* sql`DELETE FROM company_ticker`;
            for (const entry of entries) {
              yield* sql`
                INSERT INTO company_ticker (ticker, cik, list_position)
                VALUES (${entry.ticker}, ${entry.cik}, ${entry.position})
                ON CONFLICT (ticker) DO NOTHING
              `;
            }
          }),
        );
        return new Set(entries.map((entry) => entry.cik)).size;
      });

      // The SEC's list runs roughly from the largest company to the smallest,
      // so `list_position` breaks ties in favour of the larger one.
      const findMatches = SqlSchema.findAll({
        Request: Schema.Struct({ query: Schema.String, limit: Schema.Int }),
        Result: CompanyMatchRow,
        execute: ({ query, limit }) => {
          const exactTicker = query.toUpperCase();
          const startsWith = `${escapeLike(query)}%`;
          const wordStartsWith = `% ${escapeLike(query)}%`;
          const contains = `%${escapeLike(query)}%`;
          return sql`
            SELECT cik, name, state, tickers FROM (
              SELECT
                c.cik, c.name, c.state, c.list_position,
                (SELECT group_concat(ticker, ' ') FROM (
                  SELECT ticker FROM company_ticker WHERE cik = c.cik ORDER BY list_position
                )) AS tickers,
                CASE
                  WHEN EXISTS (
                    SELECT 1 FROM company_ticker WHERE cik = c.cik AND ticker = ${exactTicker}
                  ) THEN 0
                  WHEN c.name LIKE ${startsWith} ESCAPE '\\' THEN 1
                  WHEN EXISTS (
                    SELECT 1 FROM company_ticker
                    WHERE cik = c.cik AND ticker LIKE ${startsWith} ESCAPE '\\'
                  ) THEN 2
                  WHEN c.name LIKE ${wordStartsWith} ESCAPE '\\' THEN 3
                  WHEN c.name LIKE ${contains} ESCAPE '\\' THEN 4
                END AS rank
              FROM company c
            )
            WHERE rank IS NOT NULL AND tickers IS NOT NULL
            ORDER BY rank, list_position
            LIMIT ${limit}
          `;
        },
      });

      const search = (query: string, limit = 20) => {
        const trimmed = query.trim();
        if (trimmed === "") return Effect.succeed([]);
        return findMatches({ query: trimmed, limit }).pipe(
          Effect.map((rows) => rows.map((row) => ({ ...row, tickers: row.tickers.split(" ") }))),
        );
      };

      return Companies.of({ refreshList, search });
    }),
  );
}
