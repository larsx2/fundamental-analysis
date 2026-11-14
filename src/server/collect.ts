import { Array as Arr, Context, Data, Effect, Layer, Option, Result, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";
import { openingOfBusiness } from "./business-description";
import { paragraphsOf } from "./report-text";
import {
  addFilings,
  annualReportForms,
  collectFilings,
  type CompanyFiling,
  newFilings,
} from "./filings";
import { fiscalYearOf } from "./fiscal-year";
import { type Filing, type ReportedNumber, ReportedNumbers } from "./reported-numbers";
import { Sec, type SecError } from "./sec";

export const companyFactsUrl = (cik: number) =>
  `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, "0")}.json`;

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
    readonly newFilings: (
      cik: number,
    ) => Effect.Effect<ReadonlyArray<CompanyFiling>, SecError | Schema.SchemaError | SqlError>;
    readonly addFilings: (
      cik: number,
      filings: ReadonlyArray<CompanyFiling>,
    ) => Effect.Effect<void, SqlError>;
    // Reads the latest annual report: the opening of its business description,
    // and its paragraphs for the agent to search. A report that cannot be read
    // leaves a gap; it never fails a company.
    readonly annualReport: (cik: number) => Effect.Effect<void>;
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
                  // Corrected and transition annual reports count too. Where a
                  // number appears in more than one, the latest filed is shown.
                  if (!annualReportForms.has(fact.form)) continue;
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

      const annualReport = (cik: number) =>
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
          const paragraphs = paragraphsOf(html).map((paragraph) => ({
            cik,
            accession: filing.accession,
            line: paragraph.line,
            heading: paragraph.heading ? 1 : 0,
            section: paragraph.section,
            text: paragraph.text,
          }));
          yield* Effect.gen(function* () {
            yield* sql`
              UPDATE company SET
                description = ${openingOfBusiness(html)},
                description_accession = ${filing.accession}
              WHERE cik = ${cik}
            `;
            yield* sql`DELETE FROM report_paragraph WHERE cik = ${cik}`;
            if (Arr.isReadonlyArrayNonEmpty(paragraphs)) {
              for (const chunk of Arr.chunksOf(paragraphs, 200)) {
                yield* sql`INSERT INTO report_paragraph ${sql.insert(chunk)}`;
              }
            }
          }).pipe(sql.withTransaction);
        }).pipe(
          Effect.ignoreCause({
            log: "Warn",
            message: `Could not read the latest annual report of company ${cik}`,
          }),
        );

      return Collect.of({
        reportedNumbers,
        filings,
        newFilings: (cik) =>
          newFilings(cik).pipe(
            Effect.provideService(Sec, sec),
            Effect.provideService(SqlClient, sql),
          ),
        addFilings: (cik, list) =>
          addFilings(cik, list).pipe(Effect.provideService(SqlClient, sql)),
        annualReport,
      });
    }),
  );
}
