import { Data } from "effect";
import { yearsShown } from "../../../shared/company-summary";
import type { CheckedFigure } from "../../../shared/figures";
import type { FilingLink, Shade, Unit } from "../../../shared/lookups";
import { filingUrl, money, percent, perShare, signedPercent } from "../../../shared/format";
import { type FigureKey, ratioKeys } from "../../../shared/figure-keys";
import type { EconomyMonth } from "../../economy";
import type { CorporateEvent } from "../../filings";
import type { StatementYear } from "../../terms/statements";

export type CompanyData = {
  readonly cik: number;
  readonly name: string;
  readonly ticker: string;
  readonly years: ReadonlyArray<StatementYear>;
  readonly events: ReadonlyArray<CorporateEvent>;
  readonly description: {
    readonly text: string;
    readonly accession: string;
    readonly document: string | null;
    readonly filedOn: string;
  } | null;
  readonly months: ReadonlyArray<EconomyMonth>;
  readonly unexpectedNumbers: number;
};

export class LookupProblem extends Data.TaggedError("LookupProblem")<{
  readonly message: string;
}> {}

export const annualReport = "Annual report (10-K)";
export const currentReport = "Current report (8-K)";

export const notCollected = [
  "segments, so the tool cannot split revenue by product or place",
  "the number of shares, so it cannot show dilution",
  "share prices, so it cannot say whether the shares are cheap or worth buying",
  "the text of annual reports before the latest one, so it cannot quote what a company said in earlier years",
  "short-term investments, so cash may read low and net debt high",
  "interest and tax on their own lines, so return on invested capital can only be worked out before tax",
];

export const recent = (company: CompanyData) => company.years.slice(-yearsShown);
export const first = <T>(list: ReadonlyArray<T>) => list[0]!;
export const last = <T>(list: ReadonlyArray<T>) => list.at(-1)!;
export const span = (list: ReadonlyArray<StatementYear>) =>
  `fiscal ${first(list).fiscalYear} to ${last(list).fiscalYear}`;

export const sourceOf = (figure: CheckedFigure | undefined) =>
  figure === undefined
    ? null
    : figure.kind === "reported"
      ? figure.latest
      : figure.kind === "calculated"
        ? (figure.latest ?? null)
        : null;

export const filingsOf = (cik: number, figures: ReadonlyArray<CheckedFigure | undefined>) => {
  const seen = new Map<string, string>();
  for (const figure of figures) {
    const source = sourceOf(figure);
    if (source !== null) seen.set(source.accession, source.filedOn);
  }
  return [...seen]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 3)
    .map(([accession, filedOn]): FilingLink => ({
      form: annualReport,
      filedOn,
      url: filingUrl(cik, accession),
    }));
};

export const pickYear = (company: CompanyData, asked: number | undefined) => {
  if (asked === undefined) return last(company.years);
  const year = company.years.find((each) => each.fiscalYear === asked);
  if (year === undefined) {
    throw new LookupProblem({
      message: `${company.name} has no fiscal ${asked} collected. Collected: ${span(company.years)}.`,
    });
  }
  return year;
};

export const unitOf = (key: FigureKey, asShare: boolean): Unit =>
  asShare || ratioKeys.has(key) ? "share" : key === "earningsPerShare" ? "perShare" : "money";

export const writeValue = (unit: Unit, value: number) =>
  unit === "share"
    ? percent(value)
    : unit === "perShare"
      ? perShare(value)
      : unit === "cents"
        ? `${value}¢`
        : unit === "change"
          ? signedPercent(value)
          : money(value);

export const perDollar = (ratio: number) =>
  ratio >= 1 ? `$${ratio.toFixed(2)}` : `${Math.round(ratio * 100)}¢`;

const monthsOf = (company: CompanyData, year: StatementYear) =>
  company.months.filter(
    (month) => month.month >= year.startOn.slice(0, 7) && month.month <= year.endOn.slice(0, 7),
  );

export const recessionYears = (company: CompanyData) =>
  company.years
    .filter((year) => monthsOf(company, year).some((month) => month.recession))
    .map((year) => year.fiscalYear);

export const risingRateYears = (company: CompanyData) =>
  company.years
    .filter((year) => {
      const rates = monthsOf(company, year).flatMap((month) =>
        month.interestRate === null ? [] : [month.interestRate],
      );
      return rates.length > 1 && last(rates) - first(rates) >= 1;
    })
    .map((year) => year.fiscalYear);

export const shadesFor = (company: CompanyData): ReadonlyArray<Shade> => [
  ...recessionYears(company).map((fiscalYear) => ({
    fiscalYear,
    why: "recession" as const,
  })),
  ...risingRateYears(company).map((fiscalYear) => ({
    fiscalYear,
    why: "rates" as const,
  })),
];
