import { Context, Data, Effect, Layer, Schema } from "effect";
import { Sec, type SecError } from "./sec";

export const submissionsUrl = (cik: number) =>
  `https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`;

const Submissions = Schema.Struct({
  name: Schema.String,
  sic: Schema.String,
  filings: Schema.Struct({
    recent: Schema.Struct({ form: Schema.Array(Schema.String) }),
  }),
});

export type Coverage =
  | { readonly covered: true }
  | { readonly covered: false; readonly reason: string };

const annualReports = new Set(["10-K", "10-K/A", "10-KT"]);
const otherAnnualReports = ["20-F", "40-F"];

const inRange = (code: number, from: number, to: number) => code >= from && code <= to;

// Industry codes are the SEC's Standard Industrial Classification.
export const coverageOf = (company: {
  readonly name: string;
  readonly sic: string;
  readonly forms: ReadonlyArray<string>;
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
  if (!company.forms.some((form) => annualReports.has(form))) {
    const other = otherAnnualReports.find((form) => company.forms.includes(form));
    return {
      covered: false,
      reason:
        other === undefined
          ? `${company.name} has not filed an annual report (10-K) recently, so it is not covered yet.`
          : `${company.name} files a ${other} each year instead of an annual report (10-K), and follows different accounting rules, so it is not covered yet.`,
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
            return coverageOf({
              name: submissions.name,
              sic: submissions.sic,
              forms: submissions.filings.recent.form,
            });
          }),
      });
    }),
  );
}
