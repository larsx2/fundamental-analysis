import { valueOf } from "../../../shared/figures";
import type { LookupResult } from "../../../shared/lookups";
import { money } from "../../../shared/format";
import type { StatementYear } from "../../terms/statements";
import { type CompanyData, recent, first, last, span, filingsOf, perDollar } from "./common";

export const cash = (data: CompanyData): LookupResult => {
  const list = recent(data);
  const net = (year: StatementYear) => valueOf(year.terms.netIncome);
  const free = (year: StatementYear) => valueOf(year.terms.freeCashFlow);
  const figures: Record<string, string> = {};
  for (const year of list) {
    const n = net(year);
    const f = free(year);
    figures[`Net income, fiscal ${year.fiscalYear}`] = n === null ? "gap" : money(n);
    figures[`Free cash flow, fiscal ${year.fiscalYear}`] = f === null ? "gap" : money(f);
  }
  const latest = last(list);
  const flow = valueOf(latest.terms.operatingCashFlow);
  const spend = valueOf(latest.terms.capitalExpenditure);
  if (flow !== null) figures[`Operating cash flow, fiscal ${latest.fiscalYear}`] = money(flow);
  if (spend !== null) figures[`Capital expenditure, fiscal ${latest.fiscalYear}`] = money(spend);
  const both = list.filter((year) => net(year) !== null && free(year) !== null);
  const netTotal = both.reduce((total, year) => total + net(year)!, 0);
  const freeTotal = both.reduce((total, year) => total + free(year)!, 0);
  if (both.length > 1 && netTotal > 0) {
    figures[
      `Free cash flow for each dollar of net income, fiscal ${first(both).fiscalYear} to ${last(both).fiscalYear}`
    ] = perDollar(freeTotal / netTotal);
    figures["Fiscal years counted"] = String(both.length);
  }
  return {
    lookup: "cash",
    title: `Net income and free cash flow, ${span(list)}`,
    detail:
      "Free cash flow worked out by the tool from operating cash flow and capital expenditure",
    figures,
    notes: [
      "Free cash flow is operating cash flow minus capital expenditure.",
      "Net income can differ from cash, because some costs and income are counted before or after the cash moves.",
    ],
    drawing: {
      kind: "bars",
      title: `Net income and free cash flow, ${span(list)}`,
      unit: "money",
      rows: false,
      series: [
        {
          name: "Net income",
          term: "Net income",
          tone: "kept",
          points: list.map((year) => ({
            fiscalYear: year.fiscalYear,
            value: net(year),
          })),
        },
        {
          name: "Free cash flow",
          term: "Free cash flow",
          tone: "soft",
          points: list.map((year) => ({
            fiscalYear: year.fiscalYear,
            value: free(year),
          })),
        },
      ],
    },
    filings: filingsOf(data.cik, [
      latest.terms.netIncome,
      latest.terms.operatingCashFlow,
      latest.terms.capitalExpenditure,
    ]),
  };
};
