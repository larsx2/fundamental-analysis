import { Clock, Context, Data, Effect, Layer, Schema } from "effect";
import { annualReportForms } from "./filings";
import { Sec, type SecError } from "./sec";

export const submissionsUrl = (cik: number) =>
  `https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`;

const Submissions = Schema.Struct({
  name: Schema.String,
  sic: Schema.String,
  filings: Schema.Struct({
    recent: Schema.Struct({
      form: Schema.Array(Schema.String),
      filingDate: Schema.Array(Schema.String),
    }),
  }),
});

export type Coverage =
  | { readonly covered: true }
  | { readonly covered: false; readonly reason: string };

const otherAnnualReports = ["20-F", "40-F"];

// Annual reports are due within three months of the fiscal year end, so an
// active company has filed one within the last fifteen months. Three more
// months leave room for late filers.
const activeWindowDays = 18 * 30;
const dayMillis = 24 * 60 * 60 * 1000;

const inRange = (code: number, from: number, to: number) => code >= from && code <= to;

// Industry codes are the SEC's Standard Industrial Classification.
export const coverageOf = (company: {
  readonly name: string;
  readonly sic: string;
  readonly filings: ReadonlyArray<{ readonly form: string; readonly date: string }>;
  readonly today: Date;
}): Coverage => {
  const code = Number(company.sic);
  if (inRange(code, 6000, 6199)) {
    return {
      covered: false,
      reason: `${company.name} is a bank or lender. Banks have no cost of revenue or gross profit, so they are not covered yet.`,
    };
  }
  if (inRange(code, 6300, 6411)) {
    return {
      covered: false,
      reason: `${company.name} is an insurer. Insurers have no cost of revenue or gross profit, so they are not covered yet.`,
    };
  }
  if (code === 6798) {
    return {
      covered: false,
      reason: `${company.name} is a property trust. Property trusts are judged with their own measures, which the glossary does not hold yet, so they are not covered yet.`,
    };
  }
  const forms = company.filings.map((filing) => filing.form);
  const annual = company.filings.filter((filing) => annualReportForms.has(filing.form));
  if (annual.length === 0) {
    const other = otherAnnualReports.find((form) => forms.includes(form));
    return {
      covered: false,
      reason:
        other === undefined
          ? `${company.name} has not filed an annual report (10-K) recently, so it is not covered yet.`
          : `${company.name} files a ${other} each year instead of an annual report (10-K), and follows different accounting rules, so it is not covered yet.`,
    };
  }
  const newest =
    annual
      .map((filing) => filing.date)
      .sort()
      .at(-1) ?? "";
  const age = (company.today.getTime() - Date.parse(newest)) / dayMillis;
  if (!(age <= activeWindowDays)) {
    return {
      covered: false,
      reason: `${company.name} filed its last annual report (10-K) on ${newest}, so it looks no longer active and is not covered.`,
    };
  }
  return { covered: true };
};

export class UnexpectedSubmissions extends Data.TaggedError("UnexpectedSubmissions")<{
  readonly cik: number;
  readonly cause: unknown;
}> {
  override get message() {
    return `The SEC's record of company ${this.cik} arrived in an unexpected shape.`;
  }
}

export class CoverageCheck extends Context.Service<
  CoverageCheck,
  {
    readonly check: (cik: number) => Effect.Effect<Coverage, SecError | UnexpectedSubmissions>;
  }
>()("CoverageCheck") {
  static readonly layer = Layer.effect(
    CoverageCheck,
    Effect.gen(function* () {
      const sec = yield* Sec;
      return CoverageCheck.of({
        check: (cik) =>
          Effect.gen(function* () {
            const raw = yield* sec.getJson(submissionsUrl(cik));
            const submissions = yield* Schema.decodeUnknownEffect(Submissions)(raw).pipe(
              Effect.mapError((cause) => new UnexpectedSubmissions({ cik, cause })),
            );
            const { form, filingDate } = submissions.filings.recent;
            const now = yield* Clock.currentTimeMillis;
            return coverageOf({
              name: submissions.name,
              sic: submissions.sic,
              filings: form.map((each, index) => ({ form: each, date: filingDate[index] ?? "" })),
              today: new Date(now),
            });
          }),
      });
    }),
  );
}
