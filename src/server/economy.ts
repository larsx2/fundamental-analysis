import { Clock, Context, Data, Effect, Layer, Option, Schema } from "effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";
import * as SqlSchema from "effect/sql/SqlSchema";
import { Settings } from "./settings";

// The US central bank's public data, through the St. Louis Fed's FRED
// service. All three series are in the public domain; FRED asks to be named
// as the source, which the timeline does.
export const fredSeries = {
  interestRate: "FEDFUNDS",
  prices: "CPIAUCSL",
  recession: "USREC",
} as const;

export const fredPage = (series: string) => `https://fred.stlouisfed.org/series/${series}`;
const fredCsv = (series: string) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`;

const fetchedOnKey = "economy-fetched-on";
const firstMonth = "2005-01";

export type EconomyMonth = {
  readonly month: string;
  readonly interestRate: number | null;
  readonly inflation: number | null;
  readonly recession: boolean;
};

export class EconomyUnavailable extends Data.TaggedError("EconomyUnavailable")<{
  readonly cause: unknown;
}> {
  override get message() {
    return "The US central bank's public data could not be fetched.";
  }
}

// FRED's files have a date and a value on each line. A month with no value
// is left empty or written as a dot: October 2025 has no prices, because none
// were published during that autumn's government shutdown.
export const parseFredCsv = (text: string) => {
  const values = new Map<string, number>();
  for (const line of text.trim().split("\n").slice(1)) {
    const [date, value] = line.split(",");
    if (date === undefined || value === undefined) continue;
    const number = Number(value);
    if (value.trim() === "" || value.trim() === "." || !Number.isFinite(number)) continue;
    values.set(date.slice(0, 7), number);
  }
  return values;
};

const monthBefore = (month: string, count: number) => {
  const year = Number(month.slice(0, 4));
  const index = year * 12 + Number(month.slice(5, 7)) - 1 - count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};

// Inflation is how much higher prices were than twelve months before.
export const economyMonths = (series: {
  readonly interestRate: ReadonlyMap<string, number>;
  readonly prices: ReadonlyMap<string, number>;
  readonly recession: ReadonlyMap<string, number>;
}): ReadonlyArray<EconomyMonth> => {
  const months = [...series.interestRate.keys()].filter((month) => month >= firstMonth).sort();
  return months.map((month) => {
    const now = series.prices.get(month);
    const before = series.prices.get(monthBefore(month, 12));
    return {
      month,
      interestRate: series.interestRate.get(month) ?? null,
      inflation:
        now === undefined || before === undefined || before <= 0
          ? null
          : Math.round((now / before - 1) * 1000) / 10,
      recession: series.recession.get(month) === 1,
    };
  });
};

const StoredMonth = Schema.Struct({
  month: Schema.String,
  interestRate: Schema.NullOr(Schema.Finite),
  inflation: Schema.NullOr(Schema.Finite),
  recession: Schema.Int,
});

export class Economy extends Context.Service<
  Economy,
  {
    // Fetches again at most once a day. When fetching fails, the months
    // already held are kept.
    readonly months: Effect.Effect<
      {
        readonly months: ReadonlyArray<EconomyMonth>;
        readonly fetchedOn: string | null;
      },
      SqlError | Schema.SchemaError
    >;
  }
>()("Economy") {
  static readonly layer = Layer.effect(
    Economy,
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const http = yield* HttpClient.HttpClient;
      const settings = yield* Settings;
      // No contact details go to FRED, which does not ask for them. It refuses
      // some program names, so the runtime's own is sent.
      const fetchSeries = (series: string) =>
        http.execute(HttpClientRequest.get(fredCsv(series))).pipe(
          Effect.flatMap((response): Effect.Effect<string, unknown> =>
            response.status === 200 ? response.text : Effect.fail(`status ${response.status}`),
          ),
          Effect.map(parseFredCsv),
          Effect.mapError((cause) => new EconomyUnavailable({ cause })),
          Effect.timeout("20 seconds"),
        );

      const refresh = Effect.gen(function* () {
        const [interestRate, prices, recession] = yield* Effect.all([
          fetchSeries(fredSeries.interestRate),
          fetchSeries(fredSeries.prices),
          fetchSeries(fredSeries.recession),
        ]);
        const months = economyMonths({ interestRate, prices, recession });
        yield* sql.withTransaction(
          Effect.gen(function* () {
            for (const month of months) {
              yield* sql`
                INSERT INTO economy_month (month, interest_rate, inflation, recession)
                VALUES (
                  ${month.month}, ${month.interestRate}, ${month.inflation},
                  ${month.recession ? 1 : 0}
                )
                ON CONFLICT (month) DO UPDATE SET
                  interest_rate = excluded.interest_rate,
                  inflation = excluded.inflation,
                  recession = excluded.recession
              `;
            }
          }),
        );
      });

      const stored = SqlSchema.findAll({
        Request: Schema.Void,
        Result: StoredMonth,
        execute: () => sql`
          SELECT
            month, interest_rate AS "interestRate", inflation, recession
          FROM economy_month ORDER BY month
        `,
      });

      const today = Clock.currentTimeMillis.pipe(
        Effect.map((now) => new Date(now).toLocaleDateString("en-CA")),
      );

      const months = Effect.gen(function* () {
        const day = yield* today;
        const fetchedOn = yield* settings.get(fetchedOnKey);
        if (Option.getOrNull(fetchedOn) !== day) {
          const done = yield* refresh.pipe(
            Effect.as(true),
            Effect.catchCause(() => Effect.succeed(false)),
          );
          if (done) yield* settings.set(fetchedOnKey, day);
        }
        const rows = yield* stored(undefined);
        return {
          months: rows.map((row) => ({
            ...row,
            recession: row.recession === 1,
          })),
          fetchedOn: Option.getOrNull(yield* settings.get(fetchedOnKey)),
        };
      });

      return Economy.of({ months });
    }),
  );
}
