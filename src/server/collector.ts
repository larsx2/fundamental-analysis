import { Cause, Clock, Context, Data, Effect, Layer, Option, Queue, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";
import * as SqlSchema from "effect/sql/SqlSchema";
import { Collect } from "./collect";
import { CompanyState } from "./companies";
import { Logos } from "./logos";
import { CoverageCheck, type UnexpectedSubmissions } from "./coverage";
import type { SecError } from "./sec";

const CompanyStatus = Schema.Struct({
  cik: Schema.Int,
  name: Schema.String,
  state: CompanyState,
  failureReason: Schema.NullOr(Schema.String),
  asOf: Schema.NullOr(Schema.String),
  lastCheckedOn: Schema.NullOr(Schema.String),
  notCoveredReason: Schema.NullOr(Schema.String),
  collectStep: Schema.NullOr(Schema.Int),
});
export type CompanyStatus = typeof CompanyStatus.Type;

export type RequestAnswer =
  | { readonly answer: "waiting" }
  | { readonly answer: "already ready" }
  | { readonly answer: "not covered"; readonly reason: string };

export class UnknownCompany extends Data.TaggedError("UnknownCompany")<{
  readonly cik: number;
}> {
  override get message() {
    return `The SEC lists no public company with the number ${this.cik}.`;
  }
}

export class StillCollecting extends Data.TaggedError("StillCollecting")<{
  readonly cik: number;
}> {
  override get message() {
    return "This company is waiting or being collected. It can be removed once it is ready or has failed.";
  }
}

const reasonOf = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);
  return error instanceof Error ? error.message : String(error);
};

export class Collector extends Context.Service<
  Collector,
  {
    readonly request: (
      cik: number,
    ) => Effect.Effect<
      RequestAnswer,
      UnknownCompany | SecError | UnexpectedSubmissions | SqlError | Schema.SchemaError
    >;
    readonly remove: (
      cik: number,
    ) => Effect.Effect<void, UnknownCompany | StillCollecting | SqlError | Schema.SchemaError>;
    readonly status: (
      cik: number,
    ) => Effect.Effect<Option.Option<CompanyStatus>, SqlError | Schema.SchemaError>;
  }
>()("Collector") {
  static readonly layer = Layer.effect(
    Collector,
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const collect = yield* Collect;
      const coverage = yield* CoverageCheck;
      const logos = yield* Logos;
      // A company goes in line to be collected in full, or, when it was ready
      // before the tool kept filings, only for its filings and description.
      const line = yield* Queue.unbounded<{ readonly cik: number; readonly full: boolean }>();

      const status = SqlSchema.findOneOption({
        Request: Schema.Int,
        Result: CompanyStatus,
        execute: (cik) => sql`
          SELECT
            cik, name, state, failure_reason AS "failureReason", as_of AS "asOf",
            last_checked_on AS "lastCheckedOn", not_covered_reason AS "notCoveredReason",
            collect_step AS "collectStep"
          FROM company WHERE cik = ${cik}
        `,
      });

      const today = Clock.currentTimeMillis.pipe(
        Effect.map((now) => new Date(now).toLocaleDateString("en-CA")),
      );

      const step = (cik: number, number: number) =>
        sql`UPDATE company SET collect_step = ${number} WHERE cik = ${cik}`;

      const collectOne = (cik: number) =>
        Effect.gen(function* () {
          yield* sql`UPDATE company SET state = 'collecting', collect_step = 1 WHERE cik = ${cik}`;
          yield* collect.filings(cik);
          yield* step(cik, 2);
          yield* collect.reportedNumbers(cik);
          yield* step(cik, 3);
          yield* collect.businessDescription(cik);
          yield* logos.fetch(cik);
          const checkedOn = yield* today;
          yield* sql`
            UPDATE company SET
              state = 'ready',
              failure_reason = NULL,
              collect_step = NULL,
              as_of = (SELECT max(filed_on) FROM filing WHERE cik = ${cik}),
              last_checked_on = ${checkedOn}
            WHERE cik = ${cik}
          `;
        }).pipe(
          Effect.catchCause((cause) =>
            sql`
              UPDATE company SET
                state = 'failed', failure_reason = ${reasonOf(cause)}, collect_step = NULL
              WHERE cik = ${cik}
            `.pipe(Effect.ignore),
          ),
        );

      const addDetails = (cik: number) =>
        Effect.gen(function* () {
          yield* collect.filings(cik);
          yield* collect.businessDescription(cik);
        }).pipe(Effect.ignoreCause);

      // A company left waiting or collecting when the tool stopped goes back
      // in line, in the order it was asked for.
      const leftOver = yield* sql<{ cik: number }>`
        SELECT cik FROM company WHERE state IN ('waiting', 'collecting') ORDER BY requested_at
      `;
      yield* sql`UPDATE company SET state = 'waiting' WHERE state = 'collecting'`;
      for (const { cik } of leftOver) yield* Queue.offer(line, { cik, full: true });
      const withoutFilings = yield* sql<{ cik: number }>`
        SELECT cik FROM company WHERE state = 'ready' AND filings_from IS NULL ORDER BY cik
      `;
      for (const { cik } of withoutFilings) yield* Queue.offer(line, { cik, full: false });

      // Companies collected before the tool fetched logos get theirs in the
      // background, apart from the line, since Wikidata is not the SEC.
      yield* Effect.forkScoped(
        logos.missing.pipe(
          Effect.flatMap((ciks) => Effect.forEach(ciks, logos.fetch, { discard: true })),
          Effect.ignoreCause,
        ),
      );

      yield* Effect.forkScoped(
        Effect.forever(
          Queue.take(line).pipe(
            Effect.flatMap((next) => (next.full ? collectOne(next.cik) : addDetails(next.cik))),
          ),
        ),
      );

      const request = (cik: number) =>
        Effect.gen(function* () {
          const company = yield* status(cik);
          if (Option.isNone(company)) return yield* new UnknownCompany({ cik });
          const { state, notCoveredReason } = company.value;
          if (state === "waiting" || state === "collecting") return { answer: "waiting" } as const;
          if (state === "ready") return { answer: "already ready" } as const;
          if (notCoveredReason !== null) {
            return { answer: "not covered", reason: notCoveredReason } as const;
          }

          const covered = yield* coverage.check(cik);
          if (!covered.covered) {
            yield* sql`UPDATE company SET not_covered_reason = ${covered.reason} WHERE cik = ${cik}`;
            return { answer: "not covered", reason: covered.reason } as const;
          }

          const now = yield* Clock.currentTimeMillis;
          yield* sql`
            UPDATE company SET state = 'waiting', failure_reason = NULL, requested_at = ${now}
            WHERE cik = ${cik}
          `;
          yield* Queue.offer(line, { cik, full: true });
          return { answer: "waiting" } as const;
        });

      const remove = (cik: number) =>
        Effect.gen(function* () {
          const company = yield* status(cik);
          if (Option.isNone(company)) return yield* new UnknownCompany({ cik });
          const { state } = company.value;
          if (state === "waiting" || state === "collecting") {
            return yield* new StillCollecting({ cik });
          }
          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`DELETE FROM reported_number WHERE cik = ${cik}`;
              yield* sql`DELETE FROM filing WHERE cik = ${cik}`;
              yield* sql`DELETE FROM company_filing WHERE cik = ${cik}`;
              yield* sql`DELETE FROM company_logo WHERE cik = ${cik}`;
              yield* sql`
                UPDATE company SET
                  state = 'not_collected', failure_reason = NULL, as_of = NULL,
                  last_checked_on = NULL, requested_at = NULL, filings_from = NULL,
                  description = NULL, description_accession = NULL, collect_step = NULL
                WHERE cik = ${cik}
              `;
            }),
          );
        });

      return Collector.of({ request, remove, status });
    }),
  );
}
