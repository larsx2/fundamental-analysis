import {
  Cause,
  Clock,
  Context,
  Data,
  Effect,
  Layer,
  Option,
  Queue,
  Schema,
  Semaphore,
} from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";
import * as SqlSchema from "effect/sql/SqlSchema";
import { isDueForCheck } from "./check-schedule";
import { Collect, type UnexpectedNumber } from "./collect";
import { CompanyState } from "./companies";
import { today } from "./days";
import { Logos } from "./logos";
import { CoverageCheck, type UnexpectedSubmissions } from "./coverage";
import { annualReportForms } from "./filings";
import { ReportedNumbers } from "./reported-numbers";
import type { SecError } from "./sec";
import { statementsFor } from "./terms/terms";
import { homeCompanies } from "../shared/home-companies";

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

export class NoRevenue extends Data.TaggedError("NoRevenue")<{
  readonly cik: number;
}> {
  override get message() {
    return "Its annual reports (10-K) give no revenue the tool can read, so it has no fiscal years to show.";
  }
}

const reasonOf = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);
  return error instanceof Error ? error.message : String(error);
};

const noteUnexpected = (cik: number, unexpected: ReadonlyArray<UnexpectedNumber>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    yield* sql`UPDATE company SET unexpected_numbers = ${unexpected.length} WHERE cik = ${cik}`;
    if (unexpected.length > 0) {
      yield* Effect.logWarning(
        `${unexpected.length} numbers from the SEC for company ${cik} came in a shape the tool cannot read and were left out`,
        unexpected.slice(0, 3),
      );
    }
  });

// Collects a company in full and marks it ready. The starter database is
// built with the same steps.
export const collectInFull = (cik: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    const collect = yield* Collect;
    const logos = yield* Logos;
    const step = (number: number) =>
      sql`UPDATE company SET collect_step = ${number} WHERE cik = ${cik}`;
    yield* sql`UPDATE company SET state = 'collecting', collect_step = 1 WHERE cik = ${cik}`;
    yield* collect.filings(cik);
    yield* step(2);
    yield* noteUnexpected(cik, (yield* collect.reportedNumbers(cik)).unexpected);
    const years = yield* statementsFor(cik);
    if (years.length === 0) return yield* new NoRevenue({ cik });
    yield* step(3);
    yield* collect.annualReport(cik);
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
  });

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
      const reported = yield* ReportedNumbers;
      // A company goes in line to be collected in full, or, when it was ready
      // before the tool kept filings, only for its filings and description.
      const line = yield* Queue.unbounded<{ readonly cik: number; readonly full: boolean }>();
      // Removing a company and checking it for new filings both change its
      // data, so one waits for the other.
      const writing = yield* Semaphore.make(1);
      const failedAt = new Map<number, number>();

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

      const collectOne = (cik: number) =>
        collectInFull(cik).pipe(
          Effect.provideService(SqlClient, sql),
          Effect.provideService(Collect, collect),
          Effect.provideService(Logos, logos),
          Effect.provideService(ReportedNumbers, reported),
          Effect.catchCause((cause) =>
            sql`
              UPDATE company SET
                state = 'failed', failure_reason = ${reasonOf(cause)}, collect_step = NULL
              WHERE cik = ${cik}
            `.pipe(
              Effect.ignore({ log: "Warn", message: `Could not mark company ${cik} as failed` }),
            ),
          ),
        );

      const addDetails = (cik: number) =>
        Effect.gen(function* () {
          yield* collect.filings(cik);
          yield* collect.annualReport(cik);
        }).pipe(
          Effect.ignoreCause({
            log: "Warn",
            message: `Could not add the filings of company ${cik}`,
          }),
        );

      // The ready company most overdue for a check, if any is due. One whose
      // last check failed waits behind the others, the longest ago first.
      const nextDueForCheck = Effect.gen(function* () {
        const checkedOn = yield* today;
        const companies = yield* sql<{
          cik: number;
          lastCheckedOn: string | null;
          yearEndOn: string | null;
        }>`
          SELECT
            c.cik, c.last_checked_on AS "lastCheckedOn",
            (SELECT max(f.report_date) FROM company_filing f
             WHERE f.cik = c.cik AND f.form IN ('10-K', '10-KT')) AS "yearEndOn"
          FROM company c WHERE c.state = 'ready'
          ORDER BY c.last_checked_on
        `;
        const due = companies.filter((company) => isDueForCheck({ ...company, today: checkedOn }));
        return due.toSorted((a, b) => (failedAt.get(a.cik) ?? 0) - (failedAt.get(b.cik) ?? 0))[0]
          ?.cik;
      });

      // Asks the SEC for filings newer than the ones held. A new annual report
      // brings its numbers, and a full one a fresh business description. The
      // filings are stored after the numbers, so a check that fails halfway
      // finds the same filings new next time. The company stays ready
      // throughout.
      const checkForNew = (cik: number) =>
        Effect.gen(function* () {
          const company = yield* status(cik);
          if (Option.isNone(company) || company.value.state !== "ready") return;
          const added = yield* collect.newFilings(cik);
          if (added.some((filing) => annualReportForms.has(filing.form))) {
            yield* noteUnexpected(cik, (yield* collect.reportedNumbers(cik)).unexpected).pipe(
              Effect.provideService(SqlClient, sql),
            );
          }
          yield* collect.addFilings(cik, added);
          if (added.some((filing) => filing.form === "10-K" || filing.form === "10-KT")) {
            yield* collect.annualReport(cik);
          }
          const checkedOn = yield* today;
          yield* sql`
            UPDATE company SET
              as_of = (SELECT max(filed_on) FROM filing WHERE cik = ${cik}),
              last_checked_on = ${checkedOn}
            WHERE cik = ${cik}
          `;
        }).pipe(Semaphore.withPermits(writing, 1));

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
          Effect.ignoreCause({ log: "Warn", message: "Could not fetch the missing logos" }),
        ),
      );

      const work = (next: { readonly cik: number; readonly full: boolean }) =>
        next.full ? collectOne(next.cik) : addDetails(next.cik);

      // What the person asked for always goes first. With nothing in line, one
      // ready company that is due gets checked. With none due, or after a
      // check that failed, the tool waits for the line and looks again within
      // the hour.
      const nextStep = Effect.gen(function* () {
        const asked = yield* Queue.poll(line);
        if (Option.isSome(asked)) return yield* work(asked.value);
        const checked = yield* nextDueForCheck.pipe(
          Effect.flatMap((cik) =>
            cik === undefined
              ? Effect.succeed(false)
              : checkForNew(cik).pipe(
                  Effect.tap(() => Effect.sync(() => failedAt.delete(cik))),
                  Effect.as(true),
                  Effect.catchCause((cause) =>
                    Clock.currentTimeMillis.pipe(
                      Effect.tap((now) => Effect.sync(() => failedAt.set(cik, now))),
                      Effect.andThen(
                        Effect.logWarning(`Could not check company ${cik} for new filings`, cause),
                      ),
                      Effect.as(false),
                    ),
                  ),
                ),
          ),
          Effect.catchCause((cause) =>
            Effect.logWarning("Could not find a company due for a check", cause).pipe(
              Effect.as(false),
            ),
          ),
        );
        if (checked) return;
        const waited = yield* Queue.take(line).pipe(Effect.timeoutOption("1 hour"));
        if (Option.isSome(waited)) yield* work(waited.value);
      });

      yield* Effect.forkScoped(Effect.forever(nextStep));

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
                  description = NULL, description_accession = NULL, collect_step = NULL,
                  unexpected_numbers = NULL
                WHERE cik = ${cik}
              `;
            }),
          );
        }).pipe(Semaphore.withPermits(writing, 1));

      return Collector.of({ request, remove, status });
    }),
  );
}

export const collectHomeCompanies = Effect.gen(function* () {
  const collector = yield* Collector;
  yield* Effect.forEach(
    homeCompanies,
    (cik) =>
      collector.status(cik).pipe(
        Effect.flatMap((company) =>
          Option.isSome(company) && company.value.state === "not_collected"
            ? collector.request(cik)
            : Effect.void,
        ),
        Effect.ignore({ log: "Warn", message: `Could not ask for company ${cik}` }),
      ),
    { discard: true },
  );
});
