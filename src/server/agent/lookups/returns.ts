import { type CheckedFigure, valueOf } from "../../../shared/figures";
import type { LookupResult } from "../../../shared/lookups";
import { money, percent } from "../../../shared/format";
import type { StatementYear } from "../../terms/statements";
import { type CompanyData, filingsOf, last, recent, span } from "./common";

export const returns = (data: CompanyData): LookupResult => {
  const list = recent(data);
  const rough = (year: StatementYear) => {
    const income = valueOf(year.terms.operatingIncome);
    const debt = valueOf(year.terms.debt);
    const equity = valueOf(year.terms.equity);
    if (income === null || debt === null || equity === null || debt + equity <= 0) return null;
    return income / (debt + equity);
  };
  const figures: Record<string, string> = {};
  for (const year of list) {
    const value = rough(year);
    figures[`Operating income for each dollar of debt and equity, fiscal ${year.fiscalYear}`] =
      value === null ? "gap" : percent(value);
  }
  const latest = last(list);
  const write = (figure: CheckedFigure) => {
    const value = valueOf(figure);
    return value === null ? "gap" : money(value);
  };
  figures[`Operating income, fiscal ${latest.fiscalYear}`] = write(latest.terms.operatingIncome);
  figures[`Debt, end of fiscal ${latest.fiscalYear}`] = write(latest.terms.debt);
  figures[`Equity, end of fiscal ${latest.fiscalYear}`] = write(latest.terms.equity);
  return {
    lookup: "returns",
    title: `Operating income, debt and equity, ${span(list)}`,
    detail: "Divided by the tool, before tax",
    figures,
    notes: [
      "This is operating income divided by debt plus equity, before tax. Return on invested capital takes tax out first; the tool does not collect tax on its own line, so this rough version reads higher than the real one.",
    ],
    drawing: {
      kind: "bars",
      title: `Operating income for each dollar of debt and equity, before tax`,
      unit: "share",
      rows: false,
      series: [
        {
          name: "Before tax",
          term: "Return on invested capital",
          tone: "grey",
          points: list.map((year) => ({
            fiscalYear: year.fiscalYear,
            value: rough(year),
          })),
        },
      ],
    },
    filings: filingsOf(data.cik, [latest.terms.operatingIncome, latest.terms.equity]),
  };
};
