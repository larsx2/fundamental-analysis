import { Context, Data, Effect, Layer, Option, Result, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";
import { openingOfBusiness } from "./business-description";
import { collectFilings } from "./filings";
import { fiscalYearOf } from "./fiscal-year";
import { type Filing, type ReportedNumber, ReportedNumbers } from "./reported-numbers";
import { Sec, type SecError } from "./sec";

export const companyFactsUrl = (cik: number) =>
  `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, "0")}.json`;

const annualReport = "10-K";

const DateText = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/));

const Fact = Schema.Struct({
  start: Schema.optional(DateText),
  end: DateText,
  val: Schema.Finite,
  accn: Schema.String,
  form: Schema.String,
  filed: DateText,
});

const CompanyFacts = Schema.Struct({
  facts: Schema.Record(
    Schema.String,
    Schema.Record(
      Schema.String,
      Schema.Struct({
        units: Schema.Record(Schema.String, Schema.Array(Schema.Unknown)),
      }),
    ),
  ),
});

export type UnexpectedNumber = {
  readonly taxonomy: string;
  readonly tag: string;
  readonly unit: string;
  readonly entry: unknown;
  readonly reason: string;
};

export type CollectReport = {
  readonly filings: number;
  readonly numbers: number;
  readonly unexpected: ReadonlyArray<UnexpectedNumber>;
};

export class UnexpectedCompanyFacts extends Data.TaggedError("UnexpectedCompanyFacts")<{
  readonly cik: number;
  readonly cause: unknown;
}> {
  override get message() {
    return `The SEC's reported numbers for company ${this.cik} arrived in an unexpected shape, so none were stored.`;
  }
}

export class Collect extends Context.Service<
  Collect,
  {
    readonly reportedNumbers: (
      cik: number,
    ) => Effect.Effect<CollectReport, SecError | UnexpectedCompanyFacts | SqlError>;
    readonly filings: (
      cik: number,
    ) => Effect.Effect<number, SecError | Schema.SchemaError | SqlError>;
    // A description that cannot be read leaves a gap; it never fails a company.
    readonly businessDescription: (cik: number) => Effect.Effect<void>;
  }
>()("Collect") {
  static readonly layer = Layer.effect(
    Collect,
    Effect.gen(function* () {
      const sec = yield* Sec;
      const store = yield* ReportedNumbers;
      const sql = yield* SqlClient;
      const decodeFact = Schema.decodeUnknownResult(Fact);

      const reportedNumbers = (cik: number) =>
        Effect.gen(function* () {
          const raw = yield* sec.getJson(companyFactsUrl(cik));
          const companyFacts = yield* Schema.decodeUnknownEffect(CompanyFacts)(raw).pipe(
            Effect.mapError((cause) => new UnexpectedCompanyFacts({ cik, cause })),
          );

          const filings = new Map<string, Filing>();
          const numbers: Array<ReportedNumber> = [];
          const unexpected: Array<UnexpectedNumber> = [];

          for (const [taxonomy, tags] of Object.entries(companyFacts.facts)) {
            for (const [tag, { units }] of Object.entries(tags)) {
              for (const [unit, entries] of Object.entries(units)) {
                for (const entry of entries) {
                  const decoded = decodeFact(entry);
                  if (Result.isFailure(decoded)) {
                    unexpected.push({
                      taxonomy,
                      tag,
                      unit,
                      entry,
                      reason: decoded.failure.message,
                    });
                    continue;
                  }
                  const fact = decoded.success;
                  if (fact.form !== annualReport) continue;
                  const fiscalYear = fiscalYearOf(fact);
                  if (Option.isNone(fiscalYear)) continue;

                  filings.set(fact.accn, {
                    accession: fact.accn,
                    form: fact.form,
                    filedOn: fact.filed,
                  });
                  numbers.push({
                    accession: fact.accn,
                    taxonomy,
                    tag,
                    unit,
                    startOn: fact.start ?? null,
                    endOn: fact.end,
                    fiscalYear: fiscalYear.value,
                    value: fact.val,
                  });
                }
              }
            }
          }

          yield* store.save(cik, [...filings.values()], numbers);
          return { filings: filings.size, numbers: numbers.length, unexpected };
        });

      const filings = (cik: number) =>
        collectFilings(cik).pipe(
          Effect.provideService(Sec, sec),
          Effect.provideService(SqlClient, sql),
        );

      const businessDescription = (cik: number) =>
        Effect.gen(function* () {
          const latest = yield* sql<{ accession: string; primary_document: string }>`
            SELECT accession, primary_document FROM company_filing
            WHERE cik = ${cik} AND form = '10-K' AND primary_document IS NOT NULL
            ORDER BY filed_on DESC LIMIT 1
          `;
          const filing = latest[0];
          if (filing === undefined) return;
          const html = yield* sec.getText(
            `https://www.sec.gov/Archives/edgar/data/${cik}/${filing.accession.replaceAll("-", "")}/${filing.primary_document}`,
          );
          yield* sql`
            UPDATE company SET
              description = ${openingOfBusiness(html)},
              description_accession = ${filing.accession}
            WHERE cik = ${cik}
          `;
        }).pipe(Effect.ignore);

      return Collect.of({ reportedNumbers, filings, businessDescription });
    }),
  );
}
