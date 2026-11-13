import { type CheckedFigure, valueOf, isDoubtful } from "../../../shared/figures";
import type { LookupResult } from "../../../shared/lookups";
import { money } from "../../../shared/format";
import { type FigureKey, figureOf } from "../../../shared/figure-keys";
import { type CompanyData, filingsOf, pickYear, sourceOf, span } from "./common";

const markRows: ReadonlyArray<readonly [FigureKey, string]> = [
  ["revenue", "Revenue"],
  ["costOfRevenue", "Cost of revenue"],
  ["grossProfit", "Gross profit"],
  ["researchAndDevelopment", "Research and development"],
  ["sellingGeneralAndAdministrative", "Selling, general and administrative"],
  ["operatingIncome", "Operating income"],
  ["netIncome", "Net income"],
  ["operatingCashFlow", "Operating cash flow"],
  ["capitalExpenditure", "Capital expenditure"],
  ["freeCashFlow", "Free cash flow"],
  ["cash", "Cash"],
  ["debt", "Debt"],
];

const markOf = (figure: CheckedFigure) =>
  figure.kind === "gap"
    ? ("gap" as const)
    : isDoubtful(figure)
      ? ("doubtful" as const)
      : figure.kind === "calculated"
        ? ("calculated" as const)
        : ("reported" as const);

export const marks = (data: CompanyData, input: { readonly fiscalYear: number | undefined }) => {
  const year = pickYear(data, input.fiscalYear);
  const all = data.years.flatMap((each) => Object.values(each.terms));
  const count = (mark: ReturnType<typeof markOf>) =>
    all.filter((figure) => markOf(figure) === mark).length;
  const restated = all.filter(
    (figure) => figure.kind === "reported" && figure.latest.accession !== figure.original.accession,
  ).length;
  return {
    lookup: "marks",
    title: "Marks on every figure",
    detail: `${all.length} figures, ${span(data.years)}`,
    figures: {
      "Figures held": String(all.length),
      "Reported numbers": String(count("reported")),
      "Calculated numbers": String(count("calculated")),
      Gaps: String(count("gap")),
      "Doubtful numbers": String(count("doubtful")),
      "Reported numbers taken from a later annual report than the first": String(restated),
    },
    notes: [
      "A reported number comes straight from an annual report (10-K). When a later report gives the same fiscal year again, the latest one is shown.",
      "A calculated number is worked out by the tool from reported numbers, and says how.",
      "A gap is a figure the company does not report as its own line. It is never shown as zero.",
      "A doubtful number failed one of the tool's checks, and is shown with the check it failed.",
    ],
    drawing: {
      kind: "marks",
      title: `Fiscal ${year.fiscalYear}, figure by figure`,
      rows: markRows.map(([key, name]) => {
        const figure = figureOf(year, key);
        const value = valueOf(figure);
        return {
          name,
          value: value === null ? "" : money(value),
          mark: markOf(figure),
          filedOn: sourceOf(figure)?.filedOn ?? null,
        };
      }),
    },
    filings: filingsOf(data.cik, [year.terms.revenue]),
  } satisfies LookupResult;
};
